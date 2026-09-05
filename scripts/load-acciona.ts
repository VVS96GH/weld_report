/**
 * `Acciona/Acciona_Latest Add to Query.xlsx` -> `weld`, source ACCIONA.
 *
 *   node --import tsx scripts/load-acciona.ts --dry-run
 *   node --import tsx scripts/load-acciona.ts
 *
 * The M reads a named Excel Table, not a sheet:
 *   `Source{[Item="Acciona_Query",Kind="Table"]}[Data]`
 * `Acciona_Query` sits on sheet `ICS Quary` at range A1:BA13314 with
 * headerRowCount=1, so the table IS the sheet's first 53 columns starting at row 1
 * — no ListObject API needed, and no `Table.PromoteHeaders` step exists because a
 * Table already has its own header. 13,313 data rows = the pbix exactly.
 *
 * Only `Acciona_Latest Add to Query.xlsx` contains this table; the six other
 * Acciona workbooks have no named Table and no `ICS Quary` sheet, so the M would
 * fail against them (R3-14). `Acciona Joint Summary` is NOT loaded (R3-05):
 * hand-typed, header dated 22-02-2024, `Total No. of Joints` = 0 on every row.
 *
 * Acciona contributes to the RT / PMI / PT metrics and to the welded-joint counts,
 * and to nothing else: PWHT, HT, UT, MT, weld length and spool status are all
 * blank BY SOURCE (the M adds them as ""), not blank by data.
 */

import { statSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import {
  closeLoad, copyLine, copyRows, fmt, formatRefreshes, num, openLoad, refreshMatviews,
  requireEnvUrl, secs, sha256File, txt,
} from "./load-common";
import { headerIndex, parseDmy, streamSheet } from "./lib/xlsx-stream";
import { ACCIONA_WELD_COLUMNS as WELD_COLUMNS } from "./load-columns";

const FILE = "sources/Acciona/Acciona_Latest Add to Query.xlsx";
const SHEET = "ICS Quary";
const WIDTH = 53;
const SOURCE = "ACCIONA";
const EXPECTED_ROWS = 13_313;


interface Stats {
  rows: number;
  headerWidth: number;
  rtDateUnparsed: { rowNo: number; raw: string }[];
  pmiDateUnparsed: number;
  ptDateUnparsed: number;
  rtWeldStatus: Map<string, number>;
  pmiAccRej: Map<string, number>;
  tier: Map<string, number>;
  filmTotalMismatch: number;
  distinctJointIds: number;
}

function newStats(): Stats {
  return {
    rows: 0, headerWidth: 0, rtDateUnparsed: [], pmiDateUnparsed: 0, ptDateUnparsed: 0,
    rtWeldStatus: new Map(), pmiAccRej: new Map(), tier: new Map(),
    filmTotalMismatch: 0, distinctJointIds: 0,
  };
}

const bump = (m: Map<string, number>, k: string): void => { m.set(k, (m.get(k) ?? 0) + 1); };

/**
 * `RT Report No. & Date` -> up to four fields.
 * The M splits on `&` into three parts, then splits part 3 again, then parses the
 * date POSITIONALLY: `SplitTextByPositions({0,23})` keep part 1, then
 * `SplitTextByPositions({0,11})` keep part 1. So only the first 11 characters of
 * the date fragment survive — a `dd-mm-yyyy` prefix and nothing after it.
 */
function splitRtReport(v: string): {
  report: string; date: string; reshootData: string; reshootRep: string;
} {
  const parts = v.split("&");
  const report = (parts[0] ?? "").trim();
  const datePart = (parts[1] ?? "").replace(/\s+/g, "").slice(0, 11);
  const third = (parts[2] ?? "").trim();
  // The M splits the third fragment again: report first, date second.
  const thirdParts = third.split(/\s+/);
  return {
    report,
    date: datePart,
    reshootRep: (thirdParts[0] ?? "").trim(),
    reshootData: (thirdParts.slice(1).join(" ")).replace(/\s+/g, "").slice(0, 11),
  };
}

/** `<report> & <dd-mm-yyyy>`, the PMI/PT shape. Newlines are common before the date. */
function splitReportDate(v: string): { report: string; date: string } {
  const i = v.indexOf("&");
  if (i < 0) return { report: v.trim(), date: "" };
  return { report: v.slice(0, i).trim(), date: v.slice(i + 1).trim() };
}

async function* rows(
  loadId: number,
  stats: Stats,
  jointIds: Set<string>,
): AsyncGenerator<(string | null)[]> {
  let idx: Map<string, number> | null = null;
  for await (const row of streamSheet(path.join(process.cwd(), FILE), SHEET, WIDTH)) {
    if (row.rowNo === 0) {
      idx = headerIndex(row.cells);
      stats.headerWidth = row.cells.length;
      // The source name really does carry ten spaces.
      for (const need of ["ISO Number", "Weld No.", "Dia          (Ø)", "WELDING DATE", "Column12"]) {
        if (!idx.has(need)) {
          throw new Error(`${SHEET} is missing column ${JSON.stringify(need)}`);
        }
      }
      continue;
    }
    if (!idx) throw new Error("no header");
    stats.rows += 1;
    const g = (h: string): string => {
      const i = idx?.get(h);
      return i === undefined ? "" : (row.cells[i] ?? "");
    };

    const iso = g("ISO Number").trim();
    // `Replaced Value11`: null -> '-_-' BEFORE Spool ID / Joint ID. Never fires today.
    const spoolNo = g("Spool No.").trim() === "" ? "-_-" : g("Spool No.").trim();
    const weldNo = g("Weld No.").trim();
    const jointId = `${iso}-${spoolNo}-${weldNo}`;
    const spoolId = `${iso}-${spoolNo}`;
    jointIds.add(jointId);

    // `Field` -> F, `Shop` -> S, `shop` -> S (no-ops on this file, reproduced).
    const weldCatRaw = g("Weld Cat").trim();
    const weldCat = weldCatRaw === "Field" ? "F"
      : (weldCatRaw === "Shop" || weldCatRaw === "shop") ? "S" : weldCatRaw;

    const weldType = g("Weld Type").trim();
    // Only `BW` — CCC's rule is BW or CLET, the dump's is sourced. Three rules, one column.
    const diaFactor = weldType === "BW";

    // `Text.BetweenDelimiters(Line No., "(", ")")`, then Line No. is dropped.
    const lineNo = g("Line No.");
    const open = lineNo.indexOf("(");
    const close = open < 0 ? -1 : lineNo.indexOf(")", open + 1);
    const serviceClass = open >= 0 && close > open ? lineNo.slice(open + 1, close) : "";

    // `0.05` -> 5, `1` -> 100 (no-ops today; a future refresh may re-introduce them).
    const rtPctRaw = g("RT Status %").trim();
    const rtPct = rtPctRaw === "0.05" ? "5" : rtPctRaw === "1" ? "100" : rtPctRaw;

    const rt = splitRtReport(g("RT Report No. & Date"));
    const rtDate = parseDmy(rt.date);
    if (rtDate === null && rt.date !== "") {
      // The M's RemoveRowsWithErrors would DROP such a row silently. We log it.
      stats.rtDateUnparsed.push({ rowNo: row.rowNo, raw: rt.date });
    }
    const pmi = splitReportDate(g("PMI Report No. & Date"));
    const pmiDate = parseDmy(pmi.date);
    if (pmiDate === null && pmi.date !== "") stats.pmiDateUnparsed += 1;
    const pt = splitReportDate(g("PT Report No. & Date"));
    const ptDate = parseDmy(pt.date);
    if (ptDate === null && pt.date !== "") stats.ptDateUnparsed += 1;

    // `Accepted` -> `A` is a case-SENSITIVE ReplaceText, so the 26 `ACCEPTED`
    // rows survive unchanged in the model. Reproduced literally.
    const pmiAcc = g("PMI Acc/Rej").trim().replace(/Accepted/g, "A");
    bump(stats.pmiAccRej, pmiAcc === "" ? "(blank)" : pmiAcc);
    const ptAcc = g("PT Acc/Rej").trim().replace(/Accepted/g, "A");
    const rtAcc = g("RT Acc/Rej").trim()
      .replace(/Accepted/g, "A").replace(/Repair/g, "R")
      .replace(/Reshoot \/ A/g, "RS").replace(/\(QG sign\. pending\)/g, "")
      .replace(/U\/review/g, "U/Review");

    // `Rejected Films` is REPLACED by
    //   `if [RT Acc/Rej] = "R" then [Total No of films Rej] else 0`
    const filmsAcc = num(g("Accepted Films")) ?? "0";
    const filmsRejRaw = num(g("Rejected Films")) ?? "0";
    const filmsRej = rtAcc === "R" ? filmsRejRaw : "0";
    const filmsTotalSrc = num(g("Total Films"));
    if (filmsTotalSrc !== null
      && Number(filmsTotalSrc) !== Number(filmsAcc) + Number(filmsRej)) {
      stats.filmTotalMismatch += 1;
    }

    const weldDate = txt(g("WELDING DATE"));
    // The M's own 4-branch synthesis. Branch 1 is dead (Weld Date is never null)
    // and branch 2 tests `RT Report = null` on a column that holds "" — both
    // reproduced literally, and flagged in db/README.md.
    let rtWeldStatus: string;
    if (weldDate === null && rtPct === "100") rtWeldStatus = "S";
    else if (weldDate !== null && rtPct === "100" && rt.report === "") rtWeldStatus = "HS";
    else if (weldDate !== null && rt.report !== "") rtWeldStatus = "";
    else rtWeldStatus = "S";
    bump(stats.rtWeldStatus, rtWeldStatus === "" ? "(blank)" : rtWeldStatus);

    const tier = txt(g("Column12"));
    bump(stats.tier, tier ?? "(blank)");

    const welder = g("Welder").trim();   // `Trimmed Text1`, the query's last step

    yield [
      SOURCE, String(loadId), jointId, spoolId,
      txt(iso), txt(g("Iso Rev No.")), txt(spoolNo), txt(weldNo),
      num(g("Dia          (Ø)")), diaFactor ? "t" : "f",
      num(g("Thickness")), txt(g("Material Type")), txt(g("WPS No.")),
      weldType === "" ? null : weldType,
      welder === "" ? null : welder,
      welder === "" ? null : `${welder}-${SOURCE}`,
      txt(g("DWR")), weldCat === "" ? null : weldCat,
      txt(iso.slice(0, 7)), serviceClass === "" ? null : serviceClass,
      SOURCE,                              // canonical upper case (R2-08)
      tier,                                // R3-04
      "Acciona",                           // original_joint: the M puts the party name here
      "1", "1",                            // weldpoint_no / weldpoint_seq: one row per joint
      parseDmy(g("FITUP DATE")) ?? txt(g("FITUP DATE")),
      parseDmy(g("WELDING DATE")) ?? txt(g("WELDING DATE")),
      txt(pmi.report), pmiDate, pmiAcc === "" ? null : pmiAcc,
      txt(pt.report), ptDate, ptAcc === "" ? null : ptAcc,
      txt(rt.report), rtDate, rtAcc === "" ? null : rtAcc,
      num(rtPct), txt(g("Remark")),
      rtWeldStatus === "" ? null : rtWeldStatus,
      txt(rt.reshootRep), parseDmy(rt.reshootData),
      filmsAcc, filmsRej,
      txt(g("Tracer 1")),                  // the M's mis-rename; holds `FJ-49`, not `T`
      txt(g("PR")),                        // `PR to Testpack No`; 100% blank today
      "",                                  // repair_reweld: always '' for Acciona
      `${serviceClass} `,
      `${serviceClass}   ${rtPct}`,        // Service Cat AND NDT Remarks are blank
      iso.toUpperCase().endsWith("-PCC") ? "t" : "f",
      "f", "f", "f",
    ];
  }
  stats.distinctJointIds = jointIds.size;
}

function report(stats: Stats, t0: number): boolean {
  console.log(`  table columns         ${String(stats.headerWidth).padStart(11)}  (expected ${WIDTH})`);
  console.log(`  data rows             ${fmt(stats.rows).padStart(11)}  (expected ${fmt(EXPECTED_ROWS)})`);
  console.log(`  distinct joint_id     ${fmt(stats.distinctJointIds).padStart(11)}  (one row per joint)`);
  console.log(`  RT Weld Status        ${[...stats.rtWeldStatus].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${fmt(v)}`).join(", ")}`);
  console.log(`  PMI Acc/Rej           ${[...stats.pmiAccRej].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${fmt(v)}`).join(", ")}`);
  console.log(`  sub_contractor_tier   ${[...stats.tier].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${fmt(v)}`).join(", ")}`);
  console.log(`  RT date unparsed      ${String(stats.rtDateUnparsed.length).padStart(11)}  (the M would DROP these rows; we keep and log them)`);
  for (const r of stats.rtDateUnparsed.slice(0, 5)) {
    console.log(`    row ${r.rowNo}: ${JSON.stringify(r.raw)}`);
  }
  console.log(`  PMI/PT date unparsed  ${String(stats.pmiDateUnparsed).padStart(11)} / ${stats.ptDateUnparsed}`);
  console.log(`  films acc+rej <> Total Films  ${String(stats.filmTotalMismatch).padStart(6)}  (rt_film_total is GENERATED acc+rej)`);
  console.log(`  runtime               ${secs(t0)}`);
  const ok = stats.rows === EXPECTED_ROWS && stats.headerWidth === WIDTH;
  console.log(`  verdict               ${ok ? "counts MATCH the pbix" : "COUNTS DIFFER FROM THE PBIX"}`);
  return ok;
}

async function main(): Promise<void> {
  const abs = path.join(process.cwd(), FILE);
  if (!existsSync(abs)) throw new Error(`file not found: ${abs}`);
  const t0 = Date.now();
  console.log(`${SOURCE}  ${FILE}  (${fmt(statSync(abs).size)} bytes)`);
  const stats = newStats();
  const jointIds = new Set<string>();

  if (process.argv.includes("--dry-run")) {
    for await (const r of rows(0, stats, jointIds)) void r;
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
      for await (const r of rows(loadId, stats, jointIds)) yield copyLine(r);
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
      rt_date_unparsed: stats.rtDateUnparsed.length,
      film_total_mismatch: stats.filmTotalMismatch,
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
