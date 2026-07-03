import { Suspense } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AUDIT_CLAIM } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
import { DataTable, parseTableState, type DataTableColumn } from "@/components/ops/data-table";
import { EmptyState } from "@/components/ops/empty-state";
import { FilterBar } from "@/components/ops/filter-bar";
import { StatusChip } from "@/components/ops/status-badge";
import { Time } from "@/components/ops/time";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Audit trail" };

/**
 * Audit trail — Phase 5.1 rebuild.
 * The full event history, not a 100-row stub: server-side filters
 * (search, actor type, date range), real pagination, and inline
 * before/after state inspection for every event. Answers "show me March".
 */

const PAGE_SIZE = 25;

const ACTOR_LABEL: Record<string, string> = {
  USER: "User",
  API: "Provider",
  SYSTEM: "System",
};

type AuditPayload = {
  publicId?: string;
  reference?: string;
  externalRef?: string;
  source?: string;
  status?: string;
  fromStatus?: string;
  toStatus?: string;
  amount?: string;
  currency?: string;
  settlementPublicId?: string;
  settlementReference?: string;
};

function payload(value: unknown): AuditPayload {
  return value && typeof value === "object" ? (value as AuditPayload) : {};
}

function resourceLabel(log: { resourceType: string; resourceId: string | null; before: unknown; after: unknown }) {
  const data = { ...payload(log.before), ...payload(log.after) };
  if (data.publicId || data.reference) return [data.publicId, data.reference].filter(Boolean).join(" · ");
  if (data.externalRef) return [data.externalRef, data.source].filter(Boolean).join(" · ");
  if (data.settlementPublicId || data.settlementReference) {
    return [data.settlementPublicId, data.settlementReference].filter(Boolean).join(" · ");
  }
  return `${log.resourceType}${log.resourceId ? ` / ${log.resourceId.slice(0, 8)}` : ""}`;
}

function eventDetail(log: { before: unknown; after: unknown }) {
  const before = payload(log.before);
  const after = payload(log.after);
  const fromStatus = after.fromStatus ?? before.status;
  const toStatus = after.toStatus ?? after.status;
  if (fromStatus && toStatus && fromStatus !== toStatus) return `${fromStatus} → ${toStatus}`;
  if (toStatus) return String(toStatus);
  if (after.amount && after.currency) return `${after.amount} ${after.currency}`;
  return "Recorded";
}

