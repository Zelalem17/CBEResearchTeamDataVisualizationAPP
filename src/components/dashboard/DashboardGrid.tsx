import { useCallback, useRef, useState } from "react";
import GridLayout, { Layout, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Plus, FileSpreadsheet, FileImage, FileText } from "lucide-react";
import type { DataRow, FilterRule, Widget, WidgetType } from "@/types";
import WidgetCard from "./WidgetCard";
import WidgetLibraryModal from "./WidgetLibraryModal";
import { applyFilters } from "@/utils/filterUtils";
import { exportNodeToPdf, exportDashboardToWord, exportRowsToExcel } from "@/utils/exportUtils";
import { computeAutoFitSize } from "@/components/charts/chartConfigBuilders";
import { remapWidgetConfig } from "@/services/chartTypeSwitch";

interface DashboardGridProps {
  widgets: Widget[];
  rows: DataRow[];
  filters: FilterRule[];
  searchTerm: string;
  columns: any[];
  datasetName: string;
  onWidgetsChange: (widgets: Widget[]) => void;
  onDrillDown: (field: string, value: string) => void;
  /** false for viewer-role sessions: hides "Add widget", disables
   * drag/resize, and hides the per-widget remove control. Export
   * buttons stay available either way (read-only export is fine). */
  editable?: boolean;
}

const GRID_COLS = 12;
const ROW_HEIGHT = 64;
const ResponsiveGridLayout = WidthProvider(GridLayout);

/** The customizable dashboard canvas: drag to move, drag corner to resize,
 * "+ widget" to add from the library, per-widget remove, and dashboard-wide
 * export (PNG snapshot / PDF / Excel). Layout is persisted via
 * onWidgetsChange -> caller (DashboardPage) -> PUT /dashboards/{id}/layout.
 */
