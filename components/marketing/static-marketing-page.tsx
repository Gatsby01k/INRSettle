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

function mainHtml(fileName: string) {
  const html = readStaticFile(fileName);
  const inner = matchContent(html, /<main[^>]*>([\s\S]*?)<\/main>/i);
  return rewriteContactCtas(rewriteMarketingLinks(inner));
}

export function marketingMetadata(fileName: string, routePath: string): Metadata {
  const html = readStaticFile(fileName);
  const fileTitle = matchContent(html, /<title>([\s\S]*?)<\/title>/i);
  const fileDescription = matchContent(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const title = fileTitle;
  const description = fileDescription;
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

export function StaticMarketingPage({ fileName }: { fileName: string }) {
  const html = mainHtml(fileName);
  return (
    <div className="min-h-screen bg-white text-slate-950 antialiased">
      <SiteHeader />
      <main className="mkt-legacy" dangerouslySetInnerHTML={{ __html: html }} />
      <SiteCta />
      <SiteFooter />
    </div>
  );
}
