"use client";

import { Fragment, useState } from "react";

import type { TableWidget } from "@/lib/page-model";

function rowsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((cell, i) => cell === b[i]);
}

// "375,152", "1.58%", "-", "0.40 %", "(12)" — anything a reader would call a number.
// Numeric cells get `.num` (mono, tabular figures — T.EN spec §3) so digits align.
const NUMERIC_CELL = /^[\s(+-]*[\d.,]+\s*%?\)?\s*$/;

function cellClass(cell: string): string | undefined {
  return NUMERIC_CELL.test(cell) ? "num" : undefined;
}

/**
 * Renders a `.data-table`, matching the mockup's plain HTML tables.
 *
 * The PageModel doesn't distinguish "sub-rows" (the mockup's `.sub-row` class,
 * used for drill-down detail rows) from ordinary rows, so every body row renders
 * the same way; only `total_row` gets the mockup's `.row-header` treatment.
 *
 * The first cell of every row is a `<th scope="row">` (not the mockup's plain
 * `<td>`) for table accessibility; see app/globals.css for the rule that keeps
 * it looking like an ordinary left-aligned cell instead of a header cell.
 */
/**
 * Header line breaks the owner set by hand (2026-10-15, page 2's RT & PWHT
 * table: "RT B.log & PWHT "Y" Done + PWHT "N" FAB-D" on 5 lines, and so on).
 * Display only: the column names in the model are unchanged.
 */
const HEADER_LINES: Record<string, string[]> = {
  'RT+PWHT "Y" Done': ['RT+PWHT "Y"', "Done"],
  "RT B.LOG & PWHT NOT Done": ["RT B.LOG &", "PWHT NOT", "Done"],
  "RT B.log & FAB-D": ["RT B.log &", "FAB-D"],
  'RT B.log & PWHT "Y" Done + PWHT "N" FAB-D': ["RT B.log &", 'PWHT "Y"', "Done +", 'PWHT "N"', "FAB-D"],
  'RT B.LOG & PWHT"Y" NOT Done FAB-D': ["RT B.LOG &", 'PWHT"Y"', "NOT Done", "FAB-D"],
  "% Rej by Joint": ["% Rej", "by Joint"],
  "% Rej UT Joint": ["% Rej", "UT Joint"],
};

function HeaderText({ col }: { col: string }) {
  const lines = HEADER_LINES[col];
  if (!lines) return <span className="th-text">{col}</span>;
  return (
    <span className="th-text th-text--set">
      {lines.map((l, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {l}
        </Fragment>
      ))}
    </span>
  );
}

/** A detail row: its first cell is indented under the group row above it ("  Manual"). */
const isChild = (row: string[]) => /^\s{2}/.test(row[0] ?? "");

/**
 * With `collapsible`, a row followed by indented detail rows gets + / − and its
 * details start hidden (owner, 2026-10-15: the HA Flange Status table opens an HA
 * to its methods, like the Welder Performance matrix).
 */
export function DataTable({ widget, collapsible = false }: { widget: TableWidget; collapsible?: boolean }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const lastRow = widget.rows[widget.rows.length - 1];
  // `total_row` marks WHICH row gets the mockup's `.row-header` styling — it isn't a
  // separate row. The extractor (and both the fixture and DB assemblers) already
  // include the mockup's Total row in `rows`, so append it only when it's genuinely
  // absent from `rows`; otherwise style that last row in place instead of duplicating it.
  const totalIsLastRow = widget.total_row !== undefined && lastRow !== undefined && rowsEqual(widget.total_row, lastRow);

  const renderCells = (row: string[]) =>
    row.map((cell, ci) =>
      ci === 0 ? (
        <th key={ci} scope="row">
          {cell}
        </th>
      ) : (
        <td key={ci} className={cellClass(cell)}>
          {cell}
        </td>
      ),
    );

  return (
    <table className="data-table">
      <thead>
        <tr>
          {widget.columns.map((col, i) => (
            <th key={i} scope="col">
              {/* a box with a max width: a long header wraps instead of widening its column */}
              <HeaderText col={col} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {collapsible
          ? widget.rows.map((row, ri) => {
              if (isChild(row)) return null;
              const kids: string[][] = [];
              for (let k = ri + 1; k < widget.rows.length && isChild(widget.rows[k]); k++) kids.push(widget.rows[k]);
              const isTotal = totalIsLastRow && ri === widget.rows.length - 1;
              const shown = Boolean(open[ri]);
              return (
                <Fragment key={ri}>
                  <tr className={isTotal ? "row-header" : kids.length ? "dt-group" : undefined}>
                    {kids.length ? (
                      <>
                        <th scope="row">
                          <button
                            type="button"
                            className="error-expand"
                            aria-expanded={shown}
                            onClick={() => setOpen((o) => ({ ...o, [ri]: !o[ri] }))}
                          >
                            <span aria-hidden="true">{shown ? "−" : "+"}</span> {row[0]}
                          </button>
                        </th>
                        {renderCells(row).slice(1)}
                      </>
                    ) : (
                      renderCells(row)
                    )}
                  </tr>
                  {shown
                    ? kids.map((kid, ki) => (
                        <tr key={ki} className="dt-child">
                          {renderCells(kid)}
                        </tr>
                      ))
                    : null}
                </Fragment>
              );
            })
          : widget.rows.map((row, ri) => (
              <tr key={ri} className={totalIsLastRow && ri === widget.rows.length - 1 ? "row-header" : undefined}>
                {renderCells(row)}
              </tr>
            ))}
        {widget.total_row && !totalIsLastRow ? <tr className="row-header">{renderCells(widget.total_row)}</tr> : null}
      </tbody>
    </table>
  );
}
