/**
 * Project NDE & PWHT Status by Service Class (owner, 2026-10-18) — pbix
 * "Internal. PROJECT RT% NDE AND PWHT STATUS S.Class "PR all""
 * (ReportSection78178c588b3609eebe52), read off its definition:
 *
 *   summary   Weld Cat × RT B.Log Total · RT100% B.Log · PWHT B.Log All Types / for RT /
 *             RT100% · RT B.Log + PWHT "Y" / "N" · RT B.Log & PWHT "Y" NOT Done   (Weld Cat ≠ J)
 *   matrix    Service Class + Service Cat + NDT Remarks ▸ Sub-Contractor, the "PR all"
 *             measures (Weld Cat ≠ J)
 *   cards     RT/UT Ratio % for Service Class Cover · Rejection UT Rate Joint "EP" ·
 *             RT/UT Rejection Rate by Joint "PR All"
 *   statuses  RT FILM Ratio % STATUS for Service Class (by sub-contractor) · RT/UT Cover
 *             5 % S.Class · Cover 5 % for Welder · RT FILM Ratio % STATUS for Welder —
 *             each a calculated column over ALLEXCEPT(class [, party] | welder), i.e.
 *             the WHOLE fact table, every filter dropped.
 *
 * Joint metrics reuse the welding pages' "PR all" bundle (lib/pages/welding.ts), so
 * a number here is the number every other page shows for the same scope.
 */
import { query } from "@/lib/db";
import { agingClock } from "@/lib/db";
import { RT_BACKLOG_PRALL, backlogAgingBy, type AgingBuckets } from "@/lib/metrics/rt";
import {
  FILTER_ALL,
  FILTER_SEP,
  filterValues,
  type GroupSpec,
  Params,
  pwhtYnExpr,
  type Scope,
  scopeWhere,
  SOURCES_PR_ALL_LOADED,
  sqlLit,
} from "@/lib/metrics/scope";
import type { FilterWidget, KpiWidget, TableWidget } from "@/lib/page-model";
import { availability, bundleBy, bundleTotal, GROUP_WELD_CAT, metricCell, type Bundle } from "@/lib/pages/welding";

export const PN_FILTER_IDS = [
  "subco", "sclass", "skey", "ha", "area", "welder", "wtype", "rt", "wcat", "ndt",
  "mat", "thick", "pwht", "wps", "dia", "sfilm", "scover", "wcover", "wfilm",
  "acc", "wdate", "rtdate", "rtrep", "rtbatch", "joint", "iso", "utrep",
] as const;
type PnId = (typeof PN_FILTER_IDS)[number];
type PnParams = Partial<Record<PnId, string>>;

/**
 * The row-level slicers (owner, 2026-10-19): fields of the weld rows, read from
 * mv_row_slicer (0052). Picks on several of them must hold on the SAME weld row,
 * as a pbix slicer filters the fact rows; a joint is in scope when one of its
 * rows matches. The first three ship their options with the page; the rest have
 * too many values and are searched on the server (RemotePicker).
 */
const ROW_COL = {
  acc: "rt_acc_rej", wdate: "weld_date", rtdate: "rt_date",
  rtrep: "rt_report", rtbatch: "rt_batch", joint: "joint_id", iso: "iso", utrep: "ut_report",
} as const satisfies Partial<Record<PnId, string>>;
type RowId = keyof typeof ROW_COL;
const ROW_IDS = Object.keys(ROW_COL) as RowId[];
export const PN_REMOTE: { id: RowId; label: string; noun: string }[] = [
  { id: "rtrep", label: "RT Report", noun: "reports" },
  { id: "rtbatch", label: "RT Batch No", noun: "batches" },
  { id: "joint", label: "Joint ID", noun: "joints" },
  { id: "iso", label: "ISO Number", noun: "ISOs" },
  { id: "utrep", label: 'UT Report "PR All"', noun: "reports" },
];
const isRemote = (id: string) => PN_REMOTE.some((r) => r.id === id);
/** A pick list may be pasted; past this many values it is cut (the URL would not hold more anyway). */
const MAX_PICKS = 2000;

/** `s.<col> IN (…)` for every row slicer picked, except `skip`. */
function rowConds(f: PnParams, opts: Record<string, string[]>, skip?: RowId): string[] {
  const out: string[] = [];
  for (const id of ROW_IDS) {
    if (id === skip) continue;
    let v = (filterValues(f[id]) ?? []).slice(0, MAX_PICKS);
    if (!isRemote(id)) v = v.filter((x) => (opts[id] ?? []).includes(x));
    // a few reports and joints hold a comma, which the URL also uses between
    // picks: try the neighbouring pieces glued back too (extra literals only
    // ever match a value that exists)
    else v = [...v, ...v.flatMap((_, i) => [2, 3].map((n) => v.slice(i, i + n)).filter((g) => g.length > 1).map((g) => g.join(",")))];
    if (v.length) out.push(`s.${ROW_COL[id]} IN (${v.map(sqlLit).join(", ")})`);
  }
  return out;
}

