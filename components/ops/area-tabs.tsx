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
      className="area-tabs flex h-10 max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-[var(--ops-line)] bg-slate-100/80 p-1"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              active ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
