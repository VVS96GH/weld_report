/**
 * Shared plumbing for the batch-2 loaders.
 *
 * The batch-1 dump loader (scripts/load-weld-dump.ts) keeps its own record
 * assembler because `Weld Dump.txt` is the only source where a record spans
 * lines.  Every batch-2 file is CRLF-only, BOM-free and perfectly rectangular
 * (analysis/sources2/profile.md), so one physical line is one record and the
 * reader here is deliberately simpler — and deliberately does NOT re-join on
 * separator count, because `Spool Dump.txt` carries 100 fields against a
 * 102-name header and Power Query pads each PHYSICAL LINE rather than joining.
 * Re-joining there would halve the row count.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { once } from "node:events";
import { Readable, type Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";

export type Encoding = "utf-8" | "windows-1252";

/** What to do when a line's field count is not the declared width. */
export type WidthMode = "pad" | "truncate" | "exact";

export interface ReadOptions {
  delimiter: string;
  encoding: Encoding;
  /** Declared column count. Lines are padded/truncated to it per `mode`. */
  width: number;
  mode: WidthMode;
}

export interface SourceLine {
  lineNo: number;      // 1-based, header excluded
  fields: string[];    // exactly ReadOptions.width entries
  rawWidth: number;    // fields before pad/truncate
}

/**
 * Yields the header once (as `lineNo === 0`), then every data line.
 * Decoding is streaming, so a 1.5 GB file never sits in memory.
 */
export async function* readDelimited(
  filePath: string,
  opts: ReadOptions,
): AsyncGenerator<SourceLine> {
  const stream = createReadStream(filePath, { highWaterMark: 1 << 24 });
  const decoder = new TextDecoder(opts.encoding);
  let tail = "";
  let lineNo = -1; // -1 -> the next emitted line is the header

  const emit = (raw: string): SourceLine | null => {
    if (raw.length === 0) return null;
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.length === 0) return null;
    const fields = line.split(opts.delimiter);
    const rawWidth = fields.length;
    if (rawWidth < opts.width && opts.mode === "pad") {
      while (fields.length < opts.width) fields.push("");
    } else if (rawWidth > opts.width && opts.mode === "truncate") {
      fields.length = opts.width;
    }
    lineNo += 1;
    return { lineNo, fields, rawWidth };
  };

  for await (const chunk of stream as AsyncIterable<Buffer>) {
    const data = tail + decoder.decode(chunk, { stream: true });
    const parts = data.split("\n");
    tail = parts.pop() as string;
    for (const p of parts) {
      const line = emit(p);
      if (line) yield line;
    }
  }
  tail += decoder.decode();
  for (const p of tail.split("\n")) {
    const line = emit(p);
    if (line) yield line;
  }
}

/**
 * COPY text-format escaping. Text, never CSV: `Spool Dump.txt` carries a literal
 * `"` on 193,563 of its 202,352 lines (the inch mark in `Line No`,
 * `BD6132034A01-6"(1C1KL)-S(52)(25)`), and CSV would either quote-mangle them or
 * need a quote character that cannot occur. `\N` is NULL; a real backslash is
 * doubled, so a literal `\N` in the data stays the two-character string.
 */
export function copyLine(values: (string | null)[]): string {
  let out = "";
  for (let i = 0; i < values.length; i += 1) {
    if (i > 0) out += "\t";
    const v = values[i];
    if (v === null) {
      out += "\\N";
      continue;
    }
    let s = v;
    if (s.indexOf("\\") >= 0) s = s.split("\\").join("\\\\");
    if (s.indexOf("\t") >= 0) s = s.split("\t").join("\\t");
    if (s.indexOf("\n") >= 0) s = s.split("\n").join("\\n");
    if (s.indexOf("\r") >= 0) s = s.split("\r").join("\\r");
    out += s;
  }
  return `${out}\n`;
}

