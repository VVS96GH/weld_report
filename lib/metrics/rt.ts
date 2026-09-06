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
 *  • a film sum is gated if and ONLY if its own DAX says so, and the gate is
 *    always `weldpoint_no = 1` — the DAX's own `[WeldPoint No.]` column, valid
 *    for every source (see {@link wp1Cond}). Of the `"PR all"` family only
 *    `[RT Total Films by Joint "PR all"]` carries the filter; the `"R"` twin
 *    and both `[RT Total Films "PR all"]` flavours are ungated, which is
 *    correct, not a bug: `RT Film Total` on CCC is a per-weld-point SHARE
 *    (0.75 on 296,274 rows, 145 distinct values — §7 C-6 / R2-04), so summing
 *    every pass of a joint reconstitutes that joint's film count;
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
  agingConditionOn,
  and,
  buildGroupedSelect,
  divide,
  fabricatedCond,
  filterWhere,
  JOINT_FROM,
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
  void p;
  return [
    { key: "tested", sql: `count(*) ${filterWhere([`${a}.is_tested_ep`])}` },     // M10
    { key: "rejected", sql: `count(*) ${filterWhere([`${a}.is_rejected`])}` },    // M12
    { key: "films", sql: `sum(${a}.films_wp1)` },                                 // M20
    { key: "films_acc_sum", sql: `sum(${a}.films_acc_wp1)` },                     // M21
    { key: "films_rejected", sql: `sum(${a}.films_rej_wp1)` },                    // M22
    { key: "films_all", sql: `sum(${a}.films_all)` },                             // M26
    { key: "films_all_acc", sql: `sum(${a}.films_all_acc)` },
    { key: "films_all_rejected", sql: `sum(${a}.films_all_rej)` },
  ];
}

