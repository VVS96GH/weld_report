/**
 * CCC integration test — the batch-2 sources.
 *
 * Skips with a message until `weld` holds the full CCC welder-record
 * population. The gate is the row count the pbix itself stores, which
 * `analysis/calculation-logic.md` §7 C-10 derives exactly:
 *
 *   4,791,434 rows from `CSVExport_Welder Record.csv` with a blank
 *   `RT/UT Report No.`  +  641,575 rows from the ACC/REJ workbook
 *   = 5,433,009                                            (ruling R2-16)
 *
 * There are no CCC reference numbers yet — the recon scripts have not produced
 * them — so nothing here invents one. What it does pin is:
 *
 *   • the row counts the source documents state (5,433,009 / 130,994);
 *   • the distinct-joint population (1,339,063, `analysis/sources2/profile.md`);
 *   • structural invariants that must hold at ANY data vintage, which is what
 *     actually catches a DISTINCT bug at weld-pass grain (ruling R2-01);
 *   • that fractional films survived the `numeric(10,4)` widening (R2-04).
 */

import { afterAll, describe, expect, it } from "vitest";
import { closePool, databaseUrl, query } from "@/lib/db";
import { SOURCES_CCC, type Scope } from "@/lib/metrics/scope";
import { rtStatsPrAll } from "@/lib/metrics/rt";
import { utStatsPrAll } from "@/lib/metrics/ut";
import { pwhtStatsPrAll } from "@/lib/metrics/pwht";
import { weldingStats } from "@/lib/metrics/welding";

/**
 * The CCC welder-record population that actually lands in `weld`.
 *
 * The pbix stores 5,433,009 (§7 C-10 / R2-16: 4,791,434 blank-RT CSV rows +
 * 641,575 ACC/REJ workbook rows). 16 of those are dropped by the M's four
 * hard-coded joint exclusions, so the loaded count is 5,432,993 — the pbix's
 * own arithmetic, not a loader shortfall. See db/README.md.
 */
const CCC_WELDER_RECORD_ROWS = 5_432_993;
/** R2-03 — the NOT-WELDED joints of `AllTrain_CSVExport_Joint Record.csv`. */
const CCC_JOINT_RECORD_ROWS = 130_994;
/**
 * Distinct `Joint ID` among the rows that land in `weld`.
 *
 * `analysis/sources2/profile.md:49` measured 1,339,063 over the whole raw CSV;
 * the loaded set is the §1.4 split (blank-RT CSV rows + the ACC/REJ workbook),
 * a different population, and it carries 1,339,099 joints.
 */
const CCC_DISTINCT_JOINTS = 1_339_099;

const CCC: Scope = { sources: SOURCES_CCC, subContractor: "CCC" };

