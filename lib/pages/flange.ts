/**
 * The flange dashboard — one filter-driven page.
 *
 * `getFlangePage(filters)` returns a `PageModel` with `page: 0` (a single-page
 * report, not one of the 44 welding pages) whose widgets follow
 * `analysis/mockups/flange-spec.json`'s 8 sections in order: the filter bar,
 * 4 summary KPIs, the inspection donut + 2 status tables, the per-HA
 * subcontractor table + progress donut, the leak timeline, the repair trio,
 * 3 progress bubbles, and the monthly bar.
 *
 * ── What is real and what is not ────────────────────────────────────────────
 * 19 of the 22 widgets render live numbers (`analysis/flange/mockup-vs-sources.md`).
 * The three that cannot, and why:
 *
 *  • the repair trio (widgets 16-18) — all five repair logs are absent and the
 *    one column that could have substituted,
 *    `ovAssets_1619[Flange Repair Record]`, is 0 non-blank of 226,504. They
 *    render honest-empty with the file names (RF-02).
 *
 * Two more carry a provenance note rather than a silent caveat:
 *
 *  • every HA widget — `HA l0_abs_guide` is missing, so `ovAssets_1619[Process
 *    Plant]` supplies the CCC-side handover area (0 disagreements on 226,438
 *    rows against the DAX rule) and 4,403 Joint IDs stay `(blank)` (RF-03);
 *  • the leak timeline — the as-reported weekly workbook is absent, so the
 *    series is recomputed as a cumulative rate and labelled exactly so (RF-04).
 *
 * RF-01: the dashboard ships live. The mockup is a mid-January-2026 freeze and
 * the register now runs to 2026-08, so the mockup's numbers are NOT pinned;
 * `meta.as_of` carries the register's own max date.
 */

import type {
  ChartWidget,
  FilterWidget,
  KpiWidget,
  PageModel,
  TableWidget,
  Widget,
} from "@/lib/page-model";
import {
  flangeManagementMatrix,
  FLANGE_METHODS,
  FLANGE_ALL,
  FLANGE_BLANK,
  FLANGE_REPAIR_SOURCES,
  flangeAllOptions,
  flangeAsOf,
  flangeBreakdown,
  flangeLeakTimeline,
  flangeLoaded,
  flangeMonthly,
  type FlangeFilters,
  type FlangeStats,
} from "@/lib/metrics/flange";

export const FLANGE_PAGE_ID = "flange";
export const FLANGE_TITLE = "Flange Inspection Dashboard";

/** KPI placeholder for a metric no loaded source can produce. */
export const HONEST_EMPTY = "—";

const NF = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const NF2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function int(v: number | null | undefined): string {
  return v === null || v === undefined ? HONEST_EMPTY : NF.format(v);
}

/** Table cell: blank for zero, matching the welding pages. */
function cellInt(v: number | null | undefined): string {
  return v === null || v === undefined || v === 0 ? "" : NF.format(v);
}

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? HONEST_EMPTY : `${NF2.format(v * 100)}%`;
}

function cellPct(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : `${NF2.format(v * 100)}%`;
}

// ── notes ───────────────────────────────────────────────────────────────────

const REPAIR_NOTE =
  "The three repair widgets are empty because no repair source is loaded " +
  "(ruling RF-02). They need the five SharePoint logs — " +
  `${FLANGE_REPAIR_SOURCES.join(", ")} — and there is no partial substitute: ` +
  "ovAssets_1619's Flange Repair Record column is 0 non-blank of 226,504 rows " +
  "and Flange Progress.xlsx has no repair column at all.";

const HA_NOTE =
  "Handover-area provenance (ruling RF-03): HA l0_abs_guide is missing, so the " +
  "CCC side uses ovAssets_1619[Process Plant], which agrees with the DAX rule " +
  "on 226,438 rows with 0 disagreements. The joints it cannot resolve are shown " +
  "as their own “(blank)” row — never folded into HA1.";

const LEAK_NOTE =
  "Leak timeline: recomputed from records — the as-reported weekly file is " +
  "missing (ruling RF-04). This is the cumulative rate (leaked-to-date over " +
  "inspected-to-date) with each leak back-dated to its joint's own Joint Date, " +
  "not the weekly series that was published at the time. The two are genuinely " +
  "different numbers.";

