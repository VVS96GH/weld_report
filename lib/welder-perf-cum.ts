/**
 * The owner's cumulative "CUM FILE Welders Performance" workbooks (2 Weeks /
 * 1 Month), which feed the Rejection Summary trend charts (migration 0046).
 *
 * The pbix workflow this automates (owner, 2026-10-14): after each refresh the
 * hidden table "CUM - Welders Performance. for Table" is exported to CSV
 * ("Last 2 weeks CUM - Welders Performance. for Table 09 oct.csv") and its rows
 * newer than the workbook's last RT date are pasted into the workbook, under the
 * period they fall in. Here:
 *   - `snapshotRows()` is that hidden table at a cut-off (verified 1:1 against
 *     the owner's 09-Oct exports: 436 rows / 1,006 rows, every ratio);
 *   - `appendToWorkbook()` pastes the new rows into the workbook in `sources/`,
 *     after copying it to its "Back up" folder;
 *   - `readWorkbook()` reads the workbook back, row for row, into
 *     ref_welder_perf_cum (the owner may edit the file by hand at any time).
 *
 * No database import here: callers pass `run` (the app's query, or a loader's
 * client), so the loader script and the API share one implementation.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { copyFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

export type CumKind = "2w" | "1m";
export type Run = <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

const DIR = "sources/CUM FILE Welders Performance For Graphic";
const CUM_NAMES: Record<CumKind, string> = {
  "2w": "CUM FILE Welders Performance.  Rejection Rate. Summary Status  2 Weeks Since RT Date .xlsx",
  "1m": "CUM FILE Welders Performance.  Rejection Rate. Summary Status  1 Month Since RT Date .xlsx",
};

/** A name compared without its spacing: "…Date .xlsx" = "…Date.xlsx" = "…Date  .xlsx". */
const loose = (name: string) => name.toLowerCase().replace(/\s+/g, "").replace(/\.xlsx$/, "");

/**
 * The workbook of a kind, found in its folder whatever the spacing of its name
 * (owner 2026-10-25: a re-save dropped the space before ".xlsx" and the refresh
 * kept reading the old file). The exact name wins; otherwise the newest file whose
 * name matches without spaces. A copy ("… Date 1.xlsx") never matches.
 */
export function cumFile(kind: CumKind): string {
  const exact = `${DIR}/${CUM_NAMES[kind]}`;
  if (existsSync(exact)) return exact;
  const want = loose(CUM_NAMES[kind]);
  let best: { file: string; mtime: number } | null = null;
  try {
    for (const f of readdirSync(DIR)) {
      if (!f.toLowerCase().endsWith(".xlsx") || loose(f) !== want) continue;
      const mtime = statSync(`${DIR}/${f}`).mtimeMs;
      if (!best || mtime > best.mtime) best = { file: `${DIR}/${f}`, mtime };
    }
  } catch {
    // no folder: the exact path, which the caller reports as missing
  }
  return best?.file ?? exact;
}

/** Resolved on every read, so a renamed workbook is picked up without a restart. */
export const CUM_FILES: Record<CumKind, string> = {
  get "2w"() {
    return cumFile("2w");
  },
  get "1m"() {
    return cumFile("1m");
  },
};
const SHEET = "CUM FILE Welders Performance";
/** Days of one period of each workbook (2 and 4 weeks, Friday to Friday). */
const PERIOD_DAYS: Record<CumKind, number> = { "2w": 14, "1m": 28 };
/** The pbix status labels: the 1-month column spells monitor/Critical without spaces. */
export const STATUS_LABELS: Record<CumKind, [string, string, string, string]> = {
  "2w": ["1. 0 to 5% - ok", "2. 5 to 7.5% - monitor", "3. 7.5 to 10% - Critical", "4. 10 to 100% - Disq.F"],
  "1m": ["1. 0 to 5% - ok", "2. 5 to 7.5%-monitor", "3. 7.5 to 10%-Critical", "4. 10 to 100% - Disq.F"],
};

export type CumRow = {
  rowNo: number;
  weekStart: string | null;
  weeknum: string | null;
  weekEnd: string | null;
  period: string | null;
  lastRtDate: string | null;
  sub: string | null;
  status: string | null;
  welder: string | null;
  ratio: number | null;
  count: number | null;
};

export type SnapshotRow = { lastRtDate: string; sub: string; status: string; welder: string; ratio: number };

