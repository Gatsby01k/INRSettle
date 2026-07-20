import { FundingStatus } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { DataGrid, DataGridBody, DataGridHead, DataGridRow, DataGridTd, DataGridTh } from "@/components/ops/data-grid";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { StatusBadge } from "@/components/ops/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { isMfaStepUpFresh, requireSession } from "@/lib/auth";
import { friendlyErrorMessage } from "@/lib/errors";
import { FUNDING_TRANSITIONS, updateSettlementFunding } from "@/lib/funding";
import { approvalMfaViolation, canManageFunding, roleErrorMessage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { fundingConfirmationViolation } from "@/lib/settlement-actions";
import { formatCurrencyFull, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Funding review" };

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function changeFunding(formData: FormData) {
  "use server";
  const { user, organization, membership, session } = await requireSession();
  const settlementId = String(formData.get("settlementId") ?? "");
  if (!canManageFunding(membership.role)) {
    redirect(`/settlements/${settlementId}/funding?error=${encodeURIComponent(roleErrorMessage(membership.role))}`);
  }

  const status = String(formData.get("status") ?? "") as FundingStatus;
  if (!Object.values(FundingStatus).includes(status)) {
    redirect(`/settlements/${settlementId}/funding?error=${encodeURIComponent("Invalid funding status.")}`);
  }

  if (status === FundingStatus.FUNDED) {
    const target = await prisma.settlement.findFirst({
      where: { id: settlementId, organizationId: organization.id },
      select: { createdById: true },
    });
    const mfaViolation = approvalMfaViolation({
      requireMfaForApproval: organization.settings?.requireMfaForApproval ?? true,
      mfaEnabled: user.mfaEnabled,
      mfaStepUpFresh: isMfaStepUpFresh(session),
    });
    const dualControlViolation = fundingConfirmationViolation({
      targetStatus: status,
      creatorId: target?.createdById,
      approverId: user.id,
    });
    const violation = mfaViolation ?? dualControlViolation;
    if (violation) {
      redirect(`/settlements/${settlementId}/funding?error=${encodeURIComponent(violation)}`);
    }
  }

  try {
    await updateSettlementFunding({
      settlementId,
      organizationId: organization.id,
      userId: user.id,
      status,
      requiredAmount: optionalNumber(formData.get("requiredAmount")),
      fundedAmount: optionalNumber(formData.get("fundedAmount")),
      currency: String(formData.get("currency") ?? "").trim() || undefined,
      providerCode: String(formData.get("providerCode") ?? "").trim() || undefined,
      providerReference: String(formData.get("providerReference") ?? "").trim() || undefined,
    });
  } catch (error) {
    redirect(`/settlements/${settlementId}/funding?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }

  revalidatePath("/settlements");
  revalidatePath(`/settlements/${settlementId}/funding`);
  redirect(`/settlements/${settlementId}/funding?success=updated`);
}

export default async function FundingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { organization, membership } = await requireSession();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const settlement = await prisma.settlement.findFirst({
    where: { id, organizationId: organization.id },
    include: {
      providerOperations: {
        where: { operationType: "FUNDING_REQUEST" },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!settlement) notFound();

  const connections = await prisma.providerConnection.findMany({
    where: {
      organizationId: organization.id,
      status: { in: ["SANDBOX_READY", "PILOT_READY"] },
    },
    orderBy: { displayName: "asc" },
  });
  const allowed = FUNDING_TRANSITIONS[settlement.fundingStatus];
  const canManage = canManageFunding(membership.role);

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link href="/settlements"><ArrowLeft className="h-3.5 w-3.5" /> Settlements</Link>
      </Button>
      <PageHeader
        title={`Funding · ${settlement.publicId}`}
        description="Visibility and approval workflow for pre-funding. This screen records provider or manual funding evidence; it does not itself move or custody funds."
        stats={[
          { label: "Settlement", value: settlement.status, tone: "info" },
          { label: "Funding", value: settlement.fundingStatus.replaceAll("_", " "), tone: settlement.fundingStatus === "FUNDED" ? "ok" : "pending" },
          { label: "Required", value: settlement.fundingRequired ? formatCurrencyFull(settlement.fundingRequired.toString(), settlement.fundingCurrency ?? settlement.sourceCurrency) : "—" },
          { label: "Funded", value: settlement.fundedAmount ? formatCurrencyFull(settlement.fundedAmount.toString(), settlement.fundingCurrency ?? settlement.sourceCurrency) : "—" },
        ]}
      />

      {query.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{query.error}</p> : null}
      {query.success ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Funding state updated and audit-logged.</p> : null}

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
        <p>Execution is blocked while funding is REQUESTED, ACKNOWLEDGED, PARTIALLY_FUNDED, FAILED or CANCELLED. FUNDED confirmation requires an approver-class role, MFA enrollment policy and a user other than the settlement creator.</p>
      </div>

      {canManage && settlement.status === "APPROVED" && allowed.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Record funding transition</CardTitle>
            <CardDescription>Allowed from {settlement.fundingStatus}: {allowed.join(", ")}.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={changeFunding} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <input type="hidden" name="settlementId" value={settlement.id} />
              <Field label="Next status" htmlFor="status" required>
                <select id="status" name="status" required className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                  {allowed.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Required amount" htmlFor="requiredAmount" required>
                <Input id="requiredAmount" name="requiredAmount" type="number" min="0.000001" step="0.000001" defaultValue={settlement.fundingRequired?.toString() ?? settlement.sourceAmount.toString()} />
              </Field>
              <Field label="Funded amount" htmlFor="fundedAmount" hint="Required for PARTIALLY_FUNDED and FUNDED.">
                <Input id="fundedAmount" name="fundedAmount" type="number" min="0" step="0.000001" defaultValue={settlement.fundedAmount?.toString() ?? ""} />
              </Field>
              <Field label="Currency" htmlFor="currency" required>
                <Input id="currency" name="currency" defaultValue={settlement.fundingCurrency ?? settlement.sourceCurrency} maxLength={10} />
              </Field>
              <Field label="Funding source" htmlFor="providerCode">
                <select id="providerCode" name="providerCode" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                  <option value="manual">Manual / external confirmation</option>
                  {connections.map((connection) => <option key={connection.id} value={connection.providerCode}>{connection.displayName}</option>)}
                </select>
              </Field>
              <Field label="Provider reference" htmlFor="providerReference" hint="Reference only; never a secret.">
                <Input id="providerReference" name="providerReference" maxLength={160} />
              </Field>
              <div className="md:col-span-2 lg:col-span-3">
                <SubmitButton pendingText="Recording...">Record transition</SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {!canManage
            ? roleErrorMessage(membership.role)
            : settlement.status !== "APPROVED"
              ? "Funding transitions are only available while the settlement is APPROVED."
              : "Funding is in a terminal state; remediation requires a new reviewed workflow."}
        </p>
      )}

      <section>
        <SectionHeader title="Funding operation history" description="Durable ledger rows linked to this settlement." />
        <DataGrid>
          <table className="w-full min-w-[760px]">
            <DataGridHead>
              <DataGridTh>Created</DataGridTh><DataGridTh>Provider</DataGridTh><DataGridTh>Status</DataGridTh><DataGridTh>Reference</DataGridTh><DataGridTh>Attempts</DataGridTh><DataGridTh>Error</DataGridTh>
            </DataGridHead>
            <DataGridBody>
              {settlement.providerOperations.length ? settlement.providerOperations.map((operation) => (
                <DataGridRow key={operation.id}>
                  <DataGridTd>{formatDateTime(operation.createdAt)}</DataGridTd>
                  <DataGridTd>{operation.providerCode}</DataGridTd>
                  <DataGridTd><StatusBadge status={operation.status} /></DataGridTd>
                  <DataGridTd className="font-mono text-xs">{operation.providerReference ?? "—"}</DataGridTd>
                  <DataGridTd>{operation.attemptCount}</DataGridTd>
                  <DataGridTd>{operation.errorCode ?? operation.errorMessage ?? "—"}</DataGridTd>
                </DataGridRow>
              )) : (
                <DataGridRow><DataGridTd colSpan={6} className="py-8 text-center text-slate-500">No funding request recorded.</DataGridTd></DataGridRow>
              )}
            </DataGridBody>
          </table>
        </DataGrid>
      </section>
    </div>
  );
}
