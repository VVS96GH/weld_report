"use client";

import { usePageSubtitle } from "@/components/ReportShell";
import type { Burndown, Demo2Data, HaRow, LeadTimeRow } from "@/lib/pages/demo2";

/**
 * "Demo 2": burn-down, HA readiness matrix, NDE lead-time small multiples and
 * auto-written highlights. Inline SVG on the T.EN tokens — see DemoView.tsx.
 */

const NF = new Intl.NumberFormat("en-US");
const fmt = (v: number) => NF.format(Math.round(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${MONTHS[Number(m[2]) - 1]}` : iso;
};

// ── 1. Burn-down ────────────────────────────────────────────────────────────

function BurndownChart({ b }: { b: Burndown }) {
  const W = 1100;
  const H = 330;
  const left = 56;
  const right = 16;
  const top = 24;
  const bottom = 48;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const pts = b.points;
  const n = pts.length;
  // the projection extends the axis by up to eight weeks
  const projWeeks = b.weeksToClear !== null ? Math.min(8, Math.ceil(b.weeksToClear)) : 0;
  const cols = Math.max(n + projWeeks, 2);
  const x = (i: number) => left + (i / (cols - 1)) * plotW;
  const maxV = Math.max(1, ...pts.map((p) => Math.max(p.backlog ?? 0, p.tested ?? 0)));
  const y = (v: number) => top + plotH - (v / maxV) * plotH;
  const backlogPts = pts.map((p, i) => (p.backlog === null ? null : `${x(i).toFixed(1)},${y(p.backlog).toFixed(1)}`)).filter(Boolean).join(" ");
  const lastIdx = pts.map((p) => p.backlog).lastIndexOf(pts.filter((p) => p.backlog !== null).slice(-1)[0]?.backlog ?? null);
  const slotW = plotW / (cols - 1);
  const bw = Math.max(4, Math.min(18, slotW * 0.5));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxV * f));
  const projection =
    b.weeksToClear !== null && b.latest && b.slope !== null && lastIdx >= 0
      ? { x1: x(lastIdx), y1: y(b.latest.backlog), x2: x(Math.min(cols - 1, lastIdx + projWeeks)), y2: y(Math.max(0, b.latest.backlog + b.slope * projWeeks)) }
      : null;
  return (
    <svg className="demo-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="RT backlog by week with the weekly RT/UT throughput and a straight-line projection">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} className="demo-grid" />
          <text x={left - 8} y={y(t) + 4} className="demo-tick" textAnchor="end">{fmt(t)}</text>
        </g>
      ))}
      {pts.map((p, i) =>
        p.tested === null ? null : (
          <rect key={p.week} x={x(i) - bw / 2} y={y(p.tested)} width={bw} height={Math.max(0, y(0) - y(p.tested))} rx={2} className="demo-bar-muted" />
        ),
      )}
      <polyline points={backlogPts} className="demo-line-primary" />
      {pts.map((p, i) => (p.backlog === null ? null : <circle key={p.week} cx={x(i)} cy={y(p.backlog)} r={3} className="demo-dot-primary" />))}
      {projection ? (
        <>
          <line x1={projection.x1} y1={projection.y1} x2={projection.x2} y2={projection.y2} className="demo-projection" />
          <text x={projection.x2} y={projection.y2 - 8} className="demo-note" textAnchor="end">
            {b.weeksToClear! > 104 ? "more than 2 years" : `≈ ${b.weeksToClear!.toFixed(0)} weeks`} to clear at {fmt(-b.slope!)}/week
          </text>
        </>
      ) : null}
      {pts.map((p, i) =>
        // every second week plus the last one; the week before the last yields to it
        (i % 2 === 0 && i !== n - 2) || i === n - 1 ? (
          <text key={p.week} x={x(i)} y={H - bottom + 16} className="demo-tick" textAnchor="middle">{shortDate(p.week)}</text>
        ) : null,
      )}
      {b.latest ? (
        <text x={x(lastIdx)} y={y(b.latest.backlog) - 10} className="demo-value" textAnchor="middle">{fmt(b.latest.backlog)}</text>
      ) : null}
      <g transform={`translate(${left}, ${H - 10})`} className="demo-legend-svg">
        <line x1={0} x2={18} y1={-4} y2={-4} className="demo-line-primary" />
        <text x={24} y={0} className="demo-tick">RT backlog (joints)</text>
        <rect x={150} y={-11} width={12} height={9} rx={2} className="demo-bar-muted" />
        <text x={168} y={0} className="demo-tick">RT/UT tested per week</text>
        <line x1={310} x2={328} y1={-4} y2={-4} className="demo-projection" />
        <text x={334} y={0} className="demo-tick">projection, last 4 weeks&apos; pace</text>
      </g>
    </svg>
  );
}

// ── 2. HA readiness matrix ──────────────────────────────────────────────────

/** A percentage with a bar; `traffic` colours it ≥95 / 80–95 / <80, otherwise the bar is neutral. */
function PctCell({ v, traffic }: { v: number | null; traffic?: boolean }) {
  if (v === null) return <td className="num" />;
  const tone = !traffic ? "demo-bar-neutral" : v >= 95 ? "demo-bar-ok" : v >= 80 ? "demo-bar-warn" : "demo-bar-bad";
  return (
    <td className="num demo-pct-cell">
      <span className="demo-pct-bar" aria-hidden="true">
        <span className={`demo-pct-fill ${tone}`} style={{ width: `${Math.min(100, v)}%` }} />
      </span>
      <span className="demo-pct-text">{v.toFixed(1)}%</span>
    </td>
  );
}

function HaTableRow({ r, isTotal }: { r: HaRow; isTotal?: boolean }) {
  return (
    <tr className={isTotal ? "row-header" : undefined}>
      <th scope="row">{r.ha}</th>
      <td className="num">{fmt(r.welded)}</td>
      <td className="num">{fmt(r.rtTypes)}</td>
      <td className="num">{fmt(r.rtReported)}</td>
      <PctCell v={r.rtPct} />
      <td className="num">{r.rtBacklog > 0 ? fmt(r.rtBacklog) : ""}</td>
      <td className="num">{fmt(r.pwhtRequired)}</td>
      <td className="num">{fmt(r.pwhtDone)}</td>
      <PctCell v={r.pwhtPct} traffic />
      <td className="num">{r.pwhtBacklog > 0 ? fmt(r.pwhtBacklog) : ""}</td>
    </tr>
  );
}

function HaTable({ rows, total }: { rows: HaRow[]; total: HaRow }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">HA</th>
            <th scope="col">Joints welded</th>
            <th scope="col">RT-type welded</th>
            <th scope="col">RT reported</th>
            <th scope="col">RT reported share</th>
            <th scope="col">RT backlog</th>
            <th scope="col">PWHT required</th>
            <th scope="col">PWHT done</th>
            <th scope="col">PWHT progress</th>
            <th scope="col">PWHT backlog</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <HaTableRow key={r.ha} r={r} />
          ))}
          <HaTableRow r={total} isTotal />
        </tbody>
      </table>
    </div>
  );
}

// ── 3. NDE lead time, small multiples ───────────────────────────────────────

function LeadTimeCard({ r, buckets, maxShare }: { r: LeadTimeRow; buckets: string[]; maxShare: number }) {
  const W = 300;
  const H = 120;
  const left = 8;
  const bottom = 26;
  const top = 18;
  const plotH = H - top - bottom;
  const slot = (W - left * 2) / buckets.length;
  const bw = slot * 0.66;
  const y = (v: number) => top + plotH - (v / Math.max(maxShare, 1)) * plotH;
  return (
    <div className="card demo-lead-card">
      <div className="card-header">
        <span>{r.party}</span>
        <span className="demo-legend">{fmt(r.joints)} joints</span>
      </div>
      <svg className="demo-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${r.party}: share of joints by days from weld to RT report`}>
        {r.shares.map((s, i) => {
          const cx = left + slot * i + slot / 2;
          const late = i >= 4;
          return (
            <g key={buckets[i]}>
              <rect x={cx - bw / 2} y={y(s)} width={bw} height={Math.max(0, y(0) - y(s))} rx={3} className={late ? "demo-bar-attention" : "demo-bar-total"} />
              {s >= 3 ? (
                <text x={cx} y={y(s) - 4} className="demo-value" textAnchor="middle">{s.toFixed(0)}%</text>
              ) : null}
              <text x={cx} y={H - bottom + 14} className="demo-tick" textAnchor="middle">{buckets[i]}</text>
            </g>
          );
        })}
      </svg>
      <div className="demo-lead-stats">
        <span>median <b className="num">{r.median === null ? "–" : `${fmt(r.median)} d`}</b></span>
        <span>p90 <b className="num">{r.p90 === null ? "–" : `${fmt(r.p90)} d`}</b></span>
      </div>
    </div>
  );
}

