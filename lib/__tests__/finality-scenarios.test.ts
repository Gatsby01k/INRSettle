import { describe, expect, it } from "vitest";
import { assessFinality } from "../finality";
import { buildFinalityInput } from "../finality-input";

// Regression scenarios for the three operational finality outcomes: complete
// evidence, missing independent reconciliation, and contradictory evidence.

const approvedEvents = [
  { toStatus: "APPROVED" },
  { toStatus: "EXECUTING" },
  { toStatus: "SETTLED" },
];

describe("complete settlement evidence", () => {
  it("proof completed + independent bank match + approval -> ready_to_finalize", () => {
    const result = assessFinality(
      buildFinalityInput(
        {
          publicId: "SET-20260727-001",
          status: "RECONCILED",
          sourceCurrency: "USDT",
          targetCurrency: "INR",
          sourceAmount: "10000.00",
          targetAmount: "831500.000000",
          approvedAt: new Date("2026-06-11T08:00:00Z"),
        },
        [
          {
            provider: "PontisGlobe",
            providerStatus: "completed",
            providerTransactionId: "pt_71084921",
            utr: "UTR270726184901",
            actualAmount: "831500.00",
            currency: "INR",
            receivedVia: "WEBHOOK",
            receivedAt: new Date("2026-06-11T10:00:00Z"),
          },
        ],
        [
          {
            status: "MATCHED",
            externalRef: "BANK-RECON-20260727-001",
            source: "bank_statement",
            amount: "831500.00",
            currency: "INR",
          },
        ],
        [...approvedEvents, { toStatus: "RECONCILED" }],
      ),
    );

    expect(result.decision).toBe("ready_to_finalize");
    expect(result.riskLevel).toBe("low");
    expect(result.confidence).toBe(100);
  });
});

describe("missing independent reconciliation", () => {
  it("proof completed but no reconciliation linked -> needs_review", () => {
    const result = assessFinality(
      buildFinalityInput(
        {
          publicId: "SET-20260727-003",
          status: "SETTLED",
          sourceCurrency: "USDT",
          targetCurrency: "INR",
          sourceAmount: "5000.00",
          targetAmount: "415750.000000",
          approvedAt: new Date("2026-06-11T07:00:00Z"),
        },
        [
          {
            provider: "remitquickly",
            providerStatus: "success",
            providerTransactionId: "88003",
            utr: "UTR270726184903",
            actualAmount: "415750.00",
            currency: "INR",
            receivedVia: "WEBHOOK",
            receivedAt: new Date("2026-06-11T08:00:00Z"),
          },
        ],
        [],
        approvedEvents,
      ),
    );

    expect(result.decision).toBe("needs_review");
    expect(result.blockingIssues.join(" ")).toMatch(/No reconciliation record/);
  });
});

describe("contradictory settlement evidence", () => {
  it("proof without UTR + UNMATCHED bank record with amount mismatch -> needs_review, high risk", () => {
    const result = assessFinality(
      buildFinalityInput(
        {
          publicId: "SET-20260727-004",
          status: "SETTLED",
          sourceCurrency: "USDT",
          targetCurrency: "INR",
          sourceAmount: "3000.00",
          targetAmount: "249450.000000",
          approvedAt: new Date("2026-06-11T05:00:00Z"),
        },
        [
          {
            provider: "remitquickly",
            providerStatus: "success",
            providerTransactionId: "88004",
            utr: null,
            actualAmount: "249450.00",
            currency: "INR",
            receivedVia: "POLL",
            receivedAt: new Date("2026-06-11T06:00:00Z"),
          },
        ],
        [
          {
            status: "UNMATCHED",
            externalRef: "BANK-RECON-20260727-004",
            source: "bank_statement",
            amount: "247950.00",
            currency: "INR",
          },
        ],
        approvedEvents,
      ),
    );

    expect(result.decision).toBe("needs_review");
    expect(result.riskLevel).toBe("high");
    expect(result.blockingIssues.join(" ")).toMatch(/contradicts the provider/);
  });
});
