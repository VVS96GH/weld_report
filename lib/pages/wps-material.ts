/**
 * The WPS / Material page (owner, 2026-10-18) — pbix "WPS / Material for
 * Managment" (ReportSection eb76cbf7ccca20098132), read off its definition:
 *
 *   page filters  Sub-Contractor ≠ Inco · WPS No. ≠ "" · Weld Type IN {BW, CLET, GW, MW}
 *   left matrix   Status WPQ Type of Welding Machine ▸ WPS No. ▸ Material Type ▸ Welder ID ▸ Service Class
 *   right matrix  Material Type ▸ WPS No. ▸ Welder ID ▸ Service Class
 *   values        Count of Welder ID · Joint Uniq "PR all" Total · Joint Uniq "PR all" Welded ·
 *                 TP Complete · RT FILM Rej Ratio % · Numb RT/UT · RT Ratio % · "A" · "R" ·
 *                 Rejection Rate Joint (all "PR all")
 *   slicers       Sub-Contractor · HA / Area · Weld Cat (F/S) · Weld Type · RT % · WPS No. ·
 *                 Type of Welding Machine / Welding Process · Material Type · Welder ID ·
 *                 STATUS WPS · STATUS Mat.Type
 *
 * STATUS WPS / Mat.Type are the calculated columns `RT Ratio % STATUS for WPS`
 * / `… for Material Type`: rejected films ÷ films (RT Acc/Rej ≠ RS) of the WPS
 * (material) under ALLEXCEPT — the whole fact table, every filter dropped —
 * banded 0 % / <1 % / 1–2 % / 2–5 % / 5–10 % / >10 % / No RT.
 *
 * Grain: `mv_joint_pairs` (migration 0050), one row per joint × WPS × material
 * × welder, carrying the joint's flags. A joint welded by two welders counts
 * once per welder row and once in any level above (distinct joint per group),
 * as DISTINCTCOUNT does. `Type of Welding Machine` groups case-insensitively
 * ("Manual" and "MANUAL" are one row), as the pbix does.
 */
import { z } from "zod";

import { query } from "@/lib/db";
import {
  FILTER_ALL,
  FILTER_SEP,
  filterValues,
  Params,
  PROJECT_EXCLUDED_SUBCONTRACTORS,
  SOURCES_PR_ALL_LOADED,
} from "@/lib/metrics/scope";
import type { FilterWidget } from "@/lib/page-model";
import { WM_COLUMNS, WM_LEVELS, type WmLevel, type WmPageData, type WmRow, type WmTree } from "@/lib/wps-material-shared";

export * from "@/lib/wps-material-shared";

const KEY_SQL: Record<WmLevel, string> = {
  mach: "upper(coalesce(r.welding_machine_type, ''))",
  wps: "coalesce(p.wps_no, '')",
  mat: "coalesce(p.material_type, '')",
  welder: "p.welder_id",
  sclass: "coalesce(p.service_class_cat_ndt, '')",
};

export const WM_STATUS = ["0%", "1. <1%", "2. 1% - 2%", "3. 2% - 5%", "4. 5% - 10%", "5. > 10%", "6. No RT"] as const;

function band(ratio: number | null): string {
  if (ratio === null) return "6. No RT";
  if (ratio === 0) return "0%";
  if (ratio <= 0.01) return "1. <1%";
  if (ratio <= 0.02) return "2. 1% - 2%";
  if (ratio <= 0.05) return "3. 2% - 5%";
  if (ratio <= 0.1) return "4. 5% - 10%";
  return "5. > 10%";
}

/** The slicer ids this page reads from the URL. */
export const WM_FILTER_IDS = ["subco", "ha", "area", "wcat", "wtype", "rt", "wps", "mach", "proc", "mat", "welder", "swps", "smat"] as const;
export type WmParams = Partial<Record<(typeof WM_FILTER_IDS)[number], string>>;

const PAGE_WELD_TYPES = ["BW", "CLET", "GW", "MW"];

/** WPS / material → status band, over the whole fact table (ALLEXCEPT). Memoised per load. */
let statusMemo: { key: string; wps: Map<string, string>; mat: Map<string, string> } | null = null;
async function statusMaps(): Promise<{ wps: Map<string, string>; mat: Map<string, string> }> {
  const [{ k }] = await query<{ k: string }>(`SELECT coalesce(max(id), 0)::text AS k FROM load`);
  if (statusMemo?.key === k) return statusMemo;
  const sql = (col: string) =>
    `SELECT ${col} AS v, sum(total_no_of_films_rej) AS rej,
            sum(rt_film_total) FILTER (WHERE rt_acc_rej IS DISTINCT FROM 'RS') AS films
       FROM weld WHERE NOT is_cancelled AND ${col} IS NOT NULL GROUP BY 1`;
  const [w, m] = await Promise.all([
    query<{ v: string; rej: string | null; films: string | null }>(sql("wps_no")),
    query<{ v: string; rej: string | null; films: string | null }>(sql("material_type")),
  ]);
  const toMap = (rows: typeof w) =>
    new Map(rows.map((r) => [r.v, band(Number(r.films) ? Number(r.rej ?? 0) / Number(r.films) : null)]));
  statusMemo = { key: k, wps: toMap(w), mat: toMap(m) };
  return statusMemo;
}

