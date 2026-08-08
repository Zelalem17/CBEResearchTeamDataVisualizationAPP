/** Builds & re-types a dashboard for tidy panel data produced by
 * panelReshape.ts — rows shaped like { Period, Category, Section, Metric,
 * Value }. Rather than generating one fixed chart shape for every
 * section/metric, this exposes a small set of chart "kinds" the data
 * owner can switch between (bar, stacked bar, line, area, pie, scatter,
 * histogram, ...) via a single top-of-dashboard control — every
 * section/metric comparison chart re-renders as the chosen kind at once.
 */
import type { DataRow, Widget, WidgetPosition, WidgetType } from "@/types";

const COLS = 12;

/** True when `rows` matches the tidy panel schema panelReshape.ts
 * produces: { Category, Section, Metric, Value, [Period] }. */
export function isPanelSchema(rows: DataRow[]): boolean {
  if (!rows.length) return false;
  const keys = new Set(Object.keys(rows[0]));
  return keys.has("Category") && keys.has("Section") && keys.has("Metric") && keys.has("Value");
}

/** The chart kinds a researcher can pick from for the Section x Category
 * comparison widgets. One control at the top of the dashboard switches
 * every comparison chart to the chosen kind at once. */
export type PanelChartKind =
  | "grouped_bar"
  | "stacked_bar"
  | "grouped_line"
  | "grouped_area"
  | "pie"
  | "category_scatter"
  | "histogram";

export const PANEL_CHART_KINDS: { kind: PanelChartKind; label: string; description: string }[] = [
  { kind: "grouped_bar", label: "Grouped bar", description: "Categories side-by-side per period" },
  { kind: "stacked_bar", label: "Stacked bar", description: "Categories stacked per period" },
  { kind: "grouped_line", label: "Grouped line", description: "One trend line per category" },
  { kind: "grouped_area", label: "Grouped area", description: "Filled trend line per category" },
  { kind: "pie", label: "Pie (share)", description: "Each category's overall share" },
  { kind: "category_scatter", label: "Scatter (A vs B)", description: "One category plotted against the other" },
  { kind: "histogram", label: "Histogram", description: "Distribution of all values" },
];

function firstMetaField(rows: DataRow[]): { periodField: string | null; hasPeriod: boolean; xField: string } {
  const periodField = Object.keys(rows[0] ?? {}).includes("Period") ? "Period" : null;
  const hasPeriod = !!periodField && rows.some((r) => r[periodField as string] != null);
  const xField = hasPeriod ? (periodField as string) : "Section";
  return { periodField, hasPeriod, xField };
}

/** Sensible starting kind: a trend line when data spans periods, a bar
 * chart when it doesn't (nothing to trend against). */
export function defaultPanelChartKind(rows: DataRow[]): PanelChartKind {
  return firstMetaField(rows).hasPeriod ? "grouped_line" : "grouped_bar";
}

/** Builds the {type, config} pair for one Section/Metric comparison
 * widget, for whichever chart kind is currently selected. Every variant
 * carries `comparisonKey` so retypeComparisonWidgets() can find and
 * re-render these widgets (and only these) when the kind changes. */
function buildComparisonWidgetSpec(kind: PanelChartKind, xField: string, section: string, metric: string): { type: WidgetType; config: Record<string, any> } {
  const filters = [{ field: "Section", value: section }, { field: "Metric", value: metric }];
  const comparisonKey = { section, metric };

  switch (kind) {
    case "stacked_bar":
      return { type: "grouped_bar", config: { x: xField, y: "Value", seriesField: "Category", agg: "sum", stacked: true, filters, comparisonKey } };
    case "grouped_line":
      return { type: "grouped_line", config: { x: xField, y: "Value", seriesField: "Category", agg: "sum", filters, comparisonKey } };
    case "grouped_area":
      return { type: "grouped_line", config: { x: xField, y: "Value", seriesField: "Category", agg: "sum", area: true, filters, comparisonKey } };
    case "pie":
      return { type: "pie", config: { category: "Category", value: "Value", agg: "sum", filters, comparisonKey } };
    case "category_scatter":
      return { type: "category_scatter", config: { x: xField, y: "Value", seriesField: "Category", filters, comparisonKey } };
    case "histogram":
      return { type: "histogram", config: { field: "Value", bins: 10, filters, comparisonKey } };
    case "grouped_bar":
    default:
      return { type: "grouped_bar", config: { x: xField, y: "Value", seriesField: "Category", agg: "sum", filters, comparisonKey } };
  }
}

export function generatePanelComparisonWidgets(rows: DataRow[], kind?: PanelChartKind): Omit<Widget, "id">[] {
  const widgets: Omit<Widget, "id">[] = [];
  const { xField, hasPeriod, periodField } = firstMetaField(rows);
  const effectiveKind = kind ?? defaultPanelChartKind(rows);

  const categories = Array.from(new Set(rows.map((r) => String(r.Category)))).sort();
  const sections = Array.from(new Set(rows.map((r) => String(r.Section))));

  let x = 0, y = 0;
  const place = (w: number, h: number): WidgetPosition => {
    if (x + w > COLS) { x = 0; y += h; }
    const pos = { x, y, w, h };
    x += w;
    return pos;
  };

  // 1. One comparison chart per (Section, Metric), all in the currently
  // selected kind — every section shown, never collapsed to just one.
  for (const section of sections) {
    const metricsInSection = Array.from(
      new Set(rows.filter((r) => String(r.Section) === section).map((r) => String(r.Metric)))
    );
    for (const metric of metricsInSection) {
      const spec = buildComparisonWidgetSpec(effectiveKind, xField, section, metric);
      widgets.push({ type: spec.type, title: `${section} — ${metric}`, config: spec.config, position: place(4, 4) });
    }
  }

  // 2. Per-category KPI pairs for the first metric of each section —
  // unaffected by the chart-kind picker, these are plain numbers.
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

/** Re-renders every comparison chart widget (identified by
 * `config.comparisonKey`, set by buildComparisonWidgetSpec above) as the
 * newly chosen kind, in place — same id, title, and grid position, so a
 * kind switch never disturbs manual layout or the KPI/table widgets. */
export function retypeComparisonWidgets(widgets: Widget[], rows: DataRow[], kind: PanelChartKind): Widget[] {
  const { xField } = firstMetaField(rows);
  return widgets.map((w) => {
    const key = w.config?.comparisonKey;
    if (!key) return w;
    const spec = buildComparisonWidgetSpec(kind, xField, key.section, key.metric);
    return { ...w, type: spec.type, config: spec.config };
  });
}
