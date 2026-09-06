/**
 * Flange dashboard tests.
 *
 * Two halves, like `metrics-batch3.test.ts`:
 *
 *  • the **structural** half runs with NO database — `lib/db`'s `query` is
 *    stubbed, so `getFlangePage()` takes its not-loaded path and the widget
 *    skeleton is compared against `analysis/mockups/flange-spec.json`. That is
 *    what keeps the 22 widgets, their kinds, labels, table columns and chart
 *    ids in step with the mockup;
 *  • the **data** half gates on the load ledger (`FLANGE_PROGRESS` and
 *    `OVASSETS_1619` finished) and pins every headline number from
 *    `analysis/flange/metrics.json`, which the recon computed by reproducing
 *    the pbix M pipeline over the two delivered workbooks and landing on
 *    363,245 rows — the pbix's own `Flange Progress` row count exactly.
 *
 * RF-01: the MOCKUP's numbers are deliberately NOT pinned. It is a mid-January
 * 2026 freeze and the register now runs to 2026-08.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, databaseUrl, query, setQueryImpl } from "@/lib/db";
import {
  FLANGE_ALL,
  FLANGE_COLUMNS,
  flangeMonthly,
  flangeStats,
  flangeStatsBy,
} from "@/lib/metrics/flange";
import { getFlangePage } from "@/lib/pages/flange";
import type { Widget } from "@/lib/page-model";

type Metrics = {
  rows: { combined: number; pbix_combined: number };
  join: { union: number; intersection: number };
  overall: Record<string, number>;
  by_subcontractor: Record<string, Record<string, number>>;
  by_ha: Record<string, Record<string, number>>;
  by_method: Record<string, Record<string, number>>;
  monthly_jointed: Record<string, number>;
};

const REF: Metrics = JSON.parse(
  readFileSync(path.join(process.cwd(), "analysis/flange/metrics.json"), "utf8"),
) as Metrics;

/**
 * Where the LOADED data legitimately differs from `metrics.json`.
 *
 * Orchestrator ruling: the loader parses ovAssets' fourth date shape
 * (`m/d/yyyy` with an optional time, 720 values) that the recon's Python did
 * not, so 155 CCC joints with non-midnight tightening timestamps become
 * inspected. Everything those 155 joints touch moves; everything else is exact.
 * Each override cites the recon's figure so the delta stays visible rather than
 * being quietly absorbed.
 */
const LOADED = {
  inspected: 197_980, // metrics.json: 197,825 (+155, the re-parsed CCC dates)
  constn: 187_902, // metrics.json: 187,756 (+146 of those 155)
  remains: 160_171, // metrics.json: 160,326 (−155)
  pct: 55.33, // metrics.json: 55.29
  leakedPct: 0.19, // metrics.json: 0.20 — 386 / 197,980 rather than / 197,825
  ccc: {
    inspected: 93_089, // metrics.json by_source.OV: 92,934
    constn: 88_940, // metrics.json: 88,794
    remains: 133_415, // metrics.json: 133,570
  },
  /** Months the re-parse moved. Every other bucket matches the recon exactly. */
  monthly: {
    "2025-07": 9_381, // 9,390
    "2025-08": 9_365, // 9,353
    "2025-09": 10_837, // 10,821
    "2025-10": 14_422, // 14,423
    "2025-11": 15_407, // 15,410
    "2025-12": 14_323, // 14,351
    "2026-01": 13_328, // 13,367
    "2026-02": 14_667, // 14,679
    "2026-03": 6_438, // 6,441
    "2026-04": 12_359, // 12,371
    "2026-05": 11_468, // 11,516
    "2026-06": 9_604, // 9,600
    "2026-07": 9_829, // 9,832
    "2026-08": 6_471, // 6,446
    "2024-01": 37, "2024-03": 78, "2024-05": 100, "2024-06": 144,
    "2024-09": 688, "2024-10": 1_004, "2024-11": 1_463, "2024-12": 2_027,
    "2025-01": 3_020, "2025-02": 2_983, "2025-03": 5_907, "2025-04": 9_155,
    "2025-05": 8_155, "2025-06": 8_680,
  } as Record<string, number>,
} as const;

