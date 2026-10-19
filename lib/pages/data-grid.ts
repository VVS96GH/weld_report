/**
 * The Data page (owner, 2026-10-19): the detailed weld table — every row of
 * `weld`, the pbix "Project WD+WR+INCO+Acciona" table — filtered column by
 * column and paged from the server, so the browser only ever holds the rows on
 * screen.
 *
 * State travels in the URL, like every slicer on the site:
 *   f  JSON { column: Filter }   the column filters, AND-ed
 *   c  comma list                the columns shown, in order
 *   s  "column:asc|desc"          the sort (default: load order)
 *
 * Column names come only from GRID_COLUMNS and values only as bound
 * parameters, so nothing from the URL reaches the SQL text.
 */
import { query, queryFresh } from "@/lib/db";
import { GRID_COLUMNS, type GridCol } from "@/lib/data-grid-columns";

export type GridFilter = {
  /** Exact picks; "(Blank)" picks the empty cells. */
  in?: string[];
  /** Contains (case-insensitive). */
  has?: string;
  /** Range, inclusive (numbers and dates). */
  from?: string;
  to?: string;
};
export type GridFilters = Record<string, GridFilter>;
export type GridSort = { key: string; dir: "asc" | "desc" } | null;

export const BLANK = "(Blank)";
export const GRID_PAGE = 200;
/** A CSV export stops here (Excel holds 1,048,576 rows). */
export const EXPORT_MAX = 1_000_000;

const BY_KEY = new Map(GRID_COLUMNS.map((c) => [c.key, c]));
export const gridColumn = (key: string): GridCol | undefined => BY_KEY.get(key);

// ── URL state ──

export function parseFilters(raw: string | null | undefined): GridFilters {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: GridFilters = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
      if (!BY_KEY.has(k) || !v || typeof v !== "object") continue;
      const f = v as Record<string, unknown>;
      const g: GridFilter = {};
      if (Array.isArray(f.in)) g.in = f.in.map(String).slice(0, 5000);
      if (typeof f.has === "string" && f.has.trim()) g.has = f.has.trim();
      if (typeof f.from === "string" && f.from.trim()) g.from = f.from.trim();
      if (typeof f.to === "string" && f.to.trim()) g.to = f.to.trim();
      if (g.in?.length || g.has || g.from || g.to) out[k] = g;
    }
    return out;
  } catch {
    return {};
  }
}

export function parseColumns(raw: string | null | undefined): string[] {
  const keys = (raw ?? "").split(",").map((s) => s.trim()).filter((k) => BY_KEY.has(k));
  // every column unless some are named (the page shows them all by default)
  return keys.length ? [...new Set(keys)] : GRID_COLUMNS.map((c) => c.key);
}

export function parseSort(raw: string | null | undefined): GridSort {
  const [key, dir] = (raw ?? "").split(":");
  if (!key || !BY_KEY.has(key)) return null;
  return { key, dir: dir === "desc" ? "desc" : "asc" };
}

// ── SQL ──

class P {
  list: unknown[] = [];
  add(v: unknown): string {
    this.list.push(v);
    return `$${this.list.length}`;
  }
}

const isNum = (s: string) => s.trim() !== "" && Number.isFinite(Number(s.replace(/,/g, "")));
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());

function cond(col: GridCol, f: GridFilter, p: P): string[] {
  const c = `w.${col.key}`;
  const out: string[] = [];
  if (f.in?.length) {
    const blank = f.in.includes(BLANK);
    let vals = f.in.filter((v) => v !== BLANK);
    let pick = "";
    if (vals.length) {
      if (col.type === "num") {
        vals = vals.filter(isNum).map((v) => v.replace(/,/g, ""));
        pick = vals.length ? `${c} = ANY(${p.add(vals)}::numeric[])` : "false";
      } else if (col.type === "date") {
        vals = vals.filter(isDate);
        pick = vals.length ? `${c} = ANY(${p.add(vals)}::date[])` : "false";
      } else if (col.type === "bool") {
        pick = `${c} = ANY(${p.add(vals.map((v) => v === "Y" || v === "true"))}::boolean[])`;
      } else {
        pick = `${c} = ANY(${p.add(vals)}::text[])`;
      }
    }
    const parts = [pick, blank ? `${c} IS NULL` : ""].filter(Boolean);
    out.push(parts.length ? `(${parts.join(" OR ")})` : "false");
  }
  if (f.has) {
    const like = `%${f.has.replace(/[\\%_]/g, "\\$&")}%`;
    out.push(col.type === "text" ? `${c} ILIKE ${p.add(like)}` : `${c}::text ILIKE ${p.add(like)}`);
  }
  for (const [v, op] of [[f.from, ">="], [f.to, "<="]] as const) {
    if (!v) continue;
    if (col.type === "num" && isNum(v)) out.push(`${c} ${op} ${p.add(v.replace(/,/g, ""))}::numeric`);
    else if (col.type === "date" && isDate(v)) out.push(`${c} ${op} ${p.add(v)}::date`);
    else if (col.type === "text") out.push(`${c} ${op} ${p.add(v)}`);
  }
  return out;
}

