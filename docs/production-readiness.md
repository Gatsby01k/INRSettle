# Production readiness

## Repository gates

- Prisma schema formats and validates.
- Prisma Client is generated from the committed schema.
- TypeScript completes without errors.
- ESLint completes without errors.
- The automated test suite passes.
- The production Next.js build completes.
- `git diff --check` reports no whitespace defects.

## Deployment gates

- `prisma migrate status` reports no pending migration.
- Required secrets are stored outside source control and meet documented
  lengths and formats.
- PostgreSQL certificate verification is enabled.
- Provider credentials, callback URLs, and signing secrets are verified in the
  target environment.
- The retry scheduler can reach the authenticated internal endpoint. The
  repository schedule is a daily Hobby-compatible recovery sweep; production
  volume requires a two-minute Vercel Pro or external schedule.
- Storage uses tenant-authorized, short-lived signed document URLs.
- Monitoring and incident contacts are active.

## Partner gates

- Connector capabilities and supported corridors are documented.
- Idempotency behavior and timeout semantics are jointly tested.
- Webhook signature, replay handling, and delivery retries are verified.
- Provider reference and proof fields are mapped.
- Reconciliation cut-off, exception ownership, and escalation contacts are
  agreed.
- Commercial terms, data processing, due diligence, and operating limits are
  approved.

## First-client gates

- Client due diligence is approved.
- Users, roles, approvers, and MFA policy are configured.
- Settlement and daily limits are approved.
- Funding account visibility and source evidence are confirmed.
- One end-to-end provider certification case reaches finality.
- Duplicate, timeout, webhook replay, mismatch, and provider outage scenarios
  are exercised.
- Client reporting, support, incident, and data-retention expectations are
  signed off.
