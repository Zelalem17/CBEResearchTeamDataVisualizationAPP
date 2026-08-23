import type { DataRow, Widget } from "@/types";

/** Turns raw rows + widget config into an ECharts `option` object.
 * Every builder is pure (rows in, option out) so ChartRenderer can stay
 * a thin wrapper and charts stay easy to unit-test.
 */

// Commercial Bank of Ethiopia identity: deep purple as the primary
// brand color, warm gold as the accent, rounded out with vivid teal,
// rose, and emerald accents for extra categories — deliberately no
// near-black, charcoal, or gray entries: a muted dark neutral is the
// one color that reads as "disabled"/invisible on a dark background and
// washes out on white, so every category (including the 3rd, 4th, ...)
// gets its own genuinely distinct, attractive color instead.
const PALETTE = [
  "#5b2a83", // brand purple 600 — primary
  "#f2a900", // gold 500 — accent
  "#8f5cc4", // brand purple 400 — lighter purple
  "#0ea5a4", // teal
  "#cc8b00", // gold 600 — deeper gold
  "#e11d48", // rose
  "#a78bfa", // violet
  "#059669", // emerald
];

// This app is for the Commercial Bank of Ethiopia — whenever a bar,
// slice, or series is literally labelled "CBE" (as opposed to e.g. an
// "Industry" comparison category), it should always render in CBE's
// own brand purple rather than whatever color the palette would
// otherwise assign it, so CBE's own figures are instantly identifiable
// on every chart. Matches tailwind's brand-600.
export const CBE_BRAND_PURPLE = "#5b2a83";
export function isCbeLabel(label: string): boolean {
  return /cbe/i.test(label);
}

// Real (or best-known-public) brand colors for major Ethiopian banks —
// checked against each bank's own public branding rather than assigned
// arbitrarily, so "Awash" reliably means the same orange every time it
// appears, "Abyssinia" the same yellow, and so on, instead of whichever
// color a generic cycling palette happened to land on for that chart.
// Matched by a case-insensitive substring against the category label,
// so "Awash", "Awash Bank", and "Awash International Bank" all resolve
// to the same entry. Only banks with a well-established, confidently-
// known public color are listed here; anything not recognized falls
// through to NON_CBE_COLORS below, which still guarantees it gets its
// own distinct, never-repeated color — just not a bank-specific one.
const BANK_BRAND_COLORS: [pattern: RegExp, color: string][] = [
  [/awash/i, "#F26522"],       // Awash Bank — orange
  [/abyssinia/i, "#FFC72C"],   // Bank of Abyssinia — yellow/gold
  [/dashen/i, "#C8102E"],      // Dashen Bank — red
  [/wegagen/i, "#0057A6"],     // Wegagen Bank — blue
  [/hibret|\bunited bank\b/i, "#00A19A"], // Hibret (formerly United) Bank — teal
  [/cooperative bank of oromia|\bcoop\b/i, "#2E7D32"], // Cooperative Bank of Oromia — green
  [/\boromia\b/i, "#F9A825"],  // Oromia International Bank (or plain "Oromia") — amber/gold
  [/zemen/i, "#1B2A4A"],       // Zemen Bank — navy
  [/nib international|\bnib\b/i, "#8B5E3C"], // NIB International Bank — brown
  [/lion/i, "#B8860B"],        // Lion International Bank — bronze/dark gold
  [/berhan/i, "#0072BC"],      // Berhan Bank — sky blue
  [/bunna/i, "#6F4E37"],       // Bunna Bank — coffee brown
  [/abay/i, "#004C97"],        // Abay Bank — blue
  [/enat/i, "#EC407A"],        // Enat Bank — pink
];

function bankBrandColor(label: string): string | null {
  for (const [pattern, color] of BANK_BRAND_COLORS) {
    if (pattern.test(label)) return color;
  }
  return null;
}

// Colors for everything that ISN'T CBE and isn't one of the named banks
// above — deliberately contains no purple (reserved exclusively for
// CBE) and no black/gray/white tones either: a muted charcoal or slate
// reads as "disabled" or fades away entirely on a dark background, and
// washes out on a plain white one, so every unrecognized entity still
// gets its own genuinely distinct, vivid color instead. Leads with gold
// (CBE's own accent color) so a plain two-way "CBE vs Industry"
// comparison (no other named bank involved) reads as a clean
// purple-vs-gold pair.
const NON_CBE_COLORS = ["#f2a900", "#0ea5a4", "#e11d48", "#6366f1", "#db2777", "#059669", "#f97316", "#0284c7"];

/** Assigns every name in `names` a color: anything matching "CBE" always
 * gets the brand purple; anything matching a known Ethiopian bank
 * (BANK_BRAND_COLORS above) gets that bank's real color; everything
 * else gets the next unused color from NON_CBE_COLORS, in order of
 * first appearance.
 *
 * This exists because naively indexing a shared palette by array
 * position (`PALETTE[i % n]`) breaks the moment CBE isn't literally the
 * first series/slice: whichever OTHER series lands on index 0 would
 * coincidentally get the same purple that's supposed to be CBE-only,
 * so both series render purple. Assigning colors by category identity
 * instead of array position guarantees CBE is always uniquely purple
 * and nothing else ever is, regardless of sort order — and lets a named
 * bank keep the same recognizable color across every chart it appears
 * in, rather than a random one that shifts with sort order or which
 * other banks happen to be on the same chart. */
export function assignSeriesColors(names: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const usedFallback = new Set<string>();
  let nonCbeIdx = 0;
  for (const name of names) {
    if (name in map) continue;
    if (isCbeLabel(name)) {
      map[name] = CBE_BRAND_PURPLE;
      continue;
    }
    const brandColor = bankBrandColor(name);
    if (brandColor) {
      map[name] = brandColor;
      continue;
    }
    // Skip any fallback color already claimed by a named bank above, so
    // e.g. an unrecognized entity never happens to land on the exact
    // same gold as Oromia International just by cycling order. Bounded
    // to the palette's own length so this can never spin forever if
    // every fallback color is already claimed (falls back to allowing a
    // repeat at that point, which only happens with 9+ unrecognized
    // entities on one chart — an edge case, not the common path).
    let attempts = 0;
    while (usedFallback.has(NON_CBE_COLORS[nonCbeIdx % NON_CBE_COLORS.length]) && attempts < NON_CBE_COLORS.length) {
      nonCbeIdx++;
      attempts++;
    }
    const color = NON_CBE_COLORS[nonCbeIdx % NON_CBE_COLORS.length];
    map[name] = color;
    usedFallback.add(color);
    nonCbeIdx++;
  }
  return map;
}

// Set once, synchronously, immediately before building a single chart's
// option/size/list — see setPreferredCategoryOrder below. Safe as
// module-level mutable state specifically because JS is single-threaded
// and every call site sets-then-immediately-uses it within one
// synchronous function call, with no async gap another chart's build
// could interleave into.
let preferredCategoryOrder: string[] | null = null;

/** Lets a researcher override the default CBE-first category ordering
 * with their own preferred order (e.g. "Industry" before "CBE") via the
 * drag-and-drop reorder control — applied to every chart at once, since
 * they all funnel through the same groupAndAgg/sortCbeFirst comparator.
 * Pass null/undefined/[] to go back to the default CBE-first behavior.
 * Called internally by buildOptionForWidget, getWidgetListData, and
 * computeAutoFitSize — not meant to be called from anywhere else. */
