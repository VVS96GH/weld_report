# Welding Statistics Dashboard

A Next.js 16 + Postgres 17 rebuild of the Power BI report *"ALL SUBCON CCC / GAC / Tekfen /
Medgulf (EP DATA) — Weld Progress (Full Scope)"*: 44 report pages (welding progress, NDE
status by RT coverage, PWHT backlog, rejection detail per WPS) reproduced from the raw weld
exports with every formula traced to the DAX measure it came from, and rendered in the
T.EN design system.

Repository: `anatoly/welding_report` on [git.mantalis.qa](https://git.mantalis.qa/anatoly/welding_report)
(private; see [docs/ci.md](docs/ci.md) for the remote and CI conventions).

## Quick start

```bash
npm ci                                   # Node 24
cp .env.example .env                     # DATABASE_URL, WELD_DUMP_PATH, PAGE_SOURCE
npm run db:up && npm run db:migrate      # Postgres 17 in Docker + all migrations
npm run db:load                          # sources/Weld Dump.txt -> weld (~2.5 min, 958,615 rows)
npm run db:seed:snapshot                 # weekly trend workbooks -> weld_weekly_snapshot
npm run db:load:spool                    # Spool Dump.txt + Spool.csv -> spool
npm run db:load:ccc-joints && npm run db:load:ccc   # CCC joint + welder records (~7 min)
npm run db:load:ut-ccc && npm run db:load:exclusions # CCC UT tracker (+ overlay), exclusion list
npm run db:load:acciona && npm run db:load:inco      # Acciona / Inco workbooks
npm run db:load:weld-length && npm run db:load:welders   # dia->length lookup, welder registers
npm run db:load:wps                      # WPQ RECORD REGISTER -> ref_wps_* (WPS Approved = 318)
npm run db:load:flange                   # Flange Progress.xlsx + ovAssets_1619.xlsx -> flange (~30 s)
npm run db:load:ha-guide                 # l0_abs_guide.csv (+ HA.csv) -> ref_ha_guide / ref_ha_area (HA column, HA>Area slicer)
npm run db:load:talisman                 # Joint.csv (TALISMAN DATA) -> ref_talisman_joint (~20 s)
npm run dev                              # http://localhost:3000/welding/1  (45 pages; page 2 = RT Backlog Forecast)  |  /report/overview  |  /flange
npm run export:pdf                       # the whole report as one PDF (server running; PLAYWRIGHT_BROWSERS_PATH as for e2e)
```

**Everyday run (no terminal needed).** `scripts/serve.sh` brings the database up, makes a
production build when the code has moved, warms the read cache and runs `next start` on
:3000. On the owner's machine it is the systemd user unit `weld-report` (lingering, so it
starts with the WSL distro) and a hidden Startup script on the Windows side boots the distro
at logon: `systemctl --user status|restart weld-report`, logs with
`journalctl --user -u weld-report -f`. Stop it (`systemctl --user stop weld-report`) before
`npm run dev` — both want port 3000. Read statements are memoised in process
(`lib/db.ts`, invalidated by a new load or migration; `QUERY_CACHE=off` disables it).

Without a database, `PAGE_SOURCE=fixture npm run dev` serves the mockup snapshot
(16‑Jan‑2026) through the same components.

`sources/` is git‑ignored: it holds the client's raw exports (weld dump, CCC Talisman
exports, spool dumps, trend workbooks, the original `.pbix`). Ask the report owner for
them; the list of files each page needs is in `analysis/calculation-logic.md` §5 / §7.

## What is where

