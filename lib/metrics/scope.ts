/**
 * Scope predicates — the composable `WHERE` fragments every metric shares.
 *
 * Every value is bound as `$n`; nothing here interpolates caller input into
 * SQL text. Column names are the `pg column name` list of
 * `analysis/dump/profile.md` §8.1 plus the derived columns of
 * `analysis/calculation-logic.md` §6.2.
 *
 * Rulings baked in (calculation-logic.md §5, all accepted by the orchestrator):
 *  - R-06: the `"PR"` scope (`Project WD+WR`) is NOT implemented — it is a
 *    one-row dead table in the shipped pbix. Only `"EP"`/`"WD"` (source
 *    `WELD_DUMP`) and `"PR all"` (the four-source union) exist.
 *  - R-09: Slug Catcher is `service_cat = 'SG'`, not the `EQP-SLG-*`
 *    service-class prefix.
 *  - R-03: ACCIONA in, INCO out by default.
 *  - R-02: cancelled welds are already excluded from `weld` at load time.
 *  - R-07: the four `[Total Scope Dia … Master Table]` measures (M99) are
 *    dropped — they reference a `'Master Table'` that does not exist in the
 *    model, cannot evaluate, and are bound to none of the 44 mockup pages.
 */

import { z } from "zod";
import { query } from "@/lib/db";

/** §0.3 — the fact-table scope discriminator. */
export const SOURCES_EP = ["WELD_DUMP"] as const;

/** CCC's own two files: the welder-pass fact export + the NOT-WELDED joints (R2-03). */
export const SOURCES_CCC = ["CCC_WELDER_RECORD", "CCC_JOINT_RECORD"] as const;

/**
 * The `"PR all"` union as the pbix defines it. ACCIONA and INCO are still
 * absent from `sources/` (calculation-logic §7 C-12), so nothing can be
 * computed for them — use {@link SOURCES_PR_ALL_LOADED} for real queries and
 * keep this list as the documented target.
 */
export const SOURCES_PR_ALL = [
  "WELD_DUMP",
  "CCC_WELDER_RECORD",
  "CCC_JOINT_RECORD",
  "ACCIONA",
  "INCO",
] as const;

/**
 * `"PR all"` restricted to what is actually loadable today. Every project-scope
 * page discloses which of the five are absent rather than implying the union is
 * complete — the note is computed from the data, never hard-coded.
 */
export const SOURCES_PR_ALL_LOADED = [
  "WELD_DUMP",
  "CCC_WELDER_RECORD",
  "CCC_JOINT_RECORD",
  "ACCIONA",
  "INCO",
] as const;

/**
 * R3-01 — INCO is loaded but excluded from project scope at the QUERY layer.
 *
 * The pbix puts this in 69 visual/page filters, not in the model: the measure
 * `[Total Scope Dia "BW" "PR all"]` includes Inco explicitly, so the exclusion
 * cannot live in the loader or in a measure without over- or under-counting
 * something. It belongs exactly here, applied by {@link projectScope}.
 *
 * ACCIONA is **inside** project scope — mockup page 2 has an Acciona row. (7
 * internal pbix pages do exclude Acciona too, but those are pages 13/76/82/87/
 * 113/114, none of which the mockup renders; it is not a global invariant.)
 *
 * Both spellings are listed on purpose. R2-08 canonicalises the party to
 * upper-case `INCO`, but the DAX filters read `Sub-Contractor NOT IN {Inco}`
 * and the trend workbooks carry both — a single-spelling predicate silently
 * stops excluding anything the day the other spelling appears.
 */
export const PROJECT_EXCLUDED_SUBCONTRACTORS = ["INCO", "Inco"] as const;

/**
 * The unfiltered `"PR all"` measure scope — the whole loaded union, Inco
 * included. This is what a pbix CARD shows: a measure with no visual filter on
 * it. Pinned against three of the user's readings in
 * `tests/metrics-batch3.test.ts`.
 */
export function measureScope(extra: Scope = {}): Scope {
  return { sources: SOURCES_PR_ALL_LOADED, ...extra };
}

/**
 * The project ("PR all") scope: the loaded union minus INCO.
 *
 * Every page-1/page-2 widget and every project-scope metric goes through this
 * so the predicate is written once. The per-subcontractor pages do NOT use it —
 * they are already scoped to one party.
 */
export function projectScope(extra: Scope = {}): Scope {
  return {
    sources: SOURCES_PR_ALL_LOADED,
    excludeSubContractors: PROJECT_EXCLUDED_SUBCONTRACTORS,
    ...extra,
  };
}

/**
 * R-04 / §7 C-4: `PWHT Y/N = '25.01'` (580,860 rows) is counted as BOTH `Y` and
 * `N`,
 * exactly as the DAX does (`PWHT Y/N IN {"Y","25.01"}` in the done measures
 * and `IN {"N","25.01"}` in the no-PWHT ones). Named so the report owner can
 * rule on it later without hunting through the SQL.
 */
export const PWHT_AMBIGUOUS_TOKEN = "25.01";
export const PWHT_YES_TOKENS = ["Y", PWHT_AMBIGUOUS_TOKEN] as const;
export const PWHT_NO_TOKENS = ["N", PWHT_AMBIGUOUS_TOKEN] as const;

