"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { usePageSubtitle } from "@/components/ReportShell";
import { SavedViews } from "@/components/SavedViews";
import type { GridCol } from "@/lib/data-grid-columns";

type GridFilter = { in?: string[]; has?: string; from?: string; to?: string };
type Filters = Record<string, GridFilter>;
type Sort = { key: string; dir: "asc" | "desc" } | null;

const NF = new Intl.NumberFormat("en-US");

function readFilters(raw: string | null): Filters {
  if (!raw) return {};
  try {
    return (JSON.parse(raw) as Filters) ?? {};
  } catch {
    return {};
  }
}

function describe(col: GridCol, f: GridFilter): string {
  const parts: string[] = [];
  if (f.in?.length) parts.push(f.in.length <= 2 ? f.in.join(", ") : `${f.in.length} values`);
  if (f.has) parts.push(`contains “${f.has}”`);
  if (f.from && f.to) parts.push(`${f.from} … ${f.to}`);
  else if (f.from) parts.push(`≥ ${f.from}`);
  else if (f.to) parts.push(`≤ ${f.to}`);
  return `${col.label}: ${parts.join("; ")}`;
}

/**
 * The Data page (owner, 2026-10-19): the detailed weld table, every row, with a
 * filter in each column header (values, contains, a pasted list, a range), sort
 * on the header, a column picker and a CSV export. Rows come from the server
 * 200 at a time as the table scrolls; all state is in the URL (lib/pages/data-grid.ts).
 */
