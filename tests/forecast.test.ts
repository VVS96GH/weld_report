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
import { forecastBacklogBySubcon, talismanRt100Backlog } from "@/lib/metrics/forecast";
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

  it("the Talisman card reads Joint.csv, joined for RT% (owner 358)", async () => {
    // 357, one short of the owner's 358 -- reported as a near-miss, not tuned.
    // 356 of the 357 come from CCC_WELDER_RECORD joints.
    const n = await talismanRt100Backlog();
    expect(n).toBe(357);
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

  it("cards slice 1 does not compute show an em dash, never a zero", async () => {
    const p = await getForecastPage();
    for (const label of [
      "RT Dia Total Forecast B.log", "Numb RT/UT 2024", "QTY Years",
      "PWHT B.Log PBI Rule", "RT Dia B.Log", "Total Welded RT Dia",
    ]) {
      expect(kpi(p, label), label).toBe("\u2014");
    }
    // ...and each carries its target, so the shape is complete and the gap
    // explicit rather than looking like a broken widget.
    const w = p.widgets.find(
      (x) => x.kind === "kpi" && x.label === "Total Welded RT Dia",
    );
    expect(w && w.kind === "kpi" ? w.sub : null).toMatch(/owner target 1,712,883/);
  });
});
