import { useRef } from "react";
import { Image as ImageIcon, X, GripVertical } from "lucide-react";
import type { DataRow, Widget, WidgetType } from "@/types";
import ChartRenderer from "@/components/charts/ChartRenderer";
import KpiCard from "@/components/kpi/KpiCard";
import DataTable from "@/components/tables/DataTable";
import { exportNodeToPng } from "@/utils/exportUtils";
import { SWITCHABLE_CHART_TYPES, isSwitchableChartType } from "@/services/chartTypeSwitch";

interface WidgetCardProps {
  widget: Widget;
  rows: DataRow[];
  /** Omit to hide the remove control (viewer-role / read-only sessions). */
  onRemove?: () => void;
  onDrillDown?: (field: string, value: string) => void;
  /** Omit to hide the per-widget chart-type dropdown (viewer-role
   * sessions). Works on ANY dataset — not just panel/comparison data —
   * since it re-derives config from whatever fields the widget already
   * used. See services/chartTypeSwitch.ts. */
  onChangeType?: (newType: WidgetType) => void;
}

/** The chrome around every widget: title bar with drag handle, remove
 * button, chart-type switcher, per-widget PNG export, and the widget's
 * own visualization. */
export default function WidgetCard({ widget, rows, onRemove, onDrillDown, onChangeType }: WidgetCardProps) {
  const nodeRef = useRef<HTMLDivElement>(null);

  const handleExportPng = async () => {
    if (nodeRef.current) await exportNodeToPng(nodeRef.current, widget.title.replace(/\s+/g, "_"));
  };

  const canSwitchType = Boolean(onChangeType) && isSwitchableChartType(widget.type);

  return (
    <div ref={nodeRef} data-widget-capture={widget.id} className="card h-full flex flex-col overflow-hidden group">
      <div className={`widget-drag-handle flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 ${onRemove ? "cursor-move" : ""}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {onRemove && <GripVertical size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />}
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{widget.title}</span>
        </div>
        <div className="widget-toolbar flex items-center gap-1 shrink-0">
          {canSwitchType && (
            <select
              value={widget.type}
              onChange={(e) => onChangeType!(e.target.value as WidgetType)}
              onMouseDown={(e) => e.stopPropagation()}
              title="Change chart type"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 text-gray-500 dark:text-gray-300 outline-none max-w-[7.5rem]"
            >
              {SWITCHABLE_CHART_TYPES.map(({ type, label }) => (
                <option key={type} value={type}>{label}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleExportPng}
            onMouseDown={(e) => e.stopPropagation()}
            title="Export PNG"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
          >
            <ImageIcon size={13} />
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              onMouseDown={(e) => e.stopPropagation()}
              title="Remove widget"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/40 text-gray-400 hover:text-rose-500"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 p-2 min-h-0">
        {widget.type === "kpi" && <KpiCard widget={widget} rows={rows} />}
        {widget.type === "table" && <DataTable widget={widget} rows={rows} />}
        {!["kpi", "table"].includes(widget.type) && (
          <ChartRenderer widget={widget} rows={rows} onDrillDown={onDrillDown} />
        )}
      </div>
    </div>
  );
}
