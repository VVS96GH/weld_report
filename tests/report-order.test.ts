import { describe, expect, it } from "vitest";

import {
  dataToDisplay,
  FORECAST_DISPLAY_PAGE,
  FORECAST_TITLE,
  REPORT_ORDER,
  reportEntry,
  WELDING_DATA_PAGE_TITLES,
  WELDING_DATA_PAGES,
  WELDING_PAGE_TITLES,
  WELDING_TOTAL_PAGES,
} from "@/lib/welding-pages";

/** The report's reading order: 44 mockup pages with the forecast inserted as page 2. */
describe("report display order", () => {
  it("is the 44 data pages plus the forecast at page 2", () => {
    expect(WELDING_DATA_PAGES).toBe(44);
    expect(WELDING_TOTAL_PAGES).toBe(45);
    expect(reportEntry(FORECAST_DISPLAY_PAGE)).toEqual({ kind: "forecast", title: FORECAST_TITLE });
    expect(WELDING_PAGE_TITLES[FORECAST_DISPLAY_PAGE - 1]).toBe(FORECAST_TITLE);
  });

  it("keeps every data page exactly once, in mockup order", () => {
    const data = REPORT_ORDER.filter((e) => e.kind === "data").map((e) => (e.kind === "data" ? e.data : 0));
    expect(data).toEqual(Array.from({ length: 44 }, (_, i) => i + 1));
    for (let d = 1; d <= 44; d++) {
      const display = dataToDisplay(d);
      expect(display).toBe(d < FORECAST_DISPLAY_PAGE ? d : d + 1);
      expect(WELDING_PAGE_TITLES[display - 1]).toBe(WELDING_DATA_PAGE_TITLES[d - 1]);
    }
    expect(reportEntry(0)).toBeUndefined();
    expect(reportEntry(46)).toBeUndefined();
  });
});
