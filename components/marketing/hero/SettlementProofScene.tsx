import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  FileCheck2,
  Landmark,
  Network,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LIFECYCLE = [
  { label: "Request", detail: "Terms recorded", icon: FileCheck2 },
  { label: "Approval", detail: "Dual control", icon: ShieldCheck },
  { label: "Funding", detail: "Position confirmed", icon: CircleDollarSign },
  { label: "Provider", detail: "Accepted", icon: Network },
  { label: "Evidence", detail: "Proof received", icon: Landmark },
  { label: "Finality", detail: "Review complete", icon: Scale },
] as const;

function LifecycleConsole() {
  return (
    <div className="platform-console" aria-label="Settlement lifecycle control workspace">
      <div className="platform-console__bar">
        <div>
          <p className="platform-console__eyebrow">Settlement workspace</p>
          <p className="platform-console__reference">Settlement control record</p>
        </div>
        <span className="platform-console__state">
          <span aria-hidden="true" />
          In progress
        </span>
      </div>

      <ol className="platform-console__rail">
        {LIFECYCLE.map((stage, index) => {
          const Icon = stage.icon;
          const complete = index < 3;
          const current = index === 3;
          return (
            <li
              key={stage.label}
              className={cn(
                "platform-console__stage",
                complete && "is-complete",
                current && "is-current",
              )}
            >
              <span className="platform-console__node">
                {complete ? <Check aria-hidden="true" /> : <Icon aria-hidden="true" />}
              </span>
              <span>
                <span className="platform-console__label">{stage.label}</span>
                <span className="platform-console__detail">{stage.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="platform-console__body">
        <div className="platform-console__primary">
          <div className="platform-console__section-head">
            <div>
              <p>Provider orchestration</p>
              <span>External execution boundary</span>
            </div>
            <span className="platform-console__accepted">Accepted</span>
          </div>
          <dl className="platform-console__facts">
            <div>
              <dt>Routing</dt>
              <dd>Explicit provider selection</dd>
            </div>
            <div>
              <dt>Funding control</dt>
              <dd>Confirmed before submission</dd>
            </div>
            <div>
              <dt>Request safety</dt>
              <dd>Idempotency key recorded</dd>
            </div>
            <div>
              <dt>Next control</dt>
              <dd>Await provider proof</dd>
            </div>
          </dl>
        </div>

        <aside className="platform-console__attention">
          <p className="platform-console__eyebrow">Operator context</p>
          <h3>Nothing is hidden behind a status.</h3>
          <ul>
            <li><Check aria-hidden="true" /> Funding confirmed</li>
            <li><Check aria-hidden="true" /> Provider request accepted</li>
            <li><span aria-hidden="true" /> Proof collection pending</li>
          </ul>
        </aside>
      </div>

      <div className="platform-console__foot">
        <span>INRSettle records the workflow and evidence.</span>
        <span>The integrated provider performs execution.</span>
      </div>
    </div>
  );
}

export function SettlementProofScene() {
  return (
    <section className="platform-hero" aria-labelledby="platform-hero-title">
      <div className="platform-hero__grid" aria-hidden="true" />
      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-4rem)] max-w-[1280px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16 lg:py-20">
        <div className="max-w-[590px]">
          <p className="platform-kicker">Settlement Operations Platform</p>
          <h1 id="platform-hero-title" className="platform-hero__title">
            Settlement operations,
            <span>from request to finality.</span>
          </h1>
          <p className="platform-hero__copy">
            INRSettle gives operations, treasury and compliance teams one control
            plane for provider-executed settlement: approvals, funding visibility,
            orchestration, proof, reconciliation and finality review.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/contact?intent=sales"
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "platform-primary-action group",
              )}
            >
              Discuss your settlement flow
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/docs"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-white/80")}
            >
              Read the platform docs
            </Link>
          </div>
          <div className="platform-hero__boundary">
            <ShieldCheck aria-hidden="true" />
            <p>
              Providers execute and supply liquidity. INRSettle governs the
              operating workflow and records the evidence.
            </p>
          </div>
        </div>

        <LifecycleConsole />
      </div>
    </section>
  );
}
