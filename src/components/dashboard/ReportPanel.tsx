import { useMemo } from "react";
import { FileBarChart, TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import { computeKpiValue } from "@/components/kpi/KpiCard";
import { assignSeriesColors, isCbeLabel, CBE_BRAND_PURPLE } from "@/components/charts/chartConfigBuilders";
import type { DataRow, Widget } from "@/types";

interface ReportPanelProps {
  kpiWidgets: Widget[];
  rows: DataRow[];
  /** Researcher's saved category display order (see
   * CategoryOrderModal/DashboardGrid) — sorts the metric rows the same
   * way it sorts every chart's bars/legend, so the Report panel and the
   * charts below it never disagree about which entity comes first. */
  categoryOrder?: string[];
  /** Omit to hide the per-metric remove control (viewer-role sessions). */
  onRemove?: (id: string) => void;
}

/** A KPI created by the CBE-vs-Industry comparison generator carries a
 * `{ field: "Category", value: "CBE" | "Industry" | ... }` prefilter —
 * this pulls that value out so the metric's left-border color can match
 * whatever color that same category gets in the charts. Returns null
 * for KPIs with no category prefilter (a plain "Total X" metric not
 * scoped to any one entity), which fall back to CBE purple. */
function kpiCategoryLabel(widget: Widget): string | null {
  const filters = widget.config?.filters as { field: string; value: string }[] | undefined;
  const match = filters?.find((f) => f.field.toLowerCase() === "category");
  return match ? String(match.value) : null;
}

/** The dashboard's "Report" section: every KPI ("total") widget, laid
 * out as a real table — a responsive 2-column grid of rows (so it's not
 * one long, single-column list) — each with a thick left rule and full
 * label/value text with nothing truncated.
 *
 * The left rule's color matches whatever color that KPI's own category
 * gets in the charts (CBE purple, each other bank/category its own
 * distinct color from the same shared palette — see
 * chartConfigBuilders.ts's assignSeriesColors) rather than every row
 * defaulting to plain purple regardless of which entity it's about.
 *
 * Deliberately a plain block sitting *above* and *outside* the
 * react-grid-layout grid, not a widget inside it, so it's never
 * draggable and always the first thing on the page; the chart grid
 * starts on its own line right below it. */
export default function ReportPanel({ kpiWidgets, rows, categoryOrder, onRemove }: ReportPanelProps) {
  const orderedKpiWidgets = useMemo(() => {
    return [...kpiWidgets].sort((a, b) => {
      const catA = kpiCategoryLabel(a);
      const catB = kpiCategoryLabel(b);
      if (catA === null || catB === null) return 0;
      if (categoryOrder && categoryOrder.length) {
        const ai = categoryOrder.findIndex((n) => n.toLowerCase() === catA.toLowerCase());
        const bi = categoryOrder.findIndex((n) => n.toLowerCase() === catB.toLowerCase());
        return (ai === -1 ? categoryOrder.length : ai) - (bi === -1 ? categoryOrder.length : bi);
      }
      const aCbe = isCbeLabel(catA);
      const bCbe = isCbeLabel(catB);
      if (aCbe !== bCbe) return aCbe ? -1 : 1;
      return 0;
    });
  }, [kpiWidgets, categoryOrder]);

  const colorByCategory = useMemo(() => {
    const labels = orderedKpiWidgets.map(kpiCategoryLabel).filter((l): l is string => l !== null);
    return assignSeriesColors(labels);
  }, [orderedKpiWidgets]);

  if (!orderedKpiWidgets.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-card overflow-hidden">
      <div className="bg-brand-gradient px-5 py-3 flex items-center gap-2">
        <FileBarChart size={16} className="text-gold-300 shrink-0" />
        <h2 className="text-white font-bold text-sm tracking-wide uppercase">Report</h2>
      </div>
      <div className="h-0.5 bg-gold-500" />

      <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {orderedKpiWidgets.map((widget) => {
          const { value, formattedValue, deltaPct } = computeKpiValue(widget, rows);
          const isUp = deltaPct > 0.5;
          const isDown = deltaPct < -0.5;
          const category = kpiCategoryLabel(widget);
          const accentColor = category ? colorByCategory[category] ?? CBE_BRAND_PURPLE : CBE_BRAND_PURPLE;
          return (
            <div
              key={widget.id}
              data-widget-capture={widget.id}
              // Thick left rule, deliberately the *only* border on the
              // cell — a full box around every side would read as a
              // stack of small boxes again, which is exactly what this
              // redesign moved away from. Color is set inline since it's
              // per-entity and can't be a static Tailwind class.
              style={{ borderLeftColor: accentColor }}
              className="group relative flex items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border-l-4 py-3 pl-4 pr-9"
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
