import { CheckCircle2, Database, KeyRound, Link2, Webhook } from "lucide-react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
import { StatusBadge, StatusChip } from "@/components/ops/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isMfaStepUpFresh, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { providerCatalog } from "@/lib/providers/registry";
import {
  providerConnectionStatusLabel,
  providerConnectionStatusTone,
} from "@/lib/providers/presentation";
import { approvalMfaViolation, canApproveSettlement } from "@/lib/permissions";
import {
  confirmProviderOperationNoEffect,
  NO_EFFECT_CONFIRMATION,
  syncReviewRequiredOperation,
} from "@/lib/providers/resolution";
import { friendlyErrorMessage } from "@/lib/errors";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { FlashMessage } from "@/components/ops/flash-message";

export const metadata = { title: "Provider connections" };

function timestamp(value: Date | null) {
  return value ? value.toISOString().replace("T", " ").slice(0, 19) + " UTC" : "Never";
}

async function resolveOperation(formData: FormData) {
  "use server";
  const { user, organization, membership, session } = await requireSession();
  if (!canApproveSettlement(membership.role)) redirect("/providers");
  const operationId = String(formData.get("operationId") ?? "");
  const action = String(formData.get("resolutionAction") ?? "");
  let success = "no_effect";

  try {
    if (action === "SYNC_STATUS") {
      const result = await syncReviewRequiredOperation(operationId, user.id, organization.id);
      success = result.resolved ? "resolved" : "inconclusive";
    } else {
      const mfaViolation = approvalMfaViolation({
        requireMfaForApproval: true,
        mfaEnabled: user.mfaEnabled,
        mfaStepUpFresh: isMfaStepUpFresh(session),
      });
      if (mfaViolation) throw new Error(mfaViolation);
      await confirmProviderOperationNoEffect({
        operationId,
        userId: user.id,
        organizationId: organization.id,
        confirmation: String(formData.get("confirmation") ?? ""),
        note: String(formData.get("note") ?? ""),
      });
    }
  } catch (error) {
    redirect(`/providers?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  revalidatePath("/providers");
  redirect(`/providers?success=${success}`);
}

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { organization, membership } = await requireSession();
  const params = await searchParams;
  const canResolve = canApproveSettlement(membership.role);
  const catalog = providerCatalog();
  const [connections, operations, webhookEvents] = await Promise.all([
    prisma.providerConnection.findMany({
      where: { organizationId: organization.id },
      orderBy: { providerCode: "asc" },
    }),
    prisma.providerOperation.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { settlement: { select: { publicId: true } } },
    }),
    prisma.providerWebhookEvent.findMany({
      where: { organizationId: organization.id },
      orderBy: { receivedAt: "desc" },
      take: 20,
    }),
  ]);

  const connectionByCode = new Map(connections.map((connection) => [connection.providerCode, connection]));
  const reviewRequired = operations.filter((operation) => operation.status === "REVIEW_REQUIRED").length;
  const webhookFailures = webhookEvents.filter((event) => event.status === "FAILED").length;

  return (
    <div className="space-y-6">
      <AreaTabs area="providers" />
      <PageHeader
        title="Provider connections"
        description="Manage tenant connections and review the durable operations and verified events behind settlement execution."
        stats={[
          { label: "Registered connectors", value: catalog.length, tone: "neutral" },
          { label: "Tenant connections", value: connections.length, tone: connections.length ? "info" : "pending" },
          { label: "Review required", value: reviewRequired, tone: reviewRequired ? "blocked" : "ok" },
          { label: "Webhook failures", value: webhookFailures, tone: webhookFailures ? "blocked" : "ok" },
        ]}
      />

      {params.error ? <FlashMessage message={params.error} tone="error" /> : null}
      {params.success === "resolved" ? <FlashMessage message="Operation resolved from final provider status." /> : null}
      {params.success === "inconclusive" ? <FlashMessage message="Status remains non-final; operation stays in review." tone="error" /> : null}
      {params.success === "no_effect" ? <FlashMessage message="No-effect resolution recorded; settlement moved to FAILED." /> : null}

      <section>
        <SectionHeader
          title="Connector catalog"
          description="Connector deployment, tenant activation and commercial due diligence are evaluated as separate controls."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {catalog.map((provider) => {
            const connection = connectionByCode.get(provider.code);
            return (
              <Card key={provider.code}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{provider.displayName}</CardTitle>
                      <CardDescription>
                        Connector code: {provider.code} · authentication: {provider.authentication.join(" + ").replaceAll("_", " ")}
                      </CardDescription>
                    </div>
                    <StatusChip tone={provider.configured ? "success" : "neutral"} dot>
                      {provider.configured ? "Runtime configured" : "Runtime not configured"}
                    </StatusChip>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {provider.capabilities.map((capability) => (
                      <StatusChip key={capability} tone="info">{capability.replaceAll("_", " ")}</StatusChip>
                    ))}
                  </div>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <dt className="text-xs font-medium text-slate-500">Tenant connection</dt>
                      <dd className="mt-1">
                        {connection ? (
                          <StatusChip tone={providerConnectionStatusTone(connection.status)}>
                            {providerConnectionStatusLabel(connection.status)}
                          </StatusChip>
                        ) : <span className="font-semibold text-slate-500">Not registered</span>}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <dt className="text-xs font-medium text-slate-500">Credential binding</dt>
                      <dd className="mt-1 flex items-center gap-1.5 font-semibold text-slate-900">
                        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                        {provider.credentialStrategy === "deployment_secret"
                          ? "Deployment secret"
                          : connection?.credentialsRef
                            ? "Tenant reference recorded"
                            : "Tenant reference required"}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-xs leading-relaxed text-slate-500">
                    Status polling: {provider.supportsStatusPoll ? "supported" : "not supported by this connector"}. Last recorded health check: {timestamp(connection?.lastHealthAt ?? null)}.
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Outbound operation ledger"
          description="Created before provider side effects. REVIEW_REQUIRED operations are never automatically re-submitted."
        />
        <DataGrid>
          <table className="w-full min-w-[900px]">
            <DataGridHead>
              <DataGridTh>Created</DataGridTh>
              <DataGridTh>Provider</DataGridTh>
              <DataGridTh>Operation</DataGridTh>
              <DataGridTh>Settlement</DataGridTh>
              <DataGridTh>Status</DataGridTh>
              <DataGridTh>Attempts</DataGridTh>
              <DataGridTh>Provider reference</DataGridTh>
              <DataGridTh>Error</DataGridTh>
              <DataGridTh>Resolution</DataGridTh>
            </DataGridHead>
            <DataGridBody>
              {operations.length ? operations.map((operation) => (
                <DataGridRow key={operation.id}>
                  <DataGridTd className="whitespace-nowrap text-xs text-slate-500">{timestamp(operation.createdAt)}</DataGridTd>
                  <DataGridTd className="font-medium">{operation.providerCode}</DataGridTd>
                  <DataGridTd>{operation.operationType.replaceAll("_", " ")}</DataGridTd>
                  <DataGridTd>{operation.settlement?.publicId ?? "—"}</DataGridTd>
                  <DataGridTd><StatusBadge status={operation.status} /></DataGridTd>
                  <DataGridTd>{operation.attemptCount}</DataGridTd>
                  <DataGridTd className="font-mono text-xs">{operation.providerReference ?? "—"}</DataGridTd>
                  <DataGridTd className="max-w-64 truncate text-xs text-slate-500" title={operation.errorMessage ?? undefined}>
                    {operation.errorCode ?? operation.errorMessage ?? "—"}
                  </DataGridTd>
                  <DataGridTd className="min-w-72">
                    {operation.status === "REVIEW_REQUIRED" && canResolve ? (
                      <div className="flex flex-col gap-2">
                        <form action={resolveOperation}>
                          <input type="hidden" name="operationId" value={operation.id} />
                          <input type="hidden" name="resolutionAction" value="SYNC_STATUS" />
                          <SubmitButton size="sm" variant="outline" pendingText="Checking…">
                            Sync provider status
                          </SubmitButton>
                        </form>
                        <details className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
                          <summary className="cursor-pointer font-semibold text-amber-900">Confirm no side effect</summary>
                          <form action={resolveOperation} className="mt-2 space-y-2">
                            <input type="hidden" name="operationId" value={operation.id} />
                            <input type="hidden" name="resolutionAction" value="CONFIRM_NO_EFFECT" />
                            <Input name="note" minLength={12} maxLength={1000} required placeholder="External verification source and result" />
                            <Input name="confirmation" required placeholder={NO_EFFECT_CONFIRMATION} />
                            <SubmitButton size="sm" variant="destructive" pendingText="Recording…">
                              Fail settlement and close
                            </SubmitButton>
                          </form>
                        </details>
                      </div>
                    ) : operation.resolvedAt ? (
                      <span className="text-xs text-slate-500">
                        {timestamp(operation.resolvedAt)}
                      </span>
                    ) : "—"}
                  </DataGridTd>
                </DataGridRow>
              )) : (
                <DataGridRow>
                  <DataGridTd className="py-8 text-center text-slate-500" colSpan={9}>
                    No provider operations recorded for this organization.
                  </DataGridTd>
                </DataGridRow>
              )}
            </DataGridBody>
          </table>
        </DataGrid>
      </section>

      <section>
        <SectionHeader
          title="Verified webhook inbox"
          description="Only deliveries that passed connector signature verification appear here; payloads remain server-side."
        />
        <DataGrid>
          <table className="w-full min-w-[760px]">
            <DataGridHead>
              <DataGridTh>Received</DataGridTh>
              <DataGridTh>Provider</DataGridTh>
              <DataGridTh>Event key</DataGridTh>
              <DataGridTh>Signature</DataGridTh>
              <DataGridTh>Status</DataGridTh>
              <DataGridTh>Processed</DataGridTh>
            </DataGridHead>
            <DataGridBody>
              {webhookEvents.length ? webhookEvents.map((event) => (
                <DataGridRow key={event.id}>
                  <DataGridTd className="whitespace-nowrap text-xs text-slate-500">{timestamp(event.receivedAt)}</DataGridTd>
                  <DataGridTd className="font-medium">{event.providerCode}</DataGridTd>
                  <DataGridTd className="max-w-80 truncate font-mono text-xs" title={event.eventKey}>{event.eventKey}</DataGridTd>
                  <DataGridTd>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> valid
                    </span>
                  </DataGridTd>
                  <DataGridTd><StatusBadge status={event.status} /></DataGridTd>
                  <DataGridTd className="whitespace-nowrap text-xs text-slate-500">{timestamp(event.processedAt)}</DataGridTd>
                </DataGridRow>
              )) : (
                <DataGridRow>
                  <DataGridTd className="py-8 text-center text-slate-500" colSpan={6}>
                    No verified webhook deliveries are linked to this organization.
                  </DataGridTd>
                </DataGridRow>
              )}
            </DataGridBody>
          </table>
        </DataGrid>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><Database className="h-5 w-5 text-slate-500" /><CardTitle>Durable state</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-600">Connections, operations, funding and verified webhook receipts are persisted per tenant.</CardContent>
        </Card>
        <Card>
          <CardHeader><Link2 className="h-5 w-5 text-slate-500" /><CardTitle>Explicit selection</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-600">No environment-precedence routing. Each execution names one registered connector.</CardContent>
        </Card>
        <Card>
          <CardHeader><Webhook className="h-5 w-5 text-slate-500" /><CardTitle>Recovery boundary</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-600">Uncertain execution stops for operator review; status polling remains available for recovery.</CardContent>
        </Card>
      </div>
    </div>
  );
}
