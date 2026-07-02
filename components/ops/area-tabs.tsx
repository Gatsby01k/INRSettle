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
      className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--ops-line)] bg-slate-100/80 p-1"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center rounded-md px-3 py-1 text-sm font-medium transition-colors",
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
