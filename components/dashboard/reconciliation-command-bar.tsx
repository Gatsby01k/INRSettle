"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Plus, Zap } from "lucide-react";
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
    <div className="ops-panel ops-panel-accent overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-[var(--ops-line-soft)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Primary action: capture independent evidence */}
        <button
          type="button"
          onClick={() => setComposerOpen((open) => !open)}
          aria-expanded={composerOpen}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
            composerOpen
              ? "border-brand-emerald/35 bg-brand-emerald/[0.1] text-brand-emerald-ink"
              : "border-brand-emerald/30 bg-brand-emerald/[0.06] text-brand-emerald-ink hover:border-brand-emerald/45 hover:bg-brand-emerald/[0.1]",
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Add external record
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", composerOpen && "rotate-180")} />
        </button>

        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
          <span className="hidden items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400 sm:inline-flex">
            <Zap className="h-3 w-3" />
            Matching
          </span>
          {autoMatchForm}
        </div>
      </div>

      {composerOpen ? (
        <div className="border-b border-[var(--ops-line-soft)] bg-slate-50/40 px-3 py-3">
          <p className="mb-2.5 text-xs text-slate-500">
            Capture a bank, chain, or PSP record — independent evidence only. Saved as OPEN, then reconciled
            via auto-match or a manual link.
          </p>
          {addRecordForm}
        </div>
      ) : null}
    </div>
  );
}
