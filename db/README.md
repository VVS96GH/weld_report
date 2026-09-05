# The weld-report database

Postgres 17 in Docker, six migrations, one streaming loader. Everything here reproduces the
Power Query load and the DAX calculated columns of
`sources/1. ALL SUBCON … (EP DATA) - Weld Progress +( Full Scope ).pbix`, traced in
`analysis/calculation-logic.md`.

## Run it

```bash
cp .env.example .env          # DATABASE_URL + WELD_DUMP_PATH
npm run db:up                 # docker compose up -d db   (postgres:17.6-bookworm)
npm run db:migrate            # applies db/migrations/*.sql in order, idempotent
npm run db:load               # streams sources/Weld Dump.txt into stg_weld_dump -> weld
```

Other entry points:

```bash
npm run db:down                                        # stop, keep the volume
npm run db:reset                                       # down -v && up  (drops weld_pgdata)
node --import tsx scripts/migrate.ts --status          # what is pending
node --import tsx scripts/load-weld-dump.ts --dry-run  # parse only, NO database
node --import tsx scripts/load-weld-dump.ts --truncate # wipe weld + staging + the load ledger
node --import tsx scripts/load-weld-dump.ts --print-sql
node --import tsx scripts/gen-schema-columns.ts        # regenerate 0002/0003 from columns.json
node --import tsx scripts/gen-schema-columns.ts --check
node --import tsx scripts/check-sql-columns.ts         # offline read-through check
```

Expected on the reference dump (sha256 `d221a875…48c626`, 629,915,102 bytes):

| number | value |
|---|---:|
| logical records assembled | 1,001,114 |
| records dropped: `Revision Status = 'Cancelled'` | 42,473 |
| records dropped: `Weld Date` in the M's exclusion list | 26 |
| rows in `weld` | **958,615** |

958,615 is what `analysis/reconcile_check.py` produces and what §0.4 calls the proof the load
rules are right; the pbix stores 958,634 for its own (19 days older) snapshot.

## Migrations

| file | contents |
|---|---|
| `0001_bookkeeping.sql` | `schema_migrations`, `weld_source` enum, the `load` ledger, the five cast helpers |
| `0002_stg_weld_dump.sql` | **generated** — the 223-column `UNLOGGED` staging table |
| `0003_weld.sql` | **generated** — the 194-typed-column `weld` fact table + indexes |
| `0004_reference.sql` | `calendar`, `spool`, `weld_length_by_dia`, `ref_qualified_welders`, `ref_wps_register`, `weld_weekly_snapshot` |
| `0005_calendar.sql` | populates `calendar` for 2021-05-08 … 2026-12-31 (2,064 rows) |
| `0006_views.sql` | the `nde_result` long view and `mv_weekly_progress` |
| `0007_literal_null_tokens.sql` | supersedes `weld_text()` from 0001 and `mv_weekly_progress` from 0006 — see "Null tokens" below |
| `0008_page_scope_indexes.sql` | `weld_svcclass_wd` — see "Indexes on `weld`" below |
| `0009_weld_source_ccc_joint_record.sql` | **runs outside a transaction** — adds the `CCC_JOINT_RECORD` enum value (R2-03) |
| `0010_batch2_schema.sql` | `weld_to_date` v3, fractional films, 23 new `weld` columns, `spool`, `ccc_joint_pwht`, the ref tables, `load.source` vocabulary |
| `0011_mv_weekly_progress_v3.sql` | re-creates `mv_weekly_progress` after 0010 dropped it — **the current definition** |
| `0012_lengths_and_manual_exclusion.sql` | `weld_length_m` + the two UT length columns + `week_end_date_rt`; `weld_manual_exclusion` seeded with the M’s 4 Joint IDs |

`0002` and `0003` are produced by `scripts/gen-schema-columns.ts` from
`analysis/dump/columns.json` and **are committed**. Never hand-edit them; edit
`scripts/weld-sql.ts` and regenerate. `check-sql-columns.ts` fails on drift.

## Indexes on `weld`

Twelve, eleven from `0003` and one from `0008`.

| index | shape | what it serves |
|---|---|---|
| `weld_load` | `(load_id)` | the ledger join; `DELETE … WHERE source=…` |
| `weld_source_idx` | `(source)` | the "EP" / "PR all" scope predicate (§0.3) |
| `weld_sub_date` | `(sub_contractor, weld_date)` | every weekly/trend query |
| `weld_joint` | `(joint_id)` | joint lookups, repair chains |
| `weld_spool` | `(spool_id)` | the `spool` join (R-01, once Spool Dump lands) |
| `weld_rtpct_sub` | `(rt_pct, sub_contractor)` INCLUDE `(weld_cat, weld_type)` | the NDE-by-RT% page split |
| `weld_svcclass` | `(service_class_cat_ndt)` | the "PR all" service-class key |
| `weld_svcclass_wd` | `(service_class_cat_wd)` | **0008** — the "WD" service-class key the per-subcontractor pages group on (`EQP-SLG-01 SG`); previously unindexed |
| `weld_wps` | `(wps_no)` | the per-WPS rejection pages (41-44) |
| `weld_weld_date` | `(weld_date)` | the `calendar` join in `mv_weekly_progress` |
| `weld_rt_backlog` | partial `(sub_contractor, rt_pct)` | M40-M52 |
| `weld_pwht_backlog` | partial `(sub_contractor)` | M60-M66 |

A covering index for the 8 slow pivot pages (`weld_page_scope`) was measured and dropped —
see the comment in `0008`. The loader runs `VACUUM (ANALYZE) weld` after each load so index-only
scans have a visibility map.

