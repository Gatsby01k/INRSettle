import { Check, Minus, Network } from "lucide-react";
import { AreaTabs } from "@/components/ops/area-tabs";
import {
  DataGrid,
  DataGridBody,
  DataGridHead,
  DataGridRow,
  DataGridTd,
  DataGridTh,
} from "@/components/ops/data-grid";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { StatusChip } from "@/components/ops/status-badge";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ProviderCapability } from "@/lib/providers/contracts";
import { providerCatalog } from "@/lib/providers/registry";

export const metadata = { title: "Provider capabilities" };

const CAPABILITIES: { key: ProviderCapability; label: string; meaning: string }[] = [
  { key: "prefunding", label: "Prefunding", meaning: "Provider can represent a prefunding requirement in the settlement workflow." },
  { key: "india_settlement", label: "India settlement", meaning: "Connector supports the configured India settlement flow." },
  { key: "execute", label: "Execution", meaning: "Adapter can submit an approved and funded settlement." },
  { key: "status_poll", label: "Status polling", meaning: "Adapter can request current provider state." },
  { key: "signed_webhook", label: "Signed webhooks", meaning: "Adapter verifies provider callback signatures." },
  { key: "reconciliation_reference", label: "Reconciliation reference", meaning: "Provider outcome includes a reference usable during evidence matching." },
];

export default async function ProviderCapabilitiesPage() {
  const { organization } = await requireSession();
  const [connections, catalog] = await Promise.all([
    prisma.providerConnection.findMany({
      where: { organizationId: organization.id },
      orderBy: { providerCode: "asc" },
    }),
    Promise.resolve(providerCatalog()),
  ]);

  return (
    <div className="space-y-6">
      <AreaTabs area="providers" />
      <PageHeader
        title="Provider capabilities"
        description="Normalized connector capabilities used by routing and workflow controls. Provider-specific payloads remain inside each adapter."
        stats={[
          { label: "Adapters", value: catalog.length, tone: "neutral" },
          { label: "Capability types", value: CAPABILITIES.length, tone: "info" },
          { label: "Tenant connections", value: connections.length, tone: connections.length ? "ok" : "pending" },
        ]}
      />

      <section>
        <SectionHeader
          title="Capability matrix"
          description="A declared capability means the adapter implements that boundary; it does not establish commercial readiness."
        />
        <DataGrid>
          <table className="w-full min-w-[850px]">
            <DataGridHead>
              <DataGridTh>Capability</DataGridTh>
              <DataGridTh>Operational meaning</DataGridTh>
              {catalog.map((provider) => (
                <DataGridTh key={provider.code}>{provider.displayName}</DataGridTh>
              ))}
            </DataGridHead>
            <DataGridBody>
              {CAPABILITIES.map((capability) => (
                <DataGridRow key={capability.key}>
                  <DataGridTd className="font-semibold text-slate-950">{capability.label}</DataGridTd>
                  <DataGridTd className="max-w-md text-xs leading-relaxed text-slate-500">
                    {capability.meaning}
                  </DataGridTd>
                  {catalog.map((provider) => {
                    const supported = provider.capabilities.includes(capability.key);
                    return (
                      <DataGridTd key={provider.code}>
                        <span className={supported ? "inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700" : "inline-flex items-center gap-1.5 text-xs text-slate-400"}>
                          {supported ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Minus className="h-3.5 w-3.5" aria-hidden="true" />}
                          {supported ? "Supported" : "Not declared"}
                        </span>
                      </DataGridTd>
                    );
                  })}
                </DataGridRow>
              ))}
            </DataGridBody>
          </table>
        </DataGrid>
      </section>

      <section>
        <SectionHeader
          title="Connection application"
          description="Tenant connection state determines whether declared capabilities may be used."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {catalog.map((provider) => {
            const connection = connections.find((item) => item.providerCode === provider.code);
            return (
              <article key={provider.code} className="ops-panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Network className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                    <div>
                      <h2 className="text-sm font-semibold text-slate-950">{provider.displayName}</h2>
                      <p className="mt-1 text-xs text-slate-400">{provider.code}</p>
                    </div>
                  </div>
                  <StatusChip tone={connection ? "info" : "neutral"} dot={Boolean(connection)}>
                    {connection ? "Tenant connection registered" : "No tenant connection"}
                  </StatusChip>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {provider.capabilities.map((capability) => (
                    <StatusChip key={capability} tone="neutral">{capability.replaceAll("_", " ")}</StatusChip>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
