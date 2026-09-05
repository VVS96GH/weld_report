/**
 * Loads `sources/TO BE EXLUDE FROM DATA.xlsx`, sheet `TO BE Exlude from Data`
 * (596 rows — the `Sheet1` tab, 20 rows, is a separate "new reports" staging
 * area and is NOT loaded here) into `ref_exclusion_list`.
 *
 *   node --import tsx scripts/load-exclusion-list.ts --dry-run
 *   node --import tsx scripts/load-exclusion-list.ts
 *
 * Ruling R2-02: this table is referenced by no Power Query and MUST be loaded
 * UNAPPLIED — nothing here filters `weld` or any other table. That is stated
 * again in the summary line the script prints.
 *
 * Column mapping (workbook header -> table column), per
 * db/migrations/0010_batch2_schema.sql's `ref_exclusion_list` comment:
 *   `RT/UT Report No.` (col 42) -> rt_report
 *   `Welder No.`        (col 5)  -> welder
 *   `Joint ID`          (col 124) -> joint_id
 *   `New Reports`       (col 123) -> reason (verbatim: `EXLUDE` on every row of
 *                                    this sheet — the only textual flag the
 *                                    workbook carries for why a row is listed)
 * The workbook ALSO carries a pre-concatenated `RT Report + Welder` column
 * (duplicated at positions 1 and 121, identical values, 161 distinct) that
 * *usually* equals `rt_report + '-' + welder`; it is not stored separately —
 * the pair (rt_report, welder) is meant to reproduce it.
 *
 * DEVIATION, found by this script, not assumed: it does NOT reproduce it
 * exactly. Two (rt_report, welder) pairs in the live file each correspond to
 * TWO different `RT Report + Welder` strings on different rows —
 *   (NFE1-RT00903, W-034) -> 'NFE1-RTE1748-W-034' on one row, 'NFE1-RT00903-W-034' on another
 *   (NFE1-RT02898, W-057) -> 'NFE1-RT00903-W-057' on one row, 'NFE1-RT02898-W-057' on another
 * i.e. the workbook's own `RT/UT Report No.` cell disagrees with its own
 * `RT Report + Welder` cell on 2 of the 596 rows — a source data typo, not a
 * mapping bug. That collapses 161 distinct `RT Report + Welder` strings to
 * 159 distinct (rt_report, welder) pairs. The script prints both counts and
 * this evidence rather than silently reporting "161".
 */

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { chunk, readSheet, toText } from "./lib/xlsx";

const SOURCE = "EXCLUSION_LIST";
const FILE = "sources/TO BE EXLUDE FROM DATA.xlsx";
const SHEET = "TO BE Exlude from Data";

const COL_WELDER_NO = 5;
const COL_RT_UT_REPORT_NO = 42;
const COL_NEW_REPORTS = 123;
const COL_JOINT_ID = 124;

const COL_COMBINED_KEY = 1; // `RT Report + Welder` (duplicated verbatim at col 121)

export interface ExclusionRow {
  rtReport: string | null;
  welder: string | null;
  jointId: string | null;
  reason: string | null;
  combinedKeyRaw: string | null;
}

/** Pure: one raw workbook row (1-indexed cells, matches `readSheet`) -> a typed row. */
export function mapExclusionRow(r: unknown[]): ExclusionRow {
  return {
    rtReport: toText(r[COL_RT_UT_REPORT_NO]),
    welder: toText(r[COL_WELDER_NO]),
    jointId: toText(r[COL_JOINT_ID]),
    reason: toText(r[COL_NEW_REPORTS]),
    combinedKeyRaw: toText(r[COL_COMBINED_KEY]),
  };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  if (!existsSync(FILE)) throw new Error(`file not found: ${FILE}`);

  const { rows } = await readSheet(FILE, SHEET);
  const mapped = rows.map(mapExclusionRow);

  const pairToCombined = new Map<string, Set<string>>();
  for (const r of mapped) {
    const key = `${r.rtReport ?? ""}::${r.welder ?? ""}`;
    if (!pairToCombined.has(key)) pairToCombined.set(key, new Set());
    pairToCombined.get(key)!.add(r.combinedKeyRaw ?? "");
  }
  const distinctPairs = pairToCombined.size;
  const distinctCombined = new Set(mapped.map((r) => r.combinedKeyRaw ?? "")).size;

  console.log(`file      ${FILE}`);
  console.log(`sheet     ${SHEET}`);
  console.log(`rows      ${mapped.length} (expected 596)`);
  console.log(`distinct (rt_report, welder) keys: ${distinctPairs}`);
  console.log(`distinct 'RT Report + Welder' cell values: ${distinctCombined} (workbook-plan expectation: 161)`);
  if (distinctPairs !== distinctCombined) {
    console.log(
      `!! the two do not agree: ${distinctCombined - distinctPairs} pair(s) where rt_report/welder disagree ` +
        `with the workbook's own precomputed 'RT Report + Welder' cell on different rows -- evidence:`,
    );
    for (const [key, combos] of pairToCombined) {
      if (combos.size > 1) console.log(`    (${key.replace("::", ", ")}) -> ${[...combos].join(" | ")}`);
    }
  }
  console.log("STATUS: loaded UNAPPLIED (ruling R2-02) — no loader or metric may filter on this table.");

  if (dryRun) {
    console.log("");
    console.log("--dry-run: no database writes");
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  const client = new Client({ connectionString: url });
  await client.connect();
  let loadId = -1;
  try {
    const size = statSync(FILE).size;
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO load (source, file_name, file_size, file_sha256, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [SOURCE, path.basename(FILE), size, "n/a-not-hashed", JSON.stringify({ status: "running" })],
    );
    loadId = Number(inserted.rows[0].id);
    console.log(`load_id ${loadId}`);

    await client.query("BEGIN");
    await client.query(
      `DELETE FROM ref_exclusion_list
       WHERE load_id IN (SELECT id FROM load WHERE source = $1 AND id <> $2)`,
      [SOURCE, loadId],
    );

    let insertedRows = 0;
    for (const batch of chunk(mapped, 500)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      batch.forEach((r, i) => {
        const base = i * 5;
        tuples.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`);
        values.push(r.rtReport, r.welder, r.jointId, r.reason, loadId);
      });
      await client.query(
        `INSERT INTO ref_exclusion_list (rt_report, welder, joint_id, reason, load_id)
         VALUES ${tuples.join(",")}`,
        values,
      );
      insertedRows += batch.length;
    }
    await client.query("COMMIT");
    console.log(`ref_exclusion_list: inserted ${insertedRows} rows`);

    await client.query(
      `UPDATE load SET finished_at = now(), records_read = $2, records_loaded = $3, notes = $4
       WHERE id = $1`,
      [
        loadId,
        mapped.length,
        insertedRows,
        JSON.stringify({
          status: "ok",
          distinct_rt_report_welder_pairs: distinctPairs,
          distinct_combined_key: distinctCombined,
          applied: false,
        }),
      ],
    );
    console.log("done");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection may already be gone */
    }
    if (loadId > 0) {
      await client.query(`UPDATE load SET finished_at = now(), notes = $2 WHERE id = $1`, [
        loadId,
        JSON.stringify({ status: "failed", error: String(err) }),
      ]);
    }
    throw err;
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
  });
}
