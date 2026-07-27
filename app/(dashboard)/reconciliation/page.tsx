import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  autoMatchReconciliation,
  bestSettlementMatch,
  confirmReconciliationMatch,
  createReconciliationRecord,
  matchOriginOf,
  rejectReconciliationSuggestion,
  rejectedSettlementIdsOf,
  resolveReconciliationException,
} from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import {
  canRunReconciliationMatch,
  canWriteReconciliation,
  roleErrorMessage,
} from "@/lib/permissions";
import {
  SUGGESTED_MIN_CONFIDENCE,
  compareReconciliationRecord,
  isIndependentReconciliationSource,
  matchReasonFor,
  matchTypeFor,
  MATCH_LABEL,
  RECONCILIATION_SOURCE_LABEL,
} from "@/lib/reconciliation";
import { prisma } from "@/lib/prisma";
import { cn, formatCurrencyFull, formatDateTime } from "@/lib/utils";
import { FlashMessage } from "@/components/ops/flash-message";
import { FilterBar } from "@/components/ops/filter-bar";
import { PageHeader } from "@/components/ops/page-header";
import { AddRecordForm } from "@/components/dashboard/add-record-form";
import { ReconciliationCommandBar } from "@/components/dashboard/reconciliation-command-bar";
import { ReconciliationWorkspace } from "@/components/dashboard/reconciliation-workspace";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata = { title: "Reconciliation" };