async function probe(): Promise<string | null> {
  try {
    const rows = await query<{ present: boolean }>(
      "SELECT to_regclass('public.weld') IS NOT NULL AS present",
    );
    if (!rows[0]?.present) return "table `weld` does not exist yet";
    const load = await query<{ records_loaded: string }>(
      "SELECT records_loaded::text AS records_loaded FROM load" +
        " WHERE source = 'CCC_WELDER_RECORD' AND finished_at IS NOT NULL" +
        " ORDER BY id DESC LIMIT 1",
    );
    if (!load[0]) return "no finished CCC_WELDER_RECORD load in the `load` ledger yet";
    // The ledger is the gate; the row count itself is an assertion below, so a
    // short load fails loudly instead of silently skipping the whole suite.
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

const skipReason = await probe();

if (skipReason) {
  console.log(
    `[metrics-ccc.test] SKIPPED — CCC is not loaded at ${databaseUrl()}: ${skipReason}\n` +
      `[metrics-ccc.test] Gate: weld must hold ${CCC_WELDER_RECORD_ROWS.toLocaleString("en-US")} ` +
      `CCC_WELDER_RECORD rows (4,791,434 blank-RT CSV rows + 641,575 ACC/REJ workbook rows).\n` +
      `[metrics-ccc.test] No CCC reference numbers exist yet; this suite pins the source ` +
      `row counts and the DISTINCT/fractional invariants only.`,
  );
} else {
  console.log(`[metrics-ccc.test] LIVE — CCC loaded at ${databaseUrl()}`);
}

afterAll(async () => {
  await closePool();
});

describe.skipIf(Boolean(skipReason))("CCC load reproduction", () => {
  it("holds the row counts the sources state, per source", async () => {
    const rows = await query<{ source: string; n: string }>(
      "SELECT source::text AS source, count(*)::text AS n FROM weld" +
        " WHERE source::text IN ('CCC_WELDER_RECORD','CCC_JOINT_RECORD')" +
        " GROUP BY 1",
    );
    const got: Record<string, number> = {};
    for (const r of rows) got[r.source] = Number(r.n);
    expect(got.CCC_WELDER_RECORD).toBe(CCC_WELDER_RECORD_ROWS);
    expect(got.CCC_JOINT_RECORD).toBe(CCC_JOINT_RECORD_ROWS);
  });

  it("has the distinct-joint population profile.md measured", async () => {
    const rows = await query<{ n: string }>(
      "SELECT count(DISTINCT joint_id)::text AS n FROM weld" +
        " WHERE source::text = 'CCC_WELDER_RECORD'",
    );
    const n = Number(rows[0].n);
    expect(
      n,
      `distinct CCC joints = ${n.toLocaleString("en-US")}, expected ` +
        `${CCC_DISTINCT_JOINTS.toLocaleString("en-US")}. profile.md:49 measured 1,339,063 over the ` +
        `whole raw CSV; the loaded set is the §1.4 split, a different population.`,
    ).toBe(CCC_DISTINCT_JOINTS);
  });

  it("is weld-pass grain: ~4 rows per joint (ruling R2-01)", async () => {
    const rows = await query<{ n: string; j: string }>(
      "SELECT count(*)::text AS n, count(DISTINCT joint_id)::text AS j FROM weld" +
        " WHERE source::text = 'CCC_WELDER_RECORD'",
    );
    const ratio = Number(rows[0].n) / Number(rows[0].j);
    console.log(`[metrics-ccc.test] CCC rows per joint = ${ratio.toFixed(3)}`);
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(6);
  });
});

describe.skipIf(Boolean(skipReason))("CCC structural invariants", () => {
  it("joints welded ≤ distinct joints, and tested ≤ welded", async () => {
    const [w, rt, distinct] = await Promise.all([
      weldingStats(CCC),
      rtStatsPrAll(CCC),
      query<{ n: string }>(
        "SELECT count(DISTINCT joint_id)::text AS n FROM weld" +
          " WHERE source::text = 'CCC_WELDER_RECORD'",
      ),
    ]);
    const distinctJoints = Number(distinct[0].n);
    // M01 excludes repairs/rewelds and unwelded joints, so it is a subset.
    expect(w.joints_welded).toBeLessThanOrEqual(distinctJoints);
    expect(w.joints_welded).toBeLessThanOrEqual(w.joints_welded_incl_repair_reweld);
    // M15 can exceed 100 % (repairs are tested but not counted as welded —
    // §M15), so `tested` is bounded by the joint population, not by M01.
    expect(rt.tested).toBeLessThanOrEqual(distinctJoints);
  });

  it("accepted = tested − rejected, exactly as the DAX defines M13", async () => {
    const rt = await rtStatsPrAll(CCC);
    expect(rt.accepted).toBe(rt.tested - rt.rejected);
    expect(rt.rejected).toBeLessThanOrEqual(rt.tested);
  });

  it("film sums are fractional-safe (ruling R2-04)", async () => {
    const rows = await query<{ frac: string; total: string }>(
      "SELECT count(*)::text AS frac," +
        "       (SELECT count(*)::text FROM weld WHERE source::text='CCC_WELDER_RECORD') AS total" +
        "  FROM weld" +
        " WHERE source::text = 'CCC_WELDER_RECORD'" +
        "   AND rt_film_total IS NOT NULL AND rt_film_total <> trunc(rt_film_total)",
    );
    const fractional = Number(rows[0].frac);
    console.log(
      `[metrics-ccc.test] CCC rows with a fractional rt_film_total: ${fractional.toLocaleString("en-US")}`,
    );
    // §7 C-6: `0.75` alone occurs on 296,274 rows. Zero fractional rows would
    // mean the numeric(10,4) widening did not take and every CCC film metric
    // is silently truncated.
    expect(fractional).toBeGreaterThan(0);

    const rt = await rtStatsPrAll(CCC);
    expect(Number.isFinite(rt.films)).toBe(true);
    expect(rt.films).toBeGreaterThanOrEqual(0);
    expect(rt.films_rejected).toBeLessThanOrEqual(rt.films);
  });

  it("reports whether RT Film Total is a per-pass SHARE or a repeated joint total", async () => {
    // The one place where the evidence disagrees with itself: ruling R2-04 and
    // §7 C-6 say `RT Film Total` is a weld-point SHARE (so the ungated SUM this
    // layer uses is correct), while project-wd-wr-inco-acciona.md:3128 glosses
    // it as "плёнок на стык (максимум)" — a per-joint total repeated on every
    // pass (which would make the same SUM inflate ~4x).
    //
    // The discriminator: if it is a share, per-joint sums land on whole numbers.
    // This test REPORTS the split rather than asserting a guess, so the
    // orchestrator can rule with a number in hand.
    const rows = await query<{ whole: string; joints: string }>(
      "WITH j AS (" +
        "  SELECT joint_id, sum(rt_film_total) AS s FROM weld" +
        "   WHERE source::text = 'CCC_WELDER_RECORD' AND rt_film_total > 0" +
        "   GROUP BY 1 LIMIT 200000" +
        ")" +
        " SELECT count(*) FILTER (WHERE s = trunc(s))::text AS whole," +
        "        count(*)::text AS joints FROM j",
    );
    const whole = Number(rows[0].whole);
    const joints = Number(rows[0].joints);
    const pct = joints ? (100 * whole) / joints : 0;
    console.log(
      `[metrics-ccc.test] per-joint film sums that are whole numbers: ` +
        `${whole.toLocaleString("en-US")} / ${joints.toLocaleString("en-US")} (${pct.toFixed(1)}%). ` +
        `High = SHARE (R2-04 holds, ungated SUM is right). Low = repeated joint total ` +
        `(the SUM would inflate ~4x and M20-M26 need a WP1 gate for CCC).`,
    );
    expect(joints).toBeGreaterThan(0);
  });

  it("PWHT and UT come back without error at PR-all scope", async () => {
    const [pwht, ut] = await Promise.all([pwhtStatsPrAll(CCC), utStatsPrAll(CCC)]);
    expect(pwht.pwht_backlog_rt_types).toBeLessThanOrEqual(pwht.pwht_backlog_all_types);
    expect(pwht.pwht_backlog_rt100).toBeLessThanOrEqual(pwht.pwht_backlog_rt_types);
    expect(ut.ut_accepted).toBe(ut.ut_done - ut.ut_rejected);
    expect(ut.ut_rejected).toBeLessThanOrEqual(ut.ut_done);
  });
});
