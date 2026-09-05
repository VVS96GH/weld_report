/**
 * Unit tests for the batch-2 workbook seeders' PURE mapping functions.
 * No database, no real workbooks — small inline fixtures only.
 *
 * SEED-LANE scope: scripts/seed-weekly-snapshot.ts, scripts/load-ut-tracker-ccc.ts,
 * scripts/load-exclusion-list.ts, scripts/lib/xlsx.ts.
 */

import { describe, expect, it } from "vitest";
import {
  excelSerialToDate,
  isFridayISO,
  normalizeSubContractorLabel,
  toISODate,
  toNum,
  toText,
} from "../scripts/lib/xlsx";
import {
  ACTIVE_WELDERS_METRIC,
  MPI_DONE_METRIC,
  MPI_PT_DONE_METRIC,
  TREND_REPORT_COLUMNS,
  TREND_RT_UT_COLUMNS,
  buildSnapshotRow,
} from "../scripts/seed-weekly-snapshot";
import { mapUtTrackerRow } from "../scripts/load-ut-tracker-ccc";
import { mapExclusionRow } from "../scripts/load-exclusion-list";

describe("normalizeSubContractorLabel (ruling R2-08)", () => {
  it("splits 'GAC SG' into sub_contractor GAC / scope SG", () => {
    expect(normalizeSubContractorLabel("GAC SG")).toEqual({
      subContractor: "GAC",
      scope: "SG",
      labelRaw: "GAC SG",
    });
  });

  it("splits 'TEKFEN TMCP' into sub_contractor TEKFEN / scope TMCP", () => {
    expect(normalizeSubContractorLabel("TEKFEN TMCP")).toEqual({
      subContractor: "TEKFEN",
      scope: "TMCP",
      labelRaw: "TEKFEN TMCP",
    });
  });

  it("normalises 'Inco' to sub_contractor INCO / scope ALL, keeping the raw label", () => {
    expect(normalizeSubContractorLabel("Inco")).toEqual({
      subContractor: "INCO",
      scope: "ALL",
      labelRaw: "Inco",
    });
  });

  it("normalises 'INCO' (the other workbook's casing) the same way", () => {
    expect(normalizeSubContractorLabel("INCO")).toEqual({
      subContractor: "INCO",
      scope: "ALL",
      labelRaw: "INCO",
    });
  });

  it("passes plain single-word labels through uppercased with scope ALL", () => {
    expect(normalizeSubContractorLabel("MEDGULF")).toEqual({
      subContractor: "MEDGULF",
      scope: "ALL",
      labelRaw: "MEDGULF",
    });
    expect(normalizeSubContractorLabel("CCC")).toEqual({
      subContractor: "CCC",
      scope: "ALL",
      labelRaw: "CCC",
    });
    expect(normalizeSubContractorLabel("Acciona")).toEqual({
      subContractor: "ACCIONA",
      scope: "ALL",
      labelRaw: "Acciona",
    });
  });

  it("trims surrounding whitespace before matching", () => {
    expect(normalizeSubContractorLabel("  GAC SG  ")).toEqual({
      subContractor: "GAC",
      scope: "SG",
      labelRaw: "GAC SG",
    });
  });
});

describe("Excel-serial / date-cell handling", () => {
  it("converts a known Excel serial to the matching calendar date", () => {
    // 45534 = 2024-08-30 (days since the Excel epoch 1899-12-30, i.e. the
    // classic 1900-leap-year-bug epoch; verified with Python
    // `(date(2024,8,30) - date(1899,12,30)).days`).
    const d = excelSerialToDate(45534);
    expect(d.toISOString().slice(0, 10)).toBe("2024-08-30");
  });

  it("toISODate accepts a JS Date (exceljs's normal output for a date cell)", () => {
    expect(toISODate(new Date(Date.UTC(2026, 7, 28)))).toBe("2026-08-28");
  });

  it("toISODate accepts a raw Excel serial number", () => {
    expect(toISODate(45534)).toBe("2024-08-30");
  });

  it("toISODate accepts an ISO string", () => {
    expect(toISODate("2024-02-23")).toBe("2024-02-23");
  });

  it("toISODate returns null for a blank cell", () => {
    expect(toISODate(null)).toBeNull();
    expect(toISODate(undefined)).toBeNull();
    expect(toISODate("")).toBeNull();
  });

  it("toISODate throws (reports, does not guess) on an unrecognised string", () => {
    expect(() => toISODate("not a date")).toThrow();
  });
});

