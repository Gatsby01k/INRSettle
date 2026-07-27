// Operating posture controls: caps, safety checks, and the readiness checklist for
// PROVIDER_OBSERVED / CONTROLLED_PILOT settlements.
//
// Core principle: INRSettle NEVER moves funds directly. In PROVIDER_OBSERVED and
// CONTROLLED_PILOT modes a partner/provider moves money externally while INRSettle
// records and controls the operational layer (quote → settlement → provider
// proof → independent reconciliation → audit trail → finality → report).
//
// Everything here is deterministic and takes config/data as parameters so it
// can be unit-tested; only `getShadowConfig` reads the environment.

import { isIndependentReconciliationSource } from "@/lib/reconciliation";
import { hasAuditApproval, type EventLike, type NumberLike } from "@/lib/finality-input";
import type { FinalitySafetyInput } from "@/lib/finality";

export type SettlementMode = "EVIDENCE_ONLY" | "PROVIDER_OBSERVED" | "CONTROLLED_PILOT";

export const SETTLEMENT_MODES: SettlementMode[] = ["EVIDENCE_ONLY", "PROVIDER_OBSERVED", "CONTROLLED_PILOT"];

export const MODE_LABEL: Record<SettlementMode, string> = {
  EVIDENCE_ONLY: "Evidence-only",
  PROVIDER_OBSERVED: "Provider-observed",
  CONTROLLED_PILOT: "Controlled pilot",
};

export const MODE_DESCRIPTION: Record<SettlementMode, string> = {
  EVIDENCE_ONLY: "Evidence review without an automated provider instruction.",
  PROVIDER_OBSERVED: "External provider activity is observed, evidenced and reconciled.",
  CONTROLLED_PILOT: "Provider submission is constrained by explicit limits and approvals.",
};

export type ShadowConfig = {
  /** Maximum INR leg for a CONTROLLED_PILOT settlement (tighter than shadow). */
  controlledPilotMaxInr: number;
  /** Maximum cumulative CONTROLLED_PILOT INR volume per calendar day. */
  controlledPilotDailyMaxInr: number;
  /** Providers allowed to participate in CONTROLLED_PILOT pilots. */
  controlledPilotAllowedProviders: string[];
  /** Manual proof entry is available when provider evidence arrives out of band. */
  requireManualProof: boolean;
  /** Independent reconciliation is required for finality. */
  requireIndependentReconciliation: boolean;
};

export const DEFAULT_SHADOW_CONFIG: ShadowConfig = {
  controlledPilotMaxInr: 1_000,
  controlledPilotDailyMaxInr: 2_000,
  controlledPilotAllowedProviders: ["remitquickly", "PontisGlobe"],
  requireManualProof: true,
  requireIndependentReconciliation: true,
};

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Reads operating guardrails from the environment with conservative defaults. */
export function getShadowConfig(): ShadowConfig {
  const allowedRaw = process.env.CONTROLLED_PILOT_ALLOWED_PROVIDERS?.trim();
  return {
    controlledPilotMaxInr: envNumber(
      "CONTROLLED_PILOT_MAX_INR",
      DEFAULT_SHADOW_CONFIG.controlledPilotMaxInr,
    ),
    controlledPilotDailyMaxInr: envNumber(
      "CONTROLLED_PILOT_DAILY_MAX_INR",
      DEFAULT_SHADOW_CONFIG.controlledPilotDailyMaxInr,
    ),
    controlledPilotAllowedProviders: allowedRaw
      ? allowedRaw.split(",").map((value) => value.trim()).filter(Boolean)
      : DEFAULT_SHADOW_CONFIG.controlledPilotAllowedProviders,
    requireManualProof: true,
    requireIndependentReconciliation: true,
  };
}

// --- Settlement shapes (framework-free) ------------------------------------------

export type ShadowSettlementLike = {
  publicId: string;
  status: string;
  testMode?: string | null;
  provider?: string | null;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: NumberLike;
  targetAmount: NumberLike;
  sourceAccount?: string | null;
  targetAccount?: string | null;
  approvedAt?: Date | string | null;
};

