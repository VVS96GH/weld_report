"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { WELDING_PAGE_TITLES, WELDING_REPORT_SUBTITLE, WELDING_TOTAL_PAGES } from "@/lib/welding-pages";
import { ThemeMoodControls } from "@/components/ThemeMoodControls";

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

  const current = currentPageFromPathname(pathname) ?? 1;
  const title = WELDING_PAGE_TITLES[current - 1] ?? "";

  const goTo = useCallback(
    (n: number) => {
      if (n >= 1 && n <= WELDING_TOTAL_PAGES) router.push(`/welding/${n}`);
    },
    [router],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goTo(current - 1);
      if (e.key === "ArrowRight") goTo(current + 1);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [current, goTo]);

  return (
    <SubtitleContext.Provider value={{ setSubtitle }}>
      <div className="app-shell">
      <header className="header">
        <div className="header-left">
          <Link href="/welding/1" className="brand-mark" aria-label="T.EN — Technip Energies, back to page 1">
            {/* The official globe, cut from the colour lockup (docs/brand-README.md). Plain <img>:
                a 512px PNG in a 44px circle needs no next/image pipeline. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/ten-globe-official.png" alt="" aria-hidden="true" width={44} height={44} />
          </Link>
          {/* Header chrome is navy in both schemes, so the lockup is always the dark-surface
              (negative) file — never switched by data-theme (docs/brand-README.md). Hidden
              below md; the globe carries the brand there. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-lockup" src="/brand/ten-lockup-negative.png" alt="Technip Energies" width={1200} height={582} />
          <div className="header-title">
            <h1>Welding Statistics Dashboard</h1>
            <div className="subtitle">{subtitle}</div>
          </div>
        </div>
        <div className="header-right">
          <ThemeMoodControls />
        </div>
      </header>

      <nav className="page-nav">
        <span className="page-indicator">
          Page {current} / {WELDING_TOTAL_PAGES}
        </span>
        <span className="page-title-display">{title}</span>
        <div className="nav-controls">
          {current > 1 ? (
            <Link href={`/welding/${current - 1}`} className="nav-btn" aria-label="Previous page">
              &#9664; Prev
            </Link>
          ) : (
            <button type="button" className="nav-btn" disabled aria-label="Previous page">
              &#9664; Prev
            </button>
          )}
          <label htmlFor="page-select" className="sr-only">
            Jump to page
          </label>
          <select
            id="page-select"
            className="page-select"
            value={current}
            onChange={(e) => goTo(Number(e.target.value))}
          >
            {WELDING_PAGE_TITLES.map((t, i) => (
              <option key={i} value={i + 1}>
                {`${i + 1}. ${t}`}
              </option>
            ))}
          </select>
          {current < WELDING_TOTAL_PAGES ? (
            <Link href={`/welding/${current + 1}`} className="nav-btn" aria-label="Next page">
              Next &#9654;
            </Link>
          ) : (
            <button type="button" className="nav-btn" disabled aria-label="Next page">
              Next &#9654;
            </button>
          )}
        </div>
      </nav>

      <main className="main-content">{children}</main>
      </div>
    </SubtitleContext.Provider>
  );
}
