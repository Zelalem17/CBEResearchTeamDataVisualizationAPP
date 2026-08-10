import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Image as ImageIcon, X, GripVertical, Maximize2, Minimize2, Percent,
  Circle, Diamond, Square, Triangle, Palette, PieChart,
} from "lucide-react";
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
  /** Omit to hide the value/percent-label toggle (viewer-role sessions,
   * or widget types where it doesn't apply). */
  onToggleLabels?: () => void;
  /** Omit to hide the dot-shape cycle button (line-family widgets only). */
  onCycleSymbol?: () => void;
  /** Omit to hide the bar-design cycle button (bar-family widgets only). */
  onCycleBarStyle?: () => void;
  /** Omit to hide the pie-design cycle button (pie widgets only). */
  onCyclePieStyle?: () => void;
}

// Bar and grouped-bar are clean by default; pie already always shows its
// own value+percent (that one isn't toggleable — it's just how pie
// reads). This is the set of types where the toggle button applies.
const LABEL_TOGGLEABLE_TYPES = new Set(["bar", "bar_detailed", "grouped_bar", "line", "area", "grouped_line"]);
const SYMBOL_TOGGLEABLE_TYPES = new Set(["line", "area", "grouped_line"]);
const BAR_STYLE_TOGGLEABLE_TYPES = new Set(["bar", "bar_detailed", "grouped_bar", "bar_line_combo"]);
const PIE_STYLE_TOGGLEABLE_TYPES = new Set(["pie", "pie_detailed"]);

const SYMBOL_ICONS: Record<string, any> = { circle: Circle, diamond: Diamond, rect: Square, triangle: Triangle };
const SYMBOL_LABELS: Record<string, string> = { circle: "Circle", diamond: "Diamond", rect: "Square", triangle: "Triangle" };
const BAR_STYLE_LABELS: Record<string, string> = { rounded: "Rounded", flat: "Flat", gradient: "Gradient" };
const PIE_STYLE_LABELS: Record<string, string> = { donut: "Donut", solid: "Solid", rose: "Rose (Nightingale)" };

function WidgetBody({ widget, rows, onDrillDown }: Pick<WidgetCardProps, "widget" | "rows" | "onDrillDown">) {
  if (widget.type === "kpi") return <KpiCard widget={widget} rows={rows} />;
  if (widget.type === "table") return <DataTable widget={widget} rows={rows} />;
  return <ChartRenderer widget={widget} rows={rows} onDrillDown={onDrillDown} />;
}

/** The chrome around every widget: title bar with drag handle, remove
 * button, per-widget PNG export, chart-style toggles, expand-to-fullscreen,
 * and the widget's own visualization. */
export default function WidgetCard({
  widget, rows, onRemove, onDrillDown, onToggleLabels, onCycleSymbol, onCycleBarStyle, onCyclePieStyle,
}: WidgetCardProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const labelsOn = !!widget.config?.showLabels;
  const showLabelToggle = !!onToggleLabels && LABEL_TOGGLEABLE_TYPES.has(widget.type);
  const showSymbolToggle = !!onCycleSymbol && SYMBOL_TOGGLEABLE_TYPES.has(widget.type);
  const showBarStyleToggle = !!onCycleBarStyle && BAR_STYLE_TOGGLEABLE_TYPES.has(widget.type);
  const showPieStyleToggle = !!onCyclePieStyle && PIE_STYLE_TOGGLEABLE_TYPES.has(widget.type);

  const symbolShape = widget.config?.symbolShape ?? "circle";
  const SymbolIcon = SYMBOL_ICONS[symbolShape] ?? Circle;
  const barStyle = widget.config?.barStyle ?? "rounded";
  const pieStyle = widget.config?.pieStyle ?? "donut";

  const handleExportPng = async () => {
    if (nodeRef.current) await exportNodeToPng(nodeRef.current, widget.title.replace(/\s+/g, "_"));
  };

  return (
    <div ref={nodeRef} data-widget-capture={widget.id} className="card h-full flex flex-col overflow-hidden group">
      <div className={`widget-drag-handle flex items-start justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 ${onRemove ? "cursor-move" : ""}`}>
        <div className="flex items-start gap-1.5 min-w-0">
          {onRemove && <GripVertical size={14} className="text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />}
          {/* Title wraps instead of truncating with an ellipsis — a
              clipped title on screen was also what ended up baked into
              the PNG/Word/PDF exports, since those capture this same
              DOM node verbatim. */}
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-words leading-snug">
            {widget.title}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {showPieStyleToggle && (
            <button
              onClick={onCyclePieStyle}
              title={`Pie design: ${PIE_STYLE_LABELS[pieStyle]} (click to cycle)`}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
            >
              <PieChart size={13} />
            </button>
          )}
          {showBarStyleToggle && (
            <button
              onClick={onCycleBarStyle}
              title={`Bar design: ${BAR_STYLE_LABELS[barStyle]} (click to cycle)`}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
            >
              <Palette size={13} />
            </button>
          )}
          {showSymbolToggle && (
            <button
              onClick={onCycleSymbol}
              title={`Dot shape: ${SYMBOL_LABELS[symbolShape]} (click to cycle)`}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
            >
              <SymbolIcon size={13} />
            </button>
          )}
          {showLabelToggle && (
            <button
              onClick={onToggleLabels}
              title={labelsOn ? "Hide value/% labels on chart" : "Show value/% labels on chart"}
              aria-pressed={labelsOn}
              className={`p-1 rounded transition-colors ${
                labelsOn
                  ? "bg-gold-100 text-gold-700 dark:bg-gold-900/40 dark:text-gold-400"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              }`}
            >
              <Percent size={13} />
            </button>
          )}
          <button onClick={() => setExpanded(true)} title="Expand" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <Maximize2 size={13} />
          </button>
          <button onClick={handleExportPng} title="Export PNG" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <ImageIcon size={13} />
          </button>
          {onRemove && (
            <button onClick={onRemove} title="Remove widget" className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/30 text-gray-400 hover:text-rose-500">
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 p-2 min-h-0">
        <WidgetBody widget={widget} rows={rows} onDrillDown={onDrillDown} />
      </div>

      {/* Fullscreen view: renders the same widget at (almost) full
          viewport size, on demand, instead of forcing the user to
          drag-resize the grid tile just to read a chart's labels.
          Portaled to <body> because this card lives inside a
          react-grid-layout item positioned with a CSS `transform`,
          which would otherwise become the containing block for a
          `position: fixed` child and clip/misplace it instead of
          covering the real viewport. */}
      {expanded && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setExpanded(false)}
        >
          <div
            className="card w-full h-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-base font-semibold text-gray-800 dark:text-gray-100 break-words leading-snug">
                {widget.title}
              </span>
              <button onClick={() => setExpanded(false)} title="Close" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 shrink-0">
                <Minimize2 size={16} />
              </button>
            </div>
            <div className="flex-1 p-4 min-h-0">
              <WidgetBody widget={widget} rows={rows} onDrillDown={onDrillDown} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
