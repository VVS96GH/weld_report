"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Check-box slicers, the way the pbix renders them (owner request 2026-10-14):
 * a closed control that summarises the pick, and a panel of check boxes.
 *
 * Changes are collected in a draft and applied once — when the panel closes
 * (click outside, the Apply button) — because every apply is a server
 * re-render of the page; ticking three boxes must not cost three of them.
 * Escape closes the panel and throws the draft away.
 *
 * No box ticked means "All", exactly like an untouched pbix slicer.
 */

export const BLANK_GROUP = "(Blank)";
/** Separator of an `HA>Area` pick — mirrors PAIR_SEP in lib/metrics/scope.ts. */
const PAIR = ">";

function summary(values: string[], all = "All"): string {
  if (values.length === 0) return all;
  if (values.length <= 2) return values.join(", ");
  return `${values.length} selected`;
}

/** Shared shell: the closed control, the panel, outside-click and Escape handling. */
function useDropdown(onClose: (apply: boolean) => void) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        closeRef.current(true);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        closeRef.current(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

/** Long lists (joint numbers, report numbers) get a search box above them. */
const SEARCH_FROM = 12;

function Panel({
  children,
  onApply,
  onClear,
  open,
  labelledBy,
  search,
}: {
  children: React.ReactNode;
  onApply: () => void;
  onClear: () => void;
  open: boolean;
  labelledBy: string;
  search?: { value: string; onChange: (v: string) => void };
}) {
  if (!open) return null;
  return (
    <div className="ms-panel" role="group" aria-labelledby={labelledBy}>
      {search ? (
        <input
          type="search"
          className="ms-search"
          placeholder="Search"
          aria-label="Search the options"
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          autoFocus
        />
      ) : null}
      <div className="ms-options">{children}</div>
      <div className="ms-footer">
        <button type="button" className="ms-btn" onClick={onClear}>
          Clear
        </button>
        <button type="button" className="ms-btn ms-btn--primary" onClick={onApply}>
          Apply
        </button>
      </div>
    </div>
  );
}

/** A flat check-box slicer (Sub-Contractor, Weld Type, Weld Cat). */
export function MultiSelect({
  label,
  options,
  value,
  onApply,
}: {
  label: string;
  options: string[];
  value: string[];
  onApply: (values: string[]) => void;
}) {
  const baseId = useId();
  const [draft, setDraft] = useState<string[]>(value);
  const valueKey = value.join("\u0000");
  const draftKey = draft.join("\u0000");
  const close = (apply: boolean) => {
    if (apply && draftKey !== valueKey) onApply(draft);
    else setDraft(value);
  };
  const { open, setOpen, ref } = useDropdown(close);
  const [q, setQ] = useState("");
  const shownOptions = q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options;
  const toggle = (o: string) =>
    setDraft((d) => (d.includes(o) ? d.filter((x) => x !== o) : options.filter((x) => x === o || d.includes(x))));

  return (
    <div className="filter-group ms" ref={ref}>
      <label id={`${baseId}-l`} htmlFor={`${baseId}-b`}>
        {label}
      </label>
      <button
        id={`${baseId}-b`}
        type="button"
        className="filter-select ms-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          if (open) close(true);
          else setDraft(value);
          setOpen(!open);
        }}
      >
        <span className="ms-summary">{summary(open ? draft : value)}</span>
        <span aria-hidden="true" className="ms-caret">
          ▾
        </span>
      </button>
      <Panel
        open={open}
        labelledBy={`${baseId}-l`}
        onClear={() => setDraft([])}
        onApply={() => {
          setOpen(false);
          close(true);
        }}
        search={options.length >= SEARCH_FROM ? { value: q, onChange: setQ } : undefined}
      >
        <label className="ms-option ms-option--all">
          <input type="checkbox" checked={draft.length === 0} onChange={() => setDraft([])} />
          <span>Select all</span>
        </label>
        {shownOptions.map((o) => (
          <label className="ms-option" key={o}>
            <input type="checkbox" checked={draft.includes(o)} onChange={() => toggle(o)} />
            <span>{o}</span>
          </label>
        ))}
      </Panel>
    </div>
  );
}

/**
 * The two-field "HA, Area Classification" slicer as a check-box tree.
 *
 * A ticked HA is the whole HA; a ticked area under an un-ticked HA is that
 * area within that HA only (`HA>Area`). Ticking every area of an HA collapses
 * to the HA itself, and un-ticking one area of a whole HA expands it to its
 * remaining areas — the pbix hierarchy slicer's behaviour.
 */
