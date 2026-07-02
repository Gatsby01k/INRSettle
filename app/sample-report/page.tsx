import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { REPORT_FOOTNOTE } from "@/lib/copy";
import { StatusBadge } from "@/components/ops/status-badge";
import { StatRow } from "@/components/ops/stat-row";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sample settlement report — INRSettle",
  description:
    "An example of the per-settlement evidence package INRSettle produces: quote terms, approvals, provider proof, independent reconciliation, audit trail and finality decision.",
  alternates: { canonical: "https://inrsettle.com/sample-report" },
};

/**
 * Phase 2.1 — the public sample report.
 *
 * This page keeps the landing page's central promise: "View sample report"
 * opens an actual report, not a contact form. It is a static, clearly
 * labeled rendering of the same evidence package the console generates per
 * settlement, using demonstration data only. No session required, no
 * database access, no live claims.
 */

const AUDIT_TRAIL = [
  { from: "PENDING_APPROVAL", to: "APPROVED", note: "Settlement approved by treasury manager (dual-control).", at: "12 Jun 2026, 10:41 IST" },
  { from: "APPROVED", to: "EXECUTING", note: "Provider payout submitted; provider acknowledged sb_demo_pontis_001.", at: "12 Jun 2026, 10:52 IST" },
  { from: "EXECUTING", to: "SETTLED", note: "Provider confirmed payout completed; INR credited to beneficiary account.", at: "12 Jun 2026, 11:19 IST" },
  { from: "SETTLED", to: "RECONCILED", note: "Bank statement record auto-matched (100%); settlement reconciled.", at: "12 Jun 2026, 14:03 IST" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="report-section p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{title}</p>
      {children}
    </div>
  );
}

export default function SampleReportPage() {
  return (
    <div className="app-surface min-h-screen py-8 text-slate-950">
      <div className="mx-auto max-w-3xl space-y-4 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            inrsettle.com
          </Link>
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.06em] text-amber-800">
            Sample — demonstration data
          </span>
        </div>

        <div className="report-sheet space-y-5 p-5 sm:p-6">
          {/* Header */}
          <div className="report-band -mx-5 -mt-5 flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                Settlement report · SR-2026-0612
              </p>
              <h1 className="mt-1 text-xl font-semibold text-slate-950">SET-8F42K1</h1>
              <p className="text-sm text-slate-500">PSP-BATCH-1842 · USDT → INR</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status="RECONCILED" />
            </div>
          </div>

          {/* Finality decision */}
          <div className="finality-banner finality-banner--ready text-emerald-900">
            <div className="flex flex-wrap items-center justify-between gap-2 pl-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="text-base font-semibold tracking-tight">Ready to finalize</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-emerald-800">
                Low risk
              </span>
            </div>
            <p className="mt-2 pl-2 text-sm leading-relaxed opacity-90">
              Provider proof, an independently matched bank record and a recorded dual-control approval all
              agree. Nothing blocks finality.
            </p>
          </div>

          {/* Quote terms */}
          <Section title="Quote terms">
            <StatRow label="Corridor" value="USDT → INR" />
            <StatRow label="Rate" value="83.1500 INR / USDT (desk rate, locked)" />
            <StatRow label="Fee" value="45.00 USDT (45 bps)" />
            <StatRow label="Quote validity" value="15 minutes · accepted before expiry" />
          </Section>

          {/* Settlement summary */}
          <Section title="Settlement summary">
            <StatRow label="Source" value="10,000.00 USDT · USDT Treasury Wallet" />
            <StatRow label="Destination" value="₹8,31,500.00 · INR Settlement Account" />
            <StatRow label="Provider" value="PontisGlobe (sandbox)" />
            <StatRow label="Created" value="12 Jun 2026, 10:38 IST" />
            <StatRow label="Approved" value="12 Jun 2026, 10:41 IST" />
            <StatRow label="Settled" value="12 Jun 2026, 11:19 IST" />
            <StatRow label="Reconciled" value="12 Jun 2026, 14:03 IST" />
          </Section>

          {/* Provider proof */}
          <Section title="Provider proof">
            <StatRow label="Provider" value="PontisGlobe (sandbox)" />
            <StatRow label="Provider status" value="completed" />
            <StatRow label="Transaction" value="sb_demo_pontis_001" />
            <StatRow label="UTR / reference" value="UTR2606DEMO0001" />
            <StatRow label="Reported amount" value="₹8,31,500.00" />
            <StatRow label="Received via" value="Signed webhook (HMAC verified)" />
          </Section>

          {/* Independent reconciliation */}
          <Section title="Independent reconciliation">
            <StatRow label="External reference" value="BANK-STMT-04412" />
            <StatRow label="Source" value="Bank statement" />
            <StatRow label="Match" value="MATCHED · 100% (amount + currency + value date)" />
            <StatRow label="Amount" value="₹8,31,500.00" />
            <StatRow label="Value date" value="12 Jun 2026" />
            <p className="mt-2">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.05em] text-emerald-700">
                Independent evidence
              </span>
              <span className="ml-2 text-xs text-slate-500">
                Provider claims never count as reconciliation evidence.
              </span>
            </p>
          </Section>

          {/* Approval & audit trail */}
          <Section title="Approval & audit trail">
            <StatRow label="Approval recorded" value="Yes — second operator (dual-control)" />
            <ol className="relative mt-3 space-y-3 border-l border-slate-200 pl-4">
              {AUDIT_TRAIL.map((event) => (
                <li key={event.at} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-emerald" />
                  <p className="text-sm font-medium text-slate-950">
                    {event.from} → {event.to}
                  </p>
                  <p className="text-xs text-slate-500">{event.note}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{event.at}</p>
                </li>
              ))}
            </ol>
          </Section>

          <p className="report-footnote pt-3">{REPORT_FOOTNOTE}</p>
          <p className="text-xs leading-relaxed text-slate-400">
            This sample is generated from demonstration data. In the console, every report is built from
            persisted evidence for a specific settlement and recorded in the append-only audit trail.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pb-6 pt-2">
          <Link href="/contact?intent=access" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
            Start a pilot
          </Link>
          <Link href="/contact?intent=sales" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Talk to us
          </Link>
        </div>
      </div>
    </div>
  );
}