describe("isFridayISO — the week-end assertion", () => {
  it("is true for a workbook week-end date", () => {
    expect(isFridayISO("2026-08-28")).toBe(true); // the spot-check date from trend-seed-plan.md
    expect(isFridayISO("2024-02-23")).toBe(true); // first TREND Report row
  });

  it("is false for a non-Friday date (reported, never silently shifted)", () => {
    expect(isFridayISO("2026-08-27")).toBe(false); // Thursday
    expect(isFridayISO("2026-08-29")).toBe(false); // Saturday
  });
});

describe("toNum / toText — blank vs zero, and unexpected shapes", () => {
  it("toNum: blank cell -> null, never 0 (trend-seed-plan.md)", () => {
    expect(toNum(null)).toBeNull();
    expect(toNum(undefined)).toBeNull();
    expect(toNum("")).toBeNull();
  });

  it("toNum: a literal zero cell stays 0 (ruling R2-09 — dead columns seeded as-is)", () => {
    expect(toNum(0)).toBe(0);
    expect(toNum("0")).toBe(0);
  });

  it("toNum: numeric string is parsed", () => {
    expect(toNum("0.0023")).toBeCloseTo(0.0023);
  });

  it("toNum: throws on a non-numeric string rather than coercing to null/0", () => {
    expect(() => toNum("N/A")).toThrow();
  });

  it("toText: blank -> null, numbers stringified", () => {
    expect(toText(null)).toBeNull();
    expect(toText("")).toBeNull();
    expect(toText(5)).toBe("5");
    expect(toText("  W-426  ")).toBe("W-426");
  });
});

describe("metric-column mapping — TREND Report (5,658 = 943 x 6)", () => {
  it("maps the six value columns to the plan's metric ids in column order", () => {
    expect(TREND_REPORT_COLUMNS.map((c) => c.metric)).toEqual([
      "M40",
      "M60",
      "M62",
      "M48",
      "M47",
      "M64",
    ]);
  });

  it("buildSnapshotRow reproduces the GAC 2026-08-28 spot check (M60=424, M62=131)", () => {
    // row shape: [_, Date, Sub-Contractor, RT Backlog, PWHT All Types, PWHT For RT, ...]
    const row = [undefined, "2026-08-28", "GAC", 0, 424, 131, 234, 55, 0];
    const m60 = buildSnapshotRow("2026-08-28", "GAC", "M60", row[TREND_REPORT_COLUMNS[1].col]);
    const m62 = buildSnapshotRow("2026-08-28", "GAC", "M62", row[TREND_REPORT_COLUMNS[2].col]);
    const m47 = buildSnapshotRow("2026-08-28", "GAC", "M47", row[TREND_REPORT_COLUMNS[4].col]);
    expect(m60).toMatchObject({ subContractor: "GAC", scope: "ALL", metric: "M60", value: 424 });
    expect(m62).toMatchObject({ subContractor: "GAC", scope: "ALL", metric: "M62", value: 131 });
    expect(m47).toMatchObject({ subContractor: "GAC", scope: "ALL", metric: "M47", value: 55 });
  });

  it("a trailing-blank cell (6 known short rows) becomes a NULL M64 value, not 0", () => {
    const row = buildSnapshotRow("2024-10-11", "CCC", "M64", undefined);
    expect(row.value).toBeNull();
  });

  it("splits GAC SG into sub_contractor GAC / scope SG on a snapshot row", () => {
    const row = buildSnapshotRow("2024-02-23", "GAC SG", "M40", 52);
    expect(row).toMatchObject({ subContractor: "GAC", scope: "SG", metric: "M40", value: 52, labelRaw: "GAC SG" });
  });
});

describe("metric-column mapping — TREND RT UT (3,904 = 976 x 4)", () => {
  it("maps the four value columns to the plan's metric ids in column order", () => {
    expect(TREND_RT_UT_COLUMNS.map((c) => c.metric)).toEqual(["M25", "M36", "M25P", "M36P"]);
  });

  it("keeps fractional rates as fractions, not percents", () => {
    const row = buildSnapshotRow("2024-05-03", "CCC", "M25", 0.0018);
    expect(row.value).toBeCloseTo(0.0018);
  });
});

