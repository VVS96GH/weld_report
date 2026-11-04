"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const MIN = 30;
const MAX = 200;
type Mode = "fit" | number;

/**
 * The device class (owner, 2026-11-04: phones, iPads and laptops adapt by themselves):
 * phone  < 768 px wide: the page re-flows into one column at 100 % (styles/responsive.css),
 *                       "fit" never shrinks it; pinch-zoom stays the phone's own;
 * tablet < 1280 px, or a touch screen up to 1400 px: "fit" fits the WIDTH only, the page scrolls;
 * laptop / desktop: as before, "fit" fits the whole page, never below READABLE by itself.
 * Same logic on the Welding Statistics Platform.
 */
type Device = "phone" | "tablet" | "desktop";
function deviceClass(): Device {
  const w = window.innerWidth;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (w < 768) return "phone";
  if (w < 1280 || (touch && w <= 1400)) return "tablet";
  return "desktop";
}
const READABLE = 60;
/** Remembered per device class: a phone's choice never changes the PC's. */
const keyFor = (d: Device) => (d === "desktop" ? "page-zoom" : `page-zoom:${d}`);

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
    // charts read it to keep their labels readable when the page is shrunk
    document.documentElement.dataset.zoom = String(p / 100);
    window.dispatchEvent(new Event("page-zoom"));
    setPct(p);
  }, []);

  /** The largest zoom (up to 100 %) at which the page content fits the window. */
  const fit = useCallback(() => {
    const el = target();
    if (!el) return;
    const d = deviceClass();
    document.documentElement.dataset.device = d;
    el.style.zoom = "";
    if (d === "phone") {
      apply(100);
      return;
    }
    const top = el.getBoundingClientRect().top;
    const availH = window.innerHeight - top - 8;
    const availW = el.clientWidth || document.documentElement.clientWidth;
    const h = el.scrollHeight;
    const w = el.scrollWidth;
    const k = d === "tablet" ? availW / w : Math.min(availH / h, availW / w);
    const p = Math.max(READABLE, Math.min(100, Math.floor(k * 100)));
    apply(p);
  }, [apply]);

  const choose = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(keyFor(deviceClass()), String(m));
    } catch {
      /* storage blocked: the zoom lasts this page only */
    }
    if (m === "fit") fit();
    else apply(m);
  };

  // the remembered choice, after the page has rendered
  useEffect(() => {
    const d = deviceClass();
    document.documentElement.dataset.device = d;
    // a phone or tablet opens fitted: its own re-flow, or the width
    let m: Mode = d === "desktop" ? 100 : "fit";
    try {
      const v = localStorage.getItem(keyFor(d));
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
