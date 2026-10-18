"use client";

import { useState } from "react";

import { ColHead, colThProps } from "@/components/ColHead";
import { EdgeFilters } from "@/components/EdgeFilters";
import { usePageSubtitle } from "@/components/ReportShell";
import { KpiCard } from "@/components/widgets/KpiCard";
import { tableKeyOf, useTablePrefs } from "@/lib/col-prefs";
import { WM_LEVEL_LABEL, WM_LEVELS, type WmColumn, type WmPageData, type WmRow, type WmTree } from "@/lib/wps-material-shared";
import { nextSort, sortBy, type SortState } from "@/lib/table-sort";

const NF = new Intl.NumberFormat("en-US");
const fmt = (c: WmColumn, v: number | null | undefined) =>
  v === null || v === undefined ? "" : c.fmt === "pct" ? `${(v * 100).toFixed(2)}%` : v === 0 ? "" : NF.format(v);

/** RT FILM Rej Ratio % cells take the pbix's red, the RT/UT ratio its pale green. */
const cellClass = (c: WmColumn) => (c.key === "film" ? "num wm-film" : c.key === "ratio" ? "num wm-ratio" : "num");

function sortRows(rows: WmRow[], columns: WmColumn[], sort: SortState): WmRow[] {
  if (!sort) return rows;
  const key = sort.col === 0 ? null : columns[sort.col - 1]?.key;
  return sortBy(rows, (r) => (key ? r.values[key] : r.label), sort);
}

type Kids = Record<string, WmRow[] | "loading" | "error">;

/** One row and, when open, its children (loaded from /api/wps-material on first open). */
function Node({
  row,
  path,
  tree,
  columns,
  query,
  open,
  setOpen,
  kids,
  setKids,
  sort,
}: {
  row: WmRow;
  path: string[];
  tree: WmTree;
  columns: WmColumn[];
  query: string;
  open: Record<string, boolean>;
  setOpen: (f: (o: Record<string, boolean>) => Record<string, boolean>) => void;
  kids: Kids;
  setKids: (f: (k: Kids) => Kids) => void;
  sort: SortState;
}) {
  const key = path.join("\u0000");
  const isOpen = Boolean(open[key]);
  const children = kids[key];
  const depth = path.length - 1;

  async function toggle() {
    const willOpen = !isOpen;
    setOpen((o) => ({ ...o, [key]: willOpen }));
    if (!willOpen || Array.isArray(children) || children === "loading") return;
    setKids((k) => ({ ...k, [key]: "loading" }));
    const sp = new URLSearchParams(query);
    sp.set("tree", tree);
    sp.set("path", JSON.stringify(path));
    try {
      const r = await fetch(`/api/wps-material?${sp.toString()}`);
      if (!r.ok) throw new Error(String(r.status));
      const body = (await r.json()) as { rows: WmRow[] };
      setKids((k) => ({ ...k, [key]: body.rows }));
    } catch {
      setKids((k) => ({ ...k, [key]: "error" }));
    }
  }

  const label = row.label || "(Blank)";
  return (
    <>
      <tr className={depth === 0 ? "wp-level0" : undefined}>
        <th scope="row" className="wp-rowhead" style={{ paddingInlineStart: `${10 + depth * 16}px` }}>
          {row.expandable ? (
            <button type="button" className="error-expand" aria-expanded={isOpen} onClick={toggle}>
              <span aria-hidden="true">{isOpen ? "−" : "+"}</span> {label}
            </button>
          ) : (
            <span className="error-leaf">{label}</span>
          )}
        </th>
        {columns.map((c) => (
          <td key={c.key} className={cellClass(c)}>
            {fmt(c, row.values[c.key])}
          </td>
        ))}
      </tr>
      {isOpen && (children === "loading" || children === "error") ? (
        <tr>
          <td colSpan={columns.length + 1} className="wp-loading" style={{ paddingInlineStart: `${26 + depth * 16}px` }}>
            {children === "loading" ? "Loading…" : "Could not load these rows."}
          </td>
        </tr>
      ) : null}
      {isOpen && Array.isArray(children)
        ? sortRows(children, columns, sort).map((ch) => (
            <Node
              key={ch.label}
              row={ch}
              path={[...path, ch.label]}
              tree={tree}
              columns={columns}
              query={query}
              open={open}
              setOpen={setOpen}
              kids={kids}
              setKids={setKids}
              sort={sort}
            />
          ))
        : null}
    </>
  );
}