/** §0.6 — RT weld types, everywhere in the model. */
export const RT_WELD_TYPES = ["BW", "GW", "CLET", "MW"] as const;

/**
 * §0.6 — the 16-code RT hold list, `"EP"`/`"WD"` flavour. Verbatim, unsorted.
 *
 * It deliberately OMITS `'T1-2'`. That is not an oversight to be tidied: all
 * **20** `"EP"` backlog measures in `analysis/pbix/measures.md` omit it, while
 * both `"PR all"` measures include it. The two families genuinely differ, and
 * a test pins the difference in both directions.
 */
export const RT_BACKLOG_STATUS = [
  "H",
  "HS",
  "HS CCC",
  "SS",
  "T",
  "T1",
  "T1S",
  "T1-1",
  "T1-1S",
  "T1-2S",
  "T2",
  "T3",
  "T2-1",
  "T2-1S",
  "T2-2S",
  "T2S",
] as const;

/**
 * `"PR all"` flavour = the `"EP"` list + `'T1-2'` — the 17 distinct codes of
 * `[RT BACKLOG Total Project "PR all"]`, verbatim:
 *
 * ```dax
 * [RT Weld Status] IN {
 *   "H", "HS", "HS CCC", "SS", "T", "T1","T1-2", "T1S", "T1-1", "T1-1S",
 *   "T1-2S", "T1S", "T2", "T3", "T2-1", "T2-1S", "T2-2S", "T2S" }
 * ```
 *
 * The DAX lists **18** entries because `"T1S"` appears twice — a duplicate in
 * the source, not a code we are missing. 17 distinct is the whole list.
 *
 * `'T1-2'` matches **no row** in the current load (0 in `rt_weld_status`, 0 in
 * `pwht_weld_status`), so it changes no number today. It is carried because the
 * DAX carries it, not because it does anything.
 */
export const RT_BACKLOG_STATUS_PRALL = [...RT_BACKLOG_STATUS, "T1-2"] as const;

/** Second branch of every RT-backlog measure: `RT% = 100 AND status IN {?,'',S}`. */
export const RT_BACKLOG_STATUS_100 = ["?", "S"] as const; // '' is handled as NULL

/**
 * R2-13 / §7 C-2: CCC rows carry a synthesised `RT Weld Status` of `HS CCC` on
 * every `RT% = 100` row (484,130 of them) — a token `Weld Dump` never emits.
 * `HS CCC` is already in {@link RT_BACKLOG_STATUS} verbatim from the DAX, so the
 * CCC hold list needs no special-casing; this constant exists so the intent is
 * greppable and the ruling is testable.
 */
export const CCC_RT_HOLD_TOKEN = "HS CCC";

/** §0.6 — PWHT hold list, `"EP"`/`"WD"` flavour = the RT list without `'HS CCC'`. */
export const PWHT_BACKLOG_STATUS = RT_BACKLOG_STATUS.filter(
  (s) => s !== "HS CCC",
);

/**
 * `"PR all"` flavour = the `"EP"` list + `'T1-2'` + `'HS CCC'` — the same 17
 * distinct codes as {@link RT_BACKLOG_STATUS_PRALL}, which is what
 * `[PWHT All BACKLOG All WELD TYPE "PR all"]` lists (`"T1S"` duplicated there
 * too).
 */
export const PWHT_BACKLOG_STATUS_PRALL = [
  ...RT_BACKLOG_STATUS,
  "T1-2",
] as const;

/** Aging bucket edges (M51/M66), left-open, verbatim from the DAX. */
export const AGING_BUCKETS = [
  { key: "within_3", label: "within 3 Days", min: null, max: 3 },
  { key: "3_to_7", label: "3 to 7 Days", min: 3, max: 7 },
  { key: "7_to_15", label: "7 to 15 Days", min: 7, max: 15 },
  { key: "15_to_30", label: "15 to 30 Days", min: 15, max: 30 },
  { key: "above_30", label: "above 30 Days", min: 30, max: null },
] as const;

export type AgingKey = (typeof AGING_BUCKETS)[number]["key"];

/**
 * Parameter accumulator. `p.add(v)` pushes a value and returns its `$n`
 * placeholder, so fragments compose without ever knowing their own offset.
 */
export class Params {
  readonly values: unknown[] = [];

  add(v: unknown): string {
    this.values.push(v);
    return `$${this.values.length}`;
  }

  /** Bind an array for `= ANY($n)` — one placeholder for any list length. */
  any(vs: readonly unknown[]): string {
    return this.add([...vs]);
  }

  list(): unknown[] {
    return this.values;
  }
}

export type ServiceCatScope = "SG" | "NONSG";

