/**
 * Weekly trend material — M05, M06, M80, M92.
 *
 * Two different sources, and the difference matters:
 *
 *  - **M05/M06** (Welding Progress Trend, "Welding Status for this Week") are
 *    recomputable from the fact table and are served from the materialised
 *    view `mv_weekly_progress` (calculation-logic §6.5).
 *  - **M80/M92** (the RT/PWHT backlog bars and the cumulative rejection-rate
 *    lines) are NOT recomputable. Their DAX ages on `TODAY()`, so this dump
 *    cannot say what the backlog was on 19-Dec. Ruling R-08 replaces the two
 *    hand-maintained workbooks with `weld_weekly_snapshot(week_end_date,
 *    sub_contractor, metric, value)`, appended by the ETL after every load.
 *    Until that table has rows the charts render honest-empty — never a
 *    fabricated zero series.
 */

import { z } from "zod";
import { query } from "@/lib/db";
import { haAreaCondition, Params, zCount, zSum, zText, type HaAreaPick } from "./scope";

/**
 * M81 — the flat reference lines on the rejection-rate charts. Hard-coded
 * constants in the pbix (`[% of Target "PR"]` = 0.01, `[% Unacceptable Limit
 * "PR"]` = 0.03, `[% UT of Target "PR all"]` = 0.03,
 * `[% UT Unacceptable Limit "PR all"]` = 0.05); ported as constants.
 */
export const TARGET_LINES = {
  RT_TARGET: 0.01,
  RT_UNACCEPTABLE: 0.03,
  UT_TARGET: 0.03,
  UT_UNACCEPTABLE: 0.05,
} as const;

/**
 * The `metric` vocabulary of `weld_weekly_snapshot`, fixed by
 * `analysis/sources2/trend-seed-plan.md`. They are the `M##` ids of
 * `calculation-logic.md` §2, so a snapshot row and a live measure are
 * comparable by name.
 */
export const SNAPSHOT_METRICS = {
  /** `TREND Report[RT Backlog]` — **dead column**, see {@link PROVISIONAL_METRICS}. */
  RT_BACKLOG: "M40",
  /** `RT BACKLOG & PWHT Not Done`. */
  RT_BACKLOG_PWHT_NOT_DONE: "M47",
  /** `RT BACKLOG & PWHT "Y" Done + "N"`. */
  RT_BACKLOG_PWHT_Y_DONE_PLUS_N: "M48",
  /** `PWHT Backlog All Types`. */
  PWHT_BACKLOG_ALL_TYPES: "M60",
  /** `PWHT Backlog For RT` (BW/GW/CLET/MW). */
  PWHT_BACKLOG_FOR_RT: "M62",
  /** `PWHT BACKLOG RT NOT Done (SG+TMCP)`. */
  PWHT_BACKLOG_RT_NOT_DONE: "M64",
  /** `TREND RT UT[RT% Rate]` — per sub-contractor film rejection rate. */
  RT_FILM_REJECTION_RATE: "M25",
  /** `TREND RT UT[UT% Rate]` — per sub-contractor UT length rejection rate. */
  UT_LENGTH_REJECTION_RATE: "M36",
  /** `TREND RT UT[Project RT % Rej Rate]` — the project-wide flat line. */
  RT_FILM_REJECTION_RATE_PROJECT: "M25P",
  /** `TREND RT UT[Project UT % Rej Rate]`. */
  UT_LENGTH_REJECTION_RATE_PROJECT: "M36P",
  /** Weekly active welders — NOT M90 (`Project_Welder`), which is still absent. */
  ACTIVE_WELDERS: "M90W",
  /** `CUM MPI Done[MPI Done]` — cumulative, project-wide. */
  MPI_DONE: "M71",
  /** `CUM MPI Done[MPI / PT Done]`. */
  MPI_PT_DONE: "M71PT",
} as const;

/**
 * Ruling R2-09: series the seeder wrote as-is from a column that stopped being
 * maintained. `TREND Report[RT Backlog]` is `0` for every sub-contractor in
 * every week since 2024-06-28 (only 19 of 132 weeks are non-zero, all in
 * Feb-Jun 2024), so the M40 trend line is a flat zero for the last two years —
 * honest history, not a loading defect. Any widget that plots one of these must
 * say `provisional` until the first ETL-computed week lands.
 */
export const PROVISIONAL_METRICS: ReadonlySet<string> = new Set([
  SNAPSHOT_METRICS.RT_BACKLOG,
]);

/** R2-08: the `scope` qualifier split off the workbook's sub-contractor label. */
export const SNAPSHOT_SCOPES = {
  ALL: "ALL",
  SG: "SG",
  NONSG: "NONSG",
  TMCP: "TMCP",
} as const;

