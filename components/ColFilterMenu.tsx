"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const BLANK_LABEL = "(Blank)";
import type { SortState as Sort } from "@/lib/table-sort";

export type ColFilter = {
  /** the column the menu sits on */
  col: number;
  /** the URL parameter of the picks (?wps=CS-01&wps=CS-02); the server counts the table again */
  param: string;
  /** every value of the column before this filter ("" = blank) */
  options: string[];
};

/**
 * A column's ▼ menu as on the Welding Statistics Dashboard's data grid (owner, 2026-11-03):
 * Sort A → Z / Z → A, Contains, a searchable list of the values, a pasted list (from Excel),
 * Clear / Apply. Weld Rej. Detail puts it on WPS No.
 */
export function ColFilterMenu({
  filter,
  label,
  sort,
  setSort,
}: {
  filter: ColFilter;
  label: string;
  sort: Sort;
  setSort: (s: Sort) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  // the page's own slicer param, comma-joined (components/FilterBar applyList)
  const value = (sp.get(filter.param) ?? "").split(",").filter((v) => filter.options.includes(v));
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const [picks, setPicks] = useState<string[]>(value);
  const [has, setHas] = useState("");
  const [q, setQ] = useState("");
  const [paste, setPaste] = useState(false);
  const [pasted, setPasted] = useState("");
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const toggleOpen = () => {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect();
      setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 336)), top: Math.min(r.bottom + 6, window.innerHeight - 120) });
      setPicks(value);
      setHas("");
      setQ("");
      setPaste(false);
      setPasted("");
    }
    setOpen((o) => !o);
  };

  const show = (v: string) => v || BLANK_LABEL;
  const shown = q.trim()
    ? filter.options.filter((v) => show(v).toLowerCase().includes(q.trim().toLowerCase()))
    : filter.options;
  const toggle = (v: string) => setPicks((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  const go = (next: string[]) => {
    const u = new URLSearchParams(sp.toString());
    if (next.length) u.set(filter.param, next.join(","));
    else u.delete(filter.param);
    const s = u.toString();
    router.push(s ? `${pathname}?${s}` : pathname, { scroll: false });
    setOpen(false);
  };
  const apply = () => {
    // ticks and the pasted list are picks; "Contains" keeps the values holding that text
    const lower = (s: string) => s.trim().toLowerCase();
    const pastedSet = new Set(
      paste
        ? pasted
            .split(/[\r\n\t,;]+/)
            .map(lower)
            .filter(Boolean)
        : [],
    );
    const fromPaste = filter.options.filter((v) => pastedSet.has(lower(v)));
    let next = [...new Set([...picks, ...fromPaste])];
    const h = lower(has);
    if (h) next = (next.length ? next : filter.options).filter((v) => show(v).toLowerCase().includes(h));
    if (h && next.length === 0) {
      setQ(has); // nothing holds that text: show it in the list (empty) instead of applying
      return;
    }
    // everything picked = no filter
    go(next.length === filter.options.length ? [] : next);
  };

  const on = value.length > 0 || sort?.col === filter.col;
  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={value.length ? `Filtered: ${value.length} of ${filter.options.length}` : "Sort and filter"}
        aria-label={`Sort and filter ${label}`}
        className={`mt-0.5 block w-full text-[9px] leading-none transition-opacity ${on ? "text-amber-300 opacity-100" : "opacity-45 hover:opacity-90"}`}
        style={{ textAlign: "start" }}
      >
        {value.length ? `▼ ${value.length}` : "▼"}
      </button>
      {/* drawn on <body>: no table scroll box, page zoom or header layer can cut or cover it */}
      {open
        ? createPortal(
        <div
          ref={panel}
          className="ms-panel dg-panel"
          role="dialog"
          aria-label={`Filter ${label}`}
          style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 1000, maxHeight: `calc(100vh - ${pos.top + 12}px)` }}
        >
          <div className="dg-panel-body">
            <div className="dg-sortrow" role="group" aria-label="Sort">
              {(["asc", "desc"] as const).map((d) => {
                const active = sort?.col === filter.col && sort.dir === d;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`ms-btn${active ? " ms-btn--primary" : ""}`}
                    aria-pressed={active}
                    onClick={() => setSort(active ? null : { col: filter.col, dir: d })}
                  >
                    {d === "asc" ? "Sort A → Z" : "Sort Z → A"}
                  </button>
                );
              })}
            </div>
            <label className="dg-has">
              Contains
              <input
                type="search"
                className="ms-search"
                placeholder="part of the text"
                value={has}
                onChange={(e) => setHas(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") apply();
                }}
              />
            </label>
            <div className="dg-values">
              <input
                type="search"
                className="ms-search"
                placeholder="Search values"
                aria-label="Search the values"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="ms-options">
                {shown.map((v) => (
                  <label className="ms-option" key={v}>
                    <input type="checkbox" checked={picks.includes(v)} onChange={() => toggle(v)} />
                    <span>{show(v)}</span>
                  </label>
                ))}
                {shown.length === 0 ? <p className="dg-none">No values.</p> : null}
              </div>
            </div>
            <button type="button" className="dg-link" onClick={() => setPaste((p) => !p)}>
              {paste ? "Hide the pasted list" : "Paste a list (from Excel)…"}
            </button>
            {paste ? (
              <textarea
                className="dg-paste"
                rows={5}
                placeholder="One value per line"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
            ) : null}
          </div>
          <div className="ms-footer">
            <button type="button" className="ms-btn" onClick={() => go([])}>
              Clear
            </button>
            <button type="button" className="ms-btn ms-btn--primary" onClick={apply}>
              Apply
            </button>
          </div>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
