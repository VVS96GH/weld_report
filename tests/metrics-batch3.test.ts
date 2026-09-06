/**
 * Batch-3 integration test: ACCIONA in project scope, INCO out of it.
 *
 * Two halves:
 *
 *  • the scope-predicate half runs with NO database — it proves that every
 *    project-scope query carries the INCO exclusion, which is the whole of
 *    ruling R3-01 and the thing most likely to rot silently (the predicate is
 *    a string in one helper; nothing else would notice if it stopped matching);
 *  • the data half gates on the load ledger, exactly like the CCC suite, and
 *    pins the delivered row counts: ACCIONA 13,313 rows / 13,313 joints (one
 *    row per joint), INCO 10,327 rows / 7,238 joints (joint × RT-fragment).
 *
 * R3-01 is a QUERY-layer rule on purpose: the pbix puts it in 69 visual/page
 * filters, and `[Total Scope Dia "BW" "PR all"]` includes Inco explicitly, so
 * the exclusion cannot live in the loader without breaking that measure.
 */

import { afterAll, describe, expect, it } from "vitest";
import { closePool, databaseUrl, query } from "@/lib/db";
import {
  Params,
  PROJECT_EXCLUDED_SUBCONTRACTORS,
  projectScope,
  scopeConditions,
  scopeWhere,
} from "@/lib/metrics/scope";
import { weldingStats } from "@/lib/metrics/welding";
import { utCoverage, utStatsPrAll } from "@/lib/metrics/ut";
import { rtStatsPrAll } from "@/lib/metrics/rt";
import { measureScope } from "@/lib/metrics/scope";
import { getWeldingPage } from "@/lib/pages/welding";

/** `analysis/sources3/plan.md` — the delivered populations. */
const ACCIONA_ROWS = 13_313;
// 13,312, not 13,313: the source workbook carries one duplicated joint id
// (31941A2-IA6594838-02-…-05-FJ-81 appears twice) — DB-LANE finding F1, batch 3.
const ACCIONA_JOINTS = 13_312;
const INCO_ROWS = 10_327;
const INCO_JOINTS = 7_238;

// ── the half that needs no database ─────────────────────────────────────────

describe("R3-01 — project scope excludes INCO, includes ACCIONA", () => {
  it("projectScope() emits the INCO exclusion", () => {
    const p = new Params();
    const conds = scopeConditions(projectScope(), p);
    const sql = conds.join(" AND ");
    expect(sql).toContain("sub_contractor");
    expect(p.list()).toContainEqual([...PROJECT_EXCLUDED_SUBCONTRACTORS]);
  });

  it("keeps ACCIONA inside project scope", () => {
    // Mockup page 2 has an Acciona row and no Inco row. If ACCIONA ever ends up
    // in the exclusion list, that row silently disappears.
    expect(PROJECT_EXCLUDED_SUBCONTRACTORS).not.toContain("ACCIONA");
    expect(PROJECT_EXCLUDED_SUBCONTRACTORS).not.toContain("Acciona");
  });

  it("covers both spellings of the party", () => {
    // R2-08 canonicalises to upper-case `INCO`; the DAX filters read `Inco`.
    // A single-spelling predicate stops excluding anything the day the other
    // spelling appears — which is exactly how this nearly shipped.
    expect(PROJECT_EXCLUDED_SUBCONTRACTORS).toContain("INCO");
    expect(PROJECT_EXCLUDED_SUBCONTRACTORS).toContain("Inco");
  });

  it("NULL sub_contractor survives the exclusion (DAX blank rules, §0.2)", () => {
    const p = new Params();
    const where = scopeWhere(projectScope(), p);
    expect(where).toContain("sub_contractor IS NULL OR NOT");
  });

  it("does not leak into per-subcontractor scopes", () => {
    const p = new Params();
    const where = scopeWhere({ subContractor: "GAC" }, p);
    expect(where).not.toContain("IS NULL OR NOT");
  });
});

// ── the half that needs the data ────────────────────────────────────────────

async function loadedRows(source: string): Promise<number | null> {
  try {
    const rows = await query<{ n: string }>(
      "SELECT records_loaded::text AS n FROM load" +
        " WHERE source = $1 AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1",
      [source],
    );
    return rows[0] ? Number(rows[0].n) : null;
  } catch {
    return null;
  }
}

