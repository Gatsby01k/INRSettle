import { Suspense } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { SettlementStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isMfaStepUpFresh, requireSession } from "@/lib/auth";
import { AreaTabs } from "@/components/ops/area-tabs";
import { PageHeader } from "@/components/ops/page-header";
import {
  autoMatchReconciliation,
  createSettlement,
  transitionSettlement,
} from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { assessFinality } from "@/lib/finality";
import { buildFinalityInput, hasAuditApproval, latestProofOf, relevantReconciliationOf } from "@/lib/finality-input";
import {
  INDEPENDENT_RECONCILIATION_SOURCES,
  RECONCILIATION_SOURCE_LABEL,
  isIndependentReconciliationSource,
} from "@/lib/reconciliation";
import { lifecycleApprovalViolation } from "@/lib/settlement-actions";
import { getShadowConfig, safetyFor } from "@/lib/shadow-mode";
import {
  approvalMfaViolation,
  canApproveSettlement,
  canCreateSettlement,
  canViewSensitiveFinancialData,
  roleErrorMessage,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  cn,
  formatCurrencyCompact,
  formatCurrencyFull,
  formatDateTime,
  maskFinancialIdentifier,
} from "@/lib/utils";
import { StatusBadge } from "@/components/ops/status-badge";
import { FilterBar } from "@/components/ops/filter-bar";
import { FormSelect } from "@/components/ops/form-select";
import { SettlementLifecycle } from "@/components/ops/settlement-lifecycle";
import {
  type SettlementDetail,
} from "@/components/dashboard/settlement-detail-sheet";
import {
  SettlementOperationConsoleRow,
  SettlementPageFlash,
  SettlementRowStatusSubtext,
  type SettlementOperationConsoleData,
} from "@/components/dashboard/settlement-operation-console";
import {
  SettlementActionForm,
  SettlementActionsProvider,
  SettlementAutoRefresh,
} from "@/components/dashboard/settlement-auto-refresh";
import { configuredProviderCatalog } from "@/lib/providers/registry";
import {
  checkSettlementProviderStatus,
  executeSettlementWithProvider,
} from "@/lib/providers/service";

function revalidateSettlementsPage() {
  revalidatePath("/settlements");
  revalidatePath("/dashboard/settlements");
}
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/helper-text";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata = { title: "Settlements" };

function pageFlashMessage(value?: string) {
  if (value === "created") return "Settlement created.";
  if (value === "reconciled" || value === "matched") {
    return "Settlement complete — provider execution, reconciliation and audit trail recorded.";
  }
  return null;
}

function hasWorkflowAction(status: SettlementStatus) {
  return new Set<SettlementStatus>([
    SettlementStatus.REQUESTED,
    SettlementStatus.APPROVED,
    SettlementStatus.EXECUTING,
  ]).has(status);
}

function isInFlight(status: SettlementStatus) {
  return new Set<SettlementStatus>([SettlementStatus.APPROVED, SettlementStatus.EXECUTING]).has(status);
}

function isCompleted(status: SettlementStatus) {
  return new Set<SettlementStatus>([SettlementStatus.SETTLED, SettlementStatus.RECONCILED]).has(status);
}

function rowShowsConsole(status: SettlementStatus) {
  return new Set<SettlementStatus>([
    SettlementStatus.APPROVED,
    SettlementStatus.EXECUTING,
    SettlementStatus.SETTLED,
    SettlementStatus.RECONCILED,
  ]).has(status);
}

function successMatchesRow(success: string | undefined, status: SettlementStatus) {
  if (!success) return false;
  const map: Partial<Record<string, SettlementStatus>> = {
    approved: SettlementStatus.APPROVED,
    executing: SettlementStatus.EXECUTING,
    settled: SettlementStatus.SETTLED,
    reconciled: SettlementStatus.RECONCILED,
    matched: SettlementStatus.RECONCILED,
    checked: SettlementStatus.EXECUTING,
  };
  return map[success] === status;
}

/**
 * One dominant operational state + human summary per case (display only).
 * The lifecycle status stays visible; this names what the OPERATOR should
 * care about right now.
 */
