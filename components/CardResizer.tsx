"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Hand-sized cards (owner, 2026-11-04). The ⤡ button in the header (LayoutEditButton) turns the
 * layout edit mode on: every table and chart card gets a dashed frame, and over it a grip at its
 * lower right corner; dragging the grip sets the card's width and height (charts redraw to fit),
 * a double click gives the automatic size back; a bar on top resets the whole page or ends the
 * mode (Esc too). Out of the mode nothing can be dragged by mistake. Kept in this browser, per
 * page and card.
 *
 * The grip is ONE element on <body>, placed over the card under the pointer: nothing is added
 * inside the page's own markup, so React's hydration of streamed parts never sees a stranger.
 */
const KEY = "card-size:";
const MIN_W = 220;
const MIN_H = 120;
const SEL = ".main-content .card, .main-content [data-card]";

type Size = { w?: number; h?: number };

const cards = () =>
  Array.from(document.querySelectorAll<HTMLElement>(SEL)).filter(
    (c) => !c.parentElement?.closest(".card, [data-card]") && !!c.querySelector("table, canvas, svg"),
  );

function cardKey(path: string, card: HTMLElement): string {
  const i = cards().indexOf(card);
  const title = card.querySelector(".card-header, .v2-card-h, h2, h3")?.textContent?.trim().slice(0, 60) ?? "";
  return `${KEY}${path}|${i}|${title}`;
}

function apply(card: HTMLElement, s: Size | null) {
  if (!s || (!s.w && !s.h)) {
    card.classList.remove("is-sized");
    card.style.removeProperty("width");
    card.style.removeProperty("height");
    return;
  }
  card.classList.add("is-sized");
  if (s.w) card.style.width = `${s.w}px`;
  if (s.h) card.style.height = `${s.h}px`;
}

function read(k: string): Size | null {
  try {
    const v = window.localStorage.getItem(k);
    return v ? (JSON.parse(v) as Size) : null;
  } catch {
    return null;
  }
}

function write(k: string, s: Size | null) {
  try {
    if (s) window.localStorage.setItem(k, JSON.stringify(s));
    else window.localStorage.removeItem(k);
  } catch {
    /* not kept */
  }
}

const EDIT = "data-layout-edit";
export const toggleLayoutEdit = () => {
  const d = document.documentElement;
  if (d.hasAttribute(EDIT)) d.removeAttribute(EDIT);
  else d.setAttribute(EDIT, "");
};

export function CardResizer() {
  const path = usePathname();
  useEffect(() => {
    const zoom = () => Number(document.documentElement.dataset.zoom) || 1;
    const grip = document.createElement("div");
    grip.className = "card-grip";
    grip.title = "Drag to resize · double-click: automatic size";
    document.body.appendChild(grip);
    let target: HTMLElement | null = null;
    let dragging = false;

    const editing = () => document.documentElement.hasAttribute(EDIT);
    const place = () => {
      if (!editing() || !target || !document.body.contains(target)) {
        grip.style.display = "none";
        return;
      }
      const r = target.getBoundingClientRect();
      grip.style.display = "block";
      grip.style.left = `${r.right - 16}px`;
      grip.style.top = `${r.bottom - 16}px`;
    };
    const over = (e: MouseEvent) => {
      if (!editing() || dragging || e.target === grip) return;
      const c = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(SEL) ?? null;
      const card = c && cards().includes(c) ? c : null;
      if (card !== target) {
        target = card;
        place();
      }
    };
    const down = (e: PointerEvent) => {
      if (!target) return;
      e.preventDefault();
      dragging = true;
      grip.setPointerCapture(e.pointerId);
      const card = target;
      const k = cardKey(path, card);
      const r = card.getBoundingClientRect();
      const z = zoom();
      const x0 = e.clientX;
      const y0 = e.clientY;
      let s: Size = {};
      const move = (ev: PointerEvent) => {
        s = {
          w: Math.max(MIN_W, Math.round((r.width + ev.clientX - x0) / z)),
          h: Math.max(MIN_H, Math.round((r.height + ev.clientY - y0) / z)),
        };
        apply(card, s);
        place();
      };
      const up = () => {
        dragging = false;
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", up);
        grip.removeEventListener("pointercancel", up);
        if (s.w || s.h) write(k, s);
        window.dispatchEvent(new Event("resize")); // charts and tables re-fit
      };
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", up);
      grip.addEventListener("pointercancel", up);
    };
    const reset = () => {
      if (!target) return;
      write(cardKey(path, target), null);
      apply(target, null);
      place();
      window.dispatchEvent(new Event("resize"));
    };
    grip.addEventListener("pointerdown", down);
    grip.addEventListener("dblclick", reset);
    document.addEventListener("mouseover", over);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);

    // the saved sizes, once the page has settled (after hydration: only inline styles change)
    const seen = new WeakSet<HTMLElement>();
    const restore = () => {
      for (const c of cards()) {
        if (seen.has(c)) continue;
        seen.add(c);
        const s = read(cardKey(path, c));
        if (s) apply(c, s);
      }
    };
    // the edit bar: reset this page, done
    const bar = document.createElement("div");
    bar.className = "layout-bar";
    bar.innerHTML =
      '<span><b>Layout edit</b> · drag a card\'s lower right corner · double-click it: automatic size</span>' +
      '<button type="button" class="ms-btn" data-act="reset">Reset this page</button>' +
      '<button type="button" class="ms-btn ms-btn--primary" data-act="done">Done</button>';
    bar.addEventListener("click", (e) => {
      const act = (e.target as HTMLElement).closest("button")?.dataset.act;
      if (act === "done") document.documentElement.removeAttribute(EDIT);
      if (act === "reset") {
        for (const c of cards()) {
          write(cardKey(path, c), null);
          apply(c, null);
        }
        window.dispatchEvent(new Event("resize"));
      }
    });
    document.body.appendChild(bar);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editing()) document.documentElement.removeAttribute(EDIT);
    };
    document.addEventListener("keydown", onKey);
    const modeWatch = new MutationObserver(() => {
      if (!editing()) target = null;
      place();
    });
    modeWatch.observe(document.documentElement, { attributes: true, attributeFilter: [EDIT] });

    const t1 = setTimeout(restore, 800);
    const t2 = setTimeout(restore, 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      grip.remove();
      bar.remove();
      modeWatch.disconnect();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mouseover", over);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [path]);
  return null;
}
