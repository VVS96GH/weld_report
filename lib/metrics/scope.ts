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
 * page must disclose that ACCIONA/INCO are missing rather than implying the
 * union is complete.
 */
export const SOURCES_PR_ALL_LOADED = [
  "WELD_DUMP",
  "CCC_WELDER_RECORD",
  "CCC_JOINT_RECORD",
] as const;

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

/** §0.6 — the 16-code RT hold list, `"EP"`/`"WD"` flavour. Verbatim, unsorted. */
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

/** `"PR all"` flavour = the `"EP"` list + `'T1-2'`. */
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

/** `"PR all"` flavour = the `"EP"` list + `'T1-2'` + `'HS CCC'`. */
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
  /** `SC NOT IN {…}` — the project pages all carry `NOT IN {Inco}`. */
  excludeSubContractors?: readonly string[];
  /** R-09 slug-catcher split: `service_cat = 'SG'` vs `IS DISTINCT FROM 'SG'`. */
  serviceCat?: ServiceCatScope;
  /** `RT%` slicer value (5/10/20/30/100). */
  rtPct?: number;
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
  /** `Dia Inch Factor = 'Y'` (the BW/CLET dia-inch weighting flag). */
  diaInchFactorY?: boolean;
  /** `WPS No. <> ""`. */
  wpsPresent?: boolean;
  /**
   * `PWHT Weld Status` is not blank — the extra table filter the PWHT-by-RT%
   * pages carry (§3.3 "as 19 + `PWHT Weld Status` not blank").
   */
  pwhtStatusPresent?: boolean;
  /** §0.3 source discriminator; defaults to the `"EP"` scope. */
  sources?: readonly string[];
  /**
   * `Area Classification` as text — the pbix `"PR all"` vocabulary (22 values:
   * the dump's 7-digit codes plus CCC's `Train-8 Process` style names). Group
   * and slice on this, never on the integer `area_classification`, which is
   * NULL for every CCC row.
   */
  areaClassificationLabel?: string;
};

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
  if (scope.rtPct !== undefined) {
    c.push(`${a}.rt_pct = ${p.add(scope.rtPct)}`);
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
  if (scope.tmcpPipe !== undefined) {
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
  if (scope.pwhtStatusPresent) {
    c.push(`${a}.pwht_weld_status IS NOT NULL`);
  }
  if (scope.areaClassificationLabel !== undefined) {
    c.push(`${a}.area_classification_label = ${p.add(scope.areaClassificationLabel)}`);
  }
  return c;
}

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
  const age = `(${asOfParam}::date - ${alias}.weld_date)`;
  const parts: string[] = [`${alias}.weld_date IS NOT NULL`];
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
  const from = opts.from ?? "weld w";
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