| Path | Contents |
|---|---|
| `analysis/` | The recon that drives everything: `pbix/` (448 DAX measures, 62 Power Query scripts, 145 report pages → visuals, extracted from the `.pbix`), `dump/` and `sources2/` (column profiles of every source file), `mockups/` (machine‑readable spec of the HTML mockups), **`calculation-logic.md`** (172 mockup metrics → DAX → SQL, the 44‑page build sheet, rulings R‑01…R‑12 and the batch‑2 corrections §7) |
| `db/` | Migrations (`0001`–`0039`) and `db/README.md` — the column‑name contract, null/date rules, the DAX‑derived columns, indexes, loaders |
| `scripts/` | Streaming loaders (`load-weld-dump.ts`, `load-ccc-*.ts`, `load-spool-dump.ts`), workbook seeders, `migrate.ts`, the offline schema checker `check-sql-columns.ts`, `token-lint.mjs` |
| `lib/metrics/` | Parameterised SQL, one function per DAX measure family (`M##` ids cited in every doc comment); `lib/pages/welding.ts` assembles the 44 `PageModel`s (page 1 with its five slicers), `lib/pages/flange.ts` the filter-driven flange page, `lib/pages/forecast.ts` the RT Backlog Forecast page (pbix page 20), `lib/screens.ts` the option-A regrouping of the 44 pages into 7 filter-driven screens |
| `app/` | App Router: `/welding/[page]` (page 1 takes `?ha=&area=&subco=&wtype=&wcat=`), `/flange` (`?ha=&subco=&method=`), `/welding/2` = RT Backlog Forecast (`?ha=&area=&subco=&byut=&wcat=&rt=&dia=`; `/forecast` redirects there), `/report/<screen>` (option A: overview / status / subco / nde / pwht / wps with `?subco=&rt=`; `subco=ALL`, the default, renders the party page's structure over the project scope — INCO excluded, never a sum of the party pages; `rt=ALL`, the default on nde / pwht, renders the RT 100 % page with no RT % predicate; nde / pwht also take `sclass=` and `pwht=`; `/report/demo` shows four widget forms — sparkline KPIs, a backlog waterfall, an aging heatmap, a WPS Pareto — over the project scope; `/report/demo2` a burn-down with projection, an HA readiness matrix, NDE lead-time small multiples and auto-written highlights), `/api/welding/[page]`, `/api/flange`, `/api/forecast`, `/api/health`; `app/styles/tokens.css` (T.EN tokens) and `app/globals.css` |
| `components/` | `ReportShell`, `PageView`, widgets (KPI / DataTable / ChartCard / TextNote), theme + mood + density controls |
| `docs/` | `ten-design-system.md` (the design spec, verbatim), `brand-README.md`, `ci.md` |
| `tests/`, `e2e/` | vitest (structure tests without a DB; metric pins against the loaded DB), Playwright layout/navigation matrix |
| `mockups/` | The two static HTML dashboards the app reproduces |

## Verification

```bash
npm run typecheck && npm run lint && npm run lint:tokens
node --import tsx scripts/check-sql-columns.ts   # every column the loaders/views name exists
npm test                                          # vitest: DB suites run live when the DB is loaded, else skip
npm run test:e2e                                  # Playwright, against a running server (see e2e/README.md)
```

`tests/metrics.test.ts` pins every number in `analysis/reconcile_results.json`, which is
computed independently by `uv run analysis/reconcile_check.py` over the raw dump — the SQL
must reproduce it exactly (358 assertions).

## Design principles that shape the code

- **Honest absence.** A metric whose source is not loaded renders "—" plus a note naming the
  missing file; never a fabricated zero. Every page carries its data provenance
  (`meta.as_of`, the `load` ledger).
- **Faithful to the report, not to its bugs' names.** The Power BI quirks that change the
  numbers are reproduced and documented (`PWHT Y/N = '25.01'` counted as both Y and N,
  literal `NA` kept as text, weld‑pass grain for CCC, fractional film counts); the ones
  that do not are dropped with a ruling.
- **Reproducible dates.** Every DAX `TODAY()` is an `as_of` parameter defaulting to the
  load's `max(weld_date)`.
- **One theme system, several looks.** `data-mood="ten"` (default) carries the T.EN design
  system; the five mockup moods remain selectable; `data-theme` dark/light and
  `data-density` are independent axes.

## Python

Only through `uv`: `uv run analysis/<script>.py`; `uv add <pkg>` for a dependency.
