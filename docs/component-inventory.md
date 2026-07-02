# Component inventory — Phase 0 verdicts

Rule: Phases 3–6 delete as they migrate. Nothing on the "delete/merge" list
may be used in new code.

## Canonical (build on these)

| Component | Role |
|---|---|
| `ops/page-header.tsx` `PageHeader` | THE page header: title + actions + clickable stat strip |
| `ops/data-table.tsx` `DataTable` + `parseTableState` | THE table: sort/pagination via URL, sticky header, empty state, count footer |
| `ops/status-badge.tsx` `StatusBadge` / `StatusChip` / `StateIcon` | THE status vocabulary (chips + state glyphs) |
| `ui/badge.tsx` `Badge` | Low-level chip primitive (semantic tokens only) — use via StatusChip |
| `ops/time.tsx` `Time` / `formatIst` | THE timestamp (IST label, UTC on hover) |
| `ops/data-grid.tsx` | Table primitives under DataTable (fine to use directly for static tables) |
| `ops/empty-state.tsx` | Route-level empty states |
| `ops/metric-card.tsx` | Keep `default` variant; `mission`/`telemetry` variants retire with the dashboard redesign |
| `ui/button.tsx`, `ui/input.tsx`, `ui/select.tsx`, `ui/sheet.tsx`, `ui/tabs.tsx`, `ui/card.tsx` | Keep |
| `ops/filter-bar.tsx` | Keep; pairs with DataTable |

## Migrate & delete (Phase 3–6)

| Component / pattern | Verdict |
|---|---|
| `conf-hero` CSS band (dashboard/settlements/recon/quotes) | Delete — replaced by PageHeader + stat strip (Phase 3/4) |
| `case-chip` + variants (`--demo/--shadow/--live/--gold`) | Migrate to StatusChip; mode becomes table data, not decor (Phase 4) |
| `prs-chip`, `prs-panel`, `prs-card`, dark `prs-*` system | Delete with Providers re-theme (Phase 6) |
| Text glyphs "✓ ✕ • !" in `check-dot`, `conf-step__dot`, `prs-gate-dot` | Replace with `StateIcon` as pages migrate |
| `ops/settlement-lifecycle.tsx` (2 variants) + `conf-pipeline` + landing `workflow-rail` | Converge on ONE lifecycle rendering (Phase 4.3); others deleted |
| `ui/settlement-rail-loader.tsx` | Delete (decorative loader) |
| `ops/quick-actions.tsx`, `ops/tab-links.tsx`, `ops/segmented.tsx` | Review at Phase 4; likely folded into header/filter patterns |
| `formatDateTime` (lib/utils) call sites | Sweep to `<Time>` progressively |
| `text-[9px]` / `text-[10px]` occurrences | Sweep to 12px floor during each page's migration |
| URL flash messages (`flash-message.tsx`, `?success=`) | Replace with toast system (Phase 7.2) |

## Copy source of truth

`lib/copy.ts` — thesis, no-funds disclaimer, audit claim, status vocabulary.
"Immutable" is banned; use `AUDIT_CLAIM`.