function caseOperationalSummary(
  status: SettlementStatus,
  finality: { decision: string; riskLevel: string; reconciliation: { status: string; independent: boolean } | null },
): string {
  if (status === SettlementStatus.REQUESTED) {
    return "Awaiting approval before execution.";
  }
  if (status === SettlementStatus.APPROVED) {
    return "Approved. Start provider execution to begin tracking.";
  }
  if (status === SettlementStatus.EXECUTING) {
    return "Submitted to the provider. Tracking external execution.";
  }
  if (status === SettlementStatus.FAILED) {
    return "Provider reported a terminal failure before money moved.";
  }
  if (status === SettlementStatus.RECONCILED && finality.decision === "ready_to_finalize") {
    return "Proof, independent reconciliation and audit trail agree — safe to finalize.";
  }
  if (status === SettlementStatus.SETTLED || status === SettlementStatus.RECONCILED) {
    const recon = finality.reconciliation;
    if (recon && (recon.status === "UNMATCHED" || recon.status === "EXCEPTION")) {
      return "Provider execution completed, but independent evidence does not match — investigate before finality.";
    }
    if (finality.riskLevel === "high") {
      return "Provider execution completed, but a high-risk issue blocks finality.";
    }
    return "Provider execution completed. Reconciliation is still pending before finality.";
  }
  return "Settlement in progress.";
}

type SettlementRow = Awaited<
  ReturnType<
    typeof prisma.settlement.findMany<{
      include: { events: true; reconciliation: true; providerProofs: true };
    }>
  >
>[number];

/**
 * Builds the serializable "Proof-to-Settlement" case file for the detail
 * sheet. The decision itself comes from the deterministic engine
 * (lib/finality.ts) over the same shared input builder the API route uses —
 * the dashboard and GET /api/settlements/[id]/finality can never disagree.
 */
function toFinalityReviewData(settlement: SettlementRow): SettlementDetail["finality"] {
  const assessment = assessFinality(
    buildFinalityInput(
      settlement,
      settlement.providerProofs,
      settlement.reconciliation,
      settlement.events,
      safetyFor(settlement, getShadowConfig()),
    ),
  );
  const proof = latestProofOf(settlement.providerProofs);
  const reconciliation = relevantReconciliationOf(settlement.reconciliation);

  return {
    decision: assessment.decision,
    riskLevel: assessment.riskLevel,
    confidence: assessment.confidence,
    summary: assessment.summary,
    blockingIssues: assessment.blockingIssues,
    warnings: assessment.warnings,
    evidence: assessment.evidence,
    recommendedActions: assessment.recommendedActions,
    proof: proof
      ? {
          provider: proof.provider,
          providerStatus: proof.providerStatus,
          providerTransactionId: proof.providerTransactionId ?? undefined,
          utr: proof.utr ?? undefined,
          actualAmount:
            proof.actualAmount != null && proof.currency
              ? formatCurrencyFull(proof.actualAmount.toString(), proof.currency)
              : undefined,
          currency: proof.currency ?? undefined,
          receivedVia: proof.receivedVia,
          receivedAt: formatDateTime(proof.receivedAt),
        }
      : null,
    proofCount: settlement.providerProofs.length,
    reconciliation: reconciliation
      ? {
          status: reconciliation.status,
          externalRef: reconciliation.externalRef,
          source: reconciliation.source,
          sourceLabel: RECONCILIATION_SOURCE_LABEL[reconciliation.source] ?? reconciliation.source,
          independent: isIndependentReconciliationSource(reconciliation.source),
          amount: formatCurrencyFull(String(reconciliation.amount), reconciliation.currency),
        }
      : null,
    auditApprovalPresent: hasAuditApproval(settlement, settlement.events),
  };
}

function toSettlementDetail(settlement: SettlementRow, canViewSensitive: boolean): SettlementDetail {
  return {
    publicId: settlement.publicId,
    reference: settlement.reference,
    corridor: settlement.corridor.replace("_", " → "),
    status: settlement.status,
    provider: settlement.provider ?? undefined,
    providerTransactionId: settlement.providerTransactionId ?? undefined,
    fundingStatus: settlement.fundingStatus,
    fundingRequired:
      settlement.fundingRequired && settlement.fundingCurrency
        ? formatCurrencyFull(String(settlement.fundingRequired), settlement.fundingCurrency)
        : undefined,
    fundedAmount:
      settlement.fundedAmount && settlement.fundingCurrency
        ? formatCurrencyFull(String(settlement.fundedAmount), settlement.fundingCurrency)
        : undefined,
    sourceAmount: formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency),
    targetAmount: formatCurrencyFull(String(settlement.targetAmount), settlement.targetCurrency),
    feeAmount: formatCurrencyFull(String(settlement.feeAmount), settlement.sourceCurrency),
    createdAt: formatDateTime(settlement.createdAt),
    approvedAt: settlement.approvedAt ? formatDateTime(settlement.approvedAt) : undefined,
    settledAt: settlement.settledAt ? formatDateTime(settlement.settledAt) : undefined,
    reconciledAt: settlement.reconciledAt ? formatDateTime(settlement.reconciledAt) : undefined,
    sourceAccount: canViewSensitive
      ? settlement.sourceAccount
      : maskFinancialIdentifier(settlement.sourceAccount),
    targetAccount: canViewSensitive
      ? settlement.targetAccount
      : maskFinancialIdentifier(settlement.targetAccount),
    events: settlement.events.map((event) => ({
      label: event.toStatus.replaceAll("_", " "),
      note: event.note ?? undefined,
      at: formatDateTime(event.createdAt),
    })),
    reconciliation: settlement.reconciliation.map((record) => ({
      externalRef: record.externalRef,
      source: record.source,
      status: record.status,
      amount: formatCurrencyFull(String(record.amount), record.currency),
      valueDate: formatDateTime(record.valueDate),
    })),
    finality: toFinalityReviewData(settlement),
  };
}