## The column-name contract

`weld` and `stg_weld_dump` use the `pg column name` column of
`analysis/dump/profile.md` §8.1 **verbatim**. That table is the contract shared with the
metrics lane; `scripts/weld-columns.ts::pgName()` is a port of `analysis/dump/profile.py::pgname`
and `check-sql-columns.ts` re-parses §8.1 and fails if the two ever diverge.

The rule, for reading a name off a dump header:

```
header.strip().lower()  ->  '%' becomes '_pct', '/' becomes '_', '.' is deleted,
                            every other non-[a-z0-9] run becomes '_', trim leading/trailing '_'
```

So `RT Acc/Rej` → `rt_acc_rej`, `PWHT Y/N` → **`pwht_y_n`** (note: §6.2's sketch calls it
`pwht_yn`; §8.1 wins), `Weld No.` → `weld_no`, `RT%` → `rt_pct`,
`Total No of films Rej` → `total_no_of_films_rej`.

`weld` additionally carries eleven columns the dump does NOT have: the six placeholders the
Power Query step-list adds (`rt_ut`, `ndt_remarks`, `tracer_shot`, `weld_point_code`,
`original_joint`, `repair_suffix`), the three CCC PWHT columns (`pwht_y_n_ccc`,
`pwht_report_no_ccc`, `pwht_date_no_ccc`), `spool_status` and `ha`. All are NULL for every
`WELD_DUMP` row — they exist so a later CCC / Acciona / Inco union has somewhere to land and
so `service_class_cat_ndt` can reference `ndt_remarks` the way the DAX does. `ha` is a
`Project WD+WR+INCO+Acciona` column that §6.2 lists; it is created empty rather than invented.

Three header names — `BHS`, `PIP-124-A`, `WHS` — carry no data field and are not created.
Twenty-nine columns are empty in all 1,001,114 records; they exist in `stg_weld_dump` (audit)
and are dropped from `weld` (listed in the header comment of `0003_weld.sql`).

## Null tokens and dates

**Only `''` is NULL.** `weld_text(v)` = `nullif(btrim(v), '')`, and every text column goes
through it, so a blank field is SQL `NULL` — which is what `analysis/calculation-logic.md`
§0.2 assumes.

Four tokens *look* like nulls and are deliberately **kept as literal text**:

| token | cells | columns |
|---|---:|---:|
| `NA` | 197,092 | 21 |
| `N/A` | 4,002 | 13 |
| `?` | 226 | 2 |
| `#N/A` | 7 | 1 |

**The pbix does not null them, and we reproduce that.** Its M code replaces `"NA"` with `""`
in exactly six columns — `Preheat Date`, `Weld Date`, `Cutting Date`, `Beveling Date`,
`Fitup Date`, `MIR Date` (`analysis/pbix/model.md` lines 3661-3666) — and nowhere else. The
DAX then relies on the literals surviving everywhere else:

* `[RT Report] <> ""` counts a literal `'NA'` as **tested**;
* `[RT Weld Status] IN {"?","","S"}` matches a literal `'?'` (81 rows; `PMI Weld Status` has
  145 more).

Nulling them globally was the first version of this loader and it was wrong by exactly the
rows you would predict: M10 came out at GAC 38,759 / TEKFEN 23,128 against the reference
38,761 / 23,130, and `rt_report IN ('NA','N/A')` is 2 GAC + 2 TEKFEN rows. Fixed in
`0007_literal_null_tokens.sql`.

The six `"NA"`-blanked columns are unaffected either way, because `weld_to_date()` already
returns NULL for anything that is not `dd-MMM-yyyy`. The loader still emits the M's
`replace(x,'NA','')` on them so the step list is traceable in the generated SQL; it is safe
because no month abbreviation contains the substring `NA`.

`btrim()` stays: profile.md §8.3 lists 20 columns carrying leading/trailing whitespace, and
§6.2 explicitly wants `'No '` and `'No'` in `hold_status` to be one state.

| DAX | Postgres |
|---|---|
| `[X] = ""` | `x IS NULL` |
| `[X] <> ""` | `x IS NOT NULL` (a literal `'NA'` satisfies this — intentionally) |
| `[X] <> "RS"` (true when blank too) | `x IS DISTINCT FROM 'RS'` — **not** `<> 'RS'` |
| `[X] IN {"?","","S"}` | `(x IS NULL OR x IN ('?','S'))` |
| `DIVIDE(a,b)` | `a::numeric / NULLIF(b,0)` |

Dates: all 38 date-typed columns are `dd-MMM-yyyy` (`27-JUN-2024`). `weld_to_date()` also
accepts `dd-MMM-yy` because `Manual UT Date` and `Checked Date` mix the two — those two stay
`text` per §8.1, so the second format matters only for a future CCC source. The regex spells
out the twelve month names on purpose: `to_date()` **raises** on an unknown month, and one
raise would abort the whole 958,615-row INSERT. Anything that does not match becomes NULL.
Dry-run failure counts (all of them are the `NA` token, none are a parse bug — and the
token is kept literally in the *text* columns, only these date columns turn it into NULL):

```
mir_date 12,121 · preheat_date 174,993 · weld_date 226 · fitup_date 76
cutting_date 73 · beveling_date 73 · every other date column 0
```

Numbers: `weld_to_numeric` / `weld_to_int` strip `,` (3 columns use it as a thousands
separator) and return NULL for anything non-numeric. All five helpers are `LANGUAGE sql
IMMUTABLE` and deliberately **not** `STRICT` — a strict SQL function whose body is a `CASE`
cannot be inlined by the planner, and 36 M un-inlined calls would dominate the load.

