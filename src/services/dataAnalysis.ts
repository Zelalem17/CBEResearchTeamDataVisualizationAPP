/** Client-side port of the backend's data_analysis.py: infers column
 * data types and "roles" (measure / dimension / date / identifier),
 * computes summary stats, and detects likely relationships
 * (correlations, shared-key columns). Runs entirely in the browser —
 * no server round-trip needed.
 */
import type { ColumnProfile, DataRow, RelationshipHint } from "@/types";

const DATE_HINTS = ["date", "time", "day", "month", "year", "created", "updated", "timestamp"];
const ID_HINTS = ["id", "code", "uuid", "key", "no.", "number", "sku"];

function looksLikeDate(values: any[], name: string): boolean {
  const lower = name.toLowerCase();
  if (!DATE_HINTS.some((h) => lower.includes(h))) return false;
  const sample = values.slice(0, 50).filter((v) => v !== null && v !== undefined && v !== "");
  if (!sample.length) return false;
  const parsed = sample.filter((v) => !isNaN(Date.parse(String(v))));
  return parsed.length / sample.length > 0.7;
}

function isNumeric(v: any): boolean {
  if (v === null || v === undefined || v === "") return false;
  return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)) && v.trim() !== "");
}

function inferDtypeRole(values: any[], name: string): { dtype: ColumnProfile["dtype"]; role: ColumnProfile["role"] } {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  const lower = name.toLowerCase();

  if (!nonNull.length) return { dtype: "text", role: "dimension" };

  if (looksLikeDate(nonNull, name)) return { dtype: "datetime", role: "date" };

  const boolLike = nonNull.every((v) => typeof v === "boolean" || ["true", "false", "yes", "no"].includes(String(v).toLowerCase()));
  if (boolLike) return { dtype: "boolean", role: "dimension" };

  const numericRatio = nonNull.filter(isNumeric).length / nonNull.length;
  if (numericRatio > 0.9) {
    const nums = nonNull.filter(isNumeric).map(Number);
    const distinct = new Set(nums).size;
    if (ID_HINTS.some((h) => lower.includes(h)) && distinct === nums.length) {
      return { dtype: "numeric", role: "identifier" };
    }
    const allInts = nums.every((n) => Number.isInteger(n));
    if (distinct <= 15 && allInts) return { dtype: "numeric", role: "dimension" };
    return { dtype: "numeric", role: "measure" };
  }

  const distinctRatio = new Set(nonNull.map(String)).size / nonNull.length;
  if (ID_HINTS.some((h) => lower.includes(h)) && distinctRatio > 0.9) {
    return { dtype: "text", role: "identifier" };
  }
  if (distinctRatio < 0.5 || new Set(nonNull.map(String)).size <= 50) {
    return { dtype: "categorical", role: "dimension" };
  }
  return { dtype: "text", role: "dimension" };
}

function columnStats(values: any[], dtype: ColumnProfile["dtype"]): Record<string, any> {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");

  if (dtype === "numeric") {
    const nums = nonNull.filter(isNumeric).map(Number);
    if (!nums.length) return {};
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / nums.length;
    const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length || 1);
    return {
      min: Math.min(...nums), max: Math.max(...nums),
      mean: Math.round(mean * 10000) / 10000,
      std: Math.round(Math.sqrt(variance) * 10000) / 10000,
      sum: Math.round(sum * 100) / 100,
    };
  }

  if (dtype === "categorical" || dtype === "text" || dtype === "boolean") {
    const counts = new Map<string, number>();
    nonNull.forEach((v) => counts.set(String(v), (counts.get(String(v)) ?? 0) + 1));
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { top_categories: top.map(([value, count]) => ({ value, count })) };
  }

  if (dtype === "datetime") {
    const dates = nonNull.map((v) => new Date(String(v))).filter((d) => !isNaN(d.getTime()));
    if (!dates.length) return {};
    return {
      min: new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString(),
      max: new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString(),
    };
  }

  return {};
}

export function profileRows(rows: DataRow[]): { columns: ColumnProfile[]; relationships: RelationshipHint[] } {
  if (!rows.length) return { columns: [], relationships: [] };
  const columnNames = Object.keys(rows[0]);

  const columns: ColumnProfile[] = columnNames.map((name) => {
    const values = rows.map((r) => r[name]);
    const { dtype, role } = inferDtypeRole(values, name);
    const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
    const nullPct = Math.round((1 - nonNull.length / values.length) * 10000) / 100;
    const distinctCount = new Set(nonNull.map(String)).size;
    const sampleValues = Array.from(new Set(nonNull.map(String))).slice(0, 5);

    return { name, dtype, role, null_pct: nullPct, distinct_count: distinctCount, sample_values: sampleValues, stats: columnStats(values, dtype) };
  });

  const relationships = detectRelationships(rows, columns);
  return { columns, relationships };
}

function pearson(rows: DataRow[], a: string, b: string): number {
  const pairs = rows
    .map((r) => [Number(r[a]), Number(r[b])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pairs.length;
  if (n < 2) return 0;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function detectRelationships(rows: DataRow[], columns: ColumnProfile[]): RelationshipHint[] {
  const relationships: RelationshipHint[] = [];

  const numericMeasures = columns.filter((c) => c.dtype === "numeric" && c.role === "measure").map((c) => c.name);
  for (let i = 0; i < numericMeasures.length; i++) {
    for (let j = i + 1; j < numericMeasures.length; j++) {
      const r = pearson(rows, numericMeasures[i], numericMeasures[j]);
      if (Math.abs(r) >= 0.5) {
        relationships.push({ column_a: numericMeasures[i], column_b: numericMeasures[j], kind: "correlation", strength: Math.round(r * 1000) / 1000 });
      }
    }
  }

  const idLike = columns.filter((c) => c.role === "identifier" || c.role === "dimension").map((c) => c.name);
  for (let i = 0; i < idLike.length; i++) {
    for (let j = i + 1; j < idLike.length; j++) {
      const a = idLike[i].toLowerCase().replace(/_/g, "");
      const b = idLike[j].toLowerCase().replace(/_/g, "");
      if (a.includes(b) || b.includes(a)) {
        relationships.push({ column_a: idLike[i], column_b: idLike[j], kind: "hierarchy", strength: 0.6 });
      }
    }
  }

  return relationships;
}
