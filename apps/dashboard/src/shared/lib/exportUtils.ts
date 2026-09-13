import * as XLSX from 'xlsx';

/**
 * Export an array of objects to an Excel (.xlsx) file and trigger download
 */
export function exportToExcel(
  filename: string,
  data: Record<string, unknown>[],
  columns?: { key: string; label: string }[]
) {
  if (data.length === 0) return;

  const keys = columns ? columns.map((c) => c.key) : Object.keys(data[0]);
  const headers = columns ? columns.map((c) => c.label) : keys;

  const rows = data.map((row) => keys.map((key) => row[key] ?? ''));
  const sheetData = [headers, ...rows];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Auto-fit column widths
  ws['!cols'] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length));
    return { wch: Math.min(maxLen + 2, 40) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const xlsxFilename = filename.replace(/\.(csv|pdf)$/i, '.xlsx');
  XLSX.writeFile(wb, xlsxFilename);
}

/**
 * Export multiple sheets to a single Excel file
 */
export function exportMultiSheetExcel(
  filename: string,
  sheets: {
    name: string;
    data: Record<string, unknown>[];
    columns?: { key: string; label: string }[];
  }[]
) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    if (sheet.data.length === 0) continue;
    const keys = sheet.columns ? sheet.columns.map((c) => c.key) : Object.keys(sheet.data[0]);
    const headers = sheet.columns ? sheet.columns.map((c) => c.label) : keys;
    const rows = sheet.data.map((row) => keys.map((key) => row[key] ?? ''));
    const sheetData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length));
      return { wch: Math.min(maxLen + 2, 40) };
    });
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }

  XLSX.writeFile(wb, filename);
}
