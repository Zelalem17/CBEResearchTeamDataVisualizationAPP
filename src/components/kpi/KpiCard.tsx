import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { DataRow, Widget } from "@/types";

interface KpiCardProps {
  widget: Widget;
  rows: DataRow[];
}

/** Optional widget-level prefilters (config.filters: [{field, value}]),
 * same mechanism as the chart builders — lets a KPI isolate e.g.
 * { Section: "ATM", Category: "CBE" } from the rest of the dataset. */
function applyConfigFilters(rows: DataRow[], filters?: { field: string; value: string }[]): DataRow[] {
  if (!filters?.length) return rows;
  return rows.filter((row) => filters.every((f) => String(row[f.field] ?? "") === String(f.value)));
}

function aggregate(rows: DataRow[], field: string, agg: string): number {
  const values = rows.map((r) => Number(r[field])).filter(Number.isFinite);
  if (!values.length) return 0;
  switch (agg) {
    case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
    case "count": return values.length;
    case "min": return Math.min(...values);
    case "max": return Math.max(...values);
    case "latest": return values[values.length - 1];
    default: return values.reduce((a, b) => a + b, 0);
  }
}

/** Detects a unit already declared in the metric's own name — e.g.
 * "Total Deposits in Millions" or "(In Millions Birr)" — so a value
 * that's already expressed in millions doesn't ALSO get a "M" suffix
 * computed from its raw magnitude on top of that. Stacking both would
 * silently read as 1,000,000× smaller than the real figure (e.g. a
 * deposits figure of 1,175,455.6 — already millions of Birr, i.e.
 * ~1.18 trillion Birr — naively abbreviating by raw size would show
 * "1.2M", which reads as 1.2 million of *something*, not 1.18 trillion
 * Birr): once the label says the unit, trust that instead of guessing
 * again from the number itself. */
function detectDeclaredUnit(label: string): string | null {
  const t = label.toLowerCase();
  if (/\bbillion/.test(t)) return "B";
  if (/\bmillion/.test(t)) return "M";
  if (/\bthousand/.test(t)) return "K";
  return null;
}

export function formatNumber(n: number, unitLabel?: string): string {
  const declaredUnit = unitLabel ? detectDeclaredUnit(unitLabel) : null;
  if (declaredUnit) {
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}${declaredUnit}`;
  }
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Scales the headline number's font size down as its formatted text
 * gets longer, the same idea as the chart auto-fit sizing: content
 * decides how much room it needs rather than a single fixed size
 * clipping or overflowing depending on the data. */
function valueFontSizeClass(formatted: string): string {
  const len = formatted.length;
  if (len <= 6) return "text-3xl";
  if (len <= 9) return "text-2xl";
  if (len <= 12) return "text-xl";
  return "text-lg";
}

/** Single source of truth for a KPI widget's number + trend — used by
 * this component on screen, and reused as-is by the Word export
 * (exportUtils.ts) so the exported report's KPI section always matches
 * exactly what's on screen instead of drifting out of sync with a
 * second, hand-copied implementation. */
export function computeKpiValue(widget: Widget, rows: DataRow[]): { value: number; deltaPct: number; formattedValue: string } {
  const { field, agg = "sum", filters } = widget.config;
  const scoped = applyConfigFilters(rows, filters);
  const total = aggregate(scoped, field, agg);
  // Split rows in half to approximate a trend indicator (first half vs second half)
  const mid = Math.floor(scoped.length / 2);
  const first = aggregate(scoped.slice(0, mid), field, agg);
  const second = aggregate(scoped.slice(mid), field, agg);
  const delta = first === 0 ? 0 : ((second - first) / Math.abs(first)) * 100;
  return { value: total, deltaPct: delta, formattedValue: formatNumber(total, widget.title) };
}

export default function KpiCard({ widget, rows }: KpiCardProps) {
  const { value, deltaPct, formattedValue } = useMemo(() => computeKpiValue(widget, rows), [widget, rows]);

  const isUp = deltaPct > 0.5;
  const isDown = deltaPct < -0.5;

  return (
    <div className="h-full flex flex-col justify-between p-1.5">
      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-relaxed break-words">{widget.title}</span>
      <div className="flex items-end justify-between gap-2 mt-1 min-w-0">
        <span className={`${valueFontSizeClass(formattedValue)} font-bold text-gray-900 dark:text-white tabular-nums truncate`} title={value.toLocaleString()}>
          {formattedValue}
        </span>
        <span className={`flex items-center gap-1 text-xs font-semibold shrink-0 ${isUp ? "text-emerald-600" : isDown ? "text-rose-600" : "text-gray-400"}`}>
          {isUp ? <TrendingUp size={14} /> : isDown ? <TrendingDown size={14} /> : <Minus size={14} />}
          {Math.abs(deltaPct).toFixed(1)}%
        </span>
      </div>
    </div>
  );
} 
