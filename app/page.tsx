import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  Code2,
  Database,
  Fingerprint,
  KeyRound,
  Layers3,
  LockKeyhole,
  Network,
  RefreshCcw,
  Route,
  Scale,
  ScrollText,
  Webhook,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { SettlementProofScene } from "@/components/marketing/hero/SettlementProofScene";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "INRSettle — Settlement operations, from request to finality",
  description:
    "The settlement operations platform for provider-executed settlement: workflow, approvals, funding visibility, provider orchestration, proof, reconciliation, audit and finality review.",
  alternates: { canonical: "https://inrsettle.com/" },
  openGraph: {
    title: "INRSettle — Settlement operations, from request to finality",
    description:
      "One operating record for every provider-executed settlement, from request and approval through reconciliation and finality.",
    url: "https://inrsettle.com/",
    type: "website",
  },
};

const LIFECYCLE_STAGES = [
  {
    number: "01",
    name: "Request",
    detail: "Commercial terms, corridor, accounts and client reference enter one controlled record.",
  },
  {
    number: "02",
    name: "Quote",
    detail: "Rate, fee, amount and settlement window remain bound to the request.",
  },
  {
    number: "03",
    name: "Approval",
    detail: "Role policy, limits, MFA step-up and dual control determine whether work may proceed.",
  },
  {
    number: "04",
    name: "Funding",
    detail: "Required, requested and confirmed amounts stay visible before provider submission.",
  },
  {
    number: "05",
    name: "Execution",
    detail: "A selected provider receives an idempotent request and returns its own reference.",
  },
  {
    number: "06",
    name: "Evidence",
    detail: "Signed webhooks and status polling preserve provider proof without asserting finality.",
  },
  {
    number: "07",
    name: "Reconciliation",
    detail: "Independent bank or PSP records are matched against the settlement record.",
  },
  {
    number: "08",
    name: "Finality",
    detail: "The final review evaluates approval, proof, reconciliation and operational guardrails.",
  },
] as const;

const PROVIDER_CONTROLS = [
  { icon: Route, title: "Explicit routing", body: "Provider selection is recorded per settlement and never inferred from display copy." },
  { icon: KeyRound, title: "Credential isolation", body: "Connections retain opaque secret-manager references, not credential material." },
  { icon: RefreshCcw, title: "Durable operations", body: "Every external request has an idempotency key, attempt history and provider reference." },
  { icon: Webhook, title: "Verified callbacks", body: "Connector-specific signature verification happens before a webhook enters the inbox." },
] as const;

const FAQ = [
  {
    question: "Does INRSettle move customer money?",
    answer:
      "No. Execution and liquidity remain with integrated providers. INRSettle controls the workflow, records provider activity and evaluates settlement evidence.",
  },
  {
    question: "Can one customer use more than one settlement provider?",
    answer:
      "Yes. Connections, capabilities and operations are tenant-scoped. The connector contract is provider-agnostic and supports explicit provider selection today and routing policy expansion over time.",
  },
  {
    question: "Does provider success make a settlement final?",
    answer:
      "No. Provider completion is one input. Finality review also requires the applicable approval record, independent reconciliation and operational guardrails.",
  },
  {
    question: "How are uncertain provider outcomes handled?",
    answer:
      "An uncertain execution is placed into review and is not automatically resubmitted. Operators must confirm provider status or record a controlled no-effect resolution.",
  },
  {
    question: "Can a bank or partner review the evidence?",
    answer:
      "Authorized users can inspect the settlement timeline, proof, reconciliation records, provider operations and audit history from the same tenant-scoped workspace.",
  },
] as const;

function SectionIntro({
  label,
  title,
  body,
  align = "left",
}: {
  label: string;
  title: string;
  body: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="platform-kicker">{label}</p>
      <h2 className="platform-section-title">{title}</h2>
      <p className="platform-section-copy">{body}</p>
    </div>
  );
}

