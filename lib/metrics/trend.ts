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
import { Params, zCount, zSum, zText } from "./scope";

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
  weeks?: number;
  /**
   * Project-level series: sum `value` across sub-contractors per (week, metric)
   * instead of returning one row per party. That is what the mockup's page-1
   * backlog bars are — `Sum(TREND Report[…])` with no sub-contractor in the
   * visual. Pair it with `scope: 'ALL'` so a `GAC SG` row is not added on top
   * of its own `GAC` parent.
   */
  aggregate?: boolean;
}): Promise<SnapshotPoint[]> {
  if (opts.metrics.length === 0) return [];
  const p = new Params();
  const conds = [`s.metric = ANY(${p.any(opts.metrics)})`];
  if (opts.subContractor === null) {
    conds.push(`s.sub_contractor IS NULL`);
  } else if (opts.subContractor !== undefined) {
    conds.push(`s.sub_contractor = ${p.add(opts.subContractor)}`);
  }
  if (opts.scope !== undefined) {
    conds.push(`s.scope = ${p.add(opts.scope)}`);
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
}): Promise<WeeklyProgressPoint[]> {
  const p = new Params();
  const conds: string[] = [
    `m.source::text = ANY(${p.any(opts.sources ?? ["WELD_DUMP"])}::text[])`,
  ];
  if (opts.subContractor !== undefined) {
    conds.push(`m.sub_contractor = ${p.add(opts.subContractor)}`);
  }
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
export async function latestWeekEnd(): Promise<string | null> {
  try {
    const rows = await query<{ week_end_date: string | null }>(
      `SELECT max(week_end_date)::text AS week_end_date FROM mv_weekly_progress`,
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
