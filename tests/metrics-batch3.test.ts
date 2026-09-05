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

/** `analysis/sources3/plan.md` — the delivered populations. */
const ACCIONA_ROWS = 13_313;
const ACCIONA_JOINTS = 13_313;
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

  it("fills weldpoint_seq for both sources, or every PR-all film sum is zero", async () => {
    // The WP1 gate is `CASE source WHEN 'WELD_DUMP' THEN weldpoint_no = 1 ELSE
    // weldpoint_seq = 1 END`. `weldpoint_seq` is loader-materialised; if the
    // Acciona/Inco loaders leave it NULL the gate never matches and M23/M24/M33
    // silently drop those sources instead of failing.
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