const EMPTY_NOTE =
  "The flange register is not loaded: the `flange` table has no rows, so every " +
  "figure on this page is unavailable — not zero, and there is no “data as of” " +
  "date to show because there is no data to date.";

const SNAPSHOT_NOTE =
  "Live data (ruling RF-01). The mockup is a mid-January-2026 freeze; this " +
  "register runs later, so its progress numbers are legitimately larger and are " +
  "not expected to match the mockup.";

// ── widget builders ─────────────────────────────────────────────────────────

function filterWidget(
  id: string,
  label: string,
  options: string[],
  value: string,
): FilterWidget {
  return { kind: "filter", id, label, options, value };
}

function kpi(label: string, value: string, sub?: string): KpiWidget {
  return { kind: "kpi", label, value, sub };
}

/** The 7-column status table shared by all three tables. */
const STATUS_COLUMNS = [
  "Total",
  "Const-n",
  "PCC",
  "Inspected",
  "%",
  "Leaked",
  // `Flange Break Down Rate %` = [Flanges ID BreakDown] / [Total Flanges ID
  // Jointed] -- leaked over INSPECTED, not over the register. Over the register
  // the total reads 0.11 %; over inspected it is 0.19 %, which is the owner's.
  "Leaked %",
] as const;

function statusRow(label: string, s: FlangeStats): string[] {
  return [
    label,
    cellInt(s.total),
    cellInt(s.constn),
    cellInt(s.pcc),
    cellInt(s.inspected),
    cellPct(s.pct),
    cellInt(s.leaked),
    cellPct(s.leakedPct),
  ];
}

function statusTable(
  title: string,
  keyColumn: string,
  rows: string[][],
  total: FlangeStats | null,
): TableWidget {
  const totalRow = total ? statusRow("Total", total) : undefined;
  return {
    kind: "table",
    title,
    columns: [keyColumn, ...STATUS_COLUMNS],
    rows: totalRow ? [...rows, totalRow] : rows,
    total_row: totalRow,
  };
}

function emptyChart(
  canvasId: string,
  title: string,
  chartType: string,
  datasetLabels: (string | undefined)[],
): ChartWidget {
  return {
    kind: "chart",
    canvas_id: canvasId,
    title,
    chart_type: chartType,
    labels: [],
    datasets: datasetLabels.map((l) => ({ label: l ?? "", data: [] })),
  };
}

/** `2026-08` → `Aug-26`, the mockup's month label shape. */
function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const names = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const idx = Number(m) - 1;
  return `${names[idx] ?? m}-${(y ?? "").slice(2)}`;
}

// ── the page ────────────────────────────────────────────────────────────────

export type FlangePageOpts = FlangeFilters;