function toOperationConsoleData(settlement: SettlementRow): SettlementOperationConsoleData {
  return {
    status: settlement.status,
    corridor: settlement.corridor.replace("_", " → "),
    amount: formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency),
    provider: settlement.provider ?? undefined,
    providerStatus: settlement.providerStatus ?? undefined,
    providerTransactionId: settlement.providerTransactionId ?? undefined,
    hasReconciliation: settlement.reconciliation.length > 0,
    hasAuditEvents: settlement.events.length > 0,
  };
}

async function submitSettlement(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canCreateSettlement(membership.role)) {
    redirect(`/settlements?error=${encodeURIComponent(roleErrorMessage(membership.role))}`);
  }
  try {
    await createSettlement(
      {
        quoteId: String(formData.get("quoteId") ?? ""),
        reference: String(formData.get("reference") ?? ""),
        sourceAccount: String(formData.get("sourceAccount") ?? ""),
        targetAccount: String(formData.get("targetAccount") ?? ""),
      },
      user.id,
      organization.id,
    );
  } catch (error) {
    redirect(`/settlements?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  revalidateSettlementsPage();
  redirect("/settlements?success=created");
}

async function transition(formData: FormData) {
  "use server";
  const { user, organization, membership, session } = await requireSession();
  if (!canApproveSettlement(membership.role)) redirect("/settlements");
  const status = String(formData.get("status")) as SettlementStatus;
  const settlementId = String(formData.get("settlementId"));
  const providerCode = String(formData.get("providerCode") ?? "").trim();

  // P1 lifecycle dual-control: the creator may not approve their own
  // settlement (REQUESTED -> APPROVED). Finality dual-control is enforced
  // separately in the shadow console and is unchanged.
  if (status === SettlementStatus.APPROVED) {
    const mfaViolation = approvalMfaViolation({
      requireMfaForApproval: organization.settings?.requireMfaForApproval ?? true,
      mfaEnabled: user.mfaEnabled,
      mfaStepUpFresh: isMfaStepUpFresh(session),
    });
    if (mfaViolation) {
      redirect(`/settlements?error=${encodeURIComponent(mfaViolation)}`);
    }
    const target = await prisma.settlement.findFirst({
      where: { id: settlementId, organizationId: organization.id },
      select: { createdById: true },
    });
    const violation = lifecycleApprovalViolation({
      targetStatus: status,
      creatorId: target?.createdById,
      approverId: user.id,
    });
    if (violation) {
      redirect(`/settlements?error=${encodeURIComponent(violation)}`);
    }
  }

  let finalStatus: string = status;
  try {
    if (status === SettlementStatus.EXECUTING && providerCode) {
      const result = await executeSettlementWithProvider(providerCode, settlementId, user.id, organization.id);
      finalStatus = result.settlementStatus;
    } else if (status === SettlementStatus.EXECUTING) {
      const target = await prisma.settlement.findFirst({
        where: { id: settlementId, organizationId: organization.id },
        select: { testMode: true },
      });
      if (target?.testMode === "CONTROLLED_PILOT") {
        throw new Error("Controlled-pilot execution requires an explicitly selected and activated provider connector.");
      }
      await transitionSettlement(
        settlementId,
        status,
        user.id,
        organization.id,
        "External execution started manually; no provider API connector was invoked.",
      );
    } else {
      await transitionSettlement(settlementId, status, user.id, organization.id, "Updated from dashboard.");
    }
  } catch (error) {
    redirect(`/settlements?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  if (finalStatus === SettlementStatus.FAILED) {
    revalidateSettlementsPage();
    redirect(`/settlements?error=${encodeURIComponent("The provider reported that execution failed.")}`);
  }
  revalidateSettlementsPage();
  redirect(`/settlements?success=${finalStatus.toLowerCase()}`);
}

async function runAutoMatch(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canApproveSettlement(membership.role)) redirect("/settlements");
  const settlementId = String(formData.get("settlementId") ?? "");
  try {
    await autoMatchReconciliation(user.id, organization.id);
  } catch (error) {
    redirect(`/settlements?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  if (settlementId) {
    const settlement = await prisma.settlement.findFirst({
      where: { id: settlementId, organizationId: organization.id },
    });
    if (settlement?.status === SettlementStatus.RECONCILED) {
      revalidateSettlementsPage();
      redirect("/settlements?success=reconciled");
    }
    if (settlement?.status === SettlementStatus.SETTLED) {
      revalidateSettlementsPage();
      redirect(`/settlements?reconcileRequired=${settlementId}`);
    }
  }
  revalidateSettlementsPage();
  redirect("/settlements");
}

async function checkStatus(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canApproveSettlement(membership.role)) redirect("/settlements");
  const settlementId = String(formData.get("settlementId"));
  let result: Awaited<ReturnType<typeof checkSettlementProviderStatus>>;
  try {
    result = await checkSettlementProviderStatus(settlementId, user.id, organization.id);
  } catch (error) {
    redirect(`/settlements?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  if (result.settlementStatus === SettlementStatus.SETTLED || result.settlementStatus === SettlementStatus.RECONCILED) {
    revalidateSettlementsPage();
    redirect("/settlements?success=settled");
  }
  if (result.settlementStatus === SettlementStatus.FAILED) {
    revalidateSettlementsPage();
    redirect(`/settlements?error=${encodeURIComponent(`Provider execution failed (${result.providerStatus ?? "failed"}).`)}`);
  }
  revalidateSettlementsPage();
  redirect("/settlements?success=checked");
}

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    q?: string;
    status?: string;
    reconcileRequired?: string;
    page?: string;
    quoteId?: string;
  }>;
}) {
  const { organization, membership } = await requireSession();
  const params = await searchParams;
  const settlementWhere = { organizationId: organization.id };
  const flashMessage = pageFlashMessage(params.success);
  const justCompleted =
    params.success === "reconciled" || params.success === "matched";
  const canApprove = canApproveSettlement(membership.role);
  // UI mirror of the submitSettlement server gate: read-only / compliance
  // roles browse cases but never see the creation form.
  const canCreate = canCreateSettlement(membership.role);

  const [quotes, settlements, openIndependentRecords, readyProviderConnections] = await Promise.all([
    prisma.quote.findMany({
      where: { organizationId: organization.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.settlement.findMany({
      where: settlementWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        events: { orderBy: { createdAt: "asc" } },
        reconciliation: true,
        providerProofs: { orderBy: { receivedAt: "desc" } },
        executionInstruction: { select: { id: true, updatedAt: true } },
      },
    }),
    // Display-only signal: is there anything for auto-match to work with?
    // Mirrors the auto-match engine's input filter (unlinked + independent).
    prisma.reconciliationRecord.count({
      where: {
        organizationId: organization.id,
        settlementId: null,
        status: { in: ["OPEN", "UNMATCHED"] },
        source: { in: [...INDEPENDENT_RECONCILIATION_SOURCES] },
      },
    }),
    prisma.providerConnection.findMany({
      where: {
        organizationId: organization.id,
        status: { in: ["INTEGRATION_VERIFIED", "COMMERCIAL_READY"] },
      },
      select: { providerCode: true },
    }),
  ]);
  const hasOpenRecords = openIndependentRecords > 0;

  const query = params.q?.toLowerCase().trim() ?? "";

  // Case files: settlement + its full deterministic finality detail, computed
  // once and reused for stats, cards, evidence strips and the detail sheet.
  const canViewSensitive = canViewSensitiveFinancialData(membership.role);
  const caseFiles = settlements.map((settlement) => ({
    settlement,
    detail: toSettlementDetail(settlement, canViewSensitive),
  }));

  const filteredCases = caseFiles.filter(({ settlement }) => {
    const matchesSearch =
      !query ||
      settlement.publicId.toLowerCase().includes(query) ||
      settlement.reference.toLowerCase().includes(query);
    const matchesStatus = !params.status || settlement.status === params.status;
    return matchesSearch && matchesStatus;
  });

  // Pagination (Phase 4.1-lite): the case list never renders unbounded.
  const CASE_PAGE_SIZE = 20;
  const casePage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const casePageCount = Math.max(1, Math.ceil(filteredCases.length / CASE_PAGE_SIZE));
  const pagedCases = filteredCases.slice((casePage - 1) * CASE_PAGE_SIZE, casePage * CASE_PAGE_SIZE);
  const casePageHref = (target: number) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status) sp.set("status", params.status);
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `/settlements?${qs}` : "/settlements";
  };

  const requested = settlements.filter((s) => s.status === SettlementStatus.REQUESTED).length;
  const inFlight = settlements.filter((s) => isInFlight(s.status)).length;
  const reconciledCount = settlements.filter((s) => s.status === SettlementStatus.RECONCILED).length;
  const finalityReadyCount = caseFiles.filter(({ detail }) => detail.finality.decision === "ready_to_finalize").length;
  const needsReviewCount = caseFiles.filter(({ detail }) => detail.finality.decision === "needs_review").length;
  const autoRefreshSettlements = settlements.some(
    (s) =>
      s.status === SettlementStatus.EXECUTING ||
      (s.provider &&
        s.providerStatus &&
        !["completed", "failed", "settled", "reconciled"].includes(s.providerStatus.toLowerCase())),
  );
  const readyProviderCodes = new Set(readyProviderConnections.map((connection) => connection.providerCode));
  const providers = configuredProviderCatalog().filter((provider) => readyProviderCodes.has(provider.code));

  return (
    <SettlementActionsProvider>
    <div className="space-y-4">
      <AreaTabs area="settlements" />
      <PageHeader
        title="Settlement workspace"
        description="Create, approve and operate provider-executed settlements from request through funding, evidence, reconciliation and finality."
        stats={[
          { label: "Requested", value: requested, tone: requested ? ("pending" as const) : ("neutral" as const), href: "/settlements?status=REQUESTED" },
          { label: "In flight", value: inFlight, tone: "info" as const },
          { label: "Needs review", value: needsReviewCount, tone: needsReviewCount ? ("pending" as const) : ("neutral" as const) },
          { label: "Finality ready", value: finalityReadyCount, tone: "ok" as const },
          { label: "Reconciled", value: reconciledCount, tone: "ok" as const, href: "/settlements?status=RECONCILED" },
        ]}
      />

      <SettlementAutoRefresh enabled={autoRefreshSettlements} />

      {params.error && !params.reconcileRequired ? (
        <SettlementPageFlash message={params.error} tone="error" />
      ) : null}
      {flashMessage ? <SettlementPageFlash message={flashMessage} /> : null}

      <div className="ov-reveal ov-reveal-1">
        <Suspense fallback={null}>
          <FilterBar
            searchPlaceholder="Search ID or reference..."
            statusOptions={["REQUESTED", "APPROVED", "EXECUTING", "SETTLED", "RECONCILED"]}
          />
        </Suspense>
        {justCompleted ? (
          <p className="mt-2 text-xs font-semibold text-emerald-700">Settlement completion recorded.</p>
        ) : null}
      </div>

      {filteredCases.length ? (
        <div className="space-y-3">
          {pagedCases.map(({ settlement, detail }) => {
            const rowAutoRefresh =
              settlement.status === SettlementStatus.EXECUTING ||
              Boolean(
                settlement.provider &&
                  settlement.providerStatus &&
                  !["completed", "failed", "settled", "reconciled"].includes(
                    settlement.providerStatus.toLowerCase(),
                  ),
              );
            const showConsole = rowShowsConsole(settlement.status);
            const rowJustUpdated = successMatchesRow(params.success, settlement.status);
            const finality = detail.finality;
            const reconBad =
              finality.reconciliation &&
              (["UNMATCHED", "EXCEPTION"].includes(finality.reconciliation.status) || !finality.reconciliation.independent);
            const reconOk =
              finality.reconciliation && finality.reconciliation.independent && finality.reconciliation.status === "MATCHED";
            const chain = [
              { name: "Provider proof", state: finality.proof ? "ok" : "pending" },
              { name: "Reconciliation", state: reconOk ? "ok" : reconBad ? "bad" : "pending" },
              { name: "Audit trail", state: finality.auditApprovalPresent ? "ok" : "pending" },
              {
                name: "Finality",
                // "Mismatch" is reserved for real evidence contradictions; an
                // in-flight settlement with no proof yet is simply not ready.
                state: finality.decision === "ready_to_finalize" ? "ok" : reconBad ? "bad" : "pending",
              },
            ] as const;
            // The blocker is the FIRST non-verified step; later steps are consequences.
            const blockerIndex = chain.findIndex((step) => step.state !== "ok");
            const operationalSummary = caseOperationalSummary(settlement.status, finality);
            const inFlightCase = (["REQUESTED", "APPROVED", "EXECUTING"] as string[]).includes(settlement.status);
            const awaitingRecon =
              (settlement.status === SettlementStatus.SETTLED || settlement.status === SettlementStatus.RECONCILED) &&
              finality.decision !== "ready_to_finalize";
            // Display-only recommendation, matched to the settlement's actual state.
            const recommendedAction =
              settlement.status === SettlementStatus.REQUESTED
                ? "Approve the settlement to continue."
                : settlement.status === SettlementStatus.EXECUTING
                  ? "Check provider status and record proof when available."
                  : awaitingRecon && settlement.status === SettlementStatus.SETTLED && !reconBad
                    ? "Match this settlement with a bank or PSP record."
                    : finality.decision === "ready_to_finalize"
                      ? "Generate the settlement report and finalize — all three evidence sources agree."
                      : finality.recommendedActions[0] ?? null;
            const settlementProviders = providers.filter((provider) =>
              provider.supportedCorridors.includes(settlement.corridor),
            );

            return (
              <article
                key={settlement.id}
                className={cn(
                  "scase",
                  finality.riskLevel === "high"
                    ? "scase--fin-risk"
                    : finality.decision === "ready_to_finalize"
                      ? "scase--fin-ready"
                      : finality.decision === "needs_review"
                        ? "scase--fin-review"
                        : undefined,
                  showConsole && "settlement-row-active",
                  rowJustUpdated && "settlement-row-highlight",
                )}
              >
                {/* Case header */}
                <div className="scase__header">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/settlements/${settlement.id}`}
                        className="text-[15px] font-semibold tracking-tight text-slate-950 transition-colors hover:text-brand-emerald-ink"
                      >
                        {settlement.publicId}
                      </Link>
                      <StatusBadge status={settlement.status} />
                      <span
                        className={cn(
                          "state-chip",
                          finality.decision === "ready_to_finalize" && "state-chip--ready",
                          finality.decision === "needs_review" && "state-chip--review",
                          finality.decision === "not_ready" && "state-chip--pending",
                        )}
                        title={finality.summary}
                      >
                        {finality.decision === "ready_to_finalize"
                          ? "✓ Finality ready"
                          : finality.decision === "needs_review"
                            ? "Needs review"
                            : "Finality pending"}
                      </span>
                      {finality.riskLevel === "high" ? <span className="state-chip state-chip--risk">High risk</span> : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {settlement.reference}
                      {settlement.provider ? <span className="text-slate-400"> · {settlement.provider}</span> : null}
                      {settlement.providerTransactionId ? (
                        <span className="text-slate-400"> · tx {settlement.providerTransactionId.slice(0, 16)}</span>
                      ) : null}
                    </p>
                    <p className="scase__summary">{operationalSummary}</p>
                    <SettlementRowStatusSubtext status={settlement.status} settlementId={settlement.id} />
                  </div>
                  <div className="scase__fin">
                    <p className="scase__amount" title={formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency)}>
                      {formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency)}
                    </p>
                    <div className="scase__fin-row mt-1.5">
                      <span>Corridor</span>
                      <span className="font-medium text-slate-600">{settlement.corridor.replace("_", " → ")}</span>
                    </div>
                    <div className="scase__fin-row mt-0.5">
                      <span>{settlement.settledAt ? "Settled" : "Created"}</span>
                      <span className="font-medium tabular-nums text-slate-600">
                        {formatDateTime(settlement.settledAt ?? settlement.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Evidence strip + lifecycle rail */}
                <div className="scase__body grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  <div className="evidence-chain evidence-chain--mini" aria-label="Evidence chain">
                    {chain.map((step, index) => {
                      const isBlocker = index === blockerIndex && step.state !== "ok";
                      const isDownstream = blockerIndex >= 0 && index > blockerIndex && step.state !== "ok";
                      return (
                        <div
                          key={step.name}
                          className={cn(
                            "evidence-chain__pillar",
                            `evidence-chain__pillar--${step.state}`,
                            isBlocker && "evidence-chain__pillar--focus",
                            isDownstream && "evidence-chain__pillar--downstream",
                          )}
                        >
                          <span className="evidence-chain__label">{step.name}</span>
                          <span className="evidence-chain__state">
                            {step.state === "ok"
                              ? step.name === "Finality"
                                ? "Ready"
                                : "Verified"
                              : step.state === "bad"
                                ? "Mismatch"
                                : step.name === "Reconciliation" && !finality.proof
                                  ? "Waiting for proof"
                                  : step.name === "Finality"
                                    ? inFlightCase
                                      ? "Not ready"
                                      : "Pending"
                                    : "Pending"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="scase__rail">
                    <SettlementLifecycle status={settlement.status} />
                  </div>
                </div>

                {recommendedAction ? (
                  <div className={cn("scase__next", finality.decision === "ready_to_finalize" && "scase__next--ready")}>
                    <span className="text-[10px] font-bold uppercase tracking-[0.07em]">
                      {finality.decision === "ready_to_finalize" ? "Ready" : "Next"}
                    </span>
                    <span>
                      <strong className="font-semibold">Recommended action:</strong> {recommendedAction}
                    </span>
                  </div>
                ) : null}

                {/* Case actions */}
                <div className="scase__actions">
                  {canApprove && hasWorkflowAction(settlement.status) ? (
                    <SettlementActionForm
                      settlementId={settlement.id}
                      action={
                        settlement.status === SettlementStatus.REQUESTED
                          ? "approve"
                          : settlement.status === SettlementStatus.APPROVED
                            ? "execute"
                            : "settle"
                      }
                      serverAction={transition}
                      className="flex flex-wrap gap-1.5"
                    >
                      <input type="hidden" name="settlementId" value={settlement.id} />
                      {settlement.status === SettlementStatus.REQUESTED ? (
                        <>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/settlements/${settlement.id}/execution`}>
                              {settlement.executionInstruction ? "Review execution instruction" : "Add execution instruction"}
                            </Link>
                          </Button>
                          <SubmitButton
                            name="status"
                            value="APPROVED"
                            variant="primary"
                            size="sm"
                            pendingText="Approving..."
                            settlementId={settlement.id}
                            action="approve"
                          >
                            Approve settlement
                          </SubmitButton>
                        </>
                      ) : null}
                      {settlement.status === SettlementStatus.APPROVED ? (
                        <>
                          <input type="hidden" name="status" value="EXECUTING" />
                          {settlementProviders.length > 0 ? (
                          settlementProviders.map((provider) => (
                            <SubmitButton
                              key={provider.code}
                              name="providerCode"
                              value={provider.code}
                              variant="primary"
                              size="sm"
                              pendingText={`Sending to ${provider.displayName}...`}
                              settlementId={settlement.id}
                              action="execute"
                            >
                              Execute via {provider.displayName}
                            </SubmitButton>
                          ))
                          ) : (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/settlements/${settlement.id}/execution`}>
                              Prepare provider execution
                            </Link>
                          </Button>
                          )}
                        </>
                      ) : null}
                      {settlement.status === SettlementStatus.EXECUTING && !settlement.provider ? (
                        <SubmitButton
                          name="status"
                          value="SETTLED"
                          variant="primary"
                          size="sm"
                          pendingText="Settling..."
                          settlementId={settlement.id}
                          action="settle"
                        >
                          Settle
                        </SubmitButton>
                      ) : null}
                    </SettlementActionForm>
                  ) : !canApprove ? (
                    <span className="case-chip">Read-only role</span>
                  ) : null}
                  {settlement.status === SettlementStatus.APPROVED || settlement.fundingStatus !== "NOT_REQUIRED" ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/settlements/${settlement.id}/funding`}>
                        Funding · {settlement.fundingStatus.replaceAll("_", " ")}
                      </Link>
                    </Button>
                  ) : null}
                  {/* Reconciliation actions live in ONE place: the embedded console
                      panel below renders them whenever this settlement is SETTLED
                      with no linked record. This top-row fallback only appears when
                      that panel is absent (a record is already linked but finality
                      is not ready), so the actions are never duplicated. */}
                  {awaitingRecon &&
                  settlement.status === SettlementStatus.SETTLED &&
                  settlement.reconciliation.length > 0 ? (
                    <>
                      <Button asChild variant="primary" size="sm">
                        <Link href="/reconciliation">Open reconciliation</Link>
                      </Button>
                      {canApprove && hasOpenRecords ? (
                        <form action={runAutoMatch}>
                          <input type="hidden" name="settlementId" value={settlement.id} />
                          <SubmitButton variant="outline" size="sm" pendingText="Matching...">
                            Run auto-match
                          </SubmitButton>
                        </form>
                      ) : null}
                    </>
                  ) : null}
                  {settlement.status === SettlementStatus.RECONCILED && finality.decision === "ready_to_finalize" ? (
                    <Button asChild variant="primary" size="sm">
                      <Link href={`/settlements/${settlement.id}/report`}>Generate report</Link>
                    </Button>
                  ) : null}
                  {canApprove &&
                  settlement.status === SettlementStatus.EXECUTING &&
                  settlement.provider &&
                  providers.some(
                    (provider) =>
                      provider.supportsStatusPoll &&
                      provider.persistedName.toLowerCase() === settlement.provider?.toLowerCase(),
                  ) ? (
                    <SettlementActionForm settlementId={settlement.id} action="check" serverAction={checkStatus}>
                      <input type="hidden" name="settlementId" value={settlement.id} />
                      <SubmitButton
                        type="submit"
                        variant="primary"
                        size="sm"
                        pendingText="Checking..."
                        settlementId={settlement.id}
                        action="check"
                      >
                        Check provider status
                      </SubmitButton>
                    </SettlementActionForm>
                  ) : null}

                  <span className="scase__actions-spacer" aria-hidden="true" />

                  <Button asChild variant="brand" size="sm">
                    <Link href={`/settlements/${settlement.id}`}>Open workspace</Link>
                  </Button>
                  {isCompleted(settlement.status) ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/settlements/${settlement.id}/controls`}>Finality review</Link>
                    </Button>
                  ) : null}
                  {settlement.status === SettlementStatus.RECONCILED &&
                  finality.decision !== "ready_to_finalize" ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/settlements/${settlement.id}/report`}>Settlement report</Link>
                    </Button>
                  ) : null}
                </div>

                {/* Embedded case console (provider tracking / reconcile) */}
                {showConsole ? (
                  <div className="scase__console">
                    <SettlementOperationConsoleRow
                      asCard
                      settlementId={settlement.id}
                      settlement={toOperationConsoleData(settlement)}
                      autoRefresh={rowAutoRefresh}
                      canReconcile={canApprove}
                      autoMatchAction={runAutoMatch}
                      hasOpenRecords={hasOpenRecords}
                      reconcileRequired={params.reconcileRequired === settlement.id}
                      inlineError={params.reconcileRequired === settlement.id ? params.error : undefined}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
          {casePageCount > 1 ? (
            <div className="ops-panel flex items-center justify-between gap-3 px-4 py-2.5">
              <p className="text-xs tabular-nums text-slate-500">
                {(casePage - 1) * CASE_PAGE_SIZE + 1}–{Math.min(filteredCases.length, casePage * CASE_PAGE_SIZE)} of{" "}
                {filteredCases.length} cases
              </p>
              <div className="flex items-center gap-2">
                {casePage > 1 ? (
                  <Link href={casePageHref(casePage - 1)} className="text-xs font-medium text-slate-600 hover:text-slate-950">
                    ← Previous
                  </Link>
                ) : null}
                <span className="text-xs tabular-nums text-slate-400">
                  {casePage} / {casePageCount}
                </span>
                {casePage < casePageCount ? (
                  <Link href={casePageHref(casePage + 1)} className="text-xs font-medium text-slate-600 hover:text-slate-950">
                    Next →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty-compact ops-panel">
          <span className="empty-compact__icon">
            <Landmark className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight text-slate-900">No settlement cases match</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Create a settlement from an active quote, or adjust search and filters.
            </p>
          </div>
          <Link
            href="/quotes"
            className="shrink-0 rounded-lg border border-[var(--ops-line)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-ops-xs transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            View quotes
          </Link>
        </div>
      )}

      {canCreate ? (
      <Card id="create-settlement" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Create settlement</CardTitle>
          <CardDescription>Only ACTIVE, unexpired quotes appear. The quote becomes ACCEPTED after creation.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettlementActionForm
            settlementId="__create__"
            action="create"
            serverAction={submitSettlement}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"
          >
            <Field label="Quote" hint="Only ACTIVE, unexpired quotes appear." required className="lg:col-span-2">
              <FormSelect
                name="quoteId"
                placeholder="Select quote"
                defaultValue={quotes.some((quote) => quote.id === params.quoteId) ? params.quoteId : undefined}
                required
                disabled={quotes.length === 0}
                options={
                  quotes.length
                    ? quotes.map((quote) => ({
                        value: quote.id,
                        label: `${quote.corridor.replace("_", " → ")} · ${formatCurrencyCompact(String(quote.sourceAmount), quote.sourceCurrency)}`,
                      }))
                    : [{ value: "_none", label: "No active quotes" }]
                }
              />
            </Field>
            <Field label="Reference" htmlFor="reference" hint="Your internal batch identifier." required>
              <Input id="reference" name="reference" required />
            </Field>
            <Field label="Source account" htmlFor="sourceAccount" hint="Account to debit." required>
              <Input id="sourceAccount" name="sourceAccount" required />
            </Field>
            <Field label="Target account" htmlFor="targetAccount" hint="Account to credit." required>
              <Input id="targetAccount" name="targetAccount" required />
            </Field>
            <div className="flex items-end md:col-span-2 lg:col-span-5">
              <SubmitButton
                type="submit"
                variant="primary"
                disabled={quotes.length === 0}
                pendingText="Creating..."
                settlementId="__create__"
                action="create"
              >
                Create settlement
              </SubmitButton>
            </div>
          </SettlementActionForm>
        </CardContent>
      </Card>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--ops-line)] bg-white px-3 py-2">
          <span className="case-chip">Read-only role</span>
          <p className="text-xs text-slate-500">
            You can review settlement cases, but creating settlements requires an operational role.
          </p>
        </div>
      )}
    </div>
    </SettlementActionsProvider>
  );
}
