import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import {
  Document, Packer, Paragraph, HeadingLevel, ImageRun, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, ShadingType, BorderStyle, VerticalAlign,
} from "docx";
import type { DataRow } from "@/types";
import { computeKpiValue } from "@/components/kpi/KpiCard";

// Shared brand palette for exports (matches tailwind.config.js) so PDF/Word
// output looks consistent with the CBE-purple/gold theme used on-screen,
// instead of falling back to each library's plain default styling.
const BRAND_PURPLE = "5B2A83";
const BRAND_PURPLE_RGB: [number, number, number] = [91, 42, 131];
const BRAND_GOLD = "F2A900";
const BRAND_GOLD_RGB: [number, number, number] = [242, 169, 0];
const INK_GRAY = "374151";
const MUTED_GRAY = "6B7280";
const ROW_STRIPE = "F9FAFB";
const UP_GREEN = "0F9D58";
const DOWN_RED = "D93025";

// Word's default template renders un-styled text in Times New Roman on a
// lot of setups, which is what was reading as "ugly." Pin every run to a
// clean, modern, widely-installed font instead.
const DOC_FONT = "Calibri";

/** html2canvas screenshots a *cloned* copy of the DOM. If the page's custom
 * web font (Poppins, loaded from Google Fonts) hasn't finished loading by
 * the moment that clone is captured, the clone briefly renders with a
 * fallback font — which has different letter height/metrics — and any
 * text sitting in a tightly-padded container (like a KPI label) can end up
 * visibly clipped in the exported image even though it looks fine on
 * screen. Waiting for `document.fonts.ready`, plus one extra paint frame
 * for layout to settle, eliminates that mismatch. Every screenshot in this
 * file goes through this first. */
async function ensureFontsReady(): Promise<void> {
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await (document as any).fonts.ready;
    } catch {
      /* older browsers without the Font Loading API — safe to ignore */
    }
  }
  // One extra animation frame so any font-swap reflow has actually painted
  // before html2canvas clones the DOM.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/** Shared screenshot primitive — every export (PNG button, Word's
 * per-widget images, PDF's per-widget images) goes through this one
 * html2canvas call so the capture settings (scale, background, font
 * readiness) never drift out of sync between them. */
async function captureCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  await ensureFontsReady();
  return html2canvas(node, {
    // Transparent, not a solid page/body-colored fill — a widget card
    // has rounded corners, and forcing a solid rectangle behind it used
    // to leave a visible colored box in the corners of every downloaded
    // PNG and every image placed into the Word/PDF exports (and, in
    // dark mode, a dark box that looked flatly wrong once pasted onto a
    // normal white page).
    backgroundColor: null,
    // 4x device-pixel density — high enough that chart labels, axis
    // numbers, and legends stay crisp even after being placed into a
    // Word/PDF page at a smaller display size.
    scale: 4,
    useCORS: true,
    // Drag handles and per-widget toolbar buttons are on-screen UI
    // chrome, not part of the widget's actual content — hide anything
    // marked .capture-hide (the drag-handle grip icon) so it never shows
    // up in an exported image. The toolbar buttons don't need the same
    // treatment: they're already opacity-0 except on hover, and
    // html2canvas already respects that.
    ignoreElements: (el) => el.classList?.contains("capture-hide"),
    // `backgroundColor: null` above only stops html2canvas from painting
    // its *own* fallback fill behind the captured content — it doesn't
    // touch the captured element's *own* CSS background (e.g. a widget
    // card's `bg-white dark:bg-gray-900`), which still gets faithfully
    // rendered as an opaque rectangle. html2canvas's `onclone` callback
    // only ever receives the cloned *document* (not a direct reference
    // to the cloned counterpart of `node`), so the clone of `node` is
    // located inside it via its own `data-widget-capture` id — every
    // node this function is ever called with carries one — and just
    // that root background is stripped there, on the throwaway clone
    // only (the real on-screen card is untouched). Deliberately only the
    // root node — inner colored design (the Report panel's gradient
    // header, gold accent bars, chart colors) is left exactly as-is.
    onclone: (clonedDoc: globalThis.Document) => {
      const captureId = node.getAttribute("data-widget-capture");
      const clonedNode = captureId
        ? (clonedDoc.querySelector(`[data-widget-capture="${CSS.escape(captureId)}"]`) as HTMLElement | null)
        : null;
      if (clonedNode) clonedNode.style.backgroundColor = "transparent";
    },
  });
}

