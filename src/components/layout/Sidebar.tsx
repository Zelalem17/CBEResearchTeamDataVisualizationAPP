import { X } from "lucide-react";
import type { Dataset } from "@/types";

interface SidebarProps {
  datasets: Dataset[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

/** Lists every dataset imported into the current project, each rendered
 * as its own tab/section — supports "multiple datasets in one project". */
export default function Sidebar({ datasets, activeId, onSelect, onRemove }: SidebarProps) {
  return (
    <aside className="w-56 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shrink-0 overflow-y-auto">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-2">Datasets</p>
      <div className="space-y-1">
        {datasets.map((d) => (
          <div
            key={d.dataset_id}
            onClick={() => onSelect(d.dataset_id)}
            className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-sm ${
              activeId === d.dataset_id
                ? "bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-medium"
                : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate">{d.name}</p>
              <p className="text-[11px] text-gray-400">{d.row_count.toLocaleString()} rows</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(d.dataset_id); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/40 text-gray-400 hover:text-rose-500 shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {datasets.length === 0 && <p className="text-xs text-gray-400 px-2">No datasets yet</p>}
      </div>
    </aside>
  );
}
