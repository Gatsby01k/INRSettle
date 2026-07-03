import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, FileCheck2, Scale, ShieldCheck } from "lucide-react";
import { NO_FUNDS_DISCLAIMER } from "@/lib/copy";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "INRSettle — Payment completed ≠ settlement finalized",
  description:
    "INRSettle is the control layer around INR payout rails: provider proof, independent reconciliation, append-only audit trail and finality review for every settlement. INRSettle does not move funds.",
  alternates: { canonical: "https://inrsettle.com/" },
  openGraph: {
    title: "INRSettle — Payment completed ≠ settlement finalized",
    description:
      "The control layer around INR payout rails: provider proof, independent reconciliation, audit trail and finality review. INRSettle does not move funds.",
    url: "https://inrsettle.com/",
    type: "website",
  },
};

/**
 * Landing — rebuilt as a first-class Next page in the product's design system.
 *
 * Structural doctrine:
 * - The hero shows the product's OUTPUT (the settlement report), not a
 *   dashboard mock. Enterprise buyers trust documents.
 * - The thesis appears once, as the headline. The no-funds disclaimer appears
 *   twice: once under the hero, once in the footer. Nothing repeats.
 * - Every number on this page is either real, labeled sample, or absent.
 * - One accent color, no animation, typography does the work.
 */

const LOOP = [
  { step: "Quote", detail: "Terms locked, window set" },
  { step: "Approval", detail: "Required before execution" },
  { step: "Provider execution", detail: "The provider moves the money" },
  { step: "Provider proof", detail: "Execution record captured" },
  { step: "Reconciliation", detail: "Independent bank/PSP match" },
  { step: "Audit trail", detail: "Every action recorded" },
  { step: "Finality review", detail: "Approved on evidence" },
] as const;

const SURFACES = [
  {
    icon: Scale,
    title: "Operations console",
    body: "Run INR payout workflows with approval gates and a full lifecycle per settlement — requested, approved, executing, settled, reconciled.",
    facts: ["Dual-control approvals", "Quote-locked terms", "Per-settlement lifecycle"],
  },
  {
    icon: CheckCircle2,
    title: "Independent reconciliation",
    body: "Bank and PSP records matched against settlements before anything is treated as final. A provider's own status never counts as the match.",
    facts: ["Provider claims excluded by design", "Auto-match at 100% confidence only", "Exception queue with aging"],
  },
  {
    icon: FileCheck2,
    title: "Evidence & audit",
    body: "An append-only audit trail behind every decision, and a referenceable report per settlement that finance, auditors and partners can rely on.",
    facts: ["Stable report IDs", "Before/after state on every event", "CSV & JSON exports"],
  },
] as const;

const AUDIENCES = [
  { who: "Payout operators", need: "Approval gates, provider proof and a finality queue instead of spreadsheets." },
  { who: "PSPs & payout providers", need: "Independent settlement evidence for your customers, and documented go-live readiness." },
  { who: "Treasury & OTC desks", need: "INR ↔ USDT settlement legs reconciled against bank records before they count as final." },
  { who: "Compliance & risk", need: "Every approval, match and finality decision in an exportable, append-only record." },
] as const;

const CONTROLS = [
  "Append-only audit trail",
  "Role-based access",
  "Dual-control approvals",
  "Signed webhooks",
  "Exportable evidence",
] as const;

function CtaPair({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)}>
      <Link href="/contact?intent=access" className={cn(buttonVariants({ variant: "primary", size: "default" }), "lp-cta-primary")}>
        Start a pilot
      </Link>
      <Link
        href="/sample-report"
        className={cn(buttonVariants({ variant: "outline", size: "default" }), "lp-arrow-link inline-flex items-center gap-1.5")}
      >
        View a sample report
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}


