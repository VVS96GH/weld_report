"use client";

import { useIsAdmin } from "@/lib/me";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useKeepInView } from "@/components/useKeepInView";

type View = { id: number; name: string; query: string };

/** The welding pages share one list of views; every other report keeps its own. */
const viewKey = (pathname: string) => (pathname.startsWith("/welding/") ? "/welding" : pathname);
/** Compare queries regardless of param order. */
const norm = (q: string) => [...new URLSearchParams(q)].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");

/**
 * Saved views (owner, 2026-10-15): a named set of this page's filters, shared by
 * everyone who opens the report. One click applies it; "Save current filters"
 * stores the filters on screen; the link of a filtered page can be copied too.
 */
export function SavedViews() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  // saving / deleting shared views: administrators; everyone applies them
  const admin = useIsAdmin();
  const [views, setViews] = useState<View[] | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useKeepInView(panelRef, open);
  const key = viewKey(pathname);
  const current = norm(searchParams.toString());

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/views?page=${encodeURIComponent(key)}`, { cache: "no-store" });
      const body = (await r.json()) as { views?: View[] };
      setViews(body.views ?? []);
    } catch {
      setViews([]);
    }
  }, [key]);

  // first load of the list (later reloads come from the save / delete handlers)
  useEffect(() => {
    let alive = true;
    fetch(`/api/views?page=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ views?: View[] }>)
      .then((body) => {
        if (alive) setViews(body.views ?? []);
      })
      .catch(() => {
        if (alive) setViews([]);
      });
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = views?.find((v) => norm(v.query) === current && current !== "");

  async function save() {
    const n = name.trim();
    if (!n) return;
    const r = await fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: key, name: n, query: searchParams.toString() }),
    });
    setMsg(r.ok ? `Saved “${n}”.` : "Could not save the view.");
    setName("");
    await load();
  }

  async function remove(v: View) {
    await fetch(`/api/views?id=${v.id}`, { method: "DELETE" });
    await load();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMsg("Link copied.");
    } catch {
      setMsg(window.location.href);
    }
  }

  return (
    <div className="filter-group fviews" ref={ref}>
      <button
        type="button"
        className={`filter-select fchip-btn fviews-btn${active ? " is-set" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setMsg(null);
        }}
      >
        <span aria-hidden="true">★</span>
        <span className="ms-summary">{active ? active.name : "Views"}</span>
        <span aria-hidden="true" className="ms-caret">
          ▾
        </span>
      </button>
      {open ? (
        <div className="ms-panel fviews-panel" role="group" aria-label="Saved views" ref={panelRef}>
          <div className="ms-options">
            {views === null ? <p className="fviews-note">Loading…</p> : null}
            {views?.length === 0 ? <p className="fviews-note">No saved views yet.</p> : null}
            {views?.map((v) => (
              <div key={v.id} className={`fviews-item${active?.id === v.id ? " is-active" : ""}`}>
                <button
                  type="button"
                  className="fviews-apply"
                  onClick={() => {
                    setOpen(false);
                    router.push(v.query ? `${pathname}?${v.query}` : pathname);
                  }}
                >
                  {v.name}
                </button>
                {admin ? <button type="button" className="fviews-del" aria-label={`Delete view ${v.name}`} onClick={() => remove(v)}>
                  ×
                </button> : null}
              </div>
            ))}
          </div>
          {!admin ? null : current ? (
            <form
              className="fviews-save"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <input
                type="text"
                className="ms-search"
                placeholder="Name for the current filters"
                aria-label="Name of the new view"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button type="submit" className="ms-btn ms-btn--primary" disabled={!name.trim()}>
                Save
              </button>
            </form>
          ) : (
            // no filter picked yet: say how to get one instead of a dead input
            <p className="fviews-hint">
              To save a view, first pick filters with the <strong>FILTERS</strong> tab on the right edge of the screen, then come back here and
              name it.
            </p>
          )}
          <div className="ms-footer">
            <button type="button" className="ms-btn" onClick={copyLink}>
              Copy link
            </button>
            {msg ? <span className="fviews-note">{msg}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
