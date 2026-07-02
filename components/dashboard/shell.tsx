import { redirect } from "next/navigation";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { clearSession } from "@/lib/auth";
import { getShadowConfig } from "@/lib/shadow-mode";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { CommandPalette } from "@/components/dashboard/command-palette";

async function logout() {
  "use server";
  await clearSession();
  redirect("/login");
}

/**
 * Environment posture chip — visible on every screen. Reads the same guardrail
 * config that gates finality (lib/shadow-mode.ts); display only, no control.
 */
function EnvironmentPosture() {
  const livePayoutsEnabled = getShadowConfig().livePayoutsEnabled;

  if (livePayoutsEnabled) {
    return (
      <span className="hidden items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-red-700 sm:inline-flex">
        <TriangleAlert className="h-3 w-3" aria-hidden="true" />
        Live payouts enabled — finality blocked
      </span>
    );
  }

  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-emerald-700 sm:inline-flex">
      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      Sandbox · live payouts disabled
    </span>
  );
}

export function DashboardShell({
  children,
  organizationName,
  userName,
}: {
  children: React.ReactNode;
  organizationName: string;
  userName: string;
}) {
  return (
    <div className="app-surface min-h-screen text-slate-950">
      {/* Global settlement-rail arcs (fixed, behind every screen) */}
      <div className="app-rails" aria-hidden="true" />
      <SidebarNav organizationName={organizationName} />
      <div className="lg:pl-60">
        <header className="relative sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[var(--ops-line)] bg-white/75 px-4 backdrop-blur-xl sm:px-6">
          <span className="app-topbar-rail" aria-hidden="true" />
          <div className="flex min-w-0 items-center gap-2.5">
            <MobileNav organizationName={organizationName} />
            <CommandPalette />
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-sm font-semibold tracking-tight text-slate-900">{organizationName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <EnvironmentPosture />
            <UserMenu userName={userName} organizationName={organizationName} logoutAction={logout} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
