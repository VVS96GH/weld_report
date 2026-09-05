/**
 * Applies the CCC UT overlay on its own, then refreshes the matviews.
 *
 *   node --import tsx scripts/apply-ut-overlay.ts
 *   node --import tsx scripts/apply-ut-overlay.ts --dry-run
 *
 * The overlay itself lives in `scripts/lib/ut-overlay.ts` and is also called by
 * `scripts/load-ccc-welder-record.ts` after its COPY. This entry point exists
 * because the overlay's two inputs are loaded by DIFFERENT loaders — CCC's fact
 * rows by this lane's welder loader, the tracker by the seeding lane's
 * `load-ut-tracker-ccc.ts` — so whichever runs second has to re-apply it. Adding
 *
 *     import { applyCccUtOverlay, formatUtOverlay } from "./lib/ut-overlay";
 *     console.log(`  ${formatUtOverlay(await applyCccUtOverlay(client))}`);
 *
 * after the tracker loader's COMMIT makes that automatic; until then, run this.
 *
 * `--dry-run` reports what WOULD be updated without writing, so it is safe to run
 * against a loaded database.
 */

import { Client } from "pg";
import { fmt, formatRefreshes, refreshMatviews, requireEnvUrl, secs } from "./load-common";
import { applyCccUtOverlay, formatUtOverlay } from "./lib/ut-overlay";

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry-run");
  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  try {
    await client.query("SET statement_timeout = 0");
    await client.query("SET synchronous_commit = off");

    const before = await client.query<{ source: string; n: string }>(
      `SELECT source::text, count(*) FILTER (WHERE manual_ut_report_no_all IS NOT NULL)::text AS n
         FROM weld GROUP BY 1 ORDER BY 1`);
    console.log("before  manual_ut_report_no_all set per source:");
    for (const r of before.rows) console.log(`  ${r.source.padEnd(20)} ${fmt(Number(r.n)).padStart(9)}`);

    if (dry) {
      const would = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM weld w
           WHERE w.sub_contractor = 'CCC'
             AND EXISTS (SELECT 1 FROM ref_ut_tracker_ccc t WHERE t.joint_id = w.joint_id)`);
      console.log(`\ndry run: ${fmt(Number(would.rows[0].n))} CCC rows match a tracker joint; nothing written`);
      return;
    }

    const t0 = Date.now();
    await client.query("BEGIN");
    const r = await applyCccUtOverlay(client);
    await client.query("COMMIT");
    console.log(`\n  ${formatUtOverlay(r)}`);

    const tPost = Date.now();
    await client.query("VACUUM (ANALYZE) weld");
    const refreshed = await refreshMatviews(client);
    console.log(`  post    VACUUM + ${formatRefreshes(refreshed)} — ${secs(tPost)} total`);

    const after = await client.query<{ source: string; n: string }>(
      `SELECT source::text, count(*) FILTER (WHERE manual_ut_report_no_all IS NOT NULL)::text AS n
         FROM weld GROUP BY 1 ORDER BY 1`);
    console.log("\nafter   manual_ut_report_no_all set per source:");
    for (const x of after.rows) console.log(`  ${x.source.padEnd(20)} ${fmt(Number(x.n)).padStart(9)}`);
    console.log(`\ntotal   ${secs(t0)}`);
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* connection may be gone */ }
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
