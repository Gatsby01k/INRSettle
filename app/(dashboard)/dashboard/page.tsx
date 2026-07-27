import Link from "next/link";
import { ArrowRight, Check, Clock, FileText, Plus, X } from "lucide-react";
import { SettlementStatus } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assessFinality } from "@/lib/finality";
import { buildFinalityInput, hasAuditApproval } from "@/lib/finality-input";
import { getShadowConfig, inrLegOf, safetyFor } from "@/lib/shadow-mode";
import { cn, formatCurrencyCompact, maskFinancialIdentifier } from "@/lib/utils";
import { canViewSensitiveFinancialData } from "@/lib/permissions";
import { PageHeader } from "@/components/ops/page-header";
import { Sparkline, TrendCard } from "@/components/ops/sparkline";
import { StateIcon, type StateKind } from "@/components/ops/status-badge";
import { Time } from "@/components/ops/time";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Home" };

/**
 * Home — the operator's first screen. Order of information:
 *   1. Action queue      — what needs me, oldest first
 *   2. Trends            — 30 days of motion (volume, match rate, finality, exceptions)
 *   3. Control loop      — where the latest case sits in the workflow
 *   4. Recent activity   — the last few evidence events
 * No thesis copy, no mission panels, no mutation on load.
 */

const DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;

function windowStart(multiple = 1) {
  return new Date(Date.now() - WINDOW_DAYS * DAY * multiple);
}