export type Scope = {
  /** `Sub-Contractor` page filter. */
  subContractor?: string;
  /** Page-1 multi-select: `Sub-Contractor IN (…)` (2+ values; one value uses `subContractor`). */
  subContractors?: readonly string[];
  /**
   * Page-1 "HA, Area Classification" multi-select, OR-ed: each entry is a whole
   * HA (`area` absent), an HA ▸ area pair, or an area alone (`ha` absent).
   * `ha: null` is the "(Blank)" group (`ha IS NULL`). See {@link haAreaCondition}.
   */
  haArea?: readonly HaAreaPick[];
  /** `SC NOT IN {…}` — the project pages all carry `NOT IN {Inco}`. */
  excludeSubContractors?: readonly string[];
  /** R-09 slug-catcher split: `service_cat = 'SG'` vs `IS DISTINCT FROM 'SG'`. */
  serviceCat?: ServiceCatScope;
  /** `RT%` slicer value (5/10/20/30/100). */
  rtPct?: number;
  /** Multi-select `RT% IN (…)` (forecast page, 2026-10-14). */
  rtPcts?: readonly number[];
  /** `Weld Type IN (…)`. */
  weldTypes?: readonly string[];
  /** `Weld Type NOT IN (…)` — e.g. the per-WPS pages drop `DMY`/`THD`. */
  excludeWeldTypes?: readonly string[];
  /** `Weld Cat IN (…)`. */
  weldCats?: readonly string[];
  /** `Weld Cat NOT IN (…)` — e.g. `WC <> 'J'`. */
  excludeWeldCats?: readonly string[];
  /** `Weld Date > 0` in DAX terms. */
  weldedOnly?: boolean;
  /** Page filter `Temporary Lines "WD" IN {null}` → `temporary_lines = false`. */
  temporaryLines?: boolean;
  /** TEKFEN pages split on `TMCP Pipe`. */
  tmcpPipe?: boolean;
  /**
   * Read `tmcpPipe` with the "PR all" rule — `[Service class] = "9C3AQN" &&
   * [Dia inch] IN {30, 34, 46}` — instead of the dump's 46-only `TMCP Pipe`
   * (the TEKFEN status pages, owner 2026-10-18: 4 TRN joints at 30").
   */
  tmcpPrAll?: boolean;
  /** `Dia Inch Factor = 'Y'` (the BW/CLET dia-inch weighting flag). */
  diaInchFactorY?: boolean;
  /** `WPS No. <> ""`. */
  wpsPresent?: boolean;
  /**
   * `PWHT Weld Status` is not blank — the extra table filter the PWHT-by-RT%
   * pages carry (§3.3 "as 19 + `PWHT Weld Status` not blank").
   */
  pwhtStatusPresent?: boolean;
  /**
   * The CCC PWHT-by-RT% details matrix: visual filter `PWHT Y/N CCC IN {"Y"}` —
   * the RAW joint-record column, not the owner's (NEW) one (owner, 2026-10-18:
   * reproduces 11,413 joints / 41 backlog on RT 100 %).
   */
  pwhtYnCccRawY?: boolean;
  /** §0.3 source discriminator; defaults to the `"EP"` scope. */
  sources?: readonly string[];
  /**
   * `Area Classification` as text — the pbix `"PR all"` vocabulary (22 values:
   * the dump's 7-digit codes plus CCC's `Train-8 Process` style names). Group
   * and slice on this, never on the integer `area_classification`, which is
   * NULL for every CCC row.
   */
  areaClassificationLabel?: string;
  /**
   * `HA` (handover area) as `HA1`..`HA4`. Derived in `mv_joint` from
   * `Subsystem Code` / `System No` per the pbix calculated column (migration
   * 0026) — it exists on WELD_DUMP rows only, so CCC, ACCIONA and INCO joints
   * are NULL and a HA filter excludes them by construction.
   */
  ha?: string;
  /** The pbix slicer's "(Blank)" group — `ha IS NULL`, not a literal match. */
  haIsNull?: boolean;
  /**
   * Forecast page slicers. Both are pbix CALCULATED columns with no stored
   * equivalent, so they are expressed here as SQL over the underlying columns
   * — and, like every other scope value, BOUND as parameters. They are never
   * interpolated: these come from a query string.
   */
  byUtAll?: string;
  diaBand?: string;
  /** Multi-select twins of `byUtAll` / `diaBand` (forecast page, 2026-10-14). */
  byUtAlls?: readonly string[];
  diaBands?: readonly string[];
  /**
   * The NDE / PWHT pages' Service Class slicer (owner request 2026-09-15): `sql`
   * is the page's OWN class expression (the `GroupSpec.sql` it groups rows by —
   * `w.service_class_cat_wd` or `w.service_class_cat_ndt`, never caller text),
   * `value` the chosen label, bound as a parameter.
   */
  serviceClass?: { sql: string; value: string };
  /**
   * The NDE / PWHT pages' PWHT Y/N slicer (owner request 2026-09-15): the RAW
   * token at joint grain — `PWHT Y/N` on dump rows, `PWHT Y/N CCC` on CCC rows
   * (migration 0038) — so `Y`, `N` and the dump's `25.01` are each their own value.
   */
  pwhtYn?: string;
  /** Multi-select twins (2026-10-14): several classes / tokens, OR-ed. */
  serviceClasses?: { sql: string; values: readonly string[] };
  pwhtYns?: readonly string[];
};

/**
 * The slicer's column, one expression for both sources: the dump's raw `PWHT Y/N`
 * (0038), and for CCC the owner's `[PWHT Y/N CCC (NEW)]` calculated column
 * (migration 0034, `pwht_y_n_ccc_new_y`) — the owner's ruling of 2026-09-15
 * ("вот формула — можешь её использовать"), replacing the raw `PWHT Y/N CCC`
 * for 818 of 1,470,093 CCC joints. The two are NULL on disjoint sources, so
 * `coalesce` picks whichever exists.
 */