export function setPreferredCategoryOrder(order: string[] | null | undefined) {
  preferredCategoryOrder = order && order.length ? order : null;
}

/** Primary sort key shared by groupAndAgg and sortCbeFirst: the
 * researcher's own custom order if one is set (unlisted names sort
 * after every listed one, keeping their relative order); otherwise CBE
 * always first. Returns 0 (a tie) when neither rule distinguishes two
 * names, leaving it to the caller's own secondary sort (e.g. by value). */
function compareByPreferredOrThenCbe(a: string, b: string): number {
  if (preferredCategoryOrder) {
    const order = preferredCategoryOrder;
    const ai = order.findIndex((n) => n.toLowerCase() === a.toLowerCase());
    const bi = order.findIndex((n) => n.toLowerCase() === b.toLowerCase());
    const aRank = ai === -1 ? order.length : ai;
    const bRank = bi === -1 ? order.length : bi;
    return aRank - bRank;
  }
  const aCbe = isCbeLabel(a);
  const bCbe = isCbeLabel(b);
  if (aCbe !== bCbe) return aCbe ? -1 : 1;
  return 0;
}

export function groupAndAgg(rows: DataRow[], groupField: string, valueField?: string, agg: string = "sum") {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = String(row[groupField] ?? "—");
    const val = valueField ? Number(row[valueField] ?? 0) : 1;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(val);
  }
  const entries = Array.from(groups.entries()).map(([key, vals]) => {
    let value: number;
    switch (agg) {
      case "avg": value = vals.reduce((a, b) => a + b, 0) / vals.length; break;
      case "count": value = vals.length; break;
      case "min": value = Math.min(...vals); break;
      case "max": value = Math.max(...vals); break;
      default: value = vals.reduce((a, b) => a + b, 0);
    }
    return { key, value: Math.round(value * 100) / 100 };
  });
  // CBE always comes first by default — this is CBE's own app, so
  // wherever CBE appears alongside a comparison category (Industry, a
  // competitor, etc.) it leads every bar/pie/list/legend rather than
  // being sorted in purely by value — unless the researcher has set
  // their own preferred order (see setPreferredCategoryOrder above), in
  // which case that's honored instead. Everything else still sorts by
  // value descending.
  return entries.sort((a, b) => {
    const primary = compareByPreferredOrThenCbe(a.key, b.key);
    if (primary !== 0) return primary;
    return b.value - a.value;
  });
}

/** Sorts a list of series/category names by the same rule (see
 * compareByPreferredOrThenCbe above) — the series-array equivalent of
 * groupAndAgg's ordering, for chart builders that derive their category
 * list from a plain Set rather than groupAndAgg (grouped bar, grouped
 * line, category scatter, 3D bar). */
function sortCbeFirst(names: string[]): string[] {
  return [...names].sort(compareByPreferredOrThenCbe);
}

/** Lightens a hex color toward white by `amount` (0–1) — used to build
 * the top-to-bottom fade for the "gradient" bar style option. */
function lightenHex(hex: string, amount: number): string {
  const full = hex.replace("#", "");
  const norm = full.length === 3 ? full.split("").map((c) => c + c).join("") : full;
  const num = parseInt(norm, 16);
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  r = Math.round(r + (255 - r) * amount);
  g = Math.round(g + (255 - g) * amount);
  b = Math.round(b + (255 - b) * amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** A single bar/segment's fill per config.barStyle — the selectable
 * "different design" for bar charts, cycled via the widget card's style
 * toggle: "rounded" (default, rounded top corners), "flat" (square
 * corners), or "gradient" (a soft top-to-bottom fade of the same
 * color). */
function barVisualStyle(baseColor: string, style: string | undefined) {
  const radius = style === "flat" ? [0, 0, 0, 0] : [4, 4, 0, 0];
  if (style === "gradient") {
    return {
      borderRadius: radius,
      color: {
        type: "linear", x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: baseColor }, { offset: 1, color: lightenHex(baseColor, 0.55) }],
      },
    };
  }
  return { borderRadius: radius, color: baseColor };
}

// Default fill for a single-series bar chart's non-CBE bars — CBE's own
// accent gold, kept visually distinct from the brand purple reserved for
// anything explicitly labelled "CBE" so a CBE bar always stands out
// rather than blending into the chart's base tone.
const DEFAULT_BAR_ACCENT = "#f2a900";

/** Pie radius (and roseType) per config.pieStyle — the selectable
 * "different design" for pie charts: "donut" (default, ring with a
 * hole), "solid" (full pie, no hole), or "rose" (Nightingale rose —
 * equal angles, radius scaled by value). */
function pieStyleProps(style: string | undefined): { radius: [string, string] | string; roseType?: "radius" } {
  if (style === "solid") return { radius: "70%" };
  if (style === "rose") return { radius: ["20%", "75%"], roseType: "radius" };
  return { radius: ["42%", "72%"] }; // donut, matches the original look
}

const baseTooltip = { trigger: "axis" as const, backgroundColor: "rgba(17,24,39,0.92)", borderWidth: 0, textStyle: { color: "#fff" } };
const baseGrid = { left: 48, right: 24, top: 32, bottom: 40, containLabel: true };
// Bar-family charts render a value/percent label above each bar when
// that's turned on (config.showLabels), which needs a bit more headroom
// above the plot area than the default grid.
const barGrid = { ...baseGrid, top: 44 };

/** The value+percent "chip" shown above/inside a bar when the person
 * turns on config.showLabels — bold value, smaller muted percent
 * underneath, on a soft floating pill so it stays readable over any bar
 * color (including CBE gold) or chart theme. Not shown by default; this
 * is what draws when a bar/grouped-bar widget has labels toggled on. */
function attractiveValueLabel(stacked: boolean) {
  return {
    show: true,
    position: stacked ? ("inside" as const) : ("top" as const),
    formatter: (p: any) =>
      p?.data && typeof p.data === "object"
        ? `{val|${Number(p.data.value).toLocaleString()}}\n{pct|${Number(p.data.pct).toFixed(1)}%}`
        : "",
    rich: {
      val: { fontSize: 11, fontWeight: 700, lineHeight: 14, color: stacked ? "#ffffff" : "#111827" },
      pct: { fontSize: 9, fontWeight: 500, lineHeight: 12, color: stacked ? "rgba(255,255,255,0.85)" : "#6b7280" },
    },
    ...(stacked
      ? {}
      : {
          backgroundColor: "rgba(255,255,255,0.94)",
          borderRadius: 5,
          padding: [3, 6] as [number, number],
          shadowBlur: 6,
          shadowColor: "rgba(15,23,42,0.12)",
        }),
  };
}

/** Applies optional widget-level prefilters (config.filters: [{field,
 * value}]) before any aggregation. Lets a single dataset's rows be
 * sliced down to e.g. { Section: "ATM", Metric: "Total No. of ATM
 * Machines" } for one widget, independent of the dashboard's global
 * filters. No-op when config.filters is absent. */
export function applyConfigFilters(rows: DataRow[], config: any): DataRow[] {
  const filters: { field: string; value: string }[] = config?.filters ?? [];
  if (!filters.length) return rows;
  return rows.filter((row) => filters.every((f) => String(row[f.field] ?? "") === String(f.value)));
}

