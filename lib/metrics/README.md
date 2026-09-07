# `lib/metrics` — the SQL metric layer

One module per metric family. Every exported function is parameterised
(`$1…$n`, never string interpolation of a value), returns zod-parsed rows, and
cites the metric id(s) from `analysis/calculation-logic.md` §2 plus the DAX
measure name it implements.

### The pbix cross-check, and what it corrected

A user read four measures out of the live pbix. Three of them found real bugs
here, and all four now reproduce:

| measure | pbix | ours | note |
|---|---:|---:|---|
| `Numb RT/UT "PR all"` | 207,682 | **207,682** | exact |
| `Numb UT "PR All"` | 14,214 | **14,214** | exact |
| `Joint Uniq "PR all" Welded` | 2,209,156 | 2,209,169 | +13, documented, not tuned |
| `MT + PT "PR all"` | 589,065 | 595,251 / 589,067 | see below |

**What was wrong.** `MT + PT "PR all"` read the *imported* `mt_report` /
`pt_report`; the DAX reads the **calculated** `MT Report "PR All"` =
`IF([MT Report] <> "", [MT Report], IF([MT Report CCC] <> "", [MT Report CCC],
BLANK()))`, i.e. coalesced with the CCC joint record. It reported 197,723.
`Numb UT "PR All"` read only the CCC tracker overlay and reported 9,412; the
DAX's `[Manual UT Report No.]` has a branch **per sub-contractor**, and GAC's
and TEKFEN's never read a tracker at all — they read the dump's own
`ut_report` falling back to `manual_ut_report_no`. Ruling R-05's "the trackers
are missing, so the dump is not covered" is true of the trackers and **false of
this measure**. Both are now joint-grain flags in `0016_mv_joint_prall_nde.sql`.

**The KPI/pivot scope split (amended R3-01).** Page-1 CARDS show unfiltered
measure values — Inco INCLUDED — because that is what a pbix card is: a measure
with no visual filter. Tables and pivots keep the visual-level filters
`report-inventory.md` records, Inco excluded. `measureScope()` and
`projectScope()` are the two helpers.

**`RT Acc.Joints` is bound to the TESTED measure**, not the accepted one, on the
report owner's instruction: the pbix card shows 207,682 (`Numb RT/UT "PR all"`)
where M13 gives 202,698. The label says "Acc." and the measure behind it does
not — that mismatch is the pbix's own and is recorded here rather than silently
corrected.

**The MT/PT outlier — ruled.** Three readings match with Inco in; this one only
with Inco out, the gap being exactly Inco's own contribution (6,184 =
2 × 3,092 joints — one source column, `PT/MT Report`, feeds both `mt_report`
and `pt_report`, `inco-column-map.md` row 32). The report owner ruled that
**Inco is not counted in `MT + PT "PR all"`**, so the card excludes it and the
Inco-M investigation was dropped. The remaining +2 against the pbix is
unexplained and not tuned away.

Because the pbix does not treat the cards uniformly, the scope is a per-card
table in `lib/pages/welding.ts` rather than one global flag:

| card | measure | Inco |
|---|---|---|
| Joints Welded | `Joint Uniq "PR all" Welded` | in |
| RT Acc.Joints | `Numb RT/UT "PR all"` (tested) | in |
| Numb UT/PAUT, UT/PAUT "A"/"R" | `Numb UT "PR All"` | in |
| **MT/PT Done** | `MT + PT "PR all"` | **out** |

### R3-01 — INCO is loaded, and excluded at the query layer

`projectScope()` in `scope.ts` is the single place the project filter is
written. It is `sources = the loaded union` **minus**
`PROJECT_EXCLUDED_SUBCONTRACTORS = ['INCO','Inco']`.

Why the query layer and not the loader: the pbix puts this in **69 visual/page
filters**, and `[Total Scope Dia "BW" "PR all"]` includes Inco *explicitly*, so
excluding it at load time would break that measure while excluding it in a
measure would break the 69 filters. ACCIONA is **inside** project scope —
mockup page 2 has an Acciona row and no Inco row.

Both spellings are in the list deliberately. R2-08 canonicalises the party to
upper-case `INCO`; the DAX filters read `Sub-Contractor NOT IN {Inco}`. The
phase-2 code said `<> 'Inco'` only, which would have stopped excluding anything
the moment the loader wrote `INCO` — a silent over-count of every project
total. `tests/metrics-batch3.test.ts` pins both spellings, and pins that
ACCIONA is *not* in the list, with no database needed.

The per-subcontractor pages never use `projectScope()`; they are already scoped
to one party.

---

Two scope families, chosen explicitly per page — never by a flag:

| family | `source IN …` | who uses it |
|---|---|---|
| `"EP"` / `"WD"` | `WELD_DUMP` | the GAC / TEKFEN / MEDGULF pages (4-6, 8-11, 19-40, 42-44) |
| `"PR all"` | `WELD_DUMP`, `CCC_WELDER_RECORD`, `CCC_JOINT_RECORD` | the project pages (1-2) and every CCC page (3, 7, 12-18, 41) |

`ACCIONA` and `INCO` are enum values but no file for either is in `sources/`
(§7 C-12), so `SOURCES_PR_ALL_LOADED` is what queries actually use and every
project page says so. Ruling **R-06** kills the `"PR"` scope entirely —
`Project WD+WR` is a one-row dead table in the shipped pbix.

Reference numbers: `analysis/reconcile_results.json`, reproduced exactly by
`tests/metrics.test.ts` (358 assertions when a database is reachable).

---

## The `as_of` contract

Every DAX `TODAY()` (the aging clocks `No of Days "WD"` / `No of Days "PR all"`,
i.e. M51 and M66) is an **explicit `as_of date` parameter**, resolved by
`withAsOf()` in `lib/db.ts`:

| source | value |
|---|---|
| `?as_of=YYYY-MM-DD` on the API | that date |
| default | `max(weld_date)` of the current load — `2026-08-28` for the 30-Aug-2026 export, the same value `reconcile_check.py` used |
| empty table / no database | today, flagged `fallback_today` so the caller can disclose it |

Never `current_date`: the dump is an export, so ageing against the wall clock
would inflate every "above 30 Days" bucket as the file gets older on disk.

---

## Metric id → function → DAX measure

