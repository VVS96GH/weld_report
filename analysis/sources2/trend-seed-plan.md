# Seeding `weld_weekly_snapshot` from the trend workbooks (ruling R-08)

Four hand-maintained weekly workbooks arrived. All four reproduce their pbix row counts
exactly, so nothing was lost in transit. Raw rows are dumped machine-readably next to this
file: `trend-rt-pwht.json`, `trend-rt-ut-rejrate.json`, `trend-active-welders.json`,
`trend-mpi-done.json`.

| workbook | sheet | rows | pbix table | rows in pbix | week range | week-end weekday |
|---|---|---:|---|---:|---|---|
| `CUM Trend file RT and PWHT/CUM Trend file RT and PWHT Backlog .xlsx` | `TREND` | **943** | `TREND Report` | 943 | 2024-02-23 … 2026-08-28 (132 weeks) | all **Friday** |
| `CUM Trend RT% UT% RejRate/CUM Trend RT% UT% RejRate.xlsx` | `TREND RT UT` | **976** | `TREND RT UT` | 976 | 2024-05-03 … 2026-08-28 (122 weeks) | all **Friday** |
| `CUM Trend Active Welders/CUM Trend Active Welders.xlsx` | `CUM Trend Active Welders` | **576** | `Trend Active Welders` | — | 2024-06-21 … 2026-08-28 (115 weeks) | all **Friday** |
| `CUM MPI Done .xlsx` | `MPI Done` | **124** | `CUM MPI Done` | 124 | 2024-04-19 … 2026-08-28 (124 weeks) | all **Friday** |

Both `Back up/` copies are older snapshots of the same two sheets (2024-08-25 vintage,
21–28 KB vs 48–62 KB). Load the live copies, keep the backups as provenance only.

Week-end dates are stored as real Excel dates and are **Fridays**, which matches
`calendar.week_end_date` from migration `0005` — no re-derivation needed.

## Column → metric → `weld_weekly_snapshot(week_end_date, sub_contractor, metric, value)`

`weld_weekly_snapshot` is `(week_end_date, sub_contractor, metric, value)` with the PK on all
three keys, so every workbook column becomes one `metric` string. Proposed metric ids use the
`M##` catalogue of `analysis/calculation-logic.md` §2.

### `TREND Report` — 943 rows × 6 value columns → **5,658 snapshot rows**

| workbook column | metric id | §2 measure | note |
|---|---|---|---|
| `RT Backlog` | `M40` | Total RT Backlog | **dead column — see below** |
| `PWHT Backlog All Types` | `M60` | PWHT Backlog All Types | live |
| `PWHT Backlog For RT` | `M62` | PWHT Backlog Total for RT (BW/GW/CLET/MW) | live |
| `RT BACKLOG & PWHT "Y" Done + "N"` | `M48` | RT B.log & PWHT "Y" Done + PWHT "N" | live |
| `RT BACKLOG & PWHT Not Done` | `M47` | RT B.LOG & PWHT NOT Done | live |
| `PWHT BACKLOG RT NOT Done (SG+TMCP)` | `M64` | PWHT B.Log RT NOT Done | live, SG/TMCP rows only |

`Sub-Contractor` values (132 weeks each unless noted): `CCC`, `GAC`, `TEKFEN`, `MEDGULF`,
`Acciona`, `GAC SG` (131), `TEKFEN TMCP` (130), `Inco` (22 weeks only, 2024 stub).
**`GAC SG` and `TEKFEN TMCP` are separate `sub_contractor` values, not filters** — the schema
column is text, so store them verbatim and let the UI decide.

Six rows carry only 7 of the 8 fields (a trailing blank cell): 2024-10-11 CCC, 2025-01-10 GAC,
2025-04-18 GAC + three more. Treat the missing cell as NULL, not 0.

### `TREND RT UT` — 976 rows × 4 value columns → **3,904 snapshot rows**

| workbook column | metric id | §2 measure |
|---|---|---|
| `RT% Rate` | `M25` | % RT Film Rej (per sub-contractor) |
| `UT% Rate` | `M36` | % of Rej UT by Length (per sub-contractor) |
| `Project RT % Rej Rate` | `M25P` | the project-wide flat line (same value repeated on every row of a week) |
| `Project UT % Rej Rate` | `M36P` | ditto |

Values are fractions, not percents (`0.0023` = 0.23 %). Sub-contractors: `CCC`, `GAC`,
`GAC SG`, `TEKFEN`, `TEKFEN TMCP`, `MEDGULF`, `INCO` (upper-case here, `Inco` in the other
workbook — **normalise**), `Acciona`; 122 weeks each.