function aggValues(vals: number[], agg: string): number {
  if (!vals.length) return 0;
  switch (agg) {
    case "avg": return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "count": return vals.length;
    case "min": return Math.min(...vals);
    case "max": return Math.max(...vals);
    case "latest": return vals[vals.length - 1];
    default: return vals.reduce((a, b) => a + b, 0);
  }
}

export function buildBarOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const data = groupAndAgg(scoped, config.x, config.y, config.agg ?? "sum").slice(0, 15);
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const showLabels = !!config.showLabels;
  const barStyle = config.barStyle;
  return {
    color: PALETTE,
    tooltip: baseTooltip,
    grid: showLabels ? barGrid : baseGrid,
    xAxis: { type: "category", data: data.map((d) => d.key), axisLabel: { rotate: data.length > 6 ? 30 : 0 } },
    yAxis: { type: "value" },
    series: [{
      type: "bar",
      data: data.map((d) => ({
        value: d.value,
        pct: (d.value / total) * 100,
        itemStyle: barVisualStyle(isCbeLabel(d.key) ? CBE_BRAND_PURPLE : DEFAULT_BAR_ACCENT, barStyle),
      })),
      // Off by default — plain bar chart stays clean. Turned on via the
      // "%" toggle on the widget card, which prints the actual value and
      // its share of the total right on the bar.
      label: showLabels ? attractiveValueLabel(false) : { show: false },
      barMaxWidth: 42,
    }],
  };
}

export function buildLineOption(rows: DataRow[], config: any, area = false) {
  const scoped = applyConfigFilters(rows, config);
  const data = groupAndAgg(scoped, config.x, config.y, config.agg ?? "sum")
    .sort((a, b) => (a.key > b.key ? 1 : -1));
  const showLabels = !!config.showLabels;
  // "circle" (default), "diamond", "rect" (square), "triangle", or
  // "none" — cycled via the widget card's shape toggle.
  const symbol = config.symbolShape ?? "circle";
  return {
    color: PALETTE,
    tooltip: baseTooltip,
    grid: showLabels ? barGrid : baseGrid,
    xAxis: { type: "category", data: data.map((d) => d.key), boundaryGap: false },
    yAxis: { type: "value" },
    series: [{
      type: "line", data: data.map((d) => d.value), smooth: true,
      symbol, symbolSize: symbol === "none" ? 0 : 8,
      areaStyle: area ? { opacity: 0.15 } : undefined, lineStyle: { width: 2.5 },
      // Off by default. Turned on via the "%" toggle — prints the exact
      // value at each dot instead of only implying it via the curve.
      label: showLabels
        ? {
            show: true, position: "top", fontSize: 10, fontWeight: 600, color: "#111827",
            backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 4, padding: [2, 5] as [number, number],
            formatter: (p: any) => Number(p.value).toLocaleString(),
          }
        : { show: false },
    }],
  };
}

export function buildPieOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const data = groupAndAgg(scoped, config.category, config.value, config.agg ?? "sum").slice(0, 10);
  const { radius, roseType } = pieStyleProps(config.pieStyle);
  const colorMap = assignSeriesColors(data.map((d) => d.key));
  return {
    tooltip: { trigger: "item", backgroundColor: "rgba(17,24,39,0.92)", textStyle: { color: "#fff" } },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      type: "pie", radius, roseType, center: ["50%", "45%"],
      data: data.map((d) => ({
        name: d.key,
        value: d.value,
        itemStyle: { color: colorMap[d.key] },
      })),
      itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 },
      // Name, actual value, and percent share — not just percent — so
      // the real number is always visible on the slice itself too.
      // Rich tokens give the value visual weight without hardcoding a
      // text color, so it stays legible in both light and dark theme.
      label: {
        formatter: "{name|{b}}\n{val|{c}}  {pct|({d}%)}",
        rich: {
          name: { fontSize: 11, fontWeight: 600, lineHeight: 15 },
          val: { fontSize: 12, fontWeight: 700, lineHeight: 16 },
          pct: { fontSize: 10, lineHeight: 14 },
        },
      },
    }],
  };
}

export function buildScatterOption(rows: DataRow[], config: any) {
  const points = rows
    .map((r) => [Number(r[config.x]), Number(r[config.y])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  return {
    color: PALETTE,
    tooltip: { trigger: "item", backgroundColor: "rgba(17,24,39,0.92)", textStyle: { color: "#fff" } },
    grid: baseGrid,
    xAxis: { type: "value", name: config.x, nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: config.y, nameLocation: "middle", nameGap: 40 },
    series: [{ type: "scatter", data: points, symbolSize: 8, itemStyle: { opacity: 0.7 } }],
  };
}

/** Scatter that plots one comparison category against another instead
 * of two fields on the same row — e.g. CBE's value vs Industry's value
 * for each period, one point per period. Used for the "Scatter (A vs B)"
 * panel chart kind. Falls back to a friendly empty state when fewer
 * than 2 categories are present after filtering. */
/** Scatter split by comparison category (e.g. CBE vs Industry) plotted
 * over the shared x field (e.g. Period) — one colored dot-series per
 * category, same idea as buildGroupedLineOption but as unconnected
 * points. Replaces an earlier version that plotted category A's value
 * against category B's value on two numeric axes: that produced a
 * single point cloud with only one visual series, which read as "only
 * one value" since neither category was distinguishable by color. Falls
 * back to a friendly empty state when fewer than 2 categories are
 * present after filtering. */
export function buildCategoryScatterOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const seriesField = config.seriesField ?? "Category";
  const xField = config.x;
  const valueField = config.y ?? "Value";

  const seriesValues = sortCbeFirst(Array.from(new Set(scoped.map((r) => String(r[seriesField] ?? "—")))));
  if (seriesValues.length < 2) {
    return {
      title: { text: "Need at least 2 categories to compare", left: "center", top: "middle", textStyle: { fontSize: 12, color: "#94a3b8" } },
      series: [],
    };
  }
  const xValues = Array.from(new Set(scoped.map((r) => String(r[xField] ?? "—")))).sort();
  const colorMap = assignSeriesColors(seriesValues);

  const series = seriesValues.map((sv) => {
    const data: [number, number][] = [];
    xValues.forEach((xv, xi) => {
      const match = scoped.find((r) => String(r[xField] ?? "—") === xv && String(r[seriesField] ?? "—") === sv);
      if (!match) return;
      const v = Number(match[valueField]);
      if (Number.isFinite(v)) data.push([xi, v]);
    });
    return {
      name: sv, type: "scatter", data, symbolSize: 12,
      itemStyle: { opacity: 0.85, color: colorMap[sv] },
    };
  });

  return {
    tooltip: {
      trigger: "item", backgroundColor: "rgba(17,24,39,0.92)", borderWidth: 0, textStyle: { color: "#fff" },
      formatter: (p: any) => `${xValues[p.value[0]]}<br/>${p.seriesName}: ${p.value[1].toLocaleString()}`,
    },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { ...baseGrid, bottom: 56 },
    xAxis: { type: "category", data: xValues, axisLabel: { rotate: xValues.length > 6 ? 30 : 0 } },
    yAxis: { type: "value" },
    series,
  };
}

export function buildHistogramOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const values = scoped.map((r) => Number(r[config.field])).filter(Number.isFinite);
  const bins = config.bins ?? 20;
  if (!values.length) return { series: [] };
  const min = Math.min(...values), max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);
  values.forEach((v) => {
    const idx = Math.min(bins - 1, Math.floor((v - min) / width));
    counts[idx]++;
  });
  const labels = counts.map((_, i) => (min + i * width).toFixed(1));
  return {
    color: PALETTE,
    tooltip: baseTooltip,
    grid: baseGrid,
    xAxis: { type: "category", data: labels, name: config.field, axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: "value", name: "Frequency" },
    series: [{ type: "bar", data: counts, itemStyle: { borderRadius: [3, 3, 0, 0] }, barCategoryGap: "10%" }],
  };
}