| metric | function | DAX measure | notes |
|---|---|---|---|
| M01 | `welding.weldingStats().joints_welded` | `[Welded Joint ID Uniq "EP"]` | distinct joints, `repair_reweld=''`, `weld_date IS NOT NULL` |
| M02 | `welding.weldingStats()` at `"PR all"` scope | `[Joint Uniq "PR all" Welded]` | same formula as M01; the union's `repair_reweld` rule is materialised per source by the loader (R2-12) |
| M03 | `welding.weldingStats().joints_welded_incl_repair_reweld` | `[Joint Uniq "PR all" Welded & R/RW]` | denominator of the per-WPS `RT/UT Ratio %` |
| M04 | `weldingStats({…, weldCats:["F"]})` | `[Joint Uniq "PR all" Welded "F"]` | M02 + `Weld Cat = "F"` |
| M05 | `welding.weldTypePivot({thisWeekEnding})` | M02 + `Week_End_Date IN TOP 1` | weeks are Sat→Fri, labelled by the Friday |
| M06 | `trend.weeklyProgress()` | M02 by `Week_End_Date` × `Weld Cat` | reads `mv_weekly_progress` (§6.5) |
| M07 | `welding.weldTypeDistribution()` | M02 by `Weld Type` | the donut |
| M10 | `rt.rtStats().tested` | `[Numb RT/UT]` | `rt_acc_rej IS DISTINCT FROM 'RS'` — blanks count |
| M11 | `rt.rtStatsPrAll().tested` | `[Numb RT/UT "PR all"]` | M10 + `RT Acc/Rej <> "U/Review"` over the union |
| M12 | `rt.rtStats().rejected` | `[Numb RT/UT "R"]` | no `Weld Date` / `RT Report` predicate — literal |
| M13 | `rt.rtStats().accepted` | `[Numb RT/UT "A"]` | **M10 − M12**, not `rt_acc_rej='A'` |
| M14 | `rt.rtStats().rejection_rate_joint` | `[Rejection Rate Joint "WD"]` | M12 / M10 |
| M15 | `wps.wpsRejectionTable().rt_ut_ratio`, page cell `RT/UT Ratio %` | `[RT/UT Ratio % …"EP"]` | can exceed 100 % by design |
| M20 | `rt.rtStats().films` | `[RT Total Films by Joint "EP"]` | `weldpoint_no=1 AND <> 'RS'` |
| M21 | `rt.rtStats().films_acc_sum` / `.films_accepted` | `[RT Total Films by Joint "A" "EP"]` | the mockup's "Films Acc" is M20 − M22 |
| M22 | `rt.rtStats().films_rejected` | `[RT Total Films by Joint "R" "EP"]` | `weldpoint_no=1` only, **no** `<> 'RS'` |
| M23 | `rt.rtStatsPrAll().films` | `[RT Total Films by Joint "PR all"]` | WP1 ∪ `Weld Point Code` R/H/F/C, inclusion–exclusion; see the audit |
| M24 | `rt.rtStatsPrAll().films_rejected` / `.films_accepted` | `[… "PR all" "R"/"A"]` | `"A"` is M23 − `"R"`, as the DAX defines it |
| M25 | `rt.rtStats().film_rejection_rate` | `[RT FILM Ratio % by Joint "EP"]` | M22 / M20 |
| M26 | `rt.rtStats().films_all*`, `wps.wpsRejectionTable()` | `[RT Total Films]`, `[… "A"]`, `[… "R"]` | all weld points — why page 42 shows 171,021 where page 8 shows 123,887 |
| M30 | `ut.utStats().ut_done` | `[Numb UT "EP"]` | `ut_weld_status='NR' AND ut_report IS NOT NULL` |
| M31 | `ut.utStats().ut_accepted` / `.ut_rejected` | `[Numb UT "A"/"R" "EP"]` | |
| M32 | `ut.utStatsPrAll()` | `[Numb UT "PR All"]` | reads `manual_ut_report_no_all` — the tracker OVERLAY, not the imported column. Honest-empty until the overlay is materialised; UT TRACKER (GAC)/(TEK) still missing (R-05) |
| M33 | `ut.utStats().ut_weld_length_m` | `[UT Weld Length by Joint "EP"]` | metres, `weldpoint_no=1` |
| M34 | `ut.utStatsPrAll().ut_rej_length_m` | `[UT Defect Length by Joint "PR all"]` | `Rej Length` + the CCC tracker lookup (`ref_ut_tracker_ccc`), joint-de-duplicated |
| M35 | — | `[UT Inspected Length by Joint "PR all"]` | honest-empty (R-05) |
| M36 | — | `[Rejection UT Rate Length by Sub-Con "PR all"]` | honest-empty: M34 / M35 |
| M37 | `ut.utStats().ut_rejection_rate_joint` | `[Rejection UT Rate Joint "EP"]` | |
| M38 | page cell `UT Ratio %` | `[UT Ratio % UT/ Welded … "EP"]` | M30 / M01 |
| M39 | — | `[Numb UT "PR All" Tracker]` | honest-empty (R-05) |
| M40 | `rt.rtBacklogStats().rt_backlog` | `[RT 5 10 20 100% B.log Joints Weld Status "EP"]` | 16-code hold list **OR** the `rt_pct=100` branch |
| M41 | `rt.rtBacklogAggsPrAll()` | `[RT BACKLOG Total Project "PR all"]` | M40 + `'T1-2'` in the hold list. `'HS CCC'` was already in the 16-code list (R2-13) and is what CCC's synthesised `RT Weld Status` emits on all 484,130 `RT%=100` rows |
| M42 | `rt.rtBacklogStats().rt100_backlog` | `[RT 100% Backlog Joints Weld Status "EP"]` | |
| M43 | `rt.rt100BacklogCondPrAll()` | `[RT100% Backlog "PR all"]` | keys on `RT Date` blank, not `RT Report`, and admits `?`/blank/`S` |
| M44 | `rt.fabricatedAggs()` | `[… "EP" & FABRICATED]` | `EXISTS (spool WHERE spool_id = w.spool_id AND fabricated IS NOT NULL)`. R2-06 unions both masters: `Spool Dump.txt` covers GAC/TEK/MED, `Spool.csv` covers CCC (§7 C-13), and the two are disjoint by subcontractor. Honest-empty while `spool` is empty |
| M45 | `rt.rtBacklogStats().rt_backlog_pwht_y_done` | `[RT … B.log Joints+PWHT Progress Weld Status "EP"]` | `PWHT Y/N IN ('Y', PWHT_AMBIGUOUS_TOKEN)` |
| M46 | `rt.rtBacklogStats().rt_backlog_pwht_n` | `[… +NO PWHT Progress Weld Status "EP"]` | `PWHT Y/N IN ('N', PWHT_AMBIGUOUS_TOKEN)` + blank PWHT status |
| M47 | `rt.rtBacklogStats().rt_backlog_pwht_y_not_done` | `[RT BACKLOG Total Project & PWHT NOT Done "EP"]` | PWHT on hold (`H`/`HS`), no report |
| M48 / M49 | `rt.fabricatedAggs()` | `RT B.log & PWHT … FAB-D` | `(M45 OR M46) AND fabricated` / `M47 AND fabricated` |
| M50 | — | `[… & PWHT Spool Date "PR All"]` | not required: bound only to a pbix visual the mockup does not render |
| M51 | `rt.rtBacklogAging()`, `rt.backlogAgingBy()` | `[RT Backlog within 3 days "WD"]` … | `≤3 / 3–7 / 7–15 / 15–30 / >30` from `weld_date` to `as_of` |
| M52 | `rt.coverageGapByServiceClass()` | `[RT5%/10%/20% Backlog Joints "PRall" (One Formula)]` | grouped by `service_class_cat_ndt` on CCC pages, `service_class_cat_wd` elsewhere; `ha` is added to the grain when populated, and the page discloses when it is not |
| M60 | `pwht.pwhtStats().pwht_backlog_all_types` | `[PWHT Backlog Weld Status All Weld Types "EP"]` | list omits `'HS CCC'`, genuinely |
| M61 | `pwht.pwhtStatsPrAll()` | `[PWHT All BACKLOG All WELD TYPE "PR all"]` | CCC branch (`pwht_y_n_ccc='Y'` AND `pwht_report_no_ccc IS NULL`) **+** everyone else. §7 C-4: CCC's PWHT is a clean Y/N, so the `'25.01'` branch is deliberately absent there |
| M62 | `pwht.pwhtStats().pwht_backlog_rt_types` | `[PWHT Backlog Weld Status "BW" "GW" "EP"]` | M60 + RT weld types |
| M63 | `pwht.pwhtStats().pwht_backlog_rt100` | `[PWHT BACKLOG RT100% "EP"]` | M62 + `rt_pct=100` |
| M64 | `pwht.pwhtStats().pwht_backlog_rt_not_done` | `[PWHT Backlog … RT NOT Done "EP"]` | |
| M65 | `pwht.pwhtStats().pwht_done` | `[PWHT Done All Weld Types "EP"]` | |
| M66 | `pwht.pwhtBacklogAging()` | `[PWHT Backlog within 3 Days "WD"]` … | same clock as M51 |
| M70 | `welding.weldingStats().mt_pt_done` | `[MT + PT "PR all"]` | `"EP"` reading: MT report + PT report |
| M71 | `welding.weldingStats().mt_done` | `[MT Progress All "PR all"]` | |
| M80 | `trend.weeklySnapshot()` | `[CUM …]` | the workbook's `RT% Rate`/`UT% Rate` columns ARE the cumulative rates, so plotting them is the CUM line — no re-accumulation |
| M81 | `trend.TARGET_LINES` | `[% of Target "PR"]` etc. | hard-coded 0.01 / 0.03 / 0.03 / 0.05 |
| M90 | `refs.qualifiedWelders()` | `Sum(SCTR OVERALL APPLIED WELDERS[…])` | `null` until `ref_qualified_welders` is seeded (R-12) |
| M91 | `refs.approvedWpsCount()` | `DistinctCount(WPQ RECORD REGISTER[WPS NO.])` where `DOCUMENT STATUS = 'WPS APPROVED BY CTJV/ CPY'` | **318** (R4-02); `null` until `ref_wps_register` is seeded |
| M92 | `trend.weeklySnapshot({aggregate:true})` | `Sum(TREND Report[…])` | project charts sum the parties at `scope='ALL'` (so a `GAC SG` row is not added on top of `GAC`); per-subcontractor charts filter by party + scope. M40 is marked provisional (R2-09) |
| M99 | — | `[Total Scope Dia … Master Table]` ×4 | **dropped** (R-07): references a table that does not exist |

**Coverage after phase 2: 58 / 58 §2 metric ids accounted for — 47 computed
from `weld` / `spool` / `ref_ut_tracker_ccc`, 2 read from reference tables,
2 read from the weekly snapshot, 1 constant, 5 still honest-empty with the
missing source named (M33/M35/M36 at `"PR all"` scope need the `Weld Length`
workbook; M50 is not rendered; M99 is dropped under R-07), and 1 — M39 — folded
into M32.**

### Honest-empty gates, and what each one actually asks

Getting these wrong is how an absent source becomes a fabricated `0`. Each is
probed once per page, not once per widget:

| gate | question | why not the obvious one |
|---|---|---|
| `sourceHasRows(sources)` | does `weld` hold rows for this page's source? | tells "this subcontractor has no welds" from "the export has not been loaded" |
| `spoolMasterLoaded()` | does `spool` have any row? | with an empty `spool`, `EXISTS(...)` is `false` and every FABRICATED column would read a confident 0 |
| `utCoverage(scope)` | **which in-scope sources** feed the UT measures? | an existence check produced a fabricated 0 **twice**. "Is the tracker loaded?" was true while the overlay was NULL on every row. "Does any in-scope row have the overlay?" went true when INCO's 441 rows landed — and INCO is excluded from project scope, so the KPIs computed over nothing and rendered `0`. Coverage is per source: none covered → `—`; some covered → the partial total plus a note naming what it does and does not cover |
| `hasHaValues(scope)` | is `weld.ha` populated? | M52's `ALLEXCEPT` grain includes the handover area; without it the ratio is one level coarser and the page says so |

---

## Honest-empty policy

> Absence is never a zero.

* A **KPI** whose metric cannot be computed renders `"—"` (`HONEST_EMPTY` in
  `lib/pages/welding.ts`).
* A **table cell** renders the empty string. So does a cell whose value is a
  genuine 0 — that is what the mockup does — but a cell whose *metric* is
  unavailable is blank for a different reason, and the page says which.
* A **chart** whose series is unavailable renders empty `labels` and empty
  `data`, never a row of zeros.
* Every page that had to do any of the above carries a trailing `text` widget
  naming the missing source and the ruling (R-01, R-05, R-08, R-12).
* A `Bundle` whose query returned **no row at all** is marked `present: false`
  and renders blank rather than 0 — the difference between "the count is zero"
  and "we did not get an answer".

The unavailable set, and why:

| what | why | ruling |
|---|---|---|
| CCC pages 3, 7, 12–18, 41; the CCC/ACCIONA/INCO slice of pages 1–2 | `Weld Dump.txt` has 0 CCC rows and (post-filter) 0 ACCIONA rows; the Talisman exports are not in `sources/` | R-01 |
| project-scope UT KPIs (M32/M34/M35/M36/M39) | the three UT tracker workbooks are missing | R-05 |
| every `FABRICATED` column (M44/M48/M49/M50) | `Spool Dump.txt` is missing | R-01 |
| the 6 backlog / cumulative-rejection charts (M80/M92) | history cannot be recomputed from one dump; `weld_weekly_snapshot` is empty | R-08 |
| `Project_Welder` (M90), `WPS Approved` (M91) | manual registers, never computable | R-12 |
| `RT5%/10%/20% B.log Joints` on the CCC pages (M52) | needs the CCC `HA` / `NDT Remarks` grain | R-01 |

---

## DISTINCT-safety audit (ruling R2-01, §7 C-5)

CCC's fact rows are **weld-pass grain**: 5,433,009 rows over ~1,339,063 joints,
about 4.06 rows per joint. Every `count(*)` and every ungated `sum()` inflates
~4x once CCC is in a scope. The audit went measure by measure.

**The rule the audit settles on**, and the reason the two cases differ:

* a value that is **per-row in the source** (a film share, `Rej Length`) is
  summed as the DAX writes it — but still gated to one weld point per joint at
  `"PR all"` scope, per the orchestrator's mid-flight ruling;
* a value that is a **joint-level lookup** (`UT TRACKER (CCC)[Defect
  Lenght(MM).]`) is de-duplicated to one row per joint, because adding it on
  every pass is arithmetic nonsense, not a formula choice.

### The WP1 gate is `weldpoint_no = 1`, for every source (migration 0017)

```sql
w.weldpoint_no = 1
```

This is literally the DAX's own column — `'Weld Dump'[WeldPoint No.]` at `"EP"`
scope, `'Project WD+WR+INCO+Acciona'[WeldPoint No.]` at `"PR all"`.

Migrations 0013 and 0016 instead used a per-source CASE
(`WHEN 'WELD_DUMP' THEN weldpoint_no = 1 ELSE weldpoint_seq = 1`), on the belief
that `weldpoint_no` was dump-only. **It is not.** CCC's `WeldPoint No.` is the
M-mapped column and is populated: 1,342,473 of 5,432,993 `CCC_WELDER_RECORD`
rows carry `weldpoint_no = 1`. The user's pbix cross-check settled it —
M23 `[RT Total Films by Joint "PR all"]` = A + B − C:

| gate | A | B | C | total | pbix 768,101 |
|---|---|---|---|---|---|
| `weldpoint_no = 1` | 365,490.2136 | 512,327.6100 | 109,717.2150 | **768,100.6086 → 768,101** | ✅ exact |
| the 0013/0016 CASE | 363,250.0712 | 512,327.6100 | 109,290.4050 | 766,287.2762 → 766,287 | ❌ by 1,813 |

