/**
 * Static check: every column name this lane's SQL references must exist in the
 * schema contract.
 *
 * The contract is:
 *   • `analysis/dump/profile.md` §8.1, column `pg column name` — the 226 dump
 *     columns (parsed here, not transcribed, so it cannot drift);
 *   • the derived columns of `analysis/calculation-logic.md` §6.2;
 *   • the supporting tables of §6.3 / §6.5.
 *
 * Runs with no database. A failure here means either a typo or a schema
 * request that must go to DB-LANE as DDL — never a silent invention.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** §8.1 `pg column name` column, parsed straight out of the profile. */
function dumpColumns(): Set<string> {
  const md = readFileSync(path.join(ROOT, "analysis/dump/profile.md"), "utf8");
  const out = new Set<string>();
  const row = /^\|\s*\d+\s*\|\s*`[^`]*`\s*\|\s*`([a-z0-9_]+)`\s*\|/gm;
  let m: RegExpExecArray | null;
  while ((m = row.exec(md)) !== null) out.add(m[1]);
  return out;
}

/** §6.2 derived columns, the surrogate key, and the 0003 "M placeholder" set. */
const DERIVED = new Set([
  "id",
  "load_id",
  "source",
  "joint_id",
  "spool_id",
  "rt_film_total",
  "repair_reweld",
  "service_class_cat_wd",
  "service_class_cat_ndt",
  "temporary_lines",
  "tmcp_pipe",
  "exclude_ut_films",
  "exclude_debris_films",
  "is_cancelled",
  // Blank placeholders in 0003 that CCC's export fills
  // (project-wd-wr-inco-acciona.md §5.2).
  "rt_ut",
  "ndt_remarks",
  "tracer_shot",
  "weld_point_code",
  "original_joint",
  "repair_suffix",
  "pwht_y_n_ccc",
  "pwht_report_no_ccc",
  "pwht_date_no_ccc",
  "spool_status",
  "ha",
]);

/**
 * Batch-2 additions, parsed out of the migrations rather than transcribed, so
 * the contract cannot drift from `db/migrations/0010_batch2_schema.sql`.
 */
function batch2Columns(): Set<string> {
  const out = new Set<string>();
  const dir = path.join(ROOT, "db/migrations");
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".sql")) continue;
    const sql = readFileSync(path.join(dir, f), "utf8");
    for (const m of sql.matchAll(/ADD COLUMN IF NOT EXISTS\s+([a-z0-9_]+)/gi)) {
      out.add(m[1]);
    }
  }
  return out;
}

/**
 * `mv_joint` (migration 0013) — the joint-grain rollup every measure reads.
 * Aliased `w`, the same as `weld`, because `scopeConditions` builds one WHERE
 * for both, so its output columns join the `weld` allow-list.
 */
function mvJointColumns(): Set<string> {
  const sql = readFileSync(
    path.join(ROOT, "db/migrations/0013_mv_joint.sql"),
    "utf8",
  );
  const out = new Set<string>();
  for (const m of sql.matchAll(/\bAS\s+([a-z][a-z0-9_]*)\s*,?\s*$/gim)) out.add(m[1]);
  for (const m of sql.matchAll(/^\s*w\.([a-z][a-z0-9_]*),\s*$/gim)) out.add(m[1]);
  return out;
}

/** `spool` (R2-06) — aliased `sp` in lib/metrics/scope.ts. */
function spoolColumns(): Set<string> {
  const sql = readFileSync(
    path.join(ROOT, "db/migrations/0010_batch2_schema.sql"),
    "utf8",
  );
  const block = sql.slice(sql.indexOf("CREATE TABLE spool ("));
  const body = block.slice(0, block.indexOf("PRIMARY KEY"));
  const out = new Set<string>();
  for (const m of body.matchAll(/^\s{2}([a-z0-9_]+)\s+[a-z]/gim)) out.add(m[1]);
  return out;
}

/** `ref_ut_tracker_ccc` (R2-14) — aliased `t` in lib/metrics/ut.ts. */
function utTrackerColumns(): Set<string> {
  const sql = readFileSync(
    path.join(ROOT, "db/migrations/0010_batch2_schema.sql"),
    "utf8",
  );
  const block = sql.slice(sql.indexOf("CREATE TABLE IF NOT EXISTS ref_ut_tracker_ccc ("));
  const body = block.slice(0, block.indexOf(");"));
  const out = new Set<string>();
  for (const m of body.matchAll(/^\s{2}([a-z0-9_]+)\s+[a-z]/gim)) out.add(m[1]);
  return out;
}

/** §6.5 `mv_weekly_progress`, per db/migrations/0006_views.sql. */
const MV_WEEKLY_PROGRESS = new Set([
  "week_end_date",
  "source",
  "sub_contractor",
  "weld_cat",
  "weld_type",
  "joints_welded",
  "joints_welded_incl_repairs",
  "tested",
  "rejected",
  "rt_backlog",
  "rt100_backlog",
  "pwht_backlog",
  "pwht_done",
  "films_taken",
  "films_accepted",
  "films_rejected",
  "weld_length_m",
  "rej_length_m",
  "joints_in_group",
  "rows_in_group",
]);

/** §6.3 `weld_weekly_snapshot` (ruling R-08), per db/migrations/0004_reference.sql. */
const WEEKLY_SNAPSHOT = new Set([
  "week_end_date",
  "sub_contractor",
  "metric",
  "value",
  "load_id",
  "recorded_at",
  // R2-08
  "scope",
  "label_raw",
]);

/**
 * `lib/metrics/flange.ts` queries a different fact table under the alias `f`,
 * and uses `m`/`r`/`s`/`w` freely as JavaScript identifiers. Scanning it with
 * the `weld` alias patterns produces only false positives, so it is scanned on
 * its own terms below.
 */
const FLANGE_FILE = "lib/metrics/flange.ts";

function readLib(): Array<{ file: string; text: string }> {
  const dirs = ["lib/metrics", "lib"];
  const files: Array<{ file: string; text: string }> = [];
  for (const d of dirs) {
    for (const f of readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      if (!f.isFile() || !f.name.endsWith(".ts")) continue;
      const rel = path.join(d, f.name);
      if (rel === FLANGE_FILE) continue;
      files.push({ file: rel, text: readFileSync(path.join(ROOT, rel), "utf8") });
    }
  }
  // `lib/pages/welding.ts` carries SQL only inside quoted strings; scan those.
  const pagesFile = "lib/pages/welding.ts";
  const pages = readFileSync(path.join(ROOT, pagesFile), "utf8");
  const literals = pages.match(/"[^"\n]*"/g) ?? [];
  files.push({ file: pagesFile, text: literals.join("\n") });
  return files;
}

type Ref = { file: string; alias: string; column: string };

function collectRefs(): Ref[] {
  const refs: Ref[] = [];
  for (const { file, text } of readLib()) {
    // `w.col` / `b.col` (the weld table and the aging CTE derived from it),
    // and the alias-parameterised `${a}.col` form used by the fragment builders.
    for (const m of text.matchAll(/\b([wb])\.([a-z][a-z0-9_]*)\b/g)) {
      refs.push({ file, alias: "weld", column: m[2] });
    }
    for (const m of text.matchAll(/\$\{a\}\.([a-z][a-z0-9_]*)\b/g)) {
      refs.push({ file, alias: "weld", column: m[1] });
    }
    for (const m of text.matchAll(/\bm\.([a-z][a-z0-9_]*)\b/g)) {
      refs.push({ file, alias: "mv_weekly_progress", column: m[1] });
    }
    for (const m of text.matchAll(/\bs\.([a-z][a-z0-9_]*)\b/g)) {
      refs.push({ file, alias: "weld_weekly_snapshot", column: m[1] });
    }
    for (const m of text.matchAll(/\bsp\.([a-z][a-z0-9_]*)\b/g)) {
      refs.push({ file, alias: "spool", column: m[1] });
    }
    for (const m of text.matchAll(/\bt\.([a-z][a-z0-9_]*)\b/g)) {
      refs.push({ file, alias: "ref_ut_tracker_ccc", column: m[1] });
    }
  }
  return refs;
}

/** `flange` (migration 0015), aliased `f` in lib/metrics/flange.ts. */
function flangeColumns(): Set<string> {
  const file = path.join(ROOT, "db/migrations/0015_flange.sql");
  const out = new Set<string>();
  try {
    const sql = readFileSync(file, "utf8");
    const block = sql.slice(sql.indexOf("CREATE TABLE IF NOT EXISTS flange ("));
    const body = block.slice(0, block.indexOf("\n);"));
    for (const m of body.matchAll(/^\s{2}([a-z][a-z0-9_]*)\s+[a-z]/gim)) out.add(m[1]);
  } catch {
    /* migration not shipped yet */
  }
  return out;
}

describe("flange column names exist in migration 0015", () => {
  it("references no unknown flange column", () => {
    const allowed = flangeColumns();
    if (allowed.size === 0) {
      console.log("[columns.test] 0015_flange.sql not present — flange scan skipped");
      return;
    }
    const text = readFileSync(path.join(ROOT, FLANGE_FILE), "utf8");
    const refs = [
      ...[...text.matchAll(/\bf\.([a-z][a-z0-9_]*)\b/g)].map((m) => m[1]),
      // The `${C.x}` interpolations resolve through FLANGE_COLUMNS; check the
      // literal values that object holds.
      ...[...text.matchAll(/^\s{2}[a-zA-Z]+:\s*"([a-z][a-z0-9_]*)",$/gm)].map((m) => m[1]),
    ];
    const distinct = [...new Set(refs)];
    const unknown = distinct.filter((c) => !allowed.has(c));
    console.log(
      `[columns.test] flange: ${refs.length} references, ${distinct.length} distinct, ` +
        `${unknown.length} unknown${unknown.length ? `: ${unknown.join(", ")}` : ""}`,
    );
    expect(unknown).toEqual([]);
  });
});

describe("SQL column names exist in the schema contract", () => {
  it("references no unknown column", () => {
    const weld = new Set([
      ...dumpColumns(),
      ...DERIVED,
      ...batch2Columns(),
      ...mvJointColumns(),
    ]);
    expect(weld.size).toBeGreaterThan(230);

    const allowed: Record<string, Set<string>> = {
      weld,
      mv_weekly_progress: MV_WEEKLY_PROGRESS,
      weld_weekly_snapshot: WEEKLY_SNAPSHOT,
      spool: spoolColumns(),
      ref_ut_tracker_ccc: utTrackerColumns(),
    };

    const refs = collectRefs();
    const unknown = refs.filter((r) => !allowed[r.alias].has(r.column));
    const distinct = new Set(refs.map((r) => `${r.alias}.${r.column}`));

    console.log(
      `[columns.test] ${refs.length} column references, ` +
        `${distinct.size} distinct, ${unknown.length} unknown` +
        (unknown.length
          ? `: ${[...new Set(unknown.map((u) => `${u.file} → ${u.alias}.${u.column}`))].join(", ")}`
          : ""),
    );
    console.log(
      `[columns.test] distinct: ${[...distinct].sort().join(", ")}`,
    );

    expect(unknown).toEqual([]);
  });
});
