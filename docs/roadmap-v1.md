# INRSettle v1.0 — Product Director's Implementation Roadmap

**Baseline:** `docs/design-audit-v1.md`.
**Frame:** six weeks, one team, business logic frozen (finality, reconciliation, approvals, audit, provider integrations untouched).
**Prioritisation rule:** everything is ranked by what it changes in a partner meeting, a customer pilot, or an investor demo — not by how easy it is.

**Legend per item:** Why · Business problem · Audience · Layers (UI / UX / IA / Copy / DS / BE) · Complexity (S/M/L) · Impact (Low/Med/High/**Transformational**)

---

## Challenges to my own audit (decided before the roadmap)

1. **"Quotes shouldn't be a page" — partially withdrawn.** Quote *creation* moves into the "New settlement" flow (the audit was right: it's a step, not a place). But the quote *book* — active quotes, expiry, rate provenance — matters to treasury users and survives as a tab inside Settlements. Deleting the concept would hide rate governance, which is a selling point.
2. **"Kill Monitoring entirely" — softened.** The page as a fake command center dies. But the incident *rules* content (what happens when a payout hangs >2h, who freezes what) is real operational governance partners ask about. It moves into Provider readiness as a "Runbook" tab, clearly framed as policy, not telemetry.
3. **"Rebuild the landing as a Next page" — deferred to v1.1.** Correct long-term; wrong use of week 2. The regex-patching pipeline is ugly but contained and shipping. The 80% of landing value (copy, aesthetic restraint, a real sample report behind the CTA) is achievable inside the current pipeline in days, not weeks.
4. **"Add charts" — constrained hard.** Exactly four time-series, server-rendered as lightweight inline SVG (no chart library — none is installed, and recharts would add bundle and design risk). More than four charts and the ops console becomes a BI cosplay.
5. **"One environment indicator should replace all mode chips" — corrected.** The *global* posture chip stays in the chrome (already shipped). But per-settlement mode (demo/shadow/live-test rows coexist in one table) is real data an operator filters by — it becomes a table column + filter, not a chip glued to every card. The audit conflated decoration with data.

## What the audit missed (added to the roadmap)

- **M1. Seed data is the real design system.** Every screenshot, chart, and demo flows from `prisma/seed-demo.ts`. Current seeds cluster timestamps, so any trend chart would render as a vertical spike. A curated seed pass (30–45 days of dated settlements, realistic references, a plausible exception mix) is a prerequisite for Phase 3, costs a day, and improves every screen at once. *(BE-adjacent but non-destructive: seeds only.)*
- **M2. `autoMatchReconciliation` runs as a side effect of loading the dashboard** — a mutation on GET. Operators should trigger matching explicitly (button already exists on Reconciliation) or a scheduled job should. Removing the on-load call is a one-line UX-integrity fix that also speeds up Home. *(Flagged as the one BE-lite change worth making.)*
- **M3. Error boundaries.** No `error.tsx` anywhere. One global + one per route group, with calm copy and a support path. Small, and its absence is exactly the kind of thing a pilot customer finds first.
- **M4. Page `<title>` discipline.** Routes share one title. "Settlements — INRSettle" per page: trivial, and it's what makes multi-tab operator work usable.
- **M5. Timezone decision** (not just display): all timestamps render in one declared zone (IST, labeled) with UTC on hover — a product decision the audit reduced to a display bug.
- **M6. Copy as code.** A `lib/copy.ts` with the disclaimer, thesis, and status vocabulary as constants. The "thesis repeated on ten screens" problem recurs unless the strings have one home.

---

==================================================
## PHASE 0 — Foundation (Week 1)
==================================================

**Goal: make it impossible to build the old inconsistencies again.**

| # | Item | Why / problem / audience | Layers | Cx | Impact |
|---|------|--------------------------|--------|----|--------|
| 0.1 | **Design tokens & type scale.** Formalise in `globals.css`: 12px floor (kill `text-[9px]`/`text-[10px]` except legal footnotes), 4 type sizes, spacing scale, one radius scale, semantic color tokens (`--status-ok/pending/blocked/info/neutral`) replacing hex-sprinkled classes like `text-[#9b6810]`. | Every later phase inherits this. Solves: 4 chip systems, eyebrow-itis, contrast failures. All audiences. | DS | M | **High** |
| 0.2 | **One status taxonomy.** Collapse `Badge`, `StatusBadge`, `case-chip`, `prs-chip` into a single `<StatusChip tone size>` mapped from domain statuses in one file (extend `components/ops/status-badge.tsx`, delete the rest incrementally). Lucide icons replace "✓ ✕ • !" text glyphs everywhere (`check-dot`, `conf-step__dot`, `prs-gate-dot`). | Status is the product's core vocabulary; today it has four accents. Operators/compliance. | DS | M | **High** |
| 0.3 | **One header pattern.** `<PageHeader>` becomes: title row + primary action + optional stat strip (the Settlements 6-stat strip generalised, stats clickable as filters). `conf-hero` is deleted as a concept — the thesis leaves working screens. | Kills self-pitching UI (audit 1.1). Operators. | DS/UI/Copy | M | **Transformational** |
| 0.4 | **`<DataTable>` component.** Sortable columns, pagination (cursor on `createdAt/id`), sticky header, dense rows, right-aligned tabular numerals, empty+loading rows, mobile column-priority. Built once on top of existing `DataGrid` primitives. | The spine of Phases 4–5. Cards→tables is the single biggest "prototype → product" shift. Operators, treasury. | DS | L | **Transformational** |
| 0.5 | **Timestamp component.** `<Time value>` → "12 Jan 2026, 14:32 IST", UTC + ISO on hover. Sweep `formatDateTime` call sites. | Treasury across timezones; auditability. Compliance. | DS/UI | S | Med |
| 0.6 | **Curated seed pass (M1).** 30–45 days of spread, realistic demo data; deterministic; keeps existing demo cases (SET-DEMO-001) intact. | Prerequisite for any chart; upgrades every demo. Investors/partners. | BE (seeds only) | S | **High** |
| 0.7 | **Copy constants (M6)** + copy rules doc: thesis appears on landing + report footer only; disclaimer once per surface max; "·" and em-dash budget. | Kills legal-anxiety repetition. Partners/investors. | Copy | S | Med |
| 0.8 | **Component inventory & deletion list.** One page listing every ops/ui component with keep/merge/delete verdict, so Phases 3–6 delete as they go (e.g. `settlement-rail-loader`, duplicate lifecycle renderings). | Prevents the graveyard from re-accreting. | DS | S | Low |

==================================================
## PHASE 1 — Information Architecture (Week 1–2)
==================================================

**Goal: 15 destinations → 7. The sidebar should read as the product's data model.**

Target nav (no groups needed at 7 items; keep Settings last):
**Home · Settlements · Reconciliation · Providers · Audit · Reports · Settings**

| # | Item | Why | Layers | Cx | Impact |
|---|------|-----|--------|----|--------|
| 1.1 | **Quotes → Settlements.** Quote creation becomes step 1 of "New settlement" (modal/flow); quote book becomes a "Quotes" tab on Settlements. `/quotes` redirects. | A step was promoted to a place; the core action currently spans two pages. Operators. | IA/UX | M | **High** |
| 1.2 | **KYB → Counterparties → Providers area.** KYB is an attribute, not a place. Counterparty list + KYB state merge into one "Counterparties" tab under Providers (or Settings if we decide counterparties are configuration — decide in design review; my call: Providers, because readiness is the story). `/kyb` redirects. | Two static pages become one credible surface. Compliance. | IA | M | Med |
| 1.3 | **Monitoring + Pilot readiness → fold.** Monitoring's runbook content → "Runbook" tab under Providers. Pilot-readiness checklist → "Go-live" tab under Providers (it is provider go-live governance). Both routes redirect. **Zero disabled fake buttons survive this merge.** | Kills brochureware inflation (audit 1.6); three liability clicks become one strong area. Partners. | IA/UI | M | **High** |
| 1.4 | **Accounts → tab under Settings ("Treasury references")** or under Providers — decide by user: it's reference data, not operations. My call: Settings. `/accounts` redirects. | Reference data shouldn't sit beside live operations. | IA | S | Low |
| 1.5 | **API page → replace with "API keys" stub under Settings + link to public docs.** The current page claims an API with no key management — an unverifiable claim (audit). Until keys exist, in-app API docs demote to a docs link. | Removes a claim a technical buyer will falsify. Partners. | IA/Copy | S | Med |
| 1.6 | **Team → tab under Settings.** Standard pattern (Mercury/Ramp). | Shrinks nav; team is administration. | IA | S | Low |
| 1.7 | **Sidebar chrome cleanup.** Footer pulse+static claim replaced by env posture (already in header) + version/support link. Command palette gains object search (Phase 7 dependency noted). | Decoration pretending to be telemetry (audit). | UI | S | Low |

==================================================
## PHASE 2 — Landing (Week 2, parallel track)
==================================================

**Goal: restraint + one kept promise. (Rebuild-as-Next deferred to v1.1 — see challenge #3.)**

| # | Item | Why | Layers | Cx | Impact |
|---|------|-----|--------|----|--------|
| 2.1 | **A real sample settlement report** behind "View sample report" — a static, anonymised HTML/PDF artifact generated from the actual report page with demo data. | The highest-intent CTA currently opens a contact form — a broken promise at the exact moment of maximum trust (audit 1.10). Partners/customers. | UX/Copy | S | **Transformational** |
| 2.2 | **Aesthetic restraint pass.** Remove traveling orbs + node-glow background; keep one static rail motif. Replace the fictional "PayPartner" console with a real (demo-data) report/console screenshot, labeled. | 2021-crypto aesthetic vs typography-first reference set; fake console beside real claims. Investors. | UI | M | High |
| 2.3 | **Content diet.** Cut secondary static pages from top nav (infrastructure/use-cases stay reachable via footer); nav: Product, How it works, Security, Docs, Sign in, Request access. | Six thin pages dilute; fewer, denser. | IA/Copy | S | Med |
| 2.4 | **Claims audit.** Every stat on the landing either comes from demo data labeled as such, or is removed. "146 proven final this month" goes. | No unlabeled fake numbers anywhere. Compliance/investors. | Copy | S | High |

==================================================
## PHASE 3 — Dashboard / Home (Week 2–3)
==================================================

**Goal: from manifesto to "what needs me today". Ten-second answer, zero pitch.**

Layout (top→bottom): **Action queue → Trends → Control loop → Recent activity.**

| # | Item | Why | Layers | Cx | Impact |
|---|------|-----|--------|----|--------|
| 3.1 | **Kill the hero.** Compact header: org name, env posture, "New settlement". Thesis line deleted (lives on landing/report). | Audit 1.1 — the single loudest MVP tell. Operators. | UI/Copy | S | **High** |
| 3.2 | **Action queue first.** One prioritized list merging today's risk tiles + pilot checklist duplicates: approvals waiting (with age), exceptions (with age), settled-awaiting-recon, expired quotes. Each row: count, oldest-age, one-click filtered destination. | The current 7 equal-weight sections answer no operator question. Solves duplicate risk/pilot/metric panels. Operators. | UX/UI | M | **Transformational** |
| 3.3 | **Four trends (SVG, server-rendered):** settled volume (30d), reconciliation match rate (30d), time-to-finality (median, 30d), exception count (30d). Depends on 0.6 seeds. | Audit 1.4 — no time axis anywhere. Treasury/investors. | UI | M | **High** |
| 3.4 | **Control loop strip retained but demoted** below trends, driven (as now) by the latest case; states link into the settlement detail. | It earns its place as orientation — after the operational answer, not before. Investors/new users. | UI | S | Med |
| 3.5 | **Recent activity = real audit events only** (existing stream filter), with object links; remove "operations stream" framing duplication with Audit page. | One activity concept. | UI/Copy | S | Low |
| 3.6 | **Remove `autoMatchReconciliation` from page load (M2);** matching runs from Reconciliation's explicit action. | Mutation-on-GET; also latency. Integrity. | BE-lite | S | Med |
| 3.7 | **First-run activation checklist** (new org, dismissible): create quote → approve → record proof → reconcile → view report. Replaces nothing; appears only when counts are zero. | Mercury/Ramp-style activation; demo orgs never see it, real pilots do. Customers. | UX | M | Med |

==================================================
## PHASE 4 — Core Operations (Week 3–4)
==================================================

| # | Item | Why | Layers | Cx | Impact |
|---|------|-----|--------|----|--------|
| 4.1 | **Settlements = DataTable.** Columns: ID, reference, amount (right-aligned), corridor, provider, mode, status, evidence (proof/recon icons), finality, updated. Sortable, paginated, stat-strip counts as filters. Row → detail sheet (triage) with "Open full report". Case-card grid deleted. | Audit 1.3 — the core object must scale and scan. Operators/treasury. | UX/UI/DS | L | **Transformational** |
| 4.2 | **"New settlement" flow** (from 1.1): step 1 quote (rate + provenance + TTL countdown), step 2 accounts/reference, step 3 review→create. Server actions unchanged underneath. | One action, one flow, no page-hopping. Operators. | UX | M | **High** |
| 4.3 | **Settlement detail consolidation.** The detail sheet and report page share one evidence component set (proof block, recon block, approval trail, finality banner) so sheet and report can never disagree visually. | One lifecycle language (audit: four renderings). | DS/UI | M | Med |
| 4.4 | **Reconciliation = import-first console.** Top: "Import records" (CSV upload UI writing through existing create API; provider-claim quarantine preserved) + explicit "Run matching". Queue and exceptions as DataTables with **age columns and aging highlights**. Explainer chips deleted; one sub-line of copy. | The workflow presupposes bank statements arriving; today there's no door for them. Exceptions without age isn't a queue. Operators/treasury. | UX/UI (+BE-lite CSV parse) | L | **High** |
| 4.5 | **Mode as data, not decor** (from challenge #5): mode column + filter in tables; chips stripped from cards/heroes; global posture chip remains the only ambient signal. | Audit 1.7 vocabulary spray. | UI | S | Med |
| 4.6 | **RemitQuickly sandbox card → Settings ("Developer/sandbox tools")** behind the existing flag; out of the operations flow. | Test harness in the middle of ops (audit). | IA | S | Low |

==================================================
## PHASE 5 — Evidence (Week 4–5)
==================================================

**Goal: the pitch is evidence — make the evidence surfaces the best in the app.**

| # | Item | Why | Layers | Cx | Impact |
|---|------|-----|--------|----|--------|
| 5.1 | **Audit browser rebuild.** DataTable over full history: server pagination, date-range + actor-type + action + resource filters, row expansion showing **before/after JSON diff** (data already stored, never shown), "export current view" (existing export API + filter params). | Audit 1.5: the crown-jewel data has a stub UI; auditors' first questions are unanswerable today. Compliance/partners. | UX/UI (+BE-lite query params) | L | **Transformational** |
| 5.2 | **Report becomes a document.** Stable report identity: persist first-generation timestamp + report ID (derive from the existing `settlement.report_generated` audit row — no schema change), rendered as "Report SR-xxxx · generated {first time}"; "Download PDF" via print pipeline; internal-only blocks (shadow checklist, mode chips) move behind an "Internal view" toggle, default off. | A document whose timestamp changes per view fails document control; internal QA vocabulary leaks to external eyes. Compliance/partners. | UX/UI/Copy | M | **High** |
| 5.3 | **Verification honesty pass.** "Immutable" → "append-only, organization-scoped" everywhere until a hash story ships; report footer states exactly what is and isn't verified. | Overclaim a bank will probe (audit 1.5). Compliance. | Copy | S | High |
| 5.4 | **Reports page: export history.** List of past exports/report generations from audit rows (who, what, when) under the export rows. | "An audit product must audit itself." Compliance. | UI | S | Med |
| 5.5 | **Finality explainability.** The confidence % links to a breakdown popover: the deterministic inputs (proof ✓/✗, independent match ✓/✗, approval ✓/✗, guardrails) — rendered from the existing `assessFinality` output, no logic change. | Naked scalar scores invite attack (audit 1.11). Risk/compliance. | UI | M | **High** |

==================================================
## PHASE 6 — Provider & Risk (Week 5)
==================================================

**Verdict: one system, one page, light theme. Providers absorbs KYB, Runbook, Go-live; Monitoring-as-telemetry dies until real.**

| # | Item | Why | Layers | Cx | Impact |
|---|------|-----|--------|----|--------|
| 6.1 | **Re-theme to the light design system.** `prs-*` dark surfaces replaced by ops panels; content structure (passport, gate, exposure, evidence) preserved — it's the strongest content in the app. | Audit 1.2: two design systems. Partners. | UI/DS | L | **High** |
| 6.2 | **Provider page structure:** header (name, rail, readiness decision chip) → tabs: **Readiness** (passport + gate + next actions) · **Exposure** (limits + freeze *policy*, stated as policy — no fake button) · **Evidence** (vault list) · **Counterparties/KYB** (from 1.2) · **Runbook** (from 1.3) · **Go-live** (pilot checklist from 1.3). | One credible system replaces four pages (audit 1.6). Partners/compliance. | IA/UI | L | **Transformational** |
| 6.3 | **Trust score → factor table.** Replace the naked 58/100 with the factor list it's derived from (already in `trustScore.missing`), each factor with state chip; the scalar becomes a summary of visible parts or is dropped. My call: drop the number, keep "X of Y readiness factors verified". | Unexplained scores are anti-trust for this audience (audit 1.11). Risk. | UI/Copy | S | **High** |
| 6.4 | **Evidence vocabulary pass.** "Evidence vault" → "Evidence on file"; "WhatsApp onboarding thread" → "Onboarding correspondence (archived)". Honest, without confirming cottage-scale. | Enterprise reader optics. Partners. | Copy | S | Med |

==================================================
## PHASE 7 — Polish (Week 5–6)
==================================================

| # | Item | Why | Layers | Cx | Impact |
|---|------|-----|--------|----|--------|
| 7.1 | **⌘K object search.** Palette searches settlements by publicId/reference and recon records by externalRef (server route querying existing indexes), plus nav/actions. | The defining power-user gesture of the reference set. Operators. | UX (+BE-lite search route) | M | **High** |
| 7.2 | **Toast system.** Replace `?success=`/`?error=` URL flashes app-wide; keep server actions. | Prototype-grade feedback (audit 1.8). | UX/DS | M | Med |
| 7.3 | **Loading & empty coverage:** `loading.tsx` for all routes; every empty state = what this is + one next action; `error.tsx` boundaries (M3). | Missing states are where pilots form first impressions. | UI | S | Med |
| 7.4 | **Accessibility pass:** 12px floor enforcement, contrast on remaining translucent text, focus states on all interactive rows, `aria-sort` on tables, reduced-motion coverage for new animations. | Enterprise procurement checklists include this. | UI/DS | M | Med |
| 7.5 | **Motion discipline:** entrance animations only on Home; tables never animate; one pulse (env chip) max per viewport. | Restraint = maturity. | UI | S | Low |
| 7.6 | **Per-page titles (M4), favicon/OG audit.** | Multi-tab operators; link previews to partners. | UI | S | Low |
| 7.7 | **Numbers pass:** en-IN grouping decision documented (M5 sibling), compact-format only above 10k, tabular-nums everywhere amounts render. | Treasury credibility lives in number typography. | DS | S | Med |

==================================================
## PHASE 8 — v1.0 Release Review
==================================================

**Partner-ready means:**
- A provider can be walked through *their own* readiness page (light theme, no fake buttons, factor-based readiness, evidence list) without a single "that's mocked" disclaimer.
- The sample report link on the landing opens a real document with a stable ID.
- No screen contains a disabled control, an env-var name, a JSON field name, or the word "immutable".

**Customer-ready means:**
- An operator can run the full loop — new settlement (quote step) → approval → proof → import bank CSV → match → finality → report — in one sitting, guided by the activation checklist, with toasts confirming each step and every list a sortable, paginated table.
- Exceptions and approvals show age; nothing silently truncates; audit answers "show me March".
- Every route has loading, empty, and error states; all timestamps carry a timezone.

**Investor-ready means:**
- The 10-second Home read: action queue + four 30-day trends + control loop — motion, judgment, and defensibility visible without narration.
- One design system end-to-end (landing restraint pass included); the demo dataset spans weeks and reads like a real book of business.
- The thesis appears exactly twice in the product (landing, report footer) — and lands harder both times because of it.

**Release gate:** typecheck + full test suite + build green; manual click-through of all 7 destinations in demo and empty-org states; print test of the report; mobile pass on Home, Settlements, report.

---

## Sequencing summary (six weeks)

| Week | Track |
|---|---|
| 1 | Phase 0 (tokens, StatusChip, PageHeader, DataTable start, seeds, copy constants) |
| 2 | Phase 1 (IA merges/redirects) + Phase 2 (landing, parallel) + DataTable finish |
| 3 | Phase 3 (Home) + Phase 4 start (Settlements table + New-settlement flow) |
| 4 | Phase 4 finish (Reconciliation import console) + Phase 5 start (Audit browser) |
| 5 | Phase 5 finish (report document, finality explainability) + Phase 6 (Providers system) |
| 6 | Phase 7 (polish) + Phase 8 (release review, fixes) |

**The five transformational bets, if everything else slips:** DataTable spine (0.4/4.1), Home action-queue (3.2), Audit browser (5.1), Providers one-system merge (6.2), sample report behind the landing CTA (2.1).
