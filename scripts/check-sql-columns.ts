/**
 * Offline read-through check.  SQL cannot be executed here (this lane never runs
 * a database), so this proves by parsing that the migrations, the generator and
 * the loaders agree.
 *
 * It replays the migration log through scripts/sql-schema.ts rather than reading
 * only `CREATE TABLE`, because the log is append-only: 0003 creates `weld`, 0010
 * retypes two of its columns and adds another, and three separate files create
 * `mv_weekly_progress`.  Checking the CREATE alone would check a schema that has
 * not existed since 0009.
 *
 *   node --import tsx scripts/check-sql-columns.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, pgName, sourceColumns } from "./weld-columns";
import { buildStagingDdl, buildWeldDdl, buildWeldInsert, copyColumns } from "./weld-sql";
import { resolveMigrations, type TableSchema } from "./sql-schema";
import {
  CCC_JOINT_PWHT_COLUMNS, CCC_JOINT_WELD_COLUMNS, CCC_OVERLAY_COLUMNS,
  ACCIONA_WELD_COLUMNS, CCC_WELDER_WELD_COLUMNS, INCO_WELD_COLUMNS,
  SPOOL_DUMP_MAP, TALISMAN_SPOOL_MAP, spoolColumns,
} from "./load-columns";
import {
  EXCLUDED_JOINT_IDS, WELD_TYPE_STEPS, normaliseWeldType, repairRewaldPrAll,
} from "./ccc-columns";
import { POST_LOAD_MATVIEWS } from "./load-common";

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function missing(used: Iterable<string>, declared: Set<string>): string[] {
  return [...new Set([...used])].filter((c) => !declared.has(c)).sort();
}

function names(t: TableSchema | undefined): Set<string> {
  return new Set(t ? t.columns.keys() : []);
}

/** The `weld` column targets named by analysis/sources2/ccc-column-map.md §A and §B. */
function cccTargets(): { targets: string[]; dropped: string[] } {
  const md = readFileSync(path.join(REPO_ROOT, "analysis/sources2/ccc-column-map.md"), "utf8");
  const secA = md.split("## A.")[1]?.split("## B.")[0] ?? "";
  const secB = md.split("## B.")[1]?.split("## C.")[0] ?? "";
  const out = new Set<string>();
  const cell = (line: string, i: number) => {
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
    return (cells[i] ?? "").trim().replace(/^`|`$/g, "");
  };
  for (const line of secA.split("\n")) {
    if (!line.startsWith("|") || line.includes("---")) continue;
    const v = cell(line, 2);
    if (/^[a-z_][a-z0-9_]*$/.test(v)) out.add(v);
  }
  for (const line of secB.split("\n")) {
    if (!line.startsWith("|") || line.includes("---")) continue;
    const v = cell(line, 1);
    if (/^[a-z_][a-z0-9_]*$/.test(v)) out.add(v);
  }
  // Columns the map names that `weld` deliberately does NOT have.
  //  * the three last_reshoot_*.1 spellings the M meant to drop (empty in all
  //    5,430,732 CCC rows) — the map itself says "drop both spellings";
  //  * ht_batch_no / ht_batch_status, which the M adds BLANK for CCC and which are
  //    two of the 29 columns empty in all 1,001,114 dump rows, so `weld` never
  //    created them (profile.md §8.3). Empty in both sources = no column.
  const dropped = [
    "last_reshoot_date1", "last_reshoot_report_no1", "last_reshoot_result1",
    "ht_batch_no", "ht_batch_status",
  ];
  for (const d of dropped) out.delete(d);
  return { targets: [...out].sort(), dropped };
}

