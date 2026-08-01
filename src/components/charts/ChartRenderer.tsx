import { useMemo, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { useThemeStore } from "@/store/themeStore";
import { buildOptionForWidget } from "./chartConfigBuilders";
import type { DataRow, Widget } from "@/types";

interface ChartRendererProps {
  widget: Widget;
  rows: DataRow[];
  /** Drill-down: called when the user clicks a category/bar/point. */
  onDrillDown?: (field: string, value: string) => void;
  /** Exposes the underlying chart component instance for PNG export.
   * Typed loosely (any) because echarts-for-react's own ref type
   * (EChartsReact, the component instance) doesn't line up with the
   * underlying echarts EChartsType — we only use it for exportUtils'
   * getEchartsInstance()/getDataURL() calls, not for its TS shape. */
  chartRef?: React.MutableRefObject<any>;
}

export default function ChartRenderer({ widget, rows, onDrillDown, chartRef }: ChartRendererProps) {
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