export const pwhtYnExpr = (a = "w") =>
  `coalesce(${a}.pwht_y_n, CASE WHEN ${a}.pwht_y_n_ccc_new_y THEN 'Y' WHEN ${a}.pwht_y_n_ccc_new_y = false THEN 'N' END)`;

/**
 * `[By UT All]` — materialised on `mv_joint` by migration 0033, because the
 * four columns it reads (`by_ut`, `rt_ut`, `ht_remarks`,
 * `manual_ut_report_no_all`) live at row grain and are not on the joint view.
 */
export const byUtAllExpr = (a = "w") => `${a}.by_ut_all`;

/**
 * `[Dia Inch >20<]` — materialised on `mv_joint` by migration 0033. The band
 * is LABELLED `20-199` but its upper bound is 200; that is the DAX's own
 * inconsistency, reproduced there rather than corrected.
 */
export const diaBandExpr = (a = "w") => `${a}.dia_band`;

/**
 * Render a scope as a list of SQL conditions over alias `a` (default `w`).
 * Returns `[]` for an empty scope; callers `and()` them together.
 */
export function scopeConditions(
  scope: Scope,
  p: Params,
  alias = "w",
): string[] {
  const c: string[] = [];
  const a = alias;

  const sources = scope.sources ?? SOURCES_EP;
  // Only constrain on `source` when the table can actually hold more than the
  // weld dump; a single-source predicate is free but keeps the intent visible.
  // `source` is an enum in §6.2; cast both sides to text so the binding works
  // whether DB-LANE ships `weld_source` as an enum or as plain text.
  c.push(`${a}.source::text = ANY(${p.any(sources)}::text[])`);

  if (scope.subContractor !== undefined) {
    c.push(`${a}.sub_contractor = ${p.add(scope.subContractor)}`);
  }
  if (scope.subContractors?.length) {
    c.push(`${a}.sub_contractor = ANY(${p.any(scope.subContractors)})`);
  }
  if (scope.haArea?.length) {
    c.push(haAreaCondition(scope.haArea, p, a));
  }
  if (scope.excludeSubContractors?.length) {
    // DAX `NOT IN {…}` is true for blanks, so NULL must survive (§0.2).
    c.push(
      `(${a}.sub_contractor IS NULL OR NOT (${a}.sub_contractor = ANY(${p.any(scope.excludeSubContractors)})))`,
    );
  }
  if (scope.serviceCat === "SG") {
    c.push(`${a}.service_cat = 'SG'`);
  } else if (scope.serviceCat === "NONSG") {
    // §0.2: `<> "SG"` in DAX is true for blanks too.
    c.push(`${a}.service_cat IS DISTINCT FROM 'SG'`);
  }
  if (scope.rtPcts?.length) {
    c.push(`${a}.rt_pct = ANY(${p.add(scope.rtPcts.map(String))}::int[])`);
  }
  if (scope.rtPct !== undefined) {
    c.push(`${a}.rt_pct = ${p.add(scope.rtPct)}`);
  }
  if (scope.pwhtYn !== undefined) {
    c.push(`${pwhtYnExpr(a)} = ${p.add(scope.pwhtYn)}`);
  }
  if (scope.pwhtYns?.length) {
    c.push(`${pwhtYnExpr(a)} = ANY(${p.any(scope.pwhtYns)})`);
  }
  if (scope.serviceClasses?.values.length) {
    c.push(`btrim(${scope.serviceClasses.sql}) = ANY(${p.any(scope.serviceClasses.values.map((v) => v.trim()))})`);
  }
  if (scope.serviceClass !== undefined) {
    // Compared TRIMMED: `service_class_cat_wd` is `class || ' ' || cat`, so a row with
    // no Service Cat (every CCC row under ALL) carries a trailing space that a URL
    // round-trip drops — 42 of 156 classes were unselectable (owner, 2026-09-15).
    c.push(`btrim(${scope.serviceClass.sql}) = ${p.add(scope.serviceClass.value.trim())}`);
  }
  if (scope.weldTypes?.length) {
    c.push(`${a}.weld_type = ANY(${p.any(scope.weldTypes)})`);
  }
  if (scope.excludeWeldTypes?.length) {
    c.push(
      `(${a}.weld_type IS NULL OR NOT (${a}.weld_type = ANY(${p.any(scope.excludeWeldTypes)})))`,
    );
  }
  if (scope.weldCats?.length) {
    c.push(`${a}.weld_cat = ANY(${p.any(scope.weldCats)})`);
  }
  if (scope.excludeWeldCats?.length) {
    c.push(
      `(${a}.weld_cat IS NULL OR NOT (${a}.weld_cat = ANY(${p.any(scope.excludeWeldCats)})))`,
    );
  }
  if (scope.weldedOnly) {
    c.push(`${a}.weld_date IS NOT NULL`);
  }
  if (scope.temporaryLines !== undefined) {
    c.push(`${a}.temporary_lines = ${p.add(scope.temporaryLines)}`);
  }
  if (scope.tmcpPipe !== undefined && scope.tmcpPrAll) {
    const prall = `(split_part(${a}.service_class_cat_ndt, ' ', 1) = '9C3AQN' AND ${a}.dia_inch IN (30, 34, 46))`;
    c.push(scope.tmcpPipe ? prall : `NOT coalesce(${prall}, false)`);
  } else if (scope.tmcpPipe !== undefined) {
    c.push(`${a}.tmcp_pipe = ${p.add(scope.tmcpPipe)}`);
  }
  if (scope.diaInchFactorY) {
    // §8.1 types `dia_inch_factor` as boolean, §6.2 as char(1) 'Y'/'N'.
    // Casting to text accepts either shape ('Y' or 'true'); flagged to DB-LANE.
    c.push(`${a}.dia_inch_factor::text IN ('Y','y','true','t')`);
  }
  if (scope.wpsPresent) {
    c.push(`${a}.wps_no IS NOT NULL`);
  }
  if (scope.pwhtYnCccRawY) {
    c.push(`${a}.pwht_y_n_ccc = 'Y'`);
  }
  if (scope.pwhtStatusPresent) {
    // `has_pwht_status` is the joint-grain form of `pwht_weld_status IS NOT NULL`.
    c.push(`${a}.has_pwht_status`);
  }
  if (scope.haIsNull) {
    c.push(`${a}.ha IS NULL`);
  }
  if (scope.byUtAlls?.length) {
    c.push(`(${byUtAllExpr(a)}) = ANY(${p.any(scope.byUtAlls)})`);
  }
  if (scope.diaBands?.length) {
    c.push(`(${diaBandExpr(a)}) = ANY(${p.any(scope.diaBands)})`);
  }
  if (scope.byUtAll !== undefined) {
    c.push(`(${byUtAllExpr(a)}) = ${p.add(scope.byUtAll)}`);
  }
  if (scope.diaBand !== undefined) {
    c.push(`(${diaBandExpr(a)}) = ${p.add(scope.diaBand)}`);
  }
  if (scope.ha !== undefined) {
    c.push(`${a}.ha = ${p.add(scope.ha)}`);
  }
  if (scope.areaClassificationLabel !== undefined) {
    c.push(`${a}.area_classification_label = ${p.add(scope.areaClassificationLabel)}`);
  }
  return c;
}