## Derived columns: pg column ← DAX name ← rule

| pg column | DAX / M object | rule |
|---|---|---|
| `joint_id` | M `#"JOINT ID"` | `[ISO Number]&"-"&[Spool No.]&"-"&[Weld No.]` (raw, untrimmed — Power Query does not trim) |
| `spool_id` | M `#"Added Custom"` | `[ISO Number]&"-"&[Spool No.]` |
| `rt_film_total` | M `#"Added RT Film Total"` / `Weld Dump[Total No Films A+R]` | `coalesce(acc,0)+coalesce(rej,0)` — **GENERATED STORED** |
| `is_cancelled` | column `Revision Status` (R-02) | `coalesce(revision_status,'')='Cancelled'` — **GENERATED STORED**. The `coalesce` is load-bearing: every row in `weld` has `revision_status IS NULL`, and a bare `= 'Cancelled'` would make the column NULL and silently empty `WHERE NOT is_cancelled` |
| `repair_reweld` | `Weld Dump[Repair & Reweld]` | `right([Weld No.],2)` → `R1`/`R2` = `'Repair'`, `RW` = `'Reweld'`, else `''` |
| `service_class_cat_wd` | `Weld Dump[Service Class+Service Cat "WD"]` | `[Service class]&" "&[Service Cat]` |
| `service_class_cat_ndt` | `PRALL[Service Class + Service Cat+NDT Remarks]` | `[Service class]&" "&[Service Cat]&" "&[NDT Remarks]&" "&[RT%]`. `NDT Remarks` is an M placeholder that is `""` for every Weld Dump row, so the key carries a doubled space — reproduced, not tidied, so it matches CCC rows later |
| `temporary_lines` | `Weld Dump[Temporary Lines "WD"]` | `RIGHT([ISO Number],4)="-PCC"` → boolean instead of the DAX string |
| `tmcp_pipe` | `Weld Dump[TMCP Pipe]` | `[Service class]="9C3AQN" && [Dia inch]=46`. The `"PR all"` twin uses `Dia inch IN {30,34,46}` — when CCC lands, that is a second column, not an edit to this one |
| `exclude_ut_films` | `PRALL[Exlude RT Films from UT]` | `[By UT]="Y" && Sub<>"Inco" && CONTAINSSTRING([RT Report],"UT") && (films Rej>0 \|\| RT Film Total>0)`. `CONTAINSSTRING` is case-insensitive → `ILIKE` |
| `exclude_debris_films` | `PRALL[Exlude Full Cut & Debris]` | `[RT Re-Shoot Status]="Full Cut" && Reason contains "Debris" && [Defect Code]="XX"` |
| `ht_remarks` | M `#"Removed HT Remarks"` + `#"Added HT Remarks"` | the dump's own `HT Remarks` is **discarded** and replaced by `if Text.Contains([RT Report],"PAUT") then "PAUT" else null`. `Text.Contains` (M) is case-**sensitive** → `LIKE`, not `ILIKE` |

Value transforms applied at load, all from the M step list:

```
Weld Type        BW_ -> BW,  SW_ -> SW              (substring replace, ReplaceText semantics)
RT Weld Status   T1-2 -> T1                          (so 'T1-2S' also becomes 'T1S')
Manual UT Status ACCEPT|ACEEPT -> A,  REJECT -> R
Result (A/R)     ACCEPT -> A
UT Operator ID   '-' deleted
Checked Date     '/' -> '-', plus five hand-typed Excel serials (45455 -> 12-Jun-2024, …)
TESTPACK SUB CONTRACTOR   'GAC,GAC' -> 'GAC', 'MEDGULF,MEDGULF' -> 'MEDGULF', …
Fitup/Cutting/Beveling Date   the year-0202 typo 0202-09-05 -> NULL
Preheat Date                  0202-08-03 and 0202-10-11 -> NULL
```

Row filters (`§0.4`, applied in the `INSERT … SELECT`, not per query):

```
keep  Area Classification not in ('', '0')
keep  Revision Status = ''          <- cancelled welds out (R-02)
keep  Sub-Contractor <> ''
drop  Weld Date in (2026-12-30, 2026-08-29, 2026-08-30)
```

## Rulings applied

**R-02 — cancelled welds are out.** All 42,473 of them are loaded into `stg_weld_dump` (so
"what changed between two exports" stays answerable), excluded from `weld`, and counted in
`load.records_cancelled` plus `load.notes->'rejected'`. Nobody has to wonder where the rows went.

**R-04 — `PWHT Y/N = '25.01'` (580,860 rows).** The DAX counts that token as **both** `Y` and
`N`. It is not defensible logic, but changing it changes M45/M46/M47 and therefore the
headline backlog numbers, so it is reproduced literally and never silently fixed. The constant
lives in **`scripts/weld-sql.ts`** as the exported
`PWHT_AMBIGUOUS_TOKEN = '25.01'`; the metrics lane imports it from there rather than typing
`'25.01'` into a query, so the report owner can rule on it in exactly one place. The database
stores the raw token in `weld.pwht_y_n` — no interpretation happens at load time.

**R-09 — Slug Catcher is `service_cat = 'SG'`**, which is what every pbix visual filters on.
The `EQP-SLG-*` values in `service_class` are corroboration only. Both columns are stored
untouched; no `is_slug_catcher` column is invented.