async function screenshotNode(node: HTMLElement): Promise<{ buffer: ArrayBuffer; ratio: number }> {
  const canvas = await captureCanvas(node);
  const dataUrl = canvas.toDataURL("image/png");
  const buffer = await (await fetch(dataUrl)).arrayBuffer();
  return { buffer, ratio: canvas.width / canvas.height };
}

/** Export a single DOM node (typically a widget card, which carries a
 * `data-widget-capture` id used above to make its background
 * transparent in the export) as a PNG image. */
export async function exportNodeToPng(node: HTMLElement, filename: string) {
  const canvas = await captureCanvas(node);
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/** Export in-memory rows to an .xlsx workbook — everything runs client-side,
 * no server involved. */
export function exportRowsToExcel(rows: DataRow[], sheetName: string, filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31) || "Sheet1");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

const WIDGET_IMAGE_WIDTH = 560;

export interface ExportableWidget {
  id: string;
  title: string;
  /** The widget's grid width, out of the dashboard's 12-column grid —
   * used to size its exported image proportionally, so a small KPI tile
   * and a full-width chart don't both get stamped out at the same fixed
   * width in the Word doc / PDF page. */
  gridW: number;
  /** Used to route the widget into the report's "Report" (KPI) section
   * vs its "Charts" (image) section — see TEXT_WIDGET_TYPES below. */
  type: string;
  config: Record<string, any>;
}

/** Widget types rendered as real, selectable Word text instead of a
 * screenshot: a KPI number is just a label + a number + a trend — pure
 * text, no reason to be a picture. "table" (raw data table) widgets are
 * deliberately excluded from the Word report entirely, not converted to
 * text either — this document is a report (KPI summary + chart images),
 * not a data export; the Excel button covers the underlying data. */
const TEXT_WIDGET_TYPES = new Set(["kpi", "table"]);

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 30, font: DOC_FONT, color: BRAND_PURPLE })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 40 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: BRAND_GOLD } },
  });
}

function tableHeaderCell(text: string, align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT): TableCell {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: BRAND_PURPLE, fill: BRAND_PURPLE },
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text, bold: true, color: "FFFFFF", font: DOC_FONT, size: 18 })] })],
  });
}

function tableBodyCell(text: string, striped: boolean, opts?: { color?: string; bold?: boolean; align?: typeof AlignmentType[keyof typeof AlignmentType] }): TableCell {
  return new TableCell({
    shading: striped ? { type: ShadingType.SOLID, color: ROW_STRIPE, fill: ROW_STRIPE } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: opts?.align ?? AlignmentType.LEFT,
        children: [new TextRun({ text, font: DOC_FONT, size: 17, color: opts?.color ?? INK_GRAY, bold: opts?.bold })],
      }),
    ],
  });
}

/** Builds the "Report" section's KPI summary table: one row per KPI
 * widget, columns Metric / Value / Trend, with an up/down/flat arrow
 * colored green/red/gray for the trend — a genuine formatted table
 * instead of a screenshot of the on-screen cards. */
