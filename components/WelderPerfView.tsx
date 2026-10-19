"use client";

import { relabel } from "@/lib/labels";
import { useState } from "react";

import { EdgeFilters } from "@/components/EdgeFilters";
import { RemotePicker } from "@/components/RemotePicker";
import { ColHead, colThProps } from "@/components/ColHead";
import { tableKeyOf, useTablePrefs } from "@/lib/col-prefs";
import { usePageSubtitle } from "@/components/ReportShell";
import type { Column, Level, Matrix, WpPageData, WpRow } from "@/lib/pages/welder-performance";
import { nextSort, sortBy, type SortState } from "@/lib/table-sort";

/** Rows in the header-arrow order: column 0 is the row label, column i the i-th value column. */
function sortRows<T>(items: T[], row: (item: T) => WpRow, columns: readonly Column[], sort: SortState): T[] {
  if (!sort) return items;
  const key = sort.col === 0 ? null : columns[sort.col - 1]?.key;
  return sortBy(items, (i) => (key ? row(i).values[key] : row(i).label), sort);
}

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
/** "|" in a label is a line break the owner placed ("RT Total|Films"). */
function withBreaks(text: string) {
  // "%" and the "A" / "R" marks stay with the word before them: no lone sign on a line
  const glued = text.replace(/ (%|"[AR]")/g, (_m, sign: string) => `\u00a0${sign}`);
  const parts = glued.split("|");
  return parts.map((p, i) => (
    <span key={i}>
      {i > 0 ? <br /> : null}
      {p}
    </span>
  ));
}

/** "Last 2wk Joints Welded" / "Last 1 m.th …" → the window on its own line, the rest below. */
function HeadLabel({ label }: { label: string }) {
  const m = /^(Last 2wk|Last 1 m\.th) (.*)$/.exec(label);
  if (!m) return <>{withBreaks(label)}</>;
  return (
    <>
      <span className="wp-h-prefix">{m[1]}</span>
      <br />
      {withBreaks(m[2])}
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
  sort,
}: {
  sort: SortState;
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
              <span aria-hidden="true">{isOpen ? "−" : "+"}</span> {label}
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
        ? sortRows(children, (ch) => ch.row, columns, sort).map((ch) => (
            <RowLines
              key={ch.row.label}
              sort={sort}
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
  const [sort, setSort] = useState<SortState>(null);
  const tkey = tableKeyOf(["wp", matrix, ...def.columns.map((c) => c.key)]);
  const prefs = useTablePrefs(tkey);
  const onSort = (col: number) => setSort((cur) => nextSort(cur, col));
  const ariaSort = (col: number) => (sort?.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : undefined);
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
                <th scope="col" className="wp-rowhead" title={LEVEL_LABEL[matrix]} aria-sort={ariaSort(0)} {...colThProps(prefs, "Sub-Contractor")}>
                  <ColHead table={tkey} col="Sub-Contractor" index={0} sort={sort} onSort={onSort}>
                    Sub-Contractor
                  </ColHead>
                </th>
                {def.columns.map((c, ci) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={c.group === "window" ? "wp-col-window" : c.group === "window2" ? "wp-col-window2" : undefined}
                    aria-sort={ariaSort(ci + 1)}
                    {...colThProps(prefs, c.key)}
                  >
                    <ColHead table={tkey} col={c.key} index={ci + 1} sort={sort} onSort={onSort}>
                      <HeadLabel label={relabel(c.label)} />
                    </ColHead>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortRows(res.rows, (r) => r, def.columns, sort).map((row) => (
                <RowLines
                  key={row.label}
                  sort={sort}
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
          <EdgeFilters
            widgets={data.filters}
            extra={{
              node: (
                <RemotePicker
                  key={data.joint.join(",")}
                  param="joint"
                  label="Joint ID"
                  value={data.joint}
                  endpoint={`/api/welder-performance/joints?page=${data.page.slug}`}
                  listKey="joints"
                  noun="joints"
                />
              ),
              ids: ["joint"],
              chips: data.joint.length ? [{ label: "Joint ID", value: data.joint.join(","), ids: ["joint"] }] : [],
            }}
          />
          <MatrixCard key={`rt-${data.query}`} data={data} matrix="rt" />
          <MatrixCard key={`ut-${data.query}`} data={data} matrix="ut" />
        </>
      ) : null}
    </section>
  );
}
