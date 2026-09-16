/**
 * The "Demo 2" screen (owner request 2026-09-16): three widget forms that answer
 * the three management questions — "when do we clear it", "what blocks handover",
 * "why does it take so long" — plus auto-written highlight cards. Every number is
 * a measure the report already computes, project scope (loaded union, INCO out).
 *
 *   1. Burn-down      — weekly RT backlog (M47 + M48 of the trend workbook) against
 *                       the weekly RT/UT throughput (mv_weekly_progress), with a
 *                       straight-line projection from the last four weeks
 *   2. HA readiness   — per handover area: welded, RT reported %, RT backlog,
 *                       PWHT required / done %, PWHT backlog (mv_joint flags)
 *   3. NDE lead time  — days from weld date to the first RT report, per party:
 *                       bucketed distribution, median and 90th percentile
 *
 * Pure data; the view is components/Demo2View.tsx.
 */

import { z } from "zod";
import { query, withAsOf } from "@/lib/db";
import {
  JOINT_FROM,
  Params,
  PROJECT_EXCLUDED_SUBCONTRACTORS,
  projectScope,
  RT_WELD_TYPES,
  scopeWhere,
  SOURCES_PR_ALL_LOADED,
  zCount,
} from "@/lib/metrics/scope";
import { SNAPSHOT_METRICS, weeklyProgress, weeklySnapshot } from "@/lib/metrics/trend";

export type BurnPoint = { week: string; backlog: number | null; tested: number | null };

export type Burndown = {
  points: BurnPoint[];
  /** Average weekly change of the backlog over the last four weeks (negative = shrinking). */
  slope: number | null;
  /** Weeks until the projection reaches zero; null when the backlog is not shrinking. */
  weeksToClear: number | null;
  /** Average RT/UT tested per week over the last four weeks. */
  throughput: number | null;
  latest: { week: string; backlog: number } | null;
};

export type HaRow = {
  ha: string;
  welded: number;
  rtTypes: number;
  rtReported: number;
  rtPct: number | null;
  rtBacklog: number;
  pwhtRequired: number;
  pwhtDone: number;
  pwhtPct: number | null;
  pwhtBacklog: number;
};

export type LeadTimeRow = {
  party: string;
  joints: number;
  /** Share of joints per bucket, 0..100, in LEAD_BUCKETS order. */
  shares: number[];
  median: number | null;
  p90: number | null;
};

export type Demo2Data = {
  as_of: string;
  highlights: string[];
  burndown: Burndown;
  ha: { rows: HaRow[]; total: HaRow };
  leadTime: { buckets: string[]; rows: LeadTimeRow[] };
};

export const LEAD_BUCKETS = [
  { label: "≤3 d", max: 3 },
  { label: "4–7", max: 7 },
  { label: "8–15", max: 15 },
  { label: "16–30", max: 30 },
  { label: "31–60", max: 60 },
  { label: "61–90", max: 90 },
  { label: ">90", max: null },
] as const;

const NF = new Intl.NumberFormat("en-US");
const fmt = (v: number) => NF.format(Math.round(v));
const pct = (num: number, den: number): number | null => (den > 0 ? (num / den) * 100 : null);

const HA_ORDER = ["HA1", "HA2", "HA3", "HA4"];

