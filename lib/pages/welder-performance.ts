/**
 * The "WELDER PERFORMANCE" tab (owner request 2026-10-14): the pbix pages
 * "WEEKLY WELDER PERFORMANCE LAST 2 Weeks "PR all"" and "Month WELDER
 * PERFORMANCE LAST Month "PR all"", Inco left out.
 *
 * Each page has two matrices — RT and UT — whose rows nest Sub-Contractor ▸
 * Welder ID ▸ Joint ID ▸ report. Every value is a pbix measure or an Avg/Min of
 * a calculated column, computed here from `mv_welder_perf` (migration 0045).
 *
 * "Last 2 weeks" / "Last 1 month" are the pbix's `Days Since Last RT/UT/Weld IN
 * 0..15` / `0..30`, where Days Since = Cur_Date − the row's date and Cur_Date is
 * the latest weld date — the report's as_of (owner's choice, 2026-10-14).
 *
 * Row-level calculated columns that are per WELDER (`ALLEXCEPT(…, Welder ID)`)
 * or per SUB-CONTRACTOR are computed over the welder's / sub-contractor's whole
 * history, unfiltered, as a calculated column is; the slicers then filter rows.
 */
import { z } from "zod";

import { query, withAsOf } from "@/lib/db";
import type { FilterWidget } from "@/lib/page-model";
import { FILTER_ALL, FILTER_SEP, filterValues, Params, zText } from "@/lib/metrics/scope";
import { chartCutoff } from "@/lib/metrics/trend";

// ── pages ────────────────────────────────────────────────────────────────────

/** `num0`: a sum shown as a whole number, 0 included (the pbix film columns; CCC films are fractional). */
export type Fmt = "int" | "num0" | "num2" | "num3" | "pct" | "status";
export type Column = { key: string; label: string; fmt: Fmt; group?: "window" | "window2" };

export type Matrix = "rt" | "ut";
export type Level = "sub" | "welder" | "joint" | "report";

export type WpPageDef = {
  slug: string;
  /** Tab label. */
  label: string;
  /** Banner, as the pbix textbox. */
  banner: string;
  /** The main window, in days (`Days Since … IN 0..days`). */
  days: number;
  rt: { title: string; weldTypes: readonly string[]; columns: readonly Column[] };
  ut: { title: string; weldTypes: readonly string[]; columns: readonly Column[] };
  /** Status slicers shown on the page, by status key. */
  statusSlicers: readonly string[];
};

const ALL_TYPES = ["BW", "CLET", "GW", "MW"] as const;

const RT_COMMON_TAIL: Column[] = [
  { key: "films", label: "RT Total|Films", fmt: "num0" },
  { key: "films_a", label: 'RT Total|Films "A"', fmt: "num0" },
  { key: "films_r", label: 'RT Total|Films "R"', fmt: "num0" },
  { key: "film_ratio", label: "RT FILM|Ratio %", fmt: "pct" },
  { key: "welded", label: "Total Joints Welded", fmt: "int" },
  { key: "numb_rt", label: "Total Numb RT/UT", fmt: "int" },
  { key: "rt_ratio", label: "RT Ratio %", fmt: "pct" },
  { key: "numb_rt_a", label: "Total Numb RT/UT Acc", fmt: "int" },
  { key: "numb_rt_r", label: "Total Numb RT/UT Rej", fmt: "int" },
  { key: "rej_rate", label: "Rejection Rate Joint", fmt: "pct" },
];

const UT_COMMON_TAIL: Column[] = [
  { key: "welded", label: "Joints Welded", fmt: "int" },
  { key: "numb_ut", label: "Numb UT", fmt: "int" },
  { key: "ut_len_joint", label: "UT Weld Length by Joint", fmt: "num2" },
  { key: "ut_len_welder", label: "UT Weld Length by Welder", fmt: "num2" },
  { key: "defect_j", label: "UT Def. Len.m", fmt: "num3" },
  { key: "insp_j", label: "UT Inspected Length by Joint", fmt: "num2" },
  { key: "defect_w", label: "UT Defect Length by Welder", fmt: "num3" },
  { key: "numb_ut_a", label: 'Numb UT "A"', fmt: "int" },
  { key: "numb_ut_r", label: 'Numb UT "R"', fmt: "int" },
  { key: "ut_ratio", label: "UT Ratio %", fmt: "pct" },
  { key: "rej_len_sub", label: "UT Rej Rate % Length by Sub-Con", fmt: "pct" },
];