/** R2-08: MPI rows carry no sub-contractor; the seeder writes this sentinel. */
export const SNAPSHOT_PROJECT = "PROJECT";

const SnapshotRow = z.object({
  // Selected as `::text`; see the note in lib/db.ts on date/timezone drift.
  week_end_date: z.string().transform((v) => v.slice(0, 10)),
  sub_contractor: zText,
  scope: zText,
  metric: z.string(),
  value: zSum,
});

export type SnapshotPoint = z.infer<typeof SnapshotRow>;

/**
 * M92 / M80 — read the weekly snapshot table (ruling R-08).
 * Returns `[]` when the table is empty or absent; callers must render
 * honest-empty rather than a zero series.
 */
export async function weeklySnapshot(opts: {
  metrics: readonly string[];
  subContractor?: string | null;
  /** R2-08 qualifier: `ALL` | `SG` | `NONSG` | `TMCP`. Omit to take every scope. */
  scope?: string;
  /**
   * Drop the `PROJECT` sentinel rows (R2-08: the MPI metrics carry no party).
   * Pair with `aggregate` and NO `scope` to reproduce a pbix chart that sums
   * every party AND every scope — which is what the page-1 backlog bars are.
   */
  excludeProject?: boolean;
  weeks?: number;
  /**
   * Project-level series: sum `value` across sub-contractors per (week, metric)
   * instead of returning one row per party. That is what the mockup's page-1
   * backlog bars are — `Sum(TREND Report[…])` with no sub-contractor in the
   * visual. Pair it with `scope: 'ALL'` so a `GAC SG` row is not added on top
   * of its own `GAC` parent.
   */
  aggregate?: boolean;
  /** Last week end to show ({@link chartCutoff}); later weeks are dropped. */
  upTo?: string;
  /** Page-1 multi-select: these parties only (overrides `subContractor`). */
  subContractors?: readonly string[];
}): Promise<SnapshotPoint[]> {
  if (opts.metrics.length === 0) return [];
  const p = new Params();
  const conds = [`s.metric = ANY(${p.any(opts.metrics)})`];
  if (opts.upTo !== undefined) {
    conds.push(`s.week_end_date <= ${p.add(opts.upTo)}::date`);
  }
  if (opts.subContractors?.length) {
    conds.push(`s.sub_contractor = ANY(${p.any(opts.subContractors)})`);
  } else if (opts.subContractor === null) {
    conds.push(`s.sub_contractor IS NULL`);
  } else if (opts.subContractor !== undefined) {
    conds.push(`s.sub_contractor = ${p.add(opts.subContractor)}`);
  }
  if (opts.scope !== undefined) {
    conds.push(`s.scope = ${p.add(opts.scope)}`);
  }
  if (opts.excludeProject) {
    conds.push(`s.sub_contractor IS DISTINCT FROM ${p.add(SNAPSHOT_PROJECT)}`);
  }
  const limit = p.add(opts.weeks ?? 14);
  const select = opts.aggregate
    ? `SELECT s.week_end_date::text AS week_end_date, NULL::text AS sub_contractor,\n` +
      `       NULL::text AS scope, s.metric, sum(s.value) AS value\n` +
      `  FROM weld_weekly_snapshot s JOIN weeks ON weeks.week_end_date = s.week_end_date\n` +
      ` WHERE ${conds.join(" AND ")}\n` +
      ` GROUP BY 1, 4\n` +
      ` ORDER BY 1, 4`
    : `SELECT s.week_end_date::text AS week_end_date, s.sub_contractor, s.scope, s.metric, s.value\n` +
      `  FROM weld_weekly_snapshot s JOIN weeks ON weeks.week_end_date = s.week_end_date\n` +
      ` WHERE ${conds.join(" AND ")}\n` +
      ` ORDER BY s.week_end_date, s.metric`;
  const sql =
    `WITH weeks AS (\n` +
    `  SELECT DISTINCT s.week_end_date FROM weld_weekly_snapshot s\n` +
    `   WHERE ${conds.join(" AND ")}\n` +
    `   ORDER BY 1 DESC LIMIT ${limit}\n` +
    `)\n` +
    select;
  try {
    const rows = await query(sql, p.list());
    return z.array(SnapshotRow).parse(rows);
  } catch {
    // Table not created yet (DB-LANE owns the migration) — honest-empty.
    return [];
  }
}

const WeeklyRow = z.object({
  week_end_date: z.string().transform((v) => v.slice(0, 10)),
  weld_cat: zText,
  joints_welded: zCount,
  tested: zCount,
  rejected: zCount,
  films_taken: zSum,
  films_rejected: zSum,
});

