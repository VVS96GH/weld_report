"use client";

import { useId, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { FilterWidget } from "@/lib/page-model";
import { MultiSelect, TreeMultiSelect } from "@/components/MultiSelect";

/**
 * Server-driven filters (flange dashboard): each FilterWidget is a labelled
 * <select>; choosing a value pushes the page URL with the updated search params
 * (values equal to "All" are dropped from the URL), so the server re-renders the
 * PageModel with the applied filters — no client-side aggregation. An aria-live
 * region announces the applied set for screen-reader users.
 */
/** URL value that selects rows whose parent (HA) is blank — the pbix slicer's "(Blank)". */
const BLANK_PARENT = "(Blank)";

/**
 * `alsoReset`: params of slicers rendered OUTSIDE the bar (the Welder
 * Performance Joint ID picker) that the Reset link clears too.
 */
export function FilterBar({ widgets, alsoReset = [] }: { widgets: FilterWidget[]; alsoReset?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const baseId = useId();

  if (widgets.length === 0) return null;

  function push(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function apply(id: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "All") next.delete(id);
    else next.set(id, value);
    push(next);
  }

  // A parent/child pair ("HA, Area Classification") is one grouped <select>: every
  // option carries "<parent>|<child>" (child "" = the whole parent), so one choice
  // sets both search params at once and a parent change can never leave a child
  // value that does not belong to it.
  function applyPair(parentId: string, childId: string, encoded: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (encoded === "All") {
      next.delete(parentId);
      next.delete(childId);
    } else {
      const sep = encoded.indexOf("|");
      const p = encoded.slice(0, sep);
      const c = encoded.slice(sep + 1);
      if (p === BLANK_PARENT) next.set(parentId, BLANK_PARENT);
      else next.set(parentId, p);
      if (c) next.set(childId, c);
      else next.delete(childId);
    }
    push(next);
  }

  // Multi-select slicers (page 1, 2026-10-14): values travel comma-joined in
  // the same params; no box ticked = the param is dropped = "All".
  const list = (v: string) => (v === "All" ? [] : v.split(",").filter(Boolean));
  function applyList(id: string, values: string[]) {
    const next = new URLSearchParams(searchParams.toString());
    if (values.length === 0) next.delete(id);
    else next.set(id, values.join(","));
    push(next);
  }
  function applyTree(parentId: string, childId: string, v: { has: string[]; pairs: string[] }) {
    const next = new URLSearchParams(searchParams.toString());
    if (v.has.length) next.set(parentId, v.has.join(","));
    else next.delete(parentId);
    if (v.pairs.length) next.set(childId, v.pairs.join(","));
    else next.delete(childId);
    push(next);
  }

  const applied = widgets.filter((w) => w.value !== "All");
  const outsideApplied = alsoReset.some((id) => searchParams.has(id));
  // Reset clears THIS bar's params only: a page may carry several bars (the
  // Errors page has one per check) and another bar's picks must survive.
  const resetParams = new URLSearchParams(searchParams.toString());
  for (const w of widgets) resetParams.delete(w.id);
  for (const id of alsoReset) resetParams.delete(id);
  const resetQs = resetParams.toString();
  const resetHref = resetQs ? `${pathname}?${resetQs}` : pathname;
  const announcement =
    applied.length === 0
      ? "Filters: all records"
      : `Filters applied: ${applied.map((w) => `${w.label} ${w.value.split(",").join(" or ")}`).join(", ")}`;

  return (
    <div className="filter-bar" role="group" aria-label="Report filters" aria-busy={pending}>
      {widgets.map((w) => {
        const selectId = `${baseId}-${w.id}`;
        // children are rendered inside their parent's grouped control
        if (w.parent && widgets.some((p) => p.id === w.parent)) return null;
        const child = widgets.find((c) => c.parent === w.id && c.options_by_parent);
        if (child && w.multi) {
          const byParent = child.options_by_parent ?? {};
          const groups = Object.keys(byParent)
            .sort((x, y) => (x === "" ? 1 : y === "" ? -1 : x.localeCompare(y)))
            .map((g) => ({ key: g === "" ? BLANK_PARENT : g, areas: byParent[g] ?? [] }));
          let has = list(w.value);
          let pairs = list(child.value);
          // pre-multi-select link form: ?ha=HA1&area=Train-8 Process
          if (has.length === 1 && pairs.length > 0 && pairs.every((p) => !p.includes(">"))) {
            pairs = pairs.map((a) => `${has[0]}>${a}`);
            has = [];
          }
          return (
            <TreeMultiSelect
              key={`${w.id}:${w.value}:${child.value}`}
              label={`${w.label}, ${child.label}`}
              groups={groups}
              value={{ has, pairs: pairs.filter((p) => p.includes(">")) }}
              onApply={(v) => applyTree(w.id, child.id, v)}
            />
          );
        }
        if (w.multi) {
          return (
            <MultiSelect
              key={`${w.id}:${w.value}`}
              label={w.label}
              options={w.options.filter((o) => o !== "All")}
              value={list(w.value)}
              onApply={(v) => applyList(w.id, v)}
            />
          );
        }
        if (child) {
          const byParent = child.options_by_parent ?? {};
          const parentValue = w.value === "All" ? "" : w.value;
          const encoded =
            w.value === "All" && child.value === "All" ? "All" : `${parentValue || BLANK_PARENT}|${child.value === "All" ? "" : child.value}`;
          const groups = Object.keys(byParent).sort((x, y) => (x === "" ? 1 : y === "" ? -1 : x.localeCompare(y)));
          return (
            <div className="filter-group filter-group--tree" key={w.id}>
              <label htmlFor={selectId}>
                {w.label}, {child.label}
              </label>
              <select id={selectId} name={w.id} className="filter-select" value={encoded} onChange={(e) => applyPair(w.id, child.id, e.target.value)}>
                <option value="All">All</option>
                {groups.map((g) => {
                  const key = g === "" ? BLANK_PARENT : g;
                  return (
                    <optgroup key={key} label={key}>
                      <option value={`${key}|`}>{key} — all areas</option>
                      {(byParent[g] ?? []).map((o, oi) => (
                        <option key={`${oi}-${o}`} value={`${key}|${o}`}>
                          {"\u2003"}{o}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          );
        }
        return (
          <div className="filter-group" key={w.id}>
            <label htmlFor={selectId}>{w.label}</label>
            <select
              id={selectId}
              name={w.id}
              className="filter-select"
              value={w.value}
              onChange={(e) => apply(w.id, e.target.value)}
            >
              {w.options.map((o, i) => (
                <option key={`${i}-${o}`} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        );
      })}
      {applied.length > 0 || outsideApplied ? (
        <Link href={resetHref} className="nav-btn filter-reset" aria-label="Reset all filters">
          &#10005; Reset
        </Link>
      ) : null}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}