**R-01 / R-08 / R-12 — the absent sources.** `spool`, `weld_length_by_dia`,
`ref_qualified_welders`, `ref_wps_register` and `weld_weekly_snapshot` are created and
**empty**. Their inputs are among the 14 workbooks `sources/` does not hold. Empty is the
honest state; a query that joins them must render "source not loaded", never a zero.
`--truncate` deliberately does **not** clear `weld_weekly_snapshot` — that history cannot be
recomputed from a dump.

**R-03 / R-06** — `weld_source` has four values and no `'PR'`: the pbix's `Project WD+WR`
table is filtered to a single joint and is dead. Use `source = 'WELD_DUMP'` for `"EP"` and
`source IN ('WELD_DUMP','CCC_WELDER_RECORD','ACCIONA','INCO')` for `"PR all"`.

## Load strategy

Default `npm run db:load` **appends a `load` row and replaces the rows of that source**:
staging is truncated, previous `weld` rows with the same `source` are deleted, the new ones are
inserted. So `weld` holds exactly one load per source and no aggregate can double-count, while
`load` keeps the full history of what was loaded, when, from which file (size + sha256) and how
many rows each filter dropped. `--truncate` additionally clears every source and the ledger.

`COPY` uses the **text** format, not CSV. CSV would need a quote character that cannot occur
(`QUOTE E'\b'`), but with quoting effectively disabled CSV has no way to represent the embedded
LF that 1,236 records carry inside a field — the newline would end the record. Text format
escapes `\`, tab, LF and CR and is also the fastest path.

Records are assembled by counting `;` separators, never by splitting on a newline: 1,236
records contain a bare LF inside a field and 17 contain an embedded CRLF, so neither `\n` nor
`\r\n` delimits a record. The assembler is a port of
`analysis/reconcile_check.py::iter_records`; the dry run reports both counts (17 re-joined
records is the number to watch).

## `mv_weekly_progress`

Refreshed at the end of every load. Its predicates are the §2 measure definitions verbatim —
each flag names its measure (M01, M03, M10, M12, M20, M21, M22, M40, M42, M60, M65).

It is deliberately **not** written as eleven `count(DISTINCT joint_id) FILTER (…)` aggregates
like the §6.5 sketch: Postgres runs multiple DISTINCT aggregates with one tuplesort per
aggregate per group, which would sort ~958k joint ids eleven times and make the refresh the
slowest step of the load. It first collapses to one row per (group, joint) with `bool_or()`
and then counts those rows — exactly equivalent (a joint is in the bucket iff **any** of its
rows satisfies the predicate) and two hash aggregates instead of eleven sorts.

**Two things a consumer must know:**

1. the `count(DISTINCT joint_id)` columns are **not additive across rows** — a joint welded in
   two weeks is counted in both; re-aggregate from `weld` for a total;
2. the join to `calendar` is on `weld_date`, so rows without a weld date are absent. That
   matches M01/M05/M06, but M12 (rejected joints) has no weld-date predicate in the DAX, so the
   `rejected` column here is "rejected AND welded" and is a lower bound on the live M12.

## Batch-2 schema (CCC, spools, workbooks) — migrations 0009-0011

Sources: `analysis/sources2/{rulings,plan,ccc-column-map,trend-seed-plan,workbooks,profile}.md`
and `analysis/pbix/project-wd-wr-inco-acciona.md`. Rulings R2-01…R2-16 are binding.

### `weld_source` gains a fifth value

`CCC_JOINT_RECORD` (R2-03) for the 130,994 NOT-WELDED rows of
`AllTrain_CSVExport_Joint Record.csv` — a different file with a different grain from
`CSVExport_Welder Record.csv`. Labelling them `CCC_WELDER_RECORD` would make provenance a lie.

`ALTER TYPE … ADD VALUE` is why `scripts/migrate.ts` now understands a
`-- migrate: no-transaction` marker on line 1 of a migration: such a file is run with
autocommit and **must be internally idempotent**, because nothing rolls back. `0009` is the
only file that carries it.

### `weld` grows by 23 columns

| column | type | filled by | why |
|---|---|---|---|
| `area_classification_label` | text | every loader | CCC's `Area Group-2` renames to `Area Classification` but its values are TEXT (`Train-8 Process` ×1,493,903) while the dump's are 7-digit codes. The pbix's PR-all table has 22 distinct classes = the union. `area_classification` stays `integer` (dump only, NULL for CCC); **group and slice on the label**. Migration 0010 backfills the dump rows. |
| `weldpoint_seq` | integer | loader | `ROW_NUMBER() OVER (PARTITION BY joint_id ORDER BY id)`. `seq = 1` is the pbix `WeldPoint No.1 WP1` flag that 14 `Total … Dia WP1 …` measures — the entire dia-inch welded volume — key on. |
| `welder_id` | text | loader | `welder \|\| '-' \|\| sub_contractor`. 96 visuals and 19 measures group by this, **not** by `welder`: badge numbers collide across subcontractors (3,940 vs 3,896). |
| `testpack_no_all` | text | loader | `TESTPACK No "PR All"`. CCC's from the joint record's `Test Package No`, else `max(testpack_no)` over `joint_id`. Cardinality 17,875 → 29,456; without it the TESTPACK page undercounts 40 % of packages. |
| `manual_ut_report_no_all`, `manual_ut_status_all`, `manual_ut_date_all`, `ut_operator_id_all`, `ut_report_all`, `ut_date_all` | text/date | loader | **UT-tracker overlays, kept separate on purpose.** The pbix has both an imported `Manual UT Report No` and a *calculated* `Manual UT Report No.` (with the dot) — different columns, the second overwriting the first from the UT trackers. Same for Date / Status / Operator ID. Merging each pair would destroy the raw value. Read the `_all` column for "PR all" metrics; the raw column keeps what the source file said. |
| `mt_report_ccc`, `mt_date_ccc`, `mt_pct_ccc`, `pt_report_ccc`, `pt_date_ccc`, `pt_pct_ccc`, `pmi_report_ccc`, `pmi_date_ccc`, `ht_report_ccc`, `ht_date_ccc`, `dwir_ccc_from_jr`, `thickness_from_jr`, `rework_code_all` | mixed | CCC loader | The "… CCC" measure branches. Every one is a `LEFT JOIN ccc_joint_pwht ON joint_id` with `MAX()` over the group, because the joint record is joint-grained and CCC's fact rows are welder-pass-grained (R2-01). `dwir_ccc_from_jr` is the joint record's `Weld Report No`; `DWIR Report "PR All"` is then `coalesce(dwir_no, dwir_ccc_from_jr)` — an expression, not a stored column. |

Plus three indexes: `weld_welder_id`, `weld_wp1` (partial, `WHERE weldpoint_seq = 1`) and
`weld_testpack_all`.

**Films are fractional now (R2-04).** `total_no_of_films_acc`, `total_no_of_films_rej` and the
generated `rt_film_total` are `numeric(10,4)`. CCC's `RT Film Total` is a weld-point *share*,
not a film count — `0.75` on 296,274 rows, 145 distinct values — and the DAX SUMs it. The
dump's values are whole numbers and are unchanged. `mv_weekly_progress.films_taken` /
`films_accepted` / `films_rejected` are therefore `numeric`: **format them, never cast to
integer.** Widening the two columns forced dropping the generated column, which forced
dropping and re-creating the matview — hence `0011`.

### What is NOT in `weld`, on purpose

`analysis/pbix/project-wd-wr-inco-acciona.md` §5.4 lists ~60 pbix "columns" that are really
aggregates written as columns — every `RT Film Ratio % …`/`UT Rej Rate % …` and its `STATUS`
twin, `Days Since Last …`, the `CROSS CHECK` flags, `Open_Punch_*`. Those belong in a
`GROUP BY` in `lib/metrics`, not in the fact table, and are deliberately absent. The two
`Index` row-order relationships are not ported either — join on `joint_id`.

The five columns `ccc-column-map.md` names that `weld` still does not have are all empty in
every row of every source: `last_reshoot_date1` / `last_reshoot_report_no1` /
`last_reshoot_result1` (the M meant to drop them and misspelled the names) and
`ht_batch_no` / `ht_batch_status` (two of the 29 all-empty dump columns; the M adds them blank
for CCC). Empty in both sources = no column.

### `spool` — two masters, one table (R2-06)

`Spool Dump.txt` has **zero CCC spools** (GAC 103,260 / TEKFEN 82,072 / MEDGULF 17,020);
CCC's live in `Spool.csv` (Talisman) under other names. One table, `source spool_source`
(`SPOOL_DUMP` | `TALISMAN_SPOOL`), PK `(source, spool_id)`.

| `spool` column | `Spool Dump.txt` | `Spool.csv` (Talisman) |
|---|---|---|
| `spool_id` | `ISO Number` + `-` + `Spool No.` | `QCISO NO` + `-` + `SPOOL NO` |
| `iso_number` / `spool_no` | `ISO Number` / `Spool No.` | `QCISO NO` / `SPOOL NO` |
| `spool_weight` | `Spool Weight` | `WEIGHT` |
| `fabrication_order` | — | `FABRICATION ORDER` |
| `material_issue` | `Material Check` | `MATERIAL ISSUE` |
| `cut_fit` | — | `CUT / FIT` |
| `start_fab` | `START FAB` | — |
| **`fabricated`** | `FABRICATED` | `SHOP WELD COMPLETE` |
| **`qc_release`** | `QC RELEASE` | `QC SPOOL RELEASED TO NDT/PWHT` |
| `pwht_date` | — | `PWHT` |
| `shop_nde_done` | — | `SHOP NDE DONE` |
| `sent_to_paint` | `SENT TO PAINT` | `PAINT RELEASE` |
| **`painted`** | `PAINTED` | `PAINT COMPLETE` |
| `final_qc` | `FINAL QC` | `QC RELEASE FROM PAINTING` |
| `paint_report_date` / `paint_report_no` | — | `PAINTING REPORT DATE` / `PAINTING REPORT NO` |
| `laydown` | `LAYDOWN` | `SENT TO LAYDOWN` |
| `laydown_move` | — | `LAYDOWN MOVE` |
| **`to_site`** | `TO SITE` | `SITE MOVE` |
| **`erected`** | `ERECTED` | `SPOOL ERECTION DONE` |
| `field_weld_complete` | — | `FIELD WELD COMPLETE` |
| `field_nde_done` | — | `FIELD NDE DONE` (a date) |
| `field_weld_nde_completed` | `Field Weld NDE Completed` (**text**) | — |
| `spool_nde_status` | `Spool Nde Status` | — |
| `welded_bolt`, `supported`, `rft`, `mir_no`, `mir_date`, `qc_sign_off`, `erec_mir_*`, `testpack_test_done_date` | same-named | — |
| all scope/geometry columns (`area_classification`, `line_no`, `service_class`, `shop_dia`, …) | same-named | — |

The five bolded rows are the milestones the DAX `LOOKUPVALUE`s read
(`Weld Dump[Fabricated Date]`, `[QC Release Date]`, `[PAINTED Date]`, `[To Site Date]`,
`[ERECTED Date]`, `[Status Spool NDE]`), so those are the ones that must be right.

`Spool Dump.txt` columns dropped as unmapped noise: `QC13 Form No`, `W10/P Form No`,
`W24 Form No`, `QC13`, `W10P`, `QR Code`, `Barcode`-adjacent form numbers, the insulation and
cladding block (`RELEASE FOR INSULATION`, `INSULATION COMPLETION`, `INSULATION TYPE`,
`CLADDING`, `TQ/SDR FOR INSULATION`, `INSU FINAL INSP RFI NO`), the painting-touch-up block,
`IWP CODE`, `TRACING *`, `ETA`, `Field Pipe`, `Material Check`-adjacent duplicates, and the
five columns empty in all 202,352 rows (`RELEASE FOR TRACING`, `Commissioning Package`,
`GPSNCOORDINATE`, `GPSECOORDINATE`, `PED`, `GWBS`, `BHS`, `WHS`). Talisman drops only
`LAYDOWN LOCATION` (empty in all 331,979 rows).

Framing: `Spool Dump.txt` has **193,563 lines containing a `"`** — the inch mark in `Line No`
(`BD6132034A01-6"(1C1KL)-S(52)(25)`). `COPY … FORMAT text`, never CSV, or 96 % of rows break
(R2-06). The header names 101/102 (`BHS`, `WHS`) have no data field, exactly like
`Weld Dump.txt`: every line carries 100 fields. Filter `Revision Status = ''` → 198,647 rows,
after which `spool_id` is unique (all 335 duplicates are cancelled rows).

