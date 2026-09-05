/**
 * RT / radiography metrics — M10–M15, M20–M26, M40–M52.
 *
 * Every predicate is the literal translation of the DAX in
 * `analysis/calculation-logic.md` §2, using the blank rules of §0.2:
 * `[X] <> "RS"` is TRUE for blanks, so it becomes `IS DISTINCT FROM`, not `<>`.
 * Getting that wrong silently drops every untested row.
 *
 * Numbers produced here are pinned against `analysis/reconcile_results.json`
 * by `tests/metrics.test.ts`.
 *
 * ── DISTINCT-safety at weld-pass grain (ruling R2-01, §7 C-5) ───────────────
 * CCC's fact rows are one per WELDER PASS: 5,430,732 rows over 1,339,063
 * distinct joints, ~4.06 rows per joint. So:
 *
 *  • every joint answer is `count(DISTINCT w.joint_id)` — never `count(*)`;
 *  • the film sums are deliberately UNGATED, and that is correct, not a bug.
 *    `RT Film Total` on CCC is a per-weld-point SHARE (0.75 on 296,274 rows,
 *    145 distinct values — §7 C-6 / R2-04), so summing every pass of a joint
 *    reconstitutes that joint's film count. Adding a `weldpoint_seq = 1` gate
 *    would under-count CCC roughly 4x. The pbix agrees: its film ratios
 *    (`RT Film Ratio % "PR all" For Welder`,
 *    analysis/pbix/project-wd-wr-inco-acciona.md:757-767) are
 *    `DIVIDE(SUM([Total No of films Rej]), SUM([RT Film Total]))` with no WP1
 *    filter anywhere;
 *  • the `"EP"` by-joint family (M20/M21/M22/M33) keeps `weldpoint_no = 1`,
 *    which on `Weld Dump` is the repair-attempt sequence — correct there, and
 *    those measures are never evaluated over CCC.
 *
 * The full audit table lives in lib/metrics/README.md.
 *
 * ── Still not implementable ─────────────────────────────────────────────────
 *  • M50 `[RT Backlog & FABRICATED & PWHT Spool Date "PR All"]` — bound only to
 *    pbix page 36 visual `c6e92e5e…`, which the mockup does not render.
 */

import { z } from "zod";
import { query } from "@/lib/db";
import {
  AGING_BUCKETS,
  type AgingKey,
  type AggSpec,
  type GroupSpec,
  Params,
  PWHT_NO_TOKENS,
  PWHT_YES_TOKENS,
  RT_BACKLOG_STATUS,
  RT_BACKLOG_STATUS_100,
  RT_BACKLOG_STATUS_PRALL,
  RT_WELD_TYPES,
  type Scope,
  agingCondition,
  and,
  buildGroupedSelect,
  divide,
  fabricatedCond,
  filterWhere,
  inList,
  inListOrBlank,
  notEq,
  scopeWhere,
  zCount,
  zSum,
  zText,
} from "./scope";

// ── predicate fragments ─────────────────────────────────────────────────────

/** M10 `[Numb RT/UT]` — welded, has an RT report, not re-shot. */
export function testedCond(p: Params, a = "w"): string {
  return and([
    `${a}.weld_date IS NOT NULL`,
    `${a}.rt_report IS NOT NULL`,
    notEq(`${a}.rt_acc_rej`, "RS", p),
  ]);
}

/**
 * M12 `[Numb RT/UT "R"]` — note the asymmetry: no `Weld Date` and no
 * `RT Report` predicate. Reproduced literally.
 */
export function rejectedCond(p: Params, a = "w"): string {
  return `${a}.rt_acc_rej = ${p.add("R")}`;
}

/**
 * M40 `[RT 5 10 20 100% B.log Joints Weld Status "EP"]`.
 * Branch A: a hold/selected status from the 16-code list.
 * Branch B: a 100 %-RT joint whose status is still blank / `?` / `S`.
 * The DAX adds the branches; the `"PR all"` twin ORs them. §M40 rules OR.
 */
export function rtBacklogCond(p: Params, a = "w"): string {
  return and([
    inList(`${a}.weld_type`, RT_WELD_TYPES, p),
    `${a}.weld_date IS NOT NULL`,
    `${a}.rt_report IS NULL`,
    `(${inList(`${a}.rt_weld_status`, RT_BACKLOG_STATUS, p)} OR ${and([
      `${a}.rt_pct = 100`,
      inListOrBlank(`${a}.rt_weld_status`, RT_BACKLOG_STATUS_100, p),
    ])})`,
  ]);
}

