"use client";

import { useMemo } from "react";

import type { ChartWidget, KpiWidget, PageModel, TableWidget, TextWidget } from "@/lib/page-model";
import { usePageSubtitle } from "@/components/ReportShell";
import { ChartCard, type Palette } from "@/components/widgets/ChartCard";
import { DataTable } from "@/components/widgets/DataTable";
import { MatrixTable } from "@/components/MatrixTable";
import { TextNote } from "@/components/widgets/TextNote";

/**
 * The flange dashboard arranged and coloured as the pbix page (owner request
 * 2026-09-08 "один в один"): three status tables down the left; on the right the
 * monthly column chart beside the "Project Flange Inspected" card block, then the
 * three banner sections — Flange Inspection (method doughnut + HA 1 progress),
 * Leaked Flange Break (weekly line + two cards), Flange Repair (site / vendor bars +
 * repaired doughnut). Widgets are bound by canvas_id / label / title; anything the
 * layout does not name falls through to a trailing grid.
 */

/** The pbix palette for the charts on this page (read by ChartCard through paletteOverride). */
function pbiPalette(): Partial<Palette> {
  if (typeof window === "undefined") return {};
  const s = getComputedStyle(document.querySelector(".pbi-page") ?? document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    colors: [v("--pbi-navy"), v("--pbi-bar"), v("--pbi-teal"), v("--pbi-grey"), v("--pbi-navy-2"), v("--pbi-line")].filter(Boolean),
    primary: v("--pbi-navy"),
    attention: v("--pbi-line"),
    fg: v("--pbi-fg"),
    text: v("--pbi-muted"),
    grid: v("--pbi-grid"),
  };
}

function Visual({ widget, className, palette, title }: { widget: ChartWidget; className?: string; palette: Partial<Palette>; title?: string }) {
  return (
    <div className={`pbi-visual ${className ?? ""}`.trim()}>
      <div className="pbi-visual-title">{title ?? widget.title}</div>
      <div className="chart-container">
        <ChartCard widget={widget} paletteOverride={palette} />
      </div>
    </div>
  );
}

function Card({ widget, big }: { widget: KpiWidget; big?: boolean }) {
  return (
    <div className={`pbi-card ${big ? "pbi-card--big" : ""}`.trim()}>
      <div className="pbi-card-value num">{widget.value}</div>
      <div className="pbi-card-label">{widget.label}</div>
    </div>
  );
}

function Table({ widget }: { widget: TableWidget }) {
  return (
    <div className="pbi-visual pbi-table">
      <div className="pbi-visual-title">{widget.title}</div>
      <div className="table-scroll">
        <DataTable widget={widget} />
      </div>
    </div>
  );
}