export function DataGridView({ columns, defaults }: { columns: readonly GridCol[]; defaults: readonly string[] }) {
  usePageSubtitle("Data — detailed weld table");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);

  const fRaw = sp.get("f");
  const filters = useMemo(() => readFilters(fRaw), [fRaw]);
  const cRaw = sp.get("c");
  const cols = useMemo(() => {
    const keys = (cRaw ?? "").split(",").filter((k) => byKey.has(k));
    return keys.length ? keys : [...defaults];
  }, [cRaw, byKey, defaults]);
  const sRaw = sp.get("s");
  const sort: Sort = useMemo(() => {
    const [key, dir] = (sRaw ?? "").split(":");
    return key && byKey.has(key) ? { key, dir: dir === "desc" ? "desc" : "asc" } : null;
  }, [sRaw, byKey]);

  const setParams = useCallback(
    (upd: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(upd)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );
  const setFilters = (f: Filters) => setParams({ f: Object.keys(f).length ? JSON.stringify(f) : null });
  const setFilter = (key: string, f: GridFilter | null) => {
    const next = { ...filters };
    if (f && (f.in?.length || f.has || f.from || f.to)) next[key] = f;
    else delete next[key];
    setFilters(next);
  };

  // ── rows ──
  const [rows, setRows] = useState<(string | null)[][]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the count of the filters it was read for, so a stale one never shows
  const [counted, setCounted] = useState<{ key: string; n: number } | null>(null);
  const reqId = useRef(0);
  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (Object.keys(filters).length) q.set("f", JSON.stringify(filters));
    q.set("c", cols.join(","));
    if (sort) q.set("s", `${sort.key}:${sort.dir}`);
    return q.toString();
  }, [filters, cols, sort]);

  const load = useCallback(
    async (offset: number) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/data?action=rows&offset=${offset}&${query}`);
        const body = (await r.json()) as { rows?: (string | null)[][]; more?: boolean; error?: string };
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        if (id !== reqId.current) return;
        setRows((prev) => (offset === 0 ? body.rows ?? [] : [...prev, ...(body.rows ?? [])]));
        setMore(Boolean(body.more));
      } catch (e) {
        if (id === reqId.current) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [query],
  );

  const fKey = JSON.stringify(filters);
  useEffect(() => {
    // a new query (filters, columns, sort): read its first page
    const t = setTimeout(() => void load(0), 0);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    const fq = fKey !== "{}" ? `&f=${encodeURIComponent(fKey)}` : "";
    let live = true;
    fetch(`/api/data?action=count${fq}`)
      .then((r) => r.json())
      .then((b: { count?: number }) => {
        if (live && typeof b.count === "number") setCounted({ key: fKey, n: b.count });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [fKey]);
  const count = counted?.key === fKey ? counted.n : null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || loading || !more) return;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 600) void load(rows.length);
  };

  // the table takes the window's remaining height and scrolls inside
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.max(300, window.innerHeight - top - 24)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [filters]);

  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const active = Object.entries(filters).filter(([k]) => byKey.has(k));

  const toggleSort = (key: string) => {
    if (!sort || sort.key !== key) setParams({ s: `${key}:asc` });
    else if (sort.dir === "asc") setParams({ s: `${key}:desc` });
    else setParams({ s: null });
  };

  return (
    <section className="page-section active pv-page dg-page" aria-labelledby="page-heading">
      <div className="page-header">
        <h2 id="page-heading">Data — Project WD+WR+INCO+Acciona</h2>
      </div>
      <div className="dg-toolbar">
        <SavedViews />
        <span className="dg-count num" role="status">
          {count === null ? "Counting…" : `${NF.format(count)} rows`}
          {rows.length ? ` · ${NF.format(rows.length)} loaded` : ""}
        </span>
        <div className="dg-tools">
          <div className="dg-picker-wrap">
            <button type="button" className="ms-btn" aria-expanded={picker} onClick={() => setPicker((p) => !p)}>
              Columns ({cols.length} / {columns.length})
            </button>
            {picker ? (
              <ColumnPicker
                columns={columns}
                chosen={cols}
                defaults={defaults}
                onApply={(keys) => {
                  setPicker(false);
                  setParams({ c: keys.join(",") === defaults.join(",") ? null : keys.join(",") });
                }}
                onClose={() => setPicker(false)}
              />
            ) : null}
          </div>
          <a className="ms-btn" href={`/api/data?action=csv&${query}`} download>
            Export CSV
          </a>
        </div>
      </div>
      {active.length ? (
        <div className="dg-chips">
          {active.map(([k, f]) => (
            <span key={k} className="fchip-static">
              {describe(byKey.get(k)!, f)}
              <button type="button" className="fchip-clear" aria-label={`Clear ${byKey.get(k)!.label}`} onClick={() => setFilter(k, null)}>
                ×
              </button>
            </span>
          ))}
          <button type="button" className="filter-reset fbar-clear" onClick={() => setFilters({})}>
            Clear all
          </button>
        </div>
      ) : null}
      {error ? <p className="error-empty">Failed: {error}</p> : null}
      <div className="dg-scroll" ref={scrollRef} onScroll={onScroll}>
        <table className="dg-table">
          <thead>
            <tr>
              {cols.map((k) => {
                const col = byKey.get(k)!;
                const on = Boolean(filters[k]);
                return (
                  <th key={k} scope="col" aria-sort={sort?.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                    <div className="dg-th">
                      <button type="button" className="dg-sort" title="Sort" onClick={() => toggleSort(k)}>
                        {col.label}
                        {sort?.key === k ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                      </button>
                      <button
                        type="button"
                        className={`dg-fbtn${on ? " is-on" : ""}`}
                        aria-label={`Filter ${col.label}`}
                        aria-expanded={openFilter === k}
                        onClick={() => setOpenFilter(openFilter === k ? null : k)}
                      >
                        {on ? "▼" : "▾"}
                      </button>
                    </div>
                    {openFilter === k ? (
                      <FilterPanel
                        col={col}
                        value={filters[k] ?? {}}
                        filters={filters}
                        onApply={(f) => {
                          setOpenFilter(null);
                          setFilter(k, f);
                        }}
                        onClose={() => setOpenFilter(null)}
                      />
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => {
                  const t = byKey.get(cols[j]!)?.type;
                  return (
                    <td key={j} className={t === "num" ? "num" : undefined} title={v && v.length > 30 ? v : undefined}>
                      {v ?? ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <p className="dg-note">Loading…</p> : null}
        {!loading && rows.length === 0 && !error ? <p className="dg-note">No rows under these filters.</p> : null}
        {!loading && more ? <p className="dg-note">Scroll down for more rows.</p> : null}
      </div>
    </section>
  );
}

/** One column's filter: contains / range, the column's values (searched on the server), a pasted list. */
function FilterPanel({
  col,
  value,
  filters,
  onApply,
  onClose,
}: {
  col: GridCol;
  value: GridFilter;
  filters: Filters;
  onApply: (f: GridFilter | null) => void;
  onClose: () => void;
}) {
  const [has, setHas] = useState(value.has ?? "");
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");
  const [picks, setPicks] = useState<string[]>(value.in ?? []);
  const [q, setQ] = useState("");
  const [paste, setPaste] = useState(false);
  const [pasted, setPasted] = useState("");
  const [list, setList] = useState<{ values: string[]; more: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef(0);

  useEffect(() => {
    const n = ++id.current;
    const t = setTimeout(async () => {
      setBusy(true);
      const others = { ...filters };
      delete others[col.key];
      const fq = Object.keys(others).length ? `&f=${encodeURIComponent(JSON.stringify(others))}` : "";
      try {
        const r = await fetch(`/api/data?action=values&col=${col.key}&q=${encodeURIComponent(q)}${fq}`);
        const b = (await r.json()) as { values?: string[]; more?: boolean };
        if (n === id.current) setList({ values: b.values ?? [], more: Boolean(b.more) });
      } catch {
        if (n === id.current) setList({ values: [], more: false });
      } finally {
        if (n === id.current) setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, col.key, filters]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const toggle = (v: string) => setPicks((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const shown = list ? [...picks.filter((p) => !list.values.includes(p)), ...list.values] : picks;
  const range = col.type === "num" || col.type === "date";
  const apply = () => {
    const extra = paste
      ? pasted
          .split(/[\r\n\t,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const all = [...new Set([...picks, ...extra])];
    onApply({
      in: all.length ? all : undefined,
      has: !range && has.trim() ? has.trim() : undefined,
      from: range && from ? from : undefined,
      to: range && to ? to : undefined,
    });
  };

  return (
    <div className="ms-panel dg-panel" ref={ref} role="dialog" aria-label={`Filter ${col.label}`}>
      <div className="dg-panel-body">
        {range ? (
          <div className="dg-range">
            <label>
              From
              <input type={col.type === "date" ? "date" : "text"} className="ms-search" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              To
              <input type={col.type === "date" ? "date" : "text"} className="ms-search" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        ) : col.type === "text" ? (
          <label className="dg-has">
            Contains
            <input
              type="search"
              className="ms-search"
              placeholder="part of the text"
              value={has}
              onChange={(e) => setHas(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
              }}
            />
          </label>
        ) : null}
        <div className="dg-values">
          <input type="search" className="ms-search" placeholder="Search values" aria-label="Search the values" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="ms-options">
            {shown.map((v) => (
              <label className="ms-option" key={v}>
                <input type="checkbox" checked={picks.includes(v)} onChange={() => toggle(v)} />
                <span>{v}</span>
              </label>
            ))}
            {busy ? <p className="wp-loading">Loading…</p> : null}
            {!busy && list && list.values.length === 0 ? <p className="wp-loading">No values under the other filters.</p> : null}
            {!busy && list?.more ? <p className="wp-loading">First {list.values.length} shown — type to narrow.</p> : null}
          </div>
        </div>
        <button type="button" className="dg-link" onClick={() => setPaste((p) => !p)}>
          {paste ? "Hide the pasted list" : "Paste a list (from Excel)…"}
        </button>
        {paste ? (
          <textarea className="dg-paste" rows={5} placeholder="One value per line" value={pasted} onChange={(e) => setPasted(e.target.value)} />
        ) : null}
      </div>
      <div className="ms-footer">
        <button type="button" className="ms-btn" onClick={() => onApply(null)}>
          Clear
        </button>
        <button type="button" className="ms-btn ms-btn--primary" onClick={apply}>
          Apply
        </button>
      </div>
    </div>
  );
}

/** Which columns show, in which order: tick to add (at the end), untick to drop. */
function ColumnPicker({
  columns,
  chosen,
  defaults,
  onApply,
  onClose,
}: {
  columns: readonly GridCol[];
  chosen: string[];
  defaults: readonly string[];
  onApply: (keys: string[]) => void;
  onClose: () => void;
}) {
  const [keys, setKeys] = useState<string[]>(chosen);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);
  const shown = columns.filter((c) => !q.trim() || c.label.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (k: string) => setKeys((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  return (
    <div className="ms-panel dg-cols" ref={ref} role="dialog" aria-label="Columns">
      <input type="search" className="ms-search" placeholder="Search columns" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="ms-options">
        {shown.map((c) => (
          <label className="ms-option" key={c.key}>
            <input type="checkbox" checked={keys.includes(c.key)} onChange={() => toggle(c.key)} />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
      <div className="ms-footer">
        <button type="button" className="ms-btn" onClick={() => setKeys([...defaults])}>
          Default
        </button>
        <button type="button" className="ms-btn" onClick={() => setKeys(columns.map((c) => c.key))}>
          All
        </button>
        <button type="button" className="ms-btn ms-btn--primary" disabled={!keys.length} onClick={() => onApply(keys)}>
          Apply
        </button>
      </div>
    </div>
  );
}
