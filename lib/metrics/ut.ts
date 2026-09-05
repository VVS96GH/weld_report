/**
 * UT / PAUT metrics — M30, M31, M33, M37, M38.
 *
 * The `"EP"` family reads `ut_weld_status` / `ut_report` off the dump.
 *
 * The `"PR all"` family (M32/M34) reads the UT-tracker OVERLAY columns
 * `manual_ut_report_no_all` / `manual_ut_status_all`, which the loader
 * materialises from `[Manual UT Report No.]` / `[Manual UT Status.]` — the
 * pbix's *calculated* columns (note the trailing dot), kept separate from the
 * imported `manual_ut_report_no` so the raw value survives
 * (project-wd-wr-inco-acciona.md §5.3 #8). `UT TRACKER (CCC)_Talisman.xlsx` is
 * loaded (R2-14); `UT TRACKER (GAC)_Master.xlsx` and `UT TRACKER (TEK).xlsx`
 * are still missing, so GAC/TEKFEN keep their raw `UT Acc/Rej` fallback and
 * ruling R-05 stays open for them.
 *
 * M33/M35/M36 read the loader-materialised `weld_length_m` /
 * `inspected_length_mm` / `defect_length_mm` columns (migration 0012). All
 * three resolve through `[Weld Length "PR all"]`, a `LOOKUPVALUE` into the
 * `Weld Length` dimension (`weld_length_by_dia`), whose workbook is still
 * absent (§7 C-12) — so they are NULL today and the pages render honest-empty.
 * Reading the columns rather than hardcoding NULL means they start working the
 * moment the workbook lands, instead of silently staying blank.
 *
 * Reality check: MEDGULF has zero rows with a `UT Report` in this dump, which
 * matches the mockup's blank UT columns on pages 6 and 11 (§4.6 finding 5).
 */

import { z } from "zod";
import { query } from "@/lib/db";
import {
  type AggSpec,
  type GroupSpec,
  Params,
  type Scope,
  and,
  buildGroupedSelect,
  divide,
  filterWhere,
  JOINT_FROM,
  scopeWhere,
  zCount,
  zSum,
  zText,
} from "./scope";

/** M30 `[Numb UT "EP"]` — `UT Weld Status = 'NR'` and a UT report exists. */
export function utDoneCond(p: Params, a = "w"): string {
  return and([
    `${a}.ut_weld_status = ${p.add("NR")}`,
    `${a}.ut_report IS NOT NULL`,
  ]);
}

export function utAggs(p: Params, a = "w"): AggSpec[] {
  void p;
  return [
    { key: "ut_done", sql: `count(*) ${filterWhere([`${a}.ut_done`])}` },          // M30
    { key: "ut_accepted", sql: `count(*) ${filterWhere([`${a}.ut_accepted`])}` },  // M31 "A"
    { key: "ut_rejected", sql: `count(*) ${filterWhere([`${a}.ut_rejected`])}` },  // M31 "R"
    { key: "ut_weld_length_m", sql: `sum(${a}.ut_weld_length_m)` },                // M33
    // `Rej Length` over rejected UT joints — the raw column behind the non-Inco,
    // non-CCC branch of `[Defect Length(MM).]`. There is no "EP" M34 (§M34).
    { key: "ut_rej_length_m", sql: `sum(${a}.ut_rej_length_m)` },
  ];
}

const UtRow = z.object({
  ut_done: zCount,
  ut_accepted: zCount,
  ut_rejected: zCount,
  ut_weld_length_m: zSum,
  ut_rej_length_m: zSum,
});

export type UtStats = {
  /** M30 `[Numb UT "EP"]`. */
  ut_done: number;
  /** M31 `[Numb UT "A" "EP"]`. */
  ut_accepted: number;
  /** M31 `[Numb UT "R" "EP"]`. */
  ut_rejected: number;
  /** M37 `[Rejection UT Rate Joint "EP"]` = M31r / M30. */
  ut_rejection_rate_joint: number | null;
  /** M33 `[UT Weld Length by Joint "EP"]`, metres. */
  ut_weld_length_m: number;
  /** `sum([Rej Length])` over rejected UT joints — see the note above. */
  ut_rej_length_m: number;
};

function toStats(r: z.infer<typeof UtRow>): UtStats {
  return {
    ut_done: r.ut_done,
    ut_accepted: r.ut_accepted,
    ut_rejected: r.ut_rejected,
    ut_rejection_rate_joint: divide(r.ut_rejected, r.ut_done),
    ut_weld_length_m: r.ut_weld_length_m ?? 0,
    ut_rej_length_m: r.ut_rej_length_m ?? 0,
  };
}

