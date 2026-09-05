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