### `ccc_joint_pwht` — the CCC joint-record lookup

**A separate table, not folded into `weld`.** The joint record is joint-grained (1,560,273
kept rows) while CCC's fact rows are welder-pass-grained (5,430,732); folding it in would copy
the same PWHT value onto ~4 rows each and invite the `count(*)` double-count R2-01 warns about.
The pbix does the same: `PWHT Y/N CCC`, `PWHT Report No CCC` and `PWHT Date No CCC` are
`LOOKUPVALUE` calculated columns keyed `Joint ID "JR"` → `Joint ID`.

The `weld.*_ccc` columns are the *materialised overlay* of this table onto the fact rows, so
that M45/M46/M47/M61/M65 stay single-table predicates. This table is the auditable source.

The name says PWHT for historical reasons; it carries the **whole** joint-record lookup —
MT/PT/PMI/HT reports and dates, `Test Package No`, `Weld Report No`, `Wall Thickness`,
`Rework Code`.

> **Grain warning for the loader.** 1,560,273 kept rows collapse to 1,470,065 distinct
> `Joint ID`s, so the key is **not** unique in the file. The loader must collapse to one row
> per joint, record how many source rows it merged in `source_rows`, and set `is_ambiguous`
> when the merged rows disagree. DAX `LOOKUPVALUE` returns BLANK on a genuine conflict; we
> make the conflict countable instead of invisible.
>
> There is **no `25.01` token** in this file — `PWHT` is a clean `Y` (202,786) / `N`
> (1,357,487). Ruling R-04's ambiguous value is a Weld Dump artefact only.

