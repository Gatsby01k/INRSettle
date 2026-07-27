// Live Pilot Readiness engine for CONTROLLED_PILOT settlements (pure, deterministic).
//
// "Live pilot readiness" means INRSettle can safely TRACK AND CONTROL a tiny
// pilot workflow — not freely move money. INRSettle never moves funds unless
// live payouts are explicitly enabled, which nothing in this codebase does;
// finality blocks if that tripwire is ever set.
//
// Every readiness item derives from persisted data + config. No overrides, no
// self-attestation. The final decision:
//   - blocked:      a hard guardrail is violated (caps, provider allowlist,
//                    live-payout tripwire) — cannot proceed regardless of evidence
//   - needs_review: guardrails hold but evidence is incomplete
//   - ready:        all guardrails and all evidence requirements pass

import { isIndependentReconciliationSource } from "@/lib/reconciliation";
import { hasAuditApproval, type EventLike } from "@/lib/finality-input";
import {
  inrLegOf,
  type ShadowConfig,
  type ShadowProofLike,
  type ShadowReconciliationLike,
  type ShadowSettlementLike,
} from "@/lib/shadow-mode";

export type LivePilotDecision = "ready" | "needs_review" | "blocked";

export type LivePilotItem = {
  key: string;
  label: string;
  /** Hard guardrail: a failed `blocking` item forces decision = blocked. */
  blocking: boolean;
  done: boolean;
  detail: string;
};

export type LivePilotFlags = {
  /**
   * Dual-control: user id of the explicit finality approval, or null. Must be
   * present AND differ from the settlement creator.
   */
  finalityApprovedById: string | null;
  /** Settlement creator user id (for the dual-control comparison). */
  createdById: string;
  /** A settlement report was generated for this settlement (audit-evidenced). */
  reportGenerated: boolean;
  /** Today's cumulative CONTROLLED_PILOT INR volume, EXCLUDING this settlement. */
  dailyUsedInrExcludingThis: number;
};

export type LivePilotReadiness = {
  decision: LivePilotDecision;
  items: LivePilotItem[];
  blockedReasons: string[];
  pendingItems: string[];
};

function inr(value: number): string {
  return `INR ${value.toLocaleString("en-IN")}`;
}

export function isProviderAllowedForLiveTest(
  provider: string | null | undefined,
  config: ShadowConfig,
): boolean {
  if (!provider?.trim()) return false;
  return config.controlledPilotAllowedProviders.some(
    (allowed) => allowed.toLowerCase() === provider.trim().toLowerCase(),
  );
}

