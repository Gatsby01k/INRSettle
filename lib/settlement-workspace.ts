export type WorkspaceStageState = "complete" | "current" | "upcoming" | "blocked";

export type WorkspaceStage = {
  key:
    | "draft"
    | "internal_review"
    | "quote_locked"
    | "approval"
    | "funding_requested"
    | "funding_available"
    | "provider_accepted"
    | "executing"
    | "proof_received"
    | "reconciliation"
    | "finality_review"
    | "completed";
  label: string;
  owner: string;
  requirement: string;
};

export const WORKSPACE_STAGES: WorkspaceStage[] = [
  {
    key: "draft",
    label: "Draft",
    owner: "Settlement initiator",
    requirement: "Commercial terms and account instructions recorded",
  },
  {
    key: "internal_review",
    label: "Internal Review",
    owner: "Settlement operations",
    requirement: "Record is complete and ready for controlled processing",
  },
  {
    key: "quote_locked",
    label: "Quote Locked",
    owner: "Treasury operations",
    requirement: "Rate, fee, amount and validity are bound to the settlement",
  },
  {
    key: "approval",
    label: "Approval",
    owner: "Authorized approver",
    requirement: "MFA and separation-of-duties checks pass",
  },
  {
    key: "funding_requested",
    label: "Funding Requested",
    owner: "Treasury controller",
    requirement: "Provider funding requirement is acknowledged",
  },
  {
    key: "funding_available",
    label: "Funding Available",
    owner: "Treasury controller",
    requirement: "Required amount is confirmed before execution",
  },
  {
    key: "provider_accepted",
    label: "Provider Accepted",
    owner: "Provider operations",
    requirement: "Selected provider accepts an idempotent execution request",
  },
  {
    key: "executing",
    label: "Executing",
    owner: "Provider operations",
    requirement: "External execution is tracked to a terminal provider state",
  },
  {
    key: "proof_received",
    label: "Provider Proof Received",
    owner: "Evidence operations",
    requirement: "Provider reference and proof are retained with provenance",
  },
  {
    key: "reconciliation",
    label: "Independent Reconciliation",
    owner: "Reconciliation analyst",
    requirement: "A bank or PSP record independently matches the settlement",
  },
  {
    key: "finality_review",
    label: "Finality Review",
    owner: "Authorized approver",
    requirement: "Approval, proof, reconciliation and guardrails agree",
  },
  {
    key: "completed",
    label: "Completed",
    owner: "No active owner",
    requirement: "Finality decision and authorized completion are recorded",
  },
];

export type SettlementWorkflowInput = {
  status: string;
  quoteLocked: boolean;
  approved: boolean;
  fundingStatus: string;
  providerAccepted: boolean;
  proofReceived: boolean;
  reconciliationMatched: boolean;
  reconciliationException?: string | null;
  finalityReady: boolean;
  finalityApproved: boolean;
  failureReason?: string | null;
  providerException?: string | null;
  finalityBlockers?: string[];
};

export type SettlementWorkflow = {
  stages: (WorkspaceStage & { state: WorkspaceStageState; evidence: string })[];
  currentIndex: number;
  currentStage: WorkspaceStage;
  currentOwner: string;
  nextAction: string;
  nextActionHref: string;
  blockers: string[];
  complete: boolean;
};

function normalise(value: string) {
  return value.toUpperCase();
}

