"use client";

import { useState } from "react";

import { ColHead, colThProps } from "@/components/ColHead";
import { tableKeyOf, useTablePrefs } from "@/lib/col-prefs";
import type { TableWidget } from "@/lib/page-model";
import { nextSort, sortGroupedRows, type SortState } from "@/lib/table-sort";

/**
 * The "FLANGE MANAGEMENT / Repartition and Progress" matrix: a grouped header
 * derived from the column names ("Manual Required" → group "Manual", sub-column
 * "Required"), HA parent rows shaded, sub-contractor child rows (two-space indent
 * in the first cell) indented, every "Completed %" column shaded, Total row bold —
 * the pbix table's own reading conventions. An HA starts collapsed; + opens it to
 * its sub-contractors (owner, 2026-10-15, like the Welder Performance matrix).
 */
export function MatrixTable({ widget }: { widget: TableWidget }) {
  const [first, ...rest] = widget.columns;
  const groups: { name: string; subs: string[] }[] = [];
  for (const col of rest) {
    const at = col.lastIndexOf(" ");
    const name = at > 0 ? col.slice(0, at) : col;
    const sub = at > 0 ? col.slice(at + 1) : col;
    const g = groups[groups.length - 1];
    if (g && g.name === name) g.subs.push(sub);
    else groups.push({ name, subs: [sub] });
  }
  // "Completed Total" arrives as group "Completed" + sub "Total" by the split above;
  // fold it back: the real groups are the tightening methods.
  const METHODS = ["Manual", "TBN", "Tensioning", "Torquing", "Total"];
  const folded: { name: string; subs: string[] }[] = [];
  for (const col of rest) {
    const method = METHODS.find((m) => col.startsWith(m + " "));
    const name = method ?? col;
    const sub = method ? col.slice(method.length + 1) : "";
    const g = folded[folded.length - 1];
    if (g && g.name === name) g.subs.push(sub);
    else folded.push({ name, subs: [sub] });
  }
  const header = folded.length > 0 ? folded : groups;
  const isPct = (col: string) => /%$/.test(col.trim());
  const rows = widget.rows;
  const lastIsTotal = rows.length > 0 && rows[rows.length - 1][0] === "Total";
  const [open, setOpen] = useState<Record<number, boolean>>({});
  // each child row's parent (the nearest row above it that is not indented)
  const parentOf: number[] = [];
  let lastParent = -1;
  rows.forEach((row, ri) => {
    if (!row[0].startsWith("  ")) lastParent = ri;
    parentOf[ri] = lastParent;
  });
  const hasKids = (ri: number) => rows[ri + 1]?.[0].startsWith("  ") ?? false;
  const [sort, setSort] = useState<SortState>(null);
  const tkey = tableKeyOf(widget.columns);
  const prefs = useTablePrefs(tkey);
  const onSort = (col: number) => setSort((cur) => nextSort(cur, col));
  const order = sortGroupedRows(rows, sort, (r) => r[0].startsWith("  "), (ri) => lastIsTotal && ri === rows.length - 1);
  const ariaSort = (col: number) => (sort?.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : undefined);

  return (
    <div className="table-scroll">
      <table className="data-table pbi-matrix">
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className="pbi-matrix-corner" aria-sort={ariaSort(0)} {...colThProps(prefs, first)}>
              <ColHead table={tkey} col={first} index={0} sort={sort} onSort={onSort}>
                {first}
              </ColHead>
            </th>
            {header.map((g, gi) => (
              <th key={`g-${gi}`} scope="colgroup" colSpan={g.subs.length} className="pbi-matrix-group">{g.name}</th>
            ))}
          </tr>
          <tr>
            {rest.map((col, ci) => (
              <th key={ci} scope="col" className={isPct(col) ? "pbi-matrix-pct" : undefined} aria-sort={ariaSort(ci + 1)} {...colThProps(prefs, col)}>
                <ColHead table={tkey} col={col} index={ci + 1} sort={sort} onSort={onSort}>
                  {col.replace(/^(Manual|TBN|Tensioning|Torquing|Total) /, "")}
                </ColHead>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.map((ri) => {
            const row = rows[ri];
            const child = row[0].startsWith("  ");
            const total = lastIsTotal && ri === rows.length - 1;
            const cls = total ? "row-header" : child ? "pbi-matrix-child" : "pbi-matrix-parent";
            if (child && !open[parentOf[ri]]) return null;
            const kids = !child && !total && hasKids(ri);
            return (
              <tr key={ri} className={cls}>
                <th scope="row">
                  {kids ? (
                    <button
                      type="button"
                      className="error-expand"
                      aria-expanded={Boolean(open[ri])}
                      onClick={() => setOpen((o) => ({ ...o, [ri]: !o[ri] }))}
                    >
                      <span aria-hidden="true">{open[ri] ? "−" : "+"}</span> {row[0].trim()}
                    </button>
                  ) : (
                    row[0].trim()
                  )}
                </th>
                {row.slice(1).map((cell, ci) => (
                  <td key={ci} className={`num ${isPct(rest[ci] ?? "") ? "pbi-matrix-pct" : ""}`.trim()}>{cell}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
