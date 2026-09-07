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

import { readFileSync } from "node:fs";
import path from "node:path";
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
import { rtStatsPrAll, fabricatedBacklogPrAll } from "@/lib/metrics/rt";
import {
  measureScope,
  PWHT_BACKLOG_STATUS_PRALL,
  RT_BACKLOG_STATUS,
  RT_BACKLOG_STATUS_PRALL,
  RT_WELD_TYPES,
  SOURCES_PR_ALL_LOADED,
} from "@/lib/metrics/scope";
import { getWeldingPage } from "@/lib/pages/welding";
import { approvedWpsCount } from "@/lib/metrics/refs";
import {
  rtBacklogCurrent,
  pwhtBacklogCurrent,
  weeklySnapshot,
} from "@/lib/metrics/trend";

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

  it("M91 WPS Approved = 318 once the register is loaded, em-dash before", async () => {
    // R4-02: count(DISTINCT [WPS NO.]) where
    // [DOCUMENT STATUS] = 'WPS APPROVED BY CTJV/ CPY' over CONSOLIDATED = 318.
    // The mockup's 294 is the 2025-10..2026-03 plateau of the same series, not
    // a target to reconcile to.
    // R4-03: the register holds DOCUMENT numbers and is never joined to
    // weld.wps_no (SITE numbers) -- asserted below, not just documented.
    const [{ n }] = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM ref_wps_register",
    );
    const loaded = Number(n) > 0;

    const model = await getWeldingPage(1);
    const m91 = model.widgets.find(
      (w) => w.kind === "kpi" && w.label === "WPS Approved",
    );
    const value = m91 && m91.kind === "kpi" ? m91.value : null;

    if (!loaded) {
      expect(value, "register unseeded -> honest empty, never 0").toBe("\u2014");
      return;
    }
    expect(value).toBe("318");
    const approved = await approvedWpsCount();
    expect(approved?.total).toBe(318);
    // Provenance: a count off a dated file states its date.
    expect(m91 && m91.kind === "kpi" ? m91.sub : null).toMatch(/^as of \d{4}-\d{2}-\d{2} \(file date\)$/);
  });

  it("M91's register is never joined to weld.wps_no (R4-03)", async () => {
    // Document numbers vs site numbers. This is a naming trap, not a schema
    // one -- both columns are called wps_no -- so it is pinned rather than
    // left to review. `ref_wps_process` is the join table if one is ever needed.
    const src = readFileSync(
      path.join(process.cwd(), "lib/metrics/refs.ts"),
      "utf8",
    );
    // Every SQL template literal that names the register must not also name
    // the fact table. Scoped to one statement at a time so an unrelated query
    // further down the file cannot trip it.
    const sqlLiterals = src.match(/`[^`]*`/g) ?? [];
    const registerQueries = sqlLiterals.filter((q) =>
      q.includes("ref_wps_register"),
    );
    expect(registerQueries.length).toBeGreaterThan(0);
    for (const q of registerQueries) {
      expect(q, "R4-03: never join the register to weld").not.toMatch(/\bweld\b/);
    }
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

  it('UT Weld Length by Joint "PR all" = 27,856.97 (owner 27,856.97)', async () => {
    // Migration 0021. Two CALCULATEs simply ADDED, both gated
    // [WeldPoint No.1 WP1] = 1 (weldpoint_seq):
    //   term 1  [UT Report] <> ""  -> GAC 4,840.1732 + TEKFEN 4,062.3483
    //                                 + INCO 490.50
    //   term 2  [RT/UT] = "UT"     -> CCC 18,463.9501
    // Term 1 reads the RAW [UT Report], so CCC contributes only via term 2.
    // Inco IS included: [Weld Length "PR all"] takes weld_length/1000 on the
    // rows where the C-20 [Manual UT Report No.] resolves.
    const all = await utStatsPrAll(measureScope());
    // Exact: 27,366.4716 + 490.5040 = 27,856.9756. The owner quoted
    // 27,856.97, which is this TRUNCATED to 2 dp, not rounded (rounding gives
    // .98). [UT Defect Length by Joint "PR all"] shows the same pattern
    // (18.73657 quoted as 18.736), so it is the reading, not a mismatch.
    // Pinned at full precision; the display rounds as every other card does.
    expect(all.ut_weld_length_m).toBeCloseTo(27_856.9756, 4);
    expect(all.ut_weld_length_m.toFixed(2)).toBe("27856.98");
  });

  it('UT Weld Length "PR all" excluding Inco = 27,366.47', async () => {
    // What a page carrying the pbix's Inco filter shows. The owner's first
    // reading (27,366.47) was taken that way; the measure itself is the
    // with-Inco value above. Both are pinned so neither can drift into the
    // other -- the difference is exactly Inco's 490.50 m.
    const noInco = await utStatsPrAll(projectScope());
    expect(noInco.ut_weld_length_m).toBeCloseTo(27_366.4716, 4);
    const all = await utStatsPrAll(measureScope());
    expect(all.ut_weld_length_m - noInco.ut_weld_length_m).toBeCloseTo(490.504, 3);
  });

  it('UT Defect Length by Joint "PR all" = 18.7366 (owner 18.736)', async () => {
    // SUM([Defect Length(MM).]) filtered to [Manual UT Report No.] <> ""
    // AND [Manual UT Status.] = "R", both the C-20 calculated columns.
    //   INCO    2.4970  (74 rows, [Repair Length (mm)]/1000, migration 0020)
    //   GAC     7.7320  (169 rows, [Rej Length] where [By UT] = "Y")
    //   TEKFEN  8.0656  (233 rows, same branch)
    //   CCC     0.4420  (204 rows, tracker LOOKUPVALUE, ROW-level)
    // The CCC term is deliberately NOT de-duplicated to one row per joint: the
    // DAX sums a LOOKUPVALUE over PR-all ROWS, so a joint with several UT rows
    // contributes once per row. The R2-01 dedup gives 0.0890 and would miss by
    // 0.353. R2-01 licenses de-duplication for a joint-level lookup only where
    // the DAX is not already summing per row -- here it is.
    const all = await utStatsPrAll(measureScope());
    // Exact 18.736570; the owner's 18.736 is that truncated to 3 dp.
    expect(all.ut_rej_length_m).toBeCloseTo(18.73657, 5);
    expect(all.ut_rej_length_m.toFixed(3)).toBe("18.737");
  });

  it('UT Defect Length "PR all" excluding Inco = 16.2396', async () => {
    const noInco = await utStatsPrAll(projectScope());
    expect(noInco.ut_rej_length_m).toBeCloseTo(16.2396, 4);
    const all = await utStatsPrAll(measureScope());
    expect(all.ut_rej_length_m - noInco.ut_rej_length_m).toBeCloseTo(2.497002, 5);
  });

  it('UT Inspected Length by Joint "PR all" is a DIFFERENT measure from M33', async () => {
    // The pbix keeps both, and they gate different columns:
    //   [UT Weld Length by Joint "PR all"]      -> [WeldPoint No.1 WP1]
    //   [UT Inspected Length by Joint "PR all"] -> [WeldPoint No.]
    // Pinned so a future "tidy-up" cannot quietly collapse them into one.
    const all = await utStatsPrAll(measureScope());
    expect(all.ut_inspected_length_m).not.toBeCloseTo(all.ut_weld_length_m, 2);
    expect(all.ut_inspected_length_m).toBeGreaterThan(0);
  });

  it('page 1 renders the three UT length cards at the owner\'s figures', async () => {
    const page = await getWeldingPage(1);
    const kpi = (label: string) =>
      page.widgets.find((w) => w.kind === "kpi" && w.label === label) as
        | { value: string }
        | undefined;
    // Inco INCLUDED, consistent with every other page-1 card (R3-01: cards are
    // measure scope). 18.7366 / 27,856.97 = 0.0673% -> "0.07%".
    expect(kpi("UT Insp Len")?.value).toBe("27,856.98");
    expect(kpi("UT Def.Length")?.value).toBe("18.737");
    expect(kpi("UT Rej% Len")?.value).toBe("0.07%");
  });

  it('TEKFEN films, "PR all" + Weld Type filter = 82,287 / 81,480 / 807', async () => {
    // The report owner's matrix-by-Sub-Contractor screenshot. It settles two
    // things at once about the "Cumulative RT/UT Joints Tested and Accepted"
    // visual, which report-inventory.md shows binding the "PR all" family on
    // every sub-contractor page (and "EP" on none):
    //
    //   "EP", as we rendered it   82,339 / 81,566 / 773
    //   "PR all", no type filter  82,312 / 81,505 / 807
    //   "PR all" + type filter    82,287 / 81,480 / 807   <- the screenshot
    //
    // Switching family alone still misses by 25 films, so both the family and
    // `Weld Type IN {BW, CLET, GW, MW}` are load-bearing. Acc is Taken - Rej.
    const s = await rtStatsPrAll({
      sources: SOURCES_PR_ALL_LOADED,
      subContractor: "TEKFEN",
      weldTypes: RT_WELD_TYPES,
      temporaryLines: false,
    });
    expect(Math.round(s.films)).toBe(82_287);
    expect(Math.round(s.films_accepted)).toBe(81_480);
    expect(Math.round(s.films_rejected)).toBe(807);
    expect(Math.round(s.films - s.films_rejected)).toBe(81_480);
  });

  it("pages 5 and 10 show the owner's matrix figures exactly", async () => {
    // Owner ruling: no discrepancy between their matrix and the page, so the
    // PR-all NDE table does NOT take the pbix visual's `TMCP Pipe IN {null}`
    // filter (the rest of those pages' EP tables still do). The page total is
    // therefore identical to the measure-level pin above.
    for (const n of [5, 10]) {
      const page = await getWeldingPage(n);
      const table = page.widgets.find(
        (w) =>
          w.kind === "table" &&
          w.columns.includes("Tested Joints") &&
          w.columns.includes("Films Taken"),
      );
      expect(table, `page ${n} NDE table`).toBeDefined();
      if (!table || table.kind !== "table") continue;
      const total = table.rows[table.rows.length - 1]!;
      const col = (name: string) => total[table.columns.indexOf(name)];
      // Films Rej moves 773 -> 807: the "EP" twin is WP1-gated, the "PR all"
      // one is not (migration 0017), and that is the whole difference.
      expect(col("Films Rej")).toBe("807");
      expect(col("Films Taken")).toBe("82,287");
      expect(col("Films Acc")).toBe("81,480");
      expect(col("Tested Joints")).toBe("23,111");
    }
  });

  it("page 10's cards agree with the table below them", async () => {
    // The pbix carries each film card TWICE, once per family:
    //   card 97e6ec71… RT Total Films by Joint "A" "EP"
    //   card fd667f0e… RT Total Films by Joint "PR all" "A"
    //   card bf8a82da… RT Total Films by Joint "R" "EP"
    //   card 01a3a7e9… RT Total Films by Joint "PR all" "R"
    // We rendered the "EP" pair (81,187 / 773) under a table showing "PR all"
    // (81,480 / 807), so the page contradicted itself. Both now read the same
    // bundle, which is the invariant worth pinning: card == table Total.
    const page = await getWeldingPage(10);
    const kpi = (label: string) =>
      page.widgets.find((w) => w.kind === "kpi" && w.label === label) as
        | { value: string }
        | undefined;
    const table = page.widgets.find(
      (w) =>
        w.kind === "table" &&
        w.columns.includes("Tested Joints") &&
        w.columns.includes("Films Taken"),
    );
    expect(table?.kind).toBe("table");
    if (!table || table.kind !== "table") return;
    const total = table.rows[table.rows.length - 1]!;
    const col = (n: string) => total[table.columns.indexOf(n)];

    expect(kpi("RT Film_Accepted")?.value).toBe("81,480");
    expect(kpi("No.Rej Film")?.value).toBe("807");
    expect(kpi("RT Film_Accepted")?.value, "card must equal table").toBe(col("Films Acc"));
    expect(kpi("No.Rej Film")?.value, "card must equal table").toBe(col("Films Rej"));

    // `Joints Welded` is NOT switched: the pbix has both twins for it, and its
    // PR-all card carries `TMCP Pipe IN {null}`, under which the two families
    // agree exactly -- 369,931 either way. Only PR-all WITHOUT that filter
    // gives 370,089, and that is neither card. Pinned so the ambiguity cannot
    // be "resolved" by accident later.
    expect(kpi("Joints Welded")?.value).toBe("369,931");
  });

  it("the PR-all hold list is the owner's 17 codes, and EP's 16 is not a bug", () => {
    // [RT BACKLOG Total Project "PR all"] lists 18 entries but "T1S" appears
    // TWICE, so 17 distinct is the whole list -- ours, exactly:
    const OWNER = [
      "H", "HS", "HS CCC", "SS", "T", "T1", "T1-2", "T1S", "T1-1", "T1-1S",
      "T1-2S", "T2", "T3", "T2-1", "T2-1S", "T2-2S", "T2S",
    ];
    expect([...RT_BACKLOG_STATUS_PRALL].sort()).toEqual([...OWNER].sort());
    expect(new Set(RT_BACKLOG_STATUS_PRALL).size).toBe(17);
    // [PWHT All BACKLOG All WELD TYPE "PR all"] lists the same 17.
    expect([...PWHT_BACKLOG_STATUS_PRALL].sort()).toEqual([...OWNER].sort());

    // The "EP" list omits T1-2 DELIBERATELY: all 20 "EP" backlog measures in
    // measures.md omit it. Pinned in both directions so neither list can be
    // "harmonised" into the other.
    expect(RT_BACKLOG_STATUS).not.toContain("T1-2");
    expect(new Set(RT_BACKLOG_STATUS).size).toBe(16);
  });

  it("T1-2 matches no row today, so carrying it changes nothing", async () => {
    // Justifies the claim above rather than asserting it. If this ever fails,
    // the two families start disagreeing and that is worth knowing.
    const [r] = await query<{ rt: string; pwht: string }>(
      "SELECT count(*) FILTER (WHERE rt_weld_status = 'T1-2')::text AS rt," +
        "       count(*) FILTER (WHERE pwht_weld_status = 'T1-2')::text AS pwht" +
        "  FROM weld",
    );
    expect(Number(r.rt)).toBe(0);
    expect(Number(r.pwht)).toBe(0);
  });

  it("RT + PWHT backlog match the owner's DAX (computed, not pbix-read)", async () => {
    // NOT owner-read values -- these are OUR numbers from the owner's DAX,
    // to be flipped to pbix-read figures when the owner sends them.
    //
    // [RT BACKLOG Total Project "PR all"]      672
    //   CCC 357 + GAC 292 + MEDGULF 23 + TEKFEN 0 + ACCIONA 0 + INCO 0
    // [PWHT All BACKLOG All WELD TYPE "PR all"] 1,042 = 546 + 496
    //   CCC branch  546  (Weld Date > 0, PWHT Y/N CCC = "Y", no report)
    //   rest branch 496  (GAC 427 + MEDGULF 43 + TEKFEN 26) -- and the second
    //   term carries NO weld-date filter, per the DAX. mv_joint's flag is
    //   `pwht_weld_status IN (...) AND pwht_report IS NULL`, nothing more.
    const rows = await query<{ sub: string; rt: string; pc: string; pr: string }>(
      "SELECT sub_contractor AS sub," +
        " count(*) FILTER (WHERE rt_backlog_prall)::text AS rt," +
        " count(*) FILTER (WHERE pwht_backlog_ccc)::text AS pc," +
        " count(*) FILTER (WHERE pwht_backlog_rest)::text AS pr" +
        " FROM mv_joint WHERE source::text IN " +
        "('WELD_DUMP','CCC_WELDER_RECORD','CCC_JOINT_RECORD','ACCIONA','INCO')" +
        " GROUP BY 1",
    );
    const by = Object.fromEntries(rows.map((r) => [r.sub, r]));
    expect(Number(by.CCC!.rt)).toBe(357);
    expect(Number(by.GAC!.rt)).toBe(292);
    expect(Number(by.MEDGULF!.rt)).toBe(23);
    expect(Number(by.TEKFEN!.rt)).toBe(0);
    expect(rows.reduce((a, r) => a + Number(r.rt), 0)).toBe(672);

    expect(Number(by.CCC!.pc)).toBe(546);
    expect(Number(by.GAC!.pr)).toBe(427);
    expect(Number(by.MEDGULF!.pr)).toBe(43);
    expect(Number(by.TEKFEN!.pr)).toBe(26);
    expect(rows.reduce((a, r) => a + Number(r.pc) + Number(r.pr), 0)).toBe(1_042);
  });

  it("page 1's backlog charts reproduce the pbix week for week", async () => {
    // The pbix chart IS the trend workbook, summed over every sub-contractor
    // AND every scope (SG/TMCP included), with only the PROJECT sentinel
    // dropped. Owner's chart, 31-Jul..28-Aug:
    const want: Record<string, Record<string, number[]>> = {
      chart1_rtbacklog: {
        "RT/UT+PWHT": [135, 101, 94, 94, 76], // M47
        "RT/UT Only": [556, 550, 525, 530, 596], // M48
      },
      chart1_pwhtbacklog: {
        // M64, NOT M62 -- M62 is 354 where the chart shows 3.
        "PWHT+RT/UT": [3, 3, 3, 3, 3],
        "PWHT Only": [1_434, 1_394, 1_206, 814, 1_039], // M60
      },
    };
    const page = await getWeldingPage(1);
    for (const [id, series] of Object.entries(want)) {
      const c = page.widgets.find((w) => w.kind === "chart" && w.canvas_id === id);
      expect(c?.kind, id).toBe("chart");
      if (!c || c.kind !== "chart") continue;
      for (const [label, data] of Object.entries(series)) {
        expect(c.datasets.find((d) => d.label === label)?.data, `${id} ${label}`).toEqual(data);
      }
      // Stack totals: 691, 651, 619, 624, 672 and 1437, 1397, 1209, 817, 1042.
      const totals = c.labels.map((_, i) =>
        c.datasets.reduce((a, d) => a + Number(d.data[i] ?? 0), 0),
      );
      expect(totals[totals.length - 1]).toBe(id === "chart1_rtbacklog" ? 672 : 1_042);
    }
  });

  it("PWHT+RT/UT = 3 (SG/TMCP) and PWHT Only = 1,042 - 3 = 1,039", async () => {
    // [PWHT Backlog Weld Status All Weld Types RT NOT Done "PR all"] -- FOUR
    // added DISTINCTCOUNTs, a CCC branch and a status branch, each once for
    // Service Cat = "SG" and once for TMCP Pipe = "TMCP Pipe". NO weld-type
    // filter, and PWHT Weld Status uses the same 17-code hold list as RT.
    // Today it is 3, entirely GAC through the SG status branch (0 + 3 + 0 + 0).
    // Scope columns: `service_cat = 'SG'` -- an equality, never a LIKE, because
    // 'SGCS' and 'HRSG' also exist -- and the boolean `tmcp_pipe`.
    const cur = await pwhtBacklogCurrent({ sources: SOURCES_PR_ALL_LOADED });
    expect(cur).not.toBeNull();
    expect(cur!.plus_rt).toBe(3);
    expect(cur!.total).toBe(1_042);
    expect(cur!.pwht_only).toBe(1_039);

    const gac = await pwhtBacklogCurrent({
      sources: SOURCES_PR_ALL_LOADED,
      subContractor: "GAC",
    });
    expect(gac!.plus_rt, "all 3 are GAC's").toBe(3);
    expect(gac!.pwht_only).toBe(gac!.total - 3);
  });

  it("both charts' current week is computed, and equals the workbook", async () => {
    // History is the workbook; the LAST week is recomputed from mv_joint so the
    // chart can never drift from page 2. They agree today -- if they stop, the
    // computed value is the truthful one and this test fails loudly.
    const cur = await rtBacklogCurrent({ sources: SOURCES_PR_ALL_LOADED });
    expect(cur).not.toBeNull();
    expect(cur!.plus_pwht).toBe(76);
    expect(cur!.rt_only).toBe(596);
    expect(cur!.total).toBe(672);

    const pw = await pwhtBacklogCurrent({ sources: SOURCES_PR_ALL_LOADED });

    // The workbook's OWN last week, unmodified -- the agreement check. The
    // rendered chart carries the computed value, so comparing the chart to the
    // measure would be circular; this compares measure to workbook.
    const wb = await weeklySnapshot({
      metrics: ["M47", "M48", "M60", "M64"],
      aggregate: true,
      excludeProject: true,
      weeks: 1,
    });
    const at = (m: string) => Number(wb.find((r) => r.metric === m)?.value ?? -1);
    expect(at("M47"), "RT/UT+PWHT").toBe(cur!.plus_pwht);
    expect(at("M48"), "RT/UT Only").toBe(cur!.rt_only);
    expect(at("M64"), "PWHT+RT/UT").toBe(pw!.plus_rt);
    expect(at("M60"), "PWHT Only").toBe(pw!.pwht_only);

    const page = await getWeldingPage(1);
    const lastOf = (id: string, label: string) => {
      const c = page.widgets.find((w) => w.kind === "chart" && w.canvas_id === id);
      if (!c || c.kind !== "chart") throw new Error(`no chart ${id}`);
      const d = c.datasets.find((x) => x.label === label)!.data;
      return Number(d[d.length - 1] ?? 0);
    };
    expect(lastOf("chart1_rtbacklog", "RT/UT+PWHT")).toBe(cur!.plus_pwht);
    expect(lastOf("chart1_rtbacklog", "RT/UT Only")).toBe(cur!.rt_only);
    expect(lastOf("chart1_pwhtbacklog", "PWHT+RT/UT")).toBe(pw!.plus_rt);
    expect(lastOf("chart1_pwhtbacklog", "PWHT Only")).toBe(pw!.pwht_only);
  });

  it("pages 7-11 carry the same computed current week, per party", async () => {
    // GAC's PWHT chart is the only per-party one with a `+` series today,
    // because M64 is entirely GAC's: 427 - 3 = 424.
    for (const [n, sub] of [[7, "CCC"], [8, "GAC"], [10, "TEKFEN"], [11, "MEDGULF"]] as const) {
      const page = await getWeldingPage(n);
      const [rt, pw] = await Promise.all([
        rtBacklogCurrent({ sources: SOURCES_PR_ALL_LOADED, subContractor: sub }),
        pwhtBacklogCurrent({ sources: SOURCES_PR_ALL_LOADED, subContractor: sub }),
      ]);
      for (const w of page.widgets) {
        if (w.kind !== "chart" || !/backlog/i.test(w.canvas_id)) continue;
        const last = (label: string) => {
          const d = w.datasets.find((x) => x.label === label)?.data;
          return d ? Number(d[d.length - 1] ?? 0) : null;
        };
        if (/pwht/i.test(w.canvas_id)) {
          expect(last("PWHT Only"), `page ${n} PWHT Only`).toBe(pw!.pwht_only);
        } else {
          expect(last("RT/UT+PWHT"), `page ${n} RT/UT+PWHT`).toBe(rt!.plus_pwht);
          expect(last("RT/UT Only"), `page ${n} RT/UT Only`).toBe(rt!.rt_only);
        }
      }
    }
  });

  it("M47's CCC branch and M64's SG/TMCP scope (migration 0024)", async () => {
    // Both were missing terms, found by reading the verbatim DAX:
    //   M47 = 3 added CALCULATEs; the third (PWHT Y/N CCC = "Y") was absent,
    //         so this read 58 against the live pbix's 76. 58 + 18 = 76.
    //   M64 = 4 added CALCULATEs, each scoped to Service Cat = "SG" or
    //         TMCP Pipe = "TMCP Pipe". Unscoped it read 0 against the pbix's 3.
    const [r] = await query<Record<string, string>>(
      "SELECT count(*) FILTER (WHERE rt_backlog_pwht_y_not_done_prall)::text AS a," +
        " count(*) FILTER (WHERE rt_backlog_pwht_y_not_done_ccc)::text AS ccc," +
        " (count(*) FILTER (WHERE pwht_bl_rt_nd_sg_ccc)" +
        "  + count(*) FILTER (WHERE pwht_bl_rt_nd_sg_status)" +
        "  + count(*) FILTER (WHERE pwht_bl_rt_nd_tmcp_ccc)" +
        "  + count(*) FILTER (WHERE pwht_bl_rt_nd_tmcp_status))::text AS m64" +
        " FROM mv_joint WHERE source::text IN " +
        "('WELD_DUMP','CCC_WELDER_RECORD','CCC_JOINT_RECORD','ACCIONA','INCO')",
    );
    expect(Number(r.a)).toBe(58);
    expect(Number(r.ccc), "the CCC branch M47 was missing").toBe(18);
    expect(Number(r.a) + Number(r.ccc)).toBe(76);
    expect(Number(r.m64), "M64 is SG/TMCP-scoped").toBe(3);
  });

  it("the three RT-backlog components partition the 672", async () => {
    // Owner's verbatim measures, each a SUM of DISTINCTCOUNT branches that are
    // NOT de-duplicated against one another:
    //   (C) RT BACKLOG Total Project & PWHT "Y" NOT Done   76  (58 + 18 CCC)
    //   (A) RT Backlog+PWHT "N"                           507  (GAC 170 +
    //                                                           MEDGULF 23 +
    //                                                           CCC 314)
    //       RT Backlog+PWHT Progress "Y"                   89  (GAC 64, CCC 25)
    //   (A) + Progress "Y" = 596 = the chart's "RT/UT Only"
    //   (C) + 596          = 672 = RT BACKLOG Total Project "PR all"
    const [r] = await query<Record<string, string>>(
      "SELECT count(*) FILTER (WHERE rt_backlog_pwht_n_prall)::text AS a," +
        " count(*) FILTER (WHERE rt_backlog_pwht_y_done_prall)::text AS prog," +
        " count(*) FILTER (WHERE rt_backlog_prall)::text AS total" +
        " FROM mv_joint WHERE source::text IN " +
        "('WELD_DUMP','CCC_WELDER_RECORD','CCC_JOINT_RECORD','ACCIONA','INCO')",
    );
    expect(Number(r.a)).toBe(507);
    expect(Number(r.prog)).toBe(89);
    expect(Number(r.a) + Number(r.prog)).toBe(596);
    expect(Number(r.total)).toBe(672);
    const cur = await rtBacklogCurrent({ sources: SOURCES_PR_ALL_LOADED });
    expect(cur!.plus_pwht + Number(r.a) + Number(r.prog)).toBe(672);
  });

  it('FABRICATED "PR all" = 521, and 521 + 68 = 589 partitions the total', async () => {
    // [RT Backlog+PWHT Progress "Y" Done + PWHT "N" FABRICATED "PR all"],
    // six added DISTINCTCOUNTs (migration 0025), owner-verified at 521:
    //   1  56   PWHT Y/N IN {Y,25.01}, PWHT Report <> "", RT status hold16
    //   2   8   as 1 + Weld Date > 0, RT% = 100, RT status IN {?,"",S}
    //   3  18   PWHT Y/N CCC = "Y", PWHT Report No CCC <> "", RT% = 100
    //   4 163   PWHT Y/N IN {N,25.01}, PWHT Weld Status = "", hold16
    //   5   0   as 4 + Weld Date > 0, RT% = 100, RT status IN {?,""} (no "S")
    //   6 276   Weld Date > 0, PWHT Y/N CCC = "N", RT% = 100
    // The hold list here is the SIXTEEN-code one (no 'T1-2') and branch 5
    // omits 'S' where branch 2 admits it -- both verbatim, not slips.
    const all = await fabricatedBacklogPrAll(projectScope());
    expect(all).not.toBeNull();
    expect(all!.dump, "branches 1,2,4,5 -- GAC 211 + MEDGULF 16").toBe(227);
    expect(all!.ccc, "branches 3,6").toBe(294);
    expect(all!.total).toBe(521);

    for (const [sub, want] of [["GAC", 211], ["MEDGULF", 16], ["CCC", 294], ["TEKFEN", 0], ["ACCIONA", 0]] as const) {
      const s = await fabricatedBacklogPrAll({
        ...projectScope(),
        subContractor: sub,
      });
      expect(s!.total, sub).toBe(want);
    }

    // The partition. `RT BACKLOG Total Project FABRICATED` is 589, and the two
    // FABRICATED components add to it exactly -- which independently confirms
    // the 68 of the "Y NOT Done" variant, a figure the owner never quoted.
    // That is why 68 is pinned here as a derived consequence rather than as an
    // owner-read value.
    const [r] = await query<{ total: string; ynd: string }>(
      "SELECT count(*) FILTER (WHERE rt_backlog_fabricated)::text AS total," +
        " (count(*) FILTER (WHERE rt_backlog_fabricated)" +
        "  - count(*) FILTER (WHERE rt_bl_ydone_n_fab_prall_dump)" +
        "  - count(*) FILTER (WHERE rt_bl_ydone_n_fab_prall_ccc))::text AS ynd" +
        " FROM mv_joint WHERE source::text IN " +
        "('WELD_DUMP','CCC_WELDER_RECORD','CCC_JOINT_RECORD','ACCIONA')",
    );
    expect(Number(r.total)).toBe(589);
    expect(Number(r.ynd), '"Y NOT Done" FABRICATED, by difference').toBe(68);
    expect(all!.total + Number(r.ynd)).toBe(Number(r.total));
  });

  it("merging the six FABRICATED branches into two does not undercount", async () => {
    // The DAX ADDS all six, so collapsing them into two bool_ors would
    // undercount any joint matching two branches within a group. The only
    // possible overlap is pwht_y_n = '25.01', which satisfies both the Y and
    // the N branch. It does not happen today -- pinned so the day it does is
    // loud rather than silent.
    const H16 =
      "('H','HS','HS CCC','SS','T','T1','T1S','T1-1','T1-1S','T1-2S'," +
      "'T2','T3','T2-1','T2-1S','T2-2S','T2S')";
    const [r] = await query<{ six: string; merged: string }>(
      `WITH w AS (
         SELECT w.*, EXISTS (SELECT 1 FROM spool sp WHERE sp.spool_id = w.spool_id
                               AND sp.fabricated IS NOT NULL) AS fab,
                w.weld_type IN ('BW','GW','CLET','MW') AS wt,
                w.rt_weld_status IN ${H16} AS hold
           FROM weld w WHERE w.source::text <> 'INCO'
       ), j AS (
         SELECT joint_id, source,
           bool_or(fab AND wt AND pwht_y_n IN ('Y','25.01') AND pwht_report IS NOT NULL AND hold AND rt_report IS NULL) b1,
           bool_or(fab AND wt AND pwht_y_n IN ('Y','25.01') AND pwht_report IS NOT NULL AND weld_date IS NOT NULL AND rt_pct=100 AND rt_report IS NULL AND (rt_weld_status IS NULL OR rt_weld_status IN ('?','S'))) b2,
           bool_or(fab AND wt AND pwht_y_n_ccc='Y' AND pwht_report_no_ccc IS NOT NULL AND rt_report IS NULL AND rt_pct=100) b3,
           bool_or(fab AND wt AND pwht_y_n IN ('N','25.01') AND pwht_weld_status IS NULL AND hold AND rt_report IS NULL) b4,
           bool_or(fab AND wt AND pwht_y_n IN ('N','25.01') AND pwht_weld_status IS NULL AND weld_date IS NOT NULL AND rt_pct=100 AND rt_report IS NULL AND (rt_weld_status IS NULL OR rt_weld_status='?')) b5,
           bool_or(fab AND weld_date IS NOT NULL AND wt AND pwht_y_n_ccc='N' AND rt_report IS NULL AND rt_pct=100) b6
         FROM w GROUP BY 1,2
       )
       SELECT (count(*) FILTER (WHERE b1) + count(*) FILTER (WHERE b2)
             + count(*) FILTER (WHERE b3) + count(*) FILTER (WHERE b4)
             + count(*) FILTER (WHERE b5) + count(*) FILTER (WHERE b6))::text AS six,
              (count(*) FILTER (WHERE b1 OR b2 OR b4 OR b5)
             + count(*) FILTER (WHERE b3 OR b6))::text AS merged
         FROM j`,
    );
    expect(Number(r.six)).toBe(521);
    expect(Number(r.merged)).toBe(Number(r.six));
  });

  it("page 2's sub-contractor table matches the owner's pbix, cell for cell", async () => {
    // Full reconciliation against the owner's screenshot. INCO is not a row
    // (R3-01). Every cell below is an owner-read value.
    //
    // Three bindings were wrong and are fixed:
    //   "PWHT B.Log RT NOT Done"      read the "EP"-shaped flag  -> 58, is 3
    //   "RT B.LOG & PWHT NOT Done"    missed M47's CCC branch    -> 58, is 76
    //   "% Rej by Joint"              read the JOINT rejection rate; despite
    //                                 the name it is the FILM ratio
    //                                 (RT FILM Ratio % by Joint "PR all")
    //
    // Two cells still differ and are NOT tuned -- see the flags in the README:
    //   ACCIONA "RT100% Backlog"  owner 2, ours blank (total 637 vs 635)
    //   TEKFEN  "% Rej UT Joint"  owner 7.74%, ours 7.78% (198 vs 197 joints)
    const owner: Record<string, Record<string, string>> = {
      ACCIONA: { "% Rej by Joint": "0.39%" },
      CCC: {
        "RT B.LOG Total": "357", "RT100% Backlog": "357",
        "PWHT Backlog All": "546", "PWHT B.log for RT": "185",
        "PWHT B.log RT100%": "26", "PWHT B.Log RT NOT Done": "",
        'RT+PWHT "Y" Done': "25", 'RT+PWHT "N"': "314",
        "RT B.LOG & PWHT NOT Done": "18",
        "% Rej by Joint": "0.12%", "% Rej UT Joint": "0.32%",
      },
      GAC: {
        "RT B.LOG Total": "292", "RT100% Backlog": "256",
        "PWHT Backlog All": "427", "PWHT B.log for RT": "134",
        "PWHT B.log RT100%": "77", "PWHT B.Log RT NOT Done": "3",
        'RT+PWHT "Y" Done': "64", 'RT+PWHT "N"': "170",
        "RT B.LOG & PWHT NOT Done": "58",
        "% Rej by Joint": "0.42%", "% Rej UT Joint": "5.65%",
      },
      MEDGULF: {
        "RT B.LOG Total": "23", "RT100% Backlog": "22",
        "PWHT Backlog All": "43", "PWHT B.log for RT": "24",
        'RT+PWHT "N"': "23", "% Rej by Joint": "0.23%",
      },
      TEKFEN: {
        "PWHT Backlog All": "26", "PWHT B.log for RT": "11",
        "% Rej by Joint": "0.98%",
      },
      Total: {
        "RT B.LOG Total": "672", "PWHT Backlog All": "1,042",
        "PWHT B.log for RT": "354", "PWHT B.log RT100%": "103",
        "PWHT B.Log RT NOT Done": "3", 'RT+PWHT "Y" Done': "89",
        'RT+PWHT "N"': "507", "RT B.LOG & PWHT NOT Done": "76",
        "% Rej by Joint": "0.27%",
      },
    };
    const page = await getWeldingPage(2);
    const table = page.widgets.find(
      (w) => w.kind === "table" && w.columns[0] === "Sub-Contractor",
    );
    expect(table?.kind).toBe("table");
    if (!table || table.kind !== "table") return;
    for (const row of table.rows) {
      const want = owner[row[0]!];
      if (!want) continue;
      for (const [col, value] of Object.entries(want)) {
        const i = table.columns.indexOf(col);
        expect(i, `column ${col}`).toBeGreaterThan(0);
        expect(row[i], `${row[0]} / ${col}`).toBe(value);
      }
    }
  });

  it("the two page-2 cells that do not match the owner, pinned as-is", async () => {
    // Pinned so they cannot drift unnoticed while the owner rules on them.
    //
    // 1. ACCIONA "RT100% Backlog" = 2 in the pbix. We render blank: ACCIONA has
    //    945 rows with RT% = 100 and EVERY one carries an RT report, so M43's
    //    `RT Date is blank` can never fire. No reading of the measure over our
    //    data yields 2, so nothing is tuned.
    // 2. TEKFEN "% Rej UT Joint" = 7.74% (197/2545); we have 7.78% (198/2545).
    //    The extra joint is 21010AA-NG7131299R01-SP1-002: it has NO ut_report
    //    and NO ut_acc_rej, only manual_ut_report_no + manual_ut_status = 'R',
    //    so it qualifies solely through the C-20 fallback. Both candidate
    //    mechanisms for excluding it (requiring ut_report/ut_acc_rej directly,
    //    or requiring ut_weld_status = 'NR') give exactly 197, and neither is
    //    in the verbatim DAX -- so the measure is left alone rather than tuned
    //    to the target by a guess.
    const [acc] = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM weld" +
        " WHERE sub_contractor = 'ACCIONA' AND rt_pct = 100 AND rt_report IS NULL",
    );
    expect(Number(acc.n), "no ACCIONA RT100% row lacks a report").toBe(0);

    const [tek] = await query<{ ours: string; strict: string }>(
      "SELECT count(*) FILTER (WHERE ours)::text AS ours," +
        "       count(*) FILTER (WHERE strict)::text AS strict FROM (" +
        "  SELECT bool_or(coalesce(ut_acc_rej, manual_ut_status) = 'R'" +
        "           AND coalesce(ut_report, manual_ut_report_no) IS NOT NULL) AS ours," +
        "         bool_or(ut_acc_rej = 'R' AND ut_report IS NOT NULL) AS strict" +
        "    FROM weld WHERE sub_contractor = 'TEKFEN' GROUP BY source, joint_id) t",
    );
    expect(Number(tek.ours)).toBe(198);
    expect(Number(tek.strict), "the owner's 197").toBe(197);
  });

  it("page 1 with no filters is byte-identical to page 1 without the option", async () => {
    // The whole feature must be inert when unused: every existing pin depends
    // on it. Compared after stripping the filter bar itself.
    const bare = await getWeldingPage(1);
    const withAll = await getWeldingPage(1, {
      filters: { subco: "All", wtype: "All", wcat: "All" },
    });
    const strip = (p: Awaited<ReturnType<typeof getWeldingPage>>) =>
      JSON.stringify({ ...p, widgets: p.widgets.filter((w) => w.kind !== "filter") });
    expect(strip(withAll)).toBe(strip(bare));
    expect(bare.filters).toEqual({ subco: "All", wtype: "All", wcat: "All" });

    // The bar itself: three widgets, FIRST, with these exact ids and labels.
    const first3 = bare.widgets.slice(0, 3);
    expect(first3.map((w) => w.kind)).toEqual(["filter", "filter", "filter"]);
    expect(first3.map((w) => (w.kind === "filter" ? w.id : ""))).toEqual([
      "subco", "wtype", "wcat",
    ]);
    expect(first3.map((w) => (w.kind === "filter" ? w.label : ""))).toEqual([
      "Sub-Contractor", "Weld Type", "Weld Cat",
    ]);
    for (const w of first3) {
      if (w.kind !== "filter") continue;
      expect(w.options[0], "All comes first").toBe("All");
      expect(w.options.slice(1).every((o) => o.trim() !== ""), "no blanks").toBe(true);
    }
  });

  it("filtered Joints Welded sums back to the unfiltered total", async () => {
    // The slicer must partition, not reshape. Checked over both dimensions
    // that have complete coverage; weld_type is skipped because THD and other
    // types are excluded from some widgets by page rules, not by the slicer.
    const bare = await getWeldingPage(1);
    const jw = (p: Awaited<ReturnType<typeof getWeldingPage>>) => {
      const w = p.widgets.find((x) => x.kind === "kpi" && x.label === "Joints Welded");
      return w && w.kind === "kpi" ? Number(w.value.replace(/,/g, "")) : NaN;
    };
    const total = jw(bare);
    const bar = bare.widgets.filter((w) => w.kind === "filter");
    for (const [i, key] of [[0, "subco"], [2, "wcat"]] as const) {
      const widget = bar[i]!;
      if (widget.kind !== "filter") continue;
      let sum = 0;
      for (const v of widget.options.slice(1)) {
        sum += jw(await getWeldingPage(1, { filters: { [key]: v } }));
      }
      expect(sum, `sum over ${key}`).toBe(total);
    }
  });

  it("two filtered combinations match independently computed SQL", async () => {
    // Computed straight off mv_joint here, not through the metric layer, so a
    // shared bug in the scope builder cannot make both sides agree.
    for (const [filters, sub, wt, wc] of [
      [{ subco: "GAC", wtype: "BW", wcat: "F" }, "GAC", "BW", "F"],
      [{ subco: "CCC", wtype: "SW" }, "CCC", "SW", null],
    ] as const) {
      const page = await getWeldingPage(1, { filters });
      const card = page.widgets.find(
        (w) => w.kind === "kpi" && w.label === "Joints Welded",
      );
      const rendered = card && card.kind === "kpi"
        ? Number(card.value.replace(/,/g, ""))
        : NaN;

      const p = new Params();
      // M01 is `is_welded_norepair` — welded EXCLUDING repairs and rewelds,
      // not merely `weld_date IS NOT NULL` (which gives 54,801 here). Naming
      // the right flag is the point of the independent check.
      const conds = [
        `source::text = ANY(${p.any(SOURCES_PR_ALL_LOADED)}::text[])`,
        `is_welded_norepair`,
        `sub_contractor = ${p.add(sub)}`,
        `weld_type = ${p.add(wt)}`,
      ];
      if (wc) conds.push(`weld_cat = ${p.add(wc)}`);
      const [r] = await query<{ n: string }>(
        `SELECT count(*)::text AS n FROM mv_joint WHERE ${conds.join(" AND ")}`,
        p.list(),
      );
      expect(rendered, JSON.stringify(filters)).toBe(Number(r.n));
    }
  });

  it("filtering to Inco renders MT/PT empty, never 0", async () => {
    // R3-01 keeps Inco out of that card, so filtering TO Inco leaves it
    // measuring nothing. A 0 there would read as "Inco did no MT/PT".
    const page = await getWeldingPage(1, { filters: { subco: "INCO" } });
    const mtpt = page.widgets.find(
      (w) => w.kind === "kpi" && w.label === "MT/PT Done",
    );
    expect(mtpt && mtpt.kind === "kpi" ? mtpt.value : null).toBe("\u2014");
    expect(
      page.widgets.some((w) => w.kind === "text" && /Inco excluded/.test(w.text)),
      "and the page says why",
    ).toBe(true);
    // Every other card still follows the filter.
    const jw = page.widgets.find(
      (w) => w.kind === "kpi" && w.label === "Joints Welded",
    );
    expect(jw && jw.kind === "kpi" ? jw.value : null).toBe("7,238");
  });

  it("a weld-type filter drops the workbook history and says so", async () => {
    // weld_weekly_snapshot is keyed per party only, so no history can honour a
    // weld-type filter. Showing the old line would silently ignore the filter.
    const page = await getWeldingPage(1, { filters: { wtype: "BW" } });
    const backlog = page.widgets.find(
      (w) => w.kind === "chart" && w.canvas_id === "chart1_rtbacklog",
    );
    expect(backlog?.kind).toBe("chart");
    if (backlog?.kind === "chart") expect(backlog.labels).toHaveLength(1);
    expect(
      page.widgets.some((w) => w.kind === "text" && /only the current week/.test(w.text)),
    ).toBe(true);
  });

  it("an unknown filter value is ignored and reported", async () => {
    const page = await getWeldingPage(1, { filters: { subco: "NOT-A-PARTY" } });
    expect(page.filters?.subco).toBe("All");
    expect(
      page.widgets.some((w) => w.kind === "text" && /not present in the data/.test(w.text)),
    ).toBe(true);
  });

  it("page 1's Welding Progress Trend shows the last 10 weeks", async () => {
    // Owner ruling. The mockup snapshot declares 14 labels; pages 7-11 keep
    // their own 8-week window, so this pins the difference rather than letting
    // one page's change drift into the others.
    const p1 = await getWeldingPage(1);
    const trend = p1.widgets.find(
      (w) => w.kind === "chart" && w.canvas_id === "chart1_progress",
    );
    expect(trend?.kind).toBe("chart");
    if (trend?.kind === "chart") {
      expect(trend.labels).toHaveLength(10);
      expect(trend.labels).toEqual([...trend.labels].sort());
    }
    const p7 = await getWeldingPage(7);
    const sub = p7.widgets.find(
      (w) => w.kind === "chart" && w.canvas_id === "chart7_welding",
    );
    if (sub?.kind === "chart") expect(sub.labels).toHaveLength(8);
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
