"use client";

import { useState } from "react";

import { FilterBar } from "@/components/FilterBar";
import { usePageSubtitle } from "@/components/ReportShell";
import { ColHead, colThProps } from "@/components/ColHead";
import { tableKeyOf, useTablePrefs } from "@/lib/col-prefs";
import type { ErrorCheckResult, ErrorNode, ErrorsPage } from "@/lib/pages/errors";
import { nextSort, sortBy, type SortState } from "@/lib/table-sort";

/** Nodes in the header-arrow order: column 0 the label, then the split columns, then the total. */
function sortNodes(nodes: ErrorNode[], columns: string[], sort: SortState): ErrorNode[] {
  if (!sort) return nodes;
  return sortBy(nodes, (n) => (sort.col === 0 ? n.label : sort.col <= columns.length ? (n.counts[columns[sort.col - 1]] ?? null) : n.total), sort);
}

const num = (n: number | undefined) => (n ? n.toLocaleString("en-US") : "");

/**
 * One node of the pbix-style row hierarchy and, when expanded, its children.
 * Leaves (the joints) have no toggle.
 */
function NodeRows({
  node,
  path,
  depth,
  columns,
  open,
  toggle,
  sort,
}: {
  sort: SortState;
  node: ErrorNode;
  path: string;
  depth: number;
  columns: string[];
  open: Record<string, boolean>;
  toggle: (path: string) => void;
}) {
  const isOpen = Boolean(open[path]);
  const leaf = node.children.length === 0;
  return (
    <>
      <tr className={depth === 0 ? "error-level0" : undefined}>
        <td style={{ paddingInlineStart: `${12 + depth * 18}px` }}>
          {leaf ? (
            <span className="error-leaf">{node.label}</span>
          ) : (
            <button type="button" className="error-expand" aria-expanded={isOpen} onClick={() => toggle(path)}>
              <span aria-hidden="true">{isOpen ? "−" : "+"}</span> {node.label}
            </button>
          )}
        </td>
        {columns.map((c) => (
          <td key={c} className="num">
            {num(node.counts[c])}
          </td>
        ))}
        <td className="num">{num(node.total)}</td>
      </tr>
      {isOpen
        ? sortNodes(node.children, columns, sort).map((ch) => (
            <NodeRows
              key={ch.label}
              sort={sort}
              node={ch}
              path={`${path}\u0000${ch.label}`}
              depth={depth + 1}
              columns={columns}
              open={open}
              toggle={toggle}
            />
          ))
        : null}
    </>
  );
}

/** Every path of the tree, so "expand all" can open it in one go. */
function allPaths(nodes: ErrorNode[], prefix = ""): string[] {
  return nodes.flatMap((n) => {
    const p = prefix ? `${prefix}\u0000${n.label}` : n.label;
    return n.children.length ? [p, ...allPaths(n.children, p)] : [];
  });
}