const QUEUE_VIEWS = [
  { key: "attention", label: "Needs attention" },
  { key: "suggested", label: "Suggested" },
  { key: "exceptions", label: "Exceptions" },
  { key: "matched", label: "Matched" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All records" },
] as const;

type QueueView = (typeof QUEUE_VIEWS)[number]["key"];

function metadataString(rawPayload: unknown, key: string): string | null {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) return null;
  const value = (rawPayload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * P0 RBAC: every reconciliation mutation requires the operational write set.
 * Reconciliation records are INDEPENDENT finality evidence — read-only and
 * compliance roles must never be able to create or link them.
 */
async function requireReconciliationWriter() {
  const context = await requireSession();
  if (!canWriteReconciliation(context.membership.role)) {
    redirect(`/reconciliation?error=${encodeURIComponent(roleErrorMessage(context.membership.role))}`);
  }
  return context;
}

async function submitRecord(formData: FormData) {
  "use server";
  const { user, organization } = await requireReconciliationWriter();
  const recordMode = String(formData.get("recordMode") || "queue");
  const settlementRaw = String(formData.get("settlementId") || "");
  const exceptionReason = String(formData.get("exceptionReason") || "").trim() || undefined;
  const hasManualSettlement = Boolean(settlementRaw) && settlementRaw !== "_none";

  if (!["queue", "manual", "exception"].includes(recordMode)) {
    redirect(`/reconciliation?error=${encodeURIComponent("Unknown record handling mode.")}`);
  }
  if (recordMode === "manual" && !hasManualSettlement) {
    redirect(`/reconciliation?error=${encodeURIComponent("Select an eligible SETTLED settlement for a manual match.")}`);
  }
  if (recordMode === "exception" && !exceptionReason) {
    redirect(`/reconciliation?error=${encodeURIComponent("Describe the exception before adding it to the queue.")}`);
  }
  if (recordMode !== "manual" && hasManualSettlement) {
    redirect(`/reconciliation?error=${encodeURIComponent("A settlement can only be selected in Manual match mode.")}`);
  }
  if (recordMode !== "exception" && exceptionReason) {
    redirect(`/reconciliation?error=${encodeURIComponent("An exception reason can only be submitted in Flag exception mode.")}`);
  }

  const status = recordMode === "manual" ? "MATCHED" : recordMode === "exception" ? "EXCEPTION" : "OPEN";
  const settlementId = recordMode === "manual" ? settlementRaw : undefined;

  let isManualMatch = false;
  try {
    await createReconciliationRecord(
      {
        externalRef: String(formData.get("externalRef") ?? ""),
        source: String(formData.get("source") ?? ""),
        amount: formData.get("amount"),
        currency: String(formData.get("currency") ?? ""),
        settlementId,
        valueDate: String(formData.get("valueDate") ?? ""),
        status,
        exceptionReason,
      },
      user.id,
      organization.id,
    );
    isManualMatch = status === "MATCHED";
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect(`/reconciliation?success=${isManualMatch ? "manual" : "created"}`);
}

async function runAutoMatch() {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canRunReconciliationMatch(membership.role)) {
    redirect(`/reconciliation?error=${encodeURIComponent(roleErrorMessage(membership.role))}`);
  }
  let result = { matched: 0, scanned: 0 };
  try {
    result = await autoMatchReconciliation(user.id, organization.id);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect(`/reconciliation?success=automatch&matched=${result.matched}&scanned=${result.scanned}`);
}

async function confirmMatch(formData: FormData) {
  "use server";
  const { user, organization } = await requireReconciliationWriter();
  const recordId = String(formData.get("recordId") || "");
  const settlementId = String(formData.get("settlementId") || "");
  if (!recordId || !settlementId || settlementId === "_none") {
    redirect(`/reconciliation?error=${encodeURIComponent("Select an eligible SETTLED settlement to confirm the match.")}`);
  }
  try {
    await confirmReconciliationMatch(recordId, settlementId, user.id, organization.id);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/reconciliation?success=confirmed");
}

async function rejectSuggestion(formData: FormData) {
  "use server";
  const { user, organization } = await requireReconciliationWriter();
  const recordId = String(formData.get("recordId") || "");
  const settlementId = String(formData.get("settlementId") || "");
  try {
    await rejectReconciliationSuggestion(recordId, settlementId, user.id, organization.id);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/reconciliation?success=rejected");
}

async function resolveException(formData: FormData) {
  "use server";
  const { user, organization } = await requireReconciliationWriter();
  const recordId = String(formData.get("recordId") || "");
  const resolutionNote = String(formData.get("resolutionNote") || "").trim();
  if (resolutionNote.length < 6) {
    redirect(`/reconciliation?error=${encodeURIComponent("Add a resolution note describing what was reviewed.")}`);
  }
  try {
    await resolveReconciliationException(recordId, user.id, organization.id, resolutionNote);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/reconciliation?success=resolved");
}

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    q?: string;
    view?: string;
    status?: string;
    matched?: string;
    scanned?: string;
  }>;
}) {
  const { organization, membership } = await requireSession();
  const params = await searchParams;
  // UI mirror of the server-action gates: read-only / compliance roles see
  // the queue but no mutation surfaces (forms are also blocked server-side).
  const canWrite = canWriteReconciliation(membership.role);
  const settlementWhere = { organizationId: organization.id };

  // Auto-match is an explicit operator action (the "Run auto-match" button), never a
  // side effect of opening the page or saving a record. Saving an external record
  // leaves it OPEN until the engine or an operator reconciles it.

  const [records, settledCandidates] = await Promise.all([
    prisma.reconciliationRecord.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { settlement: true },
    }),
    prisma.settlement.findMany({
      where: { ...settlementWhere, status: "SETTLED" },
      orderBy: { settledAt: "desc" },
      take: 100,
    }),
  ]);

  const rows = records.map((record) => {
    const rejectedIds = new Set(rejectedSettlementIdsOf(record.rawPayload));
    const manualCandidates = settledCandidates
      .filter((settlement) => !rejectedIds.has(settlement.id))
      .map((settlement) => {
        const refDate = settlement.settledAt ?? settlement.createdAt;
        const comparison = compareReconciliationRecord(
          Number(record.amount),
          record.currency,
          record.valueDate,
          {
            sourceCurrency: settlement.sourceCurrency,
            targetCurrency: settlement.targetCurrency,
            sourceAmount: Number(settlement.sourceAmount),
            targetAmount: Number(settlement.targetAmount),
            refDate,
          },
        );
        return {
          settlementId: settlement.id,
          publicId: settlement.publicId,
          reference: settlement.reference,
          confidence: comparison.confidence,
          reason: matchReasonFor(comparison.confidence, record.currency),
          amount:
            comparison.settlementAmount == null
              ? null
              : formatCurrencyFull(String(comparison.settlementAmount), record.currency),
          valueDate: formatDateTime(refDate),
          comparison,
        };
      })
      .filter((candidate) => candidate.confidence > 0)
      .sort(
        (a, b) =>
          b.confidence - a.confidence ||
          a.publicId.localeCompare(b.publicId),
      )
      .slice(0, 12);

    const best = record.settlement || record.status === "EXCEPTION" || record.status === "RESOLVED"
      ? null
      : bestSettlementMatch(record, settledCandidates, {
          excludeSettlementIds: rejectedIds,
          minConfidence: SUGGESTED_MIN_CONFIDENCE,
        });
    const suggestion = best
      ? manualCandidates.find((candidate) => candidate.settlementId === best.settlement.id) ?? null
      : null;

    const linkedComparison = record.settlement
      ? compareReconciliationRecord(
          Number(record.amount),
          record.currency,
          record.valueDate,
          {
            sourceCurrency: record.settlement.sourceCurrency,
            targetCurrency: record.settlement.targetCurrency,
            sourceAmount: Number(record.settlement.sourceAmount),
            targetAmount: Number(record.settlement.targetAmount),
            refDate: record.settlement.settledAt ?? record.settlement.createdAt,
          },
        )
      : null;
    const confidence = linkedComparison?.confidence ?? suggestion?.confidence ?? 0;
    const origin = matchOriginOf(record.rawPayload);
    const matchType = matchTypeFor(record.status, confidence, Boolean(record.settlement), origin);
    const matchReason = record.settlement
      ? matchReasonFor(confidence, record.currency)
      : suggestion?.reason ?? null;
    return {
      id: record.id,
      externalRef: record.externalRef,
      source: record.source,
      sourceLabel: RECONCILIATION_SOURCE_LABEL[record.source] ?? record.source.replaceAll("_", " "),
      independent: isIndependentReconciliationSource(record.source),
      amount: formatCurrencyFull(String(record.amount), record.currency),
      currency: record.currency,
      status: record.status,
      matchType,
      matchLabel: MATCH_LABEL[matchType],
      matchReason,
      confidence,
      exceptionReason: record.exceptionReason,
      resolutionNote: metadataString(record.rawPayload, "_resolutionNote"),
      age: formatDateTime(record.createdAt),
      createdAtMs: record.createdAt.getTime(),
      valueDate: formatDateTime(record.valueDate),
      settlement: record.settlement
        ? {
            id: record.settlement.id,
            publicId: record.settlement.publicId,
            reference: record.settlement.reference,
            amount:
              linkedComparison?.settlementAmount == null
                ? null
                : formatCurrencyFull(String(linkedComparison.settlementAmount), record.currency),
            valueDate: formatDateTime(record.settlement.settledAt ?? record.settlement.createdAt),
            comparison: linkedComparison,
          }
        : null,
      suggestion,
      manualCandidates,
    };
  });

  const viewFromQuery =
    params.status === "EXCEPTION"
      ? "exceptions"
      : QUEUE_VIEWS.some((view) => view.key === params.view)
        ? params.view
        : "attention";
  const activeView = viewFromQuery as QueueView;
  const query = params.q?.toLowerCase().trim() ?? "";
  const viewMatches = (matchType: (typeof rows)[number]["matchType"]) => {
    if (activeView === "all") return true;
    if (activeView === "attention") return ["SUGGESTED", "MANUAL_REVIEW", "EXCEPTION"].includes(matchType);
    if (activeView === "suggested") return matchType === "SUGGESTED";
    if (activeView === "exceptions") return matchType === "EXCEPTION";
    if (activeView === "matched") return ["AUTO_MATCHED", "MANUAL_MATCHED"].includes(matchType);
    return matchType === "RESOLVED";
  };
  const priority = {
    EXCEPTION: 0,
    SUGGESTED: 1,
    MANUAL_REVIEW: 2,
    AUTO_MATCHED: 3,
    MANUAL_MATCHED: 3,
    RESOLVED: 4,
  } as const;
  const workspaceRows = rows
    .filter((record) => {
      const candidateSearch = [
        record.settlement?.publicId,
        record.settlement?.reference,
        record.suggestion?.publicId,
        record.suggestion?.reference,
        ...record.manualCandidates.flatMap((candidate) => [candidate.publicId, candidate.reference]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch =
        !query ||
        record.externalRef.toLowerCase().includes(query) ||
        record.sourceLabel.toLowerCase().includes(query) ||
        candidateSearch.includes(query);
      return matchesSearch && viewMatches(record.matchType);
    })
    .sort(
      (a, b) =>
        priority[a.matchType] - priority[b.matchType] ||
        (["EXCEPTION", "SUGGESTED", "MANUAL_REVIEW"].includes(a.matchType)
          ? a.createdAtMs - b.createdAtMs
          : a.externalRef.localeCompare(b.externalRef)),
    );

  const suggestedCount = rows.filter((record) => record.matchType === "SUGGESTED").length;
  const manualReview = rows.filter((record) => record.matchType === "MANUAL_REVIEW").length;
  const exceptions = rows.filter((record) => record.matchType === "EXCEPTION").length;
  const matchedCount = rows.filter((record) =>
    ["AUTO_MATCHED", "MANUAL_MATCHED"].includes(record.matchType),
  ).length;
  const attentionCount = suggestedCount + manualReview + exceptions;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reconciliation control room"
        description="Decide whether independent bank, PSP, chain, or operator evidence agrees with a settled transaction. Ambiguous records always remain under operator control."
        stats={[
          {
            label: "Need attention",
            value: attentionCount,
            tone: attentionCount ? ("pending" as const) : ("ok" as const),
            href: "/reconciliation?view=attention",
          },
          {
            label: "Suggested",
            value: suggestedCount,
            tone: suggestedCount ? ("info" as const) : ("neutral" as const),
            href: "/reconciliation?view=suggested",
          },
          {
            label: "Exceptions",
            value: exceptions,
            tone: exceptions ? ("blocked" as const) : ("neutral" as const),
            href: "/reconciliation?view=exceptions",
          },
          {
            label: "Matched",
            value: matchedCount,
            tone: "ok" as const,
            href: "/reconciliation?view=matched",
          },
        ]}
      />

      {params.error ? <FlashMessage message={params.error} tone="error" /> : null}
      {params.success === "created" ? (
        <FlashMessage message="Record saved as OPEN. Run auto-match to reconcile." />
      ) : null}
      {params.success === "manual" ? (
        <FlashMessage message="Manual match confirmed — record linked and settlement reconciled." />
      ) : null}
      {params.success === "confirmed" ? (
        <FlashMessage message="Match confirmed — settlement reconciled." />
      ) : null}
      {params.success === "rejected" ? (
        <FlashMessage message="Suggestion rejected — record kept in manual review." />
      ) : null}
      {params.success === "resolved" ? (
        <FlashMessage message="Exception resolved — marked reviewed and cleared from the exceptions queue." />
      ) : null}
      {params.success === "automatch" ? (
        <FlashMessage
          message={`Auto-match complete — ${params.matched ?? 0} of ${params.scanned ?? 0} open records matched and reconciled.`}
        />
      ) : null}
      {!canWrite ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--ops-line)] bg-white px-3 py-2">
          <span className="case-chip">Read-only role</span>
          <p className="text-xs text-slate-500">
            You can review the reconciliation queue, but adding, matching, and resolving records requires an
            operational role.
          </p>
        </div>
      ) : null}

      {canWrite ? (
        <ReconciliationCommandBar
          addRecordForm={
            <AddRecordForm
              action={submitRecord}
              compact
              settlements={settledCandidates.map((settlement) => ({
                value: settlement.id,
                label: `${settlement.publicId} · ${settlement.reference}`,
              }))}
            />
          }
          autoMatchForm={
            <form action={runAutoMatch}>
              <SubmitButton variant="primary" size="sm" pendingText="Matching...">
                Run exact auto-match
              </SubmitButton>
            </form>
          }
        />
      ) : null}

      <div className="reconciliation-policy" aria-label="Reconciliation control policy">
        <div>
          <CircleDashed aria-hidden="true" />
          <span><strong>100%</strong> unique match</span>
          <small>Eligible for automatic reconciliation</small>
        </div>
        <div>
          <Sparkles aria-hidden="true" />
          <span><strong>80–99%</strong> or ambiguity</span>
          <small>Requires an attributed operator decision</small>
        </div>
        <div>
          <AlertTriangle aria-hidden="true" />
          <span><strong>Exception</strong> or no candidate</span>
          <small>Finality stays blocked until reviewed</small>
        </div>
        <div>
          <CheckCircle2 aria-hidden="true" />
          <span><strong>Matched</strong> independent record</span>
          <small>Unlocks finality review, never finality itself</small>
        </div>
      </div>

      <div className="ops-panel reconciliation-console overflow-hidden">
        <div className="reconciliation-workbench-head">
          <div className="min-w-0">
            <p>Decision queue</p>
            <span>{workspaceRows.length} record{workspaceRows.length === 1 ? "" : "s"} in this view</span>
          </div>
          <nav aria-label="Reconciliation queue views">
            {QUEUE_VIEWS.map((view) => (
              <Link
                key={view.key}
                href={`/reconciliation?view=${view.key}`}
                className={cn(activeView === view.key && "is-active")}
                aria-current={activeView === view.key ? "page" : undefined}
              >
                {view.label}
              </Link>
            ))}
          </nav>
        </div>

        <Suspense fallback={null}>
          <FilterBar
            embedded
            searchPlaceholder="Search external or settlement reference..."
          />
        </Suspense>

        <ReconciliationWorkspace
          embedded
          records={workspaceRows}
          confirmAction={canWrite ? confirmMatch : undefined}
          rejectAction={canWrite ? rejectSuggestion : undefined}
          resolveAction={canWrite ? resolveException : undefined}
          emptyTitle={activeView === "attention" ? "Attention queue is clear" : "No records in this view"}
          emptyDescription={
            activeView === "attention"
              ? "There are no suggestions, manual reviews, or exceptions waiting for an operator."
              : "Choose another queue view or clear the search."
          }
        />
      </div>
    </div>
  );
}
