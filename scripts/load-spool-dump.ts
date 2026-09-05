/**
 * Loads the two spool masters into `spool` (ruling R2-06).
 *
 *   node --import tsx scripts/load-spool-dump.ts --dry-run
 *   node --import tsx scripts/load-spool-dump.ts               # both masters
 *   node --import tsx scripts/load-spool-dump.ts --only SPOOL_DUMP
 *
 * `Spool Dump.txt`  — ';' cp1252, 102 header names but **100 fields per line**;
 *                     pad, never re-join. 202,352 lines -> 198,647 after
 *                     Revision Status = ''.  source SPOOL_DUMP.
 * `Spool.csv`       — ',' cp1252, 22 fields, clean. 331,979 rows, no filter.
 *                     source TALISMAN_SPOOL.
 *
 * WHY PAD AND NOT RE-JOIN: with QuoteStyle.None Power Query pads or truncates
 * each PHYSICAL LINE to its declared width. `Spool Dump.txt` has 193,563 lines
 * containing a literal `"` (the inch mark in `Line No`) and every line carries
 * 100 fields against 102 names — the two trailing names `BHS`/`WHS` have no data
 * field, exactly like `Weld Dump.txt`. An assembler that re-joins until the
 * separator count reaches 101 would fuse pairs of lines and yield 101,176
 * records instead of 202,352 (analysis/sources2/profile.md).
 */

import { statSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import {
  closeLoad, copyLine, copyRows, fmt, num, openLoad, parseDate, readDelimited,
  requireEnvUrl, secs, sha256File, txt, type Encoding,
} from "./load-common";
import { SPOOL_DUMP_MAP, TALISMAN_SPOOL_MAP, spoolColumns } from "./load-columns";

interface MasterSpec {
  source: "SPOOL_DUMP" | "TALISMAN_SPOOL";
  file: string;
  delimiter: string;
  encoding: Encoding;
  width: number;
  expectedLines: number;
  expectedLoaded: number;
  /** spool column -> source header name (or a special marker). */
  map: Record<string, string>;
  dateCols: string[];
  numCols: string[];
  intCols: string[];
}

/** The mapping table documented in db/README.md, "spool — two masters, one table". */
const SPOOL_DUMP: MasterSpec = {
  source: "SPOOL_DUMP",
  file: "sources/Spool Dump.txt",
  delimiter: ";",
  encoding: "windows-1252",
  width: 102,
  expectedLines: 202_352,
  expectedLoaded: 198_647,
  map: SPOOL_DUMP_MAP,  dateCols: ["material_issue", "mir_date", "start_fab", "fabricated", "qc_release",
    "sent_to_paint", "painted", "final_qc", "laydown", "to_site", "erected",
    "welded_bolt", "supported", "rft", "erec_mir_date", "testpack_test_done_date",
    "spool_tracking_date"],
  numCols: ["shop_dia", "shop_di_comp", "field_dia", "field_di_comp", "spool_diameter",
    "spool_weight", "spool_length", "spool_volume", "surface_area", "spool_inch_meter"],
  intCols: ["spool_rev_no", "sheet_no", "barcode_number", "area_classification", "wbu"],
};

const TALISMAN_SPOOL: MasterSpec = {
  source: "TALISMAN_SPOOL",
  file: "sources/Spool.csv",
  delimiter: ",",
  encoding: "windows-1252",
  width: 22,
  expectedLines: 331_979,
  expectedLoaded: 331_979,
  map: TALISMAN_SPOOL_MAP,  dateCols: ["fabrication_order", "material_issue", "cut_fit", "fabricated", "qc_release",
    "pwht_date", "shop_nde_done", "sent_to_paint", "laydown", "painted", "final_qc",
    "paint_report_date", "laydown_move", "to_site", "erected", "field_weld_complete",
    "field_nde_done"],
  numCols: ["spool_weight"],
  intCols: [],
};

interface Stats {
  lines: number;
  loaded: number;
  droppedRevisionStatus: number;
  duplicateSpoolId: number;
  raggedWidths: Map<number, number>;
  dateFailures: Map<string, number>;
  /** the actual values weld_to_date() will NULL, so a real parse bug is visible. */
  unparsedDateValues: Map<string, number>;
}

function newStats(): Stats {
  return {
    lines: 0, loaded: 0, droppedRevisionStatus: 0, duplicateSpoolId: 0,
    raggedWidths: new Map(), dateFailures: new Map(), unparsedDateValues: new Map(),
  };
}

/** Streams one master, yielding the ordered COPY values for every kept row. */
async function* rows(
  spec: MasterSpec,
  loadId: number,
  columns: string[],
  stats: Stats,
  seen: Set<string>,
): AsyncGenerator<(string | null)[]> {
  let index: Map<string, number> | null = null;
  const dateSet = new Set(spec.dateCols);
  const numSet = new Set(spec.numCols);
  const intSet = new Set(spec.intCols);

  for await (const line of readDelimited(path.join(process.cwd(), spec.file), {
    delimiter: spec.delimiter, encoding: spec.encoding, width: spec.width, mode: "pad",
  })) {
    if (line.lineNo === 0) {
      index = new Map(line.fields.map((h, i) => [h.trim(), i]));
      continue;
    }
    if (!index) throw new Error("no header");
    stats.lines += 1;
    stats.raggedWidths.set(line.rawWidth, (stats.raggedWidths.get(line.rawWidth) ?? 0) + 1);

    const get = (header: string): string | undefined => {
      const i = index?.get(header);
      return i === undefined ? undefined : line.fields[i];
    };

    // The M's only row filter on Spool Dump; Talisman has none.
    if (spec.source === "SPOOL_DUMP" && txt(get("Revision Status")) !== null) {
      stats.droppedRevisionStatus += 1;
      continue;
    }

    const iso = (get(spec.map.iso_number) ?? "").trim();
    const sp = (get(spec.map.spool_no) ?? "").trim();
    const spoolId = `${iso}-${sp}`;
    if (seen.has(spoolId)) {
      // After the Revision Status filter this must not happen (all 335 duplicate
      // Spool IDs are cancelled rows); counted rather than silently overwritten.
      stats.duplicateSpoolId += 1;
      continue;
    }
    seen.add(spoolId);
    stats.loaded += 1;

    const out: (string | null)[] = [];
    for (const col of columns) {
      if (col === "source") { out.push(spec.source); continue; }
      if (col === "load_id") { out.push(String(loadId)); continue; }
      if (col === "spool_id") { out.push(spoolId); continue; }
      const header = spec.map[col];
      if (header === undefined) { out.push(null); continue; }
      const raw = get(header);
      if (dateSet.has(col)) {
        const d = parseDate(raw);
        if (d === null && txt(raw) !== null) {
          stats.dateFailures.set(col, (stats.dateFailures.get(col) ?? 0) + 1);
          const v = (raw ?? "").trim();
          stats.unparsedDateValues.set(v, (stats.unparsedDateValues.get(v) ?? 0) + 1);
        }
        out.push(d);
      } else if (numSet.has(col) || intSet.has(col)) {
        out.push(num(raw));
      } else {
        out.push(txt(raw));
      }
    }
    yield out;
  }
}

function columnsFor(spec: MasterSpec): string[] {
  return spoolColumns(spec.map);
}

function report(spec: MasterSpec, stats: Stats, t0: number): boolean {
  const ragged = [...stats.raggedWidths].sort((a, b) => b[1] - a[1]);
  console.log(`  physical data lines   ${fmt(stats.lines).padStart(11)}  (expected ${fmt(spec.expectedLines)})`);
  console.log(`  field-count histogram ${ragged.map(([w, c]) => `${w}->${fmt(c)}`).join(", ")}`);
  if (spec.source === "SPOOL_DUMP") {
    console.log(`  dropped Revision Status <> '' ${fmt(stats.droppedRevisionStatus).padStart(6)}`);
  }
  if (stats.duplicateSpoolId > 0) {
    console.log(`  dropped duplicate spool_id    ${fmt(stats.duplicateSpoolId).padStart(6)}  <-- INVESTIGATE`);
  }
  console.log(`  rows into spool       ${fmt(stats.loaded).padStart(11)}  (expected ${fmt(spec.expectedLoaded)})`);
  const bad = [...stats.dateFailures].sort((a, b) => b[1] - a[1]);
  console.log(`  date-parse failures   ${bad.length === 0 ? "(none)" : bad.map(([c, n]) => `${c}=${fmt(n)}`).join(", ")}`);
  if (stats.unparsedDateValues.size > 0) {
    const vals = [...stats.unparsedDateValues].sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`  ...the values themselves  ${vals.map(([v, n]) => `${JSON.stringify(v)}x${fmt(n)}`).join(", ")}`);
    console.log(`  (a null token, not a parse bug, if this is only NA / N/A)`);
  }
  console.log(`  runtime               ${secs(t0)}`);
  const ok = stats.lines === spec.expectedLines && stats.loaded === spec.expectedLoaded;
  console.log(`  verdict               ${ok ? "counts MATCH the profile" : "COUNTS DIFFER FROM THE PROFILE"}`);
  return ok;
}

