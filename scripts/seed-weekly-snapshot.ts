/**
 * Seeds `weld_weekly_snapshot` (+ `ref_mpi_done` + `ref_active_welders`) from
 * the four hand-maintained "CUM Trend …" workbooks.
 *
 * Sources (live copies only — NOT the `Back up/` copies, per
 * analysis/sources2/trend-seed-plan.md):
 *   sources/CUM Trend file RT and PWHT/CUM Trend file RT and PWHT Backlog .xlsx   sheet TREND
 *   sources/CUM Trend RT% UT% RejRate/CUM Trend RT% UT% RejRate.xlsx              sheet TREND RT UT
 *   sources/CUM Trend Active Welders/CUM Trend Active Welders.xlsx                sheet CUM Trend Active Welders
 *   sources/CUM MPI Done .xlsx                                                    sheet MPI Done
 *
 * Column -> metric -> normalisation mapping is
 * analysis/sources2/trend-seed-plan.md; sub-contractor normalisation is
 * ruling R2-08 (db/migrations/0010_batch2_schema.sql §6).
 *
 *   node --import tsx scripts/seed-weekly-snapshot.ts --dry-run
 *   node --import tsx scripts/seed-weekly-snapshot.ts
 *
 * DEVIATION from the load-weld-dump.ts ledger pattern (documented in the
 * CHECKPOINT, not just here): trend-seed-plan.md's "Loader shape" section is
 * explicit that this history is irreplaceable and must be written with
 * `INSERT … ON CONFLICT DO UPDATE`, never a delete-then-insert of the
 * previous same-source rows — db/README.md says the same thing about
 * `--truncate` never clearing `weld_weekly_snapshot`. So this script still
 * appends one `load` row per run (source `WEEKLY_SNAPSHOT`) and reports
 * records_loaded, but it UPSERTs the three target tables instead of
 * delete-then-insert. `ref_mpi_done` / `ref_active_welders` get the same
 * treatment for consistency (their PKs are just as naturally idempotent, and
 * they are filled by this same run).
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import {
  chunk,
  isFridayISO,
  normalizeSubContractorLabel,
  readSheet,
  toISODate,
  toNum,
  type NormalisedLabel,
} from "./lib/xlsx";
import { TREND_RT_PWHT_FILE } from "./lib/source-path";

const SOURCE = "WEEKLY_SNAPSHOT";

const FILE_TREND_REPORT = TREND_RT_PWHT_FILE;
const SHEET_TREND_REPORT = "TREND";
const FILE_TREND_RT_UT = "sources/CUM Trend RT% UT% RejRate/CUM Trend RT% UT% RejRate.xlsx";
const SHEET_TREND_RT_UT = "TREND RT UT";
const FILE_ACTIVE_WELDERS = "sources/CUM Trend Active Welders/CUM Trend Active Welders.xlsx";
const SHEET_ACTIVE_WELDERS = "CUM Trend Active Welders";
const FILE_MPI_DONE = "sources/CUM MPI Done .xlsx";
const SHEET_MPI_DONE = "MPI Done";

/** workbook column (1-indexed, matches exceljs `row.getCell(n)`) -> metric id */
export const TREND_REPORT_COLUMNS: Array<{ col: number; header: string; metric: string }> = [
  { col: 3, header: "RT Backlog", metric: "M40" },
  { col: 4, header: "PWHT Backlog All Types", metric: "M60" },
  { col: 5, header: "PWHT Backlog For RT", metric: "M62" },
  { col: 6, header: 'RT BACKLOG & PWHT "Y" Done + "N"', metric: "M48" },
  { col: 7, header: "RT BACKLOG & PWHT Not Done", metric: "M47" },
  { col: 8, header: "PWHT BACKLOG RT NOT Done (SG+TMCP)", metric: "M64" },
];

export const TREND_RT_UT_COLUMNS: Array<{ col: number; header: string; metric: string }> = [
  { col: 3, header: "RT% Rate", metric: "M25" },
  { col: 4, header: "UT% Rate", metric: "M36" },
  { col: 5, header: "Project RT % Rej Rate", metric: "M25P" },
  { col: 6, header: "Project UT % Rej Rate", metric: "M36P" },
];

