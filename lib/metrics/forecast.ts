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
          `SELECT count(DISTINCT tj.joint_id) AS n\n` +
            `  FROM ref_talisman_joint tj\n` +
            `  JOIN mv_joint mj ON mj.joint_id = tj.joint_id AND mj.rt_pct = 100\n` +
            ` WHERE tj.weld_date IS NOT NULL AND tj.rt1_rep_no IS NULL`,
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
