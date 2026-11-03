/**
 * The database documentation (owner, 2026-11-03, after NFE1_DATABASE_DOCUMENTATION):
 * docs/database.md (+ .docx) generated from the live catalog, so it cannot drift from it.
 * The meanings live in the database: COMMENT ON (migrations, e.g. 0066), and the weld
 * table's columns are labelled here with their dump header (lib/data-grid-columns.ts).
 *
 *   npm run db:docs
 */
import { Client } from "pg";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { requireEnvUrl } from "./load-common";
import { GRID_COLUMNS } from "../lib/data-grid-columns";

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0).toLocaleString("en-US");
const cell = (v: unknown) => String(v ?? "").replace(/\|/g, "/").replace(/\n/g, " ");

async function main(): Promise<void> {
  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  const q = async <T extends Row>(sql: string, p: unknown[] = []) => (await client.query(sql, p)).rows as T[];
  try {
    // the weld columns: their dump header (no row changes — comments only)
    const weldCols = new Set((await q<{ c: string }>(
      "SELECT attname AS c FROM pg_attribute WHERE attrelid = 'weld'::regclass AND attnum > 0 AND NOT attisdropped")).map((r) => r.c));
    let labelled = 0;
    for (const c of GRID_COLUMNS) {
      if (c.sql || !weldCols.has(c.key)) continue;
      await client.query(`COMMENT ON COLUMN weld."${c.key}" IS $$Dump header "${c.label.replace(/\$/g, "")}" (${c.type}).$$`);
      labelled++;
    }
    const version = (await q<{ v: string }>("SELECT current_setting('server_version') AS v"))[0]!.v;
    const size = (await q<{ s: string }>("SELECT pg_size_pretty(pg_database_size(current_database())) AS s"))[0]!.s;
    const rels = await q<{ oid: number; name: string; kind: string; note: string | null }>(
      `SELECT c.oid::int AS oid, c.relname AS name, c.relkind::text AS kind, obj_description(c.oid) AS note
         FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
        WHERE ns.nspname = 'public' AND c.relkind IN ('r', 'm') ORDER BY c.relkind DESC, c.relname`);
    const L: string[] = [];
    const a = (s = "") => L.push(s);
    let total = 0;
    const info: { r: (typeof rels)[number]; rows: number; cols: Row[]; cons: Row[]; idx: Row[] }[] = [];
    for (const r of rels) {
      const rows = Number((await q<{ n: string }>(`SELECT count(*)::text AS n FROM "${r.name}"`))[0]!.n);
      total += rows;
      const cols = await q(
        `SELECT attname AS name, format_type(atttypid, atttypmod) AS type, attnotnull AS nn, col_description(attrelid, attnum) AS note
           FROM pg_attribute WHERE attrelid = $1 AND attnum > 0 AND NOT attisdropped ORDER BY attnum`, [r.oid]);
      const cons = await q("SELECT conname, contype::text AS t, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1", [r.oid]);
      const idx = await q("SELECT indexrelid::regclass::text AS name, pg_get_indexdef(indexrelid) AS def FROM pg_index WHERE indrelid = $1", [r.oid]);
      info.push({ r, rows, cols, cons, idx });
    }
    const loads = await q(
      `SELECT DISTINCT ON (source) source, file_name, finished_at::timestamp(0)::text AS at, records_loaded AS rows_written
         FROM load WHERE finished_at IS NOT NULL ORDER BY source, id DESC`);
    const now = new Date().toISOString().slice(0, 16).replace("T", " ");

    a("# Database documentation - Welding Statistics Dashboard (weld_report)");
    a();
    a(`Generated from the live catalog on ${now} UTC by \`npm run db:docs\` (scripts/db-docs.ts). Do not edit by hand:`);
    a("the meanings live in the database (COMMENT ON, migrations) and in the code that writes them.");
    a();
    a("## 1. Overview");
    a();
    a(`- **Name and platform:** PostgreSQL ${version}, Docker container \`weld_report_db\` on this machine. Connection values come from \`.env\`; none is written here.`);
    a(`- **Scale:** ${rels.filter((r) => r.kind === "r").length} tables and ${rels.filter((r) => r.kind === "m").length} materialized views, ${n(total)} rows, ${size} on disk.`);
    a("- **What it is:** the Welding Statistics Dashboard's store. It reproduces the owner's Power BI report: the export files in `sources/` are");
    a("  loaded into `weld` and the reference tables, the materialized views (`mv_*`) precompute what the pages read.");
    a("- **Who uses it:** the Next.js site (port 3000) only. The Welding Statistics Platform never reads it.");
    a("- **Companions:** `RULINGS.md` (the owner's rulings), `db/migrations/*.sql` (every definition, with its reason), `docs/`.");
    a();
    a("## 2. Tables and what one row means");
    a();
    a("| Table / view | Kind | Rows | Key | Meaning |");
    a("|---|---|---:|---|---|");
    for (const t of info) {
      const pk = t.cons.find((c) => c.t === "p");
      a(`| \`${t.r.name}\` | ${t.r.kind === "m" ? "view" : "table"} | ${n(t.rows)} | ${pk ? cell(String(pk.def).replace("PRIMARY KEY ", "")) : "-"} | ${cell(t.r.note)} |`);
    }
    a();
    a("## 3. Columns");
    a();
    a("Every column with its type and meaning (`weld`: the dump header it holds).");
    for (const t of info) {
      a();
      a(`### \`${t.r.name}\` - ${n(t.rows)} rows`);
      a();
      a("| Column | Type | Not null | Meaning |");
      a("|---|---|:-:|---|");
      for (const c of t.cols) a(`| \`${c.name}\` | ${c.type} | ${c.nn ? "yes" : ""} | ${cell(c.note)} |`);
    }
    a();
    a("## 4. Keys and constraints");
    a();
    a("| Table | Constraint | Definition |");
    a("|---|---|---|");
    for (const t of info) for (const c of t.cons) a(`| \`${t.r.name}\` | ${c.conname} | \`${cell(c.def)}\` |`);
    a();
    a("## 5. Indexes");
    a();
    a("| Table | Index |");
    a("|---|---|");
    for (const t of info) for (const i of t.idx) a(`| \`${t.r.name}\` | \`${cell(String(i.def).split(" USING ").pop())}\` (${i.name}) |`);
    a();
    a("## 6. Data flow");
    a();
    a("1. **Files** - `sources/` (the owner's exports and the CUM workbooks).");
    a("2. **Refresh** (`npm run db:refresh`, the Refresh button) - each step loads its files when their sha256 changed (the `load` ledger);");
    a("   the materialized views are refreshed after the loads that feed them.");
    a("3. **Definitions** - every table and view is created by a migration (`db/migrations/NNNN_*.sql`, `npm run db:migrate`), never by hand.");
    a("4. **Read** - the pages read the views and `weld` with the report cut-off (the last Friday).");
    a("5. **Check** - the Welding Statistics Platform reconciles its figures with this site's pages over HTTP (its Data page).");
    a();
    a("Last load of each source:");
    a();
    a("| Source | File | Finished | Rows |");
    a("|---|---|---|---:|");
    for (const l of loads) a(`| ${l.source} | ${cell(l.file_name)} | ${l.at} | ${n(l.rows_written)} |`);
    a();
    a("## 7. Do / avoid");
    a();
    a("| Do | Avoid |");
    a("|---|---|");
    a("| Change data only through a refresh of its file. | UPDATE / DELETE in `weld` or a reference table by hand. |");
    a("| Change a table or view with a new migration. | Editing a view in psql: the next migration or rebuild undoes it. |");
    a("| Keep the owner's rulings in RULINGS.md, with an example joint. | Changing a counted rule without a ruling. |");
    a("| Keep passwords in `.env`. | Copying them into docs, commits or chat. |");
    a();
    a("## Appendix A. Health check (30 seconds)");
    a();
    a("1. `curl http://127.0.0.1:3000/api/health` - the site and its database answer.");
    a("2. The Data page of the Welding Statistics Platform: **Data health** - the reconciliation of both sites.");
    a("3. The table above: each source's last load.");
    a();
    const md = path.resolve("docs/database.md");
    writeFileSync(md, L.join("\n"));
    try {
      execFileSync("uv", ["run", "-q", "--with", "python-docx", "python", "scripts/md_to_docx.py", md, md.replace(/\.md$/, ".docx")], { stdio: "inherit" });
      console.log(`${labelled} weld columns labelled; docs/database.md and docs/database.docx written`);
    } catch {
      console.log(`${labelled} weld columns labelled; docs/database.md written (no .docx: uv / python-docx unavailable)`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