export type WeeklyProgressPoint = z.infer<typeof WeeklyRow>;

/**
 * M06 — Welding Progress Trend, the last `weeks` weeks by `weld_cat`.
 *
 * Reads `mv_weekly_progress` (§6.5, DB-LANE's `db/migrations/0006_views.sql`),
 * which is grouped by `(week_end_date, source, sub_contractor, weld_cat,
 * weld_type)`. Summing over `weld_type` inside one week is safe — a joint has
 * one weld type per row — but the view's own header warns that the joint
 * counts are NOT additive ACROSS weeks, so never sum these series to a total.
 * The mockup's chart filters `Weld Cat NOT IN {J}` and `SC NOT IN {Inco}`.
 *
 * The view is created `WITH NO DATA`; before the first `REFRESH` a query on it
 * errors, which this function turns into an empty series (honest-empty).
 */
export async function weeklyProgress(opts: {
  subContractor?: string;
  weeks?: number;
  excludeWeldCats?: readonly string[];
  excludeSubContractors?: readonly string[];
  sources?: readonly string[];
  /** Page-1 slicer: `mv_weekly_progress` carries all four columns (0030). */
  weldType?: string;
  weldCat?: string;
  ha?: string;
  /** The pbix slicer's "(Blank)" group — `ha IS NULL`. */
  haIsNull?: boolean;
  area?: string;
  /** Last week end to show ({@link chartCutoff}); later weeks are dropped. */
  upTo?: string;
  /** Page-1 multi-select lists; each overrides its single-value twin above. */
  subContractors?: readonly string[];
  weldTypes?: readonly string[];
  weldCats?: readonly string[];
  haArea?: readonly HaAreaPick[];
}): Promise<WeeklyProgressPoint[]> {
  const p = new Params();
  const conds: string[] = [
    `m.source::text = ANY(${p.any(opts.sources ?? ["WELD_DUMP"])}::text[])`,
  ];
  if (opts.upTo !== undefined) {
    conds.push(`m.week_end_date <= ${p.add(opts.upTo)}::date`);
  }
  if (opts.subContractors?.length) {
    conds.push(`m.sub_contractor = ANY(${p.any(opts.subContractors)})`);
  } else if (opts.subContractor !== undefined) {
    conds.push(`m.sub_contractor = ${p.add(opts.subContractor)}`);
  }
  if (opts.weldTypes?.length) conds.push(`m.weld_type = ANY(${p.any(opts.weldTypes)})`);
  if (opts.weldCats?.length) conds.push(`m.weld_cat = ANY(${p.any(opts.weldCats)})`);
  if (opts.haArea?.length) conds.push(haAreaCondition(opts.haArea, p, "m"));
  if (opts.excludeSubContractors?.length) {
    conds.push(
      `(m.sub_contractor IS NULL OR NOT (m.sub_contractor = ANY(${p.any(opts.excludeSubContractors)})))`,
    );
  }
  if (opts.excludeWeldCats?.length) {
    conds.push(
      `(m.weld_cat IS NULL OR NOT (m.weld_cat = ANY(${p.any(opts.excludeWeldCats)})))`,
    );
  }
  if (opts.weldType !== undefined) {
    conds.push(`m.weld_type = ${p.add(opts.weldType)}`);
  }
  if (opts.weldCat !== undefined) {
    conds.push(`m.weld_cat = ${p.add(opts.weldCat)}`);
  }
  if (opts.haIsNull) {
    conds.push(`m.ha IS NULL`);
  }
  if (opts.ha !== undefined) {
    conds.push(`m.ha = ${p.add(opts.ha)}`);
  }
  if (opts.area !== undefined) {
    conds.push(`m.area_classification_label = ${p.add(opts.area)}`);
  }
  const where = conds.join(" AND ");
  const limit = p.add(opts.weeks ?? 14);
  const sql =
    `WITH weeks AS (\n` +
    `  SELECT DISTINCT m.week_end_date FROM mv_weekly_progress m\n` +
    `   WHERE ${where}\n` +
    `   ORDER BY 1 DESC LIMIT ${limit}\n` +
    `)\n` +
    `SELECT m.week_end_date::text AS week_end_date, m.weld_cat,\n` +
    `       sum(m.joints_welded) AS joints_welded,\n` +
    `       sum(m.tested) AS tested,\n` +
    `       sum(m.rejected) AS rejected,\n` +
    `       sum(m.films_taken) AS films_taken,\n` +
    `       sum(m.films_rejected) AS films_rejected\n` +
    `  FROM mv_weekly_progress m JOIN weeks ON weeks.week_end_date = m.week_end_date\n` +
    ` WHERE ${where}\n` +
    ` GROUP BY 1,2\n` +
    ` ORDER BY 1,2`;
  try {
    const rows = await query(sql, p.list());
    return z.array(WeeklyRow).parse(rows);
  } catch {
    return [];
  }
}

