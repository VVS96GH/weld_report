# `lib/metrics` — the SQL metric layer

One module per metric family. Every exported function is parameterised
(`$1…$n`, never string interpolation of a value), returns zod-parsed rows, and
cites the metric id(s) from `analysis/calculation-logic.md` §2 plus the DAX
measure name it implements.

Scope: the `"EP"` / `"WD"` family (source `WELD_DUMP`) unless a row below says
otherwise. Ruling **R-06** kills the `"PR"` scope entirely — `Project WD+WR` is
a one-row dead table in the shipped pbix.

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
| M02 | — | `[Joint Uniq "PR all" Welded]` | **honest-empty**: needs the four-source union (R-01) |
| M03 | `welding.weldingStats().joints_welded_incl_repair_reweld` | `[Joint Uniq "PR all" Welded & R/RW]` | denominator of the per-WPS `RT/UT Ratio %` |
| M04 | — | `[Joint Uniq "PR all" Welded "F"]` | `"PR all"` only — honest-empty |
| M05 | `welding.weldTypePivot({thisWeekEnding})` | M02 + `Week_End_Date IN TOP 1` | weeks are Sat→Fri, labelled by the Friday |
| M06 | `trend.weeklyProgress()` | M02 by `Week_End_Date` × `Weld Cat` | reads `mv_weekly_progress` (§6.5) |
| M07 | `welding.weldTypeDistribution()` | M02 by `Weld Type` | the donut |
| M10 | `rt.rtStats().tested` | `[Numb RT/UT]` | `rt_acc_rej IS DISTINCT FROM 'RS'` — blanks count |
| M11 | — | `[Numb RT/UT "PR all"]` | honest-empty: differs from M10 only by the union + `<> "U/Review"` |
| M12 | `rt.rtStats().rejected` | `[Numb RT/UT "R"]` | no `Weld Date` / `RT Report` predicate — literal |
| M13 | `rt.rtStats().accepted` | `[Numb RT/UT "A"]` | **M10 − M12**, not `rt_acc_rej='A'` |
| M14 | `rt.rtStats().rejection_rate_joint` | `[Rejection Rate Joint "WD"]` | M12 / M10 |
| M15 | `wps.wpsRejectionTable().rt_ut_ratio`, page cell `RT/UT Ratio %` | `[RT/UT Ratio % …"EP"]` | can exceed 100 % by design |
| M20 | `rt.rtStats().films` | `[RT Total Films by Joint "EP"]` | `weldpoint_no=1 AND <> 'RS'` |
| M21 | `rt.rtStats().films_acc_sum` / `.films_accepted` | `[RT Total Films by Joint "A" "EP"]` | the mockup's "Films Acc" is M20 − M22 |
| M22 | `rt.rtStats().films_rejected` | `[RT Total Films by Joint "R" "EP"]` | `weldpoint_no=1` only, **no** `<> 'RS'` |
| M23 | — | `[RT Total Films by Joint "PR all"]` | honest-empty: needs `Weld Point Code` + the two exclusion calc columns, none in the §8.1 contract |
| M24 | — | `[… "PR all" "R"/"A"]` | as M23 |
| M25 | `rt.rtStats().film_rejection_rate` | `[RT FILM Ratio % by Joint "EP"]` | M22 / M20 |
| M26 | `rt.rtStats().films_all*`, `wps.wpsRejectionTable()` | `[RT Total Films]`, `[… "A"]`, `[… "R"]` | all weld points — why page 42 shows 171,021 where page 8 shows 123,887 |
| M30 | `ut.utStats().ut_done` | `[Numb UT "EP"]` | `ut_weld_status='NR' AND ut_report IS NOT NULL` |
| M31 | `ut.utStats().ut_accepted` / `.ut_rejected` | `[Numb UT "A"/"R" "EP"]` | |
| M32 | — | `[Numb UT "PR All"]` | honest-empty: `[Manual UT Report No.]` coalesces through three UT tracker workbooks (R-05) |
| M33 | `ut.utStats().ut_weld_length_m` | `[UT Weld Length by Joint "EP"]` | metres, `weldpoint_no=1` |
| M34 | — | `[UT Defect Length by Joint "PR all"]` | honest-empty: no `"EP"` version exists; needs the trackers |
| M35 | — | `[UT Inspected Length by Joint "PR all"]` | honest-empty (R-05) |
| M36 | — | `[Rejection UT Rate Length by Sub-Con "PR all"]` | honest-empty: M34 / M35 |
| M37 | `ut.utStats().ut_rejection_rate_joint` | `[Rejection UT Rate Joint "EP"]` | |
| M38 | page cell `UT Ratio %` | `[UT Ratio % UT/ Welded … "EP"]` | M30 / M01 |
| M39 | — | `[Numb UT "PR All" Tracker]` | honest-empty (R-05) |
| M40 | `rt.rtBacklogStats().rt_backlog` | `[RT 5 10 20 100% B.log Joints Weld Status "EP"]` | 16-code hold list **OR** the `rt_pct=100` branch |
| M41 | — | `[RT BACKLOG Total Project "PR all"]` | honest-empty: `"PR all"` union + `'T1-2'` |
| M42 | `rt.rtBacklogStats().rt100_backlog` | `[RT 100% Backlog Joints Weld Status "EP"]` | |
| M43 | — | `[RT100% Backlog "PR all"]` | honest-empty; note it keys on `RT Date`, not `RT Report` |
| M44 | — | `[… "EP" & FABRICATED]` | honest-empty: needs `Spool Dump.txt` |
| M45 | `rt.rtBacklogStats().rt_backlog_pwht_y_done` | `[RT … B.log Joints+PWHT Progress Weld Status "EP"]` | `PWHT Y/N IN ('Y', PWHT_AMBIGUOUS_TOKEN)` |
| M46 | `rt.rtBacklogStats().rt_backlog_pwht_n` | `[… +NO PWHT Progress Weld Status "EP"]` | `PWHT Y/N IN ('N', PWHT_AMBIGUOUS_TOKEN)` + blank PWHT status |
| M47 | `rt.rtBacklogStats().rt_backlog_pwht_y_not_done` | `[RT BACKLOG Total Project & PWHT NOT Done "EP"]` | PWHT on hold (`H`/`HS`), no report |
| M48 / M49 / M50 | — | FABRICATED variants | honest-empty: `Spool Dump.txt` |
| M51 | `rt.rtBacklogAging()`, `rt.backlogAgingBy()` | `[RT Backlog within 3 days "WD"]` … | `≤3 / 3–7 / 7–15 / 15–30 / >30` from `weld_date` to `as_of` |
| M52 | `rt.coverageGapByServiceClass()` | `[RT5%/10%/20% Backlog Joints "PRall" (One Formula)]` | **reduced grain** — see the deviation note below |
| M60 | `pwht.pwhtStats().pwht_backlog_all_types` | `[PWHT Backlog Weld Status All Weld Types "EP"]` | list omits `'HS CCC'`, genuinely |
| M61 | — | `[PWHT All BACKLOG All WELD TYPE "PR all"]` | honest-empty: CCC branch needs `PWHT Y/N CCC` |
| M62 | `pwht.pwhtStats().pwht_backlog_rt_types` | `[PWHT Backlog Weld Status "BW" "GW" "EP"]` | M60 + RT weld types |
| M63 | `pwht.pwhtStats().pwht_backlog_rt100` | `[PWHT BACKLOG RT100% "EP"]` | M62 + `rt_pct=100` |
| M64 | `pwht.pwhtStats().pwht_backlog_rt_not_done` | `[PWHT Backlog … RT NOT Done "EP"]` | |
| M65 | `pwht.pwhtStats().pwht_done` | `[PWHT Done All Weld Types "EP"]` | |
| M66 | `pwht.pwhtBacklogAging()` | `[PWHT Backlog within 3 Days "WD"]` … | same clock as M51 |
| M70 | `welding.weldingStats().mt_pt_done` | `[MT + PT "PR all"]` | `"EP"` reading: MT report + PT report |
| M71 | `welding.weldingStats().mt_done` | `[MT Progress All "PR all"]` | |
| M80 | `trend.weeklySnapshot()` | `[CUM …]` | honest-empty until `weld_weekly_snapshot` has rows (R-08) |
| M81 | `trend.TARGET_LINES` | `[% of Target "PR"]` etc. | hard-coded 0.01 / 0.03 / 0.03 / 0.05 |
| M90 | `refs.qualifiedWelders()` | `Sum(SCTR OVERALL APPLIED WELDERS[…])` | `null` until `ref_qualified_welders` is seeded (R-12) |
| M91 | `refs.approvedWpsCount()` | `DistinctCount(WPQ RECORD REGISTER[WPS NO.])` | `null` until `ref_wps_register` is seeded (R-12) |
| M92 | `trend.weeklySnapshot()` | `Sum(TREND Report[…])` | as M80 |
| M99 | — | `[Total Scope Dia … Master Table]` ×4 | **dropped** (R-07): references a table that does not exist |

**Coverage: 58 / 58 §2 metric ids accounted for — 34 computed from `weld`,
2 read from reference tables, 2 read from the weekly snapshot, 1 constant,
19 documented honest-empty with the missing source named.**

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

## Batching

Page assemblers call `bundleTotal()` / `bundleBy()` in `lib/pages/welding.ts`,
which unions `weldingAggs + rtAggs + utAggs + rtBacklogAggs + pwhtAggs` into a
single `SELECT`. A 14-column table is therefore one round-trip, not fourteen;
a whole NDE page is ~7 statements (totals, by weld cat, by service class, by
RT %, and three aging queries whose joint-level dedup has to happen at each
grain separately).
