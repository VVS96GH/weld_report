"use client";

import { usePageSubtitle } from "@/components/ReportShell";
import type { DemoData, HeatmapRow, ParetoRow, SparkKpi, WaterfallStep } from "@/lib/pages/demo";

/**
 * The "Demo" screen: four widget forms the report does not use yet, drawn as
 * inline SVG on the T.EN tokens (every colour is a `var(--…)`, so both schemes
 * and the token lint hold). Data is lib/pages/demo.ts — the report's own
 * measures, project scope.
 */

const NF = new Intl.NumberFormat("en-US");
const fmt = (v: number) => NF.format(Math.round(v));

// ── 1. KPI tile with a sparkline ────────────────────────────────────────────

function Sparkline({ series, percent }: { series: number[]; percent?: boolean }) {
  const W = 140;
  const H = 36;
  const pad = 3;
  if (series.length < 2) return <svg className="demo-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" />;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (series.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const points = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${x(0).toFixed(1)},${H - pad} ${points} ${x(series.length - 1).toFixed(1)},${H - pad}`;
  const last = series[series.length - 1]!;
  return (
    <svg className="demo-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`12-week trend, latest ${percent ? last.toFixed(2) + "%" : fmt(last)}`}>
      <polygon points={area} className="demo-spark-area" />
      <polyline points={points} className="demo-spark-line" />
      <circle cx={x(series.length - 1)} cy={y(last)} r={3} className="demo-spark-dot" />
    </svg>
  );
}

function SparkTile({ k }: { k: SparkKpi }) {
  const up = k.delta !== null && k.delta.startsWith("+");
  return (
    <div className="stat-box demo-tile">
      <div className="demo-tile-top">
        <div>
          <div className="stat-value num">{k.value}</div>
          <div className="stat-label">{k.label}</div>
        </div>
        <Sparkline series={k.series} percent={k.percent} />
      </div>
      <div className="stat-sub">
        {k.delta !== null ? (
          <>
            <span className={up ? "demo-delta-up" : "demo-delta-down"}>{k.delta}</span> vs previous week · {k.weeks.length} weeks to {k.weeks[k.weeks.length - 1]}
          </>
        ) : (
          "no weekly history"
        )}
      </div>
    </div>
  );
}

// ── 2. Waterfall ────────────────────────────────────────────────────────────

function Waterfall({ total, steps, fabricated }: { total: WaterfallStep; steps: WaterfallStep[]; fabricated: number }) {
  const W = 640;
  const H = 260;
  const left = 56;
  const bottom = 46;
  const top = 28;
  const plotH = H - top - bottom;
  const max = Math.max(total.value, 1);
  const y = (v: number) => top + plotH - (v / max) * plotH;
  type Bar = { label: string; from: number; to: number; kind: "total" | "step" | "rest" };
  const bars: Bar[] = [{ label: total.label, from: 0, to: total.value, kind: "total" }];
  let running = total.value;
  for (const s of steps) {
    bars.push({ label: s.label, from: running - s.value, to: running, kind: "step" });
    running -= s.value;
  }
  bars.push({ label: "Remainder", from: 0, to: Math.max(0, running), kind: "rest" });
  const slot = (W - left - 16) / bars.length;
  const bw = Math.min(72, slot * 0.6);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  return (
    <svg className="demo-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`RT backlog ${fmt(total.value)} split into ${steps.map((s) => `${s.label} ${fmt(s.value)}`).join(", ")}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - 8} y1={y(t)} y2={y(t)} className="demo-grid" />
          <text x={left - 8} y={y(t) + 4} className="demo-tick" textAnchor="end">{fmt(t)}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const cx = left + slot * i + slot / 2;
        const yTop = y(b.to);
        const h = Math.max(0, y(b.from) - yTop);
        const cls = b.kind === "total" ? "demo-bar-total" : b.kind === "rest" ? "demo-bar-rest" : "demo-bar-step";
        const next = bars[i + 1];
        return (
          <g key={b.label}>
            <rect x={cx - bw / 2} y={yTop} width={bw} height={h} rx={3} className={cls} />
            {next && b.kind !== "rest" ? (
              <line x1={cx + bw / 2} x2={left + slot * (i + 1) + slot / 2 - bw / 2} y1={b.kind === "total" ? yTop : y(b.from)} y2={b.kind === "total" ? yTop : y(b.from)} className="demo-connector" />
            ) : null}
            <text x={cx} y={yTop - 6} className="demo-value" textAnchor="middle">
              {b.kind === "step" ? `−${fmt(b.to - b.from)}` : fmt(b.to - b.from)}
            </text>
            <text x={cx} y={H - bottom + 16} className="demo-tick" textAnchor="middle">
              {b.label}
            </text>
          </g>
        );
      })}
      <text x={W - 8} y={H - 8} className="demo-note" textAnchor="end">
        of which fabricated spools: {fmt(fabricated)} ({total.value > 0 ? ((fabricated / total.value) * 100).toFixed(0) : 0}%)
      </text>
    </svg>
  );
}

// ── 3. Aging heatmap ────────────────────────────────────────────────────────

