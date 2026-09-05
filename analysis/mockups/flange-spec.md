# Flange Management Dashboard -- extracted spec

Source: `mockups/flange-dashboard 1.html` (single-page, filter-driven via `filterHA`/`filterSubco`/`filterMethod`). Extracted by `analysis/mockups/extract_flange.py`.

## Global

- `<html data-theme="dark" data-mood="pastel">` (dark theme, pastel mood by default; both are toggled client-side and persisted to localStorage).
- External scripts: https://cdn.jsdelivr.net/npm/chart.js
- External stylesheets: https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap, https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap
- 10 CSS custom-property blocks found in `<style>` (`:root` + one block per mood, plus a `[data-theme="light"]` variant of each mood): `:root`, `[data-theme="light"][data-mood="pastel"]`, `[data-mood="ocean"]`, `[data-theme="light"][data-mood="ocean"]`, `[data-mood="desert"]`, `[data-theme="light"][data-mood="desert"]`, `[data-mood="upsidedown"]`, `[data-theme="light"][data-mood="upsidedown"]`, `[data-mood="powerbi"]`, `[data-theme="light"][data-mood="powerbi"]`
- JS `palettes` object mirrors the moods: pastel, ocean, desert, upsidedown, powerbi (each gives colors[8], icon, label -- charts read colors via getColors()/palettes[currentMood].colors).

## Sections & widgets

### Filters  (`id=filterBar`, title source: synthesized (container has no h2/h3; class="filter-bar"))

- **filter** `#filterSubco` -- options: [All, CCC, GAC, MEDGULF, TEKFEN], default: `All`
- **filter** `#filterHA` -- options: [All, HA1, HA2, HA3, HA4], default: `All`
- **filter** `#filterMethod` -- options: [All, Manual, Torquing, Tensioning, TBN], default: `All`
- **text/button** "✕ Reset" -- `onclick="resetFilters()"`
- **text/button** "📊 Export" -- `onclick="exportData()"`

### Summary Highlights  (`id=summaryHighlights`, title source: synthesized (container has no h2/h3; class="summary-highlights", 4 .summary-card tiles))

- **kpi** Total Register (`#sumTotal`) = 358,342, sub = Flanges
- **kpi** Total Inspected (`#sumInspected`) = 124,188, sub = 34.66% (`#sumInspectedPct`)
- **kpi** Inspected Const-n (`#sumConstn`) = 122,867, sub = Construction
- **kpi** Leaked Flange Break (`#sumLeaked`) = 44, sub = 0.04% (`#sumLeakedPct`)

### Project Inspection & Status Tables  (`id=dashboardGrid1`, title source: synthesized (container has no h2/h3; class="dashboard-grid", first grid, 3 cards each with its own h3))

- **chart** "Project Flange Inspected" (`#inspectionDonut`, `doughnut`, rendered by `renderInspectionDonut()`) -- initial labels: ['Manual', 'Torquing', 'Tensioning']
- **table** "Subcontractor Flange Status" (`#subcoBody`, populated by `renderSubcoTable()`) -- columns: ['Subcontractor', 'Total', 'Const-n', 'PCC', 'Inspected', '%', 'Leaked']
- **table** "HA Flange Status" (`#haBody`, populated by `renderHATable()`) -- columns: ['HA / Method', 'Total', 'Const-n', 'PCC', 'Inspected', '%', 'Leaked']

### HA1 Subcontractor & Progress  (`id=ha1Section`, title source: synthesized (grid container DOES carry id="ha1Section" but no own h2/h3; the 2 cards inside have their own h3, dynamically retitled to the selected HA))

- **table** "HA 1 Subcontractor Flange Status" (`#ha1SubcoBody`, populated by `renderHA1SubcoTable()`) -- columns: ['Subcontractor', 'Total', 'Const-n', 'PCC', 'Inspected', '%', 'Leaked']
- **chart** "HA 1 Flange Inspection Progress" (`#ha1ProgressDonut`, `doughnut`, rendered by `renderHA1ProgressDonut()`) -- initial labels: ['Inspected Const', 'Inspected PCC', 'Remains']

