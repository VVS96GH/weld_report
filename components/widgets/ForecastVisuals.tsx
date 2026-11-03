"use client";

import { useState } from "react";

/**
 * RT B.Log Forecast visuals (owner, 2026-11-03), redrawn in the T.EN style without Chart.js:
 * the parts only (the total is their sum, never drawn beside them), one stacked bar per
 * sub-contractor with its total and share, a half-ring for done / backlog and a ring of the parts
 * with the total in the centre and a legend table. Colours are the theme's (--rt-* in the CSS);
 * the same file serves both sites.
 */

export type Part = { key: string; label: string };
export type ForecastRow = { name: string; values: Record<string, number> };

export const RT_PARTS: Part[] = [
  { key: "100", label: "RT 100%" },
  { key: "5", label: "RT 5%" },
  { key: "10", label: "RT 10%" },
  { key: "20", label: "RT 20%" },
  { key: "30", label: "RT 30%" },
];
const color = (key: string) => `var(--rt-${key})`;
const NF = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const n0 = (v: number) => NF.format(Math.round(v));
const pct = (v: number, of: number) => (of ? `${((100 * v) / of).toFixed(1)}%` : "—");
const sum = (v: Record<string, number>) => RT_PARTS.reduce((a, p) => a + (v[p.key] ?? 0), 0);

