/**
 * The "Errors" page (owner request 2026-10-14): data errors the sub-contractors
 * must correct. Each check lists the offending joints, shows them as the pbix
 * matrix (row key × sub-contractor, distinct joints), and exports a CSV that is
 * sent to the sub-contractor with the request to fix it.
 *
 * Checks are a registry: adding the next error is one more entry in CHECKS with
 * its own SQL and its own CSV columns. Nothing here edits data.
 */
import { z } from "zod";

import { query, withAsOf } from "@/lib/db";
import type { FilterWidget } from "@/lib/page-model";
import { FILTER_ALL, FILTER_SEP, filterValues, Params, zText } from "@/lib/metrics/scope";

/** One offending joint, one CSV row. Keys are the check's CSV column names. */
export type ErrorRow = Record<string, string | number | null>;

export type ErrorCheck = {
  /** URL-safe id: `/api/errors/<id>` serves the CSV. */
  id: string;
  /** The pbix visual title, e.g. `NDT Remarks "Blank"`. */
  title: string;
  /** What is wrong and what the sub-contractor must do, one sentence each. */
  description: string;
  /** Header of the matrix's first column. */
  rowLabel: string;
  /** CSV columns, in order — the owner's export layout. */
  csvColumns: readonly string[];
  /** CSV columns that nest the matrix rows, outermost first (the pbix row hierarchy). */
  levels: readonly string[];
  /** CSV column whose values become the matrix columns (+ Total). */
  columnField: string;
  /**
   * `"table"`: render the rows as a flat table of the CSV columns (the pbix
   * tableEx visuals) instead of the pivot; `sumColumns` get a Total.
   */
  display?: "matrix" | "table";
  /**
   * Matrix without a column split (the pbix visual has only its count): the one
   * value column is headed `totalLabel` instead of per-`columnField` columns.
   */
  totalLabel?: string;
  /** Sort the matrix rows by label at every level (the pbix default, A→Z). */
  sortRows?: boolean;
  sumColumns?: readonly string[];
  /**
   * The check's OWN slicers (owner, 2026-10-14): they sit in its card and filter
   * only this check. A flat slicer reads one CSV column; a tree slicer is the
   * pbix two-field kind (e.g. "RT Report, Joint ID").
   */
  filters: readonly ErrorFilterSpec[];
  /** Known exceptions the check leaves out on purpose, shown on the page. */
  exceptions?: () => Promise<{ title: string; items: string[] }>;
  /** Rows matching the check under a sub-contractor pick. */
  rows: (subcos: readonly string[] | undefined) => Promise<ErrorRow[]>;
};

/** One node of the matrix row tree; distinct joints per column under it. */
export type ErrorNode = {
  label: string;
  counts: Record<string, number>;
  total: number;
  children: ErrorNode[];
};

export type ErrorFilterSpec =
  | { kind: "list"; id: string; label: string; field: string }
  | { kind: "tree"; id: string; label: string; field: string; childId: string; childLabel: string; childField: string };

export type ErrorMatrix = {
  /** Matrix column values (sub-contractors, A/R, …), in display order. */
  columns: string[];
  nodes: ErrorNode[];
  totals: Record<string, number>;
  total: number;
};

export type ErrorCheckResult = {
  id: string;
  title: string;
  description: string;
  rowLabel: string;
  /** Matrix without a column split: header of its single count column. */
  totalLabel?: string;
  count: number;
  matrix: ErrorMatrix;
  exceptions?: { title: string; items: string[] };
  /** This check's slicers; their ids are namespaced `<check>.<slicer>` in the URL. */
  filters: FilterWidget[];
  /** Query string for this check's CSV link (its own slicers, un-namespaced). */
  csvQuery: string;
  /** Flat-table checks: the rows as shown, and the Total row. */
  table?: { columns: string[]; rows: (string | number | null)[][]; total: (string | number | null)[] };
};

// ── check 1: NDT Remarks blank ───────────────────────────────────────────────

const NdtRow = z.object({
  key: zText,
  service_class: zText,
  rt_pct: z.union([z.null(), z.coerce.number()]),
  joint_id: z.string(),
  rt_report: zText,
  weld_type: zText,
  sub_contractor: zText,
  joints: z.coerce.number(),
});

/**
 * `NDT Remarks` is blank. The column exists only in the CCC welder record (the
 * Weld Dump, Acciona and Inco exports have no such field — their rows carry
 * the Power Query placeholder), so the check reads CCC rows; every other source
 * would be one false positive per joint. Blank text is stored NULL (db/README).
 *
 * Owner's 09-Oct-2026 pbix: one joint, 12090A2-VT6309070GJO-JMP---2 (1S1A, SW).
 */
const ndtRemarksBlank: ErrorCheck = {
  id: "ndt-remarks-blank",
  title: 'NDT Remarks "Blank"',
  description:
    "The joint has no NDT Remarks, so it cannot be placed in its Service Class + NDT Remarks group. " +
    "The sub-contractor must fill in NDT Remarks for each joint listed.",
  rowLabel: "Service Class + Service Cat+NDT Remarks",
  csvColumns: [
    "NDT Remarks",
    "Service Class + Service Cat+NDT Remarks",
    "Service class",
    "RT%",
    "Joint ID",
    "RT Report",
    "Weld Type",
    "Sub-Contractor",
    "Count of Joint ID",
  ],
  levels: ["Service Class + Service Cat+NDT Remarks", "Joint ID"],
  columnField: "Sub-Contractor",
  filters: [
    { kind: "list", id: "subco", label: "Sub-Contractor", field: "Sub-Contractor" },
    { kind: "list", id: "sclass", label: "Service class", field: "Service class" },
    { kind: "list", id: "joint", label: "Joint ID", field: "Joint ID" },
  ],
  async rows(subcos) {
    const p = new Params();
    const sub = subcos?.length ? ` AND w.sub_contractor = ANY(${p.any(subcos)})` : "";
    const sql =
      `SELECT btrim(w.service_class_cat_ndt) AS key, w.service_class, w.rt_pct, w.joint_id,\n` +
      `       w.rt_report, w.weld_type, w.sub_contractor, count(DISTINCT w.joint_id) AS joints\n` +
      `  FROM weld w\n` +
      ` WHERE w.source = 'CCC_WELDER_RECORD' AND w.ndt_remarks IS NULL${sub}\n` +
      ` GROUP BY 1, 2, 3, 4, 5, 6, 7\n` +
      ` ORDER BY w.sub_contractor, 1, w.joint_id`;
    const rows = z.array(NdtRow).parse(await query(sql, p.list()));
    return rows.map((r) => ({
      "NDT Remarks": "",
      "Service Class + Service Cat+NDT Remarks": r.key ?? "",
      "Service class": r.service_class ?? "",
      "RT%": r.rt_pct,
      "Joint ID": r.joint_id,
      "RT Report": r.rt_report ?? "",
      "Weld Type": r.weld_type ?? "",
      "Sub-Contractor": r.sub_contractor ?? "",
      "Count of Joint ID": r.joints,
    }));
  },
};

