import Link from "next/link";
import { ArrowRight, CircleDollarSign, ShieldCheck } from "lucide-react";
import { AreaTabs } from "@/components/ops/area-tabs";
import {
  DataGrid,
  DataGridBody,
  DataGridHead,
  DataGridRow,
  DataGridTd,
  DataGridTh,
} from "@/components/ops/data-grid";
import { EmptyState } from "@/components/ops/empty-state";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { StatusBadge } from "@/components/ops/status-badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrencyFull, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Funding workspace" };

function amount(value: { toString(): string } | null, currency: string | null) {
  if (!value || !currency) return "Not specified";
  return formatCurrencyFull(value.toString(), currency);
}

export default async function FundingPage() {
  const { organization } = await requireSession();
  const settlements = await prisma.settlement.findMany({
    where: {
      organizationId: organization.id,
      OR: [
        { fundingStatus: { not: "NOT_REQUIRED" } },
        { status: { in: ["APPROVED", "EXECUTING"] } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      publicId: true,
      reference: true,
      status: true,
      fundingStatus: true,
      fundingRequired: true,
      fundedAmount: true,
      fundingCurrency: true,
      provider: true,
      updatedAt: true,
    },
  });

  const required = settlements.filter((item) => item.fundingStatus !== "NOT_REQUIRED").length;
  const ready = settlements.filter((item) => ["FUNDED", "NOT_REQUIRED"].includes(item.fundingStatus)).length;
  const attention = settlements.filter((item) =>
    ["REQUESTED", "ACKNOWLEDGED", "PARTIALLY_FUNDED"].includes(item.fundingStatus),
  ).length;
  const blocked = settlements.filter((item) =>
    ["FAILED", "CANCELLED"].includes(item.fundingStatus),
  ).length;

  return (
    <div className="space-y-6">
      <AreaTabs area="settlements" />
      <PageHeader
        title="Funding workspace"
        description="Confirm the provider funding position before external execution. Funding records describe operational readiness; INRSettle does not hold or supply liquidity."
        stats={[
          { label: "Funding required", value: required, tone: required ? "info" : "neutral" },
          { label: "Ready for execution", value: ready, tone: ready ? "ok" : "neutral" },
          { label: "Needs attention", value: attention, tone: attention ? "pending" : "neutral" },
          { label: "Blocked", value: blocked, tone: blocked ? "blocked" : "neutral" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_0.65fr]">
        <div className="ops-panel p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <CircleDollarSign className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Execution funding gate</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                A provider request is rejected unless funding is confirmed or the
                settlement explicitly records that prefunding is not required.
              </p>
            </div>
          </div>
        </div>
        <div className="ops-panel p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-emerald-700" aria-hidden="true" />
            <p className="text-[13px] leading-relaxed text-slate-600">
              Funding confirmation uses role policy, MFA step-up and dual control.
              Every change is written to the audit trail.
            </p>
          </div>
        </div>
      </div>

      <section>
        <SectionHeader
          title="Funding queue"
          description="Ordered by most recently changed settlement."
        />
        {settlements.length ? (
          <DataGrid>
            <table className="w-full min-w-[900px]">
              <DataGridHead>
                <DataGridTh>Settlement</DataGridTh>
                <DataGridTh>Lifecycle</DataGridTh>
                <DataGridTh>Funding state</DataGridTh>
                <DataGridTh>Required</DataGridTh>
                <DataGridTh>Confirmed</DataGridTh>
                <DataGridTh>Provider</DataGridTh>
                <DataGridTh>Updated</DataGridTh>
                <DataGridTh className="text-right">Action</DataGridTh>
              </DataGridHead>
              <DataGridBody>
                {settlements.map((settlement) => (
                  <DataGridRow key={settlement.id}>
                    <DataGridTd>
                      <Link href={`/settlements?q=${settlement.publicId}`} className="font-semibold text-slate-950 hover:text-emerald-700">
                        {settlement.publicId}
                      </Link>
                      <p className="mt-0.5 max-w-56 truncate text-xs text-slate-400">{settlement.reference}</p>
                    </DataGridTd>
                    <DataGridTd><StatusBadge status={settlement.status} /></DataGridTd>
                    <DataGridTd><StatusBadge status={settlement.fundingStatus} /></DataGridTd>
                    <DataGridTd className="font-medium tabular-nums">
                      {amount(settlement.fundingRequired, settlement.fundingCurrency)}
                    </DataGridTd>
                    <DataGridTd className="font-medium tabular-nums">
                      {amount(settlement.fundedAmount, settlement.fundingCurrency)}
                    </DataGridTd>
                    <DataGridTd>{settlement.provider ?? "Not routed"}</DataGridTd>
                    <DataGridTd className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(settlement.updatedAt)}
                    </DataGridTd>
                    <DataGridTd className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/settlements/${settlement.id}/funding`}>
                          Open funding <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </Button>
                    </DataGridTd>
                  </DataGridRow>
                ))}
              </DataGridBody>
            </table>
          </DataGrid>
        ) : (
          <EmptyState
            title="No settlements require funding control"
            description="Settlements that require prefunding will enter this queue after approval. Create a settlement to begin the controlled workflow."
            action={{ label: "Create settlement", href: "/settlements" }}
            icon={CircleDollarSign}
          />
        )}
      </section>
    </div>
  );
}
