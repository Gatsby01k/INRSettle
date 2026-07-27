import { Braces, CheckCircle2, KeyRound, LockKeyhole } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { AreaTabs } from "@/components/ops/area-tabs";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusChip } from "@/components/ops/status-badge";
import { ApiCredentialForm, RevokeApiCredentialButton } from "@/components/settings/api-credential-form";
import { canManageSettings } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "API access" };

const CURRENT_ROUTES = [
  ["GET / POST", "/api/quotes", "quotes:read · quotes:write"],
  ["GET / POST", "/api/settlements", "settlements:read · settlements:write"],
  ["GET / POST", "/api/reconciliation", "reconciliation:read · reconciliation:write"],
  ["GET", "/api/settlements/:id/finality", "finality:read"],
  ["GET", "/api/settlements/:id/funding", "funding:read"],
  ["GET", "/api/reports", "reports:read"],
] as const;

export default async function ApiReferencePage() {
  const { organization, membership } = await requireSession();
  const canManage = canManageSettings(membership.role);
  const credentials = canManage
    ? await prisma.apiCredential.findMany({
        where: { organizationId: organization.id },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const active = credentials.filter((item) => !item.revokedAt && (!item.expiresAt || item.expiresAt > new Date()));

  return (
    <div className="space-y-6">
      <AreaTabs area="settings" />
      <PageHeader
        title="API access"
        description="Tenant-scoped service credentials, explicit scopes and auditable lifecycle access."
        stats={[
          { label: "Active credentials", value: active.length, tone: active.length ? "ok" : "neutral" },
          { label: "Available scopes", value: 9, tone: "info" },
          { label: "Secret storage", value: "One-way hash", tone: "ok" },
          { label: "Credential admin", value: canManage ? "Granted" : "Read only", tone: canManage ? "ok" : "neutral" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { Icon: KeyRound, title: "One-time secret", body: "The full credential is returned once and must be stored in the client secret manager." },
          { Icon: LockKeyhole, title: "Scoped access", body: "Every service request is checked against a route-specific read or write scope." },
          { Icon: CheckCircle2, title: "Tenant boundary", body: "The credential resolves one active organization and a constrained service role." },
        ].map(({ Icon, title, body }) => (
          <Card key={title}>
            <CardContent className="p-5">
              <Icon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
              <p className="mt-5 text-sm font-semibold text-slate-950">{title}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {canManage ? <ApiCredentialForm /> : null}

      <section>
        <SectionHeader
          title="Service credentials"
          description="Revocation is immediate. Prefix, scopes, expiry and last use remain visible; secrets are never returned."
        />
        {credentials.length ? (
          <div className="ops-panel overflow-hidden">
            {credentials.map((credential) => {
              const revoked = Boolean(credential.revokedAt);
              const expired = Boolean(credential.expiresAt && credential.expiresAt <= new Date());
              return (
                <article
                  key={credential.id}
                  className="grid gap-4 border-b border-[var(--ops-line-soft)] p-5 last:border-b-0 lg:grid-cols-[1fr_1.3fr_0.8fr_auto] lg:items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{credential.name}</p>
                    <code className="mt-1 block text-xs text-slate-400">inrs_live_{credential.keyPrefix}.••••••</code>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {credential.scopes.map((scope) => <StatusChip key={scope} tone="info">{scope}</StatusChip>)}
                  </div>
                  <div className="text-xs text-slate-500">
                    <p>{credential.role === "FINANCE_VIEWER" ? "Read-only integration" : "Settlement integration"}</p>
                    <p className="mt-1">Last used: {credential.lastUsedAt ? formatDateTime(credential.lastUsedAt) : "Never"}</p>
                    <p className="mt-1">Expires: {credential.expiresAt ? formatDateTime(credential.expiresAt) : "No expiry"}</p>
                  </div>
                  {revoked || expired ? (
                    <StatusChip tone={revoked ? "neutral" : "warning"}>{revoked ? "Revoked" : "Expired"}</StatusChip>
                  ) : (
                    <RevokeApiCredentialButton credentialId={credential.id} />
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="ops-panel p-5 text-sm text-slate-500">
            No service credentials have been issued for this organization.
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Scoped routes"
          description="Console-only security, settings and provider-intervention routes do not accept service credentials."
        />
        <div className="space-y-3">
          {CURRENT_ROUTES.map(([method, path, scopes]) => (
            <Card key={path}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <StatusChip tone={method.startsWith("GET") ? "info" : "success"}>{method}</StatusChip>
                <code className="min-w-64 text-sm font-semibold text-slate-900">{path}</code>
                <p className="text-xs text-slate-500">{scopes}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Braces className="mt-0.5 h-4 w-4 text-slate-600" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-slate-600">
          Use <code className="font-semibold">Authorization: Bearer &lt;credential&gt;</code>. Write scopes create
          operating records; provider execution and privileged approvals remain behind their separate workflow controls.
        </p>
      </div>
    </div>
  );
}
