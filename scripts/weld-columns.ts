/**
 * The column contract shared by the schema generator, the loader and the
 * verification script.
 *
 * Single source of truth: `analysis/dump/columns.json` (226 entries, produced by
 * `analysis/dump/profile.py`).  The `pgName()` function below is a line-by-line
 * port of `profile.py::pgname`, so the names it produces are byte-identical to
 * the "pg column name" column of `analysis/dump/profile.md` §8.1 — that table is
 * the contract with the metrics lane.  `scripts/check-sql-columns.ts` re-parses
 * profile.md §8.1 and fails if the two ever diverge.
 *
 * Nothing in this module touches the database or the filesystem beyond reading
 * that one JSON file.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

/** Repo root. Every entry point is invoked from there (npm scripts, node …). */
export const REPO_ROOT = process.cwd();

export const COLUMNS_JSON = path.join(REPO_ROOT, "analysis", "dump", "columns.json");

/** Shape of one entry in analysis/dump/columns.json (only the fields we use). */
interface ProfileColumn {
  index: number;
  raw_name: string;
  clean_name: string;
  present_in_data: boolean;
  inferred_type: string;
  num_int_digits: number | null;
  num_scale: number | null;
  top_values: [string, number][];
  null_token_counts: [string, number][];
}

/** How the loader has to cast a staged text field into the typed `weld` table. */
export type CastKind = "text" | "date" | "int" | "numeric" | "boolean";

export interface WeldColumn {
  /** 1-based field position in the dump record (1..223). */
  index: number;
  /** Header name after .strip(). */
  cleanName: string;
  /** Postgres identifier — the contract name from profile.md §8.1. */
  pgName: string;
  /** Postgres type for the typed `weld` table. */
  pgType: string;
  /** Which cast helper the loader applies. */
  cast: CastKind;
  /** True when the column is empty in all 1,001,114 records (profile §8.3). */
  allEmpty: boolean;
}

/** profile.py::pgname, ported verbatim. */
export function pgName(cleanName: string): string {
  let s = cleanName.trim().toLowerCase();
  s = s.split("%").join("_pct").split("/").join("_").split(".").join("");
  s = s.replace(/[^a-z0-9]+/g, "_").replace(/^_+/, "").replace(/_+$/, "");
  if (s.length > 0 && s[0] >= "0" && s[0] <= "9") s = `c_${s}`;
  return s.length > 0 ? s : "unnamed";
}

function readProfile(): ProfileColumn[] {
  return JSON.parse(readFileSync(COLUMNS_JSON, "utf8")) as ProfileColumn[];
}

/** profile.py's §8.1 type mapping, ported verbatim (minus the markdown notes). */
function pgTypeOf(c: ProfileColumn): { pgType: string; cast: CastKind } {
  switch (c.inferred_type) {
    case "date":
      return { pgType: "date", cast: "date" };
    case "int": {
      const d = c.num_int_digits ?? 1;
      return { pgType: d <= 9 ? "integer" : "bigint", cast: "int" };
    }
    case "decimal": {
      const scale = c.num_scale ?? 0;
      const precision = Math.max((c.num_int_digits ?? 1) + scale, 1);
      return { pgType: `numeric(${precision},${scale})`, cast: "numeric" };
    }
    case "flag": {
      const vs = new Set(c.top_values.map(([v]) => v.trim().toUpperCase()));
      const onlyYN = [...vs].every((v) => v === "Y" || v === "N");
      return onlyYN
        ? { pgType: "boolean", cast: "boolean" }
        : { pgType: "text", cast: "text" };
    }
    default:
      // "text" and "empty" both land on text.
      return { pgType: "text", cast: "text" };
  }
}

let cached: WeldColumn[] | null = null;

/** The 223 data columns, in dump field order. Header names 224-226 are dropped. */
export function sourceColumns(): WeldColumn[] {
  if (cached) return cached;
  const seen = new Map<string, number>();
  cached = readProfile()
    .filter((c) => c.present_in_data)
    .map((c) => {
      const { pgType, cast } = pgTypeOf(c);
      let n = pgName(c.clean_name);
      const count = (seen.get(n) ?? 0) + 1;
      seen.set(n, count);
      if (count > 1) n = `${n}_${count}`; // profile.py's de-duplication rule
      return {
        index: c.index,
        cleanName: c.clean_name,
        pgName: n,
        pgType,
        cast,
        allEmpty: c.inferred_type === "empty",
      };
    });
  return cached;
}

/** The 29 columns that are empty in every record — kept in staging, dropped from `weld`. */
export function emptyColumns(): WeldColumn[] {
  return sourceColumns().filter((c) => c.allEmpty);
}

/** The 194 source columns that make it into the typed `weld` table. */
export function weldSourceColumns(): WeldColumn[] {
  return sourceColumns().filter((c) => !c.allEmpty);
}

export function byName(name: string): WeldColumn {
  const c = sourceColumns().find((x) => x.pgName === name);
  if (!c) throw new Error(`no dump column named ${name}`);
  return c;
}

/**
 * Columns the Power Query `Weld Dump` step-list ADDS but the dump does not carry.
 * They exist so a later CCC / Acciona / Inco union has somewhere to land, and so
 * `service_class_cat_ndt` can reference `ndt_remarks` the way the DAX does.
 * (analysis/pbix/model.md → Weld Dump → #"Added Custom1".."Added Custom8")
 */
export const M_PLACEHOLDER_COLUMNS: { name: string; type: string; comment: string }[] = [
  { name: "rt_ut", type: "text", comment: "M placeholder, '' for WELD_DUMP rows" },
  { name: "ndt_remarks", type: "text", comment: "M placeholder; feeds service_class_cat_ndt" },
  { name: "tracer_shot", type: "text", comment: "M placeholder" },
  { name: "weld_point_code", type: "text", comment: "M placeholder; R/H/F/C on CCC rows (M23)" },
  { name: "original_joint", type: "text", comment: "M placeholder" },
  { name: "repair_suffix", type: "text", comment: "M placeholder; drives repair_reweld on CCC rows" },
  { name: "pwht_y_n_ccc", type: "text", comment: "AllTrain joint record (M61); NULL for WELD_DUMP" },
  { name: "pwht_report_no_ccc", type: "text", comment: "AllTrain joint record (M61/M65)" },
  { name: "pwht_date_no_ccc", type: "date", comment: "AllTrain joint record" },
  { name: "spool_status", type: "text", comment: "from spool.fabricated etc. (R-01: no Spool Dump yet)" },
  { name: "ha", type: "text", comment: "§6.2 lists it; a 'PR all' column, absent from the dump" },
];
