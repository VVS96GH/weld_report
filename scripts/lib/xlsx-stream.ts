/**
 * Streaming .xlsx reading for the batch-3 loaders.
 *
 * `scripts/lib/xlsx.ts` (the seeding lane's) reads a whole workbook with
 * `wb.xlsx.readFile()`, which is right for its 20-60 KB trend workbooks. Batch 3
 * needs the other shape: `Weld Length.xlsx` is 728,550 rows × 3 columns and
 * `Acciona_Latest Add to Query.xlsx` is 13,313 × 53, so both are read row by row
 * through exceljs's streaming `WorkbookReader` and never materialised.
 */

import ExcelJS from "exceljs";

/**
 * Excel cells arrive as Date | number | string | rich-text / formula objects.
 * Dates are rendered ISO so `weld_to_date()` and `parseDate()` accept them.
 */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown; richText?: { text?: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text ?? "").join("");
    if (o.text !== undefined) return cellText(o.text);
    if (o.result !== undefined) return cellText(o.result);
    return "";
  }
  return String(v);
}

export interface SheetRow {
  /** 0 = the header row, then 1..n. */
  rowNo: number;
  /** 0-based, exactly `width` entries, missing cells as "". */
  cells: string[];
}

/**
 * Yields every row of one named sheet as a fixed-width array of strings.
 *
 * `width` comes from the range recorded in `analysis/sources3/workbooks.md` — for
 * the two named Tables we read (`Acciona_Query` A1:BA13314 and
 * `WELDERS_Qualification` A1:S5485) the table starts at A1, so the table IS the
 * sheet's first `width` columns and no ListObject API is needed.
 *
 * Trailing all-blank rows are skipped: Excel commonly declares a dimension past
 * the last populated row.
 */
export async function* streamSheet(
  filePath: string,
  sheetName: string,
  width: number,
): AsyncGenerator<SheetRow> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    worksheets: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "cache",
    entries: "ignore",
  });
  let found = false;
  let rowNo = -1;
  const seen: string[] = [];
  for await (const sheet of reader) {
    const name = (sheet as unknown as { name?: string }).name ?? "";
    seen.push(name);
    if (name !== sheetName) {
      // The reader must still be drained or the zip stream stalls.
      for await (const skip of sheet) void skip;
      continue;
    }
    found = true;
    for await (const row of sheet) {
      const values = row.values as unknown[]; // 1-based; index 0 is always empty
      const cells: string[] = [];
      for (let i = 1; i <= width; i += 1) cells.push(cellText(values[i]));
      if (cells.every((c) => c === "")) continue;
      rowNo += 1;
      yield { rowNo, cells };
    }
  }
  if (!found) {
    throw new Error(`sheet "${sheetName}" not found in ${filePath} (has: ${seen.join(", ")})`);
  }
}

/** Header row -> {name: index}, trimmed. Duplicate names keep the FIRST index. */
export function headerIndex(cells: string[]): Map<string, number> {
  const m = new Map<string, number>();
  cells.forEach((h, i) => {
    const k = h.trim();
    if (k !== "" && !m.has(k)) m.set(k, i);
  });
  return m;
}

/**
 * Acciona's dates are `dd-mm-yyyy` TEXT. Parsed here and nowhere else: ruling
 * R3-03 keeps `weld_to_date()` free of it, because `dd-mm-yyyy` is ambiguous with
 * `mm-dd-yyyy` and every other source would then mis-parse 01-02-2024.
 * Returns ISO `yyyy-mm-dd`, or null — never throws.
 */
export function parseDmy(v: string | undefined): string | null {
  if (v === undefined) return null;
  const t = v.trim().replace(/\//g, "-");
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})/.exec(t);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  return `${m[3]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