The whole 1,813 is Inco: it is the only source where `weldpoint_seq = 1`
(7,238 rows) and `weldpoint_no = 1` (10,327 rows) disagree in a way that
survives the A − C cancellation. CCC's M23 is identical under either gate,
because every CCC row carries a `weld_point_code` in `{R,H,F,C}`, so A ⊆ C.

This **supersedes the phase-2 mid-flight ruling** *"the film sums at `"PR all"`
scope must gate per source"*: the gate stays, but it is the DAX's column for all
sources — and the audit below shows three of the five `"PR all"` film measures
carry no WeldPoint filter at all.

`weldpoint_seq` (the *different* pbix column `[WeldPoint No.1 WP1]`, added by
migration 0010) is **not** retired. It survives in exactly two places, neither a
stand-in for `[WeldPoint No.] = 1`:

* `mv_joint.ut_weld_length_m_prall` — M33 `[UT Weld Length by Joint "PR all"]`
  filters `'Project WD+WR+INCO+Acciona'[WeldPoint No.1 WP1] = 1` **by name**,
  and the sibling `[UT Inspected Length by Joint "PR all"]` filters
  `[WeldPoint No.]`. The pbix genuinely uses both columns, for different
  measures;
* the CCC branch of `defectLengthExpr` (M34) — a joint-level `LOOKUPVALUE`
  de-duplicated to one row per joint under ruling R2-01. Its DAX has no
  WeldPoint filter at all; the gate is ours, and deliberate.

### Film-family audit — verbatim DAX, per measure

Every row below was read out of `analysis/pbix/measures.md`. A measure is gated
if and only if its own text says so.

| measure | WeldPoint filter? | other filters | our flag |
|---|---|---|---|
| `[RT Total Films by Joint "EP"]` (M20) | **yes** `[WeldPoint No.]=1` | `<> "RS"` | `films_wp1` |
| `[RT Total Films by Joint "A" "EP"]` (M21) | **yes** | `<> "RS"` | `films_acc_wp1` |
| `[RT Total Films by Joint "R" "EP"]` (M22) | **yes** | — | `films_rej_wp1` |
| `[RT Total Films]` (M26 `"EP"`) | no | `<> "RS"` | `films_all` |
| `[RT Total Films "R"]` (M26 `"EP"`) | no | — | `films_all_rej` |
| `[RT Total Films by Joint "PR all"]` (M23) | **yes**, in terms A and C | `<> RS`, `<> U/Review`, `<> Exclude UT Films`, `<> Exclude Films:Debris` (term A only) | `films_taken_prall` |
| `[RT Total Films by Joint "PR all" "R"]` (M24) | **no** | `<> Exclude UT Films`, `<> RS`, `<> U/Review`, `<> Exclude Films:Debris` | `films_rej_prall` |
| `[RT Total Films "PR all"]` (M26) | **no** | `<> RS`, `<> Exclude Films:Debris`, `<> U/Review` | `films_all_prall` |
| `[RT Total Films "PR all" "R"]` (M26) | **no** | `<> Exclude Films:Debris` **only** | `films_all_rej_prall` |
| `[RT FILM Ratio % by Joint "PR all"]` | — | `[… "PR all" "R"] / [… "PR all"]` | `film_rejection_rate` |

**The `"EP"` twins are gated.** All three carry `'Weld Dump'[WeldPoint No.]=1`
verbatim, so the 358 `reconcile_results.json` assertions were derived from a
correct reading of the DAX: `analysis/reconcile_check.py` and
`analysis/reconcile_results.json` are **untouched**, and the `"EP"` pins
(244,071 films · 1,350 rejected · 338,888 M26) still hold bit-for-bit after 0017.

The `"EP"` and `"PR all"` families are **not** twins of each other, which is why
M24 could be ungated while M22 stays gated. That asymmetry is the pbix's.

#### What moved (measure scope, Inco included)

| measure | before (0016) | after (0017) | pbix |
|---|---|---|---|
| M23 `films_taken_prall` | 766,287.2762 | **768,100.6086 → 768,101** | 768,101 ✅ |
| M24 `films_rej_prall` | 1,517.5932 → 1,518 | **2,151.9996 → 2,152** | 2,152 ✅ |
| M26 `films_all_prall` | 363,277.0712 | **862,917.6086** | — |
| M26 `films_all_rej_prall` | 1,540.5932 | **2,151.9996** | — |

Per sub-contractor, `films_rej_prall` = ACCIONA 19 · CCC 606 · GAC 598 ·
INCO 77.9996 · MEDGULF 44 · TEKFEN 807. The total is **genuinely fractional** —
Inco's `Total No of films Rej` carries fractional values — so 2,151.9996 is the
honest sum and the card rounds it for display. It is not a rounding artefact.

Pages whose numbers move: **1, 2, 3, 7, 41** — the only ones on the `PR_ALL`
variant. Pages 42/43/44 (GAC/TEKFEN/MEDGULF weld-rejection-by-WPS) read the
`"EP"` flags `films_all` / `films_all_rej` and are unchanged, even though those
sub-contractors' `"PR all"` numbers moved.

| measure | before | after | justification |
|---|---|---|---|
| M01/M02/M03/M04, M10-M13, M30-M32, M40-M49, M60-M65 | `count(DISTINCT joint_id)` | unchanged | already DISTINCT-safe; grep confirms no `count(*)` over `weld` anywhere in `lib/metrics` |
| **M23** `[RT Total Films by Joint "PR all"]` | not implemented | 3-term inclusion–exclusion, each term `coalesce(…,0)`, WP1 gated `weldpoint_no = 1` (0017) | `weld_point_code` is no longer a blank placeholder (project-wd-wr-inco-acciona.md §5.2). The `coalesce` is load-bearing: term B matches nothing while only the dump is loaded, and `x + NULL - NULL` is NULL, which rendered the page-1 card as **0** |
| **M24** `[… "PR all" "R"]` | WP1 gated per source (0013/0016) | **ungated** (0017) | the verbatim DAX carries no WeldPoint filter — see the film-family audit above. Ungated = 2,151.9996 → **2,152**, the pbix card exactly; the old gate gave 1,518. Its `"EP"` twin M22 *is* gated and is unaffected |
| **M26** `[RT Total Films]` ×3 | `"PR all"` WP1 gated per source (0013/0016) | **ungated at both scopes** (0017) | neither family's DAX has a WeldPoint filter. The families still differ, but only in their *exclusion* filters, which is what the DAX says: `"PR all"` adds `<> Debris` / `<> U/Review`, and the `"R"` flavour drops `<> RS` entirely |
| **M34** `[UT Defect Length by Joint "PR all"]` | not implemented | `Rej Length` term ungated (per-row); CCC tracker term gated `weldpoint_seq = 1` | `[Defect Length(MM).]` is a `LOOKUPVALUE` into `UT TRACKER (CCC)_Talisman` keyed by Joint ID (project-wd-wr-inco-acciona.md:2114-2138) — one value per joint, not per pass |
| M20/M21/M22 (`"EP"`) | `weldpoint_no = 1` | unchanged | all three carry `'Weld Dump'[WeldPoint No.]=1` verbatim; pinned bit-for-bit by `reconcile_results.json` |
| `weeklyProgress` (M06) | `sum` over `weld_type` within a week | unchanged, documented | `mv_weekly_progress`'s own header warns its joint counts are not additive **across weeks**; summing weld types inside one week is safe because a row has one weld type |

Evidence that the `"EP"` family did not move: `tests/metrics.test.ts` pins
`joints_welded = 859,151`, `films = 244,071`, `films_rejected = 1,350`,
`films_all = 338,888` at project `"EP"` scope, plus all 358 original assertions.

**One unresolved disagreement in the evidence, flagged rather than decided.**
Ruling R2-04 and §7 C-6 say CCC's `RT Film Total` is a weld-point *share* (145
distinct decimals, `0.75` on 296,274 rows), which would make an ungated sum
correct. `analysis/pbix/project-wd-wr-inco-acciona.md:3128` glosses the same
column as "плёнок на стык (максимум)" — a per-joint total repeated on every
pass, which would make an ungated sum inflate ~4x. The gate satisfies the
second reading and the orchestrator's ruling; if the first is right it
under-counts CCC films. `tests/metrics-ccc.test.ts` contains the discriminating
check — it reports what fraction of per-joint film sums land on whole numbers
(high = share, low = repeated total) — so the call can be made with a number.

---

## Deviations from a literal DAX port (flagged)

1. **Aging buckets take `max(weld_date)` per joint.** The DAX ages row by row,
   so one joint with two backlog rows of different weld dates would land in two
   buckets. `analysis/reconcile_check.py` takes the latest date per joint, and
   that is the only reading under which the buckets sum to the backlog total
   (`calculation-logic.md` §4.3). The reconcile numbers are the pin, so the SQL
   follows it. Both readings are one `GROUP BY` apart if the owner rules
   otherwise.
2. **M45 / M46 / M47 are computed as "M40's predicate AND the PWHT test".**
   The literal DAX for M45 omits the `Weld Type IN {BW,GW,CLET,MW}` restriction
   on its first branch. `reconcile_check.py` applies it (the numbers pinned in
   `reconcile_results.json` are the restricted ones), and every page that shows
   M45 also shows M40 beside it, so the two must agree. Flagged.
3. **M52 is evaluated at `service_class_cat_wd` grain**, not the DAX's
   `ALLEXCEPT(HA, Service Class, Service Class + Service Cat+NDT Remarks)`:
   `ha` and `ndt_remarks` are `Project WD+WR+INCO+Acciona` columns and are not
   in the §8.1 dump contract. The pages that render M52 are CCC pages, which
   are honest-empty anyway.
4. **`dia_inch_factor` is compared as text** (`::text IN ('Y','y','true','t')`)
   because §8.1 types it `boolean` and `calculation-logic.md` §6.2 types it
   `char(1)`. Whichever DB-LANE ships, the predicate works. Worth settling.
5. **`M13 = M10 − M12`** is kept as a subtraction of two independent distinct
   counts, exactly as the DAX does. It is *not* `rt_acc_rej = 'A'`, and the two
   differ.
6. **The PWHT-by-RT% pages apply `pwht_weld_status IS NOT NULL` page-wide.**
   §3.3 puts that filter on the detail table only. It is a no-op for every
   backlog measure (their status whitelist is non-blank by construction) and
   only restricts `Joints Welded` / `PWHT Done`, which is what the mockup's
   smaller totals on pages 20/22/24/28/30/32/35/37/39 show.
7. **The per-WPS scope does not add `weld_date IS NOT NULL`** even though §3.4
   lists it, because `reconcile_check.py` does not and the pinned
   `wps_gac_nonsg` numbers are computed without it. The welded/tested counts
   carry the predicate in their own `FILTER`, so only the film sums could
   differ.
8. **`PWHT Y/N = '25.01'` counts as both `Y` and `N`** — `PWHT_AMBIGUOUS_TOKEN`
   in `scope.ts`. Indefensible as logic, faithful to the model; ruling R-04
   says reproduce and flag rather than silently fix.

---

## Live verification (2026-09-05 load)

