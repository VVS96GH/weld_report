import { describe, expect, it } from "vitest";

import { SCREENS, screenById, screenValues, screenVariantLabel } from "@/lib/screens";

/**
 * Consolidation option A is a pure regrouping of the 44 mockup pages: every page
 * must be reachable from exactly one (screen, filter combination), and no
 * combination may point outside 1..44.
 */
describe("option A screen registry", () => {
  const combos: { screen: string; values: Record<string, string>; pages: number[] | null }[] = [];
  for (const s of SCREENS) {
    const axes = s.filters.map((f) => f.options.map((o) => o.value));
    const cartesian = axes.reduce<string[][]>((acc, opts) => acc.flatMap((row) => opts.map((o) => [...row, o])), [[]]);
    for (const row of cartesian) {
      const values = Object.fromEntries(s.filters.map((f, i) => [f.id, row[i]]));
      combos.push({ screen: s.id, values, pages: s.pages(values) });
    }
  }

  it("covers every mockup page exactly once", () => {
    const hits = new Map<number, string[]>();
    for (const c of combos) for (const p of c.pages ?? []) hits.set(p, [...(hits.get(p) ?? []), `${c.screen}:${JSON.stringify(c.values)}`]);
    for (let p = 1; p <= 44; p++) expect(hits.get(p), `page ${p}`).toHaveLength(1);
    for (const [p, who] of hits) expect(p, who.join()).toBeGreaterThanOrEqual(1);
  });

  it("never resolves outside 1..44 and only the pbix-less combinations are null", () => {
    for (const c of combos) {
      for (const p of c.pages ?? []) {
        expect(p).toBeGreaterThanOrEqual(1);
        expect(p).toBeLessThanOrEqual(44);
      }
    }
    const nulls = combos.filter((c) => c.pages === null).map((c) => `${c.screen} ${c.values.subco} ${c.values.rt ?? ""}`.trim());
    // NDE: 30 % exists for GAC only; PWHT has no 20/30 % pages at all (not offered).
    expect(nulls.sort()).toEqual(["nde CCC 30", "nde MEDGULF 30", "nde TEKFEN 30"]);
  });

  it("falls back to the default when a filter value is unknown", () => {
    const nde = screenById("nde")!;
    expect(screenValues(nde, { subco: "NOPE", rt: "100" })).toEqual({ subco: "CCC", rt: "100" });
    expect(screenVariantLabel(nde, { subco: "GAC", rt: "100" })).toBe("GAC · 100 %");
  });
});
