# Provider integration

INRSettle integrates settlement providers through a connector contract, not
through provider-specific product flows.

## Components

- `lib/providers/contracts.ts` defines connector capabilities and request,
  status, proof, and webhook contracts.
- `lib/providers/registry.ts` resolves configured connectors.
- `lib/providers/routing.ts` evaluates eligibility, health, capabilities, and
  routing priority.
- `lib/providers/service.ts` owns idempotent operation creation, circuit state,
  execution dispatch, status checks, retries, and audit events.
- `lib/providers/webhook-inbox.ts` verifies and deduplicates inbound events.
- `lib/providers/redaction.ts` removes sensitive provider data before
  persistence.

InvoiceMate or any other future provider must be implemented as one adapter
behind these contracts. Product pages and lifecycle rules must not branch on a
provider brand.

## Required adapter behavior

An adapter must declare:

- supported corridors and capabilities;
- authentication and credential requirements;
- execution request mapping;
- status mapping into canonical provider states;
- signature verification for webhooks;
- stable provider references;
- proof extraction;
- health checks and timeout behavior.

Adapters must fail closed when instructions, credentials, or capabilities are
missing. They must not invent beneficiary data, quote identifiers, account
details, or successful responses.

## Reliability rules

- Execution uses a stable idempotency key.
- A submitted execution request is not automatically retried.
- Status checks may retry with bounded exponential backoff.
- Repeated failures open the provider circuit and block new work.
- Webhooks are signature-verified and deduplicated.
- Provider proof is evidence input; it does not independently establish
  finality.

## Credentials

Provider credentials are server-side only. UI and audit records expose
connection state, scope, rotation metadata, and last verification—not secret
values. Production credentials must use a managed secret store and a documented
rotation procedure.