/** WHERE for the page scope plus every slicer that is set. */
async function whereFor(f: WmParams, p: Params): Promise<string> {
  const c = [
    `p.source::text = ANY(${p.any(SOURCES_PR_ALL_LOADED)}::text[])`,
    `(p.sub_contractor IS NULL OR NOT (upper(p.sub_contractor) = ANY(${p.any([...new Set(PROJECT_EXCLUDED_SUBCONTRACTORS.map((x) => x.toUpperCase()))])})))`,
    `coalesce(p.wps_no, '') <> ''`,
    `p.weld_type = ANY(${p.any(PAGE_WELD_TYPES)})`,
  ];
  const list = (id: keyof WmParams, sql: string) => {
    const v = filterValues(f[id]);
    if (v?.length) c.push(`${sql} = ANY(${p.any(v)})`);
  };
  list("subco", "p.sub_contractor");
  list("ha", "coalesce(p.ha, '(Blank)')");
  list("area", "p.area_classification_label");
  list("wcat", "p.weld_cat");
  list("wtype", "p.weld_type");
  list("rt", "p.rt_pct::text");
  list("wps", "p.wps_no");
  list("mach", KEY_SQL.mach);
  list("proc", "coalesce(r.welding_process, '')");
  list("mat", "p.material_type");
  list("welder", "p.welder_id");
  const sw = filterValues(f.swps);
  const sm = filterValues(f.smat);
  if (sw?.length || sm?.length) {
    const maps = await statusMaps();
    const pick = (m: Map<string, string>, picks: string[]) => [...m].filter(([, b]) => picks.includes(b)).map(([v]) => v);
    // "6. No RT" also covers values with no films at all (absent from the map)
    if (sw?.length) c.push(`(p.wps_no = ANY(${p.any(pick(maps.wps, sw))})${sw.includes("6. No RT") ? ` OR NOT (p.wps_no = ANY(${p.any([...maps.wps.keys()])}))` : ""})`);
    if (sm?.length) c.push(`(p.material_type = ANY(${p.any(pick(maps.mat, sm))})${sm.includes("6. No RT") ? ` OR NOT (coalesce(p.material_type, '') = ANY(${p.any([...maps.mat.keys()])}))` : ""})`);
  }
  return c.join("\n     AND ");
}

const FROM = `mv_joint_pairs p LEFT JOIN ref_wps_process r ON r.wps_no = p.wps_no`;

const AggRow = z.object({
  k: z.string().nullable(),
  welders: z.coerce.number(),
  total: z.coerce.number(),
  welded: z.coerce.number(),
  tested: z.coerce.number(),
  rej: z.coerce.number(),
  films: z.coerce.number().nullable(),
  films_rej: z.coerce.number().nullable(),
});

function toValues(r: z.infer<typeof AggRow>): Record<string, number | null> {
  const div = (a: number, b: number | null) => (b ? a / b : null);
  return {
    welders: r.welders,
    total: r.total,
    welded: r.welded,
    tp: div(r.welded, r.total),
    film: r.films ? (r.films_rej ?? 0) / r.films : null,
    tested: r.tested,
    ratio: div(r.tested, r.welded),
    acc: r.tested - r.rej,
    rej: r.rej,
    rate: div(r.rej, r.tested),
  };
}

/** One level of a tree under `path` (the parent keys), or the total when `level` is null. */
export async function wmRows(f: WmParams, tree: WmTree, path: string[]): Promise<WmRow[]> {
  const levels = WM_LEVELS[tree];
  const level = levels[path.length];
  if (!level) return [];
  const p = new Params();
  const where = await whereFor(f, p);
  const pathSql = path.map((v, i) => `${KEY_SQL[levels[i]!]} = ${p.add(v)}`);
  const all = [where, ...pathSql].join("\n     AND ");
  const rows = await aggregate(KEY_SQL[level], all, p);
  const expandable = path.length + 1 < levels.length;
  // the pbix sorts each level by RT FILM Rej Ratio % descending
  return rows
    .map((r) => ({ label: r.k ?? "", values: toValues(r), expandable }))
    .sort((a, b) => (b.values.film ?? -1) - (a.values.film ?? -1));
}

