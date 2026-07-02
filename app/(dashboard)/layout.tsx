import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/shell";

// Phase 7 (M4) — title discipline: every console route renders as
// "<Page> — INRSettle Console" in the tab bar.
export const metadata: Metadata = {
  title: { template: "%s — INRSettle Console", default: "INRSettle Console" },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <DashboardShell
      organizationName={session.organization.displayName}
      userName={session.user.name}
    >
      {children}
    </DashboardShell>
  );
}
