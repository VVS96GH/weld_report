/**
 * The "Demo" screen (owner request 2026-09-16: "собери демо-экран, посмотрим,
 * как будет выглядеть"): four advanced widgets over the PROJECT scope, every
 * number a measure the report already computes — nothing here is a new metric.
 *
 *   1. KPI tiles with a 12-week sparkline      — mv_weekly_progress (M05 family)
 *   2. Waterfall: the RT backlog partition      — M41 → M45 / M46 / M47 (page 2's cells)
 *   3. Aging heatmap: service class × bucket    — M51 over the "PR all" RT backlog
 *   4. Pareto of rejected films by WPS          — the per-WPS pivot of pages 41–44
 *
 * Pure data; the view is components/DemoView.tsx.
 */

import { z } from "zod";
import { query, withAsOf } from "@/lib/db";
import {
  AGING_BUCKETS,
  JOINT_FROM,
  Params,
  PROJECT_EXCLUDED_SUBCONTRACTORS,
  projectScope,
  scopeWhere,
  SOURCES_PR_ALL_LOADED,
  zCount,
} from "@/lib/metrics/scope";
import { backlogAgingBy, RT_BACKLOG_PRALL } from "@/lib/metrics/rt";
import { weeklyProgress } from "@/lib/metrics/trend";
import { wpsRejectionTable } from "@/lib/metrics/wps";

export type SparkKpi = {
  label: string;
  /** Latest week's value, formatted. */
  value: string;
  /** Week-end dates, oldest first. */
  weeks: string[];
  series: number[];
  /** Change versus the previous week, formatted with sign; null when unknown. */
  delta: string | null;
  percent?: boolean;
};

export type WaterfallStep = { label: string; value: number };

export type HeatmapRow = { label: string; cells: number[]; total: number };

export type ParetoRow = { label: string; count: number; share: number; cumulative: number; /** the long-tail bucket, not a WPS */ other?: boolean };

export type DemoData = {
  as_of: string;
  kpis: SparkKpi[];
  waterfall: { total: WaterfallStep; steps: WaterfallStep[]; fabricated: number };
  heatmap: { buckets: string[]; rows: HeatmapRow[]; max: number; classesTotal: number };
  pareto: { rows: ParetoRow[]; total: number; wpsTotal: number };
};

const NF = new Intl.NumberFormat("en-US");
const fmtInt = (v: number) => NF.format(Math.round(v));
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

function kpi(label: string, weeks: string[], series: number[], percent = false): SparkKpi {
  const last = series[series.length - 1] ?? 0;
  const prev = series.length > 1 ? series[series.length - 2]! : null;
  const fmt = percent ? fmtPct : fmtInt;
  const delta =
    prev === null
      ? null
      : percent
        ? `${last - prev >= 0 ? "+" : ""}${(last - prev).toFixed(2)} pp`
        : `${last - prev >= 0 ? "+" : ""}${fmtInt(last - prev)}`;
  return { label, value: fmt(last), weeks, series, delta, percent };
}

