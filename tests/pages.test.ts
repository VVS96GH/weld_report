/**
 * Structure test for the 44 welding page assemblers.
 *
 * Runs WITHOUT a database: `lib/db.ts`'s `query` is swapped for a fixture that
 * returns no rows, so every page is built through the real assembler code path
 * with empty result sets. That proves three things at once:
 *
 *   1. every page 1..44 builds and returns a `PageModel`;
 *   2. its widget kinds, KPI labels, table titles, table column headers, chart
 *      ids/titles/types and dataset labels equal
 *      `analysis/mockups/welding-spec.json`, in the mockup's order;
 *   3. with no data, nothing fabricates a zero — KPIs render "—", table cells
 *      render blank.
 *
 * Widgets BEYOND the spec's list are allowed only if they are `text`
 * provenance notes ("which source is not loaded"), which the lane brief
 * requires honest-empty pages to carry. Everything the mockup declares is
 * compared position-for-position.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setQueryImpl } from "@/lib/db";
import {
  getWeldingPage,
  HONEST_EMPTY,
  specPage,
  specPages,
  TOTAL_PAGES,
  weldingPageIndex,
  type SpecWidget,
} from "@/lib/pages/welding";
import type { Widget } from "@/lib/page-model";

/** Structural projection: everything except the values. */
function shapeOfSpec(w: SpecWidget): unknown {
  switch (w.kind) {
    case "kpi":
      return { kind: "kpi", label: w.label };
    case "table":
      return { kind: "table", title: w.title ?? "", columns: w.columns };
    case "chart":
      return {
        kind: "chart",
        canvas_id: w.canvas_id,
        title: w.title,
        chart_type: w.chart_type,
        datasets: w.datasets.map((d) => d.label ?? ""),
      };
    case "text":
      return { kind: "text", text: w.text };
  }
}

function shapeOfModel(w: Widget): unknown {
  switch (w.kind) {
    case "kpi":
      return { kind: "kpi", label: w.label };
    case "table":
      return { kind: "table", title: w.title, columns: w.columns };
    case "chart":
      return {
        kind: "chart",
        canvas_id: w.canvas_id,
        title: w.title,
        chart_type: w.chart_type,
        datasets: w.datasets.map((d) => d.label ?? ""),
      };
    case "text":
      return { kind: "text", text: w.text };
  }
}

let widgetsCompared = 0;
let mismatches = 0;
let extraNotes = 0;

beforeAll(() => {
  // Fixture: no rows for any statement. Every assembler must survive it.
  setQueryImpl(async () => []);
});

afterAll(() => {
  setQueryImpl(null);
  console.log(
    `[pages.test] widgets compared: ${widgetsCompared}  mismatches: ${mismatches}  ` +
      `extra provenance notes: ${extraNotes}`,
  );
});

describe("welding page index", () => {
  it("lists 44 pages with the mockup titles", () => {
    const index = weldingPageIndex();
    expect(index).toHaveLength(TOTAL_PAGES);
    expect(index[0]).toEqual({ page: 1, title: "Welding Progress (Project)" });
    expect(index[43].page).toBe(44);
    expect(specPages()).toHaveLength(TOTAL_PAGES);
  });
});

describe("getWeldingPage — structure equals analysis/mockups/welding-spec.json", () => {
  for (let n = 1; n <= TOTAL_PAGES; n++) {
    it(`page ${n} matches the mockup spec`, async () => {
      const spec = specPage(n);
      const model = await getWeldingPage(n);

      expect(model.page).toBe(spec.page);
      expect(model.id).toBe(spec.id);
      expect(model.title).toBe(spec.title);

      // Pages 1 and 2 (page 2 since 2026-10-15) carry a five-widget filter bar ahead of everything the
      // mockup declares (Sub-Contractor / Weld Type / Weld Cat). It is server
      // chrome, not a mockup widget, so it is checked here and then skipped —
      // the position-for-position comparison below is unchanged.
      // The NDE / PWHT pages (12–40) likewise lead with their own Service Class
      // and PWHT Y/N slicers (2026-09-15).
      let body = model.widgets;
      const barIds = n === 1 || n === 2 ? ["ha", "area", "subco", "wtype", "wcat"] : n >= 12 && n <= 40 ? ["wcat", "sclass", "pwht"] : [];
      if (barIds.length > 0) {
        const bar = body.slice(0, barIds.length);
        expect(bar.map((w) => w.kind)).toEqual(Array(barIds.length).fill("filter"));
        expect(bar.map((w) => (w.kind === "filter" ? w.id : ""))).toEqual(barIds);
        body = body.slice(barIds.length);
      }

      // Everything the mockup declares, position for position.
      const declared = body.slice(0, spec.widgets.length);
      expect(declared).toHaveLength(spec.widgets.length);
      for (let i = 0; i < spec.widgets.length; i++) {
        widgetsCompared++;
        const want = shapeOfSpec(spec.widgets[i]);
        const got = shapeOfModel(declared[i]);
        if (JSON.stringify(want) !== JSON.stringify(got)) mismatches++;
        expect(got, `page ${n} widget ${i}`).toEqual(want);
      }

      // Anything extra must be a provenance note.
      for (const extra of body.slice(spec.widgets.length)) {
        extraNotes++;
        expect(extra.kind).toBe("text");
      }
    });
  }
});