`npx vitest run tests/metrics.test.ts` — **35/35 green, 358 assertions**, every
number in `analysis/reconcile_results.json` reproduced exactly on the 958,615-row
`WELD_DUMP` load.

Getting there surfaced one loader deviation, now fixed by DB-LANE in
`db/migrations/0007_literal_null_tokens.sql`: `weld_text()` used to null `'NA'`,
`'N/A'`, `'#N/A'` and `'?'` in **every** text column, while the Power Query
`Weld Dump` script replaces `"NA" → ""` in exactly six DATE columns
(`Preheat Date, Weld Date, Cutting Date, Beveling Date, Fitup Date, MIR Date`)
and nowhere else. The measured effect, before the fix:

| column | raw rows | joints | metrics moved |
|---|---:|---|---|
| `rt_report` = `NA`/`N/A` | 4 | GAC 2, TEKFEN 2 | M10 −2, M13 −2, M42 +2, M14/M15, one WPS row |
| `pwht_report` = `NA`/`N/A` | 75 | GAC 33, TEKFEN 20, MEDGULF 12 | M65 −33/−20/−12, M45 −3 |
| `mt_report` / `pt_report` = `NA`/`N/A` | 393 / 264 | — | M70/M71 (not pinned) |

The diagnosis was proved before the fix by running the M-query predicates
straight on `stg_weld_dump`: GAC `tested=38761 pwht_done=43320`,
TEKFEN `23130 / 79303`, MEDGULF `6090 / 6724` — the reference values to the
digit, with the same SQL semantics this layer uses.

---

## Where the numbers come from: `mv_joint`

Every measure reads the joint-grain materialised view
`db/migrations/0013_mv_joint.sql`, authored by this lane.

`weld` is weld-pass grain — 6.5 M rows over 2,370,428 joints, CCC alone
contributing 5,432,993 rows over 1,339,099 joints (~4.06 rows per joint,
ruling R2-01). Every headline measure is `DISTINCTCOUNT(Joint ID)`, so each
pivot sorted millions of joint ids once per aggregate per group. Measured
through the API at 6.5 M rows: page 1 = 20.8 s, page 2 = 30.8 s, page 3 = 22.0 s.
§6.5 predicted exactly this.

**The translation.** DAX evaluates each filter at ROW level and then counts
distinct joints, so a joint is counted iff ANY of its rows satisfies the
filter — which is `bool_or(<row predicate>)`. Every flag in the view is that,
one per predicate function in this package, and every
`count(DISTINCT joint_id) FILTER (WHERE p)` becomes `count(*) FILTER (WHERE flag)`.
Additive values (films, lengths, dia inch) stay sums.

The row-level predicate functions (`rtBacklogCond`, `pwhtBacklogCond`,
`testedCond`, …) are **still the canonical definition** — they are what the view
materialises, and they are the fallback if a flag ever has to be re-derived.

**Three grains, deliberately:**

| view | grain | who reads it |
|---|---|---|
| `mv_joint` | `(source, joint_id)` — 2,370,428 rows | every measure and pivot |
| `mv_joint_wps` | `(source, joint_id, wps_no)` — 2,194,756 rows | the per-WPS pivots only |
| `weld` | weld pass — 6.5 M rows | nothing in `lib/metrics` any more |

`wps_no` is the single dimension that is genuinely multi-valued per joint (1
joint of 2,370,428, measured). At row grain that joint counts in BOTH WPS
cells, which is what the DAX does and what `wps_gac_nonsg` pins; at joint grain
`GAC-WPS-P-CS/LTC-002` came out at 223,301 instead of 223,302. Hence the second
view. The other twelve dimensions are single-valued for all but ≤11 joints
(`rt_pct` and `service_class_cat_ndt` 11 each; `weld_type`, `dia_inch_factor` 1
each; the rest 0) and the per-RT%/per-weld-type pins police them.

**Per-family aging clocks.** `mv_joint.weld_date` is the max over ALL of a
joint's rows and must NOT drive the buckets: `reconcile_check.py` ages a
backlog joint from the latest weld date among its BACKLOG rows, and a joint can
carry a later non-backlog row. So the view carries
`rt_backlog_weld_date`, `rt_backlog_prall_weld_date`,
`pwht_backlog_weld_date`, `pwht_backlog_prall_weld_date`, and
`weld_date_norepair` for M05's week filter (M01 excludes repairs).
`BacklogFamily` in `rt.ts` pairs each flag with its clock.

**The proof.** All 358 assertions of `tests/metrics.test.ts` against
`analysis/reconcile_results.json` pass bit-for-bit after the switch. Do not
change a flag without re-running that suite.

**REFRESH.** `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_joint;` **and**
`mv_joint_wps` after every `weld` load and after any `spool` reload (the
FABRICATED flags embed the spool join). Both have the UNIQUE index
CONCURRENTLY requires. Measured: 41 s and 6.7 s.

---

## Batch-3 sources: what changed, and what deliberately did not

`mv_joint` needed **no change** for ACCIONA and INCO. Every flag in
`db/migrations/0013_mv_joint.sql` was re-read against
`analysis/sources3/{acciona,inco}-column-map.md`; the only source-conditional
expression is the WP1 gate. It was **not** already correct — see the first row:

| concern | verdict |
|---|---|
| `wp1Cond` = `weldpoint_no = 1` (was a per-source CASE) | **This row previously said the CASE was "correct for both" — it was not, and the reasoning is worth keeping as a warning.** The argument ran: Acciona is one row per joint so either column works, but Inco is joint × RT-fragment with `weldpoint_no = 1` on *every* one of its 10,327 rows, so `weldpoint_no` over-counts and `weldpoint_seq` (7,238 rows) dedups it. The data shape is real. The conclusion was still wrong, because **the pbix does not dedup Inco either** — it filters `[WeldPoint No.]`, full stop, and its card reads 768,101, which only `weldpoint_no = 1` reproduces (the CASE gave 766,287, short by exactly Inco's 1,813). The lesson: a de-duplication that looks arithmetically necessary is still a *guess* unless the DAX asks for it, and R2-01 licenses de-duplication only for joint-level `LOOKUPVALUE`s, which this is not. Migration 0017. `weldpoint_seq` remains a loader dependency for M33, still pinned by a test |
| RT backlog hold list (16 codes) | Acciona synthesises its own `RT Weld Status`; its `HS` (RT % = 100, no report yet) is in the list and *should* enter the backlog. Its `S` needs `rt_pct = 100`, and Acciona's `rt_pct` is blank on 87.8 % of rows, so that branch correctly does not fire |
| PWHT flags | neither source has PWHT (Inco's columns are 100 % empty, Acciona's are added blank), so the flags do not fire and the PWHT pages stay GAC/TEK/MED/CCC-only |
| `is_fabricated` | neither party's spools are in either master, so it is `false` — correct, not a gap |
| Inco PAUT rows | 441 rows carry the same report as both RT and UT (the M copies RT→UT without clearing RT). Both flags fire, which is what the pbix does. INCO is out of project scope anyway |

So **no migration 0015 is needed**; 0013 is untouched.

### `Weld Cat IN {F, S}` on the welding-status pivots

The "Cumulative Welding Status" and "Welding Status for this Week" pivots carry
a `Weld Cat IN {F, S}` **visual** filter in the pbix — page 22 pivots
`7feb0e7f3d3a4a556bd0` / `3d74883e1b2d5d486000` and page 23 pivots
`eb6ba97e72540102c21e` / `da743b15d5328d39855b`
(`analysis/pbix/report-inventory.md`). It became load-bearing the moment CCC
landed: Talisman's `Work Category` has a third value, **`J`** (92,240
welder-record + 22,442 joint-record rows, `analysis/sources2/profile.md:86,285`),
which no other source uses. The mockup does **not** predate the data — the
visual filters it out.

What `J` means is not documented in anything we hold; the profiles give the
vocabulary and the counts, nothing more. So it is filtered exactly where the
pbix filters it and reported everywhere the pbix reports it — the page-2
"Project RT/UT Tested" pivot restricts `Weld Type`, not `Weld Cat`, and is left
alone (no `J` row appears there anyway: no `J` joint passes
`Weld Type IN {BW,GW,MW,CLET}`).

### The three `"PR all"` UT length measures (migrations 0018 / 0019)

The pbix keeps **three** distinct length measures and they are not
interchangeable. Each is implemented exactly as its own DAX reads.

| measure | gate | filter | our flag | value |
|---|---|---|---|---|
| `[UT Weld Length by Joint "PR all"]` (M33) | `[WeldPoint No.1 WP1] = 1` (`weldpoint_seq`) | term 1 `[UT Report] <> ""`, term 2 `[RT/UT] = "UT"`, **ADDED** | `ut_weld_length_prall` | **27,856.9756** |
| `[UT Inspected Length by Joint "PR all"]` | `[WeldPoint No.] = 1` (`weldpoint_no`) | `[Manual UT Report No.] <> ""` | `ut_inspected_length_prall` | 28,855.3747 |
| `[UT Defect Length by Joint "PR all"]` (M34) | none | `[Manual UT Report No.] <> ""` and `[Manual UT Status.] = "R"` | `ut_defect_length_prall` | **18.73657** |

Two different WeldPoint columns, one per measure — the pbix's own doing, not a
transcription slip. A test pins them apart so a future tidy-up cannot collapse
them.

**M33's two terms are ADDED, not OR-ed.** A row carrying both a `[UT Report]`
and `[RT/UT] = "UT"` is counted twice. Reproduced literally. Term 1 reads the
**raw** `[UT Report]`, not the `"PR All"` one, so CCC — whose `ut_report` is
empty — contributes only through term 2.

| | term 1 | term 2 | total |
|---|---|---|---|
| GAC | 4,840.1732 | — | 4,840.1732 |
| TEKFEN | 4,062.3483 | — | 4,062.3483 |
| INCO | 490.5040 | — | 490.5040 |
| CCC | — | 18,463.9501 | 18,463.9501 |
| **total** | | | **27,856.9756** → owner's card 27,856.97 ✅ |

Excluding Inco — what a page carrying the pbix's Inco filter shows — the same
measure is 27,366.4716. Both are pinned, and the difference is exactly Inco's
490.504 m.

### R3-06 fully retired: Inco's weld length is `Length (MM)` / 1000

R3-06 said `[Weld Length "PR all"]` is blank for every Inco row, because its
guard `[Manual UT Report No.] <> ""` never fires — Inco leaving that `Weld Dump`
column empty. **Both the reason and the outcome are wrong.**

* the reason: `[Manual UT Report No.]` is the *calculated* column (C-20), whose
  Inco branch resolves to Inco's **own** `UT Report`, non-blank on 441 PAUT rows;
* the outcome: with Inco the owner's card reads 27,856.97, which is exactly our
  literal implementation including the Inco term.

So Inco's weld length is `weld_length / 1000` on the rows where it has a UT
report, and the honest-empty note the ruling justified is gone.

**How this was nearly got wrong, twice.** An intermediate reading of the owner's
card (27,366.47) was taken with a page filter excluding Inco, and matched our
total *minus* the Inco term to the cent. Migration 0019 dropped the branch on
that evidence. The defect-length measure then showed the identical pattern
(16.240 vs our 18.7366), which read as independent confirmation — "two separate
measures agreeing to the cent". It was not: **both measures are guarded by the
same predicate**, so one page filter moved them together. Two observations that
share a cause are one observation. 0021 restores both branches.

