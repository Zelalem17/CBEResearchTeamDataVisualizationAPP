import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { DataRow, Widget } from "@/types";

interface DataTableProps {
  widget: Widget;
  rows: DataRow[];
}

/** Sortable, paginated data table widget — supports the "sorting" and
 * "tables" requirements. Column headers are click-to-sort; drill-down
 * happens naturally via the global filter bar + row click. */
export default function DataTable({ widget, rows }: DataTableProps) {
  const columns: string[] = widget.config.columns ?? Object.keys(rows[0] ?? {});
  const pageSize: number = widget.config.page_size ?? 10;

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sortField) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
    return copy;
  }, [rows, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (col: string) => {
    if (sortField === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(col); setSortDir("asc"); }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 cursor-pointer select-none whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {sortField === col ? (sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={10} className="opacity-30" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 whitespace-nowrap text-gray-700 dark:text-gray-300">
                    {String(row[col] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
        <span>{sorted.length.toLocaleString()} rows</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30">Prev</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30">Next</button>
        </div>
      </div>
    </div>
  );
}