function ProductBoundary() {
  return (
    <div className="platform-boundary-strip">
      <p>INRSettle owns the operating record.</p>
      <span aria-hidden="true" />
      <p>Integrated providers supply liquidity and execute settlement.</p>
      <span aria-hidden="true" />
      <p>Independent evidence determines finality.</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-white text-slate-950 antialiased">
      <SiteHeader />
      <main>
        <SettlementProofScene />
        <ProductBoundary />

        <section id="lifecycle" className="platform-section scroll-mt-20">
          <div className="platform-container">
            <SectionIntro
              label="Settlement lifecycle"
              title="One operating record. Eight controlled stages."
              body="Each stage shows its owner, state, evidence and next action—without reconstructing the settlement across provider portals and spreadsheets."
            />
            <ol className="platform-lifecycle-grid">
              {LIFECYCLE_STAGES.map((stage) => (
                <li key={stage.name}>
                  <span>{stage.number}</span>
                  <h3>{stage.name}</h3>
                  <p>{stage.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="providers" className="platform-section platform-section--ink scroll-mt-20">
          <div className="platform-container">
            <div className="grid gap-14 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
              <SectionIntro
                label="Provider network"
                title="Providers stay behind one customer experience."
                body="Customers remain in INRSettle. Connections and operations follow one model; provider-specific details remain inside each adapter."
              />
              <div className="provider-topology" aria-label="Provider-agnostic platform topology">
                <div className="provider-topology__customer">
                  <span>Customer operations</span>
                  <strong>INRSettle workspace</strong>
                </div>
                <div className="provider-topology__core">
                  <span>Routing</span>
                  <span>Controls</span>
                  <span>Evidence</span>
                </div>
                <div className="provider-topology__providers">
                  <div><Network aria-hidden="true" /><span>Settlement provider A</span></div>
                  <div><Network aria-hidden="true" /><span>Settlement provider B</span></div>
                  <div><Network aria-hidden="true" /><span>Future provider adapter</span></div>
                </div>
              </div>
            </div>
            <div className="platform-control-grid">
              {PROVIDER_CONTROLS.map(({ icon: Icon, title, body }) => (
                <article key={title}>
                  <Icon aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="funding" className="platform-section scroll-mt-20">
          <div className="platform-container grid gap-14 lg:grid-cols-2 lg:items-center">
            <div className="funding-ledger">
              <div className="funding-ledger__head">
                <div>
                  <p>Funding position</p>
                  <span>Required before provider execution</span>
                </div>
                <strong>Confirmed</strong>
              </div>
              <div className="funding-ledger__amount">
                <span>Coverage</span>
                <strong>100%</strong>
              </div>
              <div className="funding-ledger__track"><span /></div>
              <dl>
                <div><dt>Required</dt><dd>Recorded from settlement terms</dd></div>
                <div><dt>Confirmed</dt><dd>Approved by a separate operator</dd></div>
                <div><dt>Execution gate</dt><dd>Open only after funding control passes</dd></div>
              </dl>
            </div>
            <SectionIntro
              label="Funding visibility"
              title="Funding is a control state, not a chat update."
              body="Required and confirmed amounts stay with the settlement. Dual control records who cleared execution and when."
            />
          </div>
        </section>

        <section id="execution" className="platform-section platform-section--soft scroll-mt-20">
          <div className="platform-container">
            <SectionIntro
              label="Execution orchestration"
              title="External execution with an internal control record."
              body="A durable operation is recorded before provider submission. Outcomes, retries and uncertain states remain explicit."
              align="center"
            />
            <div className="operation-sequence">
              {[
                ["01", "Validate", "Approval, limits and funding"],
                ["02", "Record", "Operation and idempotency key"],
                ["03", "Submit", "Provider-specific adapter"],
                ["04", "Observe", "Webhook and status polling"],
                ["05", "Resolve", "Success, failure or review"],
              ].map(([number, title, body]) => (
                <div key={number}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <ChevronRight aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="evidence" className="platform-section scroll-mt-20">
          <div className="platform-container grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <SectionIntro
              label="Evidence engine"
              title="Provider proof is preserved, not promoted into finality."
              body="Provider references, status, amount, receipt channel and time remain append-only and traceable to the settlement."
            />
            <div className="evidence-record">
              <div className="evidence-record__head">
                <span>Provider proof</span>
                <strong>Received</strong>
              </div>
              <div className="evidence-record__lines">
                <div><span>Provider reference</span><b>Recorded</b></div>
                <div><span>Receipt channel</span><b>Verified webhook</b></div>
                <div><span>Payload integrity</span><b>Hash retained</b></div>
                <div><span>Finality effect</span><b>Evidence input only</b></div>
              </div>
            </div>
          </div>
        </section>

        <section id="reconciliation" className="platform-section platform-section--ink scroll-mt-20">
          <div className="platform-container">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div className="recon-comparison">
                <div>
                  <p>Settlement record</p>
                  <strong>Expected amount and value date</strong>
                  <span>Provider claim remains separate</span>
                </div>
                <Scale aria-hidden="true" />
                <div>
                  <p>Independent record</p>
                  <strong>Bank or PSP statement</strong>
                  <span>Source and external reference retained</span>
                </div>
                <footer><Check aria-hidden="true" /> Match criteria satisfied</footer>
              </div>
              <SectionIntro
                label="Reconciliation"
                title="Independent matching before completion."
                body="Bank and PSP records are evaluated independently. Mismatches become owned exceptions linked to the settlement."
              />
            </div>
          </div>
        </section>

        <section id="audit" className="platform-section scroll-mt-20">
          <div className="platform-container grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <SectionIntro
              label="Audit trail"
              title="Every privileged action leaves a durable record."
              body="Approvals, funding, provider operations, reconciliation and finality retain actor, time and relevant state."
            />
            <div className="audit-ledger">
              {[
                ["Approval recorded", "User · dual control"],
                ["Funding confirmed", "User · step-up verified"],
                ["Provider request accepted", "API · idempotent operation"],
                ["Proof received", "System · signed webhook"],
                ["Reconciliation matched", "User · independent source"],
              ].map(([event, actor], index) => (
                <div key={event}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p><strong>{event}</strong><small>{actor}</small></p>
                  <Check aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="finality" className="platform-section platform-section--soft scroll-mt-20">
          <div className="platform-container">
            <SectionIntro
              label="Finality review"
              title="Completion is a decision supported by evidence."
              body="Approval, provider proof, independent reconciliation and guardrails produce one reviewable decision."
              align="center"
            />
            <div className="finality-matrix">
              {[
                ["Recorded approval", "Verified"],
                ["Funding control", "Verified"],
                ["Provider proof", "Received"],
                ["Independent reconciliation", "Matched"],
                ["Operational guardrails", "Within policy"],
              ].map(([label, value]) => (
                <div key={label}><span>{label}</span><strong><Check aria-hidden="true" />{value}</strong></div>
              ))}
              <footer>
                <span>Finality decision</span>
                <strong>Ready for authorized completion</strong>
              </footer>
            </div>
          </div>
        </section>

        <section id="api" className="platform-section platform-section--ink scroll-mt-20">
          <div className="platform-container grid gap-14 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <SectionIntro
              label="Multi-provider API"
              title="One lifecycle model across provider adapters."
              body="Settlement, provider operation, funding and finality states remain stable across provider adapters."
            />
            <div className="api-window">
              <div className="api-window__bar">
                <span>GET</span>
                <code>/api/settlements/:id/finality</code>
              </div>
              <pre><code>{`{
  "settlement": "SET-…",
  "provider": {
    "connection": "configured",
    "operation": "succeeded",
    "reference": "recorded"
  },
  "evidence": {
    "providerProof": "verified",
    "reconciliation": "matched",
    "approval": "recorded"
  },
  "decision": "ready_to_finalize"
}`}</code></pre>
            </div>
          </div>
        </section>

        <section id="security" className="platform-section scroll-mt-20">
          <div className="platform-container">
            <SectionIntro
              label="Enterprise security"
              title="Controls follow the settlement, not the screen."
              body="Tenant scope is enforced at server boundaries. Sensitive decisions require role policy, session assurance and an auditable actor."
            />
            <div className="security-grid">
              {[
                [Fingerprint, "Session assurance", "TOTP MFA, recovery codes, lockout and short-lived step-up for sensitive operations."],
                [LockKeyhole, "Role enforcement", "Six tenant roles with server-side mutation gates and sensitive financial-data masking."],
                [Layers3, "Tenant isolation", "Organization scope is applied to settlements, operations, reconciliation and audit queries."],
                [Database, "Auditability", "Append-only audit records capture privileged actions and configuration changes."],
                [Webhook, "Webhook trust", "Provider-specific signatures are verified before a delivery can affect settlement state."],
                [KeyRound, "Secret boundary", "Credential values stay outside application records; only opaque manager references are retained."],
              ].map(([Icon, title, body]) => (
                <article key={String(title)}>
                  <Icon aria-hidden="true" />
                  <h3>{String(title)}</h3>
                  <p>{String(body)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="compliance" className="platform-section platform-section--soft scroll-mt-20">
          <div className="platform-container grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="compliance-register">
              {[
                ["Separation of duties", "Creator and approver are evaluated separately"],
                ["Evidence provenance", "Provider and independent records retain their source"],
                ["Decision traceability", "Finality inputs and blockers remain inspectable"],
                ["Controlled exceptions", "Uncertain outcomes require explicit intervention"],
              ].map(([title, body]) => (
                <div key={title}><ClipboardCheck aria-hidden="true" /><p><strong>{title}</strong><span>{body}</span></p></div>
              ))}
            </div>
            <SectionIntro
              label="Compliance operations"
              title="Operational evidence for review and oversight."
              body="INRSettle supports control execution and evidence collection; licensing, provider diligence and regulatory obligations remain with the responsible parties."
            />
          </div>
        </section>

        <section id="customer-stories" className="platform-section scroll-mt-20">
          <div className="platform-container">
            <SectionIntro
              label="Operating models"
              title="The same record answers different teams."
              body="Each team sees the decisions it owns without losing the shared settlement context."
              align="center"
            />
            <div className="role-stories">
              {[
                ["Settlement operations", "What happens next?", "A prioritized queue, current lifecycle stage, blockers and the next permitted action."],
                ["Treasury", "Is the settlement funded?", "Required amount, confirmed position, funding approver and provider execution gate."],
                ["Compliance", "Can the decision be defended?", "Approval provenance, provider proof, independent match and finality rationale."],
                ["Partnerships", "Can another provider integrate?", "Capabilities, connection posture, operations, webhooks and performance in one provider layer."],
              ].map(([role, question, answer]) => (
                <article key={role}>
                  <span>{role}</span>
                  <h3>{question}</h3>
                  <p>{answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="developers" className="platform-section platform-section--ink scroll-mt-20">
          <div className="platform-container grid gap-12 lg:grid-cols-2">
            <article className="developer-path">
              <Code2 aria-hidden="true" />
              <p className="platform-kicker">API</p>
              <h2>Integrate against stable settlement concepts.</h2>
              <p>
                Create and inspect settlement records, retrieve finality decisions,
                manage provider connections and receive tenant-scoped responses.
              </p>
              <Link href="/developers">Explore the API model <ArrowRight aria-hidden="true" /></Link>
            </article>
            <article className="developer-path">
              <ScrollText aria-hidden="true" />
              <p className="platform-kicker">Documentation</p>
              <h2>Understand controls before writing code.</h2>
              <p>
                Start with the lifecycle, approval model, provider boundary,
                webhook trust rules and reconciliation requirements.
              </p>
              <Link href="/docs">Read the documentation <ArrowRight aria-hidden="true" /></Link>
            </article>
          </div>
        </section>

        <section id="faq" className="platform-section scroll-mt-20">
          <div className="platform-container grid gap-12 lg:grid-cols-[0.65fr_1.35fr]">
            <SectionIntro
              label="FAQ"
              title="Clear boundaries from the first conversation."
              body="Operating responsibility stays explicit across customers, INRSettle and integrated providers."
            />
            <div className="platform-faq">
              {FAQ.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}<span aria-hidden="true">+</span></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="enterprise-cta">
          <div className="platform-container">
            <div>
              <p className="platform-kicker">Enterprise deployment</p>
              <h2>Bring your settlement workflow and provider model.</h2>
              <p>
                We will map the controls, evidence sources and integration boundary
                required to operate the flow inside INRSettle.
              </p>
            </div>
            <div>
              <Link
                href="/contact?intent=sales"
                className={cn(buttonVariants({ variant: "primary", size: "lg" }), "group")}
              >
                Start the technical discussion
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link href="/security" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                Review security controls
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