const EMPTY = {
  ut_done: 0,
  ut_accepted: 0,
  ut_rejected: 0,
  ut_weld_length_m: null,
  ut_rej_length_m: null,
};

/** M30, M31, M33, M37 for one scope. */
export async function utStats(scope: Scope): Promise<UtStats> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [],
    aggs: utAggs(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  return toStats(UtRow.parse(rows[0] ?? EMPTY));
}

/** The same bundle, grouped. */
export async function utStatsBy(
  scope: Scope,
  group: GroupSpec,
): Promise<Map<string | null, UtStats>> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [group],
    aggs: utAggs(p),
    where: scopeWhere(scope, p),
  });
  const rows = await query(sql, p.list());
  const out = new Map<string | null, UtStats>();
  for (const raw of rows) {
    const key = zText.parse((raw as Record<string, unknown>)[group.key] ?? null);
    out.set(key, toStats(UtRow.parse(raw)));
  }
  return out;
}

/** Map one row of a combined `utAggs()` select into {@link UtStats}. */
export function utStatsFromRow(raw: unknown): UtStats {
  return toStats(UtRow.parse(raw));
}

// ── "PR all" variants ───────────────────────────────────────────────────────

/**
 * M32 `[Numb UT "PR All"]` — keys off `[Manual UT Report No.]`, the calculated
 * overlay, NOT `UT Report`.
 * `[Numb UT "R" "PR All"]` adds `[Manual UT Status.] = "R"`;
 * `[Numb UT "A" "PR All"]` is the subtraction, exactly as the DAX writes it.
 */
export function utDoneCondPrAll(a = "w"): string {
  return `${a}.manual_ut_report_no_all IS NOT NULL`;
}

/**
 * M34 `[UT Defect Length by Joint "PR all"]` — `SUM([Defect Length(MM).])` over
 * rows with a manual UT report and status `R`.
 *
 * `[Defect Length(MM).]`
 * (project-wd-wr-inco-acciona.md:2114-2138) is:
 *   Inco + manual report        -> [Repair Length (mm)] / 1000   (no Inco rows, no column)
 *   manual report AND By UT='Y' -> [Rej Length]                  (per-row, dump)
 *   CCC AND Manual UT Status.='R' -> LOOKUPVALUE(UT TRACKER (CCC)[Defect Lenght(MM).])
 *   else                        -> 0
 *
 * DISTINCT-SAFETY DIVERGENCE (ruling R2-01). The CCC term is a **joint-level
 * lookup**, not a per-pass share: the tracker holds one row per joint, so
 * adding it on every one of CCC's ~4 welder-pass rows would inflate the answer
 * ~4x. It is therefore gated on `weldpoint_seq = 1` (the pbix `WP1` flag). The
 * `Rej Length` term is a genuine per-row column on the dump and stays ungated.
 * This is the rule the audit settles on: per-row source values sum ungated,
 * joint-level lookups are de-duplicated to one row per joint.
 */
export function defectLengthExpr(p: Params, a = "w"): string {
  const ccc = p.add("CCC");
  const r = p.add("R");
  const y = p.add("Y");
  return (
    `CASE\n` +
    // Migration 0012 materialises the DAX column itself; prefer it when the
    // loader has filled it and fall back to the branches below otherwise.
    `         WHEN ${a}.defect_length_mm IS NOT NULL THEN ${a}.defect_length_mm\n` +
    `         WHEN ${a}.manual_ut_report_no_all IS NOT NULL AND ${a}.by_ut = ${y} THEN ${a}.rej_length\n` +
    `         WHEN ${a}.manual_ut_status_all = ${r} AND ${a}.sub_contractor = ${ccc} AND ${a}.weldpoint_seq = 1\n` +
    `           THEN (SELECT max(t.weld_defect_length) FROM ref_ut_tracker_ccc t WHERE t.joint_id = ${a}.joint_id)\n` +
    `         ELSE 0\n` +
    `       END`
  );
}

