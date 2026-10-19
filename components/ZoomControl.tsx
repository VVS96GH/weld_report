"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const MIN = 30;
const MAX = 200;
const KEY = "page-zoom";
type Mode = "fit" | number;

/** The page content the zoom applies to (header and nav stay as they are). */
const target = () => document.querySelector<HTMLElement>(".main-content");

/**
 * The pbix-style zoom at the bottom right (owner, 2026-10-19): − / slider / +,
 * the percentage, "fit to window" (the whole page on one screen) and "original
 * size". The choice is remembered in this browser; "fit" is re-done on every page
 * and window resize.
 */
export function ZoomControl() {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode>(100);
  const [pct, setPct] = useState(100);

  const apply = useCallback((p: number) => {
    const el = target();
    if (el) el.style.zoom = p === 100 ? "" : String(p / 100);
    setPct(p);
  }, []);

  /** The largest zoom (up to 100 %) at which the page content fits the window. */
  const fit = useCallback(() => {
    const el = target();
    if (!el) return;
    el.style.zoom = "";
    const top = el.getBoundingClientRect().top;
    const availH = window.innerHeight - top - 8;
    const availW = document.documentElement.clientWidth;
    const h = el.scrollHeight;
    const w = el.scrollWidth;
    const p = Math.max(MIN, Math.min(100, Math.floor(Math.min(availH / h, availW / w) * 100)));
    apply(p);
  }, [apply]);

  const choose = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(KEY, String(m));
    } catch {
      /* storage blocked: the zoom lasts this page only */
    }
    if (m === "fit") fit();
    else apply(m);
  };

  // the remembered choice, after the page has rendered
  useEffect(() => {
    let m: Mode = 100;
    try {
      const v = localStorage.getItem(KEY);
      if (v === "fit") m = "fit";
      else if (v && Number.isFinite(Number(v))) m = Math.max(MIN, Math.min(MAX, Number(v)));
    } catch {
      /* default 100 % */
    }
    const t = setTimeout(() => {
      setMode(m);
      if (m === "fit") fit();
      else apply(m);
    }, 600);
    return () => clearTimeout(t);
  }, [pathname, apply, fit]);

  useEffect(() => {
    if (mode !== "fit") return;
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mode, fit]);

  const step = (d: number) => choose(Math.max(MIN, Math.min(MAX, Math.round((pct + d) / 10) * 10)));

  return (
    <div className="zoom-bar" role="group" aria-label="Page zoom">
      <button type="button" className="zoom-btn" aria-label="Zoom out" onClick={() => step(-10)}>
        −
      </button>
      <input
        type="range"
        className="zoom-range"
        min={MIN}
        max={MAX}
        step={5}
        value={pct}
        aria-label="Zoom"
        onChange={(e) => choose(Number(e.target.value))}
      />
      <button type="button" className="zoom-btn" aria-label="Zoom in" onClick={() => step(10)}>
        +
      </button>
      <span className="zoom-pct num">{pct}%</span>
      <button
        type="button"
        className={`zoom-btn zoom-fit${mode === "fit" ? " is-on" : ""}`}
        title="Fit to window"
        aria-label="Fit to window"
        aria-pressed={mode === "fit"}
        onClick={() => choose("fit")}
      >
        ⤢
      </button>
      <button type="button" className="zoom-btn" title="Original size (100%)" aria-label="Original size" onClick={() => choose(100)}>
        1:1
      </button>
    </div>
  );
}