/** Engraved rail atlas — the brand motif as security print, not animation. */
function RailAtlas() {
  return (
    <div className="lp-atlas" aria-hidden="true">
      <svg viewBox="0 0 1400 520" fill="none" preserveAspectRatio="xMidYMin slice">
        <defs>
          <linearGradient id="railTeal" x1="0" y1="0" x2="1400" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0bb4c4" stopOpacity="0" />
            <stop offset="0.3" stopColor="#0bb4c4" stopOpacity="0.35" />
            <stop offset="0.7" stopColor="#00c79d" stopOpacity="0.3" />
            <stop offset="1" stopColor="#00c79d" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="railGold" x1="0" y1="0" x2="1400" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f2ad23" stopOpacity="0" />
            <stop offset="0.35" stopColor="#f2ad23" stopOpacity="0.4" />
            <stop offset="0.75" stopColor="#f2ad23" stopOpacity="0.28" />
            <stop offset="1" stopColor="#f2ad23" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* latitude hints — the map without the map */}
        <path d="M-40,150 Q 700,110 1440,150" stroke="rgba(7,17,31,0.045)" strokeWidth="1" />
        <path d="M-40,300 Q 700,255 1440,300" stroke="rgba(7,17,31,0.04)" strokeWidth="1" />
        <path d="M-40,440 Q 700,390 1440,440" stroke="rgba(7,17,31,0.03)" strokeWidth="1" />
        {/* settlement rails — one gold thread among teal */}
        <path d="M-40,340 C 320,200 640,380 960,250 S 1300,180 1440,240" stroke="url(#railTeal)" strokeWidth="1.1" />
        <path d="M-40,255 C 360,335 700,170 1040,280 S 1330,330 1440,290" stroke="url(#railGold)" strokeWidth="0.9" />
        <path d="M-40,180 C 400,300 760,120 1120,250" stroke="url(#railTeal)" strokeWidth="0.7" strokeDasharray="1 7" />
        {/* corridor nodes — engraved, still */}
        <g>
          <circle cx="410" cy="266" r="14" fill="rgba(0,199,157,0.07)" />
          <circle cx="410" cy="266" r="2.2" fill="#0bb4c4" fillOpacity="0.55" />
          <circle cx="880" cy="262" r="16" fill="rgba(242,173,35,0.08)" />
          <circle cx="880" cy="262" r="2.4" fill="#f2ad23" fillOpacity="0.6" />
          <circle cx="1180" cy="238" r="12" fill="rgba(0,199,157,0.06)" />
          <circle cx="1180" cy="238" r="2" fill="#00c79d" fillOpacity="0.5" />
        </g>
      </svg>
    </div>
  );
}

