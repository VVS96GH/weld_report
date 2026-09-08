/**
 * Page 20 "RT Backlog Forecast" — slice 1.
 *
 * Owner values come from a pbix screenshot with every slicer at All. Anything
 * that does not match is reported in the checkpoint with its branch split, and
 * never tuned to hit the target.
 */
import { afterAll, describe, expect, it } from "vitest";
import { closePool, databaseUrl, query } from "@/lib/db";
import { getForecastPage } from "@/lib/pages/forecast";
import {
  diaMonthlyProgress,
  forecastBacklogBySubcon,
  jointMonthlyProgress,
  monthLabel,
  talismanRt100Backlog,
} from "@/lib/metrics/forecast";
import { PROJECT_EXCLUDED_SUBCONTRACTORS, SOURCES_PR_ALL_LOADED } from "@/lib/metrics/scope";

let skipReason: string | null = null;
try {
  const rows = await query<{ n: string }>("SELECT count(*)::text AS n FROM mv_joint");
  if (Number(rows[0]?.n ?? 0) === 0) skipReason = "mv_joint is empty";
} catch (e) {
  skipReason = `no database at ${databaseUrl()}: ${(e as Error).message}`;
}
if (skipReason) console.log(`[forecast.test] SKIPPED — ${skipReason}`);

afterAll(async () => {
  await closePool();
});

const kpi = (p: Awaited<ReturnType<typeof getForecastPage>>, label: string) => {
  const w = p.widgets.find((x) => x.kind === "kpi" && x.label === label);
  return w && w.kind === "kpi" ? w.value : null;
};