const acciona = await loadedRows("ACCIONA");
const inco = await loadedRows("INCO");
const skipReason =
  acciona === null || inco === null
    ? "no finished ACCIONA / INCO load in the `load` ledger yet"
    : null;

if (skipReason) {
  console.log(
    `[metrics-batch3.test] SKIPPED — ${skipReason} (${databaseUrl()}).\n` +
      `[metrics-batch3.test] Expected: ACCIONA ${ACCIONA_ROWS.toLocaleString("en-US")} rows / ` +
      `${ACCIONA_JOINTS.toLocaleString("en-US")} joints, INCO ${INCO_ROWS.toLocaleString("en-US")} rows / ` +
      `${INCO_JOINTS.toLocaleString("en-US")} joints. The scope-predicate tests above ran regardless.`,
  );
} else {
  console.log(`[metrics-batch3.test] LIVE — ACCIONA and INCO loaded at ${databaseUrl()}`);
}

afterAll(async () => {
  await closePool();
});

describe.skipIf(Boolean(skipReason))("batch-3 load reproduction", () => {
  it("holds the delivered row and joint counts", async () => {
    const rows = await query<{ source: string; n: string; j: string }>(
      "SELECT source::text AS source, count(*)::text AS n," +
        " count(DISTINCT joint_id)::text AS j FROM weld" +
        " WHERE source::text IN ('ACCIONA','INCO') GROUP BY 1",
    );
    const got: Record<string, { n: number; j: number }> = {};
    for (const r of rows) got[r.source] = { n: Number(r.n), j: Number(r.j) };
    // R3-02: Acciona is one row per joint; Inco is joint × RT-fragment.
    expect(got.ACCIONA).toEqual({ n: ACCIONA_ROWS, j: ACCIONA_JOINTS });
    expect(got.INCO).toEqual({ n: INCO_ROWS, j: INCO_JOINTS });
  });

  it("fills weldpoint_seq for both sources, or M33 silently drops them", async () => {
    // `weldpoint_seq` is the pbix column `[WeldPoint No.1 WP1]` — NOT
    // `[WeldPoint No.]`, which is `weldpoint_no` and is what the film gate uses
    // (migration 0017). It survives in one measure: `ut_weld_length_m_prall`
    // (M33 `[UT Weld Length by Joint "PR all"]`), whose DAX filters that column
    // by name. It is loader-materialised; if the Acciona/Inco loaders leave it
    // NULL the gate never matches and M33 silently drops those sources instead
    // of failing.
    const rows = await query<{ source: string; missing: string }>(
      "SELECT source::text AS source, count(*) FILTER (WHERE weldpoint_seq IS NULL)::text AS missing" +
        "  FROM weld WHERE source::text IN ('ACCIONA','INCO') GROUP BY 1",
    );
    for (const r of rows) {
      expect(Number(r.missing), `${r.source} rows with a NULL weldpoint_seq`).toBe(0);
    }
  });
});

describe.skipIf(Boolean(skipReason))("project scope over the real data", () => {
  it("excludes every INCO joint and keeps every ACCIONA one", async () => {
    const [project, incoOnly, accionaOnly] = await Promise.all([
      weldingStats(projectScope()),
      weldingStats({ ...projectScope(), subContractor: "INCO" }),
      weldingStats({ ...projectScope(), subContractor: "ACCIONA" }),
    ]);
    // The exclusion wins over an explicit sub-contractor filter, so an INCO
    // slice of project scope is empty by construction.
    expect(incoOnly.joints_welded, "INCO inside project scope").toBe(0);
    expect(accionaOnly.joints_welded, "ACCIONA inside project scope").toBeGreaterThan(0);
    expect(project.joints_welded).toBeGreaterThanOrEqual(accionaOnly.joints_welded);
  });

  it("project totals move by exactly the INCO population when it is let back in", async () => {
    const withInco = await weldingStats({
      sources: projectScope().sources,
    });
    const withoutInco = await weldingStats(projectScope());
    const incoAlone = await weldingStats({
      sources: projectScope().sources,
      subContractor: "INCO",
    });
    expect(withInco.joints_welded - withoutInco.joints_welded).toBe(
      incoAlone.joints_welded,
    );
    expect(incoAlone.joints_welded).toBeGreaterThan(0);
  });
});

