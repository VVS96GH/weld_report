"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { PDF_SECTIONS } from "@/lib/pdf-catalog";

/**
 * Header PDF button and its small menu (owner, 2026-10-19):
 *   - "This page": the page on screen, same filters, theme and mood (app/api/pdf);
 *   - "Report": the ticked pages, one PDF page each, merged into one file
 *     (app/api/pdf/report). Every section is ticked by default except Errors and
 *     Data; single Welding pages can be (un)ticked under "pages…". The choice is
 *     kept in this browser.
 */
const STORE = "pdf-pages";

function defaults(): Set<string> {
  return new Set(PDF_SECTIONS.filter((s) => s.defaultOn).flatMap((s) => s.pages.map((p) => p.path)));
}

function themeParams() {
  const h = document.documentElement;
  return {
    theme: h.getAttribute("data-theme") ?? "",
    mood: h.getAttribute("data-mood") ?? "",
    density: h.getAttribute("data-density") ?? "",
  };
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function nameOf(r: Response, fallback: string) {
  const m = /filename\*=UTF-8''([^;]+)/.exec(r.headers.get("Content-Disposition") ?? "");
  return m ? decodeURIComponent(m[1]!) : fallback;
}

export function PdfButton() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(defaults);
  const [expand, setExpand] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "page" | "report">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // the last choice, from this browser
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = window.localStorage.getItem(STORE);
        if (v) setPicked(new Set(JSON.parse(v) as string[]));
      } catch {
        /* defaults */
      }
    });
    return () => clearTimeout(t);
  }, []);
  const keep = (next: Set<string>) => {
    setPicked(next);
    try {
      window.localStorage.setItem(STORE, JSON.stringify([...next]));
    } catch {
      /* not kept */
    }
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const chosen = useMemo(
    () => PDF_SECTIONS.flatMap((s) => s.pages.filter((p) => picked.has(p.path)).map((p) => p.path)),
    [picked],
  );

  function toggleSection(id: string, on: boolean) {
    const s = PDF_SECTIONS.find((x) => x.id === id)!;
    const next = new Set(picked);
    for (const p of s.pages) {
      if (on) next.add(p.path);
      else next.delete(p.path);
    }
    keep(next);
  }
  function togglePage(path: string) {
    const next = new Set(picked);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    keep(next);
  }

  async function thisPage() {
    setBusy("page");
    setMsg("Готовлю PDF этой страницы…");
    try {
      const q = new URLSearchParams({ path: window.location.pathname + window.location.search, ...themeParams() });
      const r = await fetch(`/api/pdf?${q}`);
      if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${r.status}`);
      save(await r.blob(), nameOf(r, "page.pdf"));
      setMsg(null);
    } catch (e) {
      setMsg(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function report() {
    if (!chosen.length) return;
    setBusy("report");
    setMsg(`Собираю отчёт: 0 из ${chosen.length}…`);
    try {
      const r = await fetch("/api/pdf/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: chosen, ...themeParams() }),
      });
      const start = (await r.json()) as { id?: string; total?: number; error?: string };
      if (!r.ok || !start.id) throw new Error(start.error ?? `HTTP ${r.status}`);
      for (;;) {
        await new Promise((res) => setTimeout(res, 1500));
        const s = (await (await fetch(`/api/pdf/report?id=${start.id}`)).json()) as {
          done: number;
          total: number;
          ready: boolean;
          error: string | null;
        };
        if (s.error) throw new Error(s.error);
        if (s.ready) break;
        setMsg(`Собираю отчёт: ${s.done} из ${s.total}…`);
      }
      const f = await fetch(`/api/pdf/report?id=${start.id}&download=1`);
      if (!f.ok) throw new Error(`HTTP ${f.status}`);
      save(await f.blob(), nameOf(f, "report.pdf"));
      setMsg(`Готово: ${chosen.length} стр.`);
    } catch (e) {
      setMsg(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="pdf-btn-wrapper" ref={ref}>
      <button
        type="button"
        className={`header-btn pdf-btn${busy ? " is-running" : ""}`}
        aria-label="Сохранить в PDF"
        aria-expanded={open}
        title="Сохранить в PDF"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{busy ? "…" : "PDF"}</span>
      </button>
      {open ? (
        <div className="pdf-menu" role="dialog" aria-label="PDF">
          <button type="button" className="ms-btn ms-btn--primary pdf-menu-wide" disabled={busy !== null} onClick={thisPage}>
            Эта страница
          </button>
          <div className="pdf-menu-head">Отчёт: выбранные страницы</div>
          <ul className="pdf-menu-list">
            {PDF_SECTIONS.map((s) => {
              const n = s.pages.filter((p) => picked.has(p.path)).length;
              const all = n === s.pages.length;
              return (
                <li key={s.id}>
                  <label className="pdf-menu-row">
                    <input
                      type="checkbox"
                      checked={n > 0}
                      ref={(el) => {
                        if (el) el.indeterminate = n > 0 && !all;
                      }}
                      onChange={(e) => toggleSection(s.id, e.target.checked)}
                    />
                    <span>{s.label}</span>
                    <span className="pdf-menu-n">
                      {n}/{s.pages.length}
                    </span>
                    {s.pages.length > 1 ? (
                      <button
                        type="button"
                        className="pdf-menu-more"
                        onClick={(e) => {
                          e.preventDefault();
                          setExpand(expand === s.id ? null : s.id);
                        }}
                      >
                        {expand === s.id ? "скрыть" : "страницы…"}
                      </button>
                    ) : null}
                  </label>
                  {expand === s.id ? (
                    <ul className="pdf-menu-pages">
                      {s.pages.map((p) => (
                        <li key={p.path}>
                          <label>
                            <input type="checkbox" checked={picked.has(p.path)} onChange={() => togglePage(p.path)} />
                            <span>{p.title}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="pdf-menu-foot">
            <button type="button" className="ms-btn" disabled={busy !== null} onClick={() => keep(defaults())}>
              По умолчанию
            </button>
            <button type="button" className="ms-btn ms-btn--primary" disabled={busy !== null || !chosen.length} onClick={report}>
              Собрать PDF ({chosen.length})
            </button>
          </div>
          {msg ? (
            <p className="pdf-menu-msg" role="status">
              {msg}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
