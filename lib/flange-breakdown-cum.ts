/**
 * The "CUM Trend Flange Progress Break Down Rate %" workbook (owner, 2026-10-19):
 * the Insert into CUM file button of the Leaked Flange Break chart writes the
 * week's Leaked % per sub-contractor, and the project's, from the flange page's
 * "Subcontractor Flange Status" table into sheet Fl.BreakDown — one row per
 * party, the project rate repeated on each (the workbook's own layout) — then
 * reloads `flange_breakdown`, which the chart reads.
 */
import { copyFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

import { getPool, queryFresh } from "@/lib/db";
import type { TableWidget } from "@/lib/page-model";
import { getFlangePage } from "@/lib/pages/flange";

export const FLANGE_CUM_FILE = () => path.resolve("sources/CUM Trend Flange Progress Break Down Rate %.xlsx");
const SHEET = "Fl.BreakDown";
/** The workbook's party order. */
const PARTIES = ["CCC", "GAC", "TEKFEN", "MEDGULF"] as const;

export type FlangeWeekRow = { sub: string; rate: number | null; project: number | null };

const pctOf = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const n = Number(s.replace(/[%,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 10000 : null; // "0.17%" -> 0.0017, as the workbook
};

const fridayOf = (iso: string): string => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
};

/** This week's rows, from the unfiltered flange page. */
export async function computeFlangeWeek(): Promise<{ week: string; rows: FlangeWeekRow[] }> {
  const m = await getFlangePage({});
  const t = m.widgets.find((w): w is TableWidget => w.kind === "table" && w.title === "Subcontractor Flange Status");
  if (!t) throw new Error("the Subcontractor Flange Status table is not on the flange page");
  const col = t.columns.findIndex((c) => /^leaked\s*%$/i.test(c.trim()));
  if (col < 0) throw new Error("no Leaked % column in Subcontractor Flange Status");
  const byKey = new Map(t.rows.map((r) => [String(r[0]).trim().toUpperCase(), r[col]]));
  const project = pctOf(byKey.get("TOTAL"));
  const week = fridayOf(m.meta?.as_of ?? new Date().toISOString());
  // a party with no inspected flange shows a blank Leaked %: the workbook keeps 0 then
  return { week, rows: PARTIES.map((sub) => ({ sub, rate: pctOf(byKey.get(sub)) ?? 0, project })) };
}

export async function lastFlangeWeek(): Promise<string | null> {
  try {
    const r = await queryFresh<{ w: string | null }>("SELECT max(week_date)::text AS w FROM flange_breakdown");
    return r[0]?.w ?? null;
  } catch {
    return null;
  }
}

export function flangeWeekCsv(week: string, rows: FlangeWeekRow[]): string {
  const head = "Date,Sub-Contractor,Fl.BreakDown % Rate,Project Fl.BreakDown  % Rej Rate";
  return [head, ...rows.map((r) => [week, r.sub, r.rate ?? "", r.project ?? ""].join(","))].join("\n") + "\n";
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

/** Write the week into the workbook (backup first, then a temp file + rename) and reload the chart's table. */
export async function insertFlangeWeek(
  week: string,
  rows: FlangeWeekRow[],
  file = FLANGE_CUM_FILE(),
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
  const existing = new Map<string, number>();
  for (let n = 2; n <= lastNo; n += 1) {
    const r = sheet.getRow(n);
    if (isoOf(r.getCell(1).value) === week) existing.set(String(r.getCell(2).value ?? "").trim().toUpperCase(), n);
  }
  const date = new Date(`${week}T00:00:00Z`);
  let added = 0;
  let replaced = 0;
  for (const r of rows) {
    let no = existing.get(r.sub);
    if (no) replaced += 1;
    else {
      lastNo += 1;
      no = lastNo;
      added += 1;
    }
    const row = sheet.getRow(no);
    const template = existing.has(r.sub) ? row : sheet.getRow(Math.max(2, no - PARTIES.length));
    row.getCell(1).value = date;
    row.getCell(2).value = r.sub;
    row.getCell(3).value = r.rate;
    row.getCell(4).value = r.project;
    for (let c = 1; c <= 4; c += 1) {
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
  await reloadFlangeFromFile(file);
  return { added, replaced, backup };
}

/** Re-read the whole sheet into `flange_breakdown` (also after a hand edit). */
export async function reloadFlangeFromFile(file = FLANGE_CUM_FILE()): Promise<number> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet = wb.getWorksheet(SHEET);
  if (!sheet) throw new Error(`sheet "${SHEET}" not found in ${path.basename(file)}`);
  const recs = new Map<string, [string, string, number | null, number | null]>();
  sheet.eachRow((r, n) => {
    if (n === 1) return;
    const week = isoOf(r.getCell(1).value);
    const sub = String(r.getCell(2).value ?? "").trim();
    if (!week || !sub) return;
    recs.set(`${week}|${sub.toUpperCase()}`, [week, sub, numOf(r.getCell(3).value), numOf(r.getCell(4).value)]);
  });
  const list = [...recs.values()];
  const db = await getPool().connect();
  try {
    await db.query("BEGIN");
    await db.query("DELETE FROM flange_breakdown");
    await db.query(
      `INSERT INTO flange_breakdown (week_date, sub_contractor, rate, project_rate)
       SELECT w::date, s, r, p FROM unnest($1::text[], $2::text[], $3::numeric[], $4::numeric[]) AS t(w, s, r, p)`,
      [list.map((x) => x[0]), list.map((x) => x[1]), list.map((x) => x[2]), list.map((x) => x[3])],
    );
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
  return list.length;
}
