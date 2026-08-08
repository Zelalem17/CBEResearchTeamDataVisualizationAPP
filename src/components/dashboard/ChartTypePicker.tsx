/** Top-of-dashboard control for panel-comparison datasets: lets the data
 * owner / researcher pick which chart kind every Section x Category
 * comparison widget should render as (bar, stacked bar, line, area,
 * pie, scatter, histogram, ...), instead of the dashboard always
 * generating one fixed chart shape for every section. */
import { BarChart3, LineChart, AreaChart, PieChart, ScatterChart, Grid3x3, Activity } from "lucide-react";
import { PANEL_CHART_KINDS, type PanelChartKind } from "@/services/comparisonDashboard";

const ICONS: Record<PanelChartKind, any> = {
  grouped_bar: BarChart3,
  stacked_bar: Grid3x3,
  grouped_line: LineChart,
  grouped_area: AreaChart,
  pie: PieChart,
  category_scatter: ScatterChart,
  histogram: Activity,
};

interface Props {
  value: PanelChartKind;
  onChange: (kind: PanelChartKind) => void;
  sectionCount: number;
}

export default function ChartTypePicker({ value, onChange, sectionCount }: Props) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Comparison chart type
        </span>
        <span className="text-[11px] text-gray-400">
          Applies to all {sectionCount} section{sectionCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {PANEL_CHART_KINDS.map(({ kind, label, description }) => {
          const Icon = ICONS[kind];
          const active = value === kind;
          return (
            <button
              key={kind}
              type="button"
              title={description}
              onClick={() => onChange(kind)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                active
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                  : "border-gray-200 dark:border-gray-700 hover:border-brand-300 text-gray-600 dark:text-gray-300"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
