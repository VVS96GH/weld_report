"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FilterBar } from "@/components/FilterBar";
import { SavedViews } from "@/components/SavedViews";
import type { FilterWidget } from "@/lib/page-model";

/** One applied pick shown on the page, with × to clear its params. */
export type EdgeChip = { label: string; value: string; ids: string[] };

/**
 * A page's slicers behind a "FILTERS" tab on the right edge of the window
 * (owner, 2026-10-15): hovering the tab (a tap where there is no mouse) slides
 * the panel out; leaving it slides it back. The page itself shows only the
 * saved views and the applied picks as chips. The slicers inside are the same
 * FilterBar, so the URL params, and every number, are unchanged.
 *
 * Slicers whose label says "status" are grouped under STATUS. `extra` adds a
 * control of the page's own (the Welder Performance Joint ID picker) under them.
 * Pages whose slicers are not chip slicers (plain selects) keep the inline bar.
 */
export function EdgeFilters({
  widgets,
  extra,
  actions,
}: {
  widgets: FilterWidget[];
  extra?: { node: ReactNode; ids: string[]; chips: EdgeChip[] };
  /** page buttons shown next to Views (the flange page's SCDB download) */
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  // the tab, scrim and panel are portalled to <body>: inside the page they would
  // sit in its stacking context (the page fade-in) and under the header
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const set = () => setHover(mq.matches);
    const raf = requestAnimationFrame(() => {
      set();
      setPortal(document.body);
    });
    mq.addEventListener("change", set);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", set);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (openTimer.current) clearTimeout(openTimer.current);
    },
    [],
  );

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    if (!hover) return;
    cancelClose();
    closeTimer.current = setTimeout(() => {
      const el = panelRef.current;
      // keep it open while a list is open or the user types in a search box
      const busy =
        el &&
        (el.querySelector(".ms-panel") ||
          (document.activeElement instanceof HTMLInputElement &&
            el.contains(document.activeElement)));
      if (!busy) setOpen(false);
    }, 450);
  };

  if (widgets.length === 0 && !extra) return null;
  // plain <select> slicers (the fixture build) stay in the inline bar
  if (widgets.some((w) => !w.multi))
    return <FilterBar widgets={widgets} views />;

  const isStatus = (label: string) => /status/i.test(label);
  const main = widgets.filter((w) => !isStatus(w.label));
  const status = widgets.filter((w) => isStatus(w.label));
  const short = (v: string) => {
    const vals = v
      .split(",")
      .map((x) => (x.includes(">") ? x.slice(x.indexOf(">") + 1) : x));
    return vals.length <= 2 ? vals.join(", ") : `${vals.length} selected`;
  };
  const chips: EdgeChip[] = [
    ...widgets
      .filter((w) => w.value !== "All")
      .map((w) => ({ label: w.label, value: w.value, ids: [w.id] })),
    ...(extra?.chips ?? []),
  ];
  const count = chips.length;
  const clear = (ids: string[]) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const id of ids) next.delete(id);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="fdrawer-bar">
      <SavedViews />
      {actions}
      {chips.map((c) => (
        <span key={c.ids.join("+")} className="fchip-static">
          <span className="fchip-label">{c.label}:</span> {short(c.value)}
          <button
            type="button"
            className="fchip-clear"
            aria-label={`Clear ${c.label}`}
            onClick={() => clear(c.ids)}
          >
            ×
          </button>
        </span>
      ))}
      {portal
        ? createPortal(
            <>
              <button
                type="button"
                className={`fdrawer-open fdrawer-tab${count ? " is-set" : ""}`}
                aria-expanded={open}
                aria-controls="edge-filter-panel"
                onMouseEnter={() => {
                  if (!hover) return;
                  cancelClose();
                  // a short dwell, so a pointer passing by does not throw the panel open
                  openTimer.current = setTimeout(() => setOpen(true), 120);
                }}
                onMouseLeave={() => {
                  if (openTimer.current) clearTimeout(openTimer.current);
                  scheduleClose();
                }}
                onClick={() => setOpen((o) => !o)}
              >
                <span aria-hidden="true" className="fdrawer-tab-icon">
                  ⚙
                </span>
                <span className="fdrawer-tab-text">
                  FILTERS{count ? ` (${count})` : ""}
                </span>
              </button>
              {open && !hover ? (
                <div
                  className="fdrawer-scrim"
                  aria-hidden="true"
                  onClick={() => setOpen(false)}
                />
              ) : null}
              <aside
                id="edge-filter-panel"
                ref={panelRef}
                className={`fdrawer${open ? " is-open" : ""}`}
                aria-label="Filters"
                aria-hidden={!open}
                inert={!open}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <div className="fdrawer-head">
                  <h3>Filters</h3>
                  <button
                    type="button"
                    className="fchip-clear fdrawer-x"
                    aria-label="Close filters"
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </button>
                </div>
                {main.length ? (
                  <FilterBar widgets={main} layout="stack" showReset={false} />
                ) : null}
                {status.length ? (
                  <section
                    className="fdrawer-section"
                    aria-labelledby="edge-status-head"
                  >
                    <h4 id="edge-status-head" className="fdrawer-section-head">
                      STATUS
                    </h4>
                    <FilterBar
                      widgets={status}
                      layout="stack"
                      showReset={false}
                    />
                  </section>
                ) : null}
                {extra ? (
                  <div className="fdrawer-section">{extra.node}</div>
                ) : null}
                <div className="fdrawer-foot">
                  {count ? (
                    <button
                      type="button"
                      className="filter-reset fbar-clear"
                      onClick={() =>
                        clear([
                          ...widgets.map((w) => w.id),
                          ...(extra?.ids ?? []),
                        ])
                      }
                    >
                      Clear all
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    className="ms-btn ms-btn--primary fdrawer-done"
                    onClick={() => setOpen(false)}
                  >
                    Show results
                  </button>
                </div>
              </aside>
            </>,
            portal,
          )
        : null}
    </div>
  );
}
