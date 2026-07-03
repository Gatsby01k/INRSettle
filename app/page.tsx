import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, CheckCircle2, FileCheck2, Scale, ShieldCheck } from "lucide-react";
import { NO_FUNDS_DISCLAIMER, THESIS } from "@/lib/copy";
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
      <Link href="/contact?intent=access" className={cn(buttonVariants({ variant: "primary", size: "default" }))}>
        Start a pilot
      </Link>
      <Link
        href="/sample-report"
        className={cn(buttonVariants({ variant: "outline", size: "default" }), "inline-flex items-center gap-1.5")}
      >
        View a sample report
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

/** The hero artifact: a faithful miniature of the product's actual output. */
function ReportArtifact() {
  return (
    <div className="relative">
      <div className="rounded-2xl border border-[var(--ops-line)] bg-white p-5 shadow-ops-md">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Settlement report · SR-2026-0612
            </p>
            <p className="mt-0.5 text-base font-semibold text-slate-950">SET-8F42K1</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--status-ok-line)] bg-[var(--status-ok-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--status-ok)]">
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
            <div key={row.k} className="flex items-start gap-2.5">
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
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--ops-line)] bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Primary">
          <Link href="/" className="flex items-center gap-2.5" aria-label="INRSettle home">
            <Image src="/assets/mark.png" alt="" width={32} height={32} className="rounded-lg" />
            <span className="text-[15px] font-semibold tracking-tight">INRSettle</span>
          </Link>
          <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-slate-950">How it works</a>
            <a href="#platform" className="transition-colors hover:text-slate-950">Platform</a>
            <Link href="/security" className="transition-colors hover:text-slate-950">Security</Link>
            <Link href="/docs" className="transition-colors hover:text-slate-950">Docs</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
              Sign in
            </Link>
            <Link href="/contact?intent=access" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
              Request access
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(0,199,157,0.07),transparent)]"
            aria-hidden="true"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-20">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ops-line)] bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                Private beta — with selected payout and treasury teams
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                {THESIS}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                INRSettle is the control layer around INR payout rails. Every settlement carries provider
                proof, an independently matched bank record, a recorded approval and an append-only audit
                trail — before anyone calls it final.
              </p>
              <CtaPair className="mt-7" />
              <p className="mt-5 text-sm text-slate-400">{NO_FUNDS_DISCLAIMER}</p>
            </div>
            <ReportArtifact />
          </div>
        </section>

        {/* ── The problem ───────────────────────────────────────────────── */}
        <section className="border-y border-[var(--ops-line)] bg-slate-50/60">
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
        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">One loop, seven checkpoints.</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Every settlement moves through the same controlled sequence — the same loop you&rsquo;ll see live
            on the console&rsquo;s home screen. Pilots run alongside your existing payout flow: settlements and
            provider events enter through the console or the partner API, and your bank/PSP records are matched
            as they arrive. No rail migration, and no code required to start.
          </p>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-[var(--ops-line)] bg-[var(--ops-line)] sm:grid-cols-2 lg:grid-cols-7">
            {LOOP.map((item, index) => (
              <li key={item.step} className="bg-white p-4">
                <span className="text-xs font-semibold tabular-nums text-[var(--status-ok)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-950">{item.step}</p>
                <p className="mt-1 text-xs leading-snug text-slate-500">{item.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Platform surfaces ────────────────────────────────────────── */}
        <section id="platform" className="border-t border-[var(--ops-line)] bg-slate-50/60">
          <div className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Three surfaces. One standard of evidence.
            </h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {SURFACES.map((surface) => {
                const Icon = surface.icon;
                return (
                  <div key={surface.title} className="rounded-2xl border border-[var(--ops-line)] bg-white p-6">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--status-ok-bg)] text-[var(--status-ok)] ring-1 ring-inset ring-[var(--status-ok-line)]">
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
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Built for teams that have to prove it settled.
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            INRSettle sits around your existing payout rails. It does not replace your providers — it
            verifies them.
          </p>
          <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {AUDIENCES.map((audience) => (
              <div key={audience.who} className="border-l-2 border-[var(--status-ok-line)] pl-4">
                <dt className="text-[15px] font-semibold text-slate-950">{audience.who}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-600">{audience.need}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Controls strip ───────────────────────────────────────────── */}
        <section className="border-y border-[var(--ops-line)] bg-slate-50/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-8 sm:px-6">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              <ShieldCheck className="h-4 w-4 text-[var(--status-ok)]" aria-hidden="true" />
              Enforced, not optional
            </span>
            {CONTROLS.map((control) => (
              <span key={control} className="text-sm font-medium text-slate-700">
                {control}
              </span>
            ))}
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Prove your settlements are actually final.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Run a pilot on the payouts you already process. Your providers keep moving the money —
            INRSettle proves what happened.
          </p>
          <CtaPair className="mt-7 justify-center" />
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--ops-line)] bg-slate-50/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/assets/mark.png" alt="" width={28} height={28} className="rounded-lg" />
              <span className="text-sm font-semibold tracking-tight">INRSettle</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
              Settlement proof and finality review for teams that move money through providers.
            </p>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-slate-400">{NO_FUNDS_DISCLAIMER}</p>
            <p className="mt-4 text-xs text-slate-400">
              © 2026 INRSettle · Private beta ·{" "}
              <a href="mailto:info@inrsettle.com" className="hover:text-slate-600">
                info@inrsettle.com
              </a>
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><a href="#how-it-works" className="hover:text-slate-950">How it works</a></li>
              <li><Link href="/sample-report" className="hover:text-slate-950">Sample report</Link></li>
              <li><Link href="/security" className="hover:text-slate-950">Security</Link></li>
              <li><Link href="/compliance" className="hover:text-slate-950">Compliance</Link></li>
              <li><Link href="/status" className="hover:text-slate-950">Status</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Company</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link href="/docs" className="hover:text-slate-950">Documentation</Link></li>
              <li><Link href="/contact?intent=sales" className="hover:text-slate-950">Contact</Link></li>
              <li><Link href="/legal/privacy" className="hover:text-slate-950">Privacy</Link></li>
              <li><Link href="/legal/terms" className="hover:text-slate-950">Terms</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
