import { useMemo, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { useThemeStore } from "@/store/themeStore";
import { buildOptionForWidget, getWidgetListData, isCbeLabel } from "./chartConfigBuilders";
import type { DataRow, Widget } from "@/types";

interface ChartRendererProps {
  widget: Widget;
  rows: DataRow[];
  /** Drill-down: called when the user clicks a category/bar/point. */
  onDrillDown?: (field: string, value: string) => void;
  /** Exposes the underlying chart component instance for PNG export. */
  chartRef?: React.MutableRefObject<any>;
}

const DETAILED_TYPES = new Set(["bar_detailed", "pie_detailed"]);

export default function ChartRenderer({ widget, rows, onDrillDown, chartRef }: ChartRendererProps) {
  const isDetailed = DETAILED_TYPES.has(widget.type);

  const chart = (
    <EchartsPanel widget={widget} rows={rows} onDrillDown={onDrillDown} chartRef={chartRef} />
  );

  if (!isDetailed) return chart;

  // "Detailed" bar/pie: the chart stays exactly as-is, plus a
  // value + percentage list next to it (left or right, via
  // config.listPosition) so exact figures are always readable, not
  // just implied by bar height or slice angle.
  const listData = getWidgetListData(widget, rows);
  const listPosition = widget.config?.listPosition === "left" ? "left" : "right";
  const list = <ValueList data={listData} />;

  return (
    <div className="flex h-full w-full min-h-0 gap-2">
      {listPosition === "left" && list}
      <div className="flex-1 min-w-0 h-full">{chart}</div>
      {listPosition === "right" && list}
    </div>
  );
}

function ValueList({ data }: { data: { key: string; value: number; pct: number }[] }) {
  return (
    <div className="w-[38%] min-w-[128px] max-w-[220px] h-full overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-lg">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400">
          <tr>
            <th className="text-left font-medium px-2 py-1.5">Label</th>
            <th className="text-right font-medium px-2 py-1.5">Value</th>
            <th className="text-right font-medium px-2 py-1.5">%</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            const cbe = isCbeLabel(d.key);
            return (
              <tr
                key={d.key}
                className={`border-t border-gray-50 dark:border-gray-800 ${cbe ? "bg-gold-50 dark:bg-gold-900/20" : ""}`}
              >
                <td
                  className={`px-2 py-1 truncate max-w-[90px] ${cbe ? "text-gold-700 dark:text-gold-400 font-semibold" : "text-gray-700 dark:text-gray-300"}`}
                  title={d.key}
                >
                  {d.key}
                </td>
                <td className={`px-2 py-1 text-right tabular-nums ${cbe ? "text-gold-700 dark:text-gold-400 font-semibold" : "text-gray-700 dark:text-gray-300"}`}>
                  {d.value.toLocaleString()}
                </td>
                <td className={`px-2 py-1 text-right tabular-nums ${cbe ? "text-gold-700 dark:text-gold-400 font-semibold" : "text-gray-500 dark:text-gray-400"}`}>
                  {d.pct.toFixed(1)}%
                </td>
              </tr>
            );
          })}
          {!data.length && (
            <tr>
              <td colSpan={3} className="px-2 py-3 text-center text-gray-400">No data</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** The actual ECharts instance — split out so the "detailed" wrapper
 * above can lay it out next to the value list without duplicating the
 * option-building / event-wiring logic. */
function EchartsPanel({ widget, rows, onDrillDown, chartRef }: ChartRendererProps) {
  const theme = useThemeStore((s) => s.theme);
  const localRef = useRef<any>(null);

  const option = useMemo(() => buildOptionForWidget(widget, rows), [widget, rows]);

  const onEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (!onDrillDown) return;
        const field = widget.config.x || widget.config.category || widget.config.field;
        const value = params.name ?? params.value;
        if (field && value !== undefined) onDrillDown(field, String(value));
      },
    }),
    [onDrillDown, widget.config]
  );

  return (
    <ReactECharts
      ref={(instance) => {
        localRef.current = instance;
        if (chartRef) chartRef.current = instance;
      }}
      option={option}
      theme={theme === "dark" ? "dark" : undefined}
      notMerge
      lazyUpdate
      onEvents={onEvents}
      style={{ height: "100%", width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  );
}
