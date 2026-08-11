import { useState } from "react";
import {
  X, BarChart3, LineChart, PieChart, ScatterChart, AreaChart, Gauge, Grid3x3, Table2, Activity, TrendingUp,
  ListOrdered, Box, Waves, GitCompare,
} from "lucide-react";
import type { ColumnProfile, Widget, WidgetType } from "@/types";

interface WidgetLibraryModalProps {
  columns: ColumnProfile[];
  onAdd: (widget: Omit<Widget, "id">) => void;
  onClose: () => void;
}

const WIDGET_TYPES: { type: WidgetType; label: string; icon: any }[] = [
  { type: "kpi", label: "KPI Card", icon: TrendingUp },
  { type: "bar", label: "Bar chart", icon: BarChart3 },
  { type: "bar_detailed", label: "Bar chart (values + %)", icon: ListOrdered },
  { type: "grouped_bar", label: "Grouped bar (compare)", icon: BarChart3 },
  { type: "bar_line_combo", label: "Bar + line (Pareto)", icon: GitCompare },
  { type: "bar_line_series", label: "Bar + line (compare)", icon: GitCompare },
  { type: "bar3d", label: "3D bar (compare)", icon: Box },
  { type: "line", label: "Line chart", icon: LineChart },
  { type: "grouped_line", label: "Grouped line (compare)", icon: LineChart },
  { type: "area", label: "Area chart", icon: Activity },
  { type: "pie", label: "Pie chart", icon: PieChart },
  { type: "pie_detailed", label: "Pie chart (values + %)", icon: ListOrdered },
  { type: "pie3d", label: "3D pie chart", icon: Box },
  { type: "wave", label: "Wave (liquid fill)", icon: Waves },
  { type: "scatter", label: "Scatter plot", icon: ScatterChart },
  { type: "category_scatter", label: "Scatter (compare A vs B)", icon: ScatterChart },
  { type: "histogram", label: "Histogram", icon: AreaChart },
  { type: "heatmap", label: "Heatmap", icon: Grid3x3 },
  { type: "treemap", label: "Treemap", icon: Grid3x3 },
  { type: "gauge", label: "Gauge", icon: Gauge },
  { type: "table", label: "Data table", icon: Table2 },
];

// Sized generously enough that the chart renders at (close to) its
// natural size out of the box, rather than defaulting to a cramped box
// the user has to manually drag larger just to read labels/legends —
// widgets can still be resized or expanded to fullscreen (the expand
// icon on each widget card) at any time.
const DEFAULT_SIZE: Record<WidgetType, { w: number; h: number }> = {
  kpi: { w: 3, h: 2 }, bar: { w: 6, h: 5 }, line: { w: 6, h: 5 }, area: { w: 6, h: 5 },
  pie: { w: 5, h: 5 }, scatter: { w: 6, h: 5 }, histogram: { w: 5, h: 5 },
  heatmap: { w: 6, h: 5 }, treemap: { w: 6, h: 5 }, gauge: { w: 3, h: 3 }, table: { w: 12, h: 6 },
  grouped_bar: { w: 6, h: 5 }, grouped_line: { w: 6, h: 5 }, category_scatter: { w: 6, h: 5 },
  bar_detailed: { w: 9, h: 5 }, pie_detailed: { w: 9, h: 5 },
  bar_line_combo: { w: 7, h: 6 }, bar_line_series: { w: 7, h: 6 }, bar3d: { w: 7, h: 6 }, pie3d: { w: 6, h: 6 }, wave: { w: 4, h: 4 },
};

/** Modal used to add a new widget to the dashboard: pick a chart type,
 * then map it to fields from the dataset's detected columns. */