### `weld_weekly_snapshot` — scope and the raw label (R2-08)

New columns `scope text NOT NULL DEFAULT 'ALL'` and `label_raw text`; PK is now
`(week_end_date, sub_contractor, scope, metric)`. Normalisation at load:

| workbook cell | `sub_contractor` | `scope` | `label_raw` |
|---|---|---|---|
| `GAC SG` | `GAC` | `SG` | `GAC SG` |
| `TEKFEN TMCP` | `TEKFEN` | `TMCP` | `TEKFEN TMCP` |
| `Inco` / `INCO` | `INCO` | `ALL` | as found |
| (MPI sheet, no such column) | `PROJECT` | `ALL` | — |

`ALTER`, never `DROP`: this history is the only copy outside the workbooks (R-08), and
`--truncate` still does not clear it.

### Reference tables for the seeding lane

| table | source | rows | note |
|---|---|---:|---|
| `ref_exclusion_list` | `TO BE EXLUDE FROM DATA.xlsx` | 596 | **R2-02: stored UNAPPLIED.** No loader or metric may filter on it without an explicit ruling. Referenced by no Power Query. |
| `ref_ut_tracker_ccc` | `UT TRACKER (CCC)_Talisman.xlsx`, sheet `TalismanUT_update` | 9,419 | R2-14. All 24 columns including `TPI Date` / `TPI Report No`, which the pbix M predates. The `Reject` sheet (30 rows) is a subset and is **not** loaded. `ut1_rep_no` is the natural key (9,419 distinct). `welder_id` can hold a PAIR (`W-276/W-442`) — text, never split at load. |
| `ref_mpi_done` | `CUM MPI Done .xlsx` | 124 | Project totals, no sub-contractor column. Values are **cumulative running totals**, not weekly deltas. Also seeded into `weld_weekly_snapshot` as `M71` / `M71PT` with `sub_contractor = 'PROJECT'`. |
| `ref_active_welders` | `CUM Trend Active Welders.xlsx` | 576 | Weekly active welders. **Not** M90 (`Project_Welder`, the SCTR register, still missing) — its own metric id `M90W`. Two of the 576 value cells are blank: store NULL, never 0. |

### `load.source` is text with a CHECK, no longer the enum

`load.source` described only rows that land in the fact table. Batch 2 loads spool masters,
workbooks and a tracker, none of which are weld rows. It is now `text` with a CHECK over:

