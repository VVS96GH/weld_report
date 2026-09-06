/**
 * The manual registers — M90 `Project_Welder` and M91 `WPS Approved`.
 *
 * Ruling R-12: neither is computable from the weld data and never was.
 * `SCTR OVERALL APPLIED WELDERS` (16 rows) and `WPQ RECORD REGISTER`
 * (318 rows) are small hand-maintained workbooks that are NOT in `sources/`.
 * They are modelled as `ref_qualified_welders` / `ref_wps_register`
 * (calculation-logic §6.3); until an admin screen or a seed fills them, both
 * functions return `null` and the KPI renders honest-empty ("—"), never 0.
 */

import { z } from "zod";
import { query } from "@/lib/db";
import { Params, zCount, zText } from "./scope";

/** `[ DOCUMENT STATUS]` value that M91 counts. */
export const WPS_APPROVED_STATUS = "WPS APPROVED BY CTJV/ CPY";

export type QualifiedWelders = {
  /** M90 total — 3,816 across the six parties on the delivered file. */
  total: number;
  /**
   * R3-10: the workbook carries NO date, so this is the FILE's mtime
   * (2026-08-23). The widget must say "as of <date> (file date)" — presenting a
   * file timestamp as a data date would be a quiet lie about currency.
   */
  as_of: string | null;
  source_note: string | null;
};

/**
 * M90 `Project_Welder` = `Sum(SCTR OVERALL APPLIED WELDERS[QUALIFIED WELDERS])`.
 *
 * R3-09: the pbix's own M for this `.xls` is stale (the sheet gained a
 * left-hand column, so its `RenameColumns` targets a name that no longer
 * exists and its two `RemoveLastN` steps would cut 5 live rows). DB-LANE's
 * loader is built positionally against the delivered file instead, so this
 * number comes from the file, not from a query that would now fail to refresh.
 *
 * `null` when `ref_qualified_welders` is absent or empty — the KPI then renders
 * "—", never 0.
 */
export async function qualifiedWelders(
  subContractor?: string,
): Promise<QualifiedWelders | null> {
  const build = (withAsOf: boolean) => {
    const p = new Params();
    const where =
      subContractor === undefined
        ? "TRUE"
        : `r.sub_contractor = ${p.add(subContractor)}`;
    const extra = withAsOf
      ? ", max(r.as_of)::text AS as_of, max(r.source_note) AS source_note"
      : ", NULL::text AS as_of, NULL::text AS source_note";
    return {
      sql: `SELECT sum(r.qualified_welders) AS n${extra} FROM ref_qualified_welders r WHERE ${where}`,
      params: p.list(),
    };
  };
  const Row = z.object({
    n: z.union([z.null(), z.coerce.number()]),
    as_of: zText,
    source_note: zText,
  });
  for (const withAsOf of [true, false]) {
    // `as_of` / `source_note` arrive with migration 0014; fall back to the
    // narrow shape so the KPI works either side of that migration.
    try {
      const { sql, params } = build(withAsOf);
      const rows = await query(sql, params);
      const r = Row.parse(rows[0] ?? { n: null, as_of: null, source_note: null });
      if (r.n === null) return null;
      return { total: r.n, as_of: r.as_of, source_note: r.source_note };
    } catch {
      /* try the narrow shape */
    }
  }
  return null;
}

/**
 * M91 `WPS Approved` = `DistinctCount(WPQ RECORD REGISTER[WPS NO.])` filtered
 * `[ DOCUMENT STATUS] IN {WPS APPROVED BY CTJV/ CPY}`.
 * `null` when `ref_wps_register` is absent or empty.
 */
export type ApprovedWps = {
  /** M91 `WPS Approved` — 318 on the register as delivered (R4-02). */
  total: number;
  /** The register file's own date, for the card's provenance line. */
  as_of: string | null;
};

/**
 * M91 `WPS Approved` (R4-02): distinct `WPS NO.` on the CONSOLIDATED sheet
 * whose `DOCUMENT STATUS` is exactly {@link WPS_APPROVED_STATUS}.
 *
 * The mockup shows 294. That is not a discrepancy to reconcile — it is the
 * 2025-10…2026-03 plateau of the same series, and the register has moved since.
 * We render what the register holds today.
 *
 * R4-03: `ref_wps_register` carries DOCUMENT numbers and is **never** joined to
 * `weld.wps_no`, which carries SITE numbers. `ref_wps_process` is the join
 * table if a future measure needs one. Nothing here joins to `weld` at all.
 *
 * Returns `null` — never `0` — while the register is unseeded, so the card
 * renders `—` and the page discloses why.
 */