/** The hero artifact: a faithful miniature of the product's actual output. */
function ReportArtifact() {
  return (
    <div className="lp-artifact relative">
      <div className="lp-sheet lp-sheet--b" aria-hidden="true" />
      <div className="lp-sheet lp-sheet--a" aria-hidden="true" />
      <div className="lp-artifact-card rounded-2xl border border-[var(--ops-line)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Settlement report · SR-2026-0612
            </p>
            <p className="mt-0.5 text-base font-semibold text-slate-950">SET-8F42K1</p>
          </div>
          <span className="lp-verified inline-flex items-center gap-1.5 rounded-full border border-[var(--status-ok-line)] bg-[var(--status-ok-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--status-ok)]">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            Ready to finalize
          </span>
        </div>

        <dl className="mt-3 space-y-2">
          {[
            { k: "Provider proof", v: "PontisGlobe · completed · UTR verified", ok: true },
            { k: "Independent reconciliation", v: "Bank statement · matched 100%", ok: true },
            { k: "Approval", v: "Dual-control · recorded in audit trail", ok: true },
            { k: "Finality decision", v: "All evidence agrees · low risk", ok: true },
          ].map((row) => (
            <div key={row.k} className="lp-row flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--status-ok-bg)] text-[var(--status-ok)] ring-1 ring-inset ring-[var(--status-ok-line)]">
                <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <dt className="text-sm font-medium text-slate-900">{row.k}</dt>
                <dd className="text-xs text-slate-500">{row.v}</dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-400">10,000.00 USDT → ₹8,31,500.00</p>
          <Link href="/sample-report" className="text-xs font-semibold text-[var(--status-ok)] hover:underline">
            Open the full sample →
          </Link>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">
        The product&apos;s output — a sample evidence package, generated from demonstration data.
      </p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-950 antialiased">
      {/* ── Nav (shared site chrome) ─────────────────────────────────── */}
      <SiteHeader />

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="lp-hero relative overflow-hidden">
          <div className="lp-hero-light pointer-events-none" aria-hidden="true" />
          <RailAtlas />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-20">
            <div>
              <p className="lp-reveal lp-d1 inline-flex items-center gap-2 rounded-full border border-[var(--ops-line)] bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600">
                <span className="lp-gold-dot" aria-hidden="true" />
                Private beta — with selected payout and treasury teams
              </p>
              {/* Visual markup of THESIS — keep wording in sync with lib/copy.ts */}
              <h1 className="lp-reveal lp-d2 mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                <span className="lp-ink">Payment completed</span> <span className="lp-neq">≠</span>{" "}
                <span className="lp-ink">settlement finalized.</span>
              </h1>
              <p className="lp-reveal lp-d3 mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                INRSettle is the control layer around INR payout rails. Every settlement carries provider
                proof, an independently matched bank record, a recorded approval and an append-only audit
                trail — before anyone calls it final.
              </p>
              <CtaPair className="lp-reveal lp-d4 mt-7" />
              <p className="lp-reveal lp-d5 mt-5 text-sm text-slate-400">{NO_FUNDS_DISCLAIMER}</p>
            </div>
            <ReportArtifact />
          </div>
        </section>

        {/* ── The problem ───────────────────────────────────────────────── */}
        <section className="lp-view border-y border-[var(--ops-line)] bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                &ldquo;Completed&rdquo; is what the provider says.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                When a payout provider marks a payment completed, you hold a claim — not proof. Without an
                independent bank or PSP record, you are trusting one side&rsquo;s word. And when a payout is
                questioned months later, a spreadsheet and a chat thread are not a defensible record.
              </p>
              <p className="mt-4 text-lg font-medium leading-relaxed text-slate-900">
                Settlement finality is something you prove, not something you&rsquo;re told.
              </p>
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section id="how-it-works" className="lp-view mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">One loop, seven checkpoints.</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Every settlement moves through the same controlled sequence — the same loop you&rsquo;ll see live
            on the console&rsquo;s home screen. Pilots run alongside your existing payout flow: settlements and
            provider events enter through the console or the partner API, and your bank/PSP records are matched
            as they arrive. No rail migration, and no code required to start.
          </p>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-[var(--ops-line)] bg-[var(--ops-line)] sm:grid-cols-2 lg:grid-cols-7">
            {LOOP.map((item, index) => (
              <li key={item.step} className="lp-step bg-white p-4">
                <span className="lp-step-num text-xs font-semibold tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-950">{item.step}</p>
                <p className="mt-1 text-xs leading-snug text-slate-500">{item.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Platform surfaces ────────────────────────────────────────── */}
        <section id="platform" className="lp-view border-t border-[var(--ops-line)] bg-slate-50/60">
          <div className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Three surfaces. One standard of evidence.
            </h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {SURFACES.map((surface) => {
                const Icon = surface.icon;
                return (
                  <div key={surface.title} className="lp-card rounded-2xl border border-[var(--ops-line)] bg-white p-6">
                    <span className="lp-card-icon inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--status-ok-bg)] text-[var(--status-ok)] ring-1 ring-inset ring-[var(--status-ok-line)]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold tracking-tight">{surface.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{surface.body}</p>
                    <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                      {surface.facts.map((fact) => (
                        <li key={fact} className="flex items-start gap-2 text-sm text-slate-700">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-ok)]" strokeWidth={2.5} aria-hidden="true" />
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Who it's for ─────────────────────────────────────────────── */}
        <section className="lp-view mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Built for teams that have to prove it settled.
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            INRSettle sits around your existing payout rails. It does not replace your providers — it
            verifies them.
          </p>
          <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {AUDIENCES.map((audience) => (
              <div key={audience.who} className="lp-rule border-l-2 border-[var(--status-ok-line)] pl-4">
                <dt className="text-[15px] font-semibold text-slate-950">{audience.who}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-600">{audience.need}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Controls strip ───────────────────────────────────────────── */}
        <section className="lp-view border-y border-[var(--ops-line)] bg-slate-50/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-8 sm:px-6">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              <ShieldCheck className="h-4 w-4 text-[var(--status-ok)]" aria-hidden="true" />
              Enforced, not optional
            </span>
            {CONTROLS.map((control) => (
              <span key={control} className="lp-ctrl text-sm font-medium text-slate-700">
                {control}
              </span>
            ))}
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────────────────────── */}
        <section className="lp-view mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="lp-cert mx-auto max-w-3xl px-6 py-14 text-center sm:px-14">
            <div className="lp-cert-rule" aria-hidden="true" />
            <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Prove your settlements are actually final.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
              Run a pilot on the payouts you already process. Your providers keep moving the money —
              INRSettle proves what happened.
            </p>
            <CtaPair className="mt-8 justify-center" />
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <SiteFooter />
    </div>
  );
}
