# The 22 mockup widgets vs. the delivered data

Widget list and formulas: `analysis/mockups/flange-spec.md` (+ `flange-spec.json`).
DAX behind each formula: `analysis/flange/pbix-flange.md` §5.
Every "computed now" number below comes from `uv run analysis/flange/profile_xlsx.py`
(`analysis/flange/metrics.json`), which reproduces the pbix M pipeline over
`sources/Flange Progress.xlsx` + `sources/ovAssets_1619.xlsx` and lands on
**363,245 rows — the pbix's `Flange Progress` row count exactly**.

## The headline: the mockup is an older snapshot

| | mockup `rawData` | delivered workbooks | delta |
|---|---:|---:|---:|
| Total Register | 358,342 | **357,787** | −555 |
| Inspected (`Total Flanges ID Jointed`) | 124,188 | **197,825** | +73,637 |
| Inspected % | 34.66 % | **55.29 %** | +20.63 pp |
| Const-n | 122,867 | **187,756** | +64,889 |
| PCC | 2,276 | **16,880** | +14,604 |
| Leaked | 44 | **386** | +342 |

The mockup's `rawData.monthly.All` runs `Aug…Jan` and its `leakedTimeline` ends `09-Jan-26`,
so it froze the report in **mid-January 2026**. The delivered `Joint Date` column runs to
**2026-08**, and `ovAssets_1619[Record Modified Date]` tops out at `2026-08-02`. The register
is therefore ~7 months newer, which is why every progress number is larger. The single best
alignment proof is the month that is fully inside both windows:

| month | mockup `monthly.All` | computed | delta |
|---|---:|---:|---:|
| 2025-08 | 9,344 | **9,353** | **+9** (0.1 %) |
| 2025-09 | 10,044 | 10,821 | +777 |
| 2025-10 | 16,764 | 14,423 | −2,341 |
| 2025-11 | 15,911 | 15,410 | −501 |
| 2025-12 | 13,336 | 14,351 | +1,015 |
| 2026-01 | 4,747 | 13,367 | +8,620 (mockup cut mid-month) |

`Total Register` moving *down* by 555 while everything else moves up is a register cleanup on
the CCC side: the mockup's CCC total is 227,605 and `ovAssets_1619` — CCC's only source, and
where 100 % of CCC rows come from — now delivers 226,504 (−1,101), partly offset by GAC
(+756), MEDGULF (+56) and one `TBD` row.

## Per-widget verdict

Legend: **✅ yes** = computable now with the same formula and the same inputs ·
**🟡 partial** = computable but with a stated caveat · **❌ no** = no data at all.

### Section: Filters — 3 widgets

| # | widget | formula | source columns | status | what the data yields |
|---|---|---|---|---|---|
| 1 | `#filterSubco` | distinct list | `Flange Progress[Flange Subcontractor]`; hard-coded `"CCC"` for every `ovAssets_1619` row | ✅ yes | `CCC 226,504 · TEKFEN 64,359 · GAC 54,306 · MEDGULF 12,617 · TBD 1` (Joint IDs). The mockup's `[All, CCC, GAC, MEDGULF, TEKFEN]` list matches except for the one stray `TBD` row — and `ACCIONA` (1 row) which the M drops |
| 2 | `#filterHA` | `HA` calc column = `MID([System],2,1)` → HA1-4, else `LOOKUPVALUE('HA l0_abs_guide')` | `[System]`, `[PDS Area Final]`, **`HA l0_abs_guide`** | 🟡 partial | `HA1 145,839 · HA2 60,237 · HA3 85,747 · HA4 59,371 · (blank) 6,593`. The blank bucket = **1.84 %** of Joint IDs, exactly the rows whose `[System]` is empty or `"System-NA"` and which the absent guide would have resolved. Cross-check: for all 226,504 `ovAssets_1619` rows the DAX rule **agrees with the `Process Plant` column in 226,438 cases and disagrees in 0** — `Process Plant` carries the handover area verbatim (`HA1 - Handover Area 1 (…)`) and is a drop-in substitute for the guide on the CCC half |
| 3 | `#filterMethod` | distinct `[Joint Method]` after 6 replace steps | `[Joint Method]` / `[FL - Tightening Method]` | ✅ yes | exactly the mockup's four: `Manual 249,155 · Torquing 103,713 · Tensioning 2,913 · TBN 2,006`. Raw spellings normalised: `Manual Torquing`→Manual (5,986), `Hydraulic Torquing`→Torquing (81), `Torquing Critical`→Torquing (5), `Tensionning`→Tensioning (579), `Torqueing`→Torquing (58,431), null→TBN |
| 4 | `✕ Reset` button | `resetFilters()` — state only | — | ✅ yes | UI only |
| 5 | `📊 Export` button | `exportData()` — CSV of all `rawData` | — | ✅ yes | UI only; exports whatever the server computes |

