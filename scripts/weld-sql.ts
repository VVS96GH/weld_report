/**
 * DDL + load SQL for the `Weld Dump` source, generated from the column contract
 * in `scripts/weld-columns.ts` so that the committed migrations and the loader's
 * INSERT…SELECT can never drift apart.
 *
 * Every transform below is traced to either
 *   - analysis/pbix/model.md   → Power Query → `Weld Dump` (load-time M steps), or
 *   - analysis/pbix/measures.md → calculated columns on `Weld Dump` /
 *     `Project WD+WR+INCO+Acciona`, or
 *   - analysis/calculation-logic.md §0.4 / §0.5.
 */

import {
  M_PLACEHOLDER_COLUMNS,
  emptyColumns,
  sourceColumns,
  weldSourceColumns,
  type WeldColumn,
} from "./weld-columns";

/** R-04: `PWHT Y/N` = '25.01' on 580,860 rows; the DAX counts it as BOTH Y and N. */
export const PWHT_AMBIGUOUS_TOKEN = "25.01";

/** Weld Dates the M query throws away (source-system garbage), §0.4 step 12. */
export const DROPPED_WELD_DATES = ["2026-12-30", "2026-08-29", "2026-08-30"];

/**
 * Tokens that LOOK like nulls but are KEPT AS LITERAL TEXT.
 *
 * The pbix does not null them.  Its M code replaces "NA" with "" in exactly six
 * columns (below) and nowhere else, and the DAX then relies on the literals
 * surviving: `RT Weld Status IN {"?","","S"}` matches a literal '?', and
 * `RT Report <> ""` counts a literal 'NA' as tested.  Nulling them globally cost
 * 2 GAC + 2 TEKFEN joints on M10 against the reference numbers.
 *
 * The dry run still reports their per-column counts — they are worth watching —
 * but under the heading "literal tokens kept", not "null tokens".
 */
export const LITERAL_TOKENS = ["NA", "N/A", "?", "#N/A"];

/**
 * The ONLY columns where the M blanks "NA" (model.md lines 3661-3666,
 * #"Replaced Value NA" … #"Replaced Value NA Mir").  All six are date-typed, and
 * weld_to_date() already returns NULL for anything that is not dd-MMM-yyyy, so the
 * replace() below is behaviourally a no-op — it is emitted anyway so the M step
 * list is fully represented in the generated SQL.  It is safe: no month
 * abbreviation contains the substring "NA".
 */
export const M_NA_BLANKED_COLUMNS = [
  "preheat_date", "weld_date", "cutting_date", "beveling_date", "fitup_date", "mir_date",
];

const STG_TABLE = "stg_weld_dump";

/** Bookkeeping columns prepended to every staged record. */
export const STAGING_BOOKKEEPING = ["load_id", "line_no"];

/**
 * Per-column M transforms applied to the STAGED TEXT before the type cast.
 * `$` is the staged text expression for that column.
 */
const TEXT_TRANSFORMS: Record<string, (col: string) => string> = {
  // #"Replaced BW_ to BW" / #"Replaced SW_ to SW"  (Replacer.ReplaceText = substring)
  weld_type: (c) => `replace(replace(${c}, 'BW_', 'BW'), 'SW_', 'SW')`,
  // #"Replaced T1-2 to T1"
  rt_weld_status: (c) => `replace(${c}, 'T1-2', 'T1')`,
  // #"Replaced ACCEPT to A" / #"Replaced ACEEPT to A" / #"Replaced REJECT to R"
  manual_ut_status: (c) =>
    `replace(replace(replace(${c}, 'ACCEPT', 'A'), 'ACEEPT', 'A'), 'REJECT', 'R')`,
  // #"Replaced Result (A/R)"
  result_a_r: (c) => `replace(${c}, 'ACCEPT', 'A')`,
  // #"Replaced ""-"" to"   (removes every hyphen, ReplaceText semantics)
  ut_operator_id: (c) => `replace(${c}, '-', '')`,
  // #"Check Date 1" + #"Replaced Value".."Replaced Value5" (Excel serials typed by hand)
  checked_date: (c) =>
    `replace(replace(replace(replace(replace(replace(replace(${c}, '/', '-'),` +
    ` '45455', '12-Jun-2024'), '45433', '21-May-2024'), '45432', '20-May-2024'),` +
    ` '45441', '29-May-2024'), '45442', '30-May-2024'), '45456', '13-Jun-2024')`,
  // #"Replaced Value NA" .. #"Replaced Value NA Mir" — the six columns, and only
  // these six, where the M blanks the literal "NA".
  weld_date: (c) => `replace(${c}, 'NA', '')`,
  mir_date: (c) => `replace(${c}, 'NA', '')`,
  // #"Replaced Value6".."Replaced Value12"
  testpack_sub_contractor: (c) =>
    `replace(replace(replace(replace(${c}, 'GAC,GAC,GAC', 'GAC'), 'GAC,GAC', 'GAC'),` +
    ` 'MEDGULF,MEDGULF', 'MEDGULF'), 'TEKFEN,TEKFEN', 'TEKFEN')`,
};

