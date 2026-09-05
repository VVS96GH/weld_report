# Build plan for the batch-2 sources

Evidence: `profile.md`, `workbooks.md`, `ccc-column-map.md`, `trend-seed-plan.md`,
`gap-check.md`. Every count came from a script in this directory.

## Load order

1. `Spool Dump.txt` → `spool` (198,647). Cheap; unblocks M44/M48/M49 for GAC/TEK/MED.
2. The 4 trend workbooks → `weld_weekly_snapshot` (10,386 rows). Independent.
3. `AllTrain_CSVExport_Joint Record.csv` → a `ccc_joint_pwht` lookup **and** the 130,994
   NOT-WELDED rows into `weld`. Must precede CCC so its PWHT branch resolves.
4. `CSVExport_Welder Record.csv` + `… (ACC REJ).xlsx` → `weld`, `source='CCC_WELDER_RECORD'`.
5. `UT TRACKER (CCC)_Talisman.xlsx` → `ref_ut_tracker` (9,419) for CCC's Manual-UT branch.
6. `Spool.csv` → CCC spool milestones (ruling R2-06).

## Loaders

| loader | source → target | must do |
|---|---|---|
| `load-spool-dump.ts` | `Spool Dump.txt` `;` cp1252 → `spool` | header names 101/102 (`BHS`,`WHS`) have **no data field** — every line has 100 fields; pad, as `Weld Dump.txt` does. Filter `Revision Status=''` → 198,647, and **`Spool ID` is then unique** (the 335 dups are all cancelled rows) |
| `seed-weekly-snapshot.ts` | 4 workbooks → `weld_weekly_snapshot` | see `trend-seed-plan.md` |
| `load-ccc-joint-record.ts` | joint record → `ccc_joint_pwht` + `weld` | `Columns=143` must **truncate**: data lines carry 145 fields |
| `load-ccc-welder-record.ts` | CSV + xlsx → staging → `weld` | the §1.4 split is mandatory — keep only `RT/UT Report No.=''` from the CSV (4,791,434) and append the workbook's 641,575 = 5,433,009 |
| `load-ut-tracker-ccc.ts` | `TalismanUT_update` → `ref_ut_tracker` | the file now has 2 columns (`TPI Date`,`TPI Report No`) the pbix M predates |

## Framing (measured, `profile.md`)

All five files are **CRLF-only, BOM-free, perfectly rectangular** — no embedded newlines, no
re-joins, one physical line = one record (the opposite of `Weld Dump.txt`), so a plain `COPY`
works. But: `Spool Dump.txt` has **193,563 lines containing a `"`** (the inch mark in `Line No`,
`BD6132034A01-6"(1C1KL)-S(52)(25)`) — use `COPY … TEXT`, never CSV, or 96 % of rows break;
`Joint.csv` has **15,499 RFC-4180-quoted `QCISO NO` values** which `QuoteStyle.None` makes the
pbix read literally, so those join keys are corrupt in the pbix too; and the joint record's
145-vs-143 fields must be truncated, not failed on.

## Harmonisation risks (ranked)

1. **Grain.** 5,430,732 CCC rows over **1,339,063 distinct Joint IDs** — one row per welder per
   pass (`Weld Point Code` C/F/R/H, `Welded(Weld Point)` 1–32). Every `count(*)` inflates ~4×;
   only `count(DISTINCT joint_id)` is safe. Confirm every §2 measure is a DISTINCTCOUNT first.
2. **Dates.** CCC is **`yyyy/mm/dd`**, the dump `dd-MMM-yyyy`. `weld_to_date()` accepts neither
   `yyyy/mm/dd` today — it needs a branch, and the regex must stay non-raising.
3. **`RT Film Total` is fractional** on CCC (`0.75` ×296,274; 145 distinct) — a weld-point
   *share*, not a film count. `weld.rt_film_total` is GENERATED `acc+rej` and round-trips it
   only if numeric. M20–M26 go fractional for CCC.
4. **`RT%` vocabulary**: CCC has `0` (3,421,891) and **no `30`**; the dump has `30`. The
   100/30/20/10/5 page split gains a 0 % bucket and loses the CCC 30 % page.
5. **`RT Weld Status`** is synthesised for CCC and emits **`HS CCC`**, a token the dump never
   uses (plus a dead `"blank"` branch). Re-check every §0.6 status whitelist.
6. **Repairs** are a `Repair Suffix` column on CCC (`RW1`/`RS1`/`R01`/`RW1RS1`…), the last two
   chars of `Weld No.` on the dump. `weld.repair_reweld` needs a second rule.
7. Also: **`RT Selected Date` empty in all 5,430,732 CCC rows** (M51 aging not computable);
   **`service_class_cat_ndt`** puts its doubled space in a *different position* for CCC (blank
   `Service Cat`, non-blank `NDT Remarks`) yet is a join key; **`Dia inch` is `0.0` on 448,842
   CCC rows** and `Dia Inch Factor` is derived, not sourced.

## Cost

Measured: a full streaming Python pass over the 1.5 GB / 5.43 M × 119 file takes **51–57 s** at
~1.2 GB peak RSS (88–105 s for all five). Postgres estimate: `COPY` into an `UNLOGGED` 119-text
staging table ≈ 40–90 s; the typed `INSERT … SELECT` of 5.43 M rows ≈ 3–6 min (the dump's 958 k
× 5.7); index maintenance + `VACUUM (ANALYZE)` on a `weld` grown 958,615 → ~6.4 M rows ≈ 3–5
min. **Budget 10–15 min and 8–12 GB of new heap+index.** Stream, never buffer.

## Rulings needed

1. **R2-01 grain** — CCC into `weld` at weld-pass grain (5.43 M rows, DISTINCT-only metrics) or
   collapsed to one row per joint at load? This sizes everything else.
2. **R2-02 `TO BE EXLUDE FROM DATA.xlsx`** — 596 CCC rows, 161 `RT Report + Welder` keys,
   **referenced by no Power Query**. Apply as a load filter, store unapplied, or ignore?
3. **R2-03 `weld_source` enum** — the 130,994 NOT-WELDED joint-record rows join the `"PR all"`
   union. `CCC_WELDER_RECORD` (wrong file) or a fifth value `CCC_JOINT_RECORD` (a migration)?
4. **R2-04 fractional films** — keep CCC's fractional `RT Film Total` (pbix behaviour) or round?
   Changes every headline film number on pages 1–2.
5. **R2-05 CCC RT aging (M51)** — render the five buckets honest-empty, or substitute `RT Date`?
6. **R2-06 two spool masters** — `Spool Dump.txt` has **zero CCC** spools (GAC 103,260 /
   TEKFEN 82,072 / MEDGULF 17,020); `Spool.csv` has CCC's under different column names. One
   `spool` with a `source` column, or `spool` + `spool_talisman`?
7. **R2-07 `Joint.csv`** — a QC cross-check table (22 `TR/F Talisman & …` calc columns), not a
   metric source, expanding to 3,098,341 rows. Load at all?
8. **R2-08 sub-contractor vocabulary** — the trend workbooks use `GAC SG`, `TEKFEN TMCP`, and
   both `Inco` and `INCO`. Normalise at load or in the query layer?
9. **R2-09 dead `RT Backlog` trend column** — zero for everyone since 2024-06-28. Seed the zeros
   as honest history, or NULL and start the series at the first live load?
10. **R2-10 fix `calculation-logic.md` §1.1/§1.3?** Its evidence-point 2 (`"#"`→`"CCC"`) is a
    no-op on the real export; §1.3 omits 3 of the 25 renames and the 4 derived columns. It is
    the build spec — someone must own the correction.
