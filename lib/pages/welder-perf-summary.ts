/**
 * The "Rejection Summary" pages of the Welder Performance tab (pbix pages "Rep.
 * Project Welders Performance. Cumulative Rejection Rate. Summary Report" 2
 * Weeks and 1 Month): per sub-contractor a status table (status ▸ welder, welder
 * count, RT FILM ratio), a notes box, a status doughnut and the trend of the
 * owner's cumulative workbook (lib/welder-perf-cum.ts).
 *
 * The visuals' own filters, verbatim from the pbix:
 *   status tables  BW/CLET/GW/MW, welded, status not blank, Days Since Last RT
 *                  2 weeks: 1..15 (GAC: 0..15, which in DAX also admits a BLANK
 *                  Days Since); 1 month: 0..28, four weeks (owner 2026-11-09, replacing
 *                  2026-10-25's 1..28; the pbix visual had > 0 and < 30). The 1-month
 *                  ratio stays the welder's 0..30 days (rt_w_30)
 *   doughnuts      Days Since Last RT 1..15 (1 month: < 29), status not blank,
 *                  BW/CLET/GW/MW (a page-level filter: CCC 161 ok, not 162)
 * The 2-week ratio is the measure `Last 2 weeks RT FILM Ratio %`, whose own
 * `Days Since Last RT >= 0 && <= 15` REPLACES the visual's filter on that column
 * (owner's 09-Oct page: CCC 0.15 %, GAC ok 0.35 %); the 1-month one is
 * Avg(`RT Film Ratio % "PR all" For Welder LAST 1 MONTH`) over the visual's rows.
 *
 * Owner, 2026-11-03 (replacing 2026-10-25's 1..15): the 2-week window is Days Since 0..15
 * (the pbix measure, one day of margin); the header shows the Friday two weeks back, "Since
 * 16-Oct-26" at the Friday 30-Oct cut-off. Tables, doughnuts, the welders' ratios and the CSV
 * all use the window.
 */
import { z } from "zod";

import { query, queryFresh, withAsOf } from "@/lib/db";
import { chartCutoff } from "@/lib/metrics/trend";
import { type CumKind, rtWindowSql, STATUS_LABELS, utStatusSql, utWindowSql, SHOW_1M, SINCE_2W, WINDOW_2W } from "@/lib/welder-perf-cum";

export const SUMMARY_SUBS = ["CCC", "GAC", "TEKFEN", "MEDGULF"] as const;

export type SummaryWelder = { welder: string; ratio: number | null; welderRatio: number | null };
export type SummaryStatus = { status: string; qty: number; ratio: number | null; welders: SummaryWelder[] };
export type SummarySub = {
  sub: string;
  statuses: SummaryStatus[];
  total: { qty: number; ratio: number | null };
  donut: { status: string; qty: number }[];
  trend: { periods: string[]; series: { status: string; data: (number | null)[] }[] };
  /** Disq.F welders, pre-filled into an empty note. */
  disq: string[];
  note: string | null;
};
export type SummaryPage = {
  kind: CumKind;
  cutoff: string;
  since: string;
  subs: SummarySub[];
  /** Rows a paste into the workbook would add now, and the workbook's last RT date. */
  cum: { lastDate: string | null; pending: number; file: string };
};

const n = z.coerce.number();
const nn = z.union([z.null(), z.coerce.number()]);

const statusSql = (kind: CumKind, r: string) => {
  const [l1, l2, l3, l4] = STATUS_LABELS[kind].map((s) => `'${s}'`);
  return `CASE WHEN ${r} >= 0 AND ${r} < 0.05 THEN ${l1} WHEN ${r} >= 0.05 AND ${r} < 0.075 THEN ${l2}
               WHEN ${r} >= 0.075 AND ${r} < 0.10 THEN ${l3} WHEN ${r} >= 0.10 AND ${r} <= 1 THEN ${l4} END`;
};

/** The base rows: welder status / ratio at the cut-off, Days Since Last RT as `d`. */
function baseCte(kind: CumKind): string {
  const ratios = kind === "2w" ? rtWindowSql("$1::date") : "(SELECT welder_id, rt_w_30 AS r FROM mv_welder_status)";
  return `v AS (
  SELECT p.*, ws.r AS wr, ${statusSql(kind, "ws.r")} AS st, $1::date - p.last_rt_date AS d
    FROM mv_welder_perf p JOIN ${ratios} ws USING (welder_id)
   WHERE p.sub_contractor = ANY($2) AND (p.weld_date IS NULL OR p.weld_date <= $1::date)
)`;
}

