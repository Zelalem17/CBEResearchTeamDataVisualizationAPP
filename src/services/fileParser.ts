/** Parses uploaded CSV / Excel files entirely in the browser using
 * PapaParse (CSV) and SheetJS (XLS/XLSX) — no backend required. Also
 * does light cleanup: trims strings, drops fully-empty rows/columns,
 * and coerces numeric-looking strings to numbers.
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { DataRow } from "@/types";

export interface ParsedFile {
  rows: DataRow[];
  sheetNames?: string[];
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

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => resolve({ rows: cleanRows(result.data as DataRow[]) }),
      error: (err) => reject(err),
    });
  });
}

async function parseExcel(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  return { rows: cleanRows(json as DataRow[]), sheetNames: workbook.SheetNames };
}

/** Parse a specific sheet from an already-loaded workbook (used when a
 * user picks a different tab in a multi-sheet Excel file). */
export async function parseExcelSheet(file: File, sheetName: string): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  return { rows: cleanRows(json as DataRow[]), sheetNames: workbook.SheetNames };
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
