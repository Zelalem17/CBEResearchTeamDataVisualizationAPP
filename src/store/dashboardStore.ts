import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Dataset, Widget, FilterRule, DataRow } from "@/types";

interface DatasetTab {
  dataset: Dataset;
  widgets: Widget[];
  rows: DataRow[];
  filters: FilterRule[];
}

interface DashboardState {
  tabs: Record<string, DatasetTab>;
  activeDatasetId: string | null;
  /** "single" = the classic tab switcher (one dataset's dashboard at a
   * time). "grid" = every imported dataset's full dashboard stacked on
   * one page, so you can see e.g. four datasets simultaneously. */
  viewMode: "single" | "grid";

  addDataset: (dataset: Dataset, widgets: Widget[], rows: DataRow[]) => void;
  setActiveDataset: (datasetId: string) => void;
  removeDataset: (datasetId: string) => void;
  setViewMode: (mode: "single" | "grid") => void;

  updateWidgets: (datasetId: string, widgets: Widget[]) => void;
  addWidget: (datasetId: string, widget: Widget) => void;
  removeWidget: (datasetId: string, widgetId: string) => void;

  setFilters: (datasetId: string, filters: FilterRule[]) => void;
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

      setViewMode: (mode) => set({ viewMode: mode }),

      addDataset: (dataset, widgets, rows) =>
        set((state) => ({
          tabs: { ...state.tabs, [dataset.dataset_id]: { dataset, widgets, rows, filters: [] } },
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

      setFilters: (datasetId, filters) =>
        set((state) => ({
          tabs: { ...state.tabs, [datasetId]: { ...state.tabs[datasetId], filters } },
        })),
    }),
    {
      name: "bi-insights-dashboard-v1",
      storage: safeStorage,
      // Cap what's persisted: keep only the first 2,000 rows per dataset in
      // localStorage so a large import doesn't blow the ~5MB quota. The full
      // row set stays in memory for the current session either way.
      partialize: (state) => ({
        activeDatasetId: state.activeDatasetId,
        viewMode: state.viewMode,
        tabs: Object.fromEntries(
          Object.entries(state.tabs).map(([id, tab]) => [id, { ...tab, rows: tab.rows.slice(0, 2000) }])
        ),
      }) as unknown as DashboardState,
      
    }
  )
);
