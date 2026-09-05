/**
 * The two welder registers -> `ref_qualified_welders`, `ref_welder_qualification`,
 * `ref_welder_status_weekly`.
 *
 *   node --import tsx scripts/load-welders.ts --dry-run
 *   node --import tsx scripts/load-welders.ts
 *
 * 1. `Welders/SCTR NFE WELDERS APPLIED.xls` — BIFF8, which `exceljs` cannot read at
 *    all (it looks for a zip central directory and throws). Converted at LOAD TIME
 *    through `uv run scripts/py/xls_to_csv.py` (R3-11); a checked-in conversion
 *    would go stale silently the next time the analyst re-downloads it.
 *
 *    Read POSITIONALLY (R3-09). The stored Power Query is STALE and would ERROR on
 *    refresh: a column has been inserted at the left since it was written, so its
 *    `RenameColumns({{"Column2","SUB CONTRACTOR"}})` targets a name that no longer
 *    exists — and `Table.RenameColumns` raises on a missing column. Its two
 *    `RemoveLastN` steps would also cut 5 live rows. The pbix's stored 16 rows are
 *    reproduced by the final `TOTAL` filter alone. We build against the file.
 *
 * 2. `Welders/Welders Power Q for PBI .xlsx` — the named Table
 *    `WELDERS_Qualification` (A1:S5485, so the table is the sheet's first 19
 *    columns from row 1), plus the `CUM WEEK # Status` history sheet.
 */

import { statSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import { Client } from "pg";
import {
  closeLoad, fmt, formatRefreshes, openLoad, refreshMatviews, requireEnvUrl, secs, sha256File, txt,
} from "./load-common";
import { headerIndex, streamSheet } from "./lib/xlsx-stream";

const execFileAsync = promisify(execFile);

const XLS_FILE = "sources/Welders/SCTR NFE WELDERS APPLIED.xls";
const XLS_SHEET = "SCTR OVERALL APPLIED WELDERS";
const XLSX_FILE = "sources/Welders/Welders Power Q for PBI .xlsx";
const QUAL_SHEET = "WELDERS Qualification";
const QUAL_WIDTH = 19;
const CUM_SHEET = "CUM WEEK # Status";
const CUM_WIDTH = 12;
const WEEK_SHEET = "WEEK #   STATUS";
const WEEK_WIDTH = 10;

const EXPECTED = { xlsRows: 19, qualification: 5_484, cumRows: 1_016, m90: 3_816 };

/** Positional column indices in the .xls, 0-based — R3-09. */
const XLS = { name: 2, discipline: 3, active: 13, activePiping: 15, qualified: 16 };

/** Canonical party names (R2-08). The .xls carries the raw contract names. */
function canonicalParty(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (s.includes("CCC")) return "CCC";
  if (s.includes("MEDGULF")) return "MEDGULF";
  if (s.includes("ACCIONA")) return "ACCIONA";
  if (s.includes("TEKFEN")) return "TEKFEN";
  if (s.includes("INCO")) return "INCO";
  if (s.includes("GAC")) return "GAC";
  return s;
}

/**
 * Resolve `uv`. It lives in ~/.local/bin, which is not on a non-login shell's PATH,
 * so PATH alone is not enough — and failing loudly beats loading a partial register.
 */
async function resolveUv(): Promise<string> {
  const candidates = [
    process.env.UV_BIN,
    path.join(os.homedir(), ".local", "bin", "uv"),
    "/usr/local/bin/uv",
    "/usr/bin/uv",
  ].filter((c): c is string => typeof c === "string" && c.length > 0);
  for (const c of candidates) if (existsSync(c)) return c;
  try {
    const { stdout } = await execFileAsync("bash", ["-lc", "command -v uv"]);
    const p = stdout.trim();
    if (p !== "" && existsSync(p)) return p;
  } catch { /* fall through to the loud failure */ }
  throw new Error(
    "uv not found. It is required to read the BIFF .xls welder register " +
    `(ruling R3-11) and exceljs cannot read that format. Looked in: ${candidates.join(", ")} ` +
    "and `command -v uv`. Install uv, or set UV_BIN to its path.",
  );
}

async function readXls(): Promise<string[][]> {
  const uv = await resolveUv();
  const { stdout } = await execFileAsync(
    uv,
    ["run", "scripts/py/xls_to_csv.py", XLS_FILE, XLS_SHEET],
    { cwd: process.cwd(), maxBuffer: 32 << 20, env: { ...process.env, PATH: `${path.dirname(uv)}:${process.env.PATH ?? ""}` } },
  );
  // The converter emits RFC4180 CSV; these 19 rows have no embedded newline, but
  // quoted commas do occur in the contract names.
  return stdout.split("\n").filter((l) => l.length > 0).map(parseCsvLine);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

interface Party {
  sub_contractor: string;
  qualified: number;
  active: number;
  activePiping: number;
}

interface QualRow { values: (string | null)[] }
interface StatusRow {
  week: string; sub: string; category: string; value: string | null;
  categoryRaw: string; periodRaw: string; weekRaw: string;
}

interface Stats {
  xlsRows: number;
  xlsDataRows: number;
  xlsTotalRowsDropped: number;
  parties: Map<string, Party>;
  qualification: QualRow[];
  cumSourceRows: number;
  statusRows: StatusRow[];
  weekCategories: string[];
  weeks: Set<string>;
  periodUnparsed: number;
}

function newStats(): Stats {
  return {
    xlsRows: 0, xlsDataRows: 0, xlsTotalRowsDropped: 0, parties: new Map(),
    qualification: [], cumSourceRows: 0, statusRows: [], weekCategories: [],
    weeks: new Set(), periodUnparsed: 0,
  };
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** `"1. 23-Feb-24 to 1-Mar-24"` -> the END date, ISO. The series is Fridays. */
function periodEndDate(period: string): string | null {
  const parts = period.split(/\s+to\s+/i);
  if (parts.length < 2) return null;
  // Four of the 127 weeks spell the month in full and one has a stray space
  // (`5 -June-26`), so match a 3+ letter month with optional spaces around the
  // hyphens and key on its first three letters.
  const m = /(\d{1,2})\s*-\s*([A-Za-z]{3,})\s*-\s*(\d{2,4})/.exec(parts[1]);
  if (!m) return null;
  const mo = MONTHS.indexOf(m[2].slice(0, 3).toUpperCase());
  if (mo < 0) return null;
  const yy = Number(m[3]);
  const year = m[3].length === 4 ? yy : (yy < 70 ? 2000 + yy : 1900 + yy);
  return `${year}-${String(mo + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** `"1. Under Qualification "` -> `"Under Qualification"`. */
function stripPrefix(category: string): string {
  return category.replace(/^\s*\d+\.\s*/, "").trim();
}

async function readAll(stats: Stats): Promise<void> {
  // ---- 1. the .xls register, positionally --------------------------------
  const grid = await readXls();
  stats.xlsRows = grid.length;
  let currentName = "";
  for (let r = 2; r < grid.length; r += 1) {   // row 0 blank, row 1 header
    const row = grid[r];
    const discipline = (row[XLS.discipline] ?? "").trim();
    if (discipline === "") continue;
    // Fill-down: only the first row of each party carries the name.
    const rawName = (row[XLS.name] ?? "").trim();
    if (rawName !== "") currentName = rawName;
    if (discipline.toUpperCase() === "TOTAL") { stats.xlsTotalRowsDropped += 1; continue; }
    stats.xlsDataRows += 1;
    const party = canonicalParty(currentName);
    const n = (i: number): number => {
      const v = (row[i] ?? "").trim();
      const x = Number(v);
      return v === "" || Number.isNaN(x) ? 0 : x;
    };
    const p = stats.parties.get(party)
      ?? { sub_contractor: party, qualified: 0, active: 0, activePiping: 0 };
    // The PK is sub_contractor, so the two CCC rows and the two TEKFEN rows are
    // SUMMED at load — which is what the DAX does under its party filter.
    p.qualified += n(XLS.qualified);
    p.active += n(XLS.active);
    p.activePiping += n(XLS.activePiping);
    stats.parties.set(party, p);
  }

  // ---- 2. WELDERS_Qualification (named Table, A1:S5485) -------------------
  const qualFile = path.join(process.cwd(), XLSX_FILE);
  let qidx: Map<string, number> | null = null;
  for await (const row of streamSheet(qualFile, QUAL_SHEET, QUAL_WIDTH)) {
    if (row.rowNo === 0) { qidx = headerIndex(row.cells); continue; }
    if (!qidx) throw new Error("no header");
    const g = (h: string): string => {
      const i = qidx?.get(h);
      return i === undefined ? "" : (row.cells[i] ?? "");
    };
    const subRaw = g("Sub-Contractor").trim();
    stats.qualification.push({
      values: [
        txt(g("SL No.")),
        txt(g("PIP -PIPING                                 STR- STRUCTURAL WELDERS")),
        txt(g("Welder Name")), txt(g("WQT NO #")), txt(g("Welder No.")), txt(g("WPS No")),
        txt(g("Date of Test")), txt(g("Welding Process")), txt(g("Filler Materials")),
        txt(g("Base Material")), txt(g("Type of Joint")), txt(g("WORKING LOCATION")),
        txt(g("VT RESULT")), txt(g("RT RESULT")), txt(g("STATUS")), txt(g("REMARKS")),
        subRaw === "" ? null : canonicalParty(subRaw), txt(subRaw),
        txt(g("WELDER ID")), txt(g("Welder ID Code+Sub")),
      ],
    });
  }

  // ---- 3. CUM WEEK # Status -> unpivoted -----------------------------------
  const PARTIES = ["GAC", "MEDGULF", "TEKFEN", "CCC", "ACCIONA", "INCO"];
  let cidx: Map<string, number> | null = null;
  const seenKey = new Set<string>();
  for await (const row of streamSheet(qualFile, CUM_SHEET, CUM_WIDTH)) {
    if (row.rowNo === 0) { cidx = headerIndex(row.cells); continue; }
    if (!cidx) throw new Error("no header");
    const g = (h: string): string => {
      const i = cidx?.get(h);
      return i === undefined ? "" : (row.cells[i] ?? "");
    };
    stats.cumSourceRows += 1;
    const periodRaw = g("PERIOD").trim();
    const week = periodEndDate(periodRaw);
    if (week === null) { stats.periodUnparsed += 1; continue; }
    stats.weeks.add(week);
    const categoryRaw = g("Welders Qualification Status Summary Report");
    const category = stripPrefix(categoryRaw);
    if (category === "") continue;
    for (const p of PARTIES) {
      const key = `${week}|${p}|${category}`;
      if (seenKey.has(key)) continue;      // the PK is (week, party, category)
      seenKey.add(key);
      stats.statusRows.push({
        week, sub: p, category, value: txt(g(p)),
        categoryRaw: categoryRaw.trim(), periodRaw, weekRaw: g("WEEK").trim(),
      });
    }
  }

  // ---- 4. WEEK #   STATUS: the 8 current-week categories -------------------
  for await (const row of streamSheet(qualFile, WEEK_SHEET, WEEK_WIDTH)) {
    if (row.rowNo === 0) continue;
    const c = row.cells.map((x) => x.trim());
    // Columns: A blank, B `S.No`, C the category label.
    // `Table.Skip(1)` then PromoteHeaders then RemoveLastN(1): the last row is a total.
    const label = c[2] ?? "";
    if (label === "" || /^total$/i.test(label)) continue;
    if (/summary report/i.test(label)) continue;
    stats.weekCategories.push(label);
  }
}

function report(stats: Stats, t0: number): boolean {
  const total = [...stats.parties.values()].reduce((a, p) => a + p.qualified, 0);
  console.log(`  .xls grid rows        ${String(stats.xlsRows).padStart(11)}  (expected ${EXPECTED.xlsRows})`);
  console.log(`  .xls data rows kept   ${String(stats.xlsDataRows).padStart(11)}  (TOTAL rows dropped: ${stats.xlsTotalRowsDropped})`);
  console.log(`  ref_qualified_welders ${String(stats.parties.size).padStart(11)} parties`);
  for (const p of [...stats.parties.values()].sort((a, b) => b.qualified - a.qualified)) {
    console.log(`    ${p.sub_contractor.padEnd(10)} qualified ${String(p.qualified).padStart(5)}  active ${String(p.active).padStart(5)}  active piping ${String(p.activePiping).padStart(5)}`);
  }
  console.log(`    M90 TOTAL  ${String(total).padStart(21)}  (expected ${fmt(EXPECTED.m90)})`);
  console.log(`  ref_welder_qualification ${fmt(stats.qualification.length).padStart(8)}  (expected ${fmt(EXPECTED.qualification)})`);
  console.log(`  CUM WEEK # Status rows  ${fmt(stats.cumSourceRows).padStart(8)}  (expected ${fmt(EXPECTED.cumRows)})`);
  console.log(`  ...unpivoted to         ${fmt(stats.statusRows.length).padStart(8)}  = ${stats.weeks.size} weeks x 8 categories x 6 parties`);
  console.log(`  WEEK #   STATUS categories ${String(stats.weekCategories.length).padStart(5)}  (expected 8)`);
  console.log(`  PERIOD unparsed         ${String(stats.periodUnparsed).padStart(8)}`);
  console.log(`  runtime               ${secs(t0)}`);
  const ok = stats.xlsRows === EXPECTED.xlsRows
    && total === EXPECTED.m90
    && stats.qualification.length === EXPECTED.qualification
    && stats.cumSourceRows === EXPECTED.cumRows
    && stats.weekCategories.length === 8;
  console.log(`  verdict               ${ok ? "counts MATCH the profile" : "COUNTS DIFFER FROM THE PROFILE"}`);
  return ok;
}

async function main(): Promise<void> {
  for (const f of [XLS_FILE, XLSX_FILE]) {
    if (!existsSync(path.join(process.cwd(), f))) throw new Error(`file not found: ${f}`);
  }
  const t0 = Date.now();
  console.log(`WELDERS  ${XLS_FILE}`);
  console.log(`         ${XLSX_FILE}`);
  const stats = newStats();
  await readAll(stats);
  const ok = report(stats, t0);

  if (process.argv.includes("--dry-run")) {
    if (!ok) process.exitCode = 1;
    return;
  }

  const xlsAbs = path.join(process.cwd(), XLS_FILE);
  const xlsxAbs = path.join(process.cwd(), XLSX_FILE);
  // R3-10: the sheet carries no date anywhere, so as_of is the FILE MTIME and the
  // note says so. Inventing a reporting date would be worse than an honest mtime.
  const mtime = statSync(xlsAbs).mtime;
  const asOf = `${mtime.getFullYear()}-${String(mtime.getMonth() + 1).padStart(2, "0")}-${String(mtime.getDate()).padStart(2, "0")}`;

  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  try {
    await client.query("SET statement_timeout = 0");
    await client.query("SET synchronous_commit = off");
    const sctrLoad = await openLoad(client, "WELDERS_SCTR", path.basename(xlsAbs),
      statSync(xlsAbs).size, await sha256File(xlsAbs));
    const qualLoad = await openLoad(client, "WELDERS_QUALIFICATION", path.basename(xlsxAbs),
      statSync(xlsxAbs).size, await sha256File(xlsxAbs));
    const statusLoad = await openLoad(client, "WELDER_STATUS_WEEKLY", path.basename(xlsxAbs),
      statSync(xlsxAbs).size, "see WELDERS_QUALIFICATION");
    console.log(`  load_id ${sctrLoad} (sctr), ${qualLoad} (qualification), ${statusLoad} (weekly status)`);

    await client.query("BEGIN");

    await client.query("DELETE FROM ref_qualified_welders");
    for (const p of stats.parties.values()) {
      await client.query(
        `INSERT INTO ref_qualified_welders
           (sub_contractor, qualified_welders, active_welders, active_piping_welders,
            as_of, load_id, source_note, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [p.sub_contractor, p.qualified, p.active, p.activePiping, asOf, sctrLoad,
          `as_of is the mtime of ${path.basename(xlsAbs)} (${asOf}); the sheet carries no date. `
          + "Read positionally: the stored Power Query is stale and would error (R3-09).",
          "SCTR OVERALL APPLIED WELDERS; the two CCC and two TEKFEN rows are summed."],
      );
    }

    await client.query("DELETE FROM ref_welder_qualification");
    for (const q of stats.qualification) {
      await client.query(
        `INSERT INTO ref_welder_qualification
           (load_id, sl_no, discipline, welder_name, wqt_no, welder_no, wps_no, date_of_test,
            welding_process, filler_materials, base_material, type_of_joint, working_location,
            vt_result, rt_result, status, remarks, sub_contractor, sub_contractor_raw,
            welder_id_name, welder_id_code_sub)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [qualLoad, ...q.values],
      );
    }

    await client.query("DELETE FROM ref_welder_status_weekly");
    for (const s of stats.statusRows) {
      await client.query(
        `INSERT INTO ref_welder_status_weekly
           (week_end_date, sub_contractor, category, value, category_raw, period_raw,
            week_raw, load_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [s.week, s.sub, s.category, s.value, s.categoryRaw, s.periodRaw, s.weekRaw, statusLoad],
      );
    }
    await client.query("COMMIT");

    const tPost = Date.now();
    const refreshed = await refreshMatviews(client);
    console.log(`  post    ${formatRefreshes(refreshed)} — ${secs(tPost)} total`);

    await closeLoad(client, sctrLoad, stats.xlsDataRows, stats.parties.size, 0,
      { m90_total: [...stats.parties.values()].reduce((a, p) => a + p.qualified, 0), as_of: asOf });
    await closeLoad(client, qualLoad, stats.qualification.length, stats.qualification.length, 0, {});
    await closeLoad(client, statusLoad, stats.cumSourceRows, stats.statusRows.length, 0,
      { weeks: stats.weeks.size, categories: stats.weekCategories.length });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* connection may be gone */ }
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
