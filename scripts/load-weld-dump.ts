/**
 * Streaming loader for `sources/Weld Dump.txt` -> stg_weld_dump -> weld.
 *
 *   npm run db:load
 *   node --import tsx scripts/load-weld-dump.ts --dry-run --file "sources/Weld Dump.txt"
 *   node --import tsx scripts/load-weld-dump.ts --truncate
 *   node --import tsx scripts/load-weld-dump.ts --print-sql
 *
 * Options
 *   --file <path>   override WELD_DUMP_PATH
 *   --dry-run       parse only, NO database.  Prints the record count, the
 *                   field-count histogram, per-column literal-token counts,
 *                   date-parse failures and the row counts the M filters would produce.
 *   --truncate      wipe `weld`, `stg_weld_dump` and the `load` ledger first.
 *                   (`weld_weekly_snapshot` is preserved — its history cannot be
 *                   recomputed, ruling R-08.)
 *   --print-sql     print the generated INSERT…SELECT and exit (used by
 *                   scripts/check-sql-columns.ts).
 *
 * DEFAULT (no --truncate): a new `load` row is appended, and the PREVIOUS rows of
 * the SAME source are deleted from `weld` before the insert.  So `weld` always
 * holds exactly one load per source and no query can double-count, while the
 * `load` ledger keeps the full history of what was loaded when.  Staging is
 * truncated outright — it is disposable and single-source at a time.
 */

