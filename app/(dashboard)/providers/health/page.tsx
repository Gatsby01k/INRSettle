import { Activity, Clock3, Network, ShieldAlert, Webhook } from "lucide-react";
import { AreaTabs } from "@/components/ops/area-tabs";
import { EmptyState } from "@/components/ops/empty-state";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { StatusChip } from "@/components/ops/status-badge";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  providerConnectionStatusLabel,
  providerConnectionStatusTone,
} from "@/lib/providers/presentation";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Provider health" };

export default async function ProviderHealthPage() {
  const { organization } = await requireSession();
  const since = new Date();
  since.setDate(since.getDate() - 1);
  const [connections, operations, webhooks] = await Promise.all([
    prisma.providerConnection.findMany({
      where: { organizationId: organization.id },
      orderBy: { providerCode: "asc" },
    }),
    prisma.providerOperation.findMany({
      where: { organizationId: organization.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.providerWebhookEvent.findMany({
      where: { organizationId: organization.id, receivedAt: { gte: since } },
      orderBy: { receivedAt: "desc" },
    }),
  ]);

  const failedOperations = operations.filter((item) =>
    ["FAILED", "REVIEW_REQUIRED"].includes(item.status),
  ).length;
  const failedWebhooks = webhooks.filter((item) => item.status === "FAILED" || !item.signatureValid).length;
  const checked = connections.filter((item) => item.lastHealthAt).length;

  return (
    <div className="space-y-6">
      <AreaTabs area="providers" />
      <PageHeader
        title="Provider health"
        description="Connection posture and observed provider signals. Health is based only on recorded checks, operations and webhook deliveries."
        stats={[
          { label: "Connections", value: connections.length, tone: connections.length ? "info" : "neutral" },
          { label: "Health checked", value: checked, tone: checked === connections.length && checked ? "ok" : "pending" },
          { label: "Operation exceptions · 24h", value: failedOperations, tone: failedOperations ? "blocked" : "ok" },
          { label: "Webhook exceptions · 24h", value: failedWebhooks, tone: failedWebhooks ? "blocked" : "ok" },
        ]}
      />

      {connections.length ? (
        <section>
          <SectionHeader
            title="Connection signals"
            description="A missing signal remains unverified; it is never presented as healthy."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {connections.map((connection) => {
              const providerOps = operations.filter((item) => item.providerCode === connection.providerCode);
              const providerHooks = webhooks.filter((item) => item.providerCode === connection.providerCode);
              const exceptions = providerOps.filter((item) => ["FAILED", "REVIEW_REQUIRED"].includes(item.status)).length;
              const hookFailures = providerHooks.filter((item) => item.status === "FAILED" || !item.signatureValid).length;
              const signalTone =
                exceptions || hookFailures
                  ? "danger"
                  : connection.lastHealthAt
                    ? "success"
                    : "warning";
              const signalLabel =
                exceptions || hookFailures
                  ? "Attention required"
                  : connection.lastHealthAt
                    ? "Health signal recorded"
                    : "Health unverified";

              return (
                <article key={connection.id} className="ops-panel overflow-hidden">
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--ops-line-soft)] p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                        <Network className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="text-sm font-semibold text-slate-950">{connection.displayName}</h2>
                        <p className="mt-1 text-xs text-slate-400">{connection.providerCode}</p>
                      </div>
                    </div>
                    <StatusChip tone={signalTone} dot>{signalLabel}</StatusChip>
                  </div>

                  <dl className="grid grid-cols-2 gap-px bg-[var(--ops-line-soft)]">
                    <div className="bg-white p-4">
                      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                        <Activity className="h-3.5 w-3.5" aria-hidden="true" /> Operations · 24h
                      </dt>
                      <dd className="mt-3 text-xl font-semibold tabular-nums text-slate-950">{providerOps.length}</dd>
                      <p className="mt-1 text-xs text-slate-500">{exceptions} require attention</p>
                    </div>
                    <div className="bg-white p-4">
                      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                        <Webhook className="h-3.5 w-3.5" aria-hidden="true" /> Webhooks · 24h
                      </dt>
                      <dd className="mt-3 text-xl font-semibold tabular-nums text-slate-950">{providerHooks.length}</dd>
                      <p className="mt-1 text-xs text-slate-500">{hookFailures} exceptions</p>
                    </div>
                  </dl>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ops-line-soft)] bg-slate-50/70 px-5 py-3">
                    <StatusChip tone={providerConnectionStatusTone(connection.status)} dot>
                      {providerConnectionStatusLabel(connection.status)}
                    </StatusChip>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      {connection.lastHealthAt
                        ? `Last check ${formatDateTime(connection.lastHealthAt)}`
                        : "No health check recorded"}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <EmptyState
          title="No provider connections are registered"
          description="Register a tenant-scoped provider connection before operational health can be observed."
          action={{ label: "Open provider connections", href: "/providers" }}
          icon={ShieldAlert}
        />
      )}
    </div>
  );
}
