import { useState } from "react";
import { Filter, Search, X, Plus } from "lucide-react";
import type { ColumnProfile, FilterRule } from "@/types";

interface GlobalFiltersProps {
  columns: ColumnProfile[];
  filters: FilterRule[];
  onChange: (filters: FilterRule[]) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

/** Global filter bar: free-text search across all columns, plus structured
 * filter chips (field + operator + value) that apply to every widget on
 * the active dashboard tab. */
export default function GlobalFilters({ columns, filters, onChange, searchTerm, onSearchChange }: GlobalFiltersProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [draftField, setDraftField] = useState(columns[0]?.name ?? "");

  const dimensionCols = columns.filter((c) => c.role === "dimension" || c.role === "date");

  const addFilter = () => {
    const col = columns.find((c) => c.name === draftField);
    if (!col) return;
    const defaultValue = col.stats?.top_categories?.[0]?.value ?? col.sample_values?.[0] ?? "";
    onChange([
      ...filters,
      { id: crypto.randomUUID(), field: draftField, operator: "equals", value: defaultValue },
    ]);
    setShowAdd(false);
  };

  const removeFilter = (id: string) => onChange(filters.filter((f) => f.id !== id));

  const updateFilterValue = (id: string, value: any) =>
    onChange(filters.map((f) => (f.id === id ? { ...f, value } : f)));

  return (
    <div className="card p-3 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5 min-w-[220px]">
        <Search size={15} className="text-gray-400 shrink-0" />
        <input
          className="bg-transparent text-sm outline-none w-full"
          placeholder="Search all data…"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />

      <Filter size={14} className="text-gray-400" />

      {filters.map((f) => {
        const col = columns.find((c) => c.name === f.field);
        const options = col?.stats?.top_categories?.map((t: any) => t.value) ?? [];
        return (
          <div key={f.id} className="flex items-center gap-1 bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-full pl-3 pr-1 py-1 text-xs font-medium">
            <span>{f.field}:</span>
            {options.length ? (
              <select
                className="bg-transparent outline-none text-xs font-semibold"
                value={f.value}
                onChange={(e) => updateFilterValue(f.id, e.target.value)}
              >
                {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <input
                className="bg-transparent outline-none text-xs font-semibold w-20"
                value={f.value}
                onChange={(e) => updateFilterValue(f.id, e.target.value)}
              />
            )}
            <button onClick={() => removeFilter(f.id)} className="p-0.5 rounded-full hover:bg-brand-200 dark:hover:bg-brand-800">
              <X size={12} />
            </button>
          </div>
        );
      })}

      {showAdd ? (
        <div className="flex items-center gap-1">
          <select className="input !py-1 !px-2 text-xs w-32" value={draftField} onChange={(e) => setDraftField(e.target.value)}>
            {dimensionCols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <button className="btn-primary !px-2 !py-1 text-xs" onClick={addFilter}>Add</button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 dark:hover:text-brand-400"
        >
          <Plus size={13} /> Add filter
        </button>
      )}
    </div>
  );
}
