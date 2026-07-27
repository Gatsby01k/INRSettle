"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeIndianRupee,
  BadgeCheck,
  Building2,
  BookOpen,
  CircleAlert,
  CircleCheckBig,
  ClipboardCheck,
  FileBarChart,
  FileClock,
  LayoutDashboard,
  Network,
  Radio,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  WalletCards,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/quotes": WalletCards,
  "/settlements": Activity,
  "/funding": BadgeIndianRupee,
  "/reconciliation": Scale,
  "/finality": CircleCheckBig,
  "/exceptions": CircleAlert,
  "/counterparties": Building2,
  "/accounts": Wallet,
  "/providers": ShieldCheck,
  "/providers/operations": Network,
  "/kyb": BadgeCheck,
  "/monitoring": Radio,
  "/pilot-readiness": ClipboardCheck,
  "/risk-review": ShieldAlert,
  "/reports": FileBarChart,
  "/audit-logs": FileClock,
  "/team": Users,
  "/api-reference": BookOpen,
  "/settings": Settings,
};

// Phase 1 IA — seven destinations, one flat list (source: lib/ops NAV_GROUPS).
// Former pages are tabs inside Settlements / Providers / Settings.
import { NAV_GROUPS } from "@/lib/ops";

const groups = NAV_GROUPS;

/** Sub-routes that should highlight a parent nav item. */
const NAV_ALIAS: Record<string, string> = {
  "/quotes": "/settlements",
  "/funding": "/settlements",
  "/finality": "/settlements",
  "/exceptions": "/settlements",
  "/reports": "/settlements",
  "/audit-logs": "/risk-review",
  "/counterparties": "/providers",
  "/providers/operations": "/providers",
  "/providers/health": "/providers",
  "/providers/routing": "/providers",
  "/providers/capabilities": "/providers",
  "/providers/webhooks": "/providers",
  "/providers/logs": "/providers",
  "/providers/credentials": "/providers",
  "/providers/performance": "/providers",
  "/kyb": "/risk-review",
  "/monitoring": "/providers",
  "/pilot-readiness": "/risk-review",
  "/team": "/settings",
  "/accounts": "/settings",
  "/api-reference": "/settings",
};

/**
 * Shared rail contents — reused by the fixed desktop sidebar and the mobile
 * navigation drawer so both stay perfectly in sync.
 */
export function SidebarContent({
  organizationName,
  onNavigate,
}: {
  organizationName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const allItems = groups.flatMap((group) => group.items);

  return (
    <div className="ops-rail relative flex h-full flex-col text-white">
      <div className="flex h-14 items-center gap-3 border-b border-white/8 px-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.07] ring-1 ring-white/10">
          <Image src="/assets/mark.png" alt="" width={20} height={20} className="rounded" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">INRSettle</p>
          <p className="truncate text-[11px] text-white/55">{organizationName}</p>
        </div>
      </div>

      <nav className="ops-scroll flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Primary">
        {groups.map((group) => (
          <div key={group.label}>
            {groups.length > 1 ? (
              <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
                {group.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const aliased = NAV_ALIAS[pathname] ?? pathname;
                const hasMoreSpecificMatch = allItems.some(
                  (candidate) =>
                    candidate.href !== item.href &&
                    candidate.href.startsWith(`${item.href}/`) &&
                    (pathname === candidate.href || pathname.startsWith(`${candidate.href}/`)),
                );
                const active =
                  aliased === item.href ||
                  pathname === item.href ||
                  (pathname.startsWith(`${item.href}/`) && !hasMoreSpecificMatch);
                const Icon = ICONS[item.href] ?? LayoutDashboard;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex min-h-9 items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
                      active
                        ? "bg-white/[0.08] text-white"
                        : "text-white/58 hover:bg-white/[0.045] hover:text-white/90",
                    )}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[#62d9c0]" />
                    ) : null}
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        active ? "text-[#62d9c0]" : "text-white/40 group-hover:text-white/65",
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

    </div>
  );
}

export function SidebarNav({ organizationName }: { organizationName: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
      <SidebarContent organizationName={organizationName} />
    </aside>
  );
}