/**
 * Columns whose value is REPLACED wholesale by an M step, expressed over the
 * staging row `s`.  These bypass the normal cast entirely.
 */
const VALUE_OVERRIDES: Record<string, string> = {
  // #"Removed HT Remarks" + #"Added HT Remarks":
  //   each if Text.Contains([RT Report], "PAUT") then "PAUT" else null
  // Text.Contains is case-SENSITIVE in M, so LIKE (not ILIKE).
  ht_remarks: `CASE WHEN s.rt_report LIKE '%PAUT%' THEN 'PAUT' END`,
  // #"9/5/0202 to null …" — three columns carry a year-0202 typo date.
  // The inner replace() is the M's "NA" -> "" step for these columns.
  fitup_date: `nullif(weld_to_date(replace(s.fitup_date, 'NA', '')), DATE '0202-09-05')`,
  cutting_date: `nullif(weld_to_date(replace(s.cutting_date, 'NA', '')), DATE '0202-09-05')`,
  beveling_date: `nullif(weld_to_date(replace(s.beveling_date, 'NA', '')), DATE '0202-09-05')`,
  // #"8/3/0202 to null Preheat Date" + #"10/11/0202 to null Preheat Date"
  preheat_date:
    `nullif(nullif(weld_to_date(replace(s.preheat_date, 'NA', '')), DATE '0202-08-03'),` +
    ` DATE '0202-10-11')`,
};

function castExpr(col: WeldColumn): string {
  const override = VALUE_OVERRIDES[col.pgName];
  if (override) return override;
  const transform = TEXT_TRANSFORMS[col.pgName];
  const raw = transform ? transform(`s.${col.pgName}`) : `s.${col.pgName}`;
  switch (col.cast) {
    case "date":
      return `weld_to_date(${raw})`;
    case "int":
      return `weld_to_int(${raw})::${col.pgType}`;
    case "numeric":
      return `weld_to_numeric(${raw})::${col.pgType}`;
    case "boolean":
      return `weld_to_bool(${raw})`;
    default:
      return `weld_text(${raw})`;
  }
}

export interface DerivedColumn {
  name: string;
  type: string;
  /** Column constraints appended in the DDL (e.g. NOT NULL DEFAULT false). */
  ddlSuffix: string;
  /** SQL over the staging alias `s`; null for GENERATED columns (computed by PG). */
  expr: string | null;
  /** The DAX / M object this reproduces. */
  dax: string;
  comment: string;
}

/**
 * The derived columns of §6.2, each a faithful translation of a DAX calculated
 * column or an M "Added Custom" step.
 *
 * NOTE on the raw-vs-clean choice: `joint_id` / `spool_id` concatenate the RAW
 * staged text, because Power Query concatenates the untrimmed CSV values.  All
 * five components (`ISO Number`, `Spool No.`, `Weld No.`) have zero values with
 * leading/trailing whitespace in this dump (profile.md §8.3), so raw == clean
 * here; using raw keeps it true if that ever changes.
 */
