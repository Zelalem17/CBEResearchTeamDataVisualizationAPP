import { useCallback, useState } from "react";
import { UploadCloud, Loader2, FileSpreadsheet } from "lucide-react";
import { parseFile, parseExcelSheet } from "@/services/fileParser";
import { profileRows } from "@/services/dataAnalysis";
import { generateWidgets } from "@/services/dashboardGenerator";
import { isPanelSchema, generatePanelComparisonWidgets, defaultPanelChartKind } from "@/services/comparisonDashboard";
import type { Dataset, Widget } from "@/types";

interface FileUploadProps {
  onImported: (dataset: Dataset, widgets: Widget[], rows: any[], panelChartKind?: ReturnType<typeof defaultPanelChartKind>) => void;
}

/** Drag-and-drop / click-to-browse import for CSV & Excel files.
 * Everything happens in the browser: PapaParse/SheetJS parse the file,
 * dataAnalysis.ts profiles the columns, and dashboardGenerator.ts turns
 * that profile into a starter set of widgets. No server involved, so
 * this works when the whole app is hosted as static files (e.g. GitHub
 * Pages) with no backend at all.
 */
export default function FileUpload({ onImported }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);

  const buildDataset = (name: string, rows: any[]) => {
    const { columns, relationships } = profileRows(rows);
    // Sectioned-panel sheets (e.g. CBE vs Industry across ATM/POS/...
    // sections) get comparison-first widgets — every section shown
    // side-by-side by category, in a chart kind the user can switch at
    // any time via the picker at the top of the dashboard.
    const panel = isPanelSchema(rows);
    const panelChartKind = panel ? defaultPanelChartKind(rows) : undefined;
    const rawWidgets = panel
      ? generatePanelComparisonWidgets(rows, panelChartKind)
      : generateWidgets(columns, relationships);
    const widgets: Widget[] = rawWidgets.map((w) => ({ ...w, id: crypto.randomUUID() }));
    const dataset: Dataset = {
      dataset_id: crypto.randomUUID(),
      name,
      row_count: rows.length,
      columns,
      relationships,
    };
    onImported(dataset, widgets, rows, panelChartKind);
  };

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setSheetNames([]);
    try {
      const { rows, sheetNames: sheets } = await parseFile(file);
      if (!rows.length) {
        setError("No data rows found in this file.");
        return;
      }
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      buildDataset(baseName, rows);
      if (sheets && sheets.length > 1) {
        setPendingFile(file);
        setSheetNames(sheets);
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not read this file. Check the format and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePickSheet = async (sheetName: string) => {
    if (!pendingFile) return;
    setLoading(true);
    try {
      const { rows } = await parseExcelSheet(pendingFile, sheetName);
      buildDataset(`${pendingFile.name.replace(/\.[^/.]+$/, "")} — ${sheetName}`, rows);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`card border-2 border-dashed flex flex-col items-center justify-center gap-3 py-14 text-center transition-colors ${
          dragOver ? "border-gold-400 bg-brand-50 dark:bg-brand-900/20" : "border-brand-200 dark:border-gray-700"
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin text-brand-600" size={32} />
            <p className="text-sm text-gray-500">Analysing your data…</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center">
              <UploadCloud size={26} className="text-brand-600 dark:text-gold-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Drop a CSV or Excel file here</p>
              <p className="text-sm text-gray-400">or click to browse — .csv, .xlsx, .xls</p>
              <p className="text-xs text-gray-400 mt-1">Everything runs in your browser — nothing is uploaded anywhere.</p>
            </div>
            <label className="btn-gold cursor-pointer">
              Browse files
              <input
                type="file"
                accept=".csv,.tsv,.xlsx,.xls,.xlsm"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
          </>
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {sheetNames.length > 1 && (
        <div className="card p-3 flex items-center gap-3 text-sm">
          <FileSpreadsheet size={16} className="text-brand-500 shrink-0" />
          <span className="text-gray-500">This workbook has multiple sheets — imported the first one. Add another:</span>
          <div className="flex flex-wrap gap-1.5">
            {sheetNames.map((s) => (
              <button key={s} onClick={() => handlePickSheet(s)} className="btn-secondary !py-1 !px-2 text-xs">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
