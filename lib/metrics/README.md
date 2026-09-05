# `lib/metrics` — the SQL metric layer

One module per metric family. Every exported function is parameterised
(`$1…$n`, never string interpolation of a value), returns zod-parsed rows, and
cites the metric id(s) from `analysis/calculation-logic.md` §2 plus the DAX
measure name it implements.

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
| M91 | `refs.approvedWpsCount()` | `DistinctCount(WPQ RECORD REGISTER[WPS NO.])` | `null` until `ref_wps_register` is seeded (R-12) |
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

The gate itself is per source, because the two columns mean different things:

```sql
CASE w.source WHEN 'WELD_DUMP' THEN w.weldpoint_no = 1 ELSE w.weldpoint_seq = 1 END
```

`weldpoint_no` is the dump's repair-attempt sequence (what `WeldPoint No. = 1`
means in the DAX); `weldpoint_seq` is the `WeldPoint No.1 WP1` row number that
migration 0010 added **for CCC only** — it is NULL on every dump row, so a
single `weldpoint_seq = 1` predicate would zero the dump's film totals.

| measure | before | after | justification |
|---|---|---|---|
| M01/M02/M03/M04, M10-M13, M30-M32, M40-M49, M60-M65 | `count(DISTINCT joint_id)` | unchanged | already DISTINCT-safe; grep confirms no `count(*)` over `weld` anywhere in `lib/metrics` |
| **M23** `[RT Total Films by Joint "PR all"]` | not implemented | 3-term inclusion–exclusion, each term `coalesce(…,0)`, WP1 gated per source | `weld_point_code` is no longer a blank placeholder (project-wd-wr-inco-acciona.md §5.2). The `coalesce` is load-bearing: term B matches nothing while only the dump is loaded, and `x + NULL - NULL` is NULL, which rendered the page-1 card as **0** |
| **M24** `[… "PR all" "R"]` | ungated `sum(total_no_of_films_rej)` (§7 C-5 flagged it) | WP1 gated per source | ungated gave 1,449 rejected films for the loaded dump where the WP1-gated `"EP"` twin M22 gives 1,350 — the 99 difference is repair passes counted twice |
| **M26** `[RT Total Films]` ×3 | ungated at both scopes | `"EP"` **unchanged** (ungated, pinned to `reconcile_results.json` at 180,034 films for GAC non-SG); `"PR all"` WP1 gated | §2 documents M26 as deliberately unfiltered and the `"EP"` number is verified against the mockup; at `"PR all"` scope the same sum would count a CCC joint's films ~4x. **Flagged: M26 now differs between the families by design** |
| **M34** `[UT Defect Length by Joint "PR all"]` | not implemented | `Rej Length` term ungated (per-row); CCC tracker term gated `weldpoint_seq = 1` | `[Defect Length(MM).]` is a `LOOKUPVALUE` into `UT TRACKER (CCC)_Talisman` keyed by Joint ID (project-wd-wr-inco-acciona.md:2114-2138) — one value per joint, not per pass |
| M20/M21/M22/M33 (`"EP"`) | `weldpoint_no = 1` | unchanged | never evaluated over CCC; `weldpoint_no` is the dump's repair-attempt sequence there |
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
expression is the WP1 gate, and it is already correct:

| concern | verdict |
|---|---|
| `wp1Cond` = `CASE source WHEN 'WELD_DUMP' THEN weldpoint_no = 1 ELSE weldpoint_seq = 1 END` | correct for both. Acciona sets `weldpoint_no = 1` on **every** row and is one row per joint; Inco sets `weldpoint_no = 1` on every row but is joint × RT-fragment, so `weldpoint_no` would over-count and `weldpoint_seq` is what dedups it. **This is a loader dependency**, pinned by a test: a NULL `weldpoint_seq` makes the gate never match and silently drops the source from M23/M24/M33 |
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

### M33 / M35 / M36 and the Inco blank (R3-06)

They read `weld.weld_length_m`, rolled up in `mv_joint.ut_weld_length_m_prall`,
with `weld_length_by_dia` as the reference dimension (98 distinct
`(dia_inch, weld_length)` rows, R3-07). Two honest-empty gates:

* `weldLengthDimensionLoaded()` — while `weld_length_by_dia` is empty,
  `[Weld Length "PR all"]` cannot resolve at all, so M33/M35/M36 are *unknown*
  and the KPIs render `—`;
* **INCO is blank by the DAX's own guard.** `[Weld Length "PR all"]` gates its
  Inco branch on `[Manual UT Report No.] <> ""` — a `Weld Dump` column the Inco
  source never fills — and the fallback `LOOKUPVALUE` needs `Dia inch`, which
  Inco leaves empty. Reproduced literally per R3-06, never substituted, and the
  page carries a note saying so for the report owner.

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

## Batching

Page assemblers call `bundleTotal()` / `bundleBy()` in `lib/pages/welding.ts`,
which unions `weldingAggs + rtAggs + utAggs + rtBacklogAggs + pwhtAggs` into a
single `SELECT`. A 14-column table is therefore one round-trip, not fourteen;
a whole NDE page is ~7 statements (totals, by weld cat, by service class, by
RT %, and three aging queries whose joint-level dedup has to happen at each
grain separately).
