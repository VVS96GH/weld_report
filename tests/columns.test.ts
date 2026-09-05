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

/** §6.2 derived columns + the surrogate key. */
const DERIVED = new Set([
  "id",
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
]);

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
]);

function readLib(): Array<{ file: string; text: string }> {
  const dirs = ["lib/metrics", "lib"];
  const files: Array<{ file: string; text: string }> = [];
  for (const d of dirs) {
    for (const f of readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      if (!f.isFile() || !f.name.endsWith(".ts")) continue;
      const rel = path.join(d, f.name);
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
  }
  return refs;
}

describe("SQL column names exist in the schema contract", () => {
  it("references no unknown column", () => {
    const weld = new Set([...dumpColumns(), ...DERIVED]);
    expect(weld.size).toBeGreaterThan(200);

    const allowed: Record<string, Set<string>> = {
      weld,
      mv_weekly_progress: MV_WEEKLY_PROGRESS,
      weld_weekly_snapshot: WEEKLY_SNAPSHOT,
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
