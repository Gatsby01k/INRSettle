"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileClock,
  Landmark,
  Link2,
  Scale,
  ShieldCheck,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ops/empty-state";
import { FormSelect } from "@/components/ops/form-select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { MATCH_TONE, type MatchType } from "@/lib/reconciliation";
import { cn } from "@/lib/utils";

type Comparison = {
  settlementAmount: number | null;
  currencyMatch: boolean;
  amountMatch: boolean;
  valueDateMatch: boolean;
  confidence: number;
};

export type ReconciliationCandidate = {
  settlementId: string;
  publicId: string;
  reference: string;
  confidence: number;
  reason: string;
  amount: string | null;
  valueDate: string;
  comparison: Comparison;
};

export type ReconciliationRow = {
  id: string;
  externalRef: string;
  source: string;
  sourceLabel: string;
  independent: boolean;
  amount: string;
  currency: string;
  status: string;
  matchType: MatchType;
  matchLabel: string;
  matchReason: string | null;
  confidence: number;
  exceptionReason: string | null;
  resolutionNote: string | null;
  age: string;
  createdAtMs: number;
  valueDate: string;
  settlement: {
    id: string;
    publicId: string;
    reference: string;
    amount: string | null;
    valueDate: string;
    comparison: Comparison | null;
  } | null;
  suggestion: ReconciliationCandidate | null;
  manualCandidates: ReconciliationCandidate[];
};