/** One stacked bar per sub-contractor, largest first: the RT % parts, the total and its share. */
export function ForecastBars({ rows, unit = "joints" }: { rows: ForecastRow[]; unit?: string }) {
  const [tip, setTip] = useState<{ row: string; part: string; x: number } | null>(null);
  const list = rows.map((r) => ({ ...r, total: sum(r.values) })).sort((a, b) => b.total - a.total);
  const grand = list.reduce((a, r) => a + r.total, 0);
  const max = Math.max(1, ...list.map((r) => r.total));
  const byPart = Object.fromEntries(RT_PARTS.map((p) => [p.key, list.reduce((a, r) => a + (r.values[p.key] ?? 0), 0)]));
  return (
    <div className="fc-bars">
      <div className="fc-bars-head">
        <span className="fc-big num">{n0(grand)}</span>
        <span className="fc-muted">{unit} in the forecast backlog</span>
      </div>
      <div className="fc-bars-rows" role="list">
        {list.map((r) => (
          <div className="fc-row" role="listitem" key={r.name}>
            <span className="fc-row-name">{r.name}</span>
            <div className="fc-track" onMouseLeave={() => setTip(null)}>
              <div className="fc-fill" style={{ width: `${(100 * r.total) / max}%` }}>
                {RT_PARTS.map((p) => {
                  const v = r.values[p.key] ?? 0;
                  if (v <= 0) return null;
                  return (
                    <span
                      key={p.key}
                      className={`fc-seg${tip && tip.row === r.name && tip.part !== p.key ? " is-dim" : ""}`}
                      style={{ flexGrow: v, background: color(p.key) }}
                      onMouseEnter={(e) => {
                        const track = e.currentTarget.closest(".fc-track")!.getBoundingClientRect();
                        const seg = e.currentTarget.getBoundingClientRect();
                        setTip({ row: r.name, part: p.key, x: seg.left + seg.width / 2 - track.left });
                      }}
                      aria-label={`${r.name} ${p.label}: ${n0(v)}`}
                    />
                  );
                })}
              </div>
              {tip?.row === r.name ? (
                <div className="fc-tip" style={{ left: tip.x }}>
                  <i style={{ background: color(tip.part) }} />
                  <b>{r.name}</b> · {RT_PARTS.find((p) => p.key === tip.part)?.label}:{" "}
                  <b className="num">{n0(r.values[tip.part] ?? 0)}</b>
                  <span className="fc-muted"> ({pct(r.values[tip.part] ?? 0, r.total)})</span>
                </div>
              ) : null}
            </div>
            <span className="fc-row-total num">
              <b>{n0(r.total)}</b>
              <span className="fc-muted">{pct(r.total, grand)}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="fc-legend">
        {RT_PARTS.map((p) => (
          <span key={p.key} className="fc-chip">
            <i style={{ background: color(p.key) }} />
            {p.label}
            <b className="num">{n0(byPart[p.key] ?? 0)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Done against the backlog as a half ring: the done share large in the middle. */
export function DoneGauge({ done, backlog }: { done: number; backlog: number }) {
  const all = done + backlog;
  const share = all ? (100 * done) / all : 0;
  const arc = "M 20 100 A 80 80 0 0 1 180 100";
  const a = Math.PI * (1 - share / 100);
  const tip = { x: 100 + 80 * Math.cos(a), y: 100 - 80 * Math.sin(a) };
  return (
    <div className="fc-gauge">
      <svg viewBox="0 0 200 118" role="img" aria-label={`RT/UT done ${share.toFixed(1)}%`}>
        <defs>
          <linearGradient id="fc-done" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" style={{ stopColor: "var(--rt-done)" }} />
            <stop offset="100%" style={{ stopColor: "var(--rt-100)" }} />
          </linearGradient>
        </defs>
        <path d={arc} fill="none" strokeWidth="16" strokeLinecap="round" style={{ stroke: "var(--rt-total)" }} opacity="0.9" />
        <path d={arc} fill="none" stroke="url(#fc-done)" strokeWidth="16" strokeLinecap="round" pathLength={100} strokeDasharray={`${share} 100`} />
        <circle cx={tip.x} cy={tip.y} r="5.5" fill="#fff" strokeWidth="3" style={{ stroke: "var(--rt-100)" }} />
        <text x="100" y="84" textAnchor="middle" className="fc-gauge-big">
          {share.toFixed(1)}%
        </text>
        <text x="100" y="103" textAnchor="middle" className="fc-gauge-sub">
          RT/UT done
        </text>
      </svg>
      <div className="fc-gauge-foot">
        <span>
          <i style={{ background: "var(--rt-100)" }} /> done <b className="num">{n0(done)}</b>
        </span>
        <span>
          <i style={{ background: "var(--rt-total)" }} /> B.log <b className="num">{n0(backlog)}</b>
        </span>
      </div>
    </div>
  );
}

/** The parts as a ring, the total in its centre, a legend table beside it (hover links both). */
export function ForecastRing({ values, unit = "joints" }: { values: Record<string, number>; unit?: string }) {
  const [on, setOn] = useState<string | null>(null);
  const total = sum(values);
  const parts = RT_PARTS.filter((p) => (values[p.key] ?? 0) > 0);
  const GAP = parts.length > 1 ? 0.8 : 0;
  // each part's length and where it starts on the ring (percent of the circle)
  const lens = parts.map((p) => (100 * (values[p.key] ?? 0)) / (total || 1));
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className="fc-ring">
      <svg viewBox="0 0 200 200" role="img" aria-label={`Forecast backlog ${n0(total)} ${unit}`}>
        <circle cx="100" cy="100" r="74" fill="none" strokeWidth="26" style={{ stroke: "var(--rt-track)" }} />
        {parts.map((p, i) => {
          const len = lens[i];
          return (
            <circle
              key={p.key}
              cx="100"
              cy="100"
              r="74"
              fill="none"
              strokeWidth={on === p.key ? 30 : 26}
              pathLength={100}
              strokeDasharray={`${Math.max(0.3, len - GAP)} ${100 - Math.max(0.3, len - GAP)}`}
              strokeDashoffset={-starts[i]}
              transform="rotate(-90 100 100)"
              style={{ stroke: color(p.key), opacity: on && on !== p.key ? 0.35 : 1, transition: "opacity .15s, stroke-width .15s" }}
              onMouseEnter={() => setOn(p.key)}
              onMouseLeave={() => setOn(null)}
            />
          );
        })}
        <text x="100" y="100" textAnchor="middle" className="fc-ring-big">
          {on ? n0(values[on] ?? 0) : n0(total)}
        </text>
        <text x="100" y="122" textAnchor="middle" className="fc-ring-sub">
          {on ? RT_PARTS.find((p) => p.key === on)?.label : `${unit} B.log`}
        </text>
      </svg>
      <table className="fc-ring-legend">
        <tbody>
          {RT_PARTS.map((p) => (
            <tr
              key={p.key}
              className={on === p.key ? "is-on" : on ? "is-dim" : undefined}
              onMouseEnter={() => setOn(p.key)}
              onMouseLeave={() => setOn(null)}
            >
              <td>
                <i style={{ background: color(p.key) }} />
                {p.label}
              </td>
              <td className="num">{n0(values[p.key] ?? 0)}</td>
              <td className="num fc-muted">{pct(values[p.key] ?? 0, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
