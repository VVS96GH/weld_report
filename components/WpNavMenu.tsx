"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { WP_NAV } from "@/lib/welder-perf-nav";

/**
 * The Welder Performance sections as drop-down pills (owner, 2026-10-14): each
 * section button opens its pages; the open section's button reads the page
 * shown. Closes on a pick, an outside click or Escape.
 */
export function WpNavMenu({ slug }: { slug: string | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="screen-tabs wp-nav" role="group" aria-label="Welder performance pages" ref={ref}>
      {WP_NAV.map((g) => {
        const current = g.pages.find((p) => p.slug === slug);
        const isOpen = open === g.group;
        const menuId = `wp-menu-${g.group.replace(/\s+/g, "-").toLowerCase()}`;
        return (
          <div key={g.group} className="wp-nav-group">
            <button
              type="button"
              className="report-pill wp-nav-trigger"
              aria-current={current ? "true" : undefined}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-controls={menuId}
              onClick={() => setOpen(isOpen ? null : g.group)}
            >
              {current ? current.label : g.group}
              <span aria-hidden="true" className="wp-nav-caret">
                ▾
              </span>
            </button>
            {isOpen ? (
              <div className="wp-nav-menu" id={menuId} role="menu" aria-label={g.group}>
                {g.pages.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/welder-performance/${p.slug}`}
                    role="menuitem"
                    className="wp-nav-item"
                    aria-current={p.slug === slug ? "page" : undefined}
                    onClick={() => setOpen(null)}
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
