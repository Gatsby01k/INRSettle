import { Check, Fingerprint, ShieldCheck, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canApproveSettlement, canViewSensitiveFinancialData } from "@/lib/permissions";
import { formatDateTime, maskFinancialIdentifier } from "@/lib/utils";
import { AreaTabs } from "@/components/ops/area-tabs";
import { prisma } from "@/lib/prisma";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { StatusChip } from "@/components/ops/status-badge";
import {
  DataGrid,
  DataGridBody,
  DataGridHead,
  DataGridRow,
  DataGridTd,
  DataGridTh,
} from "@/components/ops/data-grid";

export const metadata = { title: "Team and access" };

const ROLE_DETAILS = [
  {
    role: "OWNER",
    summary: "Organization administration and full settlement control.",
    permissions: ["Manage settings", "Manage provider connections", "Approve sensitive operations"],
  },
  {
    role: "ADMIN",
    summary: "Administrative and operational control without ownership transfer.",
    permissions: ["Manage settings", "Manage provider connections", "Approve settlements"],
  },
  {
    role: "TREASURY_MANAGER",
    summary: "Treasury approval, funding control and settlement oversight.",
    permissions: ["Approve settlements", "Confirm funding", "Approve finality"],
  },
  {
    role: "SETTLEMENT_OPERATOR",
    summary: "Day-to-day quote, settlement and reconciliation operations.",
    permissions: ["Create settlements", "Operate provider workflow", "Record reconciliation"],
  },
  {
    role: "COMPLIANCE_OFFICER",
    summary: "Control and evidence review without settlement mutation.",
    permissions: ["Review audit evidence", "Review finality", "Inspect provider records"],
  },
  {
    role: "FINANCE_VIEWER",
    summary: "Read-only financial reporting with sensitive-data masking.",
    permissions: ["View operations", "View reports", "No mutation access"],
  },
] as const;

export default async function TeamPage() {
  const { user, organization, membership: activeMembership } = await requireSession();
  const canViewSensitive = canViewSensitiveFinancialData(activeMembership.role);
  const memberships = await prisma.membership.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "asc" },
    include: { user: true },
  });

  const members = memberships.map((membership) => ({
    id: membership.user.id,
    name: membership.user.name,
    email: canViewSensitive
      ? membership.user.email
      : maskFinancialIdentifier(membership.user.email),
    role: membership.role,
    isYou: membership.user.id === user.id,
    canApprove: canApproveSettlement(membership.role),
    mfaEnabled: membership.user.mfaEnabled,
    lastLoginAt: membership.user.lastLoginAt,
  }));
  const approvers = members.filter((member) => member.canApprove).length;
  const mfaEnrolled = members.filter((member) => member.mfaEnabled).length;
  const dualControlAvailable = approvers >= 2 || (approvers >= 1 && members.length >= 2);

  return (
    <div className="space-y-6">
      <AreaTabs area="settings" />
      <PageHeader
        title="Team and access"
        description="Tenant membership, role scope, MFA enrollment and approval capability from the live organization directory."
        stats={[
          { label: "Members", value: members.length, tone: members.length ? "info" : "pending" },
          { label: "Approval roles", value: approvers, tone: approvers ? "ok" : "pending" },
          { label: "MFA enrolled", value: `${mfaEnrolled}/${members.length}`, tone: mfaEnrolled === members.length && members.length ? "ok" : "pending" },
          { label: "Dual control", value: dualControlAvailable ? "Available" : "Blocked", tone: dualControlAvailable ? "ok" : "blocked" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="ops-panel flex items-start gap-3 p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Separation of duties</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Settlement creators cannot approve their own controlled lifecycle or finality decision.
            </p>
          </div>
        </article>
        <article className="ops-panel flex items-start gap-3 p-5">
          <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Sensitive-operation assurance</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Approval and funding controls evaluate role, MFA enrollment and recent step-up verification.
            </p>
          </div>
        </article>
      </div>

      <section>
        <SectionHeader
          title="Organization directory"
          description="Only users with persisted tenant membership appear here."
        />
        <DataGrid>
          <table className="w-full min-w-[760px]">
            <DataGridHead>
              <DataGridTh>Member</DataGridTh>
              <DataGridTh>Role</DataGridTh>
              <DataGridTh>Approval capability</DataGridTh>
              <DataGridTh>MFA</DataGridTh>
              <DataGridTh>Last sign-in</DataGridTh>
            </DataGridHead>
            <DataGridBody>
              {members.map((member) => (
                <DataGridRow key={member.id}>
                  <DataGridTd>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-950">{member.name}</p>
                      {member.isYou ? <StatusChip tone="info">Current user</StatusChip> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{member.email}</p>
                  </DataGridTd>
                  <DataGridTd>
                    <StatusChip tone={member.role === "OWNER" ? "info" : "neutral"}>
                      {member.role.replaceAll("_", " ")}
                    </StatusChip>
                  </DataGridTd>
                  <DataGridTd className="text-xs text-slate-600">
                    {member.canApprove ? "Can approve controlled actions" : "No approval authority"}
                  </DataGridTd>
                  <DataGridTd>
                    <StatusChip tone={member.mfaEnabled ? "success" : "warning"} dot>
                      {member.mfaEnabled ? "Enrolled" : "Not enrolled"}
                    </StatusChip>
                  </DataGridTd>
                  <DataGridTd className="text-xs text-slate-500">
                    {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "No sign-in recorded"}
                  </DataGridTd>
                </DataGridRow>
              ))}
            </DataGridBody>
          </table>
        </DataGrid>
      </section>

      <section>
        <SectionHeader
          title="Role model"
          description="The interface summarizes role intent; server-side permissions remain authoritative."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ROLE_DETAILS.map((role) => (
            <article key={role.role} className="ops-panel p-5">
              <div className="flex items-center justify-between gap-3">
                <Users className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <StatusChip tone={role.role === "OWNER" ? "info" : "neutral"}>
                  {role.role.replaceAll("_", " ")}
                </StatusChip>
              </div>
              <p className="mt-5 text-sm font-semibold leading-relaxed text-slate-950">{role.summary}</p>
              <ul className="mt-4 space-y-2">
                {role.permissions.map((permission) => (
                  <li key={permission} className="flex items-start gap-2 text-xs text-slate-600">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                    {permission}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
