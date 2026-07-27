import { Activity, BarChart3, Clock3, Network, Webhook } from "lucide-react";
import { AreaTabs } from "@/components/ops/area-tabs";
import { EmptyState } from "@/components/ops/empty-state";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { StatusChip } from "@/components/ops/status-badge";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { providerCatalog } from "@/lib/providers/registry";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Provider performance" };

const WINDOW_DAYS = 30;

function percent(part: number, total: number) {
  return total ? `${Math.round((part / total) * 100)}%` : "No data";
}

function durationLabel(milliseconds: number | null) {
  if (milliseconds == null) return "No data";
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

export default async function ProviderPerformancePage() {
  const { organization } = await requireSession();
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  const [operations, webhooks] = await Promise.all([
    prisma.providerOperation.findMany({
      where: { organizationId: organization.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.providerWebhookEvent.findMany({
      where: { organizationId: organization.id, receivedAt: { gte: since } },
      orderBy: { receivedAt: "desc" },
    }),
  ]);

  const codes = Array.from(new Set([
    ...providerCatalog().map((item) => item.code),
    ...operations.map((item) => item.providerCode),
    ...webhooks.map((item) => item.providerCode),
  ])).sort();
  const resolved = operations.filter((item) =>
    ["SUCCEEDED", "FAILED", "RESOLVED_BY_STATUS", "RESOLVED_NO_EFFECT"].includes(item.status),
  );
  const successes = operations.filter((item) => item.status === "SUCCEEDED").length;
  const manual = operations.filter((item) => item.status === "REVIEW_REQUIRED" && !item.resolvedAt).length;

  return (
    <div className="space-y-6">
      <AreaTabs area="providers" />
      <PageHeader
        title="Provider performance"
        description={`Observed provider operations and webhook outcomes for the last ${WINDOW_DAYS} days. Metrics are calculated from the tenant ledger, not external SLA claims.`}
        stats={[
          { label: "Operations", value: operations.length, tone: "neutral" },
          { label: "Successful", value: percent(successes, resolved.length), tone: successes ? "ok" : "neutral" },
          { label: "Manual intervention", value: manual, tone: manual ? "blocked" : "ok" },
          { label: "Webhook deliveries", value: webhooks.length, tone: webhooks.length ? "info" : "neutral" },
        ]}
      />

      <section>
        <SectionHeader
          title="Provider comparison"
          description="Resolution time is measured from operation creation to its last recorded update."
        />
        {operations.length || webhooks.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {codes.map((code) => {
              const providerOps = operations.filter((item) => item.providerCode === code);
              const providerResolved = providerOps.filter((item) =>
                ["SUCCEEDED", "FAILED", "RESOLVED_BY_STATUS", "RESOLVED_NO_EFFECT"].includes(item.status),
              );
              const providerSuccess = providerOps.filter((item) => item.status === "SUCCEEDED");
              const providerReview = providerOps.filter((item) => item.status === "REVIEW_REQUIRED" && !item.resolvedAt);
              const providerHooks = webhooks.filter((item) => item.providerCode === code);
              const validHooks = providerHooks.filter((item) => item.signatureValid);
              const durations = providerResolved.map((item) => item.updatedAt.getTime() - item.createdAt.getTime());
              const averageDuration = durations.length
                ? durations.reduce((sum, value) => sum + value, 0) / durations.length
                : null;
              const latest = providerOps[0]?.createdAt ?? providerHooks[0]?.receivedAt ?? null;
              return (
                <article key={code} className="ops-panel overflow-hidden">
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--ops-line-soft)] p-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                        <Network className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="text-sm font-semibold text-slate-950">{code}</h2>
                        <p className="mt-1 text-xs text-slate-400">
                          {latest ? `Last signal ${formatDateTime(latest)}` : "No signal recorded"}
                        </p>
                      </div>
                    </div>
                    <StatusChip tone={providerReview.length ? "danger" : "neutral"} dot={Boolean(providerReview.length)}>
                      {providerReview.length ? `${providerReview.length} require review` : "No open intervention"}
                    </StatusChip>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-[var(--ops-line-soft)] sm:grid-cols-4">
                    {[
                      [Activity, "Operations", String(providerOps.length)],
                      [BarChart3, "Success rate", percent(providerSuccess.length, providerResolved.length)],
                      [Clock3, "Resolution", durationLabel(averageDuration)],
                      [Webhook, "Valid webhooks", percent(validHooks.length, providerHooks.length)],
                    ].map(([Icon, label, value]) => (
                      <div key={String(label)} className="bg-white p-4">
                        <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        <p className="mt-5 text-lg font-semibold tracking-tight tabular-nums text-slate-950">{String(value)}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">{String(label)}</p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No provider performance data recorded"
            description="Metrics begin when tenant-scoped provider operations or webhook deliveries enter the ledger."
            action={{ label: "Open provider operations", href: "/providers/operations" }}
            icon={BarChart3}
          />
        )}
      </section>
    </div>
  );
}
