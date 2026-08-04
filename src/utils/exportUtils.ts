import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import {
  Document, Packer, Paragraph, HeadingLevel, ImageRun, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, ShadingType,
} from "docx";
import type { DataRow } from "@/types";

/** Export a single DOM node (a widget card, or the whole dashboard grid)
 * as a PNG image. */
export async function exportNodeToPng(node: HTMLElement, filename: string) {
  const canvas = await html2canvas(node, {
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    scale: 2,
    useCORS: true,
  });
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/** Export a DOM node (typically the full dashboard grid) as a paginated
 * PDF snapshot — captures exactly what's on screen, charts included. */
export async function exportNodeToPdf(node: HTMLElement, filename: string, title?: string) {
  const canvas = await html2canvas(node, {
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    scale: 2,
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgRatio = canvas.width / canvas.height;
  let renderWidth = pageWidth - 40;
  let renderHeight = renderWidth / imgRatio;

  let heightLeft = renderHeight;
  let position = title ? 50 : 20;

  if (title) {
    pdf.setFontSize(16);
    pdf.text(title, 20, 30);
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

/** Export a Word (.docx) report: a title page with a screenshot of the
 * dashboard exactly as it's currently displayed (charts included, via the
 * same html2canvas capture used for PDF), followed by a data table of the
 * filtered rows. Built entirely in the browser with the `docx` library —
 * no server involved, same as the PDF/Excel/PNG exports. */
export async function exportNodeToWord(
  node: HTMLElement,
  filename: string,
  title: string,
  rows: DataRow[]
) {
  // 1. Screenshot the dashboard, same approach as the PDF export.
  const canvas = await html2canvas(node, {
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    scale: 2,
    useCORS: true,
  });
  const dataUrl = canvas.toDataURL("image/png");
  const imageBuffer = await (await fetch(dataUrl)).arrayBuffer();

  // Fit the screenshot to a sensible page width (docx uses points/EMU under
  // the hood; ImageRun's `transformation` takes plain pixel-ish dimensions).
  const MAX_WIDTH = 620;
  const imgRatio = canvas.width / canvas.height;
  const imgWidth = MAX_WIDTH;
  const imgHeight = Math.round(MAX_WIDTH / imgRatio);

  // 2. Build a data table (capped, so the file doesn't balloon for large
  // datasets — same cap the backend's PDF export used).
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const tableRows = rows.slice(0, MAX_WORD_TABLE_ROWS);

  const headerRow = new TableRow({
    tableHeader: true,
    children: columns.map(
      (col) =>
        new TableCell({
          shading: { type: ShadingType.SOLID, color: "1F2937", fill: "1F2937" },
          children: [
            new Paragraph({
              children: [new TextRun({ text: col, bold: true, color: "FFFFFF", size: 16 })],
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
              shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: "F9FAFB", fill: "F9FAFB" } : undefined,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: String(row[col] ?? ""), size: 16 })],
                }),
              ],
            })
        ),
      })
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Exported ${new Date().toLocaleString()} · ${rows.length.toLocaleString()} rows`,
                color: "6B7280",
                size: 18,
              }),
            ],
            spacing: { after: 300 },
          }),

          new Paragraph({
            children: [new ImageRun({ data: imageBuffer, transformation: { width: imgWidth, height: imgHeight } })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),

          new Paragraph({
            text: "Data",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 150 },
          }),

          ...(rows.length > MAX_WORD_TABLE_ROWS
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Showing the first ${MAX_WORD_TABLE_ROWS} of ${rows.length.toLocaleString()} rows. Use the Excel export for the full dataset.`,
                      italics: true,
                      color: "6B7280",
                      size: 16,
                    }),
                  ],
                  spacing: { after: 150 },
                }),
              ]
            : []),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows],
          }),
        ],
      },
    ],
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