// ── check 2: several joints on one RT/UT report ──────────────────────────────

/** Not report numbers: the dump's "not applicable" marks (NA, NA(AS PER WELD TYPE)). */
const NOT_A_REPORT = `w.rt_report ~* '^\\s*NA(\\W|$)'`;
/**
 * Manual UT reports (`…-MUT-…`). One manual-UT report covers several joints by
 * design, so the owner's slicer ("EXCEption list RT Report" on pbix page
 * "Err 2 CCC") leaves them out; on 09-Oct-2026 that is six TEKFEN reports.
 */
const MANUAL_UT_REPORT = `w.rt_report ~* '-MUT-'`;

const DupRow = z.object({
  rt_ut: zText,
  rt_pct: z.union([z.null(), z.coerce.number()]),
  rt_report: z.string(),
  joint_id: z.string(),
  rt_date: zText,
  dup: z.coerce.number(),
  rt_acc_rej: zText,
  sub_contractor: zText,
});

/**
 * `Duplicate RT Report by Joint` = DISTINCTCOUNT(Joint ID) per RT Report, over the
 * whole model (ALLEXCEPT keeps only the report) — a report carrying more than one
 * joint. Page "Err 2 CCC": Acciona and Inco excluded by the page filter.
 *
 * Owner's 09-Oct-2026 pbix: one report, NFE1-TFN-PIP-IT-RT-F-388 (two TEKFEN joints).
 */
const duplicateRtReport: ErrorCheck = {
  id: "duplicate-rt-report",
  title: "Duplicate RT Report",
  description:
    "One RT/UT report number is recorded against more than one joint. " +
    "The sub-contractor must correct the report number of the joints that do not belong to it.",
  rowLabel: "RT/UT",
  csvColumns: [
    "RT/UT",
    "RT%",
    "RT Report",
    "Joint ID",
    "RT Date",
    "Duplicate RT Report by Joint",
    "RT Acc/Rej",
    "Sub-Contractor",
    "Count of Joint ID",
  ],
  levels: ["RT/UT", "RT%", "RT Report", "Joint ID"],
  columnField: "RT Acc/Rej",
  filters: [
    { kind: "list", id: "subco", label: "Sub-Contractor", field: "Sub-Contractor" },
    {
      kind: "tree",
      id: "rtr",
      label: "RT Report",
      field: "RT Report",
      childId: "rtj",
      childLabel: "Joint ID",
      childField: "Joint ID",
    },
    { kind: "list", id: "joint", label: "Joint ID", field: "Joint ID" },
  ],
  async exceptions() {
    const rows = await query<{ rt_report: string; joints: string }>(
      `SELECT w.rt_report, count(DISTINCT w.joint_id)::text AS joints FROM weld w\n` +
        ` WHERE w.rt_report IS NOT NULL AND (${NOT_A_REPORT} OR ${MANUAL_UT_REPORT})\n` +
        ` GROUP BY 1 HAVING count(DISTINCT w.joint_id) > 1 ORDER BY 1`,
    );
    return {
      title: "Left out on purpose (not report numbers, or manual-UT reports that cover several joints by design)",
      items: rows.map((r) => `${r.rt_report} — ${r.joints} joints`),
    };
  },
  async rows(subcos) {
    const p = new Params();
    const sub = subcos?.length ? ` AND w.sub_contractor = ANY(${p.any(subcos)})` : "";
    const sql =
      `WITH d AS (\n` +
      `  SELECT w.rt_report, count(DISTINCT w.joint_id) AS dup FROM weld w\n` +
      `   WHERE w.rt_report IS NOT NULL GROUP BY 1 HAVING count(DISTINCT w.joint_id) > 1\n` +
      `)\n` +
      `SELECT w.rt_ut, w.rt_pct, w.rt_report, w.joint_id, min(w.rt_date)::text AS rt_date, d.dup,\n` +
      `       w.rt_acc_rej, w.sub_contractor\n` +
      `  FROM weld w JOIN d ON d.rt_report = w.rt_report\n` +
      ` WHERE w.source NOT IN ('ACCIONA', 'INCO') AND NOT (${NOT_A_REPORT}) AND NOT (${MANUAL_UT_REPORT})${sub}\n` +
      ` GROUP BY w.rt_ut, w.rt_pct, w.rt_report, w.joint_id, d.dup, w.rt_acc_rej, w.sub_contractor\n` +
      ` ORDER BY w.rt_ut NULLS FIRST, w.rt_pct, w.rt_report, w.joint_id`;
    const rows = z.array(DupRow).parse(await query(sql, p.list()));
    return rows.map((r) => ({
      "RT/UT": r.rt_ut ?? "",
      "RT%": r.rt_pct,
      "RT Report": r.rt_report,
      "Joint ID": r.joint_id,
      "RT Date": r.rt_date ?? "",
      "Duplicate RT Report by Joint": r.dup,
      "RT Acc/Rej": r.rt_acc_rej ?? "",
      "Sub-Contractor": r.sub_contractor ?? "",
      "Count of Joint ID": 1,
    }));
  },
};

// ── check 3: one joint on several RT/UT reports ──────────────────────────────

const JointDupRow = z.object({
  rt_ut: zText,
  rt_pct: z.union([z.null(), z.coerce.number()]),
  rt_report: zText,
  joint_id: z.string(),
  rt_date: zText,
  dup: z.coerce.number(),
  rt_acc_rej: zText,
  sub_contractor: zText,
});

