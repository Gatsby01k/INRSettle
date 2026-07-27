# INRSettle final product design decisions

## 1. Settlement is the primary operating object

The product now opens every settlement into a dedicated workspace at
`/settlements/[id]`. The former list drawer is no longer the primary place to
operate a case. The list is a queue; the workspace is the product.

**Operator efficiency:** identity, stage, owner, next action, blockers, funding,
provider activity, proof, reconciliation, finality and audit context are
available without reconstructing the case across unrelated pages.

## 2. One visual lifecycle, derived from authoritative evidence

The workspace presents the commercial lifecycle as twelve explicit stages:
Draft, Internal Review, Quote Locked, Approval, Funding Requested, Funding
Available, Provider Accepted, Executing, Provider Proof Received, Independent
Reconciliation, Finality Review and Completed.

The visual stage is derived from persisted settlement status, quote linkage,
funding state, provider operations, provider proof, independent reconciliation
and finality approval. It does not create a second state machine or weaken the
existing domain controls.

**Operator efficiency:** operators can scan progress, understand why a stage is
current, see its evidence and identify the responsible operating role without
reading documentation.

## 3. Current owner and next action are always explicit

The workspace command bar names the current stage, current queue owner, first
blocker and next required action. The action changes with the lifecycle and uses
the existing server-side approval, MFA, dual-control and provider execution
gates.

**Operator efficiency:** the interface answers “who acts next?” before showing
supporting detail, reducing handoff ambiguity and avoidable status meetings.

## 4. The homepage is an Operations Center

The former trend-led homepage is replaced by operational queues: active,
blocked, awaiting approval, awaiting provider, funding required, provider
exceptions, reconciliation, finality and critical alerts. The settlement action
queue is ranked by blockers, lifecycle urgency and age.

**Operator efficiency:** the first viewport is a work surface, not a reporting
surface. Every number links to the work it represents.

## 5. Navigation follows operating responsibilities

Primary navigation is reduced to six destinations: Operations Center,
Settlements, Reconciliation, Provider Network, Controls & Evidence and Platform
Settings. Quotes, funding, finality, exceptions, reports, provider operations
and audit remain available as contextual workflows and secondary tabs.

**Operator efficiency:** the rail communicates how an operator works instead of
exposing the database and implementation module map.

## 6. Evidence remains separated by provenance

Provider proof, provider communications, API operations, independent
reconciliation and audit activity have distinct visual treatments inside the
same workspace. Provider success is never presented as settlement finality.

**Operator efficiency:** operators can compare the provider claim with
independent evidence without losing provenance or mistaking one source for a
final decision.

## 7. Notes and documents live with the operating record

Internal notes are append-only audit events with actor and timestamp. Documents
surface the settlement evidence report, encrypted execution instruction state
and provider proof bundle from the workspace.

**Operator efficiency:** handoff context and evidence packages are discoverable
from the case instead of being kept in external chat threads or personal
bookmarks.

## 8. Desktop and mobile use different information density

Desktop uses a two-column workspace with a persistent evidence/activity rail and
a horizontal twelve-stage lifecycle. Mobile converts the command bar to a
single-action stack, the lifecycle to a vertical stepper, all cards to one
column, and primary navigation to a five-destination bottom dock. Touch targets
remain at least 44 CSS pixels for primary mobile controls.

**Operator efficiency:** mobile prioritizes status, owner, blocker and next
action before dense evidence, while desktop preserves high scanning throughput.

## 9. The public story mirrors the product

The landing page now communicates the same twelve-stage lifecycle used in the
workspace and retains the platform boundary: INRSettle controls the operating
record while integrated providers execute and supply liquidity.

**Operator efficiency and commercial clarity:** buyers see the operating model
they will use after sign-in, so the public narrative and product behavior do not
need to be reconciled during a demonstration.