### Section: Summary Highlights — 4 KPI widgets

| # | widget | formula | source columns | status | computed now | mockup |
|---|---|---|---|---|---:|---:|
| 6 | Total Register (`#sumTotal`) | `DISTINCTCOUNT([Joint ID])` | `[Iso Number]`+`[BT No.]` / `FlangeJointName` | ✅ yes | **357,787** | 358,342 |
| 7 | Total Inspected (`#sumInspected`, `#sumInspectedPct`) | `DISTINCTCOUNT([Joint ID])` where `[Joint Date] > 0`; pct = `/total` | `[Joint Date]` / `Tightening Date - Field027` | ✅ yes | **197,825 (55.29 %)** | 124,188 (34.66 %) |
| 8 | Inspected Const-n (`#sumConstn`) | `"CCC no cat"` const-n (see §5) | `[Joint Date]`, `[PCC Tightening Date- Field039]`, `[Flange Subcontractor]`, `[Cat.]` | ✅ yes | **187,756** | 122,867 |
| 9 | Leaked Flange Break (`#sumLeaked`, `#sumLeakedPct`) | `DISTINCTCOUNT([Joint ID])` where `[Reason for De-Tightening] = "FLANGE LEAKAGE"`; pct = `/inspected` | `[Reason for De-Tightening]` / `PCC Remarks - Field045` | ✅ yes | **386 (0.20 %)** | 44 (0.04 %) |

Leak detail, since the mockup shows CCC = 0 and the delivered data does not:
`FLANGE LEAKAGE` now appears **267×** in `Flange Progress.xlsx[Reason for De-Tightening]`
(GAC 204, TEKFEN 63) and **119×** in `ovAssets_1619[PCC Remarks - Field045]` after the M's two
`Flange leaking`/`Flange leakage` → `FLANGE LEAKAGE` replacements (all CCC). The mockup's
CCC = 0 is a January-2026 fact, not a schema gap.

### Section: Project Inspection & Status Tables — 3 widgets

| # | widget | formula | status | computed now |
|---|---|---|---|---|
| 10 | `Project Flange Inspected` donut (`#inspectionDonut`) | `jm.pct = jm.value / jmTotal`, value = `Total Flanges ID Jointed` by `[Joint Method]` | ✅ yes | `Manual 138,177 (69.85 %) · Torquing 57,397 (29.01 %) · TBN 1,128 (0.57 %) · Tensioning 1,123 (0.57 %)`; centre = 197,825. Mockup's initial labels are `[Manual, Torquing, Tensioning]` — TBN now has 1,128 inspected and must appear |
| 11 | `Subcontractor Flange Status` table | 7 columns = the 7 measures, `pct = inspected/total` | ✅ yes | see the table below |
| 12 | `HA Flange Status` table (+ per-method detail rows via `toggleHADetails`) | same measures grouped by `[HA]`, detail rows by `[HA]`×`[Joint Method]` | 🟡 partial | computable; carries a 5th `(blank)` HA row of 6,593 Joint IDs the mockup never had |

