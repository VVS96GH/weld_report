/**
 * Page 20 "RT Backlog Forecast" — the measures.
 *
 * The forecast backlog is NOT the RT backlog. It counts joints that are **not
 * yet welded** and weights each by its RT coverage percentage:
 *
 * ```dax
 * [RT Total Forecast Backlog] =
 *     RT_100 + RT_5 * 0.05 + RT_10 * 0.1 + RT_20 * 0.2 + RT_30 * 0.3
 *   where RT_n = CALCULATE(DISTINCTCOUNT([Joint ID]),
 *                          [Weld Type] IN {"BW","GW","CLET","MW"},
 *                          ISBLANK([Weld Date]),
 *                          [RT%] = n)
 * ```
 *
 * Reproduces the owner's card exactly for every party — CCC 11,732, GAC 1,335,
 * MEDGULF 526, TEKFEN 12, total 13,606 — but only since CCC's `RT/UT(%)` was
 * mapped: the CCC joint record IS the not-yet-welded population, and without
 * its RT% that party contributed 0 to 86 % of the measure.
 */
import { z } from "zod";
import { query } from "@/lib/db";
import {
  byUtAllExpr,
  diaBandExpr,
  JOINT_FROM,
  Params,
  RT_WELD_TYPES,
  type Scope,
  scopeWhere,
  zCount,
  zSum,
} from "./scope";

/** The RT% buckets the forecast weights, and their weights. */
export const FORECAST_WEIGHTS: ReadonlyArray<readonly [number, number]> = [
  [100, 1], [5, 0.05], [10, 0.1], [20, 0.2], [30, 0.3],
];

export type ForecastBacklog = {
  /** `[RT Total Forecast Backlog]` — the weighted sum. */
  total: number;
  /** The unweighted joint counts, per RT% bucket. */
  joints: Record<number, number>;
  /** The weighted contribution of each bucket, as the doughnut slices it. */
  weighted: Record<number, number>;
};

const Row = z.object({
  r100: zCount, r5: zCount, r10: zCount, r20: zCount, r30: zCount,
});

function shape(r: z.infer<typeof Row>): ForecastBacklog {
  const joints: Record<number, number> = {
    100: r.r100, 5: r.r5, 10: r.r10, 20: r.r20, 30: r.r30,
  };
  const weighted: Record<number, number> = {};
  let total = 0;
  for (const [pct, w] of FORECAST_WEIGHTS) {
    weighted[pct] = (joints[pct] ?? 0) * w;
    total += weighted[pct]!;
  }
  return { total, joints, weighted };
}

function selectSql(p: Params, extraGroup?: string): string {
  const buckets = FORECAST_WEIGHTS.map(
    ([pct]) => `count(*) FILTER (WHERE w.rt_pct = ${pct}) AS r${pct}`,
  ).join(",\n       ");
  return (
    `SELECT ${extraGroup ? `${extraGroup} AS grp,\n       ` : ""}${buckets}\n` +
    `  FROM ${JOINT_FROM}\n`
  );
}

/** `ISBLANK([Weld Date])` and the RT weld types — the forecast's population. */
function whereSql(scope: Scope, p: Params): string {
  return (
    `${scopeWhere(scope, p)}\n` +
    `   AND w.weld_date IS NULL\n` +
    `   AND w.weld_type = ANY(${p.any(RT_WELD_TYPES)})`
  );
}

export async function forecastBacklog(scope: Scope): Promise<ForecastBacklog> {
  const p = new Params();
  const sql = `${selectSql(p)} WHERE ${whereSql(scope, p)}`;
  try {
    const rows = await query(sql, p.list());
    return shape(Row.parse(rows[0] ?? { r100: 0, r5: 0, r10: 0, r20: 0, r30: 0 }));
  } catch {
    return shape({ r100: 0, r5: 0, r10: 0, r20: 0, r30: 0 });
  }
}