export const WP_PAGES: readonly WpPageDef[] = [
  {
    slug: "2-weeks",
    label: "Last 2 Weeks",
    banner: "WEEKLY WELDER PERFORMANCE  LAST 2 WEEKS",
    days: 15,
    rt: {
      title: "RT WEEKLY WELDER PERFORMANCE Last 2 Weeks",
      weldTypes: ALL_TYPES,
      columns: [
        { key: "l_welded_15", label: "Last 2wk Joints Welded", fmt: "int", group: "window" },
        { key: "l_rt_15", label: "Last 2wk Numb RT/UT", fmt: "int", group: "window" },
        { key: "l_ut_15", label: "Last 2wk Numb UT", fmt: "int", group: "window" },
        { key: "l_rt_a_15", label: 'Last 2wk Numb RT "A"', fmt: "int", group: "window" },
        { key: "l_ut_a_15", label: 'Last 2wk Numb UT "A"', fmt: "int", group: "window" },
        { key: "l_rt_r_15", label: 'Last 2wk Numb RT "R"', fmt: "int", group: "window" },
        { key: "l_ut_r_15", label: 'Last 2wk Numb UT "R"', fmt: "int", group: "window" },
        { key: "l_films_15", label: "Last 2wk RT Total|Films", fmt: "num0", group: "window" },
        { key: "l_ut_len_15", label: "Last 2wk UT Total|Len", fmt: "num2", group: "window" },
        { key: "l_films_a_15", label: 'Last 2wk RT Total|Films "A"', fmt: "num0", group: "window" },
        { key: "l_films_r_15", label: 'Last 2wk RT Total|Films "R"', fmt: "num0", group: "window" },
        { key: "l_ut_len_r_15", label: 'Last 2wk UT Total|Len "R"', fmt: "num2", group: "window" },
        { key: "l_film_ratio_15", label: "Last 2wk RT FILM|Ratio %", fmt: "pct", group: "window" },
        { key: "l_ut_ratio_15", label: "Last 2wk UT Rej Length Ratio %", fmt: "pct", group: "window" },
        { key: "avg_ut_len_w_15", label: "Last 2wk UT Rej Length Ratio % For Welder", fmt: "pct", group: "window" },
        ...RT_COMMON_TAIL,
        { key: "st_rt_15", label: "Last 2wk STATUS", fmt: "status" },
        { key: "st_cover", label: "Cover 5%", fmt: "status" },
      ],
    },
    ut: {
      title: "UT WEEKLY WELDER PERFOMANCE Last 2 Weeks",
      weldTypes: ALL_TYPES,
      columns: [
        { key: "l_welded_15", label: "Last 2wk Joints Welded", fmt: "int", group: "window" },
        { key: "l_ut_15", label: "Last 2wk Numb UT", fmt: "int", group: "window" },
        { key: "l_ut_a_15", label: 'Last 2wk Numb UT "A"', fmt: "int", group: "window" },
        { key: "l_ut_r_15", label: 'Last 2wk Numb UT "R"', fmt: "int", group: "window" },
        { key: "l_ut_len_15", label: "Last 2wk UT Total Length", fmt: "num2", group: "window" },
        { key: "l_ut_len_r_15", label: 'Last 2wk UT Total Length "R"', fmt: "num2", group: "window" },
        { key: "l_ut_ratio_15", label: "Last 2wk UT Rej Len Ratio %", fmt: "pct", group: "window" },
        { key: "avg_ut_len_w_15", label: "Last 2wk UT Rej Length Ratio % For Welder", fmt: "pct", group: "window" },
        { key: "st_ut_15", label: "Last 2wk UT Rej Rate % STATUS for Welder by Length", fmt: "status", group: "window" },
        ...UT_COMMON_TAIL,
        { key: "rej_len_sub2", label: "UT Rej Rate % Length by Sub-Con 2", fmt: "pct" },
        { key: "st_sub_len", label: "UT Rej Rate % STATUS for Sub-Con by Length", fmt: "status" },
        { key: "avg_ut_len_w", label: "UT Rej Rate % Length by Welder", fmt: "pct" },
        { key: "st_w_len", label: "UT Rej Rate % STATUS for Welder by Length", fmt: "status" },
        { key: "avg_ut_joint_w", label: "UT Rej Rate % For Welder by Joint", fmt: "pct" },
        { key: "st_w_joint", label: "UT Rej Rate % STATUS for Welder by Joint", fmt: "status" },
        { key: "ut_rej_joint", label: "UT Rej Rate % (EP)", fmt: "pct" },
        { key: "ut_rej_joint2", label: "UT Rej Rate % by Joint", fmt: "pct" },
        { key: "st_sub_joint", label: "UT Rej Rate % STATUS for Sub-Con by Joint", fmt: "status" },
      ],
    },
    statusSlicers: ["st_rt_15", "st_ut_15", "st_sub_joint", "st_w_joint", "st_sub_len", "st_w_len"],
  },
  {
    slug: "1-month",
    label: "Last 1 Month",
    banner: "MONTH WELDER PERFORMANCE  LAST 1 MONTH",
    days: 30,
    rt: {
      title: "RT WELDER PERFORMANCE LAST 1 Month & Last 2 Weeks",
      weldTypes: ALL_TYPES,
      columns: [
        { key: "l_welded_30", label: "Last 1 m.th Joints Welded", fmt: "int", group: "window" },
        { key: "l_welded_15", label: "Last 2wk Joints Welded", fmt: "int", group: "window2" },
        { key: "l_rt_30", label: "Last 1 m.th Numb RT/UT", fmt: "int", group: "window" },
        { key: "l_rt_15", label: "Last 2wk Numb RT", fmt: "int", group: "window2" },
        { key: "l_rt_a_30", label: 'Last 1 m.th Numb RT "A"', fmt: "int", group: "window" },
        { key: "l_rt_a_15", label: 'Last 2wk Numb RT "A"', fmt: "int", group: "window2" },
        { key: "l_rt_r_30", label: 'Last 1 m.th Numb RT "R"', fmt: "int", group: "window" },
        { key: "l_rt_r_15", label: 'Last 2wk Numb RT "R"', fmt: "int", group: "window2" },
        { key: "l_films_30", label: "Last 1 m.th RT Total|Films", fmt: "num0", group: "window" },
        { key: "l_films_15", label: "Last 2wk RT Total|Films", fmt: "num0", group: "window2" },
        { key: "l_films_a_30", label: 'Last 1 m.th RT Total|Films "A"', fmt: "num0", group: "window" },
        { key: "l_films_a_15", label: 'Last 2wk RT Total|Films "A"', fmt: "num0", group: "window2" },
        { key: "l_films_r_30", label: 'Last 1 m.th RT Total|Films "R"', fmt: "num0", group: "window" },
        { key: "l_films_r_15", label: 'Last 2wk RT Total|Films "R"', fmt: "num0", group: "window2" },
        { key: "avg_rt_w_30", label: "Last 1 m.th RT FILM|Ratio %", fmt: "pct", group: "window" },
        { key: "l_film_ratio_15", label: "Last 2wk RT FILM|Ratio %", fmt: "pct", group: "window2" },
        ...RT_COMMON_TAIL,
        { key: "st_rt_30", label: "Last 1 m.th STATUS", fmt: "status" },
        { key: "st_rt_15", label: "Last 2wk STATUS", fmt: "status" },
        { key: "st_cover", label: "Cover 5%", fmt: "status" },
      ],
    },
    ut: {
      title: "UT Project WELDER PERFOMANCE",
      // the pbix month page's UT matrix filters Weld Type to BW and CLET only
      weldTypes: ["BW", "CLET"],
      columns: [
        { key: "l_welded_15", label: "Last 2wk Joints Welded", fmt: "int", group: "window2" },
        { key: "l_ut_15", label: "Last 2wk Numb UT", fmt: "int", group: "window2" },
        { key: "l_ut_a_15", label: 'Last 2wk Numb UT "A"', fmt: "int", group: "window2" },
        { key: "l_ut_r_15", label: 'Last 2wk Numb UT "R"', fmt: "int", group: "window2" },
        { key: "l_ut_len_15", label: "Last 2wk UT Total Length", fmt: "num2", group: "window2" },
        { key: "l_ut_len_r_15", label: 'Last 2wk UT Total Length "R"', fmt: "num2", group: "window2" },
        { key: "l_ut_ratio_15", label: "Last 2wk UT Rej Len Ratio %", fmt: "pct", group: "window2" },
        { key: "avg_ut_len_w_15", label: "Last 2wk UT Rej Length Ratio % For Welder", fmt: "pct", group: "window2" },
        { key: "st_ut_15", label: "Last 2wk UT Rej Rate % STATUS for Welder by Length", fmt: "status", group: "window2" },
        ...UT_COMMON_TAIL,
        { key: "st_sub_len", label: "UT Rej Rate % STATUS for Sub-Con by Length", fmt: "status" },
        { key: "avg_ut_len_w", label: "UT Rej Rate % Length by Welder", fmt: "pct" },
        { key: "st_w_len", label: "UT Rej Rate % STATUS for Welder by Length", fmt: "status" },
        { key: "avg_ut_joint_w", label: "UT Rej Rate % For Welder by Joint", fmt: "pct" },
        { key: "st_w_joint", label: "UT Rej Rate % STATUS for Welder by Joint", fmt: "status" },
        { key: "ut_rej_joint", label: "UT Rej Rate % (EP)", fmt: "pct" },
        { key: "ut_rej_joint2", label: "UT Rej Rate % by Joint", fmt: "pct" },
        { key: "st_sub_joint", label: "UT Rej Rate % STATUS for Sub-Con by Joint", fmt: "status" },
      ],
    },
    statusSlicers: ["st_rt_30", "st_rt_15", "st_ut_15"],
  },
];

