/**
 * Integration test: the SQL metric layer must reproduce
 * `analysis/reconcile_results.json` EXACTLY on the same load.
 *
 * That file was produced by `analysis/reconcile_check.py`, a streaming
 * re-implementation of the Power Query `Weld Dump` load plus the `"EP"`/`"WD"`
 * DAX measures, run over `sources/Weld Dump.txt` with
 * `TODAY() = max(Weld Date) = 2026-08-28`. Every numeric key it holds for the
 * five scopes `GAC/ALL`, `GAC/NONSG`, `GAC/SG`, `TEKFEN/ALL`, `MEDGULF/ALL`
 * is asserted here, plus the whole `wps_gac_nonsg` table row by row.
 *
 * The suite connects when `DATABASE_URL` (default
 * `postgres://weld:weld@localhost:5432/weld_report`) is reachable and the
 * `weld` table exists; otherwise it skips with a message. Run it live with:
 *
 *     DATABASE_URL=postgres://weld:weld@localhost:5432/weld_report \
 *       npx vitest run tests/metrics.test.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { closePool, databaseUrl, query } from "@/lib/db";
import {
  Params,
  RT_WELD_TYPES,
  scopeConditions,
  SOURCES_EP,
  type Scope,
  type GroupSpec,
} from "@/lib/metrics/scope";
import {
  rtBacklogAging,
  rtBacklogStats,
  rtBacklogStatsBy,
  rtStats,
  rtStatsBy,
} from "@/lib/metrics/rt";
import { pwhtBacklogAging, pwhtStats } from "@/lib/metrics/pwht";
import { utStats } from "@/lib/metrics/ut";
import {
  weldingStats,
  weldingStatsBy,
  weldTypeDistribution,
} from "@/lib/metrics/welding";
import { wpsRejectionTable } from "@/lib/metrics/wps";

// ── the reference numbers ───────────────────────────────────────────────────

type ScopeResult = {
  joints_welded: number;
  joints_welded_incl_repair_reweld: number;
  joints_welded_by_weld_cat: Record<string, number>;
  joints_welded_by_weld_type: Record<string, number>;
  rt_tested_joints: number;
  rt_accepted_joints: number;
  rt_rejected_joints: number;
  rt_tested_joints_BW_GW_CLET_MW: number;
  rt_accepted_joints_BW_GW_CLET_MW: number;
  rt_rejected_joints_BW_GW_CLET_MW: number;
  rt_joint_rejection_pct: number | null;
  films_taken_by_joint: number;
  films_accepted_by_joint: number;
  films_rejected_by_joint: number;
  film_rejection_pct: number | null;
  films_taken_all_rows: number;
  films_rejected_all_rows: number;
  ut_done: number;
  ut_accepted: number;
  ut_rejected: number;
  ut_joint_rejection_pct: number | null;
  ut_weld_length_m: number;
  rt_backlog_total: number;
  rt100_backlog: number;
  rt_backlog_plus_pwht_Y_done: number;
  rt_backlog_plus_pwht_N: number;
  rt_backlog_and_pwht_Y_not_done: number;
  rt_backlog_aging: Record<string, number>;
  pwht_backlog_all_types: number;
  pwht_backlog_BW_GW_CLET_MW: number;
  pwht_backlog_by_RT100: number;
  pwht_done: number;
  pwht_backlog_aging: Record<string, number>;
  by_rt_pct: Record<
    string,
    {
      joints_welded: number;
      tested: number;
      accepted: number;
      rejected: number;
      rt_backlog: number;
    }
  >;
};

type Reconcile = {
  asof_used_for_TODAY: string;
  max_weld_date_in_file: string;
  records_after_powerquery_filters: number;
  rows_per_subcontractor_after_filters: Record<string, number>;
  rt_pct_vocabulary: Record<string, number>;
  scopes: Record<string, ScopeResult>;
  wps_gac_nonsg: Record<
    string,
    {
      joints_welded: number;
      tested_joints: number;
      rt_ut_ratio_pct: number | null;
      accepted: number;
      rejected: number;
      rt_total_films: number;
      rt_films_A: number;
      rt_films_R: number;
      rt_film_ratio_pct: number | null;
      rejection_rate_joint: number | null;
    }
  >;
};

const REF: Reconcile = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "analysis/reconcile_results.json"),
    "utf8",
  ),
) as Reconcile;

const AS_OF = REF.asof_used_for_TODAY;

const SCOPES: Record<string, Scope> = {
  "GAC/ALL": { subContractor: "GAC" },
  "GAC/NONSG": { subContractor: "GAC", serviceCat: "NONSG" },
  "GAC/SG": { subContractor: "GAC", serviceCat: "SG" },
  "TEKFEN/ALL": { subContractor: "TEKFEN" },
  "MEDGULF/ALL": { subContractor: "MEDGULF" },
};

const GROUP_WELD_CAT: GroupSpec = { key: "weld_cat", sql: "w.weld_cat" };
const GROUP_RT_PCT: GroupSpec = { key: "rt_pct", sql: "w.rt_pct::text" };

// ── how many assertions this suite runs live ────────────────────────────────

function countAssertions(): number {
  let n = 4; // load-level pins: row count, subcontractor rows, rt% vocab, max weld date
  for (const name of Object.keys(SCOPES)) {
    const s = REF.scopes[name];
    if (!s) continue;
    for (const [k, v] of Object.entries(s)) {
      if (v === null || typeof v === "number") {
        n += 1;
      } else if (k === "by_rt_pct") {
        n += Object.keys(v as object).length * 5;
      } else {
        n += 1; // the whole sub-object compared with toEqual
      }
    }
  }
  n += Object.keys(REF.wps_gac_nonsg).length; // one toEqual per WPS row
  n += 1; // the WPS key set
  return n;
}

const ASSERTIONS = countAssertions();

// ── connectivity probe ──────────────────────────────────────────────────────

async function probe(): Promise<string | null> {
  try {
    const exists = await query<{ present: boolean }>(
      "SELECT to_regclass('public.weld') IS NOT NULL AS present",
    );
    if (!exists[0]?.present) return "table `weld` does not exist yet";
    // Ask the load ledger rather than counting `weld`: a `count(*)` while the
    // loader is mid-COPY blows the 30 s statement timeout, and a half-loaded
    // table would fail all 358 assertions for the wrong reason.
    const load = await query<{ records_loaded: string; finished_at: string | null }>(
      "SELECT records_loaded::text AS records_loaded, finished_at::text AS finished_at" +
        " FROM load WHERE source::text = 'WELD_DUMP' AND finished_at IS NOT NULL" +
        " ORDER BY id DESC LIMIT 1",
    );
    if (!load[0]) return "no finished WELD_DUMP load in the `load` ledger yet";
    if (Number(load[0].records_loaded) === 0) return "the last WELD_DUMP load loaded 0 rows";
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

const skipReason = await probe();

if (skipReason) {
  console.log(
    `[metrics.test] SKIPPED — no loaded database at ${databaseUrl()}: ${skipReason}\n` +
      `[metrics.test] ${ASSERTIONS} assertions will run once DB-LANE's loader has run.\n` +
      `[metrics.test] Reference: analysis/reconcile_results.json ` +
      `(as_of=${AS_OF}, ${REF.records_after_powerquery_filters} rows after filters).`,
  );
} else {
  console.log(`[metrics.test] LIVE — ${ASSERTIONS} assertions against ${databaseUrl()}`);
}

afterAll(async () => {
  await closePool();
});

// ── the suite ───────────────────────────────────────────────────────────────

describe("source scoping (no database needed)", () => {
  it("every scope emits a `source` predicate, so CCC can never leak in", () => {
    for (const [name, scope] of Object.entries(SCOPES)) {
      const p = new Params();
      const conds = scopeConditions(scope, p);
      expect(
        conds.some((c) => c.includes("source::text = ANY")),
        `${name} must be source-scoped`,
      ).toBe(true);
      // The default is the "EP" family — the Weld Dump alone.
      expect(p.list()[0], `${name} default source`).toEqual([...SOURCES_EP]);
    }
  });
});

describe.skipIf(Boolean(skipReason))("load reproduction", () => {
  it(`keeps ${REF.records_after_powerquery_filters} rows after the Power Query filters`, async () => {
    const rows = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM weld WHERE source::text = 'WELD_DUMP'",
    );
    expect(Number(rows[0].n)).toBe(REF.records_after_powerquery_filters);
  });

  it("matches rows per sub-contractor", async () => {
    const rows = await query<{ sub_contractor: string; n: string }>(
      "SELECT sub_contractor, count(*)::text AS n FROM weld" +
        " WHERE source::text = 'WELD_DUMP' GROUP BY 1",
    );
    const got: Record<string, number> = {};
    for (const r of rows) got[r.sub_contractor] = Number(r.n);
    expect(got).toEqual(REF.rows_per_subcontractor_after_filters);
  });

  it("matches the RT% vocabulary", async () => {
    const rows = await query<{ rt_pct: string | null; n: string }>(
      "SELECT rt_pct::text AS rt_pct, count(*)::text AS n FROM weld" +
        " WHERE source::text = 'WELD_DUMP' GROUP BY 1",
    );
    const got: Record<string, number> = {};
    for (const r of rows) got[r.rt_pct ?? ""] = Number(r.n);
    expect(got).toEqual(REF.rt_pct_vocabulary);
  });

  it("the dump pins are source-scoped: adding CCC cannot move them", async () => {
    // The reference numbers below are all "EP" family. Asking for the same
    // scope with the source spelled out explicitly must give the identical
    // answer, which is what guarantees a CCC load leaves them alone.
    const implicitScope: Scope = { subContractor: "GAC" };
    const explicitScope: Scope = { subContractor: "GAC", sources: SOURCES_EP };
    const [a, b] = await Promise.all([
      weldingStats(implicitScope),
      weldingStats(explicitScope),
    ]);
    expect(a).toEqual(b);
    expect(a.joints_welded).toBe(REF.scopes["GAC/ALL"].joints_welded);
  });

  it("the page-1 EP-scope figures are unchanged by the phase-2 work", async () => {
    // Regression pin for the orchestrator's mid-flight finding: the "PR all"
    // family must not move the "EP" answers. These are the project scope of
    // mockup page 1 over the loaded dump (GAC+TEKFEN+MEDGULF, SC <> Inco).
    const ep: Scope = { sources: SOURCES_EP, excludeSubContractors: ["Inco"] };
    const [w, rt] = await Promise.all([weldingStats(ep), rtStats(ep)]);
    expect(w.joints_welded, "M01 joints welded").toBe(859_151);
    expect(rt.films, "M20 films taken").toBe(244_071);
    expect(rt.films_rejected, "M22 films rejected").toBe(1_350);
    expect(rt.films_all, "M26 all-weld-point films (deliberately ungated)").toBe(338_888);
  });

  it("has the expected max weld_date (the default as_of)", async () => {
    const rows = await query<{ d: string | null }>(
      "SELECT max(weld_date)::text AS d FROM weld WHERE source::text = 'WELD_DUMP'",
    );
    expect(rows[0].d).toBe(REF.max_weld_date_in_file);
  });
});

const PCT_DP = 6;

function expectPct(actual: number | null, expected: number | null, label: string) {
  if (expected === null) {
    expect(actual, label).toBeNull();
  } else {
    expect(actual, label).not.toBeNull();
    expect(actual as number, label).toBeCloseTo(expected, PCT_DP);
  }
}

for (const [name, scope] of Object.entries(SCOPES)) {
  const ref = REF.scopes[name];

  describe.skipIf(Boolean(skipReason))(`scope ${name}`, () => {
    it("welding progress (M01, M03) and the weld-cat / weld-type splits", async () => {
      const [total, byCat, byType] = await Promise.all([
        weldingStats(scope),
        weldingStatsBy(scope, GROUP_WELD_CAT),
        weldTypeDistribution(scope),
      ]);
      expect(total.joints_welded).toBe(ref.joints_welded);
      expect(total.joints_welded_incl_repair_reweld).toBe(
        ref.joints_welded_incl_repair_reweld,
      );

      const cats: Record<string, number> = {};
      for (const [k, v] of byCat) {
        if (v.joints_welded > 0) cats[k ?? ""] = v.joints_welded;
      }
      expect(cats).toEqual(ref.joints_welded_by_weld_cat);

      const types: Record<string, number> = {};
      for (const t of byType) {
        if (t.joints_welded > 0) types[t.weld_type ?? ""] = t.joints_welded;
      }
      expect(types).toEqual(ref.joints_welded_by_weld_type);
    });

    it("RT joints and films (M10, M12, M13, M14, M20, M22, M25, M26)", async () => {
      const [all, rtTypes] = await Promise.all([
        rtStats(scope),
        rtStats({ ...scope, weldTypes: RT_WELD_TYPES }),
      ]);
      expect(all.tested).toBe(ref.rt_tested_joints);
      expect(all.accepted).toBe(ref.rt_accepted_joints);
      expect(all.rejected).toBe(ref.rt_rejected_joints);
      expect(rtTypes.tested).toBe(ref.rt_tested_joints_BW_GW_CLET_MW);
      expect(rtTypes.accepted).toBe(ref.rt_accepted_joints_BW_GW_CLET_MW);
      expect(rtTypes.rejected).toBe(ref.rt_rejected_joints_BW_GW_CLET_MW);
      expectPct(all.rejection_rate_joint, ref.rt_joint_rejection_pct, "rt_joint_rejection_pct");
      expect(all.films).toBe(ref.films_taken_by_joint);
      expect(all.films_accepted).toBe(ref.films_accepted_by_joint);
      expect(all.films_rejected).toBe(ref.films_rejected_by_joint);
      expectPct(all.film_rejection_rate, ref.film_rejection_pct, "film_rejection_pct");
      expect(all.films_all).toBe(ref.films_taken_all_rows);
      expect(all.films_all_rejected).toBe(ref.films_rejected_all_rows);
    });

    it("UT (M30, M31, M33, M37)", async () => {
      const ut = await utStats(scope);
      expect(ut.ut_done).toBe(ref.ut_done);
      expect(ut.ut_accepted).toBe(ref.ut_accepted);
      expect(ut.ut_rejected).toBe(ref.ut_rejected);
      expectPct(ut.ut_rejection_rate_joint, ref.ut_joint_rejection_pct, "ut_joint_rejection_pct");
      expect(Number(ut.ut_weld_length_m.toFixed(2))).toBe(ref.ut_weld_length_m);
    });

    it("RT backlog (M40, M42, M45, M46, M47) and its aging buckets (M51)", async () => {
      const [b, aging] = await Promise.all([
        rtBacklogStats(scope),
        rtBacklogAging(scope, AS_OF),
      ]);
      expect(b.rt_backlog).toBe(ref.rt_backlog_total);
      expect(b.rt100_backlog).toBe(ref.rt100_backlog);
      expect(b.rt_backlog_pwht_y_done).toBe(ref.rt_backlog_plus_pwht_Y_done);
      expect(b.rt_backlog_pwht_n).toBe(ref.rt_backlog_plus_pwht_N);
      expect(b.rt_backlog_pwht_y_not_done).toBe(ref.rt_backlog_and_pwht_Y_not_done);
      expect(nonZero(aging)).toEqual(ref.rt_backlog_aging);
    });

    it("PWHT (M60, M62, M63, M65) and its aging buckets (M66)", async () => {
      const [p, aging] = await Promise.all([
        pwhtStats(scope),
        pwhtBacklogAging(scope, AS_OF),
      ]);
      expect(p.pwht_backlog_all_types).toBe(ref.pwht_backlog_all_types);
      expect(p.pwht_backlog_rt_types).toBe(ref.pwht_backlog_BW_GW_CLET_MW);
      expect(p.pwht_backlog_rt100).toBe(ref.pwht_backlog_by_RT100);
      expect(p.pwht_done).toBe(ref.pwht_done);
      expect(nonZero(aging)).toEqual(ref.pwht_backlog_aging);
    });

    it("the by-RT% breakdown", async () => {
      const [welded, rt, backlog] = await Promise.all([
        weldingStatsBy(scope, GROUP_RT_PCT),
        rtStatsBy(scope, GROUP_RT_PCT),
        rtBacklogStatsBy(scope, GROUP_RT_PCT),
      ]);
      for (const [pct, want] of Object.entries(ref.by_rt_pct)) {
        const key = pct === "(blank)" ? null : pct;
        expect(welded.get(key)?.joints_welded ?? 0, `RT%=${pct} welded`).toBe(
          want.joints_welded,
        );
        expect(rt.get(key)?.tested ?? 0, `RT%=${pct} tested`).toBe(want.tested);
        expect(rt.get(key)?.accepted ?? 0, `RT%=${pct} accepted`).toBe(want.accepted);
        expect(rt.get(key)?.rejected ?? 0, `RT%=${pct} rejected`).toBe(want.rejected);
        expect(
          backlog.get(key)?.rt_backlog ?? 0,
          `RT%=${pct} rt_backlog`,
        ).toBe(want.rt_backlog);
      }
    });
  });
}

/** `analysis/reconcile_check.py` emits only the non-zero aging buckets. */
function nonZero(o: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) if (v !== 0) out[k] = v;
  return out;
}

