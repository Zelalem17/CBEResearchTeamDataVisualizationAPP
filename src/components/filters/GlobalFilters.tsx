import { useState, type ReactNode } from "react";
import { Filter, Search, Plus } from "lucide-react";
import type { ColumnProfile, FilterRule } from "@/types";
import FilterChip from "./FilterChip";

interface GlobalFiltersProps {
  columns: ColumnProfile[];
  filters: FilterRule[];
  onChange: (filters: FilterRule[]) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  /** Extra control rendered at the end of this same bar (e.g. the
   * chart-type picker) — pushed to the right on wide screens, wraps
   * onto its own line on narrow ones, same as everything else here. */
  rightSlot?: ReactNode;
}

/** Global filter bar: free-text search across all columns, plus structured
 * multi-select filter chips (field + one or more values, e.g. three
 * different fiscal-year periods at once) that apply to every widget on
 * the active dashboard tab. */
export default function GlobalFilters({ columns, filters, onChange, searchTerm, onSearchChange, rightSlot }: GlobalFiltersProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [draftField, setDraftField] = useState(columns[0]?.name ?? "");

  const dimensionCols = columns.filter((c) => c.role === "dimension" || c.role === "date");

  const addFilter = () => {
    const col = columns.find((c) => c.name === draftField);
    if (!col) return;
    const defaultValue = col.stats?.top_categories?.[0]?.value ?? col.sample_values?.[0] ?? "";
    // Always "in" + an array, even for a single starting value — this is
    // what lets the chip grow to multiple selections (e.g. picking
    // 2021/2022, 2022/2023, and 2025/2026 all at once) just by checking
    // more boxes, rather than being locked to one value at a time.
    onChange([
      ...filters,
      { id: crypto.randomUUID(), field: draftField, operator: "in", value: [defaultValue] },
    ]);
    setShowAdd(false);
  };

  const removeFilter = (id: string) => onChange(filters.filter((f) => f.id !== id));

  const updateFilterValue = (id: string, value: string[] | string) =>
    onChange(
      filters.map((f) =>
        f.id === id ? { ...f, operator: Array.isArray(value) ? "in" : "equals", value } : f
      )
    );

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
        const options: string[] = col?.stats?.top_categories?.map((t: any) => String(t.value)) ?? [];
        return (
          <FilterChip
            key={f.id}
            filter={f}
            options={options}
            onChange={(value) => updateFilterValue(f.id, value)}
            onRemove={() => removeFilter(f.id)}
          />
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

      {rightSlot && (
        <>
          <div className="hidden sm:block ml-auto h-6 w-px bg-gray-200 dark:bg-gray-700" />
          <div className="flex items-center">{rightSlot}</div>
        </>
      )}
    </div>
  );
}