/** M42 `[RT 100% Backlog Joints Weld Status "EP"]`. */
export function rt100BacklogCond(p: Params, a = "w"): string {
  return and([
    inList(`${a}.weld_type`, RT_WELD_TYPES, p),
    `${a}.rt_pct = 100`,
    `${a}.weld_date IS NOT NULL`,
    `${a}.rt_report IS NULL`,
  ]);
}

/** M45 — RT backlog whose joint also has PWHT required (`Y`/`25.01`) and done. */
export function rtBacklogPwhtYDoneCond(p: Params, a = "w"): string {
  return and([
    rtBacklogCond(p, a),
    inList(`${a}.pwht_y_n`, PWHT_YES_TOKENS, p),
    `${a}.pwht_report IS NOT NULL`,
  ]);
}

/** M46 — RT backlog with PWHT not applicable (`N`/`25.01`) and no PWHT status. */
export function rtBacklogPwhtNCond(p: Params, a = "w"): string {
  return and([
    rtBacklogCond(p, a),
    inList(`${a}.pwht_y_n`, PWHT_NO_TOKENS, p),
    `${a}.pwht_weld_status IS NULL`,
  ]);
}

/** M47 — RT backlog AND PWHT required, still on hold (`H`/`HS`), no report. */
export function rtBacklogPwhtYNotDoneCond(p: Params, a = "w"): string {
  return and([
    rtBacklogCond(p, a),
    inList(`${a}.pwht_y_n`, PWHT_YES_TOKENS, p),
    inList(`${a}.pwht_weld_status`, ["H", "HS"], p),
    `${a}.pwht_report IS NULL`,
  ]);
}

// ── aggregate expressions ───────────────────────────────────────────────────

/** The RT/film aggregate bundle used by every "Tested and Accepted" table. */
export function rtAggs(p: Params, a = "w"): AggSpec[] {
  const wp1 = `${a}.weldpoint_no = 1`;
  const notRs = notEq(`${a}.rt_acc_rej`, "RS", p);
  return [
    // M10 tested joints
    { key: "tested", sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([testedCond(p, a)])}` },
    // M12 rejected joints
    { key: "rejected", sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([rejectedCond(p, a)])}` },
    // M20 films taken by joint
    { key: "films", sql: `sum(${a}.rt_film_total) ${filterWhere([wp1, notRs])}` },
    // M21 films accepted by joint (literal `sum(Total No of films Acc)`)
    { key: "films_acc_sum", sql: `sum(${a}.total_no_of_films_acc) ${filterWhere([wp1, notRs])}` },
    // M22 films rejected by joint — WeldPoint 1 only, NO `<> "RS"` filter
    { key: "films_rejected", sql: `sum(${a}.total_no_of_films_rej) ${filterWhere([wp1])}` },
    // M26 all-weld-point film totals (the per-WPS pages)
    { key: "films_all", sql: `sum(${a}.rt_film_total) ${filterWhere([notRs])}` },
    { key: "films_all_acc", sql: `sum(${a}.total_no_of_films_acc) ${filterWhere([notRs])}` },
    { key: "films_all_rejected", sql: `sum(${a}.total_no_of_films_rej)` },
  ];
}