### Leaked Flange Break % Timeline  (`id=leakedTimelineCard`, title source: h3)

- **chart** "Leaked Flange Break % Timeline" (`#leakedTimelineChart`, `line`, rendered by `renderLeakedTimelineChart()`) -- initial labels: ['05-Dec-25', '12-Dec-25', '19-Dec-25', '26-Dec-25', '02-Jan-26', '09-Jan-26']

### Repair Overview  (`id=repairGrid`, title source: synthesized (container has no h2/h3; class="grid-3", 3 cards each with own h3))

- **chart** "Repaired vs To Be Repaired" (`#repairedDonut`, `doughnut`, rendered by `renderRepairedDonut()`) -- initial labels: ['Repaired', 'To be Repaired']
- **chart** "Flange Repair (Site Issue)" (`#siteRepairChart`, `bar`, rendered by `renderSiteRepairChart()`) -- initial labels: ['Oct', 'Nov', 'Dec']
- **chart** "Flange Repair (Vendor Issue)" (`#vendorRepairChart`, `bar`, rendered by `renderVendorRepairChart()`) -- initial labels: ['Oct', 'Nov', 'Dec']

### Inspection Progress Overview  (`id=inspectionProgressOverview`, title source: h3)

- **kpi** Inspected (`#bubbleInspVal`) = 124,188, sub = 34.66% (`#bubbleInspPct`)
- **kpi** PCC (`#bubblePccVal`) = 2,276, sub = 0.64% (`#bubblePccPct`)
- **kpi** Leaked (`#bubbleLeakVal`) = 44, sub = 0.04% (`#bubbleLeakPct`)

### Monthly Inspection  (`id=monthlyChartCard`, title source: h3)

- **chart** "Monthly Inspection" (`#monthlyChart`, `bar`, rendered by `renderMonthlyChart()`) -- initial labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']

Widget totals: 7 chart, 3 table, 3 filter, 7 kpi, 2 text/button.

## Data

All values are hardcoded JS object/array literals (const `rawData`, const `palettes`) parsed verbatim out of the `<script>` block -- there is no server call and no `<table>` markup carrying the numbers (the 3 `<table>` elements in the HTML all ship with empty `<tbody>`, filled by JS).

### `rawData`

Top-level keys: `subco`, `ha`, `leakedTimeline`, `repair`, `monthly`, `ha1Progress`

- `rawData.subco` -- 1 record per subcontractor (4 records). Distinct subcontractors: CCC, GAC, MEDGULF, TEKFEN. Fields per record: total, constn, pcc, inspected, leaked, leakedPct.
- `rawData.ha` -- 1 record per HA (4 records: HA1, HA2, HA3, HA4), each with `.subco{CCC,GAC,MEDGULF,TEKFEN}` (present only where non-zero) and `.methods{Manual,TBN,Tensioning,Torquing}` sub-objects; each `.subco[x]` in turn carries its own `.methods{...}` breakdown. Leaf fields: total, constn, pcc, inspected, leaked.
- `rawData.leakedTimeline` -- 13 filter-key series (`All`, each HA, each Subco, and `HA1_<Subco>` combos), 30 `{date, pct}` points total. Fields: date (string, e.g. '05-Dec-25'), pct (number, %).
- `rawData.repair` -- 13 filter-key records (same key shape as leakedTimeline). Fields per record: repaired (int), toRepair (int), site (array of {month, ccc, gac}), vendor (array of {month, ccc, gac}).
- `rawData.monthly` -- 14 filter-key series (`All`, each Subco, each HA, `HA1_<Subco>` combos, plus one `HA1_Manual` method combo), each an array of 6 `{{month, value}}` points (Aug-Jan). Distinct months: Aug, Dec, Jan, Nov, Oct, Sep.
- `rawData.ha1Progress` -- 13 filter-key records (3 are `null`: HA2/HA3/HA4 with no matching progress breakdown). Fields per non-null record: total, constn, pcc, remains.

### `palettes`

