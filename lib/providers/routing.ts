import type { ProviderCapability } from "@/lib/providers/contracts";

export type ProviderCircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type ProviderOperationSignal = {
  status: string;
  createdAt: Date;
};

export type ProviderCircuitPolicy = {
  failureThreshold: number;
  cooldownMs: number;
};

export type ProviderRouteCandidate = {
  code: string;
  displayName: string;
  configured: boolean;
  capabilities: readonly ProviderCapability[];
};

export type ProviderRouteConnection = {
  providerCode: string;
  status: string;
  credentialsRef: string | null;
};

export type ProviderRouteEvaluation = {
  code: string;
  displayName: string;
  eligible: boolean;
  score: number;
  reasons: string[];
  circuit: ProviderCircuitState;
};

const DEFAULT_CIRCUIT_POLICY: ProviderCircuitPolicy = {
  failureThreshold: 3,
  cooldownMs: 15 * 60 * 1000,
};

const ROUTABLE_CONNECTION_STATES = new Set(["INTEGRATION_VERIFIED", "COMMERCIAL_READY"]);
const FAILURE_STATES = new Set(["FAILED", "REVIEW_REQUIRED"]);
const SUCCESS_STATES = new Set(["SUCCEEDED", "RESOLVED_BY_STATUS", "RESOLVED_NO_EFFECT"]);

/**
 * Derives connector availability from persisted operation outcomes.
 *
 * A circuit opens after consecutive failures or uncertain outcomes. It moves
 * to HALF_OPEN only after the cooldown so an operator-controlled health probe
 * can test the connector. This function never retries a settlement operation.
 */
export function deriveProviderCircuit(
  operations: readonly ProviderOperationSignal[],
  now: Date,
  policy: ProviderCircuitPolicy = DEFAULT_CIRCUIT_POLICY,
): ProviderCircuitState {
  const ordered = [...operations].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (!ordered.length || SUCCESS_STATES.has(ordered[0].status)) return "CLOSED";

  let consecutiveFailures = 0;
  for (const operation of ordered) {
    if (FAILURE_STATES.has(operation.status)) {
      consecutiveFailures += 1;
      continue;
    }
    break;
  }

  if (consecutiveFailures < policy.failureThreshold) return "CLOSED";
  const cooldownElapsed = now.getTime() - ordered[0].createdAt.getTime() >= policy.cooldownMs;
  return cooldownElapsed ? "HALF_OPEN" : "OPEN";
}

/**
 * Evaluates routes before any external side effect exists. Once an execution
 * operation has been created, provider fallback is forbidden until an
 * operator resolves the original provider outcome.
 */
export function evaluateProviderRoutes(input: {
  candidates: readonly ProviderRouteCandidate[];
  connections: readonly ProviderRouteConnection[];
  requiredCapabilities: readonly ProviderCapability[];
  preferredOrder?: readonly string[];
  circuits?: Readonly<Record<string, ProviderCircuitState>>;
  operationStarted?: boolean;
}): {
  selected: ProviderRouteEvaluation | null;
  evaluations: ProviderRouteEvaluation[];
  fallbackPermitted: boolean;
} {
  const preferredOrder = input.preferredOrder ?? [];
  const connections = new Map(input.connections.map((connection) => [connection.providerCode, connection]));
  const evaluations = input.candidates
    .map((candidate): ProviderRouteEvaluation => {
      const reasons: string[] = [];
      const connection = connections.get(candidate.code);
      const circuit = input.circuits?.[candidate.code] ?? "CLOSED";
      const missing = input.requiredCapabilities.filter(
        (capability) => !candidate.capabilities.includes(capability),
      );

      if (!candidate.configured) reasons.push("Connector deployment configuration is incomplete.");
      if (!connection) reasons.push("No tenant connection is registered.");
      if (connection && !ROUTABLE_CONNECTION_STATES.has(connection.status)) {
        reasons.push("Tenant connection has not passed activation review.");
      }
      if (missing.length) reasons.push(`Missing capabilities: ${missing.join(", ")}.`);
      if (circuit === "OPEN") reasons.push("Circuit is open after repeated provider failures.");
      if (circuit === "HALF_OPEN") reasons.push("Circuit requires an operator-controlled health probe.");
      if (input.operationStarted) reasons.push("A provider operation already exists; automatic fallback is blocked.");

      const preferredIndex = preferredOrder.indexOf(candidate.code);
      const score =
        (preferredIndex === -1 ? 0 : 1000 - preferredIndex * 100) +
        candidate.capabilities.length * 10 +
        (connection?.credentialsRef ? 5 : 0);
      const eligible =
        reasons.length === 0 &&
        circuit === "CLOSED" &&
        !input.operationStarted;

      return {
        code: candidate.code,
        displayName: candidate.displayName,
        eligible,
        score,
        reasons,
        circuit,
      };
    })
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));

  return {
    selected: evaluations.find((candidate) => candidate.eligible) ?? null,
    evaluations,
    fallbackPermitted: !input.operationStarted,
  };
}
