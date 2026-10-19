"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { menuNeighbours, menuPosition } from "@/lib/page-order";
import { displayForPath, displayHref, WELDING_PAGE_TITLES, WELDING_REPORT_SUBTITLE, WELDING_TOTAL_PAGES } from "@/lib/welding-pages";
import { SCREENS } from "@/lib/screens";
import { WP_FIRST } from "@/lib/welder-perf-nav";
import { WpNavMenu } from "@/components/WpNavMenu";
import { FilterSummary, PageNavControls } from "@/components/PageNavControls";
import { ThemeMoodControls } from "@/components/ThemeMoodControls";
import { RefreshDataButton } from "@/components/RefreshDataButton";
import { relabel } from "@/lib/labels";

type SubtitleApi = { setSubtitle: (s: string) => void };
const SubtitleContext = createContext<SubtitleApi | null>(null);

/**
 * Lets a page (via PageView) publish the header subtitle it wants shown — the
 * static fixture wording, or "Data as of <meta.as_of>" once PAGE_SOURCE=database.
 * ReportShell owns the subtitle state; this hook just pushes updates into it, since
 * ReportShell (in the root layout) has no direct prop channel from the page below it.
 */
export function usePageSubtitle(subtitle: string) {
  const ctx = useContext(SubtitleContext);
  useEffect(() => {
    ctx?.setSubtitle(subtitle);
  }, [ctx, subtitle]);
}

function currentPageFromPathname(pathname: string | null): number | null {
  const match = pathname?.match(/^\/welding\/(\d+)$/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) ? n : null;
}

/** Sticky header + page nav + mood/theme controls, wrapping every route in app/layout.tsx. */
export function ReportShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [subtitle, setSubtitle] = useState<string>(WELDING_REPORT_SUBTITLE);

  const isFlange = pathname?.startsWith("/flange") ?? false;
  // The Errors page (2026-10-14): data errors for the sub-contractors to correct.
  const isErrors = pathname?.startsWith("/errors") ?? false;
  const isData = pathname?.startsWith("/data") ?? false;
  // The WELDER PERFORMANCE tab (2026-10-14): its own pages, 2 weeks / 1 month, …
  const wpSlug = pathname?.match(/^\/welder-performance(?:\/([a-z0-9-]+))?/)?.[1] ?? (pathname?.startsWith("/welder-performance") ? WP_FIRST : null);
  const isWelders = wpSlug !== null;
  // Consolidation option A: /report/<screen> — 7 screens with filters instead of the page list.
  const screenId = pathname?.match(/^\/report\/([a-z]+)/)?.[1] ?? null;
  const isScreens = screenId !== null;
  // The reading order (lib/welding-pages.ts): the welding pages and, as pages 3..8,
  // Flange, the Welder Performance pages and Errors — one page nav across them.
  const display = displayForPath(pathname);
  const inSequence = display !== null;
  const current = display ?? 1;
  const onWelding = currentPageFromPathname(pathname) !== null;
  const title = isFlange
    ? "Flange Inspection Dashboard"
    : isErrors
      ? "Errors"
      : isWelders
      ? "Welder Performance"
      : isScreens
      ? (SCREENS.find((sc) => sc.id === screenId)?.title ?? "")
      : (WELDING_PAGE_TITLES[current - 1] ?? "");

  const goTo = useCallback(
    (n: number) => {
      if (n < 1 || n > WELDING_TOTAL_PAGES) return;
      // ← → between welding pages keep the filters on screen, as Prev / Next do
      const href = displayHref(n);
      router.push(href.startsWith("/welding/") ? `${href}${window.location.search}` : href);
    },
    [router],
  );

  useEffect(() => {
    if (!onWelding) return; // ← → paging only on the welding pages (the others have their own inputs)
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
      const { prev, next } = menuNeighbours(current);
      if (e.key === "ArrowLeft" && prev) goTo(prev);
      if (e.key === "ArrowRight" && next) goTo(next);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [current, goTo, onWelding]);

  return (
    <SubtitleContext.Provider value={{ setSubtitle }}>
      <div className="app-shell">
      <header className="header">
        <div className="header-left">
          {/* ONE brand element at any width (user ruling): below md the coloured official
              globe is the home link; from md up only the official negative lockup is —
              CSS toggles them (app/globals.css .brand-mark / .brand-lockup-link). Both
              carry the home-link semantics so whichever is visible is the link. */}
          <Link href="/welding/1" className="brand-mark" aria-label="T.EN — Technip Energies, back to page 1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/ten-globe-official.png" alt="" aria-hidden="true" width={44} height={44} />
          </Link>
          {/* Header chrome is navy in both schemes, so the lockup is always the dark-surface
              (negative) file — never switched by data-theme (docs/brand-README.md). */}
          <Link href="/welding/1" className="brand-lockup-link" aria-label="T.EN — Technip Energies, back to page 1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-lockup" src="/brand/ten-lockup-negative.png" alt="" aria-hidden="true" width={1200} height={582} />
          </Link>
          <div className="header-title">
            <h1>Welding Statistics Dashboard</h1>
            <div className="subtitle">{subtitle}</div>
          </div>
        </div>
        <div className="header-right">
          <ThemeMoodControls />
          <RefreshDataButton />
        </div>
      </header>

      <nav className="page-nav" aria-label="Report navigation">
        {/* Report switcher: two pill links; the current report carries aria-current. */}
        <div className="report-switcher" role="group" aria-label="Report">
          <Link href="/welding/1" className="report-pill" aria-current={isFlange || isScreens || isErrors || isWelders || isData ? undefined : "page"}>
            Welding
          </Link>
          <Link href="/flange" className="report-pill" aria-current={isFlange ? "page" : undefined}>
            Flange
          </Link>
          <Link href="/report/overview" className="report-pill" aria-current={isScreens ? "page" : undefined}>
            Screens
          </Link>
          <Link href="/welder-performance" className="report-pill" aria-current={isWelders ? "page" : undefined}>
            Welder Performance
          </Link>
          <Link href="/errors" className="report-pill" aria-current={isErrors ? "page" : undefined}>
            Errors
          </Link>
          <Link href="/data" className="report-pill" aria-current={isData ? "page" : undefined}>
            Data
          </Link>
        </div>
        {isScreens ? (
          <div className="screen-tabs" role="group" aria-label="Screens">
            {SCREENS.map((sc) => (
              <Link key={sc.id} href={`/report/${sc.id}${sc.defaultQuery ? `?${sc.defaultQuery}` : ""}`} className="report-pill" aria-current={sc.id === screenId ? "page" : undefined}>
                {relabel(sc.nav)}
              </Link>
            ))}
            <Link href="/flange" className="report-pill">
              Flange
            </Link>
          </div>
        ) : (
          <>
            {isWelders ? <WpNavMenu slug={wpSlug} /> : null}
            {inSequence ? (
              <span className="page-indicator">
                Page {menuPosition(current)} / {WELDING_TOTAL_PAGES}
              </span>
            ) : null}
            {isWelders || isData ? null : <span className="page-title-display">{relabel(title)}</span>}
            {/* the Data page lists its own filters as chips */}
            {isData ? null : (
              <Suspense fallback={null}>
                <FilterSummary />
              </Suspense>
            )}
            {inSequence ? (
              <Suspense fallback={<div className="nav-controls" />}>
                <PageNavControls current={current} />
              </Suspense>
            ) : null}
          </>
        )}
      </nav>

      <main className="main-content">{children}</main>
      </div>
    </SubtitleContext.Provider>
  );
}
