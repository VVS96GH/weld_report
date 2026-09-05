/**
 * Shared exceljs helpers for the batch-2 workbook seeders
 * (scripts/seed-weekly-snapshot.ts, scripts/load-ut-tracker-ccc.ts,
 * scripts/load-exclusion-list.ts).
 *
 * `analysis/sources2/profile_xlsx.py` reads these workbooks with openpyxl
 * `data_only=True` — cached formula values, exactly what Power Query's
 * `Excel.Workbook` sees. exceljs's `cell.value` is the direct equivalent: for a
 * formula cell it already resolves to `{formula, result}`, so `cellPlain()`
 * below unwraps that the same way `data_only` does. None of the four trend
 * workbooks or the two reference workbooks actually contain formulas (spot
 * checked), but the unwrap is cheap insurance.
 */

import ExcelJS from "exceljs";

export interface SheetData {
  /** 1-indexed: header[1] is column A. Index 0 is unused (mirrors exceljs `row.values`). */
  header: unknown[];
  /** Data rows only (row 1 is the header and is excluded). 1-indexed per row, same shape as header. */
  rows: unknown[][];
  rowCount: number;
}

export async function readSheet(filePath: string, sheetName: string): Promise<SheetData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) {
    const have = wb.worksheets.map((w) => w.name).join(", ");
    throw new Error(`sheet "${sheetName}" not found in ${filePath} (has: ${have})`);
  }
  const header = ws.getRow(1).values as unknown[];
  const rows: unknown[][] = [];
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    // Skip genuinely empty trailing rows (exceljs sometimes reports rowCount
    // past the last populated row after a save round-trip).
    if (row.cellCount === 0 && row.values === undefined) continue;
    const cells: unknown[] = [undefined];
    for (let c = 1; c <= ws.columnCount; c += 1) cells.push(cellPlain(row.getCell(c).value));
    rows.push(cells);
  }
  return { header, rows, rowCount: rows.length };
}

/** Unwrap exceljs formula-result / rich-text cell shapes to a plain scalar. */
function cellPlain(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if (v instanceof Date) return v;
    if ("result" in v) return cellPlain((v as { result: ExcelJS.CellValue }).result);
    if ("richText" in v) {
      return (v as { richText: Array<{ text: string }> }).richText.map((t) => t.text).join("");
    }
    if ("text" in v) return (v as { text: unknown }).text;
  }
  return v;
}

// --------------------------------------------------------------- dates ---

/**
 * Excel serial date -> UTC Date. Excel's epoch is 1899-12-30 (the classic
 * 1900-leap-year bug), so day 1 = 1899-12-31. Only used as a fallback: exceljs
 * already returns a JS `Date` for genuinely date-formatted cells, but a
 * defensively-typed loader must also accept a raw serial number.
 */
export function excelSerialToDate(serial: number): Date {
  const epochUtcMs = Date.UTC(1899, 11, 30);
  return new Date(epochUtcMs + Math.round(serial) * 86_400_000);
}

/**
 * Cell -> ISO `yyyy-mm-dd` string. Accepts a JS `Date` (exceljs's normal
 * output for a date-formatted cell), a raw Excel serial number, or an ISO-ish
 * string (`yyyy-mm-dd`, optionally with a time suffix). Returns null for a
 * blank cell. Anything else is a shape the profiler never saw, so it throws
 * rather than guessing — the loader reports that, it does not fix it.
 */
export function toISODate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return excelSerialToDate(v).toISOString().slice(0, 10);
  if (typeof v === "string") {
    const s = v.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    if (/^\d+(\.\d+)?$/.test(s)) return excelSerialToDate(Number(s)).toISOString().slice(0, 10);
    throw new Error(`toISODate: unrecognised date string ${JSON.stringify(s)}`);
  }
  throw new Error(`toISODate: unrecognised cell type ${typeof v} (${JSON.stringify(v)})`);
}

/** `week_end_date` is a Friday for every row in all four trend workbooks (per
 * analysis/sources2/workbooks.md). This does not fix anything, it only answers. */
export function isFridayISO(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`isFridayISO: not an ISO date ${JSON.stringify(iso)}`);
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return dt.getUTCDay() === 5;
}

// -------------------------------------------------------------- scalars ---

/**
 * Cell -> number | null. Blank cells (null/undefined/"") are null — "blank
 * cell -> NULL, never 0" (trend-seed-plan.md). A literal `0` cell stays `0`
 * (ruling R2-09: dead columns are seeded as-is, zeros included). Anything
 * that is neither blank nor numeric throws, so an unexpected text token in a
 * value column is reported, not silently coerced.
 */
export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return null;
    const n = Number(s);
    if (Number.isNaN(n)) throw new Error(`toNum: non-numeric value ${JSON.stringify(v)}`);
    return n;
  }
  throw new Error(`toNum: unrecognised cell type ${typeof v} (${JSON.stringify(v)})`);
}

/** Cell -> trimmed text | null. Numbers are stringified (some "text" columns
 * such as `JOINT NO` are numeric-looking but declared text in the DDL because
 * not every value is numeric). */
export function toText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" ? null : s;
  }
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  throw new Error(`toText: unrecognised cell type ${typeof v} (${JSON.stringify(v)})`);
}

// ------------------------------------------------- sub-contractor labels ---

export interface NormalisedLabel {
  subContractor: string;
  scope: string;
  labelRaw: string;
}

/**
 * Ruling R2-08. `'GAC SG'` and `'TEKFEN TMCP'` are the only compound labels
 * across all three trend workbooks that carry a sub-contractor column
 * (profile_xlsx.py enumerates the full distinct sets — 8, 8 and 6 values,
 * checked against this function in tests/seeders.test.ts). Everything else
 * (`CCC`, `GAC`, `TEKFEN`, `MEDGULF`, `Acciona`, `Inco`/`INCO`) is a single
 * canonical party uppercased with `scope = 'ALL'`.
 */
export function normalizeSubContractorLabel(raw: string): NormalisedLabel {
  const trimmed = raw.trim();
  if (trimmed === "GAC SG") return { subContractor: "GAC", scope: "SG", labelRaw: trimmed };
  if (trimmed === "TEKFEN TMCP") {
    return { subContractor: "TEKFEN", scope: "TMCP", labelRaw: trimmed };
  }
  return { subContractor: trimmed.toUpperCase(), scope: "ALL", labelRaw: trimmed };
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