/**
 * The joint-grain rollup every measure reads (`db/migrations/0013_mv_joint.sql`).
 *
 * One row per `(source, joint_id)`, so `DISTINCTCOUNT(Joint ID)` becomes
 * `count(*)` and Postgres stops sorting 6.5 M joint ids once per aggregate per
 * group. The row-level predicate functions in this package remain the canonical
 * definition of every flag in that view — read them together.
 */
export const JOINT_FROM = "mv_joint w";

/** The weld-pass fact table. Only row-level detail should read it. */
export const ROW_FROM = "weld w";

/**
 * The per-WPS pivot grain, `(source, joint_id, wps_no)`. `wps_no` is the one
 * dimension that is genuinely multi-valued per joint, so the WPS pivots cannot
 * use {@link JOINT_FROM} without losing a joint from one of its two cells.
 */
export const WPS_FROM = "mv_joint_wps w";

/** `AND` a list of conditions; `TRUE` when empty. */
export function and(conds: readonly string[]): string {
  const kept = conds.filter((c) => c && c.trim().length > 0);
  return kept.length ? kept.map((c) => `(${c})`).join(" AND ") : "TRUE";
}

/** `scopeConditions` + `and`, ready to drop after `WHERE`. */
export function scopeWhere(scope: Scope, p: Params, alias = "w"): string {
  return and(scopeConditions(scope, p, alias));
}

/**
 * `FILTER (WHERE …)` clause body for a metric predicate evaluated inside a
 * scoped query: the scope lives in the outer `WHERE`, this is the extra test.
 */
export function filterWhere(conds: readonly string[]): string {
  return `FILTER (WHERE ${and(conds)})`;
}

/** DAX `[X] <> "v"` (true when blank) → `x IS DISTINCT FROM 'v'` (§0.2). */
export function notEq(col: string, value: string, p: Params): string {
  return `${col} IS DISTINCT FROM ${p.add(value)}`;
}

/** DAX `[X] IN {…}` where the set does NOT include blank (§0.2). */
export function inList(col: string, values: readonly string[], p: Params): string {
  return `${col} = ANY(${p.any(values)})`;
}

/** DAX `[X] IN {…,""}` — the set includes blank, so NULL matches too (§0.2). */
export function inListOrBlank(
  col: string,
  values: readonly string[],
  p: Params,
): string {
  return `(${col} IS NULL OR ${col} = ANY(${p.any(values)}))`;
}

/**
 * `DATEDIFF([Weld Date], TODAY(), DAY)` bucket test (M51/M66).
 * `asOfParam` is the `$n` placeholder holding the `as_of` date.
 */
export function agingCondition(
  bucket: (typeof AGING_BUCKETS)[number],
  asOfParam: string,
  alias = "w",
): string {
  return agingConditionOn(bucket, asOfParam, `${alias}.weld_date`);
}