export function deriveSettlementWorkflow(
  input: SettlementWorkflowInput,
  settlementId: string,
): SettlementWorkflow {
  const status = normalise(input.status);
  const funding = normalise(input.fundingStatus);
  const isTerminalFailure = ["FAILED", "CANCELLED", "ON_HOLD"].includes(status);
  const fundingRequired = funding !== "NOT_REQUIRED";
  const fundingRequested = ["REQUESTED", "ACKNOWLEDGED", "PARTIALLY_FUNDED", "FUNDED"].includes(funding);
  const fundingAvailable = funding === "FUNDED" || funding === "NOT_REQUIRED";
  const fundingBlocked = ["FAILED", "CANCELLED"].includes(funding);
  const executionFinished = ["SETTLED", "RECONCILED"].includes(status);

  let currentIndex = 3;
  if (!input.approved && !["APPROVED", "EXECUTING", "SETTLED", "RECONCILED"].includes(status)) {
    currentIndex = 3;
  } else if (!fundingAvailable) {
    currentIndex = fundingRequested ? 5 : 4;
  } else if (!input.providerAccepted && status === "APPROVED") {
    currentIndex = 6;
  } else if (!executionFinished) {
    currentIndex = 7;
  } else if (!input.proofReceived) {
    currentIndex = 8;
  } else if (!input.reconciliationMatched) {
    currentIndex = 9;
  } else if (!input.finalityReady || !input.finalityApproved) {
    currentIndex = 10;
  } else {
    currentIndex = 11;
  }

  const blockers = [
    input.failureReason,
    fundingBlocked ? `Funding is ${funding.toLowerCase().replaceAll("_", " ")}.` : null,
    input.providerException,
    input.reconciliationException,
    ...(currentIndex >= 10 ? (input.finalityBlockers ?? []) : []),
  ].filter((value): value is string => Boolean(value));

  const complete = currentIndex === 11 && input.finalityReady && input.finalityApproved;
  const blocked =
    isTerminalFailure ||
    fundingBlocked ||
    Boolean(input.providerException) ||
    Boolean(input.reconciliationException) ||
    (currentIndex === 10 && (input.finalityBlockers?.length ?? 0) > 0);

  const evidenceByKey: Record<WorkspaceStage["key"], string> = {
    draft: "Settlement record created",
    internal_review: "Operating record established",
    quote_locked: input.quoteLocked ? "Accepted quote linked" : "Quote evidence unavailable",
    approval: input.approved ? "Approval recorded" : "Approval pending",
    funding_requested: fundingRequired
      ? fundingRequested
        ? "Funding request recorded"
        : "Funding request pending"
      : "Provider funding not required",
    funding_available: fundingRequired
      ? fundingAvailable
        ? "Funding confirmed"
        : "Funding not yet confirmed"
      : "Provider funding not required",
    provider_accepted: input.providerAccepted ? "Provider acceptance recorded" : "Provider submission pending",
    executing: executionFinished ? "Provider execution completed" : "Provider execution in progress",
    proof_received: input.proofReceived ? "Provider proof retained" : "Provider proof pending",
    reconciliation: input.reconciliationMatched ? "Independent record matched" : "Independent match pending",
    finality_review: input.finalityApproved
      ? "Finality approval recorded"
      : input.finalityReady
        ? "Evidence ready for authorized review"
        : "Finality requirements pending",
    completed: complete ? "Authorized completion recorded" : "Completion pending",
  };

  const stages = WORKSPACE_STAGES.map((stage, index) => ({
    ...stage,
    evidence: evidenceByKey[stage.key],
    state: (
      complete
        ? "complete"
        : index < currentIndex
          ? "complete"
          : index === currentIndex
            ? blocked
              ? "blocked"
              : "current"
            : "upcoming"
    ) as WorkspaceStageState,
  }));

  let nextAction = "Review settlement activity";
  let nextActionHref = `#activity`;
  if (complete) {
    nextAction = "Open the final settlement report";
    nextActionHref = `/settlements/${settlementId}/report`;
  } else if (currentIndex === 3) {
    nextAction = "Complete approval with an authorized second operator";
    nextActionHref = "#next-action";
  } else if (currentIndex === 4 || currentIndex === 5) {
    nextAction = fundingRequired ? "Confirm the funding position" : "Continue to provider submission";
    nextActionHref = `/settlements/${settlementId}/funding`;
  } else if (currentIndex === 6) {
    nextAction = "Select an activated provider and submit execution";
    nextActionHref = "#next-action";
  } else if (currentIndex === 7) {
    nextAction = "Check provider status and monitor execution";
    nextActionHref = "#provider";
  } else if (currentIndex === 8) {
    nextAction = "Collect and verify provider proof";
    nextActionHref = "#evidence";
  } else if (currentIndex === 9) {
    nextAction = input.reconciliationException
      ? "Resolve the independent reconciliation exception"
      : "Match an independent bank or PSP record";
    nextActionHref = "/reconciliation";
  } else if (currentIndex === 10) {
    nextAction = input.finalityReady
      ? "Record authorized finality approval"
      : "Resolve finality blockers and review evidence";
    nextActionHref = `/settlements/${settlementId}/controls`;
  }

  const currentStage = WORKSPACE_STAGES[currentIndex];
  return {
    stages,
    currentIndex,
    currentStage,
    currentOwner: currentStage.owner,
    nextAction,
    nextActionHref,
    blockers,
    complete,
  };
}
