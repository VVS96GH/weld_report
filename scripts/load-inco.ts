/**
 * `Inco/Master Weld_Latest.xlsx` -> `weld`, source INCO.
 *
 *   node --import tsx scripts/load-inco.ts --dry-run
 *   node --import tsx scripts/load-inco.ts
 *
 * Sheet `Overall Weld Log Query` (the 4th of 7), 44 columns, 10,327 data rows =
 * the pbix's `Inco Weld Log` exactly. Every date column is a real Excel date cell,
 * so no string parsing is involved — the opposite of Acciona.
 *
 * GRAIN: joint × RT-fragment. 10,327 rows over **7,238** distinct joint_ids
 * (ruling R3-02), so every Inco metric must be `count(DISTINCT joint_id)` — the
 * same rule R2-01 imposed on CCC. `weldpoint_seq` is the per-joint sequence in
 * file order, because `mv_joint`'s WP1 gate is
 * `CASE source WHEN 'WELD_DUMP' THEN weldpoint_no = 1 ELSE weldpoint_seq = 1 END`
 * and a NULL there would silently drop Inco from M23/M24/M33.
 *
 * INCO IS LOADED, NOT FILTERED (R3-01). The default exclusion lives in the query
 * layer — `sub_contractor <> 'INCO'` in every project-scope metric, which is where
 * the pbix puts its 69 filters. `[Total Scope Dia "BW" "PR all"]` includes Inco
 * explicitly, so a loader-level exclusion would make that measure wrong.
 */

import { statSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import {
  closeLoad, copyLine, copyRows, fmt, formatRefreshes, num, openLoad, refreshMatviews,
  requireEnvUrl, secs, sha256File, txt,
} from "./load-common";
import { headerIndex, streamSheet } from "./lib/xlsx-stream";
import { INCO_WELD_COLUMNS as WELD_COLUMNS } from "./load-columns";

const FILE = "sources/Inco/Master Weld_Latest.xlsx";
const SHEET = "Overall Weld Log Query";
const WIDTH = 44;
const SOURCE = "INCO";
const EXPECTED = { rows: 10_327, joints: 7_238 };


interface Stats {
  rows: number;
  headerWidth: number;
  distinctJointIds: number;
  maxSeq: number;
  weldTypes: Map<string, number>;
  rtAccRej: Map<string, number>;
  paut: number;
  manualUtAll: number;
  filmMismatch: number;
}

function newStats(): Stats {
  return {
    rows: 0, headerWidth: 0, distinctJointIds: 0, maxSeq: 0,
    weldTypes: new Map(), rtAccRej: new Map(), paut: 0, manualUtAll: 0, filmMismatch: 0,
  };
}

const bump = (m: Map<string, number>, k: string): void => { m.set(k, (m.get(k) ?? 0) + 1); };

/**
 * The M's nine `RT STATUC` replacements, IN ORDER. Every one is a no-op on the
 * delivered file (the raw values are already A / R / RS), but the order matters if
 * a future refresh reintroduces the old vocabulary: `GRS-A` must be rewritten
 * before `RS-A`, and `ACC` before `RECT` — the M has both right.
 */
function normaliseRtAccRej(v: string): string {
  return v
    .replace(/ACC /g, "ACC").replace(/A /g, "A").replace(/ACC/g, "A")
    .replace(/REJ/g, "R").replace(/GRS-A/g, "A").replace(/RS-A/g, "RS")
    .replace(/RESHOOT/g, "RS").replace(/R\/S/g, "RS").replace(/RECT/g, "R")
    .trim();
}

/** `BUTT` -> BW, `FILLET`/`Fillet` -> FW. No-ops today; reproduced. */
function normaliseWeldType(v: string): string {
  return v.replace(/BUTT/g, "BW").replace(/FILLET/g, "FW").replace(/Fillet/g, "FW").trim();
}

async function* rows(
  loadId: number,
  stats: Stats,
  seq: Map<string, number>,
): AsyncGenerator<(string | null)[]> {
  let idx: Map<string, number> | null = null;
  for await (const row of streamSheet(path.join(process.cwd(), FILE), SHEET, WIDTH)) {
    if (row.rowNo === 0) {
      idx = headerIndex(row.cells);
      stats.headerWidth = row.cells.length;
      for (const need of ["Tank No", "Joint No", "Date2", "RT/UT Report", "Remarks"]) {
        if (!idx.has(need)) throw new Error(`${SHEET} is missing column ${JSON.stringify(need)}`);
      }
      continue;
    }
    if (!idx) throw new Error("no header");
    stats.rows += 1;
    const g = (h: string): string => {
      const i = idx?.get(h);
      return i === undefined ? "" : (row.cells[i] ?? "");
    };

    const iso = g("Tank No").trim();
    const weldNo = g("Joint No").trim();
    // `Spool No.` is the literal "-" for every Inco row, so joint_id carries three
    // consecutive hyphens — `65-T9405-A---H1`. That is the Inco signature, and it
    // is what the pbix stores; the workbook's own `joint with tank` key is discarded.
    const spoolNo = "-";
    const jointId = `${iso}-${spoolNo}-${weldNo}`;
    if (jointId === "blank") continue;   // the M's `Filtered Rows4`

    const n = (seq.get(jointId) ?? 0) + 1;
    seq.set(jointId, n);
    if (n > stats.maxSeq) stats.maxSeq = n;

    const weldType = normaliseWeldType(g("Type of Weld"));
    bump(stats.weldTypes, weldType === "" ? "(blank)" : weldType);
    const rtAcc = normaliseRtAccRej(g("RT STATUC"));
    bump(stats.rtAccRej, rtAcc === "" ? "(blank)" : rtAcc);

    const films = num(g("No. of RT Films shoot"));
    // `if [RT Acc/Rej]="R" then [RT Film Total] else 0` and the "A" twin. Note the
    // M writes the string "0" for the Acc branch, which the union then types as a
    // number — same result, reproduced as a number here.
    const filmsRej = rtAcc === "R" ? (films ?? "0") : "0";
    const filmsAcc = rtAcc === "A" ? (films ?? "0") : "0";
    if (films !== null && Number(films) !== Number(filmsAcc) + Number(filmsRej)) {
      stats.filmMismatch += 1;
    }

    // The M fabricates a whole UT block out of one free-text remark: there is no
    // UT tracker for Inco. `PAUT` in Remarks turns the RT shot into a UT one —
    // WITHOUT clearing the RT columns, so those 441 rows count as both.
    const htRemarks = g("Remarks").trim();
    const isPaut = htRemarks === "PAUT";
    if (isPaut) stats.paut += 1;
    const rtReport = g("RT/UT Report").trim().replace(/#N\/A/g, "");
    const rtDate = txt(g("RT/UT Date"));
    const utReport = isPaut ? rtReport : "";
    const utAcc = isPaut
      ? rtAcc.replace(/ACC/g, "A").replace(/REJ/g, "R").replace(/RECT/g, "R")
      : "";
    // The DAX's Inco branch of [Manual UT Report No.] coalesces `UT Report`, so the
    // overlay column must carry it or Inco drops out of the manual-UT metrics.
    const manualUtAll = isPaut && utReport !== "" ? utReport : null;
    if (manualUtAll !== null) stats.manualUtAll += 1;

    // `PT/MT Report` and `PT/MT Date` each feed TWO targets: the M duplicates the
    // column, so MT and PT carry identical values for every Inco row.
    const ptMtReport = txt(g("PT/MT Report"));
    const ptMtDate = txt(g("PT/MT Date"));

    yield [
      SOURCE, String(loadId), jointId,
      spoolNo,                              // spool_id is the literal "-": Inco never joins `spool`
      txt(iso), txt(spoolNo), txt(weldNo),
      "F",                                  // weld_cat: constant for every Inco row
      weldType === "" ? null : weldType,
      txt(g("Material")), num(g("Thick")),
      num(g("Length (MM)")),                // MILLIMETRES in a column the dump fills with metres
      txt(g("WPS")), txt(g("Welder ID.")),
      g("Welder ID.").trim() === "" ? null : `${g("Welder ID.").trim()}-${SOURCE}`,
      SOURCE,                               // canonical upper case (R2-08)
      "Inco",                               // original_joint: the M puts the party name here
      "1", String(n),                       // weldpoint_no constant; weldpoint_seq per joint
      txt(g("Date")), txt(g("Date2")),
      rtReport === "" ? null : rtReport, rtDate,
      rtAcc === "" ? null : rtAcc,
      num(g("RT LENGTH (MM)")),             // the INSPECTED length, filed under rej_length by the M
      filmsAcc, filmsRej, txt(g("Type of Repair")),
      ptMtReport, ptMtDate, ptMtReport === null ? null : "NR",
      ptMtReport, ptMtDate,
      txt(g("PWHT Report")), txt(g("PWHT Date")),   // both 100% empty
      txt(g("HT Report")), txt(g("HT Date")),
      htRemarks === "" ? null : htRemarks,
      isPaut ? "t" : "f",                   // by_ut
      isPaut ? "PAUT" : null,               // ut_remarks
      utReport === "" ? null : utReport,
      isPaut ? rtDate : null,
      utAcc === "" ? null : utAcc,
      manualUtAll,
      "",                                   // repair_reweld: the DAX hard-excludes Inco
      " ", "   ",                           // service_class / Service Cat / NDT all blank
      iso.toUpperCase().endsWith("-PCC") ? "t" : "f",
      "f",
      "f",                                  // exclude_ut_films: the DAX excludes Inco
      "f",
    ];
  }
  stats.distinctJointIds = seq.size;
}

function report(stats: Stats, t0: number): boolean {
  console.log(`  sheet columns         ${String(stats.headerWidth).padStart(11)}  (expected ${WIDTH})`);
  console.log(`  data rows             ${fmt(stats.rows).padStart(11)}  (expected ${fmt(EXPECTED.rows)})`);
  console.log(`  distinct joint_id     ${fmt(stats.distinctJointIds).padStart(11)}  (expected ${fmt(EXPECTED.joints)})`);
  console.log(`  max weldpoint_seq     ${String(stats.maxSeq).padStart(11)}  (the RT-fragment explosion depth)`);
  console.log(`  weld_type             ${[...stats.weldTypes].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${fmt(v)}`).join(", ")}`);
  console.log(`  rt_acc_rej            ${[...stats.rtAccRej].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${fmt(v)}`).join(", ")}`);
  console.log(`  PAUT rows             ${String(stats.paut).padStart(11)}  -> by_ut / ut_* fabricated from Remarks`);
  console.log(`  manual_ut_report_no_all ${String(stats.manualUtAll).padStart(9)}  (the DAX's Inco branch)`);
  console.log(`  films acc+rej <> source ${String(stats.filmMismatch).padStart(9)}  (rt_film_total is GENERATED acc+rej)`);
  console.log(`  runtime               ${secs(t0)}`);
  const ok = stats.rows === EXPECTED.rows && stats.headerWidth === WIDTH
    && stats.distinctJointIds === EXPECTED.joints;
  console.log(`  verdict               ${ok ? "counts MATCH the pbix" : "COUNTS DIFFER FROM THE PBIX"}`);
  return ok;
}

async function main(): Promise<void> {
  const abs = path.join(process.cwd(), FILE);
  if (!existsSync(abs)) throw new Error(`file not found: ${abs}`);
  const t0 = Date.now();
  console.log(`${SOURCE}  ${FILE}  (${fmt(statSync(abs).size)} bytes)`);
  const stats = newStats();
  const seq = new Map<string, number>();

  if (process.argv.includes("--dry-run")) {
    for await (const r of rows(0, stats, seq)) void r;
    if (!report(stats, t0)) process.exitCode = 1;
    console.log(`  weld columns written  ${String(WELD_COLUMNS.length).padStart(11)}`);
    return;
  }

  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  let loadId = -1;
  try {
    await client.query("SET statement_timeout = 0");
    await client.query("SET synchronous_commit = off");
    loadId = await openLoad(client, SOURCE, path.basename(abs), statSync(abs).size,
      await sha256File(abs));
    console.log(`  load_id ${loadId}`);

    await client.query("BEGIN");
    await client.query("DELETE FROM weld WHERE source = $1", [SOURCE]);
    async function* lines(): AsyncGenerator<string> {
      for await (const r of rows(loadId, stats, seq)) yield copyLine(r);
    }
    const n = await copyRows(client, "weld", [...WELD_COLUMNS], lines(), { label: SOURCE });
    await client.query("COMMIT");
    console.log(`  copy    ${fmt(n)} rows`);
    report(stats, t0);

    const tPost = Date.now();
    await client.query("VACUUM (ANALYZE) weld");
    const refreshed = await refreshMatviews(client);
    console.log(`  post    VACUUM + ${formatRefreshes(refreshed)} — ${secs(tPost)} total`);

    await closeLoad(client, loadId, stats.rows, n, 0, {
      distinct_joint_ids: stats.distinctJointIds,
      max_weldpoint_seq: stats.maxSeq,
      paut_rows: stats.paut,
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

main().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