/** {@link agingCondition} against an explicit date column. */
export function agingConditionOn(
  bucket: (typeof AGING_BUCKETS)[number],
  asOfParam: string,
  dateCol: string,
): string {
  const age = `(${asOfParam}::date - ${dateCol})`;
  const parts: string[] = [`${dateCol} IS NOT NULL`];
  if (bucket.min !== null) parts.push(`${age} > ${bucket.min}`);
  if (bucket.max !== null) parts.push(`${age} <= ${bucket.max}`);
  return and(parts);
}

// ── grouped-select assembly ─────────────────────────────────────────────────

export type GroupSpec = {
  /** Output column name. */
  key: string;
  /** SQL expression to group by. */
  sql: string;
};

export type AggSpec = {
  /** Output column name. */
  key: string;
  /** Aggregate expression, already carrying its own `FILTER (WHERE …)`. */
  sql: string;
};

/**
 * Assemble one `SELECT … FROM weld w WHERE … GROUP BY …` covering a whole
 * widget group, so a page costs one round-trip per group rather than one per
 * cell. `withTotal` adds a `GROUPING SETS` rollup row (every group column
 * NULL) so the table's Total line comes back in the same result set.
 */
export function buildGroupedSelect(opts: {
  groups: readonly GroupSpec[];
  aggs: readonly AggSpec[];
  where: string;
  withTotal?: boolean;
  orderBy?: string;
  from?: string;
}): string {
  const from = opts.from ?? JOINT_FROM;
  const groupCols = opts.groups.map((g) => `${g.sql} AS ${g.key}`);
  const aggCols = opts.aggs.map((a) => `${a.sql} AS ${a.key}`);
  const select = [...groupCols, ...aggCols].join(",\n       ");
  if (opts.groups.length === 0) {
    return `SELECT ${aggCols.join(",\n       ")}\n  FROM ${from}\n WHERE ${opts.where}`;
  }
  const keys = opts.groups.map((g) => g.sql).join(", ");
  const groupBy = opts.withTotal
    ? `GROUP BY GROUPING SETS ((${keys}), ())`
    : `GROUP BY ${keys}`;
  const order = opts.orderBy ? `\n ORDER BY ${opts.orderBy}` : "";
  return `SELECT ${select}\n  FROM ${from}\n WHERE ${opts.where}\n ${groupBy}${order}`;
}

// ── row parsing ─────────────────────────────────────────────────────────────

/**
 * `node-postgres` returns `bigint`/`numeric` as strings so 64-bit values keep
 * their precision. Every metric row therefore goes through zod coercion before
 * it leaves this layer.
 */
export const zCount = z.coerce.number().int();
/** A sum that may be NULL (no matching rows) — NULL is preserved, not zeroed. */
export const zSum = z.union([z.null(), z.coerce.number()]);
export const zText = z.union([z.null(), z.string()]);

/** DAX `DIVIDE(a,b)` — blank on divide-by-zero, never `Infinity`/`NaN`. */
export function divide(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b;
}


// ── FABRICATED (M44 / M48 / M49) ────────────────────────────────────────────

/**
 * `[Status FABRICATED]` / `[Spool ID Status] = "Fabricated"`.
 *
 * The DAX looks the spool up by `Spool ID` and asks whether it has a
 * `FABRICATED` date. Ruling R2-06 unions the two spool masters into one table
 * with a `source` discriminator: `Spool Dump.txt` covers GAC/TEKFEN/MEDGULF
 * (its `FABRICATED` column) and `Spool.csv` covers CCC (its `SHOP WELD
 * COMPLETE`, mapped onto the same `fabricated` column) — §7 C-13. `Spool
 * Dump.txt` holds **zero** CCC spools, so matching on `spool_id` alone is
 * unambiguous; the source is not part of the predicate.
 */
export function fabricatedCond(a = "w"): string {
  return `EXISTS (SELECT 1 FROM spool sp WHERE sp.spool_id = ${a}.spool_id AND sp.fabricated IS NOT NULL)`;
}

// ── page-1 slicers ──────────────────────────────────────────────────────────

/**
 * The page-1 filter bar: Sub-Contractor, Weld Type, Weld Cat.
 *
 * Semantics are a pbix **slicer on the fact table** — one extra `WHERE` AND-ed
 * on top of whatever scope a widget already has. It never replaces a per-card
 * rule: `MT/PT Done` still excludes Inco, so `subco=INCO` renders honest-empty
 * with the note that already explains why, rather than a fabricated 0.
 *
 * Values are the raw column values. `undefined` and `"All"` both mean "no
 * filter", so a UI can round-trip its own sentinel without translating.
 */
export type WeldingFilters = {
  ha?: string;
  area?: string;
  subco?: string;
  wtype?: string;
  wcat?: string;
  /** NDE / PWHT pages (12–40) only: one Service Class label; absent = All. */
  sclass?: string;
  /** NDE / PWHT pages (12–40) only: one PWHT Y/N token (`Y` / `N` / `25.01`); absent = All. */
  pwht?: string;
  /** NDE / PWHT pages only: RT % values, comma-joined; absent = the page's own RT %. */
  rtpct?: string;
};

export const FILTER_ALL = "All";