function TreeCard({ data, tree, title }: { data: WmPageData; tree: WmTree; title: string }) {
  const block = data[tree];
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [kids, setKids] = useState<Kids>({});
  const [sort, setSort] = useState<SortState>(null);
  const tkey = tableKeyOf(["wm", tree, ...data.columns.map((c) => c.key)]);
  const prefs = useTablePrefs(tkey);
  const onSort = (col: number) => setSort((cur) => nextSort(cur, col));
  const ariaSort = (col: number) => (sort?.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : undefined);
  const first = WM_LEVEL_LABEL[WM_LEVELS[tree][0]!];
  const id = `wm-${tree}`;
  return (
    <section className="card wp-card" aria-labelledby={id}>
      <h3 id={id} className="wp-title">
        {title}
      </h3>
      {block.rows.length === 0 ? (
        <p className="error-empty">No rows under the current filters.</p>
      ) : (
        <div className="table-scroll wp-scroll">
          <table className="data-table wp-matrix wm-matrix">
            <thead>
              <tr>
                <th scope="col" className="wp-rowhead" aria-sort={ariaSort(0)} {...colThProps(prefs, first)}>
                  <ColHead table={tkey} col={first} index={0} sort={sort} onSort={onSort}>
                    {first}
                  </ColHead>
                </th>
                {data.columns.map((c, ci) => (
                  <th key={c.key} scope="col" aria-sort={ariaSort(ci + 1)} {...colThProps(prefs, c.key)}>
                    <ColHead table={tkey} col={c.key} index={ci + 1} sort={sort} onSort={onSort}>
                      {c.label}
                    </ColHead>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortRows(block.rows, data.columns, sort).map((r) => (
                <Node
                  key={r.label}
                  row={r}
                  path={[r.label]}
                  tree={tree}
                  columns={data.columns}
                  query={data.query}
                  open={open}
                  setOpen={setOpen}
                  kids={kids}
                  setKids={setKids}
                  sort={sort}
                />
              ))}
              {block.total ? (
                <tr className="row-header">
                  <th scope="row" className="wp-rowhead">
                    Total
                  </th>
                  {data.columns.map((c) => (
                    <td key={c.key} className={cellClass(c)}>
                      {fmt(c, block.total?.values[c.key])}
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
 * WPS / Material (owner, 2026-10-18; pbix "WPS / Material for Managment"): the
 * slicers and the two status filters in the FILTERS tab, four cards, and the
 * page split in two — WPS on the left, Materials on the right.
 */
export function WpsMaterialView({ data, note }: { data: WmPageData | null; note?: string }) {
  usePageSubtitle("WPS No / Type of Material");
  return (
    <section className="page-section active wm-page" aria-labelledby="page-heading">
      <div className="page-header">
        <h2 id="page-heading">WPS No / Type of Material</h2>
      </div>
      {note ? <p className="error-empty">{note}</p> : null}
      {data ? (
        <>
          <EdgeFilters widgets={data.filters} />
          <div className="stats-row wm-cards">
            <KpiCard widget={{ kind: "kpi", label: "RT FILM Rej %", value: data.cards.film === null ? "—" : `${(data.cards.film * 100).toFixed(2)}%` }} />
            <KpiCard widget={{ kind: "kpi", label: "WPS No.", value: NF.format(data.cards.wps) }} />
            <KpiCard widget={{ kind: "kpi", label: "QTY Mat.Type", value: NF.format(data.cards.materials) }} />
            <KpiCard widget={{ kind: "kpi", label: "Welder ID", value: NF.format(data.cards.welders) }} />
          </div>
          <div className="wm-split">
            <TreeCard key={`wps-${data.query}`} data={data} tree="wps" title="WPS No" />
            <TreeCard key={`mat-${data.query}`} data={data} tree="mat" title="Type of Material" />
          </div>
        </>
      ) : null}
    </section>
  );
}
