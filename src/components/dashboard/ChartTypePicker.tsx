/** Compact chart-type dropdown, meant to sit inline next to the filter
 * bar (see GlobalFilters' `rightSlot`) rather than as its own block.
 * Lets the data owner / researcher switch every Section x Category
 * comparison chart between bar, stacked bar, line, area, pie, scatter,
 * or histogram — never locked to whatever the dashboard defaulted to. */
import { BarChart3 } from "lucide-react";
import { PANEL_CHART_KINDS, type PanelChartKind } from "@/services/comparisonDashboard";

interface Props {
  value: PanelChartKind;
  onChange: (kind: PanelChartKind) => void;
}

export default function ChartTypePicker({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5" title="Chart type for the comparison charts below">
      <BarChart3 size={14} className="text-gray-400 shrink-0" />
      <select
        className="input !py-1.5 !px-2 text-xs font-medium w-auto"
        value={value}
        onChange={(e) => onChange(e.target.value as PanelChartKind)}
      >
        {PANEL_CHART_KINDS.map(({ kind, label }) => (
          <option key={kind} value={kind}>{label}</option>
        ))}
      </select>
    </div>
  );
}
