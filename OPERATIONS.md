# INRSettle operations

INRSettle is a Settlement Operations Platform. It records and controls the
workflow around settlement; integrated providers execute settlement and, where
contracted, supply liquidity. INRSettle does not custody funds, provide
liquidity, or become the system of record for a bank balance.

## Lifecycle

1. A time-bound quote records the commercial inputs.
2. An operator creates a settlement request.
3. A different authorized user approves the request.
4. Funding status is recorded against the designated settlement account.
5. Encrypted execution instructions are released only to the selected provider.
6. The provider accepts and executes the instruction.
7. Provider proof is captured as evidence, not treated as finality.
8. Independent bank or PSP evidence is reconciled.
9. An authorized reviewer records the finality decision.
10. The completed record and append-only audit history remain available for
    review and export.

Exceptions never disappear into the normal queue. They are surfaced in the
Exception Center and retain their provider references, evidence, attempts, and
operator decisions.

## Provider execution safety

- Every request has a stable idempotency key.
- Provider capabilities and corridor support are checked before an operation is
  created.
- Credentials remain server-side and connector-specific.
- Submitted execution operations are never retried automatically because the
  provider may already have acted.
- Failed status checks are retried with bounded exponential backoff by
  `/api/internal/provider-retries`.
- Recent connector failures open a circuit and stop new execution requests.
- `REVIEW_REQUIRED` means the provider may have received the request. An
  operator must check provider status or use the controlled no-side-effect
  attestation workflow; it must not be resubmitted as a new instruction.
- Webhook signatures are verified before payload processing. Stored payloads
  are redacted before persistence.

Configure the scheduler with a random `CRON_SECRET` of at least 32 characters.
The included `vercel.json` invokes the retry worker every two minutes.

## Deployment

Required release sequence:

```text
npm ci
npx prisma generate
npm run typecheck
npm run lint
npm test
npm run build
npx prisma migrate deploy
```

Deploy migrations before sending traffic to a release that reads new columns.
`prisma migrate status` must report that the database schema is current.

Generate independent secrets for session signing, MFA encryption, settlement
instruction encryption, API credential hashing, and the retry scheduler. Do not
reuse one value across these controls. Production PostgreSQL connections must
use certificate verification (`sslmode=verify-full`).

## Access and approvals

- Membership establishes tenant access; every operational query is scoped by
  `organizationId`.
- RBAC controls actions within the tenant.
- Creation and approval are separated. A settlement creator cannot approve
  lifecycle, funding, or finality for the same settlement.
- Organizations can require recent MFA step-up for approval and funding
  actions.
- Privileged mutations create audit events with actor, organization, target,
  time, and non-sensitive context.

See `docs/rbac-matrix.md` and `docs/security-controls.md`.

## Incident response

For a provider timeout or ambiguous response:

1. Stop new execution requests for the affected connector.
2. Preserve the original operation and idempotency key.
3. Poll status through the existing provider reference.
4. Compare provider evidence with independent bank evidence.
5. Escalate unresolved operations through Manual Intervention.
6. Record the decision and supporting evidence in the audit trail.

Never “fix” an uncertain operation by creating a replacement request. See
`docs/incident-handling-playbook.md` for ownership and evidence requirements.

## External production prerequisites

Code readiness does not replace partner and organizational controls. Before
real client settlement operations, each deployment still requires:

- executed provider and data-processing agreements;
- provider production credentials and documented corridor capabilities;
- approved client due diligence and operating limits;
- named incident contacts and reconciliation cut-off times;
- tested backup, restore, key rotation, and incident procedures;
- qualified legal, regulatory, and independent security review.
