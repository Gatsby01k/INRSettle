import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, FileCheck2, ShieldCheck } from "lucide-react";
import { resolveContactIntent, type ContactIntent } from "@/components/marketing/static-marketing-page";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { cn } from "@/lib/utils";
import { ContactMailForm } from "@/components/marketing/contact-mail-form";

/**
 * Request access / Talk to us — rebuilt native, a continuation of the
 * homepage: same chamber lighting, same glass, same certificate surfaces.
 * The form is framed as what it is — the beginning of a pilot review, not
 * a contact form. No CRM/form backend exists in this repository, so the form
 * opens a transparent email draft instead of pretending a Vercel POST was
 * delivered through Netlify.
 */

const META: Record<ContactIntent, { title: string; description: string }> = {
  access: {
    title: "Request access — INRSettle",
    description: "Access to the INRSettle console for settlement operations teams.",
  },
  sales: {
    title: "Talk to us — INRSettle",
    description: "Discuss corridors, integration, settlement volume, and partnership requirements.",
  },
  default: {
    title: "Contact — INRSettle",
    description: "Request access to the console, or start an enterprise and partnership conversation.",
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>;
}): Promise<Metadata> {
  const { intent } = await searchParams;
  const meta = META[resolveContactIntent(intent)];
  return { ...meta, alternates: { canonical: "https://inrsettle.com/contact" } };
}

function DirectContact() {
  return (
    <div className="mt-8 border-t border-[var(--ops-line-soft)] pt-5 text-sm">
      <p className="font-medium text-slate-700">Prefer direct communication?</p>
      <p className="mt-1.5 text-slate-500">
        Telegram:{" "}
        <a
          href="https://t.me/INRSettle_team"
          target="_blank"
          rel="noopener"
          className="font-medium text-[var(--status-ok)] hover:underline"
        >
          @INRSettle_team
        </a>
      </p>
      <p className="text-slate-500">
        Email:{" "}
        <a href="mailto:info@inrsettle.com" className="font-medium text-[var(--status-ok)] hover:underline">
          info@inrsettle.com
        </a>
      </p>
    </div>
  );
}

function IntentTabs({ active }: { active: "access" | "sales" }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--ops-line)] bg-white/70 p-1 backdrop-blur">
      {(
        [
          ["access", "Request access"],
          ["sales", "Enterprise & partnerships"],
        ] as const
      ).map(([value, label]) => (
        <Link
          key={value}
          href={`/contact?intent=${value}`}
          aria-current={active === value ? "page" : undefined}
          className={cn(
            "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
            active === value ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:text-slate-950",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

const ACCESS_POINTS = [
  "Settlement operations console — approval gates, lifecycle, finality queue",
  "Provider proof and independent bank/PSP reconciliation",
  "Append-only audit trail and per-settlement evidence reports",
  "Runs above existing provider and banking relationships",
] as const;

const SALES_POINTS = [
  "Corridor and integration scoping",
  "Volume-based commercial terms",
  "Partnership and onboarding support",
  "Institutional KYB and risk review",
] as const;

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>;
}) {
  const { intent } = await searchParams;
  const resolved = resolveContactIntent(intent);
  const mode: "access" | "sales" = resolved === "sales" ? "sales" : "access";
  const isAccess = mode === "access";

  return (
    <div className="min-h-screen bg-white text-slate-950 antialiased">
      <SiteHeader />

      <main className="hx-scene relative">
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-14 sm:px-6 lg:pt-20">
          <div className="lp-reveal lp-d1">
            <IntentTabs active={mode} />
          </div>

          <div className="mt-10 grid items-start gap-12 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
            {/* ── The case for talking to us ── */}
            <div>
              <h1 className="lp-reveal lp-d2 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                {isAccess ? (
                  <>
                    <span className="lp-ink">Bring settlement operations</span>{" "}
                    <span className="lp-ink">under control.</span>
                  </>
                ) : (
                  <>
                    <span className="lp-ink">Let&rsquo;s scope</span> <span className="lp-ink">your corridor.</span>
                  </>
                )}
              </h1>
              <p className="lp-reveal lp-d3 mt-5 max-w-lg text-lg leading-relaxed text-slate-600">
                {isAccess
                  ? "Review the operating workflow with your settlement, finance, technology and compliance stakeholders."
                  : "Define provider responsibilities, integration scope, settlement volume, controls and commercial terms."}
              </p>

              <ul className="lp-reveal lp-d4 mt-8 space-y-3">
                {(isAccess ? ACCESS_POINTS : SALES_POINTS).map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[15px] text-slate-700">
                    <span className="mt-1 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--status-ok-bg)] text-[var(--status-ok)] ring-1 ring-inset ring-[var(--status-ok-line)]">
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <div className="lp-reveal lp-d5 mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[var(--status-ok)]" aria-hidden="true" />
                  INRSettle does not move funds
                </span>
                <Link
                  href="/docs/reconciliation"
                  className="lp-arrow-link inline-flex items-center gap-1 font-medium text-[var(--status-ok)] hover:underline"
                >
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  Review the evidence model
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>

              <DirectContact />
            </div>

            {/* ── The form, as an instrument ── */}
            <div className="lp-cert relative p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                {isAccess ? "Workspace review" : "Partnership review"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                A few details about your {isAccess ? "settlement workflow" : "corridor"}. We reply from a named
                address, not a queue.
              </p>
              <div className="mt-5"><ContactMailForm mode={mode} /></div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