export default function DashboardGrid({
  widgets, rows, filters, searchTerm, columns, datasetName, onWidgetsChange, onDrillDown, editable = true,
}: DashboardGridProps) {
  const [showLibrary, setShowLibrary] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const filteredRows = applyFilters(
    searchTerm
      ? rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(searchTerm.toLowerCase())))
      : rows,
    filters
  );

  const layout: Layout[] = widgets.map((w) => {
    // Content-aware floor: a chart is never rendered smaller than what
    // its *current* (filtered) data actually needs to display fully —
    // more categories, comparison series, or on-bar labels all raise
    // the floor automatically, so the person never has to hunt for the
    // resize handle and manually drag a graph open just to see it whole.
    // Bumps the rendered size up to that floor and stops the grid's
    // resize handle from dragging back below it; never shrinks a size
    // the person (or a saved layout) already set larger than needed.
    const fit = computeAutoFitSize(w, filteredRows);
    const minW = Math.max(2, fit?.w ?? 2);
    const minH = Math.max(2, fit?.h ?? 2);
    return {
      i: w.id,
      x: w.position.x,
      y: w.position.y,
      w: Math.max(w.position.w, minW),
      h: Math.max(w.position.h, minH),
      minW,
      minH,
    };
  });

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      if (!editable) return;
      const updated = widgets.map((w) => {
        const l = newLayout.find((item) => item.i === w.id);
        return l ? { ...w, position: { x: l.x, y: l.y, w: l.w, h: l.h } } : w;
      });
      onWidgetsChange(updated);
    },
    [widgets, onWidgetsChange, editable]
  );

  const handleAddWidget = (widget: Omit<Widget, "id">) => {
    const maxY = widgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0);
    onWidgetsChange([...widgets, { ...widget, id: crypto.randomUUID(), position: { ...widget.position, y: maxY } }]);
  };

  const handleRemoveWidget = (id: string) => onWidgetsChange(widgets.filter((w) => w.id !== id));

  const handleToggleLabels = (id: string) =>
    onWidgetsChange(
      widgets.map((w) => (w.id === id ? { ...w, config: { ...w.config, showLabels: !w.config?.showLabels } } : w))
    );

  const SYMBOL_CYCLE = ["circle", "diamond", "rect", "triangle"];
  const handleCycleSymbol = (id: string) =>
    onWidgetsChange(
      widgets.map((w) => {
        if (w.id !== id) return w;
        const cur = w.config?.symbolShape ?? "circle";
        const next = SYMBOL_CYCLE[(SYMBOL_CYCLE.indexOf(cur) + 1) % SYMBOL_CYCLE.length];
        return { ...w, config: { ...w.config, symbolShape: next } };
      })
    );

  const BAR_STYLE_CYCLE = ["rounded", "flat", "gradient"];
  const handleCycleBarStyle = (id: string) =>
    onWidgetsChange(
      widgets.map((w) => {
        if (w.id !== id) return w;
        const cur = w.config?.barStyle ?? "rounded";
        const next = BAR_STYLE_CYCLE[(BAR_STYLE_CYCLE.indexOf(cur) + 1) % BAR_STYLE_CYCLE.length];
        return { ...w, config: { ...w.config, barStyle: next } };
      })
    );

  const PIE_STYLE_CYCLE = ["donut", "solid", "rose"];
  const handleCyclePieStyle = (id: string) =>
    onWidgetsChange(
      widgets.map((w) => {
        if (w.id !== id) return w;
        const cur = w.config?.pieStyle ?? "donut";
        const next = PIE_STYLE_CYCLE[(PIE_STYLE_CYCLE.indexOf(cur) + 1) % PIE_STYLE_CYCLE.length];
        return { ...w, config: { ...w.config, pieStyle: next } };
      })
    );

  const handleChangeType = (id: string, newType: WidgetType) =>
    onWidgetsChange(widgets.map((w) => (w.id === id ? remapWidgetConfig(w, newType) : w)));

  const handleExportPdf = async () => {
    if (gridRef.current) await exportNodeToPdf(gridRef.current, datasetName, `${datasetName} — Dashboard`);
  };

  const handleExportExcel = () => exportRowsToExcel(filteredRows, datasetName, datasetName);

  const handleExportWord = async () => {
    if (!gridRef.current) return;
    setExportingWord(true);
    try {
      await exportDashboardToWord(
        gridRef.current,
        widgets.map((w) => ({ id: w.id, title: w.title, gridW: w.position.w })),
        datasetName,
        `${datasetName} — Dashboard Report`,
        filteredRows
      );
    } finally {
      setExportingWord(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{filteredRows.length.toLocaleString()} rows shown</span>
        <div className="flex items-center gap-2">
          {editable && (
            <button onClick={() => setShowLibrary(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
              <Plus size={15} /> Add widget
            </button>
          )}
          <button onClick={handleExportExcel} className="btn-secondary flex items-center gap-1.5 text-sm">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={handleExportWord} disabled={exportingWord} className="btn-secondary flex items-center gap-1.5 text-sm">
            <FileText size={15} /> {exportingWord ? "Generating…" : "Word"}
          </button>
          <button onClick={handleExportPdf} className="btn-secondary flex items-center gap-1.5 text-sm">
            <FileImage size={15} /> PDF
          </button>
        </div>
      </div>

      <div ref={gridRef}>
        <ResponsiveGridLayout
          className="layout"
          layout={layout}
          cols={GRID_COLS}
          rowHeight={ROW_HEIGHT}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".widget-drag-handle"
          isDraggable={editable}
          isResizable={editable}
          compactType="vertical"
          margin={[12, 12]}
        >
          {widgets.map((widget) => (
            <div key={widget.id}>
              <WidgetCard
                widget={widget}
                rows={filteredRows}
                onRemove={editable ? () => handleRemoveWidget(widget.id) : undefined}
                onDrillDown={onDrillDown}
                onToggleLabels={editable ? () => handleToggleLabels(widget.id) : undefined}
                onCycleSymbol={editable ? () => handleCycleSymbol(widget.id) : undefined}
                onCycleBarStyle={editable ? () => handleCycleBarStyle(widget.id) : undefined}
                onCyclePieStyle={editable ? () => handleCyclePieStyle(widget.id) : undefined}
                onChangeType={editable ? (newType: WidgetType) => handleChangeType(widget.id, newType) : undefined}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>

      {showLibrary && (
        <WidgetLibraryModal columns={columns} onAdd={handleAddWidget} onClose={() => setShowLibrary(false)} />
      )}
    </div>
  );
}