/**
 * The Friday that closes the latest week present in `mv_weekly_progress`
 * (`Calendar[Week_End_Date] IN TOP 1 DESC`, the M05 visual filter).
 * `null` when the view is empty or absent.
 */
export async function latestWeekEnd(upTo?: string): Promise<string | null> {
  try {
    // `upTo` is the chart cut-off ({@link chartCutoff}): without it a weld typed
    // with a future date would make that future week "this week".
    const rows = await query<{ week_end_date: string | null }>(
      upTo
        ? `SELECT max(week_end_date)::text AS week_end_date FROM mv_weekly_progress WHERE week_end_date <= $1::date`
        : `SELECT max(week_end_date)::text AS week_end_date FROM mv_weekly_progress`,
      upTo ? [upTo] : undefined,
    );
    const v = rows[0]?.week_end_date ?? null;
    return v ? String(v).slice(0, 10) : null;
  } catch {
    return null;
  }
}

// ── computed backlog history ────────────────────────────────────────────────

/**
 * The page-1 / 7-11 backlog charts, recomputed from `mv_joint` at each week end
 * instead of read from the hand-typed trend workbook.
 *
 * WHY. The workbook's last week says ~680 RT and ~1,850 PWHT while the owner's
 * DAX — which page 2 renders — says 672 and 1,042. Owner ruling: the charts
 * must reflect the current calculations, and the chart TOTAL is what the owner
 * reads against the page-2 measures.
 *
 * THE INVARIANT (non-negotiable, and tested). For every week W:
 *
 * ```
 *   rt_total(W)   = [RT BACKLOG Total Project "PR all"]      at W
 *   pwht_total(W) = [PWHT All BACKLOG All WELD TYPE "PR all"] at W
 * ```
 *
 * and each stack is split by INTERSECTION, not by the workbook's own series:
 *
 * ```
 *   "RT/UT+PWHT" = both(W)              "RT/UT Only" = rt_total(W)   - both(W)
 *   "PWHT+RT/UT" = both(W)              "PWHT Only"  = pwht_total(W) - both(W)
 * ```
 *
 * so the two `+` series are the SAME joint set seen from either side. The
 * mockup confirms the semantics: at 16-Jan its RT chart reads 437 + 129 = 566,
 * exactly page 2's `RT B.LOG Total`, and its PWHT chart 1,981 + 45 = 2,026,
 * exactly `PWHT Backlog All`.
 *
 * This is NOT the trend workbook's split. There the two series are M47
 * (`RT BACKLOG & PWHT Not Done`) and M48 (`RT BACKLOG & PWHT "Y" Done + "N"`),
 * which today are 58 and 596 — summing to 654, not 672, because 18 backlog
 * joints match neither PWHT branch. Those measures do not partition the
 * backlog, so they cannot produce a stack that totals the page-2 figure. The
 * intersection split does, by construction.
 *
 * HOW HISTORY IS RECONSTRUCTED, and what is approximate. The backlog's
 * `report IS NULL` clause becomes "the report did not exist yet at W":
 * `still_open_today OR report_date > W`. Dates are exact — every row with an
 * `rt_report` carries an `rt_date`. **Status is not**: `rt_weld_status`,
 * `pwht_weld_status` and `rt_pct` are the CURRENT snapshot, because the export
 * carries no status history, so a joint whose status changed in the past is
 * counted under today's status across the whole window. The chart says so, and
 * the workbook series stays available as a dashed "as reported" overlay so the
 * two are visibly different series rather than one silently replacing the
 * other.
 */
export type BacklogTrendPoint = {
  week_end_date: string;
  /** `[RT BACKLOG Total Project "PR all"]` at this week end. */
  rt_total: number;
  /** `[PWHT All BACKLOG All WELD TYPE "PR all"]` at this week end. */
  pwht_total: number;
  /** Joints in BOTH backlogs at this week end — the shared `+` series. */
  both: number;
};

const BacklogTrendRow = z.object({
  week_end_date: z.string(),
  rt_total: zCount,
  pwht_total: zCount,
  both: zCount,
});

/** In the RT backlog at week `w`. `wk.w` and alias `j` are fixed by the query. */
const RT_OPEN =
  "(j.rt_bl_cand_prall AND j.rt_bl_start <= wk.w" +
  "  AND (j.rt_backlog_prall OR j.rt_bl_end > wk.w))";