export function wpPage(slug: string): WpPageDef | undefined {
  return WP_PAGES.find((p) => p.slug === slug);
}

// ── statuses (pbix calculated columns, thresholds verbatim) ──────────────────

/** Status slicer key → its pbix title and the options it offers. */
export const STATUS_DEFS: Record<string, { label: string; options: string[] }> = {
  st_rt_15: {
    label: "RT FILM Ratio % STATUS Last 2 weeks",
    options: ["1. 0 to 5% - ok", "2. 5 to 7.5% - monitor", "3. 7.5 to 10% - Critical", "4. 10 to 100% - Disq.F"],
  },
  st_rt_30: {
    label: "RT FILM Ratio % STATUS Last 1 Month",
    options: ["1. 0 to 5% - ok", "2. 5 to 7.5% - monitor", "3. 7.5 to 10% - Critical", "4. 10 to 100% - Disq.F"],
  },
  st_ut_15: {
    label: "UT STATUS Last 2 Weeks",
    options: ["1.Ok: 0 to 1.5%", "2.Monitor: 1.5% to 2%", "3.Action: 2% to 100%"],
  },
  st_sub_joint: {
    label: "UT Rej Rate % STATUS for Sub-Cont by Joint",
    options: ["1. ok-0 to 3%", "2. Monitor-3% to 5%", "3. Not Accept-5% to 100%"],
  },
  st_w_joint: { label: "UT Rej Rate % STATUS for Welder by Joint", options: ["1. 0 to 10%", "2. 10 to 100%"] },
  st_sub_len: {
    label: "UT Rej Rate % STATUS for Sub-Cont by Length",
    options: ["1.ok: 0 to 1%", "2.Monitor: 1% to 1.5%", "3.Not Accept: 1.5% to 100%"],
  },
  st_w_len: {
    label: "UT Rej Rate % STATUS for Welder by Length",
    options: ["1. Ok: 0 to 1.5%", "2. Monitor: 1.5% to 2%", "3. Action: 2% to 100%"],
  },
};