/** One check: the matrix (rows expand down to their joints) and its CSV link. */
function CheckCard({ check, n }: { check: ErrorCheckResult; n: number }) {
  const { nodes, totals, total } = check.matrix;
  // a matrix with no column split shows only its count column
  const columns = check.totalLabel ? [] : check.matrix.columns;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (p: string) => setOpen((o) => ({ ...o, [p]: !o[p] }));
  const [sort, setSort] = useState<SortState>(null);
  const tkey = tableKeyOf(["errors", check.id]);
  const prefs = useTablePrefs(tkey);
  const onSort = (col: number) => setSort((cur) => nextSort(cur, col));
  const ariaSort = (col: number) => (sort?.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : undefined);
  const everything = allPaths(nodes);
  const allOpen = everything.length > 0 && everything.every((p) => open[p]);
  const csv = `/api/errors/${check.id}${check.csvQuery ? `?${check.csvQuery}` : ""}`;
  return (
    <section className="card error-card" aria-labelledby={`err-${check.id}`}>
      <div className="error-card-head">
        <h3 id={`err-${check.id}`} className="error-title">
          <span className="error-no">{n}.</span> {check.title}
        </h3>
        <span className={`error-count${check.count ? " has-errors" : ""}`}>
          {check.count
            ? check.totalLabel
              ? `${num(check.count)} joint+welder key${check.count === 1 ? "" : "s"}`
              : `${num(check.count)} joint${check.count === 1 ? "" : "s"}`
            : "no errors"}
        </span>
        {everything.length && !check.table ? (
          <button
            type="button"
            className="ms-btn"
            onClick={() => setOpen(allOpen ? {} : Object.fromEntries(everything.map((p) => [p, true])))}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        ) : null}
        <a className="ms-btn ms-btn--primary error-csv" href={csv} download>
          Download CSV
        </a>
      </div>
      <p className="error-desc">{check.description}</p>
      {/* the table on the left, this check's own slicers beside it (owner's layout,
          2026-10-14); the slicers filter this card and its CSV only */}
      <div className="error-body">
      <div className="error-table">
      {check.table ? (
        check.table.rows.length === 0 ? (
          <p className="error-empty">Nothing to correct under the current filter.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table error-flat">
              <thead>
                <tr>
                  {check.table.columns.map((c, ci) => (
                    <th key={c} aria-sort={ariaSort(ci)} {...colThProps(prefs, c)}>
                      <ColHead table={tkey} col={c} index={ci} sort={sort} onSort={onSort}>
                        {c}
                      </ColHead>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortBy(check.table.rows, (r) => r[sort?.col ?? 0], sort).map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j} className={typeof v === "number" ? "num" : undefined}>
                        {typeof v === "number" ? num(v) || "0" : (v ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="row-header">
                  {check.table.total.map((v, j) => (
                    <td key={j} className={typeof v === "number" ? "num" : undefined}>
                      {typeof v === "number" ? num(v) || "0" : (v ?? "")}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )
      ) : nodes.length === 0 ? (
        <p className="error-empty">Nothing to correct under the current filter.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table error-matrix">
            <thead>
              <tr>
                <th aria-sort={ariaSort(0)} {...colThProps(prefs, check.rowLabel)}>
                  <ColHead table={tkey} col={check.rowLabel} index={0} sort={sort} onSort={onSort}>
                    {check.rowLabel}
                  </ColHead>
                </th>
                {columns.map((c, ci) => (
                  <th key={c} className="num" aria-sort={ariaSort(ci + 1)} {...colThProps(prefs, c || "(blank)")}>
                    <ColHead table={tkey} col={c || "(blank)"} index={ci + 1} sort={sort} onSort={onSort}>
                      {c || "(blank)"}
                    </ColHead>
                  </th>
                ))}
                <th className="num" aria-sort={ariaSort(columns.length + 1)} {...colThProps(prefs, (check.totalLabel ?? "Total"))}>
                  <ColHead table={tkey} col={(check.totalLabel ?? "Total")} index={columns.length + 1} sort={sort} onSort={onSort}>
                    {check.totalLabel ?? "Total"}
                  </ColHead>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortNodes(nodes, columns, sort).map((n) => (
                <NodeRows key={n.label} sort={sort} node={n} path={n.label} depth={0} columns={columns} open={open} toggle={toggle} />
              ))}
              <tr className="row-header">
                <td>Total</td>
                {columns.map((c) => (
                  <td key={c} className="num">
                    {num(totals[c])}
                  </td>
                ))}
                <td className="num">{num(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      </div>
      <div className="error-filters">
        <FilterBar widgets={check.filters} />
      </div>
      </div>
      {check.exceptions ? (
        <details className="error-exceptions">
          <summary>{check.exceptions.title}</summary>
          <ul>
            {check.exceptions.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export function ErrorsView({ page, note }: { page: ErrorsPage; note?: string }) {
  usePageSubtitle(`Data as of ${page.as_of}`);
  return (
    <section className="page-section active errors-page" aria-labelledby="page-heading">
      <div className="page-header">
        <h2 id="page-heading">Errors</h2>
      </div>
      <p className="page-subtitle">
        Data errors to be corrected by the sub-contractors. Download a check as CSV and send it to the sub-contractor
        concerned. Each check has its own filters, which apply to that check and its CSV only.
      </p>
      {note ? <p className="error-empty">{note}</p> : null}
      {page.checks.map((c, i) => (
        <CheckCard key={c.id} check={c} n={i + 1} />
      ))}
    </section>
  );
}
