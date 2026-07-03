import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { NO_FUNDS_DISCLAIMER } from "@/lib/copy";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "INRSettle — Payment completed ≠ settlement finalized",
  description:
    "INRSettle verifies settlement of INR payouts made through third-party providers — recorded approval, provider proof, independent bank reconciliation and an audit trail for every payment — without moving funds.",
  alternates: { canonical: "https://inrsettle.com/" },
  openGraph: {
    title: "INRSettle — Payment completed ≠ settlement finalized",
    description:
      "Recorded approval, provider proof, independent reconciliation and an audit trail for every payment. Providers move money; INRSettle proves what happened.",
    url: "https://inrsettle.com/",
    type: "website",
  },
};

/**
 * THE EVIDENCE ENGINE — landing rebuilt from zero.
 *
 * Concept: the page assembles a settlement evidence package in front of the
 * visitor. A gold spine runs the length of the site; five acts add the five
 * evidence layers along it — approval, provider proof, reconciliation, audit
 * trail, finality — and the story closes with the sealed verdict. The form
 * of the page IS the product truth. All data shown is labeled demonstration
 * data; every sentence is verifiable against the product as built.
 */

/* ── The five acts of evidence ──────────────────────────────────────── */
const AUDIENCES = [
  { who: "Payout operators", need: "Approval gates, provider proof and a finality queue instead of spreadsheets." },
  { who: "PSPs & payout providers", need: "Independent settlement evidence for your customers, and documented go-live readiness." },
  { who: "Treasury & OTC desks", need: "INR ↔ USDT settlement legs reconciled against bank records before they count as final." },
  { who: "Compliance & risk", need: "Every approval, match and finality decision in an exportable, append-only record." },
] as const;

/* ── The chamber atlas: engraved corridor field filling the hero ───── */
function ChamberAtlas() {
  return (
    <div className="lp-atlas" aria-hidden="true">
      <svg viewBox="0 0 1600 900" fill="none" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="eeTeal" x1="0" y1="0" x2="1600" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0bb4c4" stopOpacity="0" />
            <stop offset="0.3" stopColor="#0bb4c4" stopOpacity="0.3" />
            <stop offset="0.7" stopColor="#00c79d" stopOpacity="0.26" />
            <stop offset="1" stopColor="#00c79d" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="eeGold" x1="0" y1="0" x2="1600" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f2ad23" stopOpacity="0" />
            <stop offset="0.4" stopColor="#f2ad23" stopOpacity="0.35" />
            <stop offset="1" stopColor="#f2ad23" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M-60,180 Q 800,120 1660,180" stroke="rgba(7,17,31,0.05)" strokeWidth="1" />
        <path d="M-60,420 Q 800,340 1660,420" stroke="rgba(7,17,31,0.04)" strokeWidth="1" />
        <path d="M-60,680 Q 800,590 1660,680" stroke="rgba(7,17,31,0.035)" strokeWidth="1" />
        <path d="M-60,520 C 380,340 760,560 1140,380 S 1520,300 1660,360" stroke="url(#eeTeal)" strokeWidth="1.2" />
        <path d="M-60,380 C 420,520 820,280 1220,440 S 1560,500 1660,460" stroke="url(#eeGold)" strokeWidth="1" />
        <path d="M-60,260 C 460,440 880,200 1300,380" stroke="url(#eeTeal)" strokeWidth="0.7" strokeDasharray="1 8" />
        <g>
          <circle cx="480" cy="430" r="16" fill="rgba(0,199,157,0.07)" />
          <circle cx="480" cy="430" r="2.4" fill="#0bb4c4" fillOpacity="0.5" />
          <circle cx="1010" cy="405" r="18" fill="rgba(242,173,35,0.08)" />
          <circle cx="1010" cy="405" r="2.6" fill="#f2ad23" fillOpacity="0.55" />
          <circle cx="1330" cy="390" r="13" fill="rgba(0,199,157,0.06)" />
          <circle cx="1330" cy="390" r="2.1" fill="#00c79d" fillOpacity="0.5" />
        </g>
      </svg>
    </div>
  );
}

