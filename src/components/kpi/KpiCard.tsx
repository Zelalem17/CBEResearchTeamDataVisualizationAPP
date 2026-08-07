import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { DataRow, Widget } from "@/types";

interface KpiCardProps {
  widget: Widget;
  rows: DataRow[];
}

function aggregate(rows: DataRow[], field: string, agg: string): number {
  const values = rows.map((r) => Number(r[field])).filter(Number.isFinite);
  if (!values.length) return 0;
  switch (agg) {
    case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
    case "count": return values.length;
    case "min": return Math.min(...values);
    case "max": return Math.max(...values);
    default: return values.reduce((a, b) => a + b, 0);
  }
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function KpiCard({ widget, rows }: KpiCardProps) {
  const { field, agg = "sum" } = widget.config;

  const { value, deltaPct } = useMemo(() => {
    const total = aggregate(rows, field, agg);
    // Split rows in half to approximate a trend indicator (first half vs second half)
    const mid = Math.floor(rows.length / 2);
    const first = aggregate(rows.slice(0, mid), field, agg);
    const second = aggregate(rows.slice(mid), field, agg);
    const delta = first === 0 ? 0 : ((second - first) / Math.abs(first)) * 100;
    return { value: total, deltaPct: delta };
  }, [rows, field, agg]);

  const isUp = deltaPct > 0.5;
  const isDown = deltaPct < -0.5;

  return (
    <div className="h-full flex flex-col justify-between p-1.5">
      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-relaxed">{widget.title}</span>
      <div className="flex items-end justify-between mt-1">
        <span className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{formatNumber(value)}</span>
        <span className={`flex items-center gap-1 text-xs font-semibold ${isUp ? "text-emerald-600" : isDown ? "text-rose-600" : "text-gray-400"}`}>
          {isUp ? <TrendingUp size={14} /> : isDown ? <TrendingDown size={14} /> : <Minus size={14} />}
          {Math.abs(deltaPct).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