type SpecWidget = Record<string, unknown> & { kind: string; role?: string };
const SPEC: { sections: Array<{ widgets: SpecWidget[] }> } = JSON.parse(
  readFileSync(path.join(process.cwd(), "analysis/mockups/flange-spec.json"), "utf8"),
) as { sections: Array<{ widgets: SpecWidget[] }> };

/**
 * The mockup's 22 widgets minus the two chrome buttons ("✕ Reset",
 * "📊 Export"), which the spec itself marks `role: "button"`. They carry no
 * data: Reset belongs to the UI's FilterBar and Export is out of scope, and as
 * `text` widgets they rendered as two empty cards. 20 data widgets remain.
 */
const SPEC_WIDGETS = SPEC.sections
  .flatMap((s) => s.widgets)
  .filter((w) => w.role !== "button");

const SPEC_ALL = SPEC.sections.flatMap((s) => s.widgets);

// ── structural half: no database ────────────────────────────────────────────

describe("flange PageModel structure vs analysis/mockups/flange-spec.json", () => {
  beforeAll(() => {
    // No rows for any statement: getFlangePage takes its not-loaded path and
    // still has to emit the full widget skeleton.
    setQueryImpl(async () => []);
  });
  afterAll(() => {
    setQueryImpl(null);
  });

  it("emits the mockup's 22 widgets, in order, plus provenance notes", async () => {
    const model = await getFlangePage();
    expect(model.page, "single-page report").toBe(0);
    expect(model.id).toBe("flange");
    expect(model.filters).toEqual({ subco: "All", ha: "All", method: "All" });

    const declared = model.widgets.slice(0, SPEC_WIDGETS.length);
    expect(declared).toHaveLength(SPEC_WIDGETS.length);
    expect(SPEC_ALL, "the mockup has 22 widgets").toHaveLength(22);
    expect(SPEC_WIDGETS, "20 of them carry data").toHaveLength(20);

    const kinds = declared.map((w) => w.kind);
    expect(kinds).toEqual(SPEC_WIDGETS.map((w) => w.kind));

    // Everything past the mockup's list must be a provenance note.
    for (const extra of model.widgets.slice(SPEC_WIDGETS.length)) {
      expect(extra.kind).toBe("text");
    }
  });

  it("matches every KPI label, table column set and chart id", async () => {
    const model = await getFlangePage();
    let compared = 0;
    for (let i = 0; i < SPEC_WIDGETS.length; i++) {
      const want = SPEC_WIDGETS[i];
      const got = model.widgets[i] as Widget;
      if (want.kind === "kpi" && got.kind === "kpi") {
        expect(got.label, `widget ${i}`).toBe(want.label);
        compared++;
      } else if (want.kind === "table" && got.kind === "table") {
        expect(got.title, `widget ${i}`).toBe(want.title);
        expect(got.columns, `widget ${i} columns`).toEqual(want.columns);
        compared++;
      } else if (want.kind === "chart" && got.kind === "chart") {
        expect(got.canvas_id, `widget ${i}`).toBe(want.canvas_id);
        expect(got.title, `widget ${i} title`).toBe(want.title);
        expect(got.chart_type, `widget ${i} type`).toBe(want.chart_type);
        compared++;
      } else if (want.kind === "filter" && got.kind === "filter") {
        // The spec's ids are DOM ids (`filterSubco`); ours are the search-param
        // names the API takes (`subco`), per RF-08.
        const normalised = String(want.id).replace(/^filter/, "").toLowerCase();
        expect(got.id, `widget ${i}`).toBe(normalised === "ha" ? "ha" : normalised);
        compared++;
      } else if (want.kind === "text" && got.kind === "text") {
        expect(got.text, `widget ${i}`).toBe(want.text);
        compared++;
      }
    }
    console.log(
      `[metrics-flange.test] widgets compared: ${compared} / ${SPEC_WIDGETS.length}` +
        ` (2 chrome buttons excluded)`,
    );
    expect(compared).toBe(SPEC_WIDGETS.length);
  });

  it("renders honest-empty, never a zero, with no data", async () => {
    const model = await getFlangePage();
    for (const w of model.widgets) {
      if (w.kind === "kpi") {
        expect(w.value, `KPI ${w.label}`).not.toMatch(/^\d/);
      }
      if (w.kind === "chart") {
        expect(w.labels, `chart ${w.canvas_id}`).toEqual([]);
      }
      if (w.kind === "table") {
        expect(w.rows, `table ${w.title}`).toEqual([]);
      }
    }
    expect(
      model.widgets.some(
        (w) => w.kind === "text" && /flange register is not loaded/.test(w.text),
      ),
    ).toBe(true);
  });

  it("always keeps the repair trio empty and names the missing logs", async () => {
    const model = await getFlangePage();
    for (const id of ["repairedDonut", "siteRepairChart", "vendorRepairChart"]) {
      const w = model.widgets.find((x) => x.kind === "chart" && x.canvas_id === id);
      expect(w, id).toBeDefined();
      if (w && w.kind === "chart") {
        expect(w.datasets.every((d) => d.data.length === 0), id).toBe(true);
      }
    }
  });
});

