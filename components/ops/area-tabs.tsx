"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AREA_TABS } from "@/lib/ops";
import { cn } from "@/lib/utils";

/**
 * Phase 1 IA — route-level tabs for merged areas (Settlements, Providers,
 * Settings). Renders the tab strip that binds sibling routes into one
 * area. Active state derives from the current pathname.
 */
export function AreaTabs({ area }: { area: keyof typeof AREA_TABS }) {
  const pathname = usePathname();
  const tabs = AREA_TABS[area];
  if (!tabs) return null;

  return (
    <nav
      aria-label={`${area} sections`}
      className="area-tabs flex h-10 max-w-full items-end gap-5 overflow-x-auto border-b border-[var(--ops-line)]"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex h-10 shrink-0 items-center border-b-2 px-0.5 text-[13px] font-medium transition-colors",
              active
                ? "border-slate-950 text-slate-950"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