/** The same, split by sub-contractor — the horizontal grouped bar. */
export async function forecastBacklogBySubcon(
  scope: Scope,
): Promise<Array<{ sub_contractor: string; backlog: ForecastBacklog }>> {
  const p = new Params();
  const sql =
    `${selectSql(p, "coalesce(w.sub_contractor, '(blank)')")}` +
    ` WHERE ${whereSql(scope, p)}\n` +
    ` GROUP BY 1 ORDER BY 1`;
  try {
    const rows = z
      .array(Row.extend({ grp: z.string() }))
      .parse(await query(sql, p.list()));
    return rows
      .map((r) => ({ sub_contractor: r.grp, backlog: shape(r) }))
      .filter((r) => r.backlog.total > 0)
      .sort((x, y) => y.backlog.total - x.backlog.total);
  } catch {
    return [];
  }
}

/**
 * `[RT BACKLOG RT100% Talisman]`.
 *
 * ```dax
 * CALCULATE(DISTINCTCOUNT('TALISMAN DATA'[Joint ID]),
 *           'TALISMAN DATA'[WELD DATE] > 0,
 *           'TALISMAN DATA'[RT% from Project WD+WR] = 100,
 *           'TALISMAN DATA'[RT1 REP NO] = "")
 * ```
 *
 * `RT% from Project WD+WR` is a pbix calculated column — a lookup of the
 * union's RT% by Joint ID — so it is joined from `mv_joint` at read time rather
 * than stored on `ref_talisman_joint`, where a copy could drift.
 *
 * Returns `null`, never 0, when the register is unloaded.
 */
export async function talismanRt100Backlog(): Promise<number | null> {
  try {
    const rows = z
      .array(z.object({ n: zCount }))
      .parse(
        await query(
          // Alias `tj`, not `t`: single-letter aliases collide with the
          // column-contract test's regex scan (`t.` is the UT tracker).
          //
          // `RT% from Project WD+WR` normally resolves through `mv_joint`. The
          // four Joint IDs the M step #"EXLUDE 4 RT B.log CCC" removes from the
          // union are the exception: that step filters the UNION, not
          // `TALISMAN DATA`, so the pbix still resolves their RT% while our
          // lookup finds nothing. All four are in Joint.csv with a weld date
          // and a blank RT1 REP NO, and exactly one — 11060A4-PR6206008-SP3-11
          // — carries RT/UT(%) = 100. That one joint is the whole of this
          // card's 357 against the owner's 358.
          //
          // `weld_manual_exclusion.rt_pct` (migration 0036) gives them
          // somewhere to resolve. It cannot move a union measure: those rows
          // still never enter `weld`, and nothing else reads the column.
          `SELECT count(DISTINCT tj.joint_id) AS n\n` +
            `  FROM ref_talisman_joint tj\n` +
            `  LEFT JOIN mv_joint mj ON mj.joint_id = tj.joint_id\n` +
            `  LEFT JOIN weld_manual_exclusion me ON me.joint_id = tj.joint_id\n` +
            ` WHERE tj.weld_date IS NOT NULL AND tj.rt1_rep_no IS NULL\n` +
            `   AND coalesce(mj.rt_pct, me.rt_pct) = 100`,
        ),
      );
    const n = rows[0]?.n ?? 0;
    return n === 0 ? null : n;
  } catch {
    return null;
  }
}

/** Distinct values for the forecast page's own slicers, memoised per process. */
let optionsCache: Promise<Record<string, string[]>> | null = null;

export function resetForecastOptionsCache(): void {
  optionsCache = null;
}

export async function forecastOptions(
  scope: Scope,
): Promise<Record<string, string[]>> {
  optionsCache ??= (async () => {
    const cols: Record<string, string> = {
      subco: "w.sub_contractor",
      byut: byUtAllExpr(),
      wcat: "w.weld_cat",
      rt: "w.rt_pct::text",
      dia: diaBandExpr(),
    };
    const out: Record<string, string[]> = {};
    for (const [key, expr] of Object.entries(cols)) {
      try {
        const p = new Params();
        const rows = z
          .array(z.object({ v: z.string() }))
          .parse(
            await query(
              `SELECT (${expr}) AS v FROM ${JOINT_FROM}\n` +
                ` WHERE ${scopeWhere(scope, p)}\n` +
                `   AND (${expr}) IS NOT NULL AND btrim(${expr}) <> ''\n` +
                ` GROUP BY 1 ORDER BY count(*) DESC, 1`,
              p.list(),
            ),
          );
        out[key] = rows.map((r) => r.v);
      } catch {
        out[key] = [];
      }
    }
    return out;
  })();
  return optionsCache;
}

