# INRSettle

INRSettle is a multi-tenant B2B settlement operations platform for proof, reconciliation, audit trail, funding visibility and finality review.

It is **not** a PSP, exchange, payout provider, liquidity network or custodian. Where a configured external provider connector is used, that provider performs the external operation; INRSettle records the request, provider outcome, independent reconciliation and approval evidence.

## What is implemented

- Next.js 16 App Router console and public marketing pages.
- PostgreSQL data model and migrations through Prisma 7.
- Cookie-session authentication, active-organization enforcement and six tenant roles.
- Quote → settlement → approval → funding → provider execution/manual external execution → proof → reconciliation → finality review → report.
- Dual control for lifecycle approval, funding confirmation and LIVE_TEST finality approval.
- Deterministic finality engine: provider proof alone never establishes finality.
- Generic provider connector registry, per-tenant connection metadata, durable outbound operation ledger and durable verified-webhook inbox.
- Existing sandbox-oriented PontisGlobe and RemitQuickly adapters.

InvoiceMate / PayMate is **not** implemented or claimed as integrated. No authoritative API contract, credentials, webhook scheme or status mapping for it exists in this repository. A connector can be added through `lib/providers/contracts.ts` after those artifacts are supplied.

## Product map

- Operational console: `app/(dashboard)`
- Session/RBAC: `lib/auth.ts`, `lib/api.ts`, `lib/permissions.ts`
- Settlement domain: `lib/domain.ts`, `lib/settlement-lifecycle.ts`
- Funding: `lib/funding.ts`, `app/(dashboard)/settlements/[id]/funding`
- Finality: `lib/finality.ts`, `lib/finality-input.ts`
- Provider layer: `lib/providers/contracts.ts`, `registry.ts`, `service.ts`, `webhook-inbox.ts`
- Data model/migrations: `prisma/schema.prisma`, `prisma/migrations`
- Pontis static-IP gateway: `gateway/pontis`

The Accounts, Counterparties, KYB, Monitoring and Pilot Readiness screens contain explicitly labelled illustrative/static datasets. They are not systems of record, live monitoring, connected balances, document storage or completed provider DD.

## Local setup

Requirements: Node.js 20+, npm and PostgreSQL.

```bash
cp .env.example .env.local
npm ci
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

Quality gates:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx prisma validate
```

## Deployment and secrets

The application deploys as Next.js (the repository is not a static Netlify site). Use a secret manager for production values. `ProviderConnection.credentialsRef` stores only an opaque reference such as `vault://...`; it must never contain a credential value.

Vercel uses `npm run build:vercel`, which applies committed Prisma migrations
before compiling the application. The deployment fails closed if the database
cannot be reached or a migration cannot be applied, preventing a new Prisma
Client from being published against an older schema. Preview and production
must use separately scoped `DATABASE_URL` values. PostgreSQL URLs should use
`sslmode=verify-full`; the runtime also preserves pg 8's current strict
verification when a legacy `prefer`, `require` or `verify-ca` alias is supplied.

Pontis deployments that require a whitelisted static IP should use `gateway/pontis`. Provider credentials remain on that gateway; the app receives only the gateway URL and a separate shared secret.

## Known production blockers

The repository is suitable for a controlled, clearly labelled product demonstration after environment setup. It is not yet approved for first production clients. TOTP MFA, recovery codes, short-lived approval step-up, account lockout and primary FINANCE_VIEWER masking are implemented. Open blockers include distributed IP/device throttling and administrative recovery, service-account/OAuth API authentication, secret-manager resolution, encrypted-at-rest PII/provider payloads and document storage, immutable audit export/WORM, automated retry workers and alerting, real KYB/screening integrations, provider-specific DD, and deployment/DR/penetration evidence.

See `docs/partner-readiness-audit-2026-07-20.md` for the evidence-backed audit, priority plan and readiness gates.
