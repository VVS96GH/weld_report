/**
 * Column sorting for the report tables (owner, 2026-10-17: a small arrow under
 * every column header sorts it largest→smallest, then smallest→largest, then
 * back to the report's own order). Pure functions: shared by every table view.
 */

export type SortDir = "desc" | "asc";
export type SortState = { col: number; dir: SortDir } | null;

/** Next state for a click on column `col`: desc → asc → off. */
export function nextSort(cur: SortState, col: number): SortState {
  if (!cur || cur.col !== col) return { col, dir: "desc" };
  return cur.dir === "desc" ? { col, dir: "asc" } : null;
}

/** "1,234" → 1234, "1.58 %" → 1.58, "(12)" → -12; blank / "-" → null; other text → the text. */
export function sortKey(cell: string | number | null | undefined): number | string | null {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  const s = cell.trim();
  if (s === "" || s === "-" || s === "—" || s === "–") return null;
  const m = /^(\()?\s*([+-]?[\d.,\s]+?)\s*%?\s*(\))?$/.exec(s);
  if (m) {
    const n = Number(m[2].replace(/[,\s]/g, ""));
    if (Number.isFinite(n)) return m[1] && m[3] ? -n : n;
  }
  return s;
}

/** Compare two cells in `dir`; empty cells always go last, numbers before text. */
export function compareCells(a: string | number | null | undefined, b: string | number | null | undefined, dir: SortDir): number {
  const ka = sortKey(a);
  const kb = sortKey(b);
  if (ka === null || kb === null) return ka === kb ? 0 : ka === null ? 1 : -1;
  let c: number;
  if (typeof ka === "number" && typeof kb === "number") c = ka - kb;
  else if (typeof ka === "number") return -1;
  else if (typeof kb === "number") return 1;
  else c = ka.localeCompare(kb, undefined, { numeric: true, sensitivity: "base" });
  return dir === "asc" ? c : -c;
}

/** Stable sort of `items` by `key(item)`; `pinned(item)` items keep their place at the end. */
export function sortBy<T>(items: T[], key: (item: T) => string | number | null | undefined, sort: SortState, pinned?: (item: T) => boolean): T[] {
  if (!sort) return items;
  const head = items.filter((i) => !pinned?.(i));
  const tail = items.filter((i) => pinned?.(i));
  const idx = head.map((item, i) => ({ item, i }));
  idx.sort((x, y) => compareCells(key(x.item), key(y.item), sort.dir) || x.i - y.i);
  return [...idx.map((x) => x.item), ...tail];
}

/**
 * Row indices of a table whose detail rows sit under a parent row: the parents
 * sort among themselves and each carries its detail rows (sorted too) along.
 * `pinned` rows (the Total) stay last.
 */
export function sortGroupedRows(
  rows: string[][],
  sort: SortState,
  isChild: (row: string[]) => boolean,
  pinned: (ri: number) => boolean,
): number[] {
  const groups: { parent: number; kids: number[] }[] = [];
  rows.forEach((row, ri) => {
    const g = groups[groups.length - 1];
    if (isChild(row) && g && !pinned(g.parent)) g.kids.push(ri);
    else groups.push({ parent: ri, kids: [] });
  });
  if (!sort) return rows.map((_, i) => i);
  const cell = (ri: number) => rows[ri]?.[sort.col];
  return sortBy(groups, (g) => cell(g.parent), sort, (g) => pinned(g.parent)).flatMap((g) => [
    g.parent,
    ...sortBy(g.kids, cell, sort),
  ]);
}
