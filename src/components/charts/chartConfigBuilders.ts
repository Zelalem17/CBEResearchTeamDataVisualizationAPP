import type { DataRow, Widget } from "@/types";

/** Turns raw rows + widget config into an ECharts `option` object.
 * Every builder is pure (rows in, option out) so ChartRenderer can stay
 * a thin wrapper and charts stay easy to unit-test.
 */

// Commercial Bank of Ethiopia identity: deep purple as the primary
// brand color, warm gold as the accent, with near-black/charcoal and
// soft neutrals rounding out a palette that reads as "CBE" rather than
// a generic rainbow — every chart in the app draws its category colors
// from this set. Mirrors tailwind.config.js's brand/gold scales.
const PALETTE = [
  "#5b2a83", // brand purple 600 — primary
  "#f2a900", // gold 500 — accent
  "#2a1339", // brand purple 900 — near-black plum
  "#8f5cc4", // brand purple 400 — lighter purple
  "#cc8b00", // gold 600 — deeper gold
  "#4a2169", // brand purple 700
  "#fbc94d", // gold 300 — light gold
  "#1f2937", // charcoal — neutral for extra categories
];

// This app is for the Commercial Bank of Ethiopia — whenever a bar,
// slice, or series is literally labelled "CBE" (as opposed to e.g. an
// "Industry" comparison category), it should always render in CBE's
// own brand purple rather than whatever color the palette would
// otherwise assign it, so CBE's own figures are instantly identifiable
// on every chart. Matches tailwind's brand-600.
const CBE_BRAND_PURPLE = "#5b2a83";
export function isCbeLabel(label: string): boolean {
  return /cbe/i.test(label);
}
/** Returns an itemStyle color override for CBE-labelled data/series,
 * or undefined so the caller's own default (palette / series index)
 * applies untouched. */
