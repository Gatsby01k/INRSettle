export const SETTLEMENT_LIFECYCLE = [
  "REQUESTED",
  "APPROVED",
  "EXECUTING",
  "SETTLED",
  "RECONCILED",
] as const;

export type SettlementLifecycleStep = (typeof SETTLEMENT_LIFECYCLE)[number];

export function settlementStepIndex(status: string) {
  const index = SETTLEMENT_LIFECYCLE.indexOf(status as SettlementLifecycleStep);
  return index >= 0 ? index : 0;
}

export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * Phase 1 IA — the single source of truth for primary navigation.
 * Seven destinations that mirror the product's data model. Former pages
 * live on as tabs inside their areas (see AREA_TABS below); their routes
 * remain valid so links and bookmarks keep working.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Console",
    items: [
      { href: "/dashboard", label: "Home" },
      { href: "/settlements", label: "Settlements" },
      { href: "/reconciliation", label: "Reconciliation" },
      { href: "/providers", label: "Providers" },
      { href: "/audit-logs", label: "Audit trail" },
      { href: "/reports", label: "Reports" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Route-level tab sets for the three merged areas (Phase 1 IA). */
export const AREA_TABS: Record<string, NavItem[]> = {
  settlements: [
    { href: "/settlements", label: "Settlements" },
    { href: "/quotes", label: "Quotes" },
  ],
  providers: [
    { href: "/providers", label: "Readiness" },
    { href: "/counterparties", label: "Counterparties" },
    { href: "/kyb", label: "KYB" },
    { href: "/monitoring", label: "Runbook" },
    { href: "/pilot-readiness", label: "Go-live" },
  ],
  settings: [
    { href: "/settings", label: "Organization" },
    { href: "/team", label: "Team" },
    { href: "/accounts", label: "Treasury references" },
    { href: "/api-reference", label: "API" },
  ],
};
