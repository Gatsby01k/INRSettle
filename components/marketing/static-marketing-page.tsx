import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { SiteCta, SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";

/**
 * Legacy content renderer — unified design system (public website v2).
 *
 * The secondary public pages (security, compliance, docs, legal, status, …)
 * keep their CONTENT in the original static HTML files — wording unchanged,
 * which matters for legal and compliance text. Everything else is new:
 * this module extracts only each file's <main> content, rewrites internal
 * links, and renders it inside the same SiteHeader / SiteFooter chrome and
 * typography the landing uses (styled by the `.mkt-legacy` rules in
 * globals.css). The old marketing stylesheet, scripts, analytics snippet,
 * animated background and CSS patch layer are gone.
 */

const staticFiles: Record<string, string> = {
  "use-cases.html": path.join(process.cwd(), "use-cases.html"),
  "inr-settlement-india.html": path.join(process.cwd(), "inr-settlement-india.html"),
  "infrastructure.html": path.join(process.cwd(), "infrastructure.html"),
  "api.html": path.join(process.cwd(), "api.html"),
  "compliance.html": path.join(process.cwd(), "compliance.html"),
  "security.html": path.join(process.cwd(), "security.html"),
  "risk.html": path.join(process.cwd(), "risk.html"),
  "status.html": path.join(process.cwd(), "status.html"),
  "contact.html": path.join(process.cwd(), "contact.html"),
  "docs/index.html": path.join(process.cwd(), "docs", "index.html"),
  "docs/api.html": path.join(process.cwd(), "docs", "api.html"),
  "docs/integration.html": path.join(process.cwd(), "docs", "integration.html"),
  "docs/webhooks.html": path.join(process.cwd(), "docs", "webhooks.html"),
  "docs/reconciliation.html": path.join(process.cwd(), "docs", "reconciliation.html"),
  "legal/privacy.html": path.join(process.cwd(), "legal", "privacy.html"),
  "legal/terms.html": path.join(process.cwd(), "legal", "terms.html"),
  "legal/compliance.html": path.join(process.cwd(), "legal", "compliance.html"),
};

const routeMap: Record<string, string> = {
  "/index.html": "/",
  "/docs/index.html": "/docs",
  "/docs/api.html": "/docs/api",
  "/docs/integration.html": "/docs/integration",
  "/docs/webhooks.html": "/docs/webhooks",
  "/docs/reconciliation.html": "/docs/reconciliation",
  "/legal/privacy.html": "/legal/privacy",
  "/legal/terms.html": "/legal/terms",
  "/legal/compliance.html": "/legal/compliance",
  "/use-cases.html": "/use-cases",
  "/inr-settlement-india.html": "/inr-settlement-india",
  "/infrastructure.html": "/infrastructure",
  "/api.html": "/developers",
  "/compliance.html": "/compliance",
  "/security.html": "/security",
  "/risk.html": "/risk",
  "/status.html": "/status",
  "/contact.html": "/contact",
};

function readStaticFile(fileName: string) {
  const filePath = staticFiles[fileName];
  if (!filePath) throw new Error(`Unknown marketing page: ${fileName}`);
  return fs.readFileSync(filePath, "utf8");
}

function matchContent(html: string, pattern: RegExp) {
  return html.match(pattern)?.[1] ?? "";
}

function rewriteMarketingLinks(html: string) {
  let rewritten = html;
  for (const [from, to] of Object.entries(routeMap)) {
    const escaped = from.replace(".", "\\.");
    rewritten = rewritten.replace(new RegExp(escaped, "g"), to);
  }
  return rewritten;
}

// Split the two public CTAs by intent: access → product flow, sales → sales flow.
function rewriteContactCtas(html: string) {
  return html
    .replace(/href="\/contact#access"/g, 'href="/contact?intent=access"')
    .replace(/href="\/contact"(?!\?)/g, 'href="/contact?intent=sales"');
}

export type ContactIntent = "access" | "sales" | "default";

export function resolveContactIntent(value?: string | string[]): ContactIntent {
  const intent = Array.isArray(value) ? value[0] : value;
  if (intent === "access") return "access";
  if (intent === "sales") return "sales";
  return "default";
}

const directContactHtml = `
      <div class="direct-contact">
        <p>Prefer direct communication?</p>
        <p>Telegram: <a href="https://t.me/INRSettle_team" target="_blank" rel="noopener">@INRSettle_team</a></p>
        <p>Email: <a href="mailto:info@inrsettle.com">info@inrsettle.com</a></p>
      </div>`;

function accessMainHtml() {
  return `
<section class="page-hero">
  <div class="container">
    <div class="eyebrow">Request access</div>
    <h1>Request access</h1>
    <p>Access to the INRSettle console for payout, treasury and settlement teams — currently in private beta.</p>
  </div>
</section>
<section class="section" id="access">
  <div class="container split">
    <div class="contact-box">
      <h2>Product access</h2>
      <p class="muted">Share your business profile and settlement use case. The team reviews fit, KYB requirements, and operational needs before provisioning console access.</p>
      <ul class="feature-list">
        <li>Settlement operations console</li>
        <li>Provider proof and independent reconciliation</li>
        <li>Append-only audit trail and finality review</li>
        <li>Per-settlement evidence reports</li>
      </ul>${directContactHtml}
    </div>
    <form class="form card" name="access-request" method="POST" data-netlify="true" netlify-honeypot="bot-field">
      <input type="hidden" name="form-name" value="access-request">
      <input type="hidden" name="intent" value="Access request">
      <p hidden><label>Do not fill:<input name="bot-field"></label></p>
      <input name="email" type="email" placeholder="Work email" required>
      <input name="company" placeholder="Company" required>
      <input name="role" placeholder="Role">
      <select name="monthly_volume">
        <option value="">Monthly INR/USDT settlement volume</option>
        <option>Below $10k</option>
        <option>$10k–$50k</option>
        <option>$50k–$250k</option>
        <option>$250k+</option>
      </select>
      <textarea name="use_case" placeholder="Use case"></textarea>
      <button class="btn primary" type="submit">Request access</button>
    </form>
  </div>
</section>`;
}

function salesMainHtml() {
  return `
<section class="page-hero">
  <div class="container">
    <div class="eyebrow">Talk to us</div>
    <h1>Talk to us</h1>
    <p>Discuss corridors, integration, settlement volume, and partnership requirements.</p>
  </div>
</section>
<section class="section" id="sales">
  <div class="container split">
    <div class="contact-box">
      <h2>Enterprise &amp; partnerships</h2>
      <p class="muted">Work with our team on corridor coverage, integration scope, settlement volume, and commercial terms.</p>
      <ul class="feature-list">
        <li>Corridor and integration scoping</li>
        <li>Volume-based commercial terms</li>
        <li>Partnership and onboarding support</li>
        <li>Institutional KYB and risk review</li>
      </ul>${directContactHtml}
    </div>
    <form class="form card" name="sales-conversation" method="POST" data-netlify="true" netlify-honeypot="bot-field">
      <input type="hidden" name="form-name" value="sales-conversation">
      <input type="hidden" name="intent" value="Sales conversation">
      <p hidden><label>Do not fill:<input name="bot-field"></label></p>
      <input name="email" type="email" placeholder="Work email" required>
      <input name="company" placeholder="Company" required>
      <input name="role" placeholder="Role">
      <input name="corridor" placeholder="Corridor interest">
      <textarea name="message" placeholder="Message"></textarea>
      <button class="btn primary" type="submit">Talk to us</button>
    </form>
  </div>
</section>`;
}

function defaultContactMainHtml() {
  return `
<section class="page-hero">
  <div class="container">
    <div class="eyebrow">Contact</div>
    <h1>Contact INRSettle</h1>
    <p>Request access to the console, or start an enterprise and partnership conversation with our team.</p>
  </div>
</section>
<section class="section">
  <div class="container grid-2">
    <div class="contact-box intent-card">
      <div class="eyebrow">Product access</div>
      <h2>Request access</h2>
      <p class="muted">Access the INRSettle console for settlement operations. Best for teams evaluating the product directly.</p>
      <ul class="feature-list">
        <li>Console access</li>
        <li>INR ↔ USDT settlement workflows</li>
        <li>Evidence and reporting walkthrough</li>
      </ul>
      <p class="intent-cta"><a class="btn primary" href="/contact?intent=access">Request access</a></p>
    </div>
    <div class="contact-box intent-card">
      <div class="eyebrow">Enterprise &amp; partnerships</div>
      <h2>Talk to us</h2>
      <p class="muted">Discuss corridors, integration, settlement volume, and partnership requirements with our team.</p>
      <ul class="feature-list">
        <li>Corridor and integration scoping</li>
        <li>Volume-based commercial terms</li>
        <li>Partnership and onboarding support</li>
      </ul>
      <p class="intent-cta"><a class="btn" href="/contact?intent=sales">Talk to us</a></p>
    </div>
  </div>
</section>`;
}

function mainHtml(fileName: string, intent: ContactIntent = "default") {
  if (fileName === "contact.html") {
    return intent === "access" ? accessMainHtml() : intent === "sales" ? salesMainHtml() : defaultContactMainHtml();
  }
  const html = readStaticFile(fileName);
  const inner = matchContent(html, /<main[^>]*>([\s\S]*?)<\/main>/i);
  return rewriteContactCtas(rewriteMarketingLinks(inner));
}

const contactIntentMeta: Record<Exclude<ContactIntent, "default">, { title: string; description: string }> = {
  access: {
    title: "Request access — INRSettle",
    description: "Access to the INRSettle console for payout, treasury and settlement teams.",
  },
  sales: {
    title: "Talk to us — INRSettle",
    description: "Discuss corridors, integration, settlement volume, and partnership requirements.",
  },
};

export function marketingMetadata(fileName: string, routePath: string, intent: ContactIntent = "default"): Metadata {
  const html = readStaticFile(fileName);
  const fileTitle = matchContent(html, /<title>([\s\S]*?)<\/title>/i);
  const fileDescription = matchContent(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const intentMeta = fileName === "contact.html" && intent !== "default" ? contactIntentMeta[intent] : undefined;
  const title = intentMeta?.title ?? fileTitle;
  const description = intentMeta?.description ?? fileDescription;
  const canonical = `https://inrsettle.com${routePath}`;

  return {
    title,
    description,
    manifest: "/site.webmanifest",
    icons: { icon: "/assets/favicon.png", apple: "/assets/favicon.png" },
    alternates: { canonical },
    openGraph: { title, description, type: "website", url: canonical, images: ["/assets/logo.png"] },
    twitter: { card: "summary_large_image", title, description, images: ["/assets/logo.png"] },
  };
}

export function StaticMarketingPage({ fileName, intent = "default" }: { fileName: string; intent?: ContactIntent }) {
  const html = mainHtml(fileName, intent);
  const isContact = fileName === "contact.html";

  return (
    <div className="min-h-screen bg-white text-slate-950 antialiased">
      <SiteHeader />
      <main className="mkt-legacy" dangerouslySetInnerHTML={{ __html: html }} />
      {!isContact ? <SiteCta /> : null}
      <SiteFooter />
    </div>
  );
}
