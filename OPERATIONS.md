# INRSettle Operations Notes

## Operating Model

INRSettle should be operated as a B2B settlement-operations control and evidence platform for verified PSPs, merchants, payment operators, and treasury teams. It is not a PSP, exchange, payout provider, liquidity network or custodian.

## Client Onboarding

Recommended onboarding sequence:

1. Access request submitted.
2. Business profile reviewed.
3. KYB documentation collected.
4. Corridor and use case assessed.
5. Settlement limits and workflows approved.
6. Dashboard access provisioned; service API access is not available until service authentication is implemented.
7. Test settlement lifecycle completed.
8. Production access enabled.

## Settlement Lifecycle

1. Time-boxed quote created.
2. Settlement created and approved under dual control.
3. Funding marked not required or tracked through to funded.
4. External provider execution is requested through an explicitly selected connector, or a shadow operation is recorded manually.
5. Provider claim/proof is captured; it does not establish finality by itself.
6. Independent bank/PSP evidence is reconciled.
7. Finality review and evidence report are generated.

### Uncertain provider execution

- `REVIEW_REQUIRED` means the provider may have received the request; never submit it again automatically.
- First use **Sync provider status** on `/providers`. This creates a separate status-check operation and closes the original only when the settlement reaches a final provider-derived state.
- **Confirm no side effect** is allowed only for a different approver with a fresh MFA step-up, an exact attestation phrase, a substantive external-verification note, and no provider reference. It atomically resolves the operation and moves the settlement to `FAILED`; it never resets or retries it.
- Queue/DLQ automation and a durable Pontis gateway callback outbox are still required before production.

## Support Model

Recommended channels:

- Dedicated business support email
- Incident escalation contact
- Treasury operations channel
- Status page

## Security Requirements

For the production application layer, implement:

- MFA
- RBAC
- audit logs
- signed webhooks
- API key rotation
- encrypted data storage
- client-level permissions
- IP allowlisting for API clients

### MFA operations

- Set `MFA_ENCRYPTION_KEY` to an independently generated base64url 32-byte key.
- Users enroll TOTP under `/settings/security`; the secret is AES-256-GCM encrypted and recovery codes are stored only as keyed hashes.
- Approval, funding confirmation and finality approval require a successful MFA step-up within the previous 10 minutes when organization policy is enabled.
- Five consecutive password/MFA failures lock the account for 15 minutes. A distributed IP/device rate limiter is still required before production exposure.
- Back up and rotate the encryption key through a documented decrypt/re-encrypt procedure; losing it makes enrolled TOTP secrets unrecoverable.

## Compliance Requirements

Before full launch, obtain qualified legal review for:

- India payment exposure
- stablecoin settlement workflows
- AML monitoring obligations
- KYB documentation requirements
- counterparty screening
- sanctions controls
- travel rule applicability where relevant

## Website Maintenance

When adding new pages:

1. Add the page link to navigation or footer.
2. Add the URL to `sitemap.xml`.
3. Ensure no `.svg` references are introduced unless the asset exists.
4. Keep copy institutional and infrastructure-first.
