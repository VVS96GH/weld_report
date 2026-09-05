"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const MOODS = [
  { id: "pastel", icon: "\u{1F3A8}", label: "Pastel", dots: ["#ffadd8", "#ae9cff", "#b4fad9"] },
  { id: "ocean", icon: "\u{1F30A}", label: "Ocean", dots: ["#9ae9f5", "#6bbcff", "#5e81d1"] },
  { id: "desert", icon: "\u{1F3DC}\u{FE0F}", label: "Desert", dots: ["#ffe77d", "#ffd061", "#f0b860"] },
  { id: "upsidedown", icon: "\u{1F52E}", label: "Upside Down", dots: ["#a80000", "#003e7d", "#385b94"] },
  { id: "powerbi", icon: "\u{1F4CA}", label: "Power BI", dots: ["#ED7D31", "#70AD47", "#FFD966"] },
] as const;

type MoodId = (typeof MOODS)[number]["id"];

// The mockup's `<html data-mood>` ships as "pastel" and its `currentMood` JS
// fallback (`|| 'powerbi'`) never actually fires because that attribute is always
// present — so "pastel" is the mockup's real default, not "powerbi". See the
// CHECKPOINT deviations note in the final report.
const DEFAULT_MOOD: MoodId = "pastel";
const DEFAULT_THEME: "dark" | "light" = "dark";

const THEME_KEY = "weld-report-theme";
const MOOD_KEY = "weld-report-mood";

// The <html> element's data-theme/data-mood attributes are the single source of
// truth (app/layout.tsx sets the defaults on the server; applyTheme/applyMood below
// and ChartCard both read/write the same attributes). useSyncExternalStore subscribes
// to that external system directly, so the effect that applies a stored localStorage
// preference on mount only ever mutates the DOM — it never calls setState itself,
// which keeps the react-hooks/set-state-in-effect rule happy (and stays correct: the
// subscription below re-renders whenever the attribute actually changes).
function subscribeToHtmlAttrs(callback: () => void) {
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.attributeName === "data-theme" || m.attributeName === "data-mood")) {
      callback();
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-mood"],
  });
  return () => observer.disconnect();
}

function getThemeSnapshot(): "dark" | "light" {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}
function getMoodSnapshot(): MoodId {
  const v = document.documentElement.getAttribute("data-mood");
  return MOODS.some((m) => m.id === v) ? (v as MoodId) : DEFAULT_MOOD;
}
function getServerTheme(): "dark" | "light" {
  return DEFAULT_THEME;
}
function getServerMood(): MoodId {
  return DEFAULT_MOOD;
}

/** Theme toggle + mood dropdown, persisted to localStorage, applied to <html>. */
export function ThemeMoodControls() {
  const theme = useSyncExternalStore(subscribeToHtmlAttrs, getThemeSnapshot, getServerTheme);
  const mood = useSyncExternalStore(subscribeToHtmlAttrs, getMoodSnapshot, getServerMood);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Apply any stored preference once, on mount only (guarded: localStorage can throw
  // or be unavailable in private-browsing / restricted contexts). The <html> element
  // already carries the same defaults from app/layout.tsx, so skipping this on the
  // server render (and only running it after mount) never causes a hydration mismatch.
  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(THEME_KEY);
      if (storedTheme === "dark" || storedTheme === "light") {
        document.documentElement.setAttribute("data-theme", storedTheme);
      }
      const storedMood = window.localStorage.getItem(MOOD_KEY);
      if (storedMood && MOODS.some((m) => m.id === storedMood)) {
        document.documentElement.setAttribute("data-mood", storedMood);
      }
    } catch {
      // localStorage unavailable: keep the server-rendered defaults.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  function applyTheme(next: "dark" | "light") {
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore: preference just won't persist across reloads
    }
  }

  function applyMood(next: MoodId) {
    document.documentElement.setAttribute("data-mood", next);
    try {
      window.localStorage.setItem(MOOD_KEY, next);
    } catch {
      // ignore: preference just won't persist across reloads
    }
    setOpen(false);
  }

  const activeMood = MOODS.find((m) => m.id === mood) ?? MOODS[0];

  return (
    <>
      <div className="mood-toggle-wrapper" ref={wrapperRef}>
        <button
          type="button"
          className="header-btn"
          aria-label="Change color mood"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden="true">{activeMood.icon}</span>
        </button>
        <div className={`mood-dropdown${open ? " open" : ""}`} role="menu">
          {MOODS.map((m) => (
            <div
              key={m.id}
              role="menuitemradio"
              aria-checked={m.id === mood}
              tabIndex={0}
              className={`mood-option${m.id === mood ? " active" : ""}`}
              onClick={() => applyMood(m.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  applyMood(m.id);
                }
              }}
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
        </div>
      </div>
      <button
        type="button"
        className="header-btn"
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}
      >
        <span aria-hidden="true">{theme === "dark" ? "\u{1F319}" : "\u{2600}\u{FE0F}"}</span>
      </button>
    </>
  );
}