export function buildHeatmapOption(rows: DataRow[], config: any) {
  const fields: string[] = config.fields ?? [];
  const matrix = fields.map((a) => fields.map((b) => correlation(rows, a, b)));
  const data: [number, number, number][] = [];
  fields.forEach((_, i) => fields.forEach((__, j) => data.push([i, j, Math.round(matrix[i][j] * 100) / 100])));
  return {
    tooltip: { position: "top", backgroundColor: "rgba(17,24,39,0.92)", textStyle: { color: "#fff" } },
    grid: { left: 90, right: 20, top: 20, bottom: 60, containLabel: true },
    xAxis: { type: "category", data: fields, splitArea: { show: true }, axisLabel: { rotate: 30, fontSize: 10 } },
    yAxis: { type: "category", data: fields, splitArea: { show: true }, axisLabel: { fontSize: 10 } },
    visualMap: {
      min: -1, max: 1, calculable: true, orient: "horizontal", bottom: 0,
      inRange: { color: ["#f2a900", "#f8fafc", "#5b2a83"] },
    },
    series: [{ type: "heatmap", data, label: { show: true, fontSize: 9 } }],
  };
}

function correlation(rows: DataRow[], a: string, b: string): number {
  const xs = rows.map((r) => Number(r[a])).filter(Number.isFinite);
  const ys = rows.map((r) => Number(r[b])).filter(Number.isFinite);
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

export function buildTreemapOption(rows: DataRow[], config: any) {
  const [level1, level2] = config.levels ?? [];
  const valueField = config.value;
  const byLevel1 = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const k1 = String(row[level1] ?? "—");
    const k2 = level2 ? String(row[level2] ?? "—") : "value";
    const v = Number(row[valueField] ?? 0);
    if (!byLevel1.has(k1)) byLevel1.set(k1, new Map());
    const inner = byLevel1.get(k1)!;
    inner.set(k2, (inner.get(k2) ?? 0) + v);
  }
  const data = Array.from(byLevel1.entries()).map(([name, inner]) => ({
    name,
    children: Array.from(inner.entries()).map(([n, v]) => ({ name: n, value: Math.round(v * 100) / 100 })),
  }));
  return {
    tooltip: { backgroundColor: "rgba(17,24,39,0.92)", textStyle: { color: "#fff" } },
    series: [{
      type: "treemap", data, roam: false, breadcrumb: { show: false },
      label: { fontSize: 11 }, upperLabel: { show: true, height: 24 },
      levels: [
        { itemStyle: { borderColor: "#fff", borderWidth: 2, gapWidth: 2 } },
        { colorSaturation: [0.35, 0.55], itemStyle: { borderColorSaturation: 0.6, gapWidth: 1 } },
      ],
    }],
  };
}

export function buildGaugeOption(rows: DataRow[], config: any) {
  const values = rows.map((r) => Number(r[config.field])).filter(Number.isFinite);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const max = values.length ? Math.max(...values) : 100;
  return {
    series: [{
      type: "gauge", min: 0, max: Math.ceil(max * 1.1) || 100,
      progress: { show: true, width: 14, itemStyle: { color: CBE_BRAND_PURPLE } },
      axisLine: { lineStyle: { width: 14, color: [[1, "#f3e8ff"]] } }, pointer: { show: false },
      axisTick: { show: false }, splitLine: { length: 8 },
      axisLabel: { fontSize: 9, distance: 14 },
      detail: { valueAnimation: true, fontSize: 22, offsetCenter: [0, "35%"], formatter: (v: number) => v.toFixed(1), color: CBE_BRAND_PURPLE },
      data: [{ value: Math.round(avg * 100) / 100 }],
    }],
  };
}

/** "Wave" / liquid-fill chart (needs the `echarts-liquidfill` extension,
 * registered globally in ChartRenderer.tsx): one ratio rendered as an
 * animated rising-water circle — a distinctive, attention-grabbing way
 * to show a single utilization/share/completion metric (e.g. "% of
 * branches reporting", "capacity used") that a plain gauge doesn't
 * quite capture. config.max lets the person say what "100%" means; by
 * default a value over 1 is read as already being a 0–100 percentage. */
export function buildWaveOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const values = scoped.map((r) => Number(r[config.field])).filter(Number.isFinite);

  let ratio: number;
  if (config.shareOf) {
    // Ratio of one sub-category's total to the whole scoped total (e.g.
    // CBE's share of CBE+Industry for this metric) rather than a single
    // aggregated value against a fixed max.
    const { field: shareField, value: shareValue } = config.shareOf as { field: string; value: string };
    const numeratorRows = scoped.filter((r) => String(r[shareField] ?? "") === String(shareValue));
    const numeratorVals = numeratorRows.map((r) => Number(r[config.field])).filter(Number.isFinite);
    const numerator = numeratorVals.reduce((a, b) => a + b, 0);
    const denominator = values.reduce((a, b) => a + b, 0) || 1;
    ratio = Math.max(0, Math.min(1, numerator / denominator));
  } else {
    const raw = values.length ? aggValues(values, config.agg ?? "avg") : 0;
    const max = config.max ?? (raw > 1 ? 100 : 1);
    ratio = Math.max(0, Math.min(1, max ? raw / max : 0));
  }

  return {
    series: [{
      type: "liquidFill",
      radius: "78%",
      data: [
        { value: ratio, itemStyle: { color: CBE_BRAND_PURPLE, opacity: 0.88 } },
        { value: Math.max(0, ratio - 0.04), itemStyle: { color: "#f2a900", opacity: 0.5 } },
      ],
      backgroundStyle: { color: "rgba(91,42,131,0.06)" },
      outline: { show: true, borderDistance: 4, itemStyle: { borderColor: CBE_BRAND_PURPLE, borderWidth: 3 } },
      label: {
        formatter: () => `${(ratio * 100).toFixed(1)}%`,
        fontSize: 24, fontWeight: 700, color: "#2a1339",
      },
      amplitude: 8,
      waveAnimation: true,
      animationDuration: 2200,
      animationDurationUpdate: 900,
    }],
  };
}

/** Bar + line combined in one chart, as a Pareto-style combo: bars are
 * each category's value (sorted highest-first, same as a plain bar
 * chart), and the line is the running cumulative percentage of the
 * grand total on a secondary 0–100% axis — a standard, genuinely useful
 * pairing for spotting how few categories account for most of the
 * total, rather than an arbitrary bar/line mashup. */