/** `[RT BACKLOG Total Project "PR all"]` under the forecast page's scope. */
export async function rtBacklogTotal(scope: Scope): Promise<number> {
  const p = new Params();
  try {
    const rows = z.array(z.object({ n: zCount })).parse(
      await query(
        `SELECT count(*) AS n FROM ${JOINT_FROM}\n` +
          ` WHERE ${scopeWhere(scope, p)} AND w.rt_backlog_prall`,
        p.list(),
      ),
    );
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

export const zForecastSum = zSum;

// ── slice 2: the two monthly progress charts ────────────────────────────────

/**
 * `Joint RT/UT Monthly Progress (Project)` and `Dia RT/UT Monthly Progress`.
 *
 * Both are grouped by **RT date** year+month (`rt_year` / `rt_month`,
 * materialised by migration 0033 — the pbix's `YearRT` / `MonthRT`), from
 * 2024-01 onward, and stacked by Weld Cat F / S.
 *
 * * joints — `[Numb RT/UT "PR all" 2]`: `DISTINCTCOUNT([Joint ID])` with
 *   Weld Date > 0, RT Report <> "", RT Acc/Rej ∉ {RS, U/Review}, related to the
 *   Calendar through RT Date. That is `mv_joint.is_tested_prall`, which is the
 *   same predicate; the `USERELATIONSHIP` is what the RT-date grouping does.
 * * dia — `[Total Welded RT Dia WP1 2024 "PR all"]`:
 *   `SUM([Total Welded Dia "PR all" Table])` with Repair & Reweld = "",
 *   Weld Type in the RT four, `[WeldPoint No.1 WP1] = 1`, RT Report <> "" and
 *   RT Date > 1/1/2024. `[Total Welded Dia "PR all" Table]` is
 *   `CALCULATE(SUM([Dia inch]), [Weld Date] > 0)`, i.e. the row's dia inch on a
 *   welded row — so this sums `dia_inch` at row grain, not joint grain, and it
 *   reads `weld`, not `mv_joint`.
 *
 * Weld Cat `J` is excluded, as the visual does.
 */
export type MonthlyPoint = {
  /** `2024-01` — sortable, and the label is formatted from it. */
  month: string;
  f: number;
  s: number;
  total: number;
};

const MonthlyRow = z.object({
  y: zCount,
  m: zCount,
  f: zSum,
  s: zSum,
});

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** `2024-01` -> `Jan 2024`, the mockup's label form. */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

function toPoints(rows: z.infer<typeof MonthlyRow>[]): MonthlyPoint[] {
  return rows.map((r) => {
    const f = r.f ?? 0;
    const s = r.s ?? 0;
    return {
      month: `${r.y}-${String(r.m).padStart(2, "0")}`,
      f,
      s,
      total: f + s,
    };
  });
}

/** Joints tested, by RT month, split F / S. */
export async function jointMonthlyProgress(scope: Scope): Promise<MonthlyPoint[]> {
  const p = new Params();
  const sql =
    `SELECT w.rt_year AS y, w.rt_month AS m,\n` +
    `       count(*) FILTER (WHERE w.weld_cat = 'F') AS f,\n` +
    `       count(*) FILTER (WHERE w.weld_cat = 'S') AS s\n` +
    `  FROM ${JOINT_FROM}\n` +
    ` WHERE ${scopeWhere(scope, p)}\n` +
    `   AND w.is_tested_prall\n` +
    `   AND w.weld_cat IS DISTINCT FROM 'J'\n` +
    `   AND w.rt_year >= 2024\n` +
    ` GROUP BY 1, 2 ORDER BY 1, 2`;
  try {
    return toPoints(z.array(MonthlyRow).parse(await query(sql, p.list())));
  } catch {
    return [];
  }
}

/**
 * Welded dia inch, by RT month, split F / S.
 *
 * Row grain, not joint grain: `[Total Welded Dia "PR all" Table]` is a per-row
 * value, and the measure gates on `[WeldPoint No.1 WP1] = 1` — `weldpoint_seq`,
 * the pbix's own WP1 column, not `weldpoint_no`.
 */
export async function diaMonthlyProgress(scope: Scope): Promise<MonthlyPoint[]> {
  const p = new Params();
  const sql =
    `SELECT extract(year from w.rt_date)::int AS y,\n` +
    `       extract(month from w.rt_date)::int AS m,\n` +
    `       sum(w.dia_inch) FILTER (WHERE w.weld_cat = 'F') AS f,\n` +
    `       sum(w.dia_inch) FILTER (WHERE w.weld_cat = 'S') AS s\n` +
    `  FROM weld w\n` +
    ` WHERE ${scopeWhere(scope, p, "w")}\n` +
    `   AND w.weldpoint_seq = 1\n` +
    `   AND coalesce(w.repair_reweld, '') = ''\n` +
    `   AND w.weld_type = ANY(${p.any(RT_WELD_TYPES)})\n` +
    `   AND w.rt_report IS NOT NULL\n` +
    `   AND w.weld_date IS NOT NULL\n` +
    `   AND w.weld_cat IS DISTINCT FROM 'J'\n` +
    `   AND w.rt_date > DATE '2024-01-01'\n` +
    ` GROUP BY 1, 2 ORDER BY 1, 2`;
  try {
    return toPoints(z.array(MonthlyRow).parse(await query(sql, p.list())));
  } catch {
    return [];
  }
}

// ── slice 3: the dia family, the averages and the PBI-rule PWHT backlog ─────

/** 2024-01-01, the epoch every "2024" measure counts from. */
export const FORECAST_EPOCH = "2024-01-01";

export type ForecastTotals = {
  /** `[RT Dia Total Forecast Backlog]` — the dia twin of the joint forecast. */
  dia_forecast: number;
  /**
   * `[Numb RT/UT "PR all" 2]` under the cards' own visual filter,
   * `Calendar[Week_End_Date] > 2024-01-01` reached through the RT-date
   * relationship. Both rendered cards (`Numb RT/UT_` and `Numb RT/UT 2024`)
   * use this reading.
   */
  numb_rt_2024: number;
  /** `[RT Average Production …]` on card 322a — no visual filter. */
  avg_prod_month: number | null;
  /** The same measure on card f28b — weld-date week end >= 2024-01-01. */
  avg_prod_month_weld: number | null;
  /** `[Total Welded RT Dia WP1 2024 "PR all"]`, RT week end > 2024-01-01. */
  welded_dia: number;
  /** `[RT Dia Average Production …]` — weld-date week end >= 2024-01-01. */
  dia_avg_prod_month: number | null;
  /** `[RT BACKLOG Dia Total Project "PR all"]`. */
  dia_backlog: number;
  /** `[PWHT All BACKLOG All WELD TYPE "PR all" (New PBI Rule)]`. */
  pwht_backlog_pbi: number;
  /** Days from 2024-01-01 to the latest RT date — both averages' divisor. */
  days_since_2024: number;
};

/**
 * Everything slice 3 adds, in one round trip.
 *
 * The two averages share the DAX's shape:
 * `IF(days > 0, (value / days) * 30, 0)` where `days = DATEDIFF(2024-01-01,
 * MAX([RT Date]), DAY)`. `QTY Years` and both `Months to keep` are ratios of
 * measures already here, so they are derived in the page rather than queried.
 */
export async function forecastTotals(scope: Scope): Promise<ForecastTotals> {
  const p = new Params();
  const w = scopeWhere(scope, p);
  const rt = `w.weld_type = ANY(${p.any(RT_WELD_TYPES)})`;
  const jointSql =
    `SELECT\n` +
    FORECAST_WEIGHTS.map(
      ([pct]) =>
        `  sum(w.dia_inch) FILTER (WHERE w.weld_date IS NULL AND ${rt}` +
        ` AND w.rt_pct = ${pct}) AS d${pct},`,
    ).join("\n") +
    // The card's VISUAL filter is on Calendar[Week_End_Date], not on the date:
    // RT dates 2023-12-30/31 fall in the week ending 2024-01-04 and so PASS,
    // where `rt_date > 2024-01-01` drops them. 172,153 -> 172,521.
    `\n  count(*) FILTER (WHERE w.is_tested_prall\n` +
    `    AND w.rt_week_end > DATE '${FORECAST_EPOCH}') AS numb_2024,\n` +
    // Card 322a takes no visual filter; card f28b filters the WELD-date week
    // end. Two cards, one measure, two numbers -- both are in the inventory.
    `  count(*) FILTER (WHERE w.is_tested_prall\n` +
    `    AND w.rt_year BETWEEN 2024 AND 2026) AS avg_num,\n` +
    `  count(*) FILTER (WHERE w.is_tested_prall\n` +
    `    AND w.rt_year BETWEEN 2024 AND 2026\n` +
    `    AND w.weld_week_end >= DATE '${FORECAST_EPOCH}') AS avg_num_weld,\n` +
    `  count(*) FILTER (WHERE w.pwht_backlog_ccc_new) AS pbi_ccc,\n` +
    `  count(*) FILTER (WHERE w.pwht_backlog_rest) AS pbi_rest\n` +
    `  FROM ${JOINT_FROM} WHERE ${w}`;

  const p2 = new Params();
  const w2 = scopeWhere(scope, p2, "w");
  // `[RT BACKLOG Dia Total Project "PR all"]` is TWO added row-level sums, and
  // both differ from the joint-flag shortcut this first used (6,958):
  //
  //   1  Weld Type in the RT four, Weld Date > 0, RT Report = "",
  //      [WeldPoint No.1 WP1] = 1, RT Weld Status in the SIXTEEN-code hold
  //      list -- no 'T1-2', unlike the "PR all" backlog measures
  //   2  the same plus RT% = 100, with RT Weld Status IN {"?", ""} -- and NO
  //      'S', unlike the joint backlog's own RT%=100 branch
  //
  // 6,811.00 + 20.50 = 6,831.50 -> 6,832, the owner's card exactly.
  const hold16 = p2.any([
    "H", "HS", "HS CCC", "SS", "T", "T1", "T1S", "T1-1", "T1-1S", "T1-2S",
    "T2", "T3", "T2-1", "T2-1S", "T2-2S", "T2S",
  ]);
  const rtTypes = p2.any(RT_WELD_TYPES);
  // The two dia measures are ROW-level, so `calendar` is joined here rather
  // than materialised on the joint view: a joint-grain week end would be the
  // wrong grain for a sum over weld passes.
  //
  // Their visual filters differ from each other: the TOTAL filters the RT-date
  // week end, the AVERAGE filters the weld-date week end. Hence two sums over
  // the same base rows.
  const diaBase =
    `w.weldpoint_seq = 1 AND coalesce(w.repair_reweld, '') = ''\n` +
    `      AND w.weld_type = ANY(${rtTypes})\n` +
    `      AND w.rt_report IS NOT NULL AND w.weld_date IS NOT NULL`;
  const rowSql =
    `SELECT\n` +
    `  sum(w.dia_inch) FILTER (\n` +
    `    WHERE ${diaBase}\n` +
    `      AND crt.week_end_date > DATE '${FORECAST_EPOCH}') AS welded_dia,\n` +
    // NOTE the asymmetry between these two, and that it is the owner's, not
    // ours: the TOTAL reproduces from the visual's week-end filter ALONE (the
    // measure's own `[RT Date] > 1/1/2024` adds nothing on top of it), while
    // the AVERAGE reproduces only with that date condition ALSO applied.
    // 1,648,317 without it, 1,647,092 with it -- and 1,647,092 is the figure
    // the owner's card divides. Both readings are verified against the pbix;
    // neither is smoothed to match the other.
    `  sum(w.dia_inch) FILTER (\n` +
    `    WHERE ${diaBase}\n` +
    `      AND cwd.week_end_date >= DATE '${FORECAST_EPOCH}'\n` +
    `      AND w.rt_date > DATE '${FORECAST_EPOCH}') AS dia_avg_num,\n` +
    `  coalesce(sum(w.dia_inch) FILTER (\n` +
    `    WHERE w.weld_type = ANY(${rtTypes}) AND w.weld_date IS NOT NULL\n` +
    `      AND w.rt_report IS NULL AND w.weldpoint_seq = 1\n` +
    `      AND w.rt_weld_status = ANY(${hold16})), 0)\n` +
    `  + coalesce(sum(w.dia_inch) FILTER (\n` +
    `    WHERE w.weld_type = ANY(${rtTypes}) AND w.weld_date IS NOT NULL\n` +
    `      AND w.rt_pct = 100 AND w.rt_report IS NULL AND w.weldpoint_seq = 1\n` +
    `      AND (w.rt_weld_status IS NULL OR w.rt_weld_status = '?')), 0)\n` +
    `    AS dia_backlog,\n` +
    `  (max(w.rt_date) - DATE '${FORECAST_EPOCH}') AS days\n` +
    `  FROM weld w\n` +
    `  LEFT JOIN calendar crt ON crt.date = w.rt_date\n` +
    `  LEFT JOIN calendar cwd ON cwd.date = w.weld_date\n` +
    ` WHERE ${w2}`;

  const empty: ForecastTotals = {
    dia_forecast: 0, numb_rt_2024: 0, avg_prod_month: null,
    avg_prod_month_weld: null, welded_dia: 0, dia_avg_prod_month: null,
    dia_backlog: 0, pwht_backlog_pbi: 0, days_since_2024: 0,
  };
  try {
    const [j, r] = await Promise.all([
      query(jointSql, p.list()),
      query(rowSql, p2.list()),
    ]);
    const jr = z
      .object({
        d100: zSum, d5: zSum, d10: zSum, d20: zSum, d30: zSum,
        numb_2024: zCount, avg_num: zCount, avg_num_weld: zCount,
        pbi_ccc: zCount, pbi_rest: zCount,
      })
      .parse(j[0] ?? {});
    const rr = z
      .object({
        welded_dia: zSum, dia_avg_num: zSum, dia_backlog: zSum, days: zSum,
      })
      .parse(r[0] ?? {});
    const dia: Record<number, number> = {
      100: jr.d100 ?? 0, 5: jr.d5 ?? 0, 10: jr.d10 ?? 0,
      20: jr.d20 ?? 0, 30: jr.d30 ?? 0,
    };
    const days = rr.days ?? 0;
    const perMonth = (v: number) => (days > 0 ? (v / days) * 30 : 0);
    return {
      dia_forecast: FORECAST_WEIGHTS.reduce(
        (a, [pct, wt]) => a + (dia[pct] ?? 0) * wt,
        0,
      ),
      numb_rt_2024: jr.numb_2024,
      avg_prod_month: days > 0 ? perMonth(jr.avg_num) : null,
      avg_prod_month_weld: days > 0 ? perMonth(jr.avg_num_weld) : null,
      welded_dia: rr.welded_dia ?? 0,
      dia_avg_prod_month: days > 0 ? perMonth(rr.dia_avg_num ?? 0) : null,
      dia_backlog: rr.dia_backlog ?? 0,
      pwht_backlog_pbi: jr.pbi_ccc + jr.pbi_rest,
      days_since_2024: days,
    };
  } catch {
    return empty;
  }
}
