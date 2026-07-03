# INRSettle — the website at scale

Design specification for the public website people would expect from INRSettle
as a successful company. This is the north star the current site grows into —
not a build order. The current site is the honest subset of this design;
every section below is annotated with the fact that unlocks it, because the
one thing success must not change is the rule that built the product:
**nothing appears on the site that the company cannot prove.**

---

## 1. What success changes — and what it must not

Success changes the *evidence available*, not the design language. The site
stays white, typography-first, one emerald accent, zero animation theater,
documents-as-hero. What was restraint at private beta reads as confidence at
scale — the Stripe lesson: the website of the winner looks calmer than the
websites of the contenders.

Three things do change:

1. **Proof replaces argument.** Today the site argues the thesis; at scale it
   demonstrates it with aggregate numbers, named customers and case studies.
   The "problem" section shrinks as the "customers" section grows.
2. **Audiences get their own front doors.** One landing serving six personas
   becomes a Solutions layer with a page per buyer.
3. **Developers become a first-class audience.** Self-serve API keys exist by
   then; the docs stop being brochure pages and become the reference for a
   product people integrate without talking to sales.

## 2. Sitemap at scale

```
inrsettle.com
├── Product
│   ├── Platform            (console, reconciliation, evidence — the 3 surfaces, each with real screenshots)
│   ├── How it works        (the 7-checkpoint loop, interactive)
│   ├── Sample report       (kept forever — the original promise)
│   ├── Providers           (directory of verified payout providers, with readiness methodology)
│   └── Pricing             (public, per-settlement + platform tiers)
├── Solutions
│   ├── Payout operators
│   ├── PSPs & providers    (the "get verified" page — providers come to be listed)
│   ├── Treasury & OTC desks
│   └── Compliance & audit
├── Developers
│   ├── Documentation       (quickstart, guides, API reference — versioned)
│   ├── Changelog           (the credibility engine; weekly, unglamorous, real)
│   └── Status              (live uptime, incident history — real telemetry)
├── Trust
│   ├── Trust center        (SOC 2 / ISO artifacts, subprocessors, DPA, pen-test summaries)
│   ├── Security
│   └── Compliance
├── Company
│   ├── Customers           (case studies in evidence format)
│   ├── About               (team, entity, investors)
│   ├── Careers             (with an engineering-principles page)
│   └── Press               (kit: logo, boilerplate = positioning.md verbatim, coverage)
├── Contact                 (request access → "start now" once self-serve exists)
└── Sign in
```

Nav collapses this to six items: **Product · Solutions · Developers · Pricing
· Company · Sign in**, with "Get started" as the sole primary CTA. Trust and
legal live in the footer, where procurement looks for them.

## 3. The homepage at scale, section by section

| # | Section | Design | Unlocked by |
|---|---------|--------|-------------|
| 1 | **Hero** | The thesis headline stays: *Payment completed ≠ settlement finalized.* Sub-line becomes one aggregate fact: "INRSettle has verified settlement of ₹X across N payments for Y companies." CTAs: Get started · View a sample report. | Audited aggregate numbers, refreshed quarterly, methodology linked. Until then: current hero. |
| 2 | **Report artifact** | Kept — but rendered from a *real* (anonymized, permissioned) settlement rather than demonstration data, labeled accordingly. | One customer's written permission. |
| 3 | **Logo wall** | One row, grayscale, max 8, no carousel. Caption: "Teams that prove their settlements." | Written logo permission per customer. Never before. |
| 4 | **Product tour** | Three real screenshots (Home queue, reconciliation, report) in browser chrome, captioned with one factual line each. Screenshots replace the current text-only surfaces section. | Production UI with customer-shaped (not demo-labeled) data. |
| 5 | **Numbers band** | Four figures max: volume verified, match rate across the network, median time-to-finality, providers verified. Each links to methodology. | Same audited-quarterly rule as the hero. |
| 6 | **Case study feature** | One customer story in *evidence format*: the situation, the numbers before, the numbers after, a quoted operator with name and title. Not a testimonial wall — one story, rotated. | A referenceable customer. |
| 7 | **Developer strip** | Real request/response pair for `POST /v1/settlements`, copyable, against the actual API. "Read the docs →". | Self-serve or documented partner API keys. |
| 8 | **Controls strip** | Kept as-is, upgraded with certification marks (SOC 2, ISO 27001) when held. | The certifications themselves. |
| 9 | **Closing CTA** | "Prove your settlements are actually final." — unchanged. Some sentences are finished. | — |

Explicitly **absent, forever**: animated backgrounds, mascots, G2 badges,
"leader" quadrant graphics, AI positioning, countup animations on the numbers
band, and any statistic without a methodology link.

## 4. Pages success creates

**Customers.** Case studies written like the product's own reports: context,
control gaps found, evidence chain installed, measured outcome (match rate,
exception aging, audit prep time), named quote. PDF-exportable — a case study
a champion can attach to an internal memo outranks any landing page.

**Pricing.** Public. Per-settlement verification fee + platform tiers, a
calculator, and the enterprise "talk to us" row. Publishing pricing is the
single loudest "we are a real company" signal in B2B; the page exists the day
pricing stabilizes.

**Providers directory.** The quiet moat page: every payout provider that has
passed go-live verification, with readiness methodology published. At scale,
providers ask to be listed — the audience flips from buyers to supply.

**Changelog.** Weekly, dry, real ("Reconciliation: CSV import now accepts
SFDC-format statement exports"). Nothing signals a living product to a
technical evaluator like an unbroken changelog. Starts the week the site
relaunches — this one needs no success to unlock.

**Trust center.** Certifications with downloadable letters, subprocessor
list, data-residency statement, responsible-disclosure policy, uptime SLA.
Replaces today's static security/compliance prose as procurement's
self-serve path.

**About.** Entity, team with real photographs, investors, the manifesto
(from positioning.md, verbatim). The anonymity gap identified in the persona
review, closed permanently.

## 5. Design system at scale

Unchanged: tokens, Inter, white surfaces, hairline borders, emerald =
verified, documents as the visual signature. Added: a screenshot standard
(browser chrome, 2× DPI, consistent viewport, quarterly refresh), a
photography policy (real people, no stock), a diagram library (the loop, the
evidence chain, the boundary diagram "providers move money / INRSettle proves
it" — drawn once, reused everywhere), and localized pages (the INR market
justifies Hindi-language solution pages before any other localization).

## 6. Content rules that survive success

1. Logos and case studies only with written permission.
2. Aggregate numbers audited quarterly; methodology one click away.
3. The words *leading, first, best, seamless, revolutionary, AI-powered*
   remain banned.
4. The thesis appears once on the homepage and once in every report footer.
5. The sample report never disappears — successful companies keep the
   artifact that earned their first ten customers.
6. Positioning (docs/positioning.md) is the boilerplate everywhere: press
   kit, About, meta descriptions. One source, no drift.

## 7. Path from today

The current site is already this design at private-beta truth level: same
chrome, same hero, same artifact strategy, same voice. The growth path is
strictly additive — each unlock row above swaps a placeholder for a fact.
Nothing built today gets thrown away, because nothing built today lies.

First three unlocks worth pursuing, in order:
1. **Changelog** (no dependency — start now),
2. **About with entity + team** (one legal fact + photographs),
3. **First permissioned case study** (one happy pilot).
```
