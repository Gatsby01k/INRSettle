import Link from "next/link";
import { ArrowRight, Download, FileCheck2, FileClock, FileSpreadsheet, Scale } from "lucide-react";
import { SettlementStatus } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ops/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatNumberCompact } from "@/lib/utils";

export const metadata = { title: "Reports & exports" };

// Reports & exports — the evidence surface of the console. Two layers:
// 1. Per-settlement evidence packages (the settlement report), and
// 2. Full-ledger exports for finance, compliance and partner review.
// Everything is generated on demand from persisted, org-scoped data.

const EXPORTS = [
  {
    type: "settlement",
    icon: FileSpreadsheet,
    title: "Settlement ledger",
    description:
      "Every settlement with its full lifecycle — created, approved, executed, settled, reconciled — plus amounts, fees, provider and provider transaction ID.",
    contents: ["Settlement ID", "Lifecycle timestamps", "Amounts & fees", "Provider", "Provider transaction ID", "Status"],
  },
  {
    type: "reconciliation",
    icon: Scale,
    title: "Reconciliation ledger",
    description:
      "Independent bank/PSP records with match status, confidence, linked settlement and exception reasons. Provider claims are flagged and never count as matches.",
    contents: ["External reference", "Evidence source", "Match status & confidence", "Linked settlement", "Exception reason"],
  },
  {
    type: "audit",
    icon: FileClock,
    title: "Audit trail",
    description:
      "The append-only record of every operator, provider and system action — approvals, transitions, matches, finality decisions — with actor and before/after state.",
    contents: ["Actor & actor type", "Action", "Resource", "Before / after state", "Timestamp"],
  },
] as const;

export default async function ReportsPage() {
  const { organization } = await requireSession();

  const completedStatus = { in: [SettlementStatus.SETTLED, SettlementStatus.RECONCILED] };
  const [settlementCount, reconciliationCount, auditCount, reportsGenerated, latestCompleted] = await Promise.all([
    prisma.settlement.count({ where: { organizationId: organization.id } }),
    prisma.reconciliationRecord.count({ where: { organizationId: organization.id } }),
    prisma.auditLog.count({ where: { organizationId: organization.id } }),
    prisma.auditLog.count({ where: { organizationId: organization.id, action: "settlement.report_generated" } }),
    prisma.settlement.findFirst({
      where: { organizationId: organization.id, status: completedStatus },
      orderBy: [{ reconciledAt: "desc" }, { settledAt: "desc" }],
      select: { id: true, publicId: true },
    }),
  ]);

  const counts: Record<string, number> = {
    settlement: settlementCount,
    reconciliation: reconciliationCount,
    audit: auditCount,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports & exports"
        description="Audit-ready evidence for finance, compliance and partner review — per-settlement evidence packages plus full-ledger exports."
      />

      {/* Featured: per-settlement evidence package */}
      <section className="ops-panel p-4 sm:p-5" aria-label="Settlement evidence package">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-[#00c79d]/15 to-[#0bb4c4]/5 text-brand-emerald-ink ring-1 ring-[#00c79d]/25">
              <FileCheck2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">
                  Settlement evidence package
                </h2>
                <span className="case-chip border-emerald-200 bg-emerald-50 text-emerald-700">
                  {reportsGenerated} generated
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
                One report per settlement, built from persisted evidence: quote terms, approvals, provider proof,
                the matched independent record, the audit trail and the finality decision. Print-ready and safe to
                forward to finance, auditors or partners.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {[
                  "Settlement ID",
                  "Quote terms",
                  "Provider & transaction ID",
                  "Approval trail",
                  "Provider proof",
                  "Reconciliation result",
                  "Audit trail",
                  "Finality decision",
                ].map((item) => (
                  <span key={item} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{item}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {latestCompleted ? (
              <Link
                href={`/settlements/${latestCompleted.id}/report`}
                className={cn(buttonVariants({ variant: "primary", size: "sm" }), "inline-flex items-center gap-1.5")}
              >
                Latest report · {latestCompleted.publicId}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : null}
            <Link href="/settlements" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Browse settlements
            </Link>
          </div>
        </div>
      </section>

      {/* Ledger exports */}
      <section aria-label="Ledger exports">
        <p className="ops-eyebrow mb-2">Ledger exports</p>
        <div className="space-y-2.5">
          {EXPORTS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.type} className="ops-panel ops-card-hover p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-[var(--ops-line)]">
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold tracking-tight text-slate-950">{item.title}</h3>
                        <span className="text-[11px] tabular-nums text-slate-400">
                          {formatNumberCompact(counts[item.type])} record{counts[item.type] === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-500">{item.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.contents.map((column) => (
                          <span key={column} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{column}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`/api/reports?type=${item.type}&format=csv`}
                      className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      CSV
                    </a>
                    <a
                      href={`/api/reports?type=${item.type}&format=json`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      JSON
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="ops-helper">
        Exports are generated on demand, scoped to {organization.displayName}, and drawn from the same persisted
        records the audit trail covers. Nothing is sampled or recomputed.
      </p>
    </div>
  );
}