const RT_TYPES = ["BW", "GW", "CLET", "MW"];
const CLASS: GroupSpec = { key: "cls", sql: "w.service_class_cat_ndt" };
const CLASS_SUB: GroupSpec = { key: "cls_sub", sql: "(coalesce(w.service_class_cat_ndt, '') || '|' || coalesce(w.sub_contractor, ''))" };

// ── the four status columns, over the whole fact table (memoised per load) ──

const FILM_CLASS_BANDS = ["1. 0 to 2% - ok", "2. 2 to 4% - monitor", "3. 4 to 5% - Critical", "4. 5 to 100% - Action"];
const COVER_CLASS_BANDS = ["1. < 5% - CHECK", "2. 5% > 10%"];
const COVER_WELDER_BANDS = ["1. > 5% - ok", "2. < 5% - Action", "3. No RT"];
const FILM_WELDER_BANDS = ["1. 0 to 5% - ok", "2. 5 to 7.5% - monitor", "3. 7.5 to 10% - Critical", "4. 10 to 100% - Disq.F"];

const bandFilmClass = (r: number | null) =>
  r === null ? null : r < 0.02 ? FILM_CLASS_BANDS[0]! : r < 0.04 ? FILM_CLASS_BANDS[1]! : r < 0.05 ? FILM_CLASS_BANDS[2]! : r <= 1 ? FILM_CLASS_BANDS[3]! : null;
const bandCoverClass = (r: number) => (r < 0.05 ? COVER_CLASS_BANDS[0]! : r < 0.1 ? COVER_CLASS_BANDS[1]! : null);
const bandCoverWelder = (r: number | null, welded: number) =>
  r === null || r === 0 ? (welded > 0 && r === null ? COVER_WELDER_BANDS[2]! : r === 0 ? null : null) : r >= 0.05 ? COVER_WELDER_BANDS[0]! : COVER_WELDER_BANDS[1]!;
const bandFilmWelder = (r: number | null) =>
  r === null ? null : r < 0.05 ? FILM_WELDER_BANDS[0]! : r < 0.075 ? FILM_WELDER_BANDS[1]! : r < 0.1 ? FILM_WELDER_BANDS[2]! : r <= 1 ? FILM_WELDER_BANDS[3]! : null;

type Maps = {
  filmClassSub: Map<string, string>; // "class|party" → band
  coverClass: Map<string, number>; // class → ratio
  coverAll: number;
  coverWelder: Map<string, string>; // welder → band
  filmWelder: Map<string, string>; // welder → band
};
let memo: { key: string; maps: Maps } | null = null;