/** Empty string -> NULL. Nothing else: literal NA / N/A / ? are kept (see db/README.md). */
export function txt(v: string | undefined): string | null {
  if (v === undefined) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function num(v: string | undefined): string | null {
  const t = txt(v);
  if (t === null) return null;
  const s = t.replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(s) ? s : null;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * The JS twin of the SQL `weld_to_date()` v3 (migration 0010): the same four
 * formats, the same "return null, never throw" contract.  Used by the loaders'
 * --dry-run so the parse-failure counts a dry run reports are the counts the
 * live load will produce.
 */
export function parseDate(v: string | undefined): string | null {
  const t = txt(v);
  if (t === null) return null;
  let m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(t);
  if (m) {
    const mo = MONTHS.indexOf(m[2].toUpperCase());
    return mo < 0 ? null : `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(t);
  if (m) {
    const mo = MONTHS.indexOf(m[2].toUpperCase());
    if (mo < 0) return null;
    const yy = Number(m[3]);
    const year = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${year}-${String(mo + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

export function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath, { highWaterMark: 1 << 22 });
  stream.on("data", (c) => hash.update(c));
  return once(stream, "end").then(() => hash.digest("hex"));
}

/**
 * ONE COPY at a time, per connection, with back-pressure handled by
 * `stream.pipeline` and a stall watchdog.
 *
 * ===================== WHY THIS REPLACED `CopySink` =====================
 * The old `CopySink` let a caller open two COPY streams on one `Client`
 * (load-ccc-joint-record.ts:228-229 did exactly that: `tmp_jr` and `weld`).
 * node-postgres serialises queries per connection, so the SECOND `copyFrom`
 * only sits in the client's query queue — its Writable is never attached to
 * the socket and nothing ever consumes it. After ~4 MB of buffered rows its
 * `write()` returned false, the old code did `await once(stream, 'drain')`
 * (load-common.ts:177), and that 'drain' could never fire. The await never
 * settled, so the producing loop stopped, so the FIRST COPY stopped being fed:
 * `pg_stat_progress_copy.tuples_processed` froze at 829,562 with the node
 * process blocked at 8 s of CPU. A deadlock, not slowness.
 *
 * Three things prevent it recurring:
 *  1. `copyRows()` is the only way to COPY, it owns the whole stream lifecycle,
 *     and `ACTIVE_COPY` throws immediately if a second one is started on the
 *     same client. A deadlock becomes a loud error.
 *  2. `pipeline()` owns back-pressure. It also propagates errors BOTH ways, so
 *     a server-side COPY failure rejects instead of hanging.
 *  3. The watchdog destroys the stream if no bytes move for `stallSeconds`, so
 *     even an unforeseen stall dies with a diagnosis instead of waiting forever.
 */

/** Clients with a COPY in flight. A second concurrent COPY is a deadlock. */
const ACTIVE_COPY = new WeakSet<Client>();

export interface CopyOptions {
  /** Shown in progress and error messages. */
  label: string;
  /** Abort if no bytes reach the server for this long. Default 60 s. */
  stallSeconds?: number;
  /** Called every ~4 MB with the running totals, for progress logging. */
  onProgress?: (rows: number, bytes: number) => void;
}

/**
 * Streams pre-escaped COPY lines into `table`. Returns the row count.
 * `lines` is pulled lazily, so the producer only runs as fast as the server
 * drains — which is the whole point.
 */
export async function copyRows(
  client: Client,
  table: string,
  columns: string[],
  lines: AsyncIterable<string>,
  opts: CopyOptions,
): Promise<number> {
  if (ACTIVE_COPY.has(client)) {
    throw new Error(
      `refusing to start COPY into ${table} (${opts.label}): another COPY is already in ` +
      `flight on this connection. node-postgres runs one query per connection, so the ` +
      `second COPY would queue, never drain, and deadlock the first. Run them in ` +
      `sequence, or open a second Client.`,
    );
  }
  ACTIVE_COPY.add(client);

  let rows = 0;
  let bytes = 0;
  let lastBytes = -1;
  let lastMove = Date.now();
  const stallMs = (opts.stallSeconds ?? 60) * 1000;

  // Batch into ~4 MB chunks: one write per 20k-ish rows instead of per row.
  async function* batched(): AsyncGenerator<string> {
    let buf = "";
    for await (const line of lines) {
      rows += 1;
      buf += line;
      if (buf.length >= 4 << 20) {
        bytes += buf.length;
        opts.onProgress?.(rows, bytes);
        yield buf;
        buf = "";
      }
    }
    if (buf.length > 0) {
      bytes += buf.length;
      opts.onProgress?.(rows, bytes);
      yield buf;
    }
  }

  const dest = client.query(
    copyFrom(`COPY ${table} (${columns.join(", ")}) FROM STDIN WITH (FORMAT text)`),
  ) as unknown as Writable;

  // The watchdog RACES the pipeline instead of only destroying the stream.
  // Destroying is not enough: in a real stall the producer is parked on a promise
  // that will never settle (the old bug parked it on a 'drain' that could not
  // fire), and Node cannot cancel a pending promise — so `pipeline` itself never
  // settles either and the process would still hang, just with a message logged.
  // Racing lets the caller's catch run, roll back, and exit non-zero while the
  // orphaned generator stays parked; the loaders' top-level catch then calls
  // process.exit so a dangling handle cannot keep the process alive.
  let onStall: ((e: Error) => void) | null = null;
  const stalled = new Promise<never>((_resolve, reject) => { onStall = reject; });
  const watchdog = setInterval(() => {
    if (bytes !== lastBytes) {
      lastBytes = bytes;
      lastMove = Date.now();
      return;
    }
    if (Date.now() - lastMove > stallMs) {
      const err = new Error(
        `COPY into ${table} (${opts.label}) made no progress for ` +
        `${Math.round((Date.now() - lastMove) / 1000)} s at ${rows} rows / ${bytes} bytes. ` +
        `Aborting rather than hanging. Check for a second concurrent COPY on this ` +
        `connection, a wedged producer, or a server-side lock.`,
      );
      clearInterval(watchdog);
      dest.destroy(err);
      onStall?.(err);
    }
  }, 5000);
  watchdog.unref();

  try {
    await Promise.race([pipeline(Readable.from(batched()), dest), stalled]);
  } finally {
    clearInterval(watchdog);
    ACTIVE_COPY.delete(client);
  }
  return rows;
}

export interface CommonOptions {
  dryRun: boolean;
  truncate: boolean;
  files: Record<string, string>;
}

export function requireEnvUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  return url;
}

export async function openLoad(
  client: Client,
  source: string,
  fileName: string,
  fileSize: number,
  sha: string,
): Promise<number> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO load (source, file_name, file_size, file_sha256, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [source, fileName, fileSize, sha, JSON.stringify({ status: "running" })],
  );
  return Number(r.rows[0].id);
}

export async function closeLoad(
  client: Client,
  loadId: number,
  read: number,
  loaded: number,
  cancelled: number,
  notes: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `UPDATE load SET finished_at = now(), records_read = $2, records_loaded = $3,
                     records_cancelled = $4, notes = $5 WHERE id = $1`,
    [loadId, read, loaded, cancelled, JSON.stringify({ status: "ok", ...notes })],
  );
}

/**
 * The materialised views every loader must refresh, in dependency order.
 *
 * `mv_joint` / `mv_joint_wps` (migration 0013, authored by the metrics lane) are
 * the joint-grain rollups the project pages read: `weld` is weld-pass grain
 * (6.5 M rows over 2,370,428 joints) and the pivots were taking 20-30 s. They
 * embed an `EXISTS` against `spool` for the FABRICATED flags, so a SPOOL load
 * changes their contents too — which is why the spool loader refreshes them even
 * though it never touches `weld`.
 */
export const POST_LOAD_MATVIEWS: { name: string; concurrently: boolean }[] = [
  // Small (~10k rows) but a plain refresh held ACCESS EXCLUSIVE for 21.5 s in the
  // live spool run, blocking every trend query meanwhile; it has the non-partial
  // UNIQUE index CONCURRENTLY needs (mv_weekly_progress_key), so refresh online.
  { name: "mv_weekly_progress", concurrently: true },
  // 2,370,428 rows, ~41 s. CONCURRENTLY so the app keeps reading during a load:
  // a plain REFRESH holds ACCESS EXCLUSIVE for its whole duration.
  { name: "mv_joint", concurrently: true },
  // 2,194,756 rows, ~7 s.
  { name: "mv_joint_wps", concurrently: true },
  // joint → material type (0049), for the Material Type slicer. Keyed: online.
  { name: "mv_joint_material", concurrently: true },
  // joint × WPS × material × welder (0050), for the WPS / Material page. Keyed: online.
  { name: "mv_joint_pairs", concurrently: true },
  // NDT Remarks / Thickness / PAUT per joint (0051), the Project NDE & PWHT page. Keyed: online.
  { name: "mv_joint_attr", concurrently: true },
  // 2.5 M rows, ~33 s; no unique key (its grain has NULLs), so a plain refresh.
  { name: "mv_welder_perf", concurrently: false },
  // Read mv_welder_perf, so after it. Small, keyed: online.
  { name: "mv_welder_status", concurrently: true },
  { name: "mv_welder_sub_status", concurrently: true },
];

export interface RefreshResult {
  name: string;
  seconds: number;
  /** false when the view had to be refreshed plainly because it was unpopulated. */
  concurrently: boolean;
  missing: boolean;
  /** true when the refresh was left to scripts/refresh-data.ts (one refresh per run). */
  deferred?: boolean;
}

/**
 * Refreshes the post-load matviews and returns per-view timings.
 *
 * MUST be called OUTSIDE a transaction: `REFRESH MATERIALIZED VIEW CONCURRENTLY`
 * cannot run in a transaction block. All four loaders call this after COMMIT.
 *
 * The `relispopulated` branch is not optional: 0011 and 0013 both create their
 * views `WITH NO DATA`, and CONCURRENTLY refuses to refresh a view that has never
 * been populated. So the FIRST refresh after `npm run db:reset` is plain and
 * every later one is concurrent.
 */
export async function refreshMatviews(client: Client): Promise<RefreshResult[]> {
  const out: RefreshResult[] = [];
  // `npm run db:refresh` (scripts/refresh-data.ts) runs several loaders in a row
  // and refreshes the views ONCE at the end; it sets this for its children. Never
  // set it by hand: the pages read these views and would stay stale.
  if (process.env.WELD_DEFER_MATVIEW_REFRESH === "1") {
    return POST_LOAD_MATVIEWS.map((mv) => ({
      name: mv.name, seconds: 0, concurrently: false, missing: false, deferred: true,
    }));
  }
  for (const mv of POST_LOAD_MATVIEWS) {
    const meta = await client.query<{ populated: boolean }>(
      `SELECT relispopulated AS populated FROM pg_class
        WHERE oid = to_regclass($1) AND relkind = 'm'`,
      [mv.name],
    );
    if (meta.rowCount === 0) {
      // Honest-empty, loudly: the load itself succeeded, but the pages that read
      // this view will be stale until the migration is applied.
      console.warn(
        `  !! materialised view ${mv.name} does not exist — skipped. ` +
        `Run \`npm run db:migrate\`; the pages that read it are stale until you do.`,
      );
      out.push({ name: mv.name, seconds: 0, concurrently: false, missing: true });
      continue;
    }
    const concurrently = mv.concurrently && meta.rows[0].populated;
    const t = Date.now();
    await client.query(
      `REFRESH MATERIALIZED VIEW ${concurrently ? "CONCURRENTLY " : ""}${mv.name}`,
    );
    out.push({
      name: mv.name,
      seconds: Number(((Date.now() - t) / 1000).toFixed(1)),
      concurrently,
      missing: false,
    });
  }
  return out;
}

/** One-line summary for a loader's `post` line. */
export function formatRefreshes(results: RefreshResult[]): string {
  return results
    .map((r) => (r.missing ? `${r.name} SKIPPED`
      : r.deferred ? `${r.name} deferred`
      : `${r.name} ${r.seconds}s${r.concurrently ? "" : " (plain)"}`))
    .join(", ");
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function secs(t0: number): string {
  return `${((Date.now() - t0) / 1000).toFixed(1)} s`;
}