/**
 * Page-1 slicers are MULTI-select (owner request 2026-10-14, the pbix's
 * check-box slicers): several values travel comma-joined in the same search
 * param (`subco=GAC,TEKFEN`). No slicer value contains a comma (checked against
 * every option list). A child `area` value may be an `HA>Area` pair, so the
 * "HA, Area Classification" tree can pick one area under one HA only.
 */
export const FILTER_SEP = ",";
export const PAIR_SEP = ">";

/** The values of one slicer param; `undefined` when nothing is picked. */
export function filterValues(v: string | undefined): string[] | undefined {
  if (v === undefined) return undefined;
  const out = [...new Set(v.split(FILTER_SEP).map((x) => x.trim()).filter((x) => x && x !== FILTER_ALL))];
  return out.length ? out : undefined;
}

/** One pick of the "HA, Area Classification" tree. `ha: null` = "(Blank)". */
export type HaAreaPick = { ha?: string | null; area?: string };

/**
 * The tree picks from the `ha` / `area` params.
 *
 * `ha` lists whole HAs; `area` lists `HA>Area` pairs, or plain areas. A plain
 * area with exactly one `ha` and nothing else is the pre-multi-select link form
 * (`?ha=HA1&area=Train-8 Process`) and keeps its old meaning: that area within
 * that HA.
 */
export function haAreaPicks(f: WeldingFilters): HaAreaPick[] {
  const has = filterValues(f.ha) ?? [];
  const areas = filterValues(f.area) ?? [];
  const toHa = (h: string) => (h === FILTER_BLANK ? null : h);
  const legacy = has.length === 1 && areas.length > 0 && areas.every((a) => !a.includes(PAIR_SEP));
  if (legacy) return areas.map((area) => ({ ha: toHa(has[0]!), area }));
  const picks: HaAreaPick[] = has.map((h) => ({ ha: toHa(h) }));
  for (const a of areas) {
    const i = a.indexOf(PAIR_SEP);
    picks.push(i < 0 ? { area: a } : { ha: toHa(a.slice(0, i)), area: a.slice(i + 1) });
  }
  return picks;
}

/** SQL for {@link HaAreaPick}s: the picks are OR-ed, each pick's parts AND-ed. */
export function haAreaCondition(picks: readonly HaAreaPick[], p: Params, a = "w"): string {
  const ors = picks.map((k) => {
    const parts: string[] = [];
    if (k.ha === null) parts.push(`${a}.ha IS NULL`);
    else if (k.ha !== undefined) parts.push(`${a}.ha = ${p.add(k.ha)}`);
    if (k.area !== undefined) parts.push(`${a}.area_classification_label = ${p.add(k.area)}`);
    return parts.length ? `(${parts.join(" AND ")})` : "true";
  });
  return `(${ors.join(" OR ")})`;
}

/**
 * The pbix slicer's own label for the blank group. Sent as the `ha` value when
 * the reader picks "(Blank)", and translated to `ha IS NULL` — a literal
 * comparison would match nothing, since blank HA is NULL in `mv_joint`.
 */
export const FILTER_BLANK = "(Blank)";

/** Normalise: drop `"All"`, empty strings and whitespace-only values. */
export function normaliseFilters(f: WeldingFilters | undefined): WeldingFilters {
  const clean = (v: string | undefined) => {
    const t = v?.trim();
    return !t || t === FILTER_ALL ? undefined : t;
  };
  return {
    ha: clean(f?.ha),
    area: clean(f?.area),
    subco: clean(f?.subco),
    wtype: clean(f?.wtype),
    wcat: clean(f?.wcat),
    sclass: clean(f?.sclass),
    pwht: clean(f?.pwht),
    rtpct: clean(f?.rtpct),
  };
}

/** `true` when nothing is filtered — the page must then be byte-identical. */
export function noFilters(f: WeldingFilters): boolean {
  return !f.ha && !f.area && !f.subco && !f.wtype && !f.wcat;
}

/**
 * AND the slicer onto an existing scope.
 *
 * `subContractor` is overwritten rather than merged: page 1 has no
 * sub-contractor of its own, and a page that does would be filtering itself.
 * `weldTypes` / `weldCats` are likewise set, not intersected — the slicer picks
 * exactly one value and any page-level list that disagreed would empty the
 * page silently.
 */
export function withFilters(scope: Scope, f: WeldingFilters): Scope {
  const out: Scope = { ...scope };
  // "(Blank)" is the pbix slicer's own label for the blank group; it means
  // `ha IS NULL`, not `ha = '(Blank)'`. Several picks are OR-ed (haArea).
  const picks = haAreaPicks(f);
  if (picks.length > 0) out.haArea = picks;
  const subcos = filterValues(f.subco);
  if (subcos?.length === 1) out.subContractor = subcos[0];
  else if (subcos) out.subContractors = subcos;
  const wtypes = filterValues(f.wtype);
  if (wtypes) out.weldTypes = wtypes;
  const wcats = filterValues(f.wcat);
  if (wcats) out.weldCats = wcats;
  return out;
}

/**
 * Distinct slicer values, ordered by joint count descending, blanks excluded.
 *
 * Memoised for the life of the process: these are dimension values over a
 * static load, and re-deriving them costs a `mv_joint` scan per page render.
 */