async function statusMaps(): Promise<Maps> {
  const [{ k }] = await query<{ k: string }>(`SELECT coalesce(max(id), 0)::text AS k FROM load`);
  if (memo?.key === k) return memo.maps;
  type R = { v: string; a: string | null; b: string | null };
  const [fc, cc, ca, cw, fw] = await Promise.all([
    // RT Film Ratio % "PR" For SERVICE Class BY SUBCON: rejected / all films (no RS filter)
    query<R>(`SELECT coalesce(service_class_cat_ndt, '') || '|' || coalesce(sub_contractor, '') AS v,
                     sum(total_no_of_films_rej) AS a, sum(rt_film_total) AS b
                FROM weld WHERE NOT is_cancelled GROUP BY 1`),
    // RT/UT Ratio % For Service Class Cover: joints with an RT report (≠ RS) / welded, BW·GW·CLET·MW
    query<R>(`SELECT coalesce(service_class_cat_ndt, '') AS v,
                     count(*) FILTER (WHERE is_rt_reported) AS a, count(*) FILTER (WHERE is_welded) AS b
                FROM mv_joint WHERE weld_type = ANY($1) GROUP BY 1`, [RT_TYPES]),
    query<R>(`SELECT '' AS v, count(*) FILTER (WHERE is_rt_reported) AS a, count(*) FILTER (WHERE is_welded) AS b
                FROM mv_joint WHERE weld_type = ANY($1)`, [RT_TYPES]),
    // RT Ratio % For Welder (<5 % ; >5 %): the same ratio per Welder ID
    query<R>(`SELECT welder_id AS v, count(DISTINCT joint_id) FILTER (WHERE is_tested_prall) AS a,
                     count(DISTINCT joint_id) FILTER (WHERE is_welded_norepair) AS b
                FROM mv_joint_pairs WHERE weld_type = ANY($1) GROUP BY 1`, [RT_TYPES]),
    // RT Film Ratio % "PR all" For Welder: rejected / films (RT Acc/Rej ≠ RS)
    query<R>(`SELECT coalesce(welder, '') || '-' || coalesce(sub_contractor, '') AS v, sum(total_no_of_films_rej) AS a,
                     sum(rt_film_total) FILTER (WHERE rt_acc_rej IS DISTINCT FROM 'RS') AS b
                FROM weld WHERE NOT is_cancelled GROUP BY 1`),
  ]);
  const ratio = (r: R) => (Number(r.b) ? Number(r.a ?? 0) / Number(r.b) : null);
  const maps: Maps = { filmClassSub: new Map(), coverClass: new Map(), coverAll: 0, coverWelder: new Map(), filmWelder: new Map() };
  for (const r of fc) {
    const b = bandFilmClass(ratio(r));
    if (b) maps.filmClassSub.set(r.v, b);
  }
  for (const r of cc) maps.coverClass.set(r.v, ratio(r) ?? 0);
  maps.coverAll = ca[0] ? (ratio(ca[0]) ?? 0) : 0;
  for (const r of cw) {
    const b = bandCoverWelder(ratio(r), Number(r.b ?? 0));
    if (b) maps.coverWelder.set(r.v, b);
  }
  for (const r of fw) {
    const b = bandFilmWelder(ratio(r));
    if (b) maps.filmWelder.set(r.v, b);
  }
  memo = { key: k, maps };
  return maps;
}

// ── scope ──

async function scopeFor(f: PnParams, maps: Maps, opts: Record<string, string[]>): Promise<Scope> {
  const keep = (id: keyof PnParams) => (filterValues(f[id]) ?? []).filter((v) => (opts[id] ?? []).includes(v));
  const extra: string[] = [];
  const s: Scope = { sources: SOURCES_PR_ALL_LOADED, excludeWeldCats: ["J"] };
  const subco = keep("subco");
  if (subco.length) s.subContractors = subco;
  const ha = keep("ha");
  const area = keep("area");
  if (area.length) s.haArea = area.map((a) => ({ area: a }));
  else if (ha.length) s.haArea = ha.map((h) => ({ ha: h === "(Blank)" ? null : h }));
  const wt = keep("wtype");
  if (wt.length) s.weldTypes = wt;
  const rt = keep("rt").map(Number);
  if (rt.length) s.rtPcts = rt;
  const wc = keep("wcat");
  if (wc.length) s.weldCats = wc;
  const skey = keep("skey");
  if (skey.length) s.serviceClasses = { sql: "w.service_class_cat_ndt", values: skey };
  const sclass = keep("sclass");
  if (sclass.length) extra.push(`split_part({a}.service_class_cat_ndt, ' ', 1) IN (${sclass.map(sqlLit).join(", ")})`);
  const pw = keep("pwht");
  if (pw.length) s.pwhtYns = pw;
  const wps = keep("wps");
  if (wps.length) s.wpsNos = wps;
  const mat = keep("mat");
  if (mat.length) s.materialTypes = mat;
  const attr = (cond: string) => `EXISTS (SELECT 1 FROM mv_joint_attr ja WHERE ja.source = {a}.source AND ja.joint_id = {a}.joint_id AND ${cond})`;
  const ndt = keep("ndt");
  if (ndt.length) extra.push(attr(`coalesce(ja.ndt_remarks, '(Blank)') IN (${ndt.map(sqlLit).join(", ")})`));
  const thick = keep("thick");
  if (thick.length) extra.push(attr(`ja.thickness::text IN (${thick.map(sqlLit).join(", ")})`));
  const dia = keep("dia");
  if (dia.length) {
    const band = `CASE WHEN {a}.dia_inch <= 20 THEN '0-20' WHEN {a}.dia_inch <= 200 THEN '20-199' ELSE 'Greater than 199' END`;
    extra.push(`${band} IN (${dia.map(sqlLit).join(", ")})`);
  }
  const welders = new Set(keep("welder"));
  const wcover = keep("wcover");
  const wfilm = keep("wfilm");
  const narrow = (m: Map<string, string>, picks: string[]) => {
    const ok = new Set([...m].filter(([, b]) => picks.includes(b)).map(([w]) => w));
    return ok;
  };
  let welderSet: Set<string> | null = welders.size ? welders : null;
  for (const [picks, m] of [[wcover, maps.coverWelder], [wfilm, maps.filmWelder]] as const) {
    if (!picks.length) continue;
    const ok = narrow(m, picks);
    welderSet = welderSet ? new Set([...welderSet].filter((w) => ok.has(w))) : ok;
  }
  if (welderSet) {
    extra.push(
      welderSet.size
        ? `EXISTS (SELECT 1 FROM mv_joint_pairs jp WHERE jp.source = {a}.source AND jp.joint_id = {a}.joint_id AND jp.welder_id IN (${[...welderSet].map(sqlLit).join(", ")}))`
        : "false",
    );
  }
  const sfilm = keep("sfilm");
  if (sfilm.length) {
    const keys = [...maps.filmClassSub].filter(([, b]) => sfilm.includes(b)).map(([k]) => k);
    extra.push(keys.length ? `(coalesce({a}.service_class_cat_ndt, '') || '|' || coalesce({a}.sub_contractor, '')) IN (${keys.map(sqlLit).join(", ")})` : "false");
  }
  const scover = keep("scover");
  if (scover.length) {
    const keys = [...maps.coverClass].filter(([, r]) => scover.includes(bandCoverClass(r) ?? "")).map(([k]) => k);
    extra.push(keys.length ? `coalesce({a}.service_class_cat_ndt, '') IN (${keys.map(sqlLit).join(", ")})` : "false");
  }
  const rows = rowConds(f, opts);
  if (rows.length) {
    extra.push(`({a}.source, {a}.joint_id) IN (SELECT s.source, s.joint_id FROM mv_row_slicer s WHERE ${rows.join(" AND ")})`);
  }
  if (extra.length) s.extraSql = extra;
  return s;
}

