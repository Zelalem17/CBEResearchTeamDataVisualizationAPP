import { useEffect, useMemo, useRef, useState } from "react";
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
// Click payload shape doesn't map to a single (field, value) pair for
// these — bar3D gives a 3-tuple, the 3D-pie recipe's `surface` series
// isn't a real pie click target, and a liquid-fill wave isn't
// categorical at all — so drill-down is skipped for them rather than
// filtering on a garbage value.
const NO_DRILLDOWN_TYPES = new Set(["bar3d", "pie3d", "wave"]);

// echarts-gl (bar3D/surface, ~1MB+ of WebGL machinery) and
// echarts-liquidfill are only needed by bar3d/pie3d/wave widgets, which
// most dashboards never use — importing them unconditionally at the top
// of this file (as a side effect, so every chart type could use them)
// was baking that weight into the main JS bundle every visitor
// downloads, which was the biggest single contributor to "the page
// loads very slow." Loading them lazily, only the moment a widget that
// actually needs one is about to render, means the vast majority of
// dashboards (bar/line/pie/etc.) never pay that cost at all.
const NEEDS_GL = new Set(["bar3d", "pie3d"]);
const NEEDS_LIQUID = new Set(["wave"]);
let glLoading: Promise<unknown> | null = null;
let liquidLoading: Promise<unknown> | null = null;
function ensureGlLoaded() {
  if (!glLoading) glLoading = import("echarts-gl");
  return glLoading;
}
function ensureLiquidLoaded() {
  if (!liquidLoading) liquidLoading = import("echarts-liquidfill");
  return liquidLoading;
}

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
                className={`border-t border-gray-50 dark:border-gray-800 ${cbe ? "bg-brand-50 dark:bg-brand-900/20" : ""}`}
              >
                <td
                  className={`px-2 py-1 truncate max-w-[90px] ${cbe ? "text-brand-700 dark:text-brand-300 font-semibold" : "text-gray-700 dark:text-gray-300"}`}
                  title={d.key}
                >
                  {d.key}
                </td>
                <td className={`px-2 py-1 text-right tabular-nums ${cbe ? "text-brand-700 dark:text-brand-300 font-semibold" : "text-gray-700 dark:text-gray-300"}`}>
                  {d.value.toLocaleString()}
                </td>
                <td className={`px-2 py-1 text-right tabular-nums ${cbe ? "text-brand-700 dark:text-brand-300 font-semibold" : "text-gray-500 dark:text-gray-400"}`}>
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
  const needsExtension = NEEDS_GL.has(widget.type) || NEEDS_LIQUID.has(widget.type);
  const [extensionReady, setExtensionReady] = useState(!needsExtension);

  useEffect(() => {
    if (!needsExtension) {
      setExtensionReady(true);
      return;
    }
    setExtensionReady(false);
    let cancelled = false;
    const load = NEEDS_GL.has(widget.type) ? ensureGlLoaded() : ensureLiquidLoaded();
    load.then(() => {
      if (!cancelled) setExtensionReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [widget.type, needsExtension]);

  const option: any = useMemo(() => buildOptionForWidget(widget, rows), [widget, rows]);

  const onEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (!onDrillDown || NO_DRILLDOWN_TYPES.has(widget.type)) return;
        const field = widget.config.x || widget.config.category || widget.config.field;
        const value = params.name ?? params.value;
        if (field && value !== undefined) onDrillDown(field, String(value));
      },
    }),
    [onDrillDown, widget.config, widget.type]
  );

  if (!extensionReady) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-gray-400 gap-2">
        <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-brand-500 animate-spin" />
        Loading chart engine…
      </div>
    );
  }

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
