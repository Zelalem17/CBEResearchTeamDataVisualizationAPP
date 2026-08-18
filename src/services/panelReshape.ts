/** Detects and reshapes "sectioned panel" spreadsheets — the layout used
 * by e.g. National Bank / regulator digital-payments tables, where:
 *
 *   Row 1 (group headers):   |      |         |   ATM   |         |  POS  | ...
 *   Row 2 (metric headers):  | Year | Segment | Machines| Txns    | Mach. | ...
 *   Row 3+ (data):           |2021/22| Industry|  6902  |  171.1  | 11760 | ...
 *                            |       | CBE     |  3081  |  118.8  |  4620 | ...
 *
 * i.e. two stacked header rows (a sparse "section" row whose labels apply
 * to a run of columns, and a dense "metric" row underneath it), plus one
 * or more leading "meta" columns that are NOT part of any section — one
 * of which repeats a small set of comparison categories (e.g. CBE vs
 * Industry) on every row, and another of which is sparse/merged (e.g. a
 * fiscal year that's only printed once per group and needs forward-fill).
 *
 * When this shape is detected, the sheet is unpivoted into tidy rows:
 *   { Period, Category, Section, Metric, Value }
 * so every section (ATM, POS, Mobile Banking, ...) and every category
 * (CBE, Industry, ...) becomes directly comparable/filterable — instead
 * of surviving as meaningless "__EMPTY", "__EMPTY_1" columns the way a
 * naive single-header-row parse would produce.
 *
 * This is a client-side, format-agnostic detector: nothing here is
 * hardcoded to "CBE"/"Industry"/"ATM" specifically, so it generalizes to
 * any similarly-shaped grouped panel sheet.
 */
import type { DataRow } from "@/types";

export interface PanelReshapeResult {
  matched: boolean;
  rows: DataRow[];
  meta: {
    periodField: string | null;
    categoryField: string | null;
    sections: string[];
    metrics: string[];
  };
}

function isBlank(v: any): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

function asTrimmedString(v: any): string {
  return String(v).trim();
}

/** Minimum number of distinct (section, metric) data columns required
 * before we trust this is really a grouped panel sheet and not just a
 * normal table with two odd rows at the top. */
const MIN_DATA_COLUMNS = 3;
/** Minimum number of distinct sections required (a sheet with only one
 * "section" isn't meaningfully a multi-section comparison sheet). */
const MIN_SECTIONS = 2;

/**
 * @param aoa Array-of-arrays (raw sheet rows, 0-indexed, no headers
 *   consumed yet) — e.g. from `XLSX.utils.sheet_to_json(sheet, { header: 1 })`
 *   or `Papa.parse(text, { header: false })`.
 */
