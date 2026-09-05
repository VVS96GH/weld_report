/**
 * Loads `sources/UT TRACKER (CCC)_Talisman.xlsx`, sheet `TalismanUT_update`
 * (24 columns, 9,419 rows — the `Reject` sheet, 30 rows, is a subset and is
 * NOT loaded, per ruling R2-14 / db/migrations/0010_batch2_schema.sql) into
 * `ref_ut_tracker_ccc`.
 *
 *   node --import tsx scripts/load-ut-tracker-ccc.ts --dry-run
 *   node --import tsx scripts/load-ut-tracker-ccc.ts
 *
 * Ledger pattern (same shape as scripts/load-weld-dump.ts): append a `load`
 * row, delete the previous rows of source `UT_TRACKER_CCC` (by their
 * `load_id`, since this table has no `source` column of its own), insert the
 * new rows, update the ledger counts.
 */

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { chunk, readSheet, toISODate, toNum, toText } from "./lib/xlsx";

const SOURCE = "UT_TRACKER_CCC";
const FILE = "sources/UT TRACKER (CCC)_Talisman.xlsx";
const SHEET = "TalismanUT_update";

export interface UtTrackerRow {
  qcisoNo: string | null;
  jointNo: string | null;
  spoolNo: string | null;
  sizeInch: number | null;
  wallThickness: number | null;
  serviceClass: string | null;
  weldType: string | null;
  area: string | null;
  weldDate: string | null;
  welderId: string | null;
  welderId2: string | null;
  welderId3: string | null;
  welderId4: string | null;
  wpsCode: string | null;
  ut1Date: string | null;
  ut1RepNo: string | null;
  ut1Result: string | null;
  utOpe1: string | null;
  utOpe2: string | null;
  weldDefectLength: number | null;
  tpiDate: string | null;
  tpiReportNo: string | null;
  pwhtDate: string | null;
  pwhtRepNo: string | null;
  jointId: string | null;
}

/** Pure: one raw workbook row (1-indexed cells, matches `readSheet`) -> a typed row.
 * `joint_id` is loader-derived: `qciso_no || '-' || spool_no || '-' || joint_no`
 * (db/migrations/0010_batch2_schema.sql comment on `ref_ut_tracker_ccc.joint_id`). */
export function mapUtTrackerRow(r: unknown[]): UtTrackerRow {
  const qcisoNo = toText(r[1]);
  const jointNo = toText(r[2]);
  const spoolNo = toText(r[3]);
  const jointId = qcisoNo !== null && spoolNo !== null && jointNo !== null
    ? `${qcisoNo}-${spoolNo}-${jointNo}`
    : null;
  return {
    qcisoNo,
    jointNo,
    spoolNo,
    sizeInch: toNum(r[4]),
    wallThickness: toNum(r[5]),
    serviceClass: toText(r[6]),
    weldType: toText(r[7]),
    area: toText(r[8]),
    weldDate: toISODate(r[9]),
    welderId: toText(r[10]),
    welderId2: toText(r[11]),
    welderId3: toText(r[12]),
    welderId4: toText(r[13]),
    wpsCode: toText(r[14]),
    ut1Date: toISODate(r[15]),
    ut1RepNo: toText(r[16]),
    ut1Result: toText(r[17]),
    utOpe1: toText(r[18]),
    utOpe2: toText(r[19]),
    weldDefectLength: toNum(r[20]),
    tpiDate: toISODate(r[21]),
    tpiReportNo: toText(r[22]),
    pwhtDate: toISODate(r[23]),
    pwhtRepNo: toText(r[24]),
    jointId,
  };
}

const COLUMNS = [
  "load_id", "qciso_no", "joint_no", "spool_no", "size_inch", "wall_thickness",
  "service_class", "weld_type", "area", "weld_date", "welder_id", "welder_id_2",
  "welder_id_3", "welder_id_4", "wps_code", "ut1_date", "ut1_rep_no", "ut1_result",
  "ut_ope1", "ut_ope2", "weld_defect_length", "tpi_date", "tpi_report_no",
  "pwht_date", "pwht_rep_no", "joint_id",
] as const;

function rowValues(loadId: number, r: UtTrackerRow): unknown[] {
  return [
    loadId, r.qcisoNo, r.jointNo, r.spoolNo, r.sizeInch, r.wallThickness,
    r.serviceClass, r.weldType, r.area, r.weldDate, r.welderId, r.welderId2,
    r.welderId3, r.welderId4, r.wpsCode, r.ut1Date, r.ut1RepNo, r.ut1Result,
    r.utOpe1, r.utOpe2, r.weldDefectLength, r.tpiDate, r.tpiReportNo,
    r.pwhtDate, r.pwhtRepNo, r.jointId,
  ];
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  if (!existsSync(FILE)) throw new Error(`file not found: ${FILE}`);

  const { rows, header } = await readSheet(FILE, SHEET);
  const mapped = rows.map(mapUtTrackerRow);

  console.log(`file      ${FILE}`);
  console.log(`sheet     ${SHEET}`);
  console.log(`header    ${(header as unknown[]).filter((h) => h != null).length} columns`);
  console.log(`rows      ${mapped.length} (expected 9,419)`);

  const distinctReports = new Set(mapped.map((r) => r.ut1RepNo)).size;
  const nullJointId = mapped.filter((r) => r.jointId === null).length;
  console.log(`distinct ut1_rep_no (natural key) ${distinctReports}`);
  console.log(`rows with a derived joint_id       ${mapped.length - nullJointId}`);
  if (nullJointId > 0) console.log(`!! ${nullJointId} rows missing qciso_no/spool_no/joint_no (joint_id NULL)`);

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
      `DELETE FROM ref_ut_tracker_ccc
       WHERE load_id IN (SELECT id FROM load WHERE source = $1 AND id <> $2)`,
      [SOURCE, loadId],
    );

    let insertedRows = 0;
    for (const batch of chunk(mapped, 500)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      batch.forEach((r, i) => {
        const base = i * COLUMNS.length;
        tuples.push(`(${COLUMNS.map((_, j) => `$${base + j + 1}`).join(",")})`);
        values.push(...rowValues(loadId, r));
      });
      await client.query(
        `INSERT INTO ref_ut_tracker_ccc (${COLUMNS.join(", ")}) VALUES ${tuples.join(",")}`,
        values,
      );
      insertedRows += batch.length;
    }
    await client.query("COMMIT");
    console.log(`ref_ut_tracker_ccc: inserted ${insertedRows} rows`);

    await client.query(
      `UPDATE load SET finished_at = now(), records_read = $2, records_loaded = $3, notes = $4
       WHERE id = $1`,
      [
        loadId,
        mapped.length,
        insertedRows,
        JSON.stringify({ status: "ok", distinct_ut1_rep_no: distinctReports, null_joint_id: nullJointId }),
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
