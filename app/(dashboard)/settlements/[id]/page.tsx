import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDot,
  ClipboardList,
  FileCheck2,
  FileText,
  Landmark,
  MessageSquareText,
  Network,
  NotebookPen,
  Radio,
  Scale,
  ShieldCheck,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { SettlementStatus } from "@prisma/client";
import { SettlementWorkspaceLifecycle } from "@/components/dashboard/settlement-workspace-lifecycle";
import { FinalityReview, type FinalityReviewData } from "@/components/dashboard/finality-review";
import { StatusBadge } from "@/components/ops/status-badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { isMfaStepUpFresh, requireSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { transitionSettlement } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { assessFinality } from "@/lib/finality";
import {
  buildFinalityInput,
  hasAuditApproval,
  latestProofOf,
  relevantReconciliationOf,
} from "@/lib/finality-input";
import {
  approvalMfaViolation,
  canApproveSettlement,
  canViewSensitiveFinancialData,
  canWriteSettlement,
  roleErrorMessage,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { configuredProviderCatalog } from "@/lib/providers/registry";
import {
  checkSettlementProviderStatus,
  executeSettlementWithProvider,
} from "@/lib/providers/service";
import {
  RECONCILIATION_SOURCE_LABEL,
  isIndependentReconciliationSource,
} from "@/lib/reconciliation";
import { lifecycleApprovalViolation } from "@/lib/settlement-actions";
import { deriveSettlementWorkflow } from "@/lib/settlement-workspace";
import { getShadowConfig, safetyFor } from "@/lib/shadow-mode";
import {
  cn,
  formatCurrencyFull,
  formatDateTime,
  maskFinancialIdentifier,
} from "@/lib/utils";

export const metadata = { title: "Settlement workspace" };

function workspaceUrl(id: string, params?: Record<string, string>) {
  const search = new URLSearchParams(params);
  const query = search.toString();
  return `/settlements/${id}${query ? `?${query}` : ""}`;
}

function revalidateWorkspace(id: string) {
  revalidatePath(`/settlements/${id}`);
  revalidatePath("/settlements");
  revalidatePath("/dashboard");
}

async function advanceSettlement(formData: FormData) {
  "use server";
  const { user, organization, membership, session } = await requireSession();
  const settlementId = String(formData.get("settlementId") ?? "");
  const targetStatus = String(formData.get("status") ?? "") as SettlementStatus;
  const providerCode = String(formData.get("providerCode") ?? "").trim();

  if (!canApproveSettlement(membership.role)) {
    redirect(workspaceUrl(settlementId, { error: roleErrorMessage(membership.role) }));
  }

  if (targetStatus === SettlementStatus.APPROVED) {
    const mfaViolation = approvalMfaViolation({
      requireMfaForApproval: organization.settings?.requireMfaForApproval ?? true,
      mfaEnabled: user.mfaEnabled,
      mfaStepUpFresh: isMfaStepUpFresh(session),
    });
    if (mfaViolation) redirect(workspaceUrl(settlementId, { error: mfaViolation }));

    const target = await prisma.settlement.findFirst({
      where: { id: settlementId, organizationId: organization.id },
      select: { createdById: true },
    });
    const dualControlViolation = lifecycleApprovalViolation({
      targetStatus,
      creatorId: target?.createdById,
      approverId: user.id,
    });
    if (dualControlViolation) {
      redirect(workspaceUrl(settlementId, { error: dualControlViolation }));
    }
  }

  try {
    if (targetStatus === SettlementStatus.EXECUTING && providerCode) {
      const result = await executeSettlementWithProvider(
        providerCode,
        settlementId,
        user.id,
        organization.id,
      );
      if (result.settlementStatus === SettlementStatus.FAILED) {
        redirect(
          workspaceUrl(settlementId, {
            error: "The provider reported that execution failed.",
          }),
        );
      }
    } else {
      await transitionSettlement(
        settlementId,
        targetStatus,
        user.id,
        organization.id,
        "Updated from the Settlement Workspace.",
      );
    }
  } catch (error) {
    redirect(workspaceUrl(settlementId, { error: friendlyErrorMessage(error) }));
  }

  revalidateWorkspace(settlementId);
  redirect(workspaceUrl(settlementId, { success: targetStatus.toLowerCase() }));
}

async function checkProvider(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  const settlementId = String(formData.get("settlementId") ?? "");
  if (!canApproveSettlement(membership.role)) {
    redirect(workspaceUrl(settlementId, { error: roleErrorMessage(membership.role) }));
  }
  try {
    await checkSettlementProviderStatus(settlementId, user.id, organization.id);
  } catch (error) {
    redirect(workspaceUrl(settlementId, { error: friendlyErrorMessage(error) }));
  }
  revalidateWorkspace(settlementId);
  redirect(workspaceUrl(settlementId, { success: "provider_checked" }));
}

async function addInternalNote(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  const settlementId = String(formData.get("settlementId") ?? "");
  if (!canWriteSettlement(membership.role)) {
    redirect(workspaceUrl(settlementId, { error: roleErrorMessage(membership.role) }));
  }
  const note = String(formData.get("note") ?? "").trim();
  if (!note) redirect(workspaceUrl(settlementId, { error: "Write a note before saving." }));
  if (note.length > 1200) {
    redirect(workspaceUrl(settlementId, { error: "Internal notes are limited to 1,200 characters." }));
  }

  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, organizationId: organization.id },
    select: { publicId: true },
  });
  if (!settlement) redirect("/settlements");

  await writeAuditLog({
    action: "settlement.note_added",
    resourceType: "settlement",
    resourceId: settlementId,
    organizationId: organization.id,
    userId: user.id,
    after: { note, publicId: settlement.publicId },
  });
  revalidateWorkspace(settlementId);
  redirect(workspaceUrl(settlementId, { success: "note_added" }) + "#activity");
}