/** `RT FILM Ratio % STATUS LAST 2 WEEKS` / `… 1 Month` (per welder). */
const rtFilmStatus = (v: string) =>
  `CASE WHEN ${v} >= 0 AND ${v} < 0.05 THEN '1. 0 to 5% - ok'
        WHEN ${v} >= 0.05 AND ${v} < 0.075 THEN '2. 5 to 7.5% - monitor'
        WHEN ${v} >= 0.075 AND ${v} < 0.10 THEN '3. 7.5 to 10% - Critical'
        WHEN ${v} >= 0.10 AND ${v} <= 1 THEN '4. 10 to 100% - Disq.F' END`;

/** `UT Rej Rate % STATUS for Welder by Length Last 2 Weeks`. */
const utLenL2wStatus = (v: string) =>
  `CASE WHEN ${v} >= 0 AND ${v} < 0.015 THEN '1.Ok: 0 to 1.5%'
        WHEN ${v} >= 0.015 AND ${v} < 0.02 THEN '2.Monitor: 1.5% to 2%'
        WHEN ${v} >= 0.02 AND ${v} <= 1 THEN '3.Action: 2% to 100%' END`;

/** `UT Rej Rate % STATUS for Welder by Length` (cumulative). */
const utLenStatus = (v: string) =>
  `CASE WHEN ${v} >= 0 AND ${v} < 0.015 THEN '1. Ok: 0 to 1.5%'
        WHEN ${v} >= 0.015 AND ${v} < 0.02 THEN '2. Monitor: 1.5% to 2%'
        WHEN ${v} >= 0.02 AND ${v} <= 1 THEN '3. Action: 2% to 100%' END`;

const utWelderJointStatus = (v: string) =>
  `CASE WHEN ${v} >= 0 AND ${v} < 0.1 THEN '1. 0 to 10%' WHEN ${v} >= 0.1 AND ${v} <= 1 THEN '2. 10 to 100%' END`;

const utSubJointStatus = (v: string) =>
  `CASE WHEN ${v} >= 0 AND ${v} < 0.03 THEN '1. ok-0 to 3%'
        WHEN ${v} >= 0.03 AND ${v} < 0.05 THEN '2. Monitor-3% to 5%'
        WHEN ${v} >= 0.05 AND ${v} <= 1 THEN '3. Not Accept-5% to 100%' END`;

const utSubLenStatus = (v: string) =>
  `CASE WHEN ${v} >= 0 AND ${v} < 0.01 THEN '1.ok: 0 to 1%'
        WHEN ${v} >= 0.01 AND ${v} < 0.015 THEN '2.Monitor: 1% to 1.5%'
        WHEN ${v} >= 0.015 AND ${v} <= 1 THEN '3.Not Accept: 1.5% to 100%' END`;

// ── SQL ──────────────────────────────────────────────────────────────────────

/**
 * `Days Since Last X >= 0 && <= days`, against the report's Cur_Date ($cur).
 * Days Since is BLANK on a row without that date, and DAX compares BLANK as 0,
 * so such rows PASS the window — the films and UT-length sums count them (owner's
 * pbix: GAC 709 films, not 611). Measures that also demand
 * NOT ISBLANK([Last_RT Date]) say so themselves.
 */
const within = (col: string, cur: string, days: number) =>
  `(${col} IS NULL OR (${cur}::date - ${col}) BETWEEN 0 AND ${days})`;

/**
 * Per-welder and per-sub-contractor calculated columns come precomputed from
 * mv_welder_status / mv_welder_sub_status (migration 0045): they read the
 * welder's / sub-contractor's whole history, so no slicer changes them.
 */
