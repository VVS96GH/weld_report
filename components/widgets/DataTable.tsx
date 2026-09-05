import type { TableWidget } from "@/lib/page-model";

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
          <tr key={ri}>
            {row.map((cell, ci) =>
              ci === 0 ? (
                <th key={ci} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={ci}>{cell}</td>
              ),
            )}
          </tr>
        ))}
        {widget.total_row ? (
          <tr className="row-header">
            {widget.total_row.map((cell, ci) =>
              ci === 0 ? (
                <th key={ci} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={ci}>{cell}</td>
              ),
            )}
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