// ── per-group extras the bundle does not carry ──

type Extra = { sc: number; nrows: number; utLen: number; total: number; paut: number; pautR: number; w5: number; t5: number; w10: number; t10: number; welders: number; wAll: number; wRt: number };

async function extras(scope: Scope, groupSql: string | null): Promise<Map<string, Extra>> {
  const p = new Params();
  const where = scopeWhere(scope, p);
  const key = groupSql ?? "''";
  const p2 = new Params();
  const where2 = scopeWhere(scope, p2, "w");
  const [a, b] = await Promise.all([
    query<Record<string, string>>(
      `SELECT ${key} AS k,
              count(DISTINCT split_part(w.service_class_cat_ndt, ' ', 1)) AS sc,
              count(*) FILTER (WHERE ja.norepair) AS total,
              coalesce(sum(ja.nrows), 0) AS nrows, coalesce(sum(ja.ut_len_rows), 0) AS ut_len,
              count(*) FILTER (WHERE ja.paut) AS paut, count(*) FILTER (WHERE ja.paut_r) AS paut_r,
              count(*) FILTER (WHERE w.is_welded_norepair AND w.rt_pct = 5) AS w5,
              count(*) FILTER (WHERE w.is_tested_prall AND w.rt_pct = 5) AS t5,
              count(*) FILTER (WHERE w.is_welded_norepair AND w.rt_pct = 10) AS w10,
              count(*) FILTER (WHERE w.is_tested_prall AND w.rt_pct = 10) AS t10
         FROM mv_joint w LEFT JOIN mv_joint_attr ja ON ja.source = w.source AND ja.joint_id = w.joint_id
        WHERE ${where} GROUP BY 1`,
      p.list(),
    ),
    // QTY Welders: distinct `Service Class + Service Cat+NDT Remarks+Welder ID` keys
    query<Record<string, string>>(
      `SELECT ${key} AS k, count(DISTINCT jp.welder_id) AS welders,
              count(DISTINCT (w.service_class_cat_ndt, jp.welder_id)) FILTER (WHERE w.is_welded) AS w_all,
              count(DISTINCT (w.service_class_cat_ndt, jp.welder_id)) FILTER (WHERE w.is_welded AND w.is_rt_reported) AS w_rt
         FROM mv_joint_pairs jp JOIN mv_joint w ON w.source = jp.source AND w.joint_id = jp.joint_id
        WHERE ${where2} GROUP BY 1`,
      p2.list(),
    ),
  ]);
  const out = new Map<string, Extra>();
  for (const r of a) {
    out.set(r.k ?? "", {
      sc: Number(r.sc), nrows: Number(r.nrows), utLen: Number(r.ut_len), total: Number(r.total), paut: Number(r.paut), pautR: Number(r.paut_r),
      w5: Number(r.w5), t5: Number(r.t5), w10: Number(r.w10), t10: Number(r.t10), welders: 0, wAll: 0, wRt: 0,
    });
  }
  for (const r of b) {
    const e = out.get(r.k ?? "") ?? { sc: 0, nrows: 0, utLen: 0, total: 0, paut: 0, pautR: 0, w5: 0, t5: 0, w10: 0, t10: 0, welders: 0, wAll: 0, wRt: 0 };
    e.welders = Number(r.welders);
    e.wAll = Number(r.w_all);
    e.wRt = Number(r.w_rt);
    out.set(r.k ?? "", e);
  }
  return out;
}

