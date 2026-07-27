"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Network, Scale, ShieldCheck, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Center", icon: LayoutDashboard },
  { href: "/settlements", label: "Settlements", icon: Workflow },
  { href: "/reconciliation", label: "Reconcile", icon: Scale },
  { href: "/providers", label: "Providers", icon: Network },
  { href: "/risk-review", label: "Controls", icon: ShieldCheck },
] as const;

export function MobileDock() {
  const pathname = usePathname();

  return (
    <nav className="mobile-ops-dock" aria-label="Primary mobile navigation">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(active && "is-active")}
          >
            <span><Icon aria-hidden="true" /></span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
