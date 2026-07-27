import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Network,
  Plus,
  Scale,
  ShieldCheck,
  UserRoundCheck,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/ops/page-header";
import { StateIcon, type StateKind } from "@/components/ops/status-badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { canViewSensitiveFinancialData } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isIndependentReconciliationSource } from "@/lib/reconciliation";
import { deriveSettlementWorkflow } from "@/lib/settlement-workspace";
import {
  cn,
  formatCurrencyFull,
  formatDateTime,
  maskFinancialIdentifier,
} from "@/lib/utils";

export const metadata = { title: "Operations Center" };

const ACTIVE_STATUSES = [
  "REQUESTED",
  "QUOTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "EXECUTING",
  "SETTLED",
  "RECONCILED",
] as const;

function ageLabel(date: Date) {
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

type QueueTone = "neutral" | "pending" | "info" | "blocked" | "ok";

const QUEUE_TONE: Record<QueueTone, string> = {
  neutral: "is-neutral",
  pending: "is-pending",
  info: "is-info",
  blocked: "is-blocked",
  ok: "is-ok",
};

function QueueCard({
  label,
  count,
  detail,
  href,
  icon: Icon,
  tone,
}: {
  label: string;
  count: number;
  detail: string;
  href: string;
  icon: typeof Workflow;
  tone: QueueTone;
}) {
  return (
    <Link href={href} className={cn("operations-queue-card", QUEUE_TONE[tone])}>
      <span className="operations-queue-card__icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <b>{count}</b>
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

export default async function OperationsCenterPage() {
  const { organization, membership } = await requireSession();
  const canViewSensitive = canViewSensitiveFinancialData(membership.role);

  const [settlements, reconciliationQueue, finalityApprovals, recentAudit] = await Promise.all([
    prisma.settlement.findMany({
      where: { organizationId: organization.id },
      orderBy: { updatedAt: "desc" },
      take: 120,
      include: {
        createdBy: { select: { name: true } },
        events: { orderBy: { createdAt: "asc" } },
        reconciliation: true,
        providerProofs: true,
        providerOperations: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.reconciliationRecord.count({
      where: {
        organizationId: organization.id,
        status: { in: ["OPEN", "PARTIALLY_MATCHED", "UNMATCHED", "EXCEPTION"] },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        organizationId: organization.id,
        action: "settlement.finality_approved",
        resourceType: "settlement",
      },
      select: { resourceId: true },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const approvedFinalityIds = new Set(
    finalityApprovals.map((log) => log.resourceId).filter((id): id is string => Boolean(id)),
  );
  const active = settlements.filter((settlement) =>
    ACTIVE_STATUSES.includes(settlement.status as (typeof ACTIVE_STATUSES)[number]),
  );
  const waitingApproval = settlements.filter((settlement) =>
    ["REQUESTED", "QUOTED", "PENDING_APPROVAL"].includes(settlement.status),
  );
  const waitingProvider = settlements.filter(
    (settlement) =>
      settlement.status === "EXECUTING" ||
      (settlement.status === "APPROVED" &&
        settlement.providerOperations.some((operation) =>
          ["PENDING", "IN_FLIGHT"].includes(operation.status),
        )),
  );
  const fundingRequired = settlements.filter((settlement) =>
    ["REQUESTED", "ACKNOWLEDGED", "PARTIALLY_FUNDED"].includes(settlement.fundingStatus),
  );
  const providerExceptions = settlements.filter((settlement) =>
    settlement.providerOperations.some((operation) =>
      ["FAILED", "REVIEW_REQUIRED"].includes(operation.status),
    ),
  );
  const blocked = settlements.filter(
    (settlement) =>
      ["FAILED", "ON_HOLD"].includes(settlement.status) ||
      ["FAILED", "CANCELLED"].includes(settlement.fundingStatus) ||
      settlement.reconciliation.some((record) =>
        ["EXCEPTION", "UNMATCHED"].includes(record.status),
      ) ||
      settlement.providerOperations.some((operation) =>
        ["FAILED", "REVIEW_REQUIRED"].includes(operation.status),
      ),
  );
  const finalityQueue = settlements.filter(
    (settlement) =>
      settlement.status === "RECONCILED" && !approvedFinalityIds.has(settlement.id),
  );
  const criticalAlerts =
    settlements.filter((settlement) => ["FAILED", "ON_HOLD"].includes(settlement.status)).length +
    providerExceptions.length +
    settlements.filter((settlement) =>
      settlement.reconciliation.some((record) => record.status === "EXCEPTION"),
    ).length;

  const operatingRows = settlements
    .map((settlement) => {
      const latestProviderException = settlement.providerOperations.find((operation) =>
        ["FAILED", "REVIEW_REQUIRED"].includes(operation.status),
      );
      const reconException = settlement.reconciliation.find((record) =>
        ["EXCEPTION", "UNMATCHED"].includes(record.status),
      );
      const reconciliationMatched = settlement.reconciliation.some(
        (record) =>
          record.status === "MATCHED" && isIndependentReconciliationSource(record.source),
      );
      const finalityReady =
        settlement.status === "RECONCILED" &&
        settlement.providerProofs.length > 0 &&
        reconciliationMatched &&
        Boolean(settlement.approvedAt);
      const workflow = deriveSettlementWorkflow(
        {
          status: settlement.status,
          quoteLocked: Boolean(settlement.quoteId),
          approved: Boolean(settlement.approvedAt),
          fundingStatus: settlement.fundingStatus,
          providerAccepted: Boolean(
            settlement.providerTransactionId ||
              settlement.providerOperations.some((operation) =>
                ["SUCCEEDED", "RESOLVED_BY_STATUS"].includes(operation.status),
              ),
          ),
          proofReceived: settlement.providerProofs.length > 0,
          reconciliationMatched,
          reconciliationException: reconException?.exceptionReason ?? null,
          finalityReady,
          finalityApproved: approvedFinalityIds.has(settlement.id),
          failureReason: settlement.failureReason,
          providerException: latestProviderException?.errorMessage ?? null,
        },
        settlement.id,
      );
      const priority =
        workflow.blockers.length > 0
          ? 0
          : ["REQUESTED", "PENDING_APPROVAL", "QUOTED"].includes(settlement.status)
            ? 1
            : ["EXECUTING", "SETTLED"].includes(settlement.status)
              ? 2
              : workflow.complete
                ? 5
                : 3;
      return { settlement, workflow, priority };
    })
    .filter(({ workflow }) => !workflow.complete)
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.settlement.updatedAt.getTime() - b.settlement.updatedAt.getTime(),
    )
    .slice(0, 12);

  const oldestAction = operatingRows[0]?.settlement.updatedAt;
  const queueCards = [
    {
      label: "Active settlements",
      count: active.length,
      detail: "All open operating records",
      href: "/settlements",
      icon: Workflow,
      tone: "info" as const,
    },
    {
      label: "Blocked settlements",
      count: blocked.length,
      detail: "Contradictions or terminal issues",
      href: "/settlements?status=FAILED",
      icon: CircleAlert,
      tone: blocked.length ? ("blocked" as const) : ("neutral" as const),
    },
    {
      label: "Waiting for approval",
      count: waitingApproval.length,
      detail: "Authorized second operator required",
      href: "/settlements?status=REQUESTED",
      icon: UserRoundCheck,
      tone: waitingApproval.length ? ("pending" as const) : ("neutral" as const),
    },
    {
      label: "Waiting for provider",
      count: waitingProvider.length,
      detail: "Submission or external outcome pending",
      href: "/settlements?status=EXECUTING",
      icon: Network,
      tone: waitingProvider.length ? ("info" as const) : ("neutral" as const),
    },
    {
      label: "Funding required",
      count: fundingRequired.length,
      detail: "Execution gate not yet cleared",
      href: "/funding",
      icon: CircleDollarSign,
      tone: fundingRequired.length ? ("pending" as const) : ("neutral" as const),
    },
    {
      label: "Provider exceptions",
      count: providerExceptions.length,
      detail: "External outcome needs intervention",
      href: "/providers/operations?status=REVIEW_REQUIRED",
      icon: AlertTriangle,
      tone: providerExceptions.length ? ("blocked" as const) : ("neutral" as const),
    },
    {
      label: "Reconciliation queue",
      count: reconciliationQueue,
      detail: "Independent records to match or resolve",
      href: "/reconciliation",
      icon: Scale,
      tone: reconciliationQueue ? ("pending" as const) : ("neutral" as const),
    },
    {
      label: "Finality queue",
      count: finalityQueue.length,
      detail: "Evidence ready for authorized review",
      href: "/finality",
      icon: FileCheck2,
      tone: finalityQueue.length ? ("pending" as const) : ("neutral" as const),
    },
    {
      label: "Critical alerts",
      count: criticalAlerts,
      detail: "Highest-priority operational risks",
      href: "/exceptions",
      icon: ShieldCheck,
      tone: criticalAlerts ? ("blocked" as const) : ("ok" as const),
    },
  ];

  return (
    <div className="operations-center space-y-6">
      <PageHeader
        title="Operations Center"
        description={`Actionable settlement work for ${organization.displayName}. Queues are ordered by risk, age and required ownership.`}
        actions={
          <Button asChild variant="brand" size="sm">
            <Link href="/quotes" className="inline-flex items-center gap-1.5">
              <Plus aria-hidden="true" />
              Start settlement
            </Link>
          </Button>
        }
      />

      <section aria-labelledby="queue-heading">
        <div className="operations-section-head">
          <div>
            <h2 id="queue-heading">Work queues</h2>
            <p>Open the queue that requires intervention now.</p>
          </div>
          <span>
            {oldestAction ? `Oldest open action ${ageLabel(oldestAction)}` : "All queues clear"}
          </span>
        </div>
        <div className="operations-queue-grid">
          {queueCards.map((card) => (
            <QueueCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      <section aria-labelledby="action-heading">
        <div className="operations-section-head">
          <div>
            <h2 id="action-heading">Settlement action queue</h2>
            <p>One owner, one stage and one next action for every open settlement.</p>
          </div>
          <Link href="/settlements">
            View all settlements
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <div className="operations-action-list">
          {operatingRows.length ? (
            operatingRows.map(({ settlement, workflow }) => {
              const state: StateKind = workflow.blockers.length
                ? "blocked"
                : workflow.currentIndex >= 8
                  ? "attention"
                  : "pending";
              return (
                <Link key={settlement.id} href={`/settlements/${settlement.id}`}>
                  <div className="operations-action-list__identity">
                    <StateIcon state={state} />
                    <span>
                      <strong>{settlement.publicId}</strong>
                      <small>{settlement.reference}</small>
                    </span>
                  </div>
                  <div className="operations-action-list__stage">
                    <span>Current stage</span>
                    <strong>{workflow.currentStage.label}</strong>
                  </div>
                  <div className="operations-action-list__owner">
                    <span>Owner</span>
                    <strong>{workflow.currentOwner}</strong>
                  </div>
                  <div className="operations-action-list__next">
                    <span>{workflow.blockers.length ? "Blocker" : "Next action"}</span>
                    <strong>{workflow.blockers[0] ?? workflow.nextAction}</strong>
                  </div>
                  <div className="operations-action-list__amount">
                    <strong>
                      {formatCurrencyFull(
                        String(settlement.sourceAmount),
                        settlement.sourceCurrency,
                      )}
                    </strong>
                    <small>{ageLabel(settlement.updatedAt)} in queue</small>
                  </div>
                  <ArrowRight className="operations-action-list__arrow" aria-hidden="true" />
                </Link>
              );
            })
          ) : (
            <div className="operations-clear">
              <CheckCircle2 aria-hidden="true" />
              <div>
                <strong>No settlement requires action</strong>
                <p>Approval, funding, provider, reconciliation and finality queues are clear.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="operations-lower-grid" aria-label="Operational context">
        <div className="operations-panel">
          <div className="operations-section-head">
            <div>
              <h2>Operational flow</h2>
              <p>Where active settlement work is concentrated.</p>
            </div>
          </div>
          <div className="operations-flow">
            {[
              ["Approval", waitingApproval.length],
              ["Funding", fundingRequired.length],
              ["Provider", waitingProvider.length],
              ["Reconciliation", reconciliationQueue],
              ["Finality", finalityQueue.length],
            ].map(([label, count], index, items) => (
              <div key={String(label)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{label}</strong>
                <b>{count}</b>
                {index < items.length - 1 ? <ArrowRight aria-hidden="true" /> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="operations-panel">
          <div className="operations-section-head">
            <div>
              <h2>Recent control activity</h2>
              <p>Latest recorded actions across the operating environment.</p>
            </div>
            <Link href="/audit-logs">Audit explorer</Link>
          </div>
          <div className="operations-activity">
            {recentAudit.length ? (
              recentAudit.slice(0, 7).map((log) => (
                <div key={log.id}>
                  <Clock3 aria-hidden="true" />
                  <span>
                    <strong>{log.action.replaceAll("_", " ").replaceAll(".", " · ")}</strong>
                    <small>
                      {log.user?.name ??
                        (canViewSensitive
                          ? log.actorType.toLowerCase()
                          : maskFinancialIdentifier(log.actorType.toLowerCase()))}
                    </small>
                  </span>
                  <time>{formatDateTime(log.createdAt)}</time>
                </div>
              ))
            ) : (
              <p className="operations-muted">No control activity has been recorded.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