// ── formatting ──

const NF = new Intl.NumberFormat("en-US");
const int = (v: number | null | undefined) => (v ? NF.format(v) : "");
const pct = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "" : `${(v * 100).toFixed(2)}%`);
const num = (v: number | null | undefined, dp: number) => (v ? v.toFixed(dp).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "");
const div = (a: number, b: number) => (b ? a / b : null);

const MAIN_COLUMNS = [
  "Service Class + Service Cat+NDT Remarks", "Serv. class", "RT FILM Ratio %", "RT Ratio % For Service Class Cover",
  "Welder ID", "QTY Welders & RT Rep", "QTY Welders & No RT Rep", "QTY Welders & No RT Rep %",
  "Total Joints", "Joints Welded", "% Welding Complete", "Joints Balance",
  "Numb UT/PAUT", "Numb PAUT", 'Numb PAUT "R"', "UT Weld Len.m", "UT Def. Len.m", 'Numb UT "A"', 'Numb UT "R"', "UT Ratio %", "Rejection UT Rate Joint",
  "Numb RT/UT", "RT/UT Ratio %", "Remaining Joints for RT5%", "Remaining Joints for RT10%", 'Numb RT/UT "A"', 'Numb RT/UT "R"', "Rejection Rate Joint",
  "RT B.Log Total", "RT100% B.Log", "PWHT Done", "PWHT B.Log All Types",
  "RT Total Films", 'RT Films "A"', 'RT Films "R"',
  "within 3 Days", "3 to 7 Days", "7 to 15 Days", "15 to 30 Days", "above 30 Days",
];

function mainRow(label: string, b: Bundle | undefined, e: Extra | undefined, cover: number | null, aging: AgingBuckets | undefined): string[] {
  if (!b) return [label, ...MAIN_COLUMNS.slice(1).map(() => "")];
  const welded = b.welding.joints_welded;
  const tested = b.rt.tested;
  const rej = b.rt.rejected;
  const films = b.rt.films;
  const filmsR = b.rt.films_rejected;
  const ut = b.ut.ut_done;
  const ceil = (welded5: number, tested5: number, pctv: number) => Math.max(0, Math.ceil(welded5 * pctv - tested5));
  const nort = (e?.wAll ?? 0) - (e?.wRt ?? 0);
  return [
    label,
    int(e?.sc),
    pct(div(filmsR, films)),
    pct(cover),
    int(e?.welders),
    int(e?.wRt),
    int(nort),
    pct(div(nort, e?.wAll ?? 0)),
    int(e?.total),
    int(welded),
    pct(div(welded, e?.total ?? 0)),
    int((e?.total ?? 0) - welded),
    int(ut),
    int(e?.paut),
    int(e?.pautR),
    // UT Weld Length by Welder "PR all": a row-grain sum (mv_joint_attr.ut_len_rows)
    num(e?.utLen, 2),
    num(b.ut.ut_rej_length_m, 3),
    int(b.ut.ut_accepted),
    int(b.ut.ut_rejected),
    pct(div(ut, welded)),
    pct(div(b.ut.ut_rejected, ut)),
    int(tested),
    pct(div(tested, welded)),
    int(e ? ceil(e.w5, e.t5, 0.05) : 0),
    int(e ? ceil(e.w10, e.t10, 0.1) : 0),
    int(tested - rej),
    int(rej),
    pct(div(rej, tested)),
    int(b.backlog.rt_backlog),
    int(b.backlog.rt100_backlog),
    int(b.pwht.pwht_done),
    int(b.pwht.pwht_backlog_all_types),
    num(films, 0),
    num(films - filmsR, 0),
    num(filmsR, 0),
    int(aging?.within_3),
    int(aging?.["3_to_7"]),
    int(aging?.["7_to_15"]),
    int(aging?.["15_to_30"]),
    int(aging?.above_30),
  ];
}