/** Signed percentage delta vs the prior window, or null when not comparable. */
function pctDelta(current: number, prior: number): string | null {
  if (prior <= 0) return null;
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return "±0%";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function lastNDayKeys(n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) keys.push(dayKey(new Date(Date.now() - i * DAY)));
  return keys;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function ageLabel(from: Date | null | undefined): string | null {
  if (!from) return null;
  const ms = Date.now() - from.getTime();
  if (ms < 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "under 1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

const STREAM_ACTIONS: Record<string, string> = {
  "pontis.payout.created": "Provider payout submitted",
  "remitquickly.payout.created": "Provider payout submitted",
  "pontis.payout.status_updated": "Provider status updated",
  "pontis.payout.settled": "Provider payout completed",
  "remitquickly.payout.settled": "Provider payout completed",
  "reconciliation.auto_match": "Reconciliation matched (auto)",
  "reconciliation.confirm_match": "Reconciliation matched (operator)",
  "settlement.finality_approved": "Finality approved (dual-control)",
  "settlement.report_generated": "Settlement report generated",
  "provider.proof.recorded": "Provider proof recorded",
  "settlement.create": "Settlement created",
  "quote.create": "Quote locked",
};

type StepState = "ok" | "pending" | "blocked";
const STEP_LABEL: Record<StepState, string> = { ok: "Verified", pending: "Pending", blocked: "Blocked" };

export default async function DashboardPage() {
  const { organization, membership } = await requireSession();
  const canViewSensitive = canViewSensitiveFinancialData(membership.role);
  const shadowConfig = getShadowConfig();
  const since = windowStart();
  const compareSince = windowStart(2);
  const orgWhere = { organizationId: organization.id };
  const completedStatus = { in: [SettlementStatus.SETTLED, SettlementStatus.RECONCILED] };

  const [
    totalSettlements,
    pendingApprovals,
    oldestRequested,
    reconExceptions,
    oldestException,
    settledAwaiting,
    oldestSettledAwaiting,
    expiredQuotes,
    windowSettlements,
    windowExceptions,
    latestCaseRaw,
    auditLogs,
  ] = await Promise.all([
    prisma.settlement.count({ where: orgWhere }),
    prisma.settlement.count({ where: { ...orgWhere, status: SettlementStatus.REQUESTED } }),
    prisma.settlement.findFirst({
      where: { ...orgWhere, status: SettlementStatus.REQUESTED },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.reconciliationRecord.count({ where: { ...orgWhere, status: "EXCEPTION" } }),
    prisma.reconciliationRecord.findFirst({
      where: { ...orgWhere, status: "EXCEPTION" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.settlement.count({ where: { ...orgWhere, status: SettlementStatus.SETTLED } }),
    prisma.settlement.findFirst({
      where: { ...orgWhere, status: SettlementStatus.SETTLED },
      orderBy: { settledAt: "asc" },
      select: { settledAt: true },
    }),
    prisma.quote.count({
      where: {
        ...orgWhere,
        OR: [{ status: "EXPIRED" }, { status: "ACTIVE", expiresAt: { lt: new Date() } }],
      },
    }),
    prisma.settlement.findMany({
      where: { ...orgWhere, settledAt: { gte: compareSince } },
      select: {
        publicId: true,
        createdAt: true,
        settledAt: true,
        reconciledAt: true,
        status: true,
        corridor: true,
        sourceCurrency: true,
        targetCurrency: true,
        sourceAmount: true,
        targetAmount: true,
      },
    }),
    prisma.reconciliationRecord.findMany({
      where: { ...orgWhere, status: "EXCEPTION", createdAt: { gte: compareSince } },
      select: { createdAt: true },
    }),
    prisma.settlement.findFirst({
      where: { ...orgWhere, status: completedStatus },
      orderBy: [{ reconciledAt: "desc" }, { settledAt: "desc" }],
      include: { events: true, providerProofs: true },
    }),
    prisma.auditLog.findMany({
      where: orgWhere,
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { user: true },
    }),
  ]);

  /* ── Latest case + control loop ─────────────────────────────────────── */
  const latestRecon = latestCaseRaw
    ? await prisma.reconciliationRecord.findMany({
        where: { settlementId: latestCaseRaw.id },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const latestReportLog = latestCaseRaw
    ? await prisma.auditLog.findFirst({
        where: {
          ...orgWhere,
          action: "settlement.report_generated",
          resourceType: "settlement",
          resourceId: latestCaseRaw.id,
        },
      })
    : null;

  const latestCase = latestCaseRaw
    ? {
        ...latestCaseRaw,
        assessment: assessFinality(
          buildFinalityInput(
            latestCaseRaw,
            latestCaseRaw.providerProofs,
            latestRecon,
            latestCaseRaw.events,
            safetyFor(latestCaseRaw, shadowConfig),
          ),
        ),
      }
    : null;

  const executionFailed =
    latestCase?.status === SettlementStatus.FAILED || latestCase?.status === SettlementStatus.CANCELLED;
  const pipeline: { name: string; state: StepState }[] = latestCase
    ? [
        { name: "Quote locked", state: "ok" },
        { name: "Approval", state: latestCase.approvedAt ? "ok" : "pending" },
        {
          name: "Provider execution",
          state: executionFailed
            ? "blocked"
            : latestCase.executedAt || latestCase.settledAt || latestCase.providerTransactionId
              ? "ok"
              : "pending",
        },
        { name: "Provider proof", state: latestCase.providerProofs.length > 0 ? "ok" : "pending" },
        {
          name: "Independent recon",
          state: latestRecon.some((r) => r.status === "MATCHED")
            ? "ok"
            : latestRecon.some((r) => ["UNMATCHED", "EXCEPTION"].includes(r.status))
              ? "blocked"
              : "pending",
        },
        { name: "Audit trail", state: hasAuditApproval(latestCase, latestCase.events) ? "ok" : "pending" },
        {
          name: "Finality review",
          state:
            latestCase.assessment.decision === "ready_to_finalize"
              ? "ok"
              : latestCase.assessment.riskLevel === "high"
                ? "blocked"
                : "pending",
        },
      ]
    : [];

  /* ── Trends (30 days) ───────────────────────────────────────────────── */
  const dayKeys = lastNDayKeys(WINDOW_DAYS);
  const volumeByDay = new Map<string, number>(dayKeys.map((k) => [k, 0]));
  const completedByDay = new Map<string, { total: number; reconciled: number }>();
  const ttfByDay = new Map<string, number[]>();
  const exceptionsByDay = new Map<string, number>(dayKeys.map((k) => [k, 0]));

  const prior = { volume: 0, total: 0, reconciled: 0, ttf: [] as number[], exceptions: 0 };
  for (const s of windowSettlements) {
    if (!s.settledAt) continue;
    const inCurrentWindow = s.settledAt >= since;
    if (!inCurrentWindow) {
      prior.volume += inrLegOf(s);
      prior.total += 1;
      if (s.status === SettlementStatus.RECONCILED) prior.reconciled += 1;
      if (s.reconciledAt) prior.ttf.push((s.reconciledAt.getTime() - s.createdAt.getTime()) / 3_600_000);
      continue;
    }
    const k = dayKey(s.settledAt);
    if (volumeByDay.has(k)) volumeByDay.set(k, (volumeByDay.get(k) ?? 0) + inrLegOf(s));
    const bucket = completedByDay.get(k) ?? { total: 0, reconciled: 0 };
    bucket.total += 1;
    if (s.status === SettlementStatus.RECONCILED) bucket.reconciled += 1;
    completedByDay.set(k, bucket);
    if (s.reconciledAt) {
      const rk = dayKey(s.reconciledAt);
      const hours = (s.reconciledAt.getTime() - s.createdAt.getTime()) / 3_600_000;
      ttfByDay.set(rk, [...(ttfByDay.get(rk) ?? []), hours]);
    }
  }
  for (const record of windowExceptions) {
    if (record.createdAt < since) {
      prior.exceptions += 1;
      continue;
    }
    const k = dayKey(record.createdAt);
    if (exceptionsByDay.has(k)) exceptionsByDay.set(k, (exceptionsByDay.get(k) ?? 0) + 1);
  }

  const volumeSeries = dayKeys.map((k) => volumeByDay.get(k) ?? 0);
  const totalVolume = volumeSeries.reduce((a, b) => a + b, 0);
  const matchRateSeries = dayKeys.map((k) => {
    const bucket = completedByDay.get(k);
    return bucket && bucket.total > 0 ? Math.round((bucket.reconciled / bucket.total) * 100) : 0;
  });
  const completedTotals = [...completedByDay.values()].reduce(
    (acc, b) => ({ total: acc.total + b.total, reconciled: acc.reconciled + b.reconciled }),
    { total: 0, reconciled: 0 },
  );
  const overallMatchRate =
    completedTotals.total > 0 ? Math.round((completedTotals.reconciled / completedTotals.total) * 100) : null;
  const ttfSeries = dayKeys.map((k) => {
    const m = median(ttfByDay.get(k) ?? []);
    return m == null ? 0 : Math.round(m * 10) / 10;
  });
  const overallTtf = median([...ttfByDay.values()].flat());
  const exceptionSeries = dayKeys.map((k) => exceptionsByDay.get(k) ?? 0);
  const exceptionTotal = exceptionSeries.reduce((a, b) => a + b, 0);

  // Comparisons vs the prior 30 days (direction encodes "good"/"bad").
  const volumeDeltaText = pctDelta(totalVolume, prior.volume);
  const volumeDelta = volumeDeltaText
    ? { text: volumeDeltaText, direction: (totalVolume >= prior.volume ? "up" : "down") as "up" | "down" }
    : null;
  const priorMatchRate = prior.total > 0 ? Math.round((prior.reconciled / prior.total) * 100) : null;
  const matchDelta =
    overallMatchRate != null && priorMatchRate != null
      ? {
          text: `${overallMatchRate - priorMatchRate >= 0 ? "+" : ""}${overallMatchRate - priorMatchRate}pp`,
          direction: (overallMatchRate >= priorMatchRate ? "up" : "down") as "up" | "down",
        }
      : null;
  const priorTtf = median(prior.ttf);
  const ttfDelta =
    overallTtf != null && priorTtf != null
      ? {
          text: `${overallTtf <= priorTtf ? "−" : "+"}${Math.abs(Math.round((overallTtf - priorTtf) * 10) / 10)}h`,
          direction: (overallTtf <= priorTtf ? "up" : "down") as "up" | "down",
        }
      : null;
  const exceptionDelta =
    prior.exceptions > 0 || exceptionTotal > 0
      ? {
          text: `${exceptionTotal - prior.exceptions >= 0 ? "+" : ""}${exceptionTotal - prior.exceptions}`,
          direction:
            exceptionTotal === prior.exceptions
              ? null
              : ((exceptionTotal < prior.exceptions ? "up" : "down") as "up" | "down"),
        }
      : null;

  /* ── Action queue ───────────────────────────────────────────────────── */
  const queue = [
    reconExceptions > 0 && {
      state: "blocked" as StateKind,
      label: `Reconciliation exception${reconExceptions === 1 ? "" : "s"}`,
      detail: "Independent evidence contradicts or cannot corroborate a settlement.",
      count: reconExceptions,
      age: ageLabel(oldestException?.createdAt),
      href: "/reconciliation?status=EXCEPTION",
    },
    pendingApprovals > 0 && {
      state: "pending" as StateKind,
      label: `Awaiting approval`,
      detail: "Approval is required before execution and is recorded as audit evidence.",
      count: pendingApprovals,
      age: ageLabel(oldestRequested?.createdAt),
      href: "/settlements?status=REQUESTED",
    },
    settledAwaiting > 0 && {
      state: "pending" as StateKind,
      label: "Settled without independent reconciliation",
      detail: "Provider reports completed; no matching bank/PSP record yet.",
      count: settledAwaiting,
      age: ageLabel(oldestSettledAwaiting?.settledAt),
      href: "/settlements?status=SETTLED",
    },
    expiredQuotes > 0 && {
      state: "idle" as StateKind,
      label: "Expired quotes",
      detail: "Refresh or archive stale quotes before the next settlement run.",
      count: expiredQuotes,
      age: null,
      href: "/quotes?tab=expired",
    },
  ].filter(Boolean) as {
    state: StateKind;
    label: string;
    detail: string;
    count: number;
    age: string | null;
    href: string;
  }[];

  const operationsStream = auditLogs.filter((log) => STREAM_ACTIONS[log.action]).slice(0, 8);

  /* ── Activation checklist (empty workspace only) ────────────────────── */
  if (totalSettlements === 0) {
    const steps = [
      { label: "Lock a quote", detail: "Fix rate, fee and validity window for the settlement.", href: "/quotes" },
      { label: "Create and approve the settlement", detail: "Approval is required before execution.", href: "/settlements" },
      { label: "Execute via a provider", detail: "The provider moves the money; INRSettle tracks it.", href: "/settlements" },
      { label: "Record independent reconciliation", detail: "Match a bank/PSP record — provider claims never count.", href: "/reconciliation" },
      { label: "Review finality and generate the report", detail: "The audit-ready evidence package for the settlement.", href: "/reports" },
    ];
    return (
      <div className="space-y-5">
        <PageHeader
          title="Home"
          description={`Settlement operations for ${organization.displayName}. All times IST.`}
          actions={
            <Button asChild variant="primary" size="sm">
              <Link href="/quotes" className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New quote
              </Link>
            </Button>
          }
        />
        <section className="ops-panel p-5" aria-label="Get set up">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">Run your first settlement</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Five steps from quote to an audit-ready settlement report.
          </p>
          <ol className="mt-4 space-y-1">
            {steps.map((step, index) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className="group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50"
                >
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{step.label}</span>
                    <span className="block text-xs text-slate-500">{step.detail}</span>
                  </span>
                  <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Home"
        description={`Settlement operations for ${organization.displayName}. All times IST.`}
        actions={
          <>
            {latestCase ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/settlements/${latestCase.id}/report`} className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  Latest report
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="primary" size="sm">
              <Link href="/quotes" className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New quote
              </Link>
            </Button>
          </>
        }
      />

      {/* 1 ── Action queue */}
      <section aria-label="Action queue">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-slate-950">Needs attention</h2>
          <span className="text-xs tabular-nums text-slate-400">
            {queue.length === 0 ? "Queue clear" : `${queue.length} item${queue.length === 1 ? "" : "s"}`}
          </span>
        </div>
        {queue.length ? (
          <div className="ops-panel divide-y divide-slate-100">
            {queue.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/80"
              >
                <StateIcon state={item.state} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium text-slate-950">{item.label}</span>
                    {item.age ? <span className="text-xs text-slate-400">oldest {item.age}</span> : null}
                  </span>
                  <span className="block text-xs text-slate-500">{item.detail}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{item.count}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="ops-panel flex items-center gap-3 px-4 py-3.5">
            <StateIcon state="ok" label="Queue clear" />
            <p className="text-sm text-slate-600">
              Nothing needs you — no exceptions, no waiting approvals, no unreconciled settled cases.
            </p>
          </div>
        )}
      </section>

      {/* 2 ── Trends, 30 days */}
      <section aria-label="Trends, last 30 days">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-slate-950">Last 30 days</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TrendCard
            label="Settled volume (INR leg)"
            value={totalVolume > 0 ? formatCurrencyCompact(Math.round(totalVolume), "INR") : "—"}
            delta={volumeDelta}
            hint="By settlement date · vs prior 30d"
          >
            <Sparkline values={volumeSeries} tone="info" />
          </TrendCard>
          <TrendCard
            label="Reconciliation match rate"
            value={overallMatchRate != null ? `${overallMatchRate}%` : "—"}
            delta={matchDelta}
            hint="Independently matched · vs prior 30d"
          >
            <Sparkline values={matchRateSeries} tone="ok" />
          </TrendCard>
          <TrendCard
            label="Time to finality (median)"
            value={overallTtf != null ? `${Math.round(overallTtf * 10) / 10}h` : "—"}
            delta={ttfDelta}
            hint="Created → reconciled · vs prior 30d"
          >
            <Sparkline values={ttfSeries} tone="pending" />
          </TrendCard>
          <TrendCard
            label="Reconciliation exceptions"
            value={String(exceptionTotal)}
            delta={exceptionDelta}
            hint={exceptionTotal ? "Needs operator review · vs prior 30d" : "None raised in 30 days"}
          >
            <Sparkline values={exceptionSeries} tone={exceptionTotal ? "blocked" : "neutral"} type="bars" />
          </TrendCard>
        </div>
      </section>

      {/* 3 ── Control loop (latest case) */}
      {latestCase ? (
        <section aria-label="Settlement control loop">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-slate-950">Control loop</h2>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "case-chip",
                  latestReportLog ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "case-chip--muted",
                )}
              >
                {latestReportLog ? "Report generated" : "Report pending"}
              </span>
              <Link
                href={`/settlements/${latestCase.id}/report`}
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                {latestCase.publicId} →
              </Link>
            </div>
          </div>
          <div className="conf-pipeline conf-pipeline--loop">
            {pipeline.map((step, index) => (
              <div key={step.name} className={cn("conf-step", `conf-step--${step.state}`)}>
                <span className="conf-step__dot" aria-hidden="true">
                  {step.state === "ok" ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : step.state === "blocked" ? (
                    <X className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <Clock className="h-3 w-3" strokeWidth={2.5} />
                  )}
                </span>
                <p className="conf-step__index">STEP {index + 1}</p>
                <p className="conf-step__name">{step.name}</p>
                <p className="conf-step__state">{STEP_LABEL[step.state]}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 4 ── Recent activity */}
      <section className="ops-panel p-4" aria-label="Recent activity">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-slate-950">Recent activity</h2>
          <Link href="/audit-logs" className="text-xs font-medium text-slate-500 hover:text-slate-900">
            Full audit trail →
          </Link>
        </div>
        {operationsStream.length ? (
          <div className="mt-2 divide-y divide-slate-100">
            {operationsStream.map((log) => {
              const href =
                log.resourceType === "settlement" && log.resourceId
                  ? `/settlements/${log.resourceId}/report`
                  : log.resourceType === "reconciliation_record"
                    ? "/reconciliation"
                    : null;
              const row = (
                <>
                  <p className="min-w-0 flex-1 truncate text-sm text-slate-800">
                    {STREAM_ACTIONS[log.action]}
                    <span className="ml-2 text-xs text-slate-400">
                      {log.user?.email
                        ? (canViewSensitive ? log.user.email : maskFinancialIdentifier(log.user.email))
                        : log.actorType.toLowerCase()}
                    </span>
                  </p>
                  <Time value={log.createdAt} className="shrink-0 text-xs tabular-nums text-slate-400" />
                </>
              );
              return href ? (
                <Link
                  key={log.id}
                  href={href}
                  className="-mx-2 flex items-baseline gap-3 rounded-md px-2 py-2 transition-colors hover:bg-slate-50"
                >
                  {row}
                </Link>
              ) : (
                <div key={log.id} className="flex items-baseline gap-3 py-2">{row}</div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No evidence events yet.</p>
        )}
      </section>
    </div>
  );
}