A caveat for the loader: `scripts/load-weld-length.ts` materialises
`weld_length_m` with the **imported** `manual_ut_report_no` in that guard, so it
is NULL on every Inco row. The Inco branch is therefore corrected inline in the
matview rather than trusting the column. Worth a DB-LANE fix.

### M34's CCC term is row-level, and R2-01 does not apply

```dax
IF( Sub = "Inco" && [Manual UT Report No.] <> "", [Repair Length (mm)]/1000,
IF( [Manual UT Report No.] <> "" && [By UT] = "Y", [Rej Length],
IF( [Manual UT Status.] = "R" && Sub = "CCC", LOOKUPVALUE(tracker BY Joint ID), 0)))
```

| branch | rows | value |
|---|---|---|
| GAC `[Rej Length]` | 169 | 7.7320 |
| TEKFEN `[Rej Length]` | 233 | 8.0656 |
| CCC tracker lookup, **row-level** | 204 | 0.4420 |
| INCO `[Repair Length (mm)]/1000` | 74 | 2.497002 |
| **total** | | **18.73657** → owner's card 18.736 ✅ |

Excluding Inco the same measure is 16.2396; both are pinned.
`repair_length_mm` arrived with migration 0020.

The CCC term is **not** de-duplicated to one row per joint. The measure is a
`SUM` over `"PR all"` **rows** of a `LOOKUPVALUE`, so a joint with several UT
rows contributes once per row. The R2-01 dedup gives 0.0890 and misses by 0.353.

This narrows R2-01: de-duplicating a joint-level lookup is licensed only where
the DAX is **not** already summing per row. Where it is, the row-level sum *is*
the measure. Same lesson as the WP1 gate in 0017 — an adjustment that looks
arithmetically necessary is a guess unless the DAX asks for it.

### Reading the owner's figures: they are truncated, not rounded

| measure | ours, exact | owner quoted | at display precision |
|---|---|---|---|
| `[UT Weld Length by Joint "PR all"]` | 27,856.9756 | 27,856.97 | 27,856.**98** |
| `[UT Defect Length by Joint "PR all"]` | 18.73657 | 18.736 | 18.**737** |

Both quoted figures are ours **truncated**, not rounded. The pattern is
consistent across two independent measures, so it is how the figures were read,
not a mismatch to chase. Pinned at full precision; the cards round the way every
other card on the page rounds, which puts them one unit in the last place above
the quoted values. Flagged rather than special-cased — a bespoke truncation rule
for two cards would be a guess about the pbix's formatting.

### `weldpoint_seq` for `WELD_DUMP`

It was NULL on all 958,615 dump rows for part of this work and was backfilled
mid-task, which would have silently zeroed M33's term 1 for GAC and TEKFEN.
Cross-check kept as a guard: `ROW_NUMBER() OVER (PARTITION BY joint_id ORDER BY
id)` computed inline gives the identical M33 total, so the stored column is
trustworthy.

### The sub-contractor NDE table binds `"PR all"`, not `"EP"`

Each sub-contractor page in the pbix carries **two** similarly-named tables:

| pbix visual | family |
|---|---|
| `"Cumulative RT Joints Tested and Accepted"` | `"EP"` |
| `"Cumulative RT/UT Joints Tested and Accepted"` | **`"PR all"`** |

Our mockup reproduces the **second** — its 14 columns map one-for-one onto that
visual's 14 Values (`Tested Joints` … `% of Rej UT by Length`). We were
rendering it from the page's own `"EP"` bundle, i.e. from the *other* table's
measures. Every instance of the PR-all visual in `report-inventory.md` — GAC,
TEKFEN and MEDGULF alike — binds `"PR all"`; **not one binds `"EP"`**.

The visual also carries `Weld Type IN {BW, CLET, GW, MW}` (= `RT_WELD_TYPES`).
Both changes are load-bearing — the report owner's matrix-by-Sub-Contractor
screenshot for TEKFEN:

| binding | Films Taken | Films Acc | Films Rej |
|---|---|---|---|
| `"EP"`, as we rendered it | 82,339 | 81,566 | 773 |
| `"PR all"`, no type filter | 82,312 | 81,505 | 807 |
| **`"PR all"` + type filter** | **82,287** | **81,480** | **807** ✅ |

Switching family alone still misses by 25 films.

`Films Rej` moves 773 → 807 because the `"EP"` twin
`[RT Total Films by Joint "R" "EP"]` is WP1-gated and the `"PR all"` one is not
— the same asymmetry migration 0017 settled.

#### The TMCP filter is dropped here, by owner ruling

The pbix page-25/30 visual carries `TMCP Pipe IN {null}`; the owner's
matrix-by-Sub-Contractor does not. **Owner ruling: the page must show the
matrix figures, with no discrepancy** — so this one table drops the TMCP filter
and reads 82,287 / 81,480 / 807, while the rest of those pages' `"EP"` tables
keep `tmcpPipe: false` as before. Applied uniformly across the sub-contractor
pages; only TEKFEN sets `tmcpPipe` at all, so it is a no-op elsewhere.

This is a deliberate divergence from the visual's own filter list, recorded
here rather than left to be rediscovered.

#### The cards had to move with it

The pbix carries each film card **twice**, once per family — page 30 has

| card | measure |
|---|---|
| `97e6ec71…` | `RT Total Films by Joint "A" "EP"` |
| `fd667f0e…` | `RT Total Films by Joint "PR all" "A"` |
| `bf8a82da…` | `RT Total Films by Joint "R" "EP"` |
| `01a3a7e9…` | `RT Total Films by Joint "PR all" "R"` |

We rendered the `"EP"` pair (81,187 / 773) directly above a table showing
`"PR all"` (81,480 / 807), so **the page contradicted itself**. Both now read
the *same bundle*, which is the real fix: card and table Total cannot drift
apart, whatever the scope later becomes. A test pins the equality, not just the
numbers.

#### `Joints Welded` is deliberately unchanged

The pbix has both twins for it too — `Welded Joint ID Uniq "EP"` (`623e5084…`)
and `Joint Uniq "PR all" Welded` (`7d2289cf…`) — so the binding is genuinely
ambiguous. It does not matter, because the PR-all card **carries the TMCP
filter**, and under it the two families agree exactly:

| binding | TEKFEN |
|---|---|
| `"EP"`, what we render | **369,931** |
| `"PR all"` + `TMCP Pipe IN {null}` | **369,931** |
| `"PR all"`, no TMCP filter | 370,089 |

So our card already matches the pbix's PR-all card. 370,089 is neither card.
It also must **not** inherit the NDE table's `Weld Type` filter, which would
cut it to 115,558 — the card is a different visual with different filters.

#### Before → after, every affected page

| page | before (`"EP"`) | after (`"PR all"` + type) |
|---|---|---|
| 3, 7 CCC | 512,328 / 511,722 / 606 | 512,322 / 511,716 / 606 |
| 10, 11 cards | 81,187 / 773 · 18,739 / 41 | 81,480 / 807 · 18,733 / 44 |
| 4, 8 GAC non-SG | 132,354 / 131,820 / 534 | 132,328 / 131,732 / 596 |
| 4, 9 GAC SG | 10,598 / 10,596 / 2 | 10,598 / 10,596 / 2 |
| 5, 10 TEKFEN | 81,960 / 81,187 / 773 | **82,287 / 81,480 / 807** ✅ |
| 6, 11 MEDGULF | 18,780 / 18,739 / 41 | 18,777 / 18,733 / 44 |

CCC barely moves because its page was already on `"PR all"`; only the weld-type
filter applies there.

**Not applied, and flagged:** the same visual also carries
`Weld Cat NOT IN {blank, J}`. It is a no-op for TEKFEN (only `F` and `S` exist),
so it is not implemented — adding an unverified filter to reach a number nobody
has quoted would be tuning. Worth checking with the owner for GAC and MEDGULF.

Page 2 is untouched: it is a different visual, and its cards are verified
against the owner's page-1/2 figures directly.

### The backlog hold list: 17 codes at `"PR all"`, 16 at `"EP"`

`[RT BACKLOG Total Project "PR all"]` lists **18** entries — but `"T1S"` appears
twice, so 17 distinct is the whole list, and `RT_BACKLOG_STATUS_PRALL` already
matched it exactly. `[PWHT All BACKLOG All WELD TYPE "PR all"]` lists the same
17 (with the same duplicate).

**The `"EP"` list's 16 codes are not a bug.** It omits `'T1-2'`, and so do
**all 20** `"EP"` backlog measures in `measures.md`. The families genuinely
differ; a test pins the difference in both directions so neither list can be
"harmonised" into the other.

`'T1-2'` matches **no row** in the current load — 0 in `rt_weld_status`, 0 in
`pwht_weld_status` — so it changes no number today. Carried because the DAX
carries it, and pinned so that if it ever appears, the divergence is visible.

#### The PWHT second term has no weld-date filter

The DAX adds two `DISTINCTCOUNT`s and only the first is date-filtered:

```dax
CALCULATE(DISTINCTCOUNT([Joint ID]), [Weld Date]>0,
          [PWHT Y/N CCC]="Y", [PWHT Report No CCC]="")
+ CALCULATE(DISTINCTCOUNT([Joint ID]),
          [PWHT Weld Status] IN {…17…}, [PWHT Report]="")
```

Ours matches — `mv_joint.pwht_backlog_rest` is

```sql
bool_or(w.pwht_weld_status IN ('H','HS','HS CCC','SS','T','T1','T1S','T1-1',
                               'T1-1S','T1-2S','T2','T3','T2-1','T2-1S',
                               'T2-2S','T2S','T1-2')
        AND w.pwht_report IS NULL)   AS pwht_backlog_rest
```

with no `weld_date` condition, while `pwht_backlog_ccc` carries
`w.weld_date IS NOT NULL`. The branches are disjoint by construction (dump rows
have no `pwht_y_n_ccc`, CCC rows no `pwht_weld_status`), so the DAX's `+` and a
single `OR` agree; the `+` is kept for literal parity.

#### Computed against the owner's DAX — **not** owner-read

| measure | total | split |
|---|---|---|
| `[RT BACKLOG Total Project "PR all"]` | **672** | CCC 357 · GAC 292 · MEDGULF 23 · TEKFEN 0 · ACCIONA 0 · INCO 0 |
| `[PWHT All BACKLOG All WELD TYPE "PR all"]` | **1,042** | CCC branch 546 + rest 496 (GAC 427 · MEDGULF 43 · TEKFEN 26) |

These are **our** numbers from the owner's DAX text, not figures read off the
pbix. They are pinned as such and should be flipped to owner-read values when
those arrive. They already equal what page 2's sub-contractor table renders,
so M40/M60 needed no change.

### The backlog charts ARE the trend workbook

The pbix chart is not a computed visual — it reads `weld_weekly_snapshot`,
summed over **every sub-contractor and every scope** (SG/TMCP included), with
only the `PROJECT` sentinel dropped. That aggregation reproduces the owner's
31-Jul…28-Aug chart week for week:

