import { describe, expect, it } from "vitest";

import { compareCells, nextSort, sortGroupedRows, sortKey } from "@/lib/table-sort";

describe("table sort", () => {
  it("reads report cells as numbers", () => {
    expect(sortKey("1,234")).toBe(1234);
    expect(sortKey("1.58 %")).toBe(1.58);
    expect(sortKey("(12)")).toBe(-12);
    expect(sortKey("")).toBeNull();
    expect(sortKey("-")).toBeNull();
    expect(sortKey("CCC")).toBe("CCC");
  });

  it("keeps blanks last either way", () => {
    expect(compareCells("", "5", "desc")).toBeGreaterThan(0);
    expect(compareCells("", "5", "asc")).toBeGreaterThan(0);
    expect(compareCells("10", "9", "desc")).toBeLessThan(0);
  });

  it("cycles desc → asc → off", () => {
    expect(nextSort(null, 2)).toEqual({ col: 2, dir: "desc" });
    expect(nextSort({ col: 2, dir: "desc" }, 2)).toEqual({ col: 2, dir: "asc" });
    expect(nextSort({ col: 2, dir: "asc" }, 2)).toBeNull();
  });

  it("moves groups with their detail rows and pins the total", () => {
    const rows = [["A", "1"], ["  a1", "1"], ["B", "5"], ["  b1", "2"], ["  b2", "3"], ["Total", "6"]];
    const order = sortGroupedRows(rows, { col: 1, dir: "desc" }, (r) => r[0].startsWith("  "), (ri) => ri === 5);
    expect(order).toEqual([2, 4, 3, 0, 1, 5]);
  });
});