export function buildBarLineComboOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const data = groupAndAgg(scoped, config.x, config.y, config.agg ?? "sum").slice(0, 15);
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  let running = 0;
  const cumulativePct = data.map((d) => {
    running += d.value;
    return Math.round((running / total) * 1000) / 10;
  });

  return {
    color: [DEFAULT_BAR_ACCENT, CBE_BRAND_PURPLE],
    tooltip: { ...baseTooltip },
    legend: { bottom: 0, textStyle: { fontSize: 11 }, data: ["Value", "Cumulative %"] },
    grid: { ...baseGrid, bottom: 56 },
    xAxis: { type: "category", data: data.map((d) => d.key), axisLabel: { rotate: data.length > 6 ? 30 : 0 } },
    yAxis: [
      { type: "value", name: "Value" },
      { type: "value", name: "Cumulative %", min: 0, max: 100, position: "right", axisLabel: { formatter: "{value}%" }, splitLine: { show: false } },
    ],
    series: [
      {
        name: "Value", type: "bar", yAxisIndex: 0, barMaxWidth: 36,
        data: data.map((d) => ({ value: d.value, itemStyle: barVisualStyle(isCbeLabel(d.key) ? CBE_BRAND_PURPLE : DEFAULT_BAR_ACCENT, config.barStyle) })),
      },
      {
        name: "Cumulative %", type: "line", yAxisIndex: 1, smooth: false,
        symbol: "circle", symbolSize: 6,
        lineStyle: { width: 2.5, color: CBE_BRAND_PURPLE },
        itemStyle: { color: CBE_BRAND_PURPLE },
        data: cumulativePct,
      },
    ],
  };
}

/** Bar + line combined as two actual data series over a shared x field
 * (e.g. Period) — the first category (CBE, since CBE always sorts first
 * — see sortCbeFirst) renders as bars, every other category (Industry,
 * a second competitor, etc.) renders as a line drawn over them, so CBE
 * reads as the primary series and the rest as trend comparisons against
 * it, all on one shared axis. This differs from buildBarLineComboOption
 * (the Pareto chart), which is one field's own bars plus its own
 * cumulative-% line rather than two distinct categories. */
export function buildBarLineSeriesOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const xField = config.x;
  const seriesField = config.seriesField;
  const valueField = config.y;
  const agg = config.agg ?? "sum";

  const xValues = Array.from(new Set(scoped.map((r) => String(r[xField] ?? "—")))).sort();
  const seriesValues = sortCbeFirst(Array.from(new Set(scoped.map((r) => String(r[seriesField] ?? "—")))));
  const colorMap = assignSeriesColors(seriesValues);
  const showLabels = !!config.showLabels;
  const symbol = config.symbolShape ?? "circle";

  const series = seriesValues.map((sv, idx) => {
    const data = xValues.map((xv) => {
      const matching = scoped.filter((r) => String(r[xField] ?? "—") === xv && String(r[seriesField] ?? "—") === sv);
      const vals = matching.map((r) => Number(r[valueField])).filter(Number.isFinite);
      if (!vals.length) return null;
      return Math.round(aggValues(vals, agg) * 10000) / 10000;
    });
    const color = colorMap[sv];
    if (idx === 0) {
      return {
        name: sv, type: "bar", data,
        itemStyle: barVisualStyle(color, config.barStyle),
        label: showLabels ? attractiveValueLabel(false) : { show: false },
        barMaxWidth: 34,
      };
    }
    return {
      name: sv, type: "line", data, smooth: true, symbol, symbolSize: symbol === "none" ? 0 : 7,
      lineStyle: { width: 2.5, color }, itemStyle: { color }, connectNulls: true,
      label: showLabels
        ? { show: true, position: "top", fontSize: 9, fontWeight: 600, color, formatter: (p: any) => (p.value == null ? "" : Number(p.value).toLocaleString()) }
        : { show: false },
    };
  });

  return {
    tooltip: { ...baseTooltip, axisPointer: { type: "cross" } },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: showLabels ? { ...barGrid, bottom: 56 } : { ...baseGrid, bottom: 56 },
    xAxis: { type: "category", data: xValues, axisLabel: { rotate: xValues.length > 6 ? 30 : 0 } },
    yAxis: { type: "value" },
    series,
  };
}

/** 3D bar chart (needs `echarts-gl`, registered globally in
 * ChartRenderer.tsx): x category × comparison category (e.g. Period ×
 * CBE/Industry), with bar height as the value — the natural use of a
 * third (z) dimension, rather than a flat single-series bar chart
 * turned 3D for no reason. */
export function buildBar3DOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const xField = config.x;
  const seriesField = config.seriesField;
  const valueField = config.y;
  const agg = config.agg ?? "sum";

  const xValues = Array.from(new Set(scoped.map((r) => String(r[xField] ?? "—")))).sort();
  const yValues = sortCbeFirst(Array.from(new Set(scoped.map((r) => String(r[seriesField] ?? "—")))));

  const data: [number, number, number][] = [];
  let maxVal = 0;
  xValues.forEach((xv, xi) => {
    yValues.forEach((yv, yi) => {
      const matching = scoped.filter((r) => String(r[xField] ?? "—") === xv && String(r[seriesField] ?? "—") === yv);
      const vals = matching.map((r) => Number(r[valueField])).filter(Number.isFinite);
      if (!vals.length) return;
      const v = Math.round(aggValues(vals, agg) * 100) / 100;
      maxVal = Math.max(maxVal, v);
      data.push([xi, yi, v]);
    });
  });

  return {
    tooltip: {
      backgroundColor: "rgba(17,24,39,0.92)", textStyle: { color: "#fff" },
      formatter: (p: any) => `${xValues[p.value[0]]} · ${yValues[p.value[1]]}<br/>${Number(p.value[2]).toLocaleString()}`,
    },
    visualMap: {
      show: false, min: 0, max: maxVal || 1, dimension: 2,
      inRange: { color: ["#fde08a", "#f2a900", CBE_BRAND_PURPLE] },
    },
    xAxis3D: { type: "category", data: xValues },
    yAxis3D: { type: "category", data: yValues },
    zAxis3D: { type: "value" },
    grid3D: {
      boxWidth: 100, boxDepth: 70, boxHeight: 55,
      viewControl: { autoRotate: false, distance: 190, alpha: 22, beta: 30 },
      light: { main: { intensity: 1.1, shadow: false }, ambient: { intensity: 0.35 } },
    },
    series: [{
      type: "bar3D", data, shading: "lambert",
      barSize: Math.max(4, Math.min(16, 60 / Math.max(xValues.length, yValues.length, 1))),
      itemStyle: { opacity: 0.92 },
    }],
  };
}

/** Parametric surface equation for one slice of a 3D pie/donut, per the
 * standard echarts-gl "3D pie" recipe: a `surface` series shaped like a
 * wedge of a torus. `startRatio`/`endRatio` are that slice's cumulative
 * share of the whole (0–1); `k` controls the donut hole size. */
function pie3DParametricEquation(startRatio: number, endRatio: number, k: number, height: number) {
  const startRadian = startRatio * Math.PI * 2;
  const endRadian = endRatio * Math.PI * 2;
  return {
    u: { min: -Math.PI, max: Math.PI * 3, step: Math.PI / 32 },
    v: { min: 0, max: Math.PI * 2, step: Math.PI / 20 },
    x: (u: number, v: number) => {
      if (u < startRadian) return Math.cos(startRadian) * (1 + Math.cos(v) * k);
      if (u > endRadian) return Math.cos(endRadian) * (1 + Math.cos(v) * k);
      return Math.cos(u) * (1 + Math.cos(v) * k);
    },
    y: (u: number, v: number) => {
      if (u < startRadian) return Math.sin(startRadian) * (1 + Math.cos(v) * k);
      if (u > endRadian) return Math.sin(endRadian) * (1 + Math.cos(v) * k);
      return Math.sin(u) * (1 + Math.cos(v) * k);
    },
    z: (u: number, v: number) => {
      if (u < -Math.PI * 0.5) return Math.sin(u);
      if (u > Math.PI * 2.5) return Math.sin(u);
      return Math.sin(v) > 0 ? height : -1;
    },
  };
}