export function FlangeView({ model, subtitle, management }: { model: PageModel; subtitle: string; management?: PageModel }) {
  usePageSubtitle(subtitle);
  const palette = useMemo(() => pbiPalette(), []);

  const charts = new Map<string, ChartWidget>();
  const kpis = new Map<string, KpiWidget>();
  const tables = new Map<string, TableWidget>();
  const notes: TextWidget[] = [];
  for (const w of model.widgets) {
    if (w.kind === "chart") charts.set(w.canvas_id, w);
    else if (w.kind === "kpi") kpis.set(w.label, w);
    else if (w.kind === "table") tables.set(w.title, w);
    else if (w.kind === "text") notes.push(w);
  }
  const used = new Set<object>();
  const chart = (id: string) => { const c = charts.get(id); if (c) used.add(c); return c; };
  const kpi = (label: string) => { const k = kpis.get(label); if (k) used.add(k); return k; };
  const table = (title: string) => { const x = tables.get(title); if (x) used.add(x); return x; };

  const tSubco = table("Subcontractor Flange Status");
  const tHa1 = table("HA 1 Subcontractor Flange Status");
  const tHa = table("HA Flange Status");
  const withWindow = (w: ChartWidget | undefined, n: number) =>
    w ? { ...w, options_notes: `${w.options_notes ?? ""} window ${n}`.trim() } : undefined;
  // the pbix shows the last five months / five week-ends; the scrollbar reaches the rest
  const monthly = withWindow(chart("monthlyChart"), 6);
  const withHints = (w: ChartWidget | undefined) =>
    w ? { ...w, options_notes: `${w.options_notes ?? ""} label-name-pct center-total`.trim() } : undefined;
  const inspDonut = withHints(chart("inspectionDonut"));
  const ha1Donut = withHints(chart("ha1ProgressDonut"));
  const repairedDonutRaw = chart("repairedDonut");
  const repairedDonut = withHints(repairedDonutRaw);
  // duplicates of the summary block (the mockup's own second KPI row) are not re-rendered
  kpi("Inspected");
  kpi("PCC");
  kpi("Leaked");
  const leakLine = withWindow(chart("leakedTimelineChart"), 6);
  const siteBar = chart("siteRepairChart");
  const vendorBar = chart("vendorRepairChart");
  const kRegister = kpi("Total Register");
  const kInspected = kpi("Total Inspected");
  const kConst = kpi("Inspected Const-n");
  const kPcc = kpi("Inspected PCC") ?? kpis.get("PCC");
  const kLeaked = kpi("Leaked Flange Break");
  const pct = kInspected?.sub ?? "";
  const leakPct = kLeaked?.sub ?? "";
  const asOf = model.meta?.as_of ?? "";
  const rest = model.widgets.filter((w) => w.kind !== "filter" && w.kind !== "text" && !used.has(w));

  return (
    <section className="page-section active pbi-page pbi-flange" aria-labelledby="page-heading">
      <h2 id="page-heading" className="sr-only">{model.title}</h2>

      <div className="pbi-flange-grid">
        <div className="pbi-col pbi-col--tables">
          {tSubco ? <Table widget={tSubco} /> : null}
          {tHa1 ? <Table widget={tHa1} /> : null}
          {tHa ? <Table widget={tHa} /> : null}
        </div>

        <div className="pbi-col pbi-col--visuals">
          <div className="pbi-row pbi-row--top">
            {monthly ? <Visual widget={monthly} palette={palette} title="Project Flange Monthly Inspection" className="pbi-monthly" /> : null}
            <div className="pbi-visual pbi-summary">
              <div className="pbi-visual-title">Project Flange Inspected</div>
              <div className="pbi-summary-grid">
                {kRegister ? <Card widget={{ ...kRegister, label: "TOTAL Register" }} big /> : null}
                {kInspected ? <Card widget={{ ...kInspected, label: "Total Inspected" }} /> : null}
                {kInspected ? <Card widget={{ kind: "kpi", label: "Total Inspected %", value: pct }} /> : null}
                {kConst ? <Card widget={{ ...kConst, label: "Inspected Const-n" }} /> : null}
                {kPcc ? <Card widget={{ ...kPcc, label: "Inspected PCC" }} /> : null}
              </div>
            </div>
          </div>

          <div className="pbi-banner">
            <span>Flange Inspection</span>
            {asOf ? <span className="pbi-banner-date num">{asOf}</span> : null}
          </div>
          <div className="pbi-row">
            {inspDonut ? <Visual widget={inspDonut} palette={palette} title="Project Flange Inspected" /> : null}
            {ha1Donut ? <Visual widget={ha1Donut} palette={palette} title="HA 1 Flange Inspection Progress" /> : null}
          </div>

          <div className="pbi-banner"><span>Leaked Flange Break</span></div>
          <div className="pbi-row pbi-row--leak">
            {leakLine ? <Visual widget={leakLine} palette={palette} title="Leaked Flange Break %" className="pbi-leak" /> : null}
            <div className="pbi-card-stack">
              {kLeaked ? <Card widget={{ ...kLeaked, label: "Leaked Flange Break" }} /> : null}
              {kLeaked ? <Card widget={{ kind: "kpi", label: "Leaked Flg Break %", value: leakPct }} /> : null}
            </div>
          </div>

          <div className="pbi-banner"><span>Flange Repair</span></div>
          <div className="pbi-row pbi-row--repair">
            {siteBar ? <Visual widget={siteBar} palette={palette} title="Flange Repair (Site Issue)" /> : null}
            {vendorBar ? <Visual widget={vendorBar} palette={palette} title="Flange Repair (Vendor Issue)" /> : null}
            {repairedDonut ? <Visual widget={repairedDonut} palette={palette} title="Repaired vs To be Repaired" /> : null}
          </div>
        </div>
      </div>

      {management ? (
        // pbix flange page 2, kept on the same screen (owner request 2026-09-08:
        // "обе страницы в одном разделе")
        <div className="pbi-management-block">
          <div className="pbi-banner"><span>Flange Management</span></div>
          <div className="pbi-visual">
            <div className="pbi-visual-title pbi-management-title">{management.title}</div>
            {management.widgets.map((w, i) => (w.kind === "table" ? <MatrixTable key={i} widget={w} /> : null))}
          </div>
          {management.widgets.filter((w): w is TextWidget => w.kind === "text").map((t, i) => (
            <TextNote key={i} widget={t} />
          ))}
        </div>
      ) : null}

      {rest.length > 0 ? (
        <div className="dashboard-grid">
          {rest.map((w, i) =>
            w.kind === "chart" ? <Visual key={i} widget={w} palette={palette} /> : w.kind === "kpi" ? <Card key={i} widget={w} /> : w.kind === "table" ? <Table key={i} widget={w} /> : null,
          )}
        </div>
      ) : null}
      {notes.length > 0 ? (
        <div className="dashboard-grid pbi-notes">
          {notes.map((t, i) => <TextNote key={i} widget={t} />)}
        </div>
      ) : null}
    </section>
  );
}
