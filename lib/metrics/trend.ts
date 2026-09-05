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

/** Metric keys the ETL is expected to append to `weld_weekly_snapshot`. */
export const SNAPSHOT_METRICS = {
  RT_BACKLOG: "rt_backlog",
  RT_BACKLOG_PWHT_NOT_DONE: "rt_backlog_pwht_not_done",
  RT_BACKLOG_PWHT_Y_DONE_PLUS_N: "rt_backlog_pwht_y_done_plus_n",
  PWHT_BACKLOG_ALL_TYPES: "pwht_backlog_all_types",
  PWHT_BACKLOG_FOR_RT: "pwht_backlog_for_rt",
  RT_FILM_REJECTION_RATE: "rt_film_rejection_rate",
  UT_LENGTH_REJECTION_RATE: "ut_length_rejection_rate",
} as const;

const SnapshotRow = z.object({
  // Selected as `::text`; see the note in lib/db.ts on date/timezone drift.
  week_end_date: z.string().transform((v) => v.slice(0, 10)),
  sub_contractor: zText,
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
  weeks?: number;
}): Promise<SnapshotPoint[]> {
  const p = new Params();
  const conds = [`s.metric = ANY(${p.any(opts.metrics)})`];
  if (opts.subContractor === null) {
    conds.push(`s.sub_contractor IS NULL`);
  } else if (opts.subContractor !== undefined) {
    conds.push(`s.sub_contractor = ${p.add(opts.subContractor)}`);
  }
  const limit = p.add(opts.weeks ?? 14);
  const sql =
    `WITH weeks AS (\n` +
    `  SELECT DISTINCT s.week_end_date FROM weld_weekly_snapshot s\n` +
    `   WHERE ${conds.join(" AND ")}\n` +
    `   ORDER BY 1 DESC LIMIT ${limit}\n` +
    `)\n` +
    `SELECT s.week_end_date::text AS week_end_date, s.sub_contractor, s.metric, s.value\n` +
    `  FROM weld_weekly_snapshot s JOIN weeks ON weeks.week_end_date = s.week_end_date\n` +
    ` WHERE ${conds.join(" AND ")}\n` +
    ` ORDER BY s.week_end_date, s.metric`;
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
