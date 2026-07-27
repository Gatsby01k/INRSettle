import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHADOW_CONFIG,
  buildShadowChecklist,
  checklistComplete,
  inrLegOf,
  isWithinCap,
  modeCap,
  modeChangeViolations,
  safetyFor,
  type ShadowSettlementLike,
} from "../shadow-mode";

const config = { ...DEFAULT_SHADOW_CONFIG };

const baseSettlement: ShadowSettlementLike = {
  publicId: "SET-PROVIDER_OBSERVED-1",
  status: "SETTLED",
  testMode: "PROVIDER_OBSERVED",
  provider: "remitquickly",
  sourceCurrency: "USDT",
  targetCurrency: "INR",
  sourceAmount: "100.00",
  targetAmount: "8315.00",
  sourceAccount: "USDT Treasury Wallet",
  targetAccount: "1234567890",
  approvedAt: new Date("2026-06-11T09:00:00Z"),
};

const approvedEvents = [{ toStatus: "APPROVED" }];
const proof = [{ receivedVia: "MANUAL" }];
const independentRecon = [{ status: "MATCHED", source: "bank_statement" }];

describe("caps", () => {
  it("resolves the INR leg from either side of the corridor", () => {
    expect(inrLegOf(baseSettlement)).toBe(8315);
    expect(
      inrLegOf({ ...baseSettlement, sourceCurrency: "INR", targetCurrency: "USDT", sourceAmount: "5000", targetAmount: "60" }),
    ).toBe(5000);
  });

  it("applies the right cap per mode (EVIDENCE_ONLY uncapped)", () => {
    expect(modeCap("EVIDENCE_ONLY", config)).toBeNull();
    expect(modeCap("PROVIDER_OBSERVED", config)).toBeNull();
    expect(modeCap("CONTROLLED_PILOT", config)).toBe(1_000);
  });

  it("checks the cap against the INR leg", () => {
    expect(isWithinCap(baseSettlement, config)).toBe(true); // 8,315 <= 10,000
    expect(isWithinCap({ ...baseSettlement, targetAmount: "10001" }, config)).toBe(true);
    expect(isWithinCap({ ...baseSettlement, testMode: "CONTROLLED_PILOT" }, config)).toBe(false); // 8,315 > 1,000
    expect(isWithinCap({ ...baseSettlement, testMode: "EVIDENCE_ONLY", targetAmount: "9999999" }, config)).toBe(true);
  });

  it("safetyFor reflects the applicable cap and provider execution boundary", () => {
    expect(safetyFor(baseSettlement, config)).toEqual({
      withinCap: true,
      capLabel: "uncapped",
      executionBoundaryConfirmed: true,
    });
  });
});

describe("checklist", () => {
  it("is complete when provider, proof, beneficiary, amount, approval, independent recon are all on file", () => {
    const items = buildShadowChecklist(baseSettlement, proof, independentRecon, approvedEvents, config);
    expect(checklistComplete(items)).toBe(true);
    expect(items).toHaveLength(8);
  });

  it("flags each missing input", () => {
    const items = buildShadowChecklist(
      { ...baseSettlement, provider: null, targetAccount: "", approvedAt: null },
      [],
      [],
      [],
      config,
    );
    const byKey = Object.fromEntries(items.map((item) => [item.key, item.done]));
    expect(byKey.provider_selected).toBe(false);
    expect(byKey.proof_capture).toBe(false);
    expect(byKey.beneficiary_verified).toBe(false);
    expect(byKey.operator_approval).toBe(false);
    expect(byKey.independent_recon).toBe(false);
    expect(byKey.execution_boundary).toBe(true);
    expect(checklistComplete(items)).toBe(false);
  });

  it("a provider_claim record does not satisfy the independent reconciliation item", () => {
    const items = buildShadowChecklist(
      baseSettlement,
      proof,
      [{ status: "MATCHED", source: "provider_claim" }],
      approvedEvents,
      config,
    );
    expect(items.find((item) => item.key === "independent_recon")?.done).toBe(false);
  });

});