/** In the PWHT backlog at week `w` — the CCC branch OR the status branch. */
const PWHT_OPEN =
  "((j.pwht_bl_cand_ccc OR j.pwht_bl_cand_rest) AND j.pwht_bl_start <= wk.w" +
  "  AND (j.pwht_backlog_ccc OR j.pwht_backlog_rest OR j.pwht_bl_end > wk.w))";

export async function backlogTrend(opts: {
  /** Week ends run back from the Friday of this date. */
  asOf: string;
  weeks: number;
  /** Page 7-11 pass their party; page 1 passes nothing (project total). */
  subContractor?: string;
  sources: readonly string[];
}): Promise<BacklogTrendPoint[]> {
  const { asOf, weeks, subContractor, sources } = opts;
  const p = new Params();
  const asOfP = p.add(asOf);
  const weeksP = p.add(String(Math.max(1, weeks)));
  const srcP = p.any(sources);
  const subCond = subContractor
    ? ` AND sub_contractor = ${p.add(subContractor)}`
    : "";
  const sql =
    `WITH wk AS (\n` +
    `  SELECT (date_trunc('week', ${asOfP}::date)::date + 4 - 7 * g)::date AS w\n` +
    `    FROM generate_series(0, ${weeksP}::int - 1) g\n` +
    `), win AS (SELECT min(w) AS from_w FROM wk), j AS (\n` +
    `  SELECT * FROM mv_joint, win\n` +
    `   WHERE source::text = ANY(${srcP}::text[])${subCond}\n` +
    `     AND (rt_bl_cand_prall OR pwht_bl_cand_ccc OR pwht_bl_cand_rest)\n` +
    // Drop joints that had already left both backlogs before the window opens.
    // Without this the join scans every joint that was ever in a backlog.
    `     AND (rt_backlog_prall OR pwht_backlog_ccc OR pwht_backlog_rest\n` +
    `          OR rt_bl_end > win.from_w OR pwht_bl_end > win.from_w)\n` +
    `)\n` +
    `SELECT wk.w::text AS week_end_date,\n` +
    `       count(*) FILTER (WHERE ${RT_OPEN})   AS rt_total,\n` +
    `       count(*) FILTER (WHERE ${PWHT_OPEN}) AS pwht_total,\n` +
    `       count(*) FILTER (WHERE ${RT_OPEN} AND ${PWHT_OPEN}) AS both\n` +
    `  FROM wk LEFT JOIN j ON true\n` +
    ` GROUP BY wk.w ORDER BY wk.w`;
  try {
    return z.array(BacklogTrendRow).parse(await query(sql, p.list()));
  } catch {
    // The history columns arrive with migration 0023; before it the charts
    // fall back to the workbook rather than rendering a fabricated zero.
    return [];
  }
}

/**
 * The cut-off of every weekly chart: the Friday on or before `asOf`.
 *
 * Owner rule (2026-10-14): the report is read weekly, and its charts close on the
 * last Friday — a dump exported on Saturday 10-Oct shows the week ending Friday
 * 09-Oct, and the Saturday's welds wait for the next week. Week ends in this
 * model are Fridays (`Calendar[Week_End_Date]`), so this is also the label of
 * the last bar.
 */
