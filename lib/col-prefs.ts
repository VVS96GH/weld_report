"use client";

/**
 * Client store of the shared column preferences (app/api/col-prefs): loaded once
 * per page view, updated optimistically, saved per change.
 */
import { useSyncExternalStore } from "react";

export type ColPref = { label?: string | null; width?: number | null };
type Prefs = Record<string, Record<string, ColPref>>;

let prefs: Prefs = {};
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  fetch("/api/col-prefs")
    .then((r) => (r.ok ? r.json() : { prefs: [] }))
    .then((body: { prefs: { table_key: string; col: string; label: string | null; width: number | null }[] }) => {
      const next: Prefs = {};
      for (const p of body.prefs ?? []) (next[p.table_key] ??= {})[p.col] = { label: p.label, width: p.width };
      prefs = { ...next, ...prefs };
      emit();
    })
    .catch(() => {});
}

function subscribe(l: () => void) {
  listeners.add(l);
  load();
  return () => listeners.delete(l);
}

const EMPTY: Record<string, ColPref> = {};

/** The preferences of one table (keyed by tableKeyOf its original columns). */
export function useTablePrefs(table: string): Record<string, ColPref> {
  return useSyncExternalStore(
    subscribe,
    () => prefs[table] ?? EMPTY,
    () => EMPTY,
  );
}

/** Change one column; `save: false` only previews (a drag in progress). */
export function setColPref(table: string, col: string, patch: ColPref, save = true) {
  const cur = prefs[table]?.[col] ?? {};
  prefs = { ...prefs, [table]: { ...prefs[table], [col]: { ...cur, ...patch } } };
  emit();
  if (!save) return;
  fetch("/api/col-prefs", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, col, ...patch }),
  }).catch(() => {});
}

/** One table identity for every page that shows the same columns. */
export const tableKeyOf = (columns: readonly string[]) => columns.join("\u001f");