describe.skipIf(Boolean(skipReason))(
  "per-WPS rejection table — GAC excluding Slug Catcher (mockup page 42)",
  () => {
    it("reproduces every row of reconcile_results.json → wps_gac_nonsg", async () => {
      const rows = await wpsRejectionTable({
        subContractor: "GAC",
        serviceCat: "NONSG",
        excludeWeldTypes: ["DMY"],
        wpsPresent: true,
      });
      const got = new Map(rows.map((r) => [r.wps_no, r]));
      expect([...got.keys()].sort()).toEqual(
        Object.keys(REF.wps_gac_nonsg).sort(),
      );
      for (const [wps, want] of Object.entries(REF.wps_gac_nonsg)) {
        const r = got.get(wps);
        expect(r, `WPS ${wps} missing`).toBeDefined();
        expect(
          {
            joints_welded: r!.joints_welded,
            tested_joints: r!.tested_joints,
            accepted: r!.accepted,
            rejected: r!.rejected,
            rt_total_films: r!.rt_total_films,
            rt_films_A: r!.rt_films_accepted,
            rt_films_R: r!.rt_films_rejected,
          },
          `WPS ${wps}`,
        ).toEqual({
          joints_welded: want.joints_welded,
          tested_joints: want.tested_joints,
          accepted: want.accepted,
          rejected: want.rejected,
          rt_total_films: want.rt_total_films,
          rt_films_A: want.rt_films_A,
          rt_films_R: want.rt_films_R,
        });
        expectPct(r!.rt_ut_ratio, want.rt_ut_ratio_pct, `WPS ${wps} ratio`);
        expectPct(r!.rt_film_ratio, want.rt_film_ratio_pct, `WPS ${wps} film ratio`);
        expectPct(
          r!.rejection_rate_joint,
          want.rejection_rate_joint,
          `WPS ${wps} rejection rate`,
        );
      }
    });
  },
);
