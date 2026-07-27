import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Phase 0 — the single page-header pattern for the console.
 * Title row + optional description + optional actions + optional stat strip.
 * Stats are clickable (they apply filters) and replace the decorative
 * `conf-hero` bands as pages migrate. No eyebrow badges, no pulse dots,
 * no thesis copy in working screens.
 */
export type HeaderStat = {
  label: string;
  value: string | number;
  href?: string;
  tone?: "ok" | "pending" | "blocked" | "info" | "neutral";
};

const STAT_TONE: Record<NonNullable<HeaderStat["tone"]>, string> = {
  ok: "text-[var(--status-ok)]",
  pending: "text-[var(--status-pending)]",
  blocked: "text-[var(--status-blocked)]",
  info: "text-[var(--status-info)]",
  neutral: "text-slate-700",
};

function StatCell({ stat }: { stat: HeaderStat }) {
  const body = (
    <span className="flex min-w-max items-baseline gap-2">
      <span
        className={cn(
          "text-[15px] font-semibold leading-none tracking-tight tabular-nums",
          STAT_TONE[stat.tone ?? "neutral"],
        )}
      >
        {stat.value}
      </span>
      <span className="text-xs font-medium text-slate-500">{stat.label}</span>
    </span>
  );

  if (stat.href) {
    return (
      <Link
        href={stat.href}
        className="rounded-md px-2 py-1.5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald/30"
      >
        {body}
      </Link>
    );
  }
  return <span className="px-2 py-1.5">{body}</span>;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  stats,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  stats?: HeaderStat[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <span className="ops-eyebrow mb-3">{eyebrow}</span> : null}
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-slate-950 sm:text-[30px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {stats?.length ? (
        <div className="ops-scroll flex max-w-full items-center gap-1 overflow-x-auto border-y border-[var(--ops-line-soft)] py-1.5">
          {stats.map((stat) => (
            <StatCell key={stat.label} stat={stat} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-[13px] leading-5 text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