/** The status table's row filter (the visual's; GAC also admits a blank Days Since). */
function tableWindow(kind: CumKind): string {
  return kind === "2w"
    ? `(d BETWEEN 0 AND ${WINDOW_2W} OR (sub_contractor = 'GAC' AND d IS NULL))`
    : `d BETWEEN 0 AND ${SHOW_1M}`;
}

const TableRow = z.object({ sub: z.string(), st: z.string(), welder: z.string(), r: nn, f: nn, wsum: nn, wcnt: nn, wr: nn });

export async function getSummaryPage(kind: CumKind, pending: { lastDate: string | null; rows: number }): Promise<SummaryPage> {
  const { as_of } = await withAsOf(null);
  const cutoff = chartCutoff(as_of);
  const subs = [...SUMMARY_SUBS];
  if (kind === "ut2w") return getUtSummaryPage(cutoff, subs, pending);
  const visual = `weld_type IN ('BW','CLET','GW','MW') AND weld_date IS NOT NULL AND st IS NOT NULL`;

  // status table, per welder: the welders the visual shows, and their ratio
  const tableSql =
    `WITH ${baseCte(kind)},\n` +
    `vis AS (SELECT DISTINCT sub_contractor, welder_id, st FROM v WHERE ${visual} AND ${tableWindow(kind)})\n` +
    `SELECT vis.sub_contractor AS sub, vis.st, vis.welder_id AS welder,\n` +
    // 2 weeks: the window's films (+ a blank Days Since)
    `       sum(v.films_r) FILTER (WHERE v.d IS NULL OR v.d BETWEEN 0 AND ${WINDOW_2W}) AS r,\n` +
    `       sum(v.films) FILTER (WHERE v.d IS NULL OR v.d BETWEEN 0 AND ${WINDOW_2W}) AS f,\n` +
    // 1 month: Avg of the welder column over the visual's rows (row-weighted)
    `       sum(v.wr * v.n_rows) FILTER (WHERE ${tableWindow(kind)}) AS wsum,\n` +
    `       sum(v.n_rows) FILTER (WHERE ${tableWindow(kind)}) AS wcnt,\n` +
    `       max(v.wr) AS wr\n` +
    `  FROM vis JOIN v USING (sub_contractor, welder_id, st)\n` +
    ` WHERE v.${visual.replace(/ AND /g, " AND v.")}\n` +
    ` GROUP BY 1, 2, 3`;
  const donutSql =
    `WITH ${baseCte(kind)}\n` +
    `SELECT sub_contractor AS sub, st, count(DISTINCT welder_id) AS qty FROM v\n` +
    ` WHERE st IS NOT NULL AND weld_type IN ('BW','CLET','GW','MW') AND ${kind === "2w" ? `d BETWEEN 0 AND ${WINDOW_2W}` : `d BETWEEN 0 AND ${SHOW_1M}`}\n GROUP BY 1, 2`;
  const trendSql =
    `SELECT sub_contractor AS sub, period, status AS st, count(DISTINCT welder_id) AS qty,
            min(last_rt_date)::text AS first_day
       FROM ref_welder_perf_cum WHERE kind = $1 AND sub_contractor = ANY($2) AND period IS NOT NULL AND status IS NOT NULL
      GROUP BY 1, 2, 3`;
  const [tRows, dRows, trRows, notes] = await Promise.all([
    query(tableSql, [cutoff, subs]),
    query(donutSql, [cutoff, subs]),
    // the CUM rows and the notes change between refreshes: never from the read cache
    queryFresh(trendSql, [kind, subs]),
    queryFresh(`SELECT sub_contractor AS sub, body FROM welder_perf_note WHERE kind = $1 AND cutoff = $2::date`, [kind, cutoff]),
  ]);
  const table = z.array(TableRow).parse(tRows);
  const donut = z.array(z.object({ sub: z.string(), st: z.string(), qty: n })).parse(dRows);
  const trend = z.array(z.object({ sub: z.string(), period: z.string(), st: z.string(), qty: n, first_day: z.string() })).parse(trRows);
  const noteBy = new Map(z.array(z.object({ sub: z.string(), body: z.string() })).parse(notes).map((x) => [x.sub, x.body]));
  const labels = STATUS_LABELS[kind];
  const periodNo = (p: string) => Number(/^\s*(\d+)/.exec(p)?.[1] ?? 0);
  // one period range for every chart: the workbook's latest 7 periods (owner, 2026-10-14)
  const lastPeriod = Math.max(0, ...trend.map((t) => periodNo(t.period)));

  const out: SummarySub[] = subs.map((sub) => {
    const mine = table.filter((r) => r.sub === sub);
    const ratioOf = (rows: typeof mine) => {
      if (kind === "1m") {
        const c = rows.reduce((s, r) => s + (r.wcnt ?? 0), 0);
        return c > 0 ? rows.reduce((s, r) => s + (r.wsum ?? 0), 0) / c : null;
      }
      const f = rows.reduce((s, r) => s + (r.f ?? 0), 0);
      return f > 0 ? rows.reduce((s, r) => s + (r.r ?? 0), 0) / f : null;
    };
    const statuses: SummaryStatus[] = labels
      .map((st) => {
        const rows = mine.filter((r) => r.st === st).sort((a, b) => a.welder.localeCompare(b.welder));
        return {
          status: st,
          qty: rows.length,
          ratio: ratioOf(rows),
          welders: rows.map((r) => ({
            welder: r.welder,
            ratio: kind === "1m" ? (r.wcnt ? (r.wsum ?? 0) / r.wcnt : null) : r.f && r.f > 0 ? (r.r ?? 0) / r.f : null,
            welderRatio: r.wr,
          })),
        };
      })
      .filter((s) => s.qty > 0);
    // periods of this sub-contractor in the workbook, latest 9 (the pbix charts show 8-10)
    const tr = trend.filter((t) => t.sub === sub);
    const periods = [...new Set(tr.map((t) => t.period))]
      .filter((p) => periodNo(p) > lastPeriod - 7)
      .sort((a, b) => periodNo(a) - periodNo(b));
    const series = labels
      .map((st) => ({
        status: st,
        data: periods.map((p) => tr.find((t) => t.period === p && t.st === st)?.qty ?? null),
      }))
      .filter((s) => s.data.some((v) => v !== null));
    return {
      sub,
      statuses,
      total: { qty: mine.length, ratio: ratioOf(mine) },
      donut: labels
        .map((st) => ({ status: st, qty: donut.find((d) => d.sub === sub && d.st === st)?.qty ?? 0 }))
        .filter((d) => d.qty > 0),
      trend: { periods, series },
      disq: mine.filter((r) => r.st === labels[labels.length - 1]).map((r) => r.welder).sort(),
      note: noteBy.get(sub) ?? null,
    };
  });
  const back = (iso: string, days: number) => {
    const t = new Date(`${iso}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() - days);
    return t.toISOString().slice(0, 10);
  };
  return {
    kind,
    cutoff,
    since: back(cutoff, kind === "2w" ? SINCE_2W : SHOW_1M),
    subs: out,
    cum: { lastDate: pending.lastDate, pending: pending.rows, file: kind },
  };
}

/**
 * The UT Rej.Summary page (owner, 2026-11-02, as the pbix "UT Project Welders Performance.
 * Cumulative Rejection Rate. Summary Report Last 2 weeks"): per sub-contractor the welders whose
 * joints were UT-reported 0..15 days before the cut-off, by their UT Rej Length Ratio % LAST 2
 * WEEKS (rejected / inspected length; none inspected yet = 0 %), the group's ratio over the
 * window's rows, the doughnut, notes and the trend of the UT CUM workbook.
 */
async function getUtSummaryPage(
  cutoff: string,
  subs: string[],
  pending: { lastDate: string | null; rows: number },
): Promise<SummaryPage> {
  const kind: CumKind = "ut2w";
  const win = `p.has_ut AND p.weld_type IN ('BW','CLET','GW','MW') AND p.weld_date IS NOT NULL
               AND p.weld_date <= $1::date AND $1::date - p.last_ut_date BETWEEN 0 AND ${WINDOW_2W}`;
  const tableSql = `
    SELECT p.sub_contractor AS sub, ${utStatusSql("coalesce(ws.r, 0)")} AS st, p.welder_id AS welder,
           sum(p.defect) AS r, sum(p.insp) AS f, NULL::numeric AS wsum, NULL::numeric AS wcnt,
           max(coalesce(ws.r, 0)) AS wr
      FROM mv_welder_perf p JOIN ${utWindowSql("$1::date")} ws USING (welder_id)
     WHERE p.sub_contractor = ANY($2) AND ${win}
     GROUP BY 1, 2, 3`;
  const trendSql = `SELECT sub_contractor AS sub, period, status AS st, count(DISTINCT welder_id) AS qty
                      FROM ref_welder_perf_cum WHERE kind = $1 AND sub_contractor = ANY($2)
                       AND period IS NOT NULL AND status IS NOT NULL GROUP BY 1, 2, 3`;
  const [tRows, trRows, notes] = await Promise.all([
    query(tableSql, [cutoff, subs]),
    queryFresh(trendSql, [kind, subs]),
    queryFresh(`SELECT sub_contractor AS sub, body FROM welder_perf_note WHERE kind = $1 AND cutoff = $2::date`, [kind, cutoff]),
  ]);
  const table = z.array(TableRow).parse(tRows);
  const trend = z.array(z.object({ sub: z.string(), period: z.string(), st: z.string(), qty: n })).parse(trRows);
  const noteBy = new Map(z.array(z.object({ sub: z.string(), body: z.string() })).parse(notes).map((x) => [x.sub, x.body]));
  const labels = STATUS_LABELS[kind];
  const periodNo = (p: string) => Number(/^\s*(\d+)/.exec(p)?.[1] ?? 0);
  const lastPeriod = Math.max(0, ...trend.map((t) => periodNo(t.period)));
  const ratio = (rows: typeof table) => {
    const f = rows.reduce((s, r) => s + (r.f ?? 0), 0);
    return f > 0 ? rows.reduce((s, r) => s + (r.r ?? 0), 0) / f : rows.length ? 0 : null;
  };
  const out: SummarySub[] = subs.map((sub) => {
    const mine = table.filter((r) => r.sub === sub);
    const statuses: SummaryStatus[] = labels
      .map((st) => {
        const rows = mine.filter((r) => r.st === st).sort((a, b) => a.welder.localeCompare(b.welder));
        return {
          status: st,
          qty: rows.length,
          ratio: ratio(rows),
          welders: rows.map((r) => ({ welder: r.welder, ratio: r.f && r.f > 0 ? (r.r ?? 0) / r.f : 0, welderRatio: r.wr })),
        };
      })
      .filter((s) => s.qty > 0);
    const tr = trend.filter((t) => t.sub === sub);
    const periods = [...new Set(tr.map((t) => t.period))]
      .filter((p) => periodNo(p) > lastPeriod - 7)
      .sort((a, b) => periodNo(a) - periodNo(b));
    const series = labels
      .map((st) => ({ status: st, data: periods.map((p) => tr.find((t) => t.period === p && t.st === st)?.qty ?? null) }))
      .filter((s) => s.data.some((v) => v !== null));
    return {
      sub,
      statuses,
      total: { qty: mine.length, ratio: ratio(mine) },
      donut: statuses.map((s) => ({ status: s.status, qty: s.qty })),
      trend: { periods, series },
      disq: mine.filter((r) => r.st === labels[labels.length - 1]).map((r) => r.welder).sort(),
      note: noteBy.get(sub) ?? null,
    };
  });
  const t = new Date(`${cutoff}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - SINCE_2W);
  return {
    kind,
    cutoff,
    since: t.toISOString().slice(0, 10),
    subs: out,
    cum: { lastDate: pending.lastDate, pending: pending.rows, file: kind },
  };
}

/** Save one sub-contractor's note for a cut-off (empty text deletes it). */
export async function saveNote(kind: CumKind, cutoff: string, sub: string, body: string): Promise<void> {
  if (!body.trim()) {
    await queryFresh(`DELETE FROM welder_perf_note WHERE kind = $1 AND cutoff = $2::date AND sub_contractor = $3`, [kind, cutoff, sub]);
    return;
  }
  await queryFresh(
    `INSERT INTO welder_perf_note (kind, cutoff, sub_contractor, body, updated_at) VALUES ($1, $2::date, $3, $4, now())
     ON CONFLICT (kind, cutoff, sub_contractor) DO UPDATE SET body = EXCLUDED.body, updated_at = now()`,
    [kind, cutoff, sub, body],
  );
}
