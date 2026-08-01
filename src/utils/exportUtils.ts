import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
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

/** Export in-memory rows to an .xlsx workbook, client-side (used for
 * quick, filtered exports of what's currently on screen; the backend
 * /export/{dataset_id}/excel endpoint is used for full-dataset exports
 * with server-side formatting). */
export function exportRowsToExcel(rows: DataRow[], sheetName: string, filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31) || "Sheet1");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/** Trigger a browser download from a server-generated file URL (used for
 * the FastAPI /export/{dataset_id}/excel and /pdf endpoints, which stream
 * full-dataset exports with server-side aggregation applied). */
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