function buildKpiSummaryTable(kpiWidgets: ExportableWidget[], rows: DataRow[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [tableHeaderCell("Metric"), tableHeaderCell("Value", AlignmentType.RIGHT), tableHeaderCell("Trend", AlignmentType.RIGHT)],
  });
  const bodyRows = kpiWidgets.map((widget, i) => {
    const { formattedValue, deltaPct } = computeKpiValue({ type: "kpi", title: widget.title, config: widget.config } as any, rows);
    const isUp = deltaPct > 0.5;
    const isDown = deltaPct < -0.5;
    const trendText = `${isUp ? "▲" : isDown ? "▼" : "–"} ${Math.abs(deltaPct).toFixed(1)}%`;
    const trendColor = isUp ? UP_GREEN : isDown ? DOWN_RED : MUTED_GRAY;
    const striped = i % 2 === 1;
    return new TableRow({
      children: [
        tableBodyCell(widget.title, striped, { bold: true }),
        tableBodyCell(formattedValue, striped, { align: AlignmentType.RIGHT }),
        tableBodyCell(trendText, striped, { color: trendColor, bold: true, align: AlignmentType.RIGHT }),
      ],
    });
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] });
}

/** Export a Word (.docx) report: title, then a **Report** section — KPI
 * numbers and data tables rendered as real, selectable Word text/tables
 * — then a **Charts** section with every chart captured and inserted as
 * its own image (with its own heading). No raw data dump: this is a
 * report to read and present, not a data export (use the Excel button
 * for that). Everything — screenshots, document assembly, fonts, colors
 * — happens client-side; no server involved, same as the PDF/Excel/PNG
 * exports.
 *
 * `gridNode` is the dashboard grid container; each widget's root element
 * inside it carries a `data-widget-capture="<id>"` attribute (set on
 * WidgetCard's own root, not the react-grid-layout item that positions
 * it — see the note below) so each one can be located and screenshotted
 * separately.
 */