/**
 * `Duplicate RT Report` = DISTINCTCOUNT(RT Report) per Joint ID (ALLEXCEPT keeps
 * only the joint) — one joint recorded on more than one RT/UT report. A BLANK
 * report is a value of its own in DAX's DISTINCTCOUNT, so a joint with one
 * report and one pass without a report counts 2, exactly as the pbix does.
 * The CSV's `Duplicate RT Report by Joint` is still the joints-per-report count
 * (the blank report's is the number of joints without any report).
 *
 * Owner's 09-Oct-2026 pbix: 12 joints (9 CCC, 3 TEKFEN) — RT vs PAUT reports,
 * a report and its re-shoot (…RS), two RT reports, or a report plus a blank.
 */
const jointInSeveralReports: ErrorCheck = {
  id: "joint-several-rt-reports",
  title: "Duplicate RT Report — one joint in several reports",
  description:
    "One joint is recorded on more than one RT/UT report (or on a report and with no report). " +
    "The sub-contractor must confirm which report is valid and correct the others.",
  rowLabel: "RT/UT",
  csvColumns: [
    "RT/UT",
    "RT%",
    "RT Report",
    "Joint ID",
    "RT Date",
    "Duplicate RT Report by Joint",
    "RT Acc/Rej",
    "Sub-Contractor",
    "Count of Joint ID",
  ],
  levels: ["RT/UT", "RT%", "RT Report", "Joint ID"],
  columnField: "RT Acc/Rej",
  filters: [
    { kind: "list", id: "subco", label: "Sub-Contractor", field: "Sub-Contractor" },
    {
      kind: "tree",
      id: "rtr",
      label: "RT Report",
      field: "RT Report",
      childId: "rtj",
      childLabel: "Joint ID",
      childField: "Joint ID",
    },
    { kind: "list", id: "joint", label: "Joint ID", field: "Joint ID" },
  ],
  async rows(subcos) {
    const p = new Params();
    const sub = subcos?.length ? ` AND w.sub_contractor = ANY(${p.any(subcos)})` : "";
    // Speed (18 s → ~3.5 s): "more than one distinct report" is min <> max over
    // the report with blank as '' — a hash aggregate, no DISTINCT sort. The joints
    // are fetched FIRST, in their own query: inside one statement the planner
    // expects ~100 k of them and re-scans all 6.5 M rows for the join, while there
    // are a dozen. Their rows then come through weld_joint, joints-per-report
    // through weld_rt_report (0041); the blank report's count — every joint
    // without a report — is the one full scan left and runs in parallel.
    const blankP = query<{ n: string }>(
      `SELECT count(DISTINCT joint_id)::text AS n FROM weld WHERE rt_report IS NULL`,
    );
    const ids = (
      await query<{ joint_id: string }>(
        `SELECT w.joint_id FROM weld w WHERE w.source NOT IN ('ACCIONA', 'INCO')\n` +
          ` GROUP BY 1 HAVING min(coalesce(w.rt_report, '')) <> max(coalesce(w.rt_report, ''))`,
      )
    ).map((r) => r.joint_id);
    const idsP = p.any(ids);
    const sql =
      `WITH c AS (\n` +
      `  SELECT w.* FROM weld w\n` +
      `   WHERE w.joint_id = ANY(${idsP}) AND w.source NOT IN ('ACCIONA', 'INCO')${sub}\n` +
      `), d AS (\n` +
      `  SELECT w.rt_report AS rep, count(DISTINCT w.joint_id) AS dup FROM weld w\n` +
      `   WHERE w.rt_report = ANY(ARRAY(SELECT DISTINCT rt_report FROM c WHERE rt_report IS NOT NULL)) GROUP BY 1\n` +
      `)\n` +
      `SELECT c.rt_ut, c.rt_pct, c.rt_report, c.joint_id, min(c.rt_date)::text AS rt_date,\n` +
      `       coalesce(d.dup, 0) AS dup, c.rt_acc_rej, c.sub_contractor\n` +
      `  FROM c LEFT JOIN d ON d.rep = c.rt_report\n` +
      ` GROUP BY c.rt_ut, c.rt_pct, c.rt_report, c.joint_id, d.dup, c.rt_acc_rej, c.sub_contractor\n` +
      ` ORDER BY c.rt_ut NULLS FIRST, c.rt_pct, c.rt_report NULLS FIRST, c.joint_id`;
    const [main, blank] = await Promise.all([query(sql, p.list()), blankP]);
    const blankJoints = Number(blank[0]?.n ?? 0);
    const rows = z.array(JointDupRow).parse(main);
    return rows.map((r) => ({
      "RT/UT": r.rt_ut ?? "",
      "RT%": r.rt_pct,
      "RT Report": r.rt_report ?? "",
      "Joint ID": r.joint_id,
      "RT Date": r.rt_date ?? "",
      "Duplicate RT Report by Joint": r.rt_report ? r.dup : blankJoints,
      "RT Acc/Rej": r.rt_acc_rej ?? "",
      "Sub-Contractor": r.sub_contractor ?? "",
      "Count of Joint ID": 1,
    }));
  },
};

// ── shared: Talisman joints against the CCC records (checks 4, 5, 6) ─────────

const TalismanCmp = z.object({
  joint_id: z.string(),
  t_weld: zText,
  t_rt_date: zText,
  t_rt_rep: zText,
  t_rt_result: zText,
  t_ut: zText,
  size_sum: z.union([z.null(), z.coerce.number()]),
  films: z.union([z.null(), z.coerce.number()]),
  wr_weld: zText,
  wr_rt_date: zText,
  wr_rt_rep: zText,
  jr_weld: zText,
  jr_rt_date: zText,
  jr_rt_rep: zText,
  area: zText,
});
type TalismanCmpRow = z.infer<typeof TalismanCmp>;

/**
 * Every Talisman joint (Area Classification not blank) that fails at least one
 * of the three comparisons — weld date, RT date, RT report — against the CCC
 * welder record and joint record (`MAXX` per joint, BLANK = BLANK). Checks 4, 5
 * and 6 each keep their own failures from this one result: the statement text is
 * identical, so the read cache runs it once per data version even when the three
 * ask at the same moment (one scan of the 5.5 M welder-record rows, not three).
 */