export const DERIVED_COLUMNS: DerivedColumn[] = [
  {
    name: "joint_id",
    type: "text",
    ddlSuffix: "NOT NULL",
    expr: `s.iso_number || '-' || s.spool_no || '-' || s.weld_no`,
    dax: 'M step #"JOINT ID"',
    comment: `[ISO Number]&"-"&[Spool No.]&"-"&[Weld No.]`,
  },
  {
    name: "spool_id",
    type: "text",
    ddlSuffix: "NOT NULL",
    expr: `s.iso_number || '-' || s.spool_no`,
    dax: 'M step #"Added Custom"',
    comment: `[ISO Number]&"-"&[Spool No.]`,
  },
  {
    name: "repair_reweld",
    type: "text",
    ddlSuffix: "NOT NULL DEFAULT ''",
    expr:
      `CASE upper(right(btrim(s.weld_no), 2))` +
      ` WHEN 'R1' THEN 'Repair' WHEN 'R2' THEN 'Repair' WHEN 'RW' THEN 'Reweld' ELSE '' END`,
    dax: "Weld Dump[Repair & Reweld]",
    comment: `right([Weld No.],2) in R1/R2 -> 'Repair', RW -> 'Reweld', else ''`,
  },
  {
    name: "service_class_cat_wd",
    type: "text",
    ddlSuffix: "",
    expr: `concat(weld_text(s.service_class), ' ', weld_text(s.service_cat))`,
    dax: 'Weld Dump[Service Class+Service Cat "WD"]',
    comment: `[Service class]&" "&[Service Cat]  (DAX & renders blank as '')`,
  },
  {
    name: "service_class_cat_ndt",
    type: "text",
    ddlSuffix: "",
    // [NDT Remarks] is an M placeholder that is always "" for Weld Dump rows,
    // hence the doubled space; reproduced verbatim so the key matches CCC rows.
    expr:
      `concat(weld_text(s.service_class), ' ', weld_text(s.service_cat), ' ', '', ' ',` +
      ` weld_to_int(s.rt_pct))`,
    dax: "Project WD+WR+INCO+Acciona[Service Class + Service Cat+NDT Remarks]",
    comment: `[Service class]&" "&[Service Cat]&" "&[NDT Remarks]&" "&[RT%]`,
  },
  {
    name: "temporary_lines",
    type: "boolean",
    ddlSuffix: "NOT NULL DEFAULT false",
    expr: `coalesce(upper(right(s.iso_number, 4)) = '-PCC', false)`,
    dax: 'Weld Dump[Temporary Lines "WD"]',
    comment: `RIGHT([ISO Number],4)="-PCC" -> "Temporary Lines"`,
  },
  {
    name: "tmcp_pipe",
    type: "boolean",
    ddlSuffix: "NOT NULL DEFAULT false",
    expr: `coalesce(weld_text(s.service_class) = '9C3AQN' AND weld_to_numeric(s.dia_inch) = 46, false)`,
    dax: "Weld Dump[TMCP Pipe]",
    comment: `[Service class]="9C3AQN" && [Dia inch]=46  (the "PR all" twin uses 30/34/46)`,
  },
  {
    name: "exclude_ut_films",
    type: "boolean",
    ddlSuffix: "NOT NULL DEFAULT false",
    // CONTAINSSTRING (DAX) is case-INsensitive -> ILIKE.
    expr:
      `coalesce(weld_to_bool(s.by_ut) IS TRUE` +
      ` AND btrim(s.sub_contractor) <> 'Inco'` +
      ` AND s.rt_report ILIKE '%UT%'` +
      ` AND (coalesce(weld_to_int(s.total_no_of_films_rej), 0) > 0` +
      ` OR coalesce(weld_to_int(s.total_no_of_films_acc), 0)` +
      ` + coalesce(weld_to_int(s.total_no_of_films_rej), 0) > 0), false)`,
    dax: "Project WD+WR+INCO+Acciona[Exlude RT Films from UT]",
    comment: `[By UT]="Y" && Sub<>"Inco" && RT Report contains "UT" && (films Rej>0 || RT Film Total>0)`,
  },
  {
    name: "exclude_debris_films",
    type: "boolean",
    ddlSuffix: "NOT NULL DEFAULT false",
    expr:
      `coalesce(weld_text(s.rt_re_shoot_status) = 'Full Cut'` +
      ` AND s.rt_re_shoot_reason ILIKE '%Debris%'` +
      ` AND weld_text(s.defect_code) = 'XX', false)`,
    dax: "Project WD+WR+INCO+Acciona[Exlude Full Cut & Debris]",
    comment: `[RT Re-Shoot Status]="Full Cut" && Reason contains "Debris" && [Defect Code]="XX"`,
  },
];