export type ShadowProofLike = { receivedVia: string };
export type ShadowReconciliationLike = { status: string; source: string };

function toNumber(value: NumberLike): number {
  return typeof value === "number" ? value : Number(value.toString());
}

/** The INR leg of a settlement — the amount the safety caps apply to. */
export function inrLegOf(settlement: ShadowSettlementLike): number {
  if (settlement.sourceCurrency === "INR") return toNumber(settlement.sourceAmount);
  if (settlement.targetCurrency === "INR") return toNumber(settlement.targetAmount);
  return 0;
}

/** The applicable cap for an operating posture. */
export function modeCap(mode: string | null | undefined, config: ShadowConfig): number | null {
  if (mode === "CONTROLLED_PILOT") return config.controlledPilotMaxInr;
  return null;
}

export function isWithinCap(settlement: ShadowSettlementLike, config: ShadowConfig): boolean {
  const cap = modeCap(settlement.testMode, config);
  if (cap === null) return true;
  return inrLegOf(settlement) <= cap;
}

/** The safety block passed into the finality engine for PROVIDER_OBSERVED/CONTROLLED_PILOT settlements. */
export function safetyFor(settlement: ShadowSettlementLike, config: ShadowConfig): FinalitySafetyInput {
  const cap = modeCap(settlement.testMode, config);
  return {
    withinCap: isWithinCap(settlement, config),
    capLabel: cap !== null ? `INR ${cap.toLocaleString("en-IN")}` : "uncapped",
    executionBoundaryConfirmed: true,
  };
}

// --- Readiness checklist -----------------------------------------------------------

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  detail: string;
};

/**
 * The finality readiness checklist. Every item is derived deterministically
 * from persisted data + config — nothing is self-attested without evidence.
 */
export function buildShadowChecklist(
  settlement: ShadowSettlementLike,
  proofs: ShadowProofLike[],
  reconciliationRecords: ShadowReconciliationLike[],
  events: EventLike[],
  config: ShadowConfig,
): ChecklistItem[] {
  const inrLeg = inrLegOf(settlement);
  const cap = modeCap(settlement.testMode, config);
  const independentLinked = reconciliationRecords.some((record) =>
    isIndependentReconciliationSource(record.source),
  );

  return [
    {
      key: "provider_selected",
      label: "Provider selected",
      done: Boolean(settlement.provider?.trim()),
      detail: settlement.provider?.trim()
        ? `Provider: ${settlement.provider}`
        : "Assign the partner/provider that moves the money externally.",
    },
    {
      key: "proof_capture",
      label: "Provider proof captured",
      done: proofs.length > 0,
      detail:
        proofs.length > 0
          ? `${proofs.length} proof record(s) on file (manual entry available).`
          : "Record at least one provider proof — manual entry is available on this console.",
    },
    {
      key: "beneficiary_verified",
      label: "Beneficiary details recorded",
      done: Boolean(settlement.targetAccount && settlement.targetAccount.trim().length >= 3),
      detail: settlement.targetAccount?.trim()
        ? "Target account is present. Verify the restricted identifier against provider records before execution."
        : "Record the beneficiary/target account.",
    },
    {
      key: "expected_inr",
      label: "Expected INR amount entered",
      done: inrLeg > 0,
      detail:
        inrLeg > 0
          ? `Expected INR leg: ${inrLeg.toLocaleString("en-IN")}${cap !== null ? ` (cap ${cap.toLocaleString("en-IN")})` : ""}.`
          : "The settlement must carry a positive INR leg.",
    },
    {
      key: "operator_approval",
      label: "Operator approval recorded",
      done: hasAuditApproval(settlement, events),
      detail: hasAuditApproval(settlement, events)
        ? "Approval timestamp and APPROVED lifecycle event are both on file."
        : "Approve the settlement through the normal workflow (audit-logged).",
    },
    {
      key: "independent_recon",
      label: "Independent reconciliation source linked",
      done: independentLinked,
      detail: independentLinked
        ? "An independent-source record (bank statement / PSP report / operator) is linked."
        : "Link an independent record on the Reconciliation page — provider claims never count.",
    },
    {
      key: "execution_boundary",
      label: "External execution boundary",
      done: true,
      detail: "The integrated provider performs execution; INRSettle records workflow and evidence.",
    },
    {
      key: "finality_report",
      label: "Finality report enabled",
      done: true,
      detail: "Deterministic finality review and the settlement report are available for this settlement.",
    },
  ];
}

