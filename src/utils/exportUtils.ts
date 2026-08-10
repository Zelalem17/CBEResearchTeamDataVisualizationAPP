import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import {
  Document, Packer, Paragraph, HeadingLevel, ImageRun, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, ShadingType, BorderStyle,
} from "docx";
import type { DataRow } from "@/types";

// Shared brand palette for exports (matches tailwind.config.js) so PDF/Word
// output looks consistent with the CBE-purple/gold theme used on-screen,
// instead of falling back to each library's plain default styling.
const BRAND_PURPLE = "5B2A83";
const BRAND_PURPLE_RGB: [number, number, number] = [91, 42, 131];
const BRAND_GOLD_RGB: [number, number, number] = [242, 169, 0];
const INK_GRAY = "374151";
const MUTED_GRAY = "6B7280";
const HEADER_DARK = "1F2937";
const ROW_STRIPE = "F9FAFB";

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

/** Core capture logic shared by every export path (PNG button, PDF,
 * Word) — see the comments above for why this clones into an
 * untransformed off-screen container and manually restores canvas
 * pixels rather than just calling html2canvas(node) directly. */
async function captureNodeAsCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  await ensureFontsReady();

  const rect = node.getBoundingClientRect();
  const clone = node.cloneNode(true) as HTMLElement;

  const originalCanvases = node.querySelectorAll("canvas");
  const cloneCanvases = clone.querySelectorAll("canvas");
  originalCanvases.forEach((src, i) => {
    const dest = cloneCanvases[i] as HTMLCanvasElement | undefined;
    if (!dest) return;
    dest.width = src.width;
    dest.height = src.height;
    dest.getContext("2d")?.drawImage(src, 0, 0);
  });

  clone.querySelectorAll<HTMLElement>(".widget-toolbar").forEach((el) => { el.style.opacity = "0"; });

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:fixed; top:0; left:-99999px; z-index:-1; width:${rect.width}px; height:${rect.height}px; pointer-events:none;`;
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    return await html2canvas(clone, {
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      scale: 2,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
    });
  } finally {
    document.body.removeChild(wrapper);
  }
}

/** Screenshots a node and returns it as an ArrayBuffer — what the Word
 * export needs for docx.js's ImageRun. See captureNodeAsCanvas for the
 * actual capture logic (shared with the PNG/PDF exports below). */
async function screenshotNode(node: HTMLElement): Promise<{ buffer: ArrayBuffer; ratio: number }> {
  const canvas = await captureNodeAsCanvas(node);
  const dataUrl = canvas.toDataURL("image/png");
  const buffer = await (await fetch(dataUrl)).arrayBuffer();
  return { buffer, ratio: canvas.width / canvas.height };
}

/** Export a single DOM node (a widget card, or the whole dashboard grid)
 * as a PNG image. */
export async function exportNodeToPng(node: HTMLElement, filename: string) {
  const canvas = await captureNodeAsCanvas(node);
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/** Export a DOM node (typically the full dashboard grid) as a paginated
 * PDF snapshot — captures exactly what's on screen, charts included, with
 * a styled brand-purple title and gold accent rule instead of jsPDF's
 * plain default black text. */
export async function exportNodeToPdf(node: HTMLElement, filename: string, title?: string) {
  const canvas = await captureNodeAsCanvas(node);

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgRatio = canvas.width / canvas.height;
  const renderWidth = pageWidth - 40;
  const renderHeight = renderWidth / imgRatio;

  let heightLeft = renderHeight;
  let position = 24;

  if (title) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(...BRAND_PURPLE_RGB);
    pdf.text(title, 24, 34);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Exported ${new Date().toLocaleString()}`, 24, 48);

    // Thin gold accent rule under the title block, echoing the site's header.
    pdf.setDrawColor(...BRAND_GOLD_RGB);
    pdf.setLineWidth(1.5);
    pdf.line(24, 56, pageWidth - 24, 56);

    position = 68;
  }

  pdf.addImage(imgData, "PNG", 20, position, renderWidth, renderHeight);
  heightLeft -= pageHeight - position;

  while (heightLeft > 0) {
    pdf.addPage();
    position = heightLeft - renderHeight + 20;
    pdf.addImage(imgData, "PNG", 20, position, renderWidth, renderHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`${filename}.pdf`);
}

/** Export in-memory rows to an .xlsx workbook — everything runs client-side,
 * no server involved. */
export function exportRowsToExcel(rows: DataRow[], sheetName: string, filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31) || "Sheet1");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

const MAX_WORD_TABLE_ROWS = 200;
// Full-width image (a lone big widget — a table, or anything the admin
// sized wider than half the dashboard grid).
const WIDGET_IMAGE_WIDTH = 560;
// Half-width image, used when two normal-sized charts are placed
// side by side in a single Word table row instead of stacking.
const PAIRED_IMAGE_WIDTH = 230;
// A widget wider than this fraction of the live dashboard's 12-column
// grid is treated as "too big to pair" and gets its own full-width row
// in the export, same as a data table always does.
const PAIRABLE_MAX_GRID_W = 6;

export interface ExportableWidget {
  id: string;
  title: string;
  /** The widget's column span on the live 12-column dashboard grid
   * (widget.position.w) — used to decide whether it's small enough to
   * sit side by side with another widget in the export, or big enough
   * that it needs its own full-width row (tables, wide charts, etc). */
  gridW: number;
}