/** Columns Postgres computes itself; the loader never writes them. */
export const GENERATED_COLUMNS: { name: string; type: string; expr: string; dax: string }[] = [
  {
    name: "rt_film_total",
    type: "integer",
    expr: "coalesce(total_no_of_films_acc, 0) + coalesce(total_no_of_films_rej, 0)",
    dax: 'M step #"Added RT Film Total" / Weld Dump[Total No Films A+R]',
  },
  {
    name: "is_cancelled",
    type: "boolean",
    // coalesce(), not `= 'Cancelled'`: revision_status is NULL for every row that
    // survives the load filter, and a NULL here would poison `WHERE NOT is_cancelled`.
    expr: "coalesce(revision_status, '') = 'Cancelled'",
    dax: "column Revision Status (ruling R-02)",
  },
];

// --------------------------------------------------------------------- DDL ---

function pad(name: string, width = 34): string {
  return name.length >= width ? `${name} ` : name + " ".repeat(width - name.length);
}

export function buildStagingDdl(): string {
  const cols = sourceColumns();
  const lines: string[] = [];
  lines.push(`-- GENERATED by scripts/gen-schema-columns.ts — DO NOT EDIT BY HAND.`);
  lines.push(`-- Regenerate with:  node --import tsx scripts/gen-schema-columns.ts`);
  lines.push(`--`);
  lines.push(`-- Staging table: all ${cols.length} data fields of \`sources/Weld Dump.txt\` as text,`);
  lines.push(`-- named per analysis/dump/profile.md §8.1 "pg column name".  The 3 surplus header`);
  lines.push(`-- names (BHS, PIP-124-A, WHS) carry no data field and are NOT created.`);
  lines.push(`-- Nothing is trimmed or nulled here; the cast happens in the INSERT into \`weld\`.`);
  lines.push(`--`);
  lines.push(`-- UNLOGGED and index-free on purpose: staging is disposable, and skipping WAL`);
  lines.push(`-- plus index maintenance is most of the difference between a 40 s and a 4 min COPY.`);
  lines.push(``);
  lines.push(`CREATE UNLOGGED TABLE IF NOT EXISTS ${STG_TABLE} (`);
  // No FK to load(id) and no index: an FK check would cost 1M index probes during
  // COPY, and staging is deleted per source before every load anyway.
  lines.push(`  ${pad("load_id")}bigint NOT NULL,  -- load.id (no FK: keeps COPY index-free)`);
  lines.push(`  ${pad("line_no")}bigint NOT NULL,  -- logical record number, 1-based`);
  for (const c of cols) {
    lines.push(`  ${pad(c.pgName)}text,  -- #${c.index} ${c.cleanName}`);
  }
  // trailing comma of the last generated column line
  lines[lines.length - 1] = lines[lines.length - 1].replace(/,(\s*--.*)$/, "$1");
  lines.push(`);`);
  lines.push(``);
  lines.push(
    `-- Append-and-discard: the loader deletes this source's rows at the start of every load.`,
  );
  lines.push(
    `ALTER TABLE ${STG_TABLE} SET (autovacuum_enabled = off, toast.autovacuum_enabled = off);`,
  );
  lines.push(``);
  return lines.join("\n");
}