function statusCtes(): string {
  return `
x AS (
  SELECT p.*,
         ${rtFilmStatus("ws.rt_w_15")} AS st_rt_15,
         ${rtFilmStatus("ws.rt_w_30")} AS st_rt_30,
         ws.rt_w_30,
         CASE WHEN ws.cover_w >= 0.05 THEN '1. > 5% - ok'
              WHEN ws.cover_w < 0.05 AND ws.cover_w > 0 THEN '2. < 5% - Action'
              WHEN ws.cover_w IS NULL AND p.weld_type IN ('BW','GW','CLET','MW') AND p.weld_date IS NOT NULL
                THEN '3. No RT' END AS st_cover,
         -- \`UT Rej Length Rate % "PR all" For Welder\` exists only on rows with a Manual UT Date.
         CASE WHEN p.last_ut_date IS NOT NULL THEN ws.ut_len_w END AS ut_len_w,
         ws.ut_len_w_15,
         ws.ut_joint_w,
         ${utLenL2wStatus("ws.ut_len_w_15")} AS st_ut_15,
         ${utLenStatus("CASE WHEN p.last_ut_date IS NOT NULL THEN ws.ut_len_w END")} AS st_w_len,
         ${utWelderJointStatus("ws.ut_joint_w")} AS st_w_joint,
         ${utSubJointStatus("ss.ut_joint_s")} AS st_sub_joint,
         ${utSubLenStatus("ss.ut_len_s")} AS st_sub_len
    FROM mv_welder_perf p
    LEFT JOIN mv_welder_status ws ON ws.welder_id = p.welder_id
    LEFT JOIN mv_welder_sub_status ss ON ss.sub_contractor = p.sub_contractor
)`;
}

/** The measures of one matrix, for the rows in scope of one row of the matrix. */
function measures(m: Matrix, cur: string): string {
  const dj = (cond: string) => `count(DISTINCT joint_id) FILTER (WHERE ${cond})`;
  const win = (d: number) => {
    const rt = within("last_rt_date", cur, d);
    const ut = within("last_ut_date", cur, d);
    const wd = within("weld_date", cur, d);
    return [
      `${dj(`weld_date IS NOT NULL AND ${wd}`)} AS l_welded_${d}`,
      `${dj(`weld_date IS NOT NULL AND last_rt_date IS NOT NULL AND f_not_rs AND ${rt}`)} AS l_rt_${d}`,
      `${dj(`weld_date IS NOT NULL AND has_ut AND ${ut}`)} AS l_ut_${d}`,
      `${dj(`weld_date IS NOT NULL AND last_rt_date IS NOT NULL AND f_not_rs AND ${rt}`)}
         - ${dj(`last_rt_date IS NOT NULL AND f_rt_r AND ${rt}`)} AS l_rt_a_${d}`,
      `${dj(`has_ut AND last_ut_date IS NOT NULL AND ${ut}`)}
         - ${dj(`has_ut AND f_ut_r AND last_ut_date IS NOT NULL AND ${ut}`)} AS l_ut_a_${d}`,
      `${dj(`weld_date IS NOT NULL AND f_rt_r AND last_rt_date IS NOT NULL AND ${rt}`)} AS l_rt_r_${d}`,
      `${dj(`has_ut AND f_ut_r AND ${ut}`)} AS l_ut_r_${d}`,
      `sum(films) FILTER (WHERE ${rt}) AS l_films_${d}`,
      `sum(insp) FILTER (WHERE has_ut AND ${ut}) AS l_ut_len_${d}`,
      `sum(films_a) FILTER (WHERE ${rt}) AS l_films_a_${d}`,
      `sum(films_r) FILTER (WHERE ${rt}) AS l_films_r_${d}`,
      `sum(defect) FILTER (WHERE ${ut}) AS l_ut_len_r_${d}`,
      `sum(films_r) FILTER (WHERE ${rt}) / nullif(sum(films) FILTER (WHERE ${rt}), 0) AS l_film_ratio_${d}`,
      `sum(defect) FILTER (WHERE ${ut}) / nullif(sum(insp) FILTER (WHERE has_ut AND ${ut}), 0) AS l_ut_ratio_${d}`,
    ];
  };
  // Avg(column) over the rows in scope: weight each mv row by its weld rows.
  const avg = (col: string) => `sum(${col} * n_rows) / nullif(sum(n_rows) FILTER (WHERE ${col} IS NOT NULL), 0)`;
  const common = [
    ...win(15),
    ...win(30),
    `${avg("ut_len_w_15")} AS avg_ut_len_w_15`,
    `${avg("rt_w_30")} AS avg_rt_w_30`,
    `${dj("NOT is_repair AND weld_date IS NOT NULL")} AS welded`,
    `min(st_rt_15) AS st_rt_15`,
    `min(st_rt_30) AS st_rt_30`,
    `min(st_ut_15) AS st_ut_15`,
  ];
  if (m === "rt") {
    return [
      ...common,
      `sum(films) AS films`,
      `sum(films_a) AS films_a`,
      `sum(films_r) AS films_r`,
      `sum(films_j_r) / nullif(sum(films_j), 0) AS film_ratio`,
      `${dj("f_rt")} AS numb_rt`,
      `${dj("f_rt")}::numeric / nullif(${dj("NOT is_repair AND weld_date IS NOT NULL")}, 0) AS rt_ratio`,
      `${dj("f_rt")} - ${dj("f_rt_r")} AS numb_rt_a`,
      `${dj("f_rt_r")} AS numb_rt_r`,
      `${dj("f_rt_r")}::numeric / nullif(${dj("f_rt")}, 0) AS rej_rate`,
      `min(st_cover) AS st_cover`,
    ].join(",\n       ");
  }
  return [
    ...common,
    `${dj("has_ut")} AS numb_ut`,
    `sum(ut_len_joint) AS ut_len_joint`,
    `sum(ut_len_welder) AS ut_len_welder`,
    `sum(defect_r) AS defect_j`,
    `sum(insp_wp) AS insp_j`,
    `sum(defect_r) AS defect_w`,
    `${dj("has_ut")} - ${dj("has_ut AND f_ut_r")} AS numb_ut_a`,
    `${dj("has_ut AND f_ut_r")} AS numb_ut_r`,
    `${dj("has_ut")}::numeric / nullif(${dj("NOT is_repair AND weld_date IS NOT NULL")}, 0) AS ut_ratio`,
    `sum(defect_r) / nullif(sum(insp_wp), 0) AS rej_len_sub`,
    `sum(defect_r) / nullif(sum(ut_len_joint), 0) AS rej_len_sub2`,
    `min(st_sub_len) AS st_sub_len`,
    `${avg("ut_len_w")} AS avg_ut_len_w`,
    `min(st_w_len) AS st_w_len`,
    `${avg("ut_joint_w")} AS avg_ut_joint_w`,
    `min(st_w_joint) AS st_w_joint`,
    `${dj("has_ut AND f_ut_r")}::numeric / nullif(${dj("has_ut")}, 0) AS ut_rej_joint`,
    `${dj("has_ut AND f_ut_r")}::numeric / nullif(${dj("has_ut")}, 0) AS ut_rej_joint2`,
    `min(st_sub_joint) AS st_sub_joint`,
  ].join(",\n       ");
}

