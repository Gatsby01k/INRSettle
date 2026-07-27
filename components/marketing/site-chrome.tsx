import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Menu } from "lucide-react";
import { NO_FUNDS_DISCLAIMER } from "@/lib/copy";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLATFORM_LINKS = [
  { href: "/#lifecycle", label: "Lifecycle" },
  { href: "/#providers", label: "Provider network" },
  { href: "/#reconciliation", label: "Reconciliation" },
  { href: "/#finality", label: "Finality" },
] as const;

export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-40">
      <nav
        className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-8"
        aria-label="Primary"
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label="INRSettle home">
          <Image src="/assets/mark.png" alt="" width={31} height={31} className="rounded-lg" />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">INRSettle</span>
        </Link>

        <div className="hidden items-center gap-7 text-[13px] font-medium text-slate-600 lg:flex">
          <Link href="/#lifecycle" className="transition-colors hover:text-slate-950">Platform</Link>
          <Link href="/#providers" className="transition-colors hover:text-slate-950">Providers</Link>
          <Link href="/#security" className="transition-colors hover:text-slate-950">Security</Link>
          <Link href="/developers" className="transition-colors hover:text-slate-950">API</Link>
          <Link href="/docs" className="transition-colors hover:text-slate-950">Documentation</Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
          >
            Sign in
          </Link>
          <Link
            href="/contact?intent=sales"
            className={cn(buttonVariants({ variant: "primary", size: "sm" }), "hidden sm:inline-flex")}
          >
            Talk to our team
          </Link>
          <details className="site-mobile-menu lg:hidden">
            <summary aria-label="Open navigation">
              <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
            </summary>
            <div>
              <p>Platform</p>
              {PLATFORM_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>{link.label}</Link>
              ))}
              <p>Resources</p>
              <Link href="/security">Security</Link>
              <Link href="/developers">API</Link>
              <Link href="/docs">Documentation</Link>
              <Link href="/contact?intent=sales">Contact</Link>
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="platform-container grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/assets/mark.png" alt="" width={29} height={29} className="rounded-lg" />
            <span className="text-sm font-semibold tracking-tight text-white">INRSettle</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            Settlement operations from request to finality, across integrated
            providers and independent evidence sources.
          </p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-slate-500">{NO_FUNDS_DISCLAIMER}</p>
        </div>

        <div>
          <p className="site-footer__label">Platform</p>
          <ul>
            {PLATFORM_LINKS.map((link) => (
              <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="site-footer__label">Resources</p>
          <ul>
            <li><Link href="/developers">API</Link></li>
            <li><Link href="/docs">Documentation</Link></li>
            <li><Link href="/security">Security</Link></li>
            <li><Link href="/compliance">Compliance</Link></li>
            <li><Link href="/status">System status</Link></li>
          </ul>
        </div>
        <div>
          <p className="site-footer__label">Company</p>
          <ul>
            <li><Link href="/contact?intent=sales">Contact</Link></li>
            <li><Link href="/legal/privacy">Privacy</Link></li>
            <li><Link href="/legal/terms">Terms</Link></li>
            <li><a href="mailto:info@inrsettle.com">info@inrsettle.com</a></li>
          </ul>
        </div>
      </div>
      <div className="platform-container flex flex-col gap-2 border-t border-white/10 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 INRSettle</span>
        <span>Settlement Operations Platform</span>
      </div>
    </footer>
  );
}

export function SiteCta() {
  return (
    <section className="enterprise-cta">
      <div className="platform-container">
        <div>
          <p className="platform-kicker">Settlement operations</p>
          <h2>Bring the workflow under control.</h2>
          <p>
            Map approvals, funding, provider execution, evidence and finality
            into one operating record.
          </p>
        </div>
        <div>
          <Link
            href="/contact?intent=sales"
            className={cn(buttonVariants({ variant: "primary", size: "lg" }), "group")}
          >
            Discuss your settlement flow
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link href="/docs" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Read documentation
          </Link>
        </div>
      </div>
    </section>
  );
}
