# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # next dev  → http://localhost:3000
npm run build    # next build
npm run start    # serve the production build
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
npx eslint app/page.tsx        # lint a single file
npx tsc --noEmit               # typecheck only (tsconfig has noEmit)
```

npm test                       # vitest (integration tests need DATABASE_URL reachable)
npm run db:up / db:migrate / db:load   # Postgres 17 in Docker, migrations, load sources/Weld Dump.txt

**Python: `uv` only.** Analysis scripts under `analysis/` are stdlib-only and run with
`uv run analysis/<script>.py` (root `pyproject.toml`, no deps). Never call `python3`/`pip`
directly or hand-build venvs; a dependency is added with `uv add`. `uv` is at `~/.local/bin`.

`next dev` rewrites the `nextjs-agent-rules` block in `AGENTS.md`; commit that regenerated block with your work rather than reverting it.

## What this project is

A Next.js rebuild of a Power BI weld-progress report for a pipeline/plant construction
project (subcontractors CCC / GAC / Tekfen / Medgulf). The repo holds:

- `analysis/` — the recon that drives everything: `pbix/` (448 DAX measures, 62 Power Query
  scripts, 145 report pages → visuals, extracted from the .pbix), `dump/` (profile of every
  column of the weld dump), `mockups/` (machine-readable spec of every widget in the HTML
  mockups), and **`calculation-logic.md`** — 172 mockup metrics traced to their DAX and
  translated to SQL, a 44-page build sheet, and the rulings R-01…R-12. Read it before
  changing any formula.
- `mockups/` — the two static HTML dashboards that define what the app must reproduce.
- `sources/` — the raw weld dump and the original `.pbix` (git-ignored).
- `db/`, `scripts/`, `lib/`, `app/`, `components/`, `tests/` — the working app (see
  "Backend architecture" below).

Current scope: all six weld sources are loaded (Weld Dump for GAC/TEKFEN/MEDGULF, CCC welder +
joint records, Acciona, Inco — INCO excluded from project scope at the query layer). Still
missing: UT TRACKER (GAC)/(TEK), WPQ RECORD REGISTER (honest-empty KPIs) and the flange repair
logs; the flange dashboard is built (`/flange`, table `flange`, `analysis/flange/` rulings RF-01..RF-09)
with its three repair widgets honest-empty until the repair logs arrive.

## The mockups (design contract)

`mockups/welding-dashboard 1.html` (~360 KB) — 44 `.page-section` pages, one visible at a
time, driven by `currentPage` / `pageTitles` / `totalPages` with prev/next buttons and a
`<select>` jump. Page groups: project-level welding progress → per-subcontractor welding
status → NDE status split by RT coverage percentage (100/30/20/10/5 %) with the matching
PWHT status page after each → weld rejection detail per WPS.

`mockups/flange-dashboard 1.html` (~100 KB) — single page, filter-driven
(`filterHA`, `filterSubco`, `filterMethod`): flange inspection progress, leak timeline,
repaired vs to-be-repaired, site vs vendor repair.

Both share one design system worth preserving when porting:

- `data-theme` on `<html>`: `dark` (default) / `light`.
- `data-mood` on `<html>`: `powerbi`, `pastel`, `ocean`, `desert`, `upsidedown`. Each mood is
  a CSS-variable block (`--bg-*`, `--color-1..8`) **and** a JS entry in `palettes` giving
  `colors[]`, `primary`, `secondary`, icon and label. Charts read colors through
  `getColors()` / `getPrimary()` / `getSecondary()` and are destroyed and rebuilt
  (`rebuildCharts()`) on a mood switch.
- Charts are Chart.js (plus `chartjs-plugin-datalabels`) loaded from a CDN, with **all values
  hardcoded** into the chart configs and HTML tables — the mockups are static snapshots, not
  live queries. Porting means replacing those constants with values computed from the dump,
  and adding Chart.js as a real dependency.

## The data (`sources/`)

`Weld Dump.txt` — **~630 MB, 1,002,373 lines, 226 columns, semicolon-delimited**, header on
line 1. Never open it whole with a read tool; sample and aggregate with `head`, `sed -n`,
`awk -F';'`, or a streaming script.

One row = one weld. Key identity/scope columns: `ISO Number`, `Spool No.`, `Weld No.`,
`Weld Cat`, `Weld Type`, `Dia inch`, `Thickness`, `PDS Area`, `System no`, `Testpack No`,
`Sub-Contractor` (the four in the mockups: CCC, GAC, Tekfen, Medgulf), `WPS No.`, `Welder`,
`Weld Date`, `Fitup Date`, `Golden Weld`, `Rework Code`.

The bulk of the 226 columns is one **repeating block per inspection/treatment method** —
`PWHT`, `HT`, `RT`, `UT`, `MT`, `PMI`, `PT`, `FN`, `PADLT`, `ORIF` — each with the same shape:

```
<M>%            coverage percentage (RT 100/30/20/10/5 drives the mockup's page split)
<M> Batch No, <M> Batch Status, <M> Weld Status
<M> Selected Date / By, <M> Exam Req date / No / By
<M> Date, <M> Report, <M> Acc/Rej          ← acceptance drives rejection rates
<M> Client Exam Req Y/N, <M> Remarks
```

RT additionally carries film counts, defect code/location and re-shoot columns; `Weld Length`
and `Rej Length` back the rejection-percentage figures. Write extraction code against this
block pattern rather than against individual column names.

`1. ALL SUBCON ... (EP DATA) - Weld Progress +( Full Scope ).pbix` — ~1 GB Power BI file, the
original report. Reference only; it is not readable as text.

## Stack notes (Next.js 16 / React 19 / Tailwind 4)

- App Router only, TypeScript strict, `@/*` → repo root.
- Layout/page props come from the **generated global types** in `.next/types/routes.d.ts` —
  e.g. `export default function RootLayout({ children }: LayoutProps<"/">)`. Don't hand-write
  a props interface; these regenerate on `next dev`/`next build`.
- Tailwind v4 with no `tailwind.config`: configuration lives in `app/globals.css` via
  `@import "tailwindcss"` and the `@theme inline` block, and PostCSS is wired through
  `@tailwindcss/postcss`.
- The APIs in this Next.js version differ from older training data — read
  `node_modules/next/dist/docs/` before writing framework code (see `AGENTS.md`).

## Backend architecture (built 2026-09-05)

```
sources/Weld Dump.txt ─(scripts/load-weld-dump.ts)─▶ stg_weld_dump (223 text) ─▶ weld (typed, 958,615 rows)
                                                                                    │
lib/metrics/*.ts  (parameterised SQL, one function per DAX measure M##) ◀───────────┘
lib/pages/welding.ts  getWeldingPage(1..44) → PageModel (lib/page-model.ts, frozen contract)
app/api/welding/[page]  JSON        app/welding/[page]  server-rendered via lib/page-source.ts
components/*            widgets (KPI / DataTable / ChartCard) + ReportShell (theme + 5 moods)
```

- `lib/page-source.ts` picks `PAGE_SOURCE=database` (default in `.env`) or `fixture`
  (the mockup snapshot in `analysis/mockups/welding-spec.json`) — same components either way.
- Every DAX `TODAY()` is an `as_of` parameter (`?as_of=YYYY-MM-DD`, default `max(weld_date)`
  of the current load) so pages are reproducible. `lib/db.ts` documents it.
- Pages whose sources are not in `sources/` (CCC, Acciona/Inco, UT trackers, spool dump,
  weekly trend workbooks, manual registers) render honest-empty with a `text` provenance
  widget — never a fabricated zero. `analysis/calculation-logic.md` §5 lists the 14 missing
  files and the 12 rulings (R-01…R-12) the code implements.
- Tests: `tests/metrics.test.ts` pins every number in `analysis/reconcile_results.json`
  (computed independently by `uv run analysis/reconcile_check.py`) and runs live when the DB
  is loaded; `tests/pages.test.ts` checks all 44 pages against the mockup spec without a DB.

## Database
Postgres 17 in Docker (`docker-compose.yml`, volume `weld_pgdata`). `npm run db:up && npm run
db:migrate` then the loaders in order: `db:load` (Weld Dump → `weld`, 958,615 rows),
`db:seed:snapshot` / `db:load:ut-ccc` / `db:load:exclusions` (workbooks), `db:load:spool`
(two spool masters), `db:load:ccc-joints` then `db:load:ccc` (CCC Talisman exports, 5.43 M
rows, ~7 min), `db:load:ut-ccc` (tracker + the CCC UT overlay), `db:load:acciona`,
`db:load:inco`, `db:load:weld-length`, `db:load:welders`, `db:load:flange` (a separate
`flange` fact at flanged-joint grain — never joined to `weld`). `weld` holds every source at weld-pass grain with a `source` enum; metrics
read the joint-grain materialised views `mv_joint` / `mv_joint_wps` (migration 0013),
refreshed by the loaders — never `count(*)` over `weld` for a joint metric.
Column names are `analysis/dump/profile.md` §8.1 verbatim — the contract between the DB and
metrics layers; `db/migrations/0002`/`0003` are GENERATED by `scripts/gen-schema-columns.ts`,
never hand-edited. Only blank text is stored NULL; literal `NA`/`N/A`/`?` stay as text because
the pbix keeps them (migration 0007), so DAX `<> "RS"` ports to `IS DISTINCT FROM 'RS'` (see
`db/README.md`). `scripts/check-sql-columns.ts` validates the EFFECTIVE schema (it replays
the migration log); run it after touching any migration. Batch-2 rulings (grain, fractional
films, literal tokens, exclusions) are in `analysis/sources2/rulings.md`.
`PWHT_AMBIGUOUS_TOKEN` ('25.01', ruling R-04) is a named constant — never inline the literal.

## Remote & CI

Origin is the private Gitea repo `anatoly/welding_report` on git.mantalis.qa (token auth via
the credential store, identity `vik <vik@mantalis.qa>`; SSH on port 2222). CI is
`.gitea/workflows/ci.yml` (checks / db-migrate / build-e2e) — see `docs/ci.md`, including the
100 MB blob guard and the note that the runner's health is unconfirmed: verify a run executed
before trusting a green badge. Never commit tokens or passwords; `.env` is git-ignored.

## Repo hygiene

- `sources/` (~1.7 GB of client data) is git-ignored and must never be committed.
- `sonnet-orchestration-prompt.md` is the user's protocol for driving Opus/Sonnet subagents
  (routing by "can I pre-decide every ruling?", the R→P→G→I→V→C checkpoint format, one writer
  per lane). Read it before orchestrating multi-agent work here.