const SUMMARY_COLUMNS = [
  "Weld Cat", "Total RT Backlog", "RT100% Backlog", "PWHT Backlog All Types", "PWHT Backlog for RT",
  "PWHT BACKLOG by RT100%", 'RT+PWHT "Y" Done', 'RT+PWHT "N"', 'RT B.LOG & PWHT "Y" NOT Done',
];

export type PnPageData = {
  filters: FilterWidget[];
  /** The searched row slicers (RemotePicker) and their applied picks. */
  remote: { id: string; label: string; noun: string; value: string[] }[];
  cards: KpiWidget[];
  summary: TableWidget;
  main: TableWidget;
};

export async function getProjectNdePage(params: Record<string, string | undefined>): Promise<PnPageData> {
  const f: PnParams = {};
  for (const id of PN_FILTER_IDS) {
    const v = params[id]?.trim();
    if (v && v !== FILTER_ALL) f[id] = v;
  }
  const maps = await statusMaps();
  const opts = await filterOptions();
  const scope = await scopeFor(f, maps, opts);
  const av = await availability("PR_ALL", SOURCES_PR_ALL_LOADED, scope);
  const clock = await agingClock();
  const [byClass, byClassSub, total, byCat, exClass, exClassSub, exTotal, agClass, agClassSub, agTotal] = await Promise.all([
    bundleBy(scope, CLASS, av),
    bundleBy(scope, CLASS_SUB, av),
    bundleTotal(scope, av),
    bundleBy(scope, GROUP_WELD_CAT, av),
    extras(scope, CLASS.sql),
    extras(scope, CLASS_SUB.sql),
    extras(scope, null),
    backlogAgingBy(scope, clock, RT_BACKLOG_PRALL, CLASS),
    backlogAgingBy(scope, clock, RT_BACKLOG_PRALL, CLASS_SUB),
    backlogAgingBy(scope, clock, RT_BACKLOG_PRALL, { key: "all", sql: "'all'::text" }),
  ]);
  // The cover column aggregates by AVERAGE over the fact rows (a calculated
  // column in a matrix / card): weight each class's cover by its row count.
  let wSum = 0;
  let wRows = 0;
  for (const [cls, e] of exClass) {
    wSum += e.nrows * (maps.coverClass.get(cls) ?? 0);
    wRows += e.nrows;
  }
  const coverAvg = wRows ? wSum / wRows : 0;

  // matrix: each class, then its sub-contractors (indented children, + on the page)
  const rows: string[][] = [];
  const classes = [...byClass.keys()].filter((k): k is string => k !== null).sort((a, b) => a.localeCompare(b));
  for (const cls of classes) {
    const cover = maps.coverClass.get(cls) ?? 0;
    rows.push(mainRow(cls, byClass.get(cls), exClass.get(cls), cover, agClass.get(cls)));
    const subs = [...byClassSub.keys()]
      .filter((k): k is string => k !== null && k.startsWith(`${cls}|`))
      .sort((a, b) => a.localeCompare(b));
    for (const k of subs) {
      rows.push(mainRow(`  ${k.slice(cls.length + 1) || "(Blank)"}`, byClassSub.get(k), exClassSub.get(k), cover, agClassSub.get(k)));
    }
  }
  const totalRow = mainRow("Total", total, exTotal.get(""), coverAvg, [...agTotal.values()][0]);
  rows.push(totalRow);

  const catRows = [...byCat.keys()].filter((k): k is string => k !== null).sort();
  const sumRow = (label: string, b: Bundle) => [label, ...SUMMARY_COLUMNS.slice(1).map((h) => metricCell(h, b) ?? "")];
  const summaryRows = [...catRows.map((c) => sumRow(c, byCat.get(c)!)), sumRow("Total", total)];

  const keepVal = (id: keyof PnParams) => (filterValues(f[id]) ?? []).filter((v) => (opts[id] ?? []).includes(v));
  const widget = (id: keyof PnParams, label: string): FilterWidget => {
    const kept = keepVal(id);
    return { kind: "filter", id, label, options: [FILTER_ALL, ...(opts[id] ?? [])], value: kept.length ? kept.join(FILTER_SEP) : FILTER_ALL, multi: true };
  };
  const filters: FilterWidget[] = [
    widget("subco", "Sub-Contractor"),
    widget("sclass", "Service class"),
    widget("skey", "Service Class + Cat + NDT Remarks"),
    widget("ha", "HA"),
    widget("area", "Area"),
    widget("welder", "Welder ID"),
    widget("wtype", "Weld Type"),
    widget("rt", "RT %"),
    widget("wcat", "Weld Cat"),
    widget("ndt", "NDT Remarks"),
    widget("mat", "Material Type"),
    widget("thick", "Thickness"),
    widget("pwht", "PWHT Status"),
    widget("wps", "WPS No."),
    widget("dia", "Dia Inch >20<"),
    widget("acc", "RT Acc/Rej"),
    widget("wdate", "Weld Date"),
    widget("rtdate", "RT Date"),
    widget("sfilm", "STATUS RT FILM Ratio % for Service Class"),
    widget("scover", "STATUS RT/UT Cover 5% S.Class"),
    widget("wcover", "STATUS Cover 5% for Welder"),
    widget("wfilm", "STATUS RT FILM Ratio % for Welder"),
  ];
  const cards: KpiWidget[] = [
    { kind: "kpi", label: "RT Ratio % For Serv. Class Cover", value: pct(coverAvg) || "0.00%" },
    // the pbix card is titled "EP" but binds `Rejection UT Rate Joint "PR all"`
    { kind: "kpi", label: 'UT Rej Rate Joint "EP"', value: pct(div(total.ut.ut_rejected, total.ut.ut_done)) || "—" },
    { kind: "kpi", label: "RT/UT Rej Rate by Joint", value: pct(div(total.rt.rejected, total.rt.tested)) || "—" },
  ];
  const remote = PN_REMOTE.map((r) => ({ ...r, value: (filterValues(f[r.id]) ?? []).slice(0, MAX_PICKS) }));
  return {
    filters,
    remote,
    cards,
    summary: { kind: "table", title: "Project RT 100% & PWHT Summary and Backlog", columns: SUMMARY_COLUMNS, rows: summaryRows, total_row: summaryRows.at(-1) },
    main: {
      kind: "table",
      title: "Project NDE and PWHT Status / Service Class + Service Cat + NDT Remarks Performance Status",
      columns: MAIN_COLUMNS,
      rows,
      total_row: totalRow,
    },
  };
}

