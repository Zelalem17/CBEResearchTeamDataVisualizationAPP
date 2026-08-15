import { FileBarChart, TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import { computeKpiValue } from "@/components/kpi/KpiCard";
import type { DataRow, Widget } from "@/types";

interface ReportPanelProps {
  kpiWidgets: Widget[];
  rows: DataRow[];
  /** Omit to hide the per-metric remove control (viewer-role sessions). */
  onRemove?: (id: string) => void;
}

/** The dashboard's "Report" section: every KPI ("total" / headline
 * number) widget, laid out as real text in a bordered CBE-branded card
 * — purple border, purple/gold header strip — instead of looking like a
 * screenshot. Deliberately a plain block sitting *above* and *outside*
 * the react-grid-layout grid, not a widget inside it, so it's never
 * draggable and always the first thing on the page; the chart grid
 * starts on its own line right below it. */
export default function ReportPanel({ kpiWidgets, rows, onRemove }: ReportPanelProps) {
  if (!kpiWidgets.length) return null;

  return (
    <div className="rounded-2xl border-2 border-brand-600 dark:border-brand-500 bg-white dark:bg-gray-900 shadow-card overflow-hidden">
      <div className="bg-brand-gradient px-5 py-3 flex items-center gap-2">
        <FileBarChart size={16} className="text-gold-300" />
        <h2 className="text-white font-bold text-sm tracking-wide uppercase">Report</h2>
      </div>
      <div className="h-0.5 bg-gold-500" />
      <div className="p-4 sm:p-5">
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
          {kpiWidgets.map((widget) => {
            const { value, formattedValue, deltaPct } = computeKpiValue(widget, rows);
            const isUp = deltaPct > 0.5;
            const isDown = deltaPct < -0.5;
            return (
              <div
                key={widget.id}
                data-widget-capture={widget.id}
                className="group relative rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 p-3"
              >
                {onRemove && (
                  <button
                    onClick={() => onRemove(widget.id)}
                    title="Remove metric"
                    className="absolute top-1.5 right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                  >
                    <X size={12} />
                  </button>
                )}
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 truncate pr-4" title={widget.title}>
                  {widget.title}
                </p>
                <div className="flex items-end justify-between gap-2 min-w-0">
                  <span
                    className="text-2xl font-bold text-brand-700 dark:text-gold-400 tabular-nums truncate"
                    title={value.toLocaleString()}
                  >
                    {formattedValue}
                  </span>
                  <span
                    className={`flex items-center gap-0.5 text-xs font-semibold shrink-0 ${
                      isUp ? "text-emerald-600" : isDown ? "text-rose-600" : "text-gray-400"
                    }`}
                  >
                    {isUp ? <TrendingUp size={12} /> : isDown ? <TrendingDown size={12} /> : <Minus size={12} />}
                    {Math.abs(deltaPct).toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
