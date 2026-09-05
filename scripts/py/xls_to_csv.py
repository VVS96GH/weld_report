#!/usr/bin/env python3
"""Emit one sheet of a BIFF .xls as CSV on stdout.

`exceljs` cannot read BIFF at all — handed an .xls it looks for a zip central
directory and throws — and `sources/Welders/SCTR NFE WELDERS APPLIED.xls` is
BIFF8.  Ruling R3-11: convert at LOAD TIME through this script rather than
checking a converted copy into the repo, because a checked-in copy goes stale
silently the next time the analyst re-downloads the workbook.

Run through uv (xlrd is pinned in pyproject.toml):

    uv run scripts/py/xls_to_csv.py "<file.xls>" "<sheet name>"

Output is RFC4180 CSV on stdout: every cell as text, dates as ISO yyyy-mm-dd,
numbers without a trailing .0 when they are whole.  Rows are NOT trimmed and
blank rows are NOT skipped — the caller reads this file POSITIONALLY (R3-09,
the stored Power Query is stale and would error), so row and column indices
must survive the conversion exactly.
"""

import csv
import sys

import xlrd


def cell_text(book: "xlrd.Book", cell: "xlrd.sheet.Cell") -> str:
    if cell.ctype == xlrd.XL_CELL_EMPTY or cell.ctype == xlrd.XL_CELL_BLANK:
        return ""
    if cell.ctype == xlrd.XL_CELL_DATE:
        y, mo, d, h, mi, s = xlrd.xldate_as_tuple(cell.value, book.datemode)
        if (h, mi, s) == (0, 0, 0):
            return "%04d-%02d-%02d" % (y, mo, d)
        return "%04d-%02d-%02dT%02d:%02d:%02d" % (y, mo, d, h, mi, s)
    if cell.ctype == xlrd.XL_CELL_NUMBER:
        v = cell.value
        return str(int(v)) if float(v).is_integer() else repr(v)
    if cell.ctype == xlrd.XL_CELL_BOOLEAN:
        return "TRUE" if cell.value else "FALSE"
    if cell.ctype == xlrd.XL_CELL_ERROR:
        return ""
    return str(cell.value)


def main() -> int:
    if len(sys.argv) != 3:
        sys.stderr.write("usage: xls_to_csv.py <file.xls> <sheet name>\n")
        return 2
    path, sheet_name = sys.argv[1], sys.argv[2]
    book = xlrd.open_workbook(path, formatting_info=False)
    names = book.sheet_names()
    if sheet_name not in names:
        sys.stderr.write(
            "sheet %r not found in %s (has: %s)\n" % (sheet_name, path, ", ".join(names))
        )
        return 1
    sheet = book.sheet_by_name(sheet_name)
    out = csv.writer(sys.stdout, lineterminator="\n")
    for r in range(sheet.nrows):
        out.writerow([cell_text(book, sheet.cell(r, c)) for c in range(sheet.ncols)])
    return 0


if __name__ == "__main__":
    sys.exit(main())
