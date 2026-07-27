import { FileClock, Network, Webhook } from "lucide-react";
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
import { StatusBadge, StatusChip } from "@/components/ops/status-badge";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Provider logs" };

type ProviderLogRow = {
  id: string;
  at: Date;
  kind: "Operation" | "Webhook";
  provider: string;
  event: string;
  status: string;
  reference: string;
  detail: string;
};

export default async function ProviderLogsPage() {
  const { organization } = await requireSession();
  const [operations, webhooks] = await Promise.all([
    prisma.providerOperation.findMany({
      where: { organizationId: organization.id },
      include: { settlement: { select: { publicId: true } } },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
    prisma.providerWebhookEvent.findMany({
      where: { organizationId: organization.id },
      orderBy: { receivedAt: "desc" },
      take: 150,
    }),
  ]);

  const rows: ProviderLogRow[] = [
    ...operations.map((item) => ({
      id: `operation-${item.id}`,
      at: item.createdAt,
      kind: "Operation" as const,
      provider: item.providerCode,
      event: item.operationType.replaceAll("_", " "),
      status: item.status,
      reference: item.providerReference ?? item.settlement?.publicId ?? item.id,
      detail: item.resolutionNote ?? item.errorMessage ?? `Attempt ${item.attemptCount}`,
    })),
    ...webhooks.map((item) => ({
      id: `webhook-${item.id}`,
      at: item.receivedAt,
      kind: "Webhook" as const,
      provider: item.providerCode,
      event: item.eventKey,
      status: item.status,
      reference: item.payloadHash.slice(0, 16),
      detail: item.errorMessage ?? (item.signatureValid ? "Signature verified" : "Signature rejected"),
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 250);

  const exceptions = rows.filter((item) =>
    ["FAILED", "REVIEW_REQUIRED"].includes(item.status) || item.detail === "Signature rejected",
  ).length;

  return (
    <div className="space-y-6">
      <AreaTabs area="providers" />
      <PageHeader
        title="Provider logs"
        description="Chronological provider operations and webhook processing signals. Sensitive request, response and payload bodies are not rendered."
        stats={[
          { label: "Log records", value: rows.length, tone: "neutral" },
          { label: "Operations", value: operations.length, tone: "info" },
          { label: "Webhooks", value: webhooks.length, tone: "info" },
          { label: "Exceptions", value: exceptions, tone: exceptions ? "blocked" : "ok" },
        ]}
      />

      <section>
        <SectionHeader
          title="Chronological log"
          description="Newest recorded provider event first."
        />
        {rows.length ? (
          <DataGrid>
            <table className="w-full min-w-[980px]">
              <DataGridHead>
                <DataGridTh>Time</DataGridTh>
                <DataGridTh>Source</DataGridTh>
                <DataGridTh>Provider</DataGridTh>
                <DataGridTh>Event</DataGridTh>
                <DataGridTh>Status</DataGridTh>
                <DataGridTh>Reference</DataGridTh>
                <DataGridTh>Detail</DataGridTh>
              </DataGridHead>
              <DataGridBody>
                {rows.map((row) => (
                  <DataGridRow key={row.id}>
                    <DataGridTd className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(row.at)}
                    </DataGridTd>
                    <DataGridTd>
                      <StatusChip tone={row.kind === "Operation" ? "info" : "neutral"}>
                        {row.kind === "Operation" ? <Network className="mr-1 h-3 w-3" /> : <Webhook className="mr-1 h-3 w-3" />}
                        {row.kind}
                      </StatusChip>
                    </DataGridTd>
                    <DataGridTd className="font-semibold text-slate-900">{row.provider}</DataGridTd>
                    <DataGridTd className="max-w-60 truncate text-xs" title={row.event}>{row.event}</DataGridTd>
                    <DataGridTd><StatusBadge status={row.status} /></DataGridTd>
                    <DataGridTd className="max-w-52 truncate font-mono text-xs" title={row.reference}>{row.reference}</DataGridTd>
                    <DataGridTd className="max-w-72 truncate text-xs text-slate-500" title={row.detail}>{row.detail}</DataGridTd>
                  </DataGridRow>
                ))}
              </DataGridBody>
            </table>
          </DataGrid>
        ) : (
          <EmptyState
            title="No provider log records"
            description="Operations and webhook processing signals appear here once a provider connection begins handling settlement activity."
            action={{ label: "Open provider connections", href: "/providers" }}
            icon={FileClock}
          />
        )}
      </section>
    </div>
  );
}
