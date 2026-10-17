"use client";

import { Fragment, useState, type CSSProperties, type ReactNode } from "react";

import { SortButton } from "@/components/SortButton";
import { setColPref, useTablePrefs, type ColPref } from "@/lib/col-prefs";
import type { SortState } from "@/lib/table-sort";

/**
 * Props for a header <th> whose width was set by hand: fixed width, the header
 * text wraps inside it (Power BI's behaviour when a column is narrowed).
 */
export function colThProps(prefs: Record<string, ColPref>, col: string): { style?: CSSProperties; "data-sized"?: "" } {
  const w = prefs[col]?.width;
  return w ? { style: { width: w, minWidth: w, maxWidth: w }, "data-sized": "" } : {};
}

/** "A|B" → A, line break, B (the header line-break convention used elsewhere). */
function lines(text: string) {
  return text.split("|").map((l, i) => (
    <Fragment key={i}>
      {i > 0 ? <br /> : null}
      {l}
    </Fragment>
  ));
}

/**
 * A header cell's content: the label (double-click renames it for everyone; an
 * empty name restores the original; "|" breaks the line), the sort arrow, and a
 * grip on the right edge that drags the column width (double-click: auto width).
 */
export function ColHead({
  table,
  col,
  index,
  sort,
  onSort,
  children,
}: {
  table: string;
  col: string;
  index: number;
  sort?: SortState;
  onSort?: (col: number) => void;
  children: ReactNode;
}) {
  const pref = useTablePrefs(table)[col];
  const [editing, setEditing] = useState(false);
  const label = pref?.label;

  const commit = (value: string) => {
    setEditing(false);
    const v = value.trim();
    if (v === (label ?? col)) return;
    setColPref(table, col, { label: v && v !== col ? v : null });
  };

  const startResize = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.closest("th");
    if (!th) return;
    const grip = e.currentTarget;
    grip.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const w0 = th.getBoundingClientRect().width;
    let w = Math.round(w0);
    const move = (ev: PointerEvent) => {
      w = Math.max(24, Math.min(1200, Math.round(w0 + ev.clientX - x0)));
      setColPref(table, col, { width: w }, false);
    };
    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
      setColPref(table, col, { width: w });
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  };

  return (
    <>
      {editing ? (
        <input
          className="th-rename"
          defaultValue={label ?? col}
          aria-label={`Rename column ${col}`}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e.currentTarget.value);
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
        />
      ) : (
        <span className="th-label" title={`${label ? `Original: ${col}\n` : ""}Double-click to rename`} onDoubleClick={() => setEditing(true)}>
          {label ? <span className="th-text th-text--renamed">{lines(label)}</span> : children}
        </span>
      )}
      {onSort && sort !== undefined ? <SortButton col={index} sort={sort} onSort={onSort} label={label ?? col} /> : null}
      <span
        className="th-resize"
        aria-hidden="true"
        title="Drag to resize · double-click for auto width"
        onPointerDown={startResize}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setColPref(table, col, { width: null });
        }}
      />
    </>
  );
}