async function talismanMismatches(): Promise<TalismanCmpRow[]> {
  const sql =
    `WITH ar AS (\n` +
    `  SELECT joint_id, max(area_classification_label) AS a FROM mv_joint GROUP BY 1\n` +
    `), wr AS (\n` +
    `  SELECT joint_id, max(weld_date)::text AS wd, max(rt_date)::text AS rd, max(rt_report) AS rr\n` +
    `    FROM weld WHERE source = 'CCC_WELDER_RECORD' GROUP BY 1\n` +
    `), jr AS (\n` +
    `  SELECT joint_id_jr AS joint_id, max(weld_date)::text AS wd, max(rt_ut_date)::text AS rd,\n` +
    `         max(rt_ut_report_no) AS rr FROM ccc_joint_pwht GROUP BY 1\n` +
    `)\n` +
    `SELECT t.joint_id, t.weld_date::text AS t_weld, t.rt1_date::text AS t_rt_date,\n` +
    `       t.rt1_rep_no AS t_rt_rep, t.rt1_result AS t_rt_result, t.ut1_rep_no AS t_ut,\n` +
    `       t.size_sum, t.rt1_films AS films,\n` +
    `       wr.wd AS wr_weld, wr.rd AS wr_rt_date, wr.rr AS wr_rt_rep,\n` +
    `       jr.wd AS jr_weld, jr.rd AS jr_rt_date, jr.rr AS jr_rt_rep, ar.a AS area\n` +
    `  FROM ref_talisman_joint t\n` +
    `  JOIN ar ON ar.joint_id = t.joint_id AND ar.a IS NOT NULL\n` +
    `  LEFT JOIN wr ON wr.joint_id = t.joint_id\n` +
    `  LEFT JOIN jr ON jr.joint_id = t.joint_id\n` +
    ` WHERE (t.weld_date::text IS DISTINCT FROM wr.wd AND t.weld_date::text IS DISTINCT FROM jr.wd)\n` +
    `    OR (t.rt1_date::text IS DISTINCT FROM wr.rd AND t.rt1_date::text IS DISTINCT FROM jr.rd)\n` +
    `    OR (t.rt1_rep_no IS DISTINCT FROM wr.rr AND t.rt1_rep_no IS DISTINCT FROM jr.rr)`;
  return z.array(TalismanCmp).parse(await query(sql));
}

/** SQL's IS DISTINCT FROM for two nullable values. */
const differs = (a: string | null, b: string | null) => (a ?? null) !== (b ?? null);