| series | metric | 31-Jul | 07-Aug | 14-Aug | 21-Aug | 28-Aug |
|---|---|---|---|---|---|---|
| `RT/UT+PWHT` | M47 | 135 | 101 | 94 | 94 | **76** |
| `RT/UT Only` | M48 | 556 | 550 | 525 | 530 | **596** |
| stack total | | 691 | 651 | 619 | 624 | **672** |
| `PWHT+RT/UT` | **M64** | 3 | 3 | 3 | 3 | **3** |
| `PWHT Only` | M60 | 1,434 | 1,394 | 1,206 | 814 | **1,039** |
| stack total | | 1,437 | 1,397 | 1,209 | 817 | **1,042** |

The PWHT `+` series is **M64** (`PWHT BACKLOG RT NOT Done`), not M62
(`PWHT Backlog For RT`). M62 is 354 where the chart shows 3 — a mis-binding that
only a real chart could have caught.

Earlier in this work the charts were rebuilt as a computed series with an
"intersection" split. That was wrong and is reverted: the invariant it enforced
(each stack totalling its page-2 measure) happens to hold here, but it held for
the wrong reason. `backlogTrend()` survives in `trend.ts` as an internal
cross-check and for R-08's future ETL appends; nothing renders it.

#### The current week is computed, so the charts cannot drift

History is the workbook, but **both** charts' latest week is recomputed from
`mv_joint` (`rtBacklogCurrent` / `pwhtBacklogCurrent`). They agree today; if
they ever stop, the computed value is the truthful one and a test fails. The
agreement test compares the *measure* to the *workbook*, not the chart to the
measure — the chart carries the computed value, so that would be circular.

Owner-supplied measures back the RT chart, each a SUM of `DISTINCTCOUNT` branches that are **not**
de-duplicated against one another:

| series | measure | value |
|---|---|---|
| `RT/UT+PWHT` | `RT BACKLOG Total Project & PWHT "Y" NOT Done "PR all"` | **76** |
| `RT/UT Only` | `RT Backlog+PWHT "N"` (507) + `RT Backlog+PWHT Progress "Y"` (89) | **596** |
| total | `RT BACKLOG Total Project "PR all"` | **672** |

Per party: `RT Backlog+PWHT "N"` = GAC 170 + MEDGULF 23 + CCC 314;
`Progress "Y"` = GAC 64 + CCC 25. `RT/UT+PWHT` = GAC 58 + CCC 18.

The PWHT chart is now symmetric — the owner supplied its formula too:

| series | measure | value |
|---|---|---|
| `PWHT+RT/UT` | `PWHT Backlog Weld Status All Weld Types RT NOT Done "PR all"` | **3** |
| `PWHT Only` | `PWHT All BACKLOG All WELD TYPE "PR all"` − the above | **1,039** |
| total | | **1,042** |

M64 is **four** added `DISTINCTCOUNT`s — a CCC branch and a status branch, each
once for `[Service Cat] = "SG"` and once for `[TMCP Pipe] = "TMCP Pipe"`. It
carries **no weld-type filter**, and `PWHT Weld Status` uses the same 17-code
hold list as `RT Weld Status`. Today all 3 are GAC's, through the SG *status*
branch: `0 + 3 + 0 + 0`.

The scope columns are the schema's own: `service_cat = 'SG'` — an **equality**,
never a `LIKE`, because `'SGCS'` and `'HRSG'` also exist — and the boolean
`tmcp_pipe`, loaded from `Weld Dump[TMCP Pipe]` where the DAX's `"TMCP Pipe"`
literal is true.

Pages 7–11 get the same treatment per party. GAC's is the only per-party PWHT
chart with a `+` series today, precisely because M64 is entirely GAC's:
427 − 3 = 424.

#### Two missing terms, found by reading the DAX (migration 0024)

**M47** `[RT BACKLOG Total Project & PWHT "Y" NOT Done "PR all"]` is **three**
added `CALCULATE`s and we had implemented two. The missing one is the CCC
branch:

```dax
CALCULATE(DISTINCTCOUNT([Joint ID]),
    [Weld Type] IN {"BW","GW","CLET","MW"},
    [RT Weld Status] IN {…17-code hold list…},
    [PWHT Y/N CCC] = "Y",
    [PWHT Report No CCC] = "",
    [RT Report] = "")
```

No weld-date filter, no RT%=100 branch. 58 + **18** = 76.

**M64** `[PWHT Backlog Weld Status All Weld Types RT NOT Done "PR all"]` is
**four** added `CALCULATE`s — a CCC branch and a status branch, each once for
`[Service Cat] = "SG"` and once for `[TMCP Pipe] = "TMCP Pipe"`. We had the
shape but not the scope restriction, which is the whole measure: unscoped it
counts a different population and read **0** against the pbix's **3**.

Both use `+`, not `OR`, so each term is its own flag and the metric adds the
counts — a joint matching two terms is counted twice, deliberately.

`[RT BACKLOG Total Project & PWHT"Y" NOT Done FABRICATED "PR all"]` is the same
three branches plus `[Spool ID Status] = "Fabricated"` and `{H,HS}` without
`NR`. The spool masters **are** loaded, so it is computable rather than
honest-empty: **68** (GAC 56 + CCC 12).

#### The rejection-rate charts still read the workbook

`% RT Rejection Rate by Film` and `% UT/PAUT Rejection Rate by Length` on page 1
(and their per-party twins) read M25/M25P and M36/M36P from the workbook. They
are **not** computed. `Welding Progress Trend` already comes from
`mv_weekly_progress`.

### Page 2 reconciled against the owner's pbix, cell for cell

Every cell of the sub-contractor table now matches the owner's screenshot except
two, both documented below and neither tuned. Three bindings were wrong:

| column | was | is | why |
|---|---|---|---|
| `PWHT B.Log RT NOT Done` | 58 | **3** | read the `"EP"`-shaped flag; at `"PR all"` it is the SG/TMCP measure (M64) |
| `RT B.LOG & PWHT NOT Done` | 58 | **76** | M47's CCC branch was in its own flag and never added |
| `% Rej by Joint` | 0.91% | **0.27%** | despite the name it is the FILM ratio `RT FILM Ratio % by Joint "PR all"`, not the joint rejection rate |

That last one is worth remembering: the column is called "% Rej **by Joint**" and
the measure behind it counts **films**. The joint rejection rate gives
0.83 / 0.39 / 1.67 / 0.53 / 2.78 / 0.91 — plausible-looking numbers that are
simply the wrong measure. Only the owner's cells could tell them apart.

`[RT Backlog+PWHT Progress "Y" Done + PWHT "N" FABRICATED "PR all"]` = **521**
(GAC 211, MEDGULF 16, CCC 294) and it partitions the FABRICATED backlog exactly:
**521 + 68 = 589 = `RT BACKLOG Total Project FABRICATED`**. That arithmetic is
also what confirms the 68 of the `"Y" NOT Done` FABRICATED variant — a figure
the owner never quoted, so it is pinned as a derived consequence rather than as
an owner-read value. The three FAB-D columns have no place in the mockup's
page-2 table (its 12 columns do not include them), so nothing renders them yet.

#### Two cells that do not match, and are not tuned

**ACCIONA `RT100% Backlog` = 2** in the pbix; we render blank, and the total is
635 against the owner's 637 — the difference is exactly ACCIONA. Its 945 rows
with `RT% = 100` **all** carry an RT report, so M43's "RT Date is blank" clause
can never fire, and its `RT Weld Status` only ever holds `NULL` or `'S'`. No
reading of the measure over our data produces 2. Left blank.

**TEKFEN `% Rej UT Joint` = 7.74%** (197 / 2,545); we show 7.78% (198 / 2,545).
The denominator matches, so it is one joint:
`21010AA-NG7131299R01-SP1-002`. It carries **no `ut_report` and no
`ut_acc_rej`** — only `manual_ut_report_no` and `manual_ut_status = 'R'` — so it
qualifies solely through the C-20 fallback that the other 197 never need.

Two mechanisms would exclude it, and **both give exactly 197**: requiring
`ut_acc_rej` / `ut_report` directly (no fallback), or requiring
`ut_weld_status = 'NR'`. Neither appears in the verbatim DAX of
`[Numb UT "R" "PR All"]`, which is simply
`DISTINCTCOUNT([Joint ID])` filtered on `[Manual UT Report No.] <> ""` and
`[Manual UT Status.] = "R"`. A third hypothesis — that
`[Manual UT Status.]`'s `LOOKUPVALUE` needs a non-blank `Welder ID` — was tested
and **disproved**: `welder_id` is NULL on every GAC and TEKFEN UT row, so that
rule would zero both parties.

Two numerically-correct hypotheses and no DAX to choose between them is exactly
the situation where tuning would be wrong. The measure is left alone and the
one-joint difference is pinned so it cannot drift while the owner rules.

#### The two film-rejection percentages are both right

| where | value | scope |
|---|---|---|
| page 1 card `%RT FILM Rej` | **0.28%** = 2,152 / 768,101 | measure scope, **Inco included** |
| page 2 table total `% Rej by Joint` | **0.27%** = 2,074 / 761,198.61 | project scope, Inco excluded |

Same measure, different scope — the page-1 cards are measure scope by R3-01 and
page 2 is project scope. The card now carries `sub: "all parties incl. Inco"` so
a reader comparing the two pages is told why they differ instead of guessing.

### Page 1's filter bar (Sub-Contractor / Weld Type / Weld Cat)

`getWeldingPage(n, { as_of?, filters? })` with
`WeldingFilters = { ha?, area?, subco?, wtype?, wcat? }`, re-exported from
`lib/pages/welding.ts`. The bar renders in that order, HA first. Values are raw column values; `undefined` and `"All"`
both mean no filter, so a UI can round-trip its own sentinel.

Page 1 returns `filters: { ha, area, subco, wtype, wcat }` (applied values,
`"All"` when none) and five `FilterWidget`s **first** in `widgets`, ids `ha` /
`area` / `subco` / `wtype` / `wcat`. Options are `"All"` plus distinct values from `mv_joint` ordered by
joint count descending, blanks excluded, **memoised per process**
(`resetFilterOptionsCache()` exists for tests).

Semantics are a **pbix slicer on the fact table**: one extra `WHERE` AND-ed onto
every widget's own scope (`withFilters`). Every page is unaffected but page 1 —
`n === 1` is the only place the filters are read, so no other page's output can
move no matter what a caller passes. **With no filters set the page is
byte-identical to before**, which a test asserts by comparing the two renders
after stripping the bar; every existing pin depends on that.

`as_of` handling is unchanged.

#### Per-card rules survive the slicer

`MT/PT Done` is measured with Inco excluded (R3-01). Filtering **to** Inco
therefore leaves it measuring nothing, and it renders `—`, **not `0`** — a zero
there would read as "Inco did no MT/PT". The same applies to the two project
charts (Welding Progress Trend, Weld Type Distribution), whose pbix visuals all
carry `SC <> Inco`; one note explains all three. Every other card includes Inco
and does follow the filter (`Joints Welded` → 7,238).

#### The workbook charts cannot follow a weld-type or weld-cat filter

