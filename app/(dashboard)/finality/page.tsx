import Link from "next/link";
import { ArrowRight, CircleCheckBig, CircleDashed, ShieldAlert } from "lucide-react";
import { AreaTabs } from "@/components/ops/area-tabs";
import { EmptyState } from "@/components/ops/empty-state";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { StatusBadge, StatusChip } from "@/components/ops/status-badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { assessFinality } from "@/lib/finality";
import { buildFinalityInput } from "@/lib/finality-input";
import { prisma } from "@/lib/prisma";
import { getShadowConfig, safetyFor } from "@/lib/shadow-mode";
import { formatCurrencyFull, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Finality workspace" };

function decisionLabel(decision: string) {
  if (decision === "ready_to_finalize") return "Ready for review";
  if (decision === "needs_review") return "Needs review";
  return "Evidence pending";
}

export default async function FinalityPage() {
  const { organization } = await requireSession();
  const config = getShadowConfig();
  const settlements = await prisma.settlement.findMany({
    where: {
      organizationId: organization.id,
      status: { in: ["SETTLED", "RECONCILED"] },
    },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      reconciliation: { orderBy: { createdAt: "desc" } },
      providerProofs: { orderBy: { receivedAt: "desc" } },
    },
    orderBy: [{ settledAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  const cases = settlements.map((settlement) => {
    const assessment = assessFinality(
      buildFinalityInput(
        settlement,
        settlement.providerProofs,
        settlement.reconciliation,
        settlement.events,
        safetyFor(settlement, config),
      ),
    );
    return { settlement, assessment };
  });

  const ready = cases.filter((item) => item.assessment.decision === "ready_to_finalize").length;
  const review = cases.filter((item) => item.assessment.decision === "needs_review").length;
  const pending = cases.length - ready - review;
  const highRisk = cases.filter((item) => item.assessment.riskLevel === "high").length;

  return (
    <div className="space-y-6">
      <AreaTabs area="settlements" />
      <PageHeader
        title="Finality workspace"
        description="Review approval, provider proof, independent reconciliation and operational guardrails before an authorized completion decision."
        stats={[
          { label: "Ready for review", value: ready, tone: ready ? "ok" : "neutral" },
          { label: "Needs review", value: review, tone: review ? "pending" : "neutral" },
          { label: "Evidence pending", value: pending, tone: pending ? "info" : "neutral" },
          { label: "High risk", value: highRisk, tone: highRisk ? "blocked" : "neutral" },
        ]}
      />

      <section>
        <SectionHeader
          title="Finality queue"
          description="The decision is calculated from persisted evidence. Provider completion alone never marks a settlement final."
        />
        {cases.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {cases.map(({ settlement, assessment }) => {
              const tone =
                assessment.decision === "ready_to_finalize"
                  ? "success"
                  : assessment.riskLevel === "high"
                    ? "danger"
                    : "warning";
              const DecisionIcon =
                assessment.decision === "ready_to_finalize"
                  ? CircleCheckBig
                  : assessment.riskLevel === "high"
                    ? ShieldAlert
                    : CircleDashed;
              return (
                <article key={settlement.id} className="ops-panel overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--ops-line-soft)] p-5">
                    <div>
                      <Link
                        href={`/settlements?q=${settlement.publicId}`}
                        className="text-base font-semibold tracking-tight text-slate-950 hover:text-emerald-700"
                      >
                        {settlement.publicId}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{settlement.reference}</p>
                    </div>
                    <StatusChip tone={tone} dot>{decisionLabel(assessment.decision)}</StatusChip>
                  </div>

                  <div className="grid gap-5 p-5 sm:grid-cols-[0.72fr_1.28fr]">
                    <div>
                      <DecisionIcon className="h-6 w-6 text-emerald-700" aria-hidden="true" />
                      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                        {assessment.confidence}%
                      </p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                        Evidence confidence
                      </p>
                      <p className="mt-4 text-xs text-slate-500">
                        {formatCurrencyFull(
                          settlement.targetAmount.toString(),
                          settlement.targetCurrency,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[13px] leading-relaxed text-slate-600">{assessment.summary}</p>
                      <dl className="mt-4 grid gap-2 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-400">Lifecycle</dt>
                          <dd><StatusBadge status={settlement.status} /></dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-400">Blocking issues</dt>
                          <dd className="font-semibold text-slate-700">{assessment.blockingIssues.length}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-400">Last updated</dt>
                          <dd className="text-slate-600">{formatDateTime(settlement.updatedAt)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-[var(--ops-line-soft)] bg-slate-50/70 px-5 py-3">
                    <p className="text-xs text-slate-500">
                      {assessment.blockingIssues[0] ?? "All required evidence is available for authorized review."}
                    </p>
                    <Button asChild size="sm" variant="outline" className="shrink-0">
                      <Link href={`/settlements/${settlement.id}/controls`}>
                        Open review <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No settlements are awaiting finality review"
            description="A settlement enters this workspace after the provider reports completion. Proof and independent reconciliation then determine the next action."
            action={{ label: "Open settlements", href: "/settlements" }}
            icon={CircleCheckBig}
          />
        )}
      </section>
    </div>
  );
}