// ── check 4: weld date differs between Talisman and the CCC records ───────────

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** `2025-08-20` → `20-Aug-2025`, the owner's CSV export. */
const dmy = (iso: string | null) => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${Number(m[3])}-${MON[Number(m[2]) - 1]}-${m[1]}` : "";
};


/**
 * pbix page "Err 3 CCC", visual "Different Weld Date Status Talisman and Welder
 * Record and Joint Record (PIC Action)", over `TALISMAN DATA` (Joint.csv):
 *
 *   Weld Date from Welder Record = MAXX(Welder Record[Weld Date]) for the joint
 *   Weld Date from Joint Record  = MAXX(Joint Record[Weld Date])  for the joint
 *   Weld Date TR/F … = [WELD DATE] = that date   (BLANK = BLANK is TRUE)
 *
 * with both TR/F slicers on FALSE — the Talisman date matches neither record —
 * and `Area Classification` (MAX of the union's Area Classification for the
 * joint) not blank, which drops the ~29 thousand Talisman joints that exist in
 * no CCC export at all (vendor / package drawings).
 *
 * Owner's pbix (14-Oct-2026): 6 joints, 71100AB-…, Talisman blank vs 21-Aug-26.
 */
const weldDateTalisman: ErrorCheck = {
  id: "weld-date-talisman",
  title: "Different Weld Date Status",
  description:
    "The weld date in Talisman matches neither the CCC welder record nor the CCC joint record. " +
    "The weld date must be corrected in Talisman (PIC action) or in the CCC records.",
  rowLabel: "Joint ID from Talisman",
  csvColumns: [
    "Joint ID from Talisman",
    "WELD DATE Talisman",
    "Weld Date from Welder Record",
    "Weld Date from Joint Record",
    "RT Report from Welder Record",
    "RT1 REP NO",
    "Count of Joint ID",
    "Dia",
    "Area Classification",
  ],
  levels: ["Joint ID from Talisman"],
  columnField: "Sub-Contractor",
  display: "table",
  sumColumns: ["Count of Joint ID", "Dia"],
  filters: [
    { kind: "list", id: "area", label: "Area Classification", field: "Area Classification" },
    { kind: "list", id: "joint", label: "Joint ID Talisman", field: "Joint ID from Talisman" },
  ],
  async rows() {
    const all = await talismanMismatches();
    return all
      .filter((r) => differs(r.t_weld, r.wr_weld) && differs(r.t_weld, r.jr_weld))
      .sort((a, b) => (a.wr_weld ?? "").localeCompare(b.wr_weld ?? "") || a.joint_id.localeCompare(b.joint_id))
      .map((r) => ({
        "Joint ID from Talisman": r.joint_id,
        "WELD DATE Talisman": dmy(r.t_weld),
        "Weld Date from Welder Record": dmy(r.wr_weld),
        "Weld Date from Joint Record": dmy(r.jr_weld),
        "RT Report from Welder Record": r.wr_rt_rep ?? "",
        "RT1 REP NO": r.t_rt_rep ?? "",
        "Count of Joint ID": 1,
        Dia: r.size_sum,
        "Area Classification": r.area ?? "",
        "Sub-Contractor": "CCC",
        "Joint ID": r.joint_id,
      }));
  },
};

// ── check 5: RT date differs between Talisman and the CCC records ─────────────


/**
 * pbix page "Err 4 CCC", visual "Different RT Date Status Talisman and Welder
 * Record and Joint Record", over `TALISMAN DATA`:
 *
 *   RT Date from Welder Record = MAXX(Welder Record[RT Date])     for the joint
 *   RT Date from Joint Record  = MAXX(Joint Record[RT/UT Date])   for the joint
 *   RT Date TR/F …             = [RT1 DATE] = that date            (BLANK = BLANK)
 *
 * with both RT-date TR/F slicers on FALSE and `Area Classification` not blank
 * (the same rule as check 4). The films column is the measure
 * `RT Total Films by Joint Talisman "PR all"` = SUM(RT1 TOTAL FILM NO) at
 * WeldPoint No.1 — the joint's first Talisman row (migration 0042).
 *
 * Owner's pbix (14-Oct-2026): 1 joint, 13060A5-NR7206011-SP15-44 (RT1 14-Sep-26,
 * NFE1-MUTF05870, 7 films, nothing in either CCC record).
 */
const rtDateTalisman: ErrorCheck = {
  id: "rt-date-talisman",
  title: "Different RT Date Status",
  description:
    "The RT date in Talisman matches neither the CCC welder record nor the CCC joint record. " +
    "The RT date and report must be corrected in Talisman (PIC action) or in the CCC records.",
  rowLabel: "Joint ID Talisman",
  csvColumns: [
    "Joint ID Talisman",
    "RT1 DATE Talisman",
    "RT1 REP NO Talisman",
    "UT1 REP NO Talisman",
    "RT Date from Welder Record",
    "RT Report from Welder Record",
    "RT Date from Joint Record",
    "RT Report from Joint Record",
    'RT Total Films by Joint Talisman "PR all"',
    "Count of Joint ID",
    "Area Classification",
  ],
  levels: ["Joint ID Talisman"],
  columnField: "Sub-Contractor",
  display: "table",
  sumColumns: ['RT Total Films by Joint Talisman "PR all"', "Count of Joint ID"],
  filters: [
    { kind: "list", id: "area", label: "Area Classification", field: "Area Classification" },
    { kind: "list", id: "joint", label: "Joint ID Talisman", field: "Joint ID Talisman" },
  ],
  async rows() {
    const all = await talismanMismatches();
    return all
      .filter((r) => differs(r.t_rt_date, r.wr_rt_date) && differs(r.t_rt_date, r.jr_rt_date))
      .sort((a, b) => a.joint_id.localeCompare(b.joint_id))
      .map((r) => ({
        "Joint ID Talisman": r.joint_id,
        "RT1 DATE Talisman": dmy(r.t_rt_date),
        "RT1 REP NO Talisman": r.t_rt_rep ?? "",
        "UT1 REP NO Talisman": r.t_ut ?? "",
        "RT Date from Welder Record": dmy(r.wr_rt_date),
        "RT Report from Welder Record": r.wr_rt_rep ?? "",
        "RT Date from Joint Record": dmy(r.jr_rt_date),
        "RT Report from Joint Record": r.jr_rt_rep ?? "",
        'RT Total Films by Joint Talisman "PR all"': r.films,
        "Count of Joint ID": 1,
        "Area Classification": r.area ?? "",
        "Sub-Contractor": "CCC",
        "Joint ID": r.joint_id,
      }));
  },
};

// ── check 6: RT report number differs between Talisman and the CCC records ────


/**
 * pbix page "Err 4 CCC", visual "Different RT Report Status Talisman and Welder
 * Record and Joint Record": `RT Report TR/F Talisman & Welder Record` =
 * [RT1 REP NO] = MAXX(Welder Record[RT Report]) and its Joint Record twin
 * (MAXX(Joint Record[RT/UT Report No])), both on FALSE, Area Classification not
 * blank. Sorted by RT1 REP NO descending, as the owner's visual.
 *
 * Owner's pbix (14-Oct-2026): 7 joints — three original/repair pairs whose
 * report numbers are swapped between Talisman and the CCC records (…A on the
 * original in Talisman, on the repair in CCC), and 13060A5-NR7206011-SP15-44.
 */
const rtReportTalisman: ErrorCheck = {
  id: "rt-report-talisman",
  title: "Different RT Report Status",
  description:
    "The RT report number in Talisman matches neither the CCC welder record nor the CCC joint record. " +
    "The report number must be corrected in Talisman (PIC action) or in the CCC records.",
  rowLabel: "Joint ID Talisman",
  csvColumns: [
    "Joint ID Talisman",
    "RT1 REP NO Talisman",
    "RT1 DATE Talisman",
    "RT1 RESULT Talisman",
    "UT1 REP NO Talisman",
    "RT Report from Welder Record",
    "RT Date from Welder Record",
    "RT Report from Joint Record",
    "RT Date from Joint Record",
    "Count of Joint ID",
    "Area Classification",
  ],
  levels: ["Joint ID Talisman"],
  columnField: "Sub-Contractor",
  display: "table",
  sumColumns: ["Count of Joint ID"],
  filters: [
    { kind: "list", id: "area", label: "Area Classification", field: "Area Classification" },
    { kind: "list", id: "result", label: "RT1 RESULT Talisman", field: "RT1 RESULT Talisman" },
    { kind: "list", id: "joint", label: "Joint ID Talisman", field: "Joint ID Talisman" },
  ],
  async rows() {
    const all = await talismanMismatches();
    return all
      .filter((r) => differs(r.t_rt_rep, r.wr_rt_rep) && differs(r.t_rt_rep, r.jr_rt_rep))
      // RT1 REP NO descending, blanks last — the owner's visual
      .sort((a, b) =>
        a.t_rt_rep === b.t_rt_rep
          ? a.joint_id.localeCompare(b.joint_id)
          : a.t_rt_rep === null
            ? 1
            : b.t_rt_rep === null
              ? -1
              : b.t_rt_rep.localeCompare(a.t_rt_rep),
      )
      .map((r) => ({
        "Joint ID Talisman": r.joint_id,
        "RT1 REP NO Talisman": r.t_rt_rep ?? "",
        "RT1 DATE Talisman": dmy(r.t_rt_date),
        "RT1 RESULT Talisman": r.t_rt_result ?? "",
        "UT1 REP NO Talisman": r.t_ut ?? "",
        "RT Report from Welder Record": r.wr_rt_rep ?? "",
        "RT Date from Welder Record": dmy(r.wr_rt_date),
        "RT Report from Joint Record": r.jr_rt_rep ?? "",
        "RT Date from Joint Record": dmy(r.jr_rt_date),
        "Count of Joint ID": 1,
        "Area Classification": r.area ?? "",
        "Sub-Contractor": "CCC",
        "Joint ID": r.joint_id,
      }));
  },
};

// ── check 7: the welder of a joint differs between Talisman and the welder record

const WelderRow = z.object({
  joint_id: z.string(),
  welder_id: z.string(),
  area: zText,
  t_weld: zText,
  wr_weld: zText,
  rt1_rep_no: zText,
});

/**
 * pbix page "Err 6 CCC", visual "Different Welder ID Date Status Talisman and
 * Welder Record": `Joint ID+Welder ID` of TALISMAN DATA (Joint ID - WELDER ID
 * ALL, migration 0043) looked up in the welder record's `Joint ID - welder`;
 * `… TR/F` = FALSE when it is not there — the welder's stamp was changed in
 * Talisman against the CCC welder record. Area Classification not blank.
 * Sorted by RT1 REP NO descending, as the owner's export.
 *
 * Owner's pbix (14-Oct-2026): 905 keys — Intercon PR HA-1 2, Train-10 38,
 * Train-11 36, Train-8 694, Train-9 134, Utilities HA-3 1. All of them have the
 * same weld date in both systems (Weld Date TR/F = TRUE): only the stamp moved.
 *
 * Speed: an anti-join (NOT EXISTS) of the 1.48 M Talisman keys against the
 * welder record, then the joints' area and dates for the few that miss (~3 s).
 */
const welderIdTalisman: ErrorCheck = {
  id: "welder-id-talisman",
  title: "Different Welder ID Date Status",
  description:
    "The welder stamp of the joint in Talisman is not in the CCC welder record for that joint — " +
    "the stamp was changed in one of the two systems. The stamp must be corrected so both agree.",
  rowLabel: "Area Classification",
  totalLabel: "Count of Joint ID+Welder ID",
  sortRows: true,
  csvColumns: [
    "Area Classification",
    "Joint ID + Welder ID Talisman",
    "WELD DATE Talisman",
    "Weld Date from Welder Record",
    "Weld Date TR/F Talisman & Welder Record",
    "Joint ID+Welder ID from Welder Record",
    "Joint ID+Welder ID TR/F Talisman & Welder Record",
    "RT1 REP NO",
    "Count of Joint ID+Welder ID",
  ],
  levels: ["Area Classification", "Joint ID + Welder ID Talisman"],
  columnField: "",
  filters: [
    { kind: "list", id: "area", label: "Area Classification", field: "Area Classification" },
    { kind: "list", id: "rep", label: "RT1 REP NO", field: "RT1 REP NO" },
    { kind: "list", id: "key", label: "Joint ID + Welder ID", field: "Joint ID + Welder ID Talisman" },
  ],
  async rows() {
    const sql =
      `WITH miss AS (\n` +
      `  SELECT tw.joint_id, tw.welder_id FROM ref_talisman_welder tw\n` +
      `   WHERE NOT EXISTS (SELECT 1 FROM weld w WHERE w.source = 'CCC_WELDER_RECORD'\n` +
      `                       AND w.joint_id = tw.joint_id AND w.welder = tw.welder_id)\n` +
      `), ar AS (\n` +
      `  SELECT joint_id, max(area_classification_label) AS a,\n` +
      `         max(weld_date) FILTER (WHERE source = 'CCC_WELDER_RECORD')::text AS wd\n` +
      `    FROM mv_joint WHERE joint_id IN (SELECT joint_id FROM miss) GROUP BY 1\n` +
      `)\n` +
      `SELECT miss.joint_id, miss.welder_id, ar.a AS area, t.weld_date::text AS t_weld,\n` +
      `       ar.wd AS wr_weld, t.rt1_rep_no\n` +
      `  FROM miss JOIN ar ON ar.joint_id = miss.joint_id AND ar.a IS NOT NULL\n` +
      `  JOIN ref_talisman_joint t ON t.joint_id = miss.joint_id\n` +
      ` ORDER BY t.rt1_rep_no DESC NULLS LAST, miss.joint_id, miss.welder_id`;
    const rows = z.array(WelderRow).parse(await query(sql));
    return rows.map((r) => {
      const key = `${r.joint_id}-${r.welder_id}`;
      return {
        "Area Classification": r.area ?? "",
        "Joint ID + Welder ID Talisman": key,
        "WELD DATE Talisman": dmy(r.t_weld),
        "Weld Date from Welder Record": dmy(r.wr_weld),
        "Weld Date TR/F Talisman & Welder Record": differs(r.t_weld, r.wr_weld) ? "FALSE" : "TRUE",
        "Joint ID+Welder ID from Welder Record": "",
        "Joint ID+Welder ID TR/F Talisman & Welder Record": "FALSE",
        "RT1 REP NO": r.rt1_rep_no ?? "",
        "Count of Joint ID+Welder ID": 1,
        "Sub-Contractor": "CCC",
        // the matrix counts distinct "Joint ID": here the unit is the joint+welder key
        "Joint ID": key,
      };
    });
  },
};

// ── check 8: the WPS of a CCC joint differs between PIC and Talisman ──────────

const WpsRow = z.object({
  joint_id: z.string(),
  wps_no: zText,
  wps_code: z.string(),
  thickness: z.union([z.null(), z.coerce.number()]),
  service_class: zText,
  rt_report: zText,
});

/**
 * pbix page "Err 9 WPS PIC & Tal.n Tr/Fl", visual "Discrepancy WPS CCC PIC &
 * Talisman True/False Status": `WPS From "Talisman"` = MAXX(TALISMAN DATA[WPS
 * CODE]) for the joint (CCC only), and `WPS from "Talisman" True/False Status`
 * on FALSE — Talisman has the joint and its WPS CODE differs from `WPS No.`.
 *
 * DAX text equality ignores case and treats BLANK as "", hence lower() and
 * coalesce(). An EMPTY Talisman WPS CODE is a value (migration 0044), so a
 * joint with a WPS in PIC and none in Talisman is listed too. Thickness is the
 * joint's (the pbix union has one CCC row per joint; `weld` has one per pass).
 *
 * Owner's pbix (14-Oct-2026): 34 joints, e.g. 12060A4-DB6306033B-SP1-12 DS-01 vs
 * DS-09, 14010PB-LP7307312-SP4-4 CS/LTCS-021 vs CS/LTCS-001, THD vs blank.
 */
const wpsTalisman: ErrorCheck = {
  id: "wps-talisman",
  title: "Discrepancy WPS CCC PIC & Talisman",
  description:
    "The WPS of the joint in the CCC welder record (PIC) differs from the WPS CODE in Talisman. " +
    "The WPS must be corrected in Talisman or in the CCC welder record so both carry the same procedure.",
  rowLabel: "Joint ID",
  csvColumns: ["Joint ID", "WPS No. PIC", 'WPS From "Talisman"', "Thickness", "Service class", "RT Report"],
  levels: ["Joint ID"],
  columnField: "Sub-Contractor",
  display: "table",
  filters: [
    { kind: "list", id: "pic", label: "WPS No. PIC", field: "WPS No. PIC" },
    { kind: "list", id: "tal", label: 'WPS From "Talisman"', field: 'WPS From "Talisman"' },
    { kind: "list", id: "rtr", label: "RT Report", field: "RT Report" },
    { kind: "list", id: "thk", label: "Thickness", field: "Thickness" },
    { kind: "list", id: "sclass", label: "Service class", field: "Service class" },
    { kind: "list", id: "joint", label: "Joint ID", field: "Joint ID" },
  ],
  async rows() {
    const sql =
      `SELECT w.joint_id, w.wps_no, t.wps_code, max(w.thickness) AS thickness, w.service_class, w.rt_report\n` +
      `  FROM weld w\n` +
      `  JOIN ref_talisman_joint t ON t.joint_id = w.joint_id\n` +
      ` WHERE w.sub_contractor = 'CCC' AND t.wps_code IS NOT NULL\n` +
      `   AND lower(coalesce(w.wps_no, '')) <> lower(t.wps_code)\n` +
      ` GROUP BY w.joint_id, w.wps_no, t.wps_code, w.service_class, w.rt_report\n` +
      // RT Report descending, the owner's visual
      ` ORDER BY w.rt_report DESC NULLS LAST, w.joint_id`;
    const rows = z.array(WpsRow).parse(await query(sql));
    return rows.map((r) => ({
      "Joint ID": r.joint_id,
      "WPS No. PIC": r.wps_no ?? "",
      'WPS From "Talisman"': r.wps_code,
      Thickness: r.thickness,
      "Service class": r.service_class ?? "",
      "RT Report": r.rt_report ?? "",
      "Sub-Contractor": "CCC",
    }));
  },
};

export const CHECKS: readonly ErrorCheck[] = [
  ndtRemarksBlank,
  duplicateRtReport,
  jointInSeveralReports,
  weldDateTalisman,
  rtDateTalisman,
  rtReportTalisman,
  welderIdTalisman,
  wpsTalisman,
];

export function checkById(id: string): ErrorCheck | undefined {
  return CHECKS.find((c) => c.id === id);
}

// ── page ─────────────────────────────────────────────────────────────────────

function matrixOf(check: ErrorCheck, rows: ErrorRow[]): ErrorMatrix {
  const colOf = (r: ErrorRow) => String(r[check.columnField] ?? "");
  const columns = [...new Set(rows.map(colOf))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  type Acc = { label: string; joints: Map<string, Set<string>>; all: Set<string>; kids: Map<string, Acc> };
  const make = (label: string): Acc => ({ label, joints: new Map(), all: new Set(), kids: new Map() });
  const root = make("");
  for (const r of rows) {
    const joint = String(r["Joint ID"] ?? "");
    const col = colOf(r);
    let node = root;
    const path = [root];
    for (const lvl of check.levels) {
      const raw = r[lvl];
      const label = raw === null || raw === undefined || raw === "" ? "(blank)" : String(raw);
      let next = node.kids.get(label);
      if (!next) {
        next = make(label);
        node.kids.set(label, next);
      }
      node = next;
      path.push(node);
    }
    for (const n of path) {
      if (!n.joints.has(col)) n.joints.set(col, new Set());
      n.joints.get(col)!.add(joint);
      n.all.add(joint);
    }
  }
  const out = (a: Acc): ErrorNode => {
    const kids = [...a.kids.values()];
    if (check.sortRows) kids.sort((x, y) => x.label.localeCompare(y.label));
    return {
      label: a.label,
      counts: Object.fromEntries([...a.joints].map(([c, set]) => [c, set.size])),
      total: a.all.size,
      children: kids.map(out),
    };
  };
  const top = out(root);
  return { columns, nodes: top.children, totals: top.counts, total: top.total };
}

export type ErrorsPage = {
  as_of: string;
  checks: ErrorCheckResult[];
};

const PAIR = ">";
const BLANK = "(Blank)";
const cell = (r: ErrorRow, field: string) => String(r[field] ?? "");
const orBlank = (v: string) => (v === "" ? BLANK : v);

/**
 * One check's slicers over its own rows: the widgets and the rows that pass.
 * `values` is keyed by the slicer's own id (`subco`, `rtr`, …).
 *
 * The slicers CROSS-FILTER each other, as pbix slicers on one page do (owner,
 * 2026-10-14): the options of a slicer are the values left by every OTHER
 * slicer of the same check — pick a joint and the "RT Report, Joint ID" tree
 * shows only that joint and the reports it appears on. A pick stays valid
 * while it exists anywhere in the check, and stays visible in its list.
 * Slicers never reach another check.
 */
function applyFilters(
  check: ErrorCheck,
  rows: ErrorRow[],
  values: Record<string, string | undefined>,
): { rows: ErrorRow[]; widgets: FilterWidget[]; kept: Record<string, string> } {
  const ns = (id: string) => `${check.id}.${id}`;
  const kept: Record<string, string> = {};

  // 1. every slicer's picks (validated against the whole check) and its test
  type Prepared = { spec: ErrorFilterSpec; test: ((r: ErrorRow) => boolean) | null; picks: string[]; pairs: string[] };
  const prepared: Prepared[] = check.filters.map((f) => {
    if (f.kind === "list") {
      const all = new Set(rows.map((r) => orBlank(cell(r, f.field))));
      const picks = (filterValues(values[f.id]) ?? []).filter((v) => all.has(v));
      if (picks.length) kept[f.id] = picks.join(FILTER_SEP);
      const set = new Set(picks);
      return { spec: f, picks, pairs: [], test: picks.length ? (r) => set.has(orBlank(cell(r, f.field))) : null };
    }
    const parents = new Set(rows.map((r) => orBlank(cell(r, f.field))));
    const pairSet = new Set(rows.map((r) => `${orBlank(cell(r, f.field))}${PAIR}${cell(r, f.childField)}`));
    const picks = (filterValues(values[f.id]) ?? []).filter((v) => parents.has(v));
    const pairs = (filterValues(values[f.childId]) ?? []).filter((v) => pairSet.has(v));
    if (picks.length) kept[f.id] = picks.join(FILTER_SEP);
    if (pairs.length) kept[f.childId] = pairs.join(FILTER_SEP);
    const w = new Set(picks);
    const pr = new Set(pairs);
    return {
      spec: f,
      picks,
      pairs,
      test:
        picks.length || pairs.length
          ? (r) => {
              const p = orBlank(cell(r, f.field));
              return w.has(p) || pr.has(`${p}${PAIR}${cell(r, f.childField)}`);
            }
          : null,
    };
  });

  // 2. options of each slicer = rows passing every OTHER slicer (+ its own picks)
  const widgets: FilterWidget[] = [];
  prepared.forEach((pf, i) => {
    const others = rows.filter((r) => prepared.every((o, j) => j === i || !o.test || o.test(r)));
    const f = pf.spec;
    if (f.kind === "list") {
      const options = [...new Set([...others.map((r) => orBlank(cell(r, f.field))), ...pf.picks])].sort();
      widgets.push({
        kind: "filter",
        id: ns(f.id),
        label: f.label,
        options: [FILTER_ALL, ...options],
        value: pf.picks.length ? pf.picks.join(FILTER_SEP) : FILTER_ALL,
        multi: true,
      });
      return;
    }
    const byParent: Record<string, string[]> = {};
    const add = (parent: string, child: string) => {
      const list = (byParent[parent] ??= []);
      if (child && !list.includes(child)) list.push(child);
    };
    for (const r of others) add(cell(r, f.field), cell(r, f.childField));
    // a picked report / joint never vanishes from its own list
    for (const p of pf.picks) {
      const key = p === BLANK ? "" : p;
      for (const r of rows) if (cell(r, f.field) === key) add(key, cell(r, f.childField));
    }
    for (const pr of pf.pairs) {
      const at = pr.indexOf(PAIR);
      const p = pr.slice(0, at);
      add(p === BLANK ? "" : p, pr.slice(at + 1));
    }
    for (const k of Object.keys(byParent)) byParent[k]!.sort();
    const parents = Object.keys(byParent).map(orBlank).sort();
    const allChildren = [...new Set(Object.values(byParent).flat())].sort();
    widgets.push({
      kind: "filter",
      id: ns(f.id),
      label: f.label,
      options: [FILTER_ALL, ...parents],
      value: pf.picks.length ? pf.picks.join(FILTER_SEP) : FILTER_ALL,
      multi: true,
    });
    widgets.push({
      kind: "filter",
      id: ns(f.childId),
      label: f.childLabel,
      options: [FILTER_ALL, ...allChildren],
      value: pf.pairs.length ? pf.pairs.join(FILTER_SEP) : FILTER_ALL,
      parent: ns(f.id),
      options_by_parent: byParent,
      multi: true,
    });
  });

  const passing = rows.filter((r) => prepared.every((o) => !o.test || o.test(r)));
  return { rows: passing, widgets, kept };
}

/**
 * The page. `params` are the URL search params; each check reads only its own
 * `<check>.<slicer>` keys, so one check's slicers never move another check.
 */
export async function getErrorsPage(params: Record<string, string | undefined> = {}): Promise<ErrorsPage> {
  const { as_of } = await withAsOf(null);
  const checks = await Promise.all(
    CHECKS.map(async (c) => {
      const [all, exceptions] = await Promise.all([c.rows(undefined), c.exceptions?.()]);
      const own: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(params)) {
        if (k.startsWith(`${c.id}.`)) own[k.slice(c.id.length + 1)] = v;
      }
      const { rows, widgets, kept } = applyFilters(c, all, own);
      const matrix = matrixOf(c, rows);
      const table =
        c.display === "table"
          ? {
              columns: [...c.csvColumns],
              rows: rows.map((r) => c.csvColumns.map((col) => r[col] ?? null)),
              total: c.csvColumns.map((col, i) =>
                i === 0
                  ? "Total"
                  : c.sumColumns?.includes(col)
                    ? rows.reduce((n, r) => n + (Number(r[col]) || 0), 0)
                    : null,
              ),
            }
          : undefined;
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        rowLabel: c.rowLabel,
        ...(c.totalLabel ? { totalLabel: c.totalLabel } : {}),
        count: matrix.total,
        matrix,
        ...(exceptions && exceptions.items.length ? { exceptions } : {}),
        filters: widgets,
        csvQuery: new URLSearchParams(kept).toString(),
        ...(table ? { table } : {}),
      };
    }),
  );
  return { as_of, checks };
}

// ── CSV ──────────────────────────────────────────────────────────────────────

function csvCell(v: string | number | null): string {
  if (v === null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The check as CSV under its own slicers (`values` keyed by slicer id): the
 * owner's column order, comma-separated, UTF-8 with a BOM so Excel opens it
 * with the right encoding.
 */
export async function errorCsv(check: ErrorCheck, values: Record<string, string | undefined> = {}): Promise<string> {
  const { rows } = applyFilters(check, await check.rows(undefined), values);
  const lines = [
    check.csvColumns.map(csvCell).join(","),
    ...rows.map((r) => check.csvColumns.map((c) => csvCell(r[c] ?? null)).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
