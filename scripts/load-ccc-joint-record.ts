/**
 * `AllTrain_CSVExport_Joint Record.csv` -> `ccc_joint_pwht` + the NOT-WELDED
 * slice of `weld`.
 *
 *   node --import tsx scripts/load-ccc-joint-record.ts --dry-run
 *   node --import tsx scripts/load-ccc-joint-record.ts
 *
 * Framing: ',' UTF-8, CRLF only, no quoting, no embedded newlines. The header
 * carries 143 names and every data line carries **145** fields — field 144 is
 * empty in all 1,612,440 rows and field 145 holds an ISO line-number fragment on
 * 1,029,449. `Csv.Document(Columns=143)` TRUNCATES them and columns 1..143 stay
 * aligned, so we truncate too. Failing on the extra fields would lose the file.
 *
 * Two outputs, both from the same single pass:
 *   1. `ccc_joint_pwht` — every `Del Flag = ''` row (1,560,273), collapsed to one
 *      row per Joint ID "JR" (1,470,065 distinct). The collapse happens in SQL,
 *      not in JS: holding 1.47M multi-field objects in a Map would cost more RSS
 *      than the whole load is budgeted.
 *   2. `weld` — the `Weld Date IS NULL` slice of those rows (130,994), source
 *      CCC_JOINT_RECORD. This is the union's FIFTH source (ruling R2-03): joints
 *      that exist and are not yet welded, so they carry no weld_date and every
 *      "welded" metric must keep its `weld_date IS NOT NULL` predicate.
 */

import { statSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import {
  CopySink, closeLoad, copyLine, fmt, num, openLoad, parseDate, readDelimited,
  requireEnvUrl, secs, sha256File, txt,
} from "./load-common";
import {
  CCC_JOINT_PWHT_COLUMNS as JR_COLUMNS,
  CCC_JOINT_WELD_COLUMNS as WELD_COLUMNS,
} from "./load-columns";
import {
  EXCLUDED_JOINT_IDS, diaInchFactor, normaliseRepairSuffix, normaliseWeldType,
  repairRewaldPrAll,
} from "./ccc-columns";

const FILE = "sources/AllTrain_CSVExport_Joint Record.csv";
const SOURCE = "CCC_JOINT_RECORD";
const HEADER_WIDTH = 143;

const EXPECTED = { lines: 1_612_440, kept: 1_560_273, notWelded: 130_994 };

interface Stats {
  lines: number;
  kept: number;
  droppedDelFlag: number;
  notWelded: number;
  excludedByM: number;
  widths: Map<number, number>;
  distinctJointIds: number;
}

type Row = { jr: (string | null)[]; weld: (string | null)[] | null };

async function* rows(loadId: number, stats: Stats, jointIds: Set<string> | null): AsyncGenerator<Row> {
  let index: Map<string, number> | null = null;
  for await (const line of readDelimited(path.join(process.cwd(), FILE), {
    delimiter: ",", encoding: "utf-8", width: HEADER_WIDTH, mode: "truncate",
  })) {
    if (line.lineNo === 0) {
      index = new Map(line.fields.map((h, i) => [h.trim(), i]));
      continue;
    }
    if (!index) throw new Error("no header");
    stats.lines += 1;
    stats.widths.set(line.rawWidth, (stats.widths.get(line.rawWidth) ?? 0) + 1);
    const g = (h: string): string | undefined => {
      const i = index?.get(h);
      return i === undefined ? undefined : line.fields[i];
    };

    // #"Filtered Rows": keep [Del Flag] = ""
    if (txt(g("Del Flag")) !== null) {
      stats.droppedDelFlag += 1;
      continue;
    }
    stats.kept += 1;

    // #"Replaced Value"/1: R01 -> R1, R02 -> R2 (ReplaceText), BEFORE Joint ID.
    const suffix = normaliseRepairSuffix((g("Repair Suffix") ?? "").trim());
    const iso = (g("QC ISO DWG No") ?? "").trim();
    const spoolNo = (g("Spool No") ?? "").trim();
    const jointNo = (g("Joint No") ?? "").trim();
    const spoolId = `${iso}-${spoolNo}`;
    const jointId = `${iso}-${spoolNo}-${jointNo}${suffix}`;
    if (jointIds) jointIds.add(jointId);

    const weldDate = parseDate(g("Weld Date"));

    const jr: (string | null)[] = [
      jointId,
      txt(g("PWHT")), txt(g("PWHT Report No")), parseDate(g("PWHT Date")),
      txt(g("HT Report No")), parseDate(g("HT Date")),
      txt(g("MT Root Report No")), parseDate(g("MT Root Date")),
      num(g("MT Root(%)")), num(g("MT Cap(%)")),
      txt(g("PT Root Report No")), parseDate(g("PT Root Date")),
      num(g("PT Root(%)")), num(g("PT Cap(%)")),
      txt(g("PMI Report No")), parseDate(g("PMI Date")),
      txt(g("Weld Report No")), txt(g("Test Package No")), txt(g("Sub-System No")),
      num(g("Wall Thickness")), txt(g("Rework Code")),
      txt(g("Sub-Con Code")), weldDate, txt(suffix),
    ];

    // #"Filtered Rows1": the NOT-WELDED slice is [Weld Date] = null.
    let weld: (string | null)[] | null = null;
    if (weldDate === null) {
      stats.notWelded += 1;
      if (EXCLUDED_JOINT_IDS.has(jointId)) {
        // The M's #"EXLUDE 4 RT B.log CCC"; see weld_manual_exclusion (0012).
        stats.excludedByM += 1;
      } else {
        const weldType = normaliseWeldType((g("Weld Type") ?? "").trim());
        const sub = txt(g("Sub-Con Code"));
        const serviceClass = txt(g("Service Class"));
        const ndt = txt(g("NDT Remarks"));
        weld = [
          SOURCE, String(loadId), jointId, spoolId,
          txt(iso), txt(g("Revision No")), txt(spoolNo), txt(jointNo),
          txt(g("Work Category")), weldType === "" ? null : weldType,
          diaInchFactor(weldType) ? "t" : "f",
          num(g("Dia-Inch")), num(g("Wall Thickness")),
          txt(g("Area Code")), txt(g("Area Group-3")),
          txt(g("Area Group-2")),                    // CCC's TEXT Area Classification
          serviceClass, txt(g("Material Category")), ndt,
          num(g("Sheet No")), sub, txt(g("Rework Code")), txt(suffix),
          txt(g("Original Joint")), txt(g("Tracer Shot")), null,
          txt(g("Test Package No")),
          sub === null ? null : `${txt(g("Weld Report No")) ?? ""}-${sub}`,
          // The joint record IS the CCC PWHT/NDE source, so these rows carry their
          // own overlay values directly rather than joining back to themselves.
          txt(g("PWHT")), txt(g("PWHT Report No")), parseDate(g("PWHT Date")),
          txt(g("MT Root Report No")), parseDate(g("MT Root Date")), num(g("MT Root(%)")),
          txt(g("PT Root Report No")), parseDate(g("PT Root Date")), num(g("PT Root(%)")),
          txt(g("PMI Report No")), parseDate(g("PMI Date")),
          txt(g("HT Report No")), parseDate(g("HT Date")),
          txt(g("Weld Report No")), num(g("Wall Thickness")), txt(g("Rework Code")),
          // repair_reweld, PR-all rule: these rows are never Inco, and their
          // Joint ID / Repair Suffix drive the four categories (R2-12).
          repairRewaldPrAll(sub ?? "", jointId, suffix),
          // service_class_cat_wd / _ndt: Service Cat is blank for CCC, so the
          // doubled space lands between class and NDT — a real key-shape
          // difference from the dump, reproduced deliberately.
          `${serviceClass ?? ""} `,
          `${serviceClass ?? ""}  ${ndt ?? ""} `,
          iso.toUpperCase().endsWith("-PCC") ? "t" : "f",
          "f", "f", "f",
        ];
      }
    }
    yield { jr, weld };
  }
  if (jointIds) stats.distinctJointIds = jointIds.size;
}


function report(stats: Stats, t0: number): boolean {
  const widths = [...stats.widths].sort((a, b) => b[1] - a[1]);
  console.log(`  physical data lines   ${fmt(stats.lines).padStart(11)}  (expected ${fmt(EXPECTED.lines)})`);
  console.log(`  field-count histogram ${widths.map(([w, c]) => `${w}->${fmt(c)}`).join(", ")}  (truncated to ${HEADER_WIDTH})`);
  console.log(`  dropped Del Flag <> ''${fmt(stats.droppedDelFlag).padStart(11)}`);
  console.log(`  kept (Del Flag = '')  ${fmt(stats.kept).padStart(11)}  (expected ${fmt(EXPECTED.kept)})`);
  if (stats.distinctJointIds > 0) {
    console.log(`  distinct Joint ID "JR"${fmt(stats.distinctJointIds).padStart(11)}  -> ccc_joint_pwht rows after the SQL collapse`);
  }
  console.log(`  NOT WELDED slice      ${fmt(stats.notWelded).padStart(11)}  (expected ${fmt(EXPECTED.notWelded)})`);
  console.log(`  ...minus the M's 4 hard-coded Joint IDs  ${fmt(stats.excludedByM)}`);
  console.log(`  rows into weld        ${fmt(stats.notWelded - stats.excludedByM).padStart(11)}`);
  console.log(`  runtime               ${secs(t0)}`);
  const ok = stats.lines === EXPECTED.lines && stats.kept === EXPECTED.kept
    && stats.notWelded === EXPECTED.notWelded;
  console.log(`  verdict               ${ok ? "counts MATCH the profile" : "COUNTS DIFFER FROM THE PROFILE"}`);
  return ok;
}

function newStats(): Stats {
  return { lines: 0, kept: 0, droppedDelFlag: 0, notWelded: 0, excludedByM: 0,
    widths: new Map(), distinctJointIds: 0 };
}

async function dryRun(): Promise<boolean> {
  const abs = path.join(process.cwd(), FILE);
  if (!existsSync(abs)) throw new Error(`file not found: ${abs}`);
  const t0 = Date.now();
  console.log(`\n${SOURCE}  ${FILE}  (${fmt(statSync(abs).size)} bytes)`);
  const stats = newStats();
  const jointIds = new Set<string>();
  for await (const _r of rows(0, stats, jointIds)) void _r;
  const ok = report(stats, t0);
  console.log(`  ccc_joint_pwht columns ${JR_COLUMNS.length} + load_id/source_rows/is_ambiguous/is_welded`);
  console.log(`  weld columns written   ${WELD_COLUMNS.length}`);
  return ok;
}

async function live(): Promise<void> {
  const abs = path.join(process.cwd(), FILE);
  if (!existsSync(abs)) throw new Error(`file not found: ${abs}`);
  const size = statSync(abs).size;
  const t0 = Date.now();
  const sha = await sha256File(abs);
  console.log(`${SOURCE}  ${FILE}`);
  console.log(`  sha256 ${sha}`);

  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  try {
    await client.query("SET statement_timeout = 0");
    await client.query("SET synchronous_commit = off");
    const loadId = await openLoad(client, SOURCE, path.basename(abs), size, sha);
    console.log(`  load_id ${loadId}`);

    await client.query("BEGIN");
    await client.query(`CREATE TEMP TABLE tmp_jr (
      joint_id_jr text, pwht_y_n text, pwht_report_no text, pwht_date date,
      ht_report_no text, ht_date date, mt_root_report_no text, mt_root_date date,
      mt_root_pct integer, mt_cap_pct integer, pt_root_report_no text, pt_root_date date,
      pt_root_pct integer, pt_cap_pct integer, pmi_report_no text, pmi_date date,
      weld_report_no text, test_package_no text, sub_system_no text,
      wall_thickness numeric(8,2), rework_code text, sub_contractor text,
      weld_date date, repair_suffix text) ON COMMIT DROP`);
    await client.query("DELETE FROM weld WHERE source = $1", [SOURCE]);
    await client.query("DELETE FROM ccc_joint_pwht");

    const stats = newStats();
    const jrSink = new CopySink(client, "tmp_jr", [...JR_COLUMNS]);
    const weldSink = new CopySink(client, "weld", [...WELD_COLUMNS]);
    const tCopy = Date.now();
    for await (const r of rows(loadId, stats, null)) {
      await jrSink.write(copyLine(r.jr));
      if (r.weld) await weldSink.write(copyLine(r.weld));
    }
    const jrRows = await jrSink.end();
    const weldRows = await weldSink.end();
    console.log(`  copy    ${fmt(jrRows)} JR rows + ${fmt(weldRows)} weld rows in ${secs(tCopy)}`);

    // The collapse. MAX() matches the DAX (`MAXX(FILTER(JR, Joint ID = …), …)`),
    // and is_ambiguous makes a genuine conflict countable instead of invisible —
    // LOOKUPVALUE would silently return BLANK.
    const tColl = Date.now();
    const collapsed = await client.query(`
      INSERT INTO ccc_joint_pwht (
        joint_id_jr, load_id, pwht_y_n, pwht_report_no, pwht_date, ht_report_no, ht_date,
        mt_root_report_no, mt_root_date, mt_root_pct, mt_cap_pct,
        pt_root_report_no, pt_root_date, pt_root_pct, pt_cap_pct,
        pmi_report_no, pmi_date, weld_report_no, test_package_no, sub_system_no,
        wall_thickness, rework_code, sub_contractor, weld_date, repair_suffix,
        is_welded, source_rows, is_ambiguous)
      SELECT joint_id_jr, $1,
             max(pwht_y_n), max(pwht_report_no), max(pwht_date), max(ht_report_no), max(ht_date),
             max(mt_root_report_no), max(mt_root_date), max(mt_root_pct), max(mt_cap_pct),
             max(pt_root_report_no), max(pt_root_date), max(pt_root_pct), max(pt_cap_pct),
             max(pmi_report_no), max(pmi_date), max(weld_report_no), max(test_package_no),
             max(sub_system_no), max(wall_thickness), max(rework_code), max(sub_contractor),
             max(weld_date), max(repair_suffix),
             bool_or(weld_date IS NOT NULL),
             count(*),
             count(DISTINCT pwht_y_n) > 1 OR count(DISTINCT pwht_report_no) > 1
               OR count(DISTINCT pwht_date) > 1
        FROM tmp_jr GROUP BY joint_id_jr`, [loadId]);
    console.log(`  collapse ${fmt(collapsed.rowCount ?? 0)} distinct Joint ID "JR" in ${secs(tColl)}`);
    const amb = await client.query<{ n: string }>(
      "SELECT count(*) AS n FROM ccc_joint_pwht WHERE is_ambiguous",
    );
    console.log(`  ambiguous joints (rows disagreed on a PWHT value): ${fmt(Number(amb.rows[0].n))}`);

    await client.query(
      "UPDATE weld SET weldpoint_seq = 1 WHERE source = $1 AND weldpoint_seq IS NULL", [SOURCE]);
    await client.query("COMMIT");

    report(stats, t0);
    const tPost = Date.now();
    await client.query("VACUUM (ANALYZE) weld");
    await client.query("VACUUM (ANALYZE) ccc_joint_pwht");
    await client.query("REFRESH MATERIALIZED VIEW mv_weekly_progress");
    console.log(`  post    VACUUM + REFRESH in ${secs(tPost)}`);

    await closeLoad(client, loadId, stats.lines, weldRows, 0, {
      dropped_del_flag: stats.droppedDelFlag,
      kept_rows: stats.kept,
      ccc_joint_pwht_rows: collapsed.rowCount ?? 0,
      ambiguous_joints: Number(amb.rows[0].n),
      excluded_by_m: stats.excludedByM,
      elapsed_s: Number(((Date.now() - t0) / 1000).toFixed(1)),
    });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* connection may be gone */ }
    throw err;
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--dry-run")) {
    if (!(await dryRun())) process.exitCode = 1;
    return;
  }
  await live();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exitCode = 1;
});
