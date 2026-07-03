import { cn } from "@/lib/utils";

/**
 * Phase 3 — lightweight server-rendered trend graphics.
 * No chart library: pure SVG, semantic status colors, ~1KB per chart.
 * Line for continuous series, bars for counts. Exactly four of these
 * exist on Home; resist adding more.
 */

const TONE_STROKE: Record<string, string> = {
  ok: "var(--status-ok)",
  info: "var(--status-info)",
  pending: "var(--status-pending)",
  blocked: "var(--status-blocked)",
  neutral: "var(--status-neutral)",
};

export function Sparkline({
  values,
  tone = "info",
  type = "line",
  width = 240,
  height = 44,
  className,
}: {
  values: number[];
  tone?: keyof typeof TONE_STROKE;
  type?: "line" | "bars";
  width?: number;
  height?: number;
  className?: string;
}) {
  const stroke = TONE_STROKE[tone];
  const n = values.length;
  if (n === 0) return null;

  const max = Math.max(...values, 1);
  const pad = 2;
  const innerH = height - pad * 2;

  if (type === "bars") {
    const gap = 2;
    const barW = Math.max(1.5, (width - gap * (n - 1)) / n);
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        className={cn("block", className)}
        aria-hidden="true"
      >
        {values.map((v, i) => {
          const h = v <= 0 ? 1.5 : Math.max(2, (v / max) * innerH);
          return (
            <rect
              key={i}
              x={i * (barW + gap)}
              y={height - pad - h}
              width={barW}
              height={h}
              rx={1}
              fill={v > 0 ? stroke : "rgba(7,17,31,0.12)"}
              opacity={v > 0 ? 0.85 : 1}
            />
          );
        })}
      </svg>
    );
  }

  const step = width / Math.max(1, n - 1);
  const y = (v: number) => height - pad - (v / max) * innerH;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`);
  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={cn("block", className)}
      aria-hidden="true"
    >
      <path d={areaPath} fill={stroke} opacity={0.08} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={y(values[n - 1])} r={2.5} fill={stroke} />
    </svg>
  );
}

export function TrendCard({
  label,
  value,
  delta,
  hint,
  children,
}: {
  label: string;
  value: string;
  /** Comparison vs the prior window. `direction` colors it: "up" good, "down" bad, null neutral. */
  delta?: { text: string; direction: "up" | "down" | null } | null;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ops-panel ops-card-hover p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-xl font-semibold tabular-nums tracking-tight text-slate-950">{value}</p>
        {delta ? (
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              delta.direction === "up" && "text-[var(--status-ok)]",
              delta.direction === "down" && "text-[var(--status-blocked)]",
              delta.direction === null && "text-slate-400",
            )}
          >
            {delta.text}
          </span>
        ) : null}
      </div>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}