// ── filters ──────────────────────────────────────────────────────────────────

export type WpFilters = {
  subco?: string[];
  welder?: string[];
  rtpct?: string[];
  wtype?: string[];
  /** Joint ID picks (exact). The list offered is fetched page-by-page (wpJointOptions). */
  joint?: string[];
  status: Record<string, string[]>;
};

export function parseFilters(params: Record<string, string | undefined>, page: WpPageDef): WpFilters {
  const status: Record<string, string[]> = {};
  for (const k of page.statusSlicers) {
    const v = filterValues(params[k]);
    if (v) status[k] = v;
  }
  return {
    subco: filterValues(params.subco),
    welder: filterValues(params.welder),
    rtpct: filterValues(params.rtpct),
    wtype: filterValues(params.wtype),
    joint: filterValues(params.joint),
    status,
  };
}

function whereOf(
  p: Params,
  f: WpFilters,
  m: Matrix,
  page: WpPageDef,
  scope: { sub?: string; welder?: string; joint?: string },
): string {
  const def = page[m];
  const w: string[] = [`weld_type = ANY(${p.any(def.weldTypes)})`];
  // the RT matrix carries the visual filter `Weld Date is not blank`; the UT one does not
  if (m === "rt") w.push("weld_date IS NOT NULL");
  if (f.subco) w.push(`sub_contractor = ANY(${p.any(f.subco)})`);
  if (f.welder) w.push(`welder_id = ANY(${p.any(f.welder)})`);
  if (f.rtpct) w.push(`rt_pct::text = ANY(${p.any(f.rtpct)})`);
  if (f.wtype) w.push(`weld_type = ANY(${p.any(f.wtype)})`);
  if (f.joint) w.push(`joint_id = ANY(${p.any(f.joint)})`);
  for (const [k, vs] of Object.entries(f.status)) w.push(`${k} = ANY(${p.any(vs)})`);
  if (scope.sub !== undefined) w.push(`sub_contractor = ${p.add(scope.sub)}`);
  if (scope.welder !== undefined) w.push(`welder_id = ${p.add(scope.welder)}`);
  if (scope.joint !== undefined) w.push(`joint_id = ${p.add(scope.joint)}`);
  return w.join("\n   AND ");
}

export type WpRow = { label: string; values: Record<string, number | string | null>; expandable: boolean };

const LEVEL_KEY: Record<Level, (m: Matrix) => string> = {
  sub: () => "sub_contractor",
  welder: () => "welder_id",
  joint: () => "joint_id",
  report: (m) => (m === "rt" ? "rt_report" : "ut_report_prall"),
};
const NEXT: Record<Level, Level | null> = { sub: "welder", welder: "joint", joint: "report", report: null };

const num = z.union([z.null(), z.coerce.number()]);

/**
 * The rows of one matrix level (sub-contractors, a sub-contractor's welders, a
 * welder's joints, a joint's reports), in the pbix order: RT by label A→Z, UT
 * by `Numb UT "R" Last 2 Weeks` descending. With `total`, the Total row too.
 */
/**
 * Results per (as_of, page, matrix, level, slicers, scope): the data only changes
 * with a refresh (which restarts the server), and each query reads 2.5 M rows.
 */
const CACHE = new Map<string, Promise<{ rows: WpRow[]; total?: WpRow }>>();
const CACHE_MAX = 400;

