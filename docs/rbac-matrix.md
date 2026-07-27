# RBAC matrix

The enforcement sources are `lib/permissions.ts`,
`lib/settlement-actions.ts`, server actions under `app/(dashboard)`, and
`lib/__tests__/permissions.test.ts`.

All operational data access is organization-scoped. Membership determines
which organization a user can access; roles determine which actions that user
may perform.

| Capability | Owner | Admin | Treasury manager | Settlement operator | Compliance officer | Finance viewer |
|---|---:|---:|---:|---:|---:|---:|
| View operational workspaces | Yes | Yes | Yes | Yes | Yes | Yes |
| Create quotes and settlements | Yes | Yes | Yes | Yes | No | No |
| Record proof and reconciliation | Yes | Yes | Yes | Yes | No | No |
| Approve another user's settlement | Yes | Yes | Yes | No | No | No |
| Confirm funding for another user's settlement | Yes | Yes | Yes | No | No | No |
| Record finality for another user's settlement | Yes | Yes | Yes | No | No | No |
| Review due diligence and risk | Yes | Yes | No | No | Yes | No |
| Manage providers and credentials | Yes | Yes | No | No | No | No |
| Manage team and organization settings | Yes | Yes | No | No | No | No |
| View evidence, reports, and audit history | Yes | Yes | Yes | Yes | Yes | Yes |

## Dual control

The settlement creator cannot approve their own lifecycle transition, funding
confirmation, or finality decision. This is enforced server-side, not only by
button visibility. When the organization requires MFA for approvals, the
approver must have MFA enabled and a recent step-up assertion.

## Role intent

- **Owner** and **Admin** manage tenant configuration and privileged controls.
- **Treasury manager** is the operational approver for work created by another
  user.
- **Settlement operator** creates and maintains operational records but cannot
  approve them.
- **Compliance officer** reviews due diligence and risk without gaining
  treasury execution permissions.
- **Finance viewer** has read-only access to evidence, reconciliation, reports,
  and audit history.

Role changes, provider credential changes, approvals, funding decisions,
manual interventions, and finality decisions must all leave audit records.
