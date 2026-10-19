/**
 * `CSVExport_Welder Record.csv` + `CSVExport_Welder Record - FOR PIC UPDATE
 * (ACC  REJ ).xlsx` -> `weld`, source CCC_WELDER_RECORD.
 *
 *   node --import tsx scripts/load-ccc-welder-record.ts --dry-run
 *   node --import tsx scripts/load-ccc-welder-record.ts
 *
 * THE §1.4 SPLIT IS MANDATORY (ruling R2-16). The pbix appends two tables and the
 * CSV half is filtered:
 *     CSV rows with `RT/UT Report No.` = ''      4,791,434
 *   + every row of the ACC/REJ workbook            641,575
 *   = 5,433,009                                            = the pbix row count
 * Loading the CSV whole would double-count 639,298 tested rows; loading only the
 * CSV would lose the workbook's corrected ACC/REJ results.
 *
 * Framing: the CSV is ',' UTF-8, CRLF only, 119 fields on every one of its
 * 5,430,732 lines, no quoting, no embedded newlines. The workbook has the SAME
 * 119-column header and is read with the exceljs streaming WorkbookReader, so
 * neither file is ever fully in memory.
 *
 * PRE-REQUISITE: scripts/load-ccc-joint-record.ts must have run — the CCC NDE
 * branches are a LEFT JOIN to `ccc_joint_pwht`. This script refuses to run if
 * that table is empty rather than silently writing NULLs.
 */

import { statSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import ExcelJS from "exceljs";
import {
  closeLoad, copyLine, copyRows, formatRefreshes, fmt, num, openLoad, parseDate, readDelimited,
  refreshMatviews, requireEnvUrl, secs, sha256File, txt,
} from "./load-common";
import { weldCutoff } from "./lib/weld-cutoff";
import { CCC_WELDER_WELD_COLUMNS as WELD_COLUMNS } from "./load-columns";
import { applyCccUtOverlay, formatUtOverlay } from "./lib/ut-overlay";
import {
  EXCLUDED_JOINT_IDS, EXCLUDED_RS1_RT_BLOG_JOINT_IDS, diaInchFactor, normaliseRepairSuffix, normaliseWeldType,
  repairRewaldPrAll, synthRtWeldStatus, tmcpPipePrAll, wholePct,
} from "./ccc-columns";

const CSV_FILE = "sources/CSVExport_Welder Record.csv";
/** Welds dated after this are left out (last Friday before the export). */
const CUTOFF = weldCutoff(CSV_FILE);
const XLSX_FILE = "sources/CSVExport_Welder Record - FOR PIC UPDATE  (ACC  REJ ).xlsx";
const SOURCE = "CCC_WELDER_RECORD";
const WIDTH = 119;

const EXPECTED = { csvLines: 5_430_732, csvKept: 4_791_434, xlsxRows: 641_575, total: 5_433_009 };

interface Stats {
  csvLines: number; csvKept: number; csvSkippedTested: number;
  xlsxRows: number; excludedByM: number; excludedRs1: number; afterCutoff: number; written: number;
  weldTypeChanged: number; rtWeldStatus: Map<string, number>;
  repairReweld: Map<string, number>; dateFailures: Map<string, number>;
  distinctJointIds: number; peakRssMb: number;
}

function newStats(): Stats {
  return {
    csvLines: 0, csvKept: 0, csvSkippedTested: 0, xlsxRows: 0, excludedByM: 0, excludedRs1: 0, afterCutoff: 0, written: 0,
    weldTypeChanged: 0, rtWeldStatus: new Map(), repairReweld: new Map(),
    dateFailures: new Map(), distinctJointIds: 0, peakRssMb: 0,
  };
}

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/**
 * Builds one `weld` row from a 119-field CCC record.
 * `seq` counts rows per joint so weldpoint_seq reproduces
 * ROW_NUMBER() OVER (PARTITION BY joint_id ORDER BY id) without a 5.4M-row
 * post-UPDATE: rows are emitted in the order they are inserted.
 */
function buildRow(
  g: (h: string) => string,
  loadId: number,
  seq: Map<string, number>,
  stats: Stats,
): (string | null)[] | null {
  const suffix = normaliseRepairSuffix(g("Repair Suffix").trim());
  const iso = g("QC ISO DWG. No.").trim();
  const spoolNo = g("Spool No.").trim();
  const weldNo = g("Joint No.").trim();
  const jointId = `${iso}-${spoolNo}-${weldNo}${suffix}`;
  if (EXCLUDED_JOINT_IDS.has(jointId)) {
    stats.excludedByM += 1;
    return null;
  }
  if (EXCLUDED_RS1_RT_BLOG_JOINT_IDS.has(jointId)) {
    stats.excludedRs1 += 1;
    return null;
  }

  const rawType = g("Weld Type").trim();
  const weldType = normaliseWeldType(rawType);
  if (weldType !== rawType) stats.weldTypeChanged += 1;

  // #"Replaced Value ""#"" to CCC": a NO-OP on this export (Sub-Con Code is
  // already 'CCC' in all 5,430,732 rows) — reproduced anyway.
  const sub = g("Sub-Con Code").trim() === "#" ? "CCC" : g("Sub-Con Code").trim();

  const weldDate = parseDate(g("Weld Date"));
  if (weldDate === null && g("Weld Date").trim() !== "") bump(stats.dateFailures, "weld_date");
  // the M's `#"Exlude after 16 oct"`, as a rule (scripts/lib/weld-cutoff.ts)
  if (weldDate !== null && weldDate > CUTOFF) {
    stats.afterCutoff += 1;
    return null;
  }
  const rtDate = parseDate(g("RT/UT Date"));
  if (rtDate === null && g("RT/UT Date").trim() !== "") bump(stats.dateFailures, "rt_date");

  const rtPct = wholePct(g("RT/UT(%)"));
  const rtStatus = synthRtWeldStatus(g("RT/UT Report No.").trim(), rtPct, g("Tracer Shot").trim());
  bump(stats.rtWeldStatus, rtStatus === "" ? "(blank)" : rtStatus);

  const rr = repairRewaldPrAll(sub, jointId, suffix);
  bump(stats.repairReweld, rr === "" ? "(blank)" : rr);

  const serviceClass = g("Service Class").trim();
  const ndt = g("NDT Remarks").trim();
  const diaInch = num(g("Dia Inch"));

  // M `#"Total No of films Acc"` = [RT Film Total] - [Total No of films Rej],
  // so the GENERATED rt_film_total (acc + rej) round-trips the source value.
  // Fractional on CCC — a weld-point share, not a film count (ruling R2-04).
  const filmTotal = num(g("RT Film Total"));
  const filmRej = num(g("RT Film Reject"));
  const filmAcc = filmTotal === null ? null
    : String(Number(filmTotal) - Number(filmRej ?? "0"));

  const n = (seq.get(jointId) ?? 0) + 1;
  seq.set(jointId, n);

  return [
    SOURCE, String(loadId), jointId, `${iso}-${spoolNo}`,
    txt(iso), txt(spoolNo), txt(weldNo), txt(g("Work Category")),
    weldType === "" ? null : weldType,
    diaInchFactor(weldType) ? "t" : "f",
    diaInch, num(g("Wall Thickness")), txt(g("Area Code")), txt(g("Area Group-3")),
    txt(g("Area Group-2")),                       // CCC's TEXT Area Classification
    txt(serviceClass), txt(g("Material Category")), txt(ndt),
    txt(g("Weld Point Code")), num(g("Welded(Weld Point)")),
    txt(g("Welding Process")), txt(g("Welder No.")),
    `${g("Welder No.").trim()}-${sub}`, txt(sub),
    txt(g("Original Joint")), txt(suffix), txt(g("Tracer Shot")), txt(g("RT/UT")),
    weldDate, weldDate, weldDate, weldDate,       // Cutting/Beveling/Fitup = Weld Date
    txt(g("RT/UT Report No.")), rtDate, txt(g("RT/UT Result")), num(rtPct),
    rtStatus === "" ? null : rtStatus,
    filmRej, filmAcc, txt(g("RT/UT Defect Code")),
    rr,
    // Service Cat is blank for CCC, so the doubled space of the composite key
    // sits in a DIFFERENT position than on the dump. Reproduced, not tidied —
    // it is a join key and the shapes must stay as the pbix has them.
    `${serviceClass} `,
    `${serviceClass}  ${ndt} ${rtPct}`,
    iso.toUpperCase().endsWith("-PCC") ? "t" : "f",
    tmcpPipePrAll(serviceClass, diaInch) ? "t" : "f",
    "f", "f",                                     // By UT / re-shoot are blank for CCC
    String(n),
  ];
}

function trackRss(stats: Stats): void {
  const mb = Math.round(process.memoryUsage().rss / (1 << 20));
  if (mb > stats.peakRssMb) stats.peakRssMb = mb;
}

/** Excel cells arrive as Date | number | string | rich-text / formula objects. */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown; richText?: { text?: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text ?? "").join("");
    if (o.text !== undefined) return cellText(o.text);
    if (o.result !== undefined) return cellText(o.result);
    return "";
  }
  return String(v);
}

