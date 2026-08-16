import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import type { FilterRule } from "@/types";

interface FilterChipProps {
  filter: FilterRule;
  /** Known distinct values for this field, if the column was profiled
   * with top categories — enables the checkbox multi-select. Empty
   * falls back to a single free-text value (for fields with no
   * pre-computed category list). */
  options: string[];
  onChange: (value: string[] | string) => void;
  onRemove: () => void;
}

/** A single filter as a pill: closed, it shows only "Field: selected
 * values" — nothing else — so the bar stays scannable with several
 * filters active. Click it to open a checkbox list and pick as many
 * values as needed (e.g. three different fiscal-year periods at once);
 * the list itself only appears while choosing, not after. */
export default function FilterChip({ filter, options, onChange, onRemove }: FilterChipProps) {
  const [open, setOpen] = useState(false);
  const selected: string[] = Array.isArray(filter.value) ? filter.value.map(String) : [String(filter.value)];

  const summary =
    selected.length === 0
      ? "None"
      : selected.length <= 2
      ? selected.join(", ")
      : `${selected.length} selected`;

  const toggleOption = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt];
    if (next.length === 0) {
      onRemove();
      return;
    }
    onChange(next);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-full pl-3 pr-1 py-1 text-xs font-medium max-w-[220px]"
      >
        <span className="truncate">
          {filter.field}: <strong className="font-semibold">{summary}</strong>
        </span>
        {options.length > 0 && <ChevronDown size={12} className="shrink-0" />}
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-0.5 rounded-full hover:bg-brand-200 dark:hover:bg-brand-800 shrink-0"
        >
          <X size={12} />
        </span>
      </button>

      {open && options.length > 0 && (
        <>
          {/* Click-outside-to-close backdrop, same pattern used by the
              modals elsewhere in this app. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-52 max-h-64 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-1.5">
            {options.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggleOption(opt)}
                  className="accent-brand-600"
                />
                <span className="text-gray-700 dark:text-gray-200 truncate">{opt}</span>
              </label>
            ))}
          </div>
        </>
      )}

      {open && options.length === 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2">
            <input
              autoFocus
              className="input !py-1 !px-2 text-xs w-full"
              value={selected[0] ?? ""}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
