import Link from "next/link";
import { ArrowRight, Clock3, Network, RefreshCcw, TriangleAlert } from "lucide-react";
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
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Provider operations" };

export default async function ProviderOperationsPage() {
  const { organization } = await requireSession();
  const operations = await prisma.providerOperation.findMany({
    where: { organizationId: organization.id },
    include: { settlement: { select: { publicId: true, reference: true } } },
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  const inFlight = operations.filter((item) => ["PENDING", "IN_FLIGHT"].includes(item.status)).length;
  const review = operations.filter((item) => item.status === "REVIEW_REQUIRED" && !item.resolvedAt).length;
  const failed = operations.filter((item) => item.status === "FAILED").length;
  const retryQueue = operations.filter((item) => item.nextRetryAt && !item.resolvedAt);

  return (
    <div className="space-y-6">
      <AreaTabs area="providers" />
      <PageHeader
        title="Provider operations"
        description="Durable requests created before external side effects. Each operation retains idempotency, attempts, provider reference and resolution state."
        stats={[
          { label: "Operations", value: operations.length, tone: "neutral" },
          { label: "In flight", value: inFlight, tone: inFlight ? "info" : "neutral" },
          { label: "Manual intervention", value: review, tone: review ? "blocked" : "ok" },
          { label: "Failed", value: failed, tone: failed ? "pending" : "neutral" },
        ]}
      />

      {review ? (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-950">Provider outcome requires confirmation</p>
              <p className="mt-1 text-xs leading-relaxed text-red-800">
                Uncertain execution is never automatically resubmitted. Confirm final provider status or record a controlled no-effect resolution.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 border-red-200 bg-white">
            <Link href="/providers">Open intervention controls</Link>
          </Button>
        </div>
      ) : null}

      <section>
        <SectionHeader
          title="Operation ledger"
          description="Newest operation first. Request and response summaries remain server-side and tenant-scoped."
        />
        {operations.length ? (
          <DataGrid>
            <table className="w-full min-w-[1050px]">
              <DataGridHead>
                <DataGridTh>Created</DataGridTh>
                <DataGridTh>Provider</DataGridTh>
                <DataGridTh>Operation</DataGridTh>
                <DataGridTh>Settlement</DataGridTh>
                <DataGridTh>Status</DataGridTh>
                <DataGridTh>Attempts</DataGridTh>
                <DataGridTh>Provider reference</DataGridTh>
                <DataGridTh>Next retry</DataGridTh>
                <DataGridTh>Error / resolution</DataGridTh>
              </DataGridHead>
              <DataGridBody>
                {operations.map((operation) => (
                  <DataGridRow key={operation.id}>
                    <DataGridTd className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(operation.createdAt)}
                    </DataGridTd>
                    <DataGridTd className="font-semibold text-slate-900">{operation.providerCode}</DataGridTd>
                    <DataGridTd>{operation.operationType.replaceAll("_", " ")}</DataGridTd>
                    <DataGridTd>
                      {operation.settlement ? (
                        <Link href={`/settlements?q=${operation.settlement.publicId}`} className="font-medium text-slate-900 hover:text-emerald-700">
                          {operation.settlement.publicId}
                        </Link>
                      ) : "Not linked"}
                    </DataGridTd>
                    <DataGridTd><StatusBadge status={operation.status} /></DataGridTd>
                    <DataGridTd className="tabular-nums">{operation.attemptCount}</DataGridTd>
                    <DataGridTd className="font-mono text-xs">{operation.providerReference ?? "Not returned"}</DataGridTd>
                    <DataGridTd className="whitespace-nowrap text-xs text-slate-500">
                      {operation.nextRetryAt ? formatDateTime(operation.nextRetryAt) : "Not scheduled"}
                    </DataGridTd>
                    <DataGridTd className="max-w-72">
                      <p className="truncate text-xs text-slate-600" title={operation.errorMessage ?? operation.resolutionNote ?? undefined}>
                        {operation.resolutionNote ?? operation.errorCode ?? operation.errorMessage ?? "No exception recorded"}
                      </p>
                      {operation.resolvedAt ? (
                        <p className="mt-1 text-[10px] text-emerald-700">Resolved {formatDateTime(operation.resolvedAt)}</p>
                      ) : null}
                    </DataGridTd>
                  </DataGridRow>
                ))}
              </DataGridBody>
            </table>
          </DataGrid>
        ) : (
          <EmptyState
            title="No provider operations recorded"
            description="The ledger begins when an approved settlement is submitted to an integrated provider or a status check is requested."
            action={{ label: "Open settlements", href: "/settlements" }}
            icon={Network}
          />
        )}
      </section>

      <section>
        <SectionHeader
          title="Retry queue"
          description="Only operations with an explicit nextRetryAt enter this queue. Uncertain execution remains manual."
        />
        {retryQueue.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {retryQueue.map((operation) => (
              <article key={operation.id} className="ops-panel p-4">
                <div className="flex items-center justify-between">
                  <RefreshCcw className="h-4 w-4 text-amber-700" aria-hidden="true" />
                  <StatusBadge status={operation.status} />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-950">{operation.providerCode}</p>
                <p className="mt-1 text-xs text-slate-500">{operation.operationType.replaceAll("_", " ")}</p>
                <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDateTime(operation.nextRetryAt!)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="ops-panel flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-semibold text-slate-950">No retries are scheduled</p>
              <p className="mt-1 text-xs text-slate-500">
                This is an operational state from the provider ledger, not an inferred health indicator.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
          </div>
        )}
      </section>
    </div>
  );
}