export function buildWeldDdl(): string {
  const cols = weldSourceColumns();
  const dropped = emptyColumns();
  const lines: string[] = [];
  lines.push(`-- GENERATED by scripts/gen-schema-columns.ts — DO NOT EDIT BY HAND.`);
  lines.push(`-- Regenerate with:  node --import tsx scripts/gen-schema-columns.ts`);
  lines.push(`--`);
  lines.push(`-- The normalised fact table (analysis/calculation-logic.md §6.2).`);
  lines.push(`-- One row per weld record, cancelled rows EXCLUDED at load (ruling R-02).`);
  lines.push(`--`);
  lines.push(`-- ${cols.length} typed source columns = 223 dump fields - ${dropped.length} that are empty in`);
  lines.push(`-- every one of the 1,001,114 records (profile.md §8.3).  Dropped here, still`);
  lines.push(`-- present in stg_weld_dump for audit:`);
  for (let i = 0; i < dropped.length; i += 4) {
    lines.push(`--   ${dropped.slice(i, i + 4).map((c) => c.pgName).join(", ")}`);
  }
  lines.push(`--`);
  lines.push(`-- Types are analysis/dump/profile.md §8.1 verbatim.  Column NAMES are the`);
  lines.push(`-- contract shared with the metrics lane — do not rename.`);
  lines.push(``);
  lines.push(`CREATE TABLE IF NOT EXISTS weld (`);
  lines.push(`  ${pad("id")}bigserial PRIMARY KEY,`);
  lines.push(`  ${pad("source")}weld_source NOT NULL,`);
  lines.push(`  ${pad("load_id")}bigint NOT NULL REFERENCES load(id) ON DELETE CASCADE,`);
  lines.push(``);
  lines.push(`  -- derived identity (M "Added Custom" / "JOINT ID" steps)`);
  for (const d of DERIVED_COLUMNS.filter((x) => x.name === "joint_id" || x.name === "spool_id")) {
    lines.push(`  ${pad(d.name)}${d.type} ${d.ddlSuffix},  -- ${d.dax}`);
  }
  lines.push(``);
  lines.push(`  -- the ${cols.length} typed dump columns, in dump field order`);
  for (const c of cols) {
    lines.push(`  ${pad(c.pgName)}${c.pgType},  -- #${c.index} ${c.cleanName}`);
  }
  lines.push(``);
  lines.push(`  -- columns the Power Query step-list adds but the dump does not carry`);
  for (const p of M_PLACEHOLDER_COLUMNS) {
    lines.push(`  ${pad(p.name)}${p.type},  -- ${p.comment}`);
  }
  lines.push(``);
  lines.push(`  -- DAX calculated columns, materialised (§6.2)`);
  for (const d of DERIVED_COLUMNS.filter((x) => x.name !== "joint_id" && x.name !== "spool_id")) {
    const suffix = d.ddlSuffix ? ` ${d.ddlSuffix}` : "";
    lines.push(`  ${pad(d.name)}${d.type}${suffix},  -- ${d.dax}`);
  }
  lines.push(``);
  lines.push(`  -- computed by Postgres, never written by the loader`);
  for (const g of GENERATED_COLUMNS) {
    lines.push(`  ${pad(g.name)}${g.type} GENERATED ALWAYS AS (${g.expr}) STORED,  -- ${g.dax}`);
  }
  // strip the trailing comma of the last column line
  const last = lines.length - 1;
  lines[last] = lines[last].replace(/,(\s*--.*)$/, "$1");
  lines.push(`);`);
  lines.push(``);
  lines.push(indexDdl());
  return lines.join("\n");
}

function indexDdl(): string {
  return `-- Indexes per §6.2.  NO unique constraint on (iso_number, spool_no, weld_no,
-- weldpoint_no): it is the best natural key but still has 3,847 duplicated keys
-- over 7,776 rows with 0 duplicate whole rows (profile.md §2).
CREATE INDEX IF NOT EXISTS weld_load          ON weld (load_id);
CREATE INDEX IF NOT EXISTS weld_source_idx    ON weld (source);
CREATE INDEX IF NOT EXISTS weld_sub_date      ON weld (sub_contractor, weld_date);
CREATE INDEX IF NOT EXISTS weld_joint         ON weld (joint_id);
CREATE INDEX IF NOT EXISTS weld_spool         ON weld (spool_id);
CREATE INDEX IF NOT EXISTS weld_rtpct_sub     ON weld (rt_pct, sub_contractor) INCLUDE (weld_cat, weld_type);
CREATE INDEX IF NOT EXISTS weld_svcclass      ON weld (service_class_cat_ndt);
CREATE INDEX IF NOT EXISTS weld_wps           ON weld (wps_no);
CREATE INDEX IF NOT EXISTS weld_weld_date     ON weld (weld_date);
CREATE INDEX IF NOT EXISTS weld_rt_backlog    ON weld (sub_contractor, rt_pct)
       WHERE rt_report IS NULL AND weld_date IS NOT NULL
         AND weld_type IN ('BW','GW','CLET','MW');
CREATE INDEX IF NOT EXISTS weld_pwht_backlog  ON weld (sub_contractor)
       WHERE pwht_report IS NULL AND pwht_weld_status IS NOT NULL;
`;
}

// -------------------------------------------------------------------- load ---

