/**
 * A tiny "what does the schema actually look like after all the migrations"
 * resolver.
 *
 * Migrations are an append-only log: 0003 CREATEs `weld`, 0010 retypes two of its
 * columns and adds another, 0006/0007/0011 each re-create the same matview.  A
 * checker that only reads `CREATE TABLE` therefore checks a schema that has not
 * existed since migration 0009.  This module replays the log instead.
 *
 * It is a deliberately small subset of DDL — the statements this project actually
 * uses.  Anything it does not understand is ignored rather than guessed at, so a
 * false PASS is possible for exotic DDL; add a case here when that day comes.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export interface TableSchema {
  name: string;
  /** column name -> declared type text (best effort). */
  columns: Map<string, string>;
  /** the migration file that last created it. */
  createdIn: string;
}

const NON_COLUMN_STARTS = new Set([
  "primary", "unique", "constraint", "foreign", "check", "exclude", "like",
]);

/**
 * Split SQL into statements on top-level `;`, respecting `--` comments,
 * '...' literals and $tag$...$tag$ dollar-quoted bodies (the cast helpers and the
 * DO blocks are full of semicolons).
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let start = 0;
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i);
      i = nl < 0 ? sql.length : nl + 1;
      continue;
    }
    if (ch === "'") {
      i += 1;
      while (i < sql.length && sql[i] !== "'") i += 1;
      i += 1;
      continue;
    }
    if (ch === "$") {
      const tag = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i));
      if (tag) {
        const close = sql.indexOf(tag[0], i + tag[0].length);
        i = close < 0 ? sql.length : close + tag[0].length;
        continue;
      }
    }
    if (ch === ";") {
      out.push(sql.slice(start, i));
      i += 1;
      start = i;
      continue;
    }
    i += 1;
  }
  if (sql.slice(start).trim().length > 0) out.push(sql.slice(start));
  return out;
}

/** Drop leading whitespace and `--` comment lines so a statement starts at its verb. */
function stripLeadingComments(s: string): string {
  let out = s;
  for (;;) {
    const next = out.replace(/^\s+/, "").replace(/^--[^\n]*\n?/, "");
    if (next === out) return out.replace(/^\s+/, "");
    out = next;
  }
}

function parseCreateColumns(body: string): Map<string, string> {
  const cols = new Map<string, string>();
  for (const rawLine of body.split("\n")) {
    const line = rawLine.replace(/--.*$/, "");
    const m = /^\s{2,}([a-z_][a-z0-9_]*)\s+(.+?)\s*,?\s*$/.exec(line);
    if (!m) continue;
    if (NON_COLUMN_STARTS.has(m[1])) continue;
    cols.set(m[1], m[2].trim());
  }
  return cols;
}

export interface ResolvedSchema {
  tables: Map<string, TableSchema>;
  /** every CREATE MATERIALIZED VIEW body, in file order, with its file. */
  matviews: { name: string; file: string; body: string }[];
  /** every CREATE [OR REPLACE] VIEW body, in file order. */
  views: { name: string; file: string; body: string }[];
  files: { file: string; sql: string; noTransaction: boolean }[];
}

export function resolveMigrations(dir: string): ResolvedSchema {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => {
      const sql = readFileSync(path.join(dir, f), "utf8");
      return { file: f, sql, noTransaction: sql.slice(0, 400).includes("-- migrate: no-transaction") };
    });

  const tables = new Map<string, TableSchema>();
  const matviews: ResolvedSchema["matviews"] = [];
  const views: ResolvedSchema["views"] = [];

  for (const { file, sql } of files) {
    for (const stmt of splitStatements(sql)) {
      const s = stripLeadingComments(stmt);

      const create =
        /^CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*)\)\s*$/i.exec(s);
      if (create) {
        const name = create[1];
        const ifNotExists = /IF\s+NOT\s+EXISTS/i.test(s.slice(0, 60));
        if (ifNotExists && tables.has(name)) continue;
        tables.set(name, { name, columns: parseCreateColumns(create[2]), createdIn: file });
        continue;
      }

      const drop = /^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/i.exec(s);
      if (drop) {
        tables.delete(drop[1]);
        continue;
      }

      const alter = /^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)([\s\S]*)$/i.exec(s);
      if (alter) {
        const t = tables.get(alter[1]);
        if (!t) continue;
        const body = alter[2].replace(/--.*$/gm, "");
        for (const m of body.matchAll(
          /\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s+([a-z]+(?:\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)/gi,
        )) {
          if (!t.columns.has(m[1])) t.columns.set(m[1], m[2].replace(/\s+/g, ""));
        }
        for (const m of body.matchAll(/\bDROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
          t.columns.delete(m[1]);
        }
        for (const m of body.matchAll(
          /\bALTER\s+COLUMN\s+([a-z_][a-z0-9_]*)\s+(?:SET\s+DATA\s+)?TYPE\s+([a-z]+(?:\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)/gi,
        )) {
          t.columns.set(m[1], m[2].replace(/\s+/g, ""));
        }
        continue;
      }

      const mv =
        /^CREATE\s+MATERIALIZED\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s+AS([\s\S]*)$/i.exec(s);
      if (mv) {
        matviews.push({ name: mv[1], file, body: mv[2].replace(/WITH\s+NO\s+DATA\s*$/i, "") });
        continue;
      }

      const v =
        /^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([a-z_][a-z0-9_]*)\s+AS([\s\S]*)$/i.exec(s);
      if (v) {
        views.push({ name: v[1], file, body: v[2] });
        continue;
      }
    }
  }

  return { tables, matviews, views, files };
}
