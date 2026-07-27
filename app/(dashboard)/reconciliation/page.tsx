import { Suspense } from "react";
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
  computeConfidence,
  matchReasonFor,
  matchTypeFor,
  MATCH_LABEL,
} from "@/lib/reconciliation";
import { prisma } from "@/lib/prisma";
import { formatCurrencyFull, formatDateTime, formatPercent } from "@/lib/utils";
import { FlashMessage } from "@/components/ops/flash-message";
import { FilterBar } from "@/components/ops/filter-bar";
import { PageHeader } from "@/components/ops/page-header";
import { AddRecordForm } from "@/components/dashboard/add-record-form";
import { ReconciliationCommandBar } from "@/components/dashboard/reconciliation-command-bar";
import { ReconciliationWorkspace } from "@/components/dashboard/reconciliation-workspace";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata = { title: "Reconciliation" };

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
  const settlementRaw = String(formData.get("settlementId") || "");
  const exceptionReason = String(formData.get("exceptionReason") || "").trim() || undefined;
  const hasManualSettlement = Boolean(settlementRaw) && settlementRaw !== "_none";

  // Status is derived, never picked from a free dropdown: an exception reason flags
  // an EXCEPTION; an explicitly selected settlement is a MANUAL match (reconciles);
  // otherwise the record is simply captured as OPEN for the auto-match engine.
  const status = exceptionReason ? "EXCEPTION" : hasManualSettlement ? "MATCHED" : "OPEN";
  const settlementId = status === "MATCHED" ? settlementRaw : undefined;

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
  try {
    await resolveReconciliationException(recordId, user.id, organization.id);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/reconciliation?success=resolved");
}

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; q?: string; status?: string; matched?: string; scanned?: string }>;
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

  const [records, settlements, settledCandidates] = await Promise.all([
    prisma.reconciliationRecord.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { settlement: true },
    }),
    prisma.settlement.findMany({
      where: settlementWhere,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.settlement.findMany({
      where: { ...settlementWhere, status: "SETTLED" },
      orderBy: { settledAt: "desc" },
    }),
  ]);

  // Best open settlement candidate for an unlinked record (excludes rejected ones).
  const suggestionFor = (record: (typeof records)[number]) => {
    if (record.settlement || record.status === "EXCEPTION" || record.status === "RESOLVED") return null;
    const best = bestSettlementMatch(record, settledCandidates, {
      excludeSettlementIds: new Set(rejectedSettlementIdsOf(record.rawPayload)),
      minConfidence: SUGGESTED_MIN_CONFIDENCE,
    });
    if (!best) return null;
    return {
      settlementId: best.settlement.id,
      publicId: best.settlement.publicId,
      reference: best.settlement.reference,
      confidence: best.confidence,
      reason: matchReasonFor(best.confidence, record.currency),
    };
  };

  const confidenceFor = (record: (typeof records)[number]) => {
    if (record.settlement) {
      return computeConfidence(Number(record.amount), record.currency, record.valueDate, {
        sourceCurrency: record.settlement.sourceCurrency,
        targetCurrency: record.settlement.targetCurrency,
        sourceAmount: Number(record.settlement.sourceAmount),
        targetAmount: Number(record.settlement.targetAmount),
        refDate: record.settlement.settledAt ?? record.settlement.createdAt,
      });
    }
    return suggestionFor(record)?.confidence ?? 0;
  };

  const query = params.q?.toLowerCase().trim() ?? "";
  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      !query ||
      record.externalRef.toLowerCase().includes(query) ||
      record.source.toLowerCase().includes(query) ||
      record.settlement?.reference.toLowerCase().includes(query);
    const matchesStatus = !params.status || record.status === params.status;
    return matchesSearch && matchesStatus;
  });

  const matchedCount = records.filter((r) => Boolean(r.settlement) && r.status === "MATCHED").length;
  const manualReview = records.filter(
    (r) => !r.settlement && r.status !== "EXCEPTION" && r.status !== "RESOLVED",
  ).length;
  const exceptions = records.filter((r) => r.status === "EXCEPTION").length;
  const matchRate = records.length ? Math.round((matchedCount / records.length) * 100) : 0;

  const workspaceRows = filteredRecords.map((record) => {
    const confidence = confidenceFor(record);
    const origin = matchOriginOf(record.rawPayload);
    const matchType = matchTypeFor(record.status, confidence, Boolean(record.settlement), origin);
    const suggestion = suggestionFor(record);
    const matchReason = record.settlement
      ? matchReasonFor(confidence, record.currency)
      : suggestion?.reason ?? null;
    return {
      id: record.id,
      externalRef: record.externalRef,
      source: record.source,
      amount: formatCurrencyFull(String(record.amount), record.currency),
      currency: record.currency,
      status: record.status,
      matchType,
      matchLabel: MATCH_LABEL[matchType],
      matchReason,
      confidence,
      exceptionReason: record.exceptionReason,
      // Queue aging (Phase 4.4): how long this record has been waiting.
      age: (() => {
        const hours = Math.max(0, Math.floor((Date.now() - record.createdAt.getTime()) / 3_600_000));
        if (hours < 1) return "under 1h";
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d ${hours % 24}h`;
      })(),
      valueDate: formatDateTime(record.valueDate),
      settlement: record.settlement
        ? { publicId: record.settlement.publicId, reference: record.settlement.reference }
        : null,
      suggestion: suggestion
        ? {
            settlementId: suggestion.settlementId,
            publicId: suggestion.publicId,
            reference: suggestion.reference,
            confidence: suggestion.confidence,
            reason: suggestion.reason,
          }
        : null,
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reconciliation workspace"
        description="Match provider-executed settlements against independent bank or PSP records before finality. Provider claims remain separate evidence."
        stats={[
          { label: "Matched", value: matchedCount, tone: "ok" as const },
          { label: "Manual review", value: manualReview, tone: manualReview ? ("pending" as const) : ("neutral" as const) },
          { label: "Exceptions", value: exceptions, tone: exceptions ? ("blocked" as const) : ("neutral" as const), href: "/reconciliation?status=EXCEPTION" },
          { label: "Match rate", value: formatPercent(matchRate), tone: "info" as const },
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
            settlements={settlements.map((s) => ({ value: s.id, label: `${s.publicId} · ${s.reference}` }))}
          />
        }
        autoMatchForm={
          <form action={runAutoMatch}>
            <SubmitButton variant="primary" size="sm" pendingText="Matching...">
              Run auto-match
            </SubmitButton>
          </form>
        }
      />
      ) : null}

      <div className="ops-panel ops-panel-accent reconciliation-console overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ops-line-soft)] px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Reconciliation console</p>
            <p className="truncate text-xs text-slate-400">Queue on the left · resolution console on the right</p>
          </div>
          <p className="hidden shrink-0 text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400 sm:block">
            Select a record
          </p>
        </div>

        <Suspense fallback={null}>
          <FilterBar
            embedded
            searchPlaceholder="Search reference, source, settlement..."
            statusOptions={["OPEN", "MATCHED", "PARTIALLY_MATCHED", "UNMATCHED", "EXCEPTION", "RESOLVED"]}
          />
        </Suspense>

        <ReconciliationWorkspace
          embedded
          records={workspaceRows}
          confirmAction={canWrite ? confirmMatch : undefined}
          rejectAction={canWrite ? rejectSuggestion : undefined}
          resolveAction={canWrite ? resolveException : undefined}
        />
      </div>
    </div>
  );
}