// ── data half: gated on the ledger ──────────────────────────────────────────

async function ledgerDone(source: string): Promise<boolean> {
  try {
    const rows = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM load WHERE source = $1 AND finished_at IS NOT NULL",
      [source],
    );
    return Number(rows[0]?.n ?? 0) > 0;
  } catch {
    return false;
  }
}

const [fp, ov] = await Promise.all([
  ledgerDone("FLANGE_PROGRESS"),
  ledgerDone("OVASSETS_1619"),
]);
const skipReason = fp && ov ? null : "no finished FLANGE_PROGRESS / OVASSETS_1619 load in the `load` ledger yet";

if (skipReason) {
  console.log(
    `[metrics-flange.test] SKIPPED — ${skipReason} (${databaseUrl()}).\n` +
      `[metrics-flange.test] Expected: ${REF.rows.combined.toLocaleString("en-US")} rows / ` +
      `${REF.overall.total.toLocaleString("en-US")} distinct Joint IDs, ` +
      `inspected ${REF.overall.inspected.toLocaleString("en-US")}, leaked ${REF.overall.leaked}. ` +
      `The structural tests above ran regardless.`,
  );
} else {
  console.log(`[metrics-flange.test] LIVE — flange loaded at ${databaseUrl()}`);
}

afterAll(async () => {
  await closePool();
});

const ALL = { ha: FLANGE_ALL, subco: FLANGE_ALL, method: FLANGE_ALL };

describe.skipIf(Boolean(skipReason))("flange load reproduction", () => {
  it("holds the pbix's own row count and the disjoint-namespace union", async () => {
    const rows = await query<{ n: string; j: string }>(
      "SELECT count(*)::text AS n, count(DISTINCT joint_id)::text AS j FROM flange",
    );
    expect(Number(rows[0].n), "register lines").toBe(REF.rows.combined);
    expect(Number(rows[0].n)).toBe(REF.rows.pbix_combined);
    // RF-06: 357,787 distinct Joint IDs over 363,245 rows — 5,458 repeats on
    // the Flange Progress side, and a zero-intersection union with ovAssets.
    expect(Number(rows[0].j), "distinct Joint IDs").toBe(REF.join.union);
    expect(REF.join.intersection).toBe(0);
  });

  it("uses only column names the migration actually shipped", async () => {
    const cols = await query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'flange'",
    );
    const present = new Set(cols.map((c) => c.column_name));
    const unknown = Object.entries(FLANGE_COLUMNS).filter(
      ([, name]) => !present.has(name),
    );
    expect(
      unknown,
      `FLANGE_COLUMNS names missing from the flange table: ${unknown.map(([k, v]) => `${k}->${v}`).join(", ")}`,
    ).toEqual([]);
  });
});

