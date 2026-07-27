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

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Operations Center" },
      { href: "/settlements", label: "Settlements" },
      { href: "/reconciliation", label: "Reconciliation" },
      { href: "/providers", label: "Provider Network" },
      { href: "/risk-review", label: "Controls & Evidence" },
      { href: "/settings", label: "Platform Settings" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Route-level tab sets for the three merged areas (Phase 1 IA). */
export const AREA_TABS: Record<string, NavItem[]> = {
  settlements: [
    { href: "/settlements", label: "Settlements" },
    { href: "/quotes", label: "Quotes" },
    { href: "/funding", label: "Funding" },
    { href: "/finality", label: "Finality" },
    { href: "/exceptions", label: "Exceptions" },
  ],
  providers: [
    { href: "/providers", label: "Connections" },
    { href: "/providers/operations", label: "Operations" },
    { href: "/providers/health", label: "Health" },
    { href: "/providers/routing", label: "Routing" },
    { href: "/providers/capabilities", label: "Capabilities" },
    { href: "/providers/webhooks", label: "Webhooks" },
    { href: "/providers/logs", label: "Logs" },
    { href: "/providers/credentials", label: "Credentials" },
    { href: "/providers/performance", label: "Performance" },
  ],
  settings: [
    { href: "/settings", label: "Organization" },
    { href: "/team", label: "Team" },
    { href: "/api-reference", label: "API" },
  ],
};
