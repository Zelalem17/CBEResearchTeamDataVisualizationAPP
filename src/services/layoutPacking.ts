/** Shared "auto-arrange" logic for dashboard widgets: sorts widgets by
 * kind so similar charts cluster together (with compact "text-like"
 * widgets — KPI/gauge/wave — forming their own row(s) up top rather
 * than being scattered between charts), then shelf-packs them left to
 * right, wrapping to a new row only when a widget doesn't fit in the
 * remaining width of the current one. This is what makes two charts
 * that both fit within the 12-column grid sit side by side instead of
 * each defaulting to a full row.
 *
 * Sizes are taken from computeAutoFitSize when data is available (so
 * packing always reflects each widget's actual current content, the
 * same "auto resize based on data" rule the grid enforces live), falling
 * back to the widget's own declared position.w/h otherwise (e.g. during
 * initial dashboard generation, before any rows exist to size against).
 */
import type { DataRow, Widget } from "@/types";
import { computeAutoFitSize } from "@/components/charts/chartConfigBuilders";

const GRID_COLS = 12;

// Lower rank = placed earlier. KPI/gauge/wave read as compact
// number+label "text" widgets rather than full charts, so they're
// ranked first and end up clustered into their own row(s) at the top.
// Table is ranked last since it's usually full-width and belongs at
// the bottom, below the charts that summarize the same data.
const TYPE_RANK: Record<string, number> = {
  kpi: 0, gauge: 1, wave: 2,
  bar: 10, bar_detailed: 11, bar3d: 12, bar_line_combo: 13, bar_line_series: 14, grouped_bar: 15, grouped_bar_detailed: 16,
  line: 20, area: 21, grouped_line: 22, ridgeline: 23, streamgraph: 24, radar: 25,
  pie: 30, pie_detailed: 31, pie3d: 32,
  scatter: 40, category_scatter: 41,
  histogram: 50, heatmap: 51, treemap: 52,
  table: 90,
};

function rankOf(type: string): number {
  return TYPE_RANK[type] ?? 60;
}

/** Shelf-packs widgets into the 12-column grid **in whatever order
 * they're already in** — no sorting. Walks the list left to right,
 * placing each widget right after the previous one if it fits in the
 * remaining row width, and wrapping to a new row (below the tallest
 * widget already in the current row) otherwise. Returns new widget
 * objects with updated `position`; everything else about each widget,
 * including its position in the array, is untouched.
 *
 * This is the piece that's safe to re-run after every add/remove/manual
 * reorder: it only ever adjusts x/y (and the size floor from
 * computeAutoFitSize) to close gaps and keep charts sitting two-per-row
 * where they fit, and never re-sorts — so a researcher's own chosen
 * order (via drag, or "move to position") survives editing the board,
 * instead of silently reverting to type-sorted order on the very next
 * add or remove. */
export function shelfPack<T extends Widget | Omit<Widget, "id">>(widgets: T[], rows: DataRow[] = []): T[] {
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  return widgets.map((w) => {
    const fit = computeAutoFitSize(w as Widget, rows);
    const width = Math.min(GRID_COLS, Math.max(w.position.w, fit?.w ?? w.position.w));
    const height = Math.max(w.position.h, fit?.h ?? w.position.h);

    if (x > 0 && x + width > GRID_COLS) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }

    const placed = { ...w, position: { x, y, w: width, h: height } };
    x += width;
    rowHeight = Math.max(rowHeight, height);
    return placed;
  });
}

/** Sorts by type (see TYPE_RANK), then shelf-packs — the full
 * "Auto-arrange" behavior. Only ever called from an explicit user
 * action (the Auto-arrange button, or generating a fresh dashboard) —
 * routine editing (add/remove/reorder) uses shelfPack alone so it never
 * discards a researcher's own manual ordering as a side effect. */
export function packWidgets<T extends Widget | Omit<Widget, "id">>(widgets: T[], rows: DataRow[] = []): T[] {
  const sorted = [...widgets].sort((a, b) => rankOf(a.type) - rankOf(b.type));
  return shelfPack(sorted, rows);
}