/** Slicer options over the page's own scope (Weld Cat ≠ J), memoised per load. */
let optMemo: { key: string; opts: Record<string, string[]> } | null = null;
async function filterOptions(): Promise<Record<string, string[]>> {
  const [{ k }] = await query<{ k: string }>(`SELECT coalesce(max(id), 0)::text AS k FROM load`);
  if (optMemo?.key === k) return optMemo.opts;
  const p = new Params();
  const where = scopeWhere({ sources: SOURCES_PR_ALL_LOADED, excludeWeldCats: ["J"] }, p);
  const [a, b, c] = await Promise.all([
    query<Record<string, string[] | null>>(
      `SELECT array_agg(DISTINCT w.sub_contractor) AS subco,
              array_agg(DISTINCT split_part(w.service_class_cat_ndt, ' ', 1)) AS sclass,
              array_agg(DISTINCT w.service_class_cat_ndt) AS skey,
              array_agg(DISTINCT coalesce(w.ha, '(Blank)')) AS ha,
              array_agg(DISTINCT w.area_classification_label) AS area,
              array_agg(DISTINCT w.weld_type) AS wtype,
              array_agg(DISTINCT w.rt_pct::text) AS rt,
              array_agg(DISTINCT w.weld_cat) AS wcat,
              array_agg(DISTINCT ${pwhtYnExpr("w")}) AS pwht,
              array_agg(DISTINCT w.wps_no) AS wps
         FROM mv_joint w WHERE ${where}`,
      p.list(),
    ),
    query<Record<string, string[] | null>>(
      `SELECT array_agg(DISTINCT coalesce(ndt_remarks, '(Blank)')) AS ndt, array_agg(DISTINCT thickness::text) AS thick FROM mv_joint_attr`,
    ),
    query<Record<string, string[] | null>>(
      `SELECT array_agg(DISTINCT welder_id) AS welder, array_agg(DISTINCT material_type) AS mat FROM mv_joint_pairs WHERE weld_cat IS DISTINCT FROM 'J'`,
    ),
  ]);
  // the listed row slicers: values on the rows of the page's joints
  const d = await query<Record<string, string[] | null>>(
    `SELECT array_agg(DISTINCT s.rt_acc_rej) AS acc, array_agg(DISTINCT s.weld_date) AS wdate, array_agg(DISTINCT s.rt_date) AS rtdate
       FROM mv_row_slicer s
      WHERE (s.source, s.joint_id) IN (SELECT w.source, w.joint_id FROM mv_joint w WHERE ${where})`,
    p.list(),
  );
  const all = { ...a[0], ...b[0], ...c[0], ...d[0] };
  const clean = (v: string[] | null | undefined) => (v ?? []).filter((x) => x !== null && x !== "").sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
  const opts: Record<string, string[]> = {};
  for (const [key, v] of Object.entries(all)) opts[key] = clean(v);
  opts.rt = [...(opts.rt ?? [])].sort((x, y) => Number(y) - Number(x));
  // dates newest first, (Blank) last
  for (const id of ["wdate", "rtdate"]) opts[id] = [...(opts[id] ?? [])].sort((x, y) => (x === "(Blank)" ? 1 : y === "(Blank)" ? -1 : y.localeCompare(x)));
  opts.dia = ["0-20", "20-199", "Greater than 199"];
  opts.sfilm = FILM_CLASS_BANDS;
  opts.scover = COVER_CLASS_BANDS;
  opts.wcover = COVER_WELDER_BANDS;
  opts.wfilm = FILM_WELDER_BANDS;
  optMemo = { key: k, opts };
  return opts;
}

