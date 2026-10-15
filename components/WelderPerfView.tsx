"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FilterBar } from "@/components/FilterBar";
import { usePageSubtitle } from "@/components/ReportShell";
import type { Column, Level, Matrix, WpPageData, WpRow } from "@/lib/pages/welder-performance";

const NEXT: Record<Level, Level | null> = { sub: "welder", welder: "joint", joint: "report", report: null };
/** Row levels, for the header tooltip; the header itself reads "Sub-Contractor" as in the pbix. */
const LEVEL_LABEL: Record<Matrix, string> = {
  rt: "Sub-Contractor ▸ Welder ID ▸ Joint ID ▸ RT Report",
  ut: "Sub-Contractor ▸ Welder ID ▸ Joint ID ▸ UT Report",
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dmy(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}-${MON[m - 1]}-${String(y).slice(2)}`;
}

/** "L.2w Joints Welded" → "L.2W" on its own line, the rest on the next one. */
function HeadLabel({ label }: { label: string }) {
  const m = /^(L\.2w|L\.1m) (.*)$/.exec(label);
  if (!m) return <>{label}</>;
  return (
    <>
      <span className="wp-h-prefix">{m[1].toUpperCase()}</span>
      <br />
      {m[2]}
    </>
  );
}

function fmt(c: Column, v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (c.fmt === "status") return String(v);
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  switch (c.fmt) {
    case "int":
      // a DISTINCTCOUNT over no rows is BLANK in the pbix, not 0; only `Numb RT/UT
      // "PR all"` wraps itself in COALESCE(…, 0)
      if (n === 0 && c.key !== "numb_rt") return "";
      return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
    case "num0":
      return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
    case "num2":
      return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "num3":
      return n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    case "pct":
      return `${(n * 100).toFixed(2)}%`;
  }
}

/** Status cells are coloured by their rank: "1…" ok, "2…" monitor, "3…" critical, "4…" disqualified / action. */
function statusClass(v: string | number | null | undefined): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  const rank = v.trim()[0];
  return rank === "1" ? "wp-st wp-st--ok" : rank === "2" ? "wp-st wp-st--watch" : rank === "3" ? "wp-st wp-st--crit" : "wp-st wp-st--act";
}

type TreeNode = { row: WpRow; level: Level; scope: { sub?: string; welder?: string; joint?: string } };

function RowLines({
  node,
  depth,
  columns,
  matrix,
  pageSlug,
  query,
  open,
  setOpen,
  kids,
  setKids,
}: {
  node: TreeNode;
  depth: number;
  columns: readonly Column[];
  matrix: Matrix;
  pageSlug: string;
  query: string;
  open: Record<string, boolean>;
  setOpen: (f: (o: Record<string, boolean>) => Record<string, boolean>) => void;
  kids: Record<string, TreeNode[] | "loading" | "error">;
  setKids: (f: (k: Record<string, TreeNode[] | "loading" | "error">) => Record<string, TreeNode[] | "loading" | "error">) => void;
}) {
  const next = NEXT[node.level];
  const path = `${node.level}\u0000${node.scope.sub ?? ""}\u0000${node.scope.welder ?? ""}\u0000${node.scope.joint ?? ""}\u0000${node.row.label}`;
  const isOpen = Boolean(open[path]);
  const children = kids[path];

  async function toggle() {
    const willOpen = !isOpen;
    setOpen((o) => ({ ...o, [path]: willOpen }));
    if (!willOpen || !next || Array.isArray(children) || children === "loading") return;
    const scope = { ...node.scope };
    if (node.level === "sub") scope.sub = node.row.label;
    if (node.level === "welder") scope.welder = node.row.label;
    if (node.level === "joint") scope.joint = node.row.label;
    const sp = new URLSearchParams(query);
    sp.set("page", pageSlug);
    sp.set("matrix", matrix);
    sp.set("level", next);
    if (scope.sub !== undefined) sp.set("sub", scope.sub);
    if (scope.welder !== undefined) sp.set("welder_scope", scope.welder);
    if (scope.joint !== undefined) sp.set("joint_scope", scope.joint);
    setKids((k) => ({ ...k, [path]: "loading" }));
    try {
      const r = await fetch(`/api/welder-performance?${sp.toString()}`);
      if (!r.ok) throw new Error(String(r.status));
      const body = (await r.json()) as { rows: WpRow[] };
      setKids((k) => ({ ...k, [path]: body.rows.map((row) => ({ row, level: next, scope })) }));
    } catch {
      setKids((k) => ({ ...k, [path]: "error" }));
    }
  }

  const label = node.row.label || "(Blank)";
  return (
    <>
      <tr className={depth === 0 ? "wp-level0" : undefined}>
        <th scope="row" className="wp-rowhead" style={{ paddingInlineStart: `${10 + depth * 16}px` }}>
          {next ? (
            <button type="button" className="error-expand" aria-expanded={isOpen} onClick={toggle}>
              <span aria-hidden="true">{isOpen ? "⊟" : "⊞"}</span> {label}
            </button>
          ) : (
            <span className="error-leaf">{label}</span>
          )}
        </th>
        {columns.map((c) => {
          const v = node.row.values[c.key];
          return (
            <td key={c.key} className={c.fmt === "status" ? statusClass(v) : "num"}>
              {fmt(c, v)}
            </td>
          );
        })}
      </tr>
      {isOpen && children === "loading" ? (
        <tr>
          <td colSpan={columns.length + 1} className="wp-loading" style={{ paddingInlineStart: `${26 + depth * 16}px` }}>
            Loading…
          </td>
        </tr>
      ) : null}
      {isOpen && children === "error" ? (
        <tr>
          <td colSpan={columns.length + 1} className="wp-loading" style={{ paddingInlineStart: `${26 + depth * 16}px` }}>
            Could not load these rows.
          </td>
        </tr>
      ) : null}
      {isOpen && Array.isArray(children)
        ? children.map((ch) => (
            <RowLines
              key={ch.row.label}
              node={ch}
              depth={depth + 1}
              columns={columns}
              matrix={matrix}
              pageSlug={pageSlug}
              query={query}
              open={open}
              setOpen={setOpen}
              kids={kids}
              setKids={setKids}
            />
          ))
        : null}
    </>
  );
}

