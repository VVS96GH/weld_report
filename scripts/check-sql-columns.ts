/**
 * Offline read-through check.  SQL cannot be executed here (no Postgres on this
 * machine), so this proves by parsing that:
 *
 *  1. the pg column names in scripts/weld-columns.ts are byte-identical to the
 *     "pg column name" column of analysis/dump/profile.md §8.1 (the contract
 *     shared with the metrics lane);
 *  2. the committed migrations match what scripts/gen-schema-columns.ts produces;
 *  3. every column the loader's `COPY … (…)` names exists in stg_weld_dump;
 *  4. every column the loader's `INSERT INTO weld (…)` names exists in `weld`;
 *  5. every `s.<column>` the INSERT…SELECT reads exists in stg_weld_dump;
 *  6. every `w.<column>` mv_weekly_progress reads exists in `weld`.
 *
 *   node --import tsx scripts/check-sql-columns.ts
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, pgName, sourceColumns } from "./weld-columns";
import { buildStagingDdl, buildWeldDdl, buildWeldInsert, copyColumns } from "./weld-sql";

const NON_COLUMN_STARTS = new Set([
  "primary", "unique", "constraint", "foreign", "check", "exclude", "like",
]);

function migrationSql(): string {
  const dir = path.join(REPO_ROOT, "db", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
}

/** Column names declared by `CREATE [UNLOGGED] TABLE … (` blocks. */
function tableColumns(sql: string, table: string): Set<string> {
  const re = new RegExp(
    `CREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table}\\s*\\(`,
    "i",
  );
  const m = re.exec(sql);
  if (!m) throw new Error(`no CREATE TABLE for ${table}`);
  const body = sql.slice(m.index + m[0].length);
  const end = body.indexOf("\n);");
  if (end < 0) throw new Error(`unterminated CREATE TABLE for ${table}`);
  const out = new Set<string>();
  for (const line of body.slice(0, end).split("\n")) {
    const c = /^\s{2,}([a-z_][a-z0-9_]*)\s+\S/.exec(line);
    if (c && !NON_COLUMN_STARTS.has(c[1])) out.add(c[1]);
  }
  return out;
}

/** Column names selected by a `CREATE MATERIALIZED VIEW <name> AS` block. */
function matviewBody(sql: string, name: string): string {
  const re = new RegExp(
    `CREATE\\s+MATERIALIZED\\s+VIEW\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${name}\\s+AS`,
    "i",
  );
  const m = re.exec(sql);
  if (!m) throw new Error(`no CREATE MATERIALIZED VIEW for ${name}`);
  const body = sql.slice(m.index + m[0].length);
  const end = body.indexOf("WITH NO DATA");
  return end < 0 ? body : body.slice(0, end);
}

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function missing(used: Iterable<string>, declared: Set<string>): string[] {
  return [...new Set([...used])].filter((c) => !declared.has(c)).sort();
}

