/**
 * Applies db/migrations/*.sql in filename order, each in its own transaction,
 * and records it in `schema_migrations`.  Re-running is a no-op.
 *
 *   npm run db:migrate
 *   node --import tsx scripts/migrate.ts --status
 *
 * `pg` only — no migration framework.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

const BOOTSTRAP = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    text        PRIMARY KEY,
  sha256      text        NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  duration_ms integer     NOT NULL DEFAULT 0
)`;

/**
 * A file whose first 400 characters contain `-- migrate: no-transaction` is run
 * OUTSIDE a transaction.  Needed for statements Postgres refuses inside one —
 * `ALTER TYPE … ADD VALUE` (0009) is the case that forced this, and
 * `CREATE INDEX CONCURRENTLY` would be another.  Such a file must be written so
 * that a partial application is harmless: use IF NOT EXISTS everywhere, because
 * nothing rolls back.
 */
const NO_TRANSACTION_MARKER = "-- migrate: no-transaction";

interface Migration {
  filename: string;
  sql: string;
  sha256: string;
  noTransaction: boolean;
}

function loadMigrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((filename) => {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
      return {
        filename,
        sql,
        sha256: createHash("sha256").update(sql).digest("hex"),
        noTransaction: sql.slice(0, 400).includes(NO_TRANSACTION_MARKER),
      };
    });
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env (npm run db:migrate reads it).",
    );
  }
  return url;
}

async function main(): Promise<void> {
  const statusOnly = process.argv.includes("--status");
  const migrations = loadMigrations();
  if (migrations.length === 0) throw new Error(`no .sql files in ${MIGRATIONS_DIR}`);

  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  try {
    await client.query(BOOTSTRAP);
    const { rows } = await client.query<{ filename: string; sha256: string }>(
      "SELECT filename, sha256 FROM schema_migrations",
    );
    const applied = new Map(rows.map((r) => [r.filename, r.sha256]));

    let changed = 0;
    for (const m of migrations) {
      const prev = applied.get(m.filename);
      if (prev !== undefined) {
        if (prev !== m.sha256) {
          console.warn(
            `!! ${m.filename} was applied with a different checksum ` +
              `(recorded ${prev.slice(0, 12)}, file ${m.sha256.slice(0, 12)}). ` +
              `Add a NEW migration instead of editing an applied one.`,
          );
        } else {
          console.log(`  = ${m.filename}`);
        }
        continue;
      }
      if (statusOnly) {
        console.log(`  + ${m.filename} (pending)${m.noTransaction ? " [no-transaction]" : ""}`);
        changed += 1;
        continue;
      }
      const t0 = Date.now();
      if (m.noTransaction) {
        // No BEGIN/COMMIT: the file contains something Postgres will not run
        // inside a transaction block. It must be internally idempotent.
        try {
          await client.query(m.sql);
          await client.query(
            "INSERT INTO schema_migrations (filename, sha256, duration_ms) VALUES ($1, $2, $3)",
            [m.filename, m.sha256, Date.now() - t0],
          );
        } catch (err) {
          throw new Error(
            `migration ${m.filename} failed OUTSIDE a transaction — the database may be ` +
              `partially changed; the file is written to be re-runnable: ${(err as Error).message}`,
            { cause: err },
          );
        }
      } else {
        await client.query("BEGIN");
        try {
          await client.query(m.sql);
          await client.query(
            "INSERT INTO schema_migrations (filename, sha256, duration_ms) VALUES ($1, $2, $3)",
            [m.filename, m.sha256, Date.now() - t0],
          );
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw new Error(`migration ${m.filename} failed: ${(err as Error).message}`, {
            cause: err,
          });
        }
      }
      console.log(
        `  + ${m.filename} (${Date.now() - t0} ms)${m.noTransaction ? " [no-transaction]" : ""}`,
      );
      changed += 1;
    }
    console.log(
      statusOnly
        ? `${changed} pending, ${applied.size} applied`
        : changed === 0
          ? "already up to date"
          : `applied ${changed} migration(s)`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
