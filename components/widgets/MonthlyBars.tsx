"use client";

import type React from "react";
import { useMemo, useState } from "react";

/**
 * Monthly RT/UT progress, F + S stacked (owner, 2026-11-03), in the T.EN style without Chart.js:
 * rounded columns (F gold, S blue, as Welding Progress), the month's total above each, a dashed
 * average of the months shown, a hover card, 6M / 12M / 24M / All with ◀ ▶ to move the window,
 * and the last month against the one before in the header. Same file on both sites.
 */

export type Month = { label: string; f: number; s: number };

const RANGES = [6, 12, 24, 0] as const; // 0 = all
const NF = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const n0 = (v: number) => NF.format(Math.round(v));
const short = (v: number) => (v >= 10_000 ? `${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)}K` : n0(v));

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  return (steps.find((x) => m <= x) ?? 10) * p;
}

export function MonthlyBars({
  months,
  unit,
  defaultRange = 12,
  height = 200,
}: {
  months: Month[];
  unit: string;
  defaultRange?: number;
  /** the plot's height in px (the forecast page fits one screen with 130) */
  height?: number;
}) {
  const [range, setRange] = useState<number>(defaultRange);
  const [end, setEnd] = useState<number>(months.length); // exclusive
  const [hover, setHover] = useState<number | null>(null);

  const size = range === 0 ? months.length : Math.min(range, months.length);
  const stop = Math.min(Math.max(end, size), months.length);
  const shown = useMemo(() => months.slice(stop - size, stop), [months, stop, size]);
  const totals = shown.map((m) => m.f + m.s);
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const top = niceMax(Math.max(1, ...totals) * 1.12);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * top);
  const last = months[months.length - 1];
  const prev = months[months.length - 2];
  const lastT = last ? last.f + last.s : 0;
  const prevT = prev ? prev.f + prev.s : 0;
  const delta = prevT ? ((lastT - prevT) / prevT) * 100 : null;
  const every = Math.ceil(shown.length / 14); // month labels thin out on long ranges
  const step = Math.max(1, Math.round(size / 3));

  if (months.length === 0) return <p className="fc-muted px-2 py-4 text-sm">No months yet.</p>;
  const h = hover === null ? null : shown[hover];

  return (
    <div className="mb" style={{ "--mb-h": `${height}px` } as React.CSSProperties}>
      <div className="mb-head">
        <div className="mb-last">
          <span className="fc-muted">{last.label}</span>
          <b className="num">{n0(lastT)}</b>
          <span className="fc-muted">{unit}</span>
          {delta !== null ? (
            <span className={`mb-delta ${delta >= 0 ? "is-up" : "is-down"}`}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% vs {prev.label}
            </span>
          ) : null}
        </div>
        <div className="mb-tools">
          <span className="mb-key">
            <i style={{ background: "var(--series-f, #e0b84e)" }} /> F
          </span>
          <span className="mb-key">
            <i style={{ background: "var(--series-s, #2f6fd6)" }} /> S
          </span>
          <span className="mb-key mb-key--avg">
            <i /> avg <b className="num">{n0(avg)}</b>
          </span>
          <div className="mb-range" role="group" aria-label="Months shown" title={`${shown[0]?.label} – ${shown[shown.length - 1]?.label}: ${shown.length} of ${months.length} months`}>
            <button type="button" className="mb-btn" disabled={stop - size <= 0} onClick={() => setEnd(Math.max(size, stop - step))} aria-label="Earlier months">
              ◀
            </button>
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={`mb-btn${range === r ? " is-on" : ""}`}
                aria-pressed={range === r}
                onClick={() => {
                  setRange(r);
                  setEnd(months.length);
                }}
              >
                {r === 0 ? "All" : `${r}M`}
              </button>
            ))}
            <button type="button" className="mb-btn" disabled={stop >= months.length} onClick={() => setEnd(Math.min(months.length, stop + step))} aria-label="Later months">
              ▶
            </button>
          </div>
        </div>
      </div>
      <div className="mb-plot" onMouseLeave={() => setHover(null)}>
        <div className="mb-axis num" aria-hidden="true">
          {[...ticks].reverse().map((t) => (
            <span key={t}>{short(t)}</span>
          ))}
        </div>
        <div className="mb-area">
          {ticks.slice(1).map((t) => (
            <i key={t} className="mb-grid" style={{ bottom: `${(100 * t) / top}%` }} />
          ))}
          <i className="mb-avg" style={{ bottom: `${(100 * avg) / top}%` }} />
          <div className="mb-cols">
            {shown.map((m, i) => {
              const t = m.f + m.s;
              return (
                <div
                  key={m.label}
                  className={`mb-col${hover !== null && hover !== i ? " is-dim" : ""}`}
                  onMouseEnter={() => setHover(i)}
                >
                  <div className="mb-stack" style={{ height: `${(100 * t) / top}%` }}>
                    {/* a long range keeps its totals for the hover card: they would overlap */}
                    {shown.length <= 14 || hover === i ? <span className="mb-total num">{shown.length > 14 ? short(t) : n0(t)}</span> : null}
                    {m.s > 0 ? <span className="mb-s" style={{ flexGrow: m.s }} /> : null}
                    {m.f > 0 ? <span className="mb-f" style={{ flexGrow: m.f }} /> : null}
                  </div>
                  <span className="mb-label">{i % every === 0 || i === shown.length - 1 ? m.label : ""}</span>
                </div>
              );
            })}
          </div>
          {h ? (
            <div className="mb-tip" style={{ left: `${((hover! + 0.5) / shown.length) * 100}%` }}>
              <b>{h.label}</b>
              <span>
                <i style={{ background: "var(--series-f, #e0b84e)" }} /> F <b className="num">{n0(h.f)}</b>
              </span>
              <span>
                <i style={{ background: "var(--series-s, #2f6fd6)" }} /> S <b className="num">{n0(h.s)}</b>
              </span>
              <span className="mb-tip-total">
                total <b className="num">{n0(h.f + h.s)}</b> {unit}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