describe.skipIf(Boolean(skipReason))("forecast page — slice 1", () => {
  it("has the contract shape: page 0, id forecast, filters first", async () => {
    const p = await getForecastPage();
    expect(p.page).toBe(0);
    expect(p.id).toBe("forecast");
    expect(p.title).toBe("RT Backlog Forecast");
    const bar = p.widgets.slice(0, 7);
    expect(bar.map((w) => w.kind)).toEqual(Array(7).fill("filter"));
    expect(bar.map((w) => (w.kind === "filter" ? w.id : ""))).toEqual([
      "ha", "area", "subco", "byut", "wcat", "rt", "dia",
    ]);
    // The HA-Area pair keeps the hierarchy contract page 1 uses.
    const area = bar[1]!;
    expect(area.kind === "filter" ? area.parent : null).toBe("ha");
    expect(area.kind === "filter" ? area.options_by_parent : null).toBeDefined();
    // Every slicer must actually offer values -- By UT and Dia rendered with
    // only "All" until migration 0033 put their columns on mv_joint.
    for (const w of bar) {
      if (w.kind !== "filter") continue;
      expect(w.options.length, `${w.id} options`).toBeGreaterThan(1);
    }
  });

  it("reproduces the owner's exact cards", async () => {
    const p = await getForecastPage();
    expect(kpi(p, "RT Total Forecast B.log")).toBe("13,606");
    expect(kpi(p, "Total RT/UT Done")).toBe("204,560");
    expect(kpi(p, "RT B.Log")).toBe("672");
  });

  it("the forecast backlog splits by party as the owner's bar chart does", async () => {
    // NOT the RT backlog: this counts NOT-YET-WELDED joints weighted by RT
    // coverage. CCC is 86% of it and read 0 until the joint record's RT/UT(%)
    // was mapped -- that file IS the unwelded population.
    const rows = await forecastBacklogBySubcon({
      sources: SOURCES_PR_ALL_LOADED,
      excludeSubContractors: PROJECT_EXCLUDED_SUBCONTRACTORS,
      temporaryLines: false,
    });
    const by = Object.fromEntries(rows.map((r) => [r.sub_contractor, r.backlog]));
    expect(Math.round(by.CCC!.total)).toBe(11_732);
    expect(Math.round(by.GAC!.total)).toBe(1_335);
    expect(Math.round(by.MEDGULF!.total)).toBe(526);
    expect(Math.round(by.TEKFEN!.total)).toBe(12);
    expect(by.CCC!.joints[100]).toBe(10_158);
    expect(Math.round(by.CCC!.weighted[5]!)).toBe(911);
    expect(rows.reduce((a, r) => a + r.backlog.total, 0)).toBeCloseTo(13_605.65, 2);
  });

  it("the Talisman card reads Joint.csv, joined for RT% = 358", async () => {
    // The last near-miss, solved. `RT% from Project WD+WR` resolves through
    // mv_joint -- except for the four Joint IDs the M step
    // #"EXLUDE 4 RT B.log CCC" removes from the UNION. That step does not
    // filter TALISMAN DATA, so the pbix still resolves their RT% and we could
    // not. All four are in Joint.csv with a weld date and a blank RT1 REP NO,
    // and exactly one (11060A4-PR6206008-SP3-11) carries RT/UT(%) = 100 --
    // found by streaming the raw 1.5 GB welder CSV, and the whole of 357 vs 358.
    const n = await talismanRt100Backlog();
    expect(n).toBe(358);
    const [r] = await query<{ rows: string; joints: string }>(
      "SELECT count(*)::text AS rows, count(DISTINCT joint_id)::text AS joints" +
        "  FROM ref_talisman_joint",
    );
    expect(Number(r.joints)).toBe(1_506_025);
    // Rows flagged D are dropped by the loader, as the pbix M does.
    const [d] = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM ref_talisman_joint" +
        " WHERE orig_repair_delete_flag = 'D'",
    );
    expect(Number(d.n)).toBe(0);

    // The excluded joints stay OUT of the union -- the M means them to, and the
    // RT backlog of 672 depends on it. Only their RT% is recorded, for this
    // one lookup.
    const [x] = await query<{ in_weld: string; with_pct: string }>(
      "SELECT (SELECT count(*) FROM weld w JOIN weld_manual_exclusion e" +
        "         ON e.joint_id = w.joint_id)::text AS in_weld," +
        "       (SELECT count(*) FROM weld_manual_exclusion" +
        "         WHERE rt_pct = 100)::text AS with_pct",
    );
    expect(Number(x.in_weld), "excluded joints must never enter weld").toBe(0);
    expect(Number(x.with_pct), "exactly one of the four is RT 100%").toBe(1);
  });

  it("every slicer narrows the forecast, and Inco is never in scope", async () => {
    const all = await getForecastPage();
    const base = Number(kpi(all, "RT Total Forecast B.log")!.replace(/,/g, ""));
    for (const filters of [
      { subco: "GAC" }, { dia: "0-20" }, { wcat: "F" }, { rt: "100" },
    ]) {
      const p = await getForecastPage(filters);
      const v = Number(kpi(p, "RT Total Forecast B.log")!.replace(/,/g, ""));
      expect(v, JSON.stringify(filters)).toBeLessThan(base);
    }
    // The page filters Inco out entirely, so it is not even a slicer option.
    const subco = all.widgets.find((w) => w.kind === "filter" && w.id === "subco");
    expect(subco?.kind === "filter" ? subco.options : []).not.toContain("INCO");
  });

  it("every card is computed, and the exact ones match the owner", async () => {
    const p = await getForecastPage();
    // Exact against the owner's screenshot.
    expect(kpi(p, "RT Dia Total Forecast B.log")).toBe("124,613");
    // One measure, two cards, two visual filters -- both are rendered.
    expect(kpi(p, "RT Avrg Prod-on 2024-26 per Month")).toBe("5,324");
    expect(kpi(p, "RT Avrg Prod-on (week-end filtered)")).toBe("5,202");
    expect(kpi(p, "QTY Years")).toBe("0.21");
    expect(kpi(p, "Months to keep RT B.log")).toBe("0.13");
    expect(kpi(p, "Months to keep Dia RT B.log")).toBe("0.13");
    expect(kpi(p, "PWHT B.Log PBI Rule")).toBe("1,038");
    // Solved in slice 4: [RT BACKLOG Dia Total Project "PR all"] is TWO added
    // row-level sums -- a 16-code hold list (no 'T1-2') plus an RT%=100 branch
    // admitting only {?, ""} (no 'S') -- not the joint backlog flag, which gave
    // 6,958. 6,811.00 + 20.50 = 6,831.50.
    expect(kpi(p, "RT Dia B.Log")).toBe("6,832");
    expect(kpi(p, "RT B.Log Talisman")).toBe("358");
    // Nothing is left as a placeholder any more.
    for (const w of p.widgets) {
      if (w.kind !== "kpi") continue;
      expect(w.sub ?? "", `${w.label} still a placeholder`).not.toMatch(/slice \d/);
    }
  });

  it("the four near-misses say so ON THE CARD, and are not tuned", async () => {
    // Reported, never adjusted to hit the target. The branch split behind each
    // is in lib/metrics/README.md.
    const p = await getForecastPage();
    const cases: Array<[string, string, string]> = [
      ["Numb RT/UT 2024", "172,521", "172,520"],
      ["Total Welded RT Dia", "1,712,463", "1,712,883"],
      ["RT Dia Avrg Prod-on", "50,941", "50,954"],
    ];
    for (const [label, ours, owner] of cases) {
      expect(kpi(p, label), label).toBe(ours);
      const w = p.widgets.find((x) => x.kind === "kpi" && x.label === label);
      expect(
        w && w.kind === "kpi" ? w.sub : null,
        `${label} must disclose the difference`,
      ).toContain(owner);
    }
  });

  it("each card takes its OWN visual filter, on the week end not the date", async () => {
    // report-inventory.md §20 gives every card its own visual-level filter, on
    // Calendar[Week_End_Date] rather than on the date column. Across the year
    // boundary those are different sets: RT dates 2023-12-29..31 fall in the
    // week ending 2024-01-04 and so PASS `> 2024-01-01`, where the date filter
    // drops them. That is 368 joints and 6,614 dia inch, and it is the whole of
    // the movement from 172,153 -> 172,521 and 1,705,849 -> 1,712,463.
    //
    // Two relationships, and different cards use different ones: the two
    // Numb RT/UT cards and the dia TOTAL read the RT-date week end; the two
    // averages read the weld-date week end.
    const [r] = await query<Record<string, string>>(
      "SELECT count(*) FILTER (WHERE is_tested_prall" +
        "   AND rt_week_end > DATE '2024-01-01')::text AS by_week," +
        " count(*) FILTER (WHERE is_tested_prall" +
        "   AND rt_year >= 2024)::text AS by_year," +
        " count(*) FILTER (WHERE is_tested_prall AND rt_year = 2023" +
        "   AND rt_week_end > DATE '2024-01-01')::text AS boundary" +
        " FROM mv_joint WHERE source::text IN " +
        "('WELD_DUMP','CCC_WELDER_RECORD','CCC_JOINT_RECORD','ACCIONA')" +
        "   AND sub_contractor IS DISTINCT FROM 'INCO' AND NOT temporary_lines",
    );
    expect(Number(r.by_week)).toBe(172_521);
    expect(Number(r.by_year)).toBe(172_153);
    expect(Number(r.boundary), "the year-boundary week").toBe(368);
    expect(Number(r.by_year) + Number(r.boundary)).toBe(Number(r.by_week));
  });

  it("PWHT (New PBI Rule) differs from the standard rule by exactly 4 joints", async () => {
    // The NEW rule's CCC term is 542 where [PWHT Y/N CCC] gives 546; the
    // non-CCC term (496) is identical. 542 + 496 = 1,038, the owner's card.
    // Branch order in the 16-branch IF is load-bearing -- the 13-joint
    // whitelist wins outright and DS-04 for SS precedes the general SS group.
    const [r] = await query<Record<string, string>>(
      "SELECT count(*) FILTER (WHERE pwht_backlog_ccc_new)::text AS ccc_new," +
        " count(*) FILTER (WHERE pwht_backlog_ccc)::text AS ccc_old," +
        " count(*) FILTER (WHERE pwht_backlog_rest)::text AS rest" +
        " FROM mv_joint WHERE source::text IN " +
        "('WELD_DUMP','CCC_WELDER_RECORD','CCC_JOINT_RECORD','ACCIONA')" +
        "   AND sub_contractor IS DISTINCT FROM 'INCO' AND NOT temporary_lines",
    );
    expect(Number(r.ccc_new)).toBe(542);
    expect(Number(r.ccc_old)).toBe(546);
    expect(Number(r.rest)).toBe(496);
    expect(Number(r.ccc_new) + Number(r.rest)).toBe(1_038);
  });

  it("the monthly charts declare both stacking axes", async () => {
    // Without "stacked (y)" ChartCard draws grouped bars; the pbix stacks F+S.
    const p = await getForecastPage();
    for (const id of ["forecast_joint_monthly", "forecast_dia_monthly"]) {
      const c = p.widgets.find((w) => w.kind === "chart" && w.canvas_id === id);
      expect(c?.kind === "chart" ? c.options_notes : null, id).toBe(
        "stacked (x), stacked (y)",
      );
    }
  });

  it("the monthly charts run from Jan 2024, stacked F/S, every month shown", async () => {
    const p = await getForecastPage();
    for (const id of ["forecast_joint_monthly", "forecast_dia_monthly"]) {
      const c = p.widgets.find((w) => w.kind === "chart" && w.canvas_id === id);
      expect(c?.kind, id).toBe("chart");
      if (!c || c.kind !== "chart") continue;
      expect(c.labels[0]).toBe("Jan 2024");
      expect(c.datasets.map((d) => d.label)).toEqual(["F", "S"]);
      expect(c.options_notes).toContain("stacked");
      // Consecutive months, no gaps -- the owner's screenshot labels alternate
      // months, but the measure has a value for every one.
      expect(c.labels.length).toBeGreaterThanOrEqual(30);
    }
  });

  it("the joint series carries the owner's values, at alternate months", async () => {
    // KEY FINDING. The owner's transcription samples EVERY SECOND month -- the
    // chart's axis labels alternate -- so a position-by-position comparison
    // fails while the values themselves match. Ours, from Jan 2024:
    //   7211 5962 6584 5379 5496 4891 6246 6287 6556 6640 8188 8581 9606 ...
    // and the owner's Feb..Jul 2024 list (6584 5496 6247 6556 8188 9606) is
    // exactly our Mar, May, Jul, Sep, Nov 2024 and Jan 2025.
    //
    // Pinned as OUR series (a regression pin), plus the alignment itself, so
    // neither can drift. Nothing is tuned to the owner's month labels.
    const scope = {
      sources: SOURCES_PR_ALL_LOADED,
      excludeSubContractors: PROJECT_EXCLUDED_SUBCONTRACTORS,
      temporaryLines: false,
    };
    const pts = await jointMonthlyProgress(scope);
    const by = Object.fromEntries(pts.map((x) => [x.month, x.total]));
    expect(by["2024-01"]).toBe(7_211);
    expect(by["2024-03"]).toBe(6_584);
    expect(by["2024-05"]).toBe(5_496);
    expect(by["2024-09"]).toBe(6_556);
    expect(by["2024-11"]).toBe(8_188);
    expect(by["2025-01"]).toBe(9_606);
    expect(by["2025-02"]).toBe(7_164);
    expect(by["2025-12"]).toBe(3_210);

    // Every owner value the alternate-month reading predicts, within 4 joints.
    const owner: Array<[string, number]> = [
      ["2024-03", 6_584], ["2024-05", 5_496], ["2024-07", 6_247],
      ["2024-09", 6_556], ["2024-11", 8_188], ["2025-01", 9_606],
      ["2025-03", 5_419], ["2025-05", 7_110], ["2025-07", 7_684],
      ["2025-09", 6_031], ["2025-11", 5_315], ["2026-02", 1_960],
      ["2026-06", 2_119], ["2026-08", 1_086],
    ];
    for (const [month, want] of owner) {
      expect(Math.abs((by[month] ?? 0) - want), `${month}`).toBeLessThanOrEqual(4);
    }
    expect(monthLabel("2024-01")).toBe("Jan 2024");
  });

  it("the dia series matches the owner's to better than 0.05 %", async () => {
    // Same alternate-month reading. The residuals are 1-30 on values near
    // 70,000, consistent with reading data labels off a chart rather than with
    // a different measure.
    const pts = await diaMonthlyProgress({
      sources: SOURCES_PR_ALL_LOADED,
      excludeSubContractors: PROJECT_EXCLUDED_SUBCONTRACTORS,
      temporaryLines: false,
    });
    const by = Object.fromEntries(pts.map((x) => [x.month, Math.round(x.total)]));
    expect(by["2024-01"]).toBe(72_433);
    expect(by["2025-01"]).toBe(88_282);
    for (const [month, want] of [
      ["2024-01", 72_432], ["2024-03", 73_855], ["2024-11", 87_726],
      ["2025-01", 88_282], ["2025-03", 55_281], ["2025-05", 60_637],
    ] as Array<[string, number]>) {
      const got = by[month] ?? 0;
      expect(Math.abs(got - want) / want, `${month}`).toBeLessThan(0.0005);
    }
  });
});