`weld_weekly_snapshot` is keyed **per party only**. So:

* **`subco`** — the backlog and rejection-rate charts show that party's workbook
  series, exactly as pages 7–11 do (ACCIONA and INCO have rows). A party with no
  rows renders honest-empty.
* **`wtype` or `wcat`** — no history exists that honours the filter. Rather than
  draw a line that silently ignores what the reader just set, the backlog charts
  collapse to a **single point, the current week computed from `mv_joint` under
  the filters**, and one note says why. The rejection-rate charts, which have no
  computed equivalent, render empty under the same note.

`mv_weekly_progress` *does* carry `sub_contractor`, `weld_type` and `weld_cat`,
so the Welding Progress Trend follows all three filters exactly.

An unknown filter value is treated as `"All"` — dropped from the query *and*
reported as `"All"` in the widget, so the page can never display a filter it did
not honour — and a note says one was ignored.

#### `HA` is derived, and `Area` uses the label column

**`HA`** is not imported — `weld.ha` is NULL on all 6,546,242 rows, so
`max(w.ha)` gave a column that was NULL for every one of the 2,390,978 joints.
The pbix derives it, and migration 0026 derives it the same way:

1. second character of `Subsystem Code`, when that code is valid and the
   character is `1`–`4` → `HA<d>`;
2. else the same test on `System No` → `HA<d>`;
3. else `LOOKUPVALUE('HA l0_abs_guide'[Handover Area])` by `PDS Area`.