describe.skipIf(Boolean(skipReason))("page 2's sub-contractor table", () => {
  it("has an Acciona row and no Inco row", async () => {
    const rows = await query<{ sub_contractor: string }>(
      `SELECT DISTINCT w.sub_contractor FROM mv_joint w` +
        ` WHERE ${scopeWhere(projectScope({ temporaryLines: false }), new Params())}` +
        ` ORDER BY 1`,
      [[...projectScope().sources!], [...PROJECT_EXCLUDED_SUBCONTRACTORS], false],
    );
    const parties = rows.map((r) => r.sub_contractor);
    expect(parties).toContain("ACCIONA");
    expect(parties).not.toContain("INCO");
    expect(parties).not.toContain("Inco");
  });
});


// ── the fabricated-zero regression ──────────────────────────────────────────
//
// This bug shipped twice, both times because an EXISTENCE check stood in for a
// COVERAGE check. First "is ref_ut_tracker_ccc loaded?" — true while the
// overlay was NULL on every weld row. Then "does any in-scope row have the
// overlay?" — true the moment INCO's 441 rows landed, and INCO is excluded from
// project scope, so the KPIs computed over nothing and rendered 0.

describe.skipIf(Boolean(skipReason))("UT coverage is per source, not existence", () => {
  it("partitions every in-scope sub-contractor into covered / uncovered", async () => {
    // Coverage is keyed on SUB-CONTRACTOR, because that is what the DAX
    // branches key on: GAC / TEKFEN / MEDGULF all live in WELD_DUMP and only
    // MEDGULF lacks a branch.
    const cov = await utCoverage(projectScope());
    const inScope = await query<{ source: string }>(
      "SELECT DISTINCT sub_contractor AS source FROM mv_joint" +
        " WHERE sub_contractor IS NOT NULL ORDER BY 1",
    );
    const all = inScope
      .map((r) => r.source)
      .filter((sourceName) => sourceName !== "INCO"); // R3-01
    console.log(
      `[metrics-batch3.test] UT covered: ${cov.covered.join(", ") || "(none)"} · ` +
        `uncovered: ${cov.uncovered.join(", ") || "(none)"} · ` +
        `length covered: ${cov.lengthCovered.join(", ") || "(none)"}`,
    );
    expect([...cov.covered, ...cov.uncovered].sort()).toEqual(all.sort());
  });

  it("never reports INCO as covered inside project scope", async () => {
    // INCO is the only source with the overlay materialised today, and it is
    // excluded — so its presence must not make the scope look covered.
    const cov = await utCoverage(projectScope());
    expect(cov.covered).not.toContain("INCO");
    expect(cov.uncovered).not.toContain("INCO");
  });
});

describe.skipIf(Boolean(skipReason))("no KPI renders a fabricated zero", () => {
  it("the UT cards follow their coverage set in BOTH directions", async () => {
    // The real invariant, not "no zeros anywhere": a metric may render 0 only
    // when something was actually measured. With coverage it must show a
    // number — including a legitimate 0.00%, which is what CCC's 30 rejected
    // joints (0.088986 m over 18,463.01 m inspected = 0.000482%) round to at
    // the mockup's 2 dp. Without coverage it must show the em-dash.
    const cov = await utCoverage(projectScope());
    const model = await getWeldingPage(1);
    const kpis = new Map(
      model.widgets
        .filter((w): w is Extract<typeof w, { kind: "kpi" }> => w.kind === "kpi")
        .map((w) => [w.label, w.value]),
    );
    const utCards = ['Numb UT/PAUT', 'UT/PAUT "A"', 'UT/PAUT "R"', "UT Def.Length"];
    for (const label of utCards) {
      const value = kpis.get(label);
      if (cov.covered.length === 0) {
        expect(value, `${label} with no covered source`).toBe("\u2014");
      } else {
        expect(value, `${label} with coverage ${cov.covered.join(",")}`).not.toBe("\u2014");
      }
    }
    for (const label of ["UT Insp Len", "UT Rej% Len"]) {
      const value = kpis.get(label);
      if (cov.lengthCovered.length === 0) {
        expect(value, `${label} with no length coverage`).toBe("\u2014");
      } else {
        expect(value, `${label} with length coverage`).not.toBe("\u2014");
      }
    }
  });

  it("M91 stays an em-dash — its register is still missing", async () => {
    const model = await getWeldingPage(1);
    const m91 = model.widgets.find(
      (w) => w.kind === "kpi" && w.label === "WPS Approved",
    );
    expect(m91 && m91.kind === "kpi" ? m91.value : null).toBe("\u2014");
  });

  it("page 2 shows no bare-zero cell in a metric column", async () => {
    const model = await getWeldingPage(2);
    for (const w of model.widgets) {
      if (w.kind !== "table") continue;
      for (const row of w.rows) {
        for (const cell of row.slice(1)) {
          expect(cell, `${w.title} row ${row[0]}`).not.toBe("0");
        }
      }
    }
  });
});