export async function getDemoData(): Promise<DemoData> {
  const { as_of } = await withAsOf(null);
  const scope = projectScope();

  // ── 1. weekly sparklines ───────────────────────────────────────────────
  const weekly = await weeklyProgress({
    sources: SOURCES_PR_ALL_LOADED,
    excludeSubContractors: PROJECT_EXCLUDED_SUBCONTRACTORS,
    excludeWeldCats: ["J"],
    weeks: 12,
  });
  const weeks = [...new Set(weekly.map((p) => p.week_end_date))].sort();
  const byWeek = (field: "joints_welded" | "tested" | "films_taken" | "films_rejected") =>
    weeks.map((wk) => weekly.filter((p) => p.week_end_date === wk).reduce((a, p) => a + (p[field] ?? 0), 0));
  const welded = byWeek("joints_welded");
  const tested = byWeek("tested");
  const filmsTaken = byWeek("films_taken");
  const filmsRej = byWeek("films_rejected");
  const rejRate = filmsTaken.map((t, i) => (t > 0 ? ((filmsRej[i] ?? 0) / t) * 100 : 0));

  // ── 2. the RT backlog partition (page 2's Total row, "PR all") ─────────
  const p = new Params();
  const partSql =
    `SELECT count(*) FILTER (WHERE w.rt_backlog_prall)               AS total,\n` +
    `       count(*) FILTER (WHERE w.rt_backlog_pwht_y_done_prall)   AS y_done,\n` +
    `       count(*) FILTER (WHERE w.rt_backlog_pwht_n_prall)        AS n,\n` +
    `       count(*) FILTER (WHERE w.rt_backlog_pwht_y_not_done_prall)\n` +
    `     + count(*) FILTER (WHERE w.rt_backlog_pwht_y_not_done_ccc) AS y_not_done,\n` +
    `       count(*) FILTER (WHERE w.rt_backlog_fabricated)          AS fabricated\n` +
    `  FROM ${JOINT_FROM}\n` +
    ` WHERE ${scopeWhere(scope, p)}`;
  const part = z
    .object({ total: zCount, y_done: zCount, n: zCount, y_not_done: zCount, fabricated: zCount })
    .parse((await query(partSql, p.list()))[0] ?? {});

  // ── 3. aging heatmap: service class × bucket over the RT backlog ───────
  const aging = await backlogAgingBy(scope, as_of, RT_BACKLOG_PRALL, {
    key: "cls",
    sql: "btrim(w.service_class_cat_wd)",
  });
  const buckets = AGING_BUCKETS.map((b) => b.label);
  const heatRows: HeatmapRow[] = [...aging.entries()]
    .filter((e): e is [string, (typeof e)[1]] => e[0] !== null && e[0] !== "")
    .map(([label, a]) => {
      const cells = AGING_BUCKETS.map((b) => a[b.key]);
      return { label, cells, total: cells.reduce((s, v) => s + v, 0) };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const top = heatRows.slice(0, 15);
  const max = top.reduce((m, r) => Math.max(m, ...r.cells), 0);

  // ── 4. Pareto of rejected films by WPS (pages 41–44's pivot, project-wide) ──
  const wps = await wpsRejectionTable({ ...scope, wpsPresent: true, excludeWeldTypes: ["DMY", "THD"] });
  const rejected = wps
    .map((r) => ({ label: r.wps_no, count: r.rt_films_rejected ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const rejTotal = rejected.reduce((s, r) => s + r.count, 0);
  const head = rejected.slice(0, 20);
  const rest = rejected.slice(20).reduce((s, r) => s + r.count, 0);
  const paretoSrc: { label: string; count: number; other?: boolean }[] =
    rest > 0 ? [...head, { label: `Other (${rejected.length - head.length} WPS)`, count: rest, other: true }] : head;
  let cum = 0;
  const pareto: ParetoRow[] = paretoSrc.map((r) => {
    const share = rejTotal > 0 ? (r.count / rejTotal) * 100 : 0;
    cum += share;
    return { label: r.label, count: r.count, share, cumulative: Math.min(100, cum), ...(r.other ? { other: true } : {}) };
  });

  return {
    as_of,
    kpis: [
      kpi("Joints welded / week", weeks, welded),
      kpi("RT/UT tested / week", weeks, tested),
      kpi("Films rejected / week", weeks, filmsRej),
      kpi("% RT film rejection / week", weeks, rejRate, true),
    ],
    waterfall: {
      total: { label: "RT B.Log Total Project", value: part.total },
      steps: [
        { label: 'PWHT "Y" Done', value: part.y_done },
        { label: 'PWHT "N"', value: part.n },
        { label: 'PWHT "Y" NOT Done', value: part.y_not_done },
      ],
      fabricated: part.fabricated,
    },
    heatmap: { buckets, rows: top, max, classesTotal: heatRows.length },
    pareto: { rows: pareto, total: rejTotal, wpsTotal: rejected.length },
  };
}
