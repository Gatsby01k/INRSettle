import Link from "next/link";
import { ArrowRight, CircleAlert, Network, Scale, Workflow } from "lucide-react";
import { AreaTabs } from "@/components/ops/area-tabs";
import { EmptyState } from "@/components/ops/empty-state";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { StatusBadge } from "@/components/ops/status-badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrencyFull, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Exception center" };

export default async function ExceptionsPage() {
  const { organization } = await requireSession();
  const [reconciliation, operations, settlements] = await Promise.all([
    prisma.reconciliationRecord.findMany({
      where: {
        organizationId: organization.id,
        status: { in: ["UNMATCHED", "PARTIALLY_MATCHED", "EXCEPTION"] },
      },
      include: { settlement: { select: { id: true, publicId: true, reference: true } } },
      orderBy: { updatedAt: "desc" },
      take: 60,
    }),
    prisma.providerOperation.findMany({
      where: {
        organizationId: organization.id,
        status: { in: ["REVIEW_REQUIRED", "FAILED"] },
        resolvedAt: null,
      },
      include: { settlement: { select: { id: true, publicId: true, reference: true } } },
      orderBy: { updatedAt: "desc" },
      take: 60,
    }),
    prisma.settlement.findMany({
      where: {
        organizationId: organization.id,
        status: { in: ["FAILED", "ON_HOLD"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: {
        id: true,
        publicId: true,
        reference: true,
        status: true,
        failureReason: true,
        provider: true,
        updatedAt: true,
      },
    }),
  ]);

  const total = reconciliation.length + operations.length + settlements.length;
  const providerUncertain = operations.filter((item) => item.status === "REVIEW_REQUIRED").length;
  const mismatches = reconciliation.length;
  const blockedSettlements = settlements.length;

  return (
    <div className="space-y-6">
      <AreaTabs area="settlements" />
      <PageHeader
        title="Exception center"
        description="A single queue for reconciliation mismatches, uncertain provider outcomes and blocked settlements. Every item retains its source and route to resolution."
        stats={[
          { label: "Open exceptions", value: total, tone: total ? "blocked" : "ok" },
          { label: "Provider uncertainty", value: providerUncertain, tone: providerUncertain ? "blocked" : "neutral" },
          { label: "Reconciliation", value: mismatches, tone: mismatches ? "pending" : "neutral" },
          { label: "Blocked settlements", value: blockedSettlements, tone: blockedSettlements ? "blocked" : "neutral" },
        ]}
      />

      {total === 0 ? (
        <EmptyState
          title="No unresolved operational exceptions"
          description="Provider uncertainty, independent-record mismatches and blocked settlements will appear here with their resolution path."
          action={{ label: "Open settlement workspace", href: "/settlements" }}
          icon={CircleAlert}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <section className="space-y-3">
            <SectionHeader
              title="Provider operations"
              description="Confirm final provider state before any retry."
            />
            {operations.length ? operations.map((operation) => (
              <article key={operation.id} className="ops-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-700">
                    <Network className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <StatusBadge status={operation.status} />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-950">
                  {operation.settlement?.publicId ?? operation.providerCode}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {operation.operationType.replaceAll("_", " ")} · {operation.providerCode}
                </p>
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600">
                  {operation.errorMessage ?? "The provider outcome requires an operator decision."}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                  <Link href="/providers">
                    Resolve operation <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            )) : (
              <p className="ops-panel p-5 text-sm text-slate-500">No provider operations require intervention.</p>
            )}
          </section>

          <section className="space-y-3">
            <SectionHeader
              title="Reconciliation"
              description="Independent records that do not currently match."
            />
            {reconciliation.length ? reconciliation.map((record) => (
              <article key={record.id} className="ops-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-700">
                    <Scale className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <StatusBadge status={record.status} />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-950">
                  {record.settlement?.publicId ?? record.externalRef}
                </p>
                <p className="mt-1 text-xs text-slate-500">{record.source} · {record.externalRef}</p>
                <p className="mt-3 text-xs font-semibold tabular-nums text-slate-700">
                  {formatCurrencyFull(record.amount.toString(), record.currency)}
                </p>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                  {record.exceptionReason ?? "No eligible settlement match has been confirmed."}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                  <Link href={`/reconciliation?q=${encodeURIComponent(record.externalRef)}`}>
                    Open reconciliation <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            )) : (
              <p className="ops-panel p-5 text-sm text-slate-500">No reconciliation records require intervention.</p>
            )}
          </section>

          <section className="space-y-3">
            <SectionHeader
              title="Settlement blocks"
              description="Terminal failures and operational holds."
            />
            {settlements.length ? settlements.map((settlement) => (
              <article key={settlement.id} className="ops-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700">
                    <Workflow className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <StatusBadge status={settlement.status} />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-950">{settlement.publicId}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{settlement.reference}</p>
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600">
                  {settlement.failureReason ?? "Settlement processing is blocked pending operator review."}
                </p>
                <p className="mt-3 text-[11px] text-slate-400">
                  {settlement.provider ?? "No provider assigned"} · {formatDateTime(settlement.updatedAt)}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                  <Link href={`/settlements?q=${settlement.publicId}`}>
                    Open settlement <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            )) : (
              <p className="ops-panel p-5 text-sm text-slate-500">No settlements are blocked.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
