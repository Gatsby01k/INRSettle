import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { AreaTabs } from "@/components/ops/area-tabs";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { StatusChip } from "@/components/ops/status-badge";
import { ProviderConnectionForm } from "@/components/providers/provider-connection-form";
import { requireSession } from "@/lib/auth";
import { canManageSettings } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  providerConnectionStatusLabel,
  providerConnectionStatusTone,
} from "@/lib/providers/presentation";
import { providerCatalog } from "@/lib/providers/registry";

export const metadata = { title: "Provider credentials" };

export default async function ProviderCredentialsPage() {
  const { organization, membership } = await requireSession();
  const catalog = providerCatalog();
  const connections = await prisma.providerConnection.findMany({
    where: { organizationId: organization.id },
    orderBy: { providerCode: "asc" },
  });
  const canManage = canManageSettings(membership.role);
  const configured = connections.filter((item) => item.credentialsRef).length;
  const missingProviders = catalog.filter(
    (provider) => !connections.some((connection) => connection.providerCode === provider.code),
  );
  const providerOptions = catalog.map(({ code, displayName }) => ({ code, displayName }));

  return (
    <div className="space-y-6">
      <AreaTabs area="providers" />
      <PageHeader
        title="Provider credentials"
        description="Connector authentication posture and secret bindings. Credential values remain outside INRSettle application records."
        stats={[
          { label: "Registered adapters", value: catalog.length, tone: "neutral" },
          { label: "Tenant connections", value: connections.length, tone: connections.length ? "info" : "neutral" },
          { label: "Tenant secret references", value: configured, tone: configured ? "ok" : "neutral" },
          { label: "Management access", value: canManage ? "Granted" : "Read only", tone: canManage ? "ok" : "neutral" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          [LockKeyhole, "No secret values", "Only a reference to the deployment secret manager may be recorded."],
          [ShieldCheck, "Audited changes", "Connection state and credential-presence changes are written to the tenant audit trail."],
          [KeyRound, "Least exposure", "General read endpoints return only whether credentials are configured."],
        ].map(([Icon, title, body]) => (
          <article key={String(title)} className="ops-panel p-5">
            <Icon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            <h2 className="mt-5 text-sm font-semibold text-slate-950">{String(title)}</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{String(body)}</p>
          </article>
        ))}
      </div>

      <section>
        <SectionHeader
          title="Tenant connections"
          description={canManage ? "Changes take effect at the tenant connection boundary." : "Your role can inspect connection posture but cannot change it."}
        />
        <div className="space-y-4">
          {connections.map((connection) => (
            <article key={connection.id} className="ops-panel overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--ops-line-soft)] p-5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">{connection.displayName}</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {connection.providerCode} ·{" "}
                    {catalog.find((provider) => provider.code === connection.providerCode)?.authentication
                      .join(" + ")
                      .replaceAll("_", " ") ?? "Authentication contract not declared"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusChip tone={connection.credentialsRef ? "success" : "warning"} dot>
                    {catalog.find((provider) => provider.code === connection.providerCode)?.credentialStrategy === "deployment_secret"
                      ? "Deployment secret binding"
                      : connection.credentialsRef
                        ? "Tenant secret reference configured"
                        : "Tenant secret reference missing"}
                  </StatusChip>
                  <StatusChip tone={providerConnectionStatusTone(connection.status)}>
                    {providerConnectionStatusLabel(connection.status)}
                  </StatusChip>
                </div>
              </div>
              {canManage ? (
                <div className="p-5">
                  <ProviderConnectionForm
                    providers={providerOptions}
                    connection={{
                      providerCode: connection.providerCode,
                      displayName: connection.displayName,
                      status: connection.status,
                      credentialsConfigured: Boolean(connection.credentialsRef),
                    }}
                  />
                </div>
              ) : (
                <p className="p-5 text-sm text-slate-500">
                  An owner or administrator must manage provider connection credentials.
                </p>
              )}
            </article>
          ))}

          {canManage && missingProviders.length ? missingProviders.map((provider) => (
            <article key={provider.code} className="ops-panel overflow-hidden">
              <div className="border-b border-[var(--ops-line-soft)] p-5">
                <h2 className="text-sm font-semibold text-slate-950">Register {provider.displayName}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Create a tenant connection for the registered {provider.code} adapter.
                </p>
              </div>
              <div className="p-5">
                <ProviderConnectionForm
                  providers={[{ code: provider.code, displayName: provider.displayName }]}
                />
              </div>
            </article>
          )) : null}
        </div>
      </section>
    </div>
  );
}
