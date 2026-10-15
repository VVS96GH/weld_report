"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useKeepInView } from "@/components/useKeepInView";
import { menuNeighbours, pageOptions, rtSplit } from "@/lib/page-order";
import { displayHref, WELDING_PAGE_TITLES } from "@/lib/welding-pages";

/**
 * Prev / page select / Next across the reading order. Between welding pages the
 * filters on screen go along (owner, 2026-10-15: pick CCC once, every page opens
 * filtered); the other reports have their own slicers, so they open clean.
 */
/**
 * The page jump list as a drop-down panel like the filter lists (owner,
 * 2026-10-15): it glides down, is opaque, and the sub-contractor groups start
 * collapsed under +. Same place in the bar as the old <select>.
 */
function PageJump({
  current,
  href,
}: {
  current: number;
  href: (n: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useKeepInView(panel, open);
  // where there is a mouse the menu opens on hover (owner, 2026-10-15), after a
  // short dwell; a tap elsewhere
  const [hover, setHover] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const set = () => setHover(mq.matches);
    const raf = requestAnimationFrame(set);
    mq.addEventListener("change", set);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", set);
      if (openTimer.current) clearTimeout(openTimer.current);
    };
  }, []);
  const onEnter = () => {
    if (!hover) return;
    openTimer.current = setTimeout(() => setOpen(true), 120);
  };
  // leaving does not close it (owner, 2026-10-15): only a click elsewhere,
  // Escape or picking a page does; it just cancels an open still pending
  const onLeave = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  // the list scrolls to the open page when it opens
  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector<HTMLElement>("[aria-current='page']")
        ?.scrollIntoView({ block: "nearest" });
  }, [open]);
  const item = (n: number, child = false, grandchild = false) => (
    <Link
      key={n}
      href={href(n)}
      className={`page-jump-item${child ? " page-jump-item--child" : ""}${grandchild ? " page-jump-item--grandchild" : ""}${n === current ? " is-current" : ""}`}
      aria-current={n === current ? "page" : undefined}
      onClick={() => setOpen(false)}
    >
      {WELDING_PAGE_TITLES[n - 1]}
    </Link>
  );
  return (
    <div
      className="page-jump"
      ref={box}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <button
        id="page-select"
        type="button"
        className="page-select page-jump-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Jump to page"
        data-value={current}
        onClick={() => setOpen((o) => (hover ? true : !o))}
      >
        <span className="page-jump-label">
          {WELDING_PAGE_TITLES[current - 1]}
        </span>
        <span aria-hidden="true" className="ms-caret">
          ▾
        </span>
      </button>
      {open ? (
        <div
          className="ms-panel page-jump-panel"
          ref={panel}
          role="navigation"
          aria-label="Pages"
        >
          {pageOptions().map((o) => {
            if (!("group" in o)) return item(o.page);
            const isOpen = Boolean(expanded[o.group]);
            return (
              <div key={o.group} className="page-jump-group">
                <button
                  type="button"
                  className="page-jump-group-btn"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setExpanded((e) => ({ ...e, [o.group]: !e[o.group] }))
                  }
                >
                  <span aria-hidden="true" className="page-jump-toggle">
                    {isOpen ? "−" : "+"}
                  </span>
                  {o.group}
                  <span className="page-jump-count">{o.pages.length}</span>
                </button>
                {isOpen
                  ? rtSplit(o.pages).map((x) => {
                      if (typeof x === "number") return item(x, true);
                      const key = `${o.group}|${x.rt}`;
                      const subOpen = Boolean(expanded[key]);
                      return (
                        <div key={key} className="page-jump-sub">
                          <button
                            type="button"
                            className="page-jump-group-btn page-jump-sub-btn"
                            aria-expanded={subOpen}
                            onClick={() =>
                              setExpanded((e) => ({ ...e, [key]: !e[key] }))
                            }
                          >
                            <span
                              aria-hidden="true"
                              className="page-jump-toggle"
                            >
                              {subOpen ? "−" : "+"}
                            </span>
                            {x.rt}
                            <span className="page-jump-count">
                              {x.pages.length}
                            </span>
                          </button>
                          {subOpen
                            ? x.pages.map((n) => item(n, true, true))
                            : null}
                        </div>
                      );
                    })
                  : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function PageNavControls({ current }: { current: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const carry = (n: number) => {
    const href = displayHref(n);
    return qs &&
      pathname.startsWith("/welding/") &&
      href.startsWith("/welding/")
      ? `${href}?${qs}`
      : href;
  };
  // Prev / Next walk the menu's order, not the page numbers (owner, 2026-10-15)
  const { prev, next } = menuNeighbours(current);
  return (
    <div className="nav-controls">
      {prev ? (
        <Link href={carry(prev)} className="nav-btn" aria-label="Previous page">
          &#9664; Prev
        </Link>
      ) : (
        <button
          type="button"
          className="nav-btn"
          disabled
          aria-label="Previous page"
        >
          &#9664; Prev
        </button>
      )}
      <PageJump current={current} href={carry} />
      {next ? (
        <Link href={carry(next)} className="nav-btn" aria-label="Next page">
          Next &#9654;
        </Link>
      ) : (
        <button
          type="button"
          className="nav-btn"
          disabled
          aria-label="Next page"
        >
          Next &#9654;
        </button>
      )}
    </div>
  );
}

/** Params that are not slicers: never shown in the summary. */
const NOT_FILTERS = new Set(["as_of", "page"]);

/**
 * The applied filters next to the page title ("· CCC, GAC · BW"), so a
 * screenshot always says what it shows. An `HA>Area` pick reads as the area.
 */
export function FilterSummary() {
  const searchParams = useSearchParams();
  const parts: string[] = [];
  for (const [k, v] of searchParams) {
    if (NOT_FILTERS.has(k) || k.includes(".") || !v) continue;
    const vals = v
      .split(",")
      .filter(Boolean)
      .map((x) => (x.includes(">") ? x.slice(x.indexOf(">") + 1) : x));
    parts.push(
      vals.length > 3
        ? `${vals.slice(0, 2).join(", ")} +${vals.length - 2}`
        : vals.join(", "),
    );
  }
  if (!parts.length) return null;
  const text = parts.join(" · ");
  return (
    <span className="nav-filter-summary" title={text}>
      · {text}
    </span>
  );
}