function Heatmap({ buckets, rows, max }: { buckets: string[]; rows: HeatmapRow[]; max: number }) {
  return (
    <div className="table-scroll demo-heat-scroll">
      <table className="data-table demo-heat">
        <thead>
          <tr>
            <th scope="col">Service class</th>
            {buckets.map((b) => (
              <th key={b} scope="col">{b}</th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {r.cells.map((v, i) => (
                <td key={i} className="num demo-heat-cell" style={{ ["--heat" as string]: max > 0 ? Math.round((v / max) * 100) : 0 }}>
                  {v > 0 ? fmt(v) : ""}
                </td>
              ))}
              <td className="num demo-heat-total">{fmt(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 4. Pareto ───────────────────────────────────────────────────────────────

function Pareto({ rows }: { rows: ParetoRow[] }) {
  const W = 640;
  const H = 300;
  const left = 96;
  const bottom = 96;
  const top = 20;
  const plotH = H - top - bottom;
  const y = (pct: number) => top + plotH - (pct / 100) * plotH;
  const slot = (W - left - 12) / Math.max(rows.length, 1);
  const bw = Math.min(28, slot * 0.62);
  const cx = (i: number) => left + slot * i + slot / 2;
  const line = rows.map((r, i) => `${cx(i).toFixed(1)},${y(r.cumulative).toFixed(1)}`).join(" ");
  // the 80 % mark is looked for among the WPS themselves, never in the long-tail bucket
  const named = rows.filter((r) => !r.other);
  const eighty = named.findIndex((r) => r.cumulative >= 80);
  const lastNamed = named[named.length - 1];
  const short = (s: string) => (s.length > 20 ? `${s.slice(0, 19)}…` : s);
  return (
    <svg className="demo-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Share of rejected films by WPS with the cumulative share">
      {[0, 20, 40, 60, 80, 100].map((t) => (
        <g key={t}>
          <line x1={left} x2={W - 8} y1={y(t)} y2={y(t)} className={t === 80 ? "demo-grid-strong" : "demo-grid"} />
          <text x={left - 6} y={y(t) + 4} className="demo-tick" textAnchor="end">{t}%</text>
        </g>
      ))}
      {rows.map((r, i) => (
        <g key={r.label}>
          <rect x={cx(i) - bw / 2} y={y(r.share)} width={bw} height={Math.max(0, y(0) - y(r.share))} rx={3} className={r.other ? "demo-bar-rest" : eighty >= 0 && i <= eighty ? "demo-bar-attention" : "demo-bar-muted"} />
          <text x={cx(i)} y={y(r.share) - 5} className="demo-value" textAnchor="middle">{fmt(r.count)}</text>
          <text transform={`translate(${cx(i) + 4}, ${H - bottom + 12}) rotate(-45)`} className="demo-tick" textAnchor="end">
            <title>{r.label}</title>
            {short(r.label)}
          </text>
        </g>
      ))}
      <polyline points={line} className="demo-pareto-line" />
      {rows.map((r, i) => (
        <circle key={r.label} cx={cx(i)} cy={y(r.cumulative)} r={3} className="demo-pareto-dot" />
      ))}
      {eighty >= 0 ? (
        <text x={cx(eighty)} y={y(named[eighty]!.cumulative) - 8} className="demo-note" textAnchor="middle">
          {named[eighty]!.cumulative.toFixed(0)}% by {eighty + 1} WPS
        </text>
      ) : lastNamed ? (
        <text x={cx(named.length - 1)} y={y(lastNamed.cumulative) - 8} className="demo-note" textAnchor="end">
          top {named.length} WPS = {lastNamed.cumulative.toFixed(0)}%
        </text>
      ) : null}
    </svg>
  );
}

// ── the screen ──────────────────────────────────────────────────────────────

export function DemoView({ data, subtitle }: { data: DemoData; subtitle: string }) {
  usePageSubtitle(subtitle);
  const { kpis, waterfall, heatmap, pareto } = data;
  return (
    <section className="page-section active" aria-labelledby="page-heading">
      <div className="page-header">
        <h2 id="page-heading">Demo widgets — project scope</h2>
      </div>
      <p className="page-subtitle">
        Four widget forms on the report&apos;s own measures (loaded union, INCO excluded), as of {data.as_of}. Nothing here is a new number — only a new way to read one.
      </p>

      <div className="section-title">1 · KPI tiles with a 12-week sparkline</div>
      <div className="stats-row">
        {kpis.map((k) => (
          <SparkTile key={k.label} k={k} />
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">2 · Waterfall — how the RT backlog splits by PWHT state</div>
          <Waterfall total={waterfall.total} steps={waterfall.steps} fabricated={waterfall.fabricated} />
          <div className="text-note-body">
            The three steps are page 2&apos;s own cells (RT+PWHT &quot;Y&quot; Done, RT+PWHT &quot;N&quot;, RT B.LOG &amp; PWHT NOT Done); a non-zero remainder would mean a joint the three states do not cover.
          </div>
        </div>
        <div className="card">
          <div className="card-header">4 · Pareto — rejected RT films by WPS</div>
          <Pareto rows={pareto.rows} />
          <div className="text-note-body">
            Bars: each WPS&apos;s share of the {fmt(pareto.total)} rejected films ({pareto.wpsTotal} WPS with rejections); the line is the cumulative share; the green bar is the long tail. Coral bars are the WPS that together reach 80 % — when the shown ones do not, the note gives their share.
          </div>
        </div>
      </div>

      <div className="card demo-heat-card">
        <div className="card-header">
          <span>3 · Aging heatmap — RT backlog by service class and age (top {heatmap.rows.length} of {heatmap.classesTotal} classes)</span>
          <span className="demo-legend">
            <span className="demo-legend-swatch" style={{ ["--heat" as string]: 15 }} /> few
            <span className="demo-legend-swatch" style={{ ["--heat" as string]: 100 }} /> {fmt(heatmap.max)} joints
          </span>
        </div>
        <Heatmap buckets={heatmap.buckets} rows={heatmap.rows} max={heatmap.max} />
        <div className="text-note-body">
          The same M51 buckets as the NDE pages&apos; details table, coloured by count so the oldest and largest pockets read at a glance. Rows are sorted by total backlog.
        </div>
      </div>
    </section>
  );
}
