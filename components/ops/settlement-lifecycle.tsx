import {
  Check,
  Circle,
  Clock3,
  Pause,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "REQUESTED", label: "Request" },
  { key: "APPROVED", label: "Approval" },
  { key: "EXECUTING", label: "Provider" },
  { key: "SETTLED", label: "Evidence" },
  { key: "RECONCILED", label: "Finality" },
] as const;

const INDEX_BY_STATUS: Record<string, number> = {
  REQUESTED: 0,
  QUOTED: 0,
  PENDING_APPROVAL: 1,
  APPROVED: 1,
  EXECUTING: 2,
  SETTLED: 3,
  RECONCILED: 4,
  ON_HOLD: 1,
  FAILED: 2,
  CANCELLED: 0,
};

type VisualState = "complete" | "active" | "waiting" | "blocked" | "paused";

const ICON_BY_STATE: Record<VisualState, LucideIcon> = {
  complete: Check,
  active: Clock3,
  waiting: Circle,
  blocked: X,
  paused: Pause,
};

function stateFor(status: string, index: number, current: number): VisualState {
  const normalized = status.toUpperCase();
  if (normalized === "FAILED" && index === current) return "blocked";
  if (normalized === "CANCELLED" && index === current) return "blocked";
  if (normalized === "ON_HOLD" && index === current) return "paused";
  if (normalized === "RECONCILED" && index <= current) return "complete";
  if (index < current) return "complete";
  if (index === current) return "active";
  return "waiting";
}

export function SettlementLifecycle({
  status,
  compact = false,
  spotlight = false,
}: {
  status: string;
  compact?: boolean;
  spotlight?: boolean;
  proofRail?: boolean;
}) {
  const normalized = status.toUpperCase();
  const current = INDEX_BY_STATUS[normalized] ?? 0;
  const exceptional = ["FAILED", "CANCELLED", "ON_HOLD"].includes(normalized);

  return (
    <div
      className={cn("ops-lifecycle", compact && "ops-lifecycle--compact", spotlight && "ops-lifecycle--spotlight")}
      aria-label={`Settlement lifecycle. Current status: ${normalized.replaceAll("_", " ")}`}
    >
      <ol>
        {STEPS.map((step, index) => {
          const state = stateFor(normalized, index, current);
          const Icon = ICON_BY_STATE[state];
          const isCurrent = index === current;
          return (
            <li key={step.key} className={`is-${state}`} aria-current={isCurrent ? "step" : undefined}>
              <span className="ops-lifecycle__rail" aria-hidden="true" />
              <span className="ops-lifecycle__marker" aria-hidden="true">
                <Icon />
              </span>
              {!compact ? (
                <span className="ops-lifecycle__copy">
                  <strong>{step.label}</strong>
                  {isCurrent ? (
                    <small>
                      {state === "blocked"
                        ? "Exception"
                        : state === "paused"
                          ? "On hold"
                          : normalized === "RECONCILED"
                            ? "Complete"
                            : "Current"}
                    </small>
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {exceptional ? (
        <span className="sr-only">
          {normalized === "ON_HOLD" ? "Workflow is paused and requires attention." : "Workflow is blocked and requires intervention."}
        </span>
      ) : null}
    </div>
  );
}
