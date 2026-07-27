"use client";

import { useState } from "react";
import { FormSelect } from "@/components/ops/form-select";
import { Segmented } from "@/components/ops/segmented";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelperText } from "@/components/ui/helper-text";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

const NO_SETTLEMENT = "_none";

type SettlementOption = { value: string; label: string };

// All operator-recordable sources are independent evidence. provider_claim is
// deliberately NOT offered here: provider claims arrive as provider proof, not
// as reconciliation records, and never count toward finality.
const SOURCES = [
  { value: "bank_statement", label: "Bank statement" },
  { value: "chain_tx", label: "Chain transfer" },
  { value: "psp_report", label: "PSP report" },
  { value: "manual_operator", label: "Manual (operator)" },
];

/** Format a Date as a local YYYY-MM-DD string (for native date inputs / value date). */
function localISODate(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function todayISO(): string {
  return localISODate(new Date());
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localISODate(d);
}

/**
 * Add External Record form.
 *
 * Default flow: operators capture a bank/chain/PSP record without touching a
 * settlement — it is saved as OPEN and reconciled later by the auto-match engine
 * or an explicit operator action. The external reference can be left blank to
 * auto-generate, the value date defaults to today, and linking a settlement is an
 * *opt-in* manual match tucked behind a collapsible section so it is never confused
 * with auto-match.
 */
export function AddRecordForm({
  action,
  settlements,
  compact = false,
}: {
  action: (formData: FormData) => Promise<void>;
  settlements: SettlementOption[];
  compact?: boolean;
}) {
  const [manualSettlementId, setManualSettlementId] = useState(NO_SETTLEMENT);
  const [source, setSource] = useState("bank_statement");
  const [dateMode, setDateMode] = useState<"today" | "yesterday" | "custom">("today");
  const [customDate, setCustomDate] = useState(todayISO());
  const [recordMode, setRecordMode] = useState<"queue" | "manual" | "exception">("queue");
  const isManualMatch =
    recordMode === "manual" &&
    manualSettlementId !== NO_SETTLEMENT &&
    manualSettlementId !== "";

  const valueDate = dateMode === "today" ? todayISO() : dateMode === "yesterday" ? yesterdayISO() : customDate;

  return (
    <form action={action} className={compact ? "grid gap-2.5" : "grid gap-4"}>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="valueDate" value={valueDate} />
      <input type="hidden" name="recordMode" value={recordMode} />

      <div className={cn("grid gap-2", compact ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2")}>
        <div className="grid gap-1.5">
          <Label htmlFor="externalRef">External reference</Label>
          <Input id="externalRef" name="externalRef" placeholder="Bank statement reference" />
          {!compact ? <HelperText>Leave blank to auto-generate.</HelperText> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" type="number" min="1" step="0.01" required />
        </div>
        {compact ? (
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
            <Label>Source</Label>
            <Segmented ariaLabel="Source" options={SOURCES} value={source} onChange={setSource} />
          </div>
        ) : null}
        {compact ? (
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
            <Label>Currency</Label>
            <FormSelect
              name="currency"
              defaultValue="INR"
              options={[
                { value: "INR", label: "INR" },
                { value: "USDT", label: "USDT" },
              ]}
            />
          </div>
        ) : null}
      </div>

      {!compact ? (
        <div className="grid gap-1.5">
          <Label>Source</Label>
          <Segmented ariaLabel="Source" options={SOURCES} value={source} onChange={setSource} />
        </div>
      ) : null}

      <div className={cn("grid gap-2", compact ? "sm:grid-cols-2" : "md:grid-cols-2")}>
        {!compact ? (
          <div className="grid gap-1.5">
            <Label>Currency</Label>
            <FormSelect
              name="currency"
              defaultValue="INR"
              options={[
                { value: "INR", label: "INR" },
                { value: "USDT", label: "USDT" },
              ]}
            />
          </div>
        ) : null}
        <div className={cn("grid gap-1.5", compact && "sm:col-span-2")}>
          <Label>Value date</Label>
          <Segmented
            ariaLabel="Value date"
            options={[
              { value: "today", label: "Today" },
              { value: "yesterday", label: "Yesterday" },
              { value: "custom", label: "Custom" },
            ]}
            value={dateMode}
            onChange={(next) => setDateMode(next as typeof dateMode)}
          />
          {dateMode === "custom" ? (
            <Input
              type="date"
              aria-label="Custom value date"
              value={customDate}
              onChange={(event) => setCustomDate(event.target.value)}
              className="mt-1"
            />
          ) : null}
        </div>
      </div>

      <div className={cn("grid gap-2 rounded-lg border border-[var(--ops-line)] bg-slate-50/60", compact ? "p-2.5" : "p-3")}>
        <div className="grid gap-1.5">
          <Label>Record handling</Label>
          <Segmented
            ariaLabel="Record handling"
            options={[
              { value: "queue", label: "Add to queue" },
              { value: "manual", label: "Manual match" },
              { value: "exception", label: "Flag exception" },
            ]}
            value={recordMode}
            onChange={(next) => setRecordMode(next as typeof recordMode)}
          />
        </div>

        {recordMode === "queue" ? (
          <p className="text-xs text-slate-500">
            The record stays unlinked until an exact auto-match or an explicit operator decision.
          </p>
        ) : null}

        {recordMode === "manual" ? (
          <div className="reconciliation-form-reveal grid gap-1.5">
            <Label>Eligible SETTLED settlement</Label>
            <FormSelect
              name="settlementId"
              defaultValue={NO_SETTLEMENT}
              onValueChange={setManualSettlementId}
              options={[{ value: NO_SETTLEMENT, label: "Select a settlement" }, ...settlements]}
            />
            <p className="text-xs text-slate-500">
              The server verifies amount and currency before linking. Mismatched records are rejected.
            </p>
            {isManualMatch ? (
              <p className="reconciliation-manual-hint-pop text-xs font-medium text-[#0a7d86]">
                This creates an attributed manual match and moves the settlement to RECONCILED.
              </p>
            ) : null}
          </div>
        ) : null}

        {recordMode === "exception" ? (
          <div className="reconciliation-form-reveal grid gap-1.5">
            <Label htmlFor="exceptionReason">Exception reason</Label>
            <Input
              id="exceptionReason"
              name="exceptionReason"
              required
              minLength={6}
              placeholder="Describe the discrepancy and required investigation"
            />
            <p className="text-xs text-slate-500">
              Exceptions are never linked automatically and remain visible until an operator records a resolution.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center">
        <SubmitButton type="submit" variant="primary" size={compact ? "sm" : "default"} pendingText="Saving...">
          {recordMode === "manual"
            ? "Confirm manual match"
            : recordMode === "exception"
              ? "Flag exception"
              : "Add to matching queue"}
        </SubmitButton>
      </div>
    </form>
  );
}
