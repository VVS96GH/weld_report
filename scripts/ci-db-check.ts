/**
 * CI smoke check run after `npm run db:migrate` against an empty database:
 * the calendar seed has its 2,064 rows, `weld` has its columns, and the
 * `weld_source` enum carries every source. Connects exactly like migrate.ts
 * (DATABASE_URL, same default) and prints the host it resolved so a wrong
 * target is visible in the log rather than surfacing as an auth error.
 */
import pg from "pg";

const DEFAULT_DATABASE_URL = "postgres://weld:weld@localhost:5432/weld_report";
const url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const masked = url.replace(/\/\/([^:]+):[^@]+@/, "//$1:***@");
console.log(`ci-db-check: ${masked} (DATABASE_URL ${process.env.DATABASE_URL ? "set" : "unset, using default"})`);

const client = new pg.Client({ connectionString: url });
await client.connect();
const one = async <T,>(sql: string): Promise<T> => (await client.query(sql)).rows[0] as T;

const cal = await one<{ n: number }>("select count(*)::int as n from calendar");
const weldCols = await one<{ n: number }>(
  "select count(*)::int as n from information_schema.columns where table_name = 'weld'",
);
const sources = await one<{ n: number }>("select count(*)::int as n from unnest(enum_range(null::weld_source))");
const migrations = await one<{ n: number }>("select count(*)::int as n from schema_migrations");
console.log({ calendar: cal.n, weld_columns: weldCols.n, weld_sources: sources.n, migrations: migrations.n });
await client.end();

const failures: string[] = [];
if (cal.n !== 2064) failures.push(`calendar rows ${cal.n} (expected 2064)`);
if (weldCols.n < 240) failures.push(`weld columns ${weldCols.n} (expected >= 240)`);
if (sources.n < 5) failures.push(`weld_source values ${sources.n} (expected >= 5)`);
if (migrations.n < 12) failures.push(`applied migrations ${migrations.n} (expected >= 12)`);
if (failures.length) {
  console.error("ci-db-check FAILED: " + failures.join("; "));
  process.exit(1);
}
console.log("ci-db-check OK");