function main(): void {
  // ---- 1. the §8.1 name contract -----------------------------------------
  const profileMd = readFileSync(path.join(REPO_ROOT, "analysis/dump/profile.md"), "utf8");
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

  // ---- 2. committed generated SQL == generator output ---------------------
  const stagingFile = readFileSync(path.join(REPO_ROOT, "db/migrations/0002_stg_weld_dump.sql"), "utf8");
  const weldFile = readFileSync(path.join(REPO_ROOT, "db/migrations/0003_weld.sql"), "utf8");
  check("0002_stg_weld_dump.sql is up to date", stagingFile === `${buildStagingDdl().trimEnd()}\n`);
  check("0003_weld.sql is up to date", weldFile === `${buildWeldDdl().trimEnd()}\n`);

  // ---- 3. the effective schema, after replaying every migration ----------
  const schema = resolveMigrations(path.join(REPO_ROOT, "db", "migrations"));
  const stg = names(schema.tables.get("stg_weld_dump"));
  const weld = names(schema.tables.get("weld"));
  const weldTypes = schema.tables.get("weld")?.columns ?? new Map<string, string>();

  check("stg_weld_dump has 223 data columns + load_id + line_no", stg.size === 225, `got ${stg.size}`);
  check(
    "weld effective column count = 247 (219 after 0008; +23 in 0010, +4 in 0012, +1 in 0014)",
    weld.size === 247,
    `got ${weld.size}`,
  );

  // ---- 4. batch-1 read-through (COPY / INSERT / views) --------------------
  const copyCols = copyColumns();
  check(
    `COPY column list (${copyCols.length}) exists in stg_weld_dump`,
    missing(copyCols, stg).length === 0,
    missing(copyCols, stg).join(", "),
  );

  const insertSql = buildWeldInsert();
  const insertCols = /INSERT INTO weld \(([\s\S]*?)\n\)/.exec(insertSql);
  if (!insertCols) throw new Error("could not parse the INSERT column list");
  const targets = insertCols[1].split(",").map((s) => s.trim()).filter(Boolean);
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

  const mvCols = schema.matviews
    .filter((m) => m.name === "mv_weekly_progress")
    .flatMap((m) => [...m.body.matchAll(/\bw\.([a-z_][a-z0-9_]*)/g)].map((x) => x[1]));
  check(
    `mv_weekly_progress (${schema.matviews.length} definitions, current = ${schema.matviews.at(-1)?.file}) reads ${new Set(mvCols).size} distinct w.<column>, all in weld`,
    missing(mvCols, weld).length === 0,
    missing(mvCols, weld).join(", "),
  );

  const nde = schema.views.find((v) => v.name === "nde_result");
  check("nde_result view found", nde !== undefined);
  if (nde) {
    const NOISE = new Set([
      "select", "from", "union", "all", "as", "null", "text", "weld",
      "method", "pct", "weld_status", "done_date", "report", "acc_rej",
    ]);
    const ids = [...nde.body.matchAll(/\b([a-z_][a-z0-9_]*)\b/g)]
      .map((m) => m[1])
      .filter((t) => !NOISE.has(t));
    check(
      `nde_result reads ${new Set(ids).size} distinct columns, all in weld`,
      missing(ids, weld).length === 0,
      missing(ids, weld).join(", "),
    );
  }

  // ---- 5. batch-2: rulings R2-03, R2-04, R2-06, R2-08, R2-11, R2-14 ------
  const noTx = schema.files.filter((f) => f.noTransaction).map((f) => f.file);
  check(
    "0009 is marked `-- migrate: no-transaction` (ALTER TYPE … ADD VALUE)",
    noTx.length === 1 && noTx[0] === "0009_weld_source_ccc_joint_record.sql",
    noTx.join(", ") || "no file carries the marker",
  );
  const f0009 = schema.files.find((f) => f.file.startsWith("0009"))?.sql ?? "";
  check(
    "R2-03: 0009 adds the CCC_JOINT_RECORD enum value, idempotently",
    /ALTER\s+TYPE\s+weld_source\s+ADD\s+VALUE\s+IF\s+NOT\s+EXISTS\s+'CCC_JOINT_RECORD'/i.test(f0009),
  );

  for (const c of ["total_no_of_films_acc", "total_no_of_films_rej", "rt_film_total"]) {
    check(`R2-04: weld.${c} is numeric(10,4)`, weldTypes.get(c)?.startsWith("numeric(10,4)") === true,
      weldTypes.get(c) ?? "ABSENT");
  }
  check("weld.area_classification_label exists (CCC's text Area Classification vocabulary)",
    weld.has("area_classification_label"));
  check("weld.area_classification is still integer (dump-only numeric code)",
    weldTypes.get("area_classification") === "integer", weldTypes.get("area_classification") ?? "ABSENT");

  const allSql = schema.files.map((f) => f.sql).join("\n");
  for (const branch of ["YYYY/MM/DD", "YYYY-MM-DD", "DD-MON-YYYY", "DD-MON-YY"]) {
    check(`R2-11: weld_to_date has a ${branch} branch`, allSql.includes(`'${branch}'`));
  }

  const expected: Record<string, string[]> = {
    spool: ["source", "spool_id", "load_id", "iso_number", "spool_no", "fabricated", "qc_release",
      "painted", "to_site", "erected", "spool_nde_status", "revision_status", "spool_weight",
      "fabrication_order", "shop_nde_done", "field_nde_done", "paint_report_no"],
    ccc_joint_pwht: ["joint_id_jr", "load_id", "pwht_y_n", "pwht_report_no", "pwht_date",
      "ht_report_no", "ht_date", "is_welded", "source_rows", "is_ambiguous"],
    ref_exclusion_list: ["rt_report", "welder", "joint_id", "reason", "loaded_at"],
    ref_ut_tracker_ccc: ["qciso_no", "joint_no", "spool_no", "ut1_date", "ut1_rep_no", "ut1_result",
      "weld_defect_length", "tpi_date", "tpi_report_no", "pwht_date", "pwht_rep_no", "joint_id"],
    ref_mpi_done: ["week_end_date", "mpi_done", "mpi_pt_done"],
    ref_active_welders: ["week_end_date", "sub_contractor", "welders", "label_raw"],
    weld_weekly_snapshot: ["week_end_date", "sub_contractor", "scope", "metric", "value", "label_raw"],
  };
  for (const [table, cols] of Object.entries(expected)) {
    const have = names(schema.tables.get(table));
    check(
      `${table} exists with its ${cols.length} contract columns`,
      have.size > 0 && missing(cols, have).length === 0,
      have.size === 0 ? "table absent" : missing(cols, have).join(", "),
    );
  }

  check("R2-08: weld_weekly_snapshot PK is (week_end_date, sub_contractor, scope, metric)",
    /ADD\s+CONSTRAINT\s+weld_weekly_snapshot_pkey\s+PRIMARY\s+KEY\s*\(\s*week_end_date,\s*sub_contractor,\s*scope,\s*metric\s*\)/i.test(allSql));

  for (const src of ["SPOOL_DUMP", "TALISMAN_SPOOL", "WEEKLY_SNAPSHOT", "UT_TRACKER_CCC",
    "EXCLUSION_LIST", "CCC_JOINT_RECORD", "CCC_WELDER_RECORD", "MPI_DONE", "ACTIVE_WELDERS"]) {
    check(`load.source vocabulary accepts '${src}'`,
      new RegExp(`load_source_vocabulary[\\s\\S]*'${src}'`).test(allSql));
  }

  // ---- 6. the CCC loader's target columns all exist -----------------------
  const { targets: cccCols, dropped } = cccTargets();
  check(
    `ccc-column-map.md names ${cccCols.length} weld target columns, all present`,
    cccCols.length > 60 && missing(cccCols, weld).length === 0,
    missing(cccCols, weld).join(", "),
  );
  check(
    `the ${dropped.length} all-empty CCC map columns are intentionally NOT created`,
    dropped.every((d) => !weld.has(d)),
    dropped.filter((d) => weld.has(d)).join(", "),
  );

  // ---- 7. the PR-all columns (project-wd-wr-inco-acciona.md §5.3) ---------
  const prAll = {
    "§5.3 #1-#5 materialised": ["weldpoint_seq", "welder_id", "testpack_no_all", "ha"],
    "§5.3 #8 UT-tracker overlays (kept SEPARATE from the raw columns)": [
      "manual_ut_report_no_all", "manual_ut_status_all", "manual_ut_date_all",
      "ut_operator_id_all", "ut_report_all", "ut_date_all"],
    "§5.3 #7 CCC NDE branches from the joint record": [
      "pwht_y_n_ccc", "pwht_report_no_ccc", "pwht_date_no_ccc",
      "mt_report_ccc", "mt_date_ccc", "mt_pct_ccc",
      "pt_report_ccc", "pt_date_ccc", "pt_pct_ccc",
      "pmi_report_ccc", "pmi_date_ccc", "ht_report_ccc", "ht_date_ccc",
      "dwir_ccc_from_jr", "thickness_from_jr", "rework_code_all"],
  };
  for (const [label, cols] of Object.entries(prAll)) {
    check(`weld has the ${cols.length} columns of ${label}`,
      missing(cols, weld).length === 0, missing(cols, weld).join(", "));
  }
  for (const [raw, overlay] of [
    ["manual_ut_report_no", "manual_ut_report_no_all"],
    ["manual_ut_status", "manual_ut_status_all"],
    ["manual_ut_date", "manual_ut_date_all"],
    ["ut_operator_id", "ut_operator_id_all"],
  ] as [string, string][]) {
    check(`the ${raw} / ${overlay} pair is two columns, not merged (addendum 2)`,
      weld.has(raw) && weld.has(overlay));
  }
  const jr = names(schema.tables.get("ccc_joint_pwht"));
  const jrCols = ["mt_root_report_no", "mt_root_date", "mt_root_pct", "mt_cap_pct",
    "pt_root_report_no", "pt_root_date", "pt_root_pct", "pt_cap_pct",
    "pmi_report_no", "pmi_date", "weld_report_no", "test_package_no",
    "sub_system_no", "wall_thickness", "rework_code"];
  check(`ccc_joint_pwht carries the ${jrCols.length} extra joint-record columns the CCC branches read`,
    missing(jrCols, jr).length === 0, missing(jrCols, jr).join(", "));
  for (const idx of ["weld_welder_id", "weld_wp1", "weld_testpack_all"]) {
    check(`index ${idx} is created`, new RegExp(`CREATE INDEX IF NOT EXISTS ${idx}\\b`).test(allSql));
  }


  // ---- 8. the batch-2 LOADERS' column lists (deliverable 2) ---------------
  const spoolCols = names(schema.tables.get("spool"));
  const jrTable = names(schema.tables.get("ccc_joint_pwht"));
  const loaderLists: [string, readonly string[], Set<string>][] = [
    ["load-spool-dump.ts SPOOL_DUMP -> spool", spoolColumns(SPOOL_DUMP_MAP), spoolCols],
    ["load-spool-dump.ts TALISMAN_SPOOL -> spool", spoolColumns(TALISMAN_SPOOL_MAP), spoolCols],
    ["load-ccc-joint-record.ts -> ccc_joint_pwht", CCC_JOINT_PWHT_COLUMNS, jrTable],
    ["load-ccc-joint-record.ts -> weld", CCC_JOINT_WELD_COLUMNS, weld],
    ["load-ccc-welder-record.ts -> weld", CCC_WELDER_WELD_COLUMNS, weld],
    ["load-ccc-welder-record.ts overlay UPDATE -> weld", CCC_OVERLAY_COLUMNS, weld],
  ];
  for (const [label, cols, declared] of loaderLists) {
    check(`${label}: all ${cols.length} columns exist`,
      missing(cols, declared).length === 0, missing(cols, declared).join(", "));
  }
  // A loader must never write a GENERATED column — Postgres rejects the COPY.
  const generated = ["rt_film_total", "is_cancelled"];
  for (const [label, cols] of loaderLists) {
    const bad = generated.filter((gcol) => (cols as readonly string[]).includes(gcol));
    check(`${label}: writes no GENERATED column`, bad.length === 0, bad.join(", "));
  }
  // The M's four hard-coded Joint IDs must be the same in the code and in the seed.
  const seeded = [...allSql.matchAll(/\('([0-9A-Z]+-[0-9A-Z]+-SP\d+-\d+)',\s*'M step/g)].map((m) => m[1]);
  check("weld_manual_exclusion seeds the same 4 Joint IDs the CCC loaders skip",
    seeded.length === 4 && seeded.every((j) => EXCLUDED_JOINT_IDS.has(j))
      && EXCLUDED_JOINT_IDS.size === 4,
    `migration: ${seeded.join(", ")} | code: ${[...EXCLUDED_JOINT_IDS].join(", ")}`);
  check("the Weld Type normalisation is 17 ORDERED steps (order is load-bearing)",
    WELD_TYPE_STEPS.length === 17, `got ${WELD_TYPE_STEPS.length}`);
  check("normaliseWeldType collapses RPDSA via RPDA, proving the order is applied",
    normaliseWeldType("RPDSA") === "RPD" && normaliseWeldType("SOBUA") === "SOB"
      && normaliseWeldType("BW") === "BW");
  check("repairRewaldPrAll has the DAX's 4 categories incl. RS1 as its own (R2-12)",
    repairRewaldPrAll("CCC", "X-SP1-1R1", "") === "Repair"
      && repairRewaldPrAll("CCC", "X-SP1-1RW", "") === "Reweld"
      && repairRewaldPrAll("CCC", "X-SP1-1", "RS1") === "RS1"
      && repairRewaldPrAll("CCC", "X-SP1-1", "") === ""
      && repairRewaldPrAll("Inco", "X-SP1-1R1", "") === "");
  check("weld_length_by_dia is still EMPTY-by-design (Weld Length.xlsx absent)",
    schema.tables.has("weld_length_by_dia") && weld.has("weld_length_m"));


  // ---- 9. mv_joint / mv_joint_wps (migration 0013) and the post-load refresh --
  const mvNames = new Set(schema.matviews.map((m) => m.name));
  const spoolTable = names(schema.tables.get("spool"));
  for (const mv of ["mv_joint", "mv_joint_wps"]) {
    check(`${mv} is defined in the migration log`, mvNames.has(mv));
    const bodies = schema.matviews.filter((m) => m.name === mv);
    const wCols = bodies.flatMap((b) =>
      [...b.body.matchAll(/\bw\.([a-z_][a-z0-9_]*)/g)].map((x) => x[1]));
    check(`${mv} reads ${new Set(wCols).size} distinct w.<column>, all in weld`,
      missing(wCols, weld).length === 0, missing(wCols, weld).join(", "));
    const spCols = bodies.flatMap((b) =>
      [...b.body.matchAll(/\bsp\.([a-z_][a-z0-9_]*)/g)].map((x) => x[1]));
    check(`${mv} reads ${new Set(spCols).size} distinct sp.<column>, all in spool`,
      missing(spCols, spoolTable).length === 0, missing(spCols, spoolTable).join(", "));
    // CONCURRENTLY is impossible without a non-partial unique index.
    check(`${mv} has the UNIQUE index CONCURRENTLY requires`,
      new RegExp(`CREATE UNIQUE INDEX[^;]*ON ${mv}\\b`).test(allSql));
  }
  // The loaders refresh exactly these three, in this order.
  check("POST_LOAD_MATVIEWS lists mv_weekly_progress, mv_joint, mv_joint_wps in order",
    POST_LOAD_MATVIEWS.map((m) => m.name).join(",")
      === "mv_weekly_progress,mv_joint,mv_joint_wps",
    POST_LOAD_MATVIEWS.map((m) => m.name).join(","));
  check("every matview the loaders refresh exists in the migration log",
    POST_LOAD_MATVIEWS.every((m) => mvNames.has(m.name)),
    POST_LOAD_MATVIEWS.filter((m) => !mvNames.has(m.name)).map((m) => m.name).join(", "));
  // All four loaders must refresh; a load that skips one leaves the pages stale.
  for (const f of ["load-weld-dump.ts", "load-ccc-joint-record.ts",
    "load-ccc-welder-record.ts", "load-spool-dump.ts"]) {
    const src = readFileSync(path.join(REPO_ROOT, "scripts", f), "utf8");
    const calls = src.includes("refreshMatviews(client)");
    const handRolled = /REFRESH MATERIALIZED VIEW/.test(src.replace(/\/\*[\s\S]*?\*\//g, ""));
    check(`${f} refreshes all three matviews via refreshMatviews(), after COMMIT`,
      calls && !handRolled,
      calls ? (handRolled ? "still has a hand-rolled REFRESH statement" : "") : "no refreshMatviews() call");
  }


  // ---- 10. batch 3 (migration 0014, rulings R3-01..R3-15) -----------------
  const b3Tables: Record<string, string[]> = {
    ref_code_label: ["domain", "code", "description"],
    ref_qualified_welders: ["sub_contractor", "qualified_welders", "active_welders",
      "active_piping_welders", "as_of", "source_note"],
    ref_welder_qualification: ["load_id", "discipline", "welder_name", "wqt_no", "welder_no",
      "wps_no", "date_of_test", "status", "sub_contractor", "sub_contractor_raw",
      "welder_id_name", "welder_id_code_sub"],
    ref_welder_status_weekly: ["week_end_date", "sub_contractor", "category", "value",
      "category_raw", "period_raw", "week_raw"],
  };
  for (const [t, cols] of Object.entries(b3Tables)) {
    const have = names(schema.tables.get(t));
    check(`${t} exists with its ${cols.length} contract columns`,
      have.size > 0 && missing(cols, have).length === 0,
      have.size === 0 ? "table absent" : missing(cols, have).join(", "));
  }
  check("R3-04: weld.sub_contractor_tier exists (Acciona's FOURTH DIMENSION / DEBAJ)",
    weld.has("sub_contractor_tier"));
  check("R3-07: weld_length_by_dia.weld_length is numeric(12,9)",
    schema.tables.get("weld_length_by_dia")?.columns.get("weld_length") === "numeric(12,9)",
    schema.tables.get("weld_length_by_dia")?.columns.get("weld_length") ?? "ABSENT");
  // Found while writing the Inco loader: mm values up to 7,957 in a numeric(5,4).
  for (const c of ["weld_length", "rej_length"]) {
    check(`weld.${c} is numeric(12,4) — Inco files MILLIMETRES in it`,
      weldTypes.get(c) === "numeric(12,4)", weldTypes.get(c) ?? "ABSENT");
  }
  check("ref_code_label is marked NOT A PBIX REPRODUCTION in its COMMENT (R3-08)",
    /COMMENT ON TABLE ref_code_label[\s\S]{0,200}NOT A PBIX REPRODUCTION/.test(allSql));
  for (const src of ["WELDERS_SCTR", "WELDERS_QUALIFICATION", "WELDER_STATUS_WEEKLY",
    "CODE_LABELS", "ACCIONA", "INCO", "WELD_LENGTH"]) {
    check(`load.source vocabulary accepts '${src}'`,
      new RegExp(`load_source_vocabulary[\\s\\S]*'${src}'`).test(allSql));
  }
  const b3Loaders: [string, readonly string[]][] = [
    ["load-acciona.ts -> weld", ACCIONA_WELD_COLUMNS],
    ["load-inco.ts -> weld", INCO_WELD_COLUMNS],
  ];
  for (const [label, cols] of b3Loaders) {
    check(`${label}: all ${cols.length} columns exist`,
      missing(cols, weld).length === 0, missing(cols, weld).join(", "));
    const gen = ["rt_film_total", "is_cancelled"].filter((g) => (cols as readonly string[]).includes(g));
    check(`${label}: writes no GENERATED column`, gen.length === 0, gen.join(", "));
    // The metrics lane's mv_joint WP1 gate is
    // `CASE source WHEN 'WELD_DUMP' THEN weldpoint_no = 1 ELSE weldpoint_seq = 1 END`,
    // so a non-dump loader that omits weldpoint_seq silently drops its source from
    // M23/M24/M33. Every batch-2/3 loader must write it.
    check(`${label}: writes weldpoint_seq (the mv_joint WP1 gate)`,
      (cols as readonly string[]).includes("weldpoint_seq"));
  }
  check("load-inco.ts writes manual_ut_report_no_all (the DAX's Inco branch)",
    (INCO_WELD_COLUMNS as readonly string[]).includes("manual_ut_report_no_all"));
  check("CCC_WELDER_WELD_COLUMNS also writes weldpoint_seq",
    (CCC_WELDER_WELD_COLUMNS as readonly string[]).includes("weldpoint_seq"));
  for (const f of ["load-acciona.ts", "load-inco.ts", "load-weld-length.ts", "load-welders.ts"]) {
    const src = readFileSync(path.join(REPO_ROOT, "scripts", f), "utf8");
    const calls = src.includes("refreshMatviews(client)");
    check(`${f} refreshes the matviews after COMMIT (R3-15)`, calls,
      calls ? "" : "no refreshMatviews() call");
  }
  check("the .xls is read through uv at load time, never a checked-in conversion (R3-11)",
    readFileSync(path.join(REPO_ROOT, "scripts", "load-welders.ts"), "utf8")
      .includes("scripts/py/xls_to_csv.py"));

  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) FAILED`);
  if (failures > 0) process.exitCode = 1;
}

main();