/** Backlog aggregate bundle: M40, M42, M45, M46, M47. */
export function rtBacklogAggs(p: Params, a = "w"): AggSpec[] {
  return [
    { key: "rt_backlog", sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([rtBacklogCond(p, a)])}` },
    { key: "rt100_backlog", sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([rt100BacklogCond(p, a)])}` },
    {
      key: "rt_backlog_pwht_y_done",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([rtBacklogPwhtYDoneCond(p, a)])}`,
    },
    {
      key: "rt_backlog_pwht_n",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([rtBacklogPwhtNCond(p, a)])}`,
    },
    {
      key: "rt_backlog_pwht_y_not_done",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([rtBacklogPwhtYNotDoneCond(p, a)])}`,
    },
  ];
}

// ── row shapes ──────────────────────────────────────────────────────────────

const RtRow = z.object({
  tested: zCount,
  rejected: zCount,
  films: zSum,
  films_acc_sum: zSum,
  films_rejected: zSum,
  films_all: zSum,
  films_all_acc: zSum,
  films_all_rejected: zSum,
});

const BacklogRow = z.object({
  rt_backlog: zCount,
  rt100_backlog: zCount,
  rt_backlog_pwht_y_done: zCount,
  rt_backlog_pwht_n: zCount,
  rt_backlog_pwht_y_not_done: zCount,
});

export type RtStats = {
  /** M10 `[Numb RT/UT]`. */
  tested: number;
  /** M13 `[Numb RT/UT "A"]` = M10 − M12, evaluated as two distinct counts. */
  accepted: number;
  /** M12 `[Numb RT/UT "R"]`. */
  rejected: number;
  /** M14 `[Rejection Rate Joint "WD"]` = M12 / M10. */
  rejection_rate_joint: number | null;
  /** M20 `[RT Total Films by Joint "EP"]`. */
  films: number;
  /** M21/M24 — films taken minus films rejected, the mockup's "Films Acc". */
  films_accepted: number;
  /** M21 literal `sum([Total No of films Acc])` with the same two filters. */
  films_acc_sum: number;
  /** M22 `[RT Total Films by Joint "R" "EP"]`. */
  films_rejected: number;
  /** M25 `[RT FILM Ratio % by Joint "EP"]` = M22 / M20. */
  film_rejection_rate: number | null;
  /** M26 `[RT Total Films]` — all weld points, `<> "RS"`. */
  films_all: number;
  films_all_accepted: number;
  /** M26 `[RT Total Films "R"]` — unfiltered. */
  films_all_rejected: number;
};

function toStats(r: z.infer<typeof RtRow>): RtStats {
  const films = r.films ?? 0;
  const filmsRej = r.films_rejected ?? 0;
  const filmsAll = r.films_all ?? 0;
  const filmsAllRej = r.films_all_rejected ?? 0;
  return {
    tested: r.tested,
    accepted: r.tested - r.rejected,
    rejected: r.rejected,
    rejection_rate_joint: divide(r.rejected, r.tested),
    films,
    films_accepted: films - filmsRej,
    films_acc_sum: r.films_acc_sum ?? 0,
    films_rejected: filmsRej,
    film_rejection_rate: divide(filmsRej, films),
    films_all: filmsAll,
    films_all_accepted: filmsAll - filmsAllRej,
    films_all_rejected: filmsAllRej,
  };
}

export type RtBacklogStats = {
  /** M40 `[RT 5 10 20 100% B.log Joints Weld Status "EP"]`. */
  rt_backlog: number;
  /** M42 `[RT 100% Backlog Joints Weld Status "EP"]`. */
  rt100_backlog: number;
  /** M45 `[RT 5 10 20 100% B.log Joints+PWHT Progress Weld Status "EP"]`. */
  rt_backlog_pwht_y_done: number;
  /** M46 `[… +NO PWHT Progress Weld Status "EP"]`. */
  rt_backlog_pwht_n: number;
  /** M47 `[RT BACKLOG Total Project & PWHT NOT Done "EP"]`. */
  rt_backlog_pwht_y_not_done: number;
};

// ── public API ──────────────────────────────────────────────────────────────

/**
 * M10, M12, M13, M14, M20–M22, M25, M26 for one scope.
 * DAX: `[Numb RT/UT]`, `[Numb RT/UT "R"]`, `[Numb RT/UT "A"]`,
 * `[Rejection Rate Joint "WD"]`, `[RT Total Films by Joint … "EP"]`,
 * `[RT Total Films]`.
 */
export async function rtStats(scope: Scope): Promise<RtStats> {
  const p = new Params();
  const aggs = rtAggs(p);
  const sql = buildGroupedSelect({ groups: [], aggs, where: scopeWhere(scope, p) });
  const rows = await query(sql, p.list());
  if (rows.length === 0) return toStats(RtRow.parse(emptyRt()));
  return toStats(RtRow.parse(rows[0]));
}

function emptyRt() {
  return {
    tested: 0,
    rejected: 0,
    films: null,
    films_acc_sum: null,
    films_rejected: null,
    films_all: null,
    films_all_acc: null,
    films_all_rejected: null,
  };
}

/** The same bundle, grouped (`weld_cat`, `rt_pct`, `service_class_cat_wd`, …). */
export async function rtStatsBy(
  scope: Scope,
  group: GroupSpec,
): Promise<Map<string | null, RtStats>> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [group],
    aggs: rtAggs(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  const out = new Map<string | null, RtStats>();
  for (const raw of rows) {
    const key = zText.parse((raw as Record<string, unknown>)[group.key] ?? null);
    out.set(key, toStats(RtRow.parse(raw)));
  }
  return out;
}

/** M40, M42, M45, M46, M47 for one scope. */
export async function rtBacklogStats(scope: Scope): Promise<RtBacklogStats> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [],
    aggs: rtBacklogAggs(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  return BacklogRow.parse(
    rows[0] ?? {
      rt_backlog: 0,
      rt100_backlog: 0,
      rt_backlog_pwht_y_done: 0,
      rt_backlog_pwht_n: 0,
      rt_backlog_pwht_y_not_done: 0,
    },
  );
}

/** The backlog bundle, grouped. */
export async function rtBacklogStatsBy(
  scope: Scope,
  group: GroupSpec,
): Promise<Map<string | null, RtBacklogStats>> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [group],
    aggs: rtBacklogAggs(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  const out = new Map<string | null, RtBacklogStats>();
  for (const raw of rows) {
    const key = zText.parse((raw as Record<string, unknown>)[group.key] ?? null);
    out.set(key, BacklogRow.parse(raw));
  }
  return out;
}

export type AgingBuckets = Record<AgingKey, number> & { no_weld_date: number };

const AgingRow = z.object({
  within_3: zCount,
  "3_to_7": zCount,
  "7_to_15": zCount,
  "15_to_30": zCount,
  above_30: zCount,
  no_weld_date: zCount,
});

/**
 * M51 — RT backlog aging, `≤3 / 3–7 / 7–15 / 15–30 / >30` days from
 * `weld_date` to `as_of` (`DATEDIFF([Weld Date], TODAY(), DAY)`; §0.5
 * `No of Days "WD"`).
 *
 * A joint can own several backlog rows; the age is taken from the **latest**
 * `weld_date` among them, which is what `analysis/reconcile_check.py` does and
 * the only reading under which the buckets sum to the backlog total
 * (calculation-logic §4.3). Literal per-row DAX would let one joint appear in
 * two buckets.
 */
export async function rtBacklogAging(
  scope: Scope,
  asOf: string,
): Promise<AgingBuckets> {
  return backlogAging(scope, asOf, (p) => rtBacklogCond(p));
}

/** Shared by {@link rtBacklogAging} and `pwht.ts`'s M66 twin. */
export async function backlogAging(
  scope: Scope,
  asOf: string,
  cond: (p: Params) => string,
): Promise<AgingBuckets> {
  const p = new Params();
  const where = and([scopeWhere(scope, p), cond(p)]);
  const asOfParam = p.add(asOf);
  // `bk` (not `b`) so the JS property access never looks like a `b.<column>`
  // SQL reference to tests/columns.test.ts.
  const buckets = AGING_BUCKETS.map(
    (bk) => `count(*) FILTER (WHERE ${agingCondition(bk, asOfParam, "b")}) AS "${bk.key}"`,
  ).join(",\n       ");
  const sql =
    `WITH b AS (\n` +
    `  SELECT w.joint_id, max(w.weld_date) AS weld_date\n` +
    `    FROM weld w\n` +
    `   WHERE ${where}\n` +
    `   GROUP BY 1\n` +
    `)\n` +
    `SELECT ${buckets},\n` +
    `       count(*) FILTER (WHERE b.weld_date IS NULL) AS no_weld_date\n` +
    `  FROM b`;
  const rows = await query(sql, p.list());
  const parsed = AgingRow.parse(
    rows[0] ?? {
      within_3: 0,
      "3_to_7": 0,
      "7_to_15": 0,
      "15_to_30": 0,
      above_30: 0,
      no_weld_date: 0,
    },
  );
  return parsed as AgingBuckets;
}

/**
 * M52 `[RT5% / RT10% / RT20% Backlog Joints "PRall" (One Formula)]`.
 *
 * NOT a backlog of held joints: "how many more joints must be shot to reach
 * the contractual coverage for this service class".
 *
 * `ALLEXCEPT` fixes the ratio at `(HA, Service Class, Service Class + Service
 * Cat+NDT Remarks)` grain. `service_class_cat_ndt` already concatenates
 * `Service class`+`Service Cat`+`NDT Remarks`+`RT%`, so it subsumes the second
 * and third keys; `ha` is a separate column that the loader may leave empty
 * (its `HA l0_abs_guide` lookup file is still missing —
 * project-wd-wr-inco-acciona.md §5.3 #6). {@link hasHaValues} says whether the
 * finer grain is available; when it is not, the caller must disclose that the
 * ratio is computed one level coarser rather than silently pretending.
 *
 * @param group the row key — `service_class_cat_ndt` for CCC pages (label style
 *              `6R1B P 100`), `service_class_cat_wd` for GAC/TEKFEN/MEDGULF.
 */
export async function coverageGapByServiceClass(
  scope: Scope,
  targetFraction: number,
  group: GroupSpec = { key: "grp", sql: "w.service_class_cat_wd" },
  opts: { byHa?: boolean } = {},
): Promise<Array<{ group: string | null; backlog_joints: number }>> {
  const p = new Params();
  const where = scopeWhere(scope, p);
  const keys = opts.byHa ? `w.ha, ${group.sql}` : group.sql;
  const nRt = `count(DISTINCT w.joint_id) ${filterWhere([
    `w.rt_report IS NOT NULL`,
    notEq("w.rt_acc_rej", "RS", p),
    notEq("w.rt_acc_rej", "U/Review", p),
  ])}`;
  const nJoints = `count(DISTINCT w.joint_id) ${filterWhere([
    `w.weld_date IS NOT NULL`,
    `coalesce(w.repair_reweld,'') = ''`,
  ])}`;
  const t = p.add(targetFraction);
  const sql =
    `WITH g AS (\n` +
    `  SELECT ${group.sql} AS grp, ${nRt} AS n_rt, ${nJoints} AS n_joints\n` +
    `    FROM weld w\n` +
    `   WHERE ${where}\n` +
    `   GROUP BY ${keys}\n` +
    `)\n` +
    `SELECT grp AS "group",\n` +
    `       GREATEST(ceil((${t}::numeric - COALESCE(n_rt::numeric / NULLIF(n_joints,0), 0)) * n_joints), 0)::bigint AS backlog_joints\n` +
    `  FROM g`;
  const rows = await query(sql, p.list());
  return z
    .array(z.object({ group: zText, backlog_joints: zCount }))
    .parse(rows);
}

/**
 * `true` when `weld.ha` is populated for the scope — i.e. M52's `ALLEXCEPT`
 * grain can include the handover area. The loader can only fill `ha` from
 * `Subsystem Code` / `System no`; the `HA l0_abs_guide` fallback file is
 * missing, so a scope can legitimately have none.
 */
export async function hasHaValues(scope: Scope): Promise<boolean> {
  const p = new Params();
  const sql =
    `SELECT EXISTS (SELECT 1 FROM weld w WHERE ${scopeWhere(scope, p)} AND w.ha IS NOT NULL) AS present`;
  const rows = await query<{ present: boolean }>(sql, p.list());
  return Boolean(rows[0]?.present);
}

/**
 * {@link backlogAging}, grouped by one dimension. The joint-level dedup
 * happens at `(group, joint_id)` grain, so each level of a hierarchy must be
 * queried at its own grain — summing a child level would double-count any
 * joint that spans two groups.
 */
export async function backlogAgingBy(
  scope: Scope,
  asOf: string,
  cond: (p: Params) => string,
  group: GroupSpec,
): Promise<Map<string | null, AgingBuckets>> {
  const p = new Params();
  const where = and([scopeWhere(scope, p), cond(p)]);
  const asOfParam = p.add(asOf);
  // `bk` (not `b`) so the JS property access never looks like a `b.<column>`
  // SQL reference to tests/columns.test.ts.
  const buckets = AGING_BUCKETS.map(
    (bk) => `count(*) FILTER (WHERE ${agingCondition(bk, asOfParam, "b")}) AS "${bk.key}"`,
  ).join(",\n       ");
  const sql =
    `WITH b AS (\n` +
    `  SELECT ${group.sql} AS ${group.key}, w.joint_id, max(w.weld_date) AS weld_date\n` +
    `    FROM weld w\n` +
    `   WHERE ${where}\n` +
    `   GROUP BY 1, 2\n` +
    `)\n` +
    `SELECT b.${group.key}, ${buckets},\n` +
    `       count(*) FILTER (WHERE b.weld_date IS NULL) AS no_weld_date\n` +
    `  FROM b\n` +
    ` GROUP BY 1`;
  const rows = await query(sql, p.list());
  const out = new Map<string | null, AgingBuckets>();
  for (const raw of rows) {
    const key = zText.parse((raw as Record<string, unknown>)[group.key] ?? null);
    out.set(key, AgingRow.parse(raw) as AgingBuckets);
  }
  return out;
}

/** Map one row of a combined `rtAggs()` select into {@link RtStats}. */
export function rtStatsFromRow(raw: unknown): RtStats {
  return toStats(RtRow.parse(raw));
}

/** Map one row of a combined `rtBacklogAggs()` select into {@link RtBacklogStats}. */
export function rtBacklogStatsFromRow(raw: unknown): RtBacklogStats {
  return BacklogRow.parse(raw);
}

// ── "PR all" variants ───────────────────────────────────────────────────────
//
// Everything below is the four-source union family. It differs from the "EP"
// family in more than the table name, so it gets its own functions rather than
// a flag: callers must choose consciously which scope they are reporting.

/** M11 `[Numb RT/UT "PR all"]` — M10 plus `RT Acc/Rej <> "U/Review"`. */
export function testedCondPrAll(p: Params, a = "w"): string {
  return and([
    testedCond(p, a),
    notEq(`${a}.rt_acc_rej`, "U/Review", p),
  ]);
}

/**
 * The "first weld point" gate, per source.
 *
 * `weldpoint_no` is the dump's repair-attempt sequence and is what the DAX
 * `WeldPoint No. = 1` filter means for `Weld Dump` rows. `weldpoint_seq` is the
 * pbix `WeldPoint No.1 WP1` row number that migration 0010 added, and it is
 * populated for CCC only — it is NULL on every dump row, so a single
 * `weldpoint_seq = 1` predicate would silently zero the dump's film totals.
 * Hence the per-source CASE.
 *
 * Orchestrator ruling (phase 2, mid-flight): the `"PR all"` film sums MUST be
 * gated this way. It supersedes the earlier reading that the CCC operand is a
 * per-pass share needing no gate.
 */
export function wp1Cond(a = "w"): string {
  return `(CASE ${a}.source::text WHEN 'WELD_DUMP' THEN ${a}.weldpoint_no = 1 ELSE ${a}.weldpoint_seq = 1 END)`;
}

/**
 * M23 `[RT Total Films by Joint "PR all"]` — the three-term inclusion–exclusion
 * of "first weld point" ∪ "weld point code R/H/F/C":
 *
 *   WP1 (minus the two exclusion flags)  +  code R/H/F/C  −  their intersection
 *
 * `weld_point_code` was a blank placeholder while only the dump was loaded;
 * CCC's export fills it (project-wd-wr-inco-acciona.md §5.2), so the measure is
 * live now.
 */
export function filmsTakenPrAllExpr(p: Params, a = "w"): string {
  const notRs = notEq(`${a}.rt_acc_rej`, "RS", p);
  const notReview = notEq(`${a}.rt_acc_rej`, "U/Review", p);
  const wp1 = wp1Cond(a);
  const code = inList(`${a}.weld_point_code`, ["R", "H", "F", "C"], p);
  // Every term is coalesced: a `FILTER` that matches nothing yields NULL, and
  // `x + NULL - NULL` is NULL, which would render the whole KPI as 0. Term B
  // matches nothing at all while only the dump is loaded (`weld_point_code` is
  // a blank placeholder there), so this is not a hypothetical.
  const term = (conds: string[]) => `coalesce(sum(${a}.rt_film_total) ${filterWhere(conds)}, 0)`;
  return (
    `${term([wp1, notRs, notReview, `NOT ${a}.exclude_ut_films`, `NOT ${a}.exclude_debris_films`])}` +
    ` + ${term([code, notRs, notReview])}` +
    ` - ${term([wp1, code, notRs, notReview])}`
  );
}

/**
 * M24 `[RT Total Films by Joint "PR all" "R"]`.
 *
 * DISTINCT audit (R2-01 / §7 C-5): the DAX writes this ungated, which at
 * weld-pass grain counts a joint's rejected films once per welder pass. Per the
 * orchestrator's mid-flight ruling it carries the same per-source WP1 gate as
 * M23, which also restores the `"EP"`-scope answer (1,350 rejected films for
 * the loaded dump, vs 1,449 ungated).
 */
export function filmsRejectedPrAllExpr(p: Params, a = "w"): string {
  return `coalesce(sum(${a}.total_no_of_films_rej) ${filterWhere([
    wp1Cond(a),
    `NOT ${a}.exclude_ut_films`,
    notEq(`${a}.rt_acc_rej`, "RS", p),
    notEq(`${a}.rt_acc_rej`, "U/Review", p),
    `NOT ${a}.exclude_debris_films`,
  ])}, 0)`;
}

/** M41 `[RT BACKLOG Total Project "PR all"]` — M40 with `'T1-2'` added, OR-form. */
export function rtBacklogCondPrAll(p: Params, a = "w"): string {
  return and([
    inList(`${a}.weld_type`, RT_WELD_TYPES, p),
    `${a}.weld_date IS NOT NULL`,
    `${a}.rt_report IS NULL`,
    `(${inList(`${a}.rt_weld_status`, RT_BACKLOG_STATUS_PRALL, p)} OR ${and([
      `${a}.rt_pct = 100`,
      inListOrBlank(`${a}.rt_weld_status`, RT_BACKLOG_STATUS_100, p),
    ])})`,
  ]);
}

/**
 * M43 `[RT100% Backlog "PR all"]` — a genuinely different definition from M42:
 * it keys on `RT Date` being blank rather than `RT Report`, and admits the
 * whole status vocabulary including `?`/blank/`S`.
 */
export function rt100BacklogCondPrAll(p: Params, a = "w"): string {
  return and([
    `${a}.weld_date IS NOT NULL`,
    `${a}.rt_date IS NULL`,
    `${a}.rt_pct = 100`,
    inList(`${a}.weld_type`, RT_WELD_TYPES, p),
    inListOrBlank(
      `${a}.rt_weld_status`,
      [...RT_BACKLOG_STATUS_PRALL, ...RT_BACKLOG_STATUS_100],
      p,
    ),
  ]);
}

/** The `"PR all"` RT/film bundle (M11, M12, M13, M14, M23, M24, M25). */
export function rtAggsPrAll(p: Params, a = "w"): AggSpec[] {
  return [
    { key: "tested", sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([testedCondPrAll(p, a)])}` },
    { key: "rejected", sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([rejectedCond(p, a)])}` },
    { key: "films", sql: `(${filmsTakenPrAllExpr(p, a)})` },
    { key: "films_rejected", sql: `(${filmsRejectedPrAllExpr(p, a)})` },
    // M26 — the per-WPS all-weld-point totals. The `"EP"` flavour is
    // deliberately ungated and is pinned to reconcile_results.json
    // (180,034 films for GAC non-SG), so it stays exactly as it was. At
    // `"PR all"` scope the same ungated sum would count a CCC joint's films
    // once per welder pass (~4x), so the WP1 gate of the orchestrator's
    // mid-flight ruling is extended to it here. Flagged: this makes M26 differ
    // between the two families by design.
    {
      key: "films_all",
      sql: `coalesce(sum(${a}.rt_film_total) ${filterWhere([wp1Cond(a), notEq(`${a}.rt_acc_rej`, "RS", p)])}, 0)`,
    },
    {
      key: "films_all_rejected",
      sql: `coalesce(sum(${a}.total_no_of_films_rej) ${filterWhere([wp1Cond(a)])}, 0)`,
    },
  ];
}

const RtPrAllRow = z.object({
  tested: zCount,
  rejected: zCount,
  films: zSum,
  films_rejected: zSum,
  films_all: zSum,
  films_all_rejected: zSum,
});

/**
 * Structurally identical to {@link RtStats} so a page can hold either family in
 * one bundle; only the SQL behind it differs.
 */
export type RtPrAllStats = RtStats;

type RtPrAllDoc = {
  /** M11 `[Numb RT/UT "PR all"]`. */
  tested: number;
  /** M13 `[Numb RT/UT "PR all" "A"]` = M11 − M12. */
  accepted: number;
  /** M12 `[Numb RT/UT "PR all" "R"]`. */
  rejected: number;
  /** M14 `[Rejection Rate Joint "PR all"]`. */
  rejection_rate_joint: number | null;
  /** M23 `[RT Total Films by Joint "PR all"]` — fractional on CCC (R2-04). */
  films: number;
  /** M24 `"A"` = M23 − M24`"R"`, exactly as the DAX defines it. */
  films_accepted: number;
  /** M24 `[RT Total Films by Joint "PR all" "R"]`. */
  films_rejected: number;
  /** M25 `[RT FILM Ratio % by Joint "PR all"]`. */
  film_rejection_rate: number | null;
  /** M26 all-weld-point totals (the per-WPS pages). */
  films_all: number;
  films_all_accepted: number;
  films_all_rejected: number;
};
void (0 as unknown as RtPrAllDoc);

function toPrAllStats(r: z.infer<typeof RtPrAllRow>): RtPrAllStats {
  const films = r.films ?? 0;
  const filmsRej = r.films_rejected ?? 0;
  const filmsAll = r.films_all ?? 0;
  const filmsAllRej = r.films_all_rejected ?? 0;
  return {
    tested: r.tested,
    accepted: r.tested - r.rejected,
    rejected: r.rejected,
    rejection_rate_joint: divide(r.rejected, r.tested),
    films,
    films_accepted: films - filmsRej,
    // M24 "A" is defined as M23 - M24"R"; there is no separate Acc column at
    // "PR all" scope, so the literal-sum field mirrors it.
    films_acc_sum: films - filmsRej,
    films_rejected: filmsRej,
    film_rejection_rate: divide(filmsRej, films),
    films_all: filmsAll,
    films_all_accepted: filmsAll - filmsAllRej,
    films_all_rejected: filmsAllRej,
  };
}

/** Map one row of a combined `rtAggsPrAll()` select. */
export function rtPrAllStatsFromRow(raw: unknown): RtPrAllStats {
  return toPrAllStats(RtPrAllRow.parse(raw));
}

/** M11–M14, M23–M26 for one `"PR all"` scope. */
export async function rtStatsPrAll(scope: Scope): Promise<RtPrAllStats> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [],
    aggs: rtAggsPrAll(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  return toPrAllStats(
    RtPrAllRow.parse(
      rows[0] ?? {
        tested: 0,
        rejected: 0,
        films: null,
        films_rejected: null,
        films_all: null,
        films_all_rejected: null,
      },
    ),
  );
}

// ── FABRICATED: M44, M48, M49 ───────────────────────────────────────────────

/** M44 `[RT … B.log … "EP" & FABRICATED]` — M40 restricted to fabricated spools. */
export function rtBacklogFabricatedCond(p: Params, a = "w"): string {
  return and([rtBacklogCond(p, a), fabricatedCond(a)]);
}

/**
 * M48 `[RT Backlog+PWHT Progress "Y" Done + PWHT "N" FABRICATED "PR all"]`.
 * The DAX writes six added `CALCULATE`s (M45's three branches and M46's three,
 * each + FABRICATED); `(M45 OR M46) AND fabricated` is the same set (§M48).
 */
export function rtBacklogPwhtYDoneOrNFabricatedCond(p: Params, a = "w"): string {
  return and([
    `(${rtBacklogPwhtYDoneCond(p, a)} OR ${rtBacklogPwhtNCond(p, a)})`,
    fabricatedCond(a),
  ]);
}

/** M49 `[RT BACKLOG Total Project & PWHT"Y" NOT Done FABRICATED "PR all"]`. */
export function rtBacklogPwhtYNotDoneFabricatedCond(p: Params, a = "w"): string {
  return and([rtBacklogPwhtYNotDoneCond(p, a), fabricatedCond(a)]);
}

export function fabricatedAggs(p: Params, a = "w"): AggSpec[] {
  return [
    {
      key: "rt_backlog_fabricated",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([rtBacklogFabricatedCond(p, a)])}`,
    },
    {
      key: "rt_backlog_pwht_y_done_or_n_fabricated",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([rtBacklogPwhtYDoneOrNFabricatedCond(p, a)])}`,
    },
    {
      key: "rt_backlog_pwht_y_not_done_fabricated",
      sql: `count(DISTINCT ${a}.joint_id) ${filterWhere([rtBacklogPwhtYNotDoneFabricatedCond(p, a)])}`,
    },
  ];
}

const FabricatedRow = z.object({
  rt_backlog_fabricated: zCount,
  rt_backlog_pwht_y_done_or_n_fabricated: zCount,
  rt_backlog_pwht_y_not_done_fabricated: zCount,
});

export type FabricatedStats = z.infer<typeof FabricatedRow>;

/** Map one row of a combined `fabricatedAggs()` select. */
export function fabricatedStatsFromRow(raw: unknown): FabricatedStats {
  return FabricatedRow.parse(raw);
}

/**
 * `true` when the `spool` table has rows for the given master. With no rows,
 * every FABRICATED measure would evaluate to a fabricated 0 — callers must
 * render honest-empty instead.
 */
export async function spoolMasterLoaded(): Promise<boolean> {
  try {
    const rows = await query<{ present: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM spool) AS present",
    );
    return Boolean(rows[0]?.present);
  } catch {
    return false;
  }
}

/** The `"PR all"` backlog bundle: M41, M43, M45, M46, M47. */
export function rtBacklogAggsPrAll(p: Params, a = "w"): AggSpec[] {
  const backlog = rtBacklogCondPrAll(p, a);
  const count = (cond: string) => `count(DISTINCT ${a}.joint_id) ${filterWhere([cond])}`;
  return [
    { key: "rt_backlog", sql: count(backlog) },
    { key: "rt100_backlog", sql: count(rt100BacklogCondPrAll(p, a)) },
    {
      key: "rt_backlog_pwht_y_done",
      sql: count(
        and([
          backlog,
          `(${and([inList(`${a}.pwht_y_n`, PWHT_YES_TOKENS, p), `${a}.pwht_report IS NOT NULL`])}` +
            ` OR ${and([`${a}.pwht_y_n_ccc = ${p.add("Y")}`, `${a}.pwht_report_no_ccc IS NOT NULL`])})`,
        ]),
      ),
    },
    {
      key: "rt_backlog_pwht_n",
      sql: count(
        and([
          backlog,
          `(${and([inList(`${a}.pwht_y_n`, PWHT_NO_TOKENS, p), `${a}.pwht_weld_status IS NULL`])}` +
            ` OR ${a}.pwht_y_n_ccc = ${p.add("N")})`,
        ]),
      ),
    },
    {
      key: "rt_backlog_pwht_y_not_done",
      sql: count(
        and([
          backlog,
          inList(`${a}.pwht_y_n`, PWHT_YES_TOKENS, p),
          // The "PR all" twin adds 'NR' to the hold list (§M47).
          inList(`${a}.pwht_weld_status`, ["H", "HS", "NR"], p),
          `${a}.pwht_report IS NULL`,
        ]),
      ),
    },
  ];
}