type RowGen = AsyncGenerator<(string | null)[]>;

async function* streamCsv(loadId: number, seq: Map<string, number>, stats: Stats): RowGen {
  let index: Map<string, number> | null = null;
  for await (const line of readDelimited(path.join(process.cwd(), CSV_FILE), {
    delimiter: ",", encoding: "utf-8", width: WIDTH, mode: "pad",
  })) {
    if (line.lineNo === 0) {
      index = new Map(line.fields.map((h, i) => [h.trim(), i]));
      continue;
    }
    if (!index) throw new Error("no header");
    stats.csvLines += 1;
    const g = (h: string): string => {
      const i = index?.get(h);
      return i === undefined ? "" : (line.fields[i] ?? "");
    };
    // R2-16 / calculation-logic.md §1.4: only the UNTESTED rows come from the CSV;
    // the tested ones are superseded by the ACC/REJ workbook.
    if (g("RT/UT Report No.").trim() !== "") {
      stats.csvSkippedTested += 1;
      continue;
    }
    stats.csvKept += 1;
    const row = buildRow(g, loadId, seq, stats);
    if (row) yield row;
    if ((stats.csvLines & 0xfffff) === 0) trackRss(stats);
  }
}

async function* streamXlsx(loadId: number, seq: Map<string, number>, stats: Stats): RowGen {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(path.join(process.cwd(), XLSX_FILE), {
    worksheets: "emit", sharedStrings: "cache", hyperlinks: "ignore", styles: "cache",
    entries: "ignore",
  });
  let header: Map<string, number> | null = null;
  for await (const sheet of reader) {
    for await (const xlsxRow of sheet) {
      const values = xlsxRow.values as unknown[];   // 1-based; index 0 is always empty
      const cells: string[] = [];
      for (let i = 1; i <= WIDTH; i += 1) cells.push(cellText(values[i]));
      if (header === null) {
        header = new Map(cells.map((h, i) => [h.trim(), i]));
        continue;
      }
      if (cells.every((c) => c === "")) continue;
      stats.xlsxRows += 1;
      const g = (h: string): string => {
        const i = header?.get(h);
        return i === undefined ? "" : (cells[i] ?? "");
      };
      const row = buildRow(g, loadId, seq, stats);
      if (row) yield row;
      if ((stats.xlsxRows & 0xffff) === 0) trackRss(stats);
    }
    break; // the workbook has exactly one sheet of interest
  }
}

