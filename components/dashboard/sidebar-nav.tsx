"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeCheck,
  Building2,
  BookOpen,
  ClipboardCheck,
  FileBarChart,
  FileClock,
  LayoutDashboard,
  Radio,
  Scale,
  Settings,
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
  "/reconciliation": Scale,
  "/counterparties": Building2,
  "/accounts": Wallet,
  "/providers": ShieldCheck,
  "/kyb": BadgeCheck,
  "/monitoring": Radio,
  "/pilot-readiness": ClipboardCheck,
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
  "/counterparties": "/providers",
  "/kyb": "/providers",
  "/monitoring": "/providers",
  "/pilot-readiness": "/providers",
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

  return (
    <div className="ops-rail relative flex h-full flex-col text-white">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
          <Image src="/assets/mark.png" alt="" width={22} height={22} className="rounded-md" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">INRSettle</p>
          <p className="truncate text-[11px] text-white/55">{organizationName}</p>
        </div>
      </div>

      <nav className="ops-scroll flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Primary">
        {groups.map((group) => (
          <div key={group.label}>
            {groups.length > 1 ? (
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                {group.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const aliased = NAV_ALIAS[pathname] ?? pathname;
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`) ||
                  aliased === item.href;
                const Icon = ICONS[item.href] ?? LayoutDashboard;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-200",
                      active
                        ? "bg-white/[0.08] text-white ring-1 ring-white/10"
                        : "text-white/60 hover:bg-white/[0.05] hover:text-white",
                    )}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand-emerald shadow-[0_0_12px_rgba(0,199,157,0.7)]" />
                    ) : null}
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        active ? "text-brand-emerald" : "text-white/45 group-hover:text-white/70",
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

      <div className="border-t border-white/10 px-4 py-3.5">
        <p className="text-[11px] font-medium text-white/55">INRSettle Console · Private beta</p>
        <a
          href="/contact?intent=sales"
          className="mt-1 inline-block text-[11px] text-white/35 transition-colors hover:text-white/60"
        >
          Contact support
        </a>
      </div>
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