export function wpRows(
  page: WpPageDef,
  m: Matrix,
  level: Level,
  f: WpFilters,
  scope: { sub?: string; welder?: string; joint?: string },
  asOf: string,
): Promise<{ rows: WpRow[]; total?: WpRow }> {
  const key = JSON.stringify([asOf, page.slug, m, level, f, scope]);
  let hit = CACHE.get(key);
  if (!hit) {
    hit = computeRows(page, m, level, f, scope, asOf);
    hit.catch(() => CACHE.delete(key));
    if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value as string);
    CACHE.set(key, hit);
  }
  return hit;
}

async function computeRows(
  page: WpPageDef,
  m: Matrix,
  level: Level,
  f: WpFilters,
  scope: { sub?: string; welder?: string; joint?: string },
  asOf: string,
): Promise<{ rows: WpRow[]; total?: WpRow }> {
  const p = new Params();
  const cur = p.add(asOf);
  const key = LEVEL_KEY[level](m);
  const where = whereOf(p, f, m, page, scope);
  const withTotal = level === "sub";
  const sql =
    `WITH ${statusCtes()}\n` +
    `SELECT ${key} AS label, ${withTotal ? `grouping(${key}) AS is_total` : "0 AS is_total"},\n` +
    `       ${measures(m, cur)}\n` +
    `  FROM x\n WHERE ${where}\n` +
    // welds after the cut-off are not in the report (the owner's extract ends there)
    `   AND (weld_date IS NULL OR weld_date <= ${cur}::date)\n` +
    ` GROUP BY ${withTotal ? `GROUPING SETS ((${key}), ())` : key}`;
  const raw = await query<Record<string, unknown>>(sql, p.list());
  const fmts = new Map<string, Fmt>(page[m].columns.map((c) => [c.key, c.fmt]));
  fmts.set("l_ut_r_15", "int");
  const out: WpRow[] = [];
  let total: WpRow | undefined;
  for (const r of raw) {
    const values: Record<string, number | string | null> = {};
    for (const [k, fmt] of fmts) {
      const v = r[k] ?? null;
      values[k] = fmt === "status" ? zText.parse(v) : num.parse(v);
    }
    const row: WpRow = { label: zText.parse(r.label ?? null) ?? "", values, expandable: NEXT[level] !== null };
    if (Number(r.is_total) === 1 || r.is_total === true) total = row;
    else out.push(row);
  }
  if (m === "ut") {
    out.sort((a, b) => Number(b.values.l_ut_r_15 ?? -1) - Number(a.values.l_ut_r_15 ?? -1) || a.label.localeCompare(b.label));
  } else {
    out.sort((a, b) => (a.label === "" ? 1 : b.label === "" ? -1 : a.label.localeCompare(b.label)));
  }
  return { rows: out, total };
}

export function nextLevel(level: Level): Level | null {
  return NEXT[level];
}

// ── Joint ID slicer ──────────────────────────────────────────────────────────

export const JOINT_PAGE = 300;

/**
 * The Joint ID slicer's options under the OTHER slicers (the pbix cross-filters
 * slicers): joints of the rows the page shows, matching `q`, A→Z, one page of
 * JOINT_PAGE. ~800k joints with no filter, hence a server-side, searchable list.
 */
export async function wpJointOptions(
  page: WpPageDef,
  f: WpFilters,
  q: string,
  asOf: string,
): Promise<{ joints: string[]; more: boolean }> {
  const p = new Params();
  const cur = p.add(asOf);
  const where = whereOf(p, { ...f, joint: undefined }, "rt", page, {});
  const like = q.trim() ? ` AND joint_id ILIKE ${p.add(`%${q.trim().replace(/[\\%_]/g, "\\$&")}%`)}` : "";
  // the status slicers read the x CTE; without them the plain view is enough
  const from = Object.keys(f.status).length ? `WITH ${statusCtes()}\nSELECT DISTINCT joint_id FROM x` : "SELECT DISTINCT joint_id FROM mv_welder_perf";
  const sql =
    `${from}\n WHERE ${where}${like}\n   AND (weld_date IS NULL OR weld_date <= ${cur}::date)\n` +
    ` ORDER BY joint_id LIMIT ${JOINT_PAGE + 1}`;
  const rows = z.array(z.object({ joint_id: z.string() })).parse(await query(sql, p.list()));
  return { joints: rows.slice(0, JOINT_PAGE).map((r) => r.joint_id), more: rows.length > JOINT_PAGE };
}

// ── page ─────────────────────────────────────────────────────────────────────

