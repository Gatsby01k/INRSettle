# Security controls

## Identity and access

- Password authentication, account lockout, MFA enrollment, recovery codes,
  and time-bound MFA step-up are implemented in the application layer.
- Organization membership and RBAC are enforced server-side.
- Sensitive approvals use dual control; the creator cannot approve their own
  settlement.
- Service API credentials are scoped, hashed with an independent pepper, and
  revocable.

## Tenant isolation

Operational reads and mutations include the authenticated
`organizationId`. Object identifiers alone do not authorize access. New
queries must preserve this invariant and be covered by authorization tests.

## Sensitive data

- MFA secrets and settlement execution instructions use AES-256-GCM with
  independent keys.
- Provider credentials remain in server-side configuration or an external
  secret manager.
- Provider webhook and proof payloads are redacted before persistence.
- Logs and audit events record references and field presence, not account
  numbers or secret values.
- Documents should be delivered with short-lived signed URLs and tenant-scoped
  authorization at issuance time.

## Auditability

Privileged mutations record actor, tenant, action, target, timestamp, and
non-sensitive context. Audit records cover approvals, funding, provider
operations, credential administration, risk review, manual intervention, and
finality.

## Deployment controls

- Use `sslmode=verify-full` for PostgreSQL.
- Keep session, MFA, settlement-data, API-pepper, webhook, provider, and
  scheduler secrets independent.
- Run database migrations before routing traffic to a new release.
- Restrict internal scheduler endpoints with a random secret of at least 32
  characters.
- Monitor authentication failures, provider circuit state, retry exhaustion,
  unsigned webhooks, reconciliation ageing, and unresolved finality reviews.

Independent penetration testing, infrastructure configuration review, backup
evidence, and regulatory/legal review remain deployment-specific controls and
cannot be established by this repository alone.
