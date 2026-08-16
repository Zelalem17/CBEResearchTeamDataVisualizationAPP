import { FileBarChart, TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import { computeKpiValue } from "@/components/kpi/KpiCard";
import type { DataRow, Widget } from "@/types";

interface ReportPanelProps {
  kpiWidgets: Widget[];
  rows: DataRow[];
  /** Omit to hide the per-metric remove control (viewer-role sessions). */
  onRemove?: (id: string) => void;
}

/** The dashboard's "Report" section: every KPI ("total") widget, laid
 * out as a real table — a responsive 2-column grid of rows (so it's not
 * one long, single-column list) — each with a thick CBE purple rule down
 * the left edge only (no border on the other sides, so it reads as a
 * clean accent, not a boxed-in tile) and full label/value text with
 * nothing truncated.
 *
 * Deliberately a plain block sitting *above* and *outside* the
 * react-grid-layout grid, not a widget inside it, so it's never
 * draggable and always the first thing on the page; the chart grid
 * starts on its own line right below it. */
export default function ReportPanel({ kpiWidgets, rows, onRemove }: ReportPanelProps) {
  if (!kpiWidgets.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-card overflow-hidden">
      <div className="bg-brand-gradient px-5 py-3 flex items-center gap-2">
        <FileBarChart size={16} className="text-gold-300 shrink-0" />
        <h2 className="text-white font-bold text-sm tracking-wide uppercase">Report</h2>
      </div>
      <div className="h-0.5 bg-gold-500" />

      <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {kpiWidgets.map((widget) => {
          const { value, formattedValue, deltaPct } = computeKpiValue(widget, rows);
          const isUp = deltaPct > 0.5;
          const isDown = deltaPct < -0.5;
          return (
            <div
              key={widget.id}
              data-widget-capture={widget.id}
              // Thick left rule in CBE purple, deliberately the *only*
              // border on the cell — a full box around every side would
              // read as a stack of small boxes again, which is exactly
              // what this redesign moved away from.
              className="group relative flex items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border-l-4 border-brand-600 dark:border-brand-500 py-3 pl-4 pr-9"
            >
              {onRemove && (
                <button
                  onClick={() => onRemove(widget.id)}
                  title="Remove metric"
                  className="capture-hide absolute top-1/2 -translate-y-1/2 right-2.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                >
                  <X size={13} />
                </button>
              )}

              {/* Label — wraps fully, never truncated, so a long metric
                  name is always readable end to end. */}
              <p className="min-w-0 flex-1 text-sm font-semibold text-gray-700 dark:text-gray-200 break-words leading-snug">
                {widget.title}
              </p>

              <div className="flex items-center gap-2 shrink-0">
                {/* Value — also never truncated; a big number just takes
                    the room it needs. */}
                <span
                  className="text-lg sm:text-xl font-bold text-brand-700 dark:text-gold-400 tabular-nums whitespace-nowrap"
                  title={value.toLocaleString()}
                >
                  {formattedValue}
                </span>
                <span
                  className={`flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap ${
                    isUp ? "text-emerald-600" : isDown ? "text-rose-600" : "text-gray-400"
                  }`}
                >
                  {isUp ? <TrendingUp size={13} /> : isDown ? <TrendingDown size={13} /> : <Minus size={13} />}
                  {Math.abs(deltaPct).toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
