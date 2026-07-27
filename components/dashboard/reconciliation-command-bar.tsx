"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Plus, ScanSearch } from "lucide-react";
import { cn } from "@/lib/utils";

type ReconciliationCommandBarProps = {
  addRecordForm: ReactNode;
  autoMatchForm: ReactNode;
};

export function ReconciliationCommandBar({
  addRecordForm,
  autoMatchForm,
}: ReconciliationCommandBarProps) {
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="ops-panel reconciliation-commandbar overflow-hidden">
      <div className="reconciliation-commandbar__head">
        <div>
          <strong>Evidence intake and exact matching</strong>
          <small>Add independent records first. Automatic matching runs only for one unique 100% candidate.</small>
        </div>
        <div className="reconciliation-commandbar__actions">
          <button
            type="button"
            onClick={() => setComposerOpen((open) => !open)}
            aria-expanded={composerOpen}
            className={cn("reconciliation-commandbar__add", composerOpen && "is-open")}
          >
            <Plus aria-hidden="true" />
            Add external record
            <ChevronDown className={cn(composerOpen && "rotate-180")} aria-hidden="true" />
          </button>
          <span className="reconciliation-commandbar__divider" aria-hidden="true" />
          <ScanSearch aria-hidden="true" />
          {autoMatchForm}
        </div>
      </div>

      {composerOpen ? (
        <div className="reconciliation-commandbar__composer">
          {addRecordForm}
        </div>
      ) : null}
    </div>
  );
}