/** Column list for `COPY stg_weld_dump (...) FROM STDIN`, in staged field order. */
export function copyColumns(): string[] {
  return [...STAGING_BOOKKEEPING, ...sourceColumns().map((c) => c.pgName)];
}

/** Column list the loader writes into `weld` (generated columns excluded). */
export function weldInsertColumns(): string[] {
  return [
    "source",
    "load_id",
    ...DERIVED_COLUMNS.filter((d) => d.name === "joint_id" || d.name === "spool_id").map((d) => d.name),
    ...weldSourceColumns().map((c) => c.pgName),
    ...DERIVED_COLUMNS.filter((d) => d.name !== "joint_id" && d.name !== "spool_id").map((d) => d.name),
  ];
}

/**
 * `INSERT INTO weld … SELECT … FROM stg_weld_dump s WHERE <M filters>`.
 * $1 = load_id, $2 = source (weld_source).
 */
export function buildWeldInsert(): string {
  const idCols = DERIVED_COLUMNS.filter((d) => d.name === "joint_id" || d.name === "spool_id");
  const otherDerived = DERIVED_COLUMNS.filter(
    (d) => d.name !== "joint_id" && d.name !== "spool_id",
  );
  const selects: string[] = [
    `$2::weld_source AS source`,
    `s.load_id`,
    ...idCols.map((d) => `${d.expr} AS ${d.name}`),
    ...weldSourceColumns().map((c) => `${castExpr(c)} AS ${c.pgName}`),
    ...otherDerived.map((d) => `${d.expr} AS ${d.name}`),
  ];
  return [
    `INSERT INTO weld (`,
    `  ${weldInsertColumns().join(",\n  ")}`,
    `)`,
    `SELECT`,
    `  ${selects.join(",\n  ")}`,
    `FROM stg_weld_dump s`,
    `WHERE s.load_id = $1`,
    `  ${loadFilterSql()}`,
  ].join("\n");
}

/**
 * The Power Query `Weld Dump` row filters, §0.4 steps 4-6 and 12.
 * Expressed over the staging alias `s` (raw text).
 */
export function loadFilterSql(): string {
  return [
    `-- #"Exlude Area Class ""0""" (applied twice in the M; idempotent)`,
    `  AND btrim(s.area_classification) NOT IN ('', '0')`,
    `-- #"Revision Status": keep [Revision Status] = ""  (ruling R-02, cancelled welds out)`,
    `  AND btrim(s.revision_status) = ''`,
    `-- #"Filtered Rows1 Subcon"`,
    `  AND btrim(s.sub_contractor) <> ''`,
    `-- #"Exlude after 28 Aug" — M compares a typed date, so NULL weld dates are kept`,
    `  AND (weld_to_date(s.weld_date) IS NULL`,
    `       OR weld_to_date(s.weld_date) NOT IN (${DROPPED_WELD_DATES.map((d) => `DATE '${d}'`).join(", ")}))`,
  ].join("\n  ");
}

/** Rows the load filter throws away, per reason — for the `load` bookkeeping row. */
export function buildRejectCountsSql(): string {
  return `SELECT
  count(*) FILTER (WHERE btrim(s.area_classification) IN ('', '0'))            AS area_class_0_or_blank,
  count(*) FILTER (WHERE btrim(s.area_classification) NOT IN ('', '0')
                     AND btrim(s.revision_status) = 'Cancelled')               AS revision_status_cancelled,
  count(*) FILTER (WHERE btrim(s.area_classification) NOT IN ('', '0')
                     AND btrim(s.revision_status) NOT IN ('', 'Cancelled'))    AS revision_status_other,
  count(*) FILTER (WHERE btrim(s.area_classification) NOT IN ('', '0')
                     AND btrim(s.revision_status) = ''
                     AND btrim(s.sub_contractor) = '')                         AS sub_contractor_blank,
  count(*) FILTER (WHERE btrim(s.area_classification) NOT IN ('', '0')
                     AND btrim(s.revision_status) = ''
                     AND btrim(s.sub_contractor) <> ''
                     AND weld_to_date(s.weld_date) IN (${DROPPED_WELD_DATES.map((d) => `DATE '${d}'`).join(", ")}))
                                                                               AS weld_date_excluded_by_m,
  count(*)                                                                     AS staged
FROM stg_weld_dump s
WHERE s.load_id = $1`;
}
