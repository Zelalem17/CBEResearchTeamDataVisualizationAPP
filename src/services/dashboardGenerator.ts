/** Client-side port of dashboard_generator.py: turns a column profile
 * into a suggested set of dashboard widgets (KPI cards, trends, category
 * breakdowns, distributions, correlations, and a data table). */
import type { ColumnProfile, RelationshipHint, Widget, WidgetPosition } from "@/types";

const COLS = 12;

function measures(columns: ColumnProfile[]) {
  return columns.filter((c) => c.role === "measure");
}
function dimensions(columns: ColumnProfile[]) {
  return columns.filter((c) => c.role === "dimension" && (c.dtype === "categorical" || c.dtype === "boolean"));
}
function dates(columns: ColumnProfile[]) {
  return columns.filter((c) => c.role === "date");
}

export function generateWidgets(columns: ColumnProfile[], relationships: RelationshipHint[]): Omit<Widget, "id">[] {
  const meas = measures(columns);
  const dims = dimensions(columns);
  const dts = dates(columns);
  const widgets: Omit<Widget, "id">[] = [];

  let x = 0, y = 0;
  const place = (w: number, h: number): WidgetPosition => {
    if (x + w > COLS) { x = 0; y += h; }
    const pos = { x, y, w, h };
    x += w;
    return pos;
  };

  // 1. KPI cards
  for (const m of meas.slice(0, 4)) {
    widgets.push({ type: "kpi", title: `Total ${m.name}`, config: { field: m.name, agg: "sum" }, position: place(3, 2) });
  }

  // 2. Trend over time
  if (dts.length && meas.length) {
    const dateCol = dts[0].name;
    for (const m of meas.slice(0, 2)) {
      widgets.push({ type: "line", title: `${m.name} over time`, config: { x: dateCol, y: m.name, agg: "sum" }, position: place(6, 4) });
    }
  }

  // 3. Category analysis
  if (dims.length && meas.length) {
    const primary = meas[0].name;
    for (const d of dims.slice(0, 3)) {
      widgets.push({ type: "bar", title: `${primary} by ${d.name}`, config: { x: d.name, y: primary, agg: "sum" }, position: place(6, 4) });
    }
    const smallest = dims.reduce((a, b) => (a.distinct_count <= b.distinct_count ? a : b));
    widgets.push({ type: "pie", title: `Share of ${primary} by ${smallest.name}`, config: { category: smallest.name, value: primary, agg: "sum" }, position: place(4, 4) });
  }

  // 4. Distribution
  for (const m of meas.slice(0, 2)) {
    widgets.push({ type: "histogram", title: `Distribution of ${m.name}`, config: { field: m.name, bins: 20 }, position: place(4, 4) });
  }

  // 5. Comparison (top correlation)
  const corrRels = relationships.filter((r) => r.kind === "correlation");
  if (corrRels.length) {
    const top = corrRels.reduce((a, b) => (Math.abs(a.strength) >= Math.abs(b.strength) ? a : b));
    widgets.push({ type: "scatter", title: `${top.column_a} vs ${top.column_b}`, config: { x: top.column_a, y: top.column_b }, position: place(6, 4) });
  }

  // 6. Correlation heatmap
  if (meas.length >= 3) {
    widgets.push({ type: "heatmap", title: "Correlation matrix", config: { fields: meas.map((m) => m.name) }, position: place(6, 4) });
  }

  // 7. Treemap
  const hierarchyRels = relationships.filter((r) => r.kind === "hierarchy");
  if (hierarchyRels.length && meas.length) {
    const rel = hierarchyRels[0];
    widgets.push({ type: "treemap", title: `${meas[0].name} breakdown`, config: { levels: [rel.column_a, rel.column_b], value: meas[0].name }, position: place(6, 5) });
  }

  // 8. Gauge
  if (meas.length) {
    widgets.push({ type: "gauge", title: `${meas[0].name} (avg vs max)`, config: { field: meas[0].name, agg: "avg" }, position: place(3, 3) });
  }

  // 9. Data table — always
  widgets.push({ type: "table", title: "Data table", config: { columns: columns.map((c) => c.name), page_size: 25 }, position: place(12, 6) });

  return widgets;
}