import { createHash } from "node:crypto";
import { closeSync, createReadStream, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { once } from "node:events";
import path from "node:path";
import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { formatRefreshes, refreshMatviews } from "./load-common";
import { COLUMNS_JSON, sourceColumns } from "./weld-columns";
import {
  DROPPED_WELD_DATES,
  LITERAL_TOKENS,
  buildRejectCountsSql,
  buildWeldInsert,
  copyColumns,
} from "./weld-sql";
import { weldCutoff } from "./lib/weld-cutoff";

/** Every data record holds exactly this many fields (profile.md §1.2c). */
const FIELD_COUNT = 223;

/**
 * Columns the export added after the contract was profiled (08-Nov-2026: RNSCOMPDT after
 * Piping Group). The header is read first: every name the contract does not know is cut from
 * each record before anything else sees it, so the contract, staging and `weld` stay as they
 * are. Anything else in the header (a missing, renamed or moved column) stops the load.
 */
interface HeaderPlan {
  /** 0-based positions of the unknown columns in the file. */
  drop: number[];
  /** Fields a record holds in the file (FIELD_COUNT + the dropped ones). */
  fileFields: number;
}

function headerPlan(filePath: string): HeaderPlan {
  const known = (JSON.parse(readFileSync(COLUMNS_JSON, "utf8")) as { raw_name: string }[]).map(
    (c) => c.raw_name.trim(),
  );
  const fd = openSync(filePath, "r");
  const buf = Buffer.alloc(1 << 16);
  const n = readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  const text = buf.subarray(0, n).toString("utf8").replace(/^\uFEFF/, "");
  const end = text.indexOf("\r\n");
  if (end < 0) throw new Error("Weld Dump: no header line");
  const header = text.slice(0, end).split(";").map((h) => h.trim());
  const knownSet = new Set(known);
  const drop = header.map((h, i) => (knownSet.has(h) ? -1 : i)).filter((i) => i >= 0);
  const rest = header.filter((h) => knownSet.has(h));
  if (rest.length !== known.length || rest.some((h, i) => h !== known[i])) {
    const i = rest.findIndex((h, k) => h !== known[k]);
    throw new Error(
      `Weld Dump header does not match the contract (${header.length} names; first difference at ` +
        `#${i + 1}: ${JSON.stringify(rest[i])} vs ${JSON.stringify(known[i])})`,
    );
  }
  const fileFields = FIELD_COUNT + drop.length;
  if (drop.some((i) => i >= fileFields)) {
    throw new Error(`Weld Dump: an added column sits after the data fields: ${drop.join(",")}`);
  }
  if (drop.length) {
    console.log(`header  ${drop.length} column(s) not in the contract, left out: ${drop.map((i) => header[i]).join(", ")}`);
  }
  return { drop, fileFields };
}

/** The record without the dropped fields. */
function cutFields(raw: string, drop: number[]): string {
  if (!drop.length) return raw;
  const f = raw.split(";");
  for (let k = drop.length - 1; k >= 0; k -= 1) f.splice(drop[k], 1);
  return f.join(";");
}
const SEMI = 59; // ';'
const SOURCE = "WELD_DUMP";

const LITERAL_TOKEN_SET = new Set(LITERAL_TOKENS);
const DATE_RE =
  /^[0-9]{1,2}-(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-([0-9]{4}|[0-9]{2})$/i;

interface Options {
  file: string;
  dryRun: boolean;
  truncate: boolean;
  printSql: boolean;
}

function parseArgs(argv: string[]): Options {
  const fileFlag = argv.indexOf("--file");
  const file =
    fileFlag >= 0 && argv[fileFlag + 1]
      ? argv[fileFlag + 1]
      : (process.env.WELD_DUMP_PATH ?? "sources/Weld Dump.txt");
  return {
    file: path.isAbsolute(file) ? file : path.join(process.cwd(), file),
    dryRun: argv.includes("--dry-run"),
    truncate: argv.includes("--truncate"),
    printSql: argv.includes("--print-sql"),
  };
}

// ------------------------------------------------------- record assembly ---

/**
 * Yields every logical data record as a raw string (fields still joined by ';').
 *
 * Ported from analysis/reconcile_check.py::iter_records — do not "simplify" it
 * back to a line reader.  The file is CRLF-delimited, but 1,236 records carry a
 * bare LF inside a field value and 17 carry an embedded CRLF, so:
 *   - splitting on '\n' mis-splits 1,236 records;
 *   - splitting on '\r\n' mis-splits 17;
 * a record is complete only once it holds FIELD_COUNT-1 ';' separators.  Pieces
 * re-joined across an embedded CRLF are rejoined with '\n', exactly as the Python
 * reference does, so both implementations produce byte-identical field values.
 */
async function* iterRecords(
  filePath: string,
): AsyncGenerator<{ lineNo: number; raw: string; fields: number; pieces: number }> {
  const plan = headerPlan(filePath);
  const want = plan.fileFields;
  const out = (raw: string, fields: number) =>
    fields === want
      ? { raw: cutFields(raw, plan.drop), fields: fields - plan.drop.length }
      : { raw, fields };
  const stream = createReadStream(filePath, { highWaterMark: 1 << 24 });
  const decoder = new TextDecoder("utf-8");
  let tail = "";
  let seenHeader = false;
  let buf: string | null = null;
  let bufSemis = 0;
  let bufPieces = 0;
  let lineNo = 0;

  const emitPiece = function* (
    p: string,
  ): Generator<{ lineNo: number; raw: string; fields: number; pieces: number }> {
    if (!seenHeader) {
      seenHeader = true; // the header record carries 226 names (+ added ones), not 223 fields
      return;
    }
    const semis = countSemis(p);
    if (buf === null) {
      buf = p;
      bufSemis = semis;
      bufPieces = 1;
    } else {
      buf = `${buf}\n${p}`;
      bufSemis += semis;
      bufPieces += 1;
    }
    if (bufSemis + 1 >= want) {
      lineNo += 1;
      yield { lineNo, ...out(buf, bufSemis + 1), pieces: bufPieces };
      buf = null;
      bufSemis = 0;
      bufPieces = 0;
    }
  };

  for await (const chunk of stream as AsyncIterable<Buffer>) {
    const data = tail + decoder.decode(chunk, { stream: true });
    const pieces = data.split("\r\n");
    tail = pieces.pop() as string;
    for (const p of pieces) yield* emitPiece(p);
  }
  tail += decoder.decode();
  if (tail.length > 0) {
    if (!seenHeader) {
      seenHeader = true;
    } else if (buf === null && tail.trim() === "") {
      // file ends with CRLF — nothing left over
    } else {
      const semis = countSemis(tail);
      buf = buf === null ? tail : `${buf}\n${tail}`;
      bufSemis += semis;
      bufPieces += 1;
      if (buf.trim() !== "") {
        lineNo += 1;
        yield { lineNo, ...out(buf, bufSemis + 1), pieces: bufPieces };
      }
    }
  }
}

function countSemis(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) if (s.charCodeAt(i) === SEMI) n += 1;
  return n;
}

// ------------------------------------------------------------- COPY text ---

/**
 * COPY format choice: TEXT, not CSV.
 *
 * CSV would need a quote character that cannot occur in the data (the classic
 * `QUOTE E'\b'` trick from profile.md §8.4) — but with no quoting in effect, CSV
 * has no way at all to represent the embedded LF that 1,236 records carry inside a
 * field: the newline would end the record.  COPY's text format escapes it as `\n`
 * and is also the fastest path (no quote scanning).  So: escape backslash, tab, LF
 * and CR, then swap the ';' delimiters for tabs.  `\N` is the NULL marker; a
 * literal `\N` in the data becomes `\\N` by the backslash rule and stays a string,
 * which is what we want — staging keeps '' as '', and the cast to `weld` is the
 * only place a value becomes NULL.
 */
function toCopyLine(loadId: number, lineNo: number, raw: string): string {
  let s = raw;
  if (s.indexOf("\\") >= 0) s = s.split("\\").join("\\\\");
  if (s.indexOf("\t") >= 0) s = s.split("\t").join("\\t");
  if (s.indexOf("\n") >= 0) s = s.split("\n").join("\\n");
  if (s.indexOf("\r") >= 0) s = s.split("\r").join("\\r");
  return `${loadId}\t${lineNo}\t${s.split(";").join("\t")}\n`;
}

// --------------------------------------------------------------- dry run ---

interface DryRunStats {
  records: number;
  fieldHistogram: Map<number, number>;
  literalTokens: Map<number, Map<string, number>>;
  dateFailures: Map<number, number>;
  dateNonEmpty: Map<number, number>;
  afterFilters: number;
  dropped: Map<string, number>;
  embeddedNewlineRecords: number;
  rejoinedRecords: number;
}

function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath, { highWaterMark: 1 << 22 });
  stream.on("data", (c) => hash.update(c));
  return once(stream, "end").then(() => hash.digest("hex"));
}