export function reshapePanelSheet(aoa: any[][]): PanelReshapeResult {
  const empty: PanelReshapeResult = { matched: false, rows: [], meta: { periodField: null, categoryField: null, sections: [], metrics: [] } };
  if (!aoa || aoa.length < 4) return empty;

  const groupRow = aoa[0] ?? [];
  const metricRow = aoa[1] ?? [];
  const width = Math.max(groupRow.length, metricRow.length);
  if (width < 3) return empty;

  // 1. Find where the section/metric header columns begin: the first
  // column where either header row has content. Everything before that
  // is a "meta" column (identifiers like Period / Category), which is
  // required for this shape — a sheet with headers starting at column 0
  // has no room for a comparison category.
  let sectionStart = -1;
  for (let c = 0; c < width; c++) {
    if (!isBlank(groupRow[c]) || !isBlank(metricRow[c])) { sectionStart = c; break; }
  }
  if (sectionStart < 1) return empty;

  // 2. Walk columns left-to-right, forward-filling the section label and
  // pairing it with a metric name. A column with no metric name available
  // (both header rows blank) is skipped entirely — "ignored", per the
  // empty-cell handling this format needs.
  const sectionByCol = new Map<number, { section: string; metric: string }>();
  let currentSection: string | null = null;
  for (let c = sectionStart; c < width; c++) {
    const g = groupRow[c];
    const m = metricRow[c];
    let justStartedSection = false;
    if (!isBlank(g)) {
      currentSection = asTrimmedString(g);
      justStartedSection = true;
    }
    let metricName: string | null = null;
    if (!isBlank(m)) metricName = asTrimmedString(m);
    else if (justStartedSection) metricName = currentSection; // standalone single-column section

    if (currentSection && metricName) {
      sectionByCol.set(c, { section: currentSection, metric: metricName });
    }
  }

  const sections = Array.from(new Set(Array.from(sectionByCol.values()).map((v) => v.section)));
  if (sectionByCol.size < MIN_DATA_COLUMNS || sections.length < MIN_SECTIONS) return empty;

  // 3. Data rows start after the two header rows. Drop rows that are
  // entirely empty (trailing blank rows some exports leave behind).
  const rawDataRows = aoa.slice(2).filter((row) => row && !row.every((v) => isBlank(v)));
  if (!rawDataRows.length) return empty;

  // 4. Classify meta columns (those before sectionStart): a column with
  // zero blanks across all data rows is a fully-populated dimension
  // (typically the comparison category, e.g. CBE vs Industry); a column
  // with some blanks is a sparse/merged field (typically the period,
  // e.g. fiscal year only printed once per group) and needs forward-fill.
  const metaCount = sectionStart;
  const metaBlankCounts: number[] = [];
  for (let c = 0; c < metaCount; c++) {
    metaBlankCounts.push(rawDataRows.filter((r) => isBlank(r[c])).length);
  }

  let periodCol: number | null = null;
  let categoryCol: number | null = null;
  const sparseCols = metaBlankCounts.map((n, i) => ({ i, n })).filter((x) => x.n > 0);
  const denseCols = metaBlankCounts.map((n, i) => ({ i, n })).filter((x) => x.n === 0);
  if (sparseCols.length) periodCol = sparseCols[0].i;
  if (denseCols.length) categoryCol = denseCols.find((x) => x.i !== periodCol)?.i ?? null;
  // Fallback: with only one meta column, treat it as the category (still
  // gives a usable comparison dimension) rather than bailing out.
  if (categoryCol === null && periodCol === null && metaCount >= 1) categoryCol = 0;
  if (categoryCol === null) return empty; // no usable comparison dimension found

  // 5. Forward-fill sparse meta columns (merged-cell periods) down
  // through the data rows.
  const lastVal: any[] = new Array(metaCount).fill(null);
  const filledRows = rawDataRows.map((row) => {
    const next = row.slice();
    for (let c = 0; c < metaCount; c++) {
      if (isBlank(next[c])) next[c] = lastVal[c];
      else lastVal[c] = next[c];
    }
    return next;
  });

  // 6. Unpivot into tidy rows.
  const periodField = periodCol !== null ? "Period" : null;
  const categoryField = "Category";
  const tidyRows: DataRow[] = [];
  const metricsSeen = new Set<string>();

  for (const row of filledRows) {
    const period = periodCol !== null ? row[periodCol] : null;
    const category = row[categoryCol];
    if (isBlank(category)) continue;
    for (const [col, { section, metric }] of sectionByCol) {
      const raw = row[col];
      if (isBlank(raw)) continue; // ignore empty cells, move on
      const num = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
      if (!Number.isFinite(num)) continue;
      metricsSeen.add(metric);
      const tidyRow: DataRow = {
        Category: asTrimmedString(category),
        Section: section,
        Metric: metric,
        Value: num,
      };
      if (periodField) tidyRow[periodField] = isBlank(period) ? null : asTrimmedString(period);
      tidyRows.push(tidyRow);
    }
  }

  if (!tidyRows.length) return empty;

  return {
    matched: true,
    rows: tidyRows,
    meta: { periodField, categoryField, sections, metrics: Array.from(metricsSeen) },
  };
}

/** Detects and reshapes "wide, one-column-per-period" sheets — a very
 * common layout for manually-built bank/finance spreadsheets:
 *
 *   Row 1 (optional title):  | Total Deposits in Millions (In Millions Birr) |
 *   Row 2 (headers):         | Name of Bank | 2019/20 | 2020/21 | 2021/22 | ...
 *   Row 3+ (data):           | CBE          | 560178.43 | 735296.27 | ...
 *                            | Awash        | 70577.90  | 102300.00 | ...
 *
 * i.e. one row per entity (a bank, in the CBE case), one column per
 * period, with an optional single-cell title row above the real header
 * row. A naive parse mistakes that title row for the header — since it
 * has far fewer filled cells than the sheet is wide, every other column
 * ends up named a meaningless "__EMPTY", "__EMPTY_1", "__EMPTY_2", ...
 * instead of the real period labels underneath it.
 *
 * When detected, this unpivots into the exact same tidy long-format
 * shape reshapePanelSheet (above) produces — { Category, Section,
 * Metric, Value, Period } — so it feeds directly into the same
 * downstream pipeline (isPanelSchema, the CBE-vs-Industry comparison
 * dashboard, CBE-always-first-and-purple coloring, filters, everything)
 * rather than needing a second parallel code path. The entity column
 * (bank name) becomes Category; the sheet's title (or its header row's
 * first cell, if there's no separate title) becomes both Section and
 * Metric, since a single wide table like this only ever describes one
 * metric; each period column becomes one Period value per row.
 */
