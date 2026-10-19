/**
 * Loads `sources/CUM Trend Flange Progress Break Down Rate %.xlsx`, sheet
 * `Fl.BreakDown` (Date, Sub-Contractor, Fl.BreakDown % Rate, Project Fl.BreakDown
 * % Rej Rate) into `flange_breakdown`, replacing what was there — the pbix
 * `Flange BreakDown` table behind the "Leaked Flange Break %" line.
 *
 *   node --import tsx scripts/load-flange-breakdown.ts [--dry-run]
 */
import { Client } from "pg";
import { readSheet, toISODate, toNum, toText } from "./lib/xlsx";

const FILE = "sources/CUM Trend Flange Progress Break Down Rate %.xlsx";
const SHEET = "Fl.BreakDown";

async function main() {
  const dry = process.argv.includes("--dry-run");
  const { header, rows } = await readSheet(FILE, SHEET);
  const want = ["Date", "Sub-Contractor", "Fl.BreakDown % Rate", "Project Fl.BreakDown  % Rej Rate"];
  want.forEach((h, i) => {
    if (toText(header[i + 1])?.replace(/\s+/g, " ") !== h.replace(/\s+/g, " "))
      throw new Error(`${FILE}: column ${i + 1} is "${String(header[i + 1])}", expected "${h}"`);
  });
  const recs = new Map<string, [string, string, number | null, number | null]>();
  for (const r of rows) {
    const d = toISODate(r[1]);
    const sub = toText(r[2]);
    if (!d || !sub) continue;
    recs.set(`${d}|${sub.toUpperCase()}`, [d, sub, toNum(r[3]), toNum(r[4])]);
  }
  const list = [...recs.values()];
  const weeks = new Set(list.map((x) => x[0]));
  console.log(`flange_breakdown: ${list.length} rows, ${weeks.size} weeks, ${[...weeks].sort()[0]} .. ${[...weeks].sort().at(-1)}`);
  if (dry) return;
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query("DELETE FROM flange_breakdown");
    for (const [d, sub, rate, pr] of list) {
      await db.query(
        "INSERT INTO flange_breakdown (week_date, sub_contractor, rate, project_rate) VALUES ($1, $2, $3, $4)",
        [d, sub, rate, pr],
      );
    }
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