function cbeColorOverride(label: string): { color: string } | undefined {
  return isCbeLabel(label) ? { color: CBE_BRAND_PURPLE } : undefined;
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
  return entries.sort((a, b) => b.value - a.value);
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
  return {
    color: PALETTE,
    tooltip: { trigger: "item", backgroundColor: "rgba(17,24,39,0.92)", textStyle: { color: "#fff" } },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      type: "pie", radius, roseType, center: ["50%", "45%"],
      data: data.map((d) => ({
        name: d.key,
        value: d.value,
        itemStyle: cbeColorOverride(d.key),
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
export function buildCategoryScatterOption(rows: DataRow[], config: any) {
  const scoped = applyConfigFilters(rows, config);
  const seriesField = config.seriesField ?? "Category";
  const xRowField = config.x;
  const valueField = config.y ?? "Value";

  const cats = Array.from(new Set(scoped.map((r) => String(r[seriesField])))).slice(0, 2);
  if (cats.length < 2) {
    return {
      title: { text: "Need at least 2 categories to compare", left: "center", top: "middle", textStyle: { fontSize: 12, color: "#94a3b8" } },
      series: [],
    };
  }
  const [catA, catB] = cats;
  const xLabels = Array.from(new Set(scoped.map((r) => String(r[xRowField] ?? "—"))));
  const points: [number, number, string][] = [];
  for (const label of xLabels) {
    const a = scoped.find((r) => String(r[xRowField] ?? "—") === label && String(r[seriesField]) === catA);
    const b = scoped.find((r) => String(r[xRowField] ?? "—") === label && String(r[seriesField]) === catB);
    if (!a || !b) continue;
    const av = Number(a[valueField]), bv = Number(b[valueField]);
    if (Number.isFinite(av) && Number.isFinite(bv)) points.push([av, bv, label]);
  }

  return {
    color: PALETTE,
    tooltip: {
      trigger: "item", backgroundColor: "rgba(17,24,39,0.92)", borderWidth: 0, textStyle: { color: "#fff" },
      formatter: (p: any) => `${p.data[2]}<br/>${catA}: ${p.data[0]}<br/>${catB}: ${p.data[1]}`,
    },
    grid: baseGrid,
    xAxis: { type: "value", name: catA, nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: catB, nameLocation: "middle", nameGap: 45 },
    series: [{ type: "scatter", data: points, symbolSize: 12, itemStyle: { opacity: 0.75, color: PALETTE[0] } }],
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
  const yValues = Array.from(new Set(scoped.map((r) => String(r[seriesField] ?? "—"))));

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
  const series = data.map((d, i) => {
    const startRatio = cumulative / total;
    cumulative += d.value;
    const endRatio = cumulative / total;
    const color = isCbeLabel(d.key) ? CBE_BRAND_PURPLE : PALETTE[i % PALETTE.length];
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
  const seriesValues = Array.from(new Set(scoped.map((r) => String(r[seriesField] ?? "—"))));

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

  const series = seriesValues.map((sv, i) => {
    const data = matrix[i].map((v, xi) => {
      if (v === null) return null;
      return { value: v, pct: (v / totalsByX[xi]) * 100 };
    });
    const seriesColor = isCbeLabel(sv) ? CBE_BRAND_PURPLE : PALETTE[i % PALETTE.length];
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
  const seriesValues = Array.from(new Set(scoped.map((r) => String(r[seriesField] ?? "—"))));

  const symbol = config.symbolShape ?? "circle";
  const showLabels = !!config.showLabels;
  const series = seriesValues.map((sv, i) => {
    const data = xValues.map((xv) => {
      const matching = scoped.filter((r) => String(r[xField] ?? "—") === xv && String(r[seriesField] ?? "—") === sv);
      const vals = matching.map((r) => Number(r[valueField])).filter(Number.isFinite);
      if (!vals.length) return null;
      return Math.round(aggValues(vals, agg) * 10000) / 10000;
    });
    const seriesColor = isCbeLabel(sv) ? CBE_BRAND_PURPLE : PALETTE[i % PALETTE.length];
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
export function getWidgetListData(widget: Widget, rows: DataRow[]): WidgetListRow[] {
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
export function computeAutoFitSize(widget: Widget, rows: DataRow[]): { w: number; h: number } | null {
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
      let w = widget.type === "bar_detailed" ? 9 : 6;
      if (n > 8) w = Math.min(12, w + 2);
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
    case "grouped_line": {
      if (!config.x || !config.seriesField) return null;
      const xCount = new Set(scoped.map((r) => String(r[config.x] ?? "—"))).size;
      const seriesCount = new Set(scoped.map((r) => String(r[config.seriesField] ?? "—"))).size;
      let h = 5;
      if (xCount > 6) h += 1;
      if (xCount > 10) h += 1;
      if (widget.type === "grouped_bar" && config.showLabels) h += 1;
      let w = 6;
      const bars = xCount * seriesCount;
      if (bars > 12) w = 8;
      if (bars > 24) w = 10;
      return { w, h };
    }
    case "heatmap":
    case "treemap":
      return { w: 6, h: 5 };
    case "bar_line_combo": {
      if (!config.x) return null;
      const n = groupAndAgg(scoped, config.x, config.y, config.agg ?? "sum").slice(0, 15).length;
      let h = 6; // dual y-axis + legend needs a bit more than a plain bar
      if (n > 8) h += 1;
      let w = 7;
      if (n > 8) w = 9;
      return { w, h };
    }
    case "bar3d":
      return { w: 7, h: 6 }; // 3D viewport needs real estate to read
    case "pie3d":
      return { w: 6, h: 6 };
    case "wave":
      return { w: 4, h: 4 }; // compact, square-ish like a gauge
    default:
      return null;
  }
}

export function buildOptionForWidget(widget: Widget, rows: DataRow[]) {
  switch (widget.type) {
    case "bar": return buildBarOption(rows, widget.config);
    // "Detailed" variants reuse the exact same chart option as their
    // plain counterpart — the only difference is ChartRenderer also
    // paints a value+percentage list alongside them (see
    // getWidgetListData above).
    case "bar_detailed": return buildBarOption(rows, widget.config);
    case "grouped_bar": return buildGroupedBarOption(rows, widget.config);
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
    case "bar3d": return buildBar3DOption(rows, widget.config);
    case "pie3d": return buildPie3DOption(rows, widget.config);
    default: return {};
  }
}