export async function exportDashboardToWord(
  gridNode: HTMLElement,
  widgets: ExportableWidget[],
  filename: string,
  title: string,
  rows: DataRow[]
) {
  const kpiWidgets = widgets.filter((w) => w.type === "kpi");
  const chartWidgets = widgets.filter((w) => !TEXT_WIDGET_TYPES.has(w.type));

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 44, font: DOC_FONT, color: BRAND_PURPLE })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Exported ${new Date().toLocaleString()}`, font: DOC_FONT, color: MUTED_GRAY, size: 18 })],
      spacing: { after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND_GOLD } },
    }),
  ];

  // --- Report section: KPI totals as a real table, no screenshots ---
  // Deliberately doesn't include "table"-type (raw data table) widgets —
  // this document is a report to read and present (KPI summary + chart
  // images), not a data export; use the Excel button for the underlying
  // data.
  if (kpiWidgets.length) {
    children.push(sectionHeading("Report"));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Key metrics", bold: true, size: 22, font: DOC_FONT, color: INK_GRAY })],
        spacing: { before: 160, after: 100 },
      })
    );
    children.push(buildKpiSummaryTable(kpiWidgets, rows));
  }

  // --- Charts section: one screenshot image per widget, each with its own heading ---
  if (chartWidgets.length) {
    children.push(sectionHeading("Charts"));
    for (const widget of chartWidgets) {
      // Deliberately targets WidgetCard's own root element (marked with
      // data-widget-capture), NOT the react-grid-layout grid-item that wraps
      // it — that wrapper is positioned via a CSS transform, and html2canvas
      // has a known quirk where capturing a transformed element crops a few
      // pixels off the top of its content (this is what caused widget titles
      // to render half-cut in earlier exports). The per-widget PNG button
      // was never affected because it already targets this same safe inner
      // element via WidgetCard's own ref.
      const node = gridNode.querySelector<HTMLElement>(`[data-widget-capture="${widget.id}"]`);
      if (!node) continue;

      const { buffer, ratio } = await screenshotNode(node);
      // Proportional to how wide the widget actually is on the dashboard
      // (out of 12 grid columns) — clamped so a narrow tile still reads
      // clearly and nothing overflows the page width.
      const width = Math.max(220, Math.min(WIDGET_IMAGE_WIDTH, Math.round(WIDGET_IMAGE_WIDTH * (widget.gridW / 12))));
      const height = Math.round(width / ratio);

      children.push(
        new Paragraph({
          children: [new TextRun({ text: widget.title, bold: true, size: 24, font: DOC_FONT, color: BRAND_PURPLE })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 100 },
        })
      );
      children.push(
        new Paragraph({
          children: [new ImageRun({ data: buffer, transformation: { width, height } })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        })
      );
    }
  }

  const doc = new Document({
    // Sets the fallback font for any run that doesn't specify one — belt
    // and braces alongside the explicit `font: DOC_FONT` on every TextRun
    // above, so nothing in the document silently reverts to Word's own
    // default typeface.
    styles: {
      default: {
        document: { run: { font: DOC_FONT, size: 21 } },
      },
    },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.docx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Export a paginated PDF: title block, then every widget captured and
 * placed as its **own image**, one at a time, with its own heading —
 * never sliced across a page boundary. Each image is scaled to fit
 * within a single page's content area *before* being placed, and a new
 * page starts *before* drawing whenever the next widget wouldn't fully
 * fit in the space remaining — so nothing is ever cut off mid-chart the
 * way slicing one giant whole-dashboard screenshot into fixed-height
 * bands used to. Widgets that fit still pack multiple to a page. */
export async function exportDashboardToPdf(
  gridNode: HTMLElement,
  widgets: ExportableWidget[],
  filename: string,
  title?: string
) {
  await ensureFontsReady();
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: false });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  let cursorY = margin;

  if (title) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(...BRAND_PURPLE_RGB);
    const titleLines = pdf.splitTextToSize(title, pageWidth - margin * 2);
    pdf.text(titleLines, margin, cursorY + 10);
    const titleBlockHeight = titleLines.length * 20;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Exported ${new Date().toLocaleString()}`, margin, cursorY + titleBlockHeight + 4);

    pdf.setDrawColor(...BRAND_GOLD_RGB);
    pdf.setLineWidth(1.5);
    const ruleY = cursorY + titleBlockHeight + 12;
    pdf.line(margin, ruleY, pageWidth - margin, ruleY);

    cursorY = ruleY + 18;
  }

  const contentWidth = pageWidth - margin * 2;
  // Leaves room for each widget's heading line above its image, within
  // one page's usable height.
  const maxImgHeight = pageHeight - margin * 2 - 18;

  for (const widget of widgets) {
    const node = gridNode.querySelector<HTMLElement>(`[data-widget-capture="${widget.id}"]`);
    if (!node) continue;

    const canvas = await captureCanvas(node);
    const dataUrl = canvas.toDataURL("image/png");
    const ratio = canvas.width / canvas.height;

    let renderWidth = contentWidth;
    let renderHeight = renderWidth / ratio;
    // Scale down (never up) so a very tall widget still fits within one
    // page's height instead of overflowing into the next.
    if (renderHeight > maxImgHeight) {
      renderHeight = maxImgHeight;
      renderWidth = renderHeight * ratio;
    }

    const neededHeight = 16 + renderHeight + 20;
    if (cursorY + neededHeight > pageHeight - margin && cursorY > margin + 4) {
      pdf.addPage();
      cursorY = margin;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(...BRAND_PURPLE_RGB);
    pdf.text(widget.title, margin, cursorY + 10);
    cursorY += 16;

    const centeredX = margin + (contentWidth - renderWidth) / 2;
    pdf.addImage(dataUrl, "PNG", centeredX, cursorY, renderWidth, renderHeight, undefined, "NONE");
    cursorY += renderHeight + 20;
  }

  pdf.save(`${filename}.pdf`);
}

/** Trigger a browser download from a URL that returns a file (blob) —
 * generic helper, not currently used by any built-in export but handy if
 * you ever wire this app up to a server-generated export endpoint. */
export function downloadFromUrl(url: string, token: string | null) {
  fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then((res) => res.blob())
    .then((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = url.split("/").pop() || "export";
      link.click();
      URL.revokeObjectURL(link.href);
    }); 
}
