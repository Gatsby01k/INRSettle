import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SiteCta, SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";

type PublicSection = {
  title: string;
  body: string;
  points?: readonly string[];
};

type PublicPage = {
  eyebrow: string;
  title: string;
  description: string;
  boundary?: string;
  sections: readonly PublicSection[];
  link?: { label: string; href: string };
};

const PAGES: Record<string, PublicPage> = {
  "use-cases.html": {
    eyebrow: "Operating models",
    title: "One control plane for settlement operations.",
    description:
      "INRSettle gives finance, operations and compliance teams a shared record from request through finality. Existing banking, liquidity and execution relationships remain in place.",
    boundary: "INRSettle coordinates work and evidence. Integrated providers execute settlements and supply liquidity.",
    sections: [
      {
        title: "Enterprise settlement teams",
        body: "Control high-value requests across approval, funding, provider execution, evidence and close.",
        points: ["Maker-checker approval", "Funding gate visibility", "Exception ownership"],
      },
      {
        title: "Payment operations",
        body: "Replace provider portals, chat threads and spreadsheets with one lifecycle and one audit trail.",
        points: ["Provider reference mapping", "Signed event intake", "Independent reconciliation"],
      },
      {
        title: "Liquidity and settlement partners",
        body: "Operate as infrastructure behind the customer experience through a provider-agnostic connector boundary.",
        points: ["Capabilities and credentials", "Idempotent operations", "Health and webhook logs"],
      },
    ],
    link: { label: "Review the lifecycle", href: "/#lifecycle" },
  },
  "inr-settlement-india.html": {
    eyebrow: "India settlement operations",
    title: "Operational control for India settlement flows.",
    description:
      "Coordinate requests, approvals, funding confirmation, provider execution evidence and bank-side reconciliation without presenting INRSettle as the regulated money-movement rail.",
    boundary: "Corridor eligibility, client due diligence and execution remain subject to each provider and banking partner.",
    sections: [
      {
        title: "Before execution",
        body: "Capture the client request, locked terms, approval evidence, funding requirement and selected provider route.",
      },
      {
        title: "During execution",
        body: "Track the durable provider operation, acknowledgements, provider references and uncertain outcomes without creating duplicate instructions.",
      },
      {
        title: "After execution",
        body: "Collect proof, compare independent bank records, resolve exceptions and record the finality decision.",
      },
    ],
    link: { label: "Discuss an India flow", href: "/contact?intent=sales" },
  },
  "infrastructure.html": {
    eyebrow: "Architecture",
    title: "A control layer above settlement providers.",
    description:
      "The platform separates customer workflow from provider-specific execution. Connectors translate a stable operating model into each provider contract.",
    boundary: "Provider changes do not change the customer lifecycle or weaken approval and finality controls.",
    sections: [
      {
        title: "Settlement domain",
        body: "Canonical states, approvals, funding gates, proof, reconciliation and finality are owned by the platform.",
      },
      {
        title: "Provider layer",
        body: "Registry, capabilities, credential references, idempotency, signed webhooks, status checks and operation logs isolate provider behavior.",
      },
      {
        title: "Evidence layer",
        body: "Provider claims and independent reconciliation stay separate. Finality is computed from persisted evidence and approvals.",
      },
    ],
    link: { label: "View integration model", href: "/docs/integration" },
  },
  "api.html": {
    eyebrow: "Integration",
    title: "A stable API boundary for settlement operations.",
    description:
      "Integrations work against the INRSettle lifecycle while provider adapters handle authentication, payload mapping, provider references and status semantics.",
    boundary: "Production API access is provisioned per enterprise engagement. No public bearer credential is issued from this website.",
    sections: [
      {
        title: "Lifecycle resources",
        body: "Create and inspect settlement records, funding decisions, evidence, reconciliation outcomes and finality assessments.",
      },
      {
        title: "Provider operations",
        body: "Every side-effecting instruction receives a durable operation record and an idempotency key before network submission.",
      },
      {
        title: "Event delivery",
        body: "Signed provider events enter an append-only inbox before processing. Duplicate deliveries resolve to the same stored event.",
      },
    ],
    link: { label: "Read integration documentation", href: "/docs/integration" },
  },
  "compliance.html": {
    eyebrow: "Compliance operations",
    title: "Controls that follow the settlement.",
    description:
      "Client due diligence, provider review, approvals, evidence and exceptions remain attached to the same organization-scoped operating record.",
    boundary: "INRSettle supports compliance workflow and auditability; it does not replace legal, regulatory or provider due diligence.",
    sections: [
      {
        title: "Client due diligence",
        body: "Record ownership, operating purpose, corridor profile, review status and outstanding evidence before enabling provider execution.",
      },
      {
        title: "Dual control",
        body: "Sensitive decisions require an authorized role, separation from the creator and fresh MFA assurance.",
      },
      {
        title: "Review evidence",
        body: "Provider proof, bank-side records, approvals and operator interventions remain attributable in the audit trail.",
      },
    ],
    link: { label: "Review security controls", href: "/security" },
  },
  "security.html": {
    eyebrow: "Security",
    title: "Operational controls, enforced in the workflow.",
    description:
      "Security is applied at tenant, role, action and evidence boundaries rather than presented as a separate checklist.",
    boundary: "Provider secrets are referenced from a secret manager; the console never asks operators to store raw credentials in application records.",
    sections: [
      {
        title: "Access and assurance",
        body: "Organization-scoped sessions, role permissions, TOTP MFA, recovery codes, lockout and step-up checks protect privileged actions.",
      },
      {
        title: "Auditability",
        body: "State changes, approvals, provider interventions and security actions write attributable audit records.",
      },
      {
        title: "Integration safety",
        body: "Credential references, request idempotency, signed webhook verification and explicit uncertain-outcome handling reduce duplicate execution risk.",
      },
    ],
    link: { label: "Read the security documentation", href: "/docs/integration" },
  },
  "risk.html": {
    eyebrow: "Risk disclosure",
    title: "Settlement operations retain external dependencies.",
    description:
      "Provider, banking, liquidity, regulatory and technology conditions can delay or prevent settlement even when the control workflow operates as designed.",
    boundary: "INRSettle is not an exchange, custodian, liquidity provider, payout provider or investment service.",
    sections: [
      {
        title: "Execution and counterparty risk",
        body: "Availability, pricing, final execution and proof depend on integrated providers and their banking or liquidity relationships.",
      },
      {
        title: "Operational risk",
        body: "Incorrect instructions, delayed callbacks, reconciliation mismatches and manual intervention can affect completion time.",
      },
      {
        title: "Regulatory risk",
        body: "Rules differ by jurisdiction and can change. Each deployment requires qualified legal review and provider due diligence.",
      },
    ],
  },
  "status.html": {
    eyebrow: "Service communications",
    title: "Availability reporting without unverified claims.",
    description:
      "INRSettle does not publish synthetic green status indicators as evidence of service availability.",
    boundary: "Contracted environments receive incident communication, operational escalation and provider-specific exception visibility through agreed channels.",
    sections: [
      {
        title: "Platform incidents",
        body: "Application, database and security incidents are communicated with impact, containment and recovery details.",
      },
      {
        title: "Provider degradation",
        body: "Provider health is evaluated independently inside each tenant workspace from recorded checks, operations and webhook delivery.",
      },
      {
        title: "Customer escalation",
        body: "Settlement-level exceptions retain an owner, next action and complete chronology in the operational record.",
      },
    ],
    link: { label: "Contact operations", href: "/contact?intent=sales" },
  },
  "docs/index.html": {
    eyebrow: "Documentation",
    title: "Settlement operations documentation.",
    description:
      "Start with the lifecycle, then review the provider boundary, event processing and reconciliation evidence model.",
    sections: [
      {
        title: "Operating lifecycle",
        body: "Request → quote → approval → funding → provider operation → proof → reconciliation → finality.",
      },
      {
        title: "Control model",
        body: "Roles, separation of duties, tenant isolation and audit records define who can move each state forward.",
      },
      {
        title: "Integration model",
        body: "Provider connectors translate external contracts without exposing provider-specific behavior to customer workflows.",
      },
    ],
    link: { label: "Provider integration", href: "/docs/integration" },
  },
  "docs/api.html": {
    eyebrow: "API model",
    title: "Resources follow the operating lifecycle.",
    description:
      "The API returns persisted settlement, funding, provider-operation, evidence, reconciliation and finality state. It does not report a provider claim as finality.",
    boundary: "Schemas and credentials are issued during integration onboarding and versioned against the contracted environment.",
    sections: [
      {
        title: "Safe creation",
        body: "Mutation requests are tenant-scoped, authorized and idempotent. Retries must resolve to the original operation.",
      },
      {
        title: "Explicit states",
        body: "Pending, uncertain and review-required outcomes remain visible; they are never collapsed into generic success or failure.",
      },
      {
        title: "Evidence responses",
        body: "Provider proof and independent reconciliation are returned as separate records with provenance.",
      },
    ],
  },
  "docs/integration.html": {
    eyebrow: "Provider integration",
    title: "Connect providers behind a stable control plane.",
    description:
      "A connector declares capabilities, resolves a secret-manager reference, submits idempotently, normalizes status and verifies inbound events.",
    sections: [
      {
        title: "Before activation",
        body: "Complete provider due diligence, configure credential references, register capabilities and verify health and webhook signatures.",
      },
      {
        title: "During execution",
        body: "Persist the operation first, submit once, store the provider reference and poll only when event delivery is incomplete.",
      },
      {
        title: "On uncertainty",
        body: "Open manual intervention. Confirm provider state before any retry or alternate route is permitted.",
      },
    ],
    link: { label: "Webhook processing", href: "/docs/webhooks" },
  },
  "docs/webhooks.html": {
    eyebrow: "Webhook processing",
    title: "Verify, persist, deduplicate, then process.",
    description:
      "Inbound provider events are not trusted until the connector verifies the signature against the raw request body.",
    sections: [
      {
        title: "Verification",
        body: "Reject invalid signatures and record the verification outcome without applying a settlement transition.",
      },
      {
        title: "Deduplication",
        body: "Provider event IDs and payload hashes prevent a repeated delivery from applying a second state change.",
      },
      {
        title: "Recovery",
        body: "Failed processing remains visible in the webhook inbox and can be retried without losing the original evidence.",
      },
    ],
  },
  "docs/reconciliation.html": {
    eyebrow: "Reconciliation",
    title: "Provider proof is not independent evidence.",
    description:
      "Reconciliation compares the settlement record with an external bank or PSP record. A provider status alone cannot satisfy the finality gate.",
    sections: [
      {
        title: "Ingest",
        body: "Store the external source, immutable reference, amount, currency and value date with organization scope.",
      },
      {
        title: "Match",
        body: "Evaluate reference, currency, amount and date. Record the reasons and confidence behind the outcome.",
      },
      {
        title: "Resolve",
        body: "Assign exceptions, preserve operator decisions and recalculate finality only from persisted evidence.",
      },
    ],
    link: { label: "Request integration documentation", href: "/contact?intent=sales" },
  },
  "legal/privacy.html": {
    eyebrow: "Privacy",
    title: "Business and operational data handling.",
    description:
      "INRSettle processes business contact, account, onboarding and settlement-operation data to provide and secure the contracted service.",
    boundary: "Customer data terms, retention requirements and subprocessors are documented for each enterprise deployment.",
    sections: [
      {
        title: "Data processed",
        body: "Business contacts, organization details, access records, due-diligence information and operational settlement records supplied by authorized users.",
      },
      {
        title: "Purpose and access",
        body: "Data is used to operate, secure, support and audit the platform. Tenant and role controls limit access within the application.",
      },
      {
        title: "Requests and contact",
        body: "Privacy, access and deletion requests are reviewed against contractual, security, audit and legal retention obligations.",
      },
    ],
    link: { label: "Contact INRSettle", href: "/contact?intent=sales" },
  },
  "legal/terms.html": {
    eyebrow: "Terms",
    title: "Website and authorized product access.",
    description:
      "INRSettle is provided for business settlement operations. Production access is governed by the applicable enterprise agreement.",
    boundary: "INRSettle is not an exchange, PSP, payout provider, custodian or liquidity provider and does not itself move customer funds.",
    sections: [
      {
        title: "Business use",
        body: "Access is limited to authorized representatives of approved organizations and may require due diligence and security controls.",
      },
      {
        title: "Operational responsibility",
        body: "Customers remain responsible for accurate instructions, authorized users and their own legal, regulatory and provider obligations.",
      },
      {
        title: "Execution dependencies",
        body: "Settlement execution and liquidity depend on integrated providers and banking relationships under their applicable terms.",
      },
    ],
  },
  "legal/compliance.html": {
    eyebrow: "Legal and compliance",
    title: "Deployment-specific compliance controls.",
    description:
      "The platform supports client review, provider due diligence, approvals, limits, evidence and audit records across the settlement lifecycle.",
    boundary: "Workflow controls do not replace licensing analysis, regulated-provider obligations or qualified legal advice.",
    sections: [
      {
        title: "Client review",
        body: "Business identity, beneficial ownership, operating purpose, jurisdictions and corridor profile are assessed before activation.",
      },
      {
        title: "Provider review",
        body: "Commercial activation remains separate from technical integration and requires approved provider due-diligence evidence.",
      },
      {
        title: "Ongoing control",
        body: "Roles, MFA, dual control, operating limits, reconciliation exceptions and audit records support continuing oversight.",
      },
    ],
    link: { label: "Review compliance operations", href: "/compliance" },
  },
};