export const ACTIVE_WELDERS_METRIC = "M90W";
export const MPI_DONE_METRIC = "M71";
export const MPI_PT_DONE_METRIC = "M71PT";

export interface SnapshotRow {
  weekEndDate: string;
  subContractor: string;
  scope: string;
  metric: string;
  value: number | null;
  labelRaw: string;
}

/** Pure: one (date, raw sub-contractor label, metric, raw cell) -> a snapshot row. */
export function buildSnapshotRow(
  weekEndDate: string,
  rawLabel: string,
  metric: string,
  rawValue: unknown,
): SnapshotRow {
  const { subContractor, scope, labelRaw }: NormalisedLabel = normalizeSubContractorLabel(rawLabel);
  return { weekEndDate, subContractor, scope, metric, value: toNum(rawValue), labelRaw };
}

interface WorkbookResult {
  rows: SnapshotRow[];
  nonFridayDates: string[];
  rowsRead: number;
}

async function loadTrendReport(): Promise<WorkbookResult> {
  const { rows } = await readSheet(FILE_TREND_REPORT, SHEET_TREND_REPORT);
  const out: SnapshotRow[] = [];
  const nonFriday = new Set<string>();
  for (const r of rows) {
    const iso = toISODate(r[1]);
    if (iso === null) throw new Error(`TREND: blank Date cell in row ${JSON.stringify(r)}`);
    if (!isFridayISO(iso)) nonFriday.add(iso);
    const label = String(r[2]);
    for (const { col, metric } of TREND_REPORT_COLUMNS) {
      out.push(buildSnapshotRow(iso, label, metric, r[col]));
    }
  }
  return { rows: out, nonFridayDates: [...nonFriday], rowsRead: rows.length };
}

async function loadTrendRtUt(): Promise<WorkbookResult> {
  const { rows } = await readSheet(FILE_TREND_RT_UT, SHEET_TREND_RT_UT);
  const out: SnapshotRow[] = [];
  const nonFriday = new Set<string>();
  for (const r of rows) {
    const iso = toISODate(r[1]);
    if (iso === null) throw new Error(`TREND RT UT: blank Date cell in row ${JSON.stringify(r)}`);
    if (!isFridayISO(iso)) nonFriday.add(iso);
    const label = String(r[2]);
    for (const { col, metric } of TREND_RT_UT_COLUMNS) {
      out.push(buildSnapshotRow(iso, label, metric, r[col]));
    }
  }
  return { rows: out, nonFridayDates: [...nonFriday], rowsRead: rows.length };
}

export interface ActiveWelderRow {
  weekEndDate: string;
  subContractor: string;
  welders: number | null;
  labelRaw: string;
}

async function loadActiveWelders(): Promise<{
  snapshot: WorkbookResult;
  ref: ActiveWelderRow[];
}> {
  const { rows } = await readSheet(FILE_ACTIVE_WELDERS, SHEET_ACTIVE_WELDERS);
  const out: SnapshotRow[] = [];
  const ref: ActiveWelderRow[] = [];
  const nonFriday = new Set<string>();
  for (const r of rows) {
    const iso = toISODate(r[1]);
    if (iso === null) throw new Error(`Active Welders: blank Week_End_Date in row ${JSON.stringify(r)}`);
    if (!isFridayISO(iso)) nonFriday.add(iso);
    const label = String(r[2]);
    const snap = buildSnapshotRow(iso, label, ACTIVE_WELDERS_METRIC, r[3]);
    out.push(snap);
    ref.push({
      weekEndDate: iso,
      subContractor: snap.subContractor,
      welders: snap.value,
      labelRaw: snap.labelRaw,
    });
  }
  return {
    snapshot: { rows: out, nonFridayDates: [...nonFriday], rowsRead: rows.length },
    ref,
  };
}

export interface MpiDoneRow {
  weekEndDate: string;
  mpiDone: number | null;
  mpiPtDone: number | null;
}