// ── the searched row slicers ──

export const PN_OPTION_PAGE = 300;
const ROW_OPT_CACHE = new Map<string, Promise<{ values: string[]; more: boolean }>>();

/**
 * One page of a searched row slicer's values (RT Report, RT Batch No, Joint ID,
 * ISO Number, UT Report "PR All"), under every OTHER slicer: the page's joint
 * slicers narrow the joints, the other row slicers must hold on the same row.
 */
export async function pnRowOptions(
  field: string,
  params: Record<string, string | undefined>,
  q: string,
): Promise<{ values: string[]; more: boolean } | null> {
  if (!isRemote(field)) return null;
  const id = field as RowId;
  const f: PnParams = {};
  for (const k of PN_FILTER_IDS) {
    const v = params[k]?.trim();
    if (v && v !== FILTER_ALL && k !== id) f[k] = v;
  }
  const [{ k }] = await query<{ k: string }>(`SELECT coalesce(max(id), 0)::text AS k FROM load`);
  const key = JSON.stringify([k, id, f, q.trim()]);
  let hit = ROW_OPT_CACHE.get(key);
  if (!hit) {
    hit = (async () => {
      const maps = await statusMaps();
      const opts = await filterOptions();
      const joints: PnParams = { ...f };
      for (const r of ROW_IDS) delete joints[r];
      const scope = await scopeFor(joints, maps, opts);
      const p = new Params();
      const where = scopeWhere(scope, p, "w");
      const c = ROW_COL[id];
      const like = (a: string) => (q.trim() ? `${a}.${c} ILIKE ${p.add(`%${q.trim().replace(/[\\%_]/g, "\\$&")}%`)}` : "");
      const others = rowConds(f, opts, id);
      const order = (x: string) => (id === "rtbatch" ? `(${x} = '(Blank)') DESC, length(${x}), ${x}` : x);
      const narrowed = others.length > 0 || Object.keys(joints).length > 0;
      // Nothing else picked: the distinct values (an index scan), then one
      // EXISTS each — ~60 ms. Under other picks most values have no row in
      // scope and EXISTS would visit them all: hash the joints in scope once
      // and group the matching rows instead (~1–2.5 s, then cached).
      const conds = narrowed ? [...others, like("s")].filter(Boolean) : [];
      const sql = narrowed
        ? `WITH j AS MATERIALIZED (SELECT w.source, w.joint_id FROM mv_joint w WHERE ${where})
           SELECT s.${c} AS v FROM mv_row_slicer s JOIN j ON j.source = s.source AND j.joint_id = s.joint_id
            ${conds.length ? `WHERE ${conds.join(" AND ")}` : ""}
            GROUP BY 1 ORDER BY ${order(`s.${c}`)} LIMIT ${PN_OPTION_PAGE + 1}`
        : `SELECT v FROM (SELECT DISTINCT d.${c} AS v FROM mv_row_slicer d${q.trim() ? ` WHERE ${like("d")}` : ""}) d
            WHERE EXISTS (SELECT 1 FROM mv_row_slicer s JOIN mv_joint w ON w.source = s.source AND w.joint_id = s.joint_id
                           WHERE s.${c} = d.v AND ${where})
            ORDER BY ${order("v")} LIMIT ${PN_OPTION_PAGE + 1}`;
      const rows = await query<{ v: string }>(sql, p.list());
      return { values: rows.slice(0, PN_OPTION_PAGE).map((r) => r.v), more: rows.length > PN_OPTION_PAGE };
    })();
    hit.catch(() => ROW_OPT_CACHE.delete(key));
    if (ROW_OPT_CACHE.size >= 300) ROW_OPT_CACHE.delete(ROW_OPT_CACHE.keys().next().value as string);
    ROW_OPT_CACHE.set(key, hit);
  }
  return hit;
}
