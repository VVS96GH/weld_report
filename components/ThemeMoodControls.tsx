"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  DEFAULT_DENSITY,
  DEFAULT_MOOD,
  DEFAULT_THEME,
  DENSITY_IDS,
  DENSITY_KEY,
  MOOD_IDS,
  MOOD_KEY,
  THEME_KEY,
  type DensityId,
  type MoodId,
  type ThemeId,
} from "@/lib/theme/axes";

// Swatch dots are the mood's own brand colours (presentation only — the three dots
// preview the palette the way the mockup's dropdown did). The T.EN dots are its
// layer-1 brand hexes: accent, coral, sage.
const MOODS: readonly { id: MoodId; icon: string; label: string; dots: readonly string[] }[] = [
  { id: "ten", icon: "\u{1F310}", label: "T.EN", dots: ["#0070ef", "#ee7766", "#80c7a0"] }, // token-lint: allow-hex — mood swatch
  { id: "pastel", icon: "\u{1F3A8}", label: "Pastel", dots: ["#ffadd8", "#ae9cff", "#b4fad9"] }, // token-lint: allow-hex — mood swatch
  { id: "ocean", icon: "\u{1F30A}", label: "Ocean", dots: ["#9ae9f5", "#6bbcff", "#5e81d1"] }, // token-lint: allow-hex — mood swatch
  { id: "desert", icon: "\u{1F3DC}\u{FE0F}", label: "Desert", dots: ["#ffe77d", "#ffd061", "#f0b860"] }, // token-lint: allow-hex — mood swatch
  { id: "upsidedown", icon: "\u{1F52E}", label: "Upside Down", dots: ["#a80000", "#003e7d", "#385b94"] }, // token-lint: allow-hex — mood swatch
  { id: "powerbi", icon: "\u{1F4CA}", label: "Power BI", dots: ["#ED7D31", "#70AD47", "#FFD966"] }, // token-lint: allow-hex — mood swatch
];

const DENSITIES: readonly { id: DensityId; label: string; hint: string }[] = [
  { id: "normal", label: "Normal", hint: "16 px" },
  { id: "compact", label: "Compact", hint: "14 px" },
  { id: "board", label: "Board", hint: "18 px — wall screens" },
];

// The <html> element's data-theme/data-mood/data-density attributes are the single
// source of truth: app/layout.tsx sets the defaults on the server, the pre-paint
// script in <head> applies the persisted values before hydration, this component
// and ChartCard read/write the same attributes. useSyncExternalStore subscribes to
// that external system directly, so nothing here ever needs setState in an effect.
const AXIS_ATTRS = ["data-theme", "data-mood", "data-density"];

function subscribeToHtmlAttrs(callback: () => void) {
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.attributeName && AXIS_ATTRS.includes(m.attributeName))) callback();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: AXIS_ATTRS });
  return () => observer.disconnect();
}

function getThemeSnapshot(): ThemeId {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}
function getMoodSnapshot(): MoodId {
  const v = document.documentElement.getAttribute("data-mood");
  return (MOOD_IDS as readonly string[]).includes(v ?? "") ? (v as MoodId) : DEFAULT_MOOD;
}
function getDensitySnapshot(): DensityId {
  const v = document.documentElement.getAttribute("data-density");
  return (DENSITY_IDS as readonly string[]).includes(v ?? "") ? (v as DensityId) : DEFAULT_DENSITY;
}
const getServerTheme = (): ThemeId => DEFAULT_THEME;
const getServerMood = (): MoodId => DEFAULT_MOOD;
const getServerDensity = (): DensityId => DEFAULT_DENSITY;

function persist(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore: preference just won't persist across reloads
  }
}

/** Theme toggle + mood/density menu, persisted to localStorage, applied to <html>. */
export function ThemeMoodControls() {
  const theme = useSyncExternalStore(subscribeToHtmlAttrs, getThemeSnapshot, getServerTheme);
  const mood = useSyncExternalStore(subscribeToHtmlAttrs, getMoodSnapshot, getServerMood);
  const density = useSyncExternalStore(subscribeToHtmlAttrs, getDensitySnapshot, getServerDensity);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function applyTheme(next: ThemeId) {
    document.documentElement.setAttribute("data-theme", next);
    persist(THEME_KEY, next);
  }
  function applyMood(next: MoodId) {
    document.documentElement.setAttribute("data-mood", next);
    persist(MOOD_KEY, next);
    setOpen(false);
  }
  function applyDensity(next: DensityId) {
    document.documentElement.setAttribute("data-density", next);
    persist(DENSITY_KEY, next);
  }

  const activeMood = MOODS.find((m) => m.id === mood) ?? MOODS[0];

  const onRadioKey = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  return (
    <>
      <div className="mood-toggle-wrapper" ref={wrapperRef}>
        <button
          type="button"
          className="header-btn"
          aria-label="Theme and density menu"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden="true">{activeMood.icon}</span>
        </button>
        <div className={`mood-dropdown${open ? " open" : ""}`} role="menu" aria-label="Theme and density">
          <div className="mood-section-label" aria-hidden="true">
            Theme
          </div>
          {MOODS.map((m) => (
            <div
              key={m.id}
              role="menuitemradio"
              aria-checked={m.id === mood}
              tabIndex={0}
              className={`mood-option${m.id === mood ? " active" : ""}`}
              onClick={() => applyMood(m.id)}
              onKeyDown={onRadioKey(() => applyMood(m.id))}
            >
              <span className="mood-option-icon" aria-hidden="true">
                {m.icon}
              </span>
              <span className="mood-option-label">{m.label}</span>
              <span className="mood-option-colors" aria-hidden="true">
                {m.dots.map((c, i) => (
                  <span key={i} className="mood-color-dot" style={{ background: c }} />
                ))}
              </span>
            </div>
          ))}
          <div className="mood-section-label" aria-hidden="true">
            Density
          </div>
          {DENSITIES.map((d) => (
            <div
              key={d.id}
              role="menuitemradio"
              aria-checked={d.id === density}
              tabIndex={0}
              className={`mood-option${d.id === density ? " active" : ""}`}
              onClick={() => applyDensity(d.id)}
              onKeyDown={onRadioKey(() => applyDensity(d.id))}
              title={d.hint}
            >
              <span className="mood-option-label">{d.label}</span>
              <span className="mood-option-hint num" aria-hidden="true">
                {d.hint.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="header-btn"
        aria-label={theme === "dark" ? "Switch to light scheme" : "Switch to dark scheme"}
        onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}
      >
        <span aria-hidden="true">{theme === "dark" ? "\u{1F319}" : "\u{2600}\u{FE0F}"}</span>
      </button>
    </>
  );
}