```
WELD_DUMP  CCC_WELDER_RECORD  CCC_JOINT_RECORD  ACCIONA  INCO      -- fact sources (also weld_source values)
SPOOL_DUMP  TALISMAN_SPOOL  WEEKLY_SNAPSHOT  UT_TRACKER_CCC        -- dimension / reference
EXCLUSION_LIST  MPI_DONE  ACTIVE_WELDERS
WELD_LENGTH  WPS_REGISTER  QUALIFIED_WELDERS                       -- tables that exist, files still missing
```

`weld.source` stays the `weld_source` enum. The two vocabularies overlap; they are not the same.

### Dates: `weld_to_date` v3 (R2-11)

Four branches now — `dd-MMM-yyyy` (the dump), `dd-MMM-yy`, `yyyy/mm/dd` (CCC's welder and
joint records) and `yyyy-mm-dd` (the workbooks). Still non-raising: the month names are
enumerated so `to_date()` can never see an unknown `MON`, and anything unmatched returns NULL
instead of aborting a 5.4-million-row INSERT.

### Reading the migration log

Migrations are append-only, so more than one file can define the same object. **Always read
the highest-numbered definition:**

* `weld_text()` — 0001, superseded by **0007**
* `weld_to_date()` — 0001, superseded by **0010**
* `mv_weekly_progress` — 0006, 0007, superseded by **0011**
* `weld` — created by 0003 (generated), altered by 0008 and 0010

`scripts/sql-schema.ts` replays the whole log and `scripts/check-sql-columns.ts` checks the
*effective* schema, so a stale earlier definition cannot make a check pass by accident.

## Workbook seeders (SEED-LANE, rulings R2-02/R2-08/R2-09/R2-14)

| script | workbook(s) | table(s) | rows | normalisation |
|---|---|---|---:|---|
| `scripts/seed-weekly-snapshot.ts` | `CUM Trend file RT and PWHT Backlog .xlsx`, `CUM Trend RT% UT% RejRate.xlsx`, `CUM Trend Active Welders.xlsx`, `CUM MPI Done .xlsx` (live copies, not `Back up/`) | `weld_weekly_snapshot` (10,386), `ref_mpi_done` (124), `ref_active_welders` (576) | 10,386 + 124 + 576 | R2-08 label split (`GAC SG`→GAC/SG, `TEKFEN TMCP`→TEKFEN/TMCP, `Inco`/`INCO`→INCO/ALL, else uppercase/ALL); blank cell → NULL, literal `0` kept (R2-09); MPI rows → `sub_contractor='PROJECT'`; GAC SG 2026-08-28 All-Types<For-RT typo reproduced as-is and flagged in the run output |
| `scripts/load-ut-tracker-ccc.ts` | `UT TRACKER (CCC)_Talisman.xlsx`, sheet `TalismanUT_update` (24 cols; `Reject` sheet NOT loaded) | `ref_ut_tracker_ccc` | 9,419 | `joint_id` derived: `qciso_no‖'-'‖spool_no‖'-'‖joint_no`; `welder_id` kept as a `/`-pair verbatim, never split |
| `scripts/load-exclusion-list.ts` | `TO BE EXLUDE FROM DATA.xlsx`, sheet `TO BE Exlude from Data` (`Sheet1`, 20 rows, NOT loaded) | `ref_exclusion_list` | 596 | **stored UNAPPLIED (R2-02)** — no loader/metric may filter on it; `rt_report`/`welder` split from `RT/UT Report No.`/`Welder No.`; distinct-pair count is 159, not the workbook's own precomputed `RT Report + Welder` column's 161 — 2 rows where that combined column disagrees with the split source columns (a source typo, printed as evidence by the script, not silently reconciled) |

`scripts/lib/xlsx.ts` holds the shared exceljs helpers (`readSheet`, `toISODate`/`isFridayISO`,
`toNum`/`toText`, `normalizeSubContractorLabel`) all three scripts and `tests/seeders.test.ts`
import. Every script supports `--dry-run` (parse + counts, no database) and, live, appends one
`load` row per run. `seed-weekly-snapshot.ts` UPSERTs (`ON CONFLICT … DO UPDATE`) rather than
delete-then-insert, per this file's own rule that `weld_weekly_snapshot` history is
irreplaceable; the two reference loaders delete only the previous rows of their own `source`
before inserting, same shape as `load-weld-dump.ts`.

npm scripts to add (package.json is not edited by this lane):
```
"db:seed:snapshot":  "node --env-file-if-exists=.env --import tsx scripts/seed-weekly-snapshot.ts",
"db:load:ut-ccc":    "node --env-file-if-exists=.env --import tsx scripts/load-ut-tracker-ccc.ts",
"db:load:exclusions":"node --env-file-if-exists=.env --import tsx scripts/load-exclusion-list.ts"
```

### `repair_reweld` and `tmcp_pipe` — one column, two rules

Ruling D4: one column each; the loader picks the rule by source. Both rules live in
`scripts/ccc-columns.ts` and `scripts/weld-sql.ts`, side by side:

