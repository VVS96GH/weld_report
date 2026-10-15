import { describe, expect, it } from "vitest";

import {
  dataToDisplay,
  displayForPath,
  displayHref,
  FORECAST_DISPLAY_PAGE,
  FORECAST_TITLE,
  LINKED_FIRST_DISPLAY_PAGE,
  LINKED_PAGES,
  REPORT_ORDER,
  reportEntry,
  WELDING_DATA_PAGE_TITLES,
  WELDING_DATA_PAGES,
  WELDING_PAGE_TITLES,
  WELDING_TOTAL_PAGES,
} from "@/lib/welding-pages";

/**
 * The report's reading order: 44 mockup pages, the forecast at page 2, and the
 * other reports (Flange, 4 Welder Performance pages, Errors) as pages 3..8.
 */
describe("report display order", () => {
  it("is the 44 data pages plus the forecast at page 2 and six linked reports from page 3", () => {
    expect(WELDING_DATA_PAGES).toBe(44);
    expect(LINKED_PAGES).toHaveLength(6);
    expect(WELDING_TOTAL_PAGES).toBe(51);
    expect(reportEntry(FORECAST_DISPLAY_PAGE)).toEqual({ kind: "forecast", title: FORECAST_TITLE });
    expect(WELDING_PAGE_TITLES[FORECAST_DISPLAY_PAGE - 1]).toBe(FORECAST_TITLE);
    expect(WELDING_PAGE_TITLES.slice(2, 8)).toEqual([
      "Flange Inspection Dashboard",
      "Performance Last 2 Weeks",
      "Rej.Summary Last 2 Weeks",
      "Performance Last 1 Month",
      "Rej.Summary Last 1 Month",
      "Errors",
    ]);
  });

  it("keeps every data page exactly once, in mockup order", () => {
    const data = REPORT_ORDER.filter((e) => e.kind === "data").map((e) => (e.kind === "data" ? e.data : 0));
    expect(data).toEqual(Array.from({ length: 44 }, (_, i) => i + 1));
    for (let d = 1; d <= 44; d++) {
      const display = dataToDisplay(d);
      expect(display).toBe(d < FORECAST_DISPLAY_PAGE ? d : d + 1 + LINKED_PAGES.length);
      expect(WELDING_PAGE_TITLES[display - 1]).toBe(WELDING_DATA_PAGE_TITLES[d - 1]);
    }
    expect(reportEntry(0)).toBeUndefined();
    expect(reportEntry(52)).toBeUndefined();
  });

  it("maps the linked reports both ways", () => {
    LINKED_PAGES.forEach((l, i) => {
      const n = LINKED_FIRST_DISPLAY_PAGE + i;
      expect(displayHref(n)).toBe(l.href);
      expect(displayForPath(l.href)).toBe(n);
    });
    expect(displayHref(9)).toBe("/welding/9");
    expect(displayForPath("/welding/12")).toBe(12);
    expect(displayForPath("/report/overview")).toBeNull();
  });
});
