/**
 * `Weld Length/Weld Length.xlsx` -> `weld_length_by_dia`, then the
 * `weld.weld_length_m` materialisation; plus `Rework code.xlsx` ->
 * `ref_code_label` (R3-08).
 *
 *   node --import tsx scripts/load-weld-length.ts --dry-run
 *   node --import tsx scripts/load-weld-length.ts
 *
 * `Sheet1` holds 728,550 rows of (Weld Type, Dia inch, Weld Length) — but the DAX
 * `LOOKUPVALUE` keys on `Dia inch` ALONE and ignores `Weld Type`, and no dia maps
 * to two lengths, so the whole content is 98 (dia -> length) pairs. R3-07: load the
 * 98, keep 728,550 in the ledger notes. The loader ASSERTS the functional
 * dependency and aborts if it ever breaks — that would mean the pbix's own
 * LOOKUPVALUE had started returning an error, and silently picking one of two
 * lengths would hide it.
 */

import { statSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import {
  closeLoad, fmt, formatRefreshes, openLoad, refreshMatviews, requireEnvUrl, secs, sha256File,
} from "./load-common";
import { headerIndex, streamSheet } from "./lib/xlsx-stream";

const LENGTH_FILE = "sources/Weld Length/Weld Length.xlsx";
const CODE_FILE = "sources/Weld Length/Rework code.xlsx";
const EXPECTED = { sheet1Rows: 728_550, distinctDia: 98 };

interface DiaRow { dia: string; len: string; rows: number }

interface Stats {
  sheet1Rows: number;
  distinct: Map<string, DiaRow>;
  fdViolations: { dia: string; a: string; b: string }[];
  codes: { domain: string; code: string; description: string }[];
  codeSheetRows: number;
  codeSheet1Rows: number;
}

/** Collapse Sheet1 to the distinct (dia -> length) pairs, asserting the FD. */
async function readLengths(stats: Stats): Promise<void> {
  let idx: Map<string, number> | null = null;
  for await (const row of streamSheet(path.join(process.cwd(), LENGTH_FILE), "Sheet1", 3)) {
    if (row.rowNo === 0) {
      idx = headerIndex(row.cells);
      for (const need of ["Weld Type", "Dia inch", "Weld Length"]) {
        if (!idx.has(need)) throw new Error(`Sheet1 is missing column "${need}"`);
      }
      continue;
    }
    if (!idx) throw new Error("no header");
    stats.sheet1Rows += 1;
    const dia = row.cells[idx.get("Dia inch") as number].trim();
    const len = row.cells[idx.get("Weld Length") as number].trim();
    if (dia === "" || len === "") continue;
    const prev = stats.distinct.get(dia);
    if (prev === undefined) {
      stats.distinct.set(dia, { dia, len, rows: 1 });
    } else {
      prev.rows += 1;
      if (prev.len !== len) stats.fdViolations.push({ dia, a: prev.len, b: len });
    }
  }
}

/**
 * `Rework code.xlsx` — three side-by-side legends in one sheet plus a scratch
 * list. Parsed by COLUMN, not by row, because that is how it is laid out:
 *   cols B/C  32 rework codes                      -> domain 'rework_code'
 *   cols F/G  a defect legend, an NDE-status legend and a fuller defect legend,
 *             stacked vertically                    -> 'defect_code' / 'nde_status'
 *   col  L    14 `BW : Buttweld` entries            -> 'weld_type'
 * The header row is DATA for one of them: the F/G legend's first pair is the
 * literal header `BT` / `Burn Through`.
 */
async function readCodes(stats: Stats): Promise<void> {
  const file = path.join(process.cwd(), CODE_FILE);
  const seen = new Set<string>();
  const add = (domain: string, code: string, description: string): void => {
    const c = code.trim();
    if (c === "" || c === "0") return;
    const key = `${domain} ${c}`;
    if (seen.has(key)) return;
    seen.add(key);
    stats.codes.push({ domain, code: c, description: description.trim() });
  };
  let inNdeBlock = false;
  for await (const row of streamSheet(file, "Rework code", 12)) {
    const c = row.cells;
    if (row.rowNo === 0) {
      add("defect_code", c[5], c[6]);
      continue;
    }
    stats.codeSheetRows += 1;
    // Each legend is read INDEPENDENTLY of the others: they are three columns
    // that happen to share rows, and an early `continue` on one of them would
    // silently drop a value from another (it did, and cost a weld type).
    if (c[1].trim() !== "Code") add("rework_code", c[1], c[2]);

    const wt = c[11].trim();
    if (wt !== "" && wt !== "WELD TYPE") {
      const [code, ...rest] = wt.split(":");
      add("weld_type", code, rest.join(":"));
    }

    // The F/G column restarts twice: `S.No` opens an NDE-status legend, and a
    // second `BT` opens a fuller defect legend.
    const f = c[5].trim();
    if (f === "S.No") {
      inNdeBlock = true;
    } else {
      if (f === "BT") inNdeBlock = false;
      add(inNdeBlock ? "nde_status" : "defect_code", c[5], c[6]);
    }
  }
  // Sheet1 is a scratch list of the same defect codes, half `code:description`
  // and half bare tokens. Only the described ones can add anything.
  for await (const row of streamSheet(file, "Sheet1", 1)) {
    if (row.rowNo > 0) stats.codeSheet1Rows += 1;
    const v = row.cells[0].trim();
    if (v === "" || !v.includes(":")) continue;
    const [code, ...rest] = v.split(":");
    add("defect_code", code, rest.join(":"));
  }
}

/**
 * `Weld Length "PR all"`, verbatim from the DAX:
 *   IF( Sub-Contractor = "Inco" AND [Manual UT Report No.] <> "",
 *       [Weld Length] / 1000,
 *       IF( ISBLANK(LOOKUPVALUE('Weld Length'[Weld Length],
 *                               'Weld Length'[Dia inch], [Dia inch])),
 *           BLANK(), <that lookup> ) )
 * The Inco branch is DEAD on the delivered data — Inco never populates
 * `Manual UT Report No.` — so every Inco row gets NULL (R3-06). Not substituted.
 */
const WELD_LENGTH_UPDATE = `
UPDATE weld w SET weld_length_m = CASE
    WHEN w.sub_contractor = 'INCO' AND coalesce(w.manual_ut_report_no, '') <> ''
      THEN w.weld_length / 1000.0
    ELSE (SELECT l.weld_length FROM weld_length_by_dia l WHERE l.dia_inch = w.dia_inch)
  END
WHERE w.weld_length_m IS DISTINCT FROM CASE
    WHEN w.sub_contractor = 'INCO' AND coalesce(w.manual_ut_report_no, '') <> ''
      THEN w.weld_length / 1000.0
    ELSE (SELECT l.weld_length FROM weld_length_by_dia l WHERE l.dia_inch = w.dia_inch)
  END`;

function newStats(): Stats {
  return {
    sheet1Rows: 0, distinct: new Map(), fdViolations: [], codes: [],
    codeSheetRows: 0, codeSheet1Rows: 0,
  };
}

function report(stats: Stats, t0: number): boolean {
  console.log(`  Sheet1 rows           ${fmt(stats.sheet1Rows).padStart(11)}  (expected ${fmt(EXPECTED.sheet1Rows)})`);
  console.log(`  distinct dia -> length${fmt(stats.distinct.size).padStart(11)}  (expected ${fmt(EXPECTED.distinctDia)})`);
  console.log(`  FD violations         ${fmt(stats.fdViolations.length).padStart(11)}  (a dia mapping to two lengths — must be 0)`);
  const byDomain = new Map<string, number>();
  for (const c of stats.codes) byDomain.set(c.domain, (byDomain.get(c.domain) ?? 0) + 1);
  console.log(`  Rework code rows      ${String(stats.codeSheetRows).padStart(11)} + Sheet1 ${stats.codeSheet1Rows} = ${stats.codeSheetRows + stats.codeSheet1Rows} source rows`);
  console.log(`  ref_code_label rows   ${String(stats.codes.length).padStart(11)}  (${[...byDomain].map(([d, n]) => `${d}=${n}`).join(", ")})`);
  console.log(`  runtime               ${secs(t0)}`);
  const ok = stats.sheet1Rows === EXPECTED.sheet1Rows
    && stats.distinct.size === EXPECTED.distinctDia
    && stats.fdViolations.length === 0;
  console.log(`  verdict               ${ok ? "counts MATCH the profile" : "COUNTS DIFFER FROM THE PROFILE"}`);
  return ok;
}

async function main(): Promise<void> {
  for (const f of [LENGTH_FILE, CODE_FILE]) {
    if (!existsSync(path.join(process.cwd(), f))) throw new Error(`file not found: ${f}`);
  }
  const dry = process.argv.includes("--dry-run");
  const t0 = Date.now();
  console.log(`WELD_LENGTH  ${LENGTH_FILE}`);
  const stats = newStats();
  await readLengths(stats);
  await readCodes(stats);
  const ok = report(stats, t0);
  if (stats.fdViolations.length > 0) {
    for (const v of stats.fdViolations.slice(0, 5)) {
      console.error(`  !! dia ${v.dia} maps to both ${v.a} and ${v.b}`);
    }
    throw new Error("the dia -> length functional dependency is broken; refusing to load");
  }
  if (dry) {
    if (!ok) process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  try {
    await client.query("SET statement_timeout = 0");
    await client.query("SET synchronous_commit = off");
    const abs = path.join(process.cwd(), LENGTH_FILE);
    const loadId = await openLoad(client, "WELD_LENGTH", path.basename(abs),
      statSync(abs).size, await sha256File(abs));
    const codeAbs = path.join(process.cwd(), CODE_FILE);
    const codeLoadId = await openLoad(client, "CODE_LABELS", path.basename(codeAbs),
      statSync(codeAbs).size, await sha256File(codeAbs));
    console.log(`  load_id ${loadId} (lengths), ${codeLoadId} (code labels)`);

    await client.query("BEGIN");
    await client.query("DELETE FROM weld_length_by_dia");
    for (const r of stats.distinct.values()) {
      await client.query(
        "INSERT INTO weld_length_by_dia (dia_inch, weld_length) VALUES ($1, $2)",
        [r.dia, r.len],
      );
    }
    await client.query("DELETE FROM ref_code_label");
    for (const c of stats.codes) {
      await client.query(
        "INSERT INTO ref_code_label (domain, code, description, load_id) VALUES ($1,$2,$3,$4)",
        [c.domain, c.code, c.description === "" ? null : c.description, codeLoadId],
      );
    }
    const tUpd = Date.now();
    const upd = await client.query(WELD_LENGTH_UPDATE);
    console.log(`  weld_length_m updated on ${fmt(upd.rowCount ?? 0)} rows in ${secs(tUpd)}`);
    await client.query("COMMIT");

    const perSource = await client.query<{ source: string; n: string; nulls: string }>(
      `SELECT source::text, count(*) FILTER (WHERE weld_length_m IS NOT NULL)::text AS n,
              count(*) FILTER (WHERE weld_length_m IS NULL)::text AS nulls
         FROM weld GROUP BY 1 ORDER BY 1`);
    for (const r of perSource.rows) {
      console.log(`    ${r.source.padEnd(20)} weld_length_m set on ${fmt(Number(r.n)).padStart(9)}, NULL on ${fmt(Number(r.nulls)).padStart(9)}`);
    }

    const tPost = Date.now();
    await client.query("VACUUM (ANALYZE) weld");
    await client.query("VACUUM (ANALYZE) weld_length_by_dia");
    const refreshed = await refreshMatviews(client);
    console.log(`  post    VACUUM + ${formatRefreshes(refreshed)} — ${secs(tPost)} total`);

    await closeLoad(client, loadId, stats.sheet1Rows, stats.distinct.size, 0, {
      exploded_sheet1_rows: stats.sheet1Rows,
      distinct_dia: stats.distinct.size,
      weld_rows_updated: upd.rowCount ?? 0,
      elapsed_s: Number(((Date.now() - t0) / 1000).toFixed(1)),
    });
    await closeLoad(client, codeLoadId, stats.codeSheetRows + stats.codeSheet1Rows,
      stats.codes.length, 0, { note: "display-only labels, R3-08" });
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
