import { useRef } from "react";
import { Download, Image as ImageIcon, X, GripVertical } from "lucide-react";
import type { DataRow, Widget } from "@/types";
import ChartRenderer from "@/components/charts/ChartRenderer";
import KpiCard from "@/components/kpi/KpiCard";
import DataTable from "@/components/tables/DataTable";
import { exportNodeToPng } from "@/utils/exportUtils";

interface WidgetCardProps {
  widget: Widget;
  rows: DataRow[];
  /** Omit to hide the remove control (viewer-role / read-only sessions). */
  onRemove?: () => void;
  onDrillDown?: (field: string, value: string) => void;
}

/** The chrome around every widget: title bar with drag handle, remove
 * button, per-widget PNG export, and the widget's own visualization. */
export default function WidgetCard({ widget, rows, onRemove, onDrillDown }: WidgetCardProps) {
  const nodeRef = useRef<HTMLDivElement>(null);

  const handleExportPng = async () => {
    if (nodeRef.current) await exportNodeToPng(nodeRef.current, widget.title.replace(/\s+/g, "_"));
  };

  return (
    <div ref={nodeRef} data-widget-capture={widget.id} className="card h-full flex flex-col overflow-hidden group">
      <div className={`widget-drag-handle flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 ${onRemove ? "cursor-move" : ""}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {onRemove && <GripVertical size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />}
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{widget.title}</span>
        </div>
        <div className="widget-toolbar flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleExportPng}
            onMouseDown={(e) => e.stopPropagation()}
            title="Export PNG"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
          >
            <ImageIcon size={13} />
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              onMouseDown={(e) => e.stopPropagation()}
              title="Remove widget"
              className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/40 text-gray-400 hover:text-rose-500"
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