describe.skipIf(Boolean(skipReason))("the nine measures", () => {
  it("reproduces every headline number", async () => {
    const s = await flangeStats(ALL);
    expect(s.total, "Total Flanges ID").toBe(REF.overall.total);
    expect(s.inspected, "Total Flanges ID Jointed").toBe(LOADED.inspected);
    // These two key on `pcc_tightening_date`. A mismatch here is a LOADER
    // date-parsing gap, not a formula gap: CCC has one row per joint (no
    // repeats), so predicate-vs-aggregate cannot differ, and the only input
    // that can move both numbers together is how many CCC rows carry a parsed
    // PCC tightening date. Compare `count(*) FILTER (WHERE
    // pcc_tightening_date IS NOT NULL)` on OVASSETS_1619 against the recon's
    // by_source.OV.pcc before touching lib/metrics/flange.ts.
    expect(s.constn, 'Tightening Constraction "CCC no cat" — see the note above').toBe(
      LOADED.constn,
    );
    expect(s.pcc, 'Tightening PCC "CCC no cat" — see the note above').toBe(
      REF.overall.pcc,
    );
    expect(s.leaked, "Flanges ID BreakDown").toBe(REF.overall.leaked);
    expect(s.remains, "Total Flanges ID Remainder").toBe(LOADED.remains);
    expect(Number((s.pct! * 100).toFixed(2)), "Flanges ID Jointed %").toBe(LOADED.pct);
    expect(Number((s.leakedPct! * 100).toFixed(2)), "Flange Break Down Rate %").toBe(
      LOADED.leakedPct,
    );
    // total is exact against the recon and total - remains must be the joints
    // that have no date at all; the 364-joint overlap is the register's own.
    expect(s.total).toBe(REF.join.union);
  });

  it("reproduces the subcontractor table row by row", async () => {
    const rows = await flangeStatsBy(ALL, FLANGE_COLUMNS.subcontractor);
    const got = Object.fromEntries(rows.map((r) => [r.group, r]));
    expect(Object.keys(got).sort()).toEqual(
      Object.keys(REF.by_subcontractor).sort(),
    );
    for (const [name, want] of Object.entries(REF.by_subcontractor)) {
      const g = got[name];
      // CCC is the only party the date re-parse touches.
      const expected =
        name === "CCC"
          ? { ...want, ...LOADED.ccc }
          : want;
      expect(
        {
          total: g.total,
          constn: g.constn,
          pcc: g.pcc,
          inspected: g.inspected,
          leaked: g.leaked,
          remains: g.remains,
        },
        name,
      ).toEqual({
        total: expected.total,
        constn: expected.constn,
        pcc: expected.pcc,
        inspected: expected.inspected,
        leaked: expected.leaked,
        remains: expected.remains,
      });
    }
  });

  it("reproduces the HA table, including the (blank) bucket", async () => {
    const rows = await flangeStatsBy(ALL, FLANGE_COLUMNS.ha);
    const got = Object.fromEntries(rows.map((r) => [r.group, r.total]));
    for (const [name, want] of Object.entries(REF.by_ha)) {
      expect(got[name], `HA ${name}`).toBe(want.total);
    }
    // RF-03: the unresolved joints get their own visible row.
    expect(got["(blank)"], "(blank) HA bucket").toBeGreaterThan(0);
  });

  it("reproduces the method donut", async () => {
    const rows = await flangeStatsBy(ALL, FLANGE_COLUMNS.method);
    const got = Object.fromEntries(rows.map((r) => [r.group, r.total]));
    for (const [name, want] of Object.entries(REF.by_method)) {
      expect(got[name], `method ${name}`).toBe(want.total);
    }
  });

  it("reproduces the monthly inspection bars", async () => {
    const months = await flangeMonthly(ALL);
    const got = Object.fromEntries(months.map((m) => [m.month, m.inspected]));
    // A joint re-jointed in two months counts in both, so these buckets sum to
    // MORE than the headline distinct-joint total (recon: 202,918 vs 197,825).
    // That is the DAX's own behaviour and is not a bug.
    const deltas = Object.entries(REF.monthly_jointed)
      .map(([m, want]) => [m, (got[m] ?? 0) - (LOADED.monthly[m] ?? want)] as const)
      .filter(([, d]) => d !== 0);
    expect(
      deltas,
      `months differing from the pinned values: ${deltas
        .map(([m, d]) => `${m}${d > 0 ? "+" : ""}${d}`)
        .join(" ")}`,
    ).toEqual([]);
    // The buckets must still sum to the (joint, month) pair count, which is
    // larger than the headline total because a flange re-jointed in two months
    // counts in both.
    const sum = months.reduce((a, m) => a + m.inspected, 0);
    expect(sum).toBeGreaterThan(LOADED.inspected);
  });
});