export async function getFlangePage(
  filters: FlangePageOpts = {},
): Promise<PageModel> {
  const applied = {
    subco: filters.subco || FLANGE_ALL,
    ha: filters.ha || FLANGE_ALL,
    method: filters.method || FLANGE_ALL,
  };
  const notes = new Set<string>();
  const loaded = await flangeLoaded();

  if (!loaded) {
    notes.add(EMPTY_NOTE);
    return emptyPage(applied, notes);
  }

  notes.add(SNAPSHOT_NOTE);
  notes.add(HA_NOTE);
  notes.add(REPAIR_NOTE);
  notes.add(LEAK_NOTE);

  // The HA panel keeps its own HA selection: the mockup defaults it to HA1 and
  // relabels when the HA filter moves. It also ignores the method filter.
  const panelHa = applied.ha === FLANGE_ALL ? "HA1" : applied.ha;

  // Four scans, not thirteen: `flangeBreakdown` returns overall + the four
  // group-bys from one GROUPING SETS pass, and the panel is a second pass at
  // its own scope. RF-09's budget is 500 ms over 363k rows.
  const panelScope = { ...applied, ha: panelHa, method: FLANGE_ALL };
  const [options, breakdown, panel, monthly, leakSeries, stamp] = await Promise.all([
    flangeAllOptions(),
    flangeBreakdown(applied),
    flangeBreakdown(panelScope),
    flangeMonthly(applied),
    flangeLeakTimeline(applied),
    flangeAsOf(),
  ]);
  const { overall, bySubco, byHa, byMethod, byHaMethod } = breakdown;
  const panelBySubco = panel.bySubco;
  const panelStats = panel.overall;
  const subcoOptions = options.subco;
  const haOptions = options.ha;
  const methodOptions = options.method;
  if (stamp.future_rows > 0) {
    notes.add(
      `“Data as of” excludes ${stamp.future_rows} row(s) whose Joint Date is in ` +
        `the future (the register's known 2027-02 typo, kept by ruling RF-05). ` +
        `Those rows are still counted in every measure.`,
    );
  }

  const widgets: Widget[] = [];

  // ── section 0: filter bar ────────────────────────────────────────────────
  widgets.push(filterWidget("subco", "Subcontractor", subcoOptions, applied.subco));
  widgets.push(filterWidget("ha", "Handover Area", haOptions, applied.ha));
  widgets.push(filterWidget("method", "Joint Method", methodOptions, applied.method));
  // The mockup's "✕ Reset" / "📊 Export" buttons are NOT emitted: they are
  // chrome, not data. Reset belongs to the UI's FilterBar and Export is out of
  // scope; as `text` widgets they rendered as two empty cards.

  // ── section 1: summary highlights ────────────────────────────────────────
  widgets.push(kpi("Total Register", int(overall.total), "Flanges"));
  widgets.push(kpi("Total Inspected", int(overall.inspected), pct(overall.pct)));
  widgets.push(kpi("Inspected Const-n", int(overall.constn), "Construction"));
  widgets.push(
    kpi("Leaked Flange Break", int(overall.leaked), pct(overall.leakedPct)),
  );

  // ── section 2: inspection donut + the two status tables ──────────────────
  const methodSlices = byMethod.filter((m) => m.inspected > 0);
  widgets.push({
    kind: "chart",
    canvas_id: "inspectionDonut",
    title: "Project Flange Inspected",
    chart_type: "doughnut",
    labels: methodSlices.map((m) => m.group),
    datasets: [{ label: "Inspected", data: methodSlices.map((m) => m.inspected) }],
    options_notes: `centre = ${int(overall.inspected)}`,
  });
  widgets.push(
    statusTable(
      "Subcontractor Flange Status",
      "Subcontractor",
      bySubco.map((r) => statusRow(r.group, r)),
      overall,
    ),
  );
  // The HA table carries per-method detail rows under each HA, as the mockup's
  // `toggleHADetails` does. They are indented so a flat renderer still reads.
  const haRows: string[][] = [];
  for (const ha of byHa) {
    haRows.push(statusRow(ha.group, ha));
    for (const d of byHaMethod.filter((m) => m.group === ha.group)) {
      haRows.push(statusRow(`  ${d.group2}`, d));
    }
  }
  widgets.push(statusTable("HA Flange Status", "HA / Method", haRows, overall));

  // ── section 3: the HA panel ──────────────────────────────────────────────
  const haLabel = panelHa === FLANGE_BLANK ? "(blank)" : panelHa.replace(/^HA/, "HA ");
  widgets.push(
    statusTable(
      `${haLabel} Subcontractor Flange Status`,
      "Subcontractor",
      panelBySubco.map((r) => statusRow(r.group, r)),
      panelStats,
    ),
  );
  widgets.push({
    kind: "chart",
    canvas_id: "ha1ProgressDonut",
    title: `${haLabel} Flange Inspection Progress`,
    chart_type: "doughnut",
    labels: ["Inspected Const", "Inspected PCC", "Remains"],
    datasets: [
      {
        label: haLabel,
        data: [panelStats.constn, panelStats.pcc, panelStats.remains],
      },
    ],
    options_notes: `total = ${int(panelStats.total)}`,
  });

  // ── section 4: the leak timeline (RF-04) ─────────────────────────────────
  widgets.push({
    kind: "chart",
    canvas_id: "leakedTimelineChart",
    title: "Leaked Flange Break % Timeline",
    chart_type: "line",
    labels: leakSeries.map((s) => monthLabel(s.month)),
    datasets: [
      {
        label: "Leaked Flg Break % (recomputed from records)",
        data: leakSeries.map((s) => (s.rate === null ? null : Number(s.rate.toFixed(4)))),
      },
    ],
    options_notes:
      "percent-axis; recomputed from records — the as-reported weekly file is missing",
  });

  // ── section 5: the repair trio (RF-02) ───────────────────────────────────
  widgets.push(
    emptyChart("repairedDonut", "Repaired vs To Be Repaired", "doughnut", [undefined]),
  );
  widgets.push(
    emptyChart("siteRepairChart", "Flange Repair (Site Issue)", "bar", ["CCC", "GAC"]),
  );
  widgets.push(
    emptyChart("vendorRepairChart", "Flange Repair (Vendor Issue)", "bar", ["CCC", "GAC"]),
  );

  // ── section 6: the progress bubbles ──────────────────────────────────────
  widgets.push(kpi("Inspected", int(overall.inspected), pct(overall.pct)));
  // The mockup's own markup disagrees with its JS here: the static placeholder
  // is pcc/inspected while the live formula is pcc/total. The JS wins.
  widgets.push(
    kpi("PCC", int(overall.pcc), pct(divideSafe(overall.pcc, overall.total))),
  );
  widgets.push(kpi("Leaked", int(overall.leaked), pct(overall.leakedPct)));

  // ── section 7: monthly inspection ────────────────────────────────────────
  widgets.push({
    kind: "chart",
    canvas_id: "monthlyChart",
    title: "Monthly Inspection",
    chart_type: "bar",
    labels: monthly.map((m) => monthLabel(m.month)),
    datasets: [{ label: "Inspected", data: monthly.map((m) => m.inspected) }],
  });

  for (const n of notes) widgets.push({ kind: "text", text: n });

  return {
    page: 0,
    id: FLANGE_PAGE_ID,
    title: FLANGE_TITLE,
    widgets,
    filters: applied,
    meta: { source: "database", as_of: stamp.as_of ?? undefined },
  };
}

