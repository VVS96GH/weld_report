"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useKeepInView } from "@/components/useKeepInView";
import { displayHref, WELDING_PAGE_TITLES, WELDING_TOTAL_PAGES } from "@/lib/welding-pages";

/**
 * Prev / page select / Next across the reading order. Between welding pages the
 * filters on screen go along (owner, 2026-10-15: pick CCC once, every page opens
 * filtered); the other reports have their own slicers, so they open clean.
 */
/** Pages 10..51 grouped by sub-contractor in the jump list (owner, 2026-10-15; 48-51,
 *  "Weld Rejection Detail - <sub>", join their sub-contractor too). */
const GROUPED_FROM = 10;
const GROUPED_TO = 51;
const GROUP_ORDER = ["CCC", "GAC", "TEKFEN", "MEDGULF"];

type PageOption = { page: number } | { group: string; pages: number[] };

function pageOptions(): PageOption[] {
  const groups = new Map<string, number[]>(GROUP_ORDER.map((g) => [g, []]));
  const out: PageOption[] = [];
  let placed = false;
  WELDING_PAGE_TITLES.forEach((t, i) => {
    const n = i + 1;
    const up = t.toUpperCase();
    const sub = GROUP_ORDER.find((g) => up.startsWith(g) || up.endsWith(`- ${g}`));
    if (n >= GROUPED_FROM && n <= GROUPED_TO && sub) {
      groups.get(sub)!.push(n);
      if (!placed) {
        placed = true;
        // the groups take the place of the first grouped page, in GROUP_ORDER
        out.push({ group: "__groups__", pages: [] });
      }
      return;
    }
    out.push({ page: n });
  });
  return out.flatMap((o): PageOption[] =>
    "group" in o ? GROUP_ORDER.filter((g) => groups.get(g)!.length).map((g) => ({ group: g, pages: groups.get(g)! })) : [o],
  );
}

/**
 * Inside a sub-contractor group, the RT % pages come in sub-groups (owner,
 * 2026-10-15: "RT 100%" holds its NDE status and its PWHT status page), in the
 * order the report has them; pages without an RT % stay at the group's level.
 */
function rtSplit(pages: number[]): (number | { rt: string; pages: number[] })[] {
  const out: (number | { rt: string; pages: number[] })[] = [];
  for (const n of pages) {
    const rt = /\bRT\s*(\d+)\s*%/i.exec(WELDING_PAGE_TITLES[n - 1] ?? "")?.[1];
    if (!rt) {
      out.push(n);
      continue;
    }
    const sub = out.find((x): x is { rt: string; pages: number[] } => typeof x !== "number" && x.rt === rt);
    if (sub) sub.pages.push(n);
    else out.push({ rt, pages: [n] });
  }
  return out;
}

/**
 * The page jump list as a drop-down panel like the filter lists (owner,
 * 2026-10-15): it glides down, is opaque, and the sub-contractor groups start
 * collapsed under ⊞. Same place in the bar as the old <select>.
 */
function PageJump({ current, href }: { current: number; href: (n: number) => string }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useKeepInView(panel, open);
  // where there is a mouse the menu opens on hover (owner, 2026-10-15), after a
  // short dwell, and closes a moment after the pointer leaves; a tap elsewhere
  const [hover, setHover] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const set = () => setHover(mq.matches);
    const raf = requestAnimationFrame(set);
    mq.addEventListener("change", set);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", set);
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);
  const onEnter = () => {
    if (!hover) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => setOpen(true), 120);
  };
  const onLeave = () => {
    if (!hover) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 450);
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
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
    if (open) panel.current?.querySelector<HTMLElement>("[aria-current='page']")?.scrollIntoView({ block: "nearest" });
  }, [open]);
  const item = (n: number, child = false, grandchild = false) => (
    <Link
      key={n}
      href={href(n)}
      className={`page-jump-item${child ? " page-jump-item--child" : ""}${grandchild ? " page-jump-item--grandchild" : ""}${n === current ? " is-current" : ""}`}
      aria-current={n === current ? "page" : undefined}
      onClick={() => setOpen(false)}
    >
      {`${n}. ${WELDING_PAGE_TITLES[n - 1]}`}
    </Link>
  );
  return (
    <div className="page-jump" ref={box} onMouseEnter={onEnter} onMouseLeave={onLeave}>
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
        <span className="page-jump-label">{`${current}. ${WELDING_PAGE_TITLES[current - 1]}`}</span>
        <span aria-hidden="true" className="ms-caret">
          ▾
        </span>
      </button>
      {open ? (
        <div className="ms-panel page-jump-panel" ref={panel} role="navigation" aria-label="Pages">
          {pageOptions().map((o) => {
            if (!("group" in o)) return item(o.page);
            const isOpen = Boolean(expanded[o.group]);
            return (
              <div key={o.group} className="page-jump-group">
                <button
                  type="button"
                  className="page-jump-group-btn"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded((e) => ({ ...e, [o.group]: !e[o.group] }))}
                >
                  <span aria-hidden="true" className="page-jump-toggle">
                    {isOpen ? "⊟" : "⊞"}
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
                            onClick={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
                          >
                            <span aria-hidden="true" className="page-jump-toggle">
                              {subOpen ? "⊟" : "⊞"}
                            </span>
                            {`RT ${x.rt}%`}
                            <span className="page-jump-count">{x.pages.length}</span>
                          </button>
                          {subOpen ? x.pages.map((n) => item(n, true, true)) : null}
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
    return qs && pathname.startsWith("/welding/") && href.startsWith("/welding/") ? `${href}?${qs}` : href;
  };
  return (
    <div className="nav-controls">
      {current > 1 ? (
        <Link href={carry(current - 1)} className="nav-btn" aria-label="Previous page">
          &#9664; Prev
        </Link>
      ) : (
        <button type="button" className="nav-btn" disabled aria-label="Previous page">
          &#9664; Prev
        </button>
      )}
      <PageJump current={current} href={carry} />
      {current < WELDING_TOTAL_PAGES ? (
        <Link href={carry(current + 1)} className="nav-btn" aria-label="Next page">
          Next &#9654;
        </Link>
      ) : (
        <button type="button" className="nav-btn" disabled aria-label="Next page">
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
    const vals = v.split(",").filter(Boolean).map((x) => (x.includes(">") ? x.slice(x.indexOf(">") + 1) : x));
    parts.push(vals.length > 3 ? `${vals.slice(0, 2).join(", ")} +${vals.length - 2}` : vals.join(", "));
  }
  if (!parts.length) return null;
  const text = parts.join(" · ");
  return (
    <span className="nav-filter-summary" title={text}>
      · {text}
    </span>
  );
}