export function checklistComplete(items: ChecklistItem[]): boolean {
  return items.every((item) => item.done);
}

// --- Mode transitions ---------------------------------------------------------------

export function isSettlementMode(value: string): value is SettlementMode {
  return (SETTLEMENT_MODES as string[]).includes(value);
}

/**
 * CONTROLLED_PILOT entry is gated by HARD GUARDRAILS only — checks that must hold
 * BEFORE the external provider execution: caps,
 * beneficiary on file, operator approval, and (when known) an allowlisted
 * provider.
 *
 * Post-execution EVIDENCE (provider proof, independent reconciliation,
 * settlement report, second approval) deliberately does NOT gate entry: it is
 * produced after the partner moves money, and it is strictly enforced where it
 * belongs — finality review (lib/finality.ts) and live-pilot readiness
 * (lib/live-pilot.ts). Splitting these lets the pilot enter CONTROLLED_PILOT first so
 * caps and the allowlist bind during the actual money movement.
 */
const LIVE_TEST_ENTRY_CHECKLIST_KEYS = ["beneficiary_verified", "operator_approval"] as const;

/**
 * Guard for switching a settlement's mode. Returns the list of violations
 * (empty when allowed). There is deliberately no override path for any
 * guardrail violation.
 */
export function modeChangeViolations(
  settlement: ShadowSettlementLike,
  newMode: SettlementMode,
  checklist: ChecklistItem[],
  config: ShadowConfig,
  options: {
    /** Today's CONTROLLED_PILOT INR volume excluding this settlement (daily cap check). */
    dailyUsedInrExcludingThis?: number;
  } = {},
): string[] {
  const violations: string[] = [];

  if (newMode === "EVIDENCE_ONLY") return violations;

  const cap = newMode === "CONTROLLED_PILOT" ? config.controlledPilotMaxInr : null;
  const inrLeg = inrLegOf(settlement);
  if (inrLeg <= 0) {
    violations.push("The settlement has no positive INR leg.");
  } else if (cap !== null && inrLeg > cap) {
    violations.push(
      `INR leg ${inrLeg.toLocaleString("en-IN")} exceeds the ${MODE_LABEL[newMode]} cap of ${cap.toLocaleString("en-IN")}.`,
    );
  }

  if (newMode === "CONTROLLED_PILOT") {
    // Daily cap (when today's usage is supplied by the caller).
    if (options.dailyUsedInrExcludingThis !== undefined && inrLeg > 0) {
      const dailyTotal = options.dailyUsedInrExcludingThis + inrLeg;
      if (dailyTotal > config.controlledPilotDailyMaxInr) {
        violations.push(
          `Daily controlled-pilot cap exceeded: today's volume would reach INR ${dailyTotal.toLocaleString("en-IN")} of ${config.controlledPilotDailyMaxInr.toLocaleString("en-IN")}.`,
        );
      }
    }

    // Provider allowlist — enforced when a provider is already assigned.
    // (The provider is often assigned at execution; live-pilot readiness
    // re-checks it as a blocking guardrail after execution.)
    const provider = settlement.provider?.trim();
    if (provider && !config.controlledPilotAllowedProviders.some((a) => a.toLowerCase() === provider.toLowerCase())) {
      violations.push(
        `${provider} is not on the controlled-pilot provider allowlist (${config.controlledPilotAllowedProviders.join(", ")}).`,
      );
    }

    // Pre-execution entry requirements only — never proof/reconciliation/report.
    for (const key of LIVE_TEST_ENTRY_CHECKLIST_KEYS) {
      const item = checklist.find((entry) => entry.key === key);
      if (item && !item.done) {
        violations.push(`Entry requirement: ${item.label}.`);
      }
    }
  }

  return violations;
}
