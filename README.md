# INRSettle

INRSettle is a multi-tenant B2B Settlement Operations Platform. It controls the lifecycle from request and approval through funding visibility, provider orchestration, proof, reconciliation and finality.

It is **not** a PSP, exchange, payout provider, liquidity network or custodian. Where a configured external provider connector is used, that provider performs the external operation; INRSettle records the request, provider outcome, independent reconciliation and approval evidence.

## What is implemented

- Next.js 16 App Router console and public marketing pages.
- PostgreSQL data model and migrations through Prisma 7.
- Cookie-session authentication, active-organization enforcement and six tenant roles.
- Quote → settlement → encrypted execution instruction → approval → funding → provider execution → proof → reconciliation → finality review → report.
- Dual control for lifecycle approval, funding confirmation and finality approval.
- Deterministic finality engine: provider proof alone never establishes finality.
- Provider-agnostic connector registry, capability and corridor declarations, tenant connection posture, durable outbound operation ledger and verified-webhook inbox.
- Signed webhook verification, persistent idempotency records, explicit uncertain-outcome handling, circuit evaluation and operator-controlled resolution.
- AES-256-GCM encrypted settlement instructions and redacted provider payload persistence.
- Scoped service credentials with one-time secret display and idempotency enforcement on mutation routes.
- PontisGlobe and RemitQuickly adapters behind the universal connector contract.

InvoiceMate / PayMate is not hardcoded or claimed as integrated. It can be added as another connector only after its authoritative API contract, credentials, webhook scheme, status semantics and reconciliation references are supplied.

## Product map

- Operational console: `app/(dashboard)`
- Session/RBAC: `lib/auth.ts`, `lib/api.ts`, `lib/permissions.ts`
- Settlement domain: `lib/domain.ts`, `lib/settlement-lifecycle.ts`
- Funding: `lib/funding.ts`, `app/(dashboard)/settlements/[id]/funding`
- Finality: `lib/finality.ts`, `lib/finality-input.ts`
- Provider layer: `lib/providers/contracts.ts`, `registry.ts`, `service.ts`, `webhook-inbox.ts`
- Encrypted instructions: `lib/settlement-instructions.ts`, `lib/sensitive-data.ts`
- Provider routing: `lib/providers/routing.ts`
- Service API: `lib/api.ts`, `lib/api-credentials.ts`, `lib/api-idempotency.ts`
- Data model/migrations: `prisma/schema.prisma`, `prisma/migrations`
- Pontis static-IP gateway: `gateway/pontis`

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

The application deploys as Next.js. Use a secret manager for production values. `ProviderConnection.credentialsRef` stores only an opaque reference such as `vault://...`; it must never contain a credential value. `MFA_ENCRYPTION_KEY`, `SETTLEMENT_DATA_ENCRYPTION_KEY`, `API_KEY_PEPPER` and `SESSION_SECRET` must be independent values.

Vercel uses `npm run build:vercel`, which applies committed Prisma migrations
before compiling the application. The deployment fails closed if the database
cannot be reached or a migration cannot be applied, preventing a new Prisma
Client from being published against an older schema. Preview and production
must use separately scoped `DATABASE_URL` values. PostgreSQL URLs should use
`sslmode=verify-full`; the runtime also preserves pg 8's current strict
verification when a legacy `prefer`, `require` or `verify-ca` alias is supplied.

Pontis deployments that require a whitelisted static IP should use `gateway/pontis`. Provider credentials remain on that gateway; the app receives only the gateway URL and a separate shared secret.

Production activation still requires deployment-specific evidence outside this repository: provider contracts and credentials, approved provider/client due diligence, bank and reconciliation sources, monitored infrastructure, backup/restore validation, incident contacts and independent security testing.
