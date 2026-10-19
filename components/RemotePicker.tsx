"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useKeepInView } from "@/components/useKeepInView";

/**
 * A check-box slicer whose options are too many to ship with the page (joints,
 * RT reports, ISOs…): they come from `endpoint` page by page, under the OTHER
 * slicers in the URL, and a search box narrows them. The picks go to the URL
 * param `param`, comma-joined, like every other slicer.
 *
 * `endpoint` gets the page's query string (without `param`) plus `q`, and
 * answers `{ [listKey]: string[], more: boolean }`.
 */
export function RemotePicker({
  param,
  label,
  value,
  endpoint,
  listKey = "values",
  noun = "values",
}: {
  param: string;
  label: string;
  value: string[];
  endpoint: string;
  listKey?: string;
  noun?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<string[]>(value);
  const [list, setList] = useState<{ items: string[]; more: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useKeepInView(panelRef, open);
  const reqId = useRef(0);
  const dom = `rp-${param}`;

  function apply(next: string[]) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next.length) sp.set(param, next.join(","));
    else sp.delete(param);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  // fetch the options for the current query, debounced
  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete(param);
      if (q.trim()) sp.set("q", q.trim());
      const sep = endpoint.includes("?") ? "&" : "?";
      try {
        const r = await fetch(`${endpoint}${sep}${sp.toString()}`);
        const body = (await r.json()) as Record<string, unknown>;
        const items = Array.isArray(body[listKey]) ? (body[listKey] as string[]) : [];
        if (id === reqId.current) setList({ items, more: body.more === true });
      } catch {
        if (id === reqId.current) setList({ items: [], more: false });
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, endpoint, listKey, param, searchParams]);

  // close on outside click (applies) / Escape (discards), like the other slicers
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        if (draft.join(",") !== value.join(",")) apply(draft);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setDraft(value);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });

  const toggle = (j: string) => setDraft((d) => (d.includes(j) ? d.filter((x) => x !== j) : [...d, j]));
  const shown = open ? draft : value;
  const summary = shown.length === 0 ? "All" : shown.length <= 2 ? shown.join(", ") : `${shown.length} selected`;
  // picks stay on top even when the search does not match them
  const options = list ? [...draft.filter((j) => !list.items.includes(j)), ...list.items] : draft;

  return (
    <div className="filter-group ms wp-joint" ref={ref}>
      <label id={`${dom}-l`} htmlFor={`${dom}-b`}>
        {label}
      </label>
      <button
        id={`${dom}-b`}
        type="button"
        className="filter-select ms-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            setOpen(false);
            if (draft.join(",") !== value.join(",")) apply(draft);
          } else {
            setDraft(value);
            setOpen(true);
          }
        }}
      >
        <span className="ms-summary">{summary}</span>
        <span aria-hidden="true" className="ms-caret">
          ▾
        </span>
      </button>
      {open ? (
        <div className="ms-panel wp-joint-panel" role="group" aria-labelledby={`${dom}-l`} ref={panelRef}>
          <input
            type="search"
            className="ms-search"
            placeholder={`Search ${noun}`}
            aria-label={`Search the ${noun}`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="ms-options">
            <label className="ms-option ms-option--all">
              <input type="checkbox" checked={draft.length === 0} onChange={() => setDraft([])} />
              <span>Select all</span>
            </label>
            {options.map((j) => (
              <label className="ms-option" key={j}>
                <input type="checkbox" checked={draft.includes(j)} onChange={() => toggle(j)} />
                <span>{j}</span>
              </label>
            ))}
            {loading ? <p className="wp-loading">Loading…</p> : null}
            {!loading && list && list.items.length === 0 ? <p className="wp-loading">No {noun} under these filters.</p> : null}
            {!loading && list?.more ? (
              <p className="wp-loading">
                First {list.items.length} {noun} shown — type to narrow the list.
              </p>
            ) : null}
          </div>
          <div className="ms-footer">
            <button type="button" className="ms-btn" onClick={() => setDraft([])}>
              Clear
            </button>
            <button
              type="button"
              className="ms-btn ms-btn--primary"
              onClick={() => {
                setOpen(false);
                if (draft.join(",") !== value.join(",")) apply(draft);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
