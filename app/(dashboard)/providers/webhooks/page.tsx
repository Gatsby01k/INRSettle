import { Fingerprint, Webhook } from "lucide-react";
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

export const metadata = { title: "Provider webhooks" };

export default async function ProviderWebhooksPage() {
  const { organization } = await requireSession();
  const events = await prisma.providerWebhookEvent.findMany({
    where: { organizationId: organization.id },
    include: { providerConnection: { select: { displayName: true } } },
    orderBy: { receivedAt: "desc" },
    take: 200,
  });

  const processed = events.filter((item) => item.status === "PROCESSED").length;
  const failed = events.filter((item) => item.status === "FAILED").length;
  const invalid = events.filter((item) => !item.signatureValid).length;
  const pending = events.filter((item) => item.status === "RECEIVED").length;

  return (
    <div className="space-y-6">
      <AreaTabs area="providers" />
      <PageHeader
        title="Provider webhooks"
        description="Verified callback inbox with event identity, payload integrity and processing outcome. Payload contents remain server-side."
        stats={[
          { label: "Deliveries", value: events.length, tone: "neutral" },
          { label: "Processed", value: processed, tone: processed ? "ok" : "neutral" },
          { label: "Pending", value: pending, tone: pending ? "pending" : "neutral" },
          { label: "Exceptions", value: failed + invalid, tone: failed + invalid ? "blocked" : "ok" },
        ]}
      />

      <section>
        <SectionHeader
          title="Webhook inbox"
          description="Connector-specific signature verification occurs before a delivery can affect settlement state."
        />
        {events.length ? (
          <DataGrid>
            <table className="w-full min-w-[980px]">
              <DataGridHead>
                <DataGridTh>Received</DataGridTh>
                <DataGridTh>Provider</DataGridTh>
                <DataGridTh>Event key</DataGridTh>
                <DataGridTh>Signature</DataGridTh>
                <DataGridTh>Processing</DataGridTh>
                <DataGridTh>Payload hash</DataGridTh>
                <DataGridTh>Completed</DataGridTh>
                <DataGridTh>Error</DataGridTh>
              </DataGridHead>
              <DataGridBody>
                {events.map((event) => (
                  <DataGridRow key={event.id}>
                    <DataGridTd className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(event.receivedAt)}
                    </DataGridTd>
                    <DataGridTd className="font-semibold text-slate-900">
                      {event.providerConnection?.displayName ?? event.providerCode}
                    </DataGridTd>
                    <DataGridTd className="font-mono text-xs">{event.eventKey}</DataGridTd>
                    <DataGridTd>
                      <StatusChip tone={event.signatureValid ? "success" : "danger"} dot>
                        {event.signatureValid ? "Verified" : "Rejected"}
                      </StatusChip>
                    </DataGridTd>
                    <DataGridTd><StatusBadge status={event.status} /></DataGridTd>
                    <DataGridTd className="font-mono text-xs text-slate-500">
                      {event.payloadHash.slice(0, 16)}…
                    </DataGridTd>
                    <DataGridTd className="whitespace-nowrap text-xs text-slate-500">
                      {event.processedAt ? formatDateTime(event.processedAt) : "Not completed"}
                    </DataGridTd>
                    <DataGridTd className="max-w-64 truncate text-xs text-slate-500" title={event.errorMessage ?? undefined}>
                      {event.errorMessage ?? "No error"}
                    </DataGridTd>
                  </DataGridRow>
                ))}
              </DataGridBody>
            </table>
          </DataGrid>
        ) : (
          <EmptyState
            title="No webhook deliveries recorded"
            description="Verified and rejected callback attempts will appear here after a provider connection begins sending events."
            action={{ label: "Review provider connections", href: "/providers" }}
            icon={Webhook}
          />
        )}
      </section>

      <div className="ops-panel flex items-start gap-3 p-5">
        <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-slate-950">Replay protection</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Provider code and event key are unique. Repeated delivery cannot create a second webhook inbox record or duplicate the same provider effect.
          </p>
        </div>
      </div>
    </div>
  );
}