function divideSafe(a: number, b: number): number | null {
  return b === 0 ? null : a / b;
}

/**
 * The same widget skeleton with no numbers, for when `flange` has no rows.
 * The structure is identical so the UI renders the page either way and the
 * structural test can compare it without a database.
 */
function emptyPage(
  applied: { subco: string; ha: string; method: string },
  notes: Set<string>,
): PageModel {
  const widgets: Widget[] = [];
  widgets.push(filterWidget("subco", "Subcontractor", [FLANGE_ALL], applied.subco));
  widgets.push(filterWidget("ha", "Handover Area", [FLANGE_ALL], applied.ha));
  widgets.push(filterWidget("method", "Joint Method", [FLANGE_ALL], applied.method));
  widgets.push(kpi("Total Register", HONEST_EMPTY, "Flanges"));
  widgets.push(kpi("Total Inspected", HONEST_EMPTY, HONEST_EMPTY));
  widgets.push(kpi("Inspected Const-n", HONEST_EMPTY, "Construction"));
  widgets.push(kpi("Leaked Flange Break", HONEST_EMPTY, HONEST_EMPTY));

  widgets.push(
    emptyChart("inspectionDonut", "Project Flange Inspected", "doughnut", ["Inspected"]),
  );
  widgets.push(statusTable("Subcontractor Flange Status", "Subcontractor", [], null));
  widgets.push(statusTable("HA Flange Status", "HA / Method", [], null));

  const haLabel = applied.ha === FLANGE_ALL ? "HA 1" : applied.ha.replace(/^HA/, "HA ");
  widgets.push(
    statusTable(`${haLabel} Subcontractor Flange Status`, "Subcontractor", [], null),
  );
  widgets.push(
    emptyChart(
      "ha1ProgressDonut",
      `${haLabel} Flange Inspection Progress`,
      "doughnut",
      [haLabel],
    ),
  );
  widgets.push(
    emptyChart("leakedTimelineChart", "Leaked Flange Break % Timeline", "line", [
      "Leaked Flg Break % (recomputed from records)",
    ]),
  );
  widgets.push(
    emptyChart("repairedDonut", "Repaired vs To Be Repaired", "doughnut", [undefined]),
  );
  widgets.push(
    emptyChart("siteRepairChart", "Flange Repair (Site Issue)", "bar", ["CCC", "GAC"]),
  );
  widgets.push(
    emptyChart("vendorRepairChart", "Flange Repair (Vendor Issue)", "bar", ["CCC", "GAC"]),
  );
  widgets.push(kpi("Inspected", HONEST_EMPTY, HONEST_EMPTY));
  widgets.push(kpi("PCC", HONEST_EMPTY, HONEST_EMPTY));
  widgets.push(kpi("Leaked", HONEST_EMPTY, HONEST_EMPTY));
  widgets.push(
    emptyChart("monthlyChart", "Monthly Inspection", "bar", ["Inspected"]),
  );

  for (const n of notes) widgets.push({ kind: "text", text: n });

  return {
    page: 0,
    id: FLANGE_PAGE_ID,
    title: FLANGE_TITLE,
    widgets,
    filters: applied,
    meta: { source: "database" },
  };
}