async function dryRun(opts: Options): Promise<DryRunStats> {
  const cols = sourceColumns();
  const dateCols = cols.filter((c) => c.cast === "date").map((c) => c.index - 1);
  const idx = Object.fromEntries(cols.map((c) => [c.pgName, c.index - 1])) as Record<
    string,
    number
  >;
  const droppedWeldDates = new Set(
    DROPPED_WELD_DATES.map((d) => {
      const [y, m, day] = d.split("-");
      const mon = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][
        Number(m) - 1
      ];
      return `${day}-${mon}-${y}`;
    }),
  );

  const stats: DryRunStats = {
    records: 0,
    fieldHistogram: new Map(),
    literalTokens: new Map(),
    dateFailures: new Map(),
    dateNonEmpty: new Map(),
    afterFilters: 0,
    dropped: new Map(),
    embeddedNewlineRecords: 0,
    rejoinedRecords: 0,
  };
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  for await (const rec of iterRecords(opts.file)) {
    stats.records += 1;
    stats.fieldHistogram.set(rec.fields, (stats.fieldHistogram.get(rec.fields) ?? 0) + 1);
    if (rec.raw.indexOf("\n") >= 0) stats.embeddedNewlineRecords += 1;
    if (rec.pieces > 1) stats.rejoinedRecords += 1;
    if (rec.fields !== FIELD_COUNT) {
      bump(stats.dropped, "field_count_mismatch");
      continue;
    }
    const f = rec.raw.split(";");

    for (let i = 0; i < f.length; i += 1) {
      const v = f[i];
      if (v.length > 0 && v.length <= 4 && LITERAL_TOKEN_SET.has(v)) {
        let per = stats.literalTokens.get(i);
        if (!per) {
          per = new Map();
          stats.literalTokens.set(i, per);
        }
        per.set(v, (per.get(v) ?? 0) + 1);
      }
    }
    for (const di of dateCols) {
      const v = f[di];
      if (v.length === 0) continue;
      stats.dateNonEmpty.set(di, (stats.dateNonEmpty.get(di) ?? 0) + 1);
      if (!DATE_RE.test(v)) stats.dateFailures.set(di, (stats.dateFailures.get(di) ?? 0) + 1);
    }

    // The Power Query row filters (§0.4 steps 4-6, 12), same order as
    // analysis/reconcile_check.py so the counts are directly comparable.
    const ac = f[idx.area_classification].trim();
    if (ac === "" || ac === "0") {
      bump(stats.dropped, "area_class_0_or_blank");
      continue;
    }
    // a Cancelled record split by a line break inside a field is kept, as Power Query does
    const pqSplit = f[idx.revision_status].trim() === "Cancelled" && f.some((v) => v.includes("\n"));
    if (f[idx.revision_status].trim() !== "" && !pqSplit) {
      bump(
        stats.dropped,
        f[idx.revision_status].trim() === "Cancelled"
          ? "revision_status_cancelled"
          : "revision_status_other",
      );
      continue;
    }
    if (f[idx.sub_contractor].trim() === "") {
      bump(stats.dropped, "sub_contractor_blank");
      continue;
    }
    let wd = f[idx.weld_date].trim().toUpperCase();
    if (wd === "NA") wd = "";
    if (droppedWeldDates.has(wd)) {
      bump(stats.dropped, "weld_date_excluded_by_m");
      continue;
    }
    stats.afterFilters += 1;
  }
  return stats;
}