export type WpPageData = {
  page: WpPageDef;
  as_of: string;
  /** The banner's "Since": the cut-off Friday − 2 / 4 weeks (the pbix card). */
  since: string;
  filters: FilterWidget[];
  /** The applied Joint ID picks. */
  joint: string[];
  /** Query string of the applied slicers, for the drill-down API. */
  query: string;
  rt: { rows: WpRow[]; total?: WpRow };
  ut: { rows: WpRow[]; total?: WpRow };
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function dmy(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}-${MON[m - 1]}-${String(y).slice(2)}`;
}

function minusDays(iso: string, days: number): string {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - days);
  return t.toISOString().slice(0, 10);
}

// ── slicer cross-filtering ───────────────────────────────────────────────────

/** The slicer columns, as the facet table names them (status keys are column names). */
const FACET_COLS = ["sub_contractor", "welder_id", "rt_pct", "weld_type", ...Object.keys(STATUS_DEFS)] as const;
type Facet = Record<(typeof FACET_COLS)[number], string | null>;

const FACETS = new Map<string, Promise<Facet[]>>();

/**
 * Every combination of slicer values that occurs (sub-contractor × welder × RT% ×
 * weld type × the welder / sub-contractor statuses — tens of thousands of rows).
 * Each slicer offers the values found under the OTHER slicers' picks, as pbix
 * slicers cross-filter one another. Without a Joint ID pick it depends on the
 * data only, so it is computed once per cut-off.
 */
function facets(page: WpPageDef, asOf: string, joints?: string[]): Promise<Facet[]> {
  const key = JSON.stringify([asOf, page.slug, joints ?? null]);
  let hit = FACETS.get(key);
  if (!hit) {
    const p = new Params();
    const cur = p.add(asOf);
    const types = p.any(page.rt.weldTypes);
    const j = joints ? ` AND joint_id = ANY(${p.any(joints)})` : "";
    const sql =
      `WITH ${statusCtes()}\n` +
      `SELECT DISTINCT sub_contractor, welder_id, rt_pct::text AS rt_pct, weld_type, ${Object.keys(STATUS_DEFS).join(", ")}\n` +
      `  FROM x\n WHERE weld_type = ANY(${types}) AND (weld_date IS NULL OR weld_date <= ${cur}::date)${j}`;
    hit = query<Facet>(sql, p.list());
    hit.catch(() => FACETS.delete(key));
    if (!joints) FACETS.set(key, hit);
  }
  return hit;
}

/** The values of `col` among the facets that match every OTHER slicer's picks. */
function facetOptions(rows: Facet[], col: (typeof FACET_COLS)[number], picks: Record<string, string[] | undefined>): string[] {
  const out = new Set<string>();
  for (const r of rows) {
    let ok = true;
    for (const c of FACET_COLS) {
      if (c === col) continue;
      const want = picks[c];
      if (want && !want.includes(r[c] ?? "")) {
        ok = false;
        break;
      }
    }
    const v = r[col];
    if (ok && v !== null && v !== "") out.add(v);
  }
  // a pick stays offered even when the other slicers leave it without rows
  for (const v of picks[col] ?? []) out.add(v);
  return [...out];
}

export async function getWelderPerfPage(
  page: WpPageDef,
  params: Record<string, string | undefined>,
): Promise<WpPageData> {
  const { as_of: loaded } = await withAsOf(null);
  // the report's cut-off: the last Friday on or before the data date (owner, 2026-10-14)
  const as_of = chartCutoff(loaded);
  const f = parseFilters(params, page);
  const [rt, ut, rows] = await Promise.all([
    wpRows(page, "rt", "sub", f, {}, as_of),
    wpRows(page, "ut", "sub", f, {}, as_of),
    facets(page, as_of, f.joint),
  ]);
  const picks: Record<string, string[] | undefined> = {
    sub_contractor: f.subco,
    welder_id: f.welder,
    rt_pct: f.rtpct,
    weld_type: f.wtype,
    ...f.status,
  };
  const az = (xs: string[]) => xs.sort((x, y) => x.localeCompare(y));
  const widget = (id: string, label: string, opts: string[], picked?: string[]): FilterWidget => ({
    kind: "filter",
    id,
    label,
    options: [FILTER_ALL, ...opts],
    value: picked?.length ? picked.join(FILTER_SEP) : FILTER_ALL,
    multi: true,
  });
  const filters: FilterWidget[] = [
    widget("subco", "Sub-Contractor", az(facetOptions(rows, "sub_contractor", picks)), f.subco),
    widget("welder", "Welder ID", az(facetOptions(rows, "welder_id", picks)), f.welder),
    widget("rtpct", "RT%", facetOptions(rows, "rt_pct", picks).sort((x, y) => Number(x) - Number(y)), f.rtpct),
    widget("wtype", "Weld Type", page.rt.weldTypes.filter((t) => facetOptions(rows, "weld_type", picks).includes(t)), f.wtype),
    ...page.statusSlicers.map((k) => {
      const have = facetOptions(rows, k as (typeof FACET_COLS)[number], picks);
      return widget(k, STATUS_DEFS[k].label, STATUS_DEFS[k].options.filter((o) => have.includes(o)), f.status[k]);
    }),
  ];
  const kept = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) kept.set(k, v);
  return {
    page,
    as_of,
    // the pbix card Last_Friday_CutOff_2_Weeks / _4_Weeks: the cut-off Friday − 14 / − 28
    since: minusDays(as_of, page.days === 15 ? 14 : 28),
    filters,
    joint: f.joint ?? [],
    query: kept.toString(),
    rt,
    ut,
  };
}