// ── the screen ──────────────────────────────────────────────────────────────

export function Demo2View({ data, subtitle }: { data: Demo2Data; subtitle: string }) {
  usePageSubtitle(subtitle);
  const { highlights, burndown, ha, leadTime } = data;
  const maxShare = Math.max(1, ...leadTime.rows.flatMap((r) => r.shares));
  return (
    <section className="page-section active" aria-labelledby="page-heading">
      <div className="page-header">
        <h2 id="page-heading">Demo 2 — when, what blocks, why so long</h2>
      </div>
      <p className="page-subtitle">
        Three questions a status meeting asks, each answered by one widget over the report&apos;s own measures (loaded union, INCO excluded), as of {data.as_of}.
      </p>

      {highlights.length > 0 ? (
        <div className="card demo-highlights">
          <div className="card-header">Highlights — written from the numbers below, refreshed with the data</div>
          <ul className="demo-highlight-list">
            {highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card demo-burn-card">
        <div className="card-header">
          <span>1 · Burn-down — RT backlog against weekly RT/UT throughput</span>
          {burndown.throughput !== null ? <span className="demo-legend">throughput, last 4 weeks: {fmt(burndown.throughput)} / week</span> : null}
        </div>
        <BurndownChart b={burndown} />
        <div className="text-note-body">
          The line is the trend workbook&apos;s RT backlog (RT/UT+PWHT plus RT/UT Only, every party summed); the bars are joints RT/UT-tested that week. The dashed projection extends the last four weeks&apos; average change — a pace, not a forecast.
        </div>
      </div>

      <div className="card demo-ha-card">
        <div className="card-header">
          <span>2 · Handover readiness by HA</span>
          <span className="demo-legend">
            PWHT progress: <span className="demo-swatch demo-bar-ok" /> ≥95 % <span className="demo-swatch demo-bar-warn" /> 80–95 % <span className="demo-swatch demo-bar-bad" /> &lt;80 %
          </span>
        </div>
        <HaTable rows={ha.rows} total={ha.total} />
        <div className="text-note-body">
          RT reported share = RT-reported / welded, RT weld types only — informational, since the contractual RT coverage is 5–100 % by class; the readiness signal is the two backlog columns. PWHT progress = done / required (dump PWHT Y/N or the CCC joint record), coloured ≥95 / 80–95 / &lt;80 %. Backlogs are the page-2 measures (RT B.LOG Total, PWHT Backlog All). &quot;(Blank)&quot; is every joint the HA rule cannot place — mostly CCC, whose rows carry no subsystem code.
        </div>
      </div>

      <div className="section-title">3 · NDE lead time — days from weld date to the first RT report, per sub-contractor</div>
      <div className="dashboard-grid demo-lead-grid">
        {leadTime.rows.map((r) => (
          <LeadTimeCard key={r.party} r={r} buckets={leadTime.buckets} maxShare={maxShare} />
        ))}
      </div>
      <div className="card">
        <div className="text-note-body">
          Same bars, same scale on every card, so the shapes compare directly: coral buckets are joints that waited more than 30 days. Only RT-type joints with a report are counted; the median and 90th percentile are per party.
        </div>
      </div>
    </section>
  );
}
