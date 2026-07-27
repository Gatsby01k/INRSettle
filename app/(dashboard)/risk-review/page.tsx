import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowRight, Building2, Check, FileCheck2, FileWarning, KeyRound, ShieldCheck, Users, X } from "lucide-react";
import { DueDiligenceSubjectType, RiskRating } from "@prisma/client";
import { z } from "zod";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { FlashMessage } from "@/components/ops/flash-message";
import { StatusBadge, StatusChip } from "@/components/ops/status-badge";
import { FormSelect } from "@/components/ops/form-select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { isMfaStepUpFresh, requireSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { friendlyErrorMessage } from "@/lib/errors";
import { approvalMfaViolation, canManageCompliance, roleErrorMessage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Risk and due diligence" };

const caseSchema = z.object({
  subjectType: z.nativeEnum(DueDiligenceSubjectType),
  subjectRef: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(180),
  jurisdiction: z.string().trim().min(2).max(80),
  riskRating: z.nativeEnum(RiskRating),
  evidenceSummary: z.string().trim().min(20).max(3000),
});

async function createDueDiligenceCase(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canManageCompliance(membership.role)) {
    redirect(`/risk-review?error=${encodeURIComponent(roleErrorMessage(membership.role))}`);
  }

  try {
    const input = caseSchema.parse({
      subjectType: String(formData.get("subjectType") ?? ""),
      subjectRef: String(formData.get("subjectRef") ?? ""),
      legalName: String(formData.get("legalName") ?? ""),
      jurisdiction: String(formData.get("jurisdiction") ?? ""),
      riskRating: String(formData.get("riskRating") ?? ""),
      evidenceSummary: String(formData.get("evidenceSummary") ?? ""),
    });

    await prisma.$transaction(async (tx) => {
      const record = await tx.dueDiligenceCase.create({
        data: {
          organizationId: organization.id,
          ...input,
          status: "IN_REVIEW",
          submittedAt: new Date(),
          createdById: user.id,
        },
      });
      await writeAuditLog({
        action: "due_diligence.submitted",
        resourceType: "due_diligence_case",
        resourceId: record.id,
        organizationId: organization.id,
        userId: user.id,
        after: {
          subjectType: record.subjectType,
          subjectRef: record.subjectRef,
          legalName: record.legalName,
          riskRating: record.riskRating,
          status: record.status,
        },
      }, tx);
    });
  } catch (error) {
    redirect(`/risk-review?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }

  revalidatePath("/risk-review");
  redirect("/risk-review?success=submitted");
}

async function approveDueDiligenceCase(formData: FormData) {
  "use server";
  const { user, organization, membership, session } = await requireSession();
  if (!canManageCompliance(membership.role)) {
    redirect(`/risk-review?error=${encodeURIComponent(roleErrorMessage(membership.role))}`);
  }

  const caseId = String(formData.get("caseId") ?? "");
  const record = await prisma.dueDiligenceCase.findFirst({
    where: { id: caseId, organizationId: organization.id },
  });
  if (!record) redirect(`/risk-review?error=${encodeURIComponent("Due-diligence case was not found.")}`);
  if (record.createdById === user.id) {
    redirect(`/risk-review?error=${encodeURIComponent("The submitting operator cannot approve the same due-diligence case.")}`);
  }
  if (record.status !== "IN_REVIEW") {
    redirect(`/risk-review?error=${encodeURIComponent("Only a case in review can be approved.")}`);
  }

  const mfaViolation = approvalMfaViolation({
    requireMfaForApproval: organization.settings?.requireMfaForApproval ?? true,
    mfaEnabled: user.mfaEnabled,
    mfaStepUpFresh: isMfaStepUpFresh(session),
  });
  if (mfaViolation) redirect(`/risk-review?error=${encodeURIComponent(mfaViolation)}`);

  await prisma.$transaction(async (tx) => {
    await tx.dueDiligenceCase.update({
      where: { id: record.id },
      data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
    });
    await writeAuditLog({
      action: "due_diligence.approved",
      resourceType: "due_diligence_case",
      resourceId: record.id,
      organizationId: organization.id,
      userId: user.id,
      before: { status: record.status },
      after: { status: "APPROVED", subjectType: record.subjectType, subjectRef: record.subjectRef },
    }, tx);
  });

  revalidatePath("/risk-review");
  redirect("/risk-review?success=approved");
}

type Control = {
  title: string;
  owner: string;
  ready: boolean;
  evidence: string;
  action: { label: string; href: string };
};

export default async function RiskReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { organization, membership } = await requireSession();
  const query = await searchParams;
  const [memberships, connections, recentAudit, cases] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: organization.id },
      include: { user: { select: { mfaEnabled: true } } },
    }),
    prisma.providerConnection.findMany({
      where: { organizationId: organization.id },
      orderBy: { providerCode: "asc" },
    }),
    prisma.auditLog.count({ where: { organizationId: organization.id } }),
    prisma.dueDiligenceCase.findMany({
      where: { organizationId: organization.id },
      include: {
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const canManage = canManageCompliance(membership.role);
  const privileged = memberships.filter((item) =>
    ["OWNER", "ADMIN", "TREASURY_MANAGER"].includes(item.role),
  );
  const privilegedMfa = privileged.filter((item) => item.user.mfaEnabled).length;
  const settings = organization.settings;
  const catalogCredentialConnections = connections.filter((item) => item.credentialsRef).length;
  const healthChecked = connections.filter((item) => item.lastHealthAt).length;
  const approvedProviderCases = new Set(
    cases
      .filter((item) => item.subjectType === "PROVIDER" && item.status === "APPROVED")
      .map((item) => item.subjectRef.toLowerCase()),
  );
  const providerDdCovered = connections.filter((connection) =>
    approvedProviderCases.has(connection.providerCode.toLowerCase()),
  ).length;
  const approvedClientCases = cases.filter(
    (item) => item.subjectType === "CLIENT" && item.status === "APPROVED",
  ).length;

  const controls: Control[] = [
    {
      title: "Organization activation",
      owner: "Administration",
      ready: organization.status === "ACTIVE",
      evidence: organization.status === "ACTIVE" ? "Tenant is active" : `Tenant state is ${organization.status}`,
      action: { label: "Organization settings", href: "/settings" },
    },
    {
      title: "Approval policy",
      owner: "Treasury",
      ready: Boolean(settings?.approvalThreshold && settings.requireMfaForApproval),
      evidence: settings
        ? "Approval threshold and MFA requirement are recorded"
        : "Organization policy has not been initialized",
      action: { label: "Review policy", href: "/settings" },
    },
    {
      title: "Privileged-user MFA",
      owner: "Security",
      ready: privileged.length > 0 && privilegedMfa === privileged.length,
      evidence: `${privilegedMfa} of ${privileged.length} privileged members enrolled`,
      action: { label: "Review team", href: "/team" },
    },
    {
      title: "Provider commercial activation",
      owner: "Partnerships",
      ready: connections.some((item) => item.status === "COMMERCIAL_READY"),
      evidence: `${connections.filter((item) => item.status === "COMMERCIAL_READY").length} of ${connections.length} connections commercially enabled`,
      action: { label: "Provider connections", href: "/providers" },
    },
    {
      title: "Provider credential isolation",
      owner: "Engineering",
      ready: connections.length > 0,
      evidence: `${catalogCredentialConnections} tenant secret references; deployment bindings are verified at connector runtime`,
      action: { label: "Credential controls", href: "/providers/credentials" },
    },
    {
      title: "Provider health evidence",
      owner: "Operations",
      ready: connections.length > 0 && healthChecked === connections.length,
      evidence: `${healthChecked} of ${connections.length} connections have a recorded health check`,
      action: { label: "Provider health", href: "/providers/health" },
    },
    {
      title: "Provider due diligence",
      owner: "Compliance",
      ready: connections.length > 0 && providerDdCovered === connections.length,
      evidence: `${providerDdCovered} of ${connections.length} connections have approved provider DD`,
      action: { label: "Review cases", href: "#due-diligence" },
    },
    {
      title: "Client due diligence",
      owner: "Compliance",
      ready: approvedClientCases > 0,
      evidence: `${approvedClientCases} client cases approved`,
      action: { label: "Review cases", href: "#due-diligence" },
    },
    {
      title: "Audit history",
      owner: "Compliance",
      ready: recentAudit > 0,
      evidence: `${recentAudit} tenant audit records retained`,
      action: { label: "Audit explorer", href: "/audit-logs" },
    },
  ];

  const ready = controls.filter((control) => control.ready).length;
  const blockers = controls.length - ready;
  const pendingCases = cases.filter((item) => item.status === "IN_REVIEW").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client and provider due diligence"
        description="Persisted review cases, dual-control approval and a control register derived from tenant evidence."
        stats={[
          { label: "Controls evidenced", value: `${ready}/${controls.length}`, tone: ready === controls.length ? "ok" : "pending" },
          { label: "Open controls", value: blockers, tone: blockers ? "blocked" : "ok" },
          { label: "Cases in review", value: pendingCases, tone: pendingCases ? "pending" : "neutral" },
          { label: "Approved cases", value: cases.filter((item) => item.status === "APPROVED").length, tone: cases.length ? "info" : "neutral" },
        ]}
      />

      {query.error ? <FlashMessage tone="error" message={query.error} /> : null}
      {query.success === "submitted" ? <FlashMessage message="Due-diligence case submitted for independent approval." /> : null}
      {query.success === "approved" ? <FlashMessage message="Due-diligence approval recorded in the audit trail." /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { Icon: Building2, title: "Client due diligence", body: "Legal identity, jurisdiction, operating purpose and evidence remain tenant-scoped." },
          { Icon: ShieldCheck, title: "Dual-control review", body: "The submitting operator cannot approve the same case; MFA policy applies." },
          { Icon: KeyRound, title: "Provider controls", body: "Commercial activation, credentials, health and due diligence remain independent gates." },
        ].map(({ Icon, title, body }) => (
          <article key={title} className="ops-panel p-5">
            <Icon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            <h2 className="mt-5 text-sm font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{body}</p>
          </article>
        ))}
      </div>

      <section id="due-diligence" className="scroll-mt-24">
        <SectionHeader
          title="Due-diligence cases"
          description="Provider cases use the registered provider code as subject reference so activation coverage can be evaluated deterministically."
        />
        {canManage ? (
          <form action={createDueDiligenceCase} className="ops-panel mb-4 grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Subject type" required>
              <FormSelect
                name="subjectType"
                defaultValue="CLIENT"
                options={[
                  { value: "CLIENT", label: "Enterprise client" },
                  { value: "PROVIDER", label: "Settlement provider" },
                ]}
              />
            </Field>
            <Field label="Subject reference" htmlFor="subjectRef" hint="Client reference or registered provider code." required>
              <Input id="subjectRef" name="subjectRef" required />
            </Field>
            <Field label="Legal name" htmlFor="legalName" required>
              <Input id="legalName" name="legalName" required />
            </Field>
            <Field label="Jurisdiction" htmlFor="jurisdiction" required>
              <Input id="jurisdiction" name="jurisdiction" required />
            </Field>
            <Field label="Risk rating" required>
              <FormSelect
                name="riskRating"
                defaultValue="MEDIUM"
                options={[
                  { value: "LOW", label: "Low" },
                  { value: "MEDIUM", label: "Medium" },
                  { value: "HIGH", label: "High" },
                ]}
              />
            </Field>
            <Field label="Evidence summary" htmlFor="evidenceSummary" hint="Sources reviewed, material findings and open conditions." required>
              <Input id="evidenceSummary" name="evidenceSummary" minLength={20} required />
            </Field>
            <div className="flex items-end xl:col-span-3">
              <SubmitButton pendingText="Submitting…">Submit for review</SubmitButton>
            </div>
          </form>
        ) : null}

        {cases.length ? (
          <div className="ops-panel overflow-hidden">
            {cases.map((record) => (
              <article
                key={record.id}
                className="grid gap-4 border-b border-[var(--ops-line-soft)] p-5 last:border-b-0 lg:grid-cols-[1.25fr_0.9fr_0.8fr_auto] lg:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={record.subjectType === "PROVIDER" ? "info" : "neutral"}>
                      {record.subjectType === "PROVIDER" ? "Provider" : "Client"}
                    </StatusChip>
                    <StatusBadge status={record.status} />
                    {record.riskRating ? <StatusChip tone={record.riskRating === "HIGH" ? "danger" : record.riskRating === "MEDIUM" ? "warning" : "success"}>{record.riskRating.toLowerCase()} risk</StatusChip> : null}
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-slate-950">{record.legalName}</h3>
                  <p className="mt-1 text-xs text-slate-500">{record.subjectRef} · {record.jurisdiction}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{record.evidenceSummary}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">Submitted by</p>
                  <p className="mt-1 text-xs font-medium text-slate-700">{record.createdBy.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(record.submittedAt ?? record.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">Approval</p>
                  <p className="mt-1 text-xs font-medium text-slate-700">{record.approvedBy?.name ?? "Independent approval pending"}</p>
                  {record.approvedAt ? <p className="mt-1 text-xs text-slate-400">{formatDateTime(record.approvedAt)}</p> : null}
                </div>
                {canManage && record.status === "IN_REVIEW" ? (
                  <form action={approveDueDiligenceCase}>
                    <input type="hidden" name="caseId" value={record.id} />
                    <SubmitButton variant="outline" size="sm" pendingText="Approving…">
                      Approve case
                    </SubmitButton>
                  </form>
                ) : <FileCheck2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />}
              </article>
            ))}
          </div>
        ) : (
          <div className="ops-panel flex items-start gap-3 p-5">
            <FileWarning className="mt-0.5 h-5 w-5 text-amber-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-slate-950">No due-diligence cases recorded</p>
              <p className="mt-1 text-xs text-slate-500">Provider and client activation remain blocked until review evidence is submitted and independently approved.</p>
            </div>
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Control register"
          description="Every open control links to the workspace that owns its evidence."
        />
        <div className="ops-panel overflow-hidden">
          {controls.map((control) => (
            <div
              key={control.title}
              className="grid gap-4 border-b border-[var(--ops-line-soft)] p-5 last:border-b-0 md:grid-cols-[auto_1fr_0.8fr_auto] md:items-center"
            >
              <span className={control.ready ? "grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-emerald-700" : "grid h-8 w-8 place-items-center rounded-full bg-red-50 text-red-700"}>
                {control.ready ? <Check className="h-4 w-4" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950">{control.title}</p>
                <p className="mt-1 text-xs text-slate-500">{control.evidence}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">Control owner</p>
                <p className="mt-1 text-xs font-medium text-slate-700">{control.owner}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={control.action.href}>
                  {control.action.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {blockers ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-amber-950">
            Open controls remain deployment blockers until their evidence is persisted and approved.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          <Users className="h-5 w-5" aria-hidden="true" />
          All configured control checks are evidenced.
        </div>
      )}
    </div>
  );
}