describe("Active Welders (M90W) and MPI Done (M71 / M71PT)", () => {
  it("uses the dedicated M90W id, not M90", () => {
    expect(ACTIVE_WELDERS_METRIC).toBe("M90W");
  });

  it("MPI rows use sub_contractor PROJECT / scope ALL (no sub-contractor column in that sheet)", () => {
    const mpi = buildSnapshotRow("2024-04-19", "PROJECT", MPI_DONE_METRIC, 70593);
    const mpiPt = buildSnapshotRow("2024-04-19", "PROJECT", MPI_PT_DONE_METRIC, 0);
    expect(mpi).toMatchObject({ subContractor: "PROJECT", scope: "ALL", metric: "M71", value: 70593 });
    expect(mpiPt).toMatchObject({ subContractor: "PROJECT", scope: "ALL", metric: "M71PT", value: 0 });
  });

  it("a blank Active Welders cell becomes NULL, never 0", () => {
    const row = buildSnapshotRow("2024-08-16", "Inco", ACTIVE_WELDERS_METRIC, undefined);
    expect(row.value).toBeNull();
    expect(row.subContractor).toBe("INCO");
  });
});

describe("mapUtTrackerRow (ref_ut_tracker_ccc)", () => {
  it("maps all 24 columns and derives joint_id = qciso_no-spool_no-joint_no", () => {
    // 1-indexed like readSheet(): index 0 unused.
    const row: unknown[] = [
      undefined,
      "13020AZ-SV7202063", // 1 QCISO NO
      "5", // 2 JOINT NO
      "SP2", // 3 SPOOL NO
      28, // 4 SIZE
      34, // 5 Wall Thickness
      "9D3AS", // 6 SERVICE CLASS
      "BW", // 7 WELD TYPE
      "13020AZ", // 8 AREA
      new Date(Date.UTC(2024, 4, 24)), // 9 WELD DATE
      "W-276/W-442", // 10 Welder ID
      "W-276/W-442", // 11 WELDER ID 2
      "W-276/W-442", // 12 WELDER ID 3
      "W-276/W-442", // 13 WELDER ID 4
      "CS/LTCS-006", // 14 WPS CODE
      new Date(Date.UTC(2024, 4, 29)), // 15 UT1 DATE
      "NFE1-MUTF00002", // 16 UT1 REP NO
      "R", // 17 UT1 RESULT
      "Mansoor Ali Khan - MUT 2", // 18 UT OPE1
      null, // 19 UT OPE2
      0.001875, // 20 WELDDEFECTLENGTH
      null, // 21 TPI Date
      null, // 22 TPI Report No
      new Date(Date.UTC(2024, 4, 26)), // 23 PWHT DATE
      "PWHT01174", // 24 PWHT REP NO
    ];
    const mapped = mapUtTrackerRow(row);
    expect(mapped.qcisoNo).toBe("13020AZ-SV7202063");
    expect(mapped.jointNo).toBe("5");
    expect(mapped.spoolNo).toBe("SP2");
    expect(mapped.sizeInch).toBe(28);
    expect(mapped.wallThickness).toBe(34);
    expect(mapped.weldDate).toBe("2024-05-24");
    expect(mapped.welderId).toBe("W-276/W-442");
    expect(mapped.ut1RepNo).toBe("NFE1-MUTF00002");
    expect(mapped.utOpe2).toBeNull();
    expect(mapped.tpiDate).toBeNull();
    expect(mapped.jointId).toBe("13020AZ-SV7202063-SP2-5");
  });
});

describe("mapExclusionRow (ref_exclusion_list, ruling R2-02: UNAPPLIED)", () => {
  it("maps Welder No. / RT-UT Report No. / Joint ID / New Reports by column position", () => {
    const row: unknown[] = new Array(125).fill(null);
    row[1] = "NFE1-RT53073-W-310"; // RT Report + Welder (combined, col 1)
    row[5] = "W-310"; // Welder No.
    row[42] = "NFE1-RT53073"; // RT/UT Report No.
    row[121] = "NFE1-RT53073-W-310"; // RT Report + Welder (duplicate, col 121)
    row[123] = "EXLUDE"; // New Reports
    row[124] = "11010P1-CW6294101-SP7-27"; // Joint ID
    const mapped = mapExclusionRow(row);
    expect(mapped).toMatchObject({
      rtReport: "NFE1-RT53073",
      welder: "W-310",
      jointId: "11010P1-CW6294101-SP7-27",
      reason: "EXLUDE",
      combinedKeyRaw: "NFE1-RT53073-W-310",
    });
  });
});
