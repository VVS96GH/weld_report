"use client";

import { useId, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { FilterWidget } from "@/lib/page-model";

/**
 * Server-driven filters (flange dashboard): each FilterWidget is a labelled
 * <select>; choosing a value pushes the page URL with the updated search params
 * (values equal to "All" are dropped from the URL), so the server re-renders the
 * PageModel with the applied filters — no client-side aggregation. An aria-live
 * region announces the applied set for screen-reader users.
 */
export function FilterBar({ widgets }: { widgets: FilterWidget[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const baseId = useId();

  if (widgets.length === 0) return null;

  function apply(id: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "All") next.delete(id);
    else next.set(id, value);
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  const applied = widgets.filter((w) => w.value !== "All");
  const announcement =
    applied.length === 0
      ? "Filters: all records"
      : `Filters applied: ${applied.map((w) => `${w.label} ${w.value}`).join(", ")}`;

  return (
    <div className="filter-bar" role="group" aria-label="Report filters" aria-busy={pending}>
      {widgets.map((w) => {
        const selectId = `${baseId}-${w.id}`;
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
              {w.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        );
      })}
      {applied.length > 0 ? (
        <Link href={pathname} className="nav-btn filter-reset" aria-label="Reset all filters">
          &#10005; Reset
        </Link>
      ) : null}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}