function printDryRun(opts: Options, stats: DryRunStats, ms: number, sha: string): void {
  const cols = sourceColumns();
  const size = statSync(opts.file).size;
  console.log(`file                 ${opts.file}`);
  console.log(`size                 ${size.toLocaleString()} bytes`);
  console.log(`sha256               ${sha}`);
  console.log(`logical records      ${stats.records.toLocaleString()}`);
  console.log(`records w/ embedded LF ${stats.embeddedNewlineRecords.toLocaleString().padStart(9)}  (bare LF inside a field value)`);
  console.log(`records re-joined      ${stats.rejoinedRecords.toLocaleString().padStart(9)}  (embedded CRLF: assembled from >1 CRLF piece)`);
  console.log("");
  console.log("field-count histogram (assembled records)");
  for (const [n, c] of [...stats.fieldHistogram].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)} fields  ${c.toLocaleString().padStart(11)}${n === FIELD_COUNT ? "" : "   <-- NOT LOADABLE"}`);
  }
  console.log("");
  console.log("Power Query load filters (§0.4)");
  for (const [k, v] of [...stats.dropped].sort((a, b) => b[1] - a[1])) {
    console.log(`  dropped ${k.padEnd(28)} ${v.toLocaleString().padStart(9)}`);
  }
  console.log(`  ROWS THAT WOULD REACH weld    ${stats.afterFilters.toLocaleString().padStart(9)}`);
  console.log("");
  console.log("literal tokens kept by column (profile.md §8.2 — NOT nulled; see db/README.md)");
  const tokenRows = [...stats.literalTokens].sort((a, b) => a[0] - b[0]);
  let tokenTotal = 0;
  for (const [i, per] of tokenRows) {
    const parts = [...per].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}(${n.toLocaleString()})`);
    for (const [, n] of per) tokenTotal += n;
    console.log(`  #${String(i + 1).padStart(3)} ${cols[i].pgName.padEnd(34)} ${parts.join(", ")}`);
  }
  console.log(`  ${tokenRows.length} columns, ${tokenTotal.toLocaleString()} cells`);
  console.log("");
  console.log("date-parse failures (non-empty values that weld_to_date() will NULL)");
  let anyFailure = false;
  for (const c of cols.filter((x) => x.cast === "date")) {
    const i = c.index - 1;
    const bad = stats.dateFailures.get(i) ?? 0;
    const nonEmpty = stats.dateNonEmpty.get(i) ?? 0;
    if (bad > 0) anyFailure = true;
    console.log(
      `  #${String(c.index).padStart(3)} ${c.pgName.padEnd(34)} ${String(bad).padStart(8)} bad / ${nonEmpty.toLocaleString().padStart(9)} non-empty`,
    );
  }
  if (!anyFailure) console.log("  (none)");
  console.log("");
  console.log(`runtime              ${(ms / 1000).toFixed(1)} s`);
}