export async function getDemo2Data(): Promise<Demo2Data> {
  const { as_of } = await withAsOf(null);
  const scope = projectScope();

  // ── 1. burn-down ───────────────────────────────────────────────────────
  const [snap, weekly] = await Promise.all([
    weeklySnapshot({
      metrics: [SNAPSHOT_METRICS.RT_BACKLOG_PWHT_NOT_DONE, SNAPSHOT_METRICS.RT_BACKLOG_PWHT_Y_DONE_PLUS_N],
      aggregate: true,
      excludeProject: true,
      weeks: 16,
    }),
    weeklyProgress({
      sources: SOURCES_PR_ALL_LOADED,
      excludeSubContractors: PROJECT_EXCLUDED_SUBCONTRACTORS,
      excludeWeldCats: ["J"],
      weeks: 16,
    }),
  ]);
  const weeks = [...new Set([...snap.map((s) => s.week_end_date), ...weekly.map((p) => p.week_end_date)])].sort();
  const points: BurnPoint[] = weeks.map((week) => {
    const b = snap.filter((s) => s.week_end_date === week);
    const t = weekly.filter((p) => p.week_end_date === week);
    return {
      week,
      backlog: b.length > 0 ? b.reduce((a, s) => a + (s.value ?? 0), 0) : null,
      tested: t.length > 0 ? t.reduce((a, p) => a + p.tested, 0) : null,
    };
  });
  const withBacklog = points.filter((p): p is BurnPoint & { backlog: number } => p.backlog !== null);
  const last4 = withBacklog.slice(-5);
  const slope =
    last4.length >= 2 ? (last4[last4.length - 1]!.backlog - last4[0]!.backlog) / (last4.length - 1) : null;
  const latest = withBacklog.length > 0 ? { week: withBacklog[withBacklog.length - 1]!.week, backlog: withBacklog[withBacklog.length - 1]!.backlog } : null;
  const weeksToClear = slope !== null && slope < 0 && latest ? latest.backlog / -slope : null;
  const testedLast4 = points.filter((p) => p.tested !== null).slice(-4).map((p) => p.tested as number);
  const throughput = testedLast4.length > 0 ? testedLast4.reduce((a, v) => a + v, 0) / testedLast4.length : null;

  // ── 2. HA readiness ────────────────────────────────────────────────────
  const p = new Params();
  const rtTypes = p.any(RT_WELD_TYPES);
  const haSql =
    `SELECT coalesce(w.ha, '(Blank)') AS ha,\n` +
    `       count(*) FILTER (WHERE w.is_welded_norepair) AS welded,\n` +
    `       count(*) FILTER (WHERE w.is_welded_norepair AND w.weld_type = ANY(${rtTypes})) AS rt_types,\n` +
    `       count(*) FILTER (WHERE w.is_rt_reported AND w.weld_type = ANY(${rtTypes})) AS rt_reported,\n` +
    `       count(*) FILTER (WHERE w.rt_backlog_prall) AS rt_backlog,\n` +
    `       count(*) FILTER (WHERE w.is_welded_norepair AND (w.pwht_required OR w.pwht_required_ccc)) AS pwht_required,\n` +
    `       count(*) FILTER (WHERE w.is_welded_norepair AND (w.pwht_required OR w.pwht_required_ccc) AND w.pwht_done_prall) AS pwht_done,\n` +
    `       count(*) FILTER (WHERE w.pwht_backlog_ccc) + count(*) FILTER (WHERE w.pwht_backlog_rest) AS pwht_backlog\n` +
    `  FROM ${JOINT_FROM}\n` +
    ` WHERE ${scopeWhere(scope, p)}\n` +
    ` GROUP BY 1`;
  const HaRowZ = z.object({
    ha: z.string(),
    welded: zCount,
    rt_types: zCount,
    rt_reported: zCount,
    rt_backlog: zCount,
    pwht_required: zCount,
    pwht_done: zCount,
    pwht_backlog: zCount,
  });
  const haRaw = z.array(HaRowZ).parse(await query(haSql, p.list()));
  const toRow = (r: z.infer<typeof HaRowZ>): HaRow => ({
    ha: r.ha,
    welded: r.welded,
    rtTypes: r.rt_types,
    rtReported: r.rt_reported,
    rtPct: pct(r.rt_reported, r.rt_types),
    rtBacklog: r.rt_backlog,
    pwhtRequired: r.pwht_required,
    pwhtDone: r.pwht_done,
    pwhtPct: pct(r.pwht_done, r.pwht_required),
    pwhtBacklog: r.pwht_backlog,
  });
  const haRows = haRaw
    .map(toRow)
    .sort((a, b) => {
      const ia = HA_ORDER.indexOf(a.ha), ib = HA_ORDER.indexOf(b.ha);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.ha.localeCompare(b.ha);
    });
  const sum = (k: keyof z.infer<typeof HaRowZ>) => haRaw.reduce((a, r) => a + (k === "ha" ? 0 : (r[k] as number)), 0);
  const haTotal = toRow({
    ha: "Total",
    welded: sum("welded"),
    rt_types: sum("rt_types"),
    rt_reported: sum("rt_reported"),
    rt_backlog: sum("rt_backlog"),
    pwht_required: sum("pwht_required"),
    pwht_done: sum("pwht_done"),
    pwht_backlog: sum("pwht_backlog"),
  });

  // ── 3. NDE lead time: weld date → first RT report, per party ───────────
  const q = new Params();
  const rtTypes2 = q.any(RT_WELD_TYPES);
  const days = `(w.rt_bl_end - w.weld_date)`;
  const bucketCols = LEAD_BUCKETS.map((b, i) => {
    const lo = i === 0 ? null : LEAD_BUCKETS[i - 1]!.max;
    const cond = [lo === null ? null : `${days} > ${lo}`, b.max === null ? null : `${days} <= ${b.max}`].filter(Boolean).join(" AND ");
    return `count(*) FILTER (WHERE ${cond}) AS b${i}`;
  }).join(",\n       ");
  const leadSql =
    `SELECT coalesce(w.sub_contractor, '(Blank)') AS party,\n` +
    `       count(*) AS joints,\n` +
    `       percentile_cont(0.5) WITHIN GROUP (ORDER BY ${days}) AS median,\n` +
    `       percentile_cont(0.9) WITHIN GROUP (ORDER BY ${days}) AS p90,\n` +
    `       ${bucketCols}\n` +
    `  FROM ${JOINT_FROM}\n` +
    ` WHERE ${scopeWhere(scope, q)} AND w.weld_type = ANY(${rtTypes2})\n` +
    `   AND w.is_rt_reported AND w.rt_bl_end IS NOT NULL AND w.weld_date IS NOT NULL AND w.rt_bl_end >= w.weld_date\n` +
    ` GROUP BY 1\n` +
    ` ORDER BY 2 DESC`;
  const leadRaw = z
    .array(
      z.object({
        party: z.string(),
        joints: zCount,
        median: z.coerce.number().nullable(),
        p90: z.coerce.number().nullable(),
        ...Object.fromEntries(LEAD_BUCKETS.map((_, i) => [`b${i}`, zCount])),
      }),
    )
    .parse(await query(leadSql, q.list()));
  const leadRows: LeadTimeRow[] = leadRaw.map((r) => ({
    party: r.party,
    joints: r.joints,
    shares: LEAD_BUCKETS.map((_, i) => (r.joints > 0 ? ((r[`b${i}` as keyof typeof r] as number) / r.joints) * 100 : 0)),
    median: r.median,
    p90: r.p90,
  }));

  // ── highlights — written from the numbers above, never typed by hand ────
  const highlights: string[] = [];
  if (latest) {
    highlights.push(
      weeksToClear !== null
        ? `RT backlog ${fmt(latest.backlog)} on ${latest.week}; shrinking ${fmt(-slope!)} joints/week over the last four weeks — ${weeksToClear > 104 ? "more than two years" : `about ${weeksToClear.toFixed(0)} weeks`} to clear at that pace.`
        : `RT backlog ${fmt(latest.backlog)} on ${latest.week}; it is not shrinking over the last four weeks (${slope === null ? "no history" : `${slope >= 0 ? "+" : ""}${fmt(slope)} joints/week`}).`,
    );
  }
  if (throughput !== null) highlights.push(`RT/UT throughput averages ${fmt(throughput)} joints/week over the last four weeks.`);
  const named = haRows.filter((r) => HA_ORDER.includes(r.ha));
  if (named.length > 0) {
    const worst = [...named].sort((a, b) => b.rtBacklog + b.pwhtBacklog - (a.rtBacklog + a.pwhtBacklog))[0]!;
    highlights.push(`Largest open backlog by handover area: ${worst.ha} — ${fmt(worst.rtBacklog)} joints awaiting RT and ${fmt(worst.pwhtBacklog)} awaiting PWHT (PWHT ${worst.pwhtPct === null ? "n/a" : `${worst.pwhtPct.toFixed(1)}% done`}).`);
  }
  const slow = [...leadRows].filter((r) => r.joints >= 100 && r.median !== null).sort((a, b) => (b.p90 ?? 0) - (a.p90 ?? 0))[0];
  if (slow) highlights.push(`Slowest NDE turnaround: ${slow.party} — median ${fmt(slow.median!)} days from weld to RT report, 90th percentile ${fmt(slow.p90!)} days (${fmt(slow.joints)} reported joints).`);

  return {
    as_of,
    highlights,
    burndown: { points, slope, weeksToClear, throughput, latest },
    ha: { rows: haRows, total: haTotal },
    leadTime: { buckets: LEAD_BUCKETS.map((b) => b.label), rows: leadRows },
  };
}