/** 3D pie chart (needs `echarts-gl`) — each slice is its own `surface`
 * series shaped by pie3DParametricEquation, since echarts-gl has no
 * native pie3D series type; this is the standard community recipe for
 * one. Capped at 8 slices to keep the render (and the legend) legible. */
export function buildPie3DOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const data = groupAndAgg(scoped, config.category, config.value, config.agg ?? "sum").slice(0, 8);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let cumulative = 0;
  const colorMap = assignSeriesColors(data.map((d) => d.key));
  const series = data.map((d) => {
    const startRatio = cumulative / total;
    cumulative += d.value;
    const endRatio = cumulative / total;
    const color = colorMap[d.key];
    return {
      name: d.key,
      type: "surface",
      parametric: true,
      wireframe: { show: false },
      itemStyle: { color, opacity: 0.98 },
      parametricEquation: pie3DParametricEquation(startRatio, endRatio, 1 / 3, 0.22),
    };
  });

  return {
    tooltip: {
      backgroundColor: "rgba(17,24,39,0.92)", textStyle: { color: "#fff" },
      formatter: (p: any) => {
        const d = data.find((x) => x.key === p.seriesName);
        if (!d) return p.seriesName;
        return `${p.seriesName}<br/>${d.value.toLocaleString()} (${((d.value / total) * 100).toFixed(1)}%)`;
      },
    },
    legend: { bottom: 0, textStyle: { fontSize: 11 }, data: data.map((d) => d.key) },
    xAxis3D: { min: -1, max: 1 },
    yAxis3D: { min: -1, max: 1 },
    zAxis3D: { min: -1, max: 1 },
    grid3D: {
      show: false, boxHeight: 15,
      viewControl: { autoRotate: false, distance: 165, alpha: 32, beta: 20 },
      light: { main: { intensity: 1.2, shadow: false }, ambient: { intensity: 0.4 } },
    },
    series,
  };
}

/** Grouped/clustered bar chart: one bar per (x, seriesField) pair — e.g.
 * x = Period (fiscal year), seriesField = Category (CBE vs Industry), so
 * the two categories sit side-by-side for every period instead of being
 * collapsed into one. This is what makes a CBE-vs-Industry style
 * comparison possible instead of only ever showing a single series. */
export function buildGroupedBarOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const xField = config.x;
  const seriesField = config.seriesField;
  const valueField = config.y;
  const agg = config.agg ?? "sum";

  const xValues = Array.from(new Set(scoped.map((r) => String(r[xField] ?? "—")))).sort();
  const seriesValues = sortCbeFirst(Array.from(new Set(scoped.map((r) => String(r[seriesField] ?? "—")))));

  // Raw value matrix first, so we can compute each bar's share of its
  // own x-group's total (e.g. CBE's % of CBE+Industry for that period)
  // before building the per-series ECharts series objects.
  const matrix = seriesValues.map((sv) =>
    xValues.map((xv) => {
      const matching = scoped.filter((r) => String(r[xField] ?? "—") === xv && String(r[seriesField] ?? "—") === sv);
      const vals = matching.map((r) => Number(r[valueField])).filter(Number.isFinite);
      if (!vals.length) return null;
      return Math.round(aggValues(vals, agg) * 10000) / 10000;
    })
  );
  const totalsByX = xValues.map((_, xi) =>
    matrix.reduce((sum, seriesData) => sum + (seriesData[xi] ?? 0), 0) || 1
  );
  const colorMap = assignSeriesColors(seriesValues);

  const series = seriesValues.map((sv, i) => {
    const data = matrix[i].map((v, xi) => {
      if (v === null) return null;
      return { value: v, pct: (v / totalsByX[xi]) * 100 };
    });
    const seriesColor = colorMap[sv];
    const showLabels = !!config.showLabels;
    return {
      name: sv, type: "bar", data,
      itemStyle: barVisualStyle(seriesColor, config.stacked ? "flat" : config.barStyle),
      // Off by default — turned on via the "%" toggle on the widget
      // card. When on: actual value + this series' share of that
      // x-group's total (e.g. CBE's number and its % of CBE+Industry
      // for that period), printed right on the bar.
      label: showLabels ? attractiveValueLabel(!!config.stacked) : { show: false },
      barMaxWidth: 28,
      ...(config.stacked ? { stack: "total" } : {}),
    };
  });

  return {
    color: PALETTE,
    tooltip: { ...baseTooltip, axisPointer: { type: "shadow" } },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: config.showLabels ? { ...barGrid, bottom: 56 } : { ...baseGrid, bottom: 56 },
    xAxis: { type: "category", data: xValues, axisLabel: { rotate: xValues.length > 6 ? 30 : 0 } },
    yAxis: { type: "value" },
    series,
  };
}

/** Same idea as buildGroupedBarOption but as multiple line series — one
 * line per category (e.g. CBE, Industry) trending across x (e.g. Period),
 * so trends can be compared directly rather than just magnitudes. */
export function buildGroupedLineOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const xField = config.x;
  const seriesField = config.seriesField;
  const valueField = config.y;
  const agg = config.agg ?? "sum";

  const xValues = Array.from(new Set(scoped.map((r) => String(r[xField] ?? "—")))).sort();
  const seriesValues = sortCbeFirst(Array.from(new Set(scoped.map((r) => String(r[seriesField] ?? "—")))));

  const symbol = config.symbolShape ?? "circle";
  const showLabels = !!config.showLabels;
  const colorMap = assignSeriesColors(seriesValues);
  const series = seriesValues.map((sv) => {
    const data = xValues.map((xv) => {
      const matching = scoped.filter((r) => String(r[xField] ?? "—") === xv && String(r[seriesField] ?? "—") === sv);
      const vals = matching.map((r) => Number(r[valueField])).filter(Number.isFinite);
      if (!vals.length) return null;
      return Math.round(aggValues(vals, agg) * 10000) / 10000;
    });
    const seriesColor = colorMap[sv];
    return {
      name: sv, type: "line", data, smooth: true, symbol, symbolSize: symbol === "none" ? 0 : 7,
      lineStyle: { width: 2.5, color: seriesColor },
      itemStyle: { color: seriesColor },
      connectNulls: true,
      label: showLabels
        ? {
            show: true, position: "top", fontSize: 9, fontWeight: 600, color: seriesColor,
            formatter: (p: any) => (p.value == null ? "" : Number(p.value).toLocaleString()),
          }
        : { show: false },
      ...(config.area ? { areaStyle: { opacity: 0.18, color: seriesColor } } : {}),
    };
  });

  return {
    color: PALETTE,
    tooltip: { ...baseTooltip, axisPointer: { type: "line" } },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: showLabels ? { ...barGrid, bottom: 56 } : { ...baseGrid, bottom: 56 },
    xAxis: { type: "category", data: xValues, boundaryGap: false, axisLabel: { rotate: xValues.length > 6 ? 30 : 0 } },
    yAxis: { type: "value" },
    series,
  };
}

export interface WidgetListRow {
  key: string;
  value: number;
  pct: number;
}

/** Backing data for the "detailed" bar/pie variants' side list: the same
 * grouped/aggregated rows the chart itself renders (same field mapping,
 * same top-N cap), each annotated with its share of the total so the
 * list's percentages always match what the chart shows. */