function report(stats: Stats, t0: number): boolean {
  console.log(`  CSV physical lines    ${fmt(stats.csvLines).padStart(11)}  (expected ${fmt(EXPECTED.csvLines)})`);
  console.log(`  CSV skipped, tested   ${fmt(stats.csvSkippedTested).padStart(11)}  (RT/UT Report No. <> '')`);
  console.log(`  CSV kept, untested    ${fmt(stats.csvKept).padStart(11)}  (expected ${fmt(EXPECTED.csvKept)})`);
  console.log(`  XLSX rows             ${fmt(stats.xlsxRows).padStart(11)}  (expected ${fmt(EXPECTED.xlsxRows)})`);
  console.log(`  union                 ${fmt(stats.csvKept + stats.xlsxRows).padStart(11)}  (expected ${fmt(EXPECTED.total)})`);
  console.log(`  ...minus the M's 4 hard-coded Joint IDs  ${fmt(stats.excludedByM)}`);
  console.log(`  ...minus the RS1 RT B.log step's Joint IDs ${fmt(stats.excludedRs1)}`);
  console.log(`  ...minus welds dated after ${CUTOFF}  ${fmt(stats.afterCutoff)}`);
  console.log(`  rows into weld        ${fmt(stats.written).padStart(11)}`);
  console.log(`  distinct joint_id     ${fmt(stats.distinctJointIds).padStart(11)}`);
  console.log(`  Weld Type normalised  ${fmt(stats.weldTypeChanged).padStart(11)}  (the 17 ordered ReplaceText steps)`);
  const st = [...stats.rtWeldStatus].sort((a, b) => b[1] - a[1]);
  console.log(`  synthesised RT Weld Status  ${st.map(([k, v]) => `${k}=${fmt(v)}`).join(", ")}`);
  const rr = [...stats.repairReweld].sort((a, b) => b[1] - a[1]);
  console.log(`  repair_reweld         ${rr.map(([k, v]) => `${k}=${fmt(v)}`).join(", ")}`);
  const bad = [...stats.dateFailures];
  console.log(`  date-parse failures   ${bad.length === 0 ? "(none)" : bad.map(([c, n]) => `${c}=${fmt(n)}`).join(", ")}`);
  console.log(`  peak RSS              ${stats.peakRssMb} MB`);
  console.log(`  runtime               ${secs(t0)}`);
  const ok = stats.csvLines === EXPECTED.csvLines && stats.csvKept === EXPECTED.csvKept
    && stats.xlsxRows === EXPECTED.xlsxRows
    && stats.csvKept + stats.xlsxRows === EXPECTED.total;
  console.log(`  verdict               ${ok ? "counts MATCH the pbix" : "COUNTS DIFFER FROM THE PBIX"}`);
  return ok;
}

async function dryRun(): Promise<boolean> {
  for (const f of [CSV_FILE, XLSX_FILE]) {
    if (!existsSync(path.join(process.cwd(), f))) throw new Error(`file not found: ${f}`);
  }
  const t0 = Date.now();
  console.log(`\n${SOURCE}`);
  console.log(`  ${CSV_FILE}   (${fmt(statSync(path.join(process.cwd(), CSV_FILE)).size)} bytes)`);
  console.log(`  ${XLSX_FILE}  (${fmt(statSync(path.join(process.cwd(), XLSX_FILE)).size)} bytes)`);
  const stats = newStats();
  const seq = new Map<string, number>();
  for await (const _row of streamCsv(0, seq, stats)) { void _row; stats.written += 1; }
  for await (const _row of streamXlsx(0, seq, stats)) { void _row; stats.written += 1; }
  stats.distinctJointIds = seq.size;
  trackRss(stats);
  return report(stats, t0);
}