async function aggregate(keySql: string, where: string, p: Params): Promise<z.infer<typeof AggRow>[]> {
  const sql =
    `WITH base AS (SELECT ${keySql} AS k, p.* FROM ${FROM} WHERE ${where}),\n` +
    `jg AS (SELECT k, source, joint_id, bool_or(norepair) nr, bool_or(is_welded_norepair) wd, bool_or(is_tested_prall) t,\n` +
    `              bool_or(is_rejected) r, max(films_taken_prall) f, max(films_rej_prall) fr FROM base GROUP BY 1, 2, 3),\n` +
    `wl AS (SELECT k, count(DISTINCT welder_id) AS welders FROM base GROUP BY 1)\n` +
    `SELECT jg.k, wl.welders, count(*) FILTER (WHERE nr) AS total, count(*) FILTER (WHERE wd) AS welded,\n` +
    `       count(*) FILTER (WHERE t) AS tested, count(*) FILTER (WHERE r) AS rej, sum(f) AS films, sum(fr) AS films_rej\n` +
    `  FROM jg JOIN wl ON wl.k IS NOT DISTINCT FROM jg.k GROUP BY 1, 2`;
  return z.array(AggRow).parse(await query(sql, p.list()));
}

export async function getWpsMaterialPage(params: Record<string, string | undefined>): Promise<WmPageData> {
  const f: WmParams = {};
  for (const id of WM_FILTER_IDS) {
    const v = params[id]?.trim();
    if (v && v !== FILTER_ALL) f[id] = v;
  }
  const p = new Params();
  const where = await whereFor(f, p);
  const optP = new Params();
  const optWhere = await whereFor({}, optP);
  const [wpsRows, matRows, totalRows, cardRows, opts] = await Promise.all([
    wmRows(f, "wps", []),
    wmRows(f, "mat", []),
    aggregate("''", where, p),
    query<{ wps: string; mats: string; welders: string }>(
      `SELECT count(DISTINCT p.wps_no) AS wps, count(DISTINCT p.material_type) AS mats, count(DISTINCT p.welder_id) AS welders FROM ${FROM} WHERE ${where}`,
      p.list(),
    ),
    query<Record<string, string[] | null>>(
      `SELECT array_agg(DISTINCT p.sub_contractor) AS subco, array_agg(DISTINCT coalesce(p.ha, '(Blank)')) AS ha,
              array_agg(DISTINCT p.area_classification_label) AS area, array_agg(DISTINCT p.weld_cat) AS wcat,
              array_agg(DISTINCT p.weld_type) AS wtype, array_agg(DISTINCT p.rt_pct::text) AS rt,
              array_agg(DISTINCT p.wps_no) AS wps, array_agg(DISTINCT ${KEY_SQL.mach}) AS mach,
              array_agg(DISTINCT coalesce(r.welding_process, '')) AS proc, array_agg(DISTINCT p.material_type) AS mat,
              array_agg(DISTINCT p.welder_id) AS welder
         FROM ${FROM} WHERE ${optWhere}`,
      optP.list(),
    ),
  ]);
  const o = opts[0] ?? {};
  const clean = (v: string[] | null | undefined, sort: (a: string, b: string) => number = (a, b) => a.localeCompare(b)) =>
    (v ?? []).filter((x) => x !== null && x !== "").sort(sort);
  const widget = (id: keyof WmParams, label: string, options: string[]): FilterWidget => ({
    kind: "filter",
    id,
    label,
    options: [FILTER_ALL, ...options],
    value: f[id] ? (filterValues(f[id]) ?? []).join(FILTER_SEP) : FILTER_ALL,
    multi: true,
  });
  const filters: FilterWidget[] = [
    widget("subco", "Sub-Contractor", clean(o.subco)),
    widget("ha", "HA", clean(o.ha)),
    widget("area", "Area", clean(o.area)),
    widget("wcat", "Weld Cat", clean(o.wcat).filter((c) => c !== "J")),
    widget("wtype", "Weld Type", clean(o.wtype)),
    widget("rt", "RT %", clean(o.rt, (a, b) => Number(b) - Number(a))),
    widget("wps", "WPS No.", clean(o.wps)),
    widget("mach", "Type of Welding", clean(o.mach)),
    widget("proc", "Welding Process", clean(o.proc)),
    widget("mat", "Material Type", clean(o.mat)),
    widget("welder", "Welder ID", clean(o.welder)),
    widget("swps", "STATUS WPS", [...WM_STATUS]),
    widget("smat", "STATUS Mat.Type", [...WM_STATUS]),
  ];
  const t = totalRows[0];
  const total = t ? { label: "Total", values: toValues(t), expandable: false } : null;
  const c = cardRows[0];
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  return {
    filters,
    cards: {
      film: total?.values.film ?? null,
      wps: Number(c?.wps ?? 0),
      materials: Number(c?.mats ?? 0),
      welders: Number(c?.welders ?? 0),
    },
    columns: WM_COLUMNS,
    wps: { rows: wpsRows, total },
    mat: { rows: matRows, total },
    query: q,
  };
}

/** For the API: parse the URL's slicers the same way the page does. */
export function wmParamsFrom(sp: URLSearchParams): WmParams {
  const f: WmParams = {};
  for (const id of WM_FILTER_IDS) {
    const v = sp.get(id)?.trim();
    if (v && v !== FILTER_ALL) f[id] = v;
  }
  return f;
}