export function utAggsPrAll(p: Params, a = "w"): AggSpec[] {
  void p;
  return [
    { key: "ut_done", sql: `count(*) ${filterWhere([`${a}.ut_done_prall`])}` },
    // [Numb UT "A" "PR All"] = [Numb UT "PR All"] - [Numb UT "R" "PR All"]
    {
      key: "ut_accepted",
      sql:
        `count(*) ${filterWhere([`${a}.ut_done_prall`])}` +
        ` - count(*) ${filterWhere([`${a}.ut_rejected_prall`])}`,
    },
    { key: "ut_rejected", sql: `count(*) ${filterWhere([`${a}.ut_rejected_prall`])}` },
    { key: "ut_weld_length_m", sql: `sum(${a}.ut_weld_length_m_prall)` },   // M33
    { key: "ut_rej_length_m", sql: `sum(${a}.ut_defect_length_prall)` },    // M34
  ];
}

/** M32, M34, M37 for one `"PR all"` scope. */
export async function utStatsPrAll(scope: Scope): Promise<UtStats> {
  const p = new Params();
  const sql = buildGroupedSelect({
    groups: [],
    aggs: utAggsPrAll(p),
    where: scopeWhere(scope, p),
  });
  try {
    const rows = await query(sql, p.list());
    return toStats(UtRow.parse(rows[0] ?? EMPTY));
  } catch {
    // ref_ut_tracker_ccc missing → the whole UT block is unknown, not zero.
    return toStats(UtRow.parse(EMPTY));
  }
}

/** `true` when `ref_ut_tracker_ccc` has rows (R2-14); otherwise M34 is unknown. */
export async function utTrackerCccLoaded(): Promise<boolean> {
  try {
    const rows = await query<{ present: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM ref_ut_tracker_ccc) AS present",
    );
    return Boolean(rows[0]?.present);
  } catch {
    return false;
  }
}

/**
 * Per-source COVERAGE of the UT measures within a scope.
 *
 * An existence check is not enough and produced a fabricated zero twice. The
 * first version asked "is `ref_ut_tracker_ccc` loaded?" — the workbook can hold
 * its 9,419 rows while the overlay is still NULL on every `weld` row. The
 * second asked "does any in-scope row have the overlay?" — which went true the
 * moment INCO's 441 rows landed, and INCO is excluded from project scope
 * (R3-01), so the KPIs computed over nothing and rendered `0`.
 *
 * The honest question is per source: which of the sources actually IN this
 * scope contribute to the measure? None → the KPI is unknown (`—`). Some → show
 * the partial total and name what it does and does not cover, the same policy
 * page 1 already uses for the source union itself.
 */
export type UtCoverage = {
  /** In-scope sources with at least one joint feeding the UT joint measures. */
  covered: string[];
  /** In-scope sources with joints but no UT input materialised. */
  uncovered: string[];
  /** In-scope sources with a resolvable `[Weld Length "PR all"]` (M33/M35/M36). */
  lengthCovered: string[];
  /** In-scope sources whose weld length cannot resolve. */
  lengthUncovered: string[];
};

export const EMPTY_UT_COVERAGE: UtCoverage = {
  covered: [],
  uncovered: [],
  lengthCovered: [],
  lengthUncovered: [],
};

export async function utCoverage(scope: Scope): Promise<UtCoverage> {
  const p = new Params();
  const sql =
    `SELECT w.source::text AS source,\n` +
    `       count(*) FILTER (WHERE w.ut_done_prall) AS ut_joints,\n` +
    `       count(*) FILTER (WHERE w.ut_weld_length_m_prall IS NOT NULL) AS len_joints\n` +
    `  FROM ${JOINT_FROM}\n` +
    ` WHERE ${scopeWhere(scope, p)}\n` +
    ` GROUP BY 1`;
  try {
    const rows = z
      .array(z.object({ source: z.string(), ut_joints: zCount, len_joints: zCount }))
      .parse(await query(sql, p.list()));
    const out: UtCoverage = {
      covered: [],
      uncovered: [],
      lengthCovered: [],
      lengthUncovered: [],
    };
    for (const r of rows) {
      (r.ut_joints > 0 ? out.covered : out.uncovered).push(r.source);
      (r.len_joints > 0 ? out.lengthCovered : out.lengthUncovered).push(r.source);
    }
    return out;
  } catch {
    return EMPTY_UT_COVERAGE;
  }
}

/**
 * `true` when the `weld_length_by_dia` dimension has rows. Kept for the
 * provenance note only: `weld.weld_length_m` can be populated from a source's
 * own column while this reference dimension is still empty, so it must NOT be
 * used as the gate — {@link utCoverage}'s `lengthCovered` is the gate.
 */
export async function weldLengthDimensionLoaded(): Promise<boolean> {
  try {
    const rows = await query<{ present: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM weld_length_by_dia) AS present",
    );
    return Boolean(rows[0]?.present);
  } catch {
    return false;
  }
}
