import * as XLSX from "xlsx";

export function exportRowsToXls(fileName: string, sheetName: string, rows: Record<string, unknown>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName.replace(/\.xls$/i, "")}.xls`, { bookType: "xls" });
}

/**
 * Same rows as `exportRowsToXls`, but as modern OOXML (.xlsx) bytes for
 * password-protected download (legacy BIFF .xls cannot carry ECMA-376
 * encryption, so protected exports always use .xlsx).
 */
export function buildRowsXlsxBlob(sheetName: string, rows: Record<string, unknown>[]): Blob {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([bytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
