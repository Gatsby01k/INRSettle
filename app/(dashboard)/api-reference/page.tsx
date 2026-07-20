import { AlertTriangle, CheckCircle2, LockKeyhole } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { AreaTabs } from "@/components/ops/area-tabs";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusChip } from "@/components/ops/status-badge";

export const metadata = { title: "Current API surface" };

const CURRENT_ROUTES = [
  ["GET / POST", "/api/quotes", "Session-authenticated, tenant-scoped; create is RBAC-gated."],
  ["GET / POST", "/api/settlements", "Session-authenticated, tenant-scoped; create is RBAC-gated."],
  ["GET / POST", "/api/reconciliation", "Session-authenticated; writes independent evidence and require an operational role."],
  ["GET", "/api/settlements/:id/finality", "Read-only deterministic finality case file."],
  ["GET / PATCH", "/api/settlements/:id/funding", "Funding visibility and approver-controlled transitions."],
  ["GET / PUT", "/api/provider-connections", "Tenant provider metadata; admin writes; credential values are never returned."],
  ["POST", "/api/provider-operations/:id/resolve", "Approver recovery: status-only sync or MFA/dual-control no-effect closure; never blind re-submit."],
  ["POST", "/api/security/mfa", "Interactive TOTP enrollment, step-up and disable for the authenticated console user."],
  ["GET / PATCH", "/api/settings", "Tenant settings; mutations require OWNER or ADMIN."],
] as const;

export default async function ApiReferencePage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <AreaTabs area="settings" />
      <PageHeader
        title="Current API surface"
        description="Routes implemented by this application today. They use the console session cookie; they are not yet a public partner API."
        stats={[
          { label: "Service/API keys", value: "Not implemented", tone: "blocked" },
          { label: "OpenAPI", value: "Not published", tone: "pending" },
          { label: "Tenant scoping", value: "Enforced", tone: "ok" },
        ]}
      />

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          The previous screen claimed <code>https://api.inrsettle.com/v1</code> and partner-provisioned API keys, but neither exists in this repository. Do not present these routes to InvoiceMate / PayMate as a production customer API until service authentication, scopes, rate limits, idempotency and an OpenAPI contract are implemented.
        </p>
      </div>

      <section>
        <SectionHeader title="Implemented routes" description="Derived from app/api. Provider webhooks are intentionally omitted because they are connector callbacks, not customer endpoints." />
        <div className="space-y-3">
          {CURRENT_ROUTES.map(([method, path, description]) => (
            <Card key={path}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <StatusChip tone={method.startsWith("GET") ? "info" : "success"}>{method}</StatusChip>
                <code className="min-w-64 text-sm font-semibold text-slate-900">{path}</code>
                <p className="text-sm text-slate-600">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
            <div><p className="font-semibold text-slate-900">Outbound provider API</p><p className="mt-1 text-sm text-slate-600">Universal connector contract, tenant connection metadata, durable operations and webhook inbox exist.</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex gap-3 p-4">
            <LockKeyhole className="h-5 w-5 shrink-0 text-amber-700" />
            <div><p className="font-semibold text-slate-900">Customer / partner ingress API</p><p className="mt-1 text-sm text-slate-600">Blocked pending service accounts or OAuth, hashed credentials, scopes, rate limiting, request idempotency and contract tests.</p></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