async function loadMpiDone(): Promise<{ snapshot: WorkbookResult; ref: MpiDoneRow[] }> {
  const { rows } = await readSheet(FILE_MPI_DONE, SHEET_MPI_DONE);
  const out: SnapshotRow[] = [];
  const ref: MpiDoneRow[] = [];
  const nonFriday = new Set<string>();
  for (const r of rows) {
    const iso = toISODate(r[1]);
    if (iso === null) throw new Error(`MPI Done: blank Week_End_Date in row ${JSON.stringify(r)}`);
    if (!isFridayISO(iso)) nonFriday.add(iso);
    const mpi = buildSnapshotRow(iso, "PROJECT", MPI_DONE_METRIC, r[2]);
    const mpiPt = buildSnapshotRow(iso, "PROJECT", MPI_PT_DONE_METRIC, r[3]);
    out.push(mpi, mpiPt);
    ref.push({ weekEndDate: iso, mpiDone: mpi.value, mpiPtDone: mpiPt.value });
  }
  return {
    snapshot: { rows: out, nonFridayDates: [...nonFriday], rowsRead: rows.length },
    ref,
  };
}

// ------------------------------------------------------------- reporting ---

function printCounts(
  label: string,
  result: WorkbookResult,
): void {
  console.log(`${label}: ${result.rowsRead} source rows -> ${result.rows.length} snapshot rows`);
  const byMetric = new Map<string, number>();
  for (const r of result.rows) byMetric.set(r.metric, (byMetric.get(r.metric) ?? 0) + 1);
  for (const [metric, n] of [...byMetric].sort()) console.log(`    ${metric.padEnd(6)} ${n}`);
  if (result.nonFridayDates.length > 0) {
    console.log(`    !! NON-FRIDAY week_end_date values (not fixed, reported): ${result.nonFridayDates.join(", ")}`);
  }
}

