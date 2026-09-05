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

/**
 * M90 `Project_Welder` = `Sum(SCTR OVERALL APPLIED WELDERS[QUALIFIED WELDERS])`.
 * `null` when `ref_qualified_welders` is absent or empty.
 */
export async function qualifiedWelders(
  subContractor?: string,
): Promise<number | null> {
  const p = new Params();
  const where =
    subContractor === undefined
      ? "TRUE"
      : `r.sub_contractor = ${p.add(subContractor)}`;
  try {
    const rows = await query(
      `SELECT sum(r.qualified_welders) AS n FROM ref_qualified_welders r WHERE ${where}`,
      p.list(),
    );
    const n = z.object({ n: z.union([z.null(), z.coerce.number()]) }).parse(
      rows[0] ?? { n: null },
    ).n;
    return n;
  } catch {
    return null;
  }
}

/**
 * M91 `WPS Approved` = `DistinctCount(WPQ RECORD REGISTER[WPS NO.])` filtered
 * `[ DOCUMENT STATUS] IN {WPS APPROVED BY CTJV/ CPY}`.
 * `null` when `ref_wps_register` is absent or empty.
 */
export async function approvedWpsCount(): Promise<number | null> {
  const p = new Params();
  try {
    const rows = await query(
      `SELECT count(DISTINCT r.wps_no) AS n FROM ref_wps_register r\n` +
        ` WHERE r.document_status = ${p.add(WPS_APPROVED_STATUS)}`,
      p.list(),
    );
    const parsed = z.object({ n: zCount }).parse(rows[0] ?? { n: 0 });
    return parsed.n === 0 ? null : parsed.n;
  } catch {
    return null;
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
