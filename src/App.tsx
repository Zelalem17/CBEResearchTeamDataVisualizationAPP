import { useState } from "react";
import { Plus, LayoutGrid, Rows3 } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import Sidebar from "@/components/layout/Sidebar";
import Hero from "@/components/upload/Hero";
import FileUpload from "@/components/upload/FileUpload";
import DatasetSection from "@/components/dashboard/DatasetSection";
import { useDashboardStore } from "@/store/dashboardStore";
import type { Dataset, Widget } from "@/types";

/** Single-page workspace. Two view modes:
 *  - "single": the classic tab switcher — one dataset's dashboard at a time
 *    (sidebar click swaps which one is shown).
 *  - "grid": every imported dataset's full dashboard stacked on one
 *    scrollable page, so several datasets (e.g. four) are all visible
 *    at once. Sidebar clicks scroll to that dataset's section instead.
 * Both modes render through the same <DatasetSection>, so widgets/filters
 * never drift out of sync between the two views.
 */
export default function App() {
  const {
    tabs, activeDatasetId, addDataset, setActiveDataset, removeDataset,
    viewMode, setViewMode,
  } = useDashboardStore();

  const [showUpload, setShowUpload] = useState(Object.keys(tabs).length === 0);

  const datasetIds = Object.keys(tabs);
  const datasetList = Object.values(tabs).map((t) => t.dataset);
  const activeTab = activeDatasetId ? tabs[activeDatasetId] : null;

  const handleImported = (dataset: Dataset, widgets: Widget[], rows: any[]) => {
    addDataset(dataset, widgets, rows);
    setShowUpload(false);
  };

  const handleSidebarSelect = (id: string) => {
    setShowUpload(false);
    if (viewMode === "grid") {
      setActiveDataset(id);
      document.getElementById(`dataset-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setActiveDataset(id);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <Topbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          datasets={datasetList}
          activeId={activeDatasetId}
          onSelect={handleSidebarSelect}
          onRemove={removeDataset}
        />

        <main className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50 dark:bg-gray-950">
          {!showUpload && datasetIds.length > 0 && (
            <div className="flex items-center justify-between">
              {/* View mode toggle — only meaningful with 2+ datasets loaded */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("single")}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                    viewMode === "single" ? "bg-white dark:bg-gray-700 shadow-sm text-brand-700 dark:text-gold-400" : "text-gray-500"
                  }`}
                >
                  <Rows3 size={13} /> Single dataset
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  disabled={datasetIds.length < 2}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    viewMode === "grid" ? "bg-white dark:bg-gray-700 shadow-sm text-brand-700 dark:text-gold-400" : "text-gray-500"
                  }`}
                  title={datasetIds.length < 2 ? "Import at least 2 datasets to compare them side by side" : "Show every dataset's dashboard at once"}
                >
                  <LayoutGrid size={13} /> All datasets ({datasetIds.length})
                </button>
              </div>

              <button onClick={() => setShowUpload(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
                <Plus size={14} /> Add dataset
              </button>
            </div>
          )}

          {showUpload && (
            <>
              {datasetIds.length === 0 && <Hero />}
              <FileUpload onImported={handleImported} />
            </>
          )}

          {!showUpload && viewMode === "single" && activeTab && (
            <DatasetSection datasetId={activeTab.dataset.dataset_id} />
          )}

          {!showUpload && viewMode === "grid" && (
            <div className="space-y-10 divide-y divide-gray-200 dark:divide-gray-800">
              {datasetIds.map((id) => (
                <div key={id} className="pt-8 first:pt-0">
                  <DatasetSection datasetId={id} showHeader />
                </div>
              ))}
            </div>
          )}

          {!showUpload && viewMode === "single" && !activeTab && (
            <div className="card p-12 text-center text-gray-400">
              Select a dataset from the sidebar, or add a new one.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
