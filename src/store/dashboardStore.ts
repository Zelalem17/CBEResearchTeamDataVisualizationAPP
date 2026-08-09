import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Dataset, Widget, FilterRule, DataRow } from "@/types";
import { retypeComparisonWidgets, type PanelChartKind } from "@/services/comparisonDashboard";
import type { PublishedBundle } from "@/services/publish";

export interface DatasetTab {
  dataset: Dataset;
  widgets: Widget[];
  rows: DataRow[];
  filters: FilterRule[];
  /** Currently selected comparison chart kind for panel-shaped datasets
   * (bar / stacked bar / line / area / pie / scatter / histogram).
   * Undefined for ordinary (non-panel) datasets. */
  panelChartKind?: PanelChartKind;
}

interface DashboardState {
  tabs: Record<string, DatasetTab>;
  activeDatasetId: string | null;
  /** "single" = the classic tab switcher (one dataset's dashboard at a
   * time). "grid" = every imported dataset's full dashboard stacked on
   * one page, so you can see e.g. four datasets simultaneously. */
  viewMode: "single" | "grid";
  /** Timestamp of the published.json this browser last loaded, if any
   * — shown as a small "Published <date>" indicator so viewers know
   * they're looking at the admin's published data, not a stale local
   * upload. Null until loadPublishedBundle runs at least once. */
  publishedAt: string | null;

  addDataset: (dataset: Dataset, widgets: Widget[], rows: DataRow[], panelChartKind?: PanelChartKind) => void;
  setActiveDataset: (datasetId: string) => void;
  removeDataset: (datasetId: string) => void;
  setViewMode: (mode: "single" | "grid") => void;

  updateWidgets: (datasetId: string, widgets: Widget[]) => void;
  addWidget: (datasetId: string, widget: Widget) => void;
  removeWidget: (datasetId: string, widgetId: string) => void;

  /** Re-renders every comparison chart in this dataset's dashboard as
   * the chosen kind (grouped bar, stacked bar, line, area, pie, scatter,
   * histogram, ...), in place — layout, KPIs, and the table are untouched. */
  setPanelChartKind: (datasetId: string, kind: PanelChartKind) => void;

  setFilters: (datasetId: string, filters: FilterRule[]) => void;

  /** Loads a published.json bundle (see services/publish.ts) — used on
   * a fresh browser with no local data so every visitor sees the same
   * admin-curated dashboard automatically, no upload needed on their
   * end. Existing local tabs always win on an id collision, so this
   * never clobbers work already in progress in this browser. */
  loadPublishedBundle: (bundle: PublishedBundle) => void;
}

// Wraps localStorage so a quota-exceeded error (large datasets can easily
// hit the ~5MB browser storage limit) degrades gracefully to "don't persist
// this session" instead of crashing the app.
const safeStorage = createJSONStorage<DashboardState>(() => ({
  getItem: (name) => {
    try { return localStorage.getItem(name); } catch { return null; }
  },
  setItem: (name, value) => {
    try { localStorage.setItem(name, value); }
    catch { /* quota exceeded or unavailable — session stays in-memory only */ }
  },
  removeItem: (name) => {
    try { localStorage.removeItem(name); } catch { /* ignore */ }
  },
}));

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      tabs: {},
      activeDatasetId: null,
      viewMode: "single",
      publishedAt: null,

      setViewMode: (mode) => set({ viewMode: mode }),

      addDataset: (dataset, widgets, rows, panelChartKind) =>
        set((state) => ({
          tabs: { ...state.tabs, [dataset.dataset_id]: { dataset, widgets, rows, filters: [], panelChartKind } },
          activeDatasetId: dataset.dataset_id,
        })),

      setActiveDataset: (datasetId) => set({ activeDatasetId: datasetId }),

      removeDataset: (datasetId) =>
        set((state) => {
          const tabs = { ...state.tabs };
          delete tabs[datasetId];
          const remaining = Object.keys(tabs);
          return {
            tabs,
            activeDatasetId: state.activeDatasetId === datasetId ? (remaining[0] ?? null) : state.activeDatasetId,
          };
        }),

      updateWidgets: (datasetId, widgets) =>
        set((state) => ({
          tabs: { ...state.tabs, [datasetId]: { ...state.tabs[datasetId], widgets } },
        })),

      addWidget: (datasetId, widget) =>
        set((state) => ({
          tabs: {
            ...state.tabs,
            [datasetId]: { ...state.tabs[datasetId], widgets: [...state.tabs[datasetId].widgets, widget] },
          },
        })),

      removeWidget: (datasetId, widgetId) =>
        set((state) => ({
          tabs: {
            ...state.tabs,
            [datasetId]: {
              ...state.tabs[datasetId],
              widgets: state.tabs[datasetId].widgets.filter((w) => w.id !== widgetId),
            },
          },
        })),

      setPanelChartKind: (datasetId, kind) =>
        set((state) => {
          const tab = state.tabs[datasetId];
          if (!tab) return {};
          const widgets = retypeComparisonWidgets(tab.widgets, tab.rows, kind);
          return { tabs: { ...state.tabs, [datasetId]: { ...tab, widgets, panelChartKind: kind } } };
        }),

      setFilters: (datasetId, filters) =>
        set((state) => ({
          tabs: { ...state.tabs, [datasetId]: { ...state.tabs[datasetId], filters } },
        })),

      loadPublishedBundle: (bundle) =>
        set((state) => {
          // Local tabs win on id collision — never overwrite work someone
          // already has open in this browser with the published version.
          const mergedTabs = { ...bundle.tabs, ...state.tabs };
          const firstPublishedId = Object.keys(bundle.tabs)[0] ?? null;
          return {
            tabs: mergedTabs,
            activeDatasetId: state.activeDatasetId ?? firstPublishedId,
            publishedAt: bundle.publishedAt,
          };
        }),
    }),
    {
      // Bump this whenever a stored-widget shape changes (like adding
      // `config.comparisonKey` for the chart-type picker) — a version
      // bump makes old localStorage silently ignored instead of loading
      // stale widgets that new code can't recognize.
      name: "bi-insights-dashboard-v2",
      storage: safeStorage,
      // Cap what's persisted: keep only the first 2,000 rows per dataset in
      // localStorage so a large import doesn't blow the ~5MB quota. The full
      // row set stays in memory for the current session either way.
      partialize: (state) => ({
        activeDatasetId: state.activeDatasetId,
        viewMode: state.viewMode,
        publishedAt: state.publishedAt,
        tabs: Object.fromEntries(
          Object.entries(state.tabs).map(([id, tab]) => [id, { ...tab, rows: tab.rows.slice(0, 2000) }])
        ),
      }) as unknown as DashboardState,
    }
  )
);