5 mood palettes: pastel, ocean, desert, upsidedown, powerbi. Each record has fields: colors, icon, label (colors is an 8-entry hex array).

## Logic

23 named `function` declarations found in `<script>` (no top-level named arrow-function declarations exist in this file -- all arrow functions are inline callbacks to forEach/map/reduce/addEventListener, documented inline within the owning function's entry below rather than separately).

### `resetFilters()`  (line 626)

Sets filters.{subco,ha,method} back to 'All', resets the three <select> elements to 'All', and calls applyFilters(). No formula (state reset only).

### `getFilteredData()`  (line 634)

The core aggregator. Given the current `filters` (subco/ha/method), sums rawData.ha[<HA>].subco[<Subco>] (or its .methods[<Method>] sub-object when a method filter is active) across the selected HA(s) and subcontractor(s) into result.{total,constn,pcc,inspected,leaked}, plus per-subco rows (subcoList), per-HA rows with per-method detail rows (haList), and per-method inspected totals for the donut (jointMethods). Also computes overall %, leaked % and (within jointMethods) each method's share of the joint-method total.

Formulas (verbatim from source):
- `subcoRow.pct = ((subcoRow.inspected / subcoRow.total) * 100).toFixed(2)`
- `haRow.pct = ((haRow.inspected / haRow.total) * 100).toFixed(2)`
- `detail.pct = md.total > 0 ? ((md.inspected / md.total) * 100).toFixed(2) : 0`
- `jm.pct = jmTotal > 0 ? ((jm.value / jmTotal) * 100).toFixed(2) : 0`
- `result.pct = result.total > 0 ? ((result.inspected / result.total) * 100).toFixed(2) : 0`
- `result.leakedPct = result.inspected > 0 ? ((result.leaked / result.inspected) * 100).toFixed(2) : 0`

### `applyFilters()`  (line 731)

Orchestrator run on load, on any filter change, and on theme/mood switch. Calls getFilteredData(), writes the summary-card / bubble text nodes from the result, relabels the HA1 section title to the selected HA (or 'HA 1' when HA filter is 'All'), then calls rebuildCharts(d).

Formulas (verbatim from source):
- `pccPct = d.total > 0 ? ((d.pcc / d.total) * 100).toFixed(2) : 0`

### `rebuildCharts(d)`  (line 762)

Destroys every live Chart.js instance in `charts`, clears the registry, then re-renders all charts/tables after a 50ms setTimeout (renderAll(d)). No formula.

### `renderAll(d)`  (line 768)

Calls, in order: renderInspectionDonut, renderSubcoTable, renderHATable, renderHA1SubcoTable, renderHA1ProgressDonut, renderLeakedTimelineChart, renderRepairedDonut, renderMonthlyChart, renderSiteRepairChart, renderVendorRepairChart. No formula (dispatcher only).

### `toggleTheme()`  (line 781)

Flips currentTheme between 'dark'/'light', persists to localStorage, updates the sun/moon icon, and re-runs applyFilters() (so charts re-read CSS var colors). No formula.

### `toggleMoodDropdown()`  (line 789)

Toggles the .open class on the mood dropdown menu. No formula (UI only).

### `selectMood(mood)`  (line 791)

Sets currentMood, persists to localStorage, updates the mood icon/label/active option, restarts the Christmas-garland animation if mood is 'upsidedown', and re-runs applyFilters(). No formula.

### `getColors()`  (line 808)

Returns palettes[currentMood].colors, the 8-color array charts pull backgroundColor/borderColor entries from by index. No formula.

### `startGarland()`  (line 810)

Every 800ms, lights a random 6-10 subset of .garland-bulb elements (cosmetic 'Upside Down' mood effect). Formula: n = Math.floor(Math.random() * 5) + 6 (random integer in [6,10]); not data-driven.

Formulas (verbatim from source):
- `n = Math.floor(Math.random() * 5) + 6`

### `renderInspectionDonut(d)`  (line 821)

Builds the 'Project Flange Inspected' doughnut from d.jointMethods (falls back to a single 'No Data' slice of value 1 when empty), sets #donutCenter to fmt(d.inspected), and rebuilds the outside legend with each slice's value and %. d.jointMethods itself is produced by getFilteredData().

Formulas (verbatim from source):
- `d.jointMethods.length > 0 ? d.jointMethods : [{ name: 'No Data', value: 1, pct: 100 }]`

### `renderHA1ProgressDonut(d)`  (line 834)

Picks a lookup key into rawData.ha1Progress: '<HA>_<Subco>' if both HA and subco filters are set, else '<HA>' if only HA is set, else '<Subco>' if only subco is set, else 'All'. If that key maps to null/undefined (e.g. HA2-4 with no subco filter), shows '(Blank)'. Otherwise splits total into Inspected Const / Inspected PCC / Remains (dropping any zero-value slice) and renders the donut + legend.

Formulas (verbatim from source):
- `progressKey = filters.ha + '_' + filters.subco  (both set)`
- `pct = total > 0 ? ((constn / total) * 100).toFixed(2) : 0   // Inspected Const slice`
- `pct = total > 0 && pcc > 0 ? ((pcc / total) * 100).toFixed(2) : 0   // Inspected PCC slice`
- `pct = total > 0 ? ((Math.max(0, remains) / total) * 100).toFixed(2) : 0   // Remains slice`

### `renderRepairedDonut()`  (line 874)

Picks a lookup key into rawData.repair using the same '<HA>_<Subco>' > '<Subco>' > '<HA>' > 'All' precedence as the timeline/monthly charts (falls back through rawData.repair[filters.subco]/[filters.ha]/.All if the combo key is absent). Renders a 2-slice donut (Repaired vs To be Repaired) with rounded percentages, or a single grey 'No Data' slice if total is 0.

Formulas (verbatim from source):
- `pct = total > 0 ? Math.round((repairData.repaired / total) * 100) : 0`
- `pct = total > 0 ? Math.round((repairData.toRepair / total) * 100) : 0`

### `renderLeakedTimelineChart()`  (line 911)

Same key-lookup precedence as renderRepairedDonut but against rawData.leakedTimeline, to get a list of {date, pct} points for the line chart (min 0 / max 0.06 y-axis, tooltip shows pct to 2dp with a '%' suffix). The #leakedBadge text uses `d.leaked` from a *fresh* getFilteredData() call, not the timeline series itself.

Formulas (verbatim from source):
- `ctx => `${ctx.parsed.y.toFixed(2)}%`  // tooltip label`

### `renderMonthlyChart()`  (line 942)

Key precedence: '<HA>_<Subco>' > '<HA>_<Method>' > '<Subco>' > '<HA>' > 'All' into rawData.monthly, to get an [{month, value}] series rendered as a single bar series labelled 'Inspected'. No percentage formula (raw counts only).

### `renderSiteRepairChart()`  (line 965)

Same '<HA>_<Subco>' > '<Subco>' > '<HA>' > 'All' precedence into rawData.repair, reading .site (grouped by month, split into CCC/GAC bar series). Badge = sum of ccc+gac across all months in the selected .site array.

Formulas (verbatim from source):
- `total = repairData.site.reduce((a, x) => a + (x.ccc || 0) + (x.gac || 0), 0)`

### `renderVendorRepairChart()`  (line 993)

Identical to renderSiteRepairChart but reads .vendor instead of .site (Flange Repair - Vendor Issue chart).

Formulas (verbatim from source):
- `total = repairData.vendor.reduce((a, x) => a + (x.ccc || 0) + (x.gac || 0), 0)`

### `renderSubcoTable(d)`  (line 1021)

Renders the 'Subcontractor Flange Status' table body from d.subcoList (the current filtered per-subco rows from getFilteredData), plus a totals row summed across subcoList.

Formulas (verbatim from source):
- `t.pct = t.total > 0 ? ((t.inspected / t.total) * 100).toFixed(2) : 0`

### `renderHA1SubcoTable(d)`  (line 1028)

Renders the 'HA1 Subcontractor Flange Status' table independently of getFilteredData: target HA = filters.ha, or 'HA1' when filters.ha is 'All'; for each subco in scope, reads rawData.ha[<target>].subco[<Subco>] directly (ignores the method filter entirely) and computes each row's % plus a totals row.

Formulas (verbatim from source):
- `pct = ((sd.inspected / sd.total) * 100).toFixed(2)   // per subco row, method filter ignored`
- `t.pct = t.total > 0 ? ((t.inspected / t.total) * 100).toFixed(2) : 0`

### `toggleHADetails(haName)`  (line 1044)

Flips expandedHAs[haName] and re-runs applyFilters() to redraw the HA table with that HA's method detail rows shown/hidden. No formula.

### `renderHATable(d)`  (line 1046)

Renders the 'HA Flange Status' table body from d.haList (rows), with each row's d.details sub-array rendered as extra (initially hidden) detail rows when that HA is expanded, plus a totals row summed across haList.

Formulas (verbatim from source):
- `t.pct = t.total > 0 ? ((t.inspected / t.total) * 100).toFixed(2) : 0`

### `fmt(n)`  (line 1066)

Number -> locale string formatter used everywhere a count is displayed: n ? n.toLocaleString() : '0' (so 0/undefined/null all render as the string '0').

Formulas (verbatim from source):
- `n ? n.toLocaleString() : '0'`

### `exportData()`  (line 1069)

Builds one big CSV string (10 sections: subco summary, HA-by-subco breakdown, HA methods summary, HA>subco>method detail, ha1Progress, monthly, repair summary, site repair by month, vendor repair by month, leaked timeline) by iterating Object.entries() over the *entire* rawData object (all filter-key combinations, not just the current filter selection), then triggers a client-side download via a Blob + <a download>. Only formula: the subcontractor-summary totals row's leaked %.

Formulas (verbatim from source):
- `subcoTotal.total > 0 ? ((subcoTotal.leaked / subcoTotal.inspected) * 100).toFixed(2) : 0`

## Source data gap

This dashboard's entire dataset lives in the JS literal `rawData` embedded in the mockup HTML
(see "Data" above) -- it is a static snapshot, not a live query. To port it, the app needs to
compute the following fields, none of which exist in `sources/`:

- **Per-flange join facts** the mockup implies but never lists individually: Sub-Contractor
  (CCC / GAC / MEDGULF / TEKFEN), HA (HA1-HA4), Joint Method (Manual / Torquing / Tensioning /
  TBN), an inspection/construction/PCC/"leaked" status, and an inspection date (for the monthly
  and weekly-timeline breakdowns) and repair date + repair-cause (site vs vendor) for repaired
  flanges. `rawData` only ever holds pre-aggregated counts (total / constn / pcc / inspected /
  leaked / repaired / toRepair) sliced by these dimensions -- never row-level records.
- **`sources/Weld Dump.txt`** (per CLAUDE.md: ~630MB, 1,002,373 rows, 226 columns,
  semicolon-delimited) is a **weld** register: one row = one weld, with weld-level columns
  (`ISO Number`, `Spool No.`, `Weld No.`, `Weld Cat`, `Weld Type`, `Sub-Contractor`, `WPS No.`,
  `Welder`, `Weld Date`, and the repeating PWHT/HT/RT/UT/MT/PMI/PT/FN/PADLT/ORIF inspection-method
  block). It has no flange-identity column, no "HA" column, no joint method
  (Manual/Torquing/Tensioning/TBN) column, and no flange leak/repair status column.
- **`sources/*.pbix`** (~1GB Power BI file) is reference-only and not machine-readable as text
  per CLAUDE.md, so it cannot be inspected here to confirm whether it contains a flange register.

**No flange source file is present in this repo.** `sources/` contains only the weld dump and the
`.pbix`; neither was inspected further for this task beyond what CLAUDE.md already documents,
per the read-only/no-`sources/`-modification scope of this extraction. Porting this dashboard to
live data requires locating (or being handed) a flange register with the fields listed above --
this extraction cannot and does not speculate about where such a register would come from.
