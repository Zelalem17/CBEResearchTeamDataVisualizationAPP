/** Builds a dashboard for tidy panel data produced by panelReshape.ts —
 * rows shaped like { Period, Category, Section, Metric, Value }. Instead
 * of the generic "one series per chart" widgets from dashboardGenerator.ts,
 * every chart here is a grouped comparison: each Section/Metric gets its
 * own chart with one bar/line per Category (e.g. CBE vs Industry) so every
 * section is compared side-by-side rather than only ever showing one.
 */
import type { DataRow, Widget, WidgetPosition } from "@/types";

const COLS = 12;

/** True when `rows` matches the tidy panel schema panelReshape.ts
 * produces: { Category, Section, Metric, Value, [Period] }. */
export function isPanelSchema(rows: DataRow[]): boolean {
  if (!rows.length) return false;
  const keys = new Set(Object.keys(rows[0]));
  return keys.has("Category") && keys.has("Section") && keys.has("Metric") && keys.has("Value");
}

export function generatePanelComparisonWidgets(rows: DataRow[]): Omit<Widget, "id">[] {
  const widgets: Omit<Widget, "id">[] = [];
  const periodField = Object.keys(rows[0] ?? {}).includes("Period") ? "Period" : null;
  const hasPeriod = !!periodField && rows.some((r) => r[periodField as string] != null);
  const xField = hasPeriod ? (periodField as string) : "Section";

  const categories = Array.from(new Set(rows.map((r) => String(r.Category)))).sort();
  const sections = Array.from(new Set(rows.map((r) => String(r.Section))));

  let x = 0, y = 0;
  const place = (w: number, h: number): WidgetPosition => {
    if (x + w > COLS) { x = 0; y += h; }
    const pos = { x, y, w, h };
    x += w;
    return pos;
  };

  // 1. One grouped comparison chart per (Section, Metric) — the core
  // deliverable: every section, compared across every category, never
  // collapsed down to a single category.
  for (const section of sections) {
    const metricsInSection = Array.from(
      new Set(rows.filter((r) => String(r.Section) === section).map((r) => String(r.Metric)))
    );
    for (const metric of metricsInSection) {
      const chartType: "grouped_line" | "grouped_bar" = hasPeriod ? "grouped_line" : "grouped_bar";
      widgets.push({
        type: chartType,
        title: `${section} — ${metric}`,
        config: {
          x: xField,
          seriesField: "Category",
          y: "Value",
          agg: "sum",
          filters: [{ field: "Section", value: section }, { field: "Metric", value: metric }],
        },
        position: place(4, 4),
      });
    }
  }

  // 2. Per-category KPI pairs for the first metric of each section, so
  // e.g. "CBE" vs "Industry" totals are visible as plain numbers too,
  // not just chart bars.
  for (const section of sections) {
    const firstMetric = rows.find((r) => String(r.Section) === section)?.Metric;
    if (!firstMetric) continue;
    for (const category of categories) {
      widgets.push({
        type: "kpi",
        title: `${section} (${firstMetric}) — ${category}`,
        config: {
          field: "Value", agg: hasPeriod ? "latest" : "sum",
          filters: [{ field: "Section", value: section }, { field: "Metric", value: String(firstMetric) }, { field: "Category", value: category }],
        },
        position: place(3, 2),
      });
    }
  }

  // 3. Full tidy data table, always last.
  widgets.push({
    type: "table",
    title: "Data table",
    config: { columns: hasPeriod ? [periodField, "Category", "Section", "Metric", "Value"] : ["Category", "Section", "Metric", "Value"], page_size: 25 },
    position: place(12, 6),
  });

  return widgets;
}