// ------------------------------------------------------------------ main ---

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  for (const f of [FILE_TREND_REPORT, FILE_TREND_RT_UT, FILE_ACTIVE_WELDERS, FILE_MPI_DONE]) {
    if (!existsSync(path.join(process.cwd(), f))) throw new Error(`file not found: ${f}`);
  }

  const trendReport = await loadTrendReport();
  const trendRtUt = await loadTrendRtUt();
  const activeWelders = await loadActiveWelders();
  const mpiDone = await loadMpiDone();

  const allRows = [
    ...trendReport.rows,
    ...trendRtUt.rows,
    ...activeWelders.snapshot.rows,
    ...mpiDone.snapshot.rows,
  ];
  const allNonFriday = [
    ...trendReport.nonFridayDates,
    ...trendRtUt.nonFridayDates,
    ...activeWelders.snapshot.nonFridayDates,
    ...mpiDone.snapshot.nonFridayDates,
  ];

  console.log("per-workbook counts");
  printCounts("TREND Report", trendReport);
  printCounts("TREND RT UT", trendRtUt);
  printCounts("Active Welders", activeWelders.snapshot);
  printCounts("MPI Done", mpiDone.snapshot);
  console.log("");
  console.log(`TOTAL snapshot rows: ${allRows.length} (expected ~10,386)`);
  console.log(
    allNonFriday.length === 0
      ? "all week_end_date values are Fridays"
      : `!! ${allNonFriday.length} non-Friday week_end_date value(s) found (kept as-is, not corrected): ${allNonFriday.join(", ")}`,
  );

  // Ruling: reproduce the GAC SG 2026-08-28 typo (All-Types < For-RT) rather
  // than silently "fixing" it — surfaced here so it is never invisible.
  const gacSgTypo = trendReport.rows.find(
    (r) =>
      r.weekEndDate === "2026-08-28" &&
      r.subContractor === "GAC" &&
      r.scope === "SG" &&
      r.metric === "M60",
  );
  const gacSgForRt = trendReport.rows.find(
    (r) =>
      r.weekEndDate === "2026-08-28" &&
      r.subContractor === "GAC" &&
      r.scope === "SG" &&
      r.metric === "M62",
  );
  if (gacSgTypo && gacSgForRt && (gacSgTypo.value ?? 0) < (gacSgForRt.value ?? 0)) {
    console.log(
      `note: workbook typo reproduced as-is — GAC SG 2026-08-28 M60 (PWHT All Types) = ${gacSgTypo.value} ` +
        `< M62 (PWHT For RT) = ${gacSgForRt.value}, which cannot both be true (For-RT is a subset of All-Types).`,
    );
  }

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
    const sizes = await Promise.all(
      [FILE_TREND_REPORT, FILE_TREND_RT_UT, FILE_ACTIVE_WELDERS, FILE_MPI_DONE].map(async (f) => {
        const { statSync } = await import("node:fs");
        return statSync(f).size;
      }),
    );
    const totalSize = sizes.reduce((a, b) => a + b, 0);

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO load (source, file_name, file_size, file_sha256, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        SOURCE,
        "CUM Trend file RT and PWHT / CUM Trend RT% UT% RejRate / CUM Trend Active Welders / CUM MPI Done",
        totalSize,
        "n/a-multi-file",
        JSON.stringify({ status: "running" }),
      ],
    );
    loadId = Number(inserted.rows[0].id);
    console.log(`load_id ${loadId}`);

    await client.query("BEGIN");

    let upserted = 0;
    for (const batch of chunk(allRows, 500)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      batch.forEach((r, i) => {
        const base = i * 7;
        tuples.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`,
        );
        values.push(r.weekEndDate, r.subContractor, r.scope, r.metric, r.value, r.labelRaw, loadId);
      });
      const sql = `
        INSERT INTO weld_weekly_snapshot
          (week_end_date, sub_contractor, scope, metric, value, label_raw, load_id)
        VALUES ${tuples.join(",")}
        ON CONFLICT (week_end_date, sub_contractor, scope, metric)
        DO UPDATE SET value = EXCLUDED.value, label_raw = EXCLUDED.label_raw,
                       load_id = EXCLUDED.load_id, recorded_at = now()`;
      await client.query(sql, values);
      upserted += batch.length;
    }
    console.log(`weld_weekly_snapshot: upserted ${upserted} rows`);

    for (const batch of chunk(mpiDone.ref, 500)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      batch.forEach((r, i) => {
        const base = i * 4;
        tuples.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4})`);
        values.push(r.weekEndDate, r.mpiDone, r.mpiPtDone, loadId);
      });
      await client.query(
        `INSERT INTO ref_mpi_done (week_end_date, mpi_done, mpi_pt_done, load_id)
         VALUES ${tuples.join(",")}
         ON CONFLICT (week_end_date)
         DO UPDATE SET mpi_done = EXCLUDED.mpi_done, mpi_pt_done = EXCLUDED.mpi_pt_done,
                        load_id = EXCLUDED.load_id`,
        values,
      );
    }
    console.log(`ref_mpi_done: upserted ${mpiDone.ref.length} rows`);

    for (const batch of chunk(activeWelders.ref, 500)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      batch.forEach((r, i) => {
        const base = i * 5;
        tuples.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`);
        values.push(r.weekEndDate, r.subContractor, r.welders, r.labelRaw, loadId);
      });
      await client.query(
        `INSERT INTO ref_active_welders (week_end_date, sub_contractor, welders, label_raw, load_id)
         VALUES ${tuples.join(",")}
         ON CONFLICT (week_end_date, sub_contractor)
         DO UPDATE SET welders = EXCLUDED.welders, label_raw = EXCLUDED.label_raw,
                        load_id = EXCLUDED.load_id`,
        values,
      );
    }
    console.log(`ref_active_welders: upserted ${activeWelders.ref.length} rows`);

    await client.query("COMMIT");

    await client.query(
      `UPDATE load SET finished_at = now(), records_read = $2, records_loaded = $3, notes = $4
       WHERE id = $1`,
      [
        loadId,
        trendReport.rowsRead + trendRtUt.rowsRead + activeWelders.snapshot.rowsRead + mpiDone.snapshot.rowsRead,
        upserted,
        JSON.stringify({
          status: "ok",
          weld_weekly_snapshot_rows: upserted,
          ref_mpi_done_rows: mpiDone.ref.length,
          ref_active_welders_rows: activeWelders.ref.length,
          non_friday_dates: allNonFriday,
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