// ── dates ────────────────────────────────────────────────────────────────────

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);
/** The Friday on or before `s` (the workbook's weeks run Friday → Thursday). */
const fridayOnOrBefore = (s: string) => addDays(s, -((toDate(s).getUTCDay() - 5 + 7) % 7));
/** "25-Sep-26", the workbook's period-label style ("June"/"July" spelt out, as it does). */
function labelDate(s: string): string {
  const d = toDate(s);
  return `${d.getUTCDate()}-${MON[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
}
/** "24-Sep-26", the CSV export's style. */
export function csvDate(s: string): string {
  const d = toDate(s);
  return `${d.getUTCDate()}-${MON3[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
}

/** `{ no, start, end }` from a label such as "73.  25-Sep-26 to 9-Oct-26". */
export function parsePeriod(label: string): { no: number; start: string; end: string } | null {
  const m = /^\s*(\d+)\.\s+(\d{1,2})-([A-Za-z]+)-(\d{2})\s+to\s+(\d{1,2})-([A-Za-z]+)-(\d{2})\s*$/.exec(label);
  if (!m) return null;
  const date = (d: string, mon: string, y: string) => {
    const i = MON3.findIndex((x) => mon.toLowerCase().startsWith(x.toLowerCase()));
    return i < 0 ? null : iso(new Date(Date.UTC(2000 + Number(y), i, Number(d))));
  };
  const start = date(m[2], m[3], m[4]);
  const end = date(m[5], m[6], m[7]);
  return start && end ? { no: Number(m[1]), start, end } : null;
}

// ── the hidden pbix table ────────────────────────────────────────────────────

/**
 * "CUM - Welders Performance. for Table" at a cut-off: one row per (RT date,
 * sub-contractor, status, welder), Inco out, BW/CLET/GW/MW, welded by the
 * cut-off, `Days Since Last RT` 1..15 (2 weeks) / 1..30 (1 month), status not
 * blank. The welder's status and ratio are mv_welder_status's (same cut-off).
 */
export async function snapshotRows(run: Run, kind: CumKind, cutoff: string): Promise<SnapshotRow[]> {
  const days = kind === "2w" ? 15 : 30;
  const col = kind === "2w" ? "rt_w_15" : "rt_w_30";
  const [l1, l2, l3, l4] = STATUS_LABELS[kind];
  const rows = await run<{ d: string; sub: string; st: string; welder: string; ratio: string }>(
    `SELECT DISTINCT p.last_rt_date::text AS d, p.sub_contractor AS sub,
            CASE WHEN r >= 0 AND r < 0.05 THEN $2 WHEN r >= 0.05 AND r < 0.075 THEN $3
                 WHEN r >= 0.075 AND r < 0.10 THEN $4 WHEN r >= 0.10 AND r <= 1 THEN $5 END AS st,
            p.welder_id AS welder, r AS ratio
       FROM mv_welder_perf p
       JOIN (SELECT welder_id, ${col} AS r FROM mv_welder_status) ws USING (welder_id)
      WHERE p.weld_type IN ('BW', 'CLET', 'GW', 'MW')
        AND p.weld_date IS NOT NULL AND p.weld_date <= $1::date
        AND $1::date - p.last_rt_date BETWEEN 1 AND ${days}
        AND r IS NOT NULL AND r <= 1
      ORDER BY 1, 2, 3, 4`,
    [cutoff, l1, l2, l3, l4],
  );
  return rows.map((r) => ({ lastRtDate: r.d, sub: r.sub, status: r.st, welder: r.welder, ratio: Number(r.ratio) }));
}

/** The snapshot as the owner's CSV export (UTF-8 with BOM, "0.00%" ratios). */
export function snapshotCsv(kind: CumKind, rows: SnapshotRow[]): string {
  const ratioHead = kind === "2w" ? 'RT Film Ratio % "PR all" For Welder LAST 2 WEEKS' : 'RT Film Ratio % "PR all" For Welder LAST 1 MONTH';
  const q = (cell: string) => (/[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  const lines = [
    ['Last_RT Date "PR all"', "Sub-Contractor", "STATUS", "Welder ID", ratioHead, "Count of Welder ID"].map(q).join(","),
    ...rows.map((r) =>
      [csvDate(r.lastRtDate), r.sub, r.status, r.welder, `${(r.ratio * 100).toFixed(2)}%`, "1"].map(q).join(","),
    ),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

// ── the workbook ─────────────────────────────────────────────────────────────

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: unknown };
    if ("result" in o) return o.result;
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if ("text" in o) return o.text;
  }
  return v;
}
function asDate(v: unknown): string | null {
  if (v instanceof Date) return iso(v);
  if (typeof v === "number" && Number.isFinite(v)) return iso(new Date(Date.UTC(1899, 11, 30) + v * 86_400_000));
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
}
const asText = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v).trim() || null);
const asNum = (v: unknown) => (typeof v === "number" ? v : v === null || v === undefined || v === "" ? null : Number(v));

/** Every data row of the workbook's first sheet, by header name (columns A–L). */
export async function readWorkbook(kind: CumKind, file = path.resolve(CUM_FILES[kind])): Promise<CumRow[]> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, {
    worksheets: "emit",
    sharedStrings: "cache",
    styles: "cache",
    hyperlinks: "ignore",
    entries: "ignore",
  });
  const out: CumRow[] = [];
  for await (const sheet of reader) {
    const name = (sheet as unknown as { name?: string }).name ?? "";
    if (name !== SHEET) {
      for await (const skip of sheet) void skip;
      continue;
    }
    let idx: Map<string, number> | null = null;
    for await (const row of sheet) {
      const values = Array.from(row.values as ExcelJS.CellValue[], (v) => cellValue(v));
      if (!idx) {
        idx = new Map(values.map((v, i) => [String(v ?? "").trim(), i]));
        continue;
      }
      const at = (h: string) => {
        const i = idx!.get(h);
        return i === undefined ? undefined : values[i];
      };
      const periodHead = [...idx.keys()].find((k) => /Period$/.test(k)) ?? "";
      const ratioHead = [...idx.keys()].find((k) => k.startsWith("RT Film Ratio")) ?? "";
      const r: CumRow = {
        rowNo: row.number,
        weekStart: asDate(at("Week_Start_Date")),
        weeknum: asText(at("Weeknum")),
        weekEnd: asDate(at("Week_End_Date")),
        period: asText(at(periodHead)),
        lastRtDate: asDate(at('Last_RT Date "PR all"')),
        sub: asText(at("Sub-Contractor")),
        status: asText(at("STATUS")),
        welder: asText(at("Welder ID")),
        ratio: asNum(at(ratioHead)),
        count: asNum(at("Count of Welder ID")),
      };
      if (r.lastRtDate || r.welder) out.push(r);
    }
  }
  return out;
}