describe.skipIf(Boolean(skipReason))("the welding-status pivots filter Weld Cat IN {F,S}", () => {
  it("drops CCC's `J` category, as the pbix visuals do", async () => {
    // Evidence: report-inventory.md page 22 pivots 7feb0e7f… / 3d74883e…, page
    // 23 pivots eb6ba97e… / da743b15…, each `Weld Cat IN {F, S}`. `J` is a
    // Talisman-only value (92,240 + 22,442 rows) that no other source uses.
    const j = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM mv_joint WHERE weld_cat = 'J'",
    );
    expect(Number(j[0].n), "J joints exist, so the filter is load-bearing").toBeGreaterThan(0);
    const model = await getWeldingPage(2);
    for (const w of model.widgets) {
      if (w.kind !== "table" || !/Welding Status/.test(w.title)) continue;
      expect(w.rows.map((r) => r[0]), w.title).not.toContain("J");
    }
  });
});


// ── the user's pbix readings ────────────────────────────────────────────────
//
// Three figures a user read out of the live pbix. They are pinned here because
// they are the only external check this layer has on the "PR all" family, and
// two of them caught real bugs: M70 was reading the imported MT/PT columns
// instead of the calculated `* Report "PR All"` coalesce, and M32 was reading
// only the CCC tracker overlay instead of the DAX's per-sub-contractor
// branches.
//
// NOTE the differing Inco treatment, reported not tuned: our MT+PT matches the
// pbix only with Inco EXCLUDED, while our UT matches it only with Inco
// INCLUDED. Both cannot be the same filter context, so at least one of the
// user's readings was taken on a page carrying the Inco filter.