export function TreeMultiSelect({
  label,
  groups,
  value,
  onApply,
}: {
  label: string;
  /** HA (or BLANK_GROUP) → its areas, in display order. */
  groups: { key: string; areas: string[] }[];
  value: { has: string[]; pairs: string[] };
  onApply: (next: { has: string[]; pairs: string[] }) => void;
}) {
  const baseId = useId();
  const [draft, setDraft] = useState(value);
  const key = (v: { has: string[]; pairs: string[] }) => `${v.has.join("\u0000")}|${v.pairs.join("\u0000")}`;
  const close = (apply: boolean) => {
    if (apply && key(draft) !== key(value)) onApply(draft);
    else setDraft(value);
  };
  const { open, setOpen, ref } = useDropdown(close);

  const pairOf = (g: string, a: string) => `${g}${PAIR}${a}`;
  const toggleHa = (g: string) =>
    setDraft((d) =>
      d.has.includes(g)
        ? { ...d, has: d.has.filter((x) => x !== g) }
        : { has: [...d.has, g], pairs: d.pairs.filter((p) => !p.startsWith(`${g}${PAIR}`)) },
    );
  const toggleArea = (g: string, a: string, areas: string[]) =>
    setDraft((d) => {
      const p = pairOf(g, a);
      if (d.has.includes(g)) {
        // un-tick one area of a whole HA → keep its other areas
        return {
          has: d.has.filter((x) => x !== g),
          pairs: [...d.pairs, ...areas.filter((x) => x !== a).map((x) => pairOf(g, x))],
        };
      }
      if (d.pairs.includes(p)) return { ...d, pairs: d.pairs.filter((x) => x !== p) };
      const pairs = [...d.pairs, p];
      const mine = areas.filter((x) => pairs.includes(pairOf(g, x)));
      // every area ticked → the whole HA
      if (areas.length > 0 && mine.length === areas.length) {
        return { has: [...d.has, g], pairs: pairs.filter((x) => !x.startsWith(`${g}${PAIR}`)) };
      }
      return { ...d, pairs };
    });

  const shown = open ? draft : value;
  const picked = [...shown.has, ...shown.pairs.map((p) => p.replace(PAIR, " ▸ "))];
  const [q, setQ] = useState("");
  const size = groups.reduce((n, g) => n + 1 + g.areas.length, 0);
  const needle = q.toLowerCase();
  const shownGroups = q
    ? groups
        .map((g) =>
          g.key.toLowerCase().includes(needle) ? g : { ...g, areas: g.areas.filter((a) => a.toLowerCase().includes(needle)) },
        )
        .filter((g) => g.key.toLowerCase().includes(needle) || g.areas.length > 0)
    : groups;

  return (
    <div className="filter-group filter-group--tree ms" ref={ref}>
      <label id={`${baseId}-l`} htmlFor={`${baseId}-b`}>
        {label}
      </label>
      <button
        id={`${baseId}-b`}
        type="button"
        className="filter-select ms-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          if (open) close(true);
          else setDraft(value);
          setOpen(!open);
        }}
      >
        <span className="ms-summary">{summary(picked)}</span>
        <span aria-hidden="true" className="ms-caret">
          ▾
        </span>
      </button>
      <Panel
        open={open}
        labelledBy={`${baseId}-l`}
        onClear={() => setDraft({ has: [], pairs: [] })}
        onApply={() => {
          setOpen(false);
          close(true);
        }}
        search={size >= SEARCH_FROM ? { value: q, onChange: setQ } : undefined}
      >
        <label className="ms-option ms-option--all">
          <input
            type="checkbox"
            checked={draft.has.length === 0 && draft.pairs.length === 0}
            onChange={() => setDraft({ has: [], pairs: [] })}
          />
          <span>Select all</span>
        </label>
        {shownGroups.map(({ key: g, areas }) => {
          const whole = draft.has.includes(g);
          const some = !whole && draft.pairs.some((p) => p.startsWith(`${g}${PAIR}`));
          return (
            <div className="ms-tree-group" key={g}>
              <label className="ms-option ms-option--parent">
                <input
                  type="checkbox"
                  checked={whole}
                  ref={(el) => {
                    if (el) el.indeterminate = some;
                  }}
                  onChange={() => toggleHa(g)}
                />
                <span>{g}</span>
              </label>
              {areas.map((a) => (
                <label className="ms-option ms-option--child" key={a}>
                  <input
                    type="checkbox"
                    checked={whole || draft.pairs.includes(pairOf(g, a))}
                    onChange={() => toggleArea(g, a, areas)}
                  />
                  <span>{a}</span>
                </label>
              ))}
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