Widget 11 in full (the mockup's own columns), computed now:

| Subcontractor | Total | Const-n | PCC | Inspected | % | Leaked | *mockup Total* | *mockup Inspected* |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| CCC | 226,504 | 88,794 | 6,820 | 92,934 | 41.03 % | 119 | *227,605* | *59,444* |
| TEKFEN | 64,359 | 57,121 | 4,529 | 59,398 | 92.29 % | 63 | *64,626* | *33,017* |
| GAC | 54,306 | 32,581 | 5,469 | 36,171 | 66.61 % | 204 | *53,550* | *25,022* |
| MEDGULF | 12,617 | 9,260 | 62 | 9,322 | 73.88 % | 0 | *12,561* | *6,705* |
| TBD | 1 | 0 | 0 | 0 | 0.00 % | 0 | — | — |

Widget 12 in full:

| HA | Total | Const-n | PCC | Inspected | % | Leaked | Remains | *mockup Total* |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| HA1 | 145,839 | 130,575 | 15,808 | 140,181 | 96.12 % | 366 | 5,887 | *156,332* |
| HA2 | 60,237 | 33,774 | 649 | 34,096 | 56.60 % | 12 | 26,224 | *58,999* |
| HA3 | 85,747 | 19,771 | 354 | 19,888 | 23.19 % | 8 | 65,909 | *83,533* |
| HA4 | 59,371 | 1,468 | 44 | 1,470 | 2.48 % | 0 | 57,903 | *59,474* |
| (blank) | 6,593 | 2,168 | 25 | 2,190 | 33.22 % | 0 | 4,403 | — |

HA1 is 10,493 Joint IDs short of the mockup while HA2/HA3 are ~1,200/2,200 over and 6,593 sit
in `(blank)`. That is more movement than the absent `HA l0_abs_guide` alone explains, so the
`[System]` values themselves also changed between the two snapshots. **RF-03** below asks
for the guide so this can be settled rather than guessed.

### Section: HA1 Subcontractor & Progress — 2 widgets

| # | widget | formula | status | computed now |
|---|---|---|---|---|
| 13 | `HA 1 Subcontractor Flange Status` table | per-subco rows inside the selected HA (`filters.ha`, default `HA1`), **method filter ignored** | 🟡 partial | HA1: `CCC 58,056 / 55,121 insp. · TEKFEN 52,312 / 50,701 · GAC 29,737 / 28,739 · MEDGULF 5,734 / 5,620` (mockup: 58,369 / 55,817 / 33,515 / 8,631 totals). Same HA-attribution caveat as #12 |
| 14 | `HA 1 Flange Inspection Progress` donut | `Inspected Const` / `Inspected PCC` / `Remains`, each `/ total` | 🟡 partial | HA1 = total 145,839, const-n 130,575 (89.53 %), PCC 15,808 (10.84 %), remains 5,887 (4.04 %). The mockup's `ha1Progress` is `null` for HA2-4 with no subco filter; with live data every HA resolves, so the `(Blank)` branch becomes dead code |

### Section: Leaked Flange Break % Timeline — 1 widget

| # | widget | formula | source | status |
|---|---|---|---|---|
| 15 | `Leaked Flange Break % Timeline` line chart | y = `Avg(Flange BreakDown[Project Fl.BreakDown % Rej Rate])` by `Flange BreakDown[Date]`; badge = a fresh `Flanges ID BreakDown` | **`Flange BreakDown` (288 rows) ← `CUM Trend Flange Progress Break Down Rate % .xlsx` — absent** | 🟡 partial |

The workbook that holds the *as-reported weekly* series is not in `sources/`. What is
recoverable from the delivered register is the **cumulative** rate the pbix measure
`CUM Flange Rejection Rate Project` defines (`[Flanges ID BreakDown]/[Total Flanges ID
Jointed]` as-of each date). Leaks by `[Joint Date]` month, computed now:

`2025-05 21 · 06 9 · 07 10 · 08 27 · 09 18 · 10 16 · 11 9 · 12 29 · 2026-01 49 · 02 6 · 03 3 · 04 8 · 05 44 · 06 1 · 07 58 · 08 68` (386 total).

Note what this *is*: a current-state register back-dating each leak to the joint's own
`[Joint Date]`, not the weekly snapshot that was published at the time. The mockup's series
(`0.02 % → 0.04 %` over six weeks) is a genuinely different number and cannot be rebuilt.
**Render this chart from the recomputed cumulative series and label it as such**, or leave it
honest-empty until the trend workbook arrives — see ruling **RF-04**.

### Section: Repair Overview — 3 widgets

| # | widget | formula | source | status | computed now |
|---|---|---|---|---|---|
| 16 | `Repaired vs To Be Repaired` donut | `Sum(Flg Onepager_data[Repaired])` vs `[To be Repaired]`, `ACCEPTED/REJECTED = "REJECTED"` | `Flg Onepager_data` ← 5 SharePoint repair logs | ❌ **no** | — (mockup: 1,926 / 255) |
| 17 | `Flange Repair (Site Issue)` bar | `Sum([Site SN])` by month × `[Subcontractor]`; badge = `Σ(ccc+gac)` | same | ❌ **no** | — (mockup: Oct 38/1, Nov 97/2, Dec 8/2) |
| 18 | `Flange Repair (Vendor Issue)` bar | `Sum([Vendor SN])` by month × `[Subcontractor]` | same | ❌ **no** | — (mockup: Oct 36/0, Nov 63/0, Dec 29/0) |

There is **no** partial substitute. The one column that could have carried it,
`ovAssets_1619[Flange Repair Record - Field032 (Custom)]`, is **0 non-blank out of 226,504**,
and `Flange Progress.xlsx` has no repair column at all. These three widgets render
honest-empty until the five repair workbooks are delivered (**RF-02**).

### Section: Inspection Progress Overview — 3 KPI widgets

| # | widget | formula | status | computed now | mockup |
|---|---|---|---|---:|---:|
| 19 | Inspected bubble | `Total Flanges ID Jointed`, pct `/ total` | ✅ yes | **197,825 (55.29 %)** | 124,188 (34.66 %) |
| 20 | PCC bubble | `Tightening PCC "CCC no cat"`, `pccPct = d.pcc / d.total` | ✅ yes | **16,880 (4.72 %)** | 2,276 (0.64 %) |
| 21 | Leaked bubble | `Flanges ID BreakDown`, pct `/ inspected` | ✅ yes | **386 (0.20 %)** | 44 (0.04 %) |

### Section: Monthly Inspection — 1 widget

| # | widget | formula | status | computed now |
|---|---|---|---|---|
| 22 | `Monthly Inspection` bar | `Total Flanges ID Jointed` by `[Joint Date]` month, single series `Inspected` | ✅ yes | 48 monthly buckets, `2022-09` … `2026-08` (plus one `2027-02` row — a data-entry typo, 1 Joint ID). Last 6: `2026-03 6,441 · 04 12,371 · 05 11,516 · 06 9,600 · 07 9,832 · 08 6,446` |

## Tally

| | count | widgets |
|---|---:|---|
| ✅ fully reproducible now | **14** | 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 19, 20, 21, 22 |
| 🟡 partial | **5** | 2, 12, 13, 14 (HA attribution: 1.84 % of Joint IDs unresolved without `HA l0_abs_guide`) · 15 (cumulative recompute, not the as-reported weekly series) |
| ❌ not reproducible | **3** | 16, 17, 18 (the repair trio — zero source data) |

**19 of 22 widgets (86 %) render with real numbers today.** The dashboard is not blocked;
three tiles are.

## Two things a builder must not get wrong

1. **Grain.** The fact is one row per *register line*, not per flange.
   `Flange Progress.xlsx` contributes 136,741 rows for **131,283** distinct Joint IDs
   (5,458 repeats — the same flange re-jointed, visible as `Joint Point` `1FR`, `1FR2`, `2FR`…);
   `ovAssets_1619` contributes 226,504 rows for 226,504 Joint IDs (no repeats). **Every single
   mockup number is a `DISTINCTCOUNT([Joint ID])`**, so every SQL metric must be
   `COUNT(DISTINCT joint_id)`, never `COUNT(*)`. The two files' Joint-ID namespaces are
   **completely disjoint** — intersection **0**, union 357,787 — so `Table.Combine` is a plain
   `UNION ALL` and no de-duplication across sources is needed or wanted.
2. **`Cat.` is not populated for CCC.** `ovAssets_1619[Category for final tightening]` is
   75.3 % filled (`X 87,948 · Y 65,460 · Z 17,052 · A 158`, 55,886 blank → `TBN`). That is
   precisely why the pbix carries the `"CCC no cat"` measure pair, and why the plain
   `Total Flanges ID Tightening Constraction` / `… PCC` / `… TBN` trio must **not** be used
   for the mockup's tiles. Using the plain trio yields CCC const-n ≈ 0.
