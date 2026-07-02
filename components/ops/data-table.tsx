import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DataGrid,
  DataGridBody,
  DataGridHead,
  DataGridRow,
  DataGridTd,
  DataGridTh,
} from "@/components/ops/data-grid";

/**
 * Phase 0 — the table spine of the console.
 *
 * Server-component data table: sorting and pagination are URL state
 * (links, not client handlers), so it composes with the existing
 * server-rendered pages, FilterBar and searchParams filters without any
 * client JS. Pages parse table state with `parseTableState`, query with
 * skip/take + orderBy, and render `<DataTable>`.
 *
 * Rules it enforces by construction:
 * - amounts and numerics right-aligned with tabular numerals
 * - sortable headers announce state (aria-sort)
 * - sticky header inside the scroll container
 * - a real empty state, never a blank panel
 * - visible result count — lists never silently truncate
 */

export type DataTableColumn<T> = {
  key: string;
  header: React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
  className?: string;
  render: (row: T) => React.ReactNode;
};

export type TableState = {
  page: number;
  sortKey: string;
  sortDir: "asc" | "desc";
};

export function parseTableState(
  params: Record<string, string | string[] | undefined>,
  defaults: { sortKey: string; sortDir?: "asc" | "desc" },
): TableState {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const page = Math.max(1, Number.parseInt(one(params.page) ?? "1", 10) || 1);
  const sortKey = one(params.sort) || defaults.sortKey;
  const dirRaw = one(params.dir);
  const sortDir: "asc" | "desc" = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : (defaults.sortDir ?? "desc");
  return { page, sortKey, sortDir };
}

function buildHref(
  basePath: string,
  params: Record<string, string | string[] | undefined>,
  updates: Record<string, string | null>,
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v != null && v !== "") next.set(key, v);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value == null) next.delete(key);
    else next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  state,
  basePath,
  searchParams = {},
  pageSize = 25,
  totalCount,
  emptyState,
  minWidth = 760,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Current sort/page state (from parseTableState). Omit for static tables. */
  state?: TableState;
  /** Route the sort/page links point at. Required when `state` is set. */
  basePath?: string;
  /** Current searchParams — preserved in sort/page links so filters survive. */
  searchParams?: Record<string, string | string[] | undefined>;
  pageSize?: number;
  /** Total row count across all pages. Enables the pagination footer. */
  totalCount?: number;
  emptyState?: React.ReactNode;
  minWidth?: number;
}) {
  const sortable = Boolean(state && basePath);
  const page = state?.page ?? 1;
  const total = totalCount ?? rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, (page - 1) * pageSize + rows.length);

  const sortHref = (key: string) => {
    if (!basePath || !state) return "#";
    const dir = state.sortKey === key && state.sortDir === "desc" ? "asc" : "desc";
    return buildHref(basePath, searchParams, { sort: key, dir, page: null });
  };

  const pageHref = (target: number) =>
    basePath ? buildHref(basePath, searchParams, { page: target <= 1 ? null : String(target) }) : "#";

  return (
    <DataGrid>
      <table className="w-full" style={{ minWidth }}>
        <DataGridHead>
          {columns.map((column) => {
            const active = state?.sortKey === column.key;
            const SortIcon = active ? (state?.sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
            return (
              <DataGridTh
                key={column.key}
                className={cn(column.align === "right" && "text-right", column.className)}
                aria-sort={active ? (state?.sortDir === "asc" ? "ascending" : "descending") : undefined}
              >
                {sortable && column.sortable ? (
                  <Link
                    href={sortHref(column.key)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald/40",
                      column.align === "right" && "flex-row-reverse",
                      active && "text-slate-900",
                    )}
                  >
                    {column.header}
                    <SortIcon className={cn("h-3 w-3", active ? "opacity-90" : "opacity-40")} aria-hidden="true" />
                  </Link>
                ) : (
                  column.header
                )}
              </DataGridTh>
            );
          })}
        </DataGridHead>
        <DataGridBody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12">
                {emptyState ?? (
                  <p className="text-center text-sm text-slate-500">No records match the current filters.</p>
                )}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <DataGridRow key={rowKey(row)}>
                {columns.map((column) => (
                  <DataGridTd
                    key={column.key}
                    className={cn(
                      column.align === "right" && "text-right tabular-nums whitespace-nowrap",
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </DataGridTd>
                ))}
              </DataGridRow>
            ))
          )}
        </DataGridBody>
      </table>

      {totalCount != null && basePath ? (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/60 px-4 py-2.5">
          <p className="text-xs tabular-nums text-slate-500">
            {total === 0 ? "0 records" : `${from}–${to} of ${total.toLocaleString("en-IN")}`}
          </p>
          <div className="flex items-center gap-1">
            <PagerLink href={pageHref(page - 1)} disabled={page <= 1} label="Previous page">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </PagerLink>
            <span className="px-2 text-xs tabular-nums text-slate-500">
              {page} / {pageCount}
            </span>
            <PagerLink href={pageHref(page + 1)} disabled={page >= pageCount} label="Next page">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </PagerLink>
          </div>
        </div>
      ) : null}
    </DataGrid>
  );
}

function PagerLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald/40"
    >
      {children}
    </Link>
  );
}
