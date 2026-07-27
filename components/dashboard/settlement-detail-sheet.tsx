"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { SettlementLifecycle } from "@/components/ops/settlement-lifecycle";
import { StatusBadge } from "@/components/ops/status-badge";
import { StatRow } from "@/components/ops/stat-row";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FinalityReview, type FinalityReviewData } from "@/components/dashboard/finality-review";

export type SettlementDetail = {
  publicId: string;
  reference: string;
  corridor: string;
  status: string;
  provider?: string;
  providerTransactionId?: string;
  fundingStatus: string;
  fundingRequired?: string;
  fundedAmount?: string;
  sourceAmount: string;
  targetAmount: string;
  feeAmount: string;
  createdAt: string;
  approvedAt?: string;
  settledAt?: string;
  reconciledAt?: string;
  sourceAccount: string;
  targetAccount: string;
  events: { label: string; note?: string; at: string }[];
  reconciliation: { externalRef: string; source: string; status: string; amount: string; valueDate: string }[];
  finality: FinalityReviewData;
};

export function SettlementDetailSheet({
  settlement,
  defaultTab = "overview",
  triggerLabel = "Details",
}: {
  settlement: SettlementDetail;
  defaultTab?: "overview" | "audit" | "reconciliation" | "finality";
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const sheetKey = `${settlement.status}-${settlement.providerTransactionId ?? ""}-${settlement.events.length}-${defaultTab}`;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <SheetContent
        key={sheetKey}
        eyebrow="Settlement"
        title={settlement.publicId}
        description={settlement.reference}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={settlement.status} />
          <span
            className={
              settlement.finality.decision === "ready_to_finalize"
                ? "case-chip border-emerald-200 bg-emerald-50 text-emerald-700"
                : settlement.finality.decision === "needs_review"
                  ? "case-chip case-chip--gold"
                  : "case-chip case-chip--shadow"
            }
          >
            {settlement.finality.decision === "ready_to_finalize"
              ? "Finality ready"
              : settlement.finality.decision === "needs_review"
                ? "Finality review"
                : "Finality pending"}
          </span>
          <span className="text-xs text-slate-500">{settlement.corridor}</span>
        </div>

        <div className="rounded-lg border border-[var(--ops-line-soft)] bg-slate-50 p-4">
          <SettlementLifecycle status={settlement.status} />
        </div>

        <Tabs defaultValue={defaultTab} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">
              Overview
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex-1">
              Audit trail
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="flex-1">
              Reconciliation
            </TabsTrigger>
            <TabsTrigger value="finality" className="flex-1">
              Finality
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="rounded-lg border border-[var(--ops-line)] p-3">
              <StatRow label="Source amount" value={settlement.sourceAmount} />
              <StatRow label="Destination amount" value={settlement.targetAmount} />
              <StatRow label="Fee" value={settlement.feeAmount} />
              <StatRow label="Source account" value={settlement.sourceAccount} />
              <StatRow label="Target account" value={settlement.targetAccount} />
              <StatRow label="Created" value={settlement.createdAt} />
              {settlement.approvedAt ? <StatRow label="Approved" value={settlement.approvedAt} /> : null}
              {settlement.settledAt ? <StatRow label="Settled" value={settlement.settledAt} /> : null}
              {settlement.reconciledAt ? <StatRow label="Reconciled" value={settlement.reconciledAt} /> : null}
              {settlement.provider ? <StatRow label="Provider" value={settlement.provider} /> : null}
              {settlement.providerTransactionId ? (
                <StatRow label="Provider transaction" value={settlement.providerTransactionId} />
              ) : null}
              <StatRow label="Funding status" value={settlement.fundingStatus.replaceAll("_", " ")} />
              {settlement.fundingRequired ? <StatRow label="Funding required" value={settlement.fundingRequired} /> : null}
              {settlement.fundedAmount ? <StatRow label="Funded amount" value={settlement.fundedAmount} /> : null}
            </div>
          </TabsContent>

          <TabsContent value="audit">
            {settlement.events.length ? (
              <ol className="relative space-y-4 border-l border-slate-200 pl-4">
                {settlement.events.map((event, index) => (
                  <li key={`${event.label}-${index}`} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-emerald" />
                    <p className="text-sm font-medium text-slate-950">{event.label}</p>
                    {event.note ? <p className="text-xs text-slate-500">{event.note}</p> : null}
                    <p className="mt-0.5 text-[11px] text-slate-400">{event.at}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-lg border border-[var(--ops-line-soft)] bg-slate-50 px-3 py-5 text-sm text-slate-600">
                Lifecycle events will appear here as the settlement moves through approval and provider execution.
              </p>
            )}
          </TabsContent>

          <TabsContent value="reconciliation">
            {settlement.reconciliation.length ? (
              <div className="space-y-2">
                {settlement.reconciliation.map((record) => (
                  <div key={record.externalRef} className="rounded-lg border border-[var(--ops-line)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-950">{record.externalRef}</p>
                      <StatusBadge status={record.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        {record.source}
                        <ArrowRight className="h-3 w-3" />
                        {record.amount}
                      </span>
                      <span>Value date {record.valueDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-[var(--ops-line-soft)] bg-slate-50 px-3 py-5 text-sm text-slate-600">
                No independent record is linked yet. Add or match a bank or PSP record in Reconciliation.
              </p>
            )}
          </TabsContent>

          <TabsContent value="finality">
            <FinalityReview data={settlement.finality} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
