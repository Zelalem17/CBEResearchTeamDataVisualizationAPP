/** Builds & re-types a dashboard for tidy panel data produced by
 * panelReshape.ts — rows shaped like { Period, Category, Section, Metric,
 * Value }. Rather than generating one fixed chart shape for every
 * section/metric, this exposes a small set of chart "kinds" the data
 * owner can switch between (bar, stacked bar, line, area, pie, scatter,
 * histogram, ...) via a single top-of-dashboard control — every
 * section/metric comparison chart re-renders as the chosen kind at once.
 */
import type { DataRow, Widget, WidgetPosition, WidgetType } from "@/types";
import { packWidgets } from "./layoutPacking";

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
  | "pie_detailed"
  | "pie3d"
  | "bar_detailed"
  | "bar3d"
  | "wave"
  | "category_scatter"
  | "histogram";

export const PANEL_CHART_KINDS: { kind: PanelChartKind; label: string; description: string }[] = [
  { kind: "grouped_bar", label: "Grouped bar", description: "Categories side-by-side per period" },
  { kind: "bar_detailed", label: "Bar (values + %)", description: "Bars plus a value/percentage list" },
  { kind: "bar3d", label: "Bar (3D)", description: "Period × category as a 3D bar grid" },
  { kind: "stacked_bar", label: "Stacked bar", description: "Categories stacked per period" },
  { kind: "grouped_line", label: "Grouped line", description: "One trend line per category" },
  { kind: "grouped_area", label: "Grouped area", description: "Filled trend line per category" },
  { kind: "pie", label: "Pie (share)", description: "Each category's overall share" },
  { kind: "pie_detailed", label: "Pie (values + %)", description: "Pie plus a value/percentage list" },
  { kind: "pie3d", label: "Pie (3D)", description: "Each category's share, in 3D" },
  { kind: "wave", label: "Wave (CBE's share)", description: "CBE's share of the total as a liquid fill" },
  { kind: "category_scatter", label: "Scatter (A vs B)", description: "One category plotted against the other" },
  { kind: "histogram", label: "Histogram", description: "Distribution of all values" },
];

function firstMetaField(rows: DataRow[]): { periodField: string | null; hasPeriod: boolean; xField: string } {
  const periodField = Object.keys(rows[0] ?? {}).includes("Period") ? "Period" : null;
  const hasPeriod = !!periodField && rows.some((r) => r[periodField as string] != null);
  const xField = hasPeriod ? (periodField as string) : "Section";
  return { periodField, hasPeriod, xField };
}

/** Starting kind for every panel dashboard: always a bar chart. Bar is
 * the most legible default for a side-by-side comparison at a glance;
 * the picker next to the filter bar lets the user switch to line, area,
 * pie, scatter, or histogram whenever they want a different view. */
export function defaultPanelChartKind(_rows: DataRow[]): PanelChartKind {
  return "grouped_bar";
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
    case "pie_detailed":
      return { type: "pie_detailed", config: { category: "Category", value: "Value", agg: "sum", listPosition: "right", filters, comparisonKey } };
    case "pie3d":
      return { type: "pie3d", config: { category: "Category", value: "Value", agg: "sum", filters, comparisonKey } };
    case "bar_detailed":
      return { type: "bar_detailed", config: { x: "Category", y: "Value", agg: "sum", listPosition: "right", showLabels: true, filters, comparisonKey } };
    case "bar3d":
      return { type: "bar3d", config: { x: xField, y: "Value", seriesField: "Category", agg: "sum", filters, comparisonKey } };
    case "wave":
      return { type: "wave", config: { field: "Value", shareOf: { field: "Category", value: "CBE" }, filters, comparisonKey } };
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
      // "Detailed" bar/pie carry a value+percentage list alongside the
      // chart, and the 3D types need real viewport room to read, so
      // both get extra width instead of squeezing into the plain-chart
      // default.
      const isDetailed = spec.type === "bar_detailed" || spec.type === "pie_detailed";
      const is3D = spec.type === "bar3d" || spec.type === "pie3d";
      const isWave = spec.type === "wave";
      const width = isDetailed || is3D ? 8 : isWave ? 4 : 4;
      widgets.push({ type: spec.type, title: `${section} — ${metric}`, config: spec.config, position: place(width, 5) });
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

  return packWidgets(widgets, rows);
}

/** Re-renders every comparison chart widget (identified by
 * `config.comparisonKey`, set by buildComparisonWidgetSpec above) as the
 * newly chosen kind, in place, then re-sorts/re-packs the whole
 * dashboard — switching every comparison chart to e.g. pie at once
 * leaves the old bar-shaped slots a poor fit for the new pie sizes, so
 * this re-flows the layout the same way a fresh generation would rather
 * than leaving stale gaps or overlaps. KPI/table widgets keep their
 * title and id; only position (and, for comparison charts, type/config)
 * changes. */
export function retypeComparisonWidgets(widgets: Widget[], rows: DataRow[], kind: PanelChartKind): Widget[] {
  const { xField } = firstMetaField(rows);
  const retyped = widgets.map((w) => {
    const key = w.config?.comparisonKey;
    if (!key) return w;
    const spec = buildComparisonWidgetSpec(kind, xField, key.section, key.metric);
    return { ...w, type: spec.type, config: spec.config };
  });
  return packWidgets(retyped, rows);
}
