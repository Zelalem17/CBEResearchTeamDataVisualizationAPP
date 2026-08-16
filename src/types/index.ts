export type ColumnDType = "numeric" | "categorical" | "datetime" | "text" | "boolean" | "identifier";
export type ColumnRole = "measure" | "dimension" | "date" | "identifier";

export interface ColumnProfile {
  name: string;
  dtype: ColumnDType;
  role: ColumnRole;
  null_pct: number;
  distinct_count: number;
  sample_values: string[];
  stats: Record<string, any>;
}

export interface RelationshipHint {
  column_a: string;
  column_b: string;
  kind: "correlation" | "shared_key" | "hierarchy";
  strength: number;
}

export type WidgetType =
  | "kpi" | "bar" | "line" | "pie" | "area" | "scatter"
  | "histogram" | "heatmap" | "treemap" | "gauge" | "table"
  | "grouped_bar" | "grouped_line" | "category_scatter"
  // Same chart as "grouped_bar" but with value/% labels defaulted on,
  // alongside the plain one (which keeps its own show/hide toggle).
  | "grouped_bar_detailed"
  // "Detailed" variants: same underlying chart as "bar"/"pie", rendered
  // side-by-side with a value + percentage list (config.listPosition:
  // "left" | "right", default "right") so exact numbers are always
  // readable, not just implied by bar height / slice angle.
  | "bar_detailed" | "pie_detailed"
  // Bar + line combined (Pareto-style: bars + cumulative % line).
  | "bar_line_combo"
  // Bar + line combined as two actual data series (e.g. CBE as bars,
  // Industry as a line) rather than one field's cumulative %.
  | "bar_line_series"
  // 3D bar (echarts-gl) and 3D pie (echarts-gl, via a parametric-surface
  // recipe), and a liquid "wave" fill for a single ratio/percentage.
  | "bar3d" | "pie3d" | "wave"
  // Ridgeline ("joyplot": overlapping filled curves, one per category)
  // and streamgraph (ECharts' native themeRiver: flowing stacked bands
  // over time) — both good for comparing several categories' shapes/
  // shares over a shared x-axis at a glance.
  | "ridgeline" | "streamgraph";

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  config: Record<string, any>;
  position: WidgetPosition;
}

export interface Dataset {
  dataset_id: string;
  name: string;
  row_count: number;
  columns: ColumnProfile[];
  relationships: RelationshipHint[];
  suggested_widgets?: Omit<Widget, "id">[];
}

export interface FilterRule {
  id: string;
  field: string;
  operator: "equals" | "in" | "gt" | "lt" | "between" | "contains";
  value: any;
}

export interface DataRow {
  [key: string]: string | number | boolean | null;
}
