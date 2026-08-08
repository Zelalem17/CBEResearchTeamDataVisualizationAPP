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
  | "grouped_bar" | "grouped_line";

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
