import Link from "next/link";
import { ArrowRight, Check, FileCheck2, Landmark, Scale, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * THE PROOF INSTRUMENT — cinematic first viewport.
 *
 * One scene: a gold rail (INR value) enters from the left edge of the
 * viewport, flows INTO a floating layered-glass instrument, is verified
 * through four timed stations inside it, and leaves the right edge as two
 * teal rails — value transformed into proven finality. The rails are one
 * SVG spanning the whole hero, so they genuinely connect to the object.
 *
 * Motion: rails draw once, then flow slowly forever; the instrument rises,
 * its stations light in sequence, the seal stamps last; glass layers
 * parallax gently on scroll. Everything degrades to the finished still
 * under prefers-reduced-motion. No particles, no neon, no libraries.
 */

const STATIONS = [
  { icon: Landmark, label: "Provider proof", detail: "captured" },
  { icon: Scale, label: "Independent reconciliation", detail: "matched" },
  { icon: ShieldCheck, label: "Recorded approval", detail: "dual-control" },
  { icon: FileCheck2, label: "Finality review", detail: "evidence agrees" },
] as const;

function RailField() {
  return (
    <svg
      className="hx-rails"
      viewBox="0 0 1600 760"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hxGold" x1="0" y1="0" x2="1030" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f2ad23" stopOpacity="0" />
          <stop offset="0.25" stopColor="#f2ad23" stopOpacity="0.75" />
          <stop offset="1" stopColor="#e8a012" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="hxTeal" x1="1180" y1="0" x2="1600" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00c79d" stopOpacity="0.9" />
          <stop offset="0.75" stopColor="#0bb4c4" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0bb4c4" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* world-map suggestion: latitude arcs + corridor dots */}
      <path d="M-40,140 Q 800,90 1640,140" stroke="rgba(7,17,31,0.05)" strokeWidth="1" />
      <path d="M-40,380 Q 800,315 1640,380" stroke="rgba(7,17,31,0.045)" strokeWidth="1" />
      <path d="M-40,620 Q 800,545 1640,620" stroke="rgba(7,17,31,0.035)" strokeWidth="1" />
      <g fill="rgba(7,17,31,0.10)">
        <circle cx="180" cy="205" r="1.6" /><circle cx="235" cy="182" r="1.6" /><circle cx="285" cy="214" r="1.6" />
        <circle cx="330" cy="188" r="1.6" /><circle cx="1370" cy="182" r="1.6" /><circle cx="1425" cy="208" r="1.6" />
        <circle cx="1480" cy="186" r="1.6" /><circle cx="255" cy="560" r="1.6" /><circle cx="310" cy="586" r="1.6" />
        <circle cx="1400" cy="568" r="1.6" /><circle cx="1455" cy="592" r="1.6" /><circle cx="1330" cy="545" r="1.6" />
      </g>

      {/* THE GOLD RAIL — value entering the instrument */}
      <path
        className="hx-rail hx-rail--gold"
        d="M-40,480 C 260,470 480,380 700,392 S 960,415 1030,405"
        stroke="url(#hxGold)"
        strokeWidth="2"
        pathLength={1}
      />
      <path
        className="hx-flow hx-flow--gold"
        d="M-40,480 C 260,470 480,380 700,392 S 960,415 1030,405"
        stroke="#ffd576"
        strokeWidth="2.5"
        pathLength={1}
      />

      {/* THE TEAL RAILS — proven finality leaving it */}
      <path
        className="hx-rail hx-rail--teal"
        d="M1180,380 C 1300,368 1430,320 1640,330"
        stroke="url(#hxTeal)"
        strokeWidth="1.8"
        pathLength={1}
      />
      <path
        className="hx-rail hx-rail--teal hx-rail--teal2"
        d="M1180,430 C 1310,448 1450,492 1640,486"
        stroke="url(#hxTeal)"
        strokeWidth="1.4"
        pathLength={1}
      />
      <path
        className="hx-flow hx-flow--teal"
        d="M1180,380 C 1300,368 1430,320 1640,330"
        stroke="#7df0d4"
        strokeWidth="2.2"
        pathLength={1}
      />
      <path
        className="hx-flow hx-flow--teal hx-flow--teal2"
        d="M1180,430 C 1310,448 1450,492 1640,486"
        stroke="#7df0d4"
        strokeWidth="1.8"
        pathLength={1}
      />
    </svg>
  );
}

function EvidenceInstrument() {
  return (
    <div className="hx-stage" aria-label="Settlement proof instrument (illustrative)">
      {/* layered glass, back to front */}
      <div className="hx-layer hx-layer--back" aria-hidden="true" />
      <div className="hx-layer hx-layer--mid" aria-hidden="true">
        <span /><span /><span />
      </div>

      <div className="hx-face">
        {/* ports where the rails dock */}
        <span className="hx-port hx-port--in" aria-hidden="true" />
        <span className="hx-port hx-port--out1" aria-hidden="true" />
        <span className="hx-port hx-port--out2" aria-hidden="true" />

        <div className="hx-face-head">
          <p className="hx-micro">Settlement proof · SET-8F42K1</p>
          <p className="hx-amount">10,000.00 USDT → ₹8,31,500.00</p>
        </div>

        <ol className="hx-stations">
          {STATIONS.map((station, index) => {
            const Icon = station.icon;
            return (
              <li key={station.label} className="hx-station" style={{ animationDelay: `${1.15 + index * 0.45}s` }}>
                <span className="hx-station-ring">
                  <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-tight text-slate-900">{station.label}</span>
                  <span className="block text-[11px] text-slate-500">{station.detail}</span>
                </span>
                <Check className="hx-station-check h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
              </li>
            );
          })}
        </ol>

        <div className="hx-verdict">
          <span className="hx-wax" aria-hidden="true">
            <Check className="h-5 w-5" strokeWidth={2.75} />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-tight text-slate-950">Ready to finalize</span>
            <span className="block text-[11px] text-slate-500">demonstration data · no funds moved</span>
          </span>
        </div>
      </div>

      {/* luxury floor: contact shadow + glass reflection */}
      <div className="hx-floor" aria-hidden="true" />
    </div>
  );
}

export function SettlementProofScene() {
  return (
    <section className="hx-scene" aria-label="INRSettle — settlement proof">
      <RailField />

      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:py-10">
        <div className="max-w-xl">
          {/* Visual markup of THESIS — keep wording in sync with lib/copy.ts */}
          <h1 className="hx-headline lp-reveal lp-d1">
            <span className="lp-ink">Payment completed</span>
            <span className="hx-neq lp-neq"> ≠ </span>
            <span className="lp-ink">settlement finalized.</span>
          </h1>
          <p className="lp-reveal lp-d3 mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
            INRSettle verifies provider proof, reconciliation, audit trail and finality around payout
            workflows — without moving funds.
          </p>
          <div className="lp-reveal lp-d4 mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/sample-report"
              className={cn(buttonVariants({ variant: "primary", size: "lg" }), "lp-cta-primary lp-arrow-link inline-flex items-center gap-1.5")}
            >
              View sample report
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/contact?intent=access" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Request access
            </Link>
          </div>
          <p className="lp-reveal lp-d5 mt-7 flex items-center gap-2 text-sm text-slate-400">
            <span className="lp-gold-dot" aria-hidden="true" />
            Private beta — providers move money; INRSettle proves what happened.
          </p>
        </div>

        <EvidenceInstrument />
      </div>
    </section>
  );
}
