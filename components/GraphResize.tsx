"use client";

import { useIsAdmin } from "@/lib/me";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";

import { GRAPH_LAYOUT_DEFAULT, GRAPH_LAYOUT_LIMITS, clampLayout, type GraphLayout } from "@/lib/graph-layout";

/**
 * Resizable Graph page (owner, 2026-10-20). "Размеры" turns on drag handles on
 * every chart edge and the column splitters, plus a small panel with the exact
 * numbers; "Сохранить" writes them to data/graph-layout.json for this page.
 */
type Ctx = {
  edit: boolean;
  drag: (key: keyof GraphLayout, e: ReactPointerEvent<HTMLElement>, opts?: { axis: "x" | "y"; pctOf?: string; invert?: boolean }) => void;
};
const LayoutCtx = createContext<Ctx>({ edit: false, drag: () => {} });

const KEYS = Object.keys(GRAPH_LAYOUT_DEFAULT) as (keyof GraphLayout)[];

function vars(l: GraphLayout): CSSProperties {
  return {
    "--g-left": `${l.left}%`,
    "--g-status-h": `${l.status}px`,
    "--g-rate1-h": `${l.rate1}px`,
    "--g-rate2-h": `${l.rate2}px`,
    "--g-blog-h": `${l.blog}px`,
    "--g-blog-left": `${l.blogLeft}%`,
    "--g-donut-h": `${l.donut}px`,
    "--g-kpi-w": `${l.kpi}px`,
    "--g-table-scale": String(l.table / 100),
  } as CSSProperties;
}

export function GraphResize({ children }: { children: ReactNode }) {
  const pageKey = usePathname() ?? "graph";
  const [layout, setLayout] = useState<GraphLayout>(GRAPH_LAYOUT_DEFAULT);
  const [edit, setEdit] = useState(false);
  // the graph sizes are shared: administrators edit them
  const admin = useIsAdmin();
  const [state, setState] = useState<"" | "dirty" | "saving" | "saved" | "error">("");
  const root = useRef<HTMLDivElement>(null);
  // the panel moves by its title bar, so it never sits on the chart being sized
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const movePanel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const panel = e.currentTarget.parentElement;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setPos({ x: Math.max(0, ev.clientX - dx), y: Math.max(0, ev.clientY - dy) });
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  useEffect(() => {
    let live = true;
    fetch("/api/graph-layout")
      .then((r) => r.json())
      .then((all: Record<string, Record<string, unknown>>) => {
        const v = all[pageKey] ?? all["*"];
        if (live && v) setLayout(clampLayout(v));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pageKey]);

  const set = useCallback((k: keyof GraphLayout, v: number) => {
    setLayout((l) => clampLayout({ ...l, [k]: v }));
    setState("dirty");
  }, []);

  const drag = useCallback<Ctx["drag"]>(
    (key, e, opts = { axis: "y" }) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      const box = (opts.pctOf ? el.closest<HTMLElement>(opts.pctOf) : null) ?? root.current;
      if (!box) return;
      // CSS zoom on the page: screen px → CSS px
      const scale = box.getBoundingClientRect().width / (box.offsetWidth || 1) || 1;
      const start = opts.axis === "x" ? e.clientX : e.clientY;
      const from = layout[key];
      el.setPointerCapture(e.pointerId);
      document.body.classList.add(opts.axis === "x" ? "g-dragging-x" : "g-dragging-y");
      const move = (ev: PointerEvent) => {
        let d = ((opts.axis === "x" ? ev.clientX : ev.clientY) - start) / scale;
        if (opts.invert) d = -d;
        set(key, opts.pctOf ? from + (d / (box.offsetWidth || 1)) * 100 : from + d);
      };
      const up = () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        document.body.classList.remove("g-dragging-x", "g-dragging-y");
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    },
    [layout, set],
  );

  async function save(next: GraphLayout | null) {
    setState("saving");
    try {
      const r = await fetch("/api/graph-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pageKey, layout: next }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setState("saved");
    } catch {
      setState("error");
    }
  }

  const ctx = useMemo(() => ({ edit, drag }), [edit, drag]);

  return (
    <LayoutCtx.Provider value={ctx}>
      <div ref={root} className={`pv-graph-wrap${edit ? " is-editing" : ""}`} style={vars(layout)}>
        {admin ? (
          <button type="button" className={`g-edit-toggle${edit ? " is-on" : ""}`} onClick={() => setEdit((v) => !v)}>
            {edit ? "Готово" : "⇲ Размеры"}
          </button>
        ) : null}
        {children}
        {edit ? (
          <div
            className="g-panel"
            role="dialog"
            aria-label="Размеры"
            style={pos ? { left: pos.x, top: pos.y, bottom: "auto" } : undefined}
          >
            <div className="g-panel-head" onPointerDown={movePanel} title="Перетащите панель">
              ⠿ Размеры графиков и таблиц
            </div>
            {KEYS.map((k) => {
              const [lo, hi, label] = GRAPH_LAYOUT_LIMITS[k];
              return (
                <label key={k} className="g-panel-row">
                  <span>{label}</span>
                  <input type="range" min={lo} max={hi} step={1} value={layout[k]} onChange={(e) => set(k, Number(e.target.value))} />
                  <input
                    type="number"
                    min={lo}
                    max={hi}
                    value={layout[k]}
                    onChange={(e) => set(k, Number(e.target.value))}
                    className="g-panel-num"
                  />
                </label>
              );
            })}
            <div className="g-panel-foot">
              <button
                type="button"
                className="ms-btn"
                onClick={() => {
                  setLayout(GRAPH_LAYOUT_DEFAULT);
                  setState("dirty");
                }}
              >
                Сброс
              </button>
              <button type="button" className="ms-btn ms-btn--primary" disabled={state === "saving"} onClick={() => save(layout)}>
                Сохранить
              </button>
            </div>
            <p className="g-panel-msg">
              {state === "dirty"
                ? "Есть несохранённые изменения"
                : state === "saving"
                  ? "Сохраняю…"
                  : state === "saved"
                    ? "Сохранено"
                    : state === "error"
                      ? "Не удалось сохранить"
                      : "Тяните синие ручки на краях графиков"}
            </p>
          </div>
        ) : null}
      </div>
    </LayoutCtx.Provider>
  );
}

/** A drag handle: "y" on a card's bottom edge, "x" on a column's right (or, inverted, left) edge. */
export function GHandle({
  k,
  axis = "y",
  pctOf,
  invert,
  side,
}: {
  k: keyof GraphLayout;
  axis?: "x" | "y";
  pctOf?: string;
  invert?: boolean;
  side?: "left" | "right";
}) {
  const { edit, drag } = useContext(LayoutCtx);
  if (!edit) return null;
  return (
    <div
      className={`g-handle g-handle-${axis}${side ? ` g-handle-${side}` : ""}`}
      title={GRAPH_LAYOUT_LIMITS[k][2]}
      onPointerDown={(e) => drag(k, e, { axis, pctOf, invert })}
    />
  );
}
