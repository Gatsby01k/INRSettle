"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleAlert, LayoutDashboard, Network, Scale, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/settlements", label: "Workflow", icon: Workflow },
  { href: "/reconciliation", label: "Match", icon: Scale },
  { href: "/exceptions", label: "Exceptions", icon: CircleAlert },
  { href: "/providers", label: "Providers", icon: Network },
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