function MatrixCard({ data, matrix }: { data: WpPageData; matrix: Matrix }) {
  const def = data.page[matrix];
  const res = data[matrix];
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [kids, setKids] = useState<Record<string, TreeNode[] | "loading" | "error">>({});
  const id = `wp-${matrix}`;
  return (
    <section className="card wp-card" aria-labelledby={id}>
      <h3 id={id} className="wp-title">
        {def.title}
      </h3>
      {res.rows.length === 0 ? (
        <p className="error-empty">No rows under the current filters.</p>
      ) : (
        <div className="table-scroll wp-scroll">
          <table className="data-table wp-matrix">
            <thead>
              <tr>
                <th scope="col" className="wp-rowhead" title={LEVEL_LABEL[matrix]}>
                  Sub-Contractor
                </th>
                {def.columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={c.group === "window" ? "wp-col-window" : c.group === "window2" ? "wp-col-window2" : undefined}
                  >
                    <HeadLabel label={c.label} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {res.rows.map((row) => (
                <RowLines
                  key={row.label}
                  node={{ row, level: "sub", scope: {} }}
                  depth={0}
                  columns={def.columns}
                  matrix={matrix}
                  pageSlug={data.page.slug}
                  query={data.query}
                  open={open}
                  setOpen={setOpen}
                  kids={kids}
                  setKids={setKids}
                />
              ))}
              {res.total ? (
                <tr className="row-header">
                  <th scope="row" className="wp-rowhead">
                    Total
                  </th>
                  {def.columns.map((c) => (
                    <td key={c.key} className={c.fmt === "status" ? statusClass(res.total?.values[c.key]) : "num"}>
                      {fmt(c, res.total?.values[c.key])}
                    </td>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * The Joint ID slicer: a check-box drop-down like the others, but its options
 * (~800k joints unfiltered) come from the server, under the OTHER slicers — pick
 * a welder or a status and only the joints it touches are offered. A search box
 * narrows the list; one page of the matches is shown at a time.
 */
function JointPicker({ value, pageSlug }: { value: string[]; pageSlug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<string[]>(value);
  const [list, setList] = useState<{ joints: string[]; more: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  function apply(next: string[]) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next.length) sp.set("joint", next.join(","));
    else sp.delete("joint");
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
      sp.delete("joint");
      sp.set("page", pageSlug);
      if (q.trim()) sp.set("q", q.trim());
      try {
        const r = await fetch(`/api/welder-performance/joints?${sp.toString()}`);
        const body = (await r.json()) as { joints: string[]; more: boolean };
        if (id === reqId.current) setList(body);
      } catch {
        if (id === reqId.current) setList({ joints: [], more: false });
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, pageSlug, searchParams]);

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
  // picked joints stay on top even when the search does not match them
  const options = list ? [...draft.filter((j) => !list.joints.includes(j)), ...list.joints] : draft;

  return (
    <div className="filter-group ms wp-joint" ref={ref}>
      <label id="wp-joint-l" htmlFor="wp-joint-b">
        Joint ID
      </label>
      <button
        id="wp-joint-b"
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
        <div className="ms-panel wp-joint-panel" role="group" aria-labelledby="wp-joint-l">
          <input
            type="search"
            className="ms-search"
            placeholder="Search joints"
            aria-label="Search the joints"
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
            {!loading && list && list.joints.length === 0 ? <p className="wp-loading">No joints under these filters.</p> : null}
            {!loading && list?.more ? (
              <p className="wp-loading">First {list.joints.length} joints shown — type to narrow the list.</p>
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

export function WelderPerfView({ data, note }: { data: WpPageData | null; note?: string }) {
  usePageSubtitle(data ? `Cut-off ${dmy(data.as_of)}` : "Welder Performance");
  return (
    <section className="page-section active wp-page" aria-labelledby="page-heading">
      <div className="page-header wp-banner">
        <h2 id="page-heading">
          {data ? data.page.banner : "WELDER PERFORMANCE"}
          {data ? <span className="wp-since"> Since {dmy(data.since)}</span> : null}
        </h2>
      </div>
      {note ? <p className="error-empty">{note}</p> : null}
      {data ? (
        <>
          <p className="page-subtitle">
            Cut-off {dmy(data.as_of)} (the last Friday of the data); welds after it are not counted. &quot;Last{" "}
            {data.page.days === 15 ? "2 weeks" : "1 month"}&quot; = {data.page.days + 1} days up to the cut-off, as the Power BI
            report counts it. Inco is not included. Expand a
            sub-contractor to see its welders, a welder to see the joints.
          </p>
          <div className="wp-filters">
            <FilterBar widgets={data.filters} alsoReset={["joint"]} />
            <JointPicker key={data.joint.join(",")} value={data.joint} pageSlug={data.page.slug} />
          </div>
          <MatrixCard key={`rt-${data.query}`} data={data} matrix="rt" />
          <MatrixCard key={`ut-${data.query}`} data={data} matrix="ut" />
        </>
      ) : null}
    </section>
  );
}
