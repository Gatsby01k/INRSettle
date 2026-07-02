import { cn } from "@/lib/utils";

type BadgeTone = "default" | "success" | "warning" | "danger" | "neutral" | "info";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  dot?: boolean;
};

// Phase 0: all status colors resolve through the semantic tokens in
// globals.css (--status-*). This file is the ONLY place chip colors live.
const TONES: Record<BadgeTone, string> = {
  default: "bg-[var(--status-neutral-bg)] text-slate-700 ring-1 ring-inset ring-[var(--status-neutral-line)]",
  success: "bg-[var(--status-ok-bg)] text-[var(--status-ok)] ring-1 ring-inset ring-[var(--status-ok-line)]",
  warning: "bg-[var(--status-pending-bg)] text-[var(--status-pending)] ring-1 ring-inset ring-[var(--status-pending-line)]",
  danger: "bg-[var(--status-blocked-bg)] text-[var(--status-blocked)] ring-1 ring-inset ring-[var(--status-blocked-line)]",
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral)] ring-1 ring-inset ring-[var(--status-neutral-line)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)] ring-1 ring-inset ring-[var(--status-info-line)]",
};

const DOTS: Record<BadgeTone, string> = {
  default: "bg-[var(--status-neutral)]",
  success: "bg-[var(--status-ok)]",
  warning: "bg-[var(--status-pending)]",
  danger: "bg-[var(--status-blocked)]",
  neutral: "bg-[var(--status-neutral)]",
  info: "bg-[var(--status-info)]",
};

export function Badge({ className, tone = "default", dot = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight tabular-nums",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOTS[tone])} /> : null}
      {children}
    </span>
  );
}