"Valid" means not blank, not `System-NA - Not Applicable`, and not containing
`NON` — all three verbatim. **Branch 3 is not implemented**: that workbook is
not in `sources/` (the same gap M52's coverage note records), so those joints
stay NULL rather than receive a guessed area.

**Branch 3 is the real lookup** (migration 0032). `sources/l0_abs_guide.csv`
arrived — 912 rows, 906 carrying HA1..HA4 (428 / 148 / 175 / 155) — so branch 3
is now implemented verbatim: `Handover Area` looked up by
`Location Number = PDS Area`, from `ref_ha_guide` (migration 0031).

*History, one line:* 0026 did branches 1–2 and left 3 NULL; 0027 stood in for 3
by mapping area labels; 0032 replaced that with the guide and **deleted** the
stand-in rather than keeping it as a fallback. `HA.csv` had already proved the
stand-in could only ever be an approximation — the (HA, Area Classification)
mapping is many-to-many, so a label alone cannot choose between HA2 and HA3.
`PDS Area` can.

Branch 3 resolves **100 % of CCC** (1,470,093) and **100 % of ACCIONA**
(13,312), and every remaining blank of the dump parties. Distribution:

| party | HA1 | HA2 | HA3 | HA4 | blank | total |
|---|---|---|---|---|---|---|
| CCC | 370,681 | 368,309 | 367,298 | 363,805 | 0 | 1,470,093 |
| GAC | 249,290 | 31,786 | 134,870 | 27,422 | 0 | 443,368 |
| TEKFEN | 306,434 | 85 | 67,186 | 81 | 0 | 373,786 |
| MEDGULF | 43,592 | 362 | 16,583 | 22,644 | 0 | 83,181 |
| ACCIONA | 13,312 | — | — | — | 0 | 13,312 |
| INCO | — | — | — | — | **7,238** | 7,238 |
| **all** | 983,309 | 400,542 | 585,937 | 413,952 | **7,238** | 2,390,978 |

**The blank group is now exactly INCO.** It has no `pds_area` in our load, and
the pbix's own derivation for it — `Text.BeforeDelimiter(Iso Number, "-")` —
yields a 2-digit code (`65`, `60`, … 6 distinct values) that cannot match the
guide's 7-character Location Numbers. Deriving the column would resolve nothing,
so it is not added; the blank is real and reported rather than papered over.

**Six of `HA.csv`'s 41 pairs produce no joints**, all of them the second HA of a
many-to-many area: HA3 × {Intercon PR HA-2, Intercon PR HA-4, Train-9 Process}
and HA4 × {Intercon PR HA-3, Train-10 Process, Utilities HA-3}. Each stays
selectable and renders 0.

#### The slicer is a hierarchy, and `(Blank)` is a value

`area` declares `parent: "ha"` and carries `options_by_parent` — per HA value,
the area labels that occur under it, ordered by joint count (key `""` is the
blank-HA group). `options` stays the flat list for any UI that ignores the
hierarchy. HA2's list is the owner's screenshot exactly:
`Train-9 Process, 3000000, 7000000, Intercon PR HA-2, 5000000`.

`ha` also offers **`(Blank)`**, the pbix slicer's own label for the blank group,
which means `ha IS NULL` — a literal comparison would match nothing. With it
counted as a value, HA partitions exactly: `Σ HA1..HA4 + (Blank) == unfiltered`
(37,069 welded joints in the blank group).

**`Area Classification`** slices `area_classification_label`, not the integer
`area_classification`. The raw column is NULL on 5,587,627 of 6,546,242 rows and
offers six numeric codes, so a slicer on it would filter almost nothing; the
label column is populated everywhere and falls back to the raw code where no
label exists, making it a strict superset. `Scope` already mandated the label
column for the same reason (it is NULL for every CCC row).

#### Page 1's trend window is 10 weeks

Owner ruling: the Welding Progress Trend shows the **last 10 weeks**. The mockup
snapshot declares 14 labels and pages 7–11 keep their own 8-week window, so the
difference is pinned rather than left to drift.

### CCC's unwelded joints carry RT%, and the forecast needs it

`AllTrain_CSVExport_Joint Record.csv` is, by design, the **not-yet-welded** CCC
joints — `weld_date` NULL is correct, and that population *is* what the RT
backlog forecast is computed over. The loader mapped 51 columns but not
`RT/UT(%)`, so every CCC joint had a NULL `rt_pct` and contributed **0** to a
measure the pbix reads as **11,732**.

It is a plain rename to `rt_pct`, exactly as the welder record does it
(`analysis/sources2/ccc-column-map.md:60`) — **not** a lookup into the welder
record, which holds welded passes only and therefore has no row for any of
these joints.

**Verified, not assumed, that this cannot leak.** Every RT and PWHT measure
gates on `weld_date`, a report, or a hold status. On these 130,994 rows all four
of `weld_date`, `rt_report`, `rt_weld_status` and `pwht_weld_status` are NULL,
and the joints appear in **zero** measure flags (`rt_backlog_prall`,
`rt100_backlog_prall`, `is_tested_prall`, `pwht_backlog_ccc/rest`,
`is_welded_norepair` — all 0 before and after). The full suite is unchanged.

The loader is safe to re-run standalone: it deletes only
`source = 'CCC_JOINT_RECORD'` from `weld`, rebuilds `ccc_joint_pwht` wholly from
the same file, never touches the welder record, and refreshes the matviews
itself.

Result — the forecast backlog now matches the owner's card for **every party**:

| party | ours | owner |
|---|---|---|
| CCC | 11,732.20 | **11,732** ✅ |
| GAC | 1,335.15 | **1,335** ✅ |
| MEDGULF | 526.40 | **526** ✅ |
| TEKFEN | 11.90 | **12** ✅ |
| **total** | **13,605.65** | **13,606** ✅ |

with RT 100% = 10,158 and RT 5% = 18,228 × 0.05 = 911, both exact.

### Page 20 "RT Backlog Forecast"

Owner ruling: *"вся информация в таблице Project WD+WR+INCO+Acciona"* — every
measure and slicer reads the union. The single exception is
`[RT BACKLOG RT100% Talisman]`, whose DAX names `TALISMAN DATA` itself
(`sources/Joint.csv` → `ref_talisman_joint`, migration 0029). Nothing else gets
a parallel fact; columns the page needs are materialised on `mv_joint`
(migration 0033: `by_ut_all`, `dia_inch`, `dia_band`, `rt_year`, `rt_month`,
`weld_year`, `weld_month`).

#### The forecast backlog is not the RT backlog

It counts joints that are **not yet welded**, weighted by RT coverage:

```dax
RT_100 + RT_5 * 0.05 + RT_10 * 0.1 + RT_20 * 0.2 + RT_30 * 0.3
  where RT_n = CALCULATE(DISTINCTCOUNT([Joint ID]),
                         [Weld Type] IN {"BW","GW","CLET","MW"},
                         ISBLANK([Weld Date]), [RT%] = n)
```

| party | ours | owner |
|---|---|---|
| CCC | 11,732.20 | **11,732** ✅ |
| GAC | 1,335.15 | **1,335** ✅ |
| MEDGULF | 526.40 | **526** ✅ |
| TEKFEN | 11.90 | **12** ✅ |
| **total** | **13,605.65** | **13,606** ✅ |

CCC is 86 % of it and read **0** until the joint record's `RT/UT(%)` was mapped:
that file *is* the not-yet-welded population.

#### The monthly charts: the owner's screenshot samples alternate months

Both charts group by **RT date** from January 2024, stacked F / S (J excluded).
A position-by-position comparison against the owner's list fails while the
*values* match — because the chart's axis labels alternate and the transcription
follows them. Our joint series from Jan 2024:

```
7211 5962 6584 5379 5496 4891 6246 6287 6556 6640 8188 8581 9606 …
```

and the owner's "Feb–Jul 2024" list — 6,584 · 5,496 · 6,247 · 6,556 · 8,188 ·
9,606 — is exactly our **Mar, May, Jul, Sep, Nov 2024 and Jan 2025**. Every
owner value the alternate-month reading predicts matches within **4 joints**;
the dia series matches within **0.05 %** (residuals of 1–30 on values near
70,000, consistent with reading data labels off a chart).

So the measure is right and the month labels in the screenshot cannot be taken
positionally. Pinned as *our* series plus the alignment, with nothing tuned to
the owner's labels.

#### `PWHT Y/N CCC (NEW)` — a 16-branch rule where order is the measure

`[PWHT All BACKLOG All WELD TYPE "PR all" (New PBI Rule)]` differs from the
measure page 2 renders in exactly one way: its CCC term reads
`[PWHT Y/N CCC (NEW)]` instead of `[PWHT Y/N CCC]`. That calculated column is a
nested `IF` over Joint ID, Weld Type, WPS No., Service class, Material Type and
Thickness — CCC only, blank elsewhere — and its **branch order is load-bearing**:

* branch 1 is a **13-joint whitelist** (the DAX's own *"АБСОЛЮТНЫЙ ПРИОРИТЕТ"*)
  that wins outright over every rule below it;
* branch 8, `Material SS + WPS DS-04 → Y`, is tested **before** the general
  SS/DSS group in branch 9 (the DAX's *"ПРИОРИТЕТНОЕ ИСКЛЮЧЕНИЕ"*). Swapping
  the two flips those rows;
* branch 11 lists `'6PIA'` — the DAX's typo for `'6P1A'`, letter I for digit 1.
  Reproduced, not corrected.

The new rule's CCC term is **542** where the standard one gives 546; the non-CCC
term (496) is untouched. **542 + 496 = 1,038**, the owner's card exactly.
Materialised on `mv_joint` (migration 0034) per the union-is-the-base ruling.

#### Exact against the owner

| card | value |
|---|---|
| RT Total Forecast B.log | **13,606** |
| RT Dia Total Forecast B.log | **124,613** |
| Total RT/UT Done | **204,560** |
| RT B.Log | **672** |
| RT Avrg Prod-on 2024-26 per Month | **5,324** |
| QTY Years | **0.21** |
| Months to keep RT B.log / Dia | **0.13** / **0.13** |
| PWHT B.Log PBI Rule | **1,038** |

#### The dia backlog: solved by reading the DAX, not by tuning

`[RT BACKLOG Dia Total Project "PR all"]` first read 6,958 against the owner's
6,832, because it took the joint-level `rt_backlog_prall` flag. The DAX is
**two added row-level sums**, and both differ from that flag:

```dax
CALCULATE(SUM([Dia inch]), [Weld Type] IN {BW,GW,CLET,MW}, [Weld Date] > 0,
          [RT Report] = "", [WeldPoint No.1 WP1] = 1,
          [RT Weld Status] IN {…16 codes…})
+ CALCULATE(SUM([Dia inch]), …same…, [RT%] = 100, [RT Weld Status] IN {"?", ""})
```

Two details carry the whole difference:

* the hold list is the **sixteen**-code one — **no `'T1-2'`**, unlike every
  other `"PR all"` backlog measure;
* the RT%=100 branch admits `{"?", ""}` and **not `'S'`**, unlike the joint
  backlog's own RT%=100 branch.

6,811.00 + 20.50 = **6,831.50 → 6,832**, exact. Pinned.

#### Four near-misses that remain, and what was ruled out

| card | ours | owner | Δ |
|---|---|---|---|
| RT B.Log Talisman | 357 | 358 | −1 |
| Numb RT/UT 2024 | 172,153 | 172,520 | −367 |
| Total Welded RT Dia | 1,705,849 | 1,712,883 | −7,034 |
| RT Dia Avrg Prod-on | 52,758 | 50,954 | +1,804 |

**Talisman — every reading gives 357.** Blank-or-empty `RT1 REP NO`, admitting
`RT1 DATE` as well as `WELD DATE`, matching RT% on any `weld` row rather than
the joint, restricting to repair-flagged rows: 357 each time. **19,627**
Talisman joints with a weld date and no RT1 report have **no union row at all**,
and the 358th is almost certainly among them — a joint the report has and our
union does not. Nothing to fix on our side without that joint.

**Numb RT/UT 2024 — no filter reaches 172,520.** By RT year ≥ 2024: 172,153. By
**weld** year ≥ 2024 (the card's other Calendar relationship): 167,770 — further
away, so that hypothesis is disproved. Dropping the Temporary Lines filter
changes nothing (172,153); including Inco overshoots to 174,850; `{2024,2025}`
gives 157,083 and `rt_date > 2024-01-01` gives 171,960. The gap is in the
population, not the date window. **The average built on our 172,153 is exact at
5,324**, which says the numerator is right and the card is a variant we have not
identified.

**Total Welded RT Dia — the DAX-justified variant is the one we ship.**

| WP1 column | Repair & Reweld | value |
|---|---|---|
| `weldpoint_seq` (= `[WeldPoint No.1 WP1]`) | `= ""` | **1,705,849** ← shipped |
| `weldpoint_no` | `= ""` | 1,715,293 |
| `weldpoint_seq` | no filter | 1,750,352 |
| `weldpoint_no` | no filter | 1,760,263 |

`weldpoint_no` + the repair filter lands closer to the owner (Δ +2,410 vs
−7,034) — and is **not** what the measure says. The DAX names
`[WeldPoint No.1 WP1]`, which is `weldpoint_seq`. Choosing the closer number
over the specified column is exactly the tuning this project refuses, so it is
recorded here and not shipped.

**RT Dia Avrg Prod-on — the owner's own two cards disagree.** The measure is the
dia total over days since 2024-01-01, × 30. On the owner's *own* dia total,
1,712,883 / 970 × 30 = **52,976**, not the 50,954 their average card shows.
Reaching 50,954 needs either a numerator of 1,647,180 — neither ours nor
theirs — or ~1,008 days instead of 970. Since the *joint* average is exact on
that same 970-day divisor, the divisor is right. **Both owner cards cannot be
reproduced at once**, so neither is chased; the card discloses both figures.

### M91 `WPS Approved` (R4-02, R4-03)

`count(DISTINCT wps_no) FILTER (document_status = 'WPS APPROVED BY CTJV/ CPY')`
over `ref_wps_register` (the CONSOLIDATED sheet) — **318** on the register as
delivered. Returns `{ total, as_of }`, and the card carries
`as of <date> (file date)`, the same provenance treatment M90 gets: a count off
a dated file states its date.

**The mockup's 294 is not a target.** It is the 2025-10…2026-03 plateau of the
same series; the register has moved since. We render what the register holds,
and the difference is recorded here rather than reconciled away.

**R4-03 — never join `ref_wps_register` to `weld.wps_no`.** The register holds
DOCUMENT numbers; `weld.wps_no` holds SITE numbers. Both columns are called
`wps_no`, so this is a naming trap that would join cleanly and silently produce
nonsense. `ref_wps_process` (the WELDING PROCESS sheet) is the join table if a
measure ever needs one — 100 % coverage of in-scope joints with a WPS. A test
pins it: every SQL literal in `refs.ts` naming the register is checked for
`weld`, statement by statement.

Until the register is seeded the count is `null`, the card renders `—`, and
`REGISTER_NOTE` says why. The pin is gated on the ledger, so it asserts the
em-dash before the load and 318 after, without a test edit in between.

### M90 `Project_Welder` (R3-09, R3-10)

`refs.qualifiedWelders()` returns `{ total, as_of, source_note }` and the KPI
renders `sub: "as of <date> (file date)"`. The date is the **file's mtime**, not
a reporting date — `SCTR NFE WELDERS APPLIED.xls` carries no date anywhere, and
presenting a file timestamp as a data date would misstate the currency of a
headline number. Total is 3,816 across six parties once loaded.

R3-09: the pbix's own M for that `.xls` is stale (the sheet gained a left-hand
column, so its `RenameColumns` targets a name that no longer exists and its two
`RemoveLastN` steps would cut 5 live rows). The loader is built positionally
against the delivered file, so this number comes from the file rather than from
a query that would now fail to refresh.

**M91 `WPS Approved` stays honest-empty**: `WPQ RECORD REGISTER.xlsx` is one of
the three files still missing.

---

## The flange dashboard (`flange.ts`)

A different fact from `weld` and it never touches it: one row per **register
line**, not per flange and not per weld. `flange` holds 363,245 rows over
357,787 distinct Joint IDs — `Flange Progress.xlsx` contributes 136,741 rows
for 131,283 joints (5,458 repeats, the same flange re-jointed) and
`ovAssets_1619` contributes 226,504 rows for 226,504 joints. The two Joint-ID
namespaces are **disjoint** (intersection 0), so the pbix `Table.Combine` is a
plain `UNION ALL`.

**RF-06: every measure is `count(DISTINCT joint_id)`.** A `count(*)` here
over-reports by 5,458.

| measure | DAX | note |
|---|---|---|
| Total Register | `Total Flanges ID` | `DISTINCTCOUNT([Joint ID])` |
| Inspected | `Total Flanges ID Jointed` | `[Joint Date] > 0` |
| % | `Flanges ID Jointed %` | inspected / total |
| Const-n | `… Tightening Constraction "CCC no cat"` | see RF-07 below |
| PCC | `… Tightening PCC "CCC no cat"` | see the `+` vs `OR` note below |
| Remains | `Total Flanges ID Remainder` | `ISBLANK([Joint Date])` |
| Leaked | `Flanges ID BreakDown` | `[Reason for De-Tightening] = "FLANGE LEAKAGE"` |
| Leaked % | `Flange Break Down Rate %` | leaked / inspected |
| Repaired / To be Repaired | `Repaired FLG` / `To be Repaired FLG` | **honest-empty** (RF-02) |

**RF-07 — the `"CCC no cat"` pair, not the plain trio.** `ovAssets_1619[Cat.]`
is only 75.3 % filled, so applying the `Cat.` test to CCC drives CCC's const-n
to ~0. The mockup's numbers are the pair that exempts CCC.

**One deliberate divergence from the literal DAX.** `Tightening PCC` adds two
`DISTINCTCOUNT`s; a non-CCC joint with both a PCC date and `Cat. IN {Z,A,B}`
would be counted **twice**. This layer uses `OR` — once — which is what the
recon that produced `analysis/flange/metrics.json` did and therefore what the
pins assert. `Const-n`'s two branches are disjoint by construction (a row is
CCC or it is not), so there `+` and `OR` are the same set.

**`remains` is `bool_or(joint_date IS NULL)`, not `NOT inspected`.** A flange
re-jointed once can carry a dated and an undated row and the register counts it
in both — which is why total (357,787) is *less* than inspected + remains
(358,151) by 364 joints. Faithful, and the pins depend on it.

### Honest-empty and provenance on this page

| what | why |
|---|---|
| the repair trio | all five repair logs are absent and `ovAssets_1619[Flange Repair Record]` is 0 non-blank of 226,504 — no partial substitute exists (RF-02) |
| the `(blank)` HA row | 6,593 Joint IDs, 1.84 %, that the absent `HA l0_abs_guide` would have resolved. Its own visible row, never folded into HA1 (RF-03) |
| the leak timeline | labelled "recomputed from records — the as-reported weekly file is missing". It is the cumulative rate with each leak back-dated to its own Joint Date, a genuinely different number from the weekly series published at the time (RF-04) |
| `meta.as_of` | the latest joint/inspection date **that is not in the future**. RF-05 keeps the register's dirty rows, one of which carries `2027-02-22`; a plain `max()` would label the page "data as of Feb 2027". The excluded rows are still counted in every measure, and the page says so |

### Performance (RF-09: measure, do not assume)

Same lesson as `mv_joint`: `count(DISTINCT)` under `GROUPING SETS` is the trap.
The unfiltered page went 1.5 s (13 separate scans) → 3.7 s (one GROUPING SETS
pass with six `count(DISTINCT)` per set) → **441 ms** by collapsing to joint
grain in a CTE first (`bool_or` per joint, then plain `count(*)`), so the page
is four scans instead of thirteen. The filter dropdowns are memoised for 60 s —
they are dimension lists that do not depend on the selection, and a stale one
can only offer a filter value that matches nothing, never a wrong number.

Measured through `/api/flange`: no filter 441 ms · subco 288 ms · HA 212 ms ·
method 354 ms · all three 36 ms · `(blank)` HA 38 ms. No materialised view was
needed; no single query exceeds 419 ms.

---

## Batching

Page assemblers call `bundleTotal()` / `bundleBy()` in `lib/pages/welding.ts`,
which unions `weldingAggs + rtAggs + utAggs + rtBacklogAggs + pwhtAggs` into a
single `SELECT`. A 14-column table is therefore one round-trip, not fourteen;
a whole NDE page is ~7 statements (totals, by weld cat, by service class, by
RT %, and three aging queries whose joint-level dedup has to happen at each
grain separately).