export type ContactIntent = "access" | "sales" | "default";

export function resolveContactIntent(value?: string | string[]): ContactIntent {
  const intent = Array.isArray(value) ? value[0] : value;
  if (intent === "access") return "access";
  if (intent === "sales") return "sales";
  return "default";
}

export function marketingMetadata(fileName: string, routePath: string): Metadata {
  const page = PAGES[fileName];
  const title = page ? `${page.eyebrow} — INRSettle` : "INRSettle";
  const description = page?.description ?? "INRSettle legal and operational information.";
  const canonical = `https://inrsettle.com${routePath}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: "website", url: canonical },
    twitter: { card: "summary", title, description },
  };
}

function NativePublicPage({ page }: { page: PublicPage }) {
  return (
    <main>
      <section className="platform-hero platform-hero--compact">
        <div className="platform-container">
          <p className="platform-kicker">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className="platform-hero__lead">{page.description}</p>
          {page.boundary ? <p className="platform-boundary">{page.boundary}</p> : null}
        </div>
      </section>

      <section className="platform-section">
        <div className="platform-container">
          <div className="platform-feature-grid">
            {page.sections.map((section, index) => (
              <article className="platform-feature" key={section.title}>
                <span className="platform-feature__index">{String(index + 1).padStart(2, "0")}</span>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
                {section.points ? (
                  <ul>
                    {section.points.map((point) => (
                      <li key={point}>
                        <CheckCircle2 aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
          {page.link ? (
            <Link className="platform-text-link" href={page.link.href}>
              {page.link.label}
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function StaticMarketingPage({ fileName }: { fileName: string }) {
  const page = PAGES[fileName];
  if (!page) return null;
  return (
    <div className="min-h-screen bg-white text-slate-950 antialiased">
      <SiteHeader />
      <NativePublicPage page={page} />
      {fileName !== "status.html" && !fileName.startsWith("legal/") ? <SiteCta /> : null}
      <SiteFooter />
    </div>
  );
}
