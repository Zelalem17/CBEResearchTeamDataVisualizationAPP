import type { FilterRule, DataRow } from "@/types";

/** Apply the global filter set (AND semantics) to an in-memory row set.
 * Used for client-side interactivity (search/sort/drill-down) on top of
 * whatever page of data is currently loaded; large aggregations are
 * pushed to the backend via /datasets/{id}/aggregate instead. */
export function applyFilters(rows: DataRow[], filters: FilterRule[]): DataRow[] {
  if (!filters.length) return rows;
  return rows.filter((row) => filters.every((f) => matchesFilter(row, f)));
}

function matchesFilter(row: DataRow, filter: FilterRule): boolean {
  const value = row[filter.field];
  if (value === null || value === undefined) return false;

  switch (filter.operator) {
    case "equals":
      return String(value) === String(filter.value);
    case "in":
      return Array.isArray(filter.value) && filter.value.map(String).includes(String(value));
    case "gt":
      return Number(value) > Number(filter.value);
    case "lt":
      return Number(value) < Number(filter.value);
    case "between": {
      const [min, max] = filter.value as [number, number];
      return Number(value) >= min && Number(value) <= max;
    }
    case "contains":
      return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
    default:
      return true;
  }
}

/** Build a pandas-compatible `.query()` string from filter rules, for
 * server-side export requests (so exported files respect active filters). */
export function filtersToQueryString(filters: FilterRule[]): string | undefined {
  if (!filters.length) return undefined;
  const clauses = filters.map((f) => {
    const field = `\`${f.field}\``;
    switch (f.operator) {
      case "equals": return `${field} == ${formatValue(f.value)}`;
      case "in": return `${field} in [${(f.value as any[]).map(formatValue).join(", ")}]`;
      case "gt": return `${field} > ${formatValue(f.value)}`;
      case "lt": return `${field} < ${formatValue(f.value)}`;
      case "between": {
        const [min, max] = f.value as [number, number];
        return `${field} >= ${min} and ${field} <= ${max}`;
      }
      case "contains": return `${field}.str.contains(${formatValue(f.value)}, case=False, na=False)`;
      default: return "";
    }
  });
  return clauses.filter(Boolean).join(" and ");
}

function formatValue(v: any): string {
  return typeof v === "string" ? `"${v.replace(/"/g, '\\"')}"` : String(v);
}
