/** Parses uploaded CSV / Excel files entirely in the browser using
 * PapaParse (CSV) and SheetJS (XLS/XLSX) — no backend required. Also
 * does light cleanup: trims strings, drops fully-empty rows/columns,
 * and coerces numeric-looking strings to numbers.
 *
 * Before falling back to a plain single-header-row parse, both paths
 * first try panelReshape.ts's two detectors, in order:
 *   1. reshapePanelSheet — "sectioned panel" sheets (two stacked header
 *      rows + a repeating comparison category, e.g. a CBE-vs-Industry
 *      breakdown across ATM / POS / Mobile Banking sections)
 *   2. reshapeWideEntityByPeriod — "wide, one row per entity, one column
 *      per period" sheets (e.g. one row per bank, one column per fiscal
 *      year, with an optional title row above the real header row)
 * Either way, unpivoting into a tidy long format instead of letting
 * SheetJS turn blank/title header cells into meaningless __EMPTY columns
 * is what lets the rest of the app (column profiling, the CBE-vs-others
 * comparison dashboard, filters, CBE-always-first coloring) actually
 * make sense of the data, rather than needing the researcher to
 * reshape their own spreadsheet by hand before uploading it.
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { DataRow } from "@/types";
import { reshapePanelSheet, reshapeWideEntityByPeriod } from "./panelReshape";

export interface ParsedFile {
  rows: DataRow[];
  sheetNames?: string[];
  /** True when one of panelReshape.ts's detectors matched and was
   * applied instead of a plain header-row parse. */
  reshaped?: boolean;
}

export function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    return parseCsv(file);
  }
  if (ext === "xlsx" || ext === "xls" || ext === "xlsm") {
    return parseExcel(file);
  }
  return Promise.reject(new Error(`Unsupported file type: .${ext}`));
}

/** Tries both reshape detectors in order, returning the first match
 * (already cleaned) or null if neither recognized this shape. */
function tryReshapes(aoa: any[][]): DataRow[] | null {
  const sectioned = reshapePanelSheet(aoa);
  if (sectioned.matched) return cleanRows(sectioned.rows);
  const wide = reshapeWideEntityByPeriod(aoa);
  if (wide.matched) return cleanRows(wide.rows);
  return null;
}

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    // First pass: read as a raw grid (no header consumed) so we can
    // check whether this is a sectioned-panel or wide-entity-by-period
    // layout.
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (aoaResult) => {
        const aoa = aoaResult.data as any[][];
        const reshapedRows = tryReshapes(aoa);
        if (reshapedRows) {
          resolve({ rows: reshapedRows, reshaped: true });
          return;
        }
        // Fall back to the normal tidy-table parse.
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (result) => resolve({ rows: cleanRows(result.data as DataRow[]) }),
          error: (err) => reject(err),
        });
      },
      error: (err) => reject(err),
    });
  });
}

async function parseExcel(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const { rows, reshaped } = parseSheet(sheet);
  return { rows, sheetNames: workbook.SheetNames, reshaped };
}

/** Parse a specific sheet from an already-loaded workbook (used when a
 * user picks a different tab in a multi-sheet Excel file). */
export async function parseExcelSheet(file: File, sheetName: string): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[sheetName];
  const { rows, reshaped } = parseSheet(sheet);
  return { rows, sheetNames: workbook.SheetNames, reshaped };
}

function parseSheet(sheet: XLSX.WorkSheet): { rows: DataRow[]; reshaped: boolean } {
  // Try both reshape detectors first, using a raw array-of-arrays read
  // so merged/blank/title header cells are visible as-is.
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) as any[][];
  const reshapedRows = tryReshapes(aoa);
  if (reshapedRows) {
    return { rows: reshapedRows, reshaped: true };
  }
  // Fall back: plain single-header-row parse (the original behavior).
  const json = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  return { rows: cleanRows(json as DataRow[]), reshaped: false };
}

function cleanRows(rows: DataRow[]): DataRow[] {
  const cleaned = rows
    .filter((row) => Object.values(row).some((v) => v !== null && v !== undefined && String(v).trim() !== ""))
    .map((row) => {
      const out: DataRow = {};
      for (const [key, value] of Object.entries(row)) {
        const cleanKey = key.trim();
        if (!cleanKey) continue;
        if (typeof value === "string") {
          const trimmed = value.trim();
          out[cleanKey] = trimmed === "" ? null : trimmed;
        } else if ((value as any) instanceof Date) {
          out[cleanKey] = (value as unknown as Date).toISOString();
        } else {
          out[cleanKey] = value as any;
        }
      }
      return out;
    });

  // Drop columns that are entirely empty
  if (!cleaned.length) return cleaned;
  const keys = Object.keys(cleaned[0]);
  const emptyKeys = keys.filter((k) => cleaned.every((r) => r[k] === null || r[k] === undefined));
  if (!emptyKeys.length) return cleaned;
  return cleaned.map((row) => {
    const out = { ...row };
    emptyKeys.forEach((k) => delete out[k]);
    return out;
  });
}