async function dryRun(specs: MasterSpec[]): Promise<boolean> {
  let allOk = true;
  for (const spec of specs) {
    const abs = path.join(process.cwd(), spec.file);
    if (!existsSync(abs)) throw new Error(`file not found: ${abs}`);
    const t0 = Date.now();
    console.log(`\n${spec.source}  ${spec.file}  (${fmt(statSync(abs).size)} bytes)`);
    const stats = newStats();
    const seen = new Set<string>();
    const cols = columnsFor(spec);
    for await (const _r of rows(spec, 0, cols, stats, seen)) void _r;
    allOk = report(spec, stats, t0) && allOk;
    console.log(`  spool columns written ${cols.length}`);
  }
  return allOk;
}

async function live(specs: MasterSpec[], truncate: boolean): Promise<void> {
  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  try {
    await client.query("SET statement_timeout = 0");
    await client.query("SET synchronous_commit = off");
    if (truncate) {
      await client.query("TRUNCATE spool");
      console.log("truncate  spool cleared (all sources)");
    }
    for (const spec of specs) {
      const abs = path.join(process.cwd(), spec.file);
      if (!existsSync(abs)) throw new Error(`file not found: ${abs}`);
      const size = statSync(abs).size;
      const t0 = Date.now();
      const sha = await sha256File(abs);
      console.log(`\n${spec.source}  ${spec.file}`);
      console.log(`  sha256 ${sha}`);
      const loadId = await openLoad(client, spec.source, path.basename(abs), size, sha);
      console.log(`  load_id ${loadId}`);

      await client.query("BEGIN");
      // Replace this source only; the other master is untouched.
      await client.query("DELETE FROM spool WHERE source = $1", [spec.source]);
      const stats = newStats();
      const seen = new Set<string>();
      const cols = columnsFor(spec);
      async function* lines(): AsyncGenerator<string> {
        for await (const r of rows(spec, loadId, cols, stats, seen)) yield copyLine(r);
      }
      const n = await copyRows(client, "spool", cols, lines(), {
        label: spec.source,
        onProgress: (rowCount, bytes) =>
          console.log(`  ... ${fmt(rowCount)} rows / ${fmt(bytes)} bytes copied`),
      });
      await client.query("COMMIT");
      report(spec, stats, t0);
      await closeLoad(client, loadId, stats.lines, n, stats.droppedRevisionStatus, {
        dropped_revision_status: stats.droppedRevisionStatus,
        dropped_duplicate_spool_id: stats.duplicateSpoolId,
        elapsed_s: Number(((Date.now() - t0) / 1000).toFixed(1)),
      });
    }
    const t = Date.now();
    await client.query("VACUUM (ANALYZE) spool");
    console.log(`\npost  VACUUM (ANALYZE) spool in ${secs(t)}`);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : null;
  let specs = [SPOOL_DUMP, TALISMAN_SPOOL];
  if (only) {
    specs = specs.filter((s) => s.source === only);
    if (specs.length === 0) throw new Error(`--only must be SPOOL_DUMP or TALISMAN_SPOOL`);
  }
  if (argv.includes("--dry-run")) {
    const ok = await dryRun(specs);
    if (!ok) process.exitCode = 1;
    return;
  }
  await live(specs, argv.includes("--truncate"));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  // exit(), not exitCode: a stalled COPY leaves a producer parked on a promise
  // that will never settle, and that handle would otherwise keep the process alive.
  process.exit(1);
});