describe("honest-empty: no fabricated zeros with no data", () => {
  it("KPIs render the em-dash, never 0", async () => {
    for (const n of [1, 7, 8, 9, 10, 11]) {
      const model = await getWeldingPage(n);
      for (const w of model.widgets) {
        if (w.kind !== "kpi") continue;
        expect(w.value, `page ${n} KPI ${w.label}`).toBe(HONEST_EMPTY);
      }
    }
  });

  it("table cells render blank, never 0", async () => {
    for (let n = 1; n <= TOTAL_PAGES; n++) {
      const model = await getWeldingPage(n);
      for (const w of model.widgets) {
        if (w.kind !== "table") continue;
        for (const row of w.rows) {
          for (const cell of row.slice(1)) {
            expect(cell, `page ${n} table ${w.title}`).not.toBe("0");
          }
        }
      }
    }
  });

  it("every CCC page carries a note naming the missing source", async () => {
    // The CCC pages are built now (phase 2); with the fixture returning no rows
    // they must still disclose that CCC's export is not loaded rather than
    // presenting empty tables as fact.
    for (const n of [3, 7, 12, 13, 14, 15, 16, 17, 18, 41]) {
      const model = await getWeldingPage(n);
      const notes = model.widgets.filter((w) => w.kind === "text");
      expect(
        notes.some((w) => w.kind === "text" && /CCC is not loaded yet/.test(w.text)),
        `page ${n}`,
      ).toBe(true);
    }
  });

  it("the CCC NDE pages disclose the R2-05 aging blackout", async () => {
    for (const n of [12, 14, 16, 18]) {
      const model = await getWeldingPage(n);
      expect(
        model.widgets.some(
          (w) => w.kind === "text" && /ruling R2-05/.test(w.text),
        ),
        `page ${n}`,
      ).toBe(true);
    }
  });
});

describe("ALL sub-contractor rendering (allSubcos)", () => {
  // The representative pages the option-A screens borrow for ALL (lib/screens.ts).
  const REPRESENTATIVE = [7, 3, 12, 13, 14, 18, 26, 41];
  for (const n of REPRESENTATIVE) {
    it(`page ${n} keeps the mockup structure and drops the party from every title`, async () => {
      const spec = specPage(n);
      const model = await getWeldingPage(n, { allSubcos: true });
      expect(model.id).toBe(`${spec.id}-all`);
      expect(model.title).toBe(spec.title.replace(/\b(CCC|GAC|TEKFEN|MEDGULF)\b/g, "ALL SUB-CONTRACTORS"));
      expect(model.title).not.toMatch(/\b(CCC|GAC|TEKFEN|MEDGULF)\b/);
      const declared = model.widgets.filter((w) => w.kind !== "filter").slice(0, spec.widgets.length);
      expect(declared.map((w) => w.kind)).toEqual(spec.widgets.map((w) => w.kind));
      for (let i = 0; i < spec.widgets.length; i++) {
        const want = spec.widgets[i];
        const got = declared[i];
        if (want.kind === "table" && got.kind === "table") {
          expect(got.columns).toEqual(want.columns);
          expect(got.title).not.toMatch(/\b(CCC|GAC|TEKFEN|MEDGULF)\b/);
        }
        if (want.kind === "chart" && got.kind === "chart") {
          expect(got.canvas_id).toBe(want.canvas_id);
          expect(got.datasets.map((d) => d.label)).toEqual(want.datasets.map((d) => d.label ?? ""));
        }
      }
      const notes = model.widgets.filter((w) => w.kind === "text").map((w) => (w.kind === "text" ? w.text : ""));
      expect(notes.some((t) => t.startsWith("ALL sub-contractors:"))).toBe(true);
    });
  }

  for (const n of [12, 13, 19, 20]) {
    it(`page ${n} over every RT % (allRtPct) keeps the structure and drops "RT 100%" from the titles`, async () => {
      const spec = specPage(n);
      const model = await getWeldingPage(n, { allRtPct: true });
      expect(model.id).toBe(`${spec.id}-allrt`);
      expect(model.title).toBe(spec.title.replace(/RT ?100 ?%/g, "ALL RT %"));
      expect(model.title).not.toMatch(/RT ?100 ?%/);
      const declared = model.widgets.filter((w) => w.kind !== "filter").slice(0, spec.widgets.length);
      expect(declared.map((w) => w.kind)).toEqual(spec.widgets.map((w) => w.kind));
      for (let i = 0; i < spec.widgets.length; i++) {
        const want = spec.widgets[i];
        const got = declared[i];
        if (want.kind === "table" && got.kind === "table") {
          expect(got.columns).toEqual(want.columns);
          expect(got.title).not.toMatch(/RT ?100 ?%/);
        }
      }
      const notes = model.widgets.filter((w) => w.kind === "text").map((w) => (w.kind === "text" ? w.text : ""));
      expect(notes.some((t) => t.startsWith("ALL RT %:"))).toBe(true);
    });
  }

  it("is a no-op on the project pages 1 and 2", async () => {
    for (const n of [1, 2]) {
      const plain = await getWeldingPage(n);
      const all = await getWeldingPage(n, { allSubcos: true });
      expect(all.id).toBe(plain.id);
      expect(all.title).toBe(plain.title);
      expect(all.widgets.length).toBe(plain.widgets.length);
    }
  });
});

describe("page bounds", () => {
  it("rejects pages outside 1..44", async () => {
    await expect(getWeldingPage(0)).rejects.toThrow(RangeError);
    await expect(getWeldingPage(45)).rejects.toThrow(RangeError);
    await expect(getWeldingPage(1.5)).rejects.toThrow(RangeError);
  });
});
