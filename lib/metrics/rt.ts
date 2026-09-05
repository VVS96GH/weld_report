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
 * ── Not implemented here, and why ───────────────────────────────────────────
 *  • M11 `[Numb RT/UT "PR all"]`, M41 `[RT BACKLOG Total Project "PR all"]`,
 *    M43 `[RT100% Backlog "PR all"]` — the `"PR all"` twins differ only by the
 *    union's extra sources (CCC/ACCIONA/INCO) and by `RT Acc/Rej <> "U/Review"`
 *    / the extra `'T1-2'` status. With only `Weld Dump` loaded they would
 *    return the `"EP"` number under a `"PR all"` label, which is a lie about
 *    scope, so the pages that want them render honest-empty (R-01).
 *  • M23 / M24 `[RT Total Films by Joint "PR all"]` — need `Weld Point Code`
 *    and the `Exlude RT Films from UT` / `Exlude Full Cut & Debris` calc
 *    columns. `weld_point_code` is not in the §8.1 dump contract (the M query
 *    adds it as a blank placeholder for the CCC union), so the three-term
 *    inclusion–exclusion cannot be evaluated on this data.
 *  • M50 `[RT Backlog & FABRICATED & PWHT Spool Date "PR All"]` — bound only to
 *    pbix page 36 visual `c6e92e5e…`, which the mockup does not render, and it
 *    needs `Spool Dump.txt`. Not required (§M50).
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
  RT_WELD_TYPES,
  type Scope,
  agingCondition,
  and,
  buildGroupedSelect,
  divide,
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
 * the contractual coverage for this service class". `ALLEXCEPT` fixes the
 * ratio at `(HA, Service Class, Service Class + Service Cat+NDT Remarks)`
 * grain — `ha` and `ndt_remarks` are `Project WD+WR+INCO+Acciona` columns and
 * are NOT in the §8.1 dump contract, so at `"EP"` scope the grain collapses to
 * `service_class_cat_wd`. That is a documented reduction, not the pbix
 * formula; the pages that use M52 (mockup 14/16/18) are CCC pages and render
 * honest-empty until the Talisman export lands.
 */
export async function coverageGapByServiceClass(
  scope: Scope,
  targetFraction: number,
): Promise<Array<{ group: string | null; backlog_joints: number }>> {
  const p = new Params();
  const where = scopeWhere(scope, p);
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
    `  SELECT w.service_class_cat_wd AS grp, ${nRt} AS n_rt, ${nJoints} AS n_joints\n` +
    `    FROM weld w\n` +
    `   WHERE ${where}\n` +
    `   GROUP BY 1\n` +
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
