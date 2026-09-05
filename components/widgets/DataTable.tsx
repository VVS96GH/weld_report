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
export function DataTable({ widget }: { widget: TableWidget }) {
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
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {widget.rows.map((row, ri) => (
          <tr key={ri} className={totalIsLastRow && ri === widget.rows.length - 1 ? "row-header" : undefined}>
            {renderCells(row)}
          </tr>
        ))}
        {widget.total_row && !totalIsLastRow ? <tr className="row-header">{renderCells(widget.total_row)}</tr> : null}
      </tbody>
    </table>
  );
}