/** Builds the CONTROLLED_PILOT pilot readiness checklist and final decision. */
export function buildLivePilotReadiness(
  settlement: ShadowSettlementLike,
  proofs: ShadowProofLike[],
  reconciliationRecords: ShadowReconciliationLike[],
  events: EventLike[],
  flags: LivePilotFlags,
  config: ShadowConfig,
  finalityDecision: "ready_to_finalize" | "needs_review" | "not_ready",
): LivePilotReadiness {
  const amount = inrLegOf(settlement);
  const withinCap = amount > 0 && amount <= config.controlledPilotMaxInr;
  const dailyTotal = flags.dailyUsedInrExcludingThis + amount;
  const withinDailyCap = dailyTotal <= config.controlledPilotDailyMaxInr;
  const providerAllowed = isProviderAllowedForLiveTest(settlement.provider, config);
  const approvalRecorded = hasAuditApproval(settlement, events);
  const proofRecorded = proofs.length > 0;
  const independentMatched = reconciliationRecords.some(
    (record) => record.status === "MATCHED" && isIndependentReconciliationSource(record.source),
  );
  const dualControlOk = Boolean(
    flags.finalityApprovedById && flags.finalityApprovedById !== flags.createdById,
  );

  const items: LivePilotItem[] = [
    {
      key: "execution_boundary",
      label: "External provider execution boundary",
      blocking: true,
      done: true,
      detail: "INRSettle controls and records the operation; the integrated provider performs execution.",
    },
    {
      key: "amount_cap",
      label: `Per-settlement cap (${inr(config.controlledPilotMaxInr)})`,
      blocking: true,
      done: withinCap,
      detail:
        amount <= 0
          ? "The settlement must carry a positive INR leg."
          : withinCap
            ? `INR leg ${amount.toLocaleString("en-IN")} is within the cap.`
            : `INR leg ${amount.toLocaleString("en-IN")} EXCEEDS the cap — reduce the test amount.`,
    },
    {
      key: "daily_cap",
      label: `Daily pilot cap (${inr(config.controlledPilotDailyMaxInr)})`,
      blocking: true,
      done: withinDailyCap,
      detail: withinDailyCap
        ? `Today's CONTROLLED_PILOT volume including this settlement: ${inr(dailyTotal)}.`
        : `Today's CONTROLLED_PILOT volume would reach ${inr(dailyTotal)} — over the daily cap. Wait for the next day.`,
    },
    {
      key: "provider_allowed",
      label: "Provider on the pilot allowlist",
      blocking: true,
      done: providerAllowed,
      detail: providerAllowed
        ? `${settlement.provider} is allowed for controlled-pilot operations.`
        : settlement.provider?.trim()
          ? `${settlement.provider} is not on the allowlist (${config.controlledPilotAllowedProviders.join(", ")}).`
          : "No provider assigned — assign one from the pilot allowlist.",
    },
    {
      key: "operator_approval",
      label: "Operator approval recorded",
      blocking: false,
      done: approvalRecorded,
      detail: approvalRecorded
        ? "Approval timestamp and APPROVED lifecycle event are on file."
        : "Approve the settlement through the normal workflow (audit-logged).",
    },
    {
      key: "dual_control",
      label: "Finality approved by a second operator",
      blocking: false,
      done: dualControlOk,
      detail: dualControlOk
        ? "Explicit finality approval recorded by a user other than the settlement creator."
        : flags.finalityApprovedById
          ? "Finality approval exists but was made by the settlement creator — a DIFFERENT operator must approve."
          : "No explicit finality approval recorded yet (Settlement controls → Approve finality).",
    },
    {
      key: "provider_proof",
      label: "Provider proof recorded",
      blocking: false,
      done: proofRecorded,
      detail: proofRecorded
        ? `${proofs.length} proof record(s) on file.`
        : "Record provider proof (webhook, poll, or manual entry).",
    },
    {
      key: "independent_recon",
      label: "Independent reconciliation matched",
      blocking: false,
      done: independentMatched,
      detail: independentMatched
        ? "A MATCHED independent-source record is linked. Provider claims never count."
        : "Link and match an independent record (bank statement / PSP report / operator).",
    },
    {
      key: "finality_review",
      label: "Finality review passes",
      blocking: false,
      done: finalityDecision === "ready_to_finalize",
      detail:
        finalityDecision === "ready_to_finalize"
          ? "Deterministic finality review: ready to finalize."
          : `Deterministic finality review currently says: ${finalityDecision.replaceAll("_", " ")}.`,
    },
    {
      key: "settlement_report",
      label: "Settlement report generated",
      blocking: false,
      done: flags.reportGenerated,
      detail: flags.reportGenerated
        ? "A settlement report was generated and recorded in the audit trail."
        : "Open the settlement report before finalization (recorded automatically).",
    },
  ];

  const blockedReasons = items
    .filter((item) => item.blocking && !item.done)
    .map((item) => item.detail);
  const pendingItems = items
    .filter((item) => !item.blocking && !item.done)
    .map((item) => item.label);

  const decision: LivePilotDecision =
    blockedReasons.length > 0 ? "blocked" : pendingItems.length > 0 ? "needs_review" : "ready";

  return { decision, items, blockedReasons, pendingItems };
}