/** Export a Word (.docx) report: a title block, then every widget
 * captured and inserted as an image (with its own heading), and
 * finally a data table of the filtered rows. Two widgets are placed
 * side by side in a borderless table row whenever both are narrow
 * enough on the live dashboard grid (see PAIRABLE_MAX_GRID_W) — a wide
 * widget (like the data table, or anything the admin resized past half
 * the grid) always gets a full-width row of its own instead, so nothing
 * gets squeezed. Everything — screenshots, document assembly, fonts,
 * colors — happens client-side; no server involved, same as the
 * PDF/Excel/PNG exports.
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
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 44, font: DOC_FONT, color: BRAND_PURPLE })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Exported ${new Date().toLocaleString()} · ${rows.length.toLocaleString()} rows`,
          font: DOC_FONT,
          color: MUTED_GRAY,
          size: 18,
        }),
      ],
      spacing: { after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "F2A900" } },
    }),
  ];

  // --- Capture every widget first (sequentially — each capture clones
  // and removes its own off-screen node, so this stays simple and safe
  // rather than racing several DOM clones at once). ---
  interface CapturedWidget { widget: ExportableWidget; buffer: ArrayBuffer; ratio: number }
  const captured: CapturedWidget[] = [];
  for (const widget of widgets) {
    // Targets WidgetCard's own root element (marked with
    // data-widget-capture), not the react-grid-layout item that
    // positions it. screenshotNode() (see above) clones this node into
    // an untransformed off-screen container before capturing it, which
    // is what actually prevents the widget header from being clipped —
    // capturing an element with a transformed ancestor in place, even
    // indirectly, is what caused that in earlier exports.
    const node = gridNode.querySelector<HTMLElement>(`[data-widget-capture="${widget.id}"]`);
    if (!node) continue;
    const { buffer, ratio } = await screenshotNode(node);
    captured.push({ widget, buffer, ratio });
  }

  const fullWidthBlock = (widget: ExportableWidget, buffer: ArrayBuffer, ratio: number) => {
    const width = WIDGET_IMAGE_WIDTH;
    const height = Math.round(width / ratio);
    children.push(
      new Paragraph({
        children: [new TextRun({ text: widget.title, bold: true, size: 26, font: DOC_FONT, color: BRAND_PURPLE })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
      })
    );
    children.push(
      new Paragraph({
        children: [new ImageRun({ data: buffer, transformation: { width, height } })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      })
    );
  };

  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  const pairCell = (entry: CapturedWidget) => {
    const width = PAIRED_IMAGE_WIDTH;
    const height = Math.round(width / entry.ratio);
    return new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
      margins: { top: 40, bottom: 200, left: 40, right: 40 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: entry.widget.title, bold: true, size: 22, font: DOC_FONT, color: BRAND_PURPLE })],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [new ImageRun({ data: entry.buffer, transformation: { width, height } })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    });
  };

  // --- Lay out: pair up consecutive small widgets two-per-row; a big
  // widget (or a leftover odd one at the end) gets a full-width row. ---
  let pending: CapturedWidget | null = null;
  const flushPending = () => {
    if (!pending) return;
    fullWidthBlock(pending.widget, pending.buffer, pending.ratio);
    pending = null;
  };

  for (const entry of captured) {
    const isPairable = entry.widget.gridW <= PAIRABLE_MAX_GRID_W;
    if (!isPairable) {
      flushPending(); // a lone pending small widget becomes its own row
      fullWidthBlock(entry.widget, entry.buffer, entry.ratio);
      continue;
    }
    if (!pending) {
      pending = entry;
      continue;
    }
    // Two pairable widgets in hand — place them side by side.
    const first = pending;
    pending = null;
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
        rows: [new TableRow({ children: [pairCell(first), pairCell(entry)] })],
      })
    );
  }
  flushPending(); // odd one out at the very end, if any

  // --- Data table appendix ---
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const tableRows = rows.slice(0, MAX_WORD_TABLE_ROWS);

  if (columns.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Data", bold: true, size: 26, font: DOC_FONT, color: BRAND_PURPLE })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 120 },
      })
    );

    if (rows.length > MAX_WORD_TABLE_ROWS) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Showing the first ${MAX_WORD_TABLE_ROWS} of ${rows.length.toLocaleString()} rows. Use the Excel export for the full dataset.`,
              italics: true,
              font: DOC_FONT,
              color: MUTED_GRAY,
              size: 16,
            }),
          ],
          spacing: { after: 120 },
        })
      );
    }

    const headerRow = new TableRow({
      tableHeader: true,
      children: columns.map(
        (col) =>
          new TableCell({
            shading: { type: ShadingType.SOLID, color: HEADER_DARK, fill: HEADER_DARK },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: col, bold: true, color: "FFFFFF", font: DOC_FONT, size: 17 })],
              }),
            ],
          })
      ),
    });

    const dataRows = tableRows.map(
      (row, i) =>
        new TableRow({
          children: columns.map(
            (col) =>
              new TableCell({
                shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: ROW_STRIPE, fill: ROW_STRIPE } : undefined,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: String(row[col] ?? ""), font: DOC_FONT, color: INK_GRAY, size: 16 })],
                  }),
                ],
              })
          ),
        })
    );

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows],
      })
    );
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
