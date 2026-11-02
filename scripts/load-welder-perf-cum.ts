/**
 * The "CUM FILE Welders Performance" workbooks (RT 2 weeks / 1 month, UT 2 weeks) -> ref_welder_perf_cum
 * (migration 0046), row for row. The workbooks are the owner's master: edited by
 * hand, or appended from the Rejection Summary page (lib/welder-perf-cum.ts).
 *
 * Safe to re-run: replaces each workbook's rows.
 */
import { Client } from "pg";
import path from "node:path";
import { statSync } from "node:fs";

import { closeLoad, openLoad, requireEnvUrl, sha256File } from "./load-common";
import { CUM_FILES, type CumKind, reloadTable } from "../lib/welder-perf-cum";

async function main(): Promise<void> {
  const client = new Client({ connectionString: requireEnvUrl() });
  await client.connect();
  const run = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await client.query(sql, params)).rows as T[];
  try {
    for (const kind of ["2w", "1m", "ut2w"] as CumKind[]) {
      const abs = path.resolve(CUM_FILES[kind]);
      const loadId = await openLoad(client, "WELDER_PERF_CUM", path.basename(abs), statSync(abs).size, await sha256File(abs));
      const t0 = Date.now();
      const n = await reloadTable(run, kind, loadId);
      const periods = await run<{ n: string; last: string }>(
        `SELECT count(DISTINCT period)::text AS n, max(last_rt_date)::text AS last FROM ref_welder_perf_cum WHERE kind = $1`,
        [kind],
      );
      console.log(`  ${kind}: ${n} rows, ${periods[0].n} periods, last RT date ${periods[0].last} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      await closeLoad(client, loadId, n, n, 0, { periods: Number(periods[0].n), last_rt_date: periods[0].last });
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
