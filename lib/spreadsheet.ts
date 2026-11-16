// Slice 128 (gap fix, Nov 16, 2026) — Excel support for the two
// upload paths. Both importers read CSV text only; the founder
// works in Excel, so a .xlsx/.xls file (binary) could not be read
// at all. This helper reads the FIRST sheet only, converts it to
// plain string rows, and feeds the SAME pipeline as CSV — the
// probate parser (lib/probate-import.ts) and the distress importer
// (components/CsvLeadImporter.tsx) both consume rows, so nothing
// about their dedupe / mapping / validation changes. Never invents
// columns or rows: empty cells become '', never a guessed value.
//
// `xlsx` (SheetJS) is a runtime dependency (npm install xlsx) and
// is dynamically imported so the bundle only loads it when a
// spreadsheet is actually uploaded.

export async function readSpreadsheetRows(file: File): Promise<string[][]> {
  const xlsx = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = xlsx.read(buf, { type: 'array' });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) throw new Error('That spreadsheet has no sheets — nothing to import.');
  const ws = wb.Sheets[firstSheet];
  // header: 1 keeps raw rows (first row = headers); defval '' keeps
  // empty cells as '' instead of dropping the column.
  const rows = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false }) as unknown[][];
  return rows.map((r) =>
    (Array.isArray(r) ? r : []).map((c) => (c == null ? '' : String(c)).trim()),
  ).filter((r) => r.some((c) => c !== ''));
}

// Convert string rows back to CSV text (quote-aware) so a sheet can
// feed a text parser unchanged — the probate parser takes text.
export function rowsToCsv(rows: string[][]): string {
  const q = (c: string) => {
    if (/[",\n\r]/.test(c)) return `"${c.replace(/"/g, '""')}"`;
    return c;
  };
  return rows.map((r) => r.map(q).join(',')).join('\r\n');
}

export function isSpreadsheetFile(name: string): boolean {
  return /\.xlsx?$/i.test(name);
}
