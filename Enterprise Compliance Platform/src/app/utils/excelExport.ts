import * as XLSX from "xlsx";

interface CellFill {
  patternType: string;
  fgColor: { rgb: string };
}

export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
}

export interface ExportOptions {
  fileName: string;
  sheetName?: string;
  title?: string;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  meta?: [string, string][];
}

const HEADER_FILL: CellFill = { patternType: "solid", fgColor: { rgb: "4C1D95" } };
const TITLE_FILL: CellFill = { patternType: "solid", fgColor: { rgb: "EDE9FE" } };

export function exportToExcel(opts: ExportOptions) {
  const aoa: unknown[][] = [];

  if (opts.title) aoa.push([opts.title]);
  if (opts.meta) {
    for (const [k, v] of opts.meta) aoa.push([k, v]);
  }

  aoa.push(opts.columns.map((c) => c.header));

  for (const row of opts.rows) {
    aoa.push(opts.columns.map((c) => row[c.key] ?? ""));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const headerRow = (opts.title ? 1 : 0) + (opts.meta ? opts.meta.length : 0) + 1;

  ws["!cols"] = opts.columns.map((c) => ({ wch: c.width ?? 20 }));

  const range = XLSX.utils.decode_range(ws["!ref"] as string);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow - 1, c })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill: HEADER_FILL,
        alignment: { horizontal: "center", vertical: "center" },
        border: { bottom: { style: "thin", color: { rgb: "6D28D9" } } },
      };
    }
  }

  if (opts.title) {
    const titleCell = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })];
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 14, color: { rgb: "4C1D95" } },
        fill: TITLE_FILL,
        alignment: { horizontal: "left", vertical: "center" },
      };
    }
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(opts.columns.length - 1, 0) } },
    ];
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName ?? "Report");
  XLSX.writeFile(wb, opts.fileName.endsWith(".xlsx") ? opts.fileName : `${opts.fileName}.xlsx`);
}