/** Backlog aggregate bundle: M40, M42, M45, M46, M47. */
export function rtBacklogAggs(p: Params, a = "w"): AggSpec[] {
  void p;
  return [
    { key: "rt_backlog", sql: `count(*) ${filterWhere([`${a}.rt_backlog`])}` },
    { key: "rt100_backlog", sql: `count(*) ${filterWhere([`${a}.rt100_backlog`])}` },
    { key: "rt_backlog_pwht_y_done", sql: `count(*) ${filterWhere([`${a}.rt_backlog_pwht_y_done`])}` },
    { key: "rt_backlog_pwht_n", sql: `count(*) ${filterWhere([`${a}.rt_backlog_pwht_n`])}` },
    {
      key: "rt_backlog_pwht_y_not_done",
      sql: `count(*) ${filterWhere([`${a}.rt_backlog_pwht_y_not_done`])}`,
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
/**
 * A backlog family: the `mv_joint` flag that says a joint is in it, and the
 * clock the aging buckets read.
 *
 * The clock is per family on purpose. `analysis/reconcile_check.py` ages a
 * backlog joint from the latest weld date among its BACKLOG rows, and a joint
 * can carry a later non-backlog row — using the joint's overall `weld_date`
 * would move joints between buckets.
 */
export type BacklogFamily = { flag: string; dateCol: string };

export const RT_BACKLOG_EP: BacklogFamily = {
  flag: "rt_backlog",
  dateCol: "rt_backlog_weld_date",
};
export const RT_BACKLOG_PRALL: BacklogFamily = {
  flag: "rt_backlog_prall",
  dateCol: "rt_backlog_prall_weld_date",
};

/**
 * M51 — RT backlog aging, `≤3 / 3–7 / 7–15 / 15–30 / >30` days from the
 * joint's backlog `weld_date` to `as_of`
 * (`DATEDIFF([Weld Date], TODAY(), DAY)`; §0.5 `No of Days "WD"`).
 *
 * One row per joint in `mv_joint`, so this is a plain `count(*) FILTER` — the
 * per-joint `max(weld_date)` the buckets need is materialised in the view.
 */
export async function rtBacklogAging(
  scope: Scope,
  asOf: string,
): Promise<AgingBuckets> {
  return backlogAging(scope, asOf, RT_BACKLOG_EP);
}

/** Shared by {@link rtBacklogAging} and `pwht.ts`'s M66 twin. */
export async function backlogAging(
  scope: Scope,
  asOf: string,
  family: BacklogFamily,
): Promise<AgingBuckets> {
  const p = new Params();
  const where = and([scopeWhere(scope, p), `w.${family.flag}`]);
  const asOfParam = p.add(asOf);
  const d = `w.${family.dateCol}`;
  const buckets = AGING_BUCKETS.map(
    (bk) =>
      `count(*) FILTER (WHERE ${agingConditionOn(bk, asOfParam, d)}) AS "${bk.key}"`,
  ).join(",\n       ");
  const sql =
    `SELECT ${buckets},\n` +
    `       count(*) FILTER (WHERE ${d} IS NULL) AS no_weld_date\n` +
    `  FROM ${JOINT_FROM}\n` +
    ` WHERE ${where}`;
  const rows = await query(sql, p.list());
  return AgingRow.parse(rows[0] ?? EMPTY_AGING_ROW) as AgingBuckets;
}

const EMPTY_AGING_ROW = {
  within_3: 0,
  "3_to_7": 0,
  "7_to_15": 0,
  "15_to_30": 0,
  above_30: 0,
  no_weld_date: 0,
};

/** {@link backlogAging}, grouped by one dimension. */
export async function backlogAgingBy(
  scope: Scope,
  asOf: string,
  family: BacklogFamily,
  group: GroupSpec,
): Promise<Map<string | null, AgingBuckets>> {
  const p = new Params();
  const where = and([scopeWhere(scope, p), `w.${family.flag}`]);
  const asOfParam = p.add(asOf);
  const d = `w.${family.dateCol}`;
  const buckets = AGING_BUCKETS.map(
    (bk) =>
      `count(*) FILTER (WHERE ${agingConditionOn(bk, asOfParam, d)}) AS "${bk.key}"`,
  ).join(",\n       ");
  const sql =
    `SELECT ${group.sql} AS ${group.key}, ${buckets},\n` +
    `       count(*) FILTER (WHERE ${d} IS NULL) AS no_weld_date\n` +
    `  FROM ${JOINT_FROM}\n` +
    ` WHERE ${where}\n` +
    ` GROUP BY 1`;
  const rows = await query(sql, p.list());
  const out = new Map<string | null, AgingBuckets>();
  for (const raw of rows) {
    const key = zText.parse((raw as Record<string, unknown>)[group.key] ?? null);
    out.set(key, AgingRow.parse(raw) as AgingBuckets);
  }
  return out;
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
  const nRt = `count(*) ${filterWhere(["w.is_rt_reported"])}`;
  const nJoints = `count(*) ${filterWhere(["w.is_welded_norepair"])}`;
  const t = p.add(targetFraction);
  const sql =
    `WITH g AS (\n` +
    `  SELECT ${group.sql} AS grp, ${nRt} AS n_rt, ${nJoints} AS n_joints\n` +
    `    FROM ${JOINT_FROM}\n` +
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
    `SELECT EXISTS (SELECT 1 FROM ${JOINT_FROM} WHERE ${scopeWhere(scope, p)} AND w.ha IS NOT NULL) AS present`;
  const rows = await query<{ present: boolean }>(sql, p.list());
  return Boolean(rows[0]?.present);
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
 * The "first weld point" gate: `weldpoint_no = 1`, for EVERY source.
 *
 * This is literally the DAX's own column — `'Weld Dump'[WeldPoint No.]` at
 * `"EP"` scope, `'Project WD+WR+INCO+Acciona'[WeldPoint No.]` at `"PR all"`.
 *
 * It replaces the per-source CASE that 0013/0016 used
 * (`WHEN 'WELD_DUMP' THEN weldpoint_no = 1 ELSE weldpoint_seq = 1`), which
 * rested on the belief that `weldpoint_no` was dump-only. It is not: CCC's
 * `WeldPoint No.` is the M-mapped column and is populated (1,342,473 of
 * 5,432,993 `CCC_WELDER_RECORD` rows carry `weldpoint_no = 1`).
 *
 * Proof — M23 `[RT Total Films by Joint "PR all"]` = A + B − C:
 *
 * | gate | A | B | C | total | pbix |
 * |---|---|---|---|---|---|
 * | `weldpoint_no = 1` | 365,490.21 | 512,327.61 | 109,717.22 | **768,100.61** | 768,101 ✓ |
 * | the old CASE | 363,250.07 | 512,327.61 | 109,290.41 | 766,287.28 | ✗ by 1,813 |
 *
 * This supersedes the phase-2 mid-flight ruling "the film sums at `"PR all"`
 * scope must gate per source": the gate stays, but it is the DAX's column for
 * all sources. See migration 0017 and lib/metrics/README.md.
 *
 * `weldpoint_seq` (the *different* pbix column `[WeldPoint No.1 WP1]`) is NOT
 * retired — it still backs `ut_weld_length_m_prall`, whose DAX
 * (`[UT Weld Length by Joint "PR all"]`) filters that column by name, and the
 * CCC branch of {@link defectLengthExpr} (a joint-level LOOKUPVALUE
 * de-duplicated per ruling R2-01, with no DAX WeldPoint filter at all).
 */
export function wp1Cond(a = "w"): string {
  return `${a}.weldpoint_no = 1`;
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
 * M24 `[RT Total Films by Joint "PR all" "R"]` — **ungated**.
 *
 * The verbatim DAX carries no WeldPoint filter, only four exclusions:
 *
 * ```dax
 * CALCULATE(
 * SUM('Project WD+WR+INCO+Acciona'[Total No of films Rej]),
 * 'Project WD+WR+INCO+Acciona'[Exlude RT Films from UT] <> "Exclude UT Films",
 * 'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "RS",
 * 'Project WD+WR+INCO+Acciona'[RT Acc/Rej] <> "U/Review",
 * 'Project WD+WR+INCO+Acciona'[Exlude Full Cut & Debris] <> "Exclude Films:Debris"
 * )
 * ```
 *
 * It is *not* the `"EP"` measure's twin: `[RT Total Films by Joint "R" "EP"]`
 * does filter `'Weld Dump'[WeldPoint No.]=1` (and nothing else), which is why
 * the `"EP"` pin of 1,350 is unaffected by this correction.
 *
 * Ungated, over the loaded union, this is 2,151.9996 → **2,152**, the pbix card
 * exactly (ACCIONA 19 · CCC 606 · GAC 598 · INCO 77.9996 · MEDGULF 44 ·
 * TEKFEN 807). The old per-source WP1 gate gave 1,517.59 → 1,518.
 *
 * The fractional total is the source data's, not a rounding artefact: INCO's
 * `Total No of films Rej` carries fractional values (77.9996), so the honest
 * sum is 2,151.9996 and the card rounds it for display.
 */
export function filmsRejectedPrAllExpr(p: Params, a = "w"): string {
  return `coalesce(sum(${a}.total_no_of_films_rej) ${filterWhere([
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
  void p;
  return [
    { key: "tested", sql: `count(*) ${filterWhere([`${a}.is_tested_prall`])}` },  // M11
    { key: "rejected", sql: `count(*) ${filterWhere([`${a}.is_rejected`])}` },    // M12
    { key: "films", sql: `sum(${a}.films_taken_prall)` },                         // M23
    { key: "films_rejected", sql: `sum(${a}.films_rej_prall)` },                  // M24
    // M26 — both flavours are ungated, each matching its own DAX:
    // `[RT Total Films "PR all"]`     <> RS, <> Debris, <> U/Review
    // `[RT Total Films "PR all" "R"]` <> Debris ONLY (no RS / U/Review filter)
    { key: "films_all", sql: `sum(${a}.films_all_prall)` },
    { key: "films_all_rejected", sql: `sum(${a}.films_all_rej_prall)` },
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
  void p;
  return [
    { key: "rt_backlog_fabricated", sql: `count(*) ${filterWhere([`${a}.rt_backlog_fabricated`])}` },
    {
      key: "rt_backlog_pwht_y_done_or_n_fabricated",
      sql: `count(*) ${filterWhere([`${a}.rt_backlog_pwht_ydone_or_n_fabricated`])}`,
    },
    {
      key: "rt_backlog_pwht_y_not_done_fabricated",
      sql: `count(*) ${filterWhere([`${a}.rt_backlog_pwht_ynotdone_fabricated`])}`,
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
  void p;
  const count = (flag: string) => `count(*) ${filterWhere([`${a}.${flag}`])}`;
  return [
    { key: "rt_backlog", sql: count("rt_backlog_prall") },
    { key: "rt100_backlog", sql: count("rt100_backlog_prall") },
    { key: "rt_backlog_pwht_y_done", sql: count("rt_backlog_pwht_y_done_prall") },
    { key: "rt_backlog_pwht_n", sql: count("rt_backlog_pwht_n_prall") },
    { key: "rt_backlog_pwht_y_not_done", sql: count("rt_backlog_pwht_y_not_done_prall") },
  ];
}