function noteFromAudit(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const note = (value as Record<string, unknown>).note;
  return typeof note === "string" ? note : null;
}

function operationSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const entries = Object.entries(record)
    .filter(([, item]) => ["string", "number", "boolean"].includes(typeof item))
    .slice(0, 3);
  return entries.length ? entries.map(([key, item]) => `${key}: ${String(item)}`).join(" · ") : null;
}

function WorkspaceSection({
  id,
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  icon: typeof Network;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("workspace-section scroll-mt-28", className)}>
      <header>
        <div className="workspace-section__icon">
          <Icon aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="workspace-section__body">{children}</div>
    </section>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="workspace-fact">
      <dt>{label}</dt>
      <dd className={cn(mono && "font-mono text-[12px]")}>{value}</dd>
    </div>
  );
}

export default async function SettlementWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { organization, membership } = await requireSession();
  const { id } = await params;
  const query = await searchParams;

  const [settlement, auditLogs] = await Promise.all([
    prisma.settlement.findFirst({
      where: { id, organizationId: organization.id },
      include: {
        quote: true,
        createdBy: { select: { id: true, name: true, email: true } },
        events: { orderBy: { createdAt: "asc" } },
        reconciliation: true,
        providerProofs: { orderBy: { receivedAt: "desc" } },
        providerOperations: { orderBy: { createdAt: "desc" } },
        providerConnection: true,
        executionInstruction: { select: { id: true, updatedAt: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        organizationId: organization.id,
        resourceType: "settlement",
        resourceId: id,
      },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);
  if (!settlement) notFound();

  const canViewSensitive = canViewSensitiveFinancialData(membership.role);
  const canOperate = canApproveSettlement(membership.role);
  const canAddNote = canWriteSettlement(membership.role);
  const reconciliationRecords = [...settlement.reconciliation].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const assessment = assessFinality(
    buildFinalityInput(
      settlement,
      settlement.providerProofs,
      reconciliationRecords,
      settlement.events,
      safetyFor(settlement, getShadowConfig()),
    ),
  );
  const proof = latestProofOf(settlement.providerProofs);
  const reconciliation = relevantReconciliationOf(reconciliationRecords);
  const finalityApproval = auditLogs.find((log) => log.action === "settlement.finality_approved");
  const providerException = settlement.providerOperations.find(
    (operation) => operation.status === "FAILED" || operation.status === "REVIEW_REQUIRED",
  );
  const reconciliationException = reconciliationRecords.find(
    (record) => record.status === "EXCEPTION" || record.status === "UNMATCHED",
  );
  const providerAccepted = Boolean(
    settlement.providerTransactionId ||
      settlement.providerOperations.some((operation) =>
        ["SUCCEEDED", "RESOLVED_BY_STATUS"].includes(operation.status),
      ),
  );

  const workflow = deriveSettlementWorkflow(
    {
      status: settlement.status,
      quoteLocked: Boolean(settlement.quoteId),
      approved: Boolean(settlement.approvedAt),
      fundingStatus: settlement.fundingStatus,
      providerAccepted,
      proofReceived: settlement.providerProofs.length > 0,
      reconciliationMatched: reconciliationRecords.some(
        (record) =>
          record.status === "MATCHED" && isIndependentReconciliationSource(record.source),
      ),
      reconciliationException: reconciliationException?.exceptionReason ?? null,
      finalityReady: assessment.decision === "ready_to_finalize",
      finalityApproved: Boolean(finalityApproval),
      failureReason: settlement.failureReason,
      providerException: providerException?.errorMessage ?? null,
      finalityBlockers: assessment.blockingIssues,
    },
    settlement.id,
  );

  const finalityData: FinalityReviewData = {
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
              ? formatCurrencyFull(String(proof.actualAmount), proof.currency)
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

  const readyConnections = await prisma.providerConnection.findMany({
    where: {
      organizationId: organization.id,
      status: { in: ["INTEGRATION_VERIFIED", "COMMERCIAL_READY"] },
    },
    select: { providerCode: true },
  });
  const readyCodes = new Set(readyConnections.map((connection) => connection.providerCode));
  const availableProviders = configuredProviderCatalog().filter(
    (provider) =>
      readyCodes.has(provider.code) && provider.supportedCorridors.includes(settlement.corridor),
  );
  const notes = auditLogs
    .filter((log) => log.action === "settlement.note_added")
    .map((log) => ({ ...log, note: noteFromAudit(log.after) }))
    .filter((log): log is typeof log & { note: string } => Boolean(log.note));
  const apiEvents = [
    ...settlement.providerOperations.map((operation) => ({
      id: operation.id,
      label: `${operation.operationType.replaceAll("_", " ")} · ${operation.status.replaceAll("_", " ")}`,
      detail:
        operation.errorMessage ??
        operationSummary(operation.responseSummary) ??
        operationSummary(operation.requestSummary) ??
        `Attempt ${operation.attemptCount}`,
      at: operation.updatedAt,
      tone:
        operation.status === "FAILED" || operation.status === "REVIEW_REQUIRED"
          ? ("danger" as const)
          : operation.status === "SUCCEEDED" || operation.status === "RESOLVED_BY_STATUS"
            ? ("success" as const)
            : ("neutral" as const),
    })),
    ...auditLogs
      .filter((log) => log.actorType === "API")
      .map((log) => ({
        id: log.id,
        label: log.action.replaceAll("_", " ").replaceAll(".", " · "),
        detail: log.requestId ? `Request ${log.requestId}` : "Authenticated API action",
        at: log.createdAt,
        tone: "neutral" as const,
      })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const timeline = [
    ...settlement.events.map((event) => ({
      id: `event-${event.id}`,
      label: event.toStatus.replaceAll("_", " "),
      detail: event.note ?? "Settlement lifecycle updated.",
      at: event.createdAt,
      kind: "Lifecycle",
    })),
    ...settlement.providerProofs.map((item) => ({
      id: `proof-${item.id}`,
      label: "Provider proof received",
      detail: `${item.provider} · ${item.providerStatus} · ${item.receivedVia.toLowerCase()}`,
      at: item.receivedAt,
      kind: "Evidence",
    })),
    ...reconciliationRecords.map((item) => ({
      id: `recon-${item.id}`,
      label: `Reconciliation ${item.status.toLowerCase().replaceAll("_", " ")}`,
      detail: `${RECONCILIATION_SOURCE_LABEL[item.source] ?? item.source} · ${item.externalRef}`,
      at: item.updatedAt,
      kind: "Reconciliation",
    })),
    ...auditLogs.slice(0, 30).map((item) => ({
      id: `audit-${item.id}`,
      label: item.action.replaceAll("_", " ").replaceAll(".", " · "),
      detail: item.user?.name ?? item.actorType.toLowerCase(),
      at: item.createdAt,
      kind: "Audit",
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 28);

  const currentAction =
    settlement.status === SettlementStatus.REQUESTED ||
    settlement.status === SettlementStatus.PENDING_APPROVAL ||
    settlement.status === SettlementStatus.QUOTED
      ? "approve"
      : settlement.status === SettlementStatus.APPROVED && workflow.currentIndex >= 6
        ? "execute"
        : settlement.status === SettlementStatus.EXECUTING
          ? "check"
          : "review";

  const successMessage: Record<string, string> = {
    approved: "Approval recorded. The settlement can move to provider execution.",
    executing: "Provider execution started.",
    provider_checked: "Provider status refreshed.",
    note_added: "Internal note added to the audit trail.",
  };

  return (
    <div className="settlement-workspace">
      <div className="workspace-breadcrumb">
        <Link href="/settlements">
          <ArrowLeft aria-hidden="true" />
          Settlements
        </Link>
        <span>/</span>
        <span>{settlement.publicId}</span>
      </div>

      <header className="workspace-hero">
        <div className="workspace-hero__main">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={settlement.status} />
            <span className="workspace-stage-chip">{workflow.currentStage.label}</span>
            {workflow.blockers.length ? (
              <span className="workspace-risk-chip">Blocked · {workflow.blockers.length}</span>
            ) : null}
          </div>
          <h1>{settlement.publicId}</h1>
          <p>{settlement.reference}</p>
        </div>
        <div className="workspace-hero__amount">
          <span>Settlement amount</span>
          <strong>{formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency)}</strong>
          <small>
            {settlement.corridor.replace("_", " → ")} ·{" "}
            {formatCurrencyFull(String(settlement.targetAmount), settlement.targetCurrency)}
          </small>
        </div>
      </header>

      <nav className="workspace-anchor-nav" aria-label="Settlement workspace sections">
        {[
          ["summary", "Summary"],
          ["funding", "Funding"],
          ["provider", "Provider"],
          ["evidence", "Evidence"],
          ["reconciliation", "Reconciliation"],
          ["finality", "Finality"],
          ["activity", "Activity"],
        ].map(([href, label]) => (
          <a key={href} href={`#${href}`}>
            {label}
          </a>
        ))}
      </nav>

      {query.error ? (
        <div className="workspace-flash workspace-flash--error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{query.error}</span>
        </div>
      ) : null}
      {query.success && successMessage[query.success] ? (
        <div className="workspace-flash workspace-flash--success" role="status">
          <Check aria-hidden="true" />
          <span>{successMessage[query.success]}</span>
        </div>
      ) : null}

      <section id="summary" className="workspace-command scroll-mt-28">
        <div className="workspace-command__status">
          <span>Current stage</span>
          <strong>{workflow.currentStage.label}</strong>
          <p>{workflow.currentStage.requirement}</p>
        </div>
        <div>
          <span>Current owner</span>
          <strong>{workflow.currentOwner}</strong>
          <p>Originator: {settlement.createdBy.name}</p>
        </div>
        <div>
          <span>{workflow.blockers.length ? "Blocking completion" : "Next required action"}</span>
          <strong>{workflow.blockers[0] ?? workflow.nextAction}</strong>
          <p>
            {workflow.blockers.length
              ? `${workflow.blockers.length} open issue${workflow.blockers.length === 1 ? "" : "s"}`
              : "No unresolved blocker at the current stage"}
          </p>
        </div>
        <div id="next-action" className="workspace-command__action scroll-mt-28">
          {canOperate && currentAction === "approve" ? (
            <form action={advanceSettlement}>
              <input type="hidden" name="settlementId" value={settlement.id} />
              <input type="hidden" name="status" value="APPROVED" />
              <SubmitButton variant="brand" pendingText="Approving…">
                Approve settlement
              </SubmitButton>
            </form>
          ) : null}
          {canOperate && currentAction === "execute" && availableProviders.length ? (
            availableProviders.map((provider) => (
              <form action={advanceSettlement} key={provider.code}>
                <input type="hidden" name="settlementId" value={settlement.id} />
                <input type="hidden" name="status" value="EXECUTING" />
                <input type="hidden" name="providerCode" value={provider.code} />
                <SubmitButton variant="brand" pendingText={`Submitting to ${provider.displayName}…`}>
                  Execute via {provider.displayName}
                </SubmitButton>
              </form>
            ))
          ) : null}
          {canOperate && currentAction === "execute" && !availableProviders.length ? (
            <Button asChild variant="brand">
              <Link href={`/settlements/${settlement.id}/execution`}>
                Prepare provider execution
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          {canOperate && currentAction === "check" && settlement.provider ? (
            <form action={checkProvider}>
              <input type="hidden" name="settlementId" value={settlement.id} />
              <SubmitButton variant="brand" pendingText="Checking provider…">
                Check provider status
              </SubmitButton>
            </form>
          ) : null}
          {canOperate && currentAction === "check" && !settlement.provider ? (
            <Button asChild variant="brand">
              <Link href={`/settlements/${settlement.id}/execution`}>
                Review execution state
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          {currentAction === "review" || !canOperate ? (
            <Button asChild variant="brand">
              <Link href={workflow.nextActionHref}>
                {workflow.complete ? "Open final report" : canOperate ? "Continue review" : "View required action"}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <SettlementWorkspaceLifecycle workflow={workflow} />

      <div className="workspace-grid">
        <main className="workspace-main">
          <WorkspaceSection
            id="operational-summary"
            icon={ClipboardList}
            title="Operational Summary"
            description="The commercial record, execution boundary and operating identity in one view."
          >
            <dl className="workspace-facts">
              <Fact label="Reference" value={settlement.reference} />
              <Fact label="Corridor" value={settlement.corridor.replace("_", " → ")} />
              <Fact label="Source amount" value={formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency)} />
              <Fact label="Destination amount" value={formatCurrencyFull(String(settlement.targetAmount), settlement.targetCurrency)} />
              <Fact label="Fee" value={formatCurrencyFull(String(settlement.feeAmount), settlement.sourceCurrency)} />
              <Fact label="Operating posture" value={settlement.testMode.replaceAll("_", " ")} />
              <Fact
                label="Source account"
                value={
                  canViewSensitive
                    ? settlement.sourceAccount
                    : maskFinancialIdentifier(settlement.sourceAccount)
                }
                mono
              />
              <Fact
                label="Target account"
                value={
                  canViewSensitive
                    ? settlement.targetAccount
                    : maskFinancialIdentifier(settlement.targetAccount)
                }
                mono
              />
              <Fact label="Created" value={formatDateTime(settlement.createdAt)} />
              <Fact label="Last updated" value={formatDateTime(settlement.updatedAt)} />
            </dl>
          </WorkspaceSection>

          <WorkspaceSection
            id="funding"
            icon={WalletCards}
            title="Funding"
            description="Funding visibility and confirmation stay attached to the settlement."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={`/settlements/${settlement.id}/funding`}>Manage funding</Link>
              </Button>
            }
          >
            <div className="workspace-split">
              <div className="workspace-state-block">
                <span>Funding state</span>
                <StatusBadge status={settlement.fundingStatus} />
                <p>
                  {settlement.fundingStatus === "NOT_REQUIRED"
                    ? "The selected provider flow does not require a separately recorded prefunding step."
                    : settlement.fundingStatus === "FUNDED"
                      ? "The recorded funding requirement is fully confirmed."
                      : "Provider execution remains gated until the funding control is complete."}
                </p>
              </div>
              <dl className="workspace-mini-facts">
                <Fact
                  label="Required"
                  value={
                    settlement.fundingRequired && settlement.fundingCurrency
                      ? formatCurrencyFull(String(settlement.fundingRequired), settlement.fundingCurrency)
                      : "Not recorded"
                  }
                />
                <Fact
                  label="Confirmed"
                  value={
                    settlement.fundedAmount && settlement.fundingCurrency
                      ? formatCurrencyFull(String(settlement.fundedAmount), settlement.fundingCurrency)
                      : "Not recorded"
                  }
                />
              </dl>
            </div>
          </WorkspaceSection>

          <WorkspaceSection
            id="provider"
            icon={Network}
            title="Provider, Communication & Execution"
            description="Execution is external; every request, response and uncertain outcome remains inside this operating record."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={`/settlements/${settlement.id}/execution`}>Execution instruction</Link>
              </Button>
            }
          >
            <div className="workspace-provider-head">
              <div>
                <span>Integrated provider</span>
                <strong>{settlement.provider ?? "Not selected"}</strong>
              </div>
              <div>
                <span>Provider state</span>
                <strong>{settlement.providerStatus?.replaceAll("_", " ") ?? "Awaiting submission"}</strong>
              </div>
              <div>
                <span>Provider reference</span>
                <strong className="font-mono">{settlement.providerTransactionId ?? "Not assigned"}</strong>
              </div>
            </div>
            <div className="workspace-event-list mt-4">
              {settlement.providerOperations.length ? (
                settlement.providerOperations.slice(0, 6).map((operation) => (
                  <div key={operation.id}>
                    <span
                      className={cn(
                        "workspace-event-dot",
                        ["FAILED", "REVIEW_REQUIRED"].includes(operation.status) && "is-danger",
                        ["SUCCEEDED", "RESOLVED_BY_STATUS"].includes(operation.status) && "is-success",
                      )}
                    />
                    <div>
                      <strong>
                        {operation.operationType.replaceAll("_", " ")} ·{" "}
                        {operation.status.replaceAll("_", " ")}
                      </strong>
                      <p>
                        {operation.errorMessage ??
                          operation.resolutionNote ??
                          operationSummary(operation.responseSummary) ??
                          `Attempt ${operation.attemptCount}`}
                      </p>
                    </div>
                    <time>{formatDateTime(operation.updatedAt)}</time>
                  </div>
                ))
              ) : (
                <div className="workspace-empty">
                  <Radio aria-hidden="true" />
                  <div>
                    <strong>No provider communication yet</strong>
                    <p>Requests, callbacks and status checks will appear here after provider submission.</p>
                  </div>
                </div>
              )}
            </div>
          </WorkspaceSection>

          <WorkspaceSection
            id="evidence"
            icon={FileCheck2}
            title="Provider Proof, Evidence & Documents"
            description="Provider claims are retained as evidence inputs; they never establish finality by themselves."
          >
            <div className="workspace-evidence-grid">
              <div>
                <h3>Provider proof</h3>
                {settlement.providerProofs.length ? (
                  <div className="workspace-proof-list">
                    {settlement.providerProofs.slice(0, 4).map((item) => (
                      <article key={item.id}>
                        <div>
                          <StatusBadge status={item.providerStatus} />
                          <span>{item.receivedVia.toLowerCase()}</span>
                        </div>
                        <strong>{item.provider}</strong>
                        <p>
                          {item.providerTransactionId
                            ? `Transaction ${item.providerTransactionId}`
                            : "Provider transaction reference unavailable"}
                        </p>
                        <small>{formatDateTime(item.receivedAt)}</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="workspace-empty">
                    <FileCheck2 aria-hidden="true" />
                    <div>
                      <strong>Provider proof pending</strong>
                      <p>Verified webhook, poll or controlled manual proof will appear here.</p>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h3>Documents</h3>
                <div className="workspace-document-list">
                  <Link href={`/settlements/${settlement.id}/report`}>
                    <FileText aria-hidden="true" />
                    <span>
                      <strong>Settlement evidence report</strong>
                      <small>{workflow.complete ? "Final package available" : "Live evidence package"}</small>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                  <Link href={`/settlements/${settlement.id}/execution`}>
                    <FileText aria-hidden="true" />
                    <span>
                      <strong>Execution instruction</strong>
                      <small>
                        {settlement.executionInstruction
                          ? `Updated ${formatDateTime(settlement.executionInstruction.updatedAt)}`
                          : "Not yet recorded"}
                      </small>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                  {settlement.providerProofs.length ? (
                    <div>
                      <FileCheck2 aria-hidden="true" />
                      <span>
                        <strong>Provider proof bundle</strong>
                        <small>{settlement.providerProofs.length} immutable record{settlement.providerProofs.length === 1 ? "" : "s"}</small>
                      </span>
                      <Check aria-hidden="true" />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </WorkspaceSection>

          <WorkspaceSection
            id="reconciliation"
            icon={Scale}
            title="Reconciliation & Exceptions"
            description="Independent evidence is evaluated separately from the provider claim."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/reconciliation">Open reconciliation queue</Link>
              </Button>
            }
          >
            {reconciliationRecords.length ? (
              <div className="workspace-recon-list">
                {reconciliationRecords.map((record) => (
                  <article key={record.id}>
                    <div>
                      <StatusBadge status={record.status} />
                      <span>
                        {isIndependentReconciliationSource(record.source)
                          ? "Independent source"
                          : "Provider claim only"}
                      </span>
                    </div>
                    <strong>{record.externalRef}</strong>
                    <p>
                      {RECONCILIATION_SOURCE_LABEL[record.source] ?? record.source} ·{" "}
                      {formatCurrencyFull(String(record.amount), record.currency)} · value{" "}
                      {formatDateTime(record.valueDate)}
                    </p>
                    {record.exceptionReason ? <small>{record.exceptionReason}</small> : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="workspace-empty">
                <Landmark aria-hidden="true" />
                <div>
                  <strong>No independent record linked</strong>
                  <p>Match a bank or PSP record after provider execution completes.</p>
                </div>
              </div>
            )}
            <div className={cn("workspace-exception", workflow.blockers.length && "is-open")}>
              {workflow.blockers.length ? (
                <>
                  <AlertTriangle aria-hidden="true" />
                  <div>
                    <strong>{workflow.blockers.length} issue{workflow.blockers.length === 1 ? "" : "s"} blocking completion</strong>
                    <ul>
                      {workflow.blockers.map((blocker, index) => (
                        <li key={`${blocker}-${index}`}>{blocker}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <ShieldCheck aria-hidden="true" />
                  <div>
                    <strong>No open settlement exceptions</strong>
                    <p>Funding, provider and evidence checks have no recorded contradiction.</p>
                  </div>
                </>
              )}
            </div>
          </WorkspaceSection>

          <WorkspaceSection
            id="finality"
            icon={UserRoundCheck}
            title="Finality Review"
            description="A deterministic review of approval, provider proof, independent reconciliation and guardrails."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={`/settlements/${settlement.id}/controls`}>
                  {finalityApproval ? "Review approval" : "Open controlled review"}
                </Link>
              </Button>
            }
          >
            <FinalityReview data={finalityData} />
          </WorkspaceSection>
        </main>

        <aside className="workspace-side">
          <WorkspaceSection
            id="activity"
            icon={CircleDot}
            title="Operational Timeline"
            description="Lifecycle, evidence and operator activity in chronological order."
          >
            <ol className="workspace-timeline">
              {timeline.length ? (
                timeline.map((item) => (
                  <li key={item.id}>
                    <span aria-hidden="true" />
                    <div>
                      <small>{item.kind}</small>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                      <time>{formatDateTime(item.at)}</time>
                    </div>
                  </li>
                ))
              ) : (
                <li>
                  <span aria-hidden="true" />
                  <div>
                    <strong>Settlement created</strong>
                    <p>Activity will accumulate as the workflow progresses.</p>
                  </div>
                </li>
              )}
            </ol>
          </WorkspaceSection>

          <WorkspaceSection
            id="internal-notes"
            icon={NotebookPen}
            title="Internal Notes"
            description="Notes are internal, append-only and captured in the audit trail."
          >
            {canAddNote ? (
              <form action={addInternalNote} className="workspace-note-form">
                <input type="hidden" name="settlementId" value={settlement.id} />
                <label htmlFor="settlement-note">Add a note</label>
                <textarea
                  id="settlement-note"
                  name="note"
                  rows={3}
                  maxLength={1200}
                  placeholder="Record a handoff, decision context or follow-up…"
                  required
                />
                <SubmitButton variant="outline" size="sm" pendingText="Saving note…">
                  Add internal note
                </SubmitButton>
              </form>
            ) : (
              <p className="workspace-muted">Your role can review notes but cannot add operational context.</p>
            )}
            <div className="workspace-note-list">
              {notes.length ? (
                notes.slice(0, 8).map((note) => (
                  <article key={note.id}>
                    <MessageSquareText aria-hidden="true" />
                    <div>
                      <p>{note.note}</p>
                      <small>
                        {note.user?.name ?? "System"} · {formatDateTime(note.createdAt)}
                      </small>
                    </div>
                  </article>
                ))
              ) : (
                <p className="workspace-muted">No internal notes have been added.</p>
              )}
            </div>
          </WorkspaceSection>

          <WorkspaceSection
            id="api-events"
            icon={Radio}
            title="API Events"
            description="Provider requests, responses and authenticated API activity."
          >
            <div className="workspace-api-list">
              {apiEvents.length ? (
                apiEvents.slice(0, 12).map((event) => (
                  <article key={event.id}>
                    <span className={cn(`is-${event.tone}`)} />
                    <div>
                      <strong>{event.label}</strong>
                      {event.detail ? <p>{event.detail}</p> : null}
                      <small>{formatDateTime(event.at)}</small>
                    </div>
                  </article>
                ))
              ) : (
                <p className="workspace-muted">No API events are linked to this settlement yet.</p>
              )}
            </div>
          </WorkspaceSection>

          <WorkspaceSection
            id="audit-trail"
            icon={ShieldCheck}
            title="Audit Trail"
            description="Actor, action and time for every privileged change."
          >
            <div className="workspace-audit-list">
              {auditLogs.length ? (
                auditLogs.slice(0, 18).map((log) => (
                  <article key={log.id}>
                    <span>{log.actorType.slice(0, 1)}</span>
                    <div>
                      <strong>{log.action.replaceAll("_", " ").replaceAll(".", " · ")}</strong>
                      <p>{log.user?.name ?? log.actorType.toLowerCase()}</p>
                    </div>
                    <time>{formatDateTime(log.createdAt)}</time>
                  </article>
                ))
              ) : (
                <p className="workspace-muted">No audit activity is available.</p>
              )}
            </div>
          </WorkspaceSection>
        </aside>
      </div>
    </div>
  );
}
