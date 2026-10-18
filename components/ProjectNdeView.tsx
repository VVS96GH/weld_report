"use client";

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
          <div className="table-scroll pn-main">
            <DataTable widget={data.main} collapsible />
          </div>
        </>
      ) : null}
    </section>
  );
}