type WorkspaceProps = {
  records: ReconciliationRow[];
  confirmAction?: (formData: FormData) => Promise<void>;
  rejectAction?: (formData: FormData) => Promise<void>;
  resolveAction?: (formData: FormData) => Promise<void>;
  embedded?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

const QUEUE_ACCENT: Record<MatchType, string> = {
  AUTO_MATCHED: "reconciliation-queue-accent-success",
  MANUAL_MATCHED: "reconciliation-queue-accent-success",
  SUGGESTED: "reconciliation-queue-accent-info",
  MANUAL_REVIEW: "reconciliation-queue-accent-warning",
  EXCEPTION: "reconciliation-queue-accent-danger",
  RESOLVED: "reconciliation-queue-accent-neutral",
};

const DECISION_COPY: Record<
  MatchType,
  { title: string; summary: string; tone: string }
> = {
  AUTO_MATCHED: {
    title: "Independent match recorded",
    summary: "A unique 100% candidate was linked automatically.",
    tone: "is-success",
  },
  MANUAL_MATCHED: {
    title: "Operator match recorded",
    summary: "An operator linked this independent record to the settlement.",
    tone: "is-success",
  },
  SUGGESTED: {
    title: "Operator decision required",
    summary: "A strong candidate exists, but no settlement has been changed.",
    tone: "is-info",
  },
  MANUAL_REVIEW: {
    title: "Manual investigation required",
    summary: "No unique suggestion is safe to present.",
    tone: "is-warning",
  },
  EXCEPTION: {
    title: "Exception blocks reconciliation",
    summary: "Record the investigation outcome before clearing this exception.",
    tone: "is-danger",
  },
  RESOLVED: {
    title: "Exception reviewed",
    summary: "The exception is closed without linking a settlement.",
    tone: "is-neutral",
  },
};

function queueContext(record: ReconciliationRow) {
  if (record.matchType === "EXCEPTION") {
    return `${record.exceptionReason ?? "Investigation required"} · created ${record.age}`;
  }
  if (record.matchType === "RESOLVED") {
    return record.resolutionNote ?? "Reviewed without a settlement link";
  }
  if (record.settlement) {
    return `${record.settlement.publicId} · ${record.settlement.reference}`;
  }
  if (record.suggestion) {
    return `${record.suggestion.publicId} · ${record.suggestion.confidence}% confidence`;
  }
  if (record.manualCandidates.length > 1) {
    return `${record.manualCandidates.length} possible settlements · operator choice required`;
  }
  return `No eligible suggestion · created ${record.age}`;
}

function ConfidenceMeter({ value }: { value: number }) {
  const tone = value >= 100 ? "is-success" : value >= 80 ? "is-info" : "is-warning";
  return (
    <div className={cn("reconciliation-score", tone)}>
      <div>
        <span style={{ width: `${Math.max(4, value)}%` }} />
      </div>
      <strong>{value}%</strong>
    </div>
  );
}

function ComparisonItem({
  label,
  matches,
  detail,
}: {
  label: string;
  matches: boolean;
  detail: string;
}) {
  return (
    <div className={cn("reconciliation-check", matches ? "is-match" : "is-mismatch")}>
      <span>{matches ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}</span>
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function RecordCard({ record }: { record: ReconciliationRow }) {
  return (
    <div className="reconciliation-side-card">
      <div className="reconciliation-side-card__head">
        <span>Independent record</span>
        <Landmark aria-hidden="true" />
      </div>
      <dl>
        <div><dt>Reference</dt><dd className="font-mono">{record.externalRef}</dd></div>
        <div><dt>Source</dt><dd>{record.sourceLabel}</dd></div>
        <div><dt>Amount</dt><dd>{record.amount}</dd></div>
        <div><dt>Value date</dt><dd>{record.valueDate}</dd></div>
      </dl>
      <p className={cn("reconciliation-provenance", record.independent ? "is-independent" : "is-provider")}>
        {record.independent ? "Independent evidence source" : "Provider-originated claim"}
      </p>
    </div>
  );
}

function CandidateCard({
  publicId,
  reference,
  amount,
  valueDate,
  suggested,
}: {
  publicId: string;
  reference: string;
  amount: string | null;
  valueDate: string;
  suggested: boolean;
}) {
  return (
    <div className="reconciliation-side-card">
      <div className="reconciliation-side-card__head">
        <span>{suggested ? "Suggested settlement" : "Linked settlement"}</span>
        <Link2 aria-hidden="true" />
      </div>
      <dl>
        <div><dt>Settlement</dt><dd>{publicId}</dd></div>
        <div><dt>Reference</dt><dd>{reference}</dd></div>
        <div><dt>Comparable amount</dt><dd>{amount ?? "Currency mismatch"}</dd></div>
        <div><dt>Settlement date</dt><dd>{valueDate}</dd></div>
      </dl>
      <p className="reconciliation-provenance is-independent">
        {suggested ? "Candidate only — no state change yet" : "Persisted settlement link"}
      </p>
    </div>
  );
}

function ConsoleFooter({ record }: { record: ReconciliationRow }) {
  return (
    <div className="reconciliation-console-footer">
      {record.settlement ? (
        <Link href={`/settlements/${record.settlement.id}`}>
          <ExternalLink aria-hidden="true" />
          Open settlement workspace
        </Link>
      ) : null}
      <Link href={`/audit-logs?q=${encodeURIComponent(record.settlement?.publicId ?? record.externalRef)}`}>
        <FileClock aria-hidden="true" />
        View audit trail
      </Link>
    </div>
  );
}

export function ReconciliationWorkspace({
  records,
  confirmAction,
  rejectAction,
  resolveAction,
  embedded = false,
  emptyTitle = "No reconciliation records",
  emptyDescription = "Add an independent external record to begin matching.",
}: WorkspaceProps) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "");
  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) ?? records[0],
    [records, selectedId],
  );

  if (!records.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const decision = DECISION_COPY[selected.matchType];
  const candidate = selected.settlement
    ? {
        publicId: selected.settlement.publicId,
        reference: selected.settlement.reference,
        amount: selected.settlement.amount,
        valueDate: selected.settlement.valueDate,
        comparison: selected.settlement.comparison,
        suggested: false,
      }
    : selected.suggestion
      ? {
          publicId: selected.suggestion.publicId,
          reference: selected.suggestion.reference,
          amount: selected.suggestion.amount,
          valueDate: selected.suggestion.valueDate,
          comparison: selected.suggestion.comparison,
          suggested: true,
        }
      : null;
  const comparison = candidate?.comparison ?? null;
  const matched =
    Boolean(selected.settlement) &&
    ["AUTO_MATCHED", "MANUAL_MATCHED"].includes(selected.matchType);
  const finalitySatisfied = matched && selected.independent;

  return (
    <div
      className={cn(
        "reconciliation-workbench",
        embedded ? "reconciliation-console-grid" : "ops-panel min-h-[520px]",
      )}
    >
      <aside className="reconciliation-queue">
        <div className="reconciliation-queue__head">
          <span>External evidence</span>
          <strong>{records.length}</strong>
        </div>
        <ul className="ops-scroll reconciliation-console-scroll">
          {records.map((record) => {
            const active = record.id === selected.id;
            return (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(record.id)}
                  className={cn(
                    "reconciliation-queue-item",
                    QUEUE_ACCENT[record.matchType],
                    active && "reconciliation-queue-item-active",
                  )}
                  aria-pressed={active}
                >
                  <div className="reconciliation-queue-item__top">
                    <span>{record.externalRef}</span>
                    <Badge tone={MATCH_TONE[record.matchType]} dot>{record.matchLabel}</Badge>
                  </div>
                  <div className="reconciliation-queue-item__amount">
                    <span>{record.sourceLabel}</span>
                    <strong>{record.amount}</strong>
                  </div>
                  <p>{queueContext(record)}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section key={selected.id} className="reconciliation-detail-enter reconciliation-decision">
        <div className="ops-scroll reconciliation-console-scroll reconciliation-decision__scroll">
          <header className={cn("reconciliation-decision__header", decision.tone)}>
            <div>
              {selected.matchType === "EXCEPTION" ? (
                <AlertTriangle aria-hidden="true" />
              ) : matched ? (
                <CheckCircle2 aria-hidden="true" />
              ) : (
                <Scale aria-hidden="true" />
              )}
              <span>
                <strong>{decision.title}</strong>
                <small>{decision.summary}</small>
              </span>
            </div>
            <Badge tone={MATCH_TONE[selected.matchType]} dot>{selected.matchLabel}</Badge>
          </header>

          <div className="reconciliation-comparison">
            <RecordCard record={selected} />

            <div className="reconciliation-comparison__decision">
              {candidate && selected.confidence > 0 ? (
                <>
                  <span>Match confidence</span>
                  <ConfidenceMeter value={selected.confidence} />
                  <ArrowRight aria-hidden="true" />
                </>
              ) : (
                <>
                  <CircleDashed aria-hidden="true" />
                  <strong>No unique candidate</strong>
                  <small>Review eligible settlements below</small>
                </>
              )}
            </div>

            {candidate ? (
              <CandidateCard
                publicId={candidate.publicId}
                reference={candidate.reference}
                amount={candidate.amount}
                valueDate={candidate.valueDate}
                suggested={candidate.suggested}
              />
            ) : (
              <div className="reconciliation-side-card is-empty">
                <CircleDashed aria-hidden="true" />
                <strong>No settlement linked</strong>
                <p>
                  {selected.manualCandidates.length
                    ? `${selected.manualCandidates.length} amount-and-currency candidate${selected.manualCandidates.length === 1 ? "" : "s"} require review.`
                    : "No SETTLED settlement matches this record's amount and currency."}
                </p>
              </div>
            )}
          </div>

          {comparison ? (
            <section className="reconciliation-section">
              <div className="reconciliation-section__head">
                <div>
                  <span>Field comparison</span>
                  <small>Persisted values used by the matching decision</small>
                </div>
                {selected.matchReason ? <p>{selected.matchReason}</p> : null}
              </div>
              <div className="reconciliation-checks">
                <ComparisonItem
                  label="Amount"
                  matches={comparison.amountMatch}
                  detail={comparison.amountMatch ? "External and settlement amounts agree" : "Amounts differ"}
                />
                <ComparisonItem
                  label="Currency"
                  matches={comparison.currencyMatch}
                  detail={comparison.currencyMatch ? `${selected.currency} exists on the settlement` : "No comparable currency leg"}
                />
                <ComparisonItem
                  label="Value date"
                  matches={comparison.valueDateMatch}
                  detail={comparison.valueDateMatch ? "Same UTC value date" : "Dates differ; operator review required"}
                />
              </div>
            </section>
          ) : null}

          <section className="reconciliation-section reconciliation-resolution">
            <div className="reconciliation-section__head">
              <div>
                <span>Required decision</span>
                <small>Every mutation is attributed and revalidated on the server</small>
              </div>
            </div>

            {selected.matchType === "SUGGESTED" && selected.suggestion ? (
              <div className="reconciliation-resolution__body">
                <p>
                  Confirm only when the external record and settlement refer to the same movement.
                  Rejecting permanently removes this candidate from the record.
                </p>
                {confirmAction && rejectAction ? (
                  <div className="reconciliation-resolution__actions">
                    <form action={confirmAction}>
                      <input type="hidden" name="recordId" value={selected.id} />
                      <input type="hidden" name="settlementId" value={selected.suggestion.settlementId} />
                      <SubmitButton variant="primary" size="sm" pendingText="Confirming...">
                        <Check aria-hidden="true" />
                        Confirm match
                      </SubmitButton>
                    </form>
                    <form action={rejectAction}>
                      <input type="hidden" name="recordId" value={selected.id} />
                      <input type="hidden" name="settlementId" value={selected.suggestion.settlementId} />
                      <SubmitButton variant="outline" size="sm" pendingText="Rejecting...">
                        <X aria-hidden="true" />
                        Reject suggestion
                      </SubmitButton>
                    </form>
                  </div>
                ) : (
                  <p className="reconciliation-readonly">An operational role is required to decide this match.</p>
                )}
              </div>
            ) : selected.matchType === "MANUAL_REVIEW" ? (
              <div className="reconciliation-resolution__body">
                {selected.manualCandidates.length ? (
                  <>
                    <p>
                      Choose only from settlements whose amount and currency match. Equal-confidence candidates
                      are deliberately never selected automatically.
                    </p>
                    {confirmAction ? (
                      <form action={confirmAction} className="reconciliation-manual-link">
                        <input type="hidden" name="recordId" value={selected.id} />
                        <FormSelect
                          name="settlementId"
                          defaultValue="_none"
                          options={[
                            { value: "_none", label: "Select an eligible settlement" },
                            ...selected.manualCandidates.map((candidate) => ({
                              value: candidate.settlementId,
                              label: `${candidate.publicId} · ${candidate.reference} · ${candidate.confidence}%`,
                            })),
                          ]}
                        />
                        <SubmitButton variant="primary" size="sm" pendingText="Linking...">
                          <Link2 aria-hidden="true" />
                          Link and reconcile
                        </SubmitButton>
                      </form>
                    ) : (
                      <p className="reconciliation-readonly">An operational role is required to link a settlement.</p>
                    )}
                  </>
                ) : (
                  <p>
                    No eligible settlement exists. Keep the record in review, correct the source data, or flag a
                    separate exception record with an investigation reason.
                  </p>
                )}
              </div>
            ) : selected.matchType === "EXCEPTION" ? (
              <div className="reconciliation-resolution__body">
                <div className="reconciliation-exception">
                  <AlertTriangle aria-hidden="true" />
                  <p>{selected.exceptionReason ?? "No exception reason recorded."}</p>
                </div>
                {resolveAction ? (
                  <form action={resolveAction} className="reconciliation-resolve-form">
                    <input type="hidden" name="recordId" value={selected.id} />
                    <label htmlFor={`resolution-${selected.id}`}>Resolution note</label>
                    <Input
                      id={`resolution-${selected.id}`}
                      name="resolutionNote"
                      required
                      minLength={6}
                      placeholder="What was checked and why the exception can be closed"
                    />
                    <SubmitButton variant="primary" size="sm" pendingText="Resolving...">
                      <ShieldCheck aria-hidden="true" />
                      Resolve exception
                    </SubmitButton>
                  </form>
                ) : (
                  <p className="reconciliation-readonly">An operational role is required to resolve this exception.</p>
                )}
              </div>
            ) : selected.matchType === "RESOLVED" ? (
              <div className="reconciliation-resolution__body">
                <p className="reconciliation-resolution-note">
                  <ShieldCheck aria-hidden="true" />
                  {selected.resolutionNote ?? "Marked reviewed by operator."}
                </p>
                <small>No settlement was linked and no finality evidence was created.</small>
              </div>
            ) : (
              <div className="reconciliation-resolution__body">
                <p>
                  The match is persisted. Reopening or relinking requires a separate controlled correction
                  workflow; this record has no pending reconciliation action.
                </p>
              </div>
            )}
          </section>

          <section className={cn("reconciliation-finality", finalitySatisfied ? "is-satisfied" : "is-blocked")}>
            {finalitySatisfied ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
            <div>
              <strong>
                {finalitySatisfied
                  ? "Independent reconciliation pillar satisfied"
                  : "Finality remains blocked by reconciliation"}
              </strong>
              <p>
                {finalitySatisfied
                  ? "Provider proof and approval controls must still agree before finality can be approved."
                  : selected.independent
                    ? "A persisted match to an eligible settlement is still required."
                    : "Provider-originated claims never satisfy independent reconciliation."}
              </p>
            </div>
          </section>
        </div>

        <ConsoleFooter record={selected} />
      </section>
    </div>
  );
}
