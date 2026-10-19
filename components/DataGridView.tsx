"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { usePageSubtitle } from "@/components/ReportShell";
import { SavedViews } from "@/components/SavedViews";
import { setColPref, useTablePrefs } from "@/lib/col-prefs";
import type { GridCol } from "@/lib/data-grid-columns";

/** Column widths are shared like every table's (lib/col-prefs), under this key. */
const PREFS_TABLE = "data-grid";

/** Drag the grip on a header's right edge to set the column width (saved for everyone). */
function startResize(e: React.PointerEvent<HTMLSpanElement>, col: string) {
  e.preventDefault();
  e.stopPropagation();
  const th = e.currentTarget.closest("th");
  if (!th) return;
  const grip = e.currentTarget;
  grip.setPointerCapture(e.pointerId);
  const x0 = e.clientX;
  const w0 = th.getBoundingClientRect().width;
  let w = Math.round(w0);
  const move = (ev: PointerEvent) => {
    w = Math.max(40, Math.min(1200, Math.round(w0 + ev.clientX - x0)));
    setColPref(PREFS_TABLE, col, { width: w }, false);
  };
  const up = () => {
    grip.removeEventListener("pointermove", move);
    grip.removeEventListener("pointerup", up);
    grip.removeEventListener("pointercancel", up);
    setColPref(PREFS_TABLE, col, { width: w });
  };
  grip.addEventListener("pointermove", move);
  grip.addEventListener("pointerup", up);
  grip.addEventListener("pointercancel", up);
}

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
  if (f.in?.length)
    parts.push(f.in.length <= 2 ? f.in.join(", ") : `${f.in.length} values`);
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
export function DataGridView({
  columns,
  defaults,
}: {
  columns: readonly GridCol[];
  defaults: readonly string[];
}) {
  usePageSubtitle("Data — detailed weld table");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const byKey = useMemo(
    () => new Map(columns.map((c) => [c.key, c])),
    [columns],
  );
  const prefs = useTablePrefs(PREFS_TABLE);
  const widthOf = (k: string) => {
    const w = prefs[k]?.width;
    return w ? { width: w, minWidth: w, maxWidth: w } : undefined;
  };

  const fRaw = sp.get("f");
  const filters = useMemo(() => readFilters(fRaw), [fRaw]);
  const cRaw = sp.get("c");
  const cols = useMemo(() => {
    const keys = (cRaw ?? "").split(",").filter((k) => byKey.has(k));
    // every column unless the URL names some (owner, 2026-10-19: "all columns shown")
    return keys.length ? keys : columns.map((c) => c.key);
  }, [cRaw, byKey, columns]);
  const sRaw = sp.get("s");
  const sort: Sort = useMemo(() => {
    const [key, dir] = (sRaw ?? "").split(":");
    return key && byKey.has(key)
      ? { key, dir: dir === "desc" ? "desc" : "asc" }
      : null;
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
  const setFilters = (f: Filters) =>
    setParams({ f: Object.keys(f).length ? JSON.stringify(f) : null });
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
  const [counted, setCounted] = useState<{ key: string; n: number } | null>(
    null,
  );
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
        const r = await fetch(
          `/api/data?action=rows&offset=${offset}&${query}`,
        );
        const body = (await r.json()) as {
          rows?: (string | null)[][];
          more?: boolean;
          error?: string;
        };
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        if (id !== reqId.current) return;
        setRows((prev) =>
          offset === 0 ? (body.rows ?? []) : [...prev, ...(body.rows ?? [])],
        );
        setMore(Boolean(body.more));
      } catch (e) {
        if (id === reqId.current)
          setError(e instanceof Error ? e.message : String(e));
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
        if (live && typeof b.count === "number")
          setCounted({ key: fKey, n: b.count });
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
    if (!el) return;
    const h =
      el.querySelector("tbody tr")?.getBoundingClientRect().height ?? 26;
    setTopRow(
      Math.min(rows.length - 1, Math.max(0, Math.floor(el.scrollTop / h))),
    );
    if (loading || !more) return;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 600)
      void load(rows.length);
  };

  const [fieldsOpen, setFieldsOpen] = useState(true);
  // the table takes the window's remaining height and scrolls inside
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      // room under it for the "Row N of M" line
      const h = Math.max(300, window.innerHeight - top - 52);
      el.style.height = `${h}px`;
      // the fields pane matches the table
      el.closest(".dg-body")?.querySelector<HTMLElement>(".dg-fields")?.style.setProperty("max-height", `${h + 28}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [filters, fieldsOpen]);

  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [topRow, setTopRow] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const setVisible = (keys: string[]) => {
    const all =
      keys.length === columns.length &&
      keys.every((k, i) => k === columns[i]!.key);
    setParams({ c: all ? null : keys.join(",") });
  };
  /** Bring a column into view (showing it first if hidden) and flash its header. */
  const jumpTo = (key: string) => {
    if (!cols.includes(key)) setVisible([...cols, key]);
    setFlash(key);
    setTimeout(() => {
      const th = scrollRef.current?.querySelector<HTMLElement>(
        `th[data-key="${key}"]`,
      );
      th?.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
    }, 60);
    setTimeout(() => setFlash((f) => (f === key ? null : f)), 1800);
  };
  const active = Object.entries(filters).filter(([k]) => byKey.has(k));

  const toggleSort = (key: string) => {
    if (!sort || sort.key !== key) setParams({ s: `${key}:asc` });
    else if (sort.dir === "asc") setParams({ s: `${key}:desc` });
    else setParams({ s: null });
  };

  return (
    <section
      className="page-section active pv-page dg-page"
      aria-labelledby="page-heading"
    >
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
          <button
            type="button"
            className={`ms-btn${fieldsOpen ? " ms-btn--primary" : ""}`}
            aria-expanded={fieldsOpen}
            onClick={() => setFieldsOpen((o) => !o)}
          >
            Fields ({cols.length} / {columns.length})
          </button>
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
              <button
                type="button"
                className="fchip-clear"
                aria-label={`Clear ${byKey.get(k)!.label}`}
                onClick={() => setFilter(k, null)}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            className="filter-reset fbar-clear"
            onClick={() => setFilters({})}
          >
            Clear all
          </button>
        </div>
      ) : null}
      {error ? <p className="error-empty">Failed: {error}</p> : null}
      <div className="dg-body">
        <div className="dg-main">
          <div className="dg-scroll" ref={scrollRef} onScroll={onScroll}>
            <table className="dg-table">
              <thead>
                <tr>
                  <th scope="col" className="dg-rownum" aria-label="Row number">
                    #
                  </th>
                  {cols.map((k) => {
                    const col = byKey.get(k)!;
                    const on = Boolean(filters[k]);
                    return (
                      <th
                        key={k}
                        scope="col"
                        style={widthOf(k)}
                        data-key={k}
                        className={flash === k ? "dg-flash" : undefined}
                        data-sized={prefs[k]?.width ? "" : undefined}
                        aria-sort={
                          sort?.key === k
                            ? sort.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                      >
                        <div className="dg-th">
                          <button
                            type="button"
                            className="dg-sort"
                            title="Click to sort · drag the right edge to resize"
                            onClick={() => toggleSort(k)}
                          >
                            {col.label}
                            {sort?.key === k
                              ? sort.dir === "asc"
                                ? " ▲"
                                : " ▼"
                              : ""}
                          </button>
                          <button
                            type="button"
                            className={`dg-fbtn${on ? " is-on" : ""}`}
                            aria-label={`Filter ${col.label}`}
                            aria-expanded={openFilter === k}
                            onClick={() =>
                              setOpenFilter(openFilter === k ? null : k)
                            }
                          >
                            {on ? "▼" : "▾"}
                          </button>
                        </div>
                        <span
                          className="th-resize"
                          aria-hidden="true"
                          title="Drag to resize · double-click for auto width"
                          onPointerDown={(e) => startResize(e, k)}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setColPref(PREFS_TABLE, k, { width: null });
                          }}
                        />
                        {openFilter === k ? (
                          <FilterPanel
                            col={col}
                            sort={sort?.key === k ? sort.dir : null}
                            onSort={(dir) => {
                              setOpenFilter(null);
                              setParams({ s: dir ? `${k}:${dir}` : null });
                            }}
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
                  <tr
                    key={i}
                    className={selected === i ? "is-selected" : undefined}
                    onClick={() => setSelected(selected === i ? null : i)}
                  >
                    <td className="dg-rownum num">{NF.format(i + 1)}</td>
                    {r.map((v, j) => {
                      const t = byKey.get(cols[j]!)?.type;
                      return (
                        <td
                          key={j}
                          className={t === "num" ? "num" : undefined}
                          style={widthOf(cols[j]!)}
                          title={v && v.length > 30 ? v : undefined}
                        >
                          {v ?? ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {loading ? <p className="dg-note">Loading…</p> : null}
            {!loading && rows.length === 0 && !error ? (
              <p className="dg-note">No rows under these filters.</p>
            ) : null}
            {!loading && more ? (
              <p className="dg-note">Scroll down for more rows.</p>
            ) : null}
          </div>
          <div className="dg-status num" role="status">
            {rows.length
              ? `Row ${NF.format((selected ?? topRow) + 1)} of ${count === null ? "…" : NF.format(count)}`
              : ""}
          </div>
        </div>
        {fieldsOpen ? (
          <FieldsPanel
            columns={columns}
            visible={cols}
            basic={defaults}
            filtered={Object.keys(filters)}
            onJump={jumpTo}
            onSet={setVisible}
            onClose={() => setFieldsOpen(false)}
          />
        ) : null}
      </div>
    </section>
  );
}

/** One column's filter: contains / range, the column's values (searched on the server), a pasted list. */
function FilterPanel({
  col,
  sort,
  onSort,
  value,
  filters,
  onApply,
  onClose,
}: {
  col: GridCol;
  sort: "asc" | "desc" | null;
  onSort: (dir: "asc" | "desc" | null) => void;
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
  const [list, setList] = useState<{ values: string[]; more: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef(0);

  useEffect(() => {
    const n = ++id.current;
    const t = setTimeout(async () => {
      setBusy(true);
      const others = { ...filters };
      delete others[col.key];
      const fq = Object.keys(others).length
        ? `&f=${encodeURIComponent(JSON.stringify(others))}`
        : "";
      try {
        const r = await fetch(
          `/api/data?action=values&col=${col.key}&q=${encodeURIComponent(q)}${fq}`,
        );
        const b = (await r.json()) as { values?: string[]; more?: boolean };
        if (n === id.current)
          setList({ values: b.values ?? [], more: Boolean(b.more) });
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

  const toggle = (v: string) =>
    setPicks((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const shown = list
    ? [...picks.filter((p) => !list.values.includes(p)), ...list.values]
    : picks;
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
    <div
      className="ms-panel dg-panel"
      ref={ref}
      role="dialog"
      aria-label={`Filter ${col.label}`}
    >
      <div className="dg-panel-body">
        <div className="dg-sortrow" role="group" aria-label="Sort">
          {(["asc", "desc"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={`ms-btn${sort === d ? " ms-btn--primary" : ""}`}
              aria-pressed={sort === d}
              onClick={() => onSort(sort === d ? null : d)}
            >
              {col.type === "num"
                ? d === "asc"
                  ? "Sort 0 → 9"
                  : "Sort 9 → 0"
                : col.type === "date"
                  ? d === "asc"
                    ? "Oldest first"
                    : "Newest first"
                  : d === "asc"
                    ? "Sort A → Z"
                    : "Sort Z → A"}
            </button>
          ))}
        </div>
        {range ? (
          <div className="dg-range">
            <label>
              From
              <input
                type={col.type === "date" ? "date" : "text"}
                className="ms-search"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              To
              <input
                type={col.type === "date" ? "date" : "text"}
                className="ms-search"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
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
          <input
            type="search"
            className="ms-search"
            placeholder="Search values"
            aria-label="Search the values"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="ms-options">
            {shown.map((v) => (
              <label className="ms-option" key={v}>
                <input
                  type="checkbox"
                  checked={picks.includes(v)}
                  onChange={() => toggle(v)}
                />
                <span>{v}</span>
              </label>
            ))}
            {busy ? <p className="wp-loading">Loading…</p> : null}
            {!busy && list && list.values.length === 0 ? (
              <p className="wp-loading">No values under the other filters.</p>
            ) : null}
            {!busy && list?.more ? (
              <p className="wp-loading">
                First {list.values.length} shown — type to narrow.
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="dg-link"
          onClick={() => setPaste((p) => !p)}
        >
          {paste ? "Hide the pasted list" : "Paste a list (from Excel)…"}
        </button>
        {paste ? (
          <textarea
            className="dg-paste"
            rows={5}
            placeholder="One value per line"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
        ) : null}
      </div>
      <div className="ms-footer">
        <button type="button" className="ms-btn" onClick={() => onApply(null)}>
          Clear
        </button>
        <button
          type="button"
          className="ms-btn ms-btn--primary"
          onClick={apply}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

/**
 * The fields pane (as the pbix Data pane): every column, searchable. A click on a
 * name brings the column into view; the box shows or hides it.
 */
function FieldsPanel({
  columns,
  visible,
  basic,
  filtered,
  onJump,
  onSet,
  onClose,
}: {
  columns: readonly GridCol[];
  visible: string[];
  basic: readonly string[];
  filtered: string[];
  onJump: (key: string) => void;
  onSet: (keys: string[]) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const shown = columns.filter(
    (c) => !q.trim() || c.label.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const toggle = (k: string) =>
    onSet(
      visible.includes(k) ? visible.filter((x) => x !== k) : [...visible, k],
    );
  return (
    <aside className="dg-fields" aria-label="Fields">
      <div className="dg-fields-head">
        <strong>Fields</strong>
        <span className="dg-fields-n num">{columns.length}</span>
        <button
          type="button"
          className="fchip-clear"
          aria-label="Close the fields pane"
          onClick={onClose}
        >
          »
        </button>
      </div>
      <input
        type="search"
        className="ms-search"
        placeholder="Search"
        aria-label="Search the fields"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="dg-fields-btns">
        <button
          type="button"
          className="dg-link"
          onClick={() => onSet(columns.map((c) => c.key))}
        >
          Show all
        </button>
        <button
          type="button"
          className="dg-link"
          onClick={() => onSet([...basic])}
        >
          Basic ({basic.length})
        </button>
      </div>
      <ul className="dg-fields-list">
        {shown.map((c) => (
          <li
            key={c.key}
            className={visible.includes(c.key) ? undefined : "is-hidden"}
          >
            <input
              type="checkbox"
              aria-label={`Show ${c.label}`}
              checked={visible.includes(c.key)}
              onChange={() => toggle(c.key)}
            />
            <button
              type="button"
              className="dg-field"
              title="Go to this column"
              onClick={() => onJump(c.key)}
            >
              {c.label}
              {filtered.includes(c.key) ? (
                <span className="dg-field-f" aria-label="filtered">
                  {" "}
                  ▼
                </span>
              ) : null}
            </button>
          </li>
        ))}
        {shown.length === 0 ? (
          <li className="dg-note">No field matches.</li>
        ) : null}
      </ul>
    </aside>
  );
}
