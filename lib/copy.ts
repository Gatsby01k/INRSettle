// Phase 0 — copy as code.
//
// The strings below have exactly one home. Rules:
//
// 1. THESIS appears in the product exactly twice: the landing page and the
//    settlement report footer. Never on working screens.
// 2. NO_FUNDS_DISCLAIMER appears at most once per surface, and only where a
//    reader could plausibly believe INRSettle moves money (report, accounts,
//    provider pages). Repetition reads as anxiety, not confidence.
// 3. Never use "immutable" — the audit trail is append-only and
//    organization-scoped; claim exactly that (AUDIT_CLAIM) until a
//    cryptographic verification story ships.
// 4. Status vocabulary comes from STATUS_LANGUAGE. Do not invent synonyms
//    ("corroborated", "attested", "proven") for states that already have
//    names.

export const THESIS = "Payment completed ≠ settlement finalized.";

export const NO_FUNDS_DISCLAIMER =
  "INRSettle does not move, custody, or provide funds. Providers move money; INRSettle records and verifies settlement.";

export const AUDIT_CLAIM = "Append-only, organization-scoped audit trail.";

export const REPORT_FOOTNOTE =
  "Finality requires provider proof, independent reconciliation and a recorded approval. A provider “completed” status alone never finalizes a settlement.";

/** Canonical names for the product's core states — the only vocabulary. */
export const STATUS_LANGUAGE = {
  proofRecorded: "Provider proof recorded",
  proofMissing: "Provider proof missing",
  reconMatched: "Reconciliation matched",
  reconPending: "Reconciliation pending",
  approvalRequired: "Approval required before execution",
  finalityPending: "Finality review pending",
  finalized: "Settlement finalized",
  integrationVerified: "Integration verified",
  commercialReview: "Commercial review pending",
  kybPending: "KYB pending",
  productionOnboarding: "Production onboarding required",
  evidenceMissing: "Evidence missing",
} as const;
