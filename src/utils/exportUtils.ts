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

async function screenshotNode(node: HTMLElement): Promise<{ buffer: ArrayBuffer; ratio: number }> {
  await ensureFontsReady();
  const canvas = await html2canvas(node, {
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    // 3x device-pixel density (previously 2x) — the difference between
    // "readable at a glance" and "blurry once placed into a Word/PDF
    // page" for chart labels, axis numbers, and legends specifically,
    // since those get shrunk down again once embedded in the document.
    scale: 3,
    useCORS: true,
  });
  const dataUrl = canvas.toDataURL("image/png");
  const buffer = await (await fetch(dataUrl)).arrayBuffer();
  return { buffer, ratio: canvas.width / canvas.height };
}

/** Export a single DOM node (a widget card, or the whole dashboard grid)
 * as a PNG image. */
export async function exportNodeToPng(node: HTMLElement, filename: string) {
  await ensureFontsReady();
  const canvas = await html2canvas(node, {
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    scale: 3,
    useCORS: true,
  });
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
  await ensureFontsReady();
  const canvas = await html2canvas(node, {
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    scale: 3,
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/png");
  // "NONE" keeps the PNG's full pixel data — jsPDF's own default
  // compression on addImage was softening fine chart lines/labels
  // slightly at this higher scale.
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: false });
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
    // Wrap instead of letting a long dataset name run off the page edge
    // (or under the export button chrome that used to sit there) — this
    // is what was reading as "header text not fully visible" in PDF
    // exports.
    const titleLines = pdf.splitTextToSize(title, pageWidth - 48);
    pdf.text(titleLines, 24, 34);
    const titleBlockHeight = titleLines.length * 20;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Exported ${new Date().toLocaleString()}`, 24, 34 + titleBlockHeight - 6);

    // Thin gold accent rule under the title block, echoing the site's header.
    pdf.setDrawColor(...BRAND_GOLD_RGB);
    pdf.setLineWidth(1.5);
    const ruleY = 34 + titleBlockHeight + 4;
    pdf.line(24, ruleY, pageWidth - 24, ruleY);

    position = ruleY + 12;
  }

  pdf.addImage(imgData, "PNG", 20, position, renderWidth, renderHeight, undefined, "NONE");
  heightLeft -= pageHeight - position;

  while (heightLeft > 0) {
    pdf.addPage();
    position = heightLeft - renderHeight + 20;
    pdf.addImage(imgData, "PNG", 20, position, renderWidth, renderHeight, undefined, "NONE");
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
const WIDGET_IMAGE_WIDTH = 560;

export interface ExportableWidget {
  id: string;
  title: string;
  /** The widget's grid width, out of the dashboard's 12-column grid —
   * used to size its exported image proportionally, so a small KPI tile
   * and a full-width chart don't both get stamped out at the same fixed
   * width in the Word doc. */
  gridW: number;
}

/** Export a Word (.docx) report: a title block, then every widget
 * captured and inserted as its **own individual image** (with its own
 * heading) rather than one merged screenshot of the whole dashboard, and
 * finally a data table of the filtered rows. Everything — screenshots,
 * document assembly, fonts, colors — happens client-side; no server
 * involved, same as the PDF/Excel/PNG exports.
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

  // --- One image per widget, each with its own heading ---
  for (const widget of widgets) {
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
    // (out of 12 grid columns) — clamped so a narrow KPI tile still
    // reads clearly and nothing overflows the page width.
    const width = Math.max(220, Math.min(WIDGET_IMAGE_WIDTH, Math.round(WIDGET_IMAGE_WIDTH * (widget.gridW / 12))));
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
  }

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
