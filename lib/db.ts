/**
 * Postgres access for the weld-report metric layer.
 *
 * Owner: METRICS-LANE. The schema this file talks to is owned by DB-LANE and
 * specified in `analysis/calculation-logic.md` §6 (column names come from
 * `analysis/dump/profile.md` §8.1 plus the §6.2 derived columns).
 *
 * ── The `as_of` contract ────────────────────────────────────────────────────
 * Every DAX `TODAY()` in the pbix model (the aging clocks `No of Days "WD"` /
 * `No of Days "PR all"`, i.e. metrics M51 and M66) becomes an explicit
 * `as_of date` **query parameter** here, never `current_date`. Reasons:
 *
 *   1. reproducibility — the same load always yields the same page, so the
 *      numbers in `analysis/reconcile_results.json` can be pinned by a test;
 *   2. the dump is an *export*, not a live feed: `max(weld_date)` is the last
 *      day the source system had data for, so ageing against the wall clock
 *      would silently inflate every "above 30 Days" bucket as the file gets
 *      older on disk.
 *
 * Default: `as_of = max(weld_date)` over the current load (2026-08-28 for the
 * 30-Aug-2026 export — the same value `analysis/reconcile_check.py` used for
 * `TODAY()`). Callers may override it with `?as_of=YYYY-MM-DD`.
 */

import { Pool, type QueryResultRow } from "pg";

export const DEFAULT_DATABASE_URL =
  "postgres://weld:weld@localhost:5432/weld_report";

/** Statement timeout applied to every session opened by this pool. */
export const STATEMENT_TIMEOUT_MS = 30_000;

export type QueryFn = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
) => Promise<T[]>;

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
      max: Number(process.env.PGPOOL_MAX ?? 8),
      // 30 s statement timeout, per the lane brief. `options` is passed
      // through to the backend at connection time so it covers every query
      // issued on the connection, including ones inside a transaction.
      statement_timeout: STATEMENT_TIMEOUT_MS,
      connectionTimeoutMillis: 10_000,
      idle_in_transaction_session_timeout: STATEMENT_TIMEOUT_MS,
    });
  }
  return pool;
}

async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params ? [...params] : undefined);
  return res.rows;
}

let impl: QueryFn = pgQuery;

/**
 * Run a parameterised statement. Values are ALWAYS bound as `$1…$n`; nothing
 * in `lib/metrics` interpolates a value into SQL text.
 */
export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<T[]> {
  return impl<T>(text, params);
}

/**
 * Test seam. `tests/pages.test.ts` swaps in a fixture so the 44 page
 * assemblers can be structurally verified with no database present.
 * Pass `null` to restore the real pool-backed implementation.
 */
export function setQueryImpl(fn: QueryFn | null): void {
  impl = fn ?? pgQuery;
}

export async function closePool(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}

/** `true` when a `DATABASE_URL` is configured or the default is in use. */
export function databaseUrl(): string {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

// ── as_of resolution ────────────────────────────────────────────────────────

export type AsOf = {
  /** ISO date used for every `TODAY()` in the DAX (M51/M66 aging clocks). */
  as_of: string;
  /** Where the value came from — surfaced in `PageModel.meta`. */
  origin: "request" | "max_weld_date" | "fallback_today";
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Resolve the reporting `as_of` date.
 *
 * - an explicit `YYYY-MM-DD` wins (that is the `?as_of=` query parameter);
 * - otherwise `max(weld_date)` of the current load;
 * - otherwise (empty table / no database) today's date, flagged as
 *   `fallback_today` so the caller can disclose it.
 */
export async function withAsOf(requested?: string | null): Promise<AsOf> {
  if (requested) {
    if (!ISO_DATE.test(requested)) {
      throw new Error(`as_of must be YYYY-MM-DD, got ${JSON.stringify(requested)}`);
    }
    return { as_of: requested, origin: "request" };
  }
  // `::text` in SQL, NOT a JS Date: node-postgres parses `date` into a Date at
  // LOCAL midnight, and `toISOString()` would then shift it a day back in any
  // timezone east of UTC. Ask Postgres for the calendar date as text instead.
  const rows = await query<{ max_weld_date: string | null }>(
    "SELECT max(weld_date)::text AS max_weld_date FROM weld",
  );
  const raw = rows[0]?.max_weld_date ?? null;
  if (raw) {
    const iso = String(raw).slice(0, 10);
    if (ISO_DATE.test(iso)) return { as_of: iso, origin: "max_weld_date" };
  }
  return { as_of: todayIso(), origin: "fallback_today" };
}

// ── health ──────────────────────────────────────────────────────────────────

export type LoadSummary = {
  load_id: string | null;
  loaded_at: string | null;
  source_file: string | null;
  row_count: number | null;
  status: string | null;
};

/** `SELECT 1` round-trip. Returns the latency in ms, or throws. */
export async function ping(): Promise<number> {
  const t0 = Date.now();
  await query("SELECT 1 AS ok");
  return Date.now() - t0;
}

/**
 * Current load summary from the `load` table written by DB-LANE's loader.
 * The table may not exist yet — callers get `null` rather than an error so
 * `/api/health` can report "db up, no load table" honestly.
 */
export async function currentLoad(): Promise<LoadSummary | null> {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT to_regclass('public.load') IS NOT NULL AS present`,
    );
    if (!rows[0]?.present) return null;
    const load = await query<Record<string, unknown>>(
      `SELECT * FROM load ORDER BY id DESC LIMIT 1`,
    );
    const r = load[0];
    if (!r) return null;
    const pick = (...keys: string[]): string | null => {
      for (const k of keys) {
        const v = r[k];
        if (v !== undefined && v !== null) {
          return v instanceof Date ? v.toISOString() : String(v);
        }
      }
      return null;
    };
    // Column names per db/migrations/0001_bookkeeping.sql; the fallbacks keep
    // this working if DB-LANE renames anything.
    const count = pick("records_loaded", "row_count", "rows", "n_rows");
    return {
      load_id: pick("id", "load_id"),
      loaded_at: pick("finished_at", "started_at", "loaded_at", "created_at"),
      source_file: pick("file_name", "source_file", "file", "path"),
      row_count: count === null ? null : Number(count),
      status: pick("status", "state") ?? (pick("finished_at") ? "finished" : "running"),
    };
  } catch {
    return null;
  }
}