/** Replace the table's rows of one workbook with what the file holds now. */
export async function reloadTable(run: Run, kind: CumKind, loadId: number | null = null): Promise<number> {
  const rows = await readWorkbook(kind);
  await run(`DELETE FROM ref_welder_perf_cum WHERE kind = $1`, [kind]);
  for (let i = 0; i < rows.length; i += 2000) {
    const chunk = rows.slice(i, i + 2000);
    const params: unknown[] = [];
    const tuples = chunk.map((r) => {
      const base = params.length;
      params.push(kind, r.rowNo, loadId, r.weekStart, r.weeknum, r.weekEnd, r.period, r.lastRtDate, r.sub, r.status, r.welder, r.ratio, r.count);
      return `(${Array.from({ length: 13 }, (_, k) => `$${base + k + 1}`).join(", ")})`;
    });
    await run(
      `INSERT INTO ref_welder_perf_cum (kind, row_no, load_id, week_start, weeknum, week_end, period,
         last_rt_date, sub_contractor, status, welder_id, ratio, welder_count) VALUES ${tuples.join(", ")}`,
      params,
    );
  }
  return rows.length;
}

export type AppendPlan = {
  /** The workbook's last RT date before the append. */
  lastDate: string | null;
  rows: (SnapshotRow & { period: string; weekStart: string; weeknum: string; weekEnd: string })[];
};

/**
 * The rows the next paste adds: the snapshot's RT dates AFTER the workbook's
 * last one, each under the period that covers it — the workbook's last period
 * while it lasts, then new ones of 14 / 28 days, numbered on. Week columns follow
 * the workbook's own (Friday-start weeks, numbered on from its last row).
 */
