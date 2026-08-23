import { Maximize2 } from "lucide-react";
import GlobalFilters from "@/components/filters/GlobalFilters";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import ChartTypePicker from "@/components/dashboard/ChartTypePicker";
import { useDashboardStore } from "@/store/dashboardStore";
import { isPanelSchema, defaultPanelChartKind } from "@/services/comparisonDashboard";
import { useState, useMemo } from "react";

interface DatasetSectionProps {
  datasetId: string;
  /** Shows a header with the dataset name + a "Focus" button to switch
   * to single-view for this dataset. Used in grid ("all datasets") mode;
   * omitted in single mode since the sidebar already shows the name. */
  showHeader?: boolean;
  /** false for viewer-role sessions: hides "Add widget", drag/resize,
   * per-widget remove, and the chart-type picker's write access — the
   * dashboard renders read-only (filters/drill-down still work). */
  editable?: boolean;
}

/** Renders one dataset's global filters + full drag-and-drop dashboard.
 * Shared by both view modes (single dataset / all datasets at once) so
 * the two modes never drift out of sync with each other. */
export default function DatasetSection({ datasetId, showHeader, editable = true }: DatasetSectionProps) {
  const tab = useDashboardStore((s) => s.tabs[datasetId]);
  const updateWidgets = useDashboardStore((s) => s.updateWidgets);
  const setFilters = useDashboardStore((s) => s.setFilters);
  const setActiveDataset = useDashboardStore((s) => s.setActiveDataset);
  const setViewMode = useDashboardStore((s) => s.setViewMode);
  const setPanelChartKind = useDashboardStore((s) => s.setPanelChartKind);
  const setCategoryOrder = useDashboardStore((s) => s.setCategoryOrder);
  const [searchTerm, setSearchTerm] = useState("");

  const isPanel = useMemo(() => (tab ? isPanelSchema(tab.rows) : false), [tab]);

  if (!tab) return null;

  const handleDrillDown = (field: string, value: string) => {
    const existing = tab.filters.find((f) => f.field === field);
    const next = existing
      ? tab.filters.map((f) => (f.field === field ? { ...f, value } : f))
      : [...tab.filters, { id: crypto.randomUUID(), field, operator: "equals" as const, value }];
    setFilters(datasetId, next);
  };

  return (
    <section id={`dataset-${datasetId}`} className="space-y-3 scroll-mt-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">{tab.dataset.name}</h2>
            <p className="text-xs text-gray-400">{tab.dataset.row_count.toLocaleString()} rows</p>
          </div>
          <button
            onClick={() => { setActiveDataset(datasetId); setViewMode("single"); }}
            className="btn-secondary flex items-center gap-1.5 text-xs"
            title="Focus this dataset in single view"
          >
            <Maximize2 size={13} /> Focus
          </button>
        </div>
      )}

      <GlobalFilters
        columns={tab.dataset.columns}
        filters={tab.filters}
        onChange={(f) => setFilters(datasetId, f)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        rightSlot={
          isPanel && editable ? (
            <ChartTypePicker
              value={tab.panelChartKind ?? defaultPanelChartKind(tab.rows)}
              onChange={(kind) => setPanelChartKind(datasetId, kind)}
            />
          ) : undefined
        }
      />

      <DashboardGrid
        widgets={tab.widgets}
        rows={tab.rows}
        filters={tab.filters}
        searchTerm={searchTerm}
        columns={tab.dataset.columns}
        datasetName={tab.dataset.name}
        onWidgetsChange={(w) => updateWidgets(datasetId, w)}
        onDrillDown={handleDrillDown}
        categoryOrder={tab.categoryOrder}
        onCategoryOrderChange={editable ? (order) => setCategoryOrder(datasetId, order) : undefined}
        editable={editable}
      />
    </section>
  ); 
}
