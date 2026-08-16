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
 * out as a real table (Metric / Value / Trend rows) with a thick CBE
 * purple rule down the left edge — not a grid of small boxes, so a long
 * metric name or a big number always has the full row's width to show
 * completely instead of being squeezed into a fixed-width tile.
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

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {kpiWidgets.map((widget) => {
          const { value, formattedValue, deltaPct } = computeKpiValue(widget, rows);
          const isUp = deltaPct > 0.5;
          const isDown = deltaPct < -0.5;
          return (
            <div
              key={widget.id}
              data-widget-capture={widget.id}
              // The thick left border is the CBE-color accent the design
              // calls for — a single rule down the left edge of each row
              // rather than a border around every side, so it reads as
              // one continuous report table rather than a stack of boxes.
              className="group relative flex flex-wrap items-center gap-x-6 gap-y-1 py-3 pl-4 pr-10 border-l-4 border-brand-600 dark:border-brand-500"
            >
              {onRemove && (
                <button
                  onClick={() => onRemove(widget.id)}
                  title="Remove metric"
                  className="capture-hide absolute top-1/2 -translate-y-1/2 right-3 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                >
                  <X size={13} />
                </button>
              )}

              {/* Label — wraps fully, never truncated, so a long metric
                  name is always readable end to end. */}
              <p className="flex-1 min-w-[160px] text-sm font-semibold text-gray-700 dark:text-gray-200 break-words leading-snug">
                {widget.title}
              </p>

              {/* Value — also never truncated; a big number just takes
                  the room it needs. */}
              <span
                className="text-xl sm:text-2xl font-bold text-brand-700 dark:text-gold-400 tabular-nums break-words"
                title={value.toLocaleString()}
              >
                {formattedValue}
              </span>

              <span
                className={`flex items-center gap-1 text-xs font-semibold shrink-0 ${
                  isUp ? "text-emerald-600" : isDown ? "text-rose-600" : "text-gray-400"
                }`}
              >
                {isUp ? <TrendingUp size={13} /> : isDown ? <TrendingDown size={13} /> : <Minus size={13} />}
                {Math.abs(deltaPct).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  ); 
}