function whereOf(filters: GridFilters, p: P, skip?: string): string {
  const parts: string[] = [];
  for (const [k, f] of Object.entries(filters)) {
    if (k === skip) continue;
    const col = BY_KEY.get(k);
    if (col) parts.push(...cond(col, f, p));
  }
  return parts.length ? parts.join("\n   AND ") : "true";
}

/** A column as text: dates YYYY-MM-DD, yes/no columns Y / N (as the pbix shows them). */
function textOf(col: GridCol): string {
  const c = `w.${col.key}`;
  if (col.type === "date") return `to_char(${c}, 'YYYY-MM-DD')`;
  if (col.type === "bool") return `CASE WHEN ${c} THEN 'Y' WHEN NOT ${c} THEN 'N' END`;
  return `${c}::text`;
}

/** The SELECT list: text for every column. */
function selectOf(cols: string[]): string {
  return cols
    .map((k) => {
      const col = BY_KEY.get(k)!;
      return `${textOf(col)} AS "${k}"`;
    })
    .join(", ");
}

const orderOf = (sort: GridSort) => (sort ? `w.${sort.key} ${sort.dir === "desc" ? "DESC" : "ASC"} NULLS LAST, w.id` : "w.id");

/** One page of rows. */
export async function gridRows(
  filters: GridFilters,
  cols: string[],
  sort: GridSort,
  offset: number,
): Promise<{ rows: (string | null)[][]; more: boolean }> {
  const p = new P();
  const where = whereOf(filters, p);
  const sql =
    `SELECT ${selectOf(cols)} FROM weld w WHERE ${where}\n` +
    ` ORDER BY ${orderOf(sort)} LIMIT ${GRID_PAGE + 1} OFFSET ${Math.max(0, Math.floor(offset))}`;
  const res = await query<Record<string, string | null>>(sql, p.list);
  const rows = res.slice(0, GRID_PAGE).map((r) => cols.map((k) => r[k] ?? null));
  return { rows, more: res.length > GRID_PAGE };
}

/** How many rows match (exact). */
export async function gridCount(filters: GridFilters): Promise<number> {
  const p = new P();
  const r = await query<{ n: string }>(`SELECT count(*)::text AS n FROM weld w WHERE ${whereOf(filters, p)}`, p.list);
  return Number(r[0]?.n ?? 0);
}

/**
 * A column's values under the OTHER filters (as pbix slicers cross-filter),
 * matching `q`, A→Z, one page. Blank first when there is one.
 */
export async function gridValues(
  key: string,
  filters: GridFilters,
  q: string,
): Promise<{ values: string[]; more: boolean } | null> {
  const col = BY_KEY.get(key);
  if (!col) return null;
  const p = new P();
  const where = whereOf(filters, p, key);
  const c = `w.${key}`;
  const text = textOf(col);
  const like = q.trim() ? ` AND ${text} ILIKE ${p.add(`%${q.trim().replace(/[\\%_]/g, "\\$&")}%`)}` : "";
  const limit = 500;
  const [vals, blank] = await Promise.all([
    query<{ v: string }>(
      `SELECT v FROM (SELECT DISTINCT ${c} AS o, ${text} AS v FROM weld w WHERE ${where} AND ${c} IS NOT NULL${like}) d
        ORDER BY o LIMIT ${limit + 1}`,
      p.list,
    ),
    q.trim()
      ? Promise.resolve([])
      : (() => {
          const p2 = new P();
          const w2 = whereOf(filters, p2, key);
          return query<{ b: boolean }>(`SELECT true AS b FROM weld w WHERE ${w2} AND ${c} IS NULL LIMIT 1`, p2.list);
        })(),
  ]);
  const values = vals.slice(0, limit).map((r) => r.v);
  return { values: blank.length ? [BLANK, ...values] : values, more: vals.length > limit };
}

/** CSV export: header + rows, in load order, up to EXPORT_MAX rows, 20,000 at a time. */
export async function* gridCsv(filters: GridFilters, cols: string[]): AsyncGenerator<string> {
  const esc = (v: string | null) => (v === null ? "" : /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  yield "﻿" + cols.map((k) => esc(BY_KEY.get(k)!.label)).join(",") + "\r\n";
  let last = 0;
  let sent = 0;
  while (sent < EXPORT_MAX) {
    const p = new P();
    const where = whereOf(filters, p);
    const n = Math.min(20_000, EXPORT_MAX - sent);
    // past the read cache: an export is read once and is large
    const rows = await queryFresh<Record<string, string | null>>(
      `SELECT w.id::text AS "__id", ${selectOf(cols)} FROM weld w WHERE ${where} AND w.id > ${p.add(last)}
        ORDER BY w.id LIMIT ${n}`,
      p.list,
    );
    if (!rows.length) break;
    yield rows.map((r) => cols.map((k) => esc(r[k] ?? null)).join(",")).join("\r\n") + "\r\n";
    sent += rows.length;
    last = Number(rows[rows.length - 1]!.__id);
    if (rows.length < n) break;
  }
}