/* ── The monumental object: the evidence package itself ────────────── */
function EvidencePackage() {
  return (
    <div className="ee-package mx-auto w-full max-w-2xl">
      <div className="lp-sheet lp-sheet--b" aria-hidden="true" />
      <div className="lp-sheet lp-sheet--a" aria-hidden="true" />
      <div className="ee-package-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
              Settlement evidence package · SR-2026-0612
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">SET-8F42K1</p>
            <p className="text-sm text-slate-500">10,000.00 USDT → ₹8,31,500.00 · PontisGlobe (sandbox)</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--status-ok-line)] bg-[var(--status-ok-bg)] px-3 py-1 text-xs font-semibold text-[var(--status-ok)]">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            Ready to finalize
          </span>
        </div>

        <div className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {[
            ["Recorded approval", "Dual-control · treasury manager"],
            ["Provider proof", "completed · UTR verified"],
            ["Independent reconciliation", "Bank statement · matched 100%"],
            ["Audit trail", "4 events · append-only"],
            ["Guardrails", "Within cap · live payouts disabled"],
            ["Finality decision", "All evidence agrees · low risk"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--status-ok-bg)] text-[var(--status-ok)] ring-1 ring-inset ring-[var(--status-ok-line)]">
                <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-snug text-slate-900">{k}</p>
                <p className="text-xs leading-snug text-slate-500">{v}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400">Demonstration data · every field exists in the real report</p>
          <Link
            href="/sample-report"
            className="lp-arrow-link inline-flex items-center gap-1 text-xs font-semibold text-[var(--status-ok)] hover:underline"
          >
            Open the full document
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        <span className="ee-seal" aria-hidden="true">
          <Check className="h-6 w-6" strokeWidth={2.75} />
        </span>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-950 antialiased">
      <SiteHeader />

      <main className="relative">
        {/* ════ ACT 0 · THE CHAMBER ═══════════════════════════════════ */}
        <section className="ee-chamber">
          <ChamberAtlas />
          <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-16 text-center sm:px-6 lg:pt-24">
            <p className="lp-reveal lp-d1 mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--ops-line)] bg-white/75 px-3.5 py-1 text-xs font-semibold text-slate-600 backdrop-blur">
              <span className="lp-gold-dot" aria-hidden="true" />
              Private beta — for payout, treasury &amp; settlement teams
            </p>

            {/* Visual markup of THESIS — keep wording in sync with lib/copy.ts */}
            <h1 className="ee-display lp-reveal lp-d2 mx-auto mt-7 max-w-4xl">
              <span className="lp-ink">Payment completed</span> <span className="lp-neq">≠</span>{" "}
              <span className="lp-ink">settlement finalized.</span>
            </h1>

            <p className="lp-reveal lp-d3 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              Providers move money. INRSettle proves what happened — recorded approval, provider
              proof, independent reconciliation and an audit trail, for every payment.
            </p>

            <div className="lp-reveal lp-d4 mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/contact?intent=access"
                className={cn(buttonVariants({ variant: "primary", size: "lg" }), "lp-cta-primary")}
              >
                Start a pilot
              </Link>
              <Link
                href="/sample-report"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "lp-arrow-link inline-flex items-center gap-1.5")}
              >
                View a sample report
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <p className="lp-reveal lp-d5 mt-6 text-sm text-slate-400">{NO_FUNDS_DISCLAIMER}</p>

            <div className="mt-14 lg:mt-16">
              <EvidencePackage />
            </div>
          </div>
        </section>

        {/* ════ THE ASSEMBLY · five scenes, five compositions ═════════ */}
        <section id="how-it-works" className="relative scroll-mt-20" aria-label="How the evidence assembles">
          <div className="ee-spine" aria-hidden="true" />

          <div className="mx-auto max-w-6xl px-4 pt-20 text-center sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--status-pending)]">
              The evidence engine
            </p>
            <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Five layers of evidence. One defensible record.
            </h2>
          </div>

          {/* 01 · THE SIGNATURE — an approval slip lands on the spine */}
          <article className="ee-act relative mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
            <p className="ee-act-num" aria-hidden="true">01</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Approval, before anything moves</h3>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-slate-600">
              Every settlement starts from quote-locked terms and a recorded approval. Creators cannot
              approve their own settlements — dual control is enforced, not optional.
            </p>
            <div className="ee-slip relative z-10 mx-auto mt-9 max-w-md p-5 text-left">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Approval record</p>
                <span className="rounded-full bg-[var(--status-ok-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-ok)]">Recorded</span>
              </div>
              <dl className="mt-3 space-y-2">
                {[
                  ["Quote", "83.1500 INR/USDT · locked · 15 min"],
                  ["Approved by", "Treasury manager · second operator"],
                  ["Control", "Dual-control · self-approval rejected"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4">
                    <dt className="shrink-0 text-xs text-slate-400">{k}</dt>
                    <dd className="text-right text-[13px] font-medium text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </article>

          {/* 02 · THE WIRE — provider proof as a full-width ticket */}
          <article className="ee-act relative px-4 py-16 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <div className="max-w-lg">
                <p className="ee-act-num" aria-hidden="true">02</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">The provider executes. The proof is captured.</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                  Your provider moves the money. INRSettle captures the provider&rsquo;s own execution
                  record — transaction ID, UTR, reported amount — delivered over signed webhooks.
                </p>
              </div>
              <div className="ee-ticket relative z-10 mt-9">
                {[
                  ["Provider", "PontisGlobe (sandbox)"],
                  ["Transaction", "sb_demo_pontis_001"],
                  ["UTR", "UTR2606DEMO0001 · verified"],
                  ["Received via", "Signed webhook · HMAC"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{k}</p>
                    <p className="mt-1 text-sm font-medium tabular-nums text-slate-900">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>

          {/* 03 · THE MATCH — claim meets independent record */}
          <article className="ee-act ee-match-scene relative px-4 py-16 text-center sm:px-6">
            <p className="ee-act-num" aria-hidden="true">03</p>
            <h3 className="mx-auto mt-2 max-w-xl text-2xl font-semibold tracking-tight">One side&rsquo;s word is never enough</h3>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-slate-600">
              Bank and PSP records are matched against every settlement — amount, currency, value date.
              Provider claims are excluded from reconciliation by design.
            </p>
            <div className="relative z-10 mx-auto mt-10 flex max-w-4xl flex-col items-center gap-5 lg:flex-row lg:items-stretch lg:gap-0">
              <div className="ee-claim w-full flex-1 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--status-pending)]">Provider claim · excluded from matching</p>
                <p className="mt-2 text-sm font-medium text-slate-900">status: completed</p>
                <p className="text-sm tabular-nums text-slate-600">reported ₹8,31,500.00</p>
              </div>
              <div className="relative z-20 -my-3 flex items-center justify-center lg:-mx-5 lg:my-auto">
                <span className="ee-bracket text-lg" aria-label="matched">=</span>
              </div>
              <div className="ee-bank w-full flex-1 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--status-ok)]">Bank record · independent evidence</p>
                <p className="mt-2 text-sm font-medium text-slate-900">BANK-STMT-04412</p>
                <p className="text-sm tabular-nums text-slate-600">₹8,31,500.00 · value date 12 Jun 2026</p>
              </div>
            </div>
            <p className="relative z-10 mt-6 inline-flex items-center gap-1.5 rounded-full border border-[var(--status-ok-line)] bg-[var(--status-ok-bg)] px-3 py-1 text-xs font-semibold text-[var(--status-ok)]">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
              MATCHED · 100% — amount + currency + value date
            </p>
          </article>

          {/* 04 · THE LEDGER — the black-box recorder, the one dark object */}
          <article className="ee-act relative px-4 py-16 sm:px-6">
            <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="ee-ledger relative z-10 p-6">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Audit trail</p>
                  <p className="text-[11px] text-white/40">append-only</p>
                </div>
                <div className="mt-2">
                  {[
                    ["PENDING_APPROVAL → APPROVED", "10:41:07 IST"],
                    ["APPROVED → EXECUTING", "10:52:31 IST"],
                    ["EXECUTING → SETTLED", "11:19:04 IST"],
                    ["SETTLED → RECONCILED", "14:03:56 IST"],
                  ].map(([event, at]) => (
                    <div key={event} className="ee-ledger-row">
                      <span className="ok">{event}</span>
                      <span className="text-white/45">{at}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                  Actor and before/after state recorded on every event.
                </p>
              </div>
              <div>
                <p className="ee-act-num" aria-hidden="true">04</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Every action, on the record</h3>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-600">
                  Approvals, transitions, matches and decisions are written to an append-only audit
                  trail. When a payout is questioned, the answer is a query — not a memory.
                </p>
              </div>
            </div>
          </article>

          {/* 05 · THE VERDICT ARRIVES — the finality decision, sealed */}
          <article className="ee-act relative px-4 pb-20 pt-16 sm:px-6">
            <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
              <div>
                <p className="ee-act-num" aria-hidden="true">05</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Finality is a decision, made on evidence</h3>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-600">
                  A deterministic engine weighs the four inputs — proof, independent match, approval,
                  guardrails — and renders the decision. The same engine answers the console and the
                  API; they can never disagree.
                </p>
              </div>
              <div className="ee-fragment relative z-10 p-6" style={{ transform: "rotate(0.8deg)" }}>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 pl-2">
                  <p className="text-sm font-semibold tracking-tight text-slate-950">Finality review</p>
                  <span className="rounded-full bg-[var(--status-ok-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--status-ok)]">Ready to finalize</span>
                </div>
                <dl className="mt-3 space-y-2.5 pl-2">
                  {[
                    ["Provider proof", "Verified"],
                    ["Independent reconciliation", "Verified"],
                    ["Recorded approval", "Verified"],
                    ["Guardrails", "Within cap · live payouts disabled"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4">
                      <dt className="text-[13px] text-slate-500">{k}</dt>
                      <dd className="text-right text-[13px] font-medium text-[var(--status-ok)]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <span className="ee-seal" aria-hidden="true">
                  <Check className="h-6 w-6" strokeWidth={2.75} />
                </span>
              </div>
            </div>
          </article>
        </section>

        {/* ════ THE VERDICT ═══════════════════════════════════════════ */}
        <section id="platform" className="ee-verdict scroll-mt-20">
          <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
            <div className="lp-cert-rule" aria-hidden="true" />
            <h2 className="ee-display mx-auto mt-8 max-w-3xl">
              <span className="lp-ink">Settlement finality is something you prove,</span>{" "}
              <span className="lp-ink">not something you&rsquo;re told.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-slate-600">
              The result is a report per settlement that finance teams, auditors and counterparties
              can rely on — print-ready, referenceable, and built only from persisted evidence.
            </p>
            <Link
              href="/sample-report"
              className={cn(buttonVariants({ variant: "outline", size: "default" }), "lp-arrow-link mt-8 inline-flex items-center gap-1.5")}
            >
              Read the sample evidence package
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* ════ DISTRIBUTION — who this document is prepared for ═════ */}
        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6" aria-label="Distribution">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--status-pending)]">Distribution</p>
          <h2 className="mx-auto mt-3 max-w-xl text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            This record is prepared for.
          </h2>
          <div className="ee-dossier mt-10">
            {AUDIENCES.map((audience, index) => (
              <div key={audience.who} className="ee-dossier-row">
                <span className="ee-dossier-num">{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-base font-semibold tracking-tight text-slate-950">{audience.who}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{audience.need}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm font-medium text-slate-600">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              <ShieldCheck className="h-4 w-4 text-[var(--status-ok)]" aria-hidden="true" />
              Enforced, not optional
            </span>
            {["Append-only audit trail", "Role-based access", "Dual-control approvals", "Signed webhooks", "Exportable evidence"].map(
              (control) => (
                <span key={control} className="lp-ctrl">{control}</span>
              ),
            )}
          </p>
        </section>

        {/* ════ THE SIGNATURE PAGE — the instrument closes ════════════ */}
        <section className="ee-signature relative px-4 pb-24 pt-24 text-center sm:px-6">
          <span
            className="ee-seal relative mx-auto grid"
            style={{ position: "relative", right: "auto", bottom: "auto" }}
            aria-hidden="true"
          >
            <Check className="h-6 w-6" strokeWidth={2.75} />
          </span>
          <h2 className="mx-auto mt-7 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Prove your settlements are actually final.
          </h2>
          <div className="mt-10">
            <div className="ee-sigline" aria-hidden="true" />
            <p className="mt-2.5 text-sm italic text-slate-500">
              Providers move money. INRSettle proves what happened.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/contact?intent=access"
              className={cn(buttonVariants({ variant: "primary", size: "lg" }), "lp-cta-primary")}
            >
              Start a pilot
            </Link>
            <Link href="/contact?intent=sales" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Talk to us
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
