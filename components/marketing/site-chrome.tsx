import Link from "next/link";
import Image from "next/image";
import { NO_FUNDS_DISCLAIMER } from "@/lib/copy";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for EVERY public page — the landing, request access, security,
 * compliance, docs, legal, status, sample report. One header, one footer,
 * one design language. A visitor moving between public pages must never feel
 * they changed websites.
 */

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--ops-line)] bg-white/85 backdrop-blur-xl">
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
        aria-label="Primary"
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label="INRSettle home">
          <Image src="/assets/mark.png" alt="" width={32} height={32} className="rounded-lg" />
          <span className="text-[15px] font-semibold tracking-tight text-slate-950">INRSettle</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link href="/#how-it-works" className="transition-colors hover:text-slate-950">
            How it works
          </Link>
          <Link href="/#platform" className="transition-colors hover:text-slate-950">
            Platform
          </Link>
          <Link href="/security" className="transition-colors hover:text-slate-950">
            Security
          </Link>
          <Link href="/docs" className="transition-colors hover:text-slate-950">
            Docs
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
          >
            Sign in
          </Link>
          <Link href="/contact?intent=access" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
            Request access
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--ops-line)] bg-slate-50/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/assets/mark.png" alt="" width={28} height={28} className="rounded-lg" />
            <span className="text-sm font-semibold tracking-tight text-slate-950">INRSettle</span>
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
            <li><Link href="/#how-it-works" className="hover:text-slate-950">How it works</Link></li>
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
  );
}

/** Closing CTA rendered natively on legacy content pages (never on /contact). */
export function SiteCta() {
  return (
    <section className="border-t border-[var(--ops-line)]">
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="mx-auto max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl">
          Prove your settlements are actually final.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          Run a pilot on the payouts you already process — your providers keep moving the money.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Link href="/contact?intent=access" className={cn(buttonVariants({ variant: "primary", size: "default" }))}>
            Start a pilot
          </Link>
          <Link href="/sample-report" className={cn(buttonVariants({ variant: "outline", size: "default" }))}>
            View a sample report
          </Link>
        </div>
      </div>
    </section>
  );
}