export interface WideReshapeResult {
  matched: boolean;
  rows: DataRow[];
  meta: { entityLabel: string | null; periods: string[]; metric: string | null };
}

/** Need at least this many period columns for a "row per entity, column
 * per period" read to be worth trusting over a plain small table. */
const MIN_PERIOD_COLUMNS = 2;
/** Need at least this many entity rows for the same reason. */
const MIN_ENTITY_ROWS = 2;

/** True if a header cell reads like a time period rather than an
 * arbitrary metric name — years ("2020"), fiscal years ("2019/20",
 * "2019-2020"), quarters ("Q1 2020", "2020 Q1"), or months ("Jan 2020",
 * "2020-01"). This is what stops an ordinary multi-column table (e.g.
 * "Country | Population | GDP | Year") from being misread as a
 * wide-by-period grid just because it happens to have several numeric
 * columns after the first one — real period columns share this
 * recognizable shape, arbitrary metric names don't. */
function looksLikePeriodLabel(s: string): boolean {
  const t = s.trim();
  return (
    /^(FY)?\d{4}([\/\-]\d{2,4})?$/i.test(t) ||
    /^Q[1-4][\s\-\/]?\d{2,4}$/i.test(t) ||
    /^\d{4}[\s\-\/]?Q[1-4]$/i.test(t) ||
    /^(19|20)\d{2}[\-\/](0[1-9]|1[0-2])$/.test(t) ||
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{2,4}$/i.test(t)
  );
}

export function reshapeWideEntityByPeriod(aoa: any[][]): WideReshapeResult {
  const empty: WideReshapeResult = { matched: false, rows: [], meta: { entityLabel: null, periods: [], metric: null } };
  if (!aoa || aoa.length < 1 + MIN_ENTITY_ROWS) return empty;

  const nonBlankCount = (row: any[] | undefined) => (row ?? []).filter((v) => !isBlank(v)).length;

  // A leading title row has just one or two filled cells (usually a
  // single merged cell), while the real header row underneath it is
  // filled across most of the sheet's width. If row 0 doesn't look like
  // a real header but row 1 does, row 0 is a title to note and skip,
  // not a row of column names or data.
  let headerRowIdx = 0;
  let title: string | null = null;
  const row0Count = nonBlankCount(aoa[0]);
  const row1Count = nonBlankCount(aoa[1]);
  if (row0Count > 0 && row0Count <= 2 && row1Count >= 3 && row1Count > row0Count) {
    title = asTrimmedString(aoa[0].find((v: any) => !isBlank(v)));
    headerRowIdx = 1;
  }

  const headerRow = aoa[headerRowIdx] ?? [];
  const dataStart = headerRowIdx + 1;
  if (aoa.length - dataStart < MIN_ENTITY_ROWS) return empty;

  const width = headerRow.length;
  if (width < 1 + MIN_PERIOD_COLUMNS) return empty;

  const entityLabel = isBlank(headerRow[0]) ? null : asTrimmedString(headerRow[0]);
  const periodCols: { col: number; period: string }[] = [];
  for (let c = 1; c < width; c++) {
    if (!isBlank(headerRow[c])) periodCols.push({ col: c, period: asTrimmedString(headerRow[c]) });
  }
  if (periodCols.length < MIN_PERIOD_COLUMNS) return empty;

  // Require most of the would-be period columns to actually look like
  // time periods — see looksLikePeriodLabel above for why.
  const periodLikeCount = periodCols.filter((p) => looksLikePeriodLabel(p.period)).length;
  if (periodLikeCount / periodCols.length < 0.7) return empty;

  const dataRows = (aoa.slice(dataStart) ?? []).filter((row) => row && !row.every((v) => isBlank(v)));
  if (dataRows.length < MIN_ENTITY_ROWS) return empty;

  const metric = title ?? entityLabel ?? "Value";
  const tidyRows: DataRow[] = [];
  let numericHits = 0;

  for (const row of dataRows) {
    const entity = row[0];
    if (isBlank(entity)) continue;
    for (const { col, period } of periodCols) {
      const raw = row[col];
      if (isBlank(raw)) continue;
      const num = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
      if (!Number.isFinite(num)) continue;
      numericHits++;
      tidyRows.push({ Category: asTrimmedString(entity), Section: metric, Metric: metric, Value: num, Period: period });
    }
  }

  // Require most of the entity×period grid to actually be numeric —
  // otherwise this is probably just an ordinary table with several text
  // columns that happens to be wide, not a real period grid.
  if (numericHits < dataRows.length * periodCols.length * 0.5) return empty;
  if (!tidyRows.length) return empty;

  return { matched: true, rows: tidyRows, meta: { entityLabel, periods: periodCols.map((p) => p.period), metric } };
}