export function getWidgetListData(widget: Widget, rows: DataRow[], categoryOrder?: string[]): WidgetListRow[] {
  setPreferredCategoryOrder(categoryOrder);
  const config = widget.config ?? {};
  const scoped = applyConfigFilters(rows, config);
  const isPie = widget.type === "pie_detailed";
  const groupField = isPie ? config.category : config.x;
  const valueField = isPie ? config.value : config.y;
  if (!groupField) return [];
  const capped = groupAndAgg(scoped, groupField, valueField, config.agg ?? "sum").slice(0, isPie ? 10 : 15);
  const total = capped.reduce((sum, d) => sum + d.value, 0) || 1;
  return capped.map((d) => ({ key: d.key, value: d.value, pct: (d.value / total) * 100 }));
}

/** Content-aware minimum grid size for a widget, given its *current*
 * (filtered) data — more categories, rotated x-axis labels, wrapped
 * legends, and on-bar value/percent labels all need more room than a
 * one-size-fits-all default grid box provides. DashboardGrid uses this
 * as a live `minW`/`minH` floor (and to bump the rendered size up to at
 * least this floor) so a chart is never silently clipped by too small a
 * tile — the person never has to find the resize handle and drag it out
 * by hand just to see the whole graph. Returns null for widget types
 * that don't need a data-driven minimum (kpi, table, gauge, ...). */
export function computeAutoFitSize(widget: Widget, rows: DataRow[], categoryOrder?: string[]): { w: number; h: number } | null {
  setPreferredCategoryOrder(categoryOrder);
  const config = widget.config ?? {};
  const scoped = applyConfigFilters(rows, config);

  switch (widget.type) {
    case "bar":
    case "bar_detailed": {
      if (!config.x) return null;
      const n = groupAndAgg(scoped, config.x, config.y, config.agg ?? "sum").slice(0, 15).length;
      let h = 5;
      if (n > 6) h += 1; // rotated x-axis labels need more vertical room
      if (n > 10) h += 1;
      if (config.showLabels) h += 1; // on-bar value+% chips need headroom too
      // Always half the grid width (6 of 12 columns) — this is what lets
      // two charts sit side by side in one row by default. Deliberately
      // doesn't escalate to full width just because a chart has a lot of
      // categories (height already grows for that, above); if someone
      // wants a bigger view of a dense chart, that's what the maximize
      // button on the widget is for, rather than every dense chart
      // permanently claiming a full row and breaking the 2-per-row
      // layout for everything after it.
      const w = widget.type === "bar_detailed" ? 9 : 6;
      return { w, h };
    }
    case "pie":
    case "pie_detailed": {
      if (!config.category) return null;
      const n = groupAndAgg(scoped, config.category, config.value, config.agg ?? "sum").slice(0, 10).length;
      const legendRows = Math.max(1, Math.ceil(n / 4));
      const h = 5 + (legendRows - 1);
      const w = widget.type === "pie_detailed" ? 9 : 5;
      return { w, h };
    }
    case "grouped_bar":
    case "grouped_bar_detailed":
    case "grouped_line":
    case "bar_line_series": {
      if (!config.x || !config.seriesField) return null;
      const xCount = new Set(scoped.map((r) => String(r[config.x] ?? "—"))).size;
      let h = 5;
      if (xCount > 6) h += 1;
      if (xCount > 10) h += 1;
      if (widget.type !== "grouped_line" && config.showLabels) h += 1;
      // Always half-width — see the "bar" case above for why this
      // doesn't scale up with data density anymore.
      return { w: 6, h };
    }
    case "heatmap":
    case "treemap":
      return { w: 6, h: 5 };
    case "bar_line_combo": {
      if (!config.x) return null;
      const n = groupAndAgg(scoped, config.x, config.y, config.agg ?? "sum").slice(0, 15).length;
      let h = 6; // dual y-axis + legend needs a bit more than a plain bar
      if (n > 8) h += 1;
      return { w: 6, h };
    }
    case "bar3d":
      return { w: 6, h: 6 }; // half-width still leaves room for the 3D viewport
    case "pie3d":
      return { w: 6, h: 6 };
    case "wave":
      return { w: 4, h: 4 }; // compact, square-ish like a gauge
    case "ridgeline": {
      if (!config.x || !config.seriesField) return null;
      const seriesCount = new Set(scoped.map((r) => String(r[config.seriesField] ?? "—"))).size;
      return { w: 6, h: Math.max(5, Math.min(9, 4 + Math.ceil(seriesCount / 2))) };
    }
    case "streamgraph":
      return { w: 6, h: 5 };
    case "radar":
      return { w: 6, h: 6 }; // needs to stay roughly square to read well
    default:
      return null;
  }
}

/** Return type is deliberately `any`: the builders return whatever
 * shape each ECharts series/component needs (including `bar3D`,
 * `surface`, and `liquidFill` series from the echarts-gl /
 * echarts-liquidfill extensions, which aren't part of core echarts'
 * bundled TypeScript types). Annotating this explicitly — rather than
 * letting TS infer a big union of literal-typed branches — is what lets
 * `<ReactECharts option={...}>` (typed against core echarts' option
 * shape) accept it without a strict literal-type mismatch at build time. */
/** A ridgeline / "joyplot" — one smoothed, semi-transparent, filled
 * curve per category (config.seriesField, e.g. a Section or Category),
 * each stacked with a fixed vertical offset from the one below it on a
 * shared x-axis (config.x) — the classic overlapping-hills look, good
 * for comparing several distributions/trends' shapes at a glance rather
 * than their exact values. ECharts has no native ridgeline series type;
 * this is the standard technique for one (an area line per category,
 * value-shifted so they stack visually without literally being stacked
 * data). Category values are normalized to 0–1 within each series
 * first, so a category with much bigger raw numbers doesn't just
 * flatten every other row. */
export function buildRidgelineOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const xField = config.x;
  const seriesField = config.seriesField;
  const valueField = config.y;
  const agg = config.agg ?? "sum";

  const xValues = Array.from(new Set(scoped.map((r) => String(r[xField] ?? "—")))).sort();
  const seriesValues = sortCbeFirst(Array.from(new Set(scoped.map((r) => String(r[seriesField] ?? "—"))))).slice(0, 10);
  const colorMap = assignSeriesColors(seriesValues);

  const rawSeries = seriesValues.map((sv) =>
    xValues.map((xv) => {
      const matching = scoped.filter((r) => String(r[xField] ?? "—") === xv && String(r[seriesField] ?? "—") === sv);
      const vals = matching.map((r) => Number(r[valueField])).filter(Number.isFinite);
      return vals.length ? aggValues(vals, agg) : null;
    })
  );

  const OFFSET_STEP = 1.15;
  // Reversed so the first category (CBE, via sortCbeFirst) draws on top,
  // at the front/bottom of the ridge stack, rather than being hidden
  // behind everything else.
  const series = seriesValues
    .map((sv, i) => {
      const raw = rawSeries[i];
      const finite = raw.filter((v): v is number => v !== null);
      const max = finite.length ? Math.max(...finite, 0.0001) : 1;
      const offset = (seriesValues.length - 1 - i) * OFFSET_STEP;
      const color = colorMap[sv];
      return {
        name: sv,
        type: "line" as const,
        data: raw.map((v) => (v === null ? null : Math.round((offset + v / max) * 1000) / 1000)),
        smooth: true,
        symbol: "none",
        z: i,
        lineStyle: { width: 1.5, color },
        areaStyle: { color, opacity: 0.55 },
        emphasis: { focus: "series" },
      };
    })
    .reverse();

  return {
    tooltip: { trigger: "axis", backgroundColor: "rgba(17,24,39,0.92)", borderWidth: 0, textStyle: { color: "#fff" } },
    legend: { bottom: 0, textStyle: { fontSize: 11 }, data: seriesValues },
    grid: { left: 8, right: 24, top: 20, bottom: 56, containLabel: true },
    xAxis: { type: "category", data: xValues, boundaryGap: false, axisLabel: { rotate: xValues.length > 6 ? 30 : 0 } },
    yAxis: { type: "value", show: false },
    series,
  };
}