async function live(): Promise<void> {
  const csvAbs = path.join(process.cwd(), CSV_FILE);
  const xlsxAbs = path.join(process.cwd(), XLSX_FILE);
  for (const f of [csvAbs, xlsxAbs]) if (!existsSync(f)) throw new Error(`file not found: ${f}`);
  const t0 = Date.now();
  const sha = await sha256File(csvAbs);
  console.log(`${SOURCE}`);
  console.log(`  csv sha256 ${sha}`);

  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  let loadId = -1;
  try {
    await client.query("SET statement_timeout = 0");
    await client.query("SET synchronous_commit = off");

    const pre = await client.query<{ n: string }>("SELECT count(*) AS n FROM ccc_joint_pwht");
    if (Number(pre.rows[0].n) === 0) {
      throw new Error(
        "ccc_joint_pwht is EMPTY. Run scripts/load-ccc-joint-record.ts first — the CCC " +
        "NDE branches are a LEFT JOIN to it, and loading now would write NULLs and look fine.",
      );
    }
    console.log(`  ccc_joint_pwht has ${fmt(Number(pre.rows[0].n))} joints — prerequisite met`);

    const size = statSync(csvAbs).size + statSync(xlsxAbs).size;
    loadId = await openLoad(client, SOURCE, path.basename(csvAbs), size, sha);
    console.log(`  load_id ${loadId}`);

    await client.query("BEGIN");
    await client.query("DELETE FROM weld WHERE source = $1", [SOURCE]);

    const stats = newStats();
    const seq = new Map<string, number>();
    // ONE COPY, pulled lazily by copyRows: the CSV and the workbook are two
    // sources but a single stream, so there is never a second COPY in flight on
    // this connection (see the note on copyRows in scripts/load-common.ts).
    const tCopy = Date.now();
    async function* lines(): AsyncGenerator<string> {
      for await (const row of streamCsv(loadId, seq, stats)) {
        stats.written += 1;
        yield copyLine(row);
      }
      for await (const row of streamXlsx(loadId, seq, stats)) {
        stats.written += 1;
        yield copyLine(row);
      }
      stats.distinctJointIds = seq.size;
    }
    const rows = await copyRows(client, "weld", [...WELD_COLUMNS], lines(), {
      label: "CCC welder record -> weld",
      onProgress: (n, b) =>
        console.log(`  ... ${fmt(n)} rows / ${fmt(b)} bytes / RSS ${stats.peakRssMb} MB`),
    });
    console.log(`  copy    ${fmt(rows)} rows in ${secs(tCopy)}`);

    // One pass for every CCC NDE branch (§5.3 #7) and testpack_no_all (§5.3 #5).
    // weldpoint_seq was computed during the stream, so this is the only UPDATE.
    const tUpd = Date.now();
    const upd = await client.query(`
      UPDATE weld w SET
        testpack_no_all    = jr.test_package_no,
        pwht_y_n_ccc       = jr.pwht_y_n,
        pwht_report_no_ccc = jr.pwht_report_no,
        pwht_date_no_ccc   = jr.pwht_date,
        mt_report_ccc      = jr.mt_root_report_no,
        mt_date_ccc        = jr.mt_root_date,
        mt_pct_ccc         = jr.mt_root_pct,
        pt_report_ccc      = jr.pt_root_report_no,
        pt_date_ccc        = jr.pt_root_date,
        pt_pct_ccc         = jr.pt_root_pct,
        pmi_report_ccc     = jr.pmi_report_no,
        pmi_date_ccc       = jr.pmi_date,
        ht_report_ccc      = jr.ht_report_no,
        ht_date_ccc        = jr.ht_date,
        dwir_ccc_from_jr   = jr.weld_report_no,
        pmi_pct_ccc        = jr.pmi_pct,     -- 0057
        ht_pct_ccc         = jr.ht_pct,
        thickness_from_jr  = jr.wall_thickness,
        rework_code_all    = coalesce(w.rework_code, jr.rework_code)
      FROM ccc_joint_pwht jr
      WHERE w.source = $1 AND jr.joint_id_jr = w.joint_id`, [SOURCE]);
    console.log(`  overlay ${fmt(upd.rowCount ?? 0)} rows joined to ccc_joint_pwht in ${secs(tUpd)}`);
    // CCC's welder record has no UT columns at all; the pbix gets CCC's UT from
    // the Talisman tracker through DAX calculated columns. The tracker is loaded
    // by a different loader, so whichever of the two runs second applies this.
    console.log(`  ${formatUtOverlay(await applyCccUtOverlay(client))}`);
    await client.query("COMMIT");

    report(stats, t0);
    const tPost = Date.now();
    await client.query("VACUUM (ANALYZE) weld");
    const refreshed = await refreshMatviews(client);
    console.log(`  post    VACUUM (ANALYZE) weld + ${formatRefreshes(refreshed)} — ${secs(tPost)} total`);

    await closeLoad(client, loadId, stats.csvLines + stats.xlsxRows, rows, 0, {
      csv_skipped_tested: stats.csvSkippedTested,
      csv_kept: stats.csvKept,
      xlsx_rows: stats.xlsxRows,
      excluded_by_m: stats.excludedByM,
      excluded_rs1_rt_blog: stats.excludedRs1,
      weld_cutoff: CUTOFF,
      after_cutoff: stats.afterCutoff,
      overlay_rows: upd.rowCount ?? 0,
      distinct_joint_ids: stats.distinctJointIds,
      peak_rss_mb: stats.peakRssMb,
      elapsed_s: Number(((Date.now() - t0) / 1000).toFixed(1)),
    });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* connection may be gone */ }
    if (loadId > 0) {
      await client.query("UPDATE load SET finished_at = now(), notes = $2 WHERE id = $1",
        [loadId, JSON.stringify({ status: "failed", error: String(err) })]);
    }
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
  // exit(), not exitCode: a stalled COPY leaves a producer parked on a promise
  // that will never settle, and that handle would otherwise keep the process alive.
  process.exit(1);
});