export function chartCutoff(asOf: string): string {
  const d = new Date(`${asOf.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return asOf;
  const back = (d.getUTCDay() - 5 + 7) % 7; // 5 = Friday
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/** Slicer options the backlog queries honour (page 1 and pages 7-11). */
type BacklogSlice = {
  subContractor?: string;
  /** Multi-select: these parties only (overrides `subContractor`). */
  subContractors?: readonly string[];
  weldTypes?: readonly string[];
  weldCats?: readonly string[];
  haArea?: readonly HaAreaPick[];
};

/** ` AND …` for the backlog queries over `mv_joint` (unaliased columns). */
function subContractorSql(opts: BacklogSlice, p: Params): string {
  const c: string[] = [];
  if (opts.subContractors?.length) c.push(`sub_contractor = ANY(${p.any(opts.subContractors)})`);
  else if (opts.subContractor) c.push(`sub_contractor = ${p.add(opts.subContractor)}`);
  if (opts.weldTypes?.length) c.push(`weld_type = ANY(${p.any(opts.weldTypes)})`);
  if (opts.weldCats?.length) c.push(`weld_cat = ANY(${p.any(opts.weldCats)})`);
  if (opts.haArea?.length) c.push(haAreaCondition(opts.haArea, p, "mv_joint"));
  return c.map((x) => ` AND ${x}`).join("");
}

type BacklogShift = { rt: number; pwht: number; both: number };

/**
 * How much each backlog moved AFTER `cutoff`: its size at the cut-off minus its
 * size now, both read through the same reconstruction `backlogTrend` uses.
 *
 * Added to the owner's live DAX values it turns "the backlog today" into "the
 * backlog at the cut-off" without re-deriving the measures: joints welded after
 * the Friday leave the backlog, joints tested after it come back. When nothing
 * happened after the cut-off every term is 0 and the live values stand as they
 * are. The status columns are the current snapshot (no history in the export),
 * which is the same approximation the reconstruction documents.
 */
async function backlogShift(opts: BacklogSlice & {
  cutoff: string;
  sources: readonly string[];
}): Promise<BacklogShift> {
  const p = new Params();
  const cutP = p.add(opts.cutoff);
  const srcP = p.any(opts.sources);
  const sub = subContractorSql(opts, p);
  const sql =
    `WITH wk AS (SELECT ${cutP}::date AS w, true AS at_cut\n` +
    `             UNION ALL SELECT DATE '9999-12-31', false), j AS (\n` +
    `  SELECT * FROM mv_joint\n` +
    `   WHERE source::text = ANY(${srcP}::text[])${sub}\n` +
    `     AND (rt_bl_cand_prall OR pwht_bl_cand_ccc OR pwht_bl_cand_rest)\n` +
    `     AND (rt_backlog_prall OR pwht_backlog_ccc OR pwht_backlog_rest\n` +
    `          OR rt_bl_end > ${cutP}::date OR pwht_bl_end > ${cutP}::date)\n` +
    `)\n` +
    `SELECT wk.at_cut,\n` +
    `       count(*) FILTER (WHERE ${RT_OPEN})   AS rt_total,\n` +
    `       count(*) FILTER (WHERE ${PWHT_OPEN}) AS pwht_total,\n` +
    `       count(*) FILTER (WHERE ${RT_OPEN} AND ${PWHT_OPEN}) AS both\n` +
    `  FROM wk LEFT JOIN j ON true GROUP BY wk.at_cut`;
  try {
    const rows = z
      .array(z.object({ at_cut: z.boolean(), rt_total: zCount, pwht_total: zCount, both: zCount }))
      .parse(await query(sql, p.list()));
    const cut = rows.find((r) => r.at_cut);
    const now = rows.find((r) => !r.at_cut);
    if (!cut || !now) return { rt: 0, pwht: 0, both: 0 };
    return {
      rt: cut.rt_total - now.rt_total,
      pwht: cut.pwht_total - now.pwht_total,
      both: cut.both - now.both,
    };
  } catch {
    // History columns absent (pre-0023): no shift rather than a wrong one.
    return { rt: 0, pwht: 0, both: 0 };
  }
}

/**
 * The page-1 RT backlog chart's CURRENT week, computed from `mv_joint`.
 *
 * The chart's history is the trend workbook (the pbix chart *is* the workbook),
 * but the latest week is recomputed so the page can never drift from the
 * measures page 2 renders. Verified equal today, and pinned.
 *
 * The three owner-supplied measures behind the two series, each a SUM of
 * DISTINCTCOUNT branches that are **not** de-duplicated against one another:
 *
 * | series | measure | today |
 * |---|---|---|
 * | `RT/UT+PWHT` | `RT BACKLOG Total Project & PWHT "Y" NOT Done "PR all"` | **76** |
 * | `RT/UT Only` | `RT Backlog+PWHT "N"` + `RT Backlog+PWHT Progress "Y"` | **596** |
 * | (their sum) | `RT BACKLOG Total Project "PR all"` | **672** |
 *
 * `RT/UT+PWHT` needed migration 0024: its third branch (the CCC one, keyed on
 * `PWHT Y/N CCC`) was missing, which is why this read 58 against the pbix's 76.
 */
export type RtBacklogCurrent = {
  /** `RT/UT+PWHT` — PWHT required and not yet done. */
  plus_pwht: number;
  /** `RT/UT Only` — PWHT not required, or already done. */
  rt_only: number;
  /** Their sum; equals `[RT BACKLOG Total Project "PR all"]`. */
  total: number;
};

export async function rtBacklogCurrent(opts: BacklogSlice & {
  sources: readonly string[];
  /** Read the backlog at this Friday instead of now ({@link chartCutoff}). */
  cutoff?: string;
}): Promise<RtBacklogCurrent | null> {
  const p = new Params();
  const srcP = p.any(opts.sources);
  const sub = subContractorSql(opts, p);
  const sql =
    `SELECT count(*) FILTER (WHERE rt_backlog_pwht_y_not_done_prall)\n` +
    `     + count(*) FILTER (WHERE rt_backlog_pwht_y_not_done_ccc) AS plus_pwht,\n` +
    `       count(*) FILTER (WHERE rt_backlog_pwht_n_prall)\n` +
    `     + count(*) FILTER (WHERE rt_backlog_pwht_y_done_prall)   AS rt_only\n` +
    `  FROM mv_joint WHERE source::text = ANY(${srcP}::text[])${sub}`;
  try {
    const rows = z
      .array(z.object({ plus_pwht: zCount, rt_only: zCount }))
      .parse(await query(sql, p.list()));
    const r = rows[0];
    if (!r) return null;
    if (!opts.cutoff) return { ...r, total: r.plus_pwht + r.rt_only };
    const d = await backlogShift({ ...opts, cutoff: opts.cutoff });
    const plus = Math.max(0, r.plus_pwht + d.both);
    const only = Math.max(0, r.rt_only + d.rt - d.both);
    return { plus_pwht: plus, rt_only: only, total: plus + only };
  } catch {
    // `rt_backlog_pwht_y_not_done_ccc` arrives with migration 0024; before it
    // the chart shows the workbook's own last week rather than a wrong number.
    return null;
  }
}

/**
 * The page-1 PWHT backlog chart's CURRENT week, computed from `mv_joint`.
 *
 * `PWHT+RT/UT` is `[PWHT Backlog Weld Status All Weld Types RT NOT Done
 * "PR all"]` — FOUR added `DISTINCTCOUNT`s, a CCC branch and a status branch,
 * each once for `[Service Cat] = "SG"` and once for
 * `[TMCP Pipe] = "TMCP Pipe"`. **No weld-type filter**, and `PWHT Weld Status`
 * uses the same 17-code hold list as `RT Weld Status`.
 *
 * The scope columns are the schema's own:
 * `service_cat = 'SG'` (verbatim text — `'SGCS'` and `'HRSG'` also exist, so
 * this is an equality, never a LIKE) and `tmcp_pipe` (boolean, loaded from
 * `Weld Dump[TMCP Pipe]` where the DAX's `"TMCP Pipe"` literal is true).
 *
 * Today: **3**, entirely GAC through the SG status branch. `PWHT Only` is then
 * `[PWHT All BACKLOG All WELD TYPE "PR all"]` minus it — 1,042 − 3 = **1,039**,
 * matching the pbix chart.
 */
export type PwhtBacklogCurrent = {
  /** `PWHT+RT/UT` — M64. */
  plus_rt: number;
  /** `PWHT Only` — the all-types backlog minus M64. */
  pwht_only: number;
  /** `[PWHT All BACKLOG All WELD TYPE "PR all"]`. */
  total: number;
};

export async function pwhtBacklogCurrent(opts: BacklogSlice & {
  sources: readonly string[];
  /** Read the backlog at this Friday instead of now ({@link chartCutoff}). */
  cutoff?: string;
}): Promise<PwhtBacklogCurrent | null> {
  const p = new Params();
  const srcP = p.any(opts.sources);
  const sub = subContractorSql(opts, p);
  const sql =
    // The DAX ADDS the four branches, so they are summed, not OR-ed: a joint
    // that is both SG and TMCP, or that matches both branches, counts once per
    // term. Same rule as M47.
    `SELECT count(*) FILTER (WHERE pwht_bl_rt_nd_sg_ccc)\n` +
    `     + count(*) FILTER (WHERE pwht_bl_rt_nd_sg_status)\n` +
    `     + count(*) FILTER (WHERE pwht_bl_rt_nd_tmcp_ccc)\n` +
    `     + count(*) FILTER (WHERE pwht_bl_rt_nd_tmcp_status)      AS plus_rt,\n` +
    // M60 itself is two ADDED counts (the CCC branch and the status branch).
    `       count(*) FILTER (WHERE pwht_backlog_ccc)\n` +
    `     + count(*) FILTER (WHERE pwht_backlog_rest)              AS total\n` +
    `  FROM mv_joint WHERE source::text = ANY(${srcP}::text[])${sub}`;
  try {
    const rows = z
      .array(z.object({ plus_rt: zCount, total: zCount }))
      .parse(await query(sql, p.list()));
    const r = rows[0];
    if (!r) return null;
    if (!opts.cutoff) return { ...r, pwht_only: r.total - r.plus_rt };
    // `PWHT+RT/UT` is an SG/TMCP-scoped measure with no history of its own, so
    // the post-cut-off movement is carried by the total (and `PWHT Only`).
    const d = await backlogShift({ ...opts, cutoff: opts.cutoff });
    const total = Math.max(r.plus_rt, r.total + d.pwht);
    return { plus_rt: r.plus_rt, total, pwht_only: total - r.plus_rt };
  } catch {
    // The SG/TMCP flags arrive with migration 0024.
    return null;
  }
}

/**
 * Per-week inspection counts by the INSPECTION date, for the per-party Welding
 * Status charts (owner, 2026-10-18; pbix `chart7_welding`):
 *   - `MT + PT "PR all"` = joints with an MT report counted on the week of
 *     `MT Date "PR All"` plus joints with a PT report on the week of
 *     `PT Date "PR All"` (both `USERELATIONSHIP` to Calendar[Date]);
 *   - `Numb RT/UT "PR all" 2` = tested joints on the week of `RT Date`.
 * The "PR All" twins fall back to the CCC joint-record columns. Row grain
 * (`weld`), as the DAX reads the fact table; `Weld Date > 0` on every term.
 */
export async function weeklyInspections(opts: {
  weeks: readonly string[];
  sources: readonly string[];
  subContractor?: string;
  subContractors?: readonly string[];
  excludeSubContractors?: readonly string[];
  excludeWeldCats?: readonly string[];
}): Promise<Map<string, { mtpt: number; tested: number }>> {
  const out = new Map<string, { mtpt: number; tested: number }>();
  if (opts.weeks.length === 0) return out;
  const p = new Params();
  const conds = [
    `w.source::text = ANY(${p.any(opts.sources)}::text[])`,
    `w.weld_date IS NOT NULL`,
    `NOT w.is_cancelled`,
  ];
  if (opts.subContractors?.length) conds.push(`w.sub_contractor = ANY(${p.any(opts.subContractors)})`);
  else if (opts.subContractor !== undefined) conds.push(`w.sub_contractor = ${p.add(opts.subContractor)}`);
  if (opts.excludeSubContractors?.length) {
    conds.push(`(w.sub_contractor IS NULL OR NOT (w.sub_contractor = ANY(${p.any(opts.excludeSubContractors)})))`);
  }
  if (opts.excludeWeldCats?.length) {
    conds.push(`(w.weld_cat IS NULL OR NOT (w.weld_cat = ANY(${p.any(opts.excludeWeldCats)})))`);
  }
  const weeks = p.any(opts.weeks);
  // Friday on or after the date: Calendar[Week_End_Date]
  const wk = (d: string) => `(${d} + ((5 - extract(isodow FROM ${d})::int + 7) % 7))`;
  const where = conds.join(" AND ");
  const sql =
    `WITH r AS (SELECT w.joint_id, coalesce(w.mt_date, w.mt_date_ccc) AS mt_d, coalesce(w.pt_date, w.pt_date_ccc) AS pt_d,\n` +
    `                  coalesce(w.mt_report, w.mt_report_ccc) AS mt_r, coalesce(w.pt_report, w.pt_report_ccc) AS pt_r,\n` +
    `                  w.rt_date, w.rt_report, w.rt_acc_rej\n` +
    `             FROM weld w WHERE ${where}),\n` +
    `     k AS (\n` +
    `  SELECT 'mtpt' AS kind, ${wk("mt_d")}::date AS wk, 'MT' || joint_id AS id FROM r WHERE mt_r IS NOT NULL AND mt_d IS NOT NULL\n` +
    `  UNION ALL\n` +
    `  SELECT 'mtpt', ${wk("pt_d")}::date, 'PT' || joint_id FROM r WHERE pt_r IS NOT NULL AND pt_d IS NOT NULL\n` +
    `  UNION ALL\n` +
    `  SELECT 'tested', ${wk("rt_date")}::date, joint_id FROM r\n` +
    `   WHERE rt_report IS NOT NULL AND rt_date IS NOT NULL\n` +
    `     AND rt_acc_rej IS DISTINCT FROM 'RS' AND rt_acc_rej IS DISTINCT FROM 'U/Review')\n` +
    `SELECT wk::text AS wk, kind, count(DISTINCT id) AS n FROM k\n` +
    ` WHERE wk = ANY(${weeks}::date[]) GROUP BY 1, 2`;
  try {
    const rows = await query<{ wk: string; kind: string; n: string }>(sql, p.list());
    for (const r of rows) {
      const cur = out.get(r.wk) ?? { mtpt: 0, tested: 0 };
      if (r.kind === "mtpt") cur.mtpt = Number(r.n);
      else cur.tested = Number(r.n);
      out.set(r.wk, cur);
    }
  } catch {
    /* honest-empty: the chart shows no MT+PT series */
  }
  return out;
}