function main(): void {
  // ---- 1. the §8.1 name contract -----------------------------------------
  const profileMd = readFileSync(
    path.join(REPO_ROOT, "analysis", "dump", "profile.md"),
    "utf8",
  );
  const section = profileMd.split("### 8.1 Suggested column types")[1].split("### 8.2")[0];
  const contract: { index: number; clean: string; pg: string }[] = [];
  for (const line of section.split("\n")) {
    const m = /^\|\s*(\d+)\s*\|\s*`([^`]*)`\s*\|\s*`?([a-z0-9_]*)`?\s*\|/.exec(line);
    if (m) contract.push({ index: Number(m[1]), clean: m[2], pg: m[3] });
  }
  const dataContract = contract.filter((c) => c.index <= 223);
  const mine = sourceColumns();
  const nameDiff = dataContract.filter((c, i) => c.pg !== mine[i]?.pgName);
  check(
    `profile.md §8.1 pg column names (${dataContract.length} data columns)`,
    dataContract.length === 223 && nameDiff.length === 0,
    nameDiff.length ? `diverges at: ${nameDiff.slice(0, 5).map((d) => d.pg).join(", ")}` : "",
  );
  check(
    "pgName() round-trips every clean_name in §8.1",
    dataContract.every((c) => pgName(c.clean) === c.pg || c.pg.startsWith(pgName(c.clean))),
  );
  const dupes = new Set<string>();
  const seen = new Set<string>();
  for (const c of mine) {
    if (seen.has(c.pgName)) dupes.add(c.pgName);
    seen.add(c.pgName);
  }
  check("no duplicate pg column names among the 223", dupes.size === 0, [...dupes].join(", "));

  // ---- 2. committed SQL == generated SQL ---------------------------------
  const stagingFile = readFileSync(
    path.join(REPO_ROOT, "db/migrations/0002_stg_weld_dump.sql"),
    "utf8",
  );
  const weldFile = readFileSync(path.join(REPO_ROOT, "db/migrations/0003_weld.sql"), "utf8");
  check("0002_stg_weld_dump.sql is up to date", stagingFile === `${buildStagingDdl().trimEnd()}\n`);
  check("0003_weld.sql is up to date", weldFile === `${buildWeldDdl().trimEnd()}\n`);

  // ---- 3-6. read-through -------------------------------------------------
  const sql = migrationSql();
  const stg = tableColumns(sql, "stg_weld_dump");
  const weld = tableColumns(sql, "weld");
  check("stg_weld_dump has 223 data columns + load_id + line_no", stg.size === 225, `got ${stg.size}`);
  check(
    "weld has 194 typed + 2 identity + 3 bookkeeping + 11 placeholder + 7 derived + 2 generated = 219",
    weld.size === 219,
    `got ${weld.size}`,
  );

  const copyCols = copyColumns();
  check(
    `COPY column list (${copyCols.length}) exists in stg_weld_dump`,
    missing(copyCols, stg).length === 0,
    missing(copyCols, stg).join(", "),
  );

  const insertSql = buildWeldInsert();
  const insertCols = /INSERT INTO weld \(([\s\S]*?)\n\)/.exec(insertSql);
  if (!insertCols) throw new Error("could not parse the INSERT column list");
  const targets = insertCols[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  check(
    `INSERT INTO weld column list (${targets.length}) exists in weld`,
    missing(targets, weld).length === 0,
    missing(targets, weld).join(", "),
  );

  const staged = [...insertSql.matchAll(/\bs\.([a-z_][a-z0-9_]*)/g)].map((m) => m[1]);
  check(
    `INSERT…SELECT reads ${new Set(staged).size} distinct s.<column>, all in stg_weld_dump`,
    missing(staged, stg).length === 0,
    missing(staged, stg).join(", "),
  );

  const mv = matviewBody(sql, "mv_weekly_progress");
  const mvCols = [...mv.matchAll(/\bw\.([a-z_][a-z0-9_]*)/g)].map((m) => m[1]);
  check(
    `mv_weekly_progress reads ${new Set(mvCols).size} distinct w.<column>, all in weld`,
    missing(mvCols, weld).length === 0,
    missing(mvCols, weld).join(", "),
  );

  const view = /CREATE OR REPLACE VIEW nde_result AS([\s\S]*?);\n/.exec(sql);
  check("nde_result view found", view !== null);
  if (view) {
    // Every bare identifier in the view body must be a `weld` column, apart from
    // SQL keywords, the table name and the view's own output aliases.
    const NOISE = new Set([
      "select", "from", "union", "all", "as", "null", "text", "weld",
      "method", "pct", "weld_status", "done_date", "report", "acc_rej",
    ]);
    const identifiers = [...view[1].matchAll(/\b([a-z_][a-z0-9_]*)\b/g)]
      .map((m) => m[1])
      .filter((t) => !NOISE.has(t));
    check(
      `nde_result reads ${new Set(identifiers).size} distinct columns, all in weld`,
      missing(identifiers, weld).length === 0,
      missing(identifiers, weld).join(", "),
    );
  }

  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) FAILED`);
  if (failures > 0) process.exitCode = 1;
}

main();
