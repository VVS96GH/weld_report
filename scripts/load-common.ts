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

/** A COPY sink that batches ~4 MB at a time and honours backpressure. */
export class CopySink {
  private batch = "";
  private readonly stream: NodeJS.WritableStream;
  rows = 0;

  constructor(client: Client, table: string, columns: string[]) {
    this.stream = client.query(
      copyFrom(`COPY ${table} (${columns.join(", ")}) FROM STDIN WITH (FORMAT text)`),
    ) as unknown as NodeJS.WritableStream;
  }

  async write(line: string): Promise<void> {
    this.rows += 1;
    this.batch += line;
    if (this.batch.length >= 4 << 20) {
      const b = this.batch;
      this.batch = "";
      if (!this.stream.write(b)) await once(this.stream, "drain");
    }
  }

  async end(): Promise<number> {
    if (this.batch.length > 0 && !this.stream.write(this.batch)) {
      await once(this.stream, "drain");
    }
    this.stream.end();
    await once(this.stream, "finish");
    return this.rows;
  }
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

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function secs(t0: number): string {
  return `${((Date.now() - t0) / 1000).toFixed(1)} s`;
}
