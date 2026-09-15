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
| `0013_mv_joint.sql` | **metrics lane** — `mv_joint` / `mv_joint_wps`, the joint-grain rollups |
| `0014_batch3_schema.sql` | `weld.sub_contractor_tier`; `weld_length`/`rej_length` widened for Inco's millimetres; `weld_length_by_dia` precision; `ref_code_label`; the three welder tables |
| `0015_flange.sql` | the `flange` register (83 cols) + `ref_ha` (empty by design) — the flange dashboard's fact table, separate from `weld` |
| `0020_inco_repair_length.sql` | `weld.repair_length_mm` — the Inco branch of `[Defect Length(MM).]` (0016-0019 are the metrics lane's) |
| `0022_wps_register.sql` | `ref_wps_register` widened + `ref_wps_process` / `ref_wps_status_cum` / `ref_wps_pwht_status` (0021 is the metrics lane's) |
| `0013_mv_joint.sql` | **metrics lane** — `mv_joint` (2,370,428 rows) and `mv_joint_wps` (2,194,756), the joint-grain rollups the project pages read |
| `0039_fabricated_prall_pages.sql` | `mv_joint.rt_bl_ynotdone_fab_prall_dump` / `_ccc` — M49 `[… PWHT"Y" NOT Done FABRICATED "PR all"]` as the DAX's dump + CCC branches (56 + 12 = 68); the `"PR all"` bundle now reads the 0025 / 0039 pairs for both FAB-D columns; otherwise 0038 verbatim |
| `0038_pwht_yn_slicer.sql` | `mv_joint.pwht_y_n` / `pwht_y_n_ccc` — the raw PWHT Y/N token at joint grain (`max()`, constant per joint) for the NDE / PWHT pages' slicer; otherwise 0035 verbatim (0036 / 0037 do not touch the views) |

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
* `mv_joint` / `mv_joint_wps` — **0013** (authored by the metrics lane; this lane only
  REFRESHes them, never edits the file)
* `weld_manual_exclusion` — 0012

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

`welder_id` is left NULL for `CCC_JOINT_RECORD` rows: the joint record has no welder
column (only `Welder(Root/Heat/Fill/Cap)`), and a fabricated identifier is worse than an
absent one.
| `load-ccc-welder-record.ts` | `CSVExport_Welder Record.csv` + the ACC/REJ workbook | `weld` | 5,432,993 |

Every one of them refreshes `mv_weekly_progress`, `mv_joint` and `mv_joint_wps` after
`COMMIT` — see "Every loader refreshes three materialised views" below; budget ~73 s for it.

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

### One COPY at a time — the deadlock that made this a rule

The first joint-record loader opened two `COPY` streams on one `Client`, one into
`tmp_jr` and one into `weld`, and fed both from a single pass. It deadlocked in
production at 829,562 rows: `pg_stat_progress_copy.tuples_processed` froze and the node
process sat at 243 MB RSS with 8 s of CPU — blocked, not slow.

**node-postgres runs one query per connection.** The second `copyFrom` only joined the
client's query queue; its `Writable` was never attached to the socket, so nothing consumed
it. Once ~4 MB of `weld` rows had buffered, `write()` returned `false`, the loader awaited
`'drain'`, and that `'drain'` could never fire. The await never settled, the producing loop
stopped, and the *first* COPY — the one that was working — stopped being fed.

`scripts/load-common.ts::copyRows()` is now the only way to COPY, and it forecloses this
three ways:

1. **A re-entrancy guard.** A second `copyRows()` on a client that already has one in flight
   throws immediately, naming the deadlock. A hang becomes a loud error.
2. **`stream.pipeline` owns back-pressure**, and propagates errors both ways — a server-side
   COPY failure now rejects instead of hanging.
3. **A stall watchdog** aborts if no bytes reach the server for 60 s (configurable). It
   *races* the pipeline rather than only destroying the stream, because in a real stall the
   producer is parked on a promise that can never settle and Node cannot cancel one — so the
   pipeline would not settle either. The loaders' top-level catch calls `process.exit(1)` so
   the parked generator cannot keep the process alive.

Both guards are proven against the live database, not just reasoned about: a second
concurrent COPY throws while the outer one still completes, and a deliberately wedged
producer is rejected after 10 s instead of hanging.

The joint-record loader now makes **two sequential passes** over the file. Re-reading 634 MB
costs ~9 s; the deadlock cost the whole load.

### Every loader refreshes three materialised views

After `COMMIT`, and **outside** any transaction, all four loaders call
`refreshMatviews()` from `scripts/load-common.ts`, which refreshes in this order:

| view | rows | refresh | why it is in the list |
|---|---:|---|---|
| `mv_weekly_progress` | 10,309 | plain, ~21 s | the weekly trend (§6.5) |
| `mv_joint` | 2,370,428 | `CONCURRENTLY`, ~43 s | migration 0013 — the joint-grain rollup the project pages read |
| `mv_joint_wps` | 2,194,756 | `CONCURRENTLY`, ~8 s | the per-WPS pivot grain |

Three rules the helper enforces so nobody has to remember them:

* **`CONCURRENTLY` cannot refresh a view that has never been populated.** 0011 and 0013 both
  create theirs `WITH NO DATA`, so the helper reads `pg_class.relispopulated` and makes the
  *first* refresh after a `npm run db:reset` a plain one. Without that branch the first load
  into a fresh database fails.
* **`CONCURRENTLY` cannot run inside a transaction block**, which is why the call sits after
  `COMMIT` in every loader. `check-sql-columns.ts` fails if a loader grows a hand-rolled
  `REFRESH MATERIALIZED VIEW` statement again.
* **`CONCURRENTLY` needs a non-partial unique index.** `mv_joint_key (source, joint_id)` and
  `mv_joint_wps_key (source, joint_id, wps_no)` are it. No `NULLS NOT DISTINCT` is needed
  here — unlike `mv_weekly_progress`, whose key columns are nullable — because `weld.source`,
  `weld.joint_id` and (in the WPS view) `wps_no` are all NOT NULL or filtered non-null.

**A spool load now costs ~73 s of post-processing on top of its ~12 s of parsing.** That is
not a mistake: `mv_joint`'s FABRICATED flags (M44/M48/M49) are an `EXISTS` against `spool`
embedded in the view, so loading spools changes the view's contents even though `weld` was
never touched. Skipping the refresh there would leave every FABRICATED metric reading the
previous spool export.

If the view is missing (0013 not applied yet), the helper prints a loud warning naming the
view and telling you to run `npm run db:migrate`, and the load still succeeds — the data is
correct, the pages that read that view are stale. It does not fabricate a silent success.

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


## Batch 3 — Acciona, Inco, weld length, the welder registers

Rulings R3-01 … R3-15 (`analysis/sources3/rulings.md`) are binding. Migration `0014`,
four loaders, all measured live.

| loader | source(s) | target | rows |
|---|---|---|---:|
| `load-acciona.ts` | `Acciona/Acciona_Latest Add to Query.xlsx` | `weld` (ACCIONA) | 13,313 |
| `load-inco.ts` | `Inco/Master Weld_Latest.xlsx` | `weld` (INCO) | 10,327 |
| `load-weld-length.ts` | `Weld Length/Weld Length.xlsx` + `Rework code.xlsx` | `weld_length_by_dia`, `ref_code_label`, `weld.weld_length_m` | 98 + 73 + 6.07 M updated |
| `load-welders.ts` | `Welders/SCTR NFE WELDERS APPLIED.xls` + `Welders Power Q for PBI .xlsx` | `ref_qualified_welders`, `ref_welder_qualification`, `ref_welder_status_weekly` | 6 + 5,484 + 6,096 |
| `load-ut-tracker-ccc.ts` | `UT TRACKER (CCC)_Talisman.xlsx` | `ref_ut_tracker_ccc` + the overlay | 9,419 → 61,139 CCC rows |
| `apply-ut-overlay.ts` | `ref_ut_tracker_ccc` | `weld.*_all` (6 cols) | 61,139 CCC rows |

```json
"db:load:acciona":     "node --env-file-if-exists=.env --import tsx scripts/load-acciona.ts",
"db:load:inco":        "node --env-file-if-exists=.env --import tsx scripts/load-inco.ts",
"db:load:weld-length": "node --env-file-if-exists=.env --import tsx scripts/load-weld-length.ts",
"db:load:welders":     "node --env-file-if-exists=.env --import tsx scripts/load-welders.ts"
```

Run `db:load:weld-length` **after** Acciona and Inco: it materialises `weld.weld_length_m`
across every source in one pass.

### `weld_length` carries two different units, and that is the pbix's doing

`0014` widens `weld.weld_length` and `weld.rej_length` from `numeric(5,4)` to
`numeric(12,4)`. Not cosmetic: `numeric(5,4)` maxes out at 9.9999, which fits the dump's
**metres** (0.1049…) and overflows on Inco's **millimetres** (`Length (MM)` up to 7,957,
`RT LENGTH (MM)` up to 2,500). The M files Inco's millimetres into the same column, and the
DAX's Inco branch divides by 1000 to compensate. Read `weld_length_m`, which normalises to
metres; `weld_length` itself is METRES for `WELD_DUMP`, MILLIMETRES for `INCO`, NULL for
CCC and Acciona.

Two materialised views read those columns — `mv_weekly_progress` (0011) and `mv_joint`
(0013, the **metrics lane's**) — and Postgres refuses to alter a column a view reads. Rather
than copy 0013's 400-line definition into a file this lane does not own, `0014` captures the
dependants from the catalogue with `pg_get_viewdef()` / `pg_get_indexdef()`, drops them,
alters, and rebuilds them from what the database itself holds. Nothing is retyped and the
metrics lane stays the only author of `mv_joint`. They come back `WITH NO DATA`, so the
next `refreshMatviews()` does a plain first refresh — which is exactly why that
`relispopulated` branch exists.

### `weld_length_m`, materialised — what each source gets, measured

The DAX, verbatim: Inco with a manual-UT report gets `Weld Length / 1000`; everything else
gets `LOOKUPVALUE('Weld Length'[Weld Length], [Dia inch])`, and `ISBLANK → BLANK()` — never 0.

| source | rows with a length | NULL | why |
|---|---:|---:|---|
| `WELD_DUMP` | 958,613 | 2 | two dia values are not among the 98 |
| `CCC_WELDER_RECORD` | 4,984,143 | 448,850 | `Dia inch` is `0.0`, and `0` is not one of the 98 keys (the smallest is 0.01) |
| `CCC_JOINT_RECORD` | 111,486 | 19,508 | as CCC |
| `ACCIONA` | 13,313 | 0 | all 15 of its dia values are in the table |
| `INCO` | 0 | 10,327 | **R3-06** — the Inco branch is gated on `Manual UT Report No. <> ''`, which the Inco M never fills, and the fallback lookup needs `Dia inch`, which Inco leaves empty. Reproduced literally; not substituted |

### Acciona

One row per joint, 13,313 rows over **13,312** distinct `joint_id` — see the deviation note
below. It contributes to the RT / PMI / PT metrics and the welded-joint counts and to
**nothing else**: PWHT, HT, UT, MT, weld length and spool status are all blank BY SOURCE (the
M adds them as `""`), not blank by data.

Reproduced literally, each flagged rather than tidied:

* `tracer_shot` holds `FJ-49`, not `T`. The M computes a `Tracer Shot = if [Tracer 1] <> "" then "T"` flag, deletes it, then renames the raw `Tracer 1` over the top.
* `PMI Acc/Rej` keeps 26 `ACCEPTED` rows: the M's `Accepted → A` is a case-**sensitive** `ReplaceText`.
* `repair_reweld` is `''` for every Acciona row — `Weld No.` ends `RW1`/`RS1`, so `right(joint_id,2)` is `W1`, never `RW`/`R1`/`R2`. **Acciona repairs are invisible to the repair/reweld split.**
* `rt_weld_status` emits only `S` (11,689) and `''` (1,624). Its `HS` branch tests `RT Report = null` on a column that holds `""`, and every row that has an `RT%` also has a report, so `HS` never fires.
* `original_joint` holds the literal `"Acciona"`, not a joint id. No `original_joint` logic may run on these rows.
* `joint_id` repeats the ISO number, because Acciona's `Spool No.` is often a full `31941A6-IA6594827-01-01` string: `31941A7-BR6594818AE-31941A7-BR6594818AE-03-FJ-47`. That is what the pbix stores.
* Dates are `dd-mm-yyyy` TEXT, parsed in `scripts/lib/xlsx-stream.ts::parseDmy` and **nowhere else** (R3-03) — adding it to `weld_to_date()` would make every other source mis-read `01-02-2024`.
* The M's `RemoveRowsWithErrors` would drop an unparseable `RT Date` row **silently**. The loader keeps and logs them instead; today there are 0.

`sub_contractor_tier` (R3-04) carries Acciona's `Column12`: `FOURTH DIMENSION` 8,593 /
`DEBAJ` 4,720. NULL for every other source — no other source has a tier, as opposed to
having an unknown one.

### Inco

Loaded, **not** filtered (R3-01): the default exclusion belongs in the query layer as
`sub_contractor <> 'INCO'`, where the pbix's 69 filters put it. `[Total Scope Dia "BW" "PR all"]`
includes Inco explicitly, so a loader-level exclusion would make that measure wrong.

10,327 rows over **7,238** distinct joints — joint × RT-fragment grain, so every Inco metric
must be `count(DISTINCT joint_id)`. `weldpoint_seq` is the per-joint sequence in file order
(max 23) because `mv_joint`'s WP1 gate is
`CASE source WHEN 'WELD_DUMP' THEN weldpoint_no = 1 ELSE weldpoint_seq = 1 END` and a NULL
there would drop the whole source from M23/M24/M33.

* `joint_id` carries three consecutive hyphens (`65-T9405-A---H1`): `Spool No.` is the literal `"-"`. `spool_id` is `"-"` too, so **Inco can never join `spool`**.
* The M **fabricates a UT block out of a free-text remark** — `Remarks = 'PAUT'` on 441 rows sets `by_ut`, `ut_remarks`, `ut_date`, `ut_report`, `ut_acc_rej` from the RT columns *without clearing them*, so those 441 rows count as both RT and UT. `manual_ut_report_no_all` carries the same value, because the DAX's Inco branch of `[Manual UT Report No.]` coalesces `UT Report`.
* `PT/MT Report` and `PT/MT Date` each feed **two** targets: MT and PT are identical for every Inco row.
* `RT LENGTH (MM)` is the **inspected** length and the M files it under `rej_length`.
* `PWHT Report` / `PWHT Date` are 100 % empty, so the PWHT pages stay GAC/TEK/MED/CCC-only.
* `repair_reweld` is `''`: `Repair & Reweld "PR all"` opens with `[Sub-Contractor] <> "Inco"`, a DAX exclusion, not a filter-layer one.

### The welder registers

`SCTR NFE WELDERS APPLIED.xls` is **BIFF8**, which `exceljs` cannot read at all — handed an
`.xls` it looks for a zip central directory and throws. It is converted **at load time**
through `uv run scripts/py/xls_to_csv.py` (R3-11); a checked-in conversion would go stale
silently the next time the analyst re-downloads the workbook. The loader resolves `uv` from
`UV_BIN`, `~/.local/bin`, `/usr/local/bin`, `/usr/bin` and `command -v`, and fails loudly
with all of them named rather than loading a partial register.

**The stored Power Query for that sheet is stale and would ERROR on refresh** (R3-09). A
column has been inserted at the left since it was written, so
`RenameColumns({{"Column2","SUB CONTRACTOR"}})` targets a name that no longer exists — and
`Table.RenameColumns` raises on a missing column. Its two `RemoveLastN` steps would also cut
5 live rows; the pbix's stored 16 are reproduced by the final `TOTAL` filter alone. The
loader is therefore built **positionally against the file**, taking the party name from
column 3 with fill-down and dropping the `TOTAL` row. M90 = **3,816** (CCC 2,045, TEKFEN 773,
GAC 611, INCO 239, MEDGULF 121, ACCIONA 27) — the two CCC rows and the two TEKFEN rows are
summed at load, which is what the DAX does under its party filter.

`ref_qualified_welders.as_of` is the **file mtime** (2026-08-23), not a reporting date: the
sheet carries no date anywhere. `source_note` says so on every row, so a widget can show
provenance honestly instead of implying a reporting week.

`ref_welder_status_weekly` unpivots `CUM WEEK # Status`: 1,016 source rows × 6 parties =
**6,096** rows, 127 weeks × 8 categories × 6 parties. Deliberately not eight new
`weld_weekly_snapshot` metric ids (R3-13) — they are a category breakdown of one population,
and putting them in the snapshot table would make `sum(value)` over metrics meaningless. The
current-week sheet (`WEEK #   STATUS`, 8 rows) uses different category strings, so the pbix
relationship between the two matches on almost nothing; treat them as independent.

### `ref_code_label` is not a pbix reproduction

`Rework code.xlsx` is read by **no** Power Query and feeds no measure. It is loaded as
display labels only, never a join key, never a filter, and never a source of truth about
which codes exist — the fact tables are. 73 rows: `rework_code` 32, `defect_code` 18,
`nde_status` 9, `weld_type` 14.


### `repair_length_mm` — the last input M34's Inco branch needed

`[UT Defect Length by Joint "PR all"]` (M34) sums `[Defect Length(MM).]`, whose first branch
is `Inco && [Manual UT Report No.] <> "" -> [Repair Length (mm)] / 1000`. That branch was
blocked from batch 3 to migration 0019: `Repair Length (mm)` is column 27 of the Inco sheet
and had no `weld` column, so `0019_ut_weld_length_no_inco.sql` leaves it **NULL — never 0**,
and counts the affected rows in `mv_joint.ut_defect_inco_gap_rows` so the page can say the
measure is incomplete. Migration `0020` adds the column and `load-inco.ts` fills it.

* **MILLIMETRES**, as the source column's name says and as `weld.weld_length` already is for
  Inco. The DAX divides by 1000 at READ time, so the loader stores the source's value
  unchanged.
* **NULL for every other source** — none carries a repair length. That is absence. `0` is a
  different thing and means a recorded zero, which is what 10,219 of the 10,327 Inco rows say.
* **Not** `defect_length_mm` (0012), which is the materialised DAX result across all four
  branches. This is a raw source column feeding it.

Measured live: **108 rows** carry a value greater than zero, totalling **3,562.002 mm** over
**40 distinct** non-zero values. Of those, **57 rows (2,497.002 mm)** are also gap-eligible —
they have a UT report and `UT Acc/Rej = 'R'` — against `ut_defect_inco_gap_rows` = 74, so the
metrics lane can now unblock that branch and see 57 of the 74 gap rows resolve. The remaining
17 genuinely have no repair length recorded.

### `weldpoint_seq` — the WP1 flag, on every source

`WeldPoint No.1 WP1` in the pbix is
`COUNTROWS(rows of the same Joint ID with a smaller Index) + 1`, computed for **every**
source, and `UT Weld Length by Joint "PR all"` filters on it — so a source whose
`weldpoint_seq` is NULL drops out of that measure entirely and silently. Every loader that
writes to `weld` must set it; `check-sql-columns.ts` fails if one stops.

Three mechanisms, one requirement:

| loader | how | why that one |
|---|---|---|
| `load-weld-dump.ts` | `UPDATE … row_number() OVER (PARTITION BY joint_id ORDER BY id)` after the INSERT | it goes through a staging table, so there is no JS pass to count in. `weld.id` is assigned in COPY order = file order = the pbix's `Index` |
| `load-ccc-welder-record.ts`, `load-inco.ts` | counted in the stream, in the COPY list | rows are built in JS in file order, so a per-joint counter is free and saves a rewrite of 5.4 M rows |
| `load-acciona.ts` | constant `1` in the COPY list | one row per joint by construction |
| `load-ccc-joint-record.ts` | `UPDATE … SET weldpoint_seq = 1` | the NOT-WELDED slice is one row per joint |

Do not confuse it with `weldpoint_no`, the **sourced** `WeldPoint No.` column: that one carries
values up to 2,180 and is the repair/attempt number the source system recorded.
`weldpoint_seq` is our own row-number within a joint. Measured on the dump after the load
filters: max **15**, and `count(*) WHERE weldpoint_seq = 1` equals `count(DISTINCT joint_id)`
exactly (900,335) — the invariant that proves the partition is right.

### The CCC UT overlay — `ref_ut_tracker_ccc` into the six `*_all` columns

CCC's welder record has **no UT columns at all**: `ut_report`, `ut_acc_rej`, `ut_date` and
`ut_operator_id` are NULL on all 5,432,993 rows. The pbix gets CCC's UT from
`UT TRACKER (CCC)_Talisman` through DAX **calculated columns**, not through the union — so
the overlay cannot happen at COPY time, and it is an `UPDATE` in
`scripts/lib/ut-overlay.ts` that either loader runs.

| `weld` column | source | DAX it reproduces |
|---|---|---|
| `ut_report_all` | tracker `UT1 REP NO` | `UT Report "PR All"`, CCC branch |
| `ut_date_all` | tracker `UT1 DATE` | `UT Date "PR All"`, CCC branch |
| `manual_ut_report_no_all` | tracker `UT1 REP NO` | `Manual UT Report No.` |
| `manual_ut_date_all` | tracker `UT1 DATE` | `Manual UT Date.` |
| `manual_ut_status_all` | tracker `UT1 RESULT` | `Manual UT Status.`, CCC branch |
| `ut_operator_id_all` | tracker `UT OPE1`, **only where `rt_ut = 'UT'`** | `UT Operator ID.` — the DAX gates that one on `[RT/UT] = "UT"` inside its `CALCULATE`, and no other |

The tracker's other 18 columns are not overlay sources: `QCISO NO` / `JOINT NO` / `SPOOL NO`
build the key, `WELDDEFECTLENGTH` feeds `defect_length_mm` (already wired in
`lib/metrics/ut.ts`), and the rest (`SIZE`, `Wall Thickness`, `SERVICE CLASS`, `WELD TYPE`,
`AREA`, `WELD DATE`, the four `WELDER ID`s, `WPS CODE`, `UT OPE2`, `TPI Date`,
`TPI Report No`, `PWHT DATE`, `PWHT REP NO`) duplicate columns `weld` already sources, or
have no DAX consumer.

**Key**: `ref_ut_tracker_ccc.joint_id` = `QCISO NO ‖ '-' ‖ SPOOL NO ‖ '-' ‖ JOINT NO`, the
same recipe CCC's own `joint_id` uses, so it is a plain equality join. 9,412 of the tracker's
9,419 joints match a CCC row.

**Multiple tracker rows per joint**: `LOOKUPVALUE` returns BLANK when a key matches rows with
different values. `joint_id` is unique in the tracker today (9,419 distinct over 9,419 rows),
so it never bites; the overlay still aggregates with `max()` and **counts** multi-row joints
rather than picking one silently. Today that count is 0.

For CCC every DAX branch collapses to a plain lookup, because the row-level fallbacks are all
NULL for CCC — `UT Report`, `UT Date`, `Manual UT Date` and `Manual UT Status` are never
populated, so the first `IF` never fires and the `MAXX` over a joint has one distinct value.

**Scope is `sub_contractor = 'CCC'`, exactly as the DAX gates it.** `WELD_DUMP` rows are left
untouched: GAC's and TEKFEN's trackers are still absent (R-05), so their overlays stay
honestly NULL rather than being filled from nothing. INCO's 441 PAUT rows keep what its own
loader wrote from the DAX's Inco branch.


> **`Manual UT Status.` — the CCC precedence branch is declared but DEAD, verified.**
> `analysis/pbix/raw/prall-columns.json` shows a `VAR UTTrackerCCCID` on that column
> that would make the row's own `RT Acc/Rej` (matched by Joint ID + Welder ID, gated
> on `RT/UT = "UT"`) win over the tracker's `UT1 RESULT`. It is never evaluated:
> `UTTrackerCCCID` occurs **exactly once** in that column's DAX — its own
> declaration — and the `RETURN` chain is `GAC → TEKFEN → INCO →` an **inline**
> `LOOKUPVALUE(tracker[UT1 RESULT], tracker[Joint ID], [Joint ID])`. DAX evaluates
> VARs lazily, so an unreferenced VAR cannot affect the stored column.
>
> The contrast is the proof: on `UT Operator ID.`, `Manual UT Report No.` and
> `Manual UT Date.` the same variable occurs **three** times each (declaration plus
> two uses in the `RETURN`), and their gates ARE live — which is why
> `ut_operator_id_all` carries the `rt_ut = 'UT'` gate and the other two do not.
>
> So `manual_ut_status_all` is tracker-only, deliberately. Applying the dead branch
> would move 86 of the 61,155 CCC `rt_ut='UT'` rows away from what the pbix stores
> (70 where the tracker says `R` and the row says `A`, 16 whose joint is one of the
> 7 not in the tracker). Shipped values: `A` 60,935 / `R` 204 rows = 9,382 / 30
> distinct joints, which is the tracker's own `A` 9,389 / `R` 30 over the 9,412
> matched joints.
>
> `Manual UT Report No.` and `Manual UT Date.` were checked rather than assumed
> symmetric: their CCC variable is `MAXX(joint rows, [UT Report "PR All"])` with
> both arms of its inner `IF` identical, i.e. a plain tracker lookup with no
> row-level first branch. No change needed there either.

Measured live: **61,139** CCC rows over 9,412 distinct joints; `ut_operator_id_all` lands on
61,047 of them, the 92-row gap being the `rt_ut = 'UT'` gate plus the 11 tracker rows with no
operator. `manual_ut_status_all` is `A` 60,935 / `R` 204.

**Both** of the overlay's inputs have their own loader, so both re-apply it:
`load-ccc-welder-record.ts` after its COPY and `load-ut-tracker-ccc.ts` after its COMMIT.
A tracker reload would otherwise leave `weld.*_all` holding the previous tracker's values.
`scripts/apply-ut-overlay.ts` runs it standalone (with `--dry-run`) for anything else — a
manual re-apply, or a check that the two are in step. The call is two lines:

```ts
import { applyCccUtOverlay, formatUtOverlay } from "./lib/ut-overlay";
console.log(`  ${formatUtOverlay(await applyCccUtOverlay(client))}`);
```


## The flange register (migration 0015, loader `load-flange.ts`)

A **different fact from `weld`** and deliberately a separate table (RF-06): the grain is a
flanged joint, not a weld; the two never join; nothing in `lib/metrics/*` should union them.

| loader | source(s) | target | rows |
|---|---|---|---:|
| `load-flange.ts` | `Flange Progress.xlsx` + `ovAssets_1619.xlsx` | `flange` | 136,741 + 226,504 |

```json
"db:load:flange": "node --env-file-if-exists=.env --import tsx scripts/load-flange.ts"
```

**Grain: one register LINE.** 363,245 rows over **357,787** distinct `joint_id` — 5,458 joints
are listed twice. **Every joint metric is `count(DISTINCT joint_id)`, never `count(*)`.**

**The union is an APPEND, not a join.** The pbix's `Flange Progress` is
`Table.Combine({Flange Progress.xlsx, Flange ovAssets_1619})` and the two files share **zero**
joint ids (measured, and re-checked in SQL after every load), so `source` partitions the table
cleanly: GAC/TEKFEN/MEDGULF on one side, CCC on the other.

### The measure contract

| mockup label | SQL |
|---|---|
| Total | `count(DISTINCT joint_id)` |
| Inspected / Jointed | `… WHERE joint_date IS NOT NULL` |
| Remains | `… WHERE joint_date IS NULL` |
| Const-n ("CCC no cat") | `joint_date IS NOT NULL AND pcc_tightening_date IS NULL AND (sub_contractor = 'CCC' OR cat IN ('X','Y'))` |
| PCC ("CCC no cat") | `pcc_tightening_date IS NOT NULL OR (joint_date IS NOT NULL AND sub_contractor <> 'CCC' AND cat IN ('Z','A','B'))` |
| Leaked | `upper(reason_for_de_tightening) = 'FLANGE LEAKAGE'` |

Use the **"CCC no cat"** pair, not the plain `Cat. IN {X,Y}` trio (RF-07): `Cat.` is only 75.3 %
filled on the CCC side, so the plain trio zeroes CCC.

`upper()` on the leak test is load-bearing. The ovAssets side stores `Flange Leakage`, and the
M's two `ReplaceText` steps (`"Flange leaking"`, `"Flange leakage"`) are case-**sensitive** and
miss it — but DAX string equality is case-insensitive, so the pbix counts those 119 rows. The
loader reproduces the M literally; the metric must compare case-insensitively.

### HA

`HA1..HA4` or NULL — never a guessed bucket. Flange Progress side: the DAX rule
`MID([System], 2, 1)`. CCC side: parsed from ovAssets `[Process Plant]` (RF-03), which agrees
with the DAX rule on 226,438 of 226,504 rows with **zero** disagreements. `ref_ha` exists and is
**empty by design**: `l0_abs_guide_202502191028.csv` (912 rows) is the DAX fallback and is
absent, which is why **6,593 joint ids (1.84 %)** have no HA. They belong in a visible
"(blank)" row, never folded into HA1.

### Loader notes

* **Header detection, not `Table.Skip(5)`.** The M skips five rows on `FlangeJointProgress`; the
  streaming reader drops all-blank rows, so a positional skip would silently shift by one — and
  it would have: the header lands at index **4**, not 5. The loader finds the row carrying both
  `Iso Number` and `BT No.` and reports which row that was, so a layout change is visible.
* **ovAssets headers carry embedded newlines** (`PCC Remarks -\n Field045 (Custom)`), so every
  header is whitespace-collapsed before matching.
* **`FL - Tightening Method`, not the plain `Tightening Method`.** Both exist; only the FL one
  reproduces the pinned method split (Manual 249,155 / Torquing 103,713 / Tensioning 2,913 /
  TBN 2,006). Using the other would be silently wrong by ~1,000 joints.
* **Four date shapes, not three.** `15-Feb-2026`, `2025/10/28` and `2026/8/20` all pass through
  the shared `parseDate()`. The fourth is ovAssets-only `m/d/yyyy` with an optional time, 720
  values — and month-first is **measured, not assumed**: across them the first component never
  exceeds 12 while the second reaches 30. It is parsed in the flange loader only; the shared
  `weld_to_date()` is not widened with an ambiguous format (the R3-03 discipline).
* **RF-05: dirty rows are KEPT and counted** in the ledger notes — one `TBD` sub-contractor, one
  2027 joint date. The pbix does not filter them either.
* **RF-09: no materialised view.** Measured after the load: `GROUP BY sub_contractor` with
  `count(DISTINCT joint_id)` runs in **481 ms** at 363k rows — just under the 500 ms threshold,
  so it stays live for now and is the number to re-measure when the page is built.


## The WPQ RECORD REGISTER (migration 0022, loader `load-wps-register.ts`)

Four reference tables, 745 rows, from three of the five delivered files. Nothing lands in
`weld`, so there is no matview to refresh. Rulings R4-01 … R4-08 are binding.

| loader | source(s) | target | rows |
|---|---|---|---:|
| `load-wps-register.ts` | `WPQ RECORD REGISTER.xlsx` (2 sheets), `CUM WPS Status.xlsx`, `WPS PWHT Status.xlsx` | `ref_wps_register`, `ref_wps_process`, `ref_wps_status_cum`, `ref_wps_pwht_status` | 318 + 266 + 254 + 34 |

```json
"db:load:wps": "node --env-file-if-exists=.env --import tsx scripts/load-wps-register.ts"
```

### The one number that moves: M91 = 318

`WPS Approved` is `count(DISTINCT wps_no)` over `ref_wps_register` where
`document_status = 'WPS APPROVED BY CTJV/ CPY'`. All 318 rows carry that status and all 318
`wps_no` are distinct, so the filter is a **no-op today** — kept anyway, as the DAX has it.
The mockup's 294 is the same series' 2025-10 → 2026-03 plateau: `ref_wps_status_cum` reads
318 for `WPS_APPROVED` at 2026-08-28 and 294 across that earlier window. The pbix snapshot is
older, not wrong. `ref_wps_register.as_of` is the **file mtime** (2026-08-04) — the sheet
carries no date — and says so in `notes`, as `ref_qualified_welders` does.

### Never join `ref_wps_register` to `weld.wps_no` (R4-03)

It holds **document** numbers (`383-TEK-…`, `WPS-638-…`); `weld` holds **site** numbers
(`TEK-…`, `MED-WPS-638-…`). They coincide on about 61 % by accident of prefix, and the pbix
does not join them either. The warning is in the table's `COMMENT` and pinned by
`check-sql-columns.ts`.

**`ref_wps_process` is the WPS join table**, and its `wps_no` is stored `btrim`+`upper`
normalised so the join needs no function. Coverage re-measured on every load, at **joint
grain** (`mv_joint`), in both scopes — reproducing `analysis/sources4/mapping.md` §6 exactly:

```
ALL sources          2,208,057 / 2,215,305  (99.67%)
in scope (<> INCO)   2,208,057 / 2,208,067  (100.00%)
```
Joint grain matters: `SELECT DISTINCT joint_id, wps_no FROM weld` counts (joint, WPS) **pairs**
and inflates the denominator by 101. INCO is the whole 0.33 % — none of its 23 WPS values is
in the register, which is why "in scope" excludes it.

### Read by header NAME — two of the four stored M queries would fail

* `CONSOLIDATED` has gained a blank left column, so every auto-named blank column shifted by
  one and the M's `RemoveColumns({"Column13".."Column18"})` names fields that no longer
  exist — `Table.RemoveColumns` raises.
* the `.xls` register's only sheet is `WPS Reg.`, while the M asks for `WPS Reg#`;
  `Excel.Workbook` returns no row for that key and the step raises.

Same staleness class as R3-09 (the welders `.xls`). The loader finds each header row **by the
names on it** and indexes columns by name, accepting both the delivered spelling and a
whitespace-collapsed form — `CONSOLIDATED` carries `' DOCUMENT STATUS'` with a leading space,
`'PWHT '` with a trailing one and `'PQR \nNo/Rev.'` with an embedded newline. It **asserts
then aborts** on any row-count miss: these are tiny tables whose counts are the point, and a
partial register would quietly break M91.

### Deliberately not loaded

* `WPS-WPQT Record Register Rev_0 24-01-25.xls` (R4-04) — Rev. 0 of Jan-2025, a different
  `DocumentStatus` vocabulary, backing one hidden pbix page. This loader therefore has **no**
  `uv`/`xlrd` path at all, unlike `load-welders.ts`.
* `WPS (Welding Process).csv` (R4-07) — a flat export of the `WELDING PROCESS` sheet; the
  sheet is canonical (the R3-14 precedent). The csv adds an unnamed 6th column (a GAC
  document-number alias on 8 rows) and two space-spelled `Welding process` values.

`ref_wps_status_cum` is `(week_end_date, metric, value)` — the **long** shape per R4-06, not
the wide sketch in mapping.md §4 — 127 weeks × `WPS_SUBMITTED`/`WPS_APPROVED` = 254 rows,
**UPSERTed and never cleared**, the same discipline `weld_weekly_snapshot` has. It is
deliberately its own table rather than new `weld_weekly_snapshot` metric ids (R3-13; the
`ref_mpi_done` double-write is the exception that predates that ruling).

`ref_wps_pwht_status` is **documentation only** (R4-08): no measure reads it, and it must not
override `weld.pwht_y_n` or `PWHT_AMBIGUOUS_TOKEN` (ruling R-04) without a separate ruling.
Three of its 34 keys — `CS/LTCS-AUT-003`, `-009`, `-010` — have no `ref_wps_process` row, so
the pbix's "1:1" edge is aspirational and there is no FK here either.

The `Sn.` / `S.N` columns are **provenance only**. The pbix's three 1:1 edges from them into
`Flg CCC_Flange Repair[SN]` are row-number-to-row-number auto-detections and are never
reproduced (R4-05).

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
