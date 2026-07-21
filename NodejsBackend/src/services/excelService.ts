import * as XLSX from "xlsx";

export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
}

export interface ExcelOptions {
  fileName: string;
  sheetName?: string;
  title?: string;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  meta?: [string, string][];
}

export function generateExcelBuffer(opts: ExcelOptions): Buffer {
  const wb = XLSX.utils.book_new();
  const wsData: any[][] = [];

  if (opts.title) {
    wsData.push([opts.title]);
    wsData.push([]);
  }

  if (opts.meta && opts.meta.length > 0) {
    for (const [k, v] of opts.meta) {
      wsData.push([k, v]);
    }
    wsData.push([]);
  }

  wsData.push(opts.columns.map((c) => c.header));

  for (const row of opts.rows) {
    wsData.push(opts.columns.map((c) => row[c.key] ?? ""));
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = opts.columns.map((c) => ({ wch: c.width || 20 }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName || "Report");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
