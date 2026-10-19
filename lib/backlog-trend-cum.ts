/**
 * The owner's "CUM Trend file RT and PWHT Backlog" workbook (sheet TREND), which
 * holds the history behind every RT/UT B.Log and PWHT B.Log chart (page 1 and the
 * per-party Graph pages).
 *
 * The workflow this automates (owner, 2026-10-19): each Friday the owner reads the
 * "RT% and PWHT B.LOG" table of every party's Graph page and types one row per
 * party into the workbook:
 *
 *   C  RT Backlog                               0 (unused since 2024-06; kept 0, as the owner does)
 *   D  PWHT Backlog All Types                   table "PWHT B.Log All Types"           (M60)
 *   E  PWHT Backlog For RT                      table "PWHT B.Log for RT"              (M62)
 *   F  RT BACKLOG & PWHT "Y" Done + "N"         table "RT+PWHT Y Done" + "RT+PWHT N"   (M48)
 *   G  RT BACKLOG & PWHT Not Done               table "RT B.Log & PWHT Y NOT Done"     (M47)
 *   H  PWHT BACKLOG RT NOT Done (SG+TMCP)       the "PWHT+RT" bar, GAC SG / TEKFEN TMCP rows only (M64)
 *
 * Checked against the owner's own 16-Oct-26 rows: all seven parties, every cell.
 * `computeWeek()` reads those same page tables, so the numbers written are the
 * numbers on screen. `insertWeek()` backs the file up, writes the week's rows
 * (replacing them when the week is already there), and upserts them into
 * `weld_weekly_snapshot`, which the charts read. `reloadFromFile()` re-reads the
 * whole sheet after a hand edit.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

import { queryFresh, withAsOf } from "@/lib/db";
import { chartCutoff } from "@/lib/metrics/trend";
import type { PageModel, TableWidget } from "@/lib/page-model";
import { getWeldingPage } from "@/lib/pages/welding";

const CANDIDATES = [
  "sources/CUM Trend file RT and PWHT/CUM Trend file RT and PWHT Backlog .xlsx",
  "sources/CUM Trend file RT and PWHT/CUM Trend file RT and PWHT Backlog.xlsx",
];
/** The workbook's export name drifts by a space before ".xlsx". */
export const trendFile = () => path.resolve(CANDIDATES.find((p) => existsSync(p)) ?? CANDIDATES[0]!);
const SHEET = "TREND";

/** Workbook columns C..H → snapshot metric (as scripts/seed-weekly-snapshot.ts). */
const METRICS = ["M40", "M60", "M62", "M48", "M47", "M64"] as const;
export const TREND_HEADERS = [
  "RT Backlog",
  "PWHT Backlog All Types",
  "PWHT Backlog For RT",
  'RT BACKLOG & PWHT "Y" Done + "N"',
  "RT BACKLOG & PWHT Not Done",
  "PWHT BACKLOG RT NOT Done (SG+TMCP)",
];

/** One workbook row per party, in the workbook's own order and spelling. */
const PARTIES: { label: string; page: number; tmcp?: boolean; plusRt?: boolean; row?: string }[] = [
  { label: "CCC", page: 7 },
  { label: "GAC", page: 8 },
  { label: "GAC SG", page: 9, plusRt: true },
  { label: "TEKFEN", page: 10 },
  { label: "TEKFEN TMCP", page: 10, tmcp: true, plusRt: true },
  { label: "MEDGULF", page: 11 },
  // no Graph page: its row of the Project Welding & NDE Status table
  { label: "Acciona", page: 2, row: "ACCIONA" },
];

export type TrendRow = { label: string; values: number[] };