describe("mode transitions: CONTROLLED_PILOT entry guardrails (pre-execution)", () => {
  // A pilot-flow settlement BEFORE execution: approved, beneficiary on file,
  // under the CONTROLLED_PILOT cap — but no provider proof and no reconciliation yet.
  const preExecution = { ...baseSettlement, targetAmount: "500.00", provider: null };

  it("allows PROVIDER_OBSERVED within cap with basic data", () => {
    const checklist = buildShadowChecklist(baseSettlement, proof, independentRecon, approvedEvents, config);
    expect(modeChangeViolations(baseSettlement, "PROVIDER_OBSERVED", checklist, config)).toEqual([]);
  });

  it("CONTROLLED_PILOT can be entered BEFORE execution: no proof/reconciliation yet, guardrails pass", () => {
    const checklist = buildShadowChecklist(preExecution, [], [], approvedEvents, config);
    expect(modeChangeViolations(preExecution, "CONTROLLED_PILOT", checklist, config)).toEqual([]);
  });

  it("blocks CONTROLLED_PILOT over the per-settlement cap even with full evidence", () => {
    const checklist = buildShadowChecklist(baseSettlement, proof, independentRecon, approvedEvents, config);
    expect(checklistComplete(checklist)).toBe(true);
    const violations = modeChangeViolations(baseSettlement, "CONTROLLED_PILOT", checklist, config); // 8,315 > 1,000
    expect(violations.join(" ")).toMatch(/exceeds the Controlled pilot cap/);
  });

  it("blocks CONTROLLED_PILOT when the daily cap would be exceeded", () => {
    const checklist = buildShadowChecklist(preExecution, [], [], approvedEvents, config);
    const violations = modeChangeViolations(preExecution, "CONTROLLED_PILOT", checklist, config, {
      dailyUsedInrExcludingThis: 1_800, // 1,800 + 500 > 2,000
    });
    expect(violations.join(" ")).toMatch(/Daily controlled-pilot cap exceeded/);
    expect(
      modeChangeViolations(preExecution, "CONTROLLED_PILOT", checklist, config, { dailyUsedInrExcludingThis: 1_000 }),
    ).toEqual([]);
  });

  it("blocks CONTROLLED_PILOT when an assigned provider is not allowlisted", () => {
    const offList = { ...preExecution, provider: "acme_pay" };
    const checklist = buildShadowChecklist(offList, [], [], approvedEvents, config);
    const violations = modeChangeViolations(offList, "CONTROLLED_PILOT", checklist, config);
    expect(violations.join(" ")).toMatch(/not on the controlled-pilot provider allowlist/);
  });

  it("allowlisted providers pass case-insensitively", () => {
    const listed = { ...preExecution, provider: "PONTISGLOBE" };
    const checklist = buildShadowChecklist(listed, [], [], approvedEvents, config);
    expect(modeChangeViolations(listed, "CONTROLLED_PILOT", checklist, config)).toEqual([]);
  });

  it("blocks CONTROLLED_PILOT when operator approval or beneficiary is missing (entry requirements)", () => {
    const unapproved = { ...preExecution, approvedAt: null };
    let checklist = buildShadowChecklist(unapproved, [], [], [], config);
    expect(modeChangeViolations(unapproved, "CONTROLLED_PILOT", checklist, config).join(" ")).toMatch(
      /Entry requirement: Operator approval/,
    );

    const noBeneficiary = { ...preExecution, targetAccount: "" };
    checklist = buildShadowChecklist(noBeneficiary, [], [], approvedEvents, config);
    expect(modeChangeViolations(noBeneficiary, "CONTROLLED_PILOT", checklist, config).join(" ")).toMatch(
      /Entry requirement: Beneficiary/,
    );
  });

  it("switching back to EVIDENCE_ONLY is always allowed", () => {
    const checklist = buildShadowChecklist(baseSettlement, [], [], [], config);
    expect(modeChangeViolations(baseSettlement, "EVIDENCE_ONLY", checklist, config)).toEqual([]);
  });
});

describe("evidence stays a finality concern (not an entry gate)", () => {
  it("missing proof/reconciliation never appears in CONTROLLED_PILOT entry violations", () => {
    const pre = { ...baseSettlement, targetAmount: "500.00", provider: null };
    const checklist = buildShadowChecklist(pre, [], [], approvedEvents, config);
    const violations = modeChangeViolations(pre, "CONTROLLED_PILOT", checklist, config);
    expect(violations.join(" ")).not.toMatch(/proof|reconciliation|report/i);
  });
});