let filterOptionsCache: Promise<Record<string, string[]>> | null = null;

export function resetFilterOptionsCache(): void {
  filterOptionsCache = null;
  areaByHaCache = null;
}

/**
 * `area` options grouped by their `ha` — the pbix two-field slicer
 * "HA, Area Classification".
 *
 * The lists come from **`ref_ha_area`** (`sources/HA.csv`, 41 pairs), not from
 * the observed cross-tab in `mv_joint`. The file is the report's own hierarchy;
 * the cross-tab can only show pairings our data happens to contain and would
 * silently drop any the report offers but we have no joints for.
 *
 * The mapping is MANY-TO-MANY — `Train-9 Process` sits under both HA2 and HA3,
 * `Train-10 Process` under HA3 and HA4 — which no single-valued `ha` column can
 * express. So a pair may be selectable and yield **zero joints** under our
 * derived `ha` (HA3 ▸ Train-9 Process is exactly that). That is deliberate: the
 * report offers the combination, so the page must too, and an honest zero is a
 * truer answer than an option quietly withheld.
 *
 * Key `""` is the blank-HA group and stays DATA-driven — the file has no row
 * for it, and what it should contain is precisely "areas we could not resolve".
 *
 * Memoised with the flat lists.
 */
let areaByHaCache: Promise<Record<string, string[]>> | null = null;

export async function areaOptionsByHa(): Promise<Record<string, string[]>> {
  areaByHaCache ??= (async () => {
    const out: Record<string, string[]> = {};
    try {
      // The file's own lists, ordered by how many joints each area actually has
      // so the busiest sit first, then alphabetically for the empty ones.
      const rows = await query<{ ha: string; lbl: string }>(
        // Aliases are two letters on purpose: a single-letter alias collides
        // with ordinary TypeScript (`agg.sql`, `arg.key`) in the column-contract
        // test's regex scan.
        `SELECT hg.ha, hg.area_classification AS lbl\n` +
          `  FROM ref_ha_area hg\n` +
          `  LEFT JOIN mv_joint mj\n` +
          `    ON mj.area_classification_label = hg.area_classification\n` +
          ` GROUP BY hg.ha, hg.area_classification\n` +
          ` ORDER BY hg.ha, count(mj.joint_id) DESC, hg.area_classification`,
      );
      for (const r of rows as { ha: string; lbl: string }[]) {
        (out[r.ha] ??= []).push(r.lbl);
      }
    } catch {
      // Guide not loaded yet — fall through to the data-driven groups only.
    }
    try {
      const p = new Params();
      const blanks = await query<{ lbl: string }>(
        `SELECT w.area_classification_label AS lbl\n` +
          `  FROM ${JOINT_FROM}\n` +
          ` WHERE ${scopeWhere({ sources: SOURCES_PR_ALL_LOADED }, p)}\n` +
          `   AND w.ha IS NULL\n` +
          `   AND w.area_classification_label IS NOT NULL\n` +
          `   AND btrim(w.area_classification_label) <> ''\n` +
          ` GROUP BY 1 ORDER BY count(*) DESC, 1`,
        p.list(),
      );
      out[""] = (blanks as { lbl: string }[]).map((r) => r.lbl);
    } catch {
      out[""] ??= [];
    }
    return out;
  })();
  return areaByHaCache;
}

export async function filterOptions(): Promise<Record<string, string[]>> {
  filterOptionsCache ??= (async () => {
    // `area_classification_label`, not `area_classification`: the raw column is
    // NULL on 85 % of rows (5,587,627 of 6,546,242) and offers six numeric
    // codes, so a slicer on it would filter almost nothing. The label column is
    // populated everywhere and falls back to the raw code where no label
    // exists, so it is a strict superset and reads as the pbix's own values.
    const cols = {
      ha: "ha",
      area: "area_classification_label",
      subco: "sub_contractor",
      wtype: "weld_type",
      wcat: "weld_cat",
    };
    const out: Record<string, string[]> = {
      ha: [], area: [], subco: [], wtype: [], wcat: [],
    };
    for (const [key, col] of Object.entries(cols)) {
      try {
        const p = new Params();
        // `area` offers the union of the data's labels and the guide's, so a
        // label the report knows about stays selectable even with no joints.
        // The guide rows sort last (count 0) but keep their own order.
        const guide =
          key === "area"
            ? `  UNION ALL\n` +
              `  SELECT area_classification AS v, 0 AS n FROM ref_ha_area\n`
            : "";
        const rows = await query<{ v: string }>(
          `SELECT v FROM (\n` +
            `  SELECT ${col} AS v, count(*) AS n FROM ${JOINT_FROM}\n` +
            `   WHERE ${scopeWhere({ sources: SOURCES_PR_ALL_LOADED }, p)}\n` +
            `     AND ${col} IS NOT NULL AND btrim(${col}) <> ''\n` +
            `   GROUP BY 1\n` +
            guide +
            `) t GROUP BY v ORDER BY max(n) DESC, v`,
          p.list(),
        );
        out[key] = rows.map((r: { v: string }) => r.v);
      } catch {
        out[key] = [];
      }
    }
    return out;
  })();
  return filterOptionsCache;
}