/** Streamgraph: ECharts' native `themeRiver` series — flowing, stacked,
 * symmetric-around-the-centerline bands, one per category
 * (config.seriesField) over time (config.x) — good for showing how each
 * category's share of the whole shifts over the timeline. */
export function buildStreamgraphOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const xField = config.x;
  const seriesField = config.seriesField;
  const valueField = config.y;
  const agg = config.agg ?? "sum";

  const xValues = Array.from(new Set(scoped.map((r) => String(r[xField] ?? "—")))).sort();
  const seriesValues = sortCbeFirst(Array.from(new Set(scoped.map((r) => String(r[seriesField] ?? "—")))));
  const colorMap = assignSeriesColors(seriesValues);

  const data: [string, number, string][] = [];
  for (const xv of xValues) {
    for (const sv of seriesValues) {
      const matching = scoped.filter((r) => String(r[xField] ?? "—") === xv && String(r[seriesField] ?? "—") === sv);
      const vals = matching.map((r) => Number(r[valueField])).filter(Number.isFinite);
      data.push([xv, vals.length ? Math.round(aggValues(vals, agg) * 100) / 100 : 0, sv]);
    }
  }

  return {
    tooltip: { trigger: "axis", backgroundColor: "rgba(17,24,39,0.92)", borderWidth: 0, textStyle: { color: "#fff" } },
    legend: { bottom: 0, textStyle: { fontSize: 11 }, data: seriesValues },
    singleAxis: {
      type: "category", data: xValues, top: 20, bottom: 56, left: 8, right: 24,
      axisLabel: { rotate: xValues.length > 6 ? 30 : 0 },
    },
    series: [{
      type: "themeRiver",
      data,
      color: seriesValues.map((sv) => colorMap[sv]),
      label: { show: false },
      emphasis: { focus: "series" },
    }],
  };
}

/** Radar chart: one indicator (axis) per distinct value of config.x
 * (e.g. Metric/Section), one colored shape per comparison category
 * (config.seriesField, e.g. CBE vs Industry) — good for comparing
 * several metrics' relative shape/balance across categories at a
 * glance, rather than their exact values. Each indicator's scale maxes
 * out at 1.15× the largest value seen for it (across every series), so
 * one outsized metric doesn't flatten all the others down to nothing. */
export function buildRadarOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const xField = config.x;
  const seriesField = config.seriesField;
  const valueField = config.y;
  const agg = config.agg ?? "sum";

  const indicators = Array.from(new Set(scoped.map((r) => String(r[xField] ?? "—")))).slice(0, 12);
  const seriesValues = sortCbeFirst(Array.from(new Set(scoped.map((r) => String(r[seriesField] ?? "—")))));
  const colorMap = assignSeriesColors(seriesValues);

  const maxByIndicator = indicators.map((ind) => {
    const vals = scoped.filter((r) => String(r[xField] ?? "—") === ind).map((r) => Number(r[valueField])).filter(Number.isFinite);
    return vals.length ? Math.max(...vals) * 1.15 || 1 : 1;
  });

  const seriesData = seriesValues.map((sv) => {
    const color = colorMap[sv];
    const value = indicators.map((ind) => {
      const matching = scoped.filter((r) => String(r[xField] ?? "—") === ind && String(r[seriesField] ?? "—") === sv);
      const vals = matching.map((r) => Number(r[valueField])).filter(Number.isFinite);
      return vals.length ? Math.round(aggValues(vals, agg) * 100) / 100 : 0;
    });
    return {
      name: sv, value,
      itemStyle: { color }, lineStyle: { color, width: 2 }, areaStyle: { color, opacity: 0.15 },
    };
  });

  return {
    tooltip: { trigger: "item", backgroundColor: "rgba(17,24,39,0.92)", borderWidth: 0, textStyle: { color: "#fff" } },
    legend: { bottom: 0, textStyle: { fontSize: 11 }, data: seriesValues },
    radar: {
      indicator: indicators.map((name, i) => ({ name, max: maxByIndicator[i] })),
      radius: "62%",
      center: ["50%", "48%"],
      splitArea: { areaStyle: { color: ["rgba(91,42,131,0.03)", "rgba(91,42,131,0.07)"] } },
      axisLine: { lineStyle: { color: "#e5e7eb" } },
      splitLine: { lineStyle: { color: "#e5e7eb" } },
      axisName: { fontSize: 10, color: "#6b7280" },
    },
    series: [{ type: "radar", data: seriesData }],
  };
}

export function buildOptionForWidget(widget: Widget, rows: DataRow[], categoryOrder?: string[]): any {
  setPreferredCategoryOrder(categoryOrder);
  switch (widget.type) {
    case "bar": return buildBarOption(rows, widget.config);
    // "Detailed" variants reuse the exact same chart option as their
    // plain counterpart — the only difference is ChartRenderer also
    // paints a value+percentage list alongside them (see
    // getWidgetListData above).
    case "bar_detailed": return buildBarOption(rows, widget.config);
    case "grouped_bar": return buildGroupedBarOption(rows, widget.config);
    // Same chart as "grouped_bar", just with the value/% labels defaulted
    // on instead of off — the "additional" always-shows-values grouped
    // bar, sitting alongside the plain one (which keeps its own toggle).
    case "grouped_bar_detailed": return buildGroupedBarOption(rows, { ...widget.config, showLabels: widget.config?.showLabels ?? true });
    case "grouped_line": return buildGroupedLineOption(rows, widget.config);
    case "line": return buildLineOption(rows, widget.config, false);
    case "area": return buildLineOption(rows, widget.config, true);
    case "pie": return buildPieOption(rows, widget.config);
    case "pie_detailed": return buildPieOption(rows, widget.config);
    case "scatter": return buildScatterOption(rows, widget.config);
    case "category_scatter": return buildCategoryScatterOption(rows, widget.config);
    case "histogram": return buildHistogramOption(rows, widget.config);
    case "heatmap": return buildHeatmapOption(rows, widget.config);
    case "treemap": return buildTreemapOption(rows, widget.config);
    case "gauge": return buildGaugeOption(rows, widget.config);
    case "wave": return buildWaveOption(rows, widget.config);
    case "bar_line_combo": return buildBarLineComboOption(rows, widget.config);
    case "bar_line_series": return buildBarLineSeriesOption(rows, widget.config);
    case "bar3d": return buildBar3DOption(rows, widget.config);
    case "pie3d": return buildPie3DOption(rows, widget.config);
    case "ridgeline": return buildRidgelineOption(rows, widget.config);
    case "streamgraph": return buildStreamgraphOption(rows, widget.config);
    case "radar": return buildRadarOption(rows, widget.config);
    default: return {};
  }
}