/** Valid filter values, for the API's 400 response. */
export async function flangeFilterOptions(): Promise<Record<string, string[]>> {
  if (!(await flangeLoaded())) {
    return { subco: [FLANGE_ALL], ha: [FLANGE_ALL], method: [FLANGE_ALL] };
  }
  return flangeAllOptions();
}


// ── FLANGE MANAGEMENT / Repartition and Progress ────────────────────────────

/**
 * The second flange page: one matrix, HA × Sub-contractor × tightening method.
 *
 * `Required` is every flange in the register for the group; `Completed` is the
 * inspected total, Const-n plus PCC. Both are the measures the HA Flange Status
 * table already shows, so this page introduces no new DAX — it is a different
 * arrangement of the same two numbers.
 *
 * The hierarchy is flattened into one table: each HA parent row followed by its
 * sub-contractor children, then the grand total. Children are marked with a
 * two-space indent in the first cell so a view can style them without needing a
 * parallel structure. Blank cells are `""`, never `0` — the owner's matrix
 * leaves a method a party never used empty, and a zero would read as "measured,
 * and it was none".
 */
export const FLANGE_MANAGEMENT_TITLE = "FLANGE MANAGEMENT / Repartition and Progress";

export async function getFlangeManagementPage(
  filters: FlangeFilters = {},
): Promise<PageModel> {
  const [matrix, options, asOf] = await Promise.all([
    flangeManagementMatrix(filters),
    flangeAllOptions(),
    flangeAsOf(),
  ]);

  const columns = ["HA"];
  for (const m of [...FLANGE_METHODS, "Total"]) {
    columns.push(`${m} Required`, `${m} Completed Total`, `${m} Completed %`);
  }

  const int = (n: number) => n.toLocaleString("en-US");
  const pct = (a: number, b: number) =>
    b === 0 ? "" : `${((a / b) * 100).toFixed(2)}%`;

  const rows = matrix.map((r) => {
    const cells = [r.child ? `  ${r.group}` : r.group];
    for (const m of [...FLANGE_METHODS, "Total"]) {
      const c = r.cells[m] ?? { required: 0, completed: 0 };
      // A method a group never used is blank, not zero.
      cells.push(
        c.required === 0 ? "" : int(c.required),
        c.completed === 0 ? "" : int(c.completed),
        pct(c.completed, c.required),
      );
    }
    return cells;
  });

  const widgets: Widget[] = [
    // Same ids and labels as /flange, so one filter bar drives both pages.
    filterWidget("subco", "Subcontractor",
      [FLANGE_ALL, ...(options.subco ?? [])], filters.subco ?? FLANGE_ALL),
    filterWidget("ha", "Handover Area",
      [FLANGE_ALL, ...(options.ha ?? [])], filters.ha ?? FLANGE_ALL),
    filterWidget("method", "Joint Method",
      [FLANGE_ALL, ...(options.method ?? [])], filters.method ?? FLANGE_ALL),
    {
      kind: "table",
      title: "Repartition and Progress",
      columns,
      rows,
    },
    {
      kind: "text",
      text:
        "Required is every flange in the register for the group; Completed is " +
        "the inspected total (Const-n + PCC) \u2014 the same two measures the HA " +
        "Flange Status table shows, rearranged. A flange with no tightening " +
        "method has no column to land in and is outside the matrix, which is " +
        "why the grand total is one short of the register.",
    },
  ];

  return {
    page: 0,
    id: "flange-management",
    title: FLANGE_MANAGEMENT_TITLE,
    widgets,
    filters: {
      ha: filters.ha ?? FLANGE_ALL,
      subco: filters.subco ?? FLANGE_ALL,
      method: filters.method ?? FLANGE_ALL,
    },
    meta: { source: "database", as_of: asOf.as_of ?? undefined },
  };
}