describe.skipIf(Boolean(skipReason))("pbix cross-check (user readings)", () => {
  it('MT + PT "PR all": 595,251 with Inco, 589,067 without (pbix 589,065)', async () => {
    const all = await weldingStats(measureScope(), "PR_ALL");
    const noInco = await weldingStats(projectScope(), "PR_ALL");
    expect(all.mt_pt_done, "all sources").toBe(595_251);
    // The CARD's value: the report owner ruled Inco is not counted in this
    // measure, so this is the one page-1 card that excludes it.
    expect(noInco.mt_pt_done, "the card's value, Inco excluded").toBe(589_067);
    // THE ODD ONE OUT, reported not tuned. The other three user readings match
    // with Inco INCLUDED; this one matches only with Inco EXCLUDED. The gap is
    // exactly Inco's own contribution:
    //   595,251 - 589,067 = 6,184 = 2 x 3,092 Inco joints (one source column,
    //   `PT/MT Report`, feeds BOTH mt_report and pt_report —
    //   analysis/sources3/inco-column-map.md row 32, 4,912 non-blank rows).
    // The report owner ruled that Inco is simply not counted in this measure,
    // which closes the question; the remaining +2 against the pbix is
    // unexplained and deliberately not tuned away.
    expect(all.mt_pt_done - noInco.mt_pt_done).toBe(6_184);
  });

  it('Numb RT/UT "PR all" = 207,682 (pbix 207,682, bit-for-bit)', async () => {
    // ACCIONA 1,572 + CCC 135,007 + GAC 38,761 + INCO 3,122 + MEDGULF 6,090
    // + TEKFEN 23,130. This is the measure page 1's "RT Acc.Joints" card is
    // bound to — the label says "Acc." but the pbix shows the TESTED count.
    const all = await rtStatsPrAll(measureScope());
    expect(all.tested).toBe(207_682);
    const noInco = await rtStatsPrAll(projectScope());
    expect(noInco.tested, "Inco excluded").toBe(204_560);
  });

  it('Joint Uniq "PR all" Welded over ALL sources = 2,209,169 (pbix 2,209,156)', async () => {
    const s = await weldingStats({ sources: projectScope().sources }, "PR_ALL");
    // +13 against the pbix. Documented, not tuned: the register has moved since
    // the pbix's last refresh and this layer counts what is loaded.
    expect(s.joints_welded).toBe(2_209_169);
  });

  it('Numb UT "PR All" = 14,214 (pbix 14,214, bit-for-bit)', async () => {
    // GAC 2,034 + TEKFEN 2,545 + CCC 9,412 + INCO 223. The measure-level value
    // includes Inco; page 1 applies project scope and shows 13,991.
    const all = await utStatsPrAll({ sources: projectScope().sources });
    expect(all.ut_done).toBe(14_214);
    const scoped = await utStatsPrAll(projectScope());
    expect(scoped.ut_done, "page-1 card, Inco excluded").toBe(13_991);
  });

  it('RT Total Films by Joint "PR all" = 768,101 (pbix 768,101, bit-for-bit)', async () => {
    // Migration 0017. The gate is `weldpoint_no = 1` for EVERY source — the
    // DAX's own [WeldPoint No.] column — not the per-source CASE that 0013/0016
    // used. A + B - C = 365,490.2136 + 512,327.6100 - 109,717.2150
    //                 = 768,100.6086 -> 768,101.
    // With the old CASE gate it was 766,287, wrong by 1,813.
    const all = await rtStatsPrAll(measureScope());
    expect(Math.round(all.films)).toBe(768_101);
  });

  it('RT Total Films by Joint "PR all" "R" = 2,152 (pbix 2,152, bit-for-bit)', async () => {
    // This measure is UNGATED in the DAX — no WeldPoint filter at all, only
    // <> "Exclude UT Films", <> "RS", <> "U/Review", <> "Exclude Films:Debris".
    // Page 1's "Rej Films" card is bound to it at measure scope (Inco IN).
    // ACCIONA 19 + CCC 606 + GAC 598 + INCO 77.9996 + MEDGULF 44 + TEKFEN 807.
    // The total is genuinely fractional (Inco's source values are); the card
    // rounds it for display.
    const all = await rtStatsPrAll(measureScope());
    expect(all.films_rejected).toBeCloseTo(2_151.9996, 4);
    expect(Math.round(all.films_rejected)).toBe(2_152);
  });

  it('%RT FILM Rej "PR all" = 2,152 / 768,101 = 0.28%', async () => {
    // [RT FILM Ratio % by Joint "PR all"] is literally
    //   [RT Total Films by Joint "PR all" "R"] / [RT Total Films by Joint "PR all"]
    // so the card moves from 0.20% to 0.28% with the 0017 gate correction.
    const all = await rtStatsPrAll(measureScope());
    const rate = all.film_rejection_rate;
    expect(rate, "the ratio must not be blank").not.toBeNull();
    expect(rate!).toBeCloseTo(2_151.9996 / 768_100.6086, 9);
    expect((rate! * 100).toFixed(2)).toBe("0.28");
  });

  it("UT coverage names GAC and TEKFEN as covered, MEDGULF and ACCIONA as not", async () => {
    // The old note blamed the missing GAC/TEKFEN tracker workbooks. That is the
    // wrong premise for this measure: the DAX's GAC and TEKFEN branches never
    // read a tracker — they read the dump's own ut_report / manual_ut_report_no.
    const cov = await utCoverage(projectScope());
    expect(cov.covered).toEqual(expect.arrayContaining(["GAC", "TEKFEN", "CCC"]));
    expect(cov.uncovered).toEqual(expect.arrayContaining(["MEDGULF", "ACCIONA"]));
    expect(cov.covered).not.toContain("MEDGULF");
  });
});
