import { AlertTriangle, Check, Circle, Clock, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// Canonical tone for every status surfaced across the console — settlement
// lifecycle, reconciliation, quotes, accounts, counterparties, and team.
const TONE_BY_STATUS: Record<string, Tone> = {
  // Completed / healthy
  SETTLED: "success",
  RECONCILED: "success",
  APPROVED: "success",
  MATCHED: "success",
  AUTO_MATCHED: "success",
  MANUAL_MATCHED: "success",
  ACTIVE: "success",
  RESOLVED: "success",
  COMPLETED: "success",
  SUCCEEDED: "success",
  FUNDED: "success",
  INTEGRATION_VERIFIED: "success",
  COMMERCIAL_READY: "success",
  // In-flight / needs attention soon
  EXECUTING: "warning",
  REQUESTED: "warning",
  OPEN: "warning",
  EXPIRED: "warning",
  PARTIALLY_MATCHED: "warning",
  MANUAL_REVIEW: "warning",
  PENDING: "warning",
  IN_FLIGHT: "warning",
  REQUESTED_FUNDING: "warning",
  ACKNOWLEDGED: "warning",
  PARTIALLY_FUNDED: "warning",
  CONFIGURING: "warning",
  REVIEW_REQUIRED: "danger",
  SUSPENDED: "danger",
  DISABLED: "neutral",
  ONBOARDING: "warning",
  // Informational / awaiting a decision
  ACCEPTED: "info",
  QUOTED: "info",
  UNMATCHED: "info",
  SUGGESTED: "info",
  SUGGESTED_MATCH: "info",
  PENDING_APPROVAL: "info",
  // Failures / exceptions
  FAILED: "danger",
  CANCELLED: "danger",
  EXCEPTION: "danger",
  REJECTED: "danger",
};

export function StatusBadge({ status, dot = true }: { status: string; dot?: boolean }) {
  const normalized = status.toUpperCase();
  const tone = TONE_BY_STATUS[normalized] ?? "neutral";
  return (
    <Badge tone={tone} dot={dot}>
      {normalized.replaceAll("_", " ")}
    </Badge>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Phase 0 — canonical status primitives.
   StatusChip: the single general-purpose labeled chip (replaces the
   case-chip / prs-chip families as call sites migrate).
   StateIcon: the single state glyph (replaces text characters "✓ ✕ • !"
   inside check-dot / conf-step__dot / prs-gate-dot).
   ────────────────────────────────────────────────────────────────────── */

export type StatusTone = Tone;

export function StatusChip({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge tone={tone} dot={dot} className={className}>
      {children}
    </Badge>
  );
}

export type StateKind = "ok" | "pending" | "blocked" | "attention" | "idle";

const STATE_ICON: Record<StateKind, LucideIcon> = {
  ok: Check,
  pending: Clock,
  blocked: X,
  attention: AlertTriangle,
  idle: Circle,
};

const STATE_STYLE: Record<StateKind, string> = {
  ok: "bg-[var(--status-ok-bg)] text-[var(--status-ok)] ring-[var(--status-ok-line)]",
  pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending)] ring-[var(--status-pending-line)]",
  blocked: "bg-[var(--status-blocked-bg)] text-[var(--status-blocked)] ring-[var(--status-blocked-line)]",
  attention: "bg-[var(--status-pending-bg)] text-[var(--status-pending)] ring-[var(--status-pending-line)]",
  idle: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral)] ring-[var(--status-neutral-line)]",
};

export function StateIcon({
  state,
  label,
  className,
}: {
  state: StateKind;
  /** Accessible name; defaults to the state itself. */
  label?: string;
  className?: string;
}) {
  const Icon = STATE_ICON[state];
  return (
    <span
      role="img"
      aria-label={label ?? state}
      className={cn(
        "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
        STATE_STYLE[state],
        className,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
    </span>
  );
}