// ------------------------------------------------------------- live load ---

async function liveLoad(opts: Options): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");

  const size = statSync(opts.file).size;
  const t0 = Date.now();
  const sha = await sha256File(opts.file);
  console.log(`file    ${opts.file}`);
  console.log(`size    ${size.toLocaleString()} bytes`);
  console.log(`sha256  ${sha}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

  const client = new Client({ connectionString: url });
  await client.connect();
  let loadId = -1;
  try {
    await client.query("SET statement_timeout = 0");
    await client.query("SET synchronous_commit = off");

    if (opts.truncate) {
      // weld_weekly_snapshot is NOT truncated: its history is not recomputable (R-08).
      await client.query("TRUNCATE weld, stg_weld_dump");
      await client.query("DELETE FROM load");
      console.log("truncate  weld, stg_weld_dump and the load ledger cleared");
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO load (source, file_name, file_size, file_sha256, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [SOURCE, path.basename(opts.file), size, sha, JSON.stringify({ status: "running" })],
    );
    loadId = Number(inserted.rows[0].id);
    console.log(`load_id ${loadId}`);

    // ---- COPY + typed INSERT in ONE transaction ---------------------------
    await client.query("BEGIN");
    await client.query("TRUNCATE stg_weld_dump");

    const tCopy = Date.now();
    const copySql = `COPY stg_weld_dump (${copyColumns().join(", ")}) FROM STDIN WITH (FORMAT text)`;
    const stream = client.query(copyFrom(copySql));
    let records = 0;
    let badFieldCount = 0;
    const badExamples: number[] = [];
    let batch = "";
    for await (const rec of iterRecords(opts.file)) {
      if (rec.fields !== FIELD_COUNT) {
        badFieldCount += 1;
        if (badExamples.length < 10) badExamples.push(rec.lineNo);
        continue;
      }
      records += 1;
      batch += toCopyLine(loadId, rec.lineNo, rec.raw);
      if (batch.length >= 4 << 20) {
        if (!stream.write(batch)) await once(stream, "drain");
        batch = "";
      }
    }
    if (batch.length > 0 && !stream.write(batch)) await once(stream, "drain");
    stream.end();
    await once(stream, "finish");
    console.log(
      `copy    ${records.toLocaleString()} records staged in ${((Date.now() - tCopy) / 1000).toFixed(1)} s` +
        (badFieldCount > 0 ? `  (${badFieldCount} SKIPPED: field count != ${FIELD_COUNT})` : ""),
    );
    if (badFieldCount > 0) {
      console.warn(`        skipped record numbers (first 10): ${badExamples.join(", ")}`);
    }

    const cutoff = weldCutoff(opts.file);
    console.log(`cutoff  welds dated after ${cutoff} (last Friday before the export) are left out`);
    const rejects = await client.query<Record<string, string>>(buildRejectCountsSql(cutoff), [loadId]);
    const rej = rejects.rows[0];

    // Previous rows of the SAME source go; other sources are untouched.
    const others = await client.query<{ n: string }>(
      "SELECT count(*) AS n FROM weld WHERE source <> $1",
      [SOURCE],
    );
    if (Number(others.rows[0].n) === 0) {
      await client.query("TRUNCATE weld");
    } else {
      await client.query("DELETE FROM weld WHERE source = $1", [SOURCE]);
    }

    const tIns = Date.now();
    const ins = await client.query(buildWeldInsert(cutoff), [loadId, SOURCE]);
    console.log(
      `insert  ${(ins.rowCount ?? 0).toLocaleString()} rows into weld in ${((Date.now() - tIns) / 1000).toFixed(1)} s`,
    );
    // `WeldPoint No.1 WP1` — the pbix computes it for EVERY source:
    //   COUNTROWS(rows of the same Joint ID with a smaller Index) + 1
    // and `UT Weld Length by Joint "PR all"` filters on it, so a NULL here drops
    // the whole source out of that measure. The dump's `id` is assigned in COPY
    // order, which is file order, which is exactly what the pbix's Index column is.
    //
    // Done as one UPDATE rather than at COPY time (the CCC/Inco loaders count it
    // in the stream) because this loader goes through a staging table: the rows
    // are not built in JS, so there is nothing to count during the pass.
    const tSeq = Date.now();
    const seq = await client.query(`
      WITH s AS (
        SELECT id, row_number() OVER (PARTITION BY joint_id ORDER BY id) AS rn
          FROM weld WHERE source = $1
      )
      UPDATE weld w SET weldpoint_seq = s.rn
        FROM s WHERE w.id = s.id AND w.weldpoint_seq IS DISTINCT FROM s.rn`, [SOURCE]);
    console.log(
      `wp1     weldpoint_seq set on ${(seq.rowCount ?? 0).toLocaleString()} rows in ` +
      `${((Date.now() - tSeq) / 1000).toFixed(1)} s`,
    );
    await client.query("COMMIT");

    const tPost = Date.now();
    // VACUUM (not just ANALYZE): TRUNCATE + INSERT leaves the visibility map empty,
    // so index-only scans would fall back to heap fetches until the next vacuum. ~1 s.
    await client.query("VACUUM (ANALYZE) weld");
    const refreshed = await refreshMatviews(client);
    console.log(
      `post    VACUUM (ANALYZE) weld + ${formatRefreshes(refreshed)}` +
      ` — ${((Date.now() - tPost) / 1000).toFixed(1)} s total`,
    );

    await client.query(
      `UPDATE load SET finished_at = now(), records_read = $2, records_loaded = $3,
                       records_cancelled = $4, notes = $5
       WHERE id = $1`,
      [
        loadId,
        records + badFieldCount,
        ins.rowCount ?? 0,
        Number(rej.revision_status_cancelled),
        JSON.stringify({
          status: "ok",
          field_count_mismatch: badFieldCount,
          rejected: rej,
          elapsed_s: Number(((Date.now() - t0) / 1000).toFixed(1)),
        }),
      ],
    );

    console.log("");
    console.log("summary");
    console.log(`  records read            ${(records + badFieldCount).toLocaleString()}`);
    for (const [k, v] of Object.entries(rej)) {
      if (k === "staged") continue;
      console.log(`  dropped ${k.padEnd(26)} ${Number(v).toLocaleString().padStart(9)}`);
    }
    console.log(`  rows in weld            ${(ins.rowCount ?? 0).toLocaleString()}`);
    console.log(`  total                   ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* the connection may already be gone */
    }
    if (loadId > 0) {
      await client.query(
        `UPDATE load SET finished_at = now(), notes = $2 WHERE id = $1`,
        [loadId, JSON.stringify({ status: "failed", error: String(err) })],
      );
    }
    throw err;
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.printSql) {
    console.log(buildWeldInsert());
    return;
  }
  if (!existsSync(opts.file)) throw new Error(`file not found: ${opts.file}`);
  if (opts.dryRun) {
    const t0 = Date.now();
    const sha = await sha256File(opts.file);
    const stats = await dryRun(opts);
    printDryRun(opts, stats, Date.now() - t0, sha);
    return;
  }
  await liveLoad(opts);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exitCode = 1;
});
