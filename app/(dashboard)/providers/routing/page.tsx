import { Check, GitBranch, Route, ShieldAlert, X } from "lucide-react";
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
import { providerCatalog } from "@/lib/providers/registry";
import { deriveProviderCircuit, evaluateProviderRoutes } from "@/lib/providers/routing";

export const metadata = { title: "Provider routing" };

export default async function ProviderRoutingPage() {
  const { organization } = await requireSession();
  const [connections, recentSettlements, recentOperations] = await Promise.all([
    prisma.providerConnection.findMany({
      where: { organizationId: organization.id },
      orderBy: { providerCode: "asc" },
    }),
    prisma.settlement.findMany({
      where: { organizationId: organization.id, providerConnectionId: { not: null } },
      select: { providerConnectionId: true, provider: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.providerOperation.findMany({
      where: { organizationId: organization.id },
      select: { providerCode: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const catalog = providerCatalog();
  const byCode = new Map(connections.map((item) => [item.providerCode, item]));
  const now = new Date();
  const circuits = Object.fromEntries(
    catalog.map((provider) => [
      provider.code,
      deriveProviderCircuit(
        recentOperations.filter((operation) => operation.providerCode === provider.code),
        now,
      ),
    ]),
  );
  const routing = evaluateProviderRoutes({
    candidates: catalog,
    connections,
    requiredCapabilities: ["india_settlement", "execute"],
    circuits,
  });
  const evaluationByCode = new Map(routing.evaluations.map((item) => [item.code, item]));
  const eligible = routing.evaluations.filter((item) => item.eligible);

  return (
    <div className="space-y-6">
      <AreaTabs area="providers" />
      <PageHeader
        title="Provider routing"
        description="Determine which tenant connection is eligible before an external operation is created. Current execution uses explicit provider selection."
        stats={[
          { label: "Registered adapters", value: catalog.length, tone: "neutral" },
          { label: "Tenant connections", value: connections.length, tone: connections.length ? "info" : "neutral" },
          { label: "Eligible now", value: eligible.length, tone: eligible.length ? "ok" : "pending" },
          { label: "Automatic fallback", value: "Off", tone: "neutral" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="ops-panel p-5 lg:col-span-2">
          <div className="flex items-start gap-3">
            <Route className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Routing policy</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                Eligibility requires a deployed connector, an activated tenant connection,
                India settlement and execution capabilities, and a closed circuit. The
                selected provider is persisted before submission.
              </p>
              <p className="mt-3 text-xs font-semibold text-emerald-800">
                Current recommended route: {routing.selected?.displayName ?? "No eligible provider"}
              </p>
            </div>
          </div>
        </article>
        <article className="ops-panel p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Fallback safety</p>
          <p className="mt-3 text-sm font-semibold text-slate-950">No blind failover</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Uncertain execution moves to manual intervention instead of a second provider.
          </p>
        </article>
      </div>

      <section>
        <SectionHeader
          title="Routing candidates"
          description="Eligibility combines runtime adapter configuration, tenant connection state and connector capabilities."
        />
        {catalog.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {catalog.map((provider) => {
              const connection = byCode.get(provider.code);
              const evaluation = evaluationByCode.get(provider.code);
              const ready = Boolean(evaluation?.eligible);
              const assignmentCount = recentSettlements.filter(
                (item) => item.providerConnectionId === connection?.id,
              ).length;
              return (
                <article key={provider.code} className="ops-panel overflow-hidden">
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--ops-line-soft)] p-5">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-950">{provider.displayName}</h2>
                      <p className="mt-1 text-xs text-slate-400">{provider.code}</p>
                    </div>
                    <StatusChip tone={ready ? "success" : "warning"} dot>
                      {ready ? "Eligible before submission" : "Not eligible"}
                    </StatusChip>
                  </div>
                  <div className="space-y-3 p-5 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Runtime adapter</span>
                      <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                        {provider.configured ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <X className="h-3.5 w-3.5 text-red-600" />}
                        {provider.configured ? "Configured" : "Unavailable"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Tenant connection</span>
                      {connection ? (
                        <StatusChip tone={providerConnectionStatusTone(connection.status)}>
                          {providerConnectionStatusLabel(connection.status)}
                        </StatusChip>
                      ) : <span className="font-semibold text-slate-500">Not registered</span>}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Circuit</span>
                      <StatusChip
                        tone={evaluation?.circuit === "CLOSED" ? "success" : evaluation?.circuit === "OPEN" ? "danger" : "warning"}
                      >
                        {evaluation?.circuit === "CLOSED"
                          ? "Closed"
                          : evaluation?.circuit === "OPEN"
                            ? "Open"
                            : "Health probe required"}
                      </StatusChip>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Recent assignments</span>
                      <span className="font-semibold tabular-nums text-slate-700">{assignmentCount}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-[var(--ops-line-soft)] bg-slate-50/70 p-4">
                    {provider.capabilities.map((capability) => (
                      <StatusChip key={capability} tone="info">
                        {capability.replaceAll("_", " ")}
                      </StatusChip>
                    ))}
                  </div>
                  {evaluation?.reasons.length ? (
                    <div className="border-t border-[var(--ops-line-soft)] px-5 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        Blocking controls
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
                        {evaluation.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No provider adapters are registered"
            description="A provider must implement the universal connector contract before it can become a routing candidate."
            icon={GitBranch}
          />
        )}
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-slate-600">
          Routing does not imply provider approval, liquidity availability or completed due diligence.
          Those controls remain separate and must be evidenced for each commercial deployment.
        </p>
      </div>
    </div>
  );
}