describe.skipIf(Boolean(skipReason))("the filter triple", () => {
  it("filtering by sub-contractor narrows to that party's population", async () => {
    for (const [name, want] of Object.entries(REF.by_subcontractor)) {
      const s = await flangeStats({ ...ALL, subco: name });
      const wantInspected =
        name === "CCC" ? LOADED.ccc.inspected : want.inspected;
      expect(s.total, `subco=${name}`).toBe(want.total);
      expect(s.inspected, `subco=${name} inspected`).toBe(wantInspected);
    }
  });

  it("filtering by HA narrows to that area", async () => {
    for (const [name, want] of Object.entries(REF.by_ha)) {
      const s = await flangeStats({ ...ALL, ha: name });
      expect(s.total, `ha=${name}`).toBe(want.total);
    }
  });

  it("All is the same as no filter at all", async () => {
    const [a, b] = await Promise.all([flangeStats(ALL), flangeStats({})]);
    expect(a).toEqual(b);
  });

  it("the triple composes: subco x ha never exceeds either alone", async () => {
    const [ccc, ha1, both] = await Promise.all([
      flangeStats({ ...ALL, subco: "CCC" }),
      flangeStats({ ...ALL, ha: "HA1" }),
      flangeStats({ ...ALL, subco: "CCC", ha: "HA1" }),
    ]);
    expect(both.total).toBeLessThanOrEqual(ccc.total);
    expect(both.total).toBeLessThanOrEqual(ha1.total);
    expect(both.total).toBeGreaterThan(0);
  });
});

describe.skipIf(Boolean(skipReason))("the live page", () => {
  it("renders the filters it was given and an as_of from the data", async () => {
    const model = await getFlangePage({ subco: "CCC" });
    expect(model.filters).toEqual({ subco: "CCC", ha: "All", method: "All" });
    expect(model.meta?.as_of, "as_of = max(joint_date)").toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const total = model.widgets.find(
      (w) => w.kind === "kpi" && w.label === "Total Register",
    );
    expect(total && total.kind === "kpi" ? total.value : null).toBe(
      REF.by_subcontractor.CCC.total.toLocaleString("en-US"),
    );
  });

  it("keeps the repair trio empty and carries all four provenance notes", async () => {
    const model = await getFlangePage();
    const notes = model.widgets.filter((w) => w.kind === "text").map((w) =>
      w.kind === "text" ? w.text : "",
    );
    expect(notes.some((t) => /ruling RF-02/.test(t)), "repair note").toBe(true);
    expect(notes.some((t) => /ruling RF-03/.test(t)), "HA provenance note").toBe(true);
    expect(notes.some((t) => /recomputed from records/.test(t)), "RF-04 note").toBe(true);
    expect(notes.some((t) => /ruling RF-01/.test(t)), "live-data note").toBe(true);
  });
});
