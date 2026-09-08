import type { TableWidget } from "@/lib/page-model";

/**
 * The "FLANGE MANAGEMENT / Repartition and Progress" matrix: a grouped header
 * derived from the column names ("Manual Required" → group "Manual", sub-column
 * "Required"), HA parent rows shaded, sub-contractor child rows (two-space indent
 * in the first cell) indented, every "Completed %" column shaded, Total row bold —
 * the pbix table's own reading conventions.
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

  return (
    <div className="table-scroll">
      <table className="data-table pbi-matrix">
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className="pbi-matrix-corner">{first}</th>
            {header.map((g, gi) => (
              <th key={`g-${gi}`} scope="colgroup" colSpan={g.subs.length} className="pbi-matrix-group">{g.name}</th>
            ))}
          </tr>
          <tr>
            {rest.map((col, ci) => (
              <th key={ci} scope="col" className={isPct(col) ? "pbi-matrix-pct" : undefined}>
                {col.replace(/^(Manual|TBN|Tensioning|Torquing|Total) /, "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const child = row[0].startsWith("  ");
            const total = lastIsTotal && ri === rows.length - 1;
            const cls = total ? "row-header" : child ? "pbi-matrix-child" : "pbi-matrix-parent";
            return (
              <tr key={ri} className={cls}>
                <th scope="row">{row[0].trim()}</th>
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