### `Trend Active Welders` — 576 rows × 1 value column → **576 rows**, metric `M90W`

`Week_End_Date`, `Sub-Contractor`, `No. of Welders 'PR all"`. Subs: CCC/TEKFEN/GAC/MEDGULF
115 weeks each, Inco and Acciona only 58. This is *not* M90 (`Project_Welder`, the
`SCTR OVERALL APPLIED WELDERS` KPI, still missing) — it is the weekly active-welder count that
feeds the "Project Welders By Weekend" column charts on pbix pages, so give it its own id.

### `CUM MPI Done` — 124 rows × 2 value columns → **248 rows**, metrics `M71` / `M71PT`

`Week_End_Date`, `MPI Done`, `MPI / PT Done`. **No `Sub-Contractor` column** — these are
project totals. Use `sub_contractor = 'PROJECT'` (or NULL if the PK is relaxed); the PK as
specified in §6.3 forbids NULL, so `'PROJECT'` is the cheaper choice. Values are cumulative
(70,593 → 355,125 over 124 weeks), so they are a running total, not a weekly delta.

Grand total to seed: **10,386 rows**.

## Agreement with what the dump computes — checked, and it is exact

The last workbook week (**2026-08-28**) is the same as-of date as the loaded dump, so the two
are directly comparable. Against `analysis/reconcile_results.json` (computed independently by
`analysis/reconcile_check.py`, no database):

| sub-contractor | metric | workbook 2026-08-28 | reconcile_results.json | verdict |
|---|---|---:|---:|---|
| GAC (non-SG) | PWHT Backlog All Types | 424 | `GAC/NONSG/pwht_backlog_all_types` = 424 | **exact** |
| GAC (non-SG) | PWHT Backlog For RT | 131 | `pwht_backlog_BW_GW_CLET_MW` = 131 | **exact** |
| GAC (non-SG) | RT B.log & PWHT "Y" Done + "N" | 234 | 64 + 170 | **exact** |
| GAC (non-SG) | RT B.log & PWHT Not Done | 55 | `rt_backlog_and_pwht_Y_not_done` = 55 | **exact** |
| GAC SG | PWHT Backlog For RT | 3 | `GAC/SG/pwht_backlog_BW_GW_CLET_MW` = 3 | **exact** |
| TEKFEN | PWHT Backlog All Types | 26 | 26 | **exact** |
| TEKFEN | PWHT Backlog For RT | 11 | 11 | **exact** |
| MEDGULF | PWHT Backlog All Types | 43 | 43 | **exact** |
| MEDGULF | PWHT Backlog For RT | 24 | 24 | **exact** |
| MEDGULF | RT B.log & PWHT "Y" Done + "N" | 23 | 0 + 23 | **exact** |
| GAC | **RT Backlog** | **0** | `rt_backlog_total` = 292 | **disagrees** |
| MEDGULF | **RT Backlog** | **0** | 23 | **disagrees** |
| TEKFEN | RT Backlog | 0 | 0 | agrees (both zero) |

Nine of eleven comparable cells reproduce to the unit. That is strong evidence that the ETL
can take over the workbook: appending M47/M48/M60/M62/M64 after every load will produce the
same numbers the report owner types by hand.

**The `RT Backlog` column is abandoned.** It is `0` for every sub-contractor in every week
since **2024-06-28**; only 19 of the 132 weeks have any non-zero value at all, all of them in
Feb–Jun 2024. So the M40 trend series on mockup pages 1 and 7–11 is a flat zero line for the
last two years of history, not a real backlog. Seed it as-is (honest history) and let the ETL
start writing real M40 values from the first live load — but the chart will show a step at the
changeover, and the report owner must be told.

One internal inconsistency in the workbook itself: the `GAC SG` row for 2026-08-28 has
`PWHT Backlog All Types = 0` but `PWHT Backlog For RT = 3`, which cannot both be true (For-RT
is a subset of All-Types). The dump says All-Types = 3. Reproduce the typo, flag it.

## Loader shape

```
seed_weekly_snapshot.ts
  read the 4 sheets (they are 20-62 KB; any xlsx reader will do)
  normalise sub_contractor: 'INCO' -> 'Inco'
  keep 'GAC SG' / 'TEKFEN TMCP' verbatim
  MPI rows -> sub_contractor 'PROJECT'
  blank cell -> NULL, never 0
  INSERT ... ON CONFLICT (week_end_date, sub_contractor, metric) DO UPDATE
```

`--truncate` must keep clearing nothing here (db/README already says so): this history is not
recomputable and the seed is the only copy outside the workbooks.