export default function WidgetLibraryModal({ columns, onAdd, onClose }: WidgetLibraryModalProps) {
  const [selected, setSelected] = useState<WidgetType | null>(null);
  const measures = columns.filter((c) => c.role === "measure");
  const dimensions = columns.filter((c) => c.role === "dimension" || c.role === "date");

  const [fieldA, setFieldA] = useState(dimensions[0]?.name ?? columns[0]?.name ?? "");
  const [fieldB, setFieldB] = useState(measures[0]?.name ?? columns[1]?.name ?? "");
  const [fieldC, setFieldC] = useState(dimensions[1]?.name ?? dimensions[0]?.name ?? columns[0]?.name ?? "");

  const handleAdd = () => {
    if (!selected) return;
    const size = DEFAULT_SIZE[selected];
    const base = { type: selected, position: { x: 0, y: 0, ...size } };

    let widget: Omit<Widget, "id">;
    switch (selected) {
      case "kpi": widget = { ...base, title: `Total ${fieldB}`, config: { field: fieldB, agg: "sum" } }; break;
      case "wave": widget = { ...base, title: `${fieldB} (share)`, config: { field: fieldB, agg: "avg" } }; break;
      case "pie": widget = { ...base, title: `${fieldB} by ${fieldA}`, config: { category: fieldA, value: fieldB, agg: "sum" } }; break;
      case "pie_detailed": widget = { ...base, title: `${fieldB} by ${fieldA}`, config: { category: fieldA, value: fieldB, agg: "sum", listPosition: "right" } }; break;
      case "pie3d": widget = { ...base, title: `${fieldB} by ${fieldA} (3D)`, config: { category: fieldA, value: fieldB, agg: "sum" } }; break;
      case "bar_detailed": widget = { ...base, title: `${fieldB} by ${fieldA}`, config: { x: fieldA, y: fieldB, agg: "sum", listPosition: "right", showLabels: true } }; break;
      case "bar_line_combo": widget = { ...base, title: `${fieldB} by ${fieldA} (Pareto)`, config: { x: fieldA, y: fieldB, agg: "sum" } }; break;
      case "scatter": widget = { ...base, title: `${fieldA} vs ${fieldB}`, config: { x: fieldA, y: fieldB } }; break;
      case "histogram": widget = { ...base, title: `Distribution of ${fieldB}`, config: { field: fieldB, bins: 20 } }; break;
      case "heatmap": widget = { ...base, title: "Correlation matrix", config: { fields: measures.map((m) => m.name) } }; break;
      case "treemap": widget = { ...base, title: `${fieldB} breakdown`, config: { levels: [fieldA], value: fieldB } }; break;
      case "gauge": widget = { ...base, title: `${fieldB} (avg)`, config: { field: fieldB, agg: "avg" } }; break;
      case "table": widget = { ...base, title: "Data table", config: { columns: columns.map((c) => c.name), page_size: 25 } }; break;
      case "grouped_bar": case "grouped_line": case "category_scatter": case "bar3d": case "bar_line_series":
        widget = { ...base, title: `${fieldB} by ${fieldA}, compared by ${fieldC}`, config: { x: fieldA, y: fieldB, seriesField: fieldC, agg: "sum" } };
        break;
      default: widget = { ...base, title: `${fieldB} by ${fieldA}`, config: { x: fieldA, y: fieldB, agg: "sum" } };
    }
    onAdd(widget);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Add widget</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {WIDGET_TYPES.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setSelected(type)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-colors ${
                selected === type
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                  : "border-gray-200 dark:border-gray-700 hover:border-brand-300"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>

        {selected && selected !== "heatmap" && selected !== "table" && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {["kpi", "histogram", "gauge", "wave"].includes(selected) ? (
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Field</label>
                <select className="input text-sm" value={fieldB} onChange={(e) => setFieldB(e.target.value)}>
                  {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">X / Category</label>
                  <select className="input text-sm" value={fieldA} onChange={(e) => setFieldA(e.target.value)}>
                    {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Y / Value</label>
                  <select className="input text-sm" value={fieldB} onChange={(e) => setFieldB(e.target.value)}>
                    {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </>
            )}
            {(selected === "grouped_bar" || selected === "grouped_line" || selected === "category_scatter" || selected === "bar3d" || selected === "bar_line_series") && (
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Compare by (series)</label>
                <select className="input text-sm" value={fieldC} onChange={(e) => setFieldC(e.target.value)}>
                  {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <button className="btn-primary w-full" disabled={!selected} onClick={handleAdd}>
          Add to dashboard
        </button>
      </div>
    </div>
  );
} 
