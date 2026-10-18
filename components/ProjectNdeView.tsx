"use client";

import { useLayoutEffect, useRef } from "react";

import { EdgeFilters } from "@/components/EdgeFilters";
import { usePageSubtitle } from "@/components/ReportShell";
import { DataTable } from "@/components/widgets/DataTable";
import { KpiCard } from "@/components/widgets/KpiCard";
import type { FilterWidget, KpiWidget, TableWidget } from "@/lib/page-model";

export type ProjectNdeData = { filters: FilterWidget[]; cards: KpiWidget[]; summary: TableWidget; main: TableWidget };

/**
 * Project NDE & PWHT Status by Service Class (owner, 2026-10-18; pbix
 * "Internal. PROJECT RT% NDE AND PWHT STATUS S.Class PR all"): every slicer and
 * the four STATUS filters in the FILTERS tab; the summary, three cards, and the
 * Service Class matrix (a class opens to its sub-contractors under +).
 */
export function ProjectNdeView({ data, note }: { data: ProjectNdeData | null; note?: string }) {
  usePageSubtitle("Project NDE & PWHT Status by Service Class");
  // One screen (owner, 2026-10-18): the matrix takes the window's remaining
  // height and scrolls inside, so the page itself never does.
  const mainRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      let h = Math.max(240, window.innerHeight - top - 30);
      el.style.maxHeight = `${h}px`;
      // whatever still overflows (the page's bottom padding) comes off the matrix too
      const over = document.documentElement.scrollHeight - window.innerHeight;
      if (over > 0) {
        h = Math.max(240, h - over);
        el.style.maxHeight = `${h}px`;
      }
    };
    fit();
    // again once the web fonts have settled the header heights
    const late = window.setTimeout(fit, 400);
    window.addEventListener("resize", fit);
    return () => {
      window.clearTimeout(late);
      window.removeEventListener("resize", fit);
    };
  }, [data]);
  return (
    <section className="page-section active pv-page pn-page" aria-labelledby="page-heading">
      <div className="page-header">
        <h2 id="page-heading">Project NDE and PWHT Status / Service Class + Service Cat + NDT Remarks</h2>
      </div>
      {note ? <p className="error-empty">{note}</p> : null}
      {data ? (
        <>
          <EdgeFilters widgets={data.filters} />
          <div className="pn-top">
            <div>
              <div className="section-title">{data.summary.title}</div>
              <div className="table-scroll">
                <DataTable widget={data.summary} />
              </div>
            </div>
            <div className="stats-row pn-cards">
              {data.cards.map((c) => (
                <KpiCard key={c.label} widget={c} />
              ))}
            </div>
          </div>
          <div className="section-title">{data.main.title}</div>
          <div className="table-scroll pn-main" ref={mainRef}>
            <DataTable widget={data.main} collapsible />
          </div>
        </>
      ) : null}
    </section>
  );
}
