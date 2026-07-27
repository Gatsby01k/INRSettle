import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { friendlyErrorMessage } from "@/lib/errors";
import { canCreateSettlement, roleErrorMessage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { saveSettlementInstruction } from "@/lib/settlement-instructions";
import { PageHeader } from "@/components/ops/page-header";
import { StatusChip } from "@/components/ops/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

async function saveInstruction(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canCreateSettlement(membership.role)) {
    redirect(`/settlements?error=${encodeURIComponent(roleErrorMessage(membership.role))}`);
  }
  const settlementId = String(formData.get("settlementId") ?? "");
  try {
    await saveSettlementInstruction({
      settlementId,
      organizationId: organization.id,
      userId: user.id,
      instruction: {
        beneficiaryName: String(formData.get("beneficiaryName") ?? ""),
        bankName: String(formData.get("bankName") ?? ""),
        bankCode: String(formData.get("bankCode") ?? ""),
        accountNumber: String(formData.get("accountNumber") ?? ""),
        accountType: String(formData.get("accountType") ?? ""),
        mobile: String(formData.get("mobile") ?? ""),
        email: String(formData.get("email") ?? ""),
        purpose: String(formData.get("purpose") ?? ""),
      },
    });
  } catch (error) {
    redirect(
      `/settlements/${encodeURIComponent(settlementId)}/execution?error=${encodeURIComponent(
        friendlyErrorMessage(error),
      )}`,
    );
  }
  revalidatePath("/settlements");
  redirect(`/settlements/${encodeURIComponent(settlementId)}/execution?saved=1`);
}

export default async function SettlementExecutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { organization, membership } = await requireSession();
  const settlement = await prisma.settlement.findFirst({
    where: { id, organizationId: organization.id },
    include: {
      executionInstruction: {
        select: { payloadVersion: true, updatedAt: true },
      },
    },
  });
  if (!settlement) notFound();

  const canEdit =
    canCreateSettlement(membership.role) &&
    ["REQUESTED", "APPROVED"].includes(settlement.status);

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link href="/settlements">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Settlement workspace
        </Link>
      </Button>

      <PageHeader
        title={`Execution instruction · ${settlement.publicId}`}
        description="Prepare the provider instruction before approval. Beneficiary data is encrypted at rest and never written to audit payloads or provider operation summaries."
        stats={[
          { label: "Settlement", value: settlement.status, tone: "info" },
          {
            label: "Instruction",
            value: settlement.executionInstruction ? "Recorded" : "Required",
            tone: settlement.executionInstruction ? "ok" : "pending",
          },
          {
            label: "Version",
            value: settlement.executionInstruction?.payloadVersion ?? "—",
          },
          { label: "Corridor", value: settlement.corridor.replace("_", " → ") },
        ]}
      />

      {query.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {query.error}
        </div>
      ) : null}
      {query.saved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Execution instruction encrypted and recorded. If the settlement had already been approved, approval was invalidated and must be performed again.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Beneficiary instruction</CardTitle>
            <CardDescription>
              Values are write-only. Saved banking details are not returned to this form.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canEdit ? (
              <form action={saveInstruction} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="settlementId" value={settlement.id} />
                <div className="space-y-1.5">
                  <Label htmlFor="beneficiaryName">Legal beneficiary name</Label>
                  <Input id="beneficiaryName" name="beneficiaryName" autoComplete="off" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bankName">Bank name</Label>
                  <Input id="bankName" name="bankName" autoComplete="off" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bankCode">IFSC / bank code</Label>
                  <Input id="bankCode" name="bankCode" autoComplete="off" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="accountNumber">Account number</Label>
                  <Input id="accountNumber" name="accountNumber" autoComplete="off" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="accountType">Account type</Label>
                  <select
                    id="accountType"
                    name="accountType"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    required
                  >
                    <option value="current">Current</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mobile">Beneficiary mobile</Label>
                  <Input id="mobile" name="mobile" inputMode="tel" autoComplete="off" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Beneficiary email</Label>
                  <Input id="email" name="email" type="email" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="purpose">Settlement purpose</Label>
                  <Input id="purpose" name="purpose" autoComplete="off" required />
                </div>
                <div className="flex items-end sm:col-span-2">
                  <SubmitButton pendingText="Encrypting and saving…">
                    <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                    Save encrypted instruction
                  </SubmitButton>
                </div>
              </form>
            ) : (
              <p className="text-sm leading-relaxed text-slate-600">
                This instruction is locked because provider execution has started or your role is read-only.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="ops-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Data control
              </p>
              <StatusChip tone="success" dot>Encrypted</StatusChip>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
              <li className="flex gap-2">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                AES-256-GCM encryption with a deployment-managed key.
              </li>
              <li className="flex gap-2">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                Provider adapters receive data only during an authorized execution.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                Changes after approval invalidate that approval and require dual control again.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
