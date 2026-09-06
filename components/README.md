# Components

Maps the mockup (`mockups/welding-dashboard 1.html`) onto this component tree.

- **ReportShell.tsx** — the mockup's `<header class="header">` + `<nav class="page-nav">`.
  Wraps every route from `app/layout.tsx`. Reads/writes the current page from the URL
  (`usePathname`), so prev/next/`<select>` navigate via `next/link` / `useRouter` to real
  `/welding/N` routes instead of toggling `.page-section.active` in place. Exposes
  `usePageSubtitle(text)` so a page can push its header subtitle up (static fixture
  wording, or `Data as of <meta.as_of>` once `PAGE_SOURCE=database`).
- **ThemeMoodControls.tsx** — the header's mood dropdown + theme toggle. Source of truth
  is the `data-theme`/`data-mood` attributes on `<html>` (read via `useSyncExternalStore`,
  not React state) so ChartCard's own DOM observer and this component never disagree.
  Persists to `localStorage` (guarded), applied post-mount only — never causes a
  hydration mismatch since the SSR defaults already match.
- **PageView.tsx** — the mockup's `.page-section`. Batches a PageModel's flat widget list
  into the mockup's rhythm: a run of KPIs → one `.stats-row`, a run of charts → one
  `.dashboard-grid` of `.card`s, a run of text widgets → one `.dashboard-grid` of
  reference cards, each table → its own `.section-title` + `.table-scroll`.
- **FilterBar.tsx** — `'use client'`; the flange dashboard's server-driven filters. Each
  `FilterWidget` becomes a labelled `<select>` (44 px targets); a change pushes `/flange?ha=…&subco=…&method=…`
  (values equal to "All" are dropped), the server re-renders `getFlangePage(filters)`, and an
  `aria-live` region announces the applied set. "Reset" is a plain link to `/flange`.
- **ReportShell — report switcher** — the nav row starts with two pill links "Welding" | "Flange"
  (`aria-current="page"` on the active one). The page indicator, prev/next and the jump select are
  welding-only and are not rendered on `/flange`; the switcher's own height keeps the row stable.
- **widgets/KpiCard, DataTable, TextNote** — plain `.stat-box` / `.data-table` /
  `.card` markup.
- **widgets/ChartCard.tsx** — `'use client'`; wraps `react-chartjs-2`'s generic `Chart`.
  Colors come from the live mood's CSS variables (`--color-N`, `--accent-primary`), not a
  duplicated JS palette; a `MutationObserver` remounts the chart on mood/theme change.

## Switching `PAGE_SOURCE`

`lib/page-source.ts` picks the data source from `PAGE_SOURCE` (`fixture` | `database`,
default `fixture`). Set `PAGE_SOURCE=database` once `lib/pages/welding.ts` (METRICS-LANE)
exports `getWeldingPage(n)`; until then, or if it's missing/broken, `database` mode throws
a clear error instead of failing the build (the import is dynamic and try/caught).

## Flange dashboard (`/flange`)

`app/flange/page.tsx` (dynamic) reads `ha` / `subco` / `method` from the URL, calls
`getFlangePage(filters)` from `lib/page-source.ts` and renders `FilterBar` + `PageView`.
Source selection follows `PAGE_SOURCE` like the welding pages; the fixture is
`lib/fixture/flange-spec.ts` (mapped from `analysis/mockups/flange-spec.json`, the mockup's
"All" snapshot — it cannot re-aggregate, and says so in a text widget when a non-default filter
is requested). In `database` mode, while `lib/pages/flange.ts` is absent the fixture is served
with a provenance note instead of a 500; once that module exports `getFlangePage(filters)` it is
used automatically. e2e coverage: `e2e/flange.spec.ts`.