export async function planAppend(run: Run, kind: CumKind, cutoff: string): Promise<AppendPlan> {
  const last = await run<{ d: string | null; ws: string | null; wn: string | null; period: string | null }>(
    `SELECT last_rt_date::text AS d, week_start::text AS ws, weeknum AS wn, period
       FROM ref_welder_perf_cum WHERE kind = $1 AND last_rt_date IS NOT NULL
      ORDER BY last_rt_date DESC, row_no DESC LIMIT 1`,
    [kind],
  );
  const lastDate = last[0]?.d ?? null;
  const snap = await snapshotRows(run, kind, cutoff);
  const fresh = snap.filter((r) => lastDate === null || r.lastRtDate > lastDate);
  let period = last[0]?.period ? parsePeriod(last[0].period) : null;
  let label = last[0]?.period ?? "";
  const baseWs = last[0]?.ws ?? null;
  const baseWn = Number(/(\d+)/.exec(last[0]?.wn ?? "")?.[1] ?? NaN);
  const rows: AppendPlan["rows"] = [];
  for (const r of fresh) {
    while (period && r.lastRtDate >= period.end) {
      const start = period.end;
      const end = addDays(start, PERIOD_DAYS[kind]);
      period = { no: period.no + 1, start, end };
      label = `${period.no}.  ${labelDate(start)} to ${labelDate(end)}`;
    }
    if (!period) {
      const start = fridayOnOrBefore(r.lastRtDate);
      period = { no: 1, start, end: addDays(start, PERIOD_DAYS[kind]) };
      label = `1.  ${labelDate(start)} to ${labelDate(period.end)}`;
    }
    const weekStart = fridayOnOrBefore(r.lastRtDate);
    const weeknum =
      baseWs && Number.isFinite(baseWn) ? `${baseWn + Math.round(daysBetween(baseWs, weekStart) / 7)} week` : "";
    rows.push({ ...r, period: label, weekStart, weeknum, weekEnd: addDays(weekStart, 7) });
  }
  return { lastDate, rows };
}

/**
 * Paste the planned rows under the workbook's last row (formats copied from it,
 * column A the same `=G<row>` formula), after copying the file to "Back up/".
 * Writes to a temp file first, so an interrupted save never truncates the master.
 */
export async function appendToWorkbook(
  kind: CumKind,
  plan: AppendPlan,
  /** Tests point this at a copy; the app always writes the master. */
  file = path.resolve(CUM_FILES[kind]),
): Promise<{ added: number; backup: string }> {
  await stat(file);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = path.join(path.dirname(file), "Back up");
  await mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `${path.basename(file, ".xlsx")} ${stamp}.xlsx`);
  await copyFile(file, backup);
  if (plan.rows.length === 0) return { added: 0, backup };

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet = wb.getWorksheet(SHEET);
  if (!sheet) throw new Error(`sheet "${SHEET}" not found in ${file}`);
  let lastNo = sheet.rowCount;
  while (lastNo > 1 && !sheet.getRow(lastNo).getCell(7).value) lastNo -= 1;
  const template = sheet.getRow(lastNo);
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  plan.rows.forEach((r, i) => {
    const no = lastNo + 1 + i;
    const row = sheet.getRow(no);
    const cells: ExcelJS.CellValue[] = [
      { formula: `G${no}`, result: d(r.lastRtDate) } as ExcelJS.CellFormulaValue, // A  Date
      null, //                                                                       B  Row Index Column
      d(r.weekStart), //                                                             C
      r.weeknum, //                                                                  D
      d(r.weekEnd), //                                                               E
      r.period, //                                                                   F
      d(r.lastRtDate), //                                                            G
      r.sub, //                                                                      H
      r.status, //                                                                   I
      r.welder, //                                                                   J
      r.ratio, //                                                                    K
      1, //                                                                          L
    ];
    cells.forEach((v, c) => {
      row.getCell(c + 1).value = v;
    });
    for (let c = 1; c <= 12; c += 1) {
      const tpl = template.getCell(c);
      if (tpl.numFmt) row.getCell(c).numFmt = tpl.numFmt;
      if (tpl.font) row.getCell(c).font = tpl.font;
      if (tpl.alignment) row.getCell(c).alignment = tpl.alignment;
    }
    row.commit();
  });
  const tmp = `${file}.tmp-${process.pid}.xlsx`;
  await wb.xlsx.writeFile(tmp);
  await rename(tmp, file);
  return { added: plan.rows.length, backup };
}
