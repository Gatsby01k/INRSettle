"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption = { value: string; label: string; count?: number };

/**
 * Compact segmented control — preferred over a dropdown when there are only a
 * handful of options. Renders as an accessible radio-style group.
 */
export function Segmented({
  options,
  value,
  onChange,
  ariaLabel,
  size = "default",
  className,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-wrap items-center gap-0.5 rounded-md bg-slate-100 p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-[5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald/30",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active
                ? "bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  active ? "bg-brand-emerald/15 text-brand-emerald-ink" : "bg-slate-200/80 text-slate-500",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
