/**
 * The WPQ RECORD REGISTER delivery -> four reference tables.
 *
 *   node --import tsx scripts/load-wps-register.ts --dry-run
 *   node --import tsx scripts/load-wps-register.ts
 *
 * Three workbooks, four sheets, 745 rows. Nothing lands in `weld`, so there is no
 * matview to refresh.
 *
 *   WPQ RECORD REGISTER.xlsx :: CONSOLIDATED     -> ref_wps_register     318
 *   WPQ RECORD REGISTER.xlsx :: WELDING PROCESS  -> ref_wps_process      266
 *   CUM WPS Status.xlsx      :: WPS Status       -> ref_wps_status_cum   127 x 2
 *   WPS PWHT Status.xlsx     :: PWHT Status      -> ref_wps_pwht_status   34
 *
 * READ BY HEADER NAME, NEVER BY POSITION OR BY REPLAYING THE M (ruling R4-01).
 * Two of the four stored Power Queries would FAIL on refresh against these files:
 *
 *   - `CONSOLIDATED` has gained a blank left column, so every auto-named blank
 *     column shifted by one. The M's `RemoveColumns({"Column13".."Column18"})`
 *     names fields that no longer exist and `Table.RemoveColumns` raises.
 *   - the `.xls` register's only sheet is `WPS Reg.`, while the M asks for
 *     `WPS Reg#`. `Excel.Workbook` returns no row for that key and the step raises.
 *
 * Same staleness class as ruling R3-09 (the welders `.xls`). Building by header
 * name is immune to both.
 *
 * NOT LOADED, deliberately:
 *   - `WPS-WPQT Record Register Rev_0 24-01-25.xls` (R4-04) — Rev. 0 of Jan-2025,
 *     a different DocumentStatus vocabulary, backing one hidden pbix page. Hence
 *     this loader has no `uv`/`xlrd` path at all, unlike load-welders.ts.
 *   - `WPS (Welding Process).csv` (R4-07) — a flat export of the WELDING PROCESS
 *     sheet; the sheet is canonical (the R3-14 precedent), and the csv adds an
 *     unnamed 6th column and two spelling variants.
 */

import { statSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { closeLoad, fmt, openLoad, parseDate, requireEnvUrl, secs, sha256File, txt } from "./load-common";
import { streamSheet } from "./lib/xlsx-stream";

const REG_FILE = "sources/WPQ RECORD REGISTER/WPQ RECORD REGISTER.xlsx";
const CUM_FILE = "sources/WPQ RECORD REGISTER/CUM WPS Status.xlsx";
const PWHT_FILE = "sources/WPQ RECORD REGISTER/WPS PWHT Status.xlsx";

const EXPECTED = { register: 318, process: 266, cum: 127, pwht: 34 };
const APPROVED = "WPS APPROVED BY CTJV/ CPY";

/**
 * Header lookup: a name -> column-index map built ONCE from the header row.
 * Honours the delivered names EXACTLY and also accepts a whitespace-collapsed
 * form. `CONSOLIDATED` carries `' DOCUMENT STATUS'` with a leading space, `'PWHT '`
 * with a trailing one and `'PQR \nNo/Rev.'` with an embedded newline; matching on
 * either form means a stray space in a future export cannot silently drop a column.
 */
function headerIndexOf(cells: string[]): Map<string, number> {
  const idx = new Map<string, number>();
  cells.forEach((h, i) => {
    if (h !== "" && !idx.has(h)) idx.set(h, i);
    const n = h.replace(/\s+/g, " ").trim();
    if (n !== "" && !idx.has(n)) idx.set(n, i);
  });
  return idx;
}

interface Sheet {
  file: string;
  sheet: string;
  width: number;
  /** Header row is found by these column names, not by a positional skip. */
  probe: string[];
}

const SHEETS: Record<string, Sheet> = {
  register: { file: REG_FILE, sheet: "CONSOLIDATED", width: 21, probe: ["WPS NO."] },
  process: { file: REG_FILE, sheet: "WELDING PROCESS", width: 5, probe: ["WPS No.", "Welding process"] },
  cum: { file: CUM_FILE, sheet: "WPS Status", width: 3, probe: ["Week_End_Date", "WPS Approved"] },
  pwht: { file: PWHT_FILE, sheet: "PWHT Status", width: 3, probe: ["WPS No.", "PWHT(Y/N)"] },
};

/** Yields `get(headerName)` per DATA row, after finding the header row by name. */
async function* readSheet(spec: Sheet): AsyncGenerator<(name: string) => string> {
  let idx: Map<string, number> | null = null;
  for await (const row of streamSheet(path.join(process.cwd(), spec.file), spec.sheet, spec.width)) {
    if (idx === null) {
      const norm = row.cells.map((c) => c.replace(/\s+/g, " ").trim());
      if (!spec.probe.every((p) => norm.includes(p.replace(/\s+/g, " ").trim()))) continue;
      idx = headerIndexOf(row.cells);
      continue;
    }
    // The getter must close over THIS row's cells, not the header's.
    const cells = row.cells;
    const map = idx;
    yield (name: string): string => {
      const i = map.get(name) ?? map.get(name.replace(/\s+/g, " ").trim());
      return i === undefined ? "" : (cells[i] ?? "");
    };
  }
  if (idx === null) {
    throw new Error(
      `${spec.file} :: ${spec.sheet}: no header row carrying ${spec.probe.join(", ")}`,
    );
  }
}

/** The join key `weld.wps_no` will be compared against: btrim + upper. */
function normKey(v: string): string {
  return v.replace(/\s+/g, " ").trim().toUpperCase();
}

interface RegisterRow { values: (string | null)[] }
interface Stats {
  register: RegisterRow[];
  registerApproved: number;
  registerDistinct: Set<string>;
  process: (string | null)[][];
  processDistinct: Set<string>;
  cum: { week: string; metric: string; value: string | null }[];
  cumWeeks: Set<string>;
  pwht: (string | null)[][];
  pwhtDistinct: Set<string>;
  statuses: Map<string, number>;
  dupKeys: string[];
}

function newStats(): Stats {
  return {
    register: [], registerApproved: 0, registerDistinct: new Set(),
    process: [], processDistinct: new Set(),
    cum: [], cumWeeks: new Set(), pwht: [], pwhtDistinct: new Set(),
    statuses: new Map(), dupKeys: [],
  };
}

async function readAll(stats: Stats): Promise<void> {
  // ---- CONSOLIDATED -------------------------------------------------------
  // The M does Table.Skip(3) then PromoteHeaders; we find the header row by name,
  // and keep the M's only real filter: [WPS NO.] <> null.
  for await (const g of readSheet(SHEETS.register)) {
    const wpsRaw = g("WPS NO.").trim();
    if (wpsRaw === "") continue;                    // the M's `[WPS NO.] <> null`
    const wps = wpsRaw;                             // the M Text.Trim()s it, and so do we
    if (stats.registerDistinct.has(wps)) stats.dupKeys.push(`register:${wps}`);
    stats.registerDistinct.add(wps);
    const status = txt(g(" DOCUMENT STATUS"));
    stats.statuses.set(status ?? "(blank)", (stats.statuses.get(status ?? "(blank)") ?? 0) + 1);
    if (status === APPROVED) stats.registerApproved += 1;
    stats.register.push({
      values: [
        wps, status, txt(g("SCTR")), txt(g("WPS Rev. No.")), txt(g("PQR No/Rev.")),
        txt(g("WELDING PROCESS (ES)")), txt(g("Column8")),
        txt(g("PQR Material Seamless / Welder Pipes & Plate")), txt(g("Column10")),
        txt(g("PWHT ")), txt(g("APPLICATION")), txt(g("S.N")),
      ],
    });
  }

  // ---- WELDING PROCESS ----------------------------------------------------
  for await (const g of readSheet(SHEETS.process)) {
    const raw = g("WPS No.").trim();
    if (raw === "") continue;
    const key = normKey(raw);
    if (stats.processDistinct.has(key)) stats.dupKeys.push(`process:${key}`);
    stats.processDistinct.add(key);
    stats.process.push([
      key, raw, txt(g("Sn.")), txt(g("SCNTR")),
      // The M's only transform on this sheet: null -> 'TBN', on Welding process ONLY.
      txt(g("Welding process")) ?? "TBN",
      txt(g("Type of Welding Machine")),
    ]);
  }

  // ---- WPS Status (cumulative) -> long form (R4-06) ------------------------
  for await (const g of readSheet(SHEETS.cum)) {
    const week = parseDate(g("Week_End_Date").slice(0, 10));
    if (week === null) continue;
    stats.cumWeeks.add(week);
    stats.cum.push({ week, metric: "WPS_SUBMITTED", value: txt(g("WPS Submitted")) });
    stats.cum.push({ week, metric: "WPS_APPROVED", value: txt(g("WPS Approved")) });
  }

  // ---- PWHT Status --------------------------------------------------------
  for await (const g of readSheet(SHEETS.pwht)) {
    const raw = g("WPS No.").trim();
    if (raw === "") continue;
    const key = normKey(raw);
    if (stats.pwhtDistinct.has(key)) stats.dupKeys.push(`pwht:${key}`);
    stats.pwhtDistinct.add(key);
    stats.pwht.push([key, raw, txt(g("PWHT(Y/N)")) ?? "", txt(g("Thickness"))]);
  }
}

function report(stats: Stats, t0: number): boolean {
  console.log(`  ref_wps_register      ${fmt(stats.register.length).padStart(11)}  (expected ${EXPECTED.register})`);
  console.log(`    distinct wps_no     ${fmt(stats.registerDistinct.size).padStart(11)}`);
  console.log(`    DOCUMENT STATUS     ${[...stats.statuses].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${fmt(v)}`).join(", ")}`);
  console.log(`    M91 (approved)      ${fmt(stats.registerApproved).padStart(11)}  <- the page-1 KPI`);
  console.log(`  ref_wps_process       ${fmt(stats.process.length).padStart(11)}  (expected ${EXPECTED.process}), distinct ${stats.processDistinct.size}`);
  console.log(`  ref_wps_status_cum    ${fmt(stats.cum.length).padStart(11)}  = ${stats.cumWeeks.size} weeks x 2 metrics (expected ${EXPECTED.cum} weeks)`);
  const last = [...stats.cumWeeks].sort().at(-1) ?? "";
  const lastRows = stats.cum.filter((c) => c.week === last);
  console.log(`    latest week ${last}  ${lastRows.map((c) => `${c.metric}=${c.value}`).join(", ")}`);
  console.log(`  ref_wps_pwht_status   ${fmt(stats.pwht.length).padStart(11)}  (expected ${EXPECTED.pwht}), distinct ${stats.pwhtDistinct.size}`);
  if (stats.dupKeys.length > 0) console.log(`  !! DUPLICATE KEYS      ${stats.dupKeys.slice(0, 5).join(", ")}`);
  console.log(`  runtime               ${secs(t0)}`);
  const matchesFirstDelivery = stats.register.length === EXPECTED.register
    && stats.registerDistinct.size === EXPECTED.register
    && stats.registerApproved === EXPECTED.register
    && stats.process.length === EXPECTED.process
    && stats.processDistinct.size === EXPECTED.process
    && stats.cumWeeks.size === EXPECTED.cum
    && stats.pwht.length === EXPECTED.pwht
    && stats.pwhtDistinct.size === EXPECTED.pwht
    && stats.dupKeys.length === 0;
  // A REFRESHED register (npm run db:refresh sets WELD_REFRESH) legitimately has
  // other counts than the 2026-09 delivery the EXPECTED numbers pin. What must
  // still hold is that the workbook is whole: no duplicate keys, no empty sheet.
  const wellFormed = stats.dupKeys.length === 0
    && stats.register.length > 0 && stats.registerDistinct.size === stats.register.length
    && stats.process.length > 0 && stats.processDistinct.size === stats.process.length
    && stats.cumWeeks.size > 0
    && stats.pwht.length > 0 && stats.pwhtDistinct.size === stats.pwht.length;
  const refreshed = process.env.WELD_REFRESH === "1";
  const ok = matchesFirstDelivery || (refreshed && wellFormed);
  console.log(`  verdict               ${matchesFirstDelivery ? "counts MATCH the pbix"
    : ok ? "counts differ from the first delivery — accepted, the workbook is well-formed (refresh)"
    : "COUNTS DIFFER FROM THE PBIX"}`);
  return ok;
}

async function main(): Promise<void> {
  for (const f of [REG_FILE, CUM_FILE, PWHT_FILE]) {
    if (!existsSync(path.join(process.cwd(), f))) throw new Error(`file not found: ${f}`);
  }
  const t0 = Date.now();
  console.log("WPS  WPQ RECORD REGISTER.xlsx + CUM WPS Status.xlsx + WPS PWHT Status.xlsx");
  const stats = newStats();
  await readAll(stats);
  const ok = report(stats, t0);
  if (!ok) {
    // Assert then ABORT: these are tiny reference tables whose counts are the
    // whole point, and a partial register would quietly break M91.
    throw new Error("row-count assertions failed; refusing to load");
  }
  if (process.argv.includes("--dry-run")) return;

  const regAbs = path.join(process.cwd(), REG_FILE);
  const mtime = statSync(regAbs).mtime;
  const asOf = `${mtime.getFullYear()}-${String(mtime.getMonth() + 1).padStart(2, "0")}-${String(mtime.getDate()).padStart(2, "0")}`;

  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  try {
    await client.query("SET statement_timeout = 0");
    const regSha = await sha256File(regAbs);
    const regLoad = await openLoad(client, "WPS_REGISTER", path.basename(regAbs), statSync(regAbs).size, regSha);
    const procLoad = await openLoad(client, "WPS_PROCESS", path.basename(regAbs), statSync(regAbs).size, regSha);
    const cumAbs = path.join(process.cwd(), CUM_FILE);
    const cumLoad = await openLoad(client, "WPS_STATUS_CUM", path.basename(cumAbs),
      statSync(cumAbs).size, await sha256File(cumAbs));
    const pwhtAbs = path.join(process.cwd(), PWHT_FILE);
    const pwhtLoad = await openLoad(client, "WPS_PWHT_STATUS", path.basename(pwhtAbs),
      statSync(pwhtAbs).size, await sha256File(pwhtAbs));
    console.log(`  load_id ${regLoad} / ${procLoad} / ${cumLoad} / ${pwhtLoad}`);

    await client.query("BEGIN");
    await client.query("DELETE FROM ref_wps_register");
    for (const r of stats.register) {
      await client.query(
        `INSERT INTO ref_wps_register
           (wps_no, document_status, sctr, wps_rev_no, pqr_no_rev, welding_process_es,
            welding_process_mode, pqr_material_1, pqr_material_2, pwht, application, sn,
            as_of, load_id, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [...r.values, asOf, regLoad,
          `CONSOLIDATED sheet, read by header name (R4-01). as_of is the file mtime (${asOf}); `
          + "the sheet carries no date. NEVER join wps_no to weld.wps_no (R4-03)."],
      );
    }
    await client.query("DELETE FROM ref_wps_process");
    for (const p of stats.process) {
      await client.query(
        `INSERT INTO ref_wps_process
           (wps_no, wps_no_raw, sn, sctr, welding_process, welding_machine_type, load_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`, [...p, procLoad],
      );
    }
    // UPSERT, never truncate: this history is not recomputable (R4-06).
    for (const c of stats.cum) {
      await client.query(
        `INSERT INTO ref_wps_status_cum (week_end_date, metric, value, load_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (week_end_date, metric)
         DO UPDATE SET value = EXCLUDED.value, load_id = EXCLUDED.load_id`,
        [c.week, c.metric, c.value, cumLoad],
      );
    }
    await client.query("DELETE FROM ref_wps_pwht_status");
    for (const p of stats.pwht) {
      await client.query(
        `INSERT INTO ref_wps_pwht_status (wps_no, wps_no_raw, pwht_yn, thickness_note, load_id)
         VALUES ($1,$2,$3,$4,$5)`, [...p, pwhtLoad],
      );
    }
    await client.query("COMMIT");
    console.log("  committed");

    await closeLoad(client, regLoad, stats.register.length, stats.register.length, 0,
      { m91_approved: stats.registerApproved, as_of: asOf, distinct_wps_no: stats.registerDistinct.size });
    await closeLoad(client, procLoad, stats.process.length, stats.process.length, 0,
      { note: "the WPS -> weld.wps_no join table (R4-03)" });
    await closeLoad(client, cumLoad, stats.cumWeeks.size, stats.cum.length, 0,
      { weeks: stats.cumWeeks.size, note: "UPSERTed, never cleared (R4-06)" });
    await closeLoad(client, pwhtLoad, stats.pwht.length, stats.pwht.length, 0,
      { note: "rule sheet, documentation only (R4-08)" });

    // Nothing lands in `weld`, so no matview refresh — but the join coverage that
    // justifies R4-03 is re-proved on every load, at JOINT grain (`mv_joint`) and
    // in both scopes, exactly as analysis/sources4/mapping.md §6 measures it.
    // Joint grain matters: `SELECT DISTINCT joint_id, wps_no FROM weld` counts
    // (joint, wps) PAIRS and inflates the denominator by 101.
    for (const [label, scope] of [
      ["ALL sources", ""],
      ["in scope (<> INCO)", "WHERE upper(j.sub_contractor) <> 'INCO'"],
    ] as [string, string][]) {
      const cov = await client.query<{ with_wps: string; matched: string }>(`
        SELECT count(*) FILTER (WHERE btrim(coalesce(j.wps_no, '')) <> '')::text AS with_wps,
               count(*) FILTER (WHERE p.wps_no IS NOT NULL)::text AS matched
          FROM mv_joint j
          LEFT JOIN ref_wps_process p ON p.wps_no = upper(btrim(j.wps_no))
         ${scope}`);
      const m = Number(cov.rows[0].matched);
      const w = Number(cov.rows[0].with_wps);
      console.log(`  join coverage ${label.padEnd(20)} ${fmt(m)} / ${fmt(w)} `
        + `(${((100 * m) / w).toFixed(2)}%)`);
    }
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* connection may be gone */ }
    throw err;
  } finally {
    await client.end();
  }
  console.log(`total   ${secs(t0)}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