| | `WELD_DUMP` ("WD" rule) | every other source ("PR all" rule) |
|---|---|---|
| `repair_reweld` | `Weld Dump[Repair & Reweld]`: `right([Weld No.],2)` → `R1`/`R2` = `Repair`, `RW` = `Reweld`, else `''`. **3 categories.** | `PRALL[Repair & Reweld "PR all"]`: `Sub-Contractor = "Inco"` → `''`; else `right([Joint ID],2)` → `R1`/`R2` = `Repair`, `RW` = `Reweld`; else `Repair Suffix = "RW1"` → `Reweld`, `= "RS1"` → **`RS1`**, else `''`. **4 categories** — `RS1` is its own bucket, not `Repair` (the model's stored cardinality is 4). |
| `tmcp_pipe` | `Service class = '9C3AQN' AND dia_inch = 46` | `Service class = '9C3AQN' AND dia_inch IN (30, 34, 46)` |

A metric reading `repair_reweld = ''` therefore means "not a repair or reweld" in both
vocabularies; a metric that needs the `RS1` distinction must test for it explicitly, and will
only ever see it on CCC rows.

## The batch-2 loaders

| script | source(s) | target | rows |
|---|---|---|---:|
| `load-spool-dump.ts` | `Spool Dump.txt`, `Spool.csv` | `spool` | 198,647 + 331,979 |
| `load-ccc-joint-record.ts` | `AllTrain_CSVExport_Joint Record.csv` | `ccc_joint_pwht` + `weld` | 1,470,065 + 130,994 |
| `load-ccc-welder-record.ts` | `CSVExport_Welder Record.csv` + the ACC/REJ workbook | `weld` | 5,432,993 |

Each takes `--dry-run`, which parses the real files with **no database** and prints the counts
above so a drift in a source file is caught before anything is written. Add these to
`package.json` (frozen for this lane):

```json
"db:load:spool":      "node --env-file-if-exists=.env --import tsx scripts/load-spool-dump.ts",
"db:load:ccc-joints": "node --env-file-if-exists=.env --import tsx scripts/load-ccc-joint-record.ts",
"db:load:ccc":        "node --env-file-if-exists=.env --max-old-space-size=4096 --import tsx scripts/load-ccc-welder-record.ts"
```

**Order matters.** `load-ccc-welder-record.ts` refuses to start if `ccc_joint_pwht` is empty:
the CCC NDE branches are a `LEFT JOIN` to it, and loading first would write NULLs into
`pwht_y_n_ccc` and friends and look perfectly successful.

### `Spool Dump.txt`: pad the line, never re-join it

`Weld Dump.txt` needs a record assembler because 1,253 of its records span lines. `Spool
Dump.txt` needs the opposite: every physical line carries **100** fields against a **102**-name
header (the trailing `BHS`/`WHS` have no data field, exactly as in the weld dump), and Power
Query with `QuoteStyle.None` pads each *physical line* to the declared width. An assembler that
re-joined until the separator count reached 101 would fuse pairs of lines and produce 101,176
records instead of 202,352. The loader pads and never re-joins.

`COPY … FORMAT text`, never CSV: 193,563 of the 202,352 lines contain a literal `"` — the inch
mark in `Line No` (`BD6132034A01-6"(1C1KL)-S(52)(25)`).

The 66,931 date cells the loader reports as parse failures are all the literal `NA` token, which
is exactly what `weld_to_date()` is meant to NULL. The dry run prints the offending values so a
real parse bug cannot hide behind that number.

### The CCC welder record: the §1.4 split

```
CSV rows with `RT/UT Report No.` = ''      4,791,434
+ every row of the ACC/REJ workbook          641,575
= 5,433,009                                          = the pbix's stored row count
```
Loading the CSV whole would double-count the 639,298 tested rows; loading only the CSV would
lose the workbook's corrected ACC/REJ results. The workbook has the same 119-column header and
is read with the `exceljs` streaming `WorkbookReader`, so neither file is ever fully in memory
(measured peak RSS 960 MB for the whole pass).

Then the M's `#"EXLUDE 4 RT B.log CCC"` removes four hard-coded Joint IDs — **16 rows**,
matching the pbix's own row arithmetic exactly — leaving **5,432,993** in `weld`. The four ids
live in `weld_manual_exclusion` (migration 0012) as well as in the loader, and
`check-sql-columns.ts` fails if the two lists ever diverge.

`weldpoint_seq` is counted during the stream rather than by a post-load
`ROW_NUMBER() OVER (PARTITION BY joint_id)`: rows are COPYed in file order, so the counter
gives the same answer and saves a full rewrite of 5.4 M rows. The CCC NDE overlay is the one
`UPDATE`, a single join to `ccc_joint_pwht`.

### Distinct `joint_id` for CCC: 1,339,099, not 1,339,063

Both numbers are right, for different row sets. `analysis/sources2/profile.md` reports
**1,339,063** distinct Joint IDs over the *whole* CSV (all 5,430,732 rows) — the loader's Joint
ID recipe reproduces that number exactly when run over the whole file. What lands in `weld` is
a *different* population: the CSV's untested rows plus the workbook's 641,575, which together
carry **1,339,099** distinct joints (and 1,339,103 before the four manual exclusions). The
workbook contributes joints the untested CSV slice does not.

---

## For CLAUDE.md (10 lines — orchestrator to merge)

```
## Database
Postgres 17 in Docker (`docker-compose.yml`, volume `weld_pgdata`). `npm run db:up && npm run
db:migrate && npm run db:load` loads `sources/Weld Dump.txt` → `stg_weld_dump` (223 text
columns) → `weld` (194 typed + derived, 958,615 rows; cancelled welds excluded, ruling R-02).
Column names are `analysis/dump/profile.md` §8.1 verbatim — that is the contract between the DB
and metrics lanes; `db/migrations/0002`/`0003` are GENERATED by `scripts/gen-schema-columns.ts`,
never hand-edited. Blank text is stored NULL, so DAX `<> "RS"` ports to `IS DISTINCT FROM 'RS'`
(see `db/README.md`). `scripts/check-sql-columns.ts` is the offline read-through check; run it
after touching any migration. `PWHT_AMBIGUOUS_TOKEN` ('25.01', ruling R-04) is exported from
`scripts/weld-sql.ts` — import it, never inline the literal.
```
