# Incident handling playbook

## Priorities

- **SEV-1:** suspected duplicate execution, unauthorized access, data exposure,
  or loss of control over a provider credential.
- **SEV-2:** provider execution is unavailable or ambiguous for active
  settlements; reconciliation or webhook processing is materially delayed.
- **SEV-3:** isolated workflow degradation with a safe manual path and no
  evidence of financial or data impact.

## Immediate control actions

1. Assign an incident lead and record the incident start time.
2. Stop new execution through the affected connector. Do not delete or replace
   existing provider operations.
3. Preserve request IDs, idempotency keys, provider references, webhook
   deliveries, proof, reconciliation records, and audit events.
4. Determine whether any provider may have acted.
5. Notify the provider and affected internal owners through approved channels.
6. Move ambiguous operations to Manual Intervention.

## Ambiguous execution

An execution timeout is not proof of failure. Query status using the original
provider reference and idempotency key. Automatic retries are limited to
read-only status checks. A new execution request is prohibited until a
different authorized reviewer records evidence that no provider side effect
occurred.

## Credential incident

Disable the affected connector, rotate the provider credential and relevant
signing secret, invalidate exposed API credentials, review audit history, and
compare provider-side logs with INRSettle operation logs. Do not place secrets
or full provider payloads in the incident record.

## Recovery and closure

Recovery requires:

- the affected provider circuit is healthy;
- queued status checks are current;
- all ambiguous operations are resolved or assigned;
- proof and bank reconciliation are complete for affected settlements;
- client-facing impact is documented;
- a second authorized reviewer approves resumption.

The closure record must include timeline, scope, evidence, root cause,
corrective actions, owner, and target dates. It must not contain raw account
numbers, credentials, or unredacted provider payloads.
