import type { DataRow, Widget } from "@/types";

/** Turns raw rows + widget config into an ECharts `option` object.
 * Every builder is pure (rows in, option out) so ChartRenderer can stay
 * a thin wrapper and charts stay easy to unit-test.
 */

const PALETTE = ["#6366f1", "#22c55e", "#f97316", "#06b6d4", "#e11d48", "#a855f7", "#eab308", "#64748b"];

function groupAndAgg(rows: DataRow[], groupField: string, valueField?: string, agg: string = "sum") {
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

const baseTooltip = { trigger: "axis" as const, backgroundColor: "rgba(17,24,39,0.92)", borderWidth: 0, textStyle: { color: "#fff" } };
const baseGrid = { left: 48, right: 24, top: 32, bottom: 40, containLabel: true };

export function buildBarOption(rows: DataRow[], config: any) {
  const data = groupAndAgg(rows, config.x, config.y, config.agg ?? "sum").slice(0, 15);
  return {
    color: PALETTE,
    tooltip: baseTooltip,
    grid: baseGrid,
    xAxis: { type: "category", data: data.map((d) => d.key), axisLabel: { rotate: data.length > 6 ? 30 : 0 } },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: data.map((d) => d.value), itemStyle: { borderRadius: [4, 4, 0, 0] }, barMaxWidth: 42 }],
  };
}

export function buildLineOption(rows: DataRow[], config: any, area = false) {
  const data = groupAndAgg(rows, config.x, config.y, config.agg ?? "sum")
    .sort((a, b) => (a.key > b.key ? 1 : -1));
  return {
    color: PALETTE,
    tooltip: baseTooltip,
    grid: baseGrid,
    xAxis: { type: "category", data: data.map((d) => d.key), boundaryGap: false },
    yAxis: { type: "value" },
    series: [{
      type: "line", data: data.map((d) => d.value), smooth: true, symbol: "circle", symbolSize: 6,
      areaStyle: area ? { opacity: 0.15 } : undefined, lineStyle: { width: 2.5 },
    }],
  };
}

export function buildPieOption(rows: DataRow[], config: any) {
  const data = groupAndAgg(rows, config.category, config.value, config.agg ?? "sum").slice(0, 10);
  return {
    color: PALETTE,
    tooltip: { trigger: "item", backgroundColor: "rgba(17,24,39,0.92)", textStyle: { color: "#fff" } },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      type: "pie", radius: ["42%", "72%"], center: ["50%", "45%"],
      data: data.map((d) => ({ name: d.key, value: d.value })),
      itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 },
      label: { formatter: "{b}\n{d}%", fontSize: 11 },
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

export function buildHistogramOption(rows: DataRow[], config: any) {
  const values = rows.map((r) => Number(r[config.field])).filter(Number.isFinite);
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
      inRange: { color: ["#e11d48", "#f8fafc", "#6366f1"] },
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
      type: "gauge", min: 0, max: Math.ceil(max * 1.1) || 100, progress: { show: true, width: 14 },
      axisLine: { lineStyle: { width: 14 } }, pointer: { show: false },
      axisTick: { show: false }, splitLine: { length: 8 },
      axisLabel: { fontSize: 9, distance: 14 },
      detail: { valueAnimation: true, fontSize: 22, offsetCenter: [0, "35%"], formatter: (v: number) => v.toFixed(1) },
      data: [{ value: Math.round(avg * 100) / 100 }],
    }],
  };
}

export function buildOptionForWidget(widget: Widget, rows: DataRow[]) {
  switch (widget.type) {
    case "bar": return buildBarOption(rows, widget.config);
    case "line": return buildLineOption(rows, widget.config, false);
    case "area": return buildLineOption(rows, widget.config, true);
    case "pie": return buildPieOption(rows, widget.config);
    case "scatter": return buildScatterOption(rows, widget.config);
    case "histogram": return buildHistogramOption(rows, widget.config);
    case "heatmap": return buildHeatmapOption(rows, widget.config);
    case "treemap": return buildTreemapOption(rows, widget.config);
    case "gauge": return buildGaugeOption(rows, widget.config);
    default: return {};
  }
}