export async function approvedWpsCount(): Promise<ApprovedWps | null> {
  const p = new Params();
  try {
    const rows = await query(
      `SELECT count(DISTINCT r.wps_no) AS n, max(r.as_of)::text AS as_of\n` +
        `  FROM ref_wps_register r\n` +
        ` WHERE r.document_status = ${p.add(WPS_APPROVED_STATUS)}`,
      p.list(),
    );
    const parsed = z
      .object({ n: zCount, as_of: zText })
      .parse(rows[0] ?? { n: 0, as_of: null });
    return parsed.n === 0 ? null : { total: parsed.n, as_of: parsed.as_of };
  } catch {
    // Migration-tolerant, the same way qualifiedWelders() is: a register that
    // predates the `as_of` column still answers the count.
    const q = new Params();
    try {
      const rows = await query(
        `SELECT count(DISTINCT r.wps_no) AS n FROM ref_wps_register r\n` +
          ` WHERE r.document_status = ${q.add(WPS_APPROVED_STATUS)}`,
        q.list(),
      );
      const parsed = z.object({ n: zCount }).parse(rows[0] ?? { n: 0 });
      return parsed.n === 0 ? null : { total: parsed.n, as_of: null };
    } catch {
      return null;
    }
  }
}

/** Full register listing, for an eventual admin screen. */
export async function wpsRegister(): Promise<
  Array<{ wps_no: string | null; document_status: string | null }>
> {
  try {
    const rows = await query(
      `SELECT r.wps_no, r.document_status FROM ref_wps_register r ORDER BY 1`,
    );
    return z
      .array(z.object({ wps_no: zText, document_status: zText }))
      .parse(rows);
  } catch {
    return [];
  }
}

// ── batch-2 landing tables ──────────────────────────────────────────────────

/**
 * `CUM MPI Done .xlsx` → `ref_mpi_done` (124 weekly rows, project-wide, no
 * sub-contractor column). The values are **cumulative running totals**, not
 * weekly deltas, so the latest week IS the project total to date.
 *
 * This is not one of the 172 mockup labels — no widget binds it — but it is the
 * only sourced MPI figure the project has, and the seeder also writes it into
 * `weld_weekly_snapshot` as `M71` / `M71PT`. Returns `null` when unloaded.
 */
export async function mpiDoneLatest(): Promise<{
  week_end_date: string;
  mpi_done: number | null;
  mpi_pt_done: number | null;
} | null> {
  try {
    const rows = await query(
      `SELECT week_end_date::text AS week_end_date, mpi_done, mpi_pt_done` +
        ` FROM ref_mpi_done ORDER BY week_end_date DESC LIMIT 1`,
    );
    const parsed = z
      .array(
        z.object({
          week_end_date: z.string(),
          mpi_done: z.union([z.null(), z.coerce.number()]),
          mpi_pt_done: z.union([z.null(), z.coerce.number()]),
        }),
      )
      .parse(rows);
    return parsed[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * `CUM Trend Active Welders.xlsx` → `ref_active_welders`, metric `M90W`.
 *
 * **Not M90.** `Project_Welder` is `Sum(SCTR OVERALL APPLIED WELDERS[QUALIFIED
 * WELDERS])` from a register that is still missing (§7 C-12 row 14); this is a
 * weekly *active*-welder count, a different measure. Wiring it to the page-1
 * `Project_Welder` KPI would be a substitution, not a computation, so
 * {@link qualifiedWelders} stays the only source for that card.
 *
 * Two of the 576 workbook cells are blank and are stored NULL, never 0.
 */
export async function activeWeldersLatest(): Promise<
  Array<{ sub_contractor: string; welders: number | null; week_end_date: string }>
> {
  try {
    const rows = await query(
      `SELECT a.sub_contractor, a.welders, a.week_end_date::text AS week_end_date` +
        `  FROM ref_active_welders a` +
        ` WHERE a.week_end_date = (SELECT max(week_end_date) FROM ref_active_welders)` +
        ` ORDER BY 1`,
    );
    return z
      .array(
        z.object({
          sub_contractor: z.string(),
          welders: z.union([z.null(), z.coerce.number()]),
          week_end_date: z.string(),
        }),
      )
      .parse(rows);
  } catch {
    return [];
  }
}

/**
 * R2-02: `TO BE EXLUDE FROM DATA.xlsx` is loaded **unapplied**. No metric may
 * filter on it without an explicit ruling. Exposed only so a future feature
 * flag has one obvious place to start, and so its size is visible.
 */
export async function exclusionListSize(): Promise<number> {
  try {
    const rows = await query(`SELECT count(*)::text AS n FROM ref_exclusion_list`);
    return z.object({ n: zCount }).parse(rows[0] ?? { n: 0 }).n;
  } catch {
    return 0;
  }
}
