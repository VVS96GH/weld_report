"use client";

import type { SortState } from "@/lib/table-sort";

/** The small arrow under a column header (lib/table-sort.ts nextSort cycles it). */
export function SortButton({ col, sort, onSort, label }: { col: number; sort: SortState; onSort: (col: number) => void; label?: string }) {
  const dir = sort && sort.col === col ? sort.dir : null;
  return (
    <button
      type="button"
      className={`th-sort${dir ? " th-sort--on" : ""}`}
      aria-label={`Sort${label ? ` ${label}` : ""}${dir === "desc" ? ", largest first" : dir === "asc" ? ", smallest first" : ""}`}
      title={dir === "desc" ? "Largest → smallest (click: smallest → largest)" : dir === "asc" ? "Smallest → largest (click: original order)" : "Sort largest → smallest"}
      onClick={(e) => {
        e.stopPropagation();
        onSort(col);
      }}
    >
      <span aria-hidden="true">{dir === "asc" ? "▲" : "▼"}</span>
    </button>
  );
}
