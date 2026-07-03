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
  /* The brand sweep — faithful to the master render: a single point of
     light near the dotted world map, from which gold and teal ribbons
     travel TOGETHER as one bundle, curving down and to the right across
     the whole frame. */
  return (
    <svg
      className="hx-rails"
      viewBox="0 0 1600 760"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hxGold" x1="300" y1="280" x2="1650" y2="820" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe9bd" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="#f2ad23" stopOpacity="0.6" />
          <stop offset="1" stopColor="#f2ad23" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="hxTeal" x1="300" y1="300" x2="1650" y2="840" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d8fff4" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="#00c79d" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0bb4c4" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="hxBurst" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#ffe9bd" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffe9bd" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* dotted world-map suggestion, upper-left — halftone clusters */}
      <g fill="rgba(7,17,31,0.12)">
        {[
          [70,120],[95,132],[120,118],[145,140],[110,158],[85,172],[135,168],[160,150],[185,166],[60,190],
          [90,205],[120,198],[150,212],[178,196],[205,182],[230,168],[110,235],[140,246],[168,232],[196,244],
          [230,258],[258,240],[286,228],[250,205],[278,190],[305,205],[330,190],[300,240],[325,255],[352,242],
          [378,225],[352,208],[380,258],[405,244],[430,230],[405,205],[300,290],[330,300],[358,286],[385,296],
          [412,282],[440,268],[440,300],[465,286],[490,272],[130,290],[158,300],[186,290],[95,262],[65,240],
        ].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="4" height="4" rx="1" />
        ))}
      </g>

      {/* the light burst — origin of the sweep */}
      <circle className="hx-burst" cx="330" cy="330" r="120" fill="url(#hxBurst)" />
      <circle cx="330" cy="330" r="4" fill="#fff" />

      {/* THE SWEEP — gold and teal travelling together, one bundle */}
      <path className="hx-rail hx-rail--gold" d="M330,330 C 620,300 940,430 1180,560 S 1560,780 1700,860"
        stroke="url(#hxGold)" strokeWidth="2.4" pathLength={1} />
      <path className="hx-rail hx-rail--gold" d="M332,318 C 640,280 960,400 1210,525 S 1580,730 1710,810"
        stroke="url(#hxGold)" strokeWidth="1.2" opacity="0.7" pathLength={1} />
      <path className="hx-rail hx-rail--teal" d="M328,344 C 600,330 920,470 1150,600 S 1540,830 1690,910"
        stroke="url(#hxTeal)" strokeWidth="2.2" pathLength={1} />
      <path className="hx-rail hx-rail--teal hx-rail--teal2" d="M326,358 C 580,360 900,505 1120,640 S 1520,880 1670,960"
        stroke="url(#hxTeal)" strokeWidth="1.1" opacity="0.7" pathLength={1} />
      {/* faint upward arcs out of the burst, like the render's fan */}
      <path d="M330,330 C 480,220 700,170 920,180" stroke="rgba(242,173,35,0.16)" strokeWidth="1" />
      <path d="M330,330 C 520,250 780,215 1020,240" stroke="rgba(11,180,196,0.14)" strokeWidth="1" />
      <path d="M330,330 C 440,180 620,120 820,110" stroke="rgba(7,17,31,0.05)" strokeWidth="1" />

      {/* flow pulses along the two main ribbons */}
      <path className="hx-flow hx-flow--gold" d="M330,330 C 620,300 940,430 1180,560 S 1560,780 1700,860"
        stroke="#ffd576" strokeWidth="2.8" pathLength={1} />
      <path className="hx-flow hx-flow--teal" d="M328,344 C 600,330 920,470 1150,600 S 1540,830 1690,910"
        stroke="#7df0d4" strokeWidth="2.4" pathLength={1} />
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
      <div className="hx-dots-tr" aria-hidden="true" />
      <div className="hx-dots-bl" aria-hidden="true" />

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
