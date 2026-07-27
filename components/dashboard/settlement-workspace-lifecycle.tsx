import { Check, Clock3, LockKeyhole, X } from "lucide-react";
import type { SettlementWorkflow } from "@/lib/settlement-workspace";
import { cn } from "@/lib/utils";

export function SettlementWorkspaceLifecycle({ workflow }: { workflow: SettlementWorkflow }) {
  return (
    <div className="workspace-lifecycle" aria-label="Settlement lifecycle">
      <ol>
        {workflow.stages.map((stage, index) => {
          const Icon =
            stage.state === "complete"
              ? Check
              : stage.state === "blocked"
                ? X
                : stage.state === "current"
                  ? Clock3
                  : LockKeyhole;
          return (
            <li
              key={stage.key}
              className={cn(`is-${stage.state}`, index === workflow.currentIndex && "is-active")}
              aria-current={index === workflow.currentIndex ? "step" : undefined}
            >
              <span className="workspace-lifecycle__connector" aria-hidden="true" />
              <span className="workspace-lifecycle__node" aria-hidden="true">
                <Icon />
              </span>
              <span className="workspace-lifecycle__copy">
                <small>{String(index + 1).padStart(2, "0")}</small>
                <strong>{stage.label}</strong>
                <span>{stage.evidence}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="workspace-lifecycle__active">
        <div>
          <span>Current owner</span>
          <strong>{workflow.currentOwner}</strong>
        </div>
        <div>
          <span>Stage requirement</span>
          <strong>{workflow.currentStage.requirement}</strong>
        </div>
      </div>
    </div>
  );
}
