/** Generalizes chart-type switching beyond the CBE/Industry-style panel
 * dashboards: lets ANY chart widget — on ANY dataset, panel-shaped or an
 * ordinary tidy table — be switched between bar / line / area / pie /
 * scatter / histogram / gauge / grouped-bar / grouped-line / category
 * scatter, by re-deriving that widget's config from whatever fields it
 * was already using. Table and KPI widgets aren't chart types in this
 * sense (different shape entirely) and are excluded.
 */
import type { Widget, WidgetType } from "@/types";

/** Chart types the quick-switch dropdown offers. Deliberately excludes
 * heatmap/treemap (need a field list or hierarchy, not a single x/y pair)
 * and kpi/table (not charts) — those keep their original type. */
export const SWITCHABLE_CHART_TYPES: { type: WidgetType; label: string }[] = [
  { type: "bar", label: "Bar" },
  { type: "bar_detailed", label: "Bar (values + %)" },
  { type: "bar3d", label: "Bar (3D)" },
  { type: "bar_line_combo", label: "Bar + line (Pareto)" },
  { type: "bar_line_series", label: "Bar + line (compare)" },
  { type: "line", label: "Line" },
  { type: "area", label: "Area" },
  { type: "pie", label: "Pie" },
  { type: "pie_detailed", label: "Pie (values + %)" },
  { type: "pie3d", label: "Pie (3D)" },
  { type: "wave", label: "Wave (liquid fill)" },
  { type: "scatter", label: "Scatter" },
  { type: "histogram", label: "Histogram" },
  { type: "gauge", label: "Gauge" },
  { type: "grouped_bar", label: "Grouped bar" },
  { type: "grouped_line", label: "Grouped line" },
  { type: "category_scatter", label: "Scatter (A vs B)" },
];
const SWITCHABLE_TYPE_SET = new Set(SWITCHABLE_CHART_TYPES.map((t) => t.type));

export function isSwitchableChartType(type: WidgetType): boolean {
  return SWITCHABLE_TYPE_SET.has(type);
}

/** Pulls out the "x-like" field, "y/value-like" field, series field
 * (if any), and aggregation from whatever shape the current config
 * happens to be in — bar/line/area use x+y, pie uses category+value,
 * histogram/gauge use a single field, scatter uses x+y with no agg,
 * grouped_* adds seriesField. Falling back across all of these means
 * this works regardless of which type the widget started as. */
function extractSemanticFields(config: Record<string, any>) {
  const xField: string | undefined = config.x ?? config.category ?? config.field ?? config.levels?.[0];
  const yField: string | undefined = config.y ?? config.value ?? config.field;
  const seriesField: string | undefined = config.seriesField;
  const agg: string = config.agg ?? "sum";
  return { xField, yField, seriesField, agg };
}

/** Rebuilds a widget's config for `newType`, reusing whatever x/y/series
 * fields (and any `filters`/`comparisonKey`, so panel-comparison charts
 * stay filtered to their section+metric) the widget already had. Title
 * and position are left untouched — only type + config change. */
export function remapWidgetConfig(widget: Widget, newType: WidgetType): Widget {
  const { xField, yField, seriesField, agg } = extractSemanticFields(widget.config ?? {});
  const carryOver: Record<string, any> = {};
  if (widget.config?.filters) carryOver.filters = widget.config.filters;
  if (widget.config?.comparisonKey) carryOver.comparisonKey = widget.config.comparisonKey;

  let config: Record<string, any>;
  switch (newType) {
    case "pie":
    case "pie_detailed":
      config = { category: xField, value: yField, agg, ...(newType === "pie_detailed" ? { listPosition: widget.config?.listPosition ?? "right" } : {}), ...carryOver };
      break;
    case "scatter":
      config = { x: xField, y: yField, ...carryOver };
      break;
    case "category_scatter":
      config = { x: xField, y: yField, seriesField: seriesField ?? xField, ...carryOver };
      break;
    case "grouped_bar":
      config = { x: xField, y: yField, seriesField: seriesField ?? xField, agg, showLabels: !!widget.config?.showLabels, ...carryOver };
      break;
    case "grouped_line":
      config = { x: xField, y: yField, seriesField: seriesField ?? xField, agg, ...carryOver };
      break;
    case "histogram":
      config = { field: yField ?? xField, bins: widget.config?.bins ?? 20, ...carryOver };
      break;
    case "gauge":
      config = { field: yField ?? xField, agg: agg === "sum" ? "avg" : agg, ...carryOver };
      break;
    case "bar_detailed":
      config = { x: xField, y: yField, agg, listPosition: widget.config?.listPosition ?? "right", showLabels: widget.config?.showLabels ?? true, ...carryOver };
      break;
    case "bar3d":
      config = { x: xField, y: yField, seriesField: seriesField ?? xField, agg, ...carryOver };
      break;
    case "bar_line_combo":
      config = { x: xField, y: yField, agg, barStyle: widget.config?.barStyle, ...carryOver };
      break;
    case "bar_line_series":
      config = { x: xField, y: yField, seriesField: seriesField ?? xField, agg, showLabels: !!widget.config?.showLabels, symbolShape: widget.config?.symbolShape, barStyle: widget.config?.barStyle, ...carryOver };
      break;
    case "pie3d":
      config = { category: xField, value: yField, agg, ...carryOver };
      break;
    case "wave":
      config = { field: yField ?? xField, agg: agg === "sum" ? "avg" : agg, max: widget.config?.max, ...carryOver };
      break;
    case "bar":
      config = { x: xField, y: yField, agg, showLabels: !!widget.config?.showLabels, ...carryOver };
      break;
    case "line":
    case "area":
    default:
      config = { x: xField, y: yField, agg, ...carryOver };
      break;
  }

  return { ...widget, type: newType, config };
}
