import { useState, useEffect } from "react";
import { Plus, LayoutGrid, Rows3, FolderOpen, UploadCloud, Loader2 } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import Sidebar from "@/components/layout/Sidebar";
import Hero from "@/components/upload/Hero";
import FileUpload from "@/components/upload/FileUpload";
import DatasetSection from "@/components/dashboard/DatasetSection";
import PublishPanel from "@/components/dashboard/PublishPanel";
import { useDashboardStore } from "@/store/dashboardStore";
import { useAuthStore } from "@/store/authStore";
import { fetchPublishedBundle } from "@/services/publish";
import type { Dataset, Widget } from "@/types";

/** Single-page workspace. Two view modes:
 *  - "single": the classic tab switcher — one dataset's dashboard at a time
 *    (sidebar click swaps which one is shown).
 *  - "grid": every imported dataset's full dashboard stacked on one
 *    scrollable page, so several datasets (e.g. four) are all visible
 *    at once. Sidebar clicks scroll to that dataset's section instead.
 * Both modes render through the same <DatasetSection>, so widgets/filters
 * never drift out of sync between the two views.
 *
 * Role gating: "admin" gets upload + edit + rearrange; "viewer" gets a
 * read-only version of the same dashboard (filter/drill-down still work,
 * upload/edit controls are hidden).
 *
 * Publishing: role gating alone doesn't share data between browsers —
 * each browser's uploaded data only ever lives in its own localStorage.
 * On mount, if this browser has nothing loaded yet, it fetches
 * public/data/published.json (see services/publish.ts) and loads that
 * automatically — that's what makes a curated dashboard visible to every
 * viewer, on any device, without them uploading anything themselves.
 */
export default function App() {
  const {
    tabs, activeDatasetId, addDataset, setActiveDataset, removeDataset,
    viewMode, setViewMode, loadPublishedBundle, publishedAt,
  } = useDashboardStore();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const [showUpload, setShowUpload] = useState(Object.keys(tabs).length === 0);
  const [showPublish, setShowPublish] = useState(false);
  // True only while we're checking for a published dashboard on a
  // browser that has nothing loaded yet — avoids flashing "no dataset"
  // before that check has a chance to finish.
  const [checkingPublished, setCheckingPublished] = useState(Object.keys(tabs).length === 0);

  useEffect(() => {
    if (Object.keys(tabs).length > 0) {
      setCheckingPublished(false);
      return;
    }
    let cancelled = false;
    fetchPublishedBundle().then((bundle) => {
      if (cancelled) return;
      if (bundle) {
        loadPublishedBundle(bundle);
        setShowUpload(false);
      }
      setCheckingPublished(false);
    });
    return () => { cancelled = true; };
    // Intentionally runs once on mount — this is a one-time "does a
    // published dashboard exist" check, not a live subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const datasetIds = Object.keys(tabs);
  const datasetList = Object.values(tabs).map((t) => t.dataset);
  const activeTab = activeDatasetId ? tabs[activeDatasetId] : null;

  const handleImported = (dataset: Dataset, widgets: Widget[], rows: any[], panelChartKind?: Parameters<typeof addDataset>[3]) => {
    addDataset(dataset, widgets, rows, panelChartKind);
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
          onRemove={isAdmin ? removeDataset : undefined}
        />

        <main className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50 dark:bg-gray-950">
          {checkingPublished ? (
            <div className="card p-12 text-center text-gray-400 flex flex-col items-center gap-2">
              <Loader2 size={22} className="animate-spin" />
              <p className="text-sm">Checking for a published dashboard…</p>
            </div>
          ) : (
            <>
              {!showUpload && datasetIds.length > 0 && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
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
                    {publishedAt && (
                      <span className="text-[11px] text-gray-400" title={new Date(publishedAt).toLocaleString()}>
                        Published {new Date(publishedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowPublish(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
                        <UploadCloud size={14} /> Publish
                      </button>
                      <button onClick={() => setShowUpload(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
                        <Plus size={14} /> Add dataset
                      </button>
                    </div>
                  )}
                </div>
              )}

              {showUpload && isAdmin && (
                <>
                  {datasetIds.length === 0 && <Hero />}
                  <FileUpload onImported={handleImported} />
                </>
              )}

              {showUpload && !isAdmin && (
                <div className="card p-12 text-center text-gray-400 flex flex-col items-center gap-2">
                  <FolderOpen size={28} className="text-gray-300 dark:text-gray-600" />
                  <p className="font-medium text-gray-500 dark:text-gray-300">No dataset published yet</p>
                  <p className="text-sm max-w-sm">
                    Viewer access doesn't include uploading. Ask an admin to publish a dashboard for you to view here.
                  </p>
                </div>
              )}

              {!showUpload && viewMode === "single" && activeTab && (
                <DatasetSection datasetId={activeTab.dataset.dataset_id} editable={isAdmin} />
              )}

              {!showUpload && viewMode === "grid" && (
                <div className="space-y-10 divide-y divide-gray-200 dark:divide-gray-800">
                  {datasetIds.map((id) => (
                    <div key={id} className="pt-8 first:pt-0">
                      <DatasetSection datasetId={id} showHeader editable={isAdmin} />
                    </div>
                  ))}
                </div>
              )}

              {!showUpload && viewMode === "single" && !activeTab && (
                <div className="card p-12 text-center text-gray-400">
                  Select a dataset from the sidebar{isAdmin ? ", or add a new one." : "."}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {showPublish && <PublishPanel onClose={() => setShowPublish(false)} />}
    </div>
  );
}
