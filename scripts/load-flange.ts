/**
 * The flange register: `Flange Progress.xlsx` + `ovAssets_1619.xlsx` -> `flange`.
 *
 *   node --import tsx scripts/load-flange.ts --dry-run
 *   node --import tsx scripts/load-flange.ts
 *   node --import tsx scripts/load-flange.ts --only OVASSETS_1619
 *
 * The pbix's `Flange Progress` is `Table.Combine({…})` — an APPEND, not a join.
 * The two files share ZERO joint ids, so `source` partitions the table cleanly:
 * 136,741 GAC/TEKFEN/MEDGULF rows and 226,504 CCC rows = 363,245, the pbix count
 * exactly.
 *
 * Two shapes, one vocabulary:
 *
 *  - `Flange Progress.xlsx` / `FlangeJointProgress` — the M does `Table.Skip(5)`
 *    then `PromoteHeaders`. This loader DETECTS the header row instead of counting
 *    five, because the streaming reader drops all-blank rows and a blank line
 *    inside the preamble would silently shift a positional skip by one. It looks
 *    for the row that carries both `Iso Number` and `BT No.`, and reports which
 *    row that was so a layout change is visible.
 *  - `ovAssets_1619.xlsx` / `Exported from SC` — headers on row 1, but several
 *    carry EMBEDDED NEWLINES (`PCC Remarks -\n Field045 (Custom)`), so every
 *    header is whitespace-collapsed before matching.
 *
 * Dates are TEXT in both, in FOUR shapes. Three — `15-Feb-2026`, `2025/10/28`,
 * `2026/8/20` — `weld_to_date()` v3 already accepts, so the loader parses them with
 * the same `parseDate()` and the SQL and JS agree. The fourth, `m/d/yyyy` with an
 * optional time, is ovAssets-only and handled by `parseOvDate()` below; see its
 * comment for why month-first is measured rather than assumed.
 *
 * RF-05: the dirty rows the M does NOT filter (one `TBD` sub-contractor, one
 * 2027-02 joint date) are KEPT and counted in the ledger notes. RF-09: no
 * materialised view.
 */

import { statSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import {
  closeLoad, copyLine, copyRows, fmt, num, openLoad, parseDate, requireEnvUrl, secs,
  sha256File, txt,
} from "./load-common";
import { streamSheet } from "./lib/xlsx-stream";
import { FLANGE_COLUMNS } from "./load-columns";

const FP_FILE = "sources/Flange Progress.xlsx";
const FP_SHEET = "FlangeJointProgress";
const FP_WIDTH = 54;
const OV_FILE = "sources/ovAssets_1619.xlsx";
const OV_SHEET = "Exported from SC";
const OV_WIDTH = 46;

const EXPECTED = {
  FLANGE_PROGRESS: { sheetRows: 136_742, kept: 136_741 },
  OVASSETS_1619: { sheetRows: 226_504, kept: 226_504 },
};

/** Collapse every whitespace run to one space: the ovAssets headers have newlines. */
function normHeader(h: string): string {
  return h.replace(/\s+/g, " ").trim();
}

export type FlangeSource = "FLANGE_PROGRESS" | "OVASSETS_1619";

interface Stats {
  source: FlangeSource;
  sheetRows: number;
  kept: number;
  headerRow: number;
  headerWidth: number;
  dropped: Map<string, number>;
  methods: Map<string, number>;
  ha: Map<string, number>;
  subcon: Map<string, number>;
  dateTypoFixes: number;
  dirtySubcontractor: number;
  usDateValues: number;
  dateUnparsed: Map<string, number>;
  dirtyFutureJointDate: number;
  jointIds: Set<string>;
}

function newStats(source: FlangeSource): Stats {
  return {
    source, sheetRows: 0, kept: 0, headerRow: -1, headerWidth: 0,
    dropped: new Map(), methods: new Map(), ha: new Map(), subcon: new Map(),
    dateTypoFixes: 0, dirtySubcontractor: 0, dirtyFutureJointDate: 0, jointIds: new Set(),
    usDateValues: 0, dateUnparsed: new Map(),
  };
}

const bump = (m: Map<string, number>, k: string): void => { m.set(k, (m.get(k) ?? 0) + 1); };

/**
 * `Joint Method`, the M's replacements IN ORDER. `Replacer.ReplaceText` is a
 * SUBSTRING replace, so order decides: `Manual Torquing -> Manual` must run before
 * anything that rewrites a bare `Torquing`, and it does.
 */
function normaliseMethod(v: string): string {
  const s = v
    .replace(/Tensionning/g, "Tensioning")
    .replace(/Manual Torquing/g, "Manual")
    .replace(/Hydraulic Torquing/g, "Torquing")
    .replace(/Torquing Critical/g, "Torquing")
    .trim();
  return s === "" ? "TBN" : s;
}

/**
 * The DAX `HA` column, primary branch: `MID([System], 2, 1)` -> HA1..HA4.
 * The fallback is `LOOKUPVALUE('HA l0_abs_guide'…)`. That workbook is now in
 * `sources/` and loaded into `ref_ha_guide`, but the lookup keys on PDS Area,
 * not on System, so it is applied as a post-load UPDATE below rather than here.
 * A row this function cannot resolve gets NULL, and stays NULL if the guide has
 * no PDS Area for it either — never a guessed HA (RF-03).
 */
function haFromSystem(system: string): string | null {
  const s = system.trim();
  if (s === "" || s === "System-NA - Not Applicable") return null;
  const d = s.charAt(1);
  return d >= "1" && d <= "4" ? `HA${d}` : null;
}

/**
 * The CCC side's HA, from ovAssets `Process Plant`
 * (`HA1 - Handover Area 1 (PHA-01…)` -> `HA1`). RF-03: measured to agree with the
 * DAX rule on 226,438 of 226,504 rows with ZERO disagreements. `HA-NA - Not
 * Applicable` resolves to NULL, not to a bucket.
 */
function haFromProcessPlant(pp: string): string | null {
  const m = /^HA([1-4])\b/.exec(pp.trim());
  return m ? `HA${m[1]}` : null;
}

/**
 * ovAssets dates, all four shapes.
 *
 * The M strips `'`, `" 12:00:00 AM"` and `" 0:00"` from `Tightening Date` before
 * typing it. Measured, that is not enough and it is not only that column: 282 PCC
 * dates and 155 tightening dates survive as **`m/d/yyyy 12:00:00 AM`** — a US
 * month-first export that neither `weld_to_date()` nor `parseDate()` accepts.
 * Leaving them NULL cost 282 joints on the PCC measure and wrongly added 144 to
 * Const-n, because Const-n keys on `pcc_tightening_date IS NULL`.
 *
 * MONTH-first is not a guess, it is measured: across those values the first
 * component never exceeds 8 and the second reaches 30, so the first can never be
 * a day. (Ruling R3-03's discipline still holds — this stays in the flange
 * loader; the shared `weld_to_date()` is NOT widened with an ambiguous format.)
 */
function parseOvDate(v: string, col: string, stats: Stats): string | null {
  const raw = v.trim();
  if (raw === "") return null;
  const cleaned = raw
    .replace(/'/g, "")
    .replace(/ 12:00:00 AM$/, "")
    .replace(/ 0:00$/, "")
    .replace(/ \d{1,2}:\d{2}(:\d{2})?( ?[AP]M)?$/i, "")
    .trim();
  const iso = parseDate(cleaned);
  if (iso !== null) return iso;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cleaned);
  if (m) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      stats.usDateValues += 1;
      return `${m[3]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  bump(stats.dateUnparsed, `${col}=${JSON.stringify(raw).slice(0, 30)}`);
  return null;
}

/** The four hand-patched `-Oct-0024` typos the M repairs on [Joint Date]. */
function fixJointDateTypo(v: string, stats: Stats): string {
  if (v.includes("-0024")) {
    stats.dateTypoFixes += 1;
    return v.replace(/-0024/g, "-2024");
  }
  return v;
}

async function* rowsFor(
  source: FlangeSource,
  loadId: number,
  stats: Stats,
): AsyncGenerator<(string | null)[]> {
  const file = source === "FLANGE_PROGRESS" ? FP_FILE : OV_FILE;
  const sheet = source === "FLANGE_PROGRESS" ? FP_SHEET : OV_SHEET;
  const width = source === "FLANGE_PROGRESS" ? FP_WIDTH : OV_WIDTH;
  let idx: Map<string, number> | null = null;

  for await (const row of streamSheet(path.join(process.cwd(), file), sheet, width)) {
    if (idx === null) {
      // Header DETECTION, not Table.Skip(5): see the module comment.
      const cells = row.cells.map(normHeader);
      const probe = source === "FLANGE_PROGRESS"
        ? ["Iso Number", "BT No."]
        : ["FlangeJointName", "Process Plant"];
      if (!probe.every((p) => cells.includes(p))) continue;
      idx = new Map();
      cells.forEach((h, i) => { if (h !== "" && !idx?.has(h)) idx?.set(h, i); });
      stats.headerRow = row.rowNo;
      stats.headerWidth = cells.filter((c) => c !== "").length;
      continue;
    }
    stats.sheetRows += 1;
    const g = (h: string): string => {
      const i = idx?.get(h);
      return i === undefined ? "" : (row.cells[i] ?? "");
    };

    let out: (string | null)[];

    if (source === "FLANGE_PROGRESS") {
      const iso = g("Iso Number").trim();
      // The M's three SelectRows, in its order.
      if (iso === "0" || iso === "1M03") { bump(stats.dropped, "iso_number_0_or_1M03"); continue; }
      const subcon = g("Flange Subcontractor").trim();
      if (subcon === "ACCIONA") { bump(stats.dropped, "sub_contractor_ACCIONA"); continue; }
      const jointDateRaw = fixJointDateTypo(g("Joint Date"), stats);
      const jointDate = parseDate(jointDateRaw);
      if (jointDate === "2026-11-20") { bump(stats.dropped, "joint_date_2026_11_20"); continue; }

      stats.kept += 1;
      const btNo = g("BT No.").trim();
      const jointId = `${iso}-${btNo}`;
      stats.jointIds.add(jointId);
      const method = normaliseMethod(g("Joint Method"));
      bump(stats.methods, method);
      const system = g("System");
      const ha = haFromSystem(system);
      bump(stats.ha, ha ?? "(blank)");
      bump(stats.subcon, subcon === "" ? "(blank)" : subcon);
      if (subcon === "TBD") stats.dirtySubcontractor += 1;
      if (jointDate !== null && jointDate >= "2027-01-01") stats.dirtyFutureJointDate += 1;
      // `AC` -> `A` then `ACC` -> `A`, the M's order. Substring replacement, so on
      // "ACC" the first step already yields "AC" and the second cannot match —
      // reproduced literally; no mockup measure reads this column.
      const accRej = g("ACC/REJ").replace(/AC/g, "A").replace(/ACC/g, "A").trim();

      out = [
        String(loadId), source, jointId,
        txt(iso), txt(btNo), txt(g("Rev No.")), txt(g("Sheet No.")), txt(g("Joint Point")),
        txt(g("Test Pack")), txt(system), txt(g("SubSystem")),
        txt(iso.split("-")[0]),                       // PDS Area = Text.BeforeDelimiter(iso,"-")
        null, null,                                   // process_plant / process_area: ovAssets only
        ha, txt(subcon), txt(g("Commissioning Package")), null,
        txt(g("Diam")), txt(g("Rating")), txt(g("Service Class")), null,
        txt(g("Bolt Size")), txt(g("Bolt Qty")), txt(g("Bolt Length")), txt(g("Bolt Ident")),
        txt(g("Bolt Desc.")), txt(g("Gasket Desc.")), null,
        txt(g("Lubricant Type")), txt(g("Service Type")), txt(g("UT")),
        method,
        // `Joint Method Original` is the raw column with only Tensionning fixed.
        txt(g("Joint Method").replace(/Tensionning/g, "Tensioning")),
        txt(g("Joint Timing")) ?? "TBN",              // the M's null -> TBN
        txt(g("Cat.")) ?? "TBN",
        txt(g("Jointing Value")), null,
        jointDate,
        txt(g("Report Nbr")), txt(g("Jointer")), txt(g("Tag Nbr")),
        txt(g("Tightening Tool Id")), num(g("Control %")),
        txt(g("Flange Batch No")), parseDate(g("Selected Date")), parseDate(g("Issued Date")),
        txt(g("Issue Request No")), txt(g("Batch Status")), txt(g("Flange Joint Status")),
        txt(g("Control Inspection Report No")), parseDate(g("Control Inspection Date")),
        txt(g("Status - A/R")), txt(g("Client Requested")), txt(g("WITNESSED BY")),
        accRej === "" ? null : accRej, txt(g("REMARKS")), txt(g("BTC01")), txt(g("BT24")),
        txt(g("Reason")),
        txt(g("Reason for De-Tightening")), txt(g("User requested for De-Tightening")),
        parseDate(g("De-Tightening Requested Date")),
        txt(g("Hold Status")), parseDate(g("Hold Date")), txt(g("Hold Comments")),
        null, null, null, null, null, null, null, null,   // the 8 PCC columns: ovAssets only
        null, null, null, null, null, null, null, null,   // ovAssets housekeeping
      ];
    } else {
      stats.kept += 1;
      const jointId = g("FlangeJointName").trim();
      stats.jointIds.add(jointId);
      // The M derives BT No. back out of the joint id.
      const parts = jointId.split("-");
      const btNo = parts[parts.length - 1] ?? "";
      const cat = txt(g("Category for final tightening - Field030 (Custom)")) ?? "TBN";
      // The M's Joint Timing is derived from Cat. on this side, not sourced.
      const timing = cat === "X" ? "Before Pressure Test"
        : cat === "Y" ? "Before Precom"
          : cat === "Z" ? "After Precom" : "TBN";
      // `FL - Tightening Method`, NOT the plain `Tightening Method` column: only the
      // FL one reproduces the pinned method split (verified against metrics.json).
      const method = normaliseMethod(
        g("FL - Tightening Method").replace(/Torqueing/g, "Torquing"),
      );
      bump(stats.methods, method);
      const processPlant = g("Process Plant");
      const ha = haFromProcessPlant(processPlant);
      bump(stats.ha, ha ?? "(blank)");
      bump(stats.subcon, "CCC");
      // The M's two ReplaceText steps are case-SENSITIVE and the file holds
      // `Flange Leakage`, so they are no-ops here. Reproduced literally; the leak
      // metric compares with upper() — see the column comment in 0015.
      const pccRemarks = g("PCC Remarks - Field045 (Custom)")
        .replace(/Flange leaking/g, "FLANGE LEAKAGE")
        .replace(/Flange leakage/g, "FLANGE LEAKAGE")
        .trim();
      const jointDate = parseOvDate(g("Tightening Date - Field027 (Custom)"), "joint_date", stats);
      if (jointDate !== null && jointDate >= "2027-01-01") stats.dirtyFutureJointDate += 1;

      out = [
        String(loadId), source, jointId,
        txt(g("PipingIsometricNum - Field026 (Custom)")), txt(btNo), null, null, null,
        txt(g("Test Pack No - Field029 (Custom)")), txt(g("System")), txt(g("Subsystem")),
        txt(g("WeldAreaName")),                       // PDS Area
        txt(processPlant), txt(g("Process Area")),
        ha, "CCC",                                    // sub_contractor: hard-set, as the M does
        null, txt(g("Line No. - Field025 (Custom)")),
        txt(g("Joint Size")), txt(g("Gasket Rating")), txt(g("Spec")),
        txt(g("Material ID Code")),
        txt(g("Stud Diameter")), txt(g("Stud Number")), txt(g("Stud Length")), null,
        txt(g("Stud Material")), txt(g("Gasket Type")), txt(g("Gasket Rating")),
        null, null, null,                             // lubricant / service type / UT: not exported
        method, txt(g("FL - Tightening Method")),
        timing, cat,
        txt(g("FL - Torque Value")), txt(g("Torque EU")),
        jointDate,
        txt(g("Report Number - Field031 (Custom)")), txt(g("Crew ID - Field034 (Custom)")),
        txt(g("Serial No of Field Tag - Field023 (Custom)")), null, null,
        null, null, null, null, null, null,           // the batch / status block: '' on every CCC row
        null, parseOvDate(g("Verified Date - Field024 (Custom)"), "control_inspection_date", stats),
        null, null, null, null, null, null, null, null,
        // Reason for De-Tightening = PCC Remarks, per the M's AddColumn.
        pccRemarks === "" ? null : pccRemarks, null,
        parseOvDate(g("Re-Tightening Date - Field028 (Custom)"), "de_tightening_requested_date", stats),
        null, null, null,
        txt(g("PCC Serial No of Field Tag - Field038 (Custom)")),
        parseOvDate(g("PCC Tightening Date - Field039 (Custom)"), "pcc_tightening_date", stats),
        txt(g("PCC Report Number - Field040 (Custom)")),
        parseOvDate(g("PCC Verified Date - Field041 (Custom)"), "pcc_verified_date", stats),
        parseOvDate(g("PCC Re-Tightening Date - Field042 (Custom)"), "pcc_re_tightening_date", stats),
        txt(g("PCC Re-Tightening Report Number - Field043 (Custom)")),
        txt(g("PCC Crew ID - Field044 (Custom)")),
        pccRemarks === "" ? null : pccRemarks,
        txt(g("Re-Tightening Report Number - Field032 (Custom)")),
        txt(g("Flange Repair Record - Field032 (Custom)")),
        txt(g("Nut Material")), txt(g("Parent Asset")),
        txt(g("Record Modified By")), parseOvDate(g("Record Modified Date"), "record_modified_date", stats),
        txt(g("Construction Responsible Company")),
        txt(g("Commissioning Responsible Company")),
      ];
    }

    if (out.length !== FLANGE_COLUMNS.length) {
      throw new Error(
        `${source}: built ${out.length} values for ${FLANGE_COLUMNS.length} columns`,
      );
    }
    yield out;
  }
}

function report(stats: Stats, t0: number): boolean {
  const exp = EXPECTED[stats.source];
  console.log(`  header row            ${String(stats.headerRow).padStart(11)}  (${stats.headerWidth} named columns)`);
  console.log(`  data rows             ${fmt(stats.sheetRows).padStart(11)}  (expected ${fmt(exp.sheetRows)})`);
  for (const [k, v] of [...stats.dropped].sort((a, b) => b[1] - a[1])) {
    console.log(`  dropped ${k.padEnd(28)} ${fmt(v).padStart(7)}`);
  }
  console.log(`  rows into flange      ${fmt(stats.kept).padStart(11)}  (expected ${fmt(exp.kept)})`);
  console.log(`  distinct joint_id     ${fmt(stats.jointIds.size).padStart(11)}`);
  console.log(`  joint_method          ${[...stats.methods].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${fmt(v)}`).join(", ")}`);
  console.log(`  ha                    ${[...stats.ha].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${fmt(v)}`).join(", ")}`);
  console.log(`  sub_contractor        ${[...stats.subcon].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${fmt(v)}`).join(", ")}`);
  if (stats.dateTypoFixes > 0) console.log(`  -0024 -> -2024 repairs${String(stats.dateTypoFixes).padStart(11)}`);
  console.log(`  dirty rows KEPT (RF-05)  TBD sub-contractor ${stats.dirtySubcontractor}, joint_date >= 2027 ${stats.dirtyFutureJointDate}`);
  if (stats.usDateValues > 0) {
    console.log(`  m/d/yyyy dates parsed ${fmt(stats.usDateValues).padStart(11)}  (month-first: measured, the first component never exceeds 12)`);
  }
  if (stats.dateUnparsed.size > 0) {
    const top = [...stats.dateUnparsed].sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`  UNPARSED dates        ${fmt([...stats.dateUnparsed.values()].reduce((a, b) => a + b, 0)).padStart(11)}  ${top.map(([k, v]) => `${k} x${v}`).join("; ")}`);
  }
  console.log(`  runtime               ${secs(t0)}`);
  const ok = stats.sheetRows === exp.sheetRows && stats.kept === exp.kept;
  console.log(`  verdict               ${ok ? "counts MATCH the pbix" : "COUNTS DIFFER FROM THE PBIX"}`);
  return ok;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : null;
  let sources: FlangeSource[] = ["FLANGE_PROGRESS", "OVASSETS_1619"];
  if (only) {
    sources = sources.filter((s) => s === only);
    if (sources.length === 0) throw new Error("--only must be FLANGE_PROGRESS or OVASSETS_1619");
  }
  for (const f of [FP_FILE, OV_FILE]) {
    if (!existsSync(path.join(process.cwd(), f))) throw new Error(`file not found: ${f}`);
  }

  if (argv.includes("--dry-run")) {
    let ok = true;
    const allJoints = new Set<string>();
    for (const source of sources) {
      const t0 = Date.now();
      const file = source === "FLANGE_PROGRESS" ? FP_FILE : OV_FILE;
      console.log(`\n${source}  ${file}  (${fmt(statSync(path.join(process.cwd(), file)).size)} bytes)`);
      const stats = newStats(source);
      for await (const r of rowsFor(source, 0, stats)) void r;
      ok = report(stats, t0) && ok;
      for (const j of stats.jointIds) allJoints.add(j);
    }
    if (sources.length === 2) {
      console.log(`\nunion   distinct joint_id ${fmt(allJoints.size)}  (expected 357,787)`);
      console.log(`        flange columns written ${FLANGE_COLUMNS.length}`);
    }
    if (!ok) process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  try {
    await client.query("SET statement_timeout = 0");
    await client.query("SET synchronous_commit = off");
    if (argv.includes("--truncate")) {
      await client.query("TRUNCATE flange");
      console.log("truncate  flange cleared (all sources)");
    }
    for (const source of sources) {
      const file = source === "FLANGE_PROGRESS" ? FP_FILE : OV_FILE;
      const abs = path.join(process.cwd(), file);
      const t0 = Date.now();
      console.log(`\n${source}  ${file}`);
      const loadId = await openLoad(client, source, path.basename(abs), statSync(abs).size,
        await sha256File(abs));
      console.log(`  load_id ${loadId}`);

      await client.query("BEGIN");
      await client.query("DELETE FROM flange WHERE source = $1", [source]);
      const stats = newStats(source);
      async function* lines(): AsyncGenerator<string> {
        for await (const r of rowsFor(source, loadId, stats)) yield copyLine(r);
      }
      const n = await copyRows(client, "flange", [...FLANGE_COLUMNS], lines(), { label: source });
      // The DAX's HA fallback: LOOKUPVALUE('HA l0_abs_guide'[Handover Area],
      // [Location Number], [PDS Area]). It keys on PDS Area rather than System,
      // so it runs here, after the rows land, and only where [System] gave
      // nothing. A row the guide does not know keeps a NULL HA and its own
      // "(blank)" row -- RF-03 -- rather than a guessed area.
      const haFilled = await client.query(
        `UPDATE flange f SET ha = g.handover_area
           FROM ref_ha_guide g
          WHERE f.ha IS NULL AND g.location_number = f.pds_area
            AND g.handover_area ~ '^HA[1-4]$'`,
      );
      console.log(`  HA from l0_abs_guide: ${haFilled.rowCount ?? 0} rows filled`);

      await client.query("COMMIT");
      console.log(`  copy    ${fmt(n)} rows`);
      report(stats, t0);
      await closeLoad(client, loadId, stats.sheetRows, n, 0, {
        distinct_joint_ids: stats.jointIds.size,
        dropped: Object.fromEntries(stats.dropped),
        dirty_tbd_subcontractor: stats.dirtySubcontractor,
        dirty_future_joint_date: stats.dirtyFutureJointDate,
        date_typo_repairs: stats.dateTypoFixes,
        elapsed_s: Number(((Date.now() - t0) / 1000).toFixed(1)),
      });
    }
    // RF-09: no materialised view. VACUUM so the planner has real statistics.
    const tPost = Date.now();
    await client.query("VACUUM (ANALYZE) flange");
    console.log(`\npost  VACUUM (ANALYZE) flange in ${secs(tPost)}`);
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
