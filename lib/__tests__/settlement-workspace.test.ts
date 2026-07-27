import { describe, expect, it } from "vitest";
import { deriveSettlementWorkflow } from "@/lib/settlement-workspace";

const base = {
  status: "REQUESTED",
  quoteLocked: true,
  approved: false,
  fundingStatus: "NOT_REQUIRED",
  providerAccepted: false,
  proofReceived: false,
  reconciliationMatched: false,
  finalityReady: false,
  finalityApproved: false,
};

describe("settlement workspace lifecycle", () => {
  it("starts an accepted settlement record at approval", () => {
    const workflow = deriveSettlementWorkflow(base, "set_1");

    expect(workflow.currentStage.label).toBe("Approval");
    expect(workflow.currentOwner).toBe("Authorized approver");
    expect(workflow.stages.slice(0, 3).every((stage) => stage.state === "complete")).toBe(true);
    expect(workflow.stages[3].state).toBe("current");
  });

  it("stops at funding available until the requirement is confirmed", () => {
    const workflow = deriveSettlementWorkflow(
      {
        ...base,
        status: "APPROVED",
        approved: true,
        fundingStatus: "ACKNOWLEDGED",
      },
      "set_2",
    );

    expect(workflow.currentStage.label).toBe("Funding Available");
    expect(workflow.nextActionHref).toBe("/settlements/set_2/funding");
  });

  it("keeps provider completion separate from proof and reconciliation", () => {
    const workflow = deriveSettlementWorkflow(
      {
        ...base,
        status: "SETTLED",
        approved: true,
        providerAccepted: true,
      },
      "set_3",
    );

    expect(workflow.currentStage.label).toBe("Provider Proof Received");
    expect(workflow.complete).toBe(false);
  });

  it("requires both finality readiness and finality approval for completion", () => {
    const awaitingApproval = deriveSettlementWorkflow(
      {
        ...base,
        status: "RECONCILED",
        approved: true,
        providerAccepted: true,
        proofReceived: true,
        reconciliationMatched: true,
        finalityReady: true,
      },
      "set_4",
    );
    const completed = deriveSettlementWorkflow(
      {
        ...base,
        status: "RECONCILED",
        approved: true,
        providerAccepted: true,
        proofReceived: true,
        reconciliationMatched: true,
        finalityReady: true,
        finalityApproved: true,
      },
      "set_4",
    );

    expect(awaitingApproval.currentStage.label).toBe("Finality Review");
    expect(awaitingApproval.complete).toBe(false);
    expect(completed.currentStage.label).toBe("Completed");
    expect(completed.complete).toBe(true);
    expect(completed.stages.every((stage) => stage.state === "complete")).toBe(true);
  });

  it("surfaces the first evidence contradiction as a blocker", () => {
    const workflow = deriveSettlementWorkflow(
      {
        ...base,
        status: "SETTLED",
        approved: true,
        providerAccepted: true,
        proofReceived: true,
        reconciliationException: "Amount differs from the bank record.",
      },
      "set_5",
    );

    expect(workflow.currentStage.label).toBe("Independent Reconciliation");
    expect(workflow.stages[9].state).toBe("blocked");
    expect(workflow.blockers[0]).toBe("Amount differs from the bank record.");
  });
});