const num = (s: string | undefined) => {
  const n = Number((s ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

/** sub-contractor / scope keys of weld_weekly_snapshot (R2-08, as the loader). */
function keyOf(label: string): { sub: string; scope: string } {
  const t = label.trim();
  if (t === "GAC SG") return { sub: "GAC", scope: "SG" };
  if (t === "TEKFEN TMCP") return { sub: "TEKFEN", scope: "TMCP" };
  return { sub: t.toUpperCase(), scope: "ALL" };
}

function backlogTable(m: PageModel): TableWidget | null {
  for (const w of m.widgets) {
    if (w.kind === "table" && w.columns.some((c) => /^PWHT (Backlog|B\.log) All/i.test(c))) return w;
  }
  return null;
}

function cell(t: TableWidget, row: string[], re: RegExp): number {
  const i = t.columns.findIndex((c) => re.test(c.trim()));
  return i < 0 ? 0 : num(row[i]);
}

/** The week's seven rows, read off the pages the owner reads them from. */
export async function computeWeek(): Promise<{ week: string; rows: TrendRow[] }> {
  const { as_of } = await withAsOf(null);
  const week = chartCutoff(as_of);
  const rows: TrendRow[] = [];
  for (const p of PARTIES) {
    const m = await getWeldingPage(p.page, p.tmcp ? { tmcp: true } : {});
    const t = backlogTable(m);
    const r = !t ? undefined : p.row ? t.rows.find((x) => x[0]?.trim().toUpperCase() === p.row) : (t.total_row ?? t.rows.at(-1));
    let plusRt = 0;
    if (p.plusRt) {
      const chart = m.widgets.find((w) => w.kind === "chart" && /pwht/i.test(w.canvas_id) && /backlog|b\.log/i.test(w.canvas_id));
      if (chart?.kind === "chart") {
        const i = chart.labels.indexOf(week);
        const ds = chart.datasets.find((d) => /\+/.test(d.label ?? ""));
        const v = i >= 0 ? ds?.data[i] : undefined;
        plusRt = typeof v === "number" ? v : num(String(v ?? ""));
      }
    }
    const values =
      t && r
        ? [
            0,
            cell(t, r, /^PWHT (Backlog|B\.log) All/i),
            cell(t, r, /^PWHT (Backlog|B\.log) for RT$/i),
            cell(t, r, /^RT\+PWHT "Y" Done$/i) + cell(t, r, /^RT\+PWHT "N"$/i),
            cell(t, r, /^RT B\.LOG & PWHT ("Y" )?NOT Done$/i),
            plusRt,
          ]
        : [0, 0, 0, 0, 0, plusRt];
    rows.push({ label: p.label, values });
  }
  return { week, rows };
}

/** The last week the charts hold (weld_weekly_snapshot, PWHT All Types). */
export async function lastWeek(): Promise<string | null> {
  const r = await queryFresh<{ d: string | null }>(
    `SELECT max(week_end_date)::text AS d FROM weld_weekly_snapshot WHERE metric = 'M60'`,
  );
  return r[0]?.d ?? null;
}

/** The week's rows as CSV, in the workbook's column order. */
export function weekCsv(week: string, rows: TrendRow[]): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = ["Date", "Sub-Contractor", ...TREND_HEADERS].map(q).join(",");
  return "﻿" + [head, ...rows.map((r) => [week, q(r.label), ...r.values].join(","))].join("\r\n") + "\r\n";
}

async function upsert(rows: { week: string; label: string; values: (number | null)[] }[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 200) {
    const params: unknown[] = [];
    const tuples: string[] = [];
    for (const r of rows.slice(i, i + 200)) {
      const { sub, scope } = keyOf(r.label);
      METRICS.forEach((metric, k) => {
        const b = params.length;
        params.push(r.week, sub, scope, metric, r.values[k] ?? null, r.label.trim());
        tuples.push(`($${b + 1}::date, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`);
      });
    }
    await queryFresh(
      `INSERT INTO weld_weekly_snapshot (week_end_date, sub_contractor, scope, metric, value, label_raw)
       VALUES ${tuples.join(", ")}
       ON CONFLICT (week_end_date, sub_contractor, scope, metric)
       DO UPDATE SET value = EXCLUDED.value, label_raw = EXCLUDED.label_raw, recorded_at = now()`,
      params,
    );
  }
}

const isoOf = (v: ExcelJS.CellValue): string | null => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v && typeof v === "object" && "result" in v && v.result instanceof Date) return v.result.toISOString().slice(0, 10);
  return null;
};
const numOf = (v: ExcelJS.CellValue): number | null => {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v && typeof v.result === "number") return v.result;
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
};

/**
 * Write the week into the workbook (backup first; a temp file, so an interrupted
 * save never truncates the master), then into the charts' table.
 */
export async function insertWeek(
  week: string,
  rows: TrendRow[],
  /** Tests point this at a copy; the app always writes the master. */
  file = trendFile(),
): Promise<{ added: number; replaced: number; backup: string }> {
  await stat(file);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = path.join(path.dirname(file), "Back up");
  await mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `${path.basename(file, ".xlsx").trim()} ${stamp}.xlsx`);
  await copyFile(file, backup);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet = wb.getWorksheet(SHEET);
  if (!sheet) throw new Error(`sheet "${SHEET}" not found in ${path.basename(file)}`);
  let lastNo = sheet.rowCount;
  while (lastNo > 1 && !sheet.getRow(lastNo).getCell(1).value) lastNo -= 1;

  // rows of this week already in the file, by label: replaced in place
  const existing = new Map<string, number>();
  for (let n = 2; n <= lastNo; n += 1) {
    const r = sheet.getRow(n);
    if (isoOf(r.getCell(1).value) === week) existing.set(String(r.getCell(2).value ?? "").trim(), n);
  }
  const date = new Date(`${week}T00:00:00Z`);
  let added = 0;
  let replaced = 0;
  for (const r of rows) {
    let no = existing.get(r.label);
    if (no) replaced += 1;
    else {
      lastNo += 1;
      no = lastNo;
      added += 1;
    }
    const row = sheet.getRow(no);
    // a new row takes the formats of the same party's row a week earlier
    const template = existing.has(r.label) ? row : sheet.getRow(Math.max(2, no - PARTIES.length));
    row.getCell(1).value = date;
    row.getCell(2).value = r.label;
    r.values.forEach((v, k) => {
      row.getCell(3 + k).value = v;
    });
    for (let c = 1; c <= 8; c += 1) {
      const tpl = template.getCell(c);
      if (tpl.numFmt) row.getCell(c).numFmt = tpl.numFmt;
      if (tpl.font) row.getCell(c).font = tpl.font;
      if (tpl.alignment) row.getCell(c).alignment = tpl.alignment;
      if (tpl.border) row.getCell(c).border = tpl.border;
    }
    row.commit();
  }
  const tmp = `${file}.tmp-${process.pid}.xlsx`;
  await wb.xlsx.writeFile(tmp);
  await rename(tmp, file);
  await upsert(rows.map((r) => ({ week, label: r.label, values: r.values })));
  return { added, replaced, backup };
}

/** Re-read the whole TREND sheet into the charts' table (after a hand edit). */
export async function reloadFromFile(file = trendFile()): Promise<number> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet = wb.getWorksheet(SHEET);
  if (!sheet) throw new Error(`sheet "${SHEET}" not found in ${path.basename(file)}`);
  const rows: { week: string; label: string; values: (number | null)[] }[] = [];
  sheet.eachRow((r, n) => {
    if (n === 1) return;
    const week = isoOf(r.getCell(1).value);
    const label = String(r.getCell(2).value ?? "").trim();
    if (!week || !label) return;
    rows.push({ week, label, values: METRICS.map((_, k) => numOf(r.getCell(3 + k).value)) });
  });
  await upsert(rows);
  return rows.length;
}