function actionTone(action: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const upper = action.toUpperCase();
  if (upper.includes("EXCEPTION") || upper.includes("FAILED") || upper.includes("REJECT")) return "danger";
  if (upper.includes("APPROV") || upper.includes("MATCH") || upper.includes("SETTLED") || upper.includes("RECONCIL")) {
    return "success";
  }
  if (upper.includes("CREATE") || upper.includes("GENERATED")) return "info";
  if (upper.includes("UPDATE") || upper.includes("TRANSITION")) return "warning";
  return "neutral";
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function filterHref(
  params: Record<string, string | undefined>,
  updates: Record<string, string | null>,
) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) next.set(k, v);
  for (const [k, v] of Object.entries(updates)) {
    if (v == null) next.delete(k);
    else next.set(k, v);
  }
  next.delete("page");
  const qs = next.toString();
  return qs ? `/audit-logs?${qs}` : "/audit-logs";
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organization } = await requireSession();
  const params = await searchParams;
  const state = parseTableState(params, { sortKey: "createdAt", sortDir: "desc" });

  const q = one(params.q)?.trim() ?? "";
  const actor = one(params.actor)?.toUpperCase() ?? "";
  const from = one(params.from);
  const to = one(params.to);

  const where: Prisma.AuditLogWhereInput = {
    organizationId: organization.id,
    ...(actor && ["USER", "API", "SYSTEM"].includes(actor) ? { actorType: actor as "USER" | "API" | "SYSTEM" } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" } },
            { resourceType: { contains: q, mode: "insensitive" } },
            { resourceId: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [totalCount, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: state.sortDir },
      skip: (state.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: true },
    }),
  ]);

  type Row = (typeof logs)[number];

  const filterParams: Record<string, string | undefined> = {
    q: q || undefined,
    actor: one(params.actor),
    from,
    to,
    sort: one(params.sort),
    dir: one(params.dir),
  };

  const columns: DataTableColumn<Row>[] = [
    {
      key: "createdAt",
      header: "Time",
      sortable: true,
      className: "whitespace-nowrap",
      render: (log) => <Time value={log.createdAt} className="text-xs tabular-nums text-slate-500" />,
    },
    {
      key: "action",
      header: "Action",
      render: (log) => (
        <div className="flex items-center gap-2">
          <StatusChip tone={actionTone(log.action)} dot>
            {log.action}
          </StatusChip>
        </div>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (log) => (
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-700">{ACTOR_LABEL[log.actorType] ?? log.actorType}</p>
          <p className="truncate text-xs text-slate-400">
            {log.user?.email ?? (log.actorType === "API" ? "Provider integration" : "System")}
          </p>
        </div>
      ),
    },
    {
      key: "resource",
      header: "Resource",
      render: (log) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-700">{resourceLabel(log)}</p>
          <p className="text-xs text-slate-400">{eventDetail(log)}</p>
        </div>
      ),
    },
    {
      key: "state",
      header: "State change",
      render: (log) =>
        log.before || log.after ? (
          <details className="group">
            <summary className="cursor-pointer select-none text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 [&::-webkit-details-marker]:hidden">
              Inspect <span className="text-slate-300 group-open:hidden">▸</span>
              <span className="hidden text-slate-300 group-open:inline">▾</span>
            </summary>
            <div className="mt-2 grid max-w-xl gap-2">
              {log.before ? (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Before</p>
                  <pre className="ops-scroll max-h-48 overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
                    {JSON.stringify(log.before, null, 2)}
                  </pre>
                </div>
              ) : null}
              {log.after ? (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">After</p>
                  <pre className="ops-scroll max-h-48 overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
                    {JSON.stringify(log.after, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </details>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit trail"
        description={`${AUDIT_CLAIM} Every settlement, reconciliation, approval and configuration event with actor and before/after state.`}
        actions={
          <a
            href="/api/reports?type=audit&format=csv"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export all (CSV)
          </a>
        }
      />

      {/* Filters: search + actor + date range */}
      <div className="ops-panel space-y-2.5 p-3">
        <Suspense fallback={null}>
          <FilterBar embedded searchPlaceholder="Search action, resource type, or ID..." />
        </Suspense>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400">Actor</span>
            {[
              { value: null, label: "All" },
              { value: "USER", label: "User" },
              { value: "API", label: "Provider" },
              { value: "SYSTEM", label: "System" },
            ].map((option) => {
              const active = (option.value ?? "") === actor || (!option.value && !actor);
              return (
                <Link
                  key={option.label}
                  href={filterHref(filterParams, { actor: option.value })}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
          <form method="GET" action="/audit-logs" className="flex flex-wrap items-center gap-1.5">
            {q ? <input type="hidden" name="q" value={q} /> : null}
            {actor ? <input type="hidden" name="actor" value={actor} /> : null}
            <label className="text-xs font-medium text-slate-400" htmlFor="audit-from">
              From
            </label>
            <input
              id="audit-from"
              type="date"
              name="from"
              defaultValue={from}
              className="h-7 rounded-md border border-[var(--ops-line)] bg-white px-2 text-xs text-slate-700"
            />
            <label className="text-xs font-medium text-slate-400" htmlFor="audit-to">
              To
            </label>
            <input
              id="audit-to"
              type="date"
              name="to"
              defaultValue={to}
              className="h-7 rounded-md border border-[var(--ops-line)] bg-white px-2 text-xs text-slate-700"
            />
            <button
              type="submit"
              className="h-7 rounded-md border border-[var(--ops-line)] bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Apply
            </button>
            {from || to ? (
              <Link
                href={filterHref(filterParams, { from: null, to: null })}
                className="text-xs font-medium text-slate-400 hover:text-slate-700"
              >
                Clear dates
              </Link>
            ) : null}
          </form>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={logs}
        rowKey={(log) => log.id}
        state={state}
        basePath="/audit-logs"
        searchParams={params}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
        minWidth={880}
        emptyState={
          <EmptyState
            title="No audit events match"
            description="Adjust the search, actor, or date range — every recorded event is queryable here."
          />
        }
      />
    </div>
  );
}
