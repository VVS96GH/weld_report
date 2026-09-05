#!/usr/bin/env python3
"""
Read-only profiler for the .xlsx / small .csv workbooks in `sources/`.

openpyxl read-only + data_only=True (so we read the CACHED VALUE of every
formula, which is what Power Query's Excel.Workbook sees too).

For every workbook: sheet list, dimensions, the header row as
`Table.PromoteHeaders` would see it (after the Table.Skip the M performs, where
it performs one), the first 5 data rows, and - for the SMALL ones - a full
per-column profile.  The three big ones (Flange Progress, ovAssets_1619,
CSVExport_Welder Record - (ACC REJ)) get sheets + headers + row counts + a
20-row sample only; fully profiling 641 k x 119 cells of cached values is
minutes of XML parsing for no decision value.

Writes ONLY analysis/sources2/workbooks.md (+ trend-*.json for the two trend
workbooks, which scope item 3 needs machine-readable).

Usage:  uv run analysis/sources2/profile_xlsx.py
        uv run analysis/sources2/profile_xlsx.py --skip-big
"""

from __future__ import annotations

import collections
import datetime as dt
import json
import os
import sys
import time

from openpyxl import load_workbook

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(REPO, "sources")
OUT = os.path.join(REPO, "analysis", "sources2")

FULL = "full"      # full column profile
SAMPLE = "sample"  # headers + 20 rows only

# (relative path, mode, M skip-rows, the pbix table it feeds or None)
BOOKS = [
    ("CUM Trend file RT and PWHT/CUM Trend file RT and PWHT Backlog .xlsx", FULL, 0, "TREND Report"),
    ("CUM Trend file RT and PWHT/Back up/CUM Trend file RT and PWHT Backlog .xlsx", FULL, 0, "(backup copy)"),
    ("CUM Trend RT% UT% RejRate/CUM Trend RT% UT% RejRate.xlsx", FULL, 0, "TREND RT UT"),
    ("CUM Trend RT% UT% RejRate/Back up/CUM Trend RT% UT% RejRate.xlsx", FULL, 0, "(backup copy)"),
    ("CUM Trend Active Welders/CUM Trend Active Welders.xlsx", FULL, 0, "Trend Active Welders"),
    ("CUM MPI Done .xlsx", FULL, 0, "CUM MPI Done"),
    ("TO BE EXLUDE FROM DATA.xlsx", FULL, 0, None),
    ("UT TRACKER (CCC)_Talisman.xlsx", FULL, 0, "UT TRACKER (CCC)_Talisman"),
    ("Flange Progress.xlsx", SAMPLE, 5, "Flange Progress"),
    ("ovAssets_1619.xlsx", SAMPLE, 0, "Flange ovAssets_1619"),
    ("CSVExport_Welder Record - FOR PIC UPDATE  (ACC  REJ ).xlsx", SAMPLE, 0,
     "CSVExport_Welder Record - (ACC  REJ )"),
]

# small plain-text files that sit beside the workbooks
TEXTS = [
    ("CUM Trend Active Welders/Project Welders By Weekend .csv", ","),
    ("CUM Trend Active Welders/New Text Document.txt", None),
]

# workbooks whose rows we also dump to JSON for the snapshot-seed plan
TREND_JSON = {
    "CUM Trend file RT and PWHT/CUM Trend file RT and PWHT Backlog .xlsx": "trend-rt-pwht.json",
    "CUM Trend RT% UT% RejRate/CUM Trend RT% UT% RejRate.xlsx": "trend-rt-ut-rejrate.json",
    "CUM Trend Active Welders/CUM Trend Active Welders.xlsx": "trend-active-welders.json",
    "CUM MPI Done .xlsx": "trend-mpi-done.json",
}

MAX_FULL_ROWS = 200_000


def cell(v):
    if v is None:
        return ""
    if isinstance(v, dt.datetime):
        return v.strftime("%Y-%m-%d") if (v.hour, v.minute, v.second) == (0, 0, 0) \
            else v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, dt.date):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v == int(v) and abs(v) < 1e15:
        return str(int(v))
    return str(v)


def esc(v):
    return str(v).replace("|", "\\|").replace("\n", " ").replace("\r", " ")


def fmt(n):
    return "{:,}".format(n) if isinstance(n, int) else str(n)


def profile_sheet(ws, skip, mode):
    """Return (header, rows_scanned, first5, colprofiles|None, all_rows|None)."""
    header = None
    first5 = []
    colcount = collections.Counter()
    profiles = None
    allrows = [] if mode == FULL else None
    n = 0
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < skip:
            continue
        vals = [cell(v) for v in row]
        while vals and vals[-1] == "":
            vals.pop()
        if header is None:
            if not any(vals):
                continue                      # leading blank rows
            header = vals
            profiles = [dict(name=(h or "(unnamed col %d)" % (j + 1)),
                             nonempty=0, blank=0, counter=collections.Counter(),
                             maxlen=0)
                        for j, h in enumerate(header)]
            continue
        if not any(vals):
            continue
        n += 1
        colcount[len(vals)] += 1
        if len(first5) < 5:
            first5.append(vals)
        if mode == FULL and n <= MAX_FULL_ROWS:
            allrows.append(vals)
            for j in range(len(profiles)):
                v = vals[j] if j < len(vals) else ""
                p = profiles[j]
                if v:
                    p["nonempty"] += 1
                    if len(p["counter"]) < 20000 or v in p["counter"]:
                        p["counter"][v] += 1
                    if len(v) > p["maxlen"]:
                        p["maxlen"] = len(v)
                else:
                    p["blank"] += 1
    return header or [], n, first5, profiles, allrows, colcount


def main():
    skip_big = "--skip-big" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    A = []
    w = A.append
    w("# sources/ batch 2 - workbook profile")
    w("")
    w("Generated by `uv run analysis/sources2/profile_xlsx.py`. openpyxl "
      "read-only, `data_only=True` (cached formula values - the same thing "
      "Power Query's `Excel.Workbook` reads).")
    w("")
    w("| workbook | bytes | sheets | pbix table |")
    w("|---|---:|---|---|")
    present = []
    for rel, mode, skip, tbl in BOOKS:
        p = os.path.join(SRC, rel)
        if not os.path.exists(p):
            w("| `%s` | - | **MISSING** | %s |" % (rel, tbl or "-"))
            continue
        present.append((rel, mode, skip, tbl, p))
    for rel, mode, skip, tbl, p in present:
        try:
            wb = load_workbook(p, read_only=True, data_only=True)
            sheets = wb.sheetnames
            wb.close()
        except Exception as e:                       # noqa: BLE001
            sheets = ["<open failed: %s>" % e]
        w("| `%s` | %s | %s | %s |" % (rel, fmt(os.path.getsize(p)),
                                       ", ".join("`%s`" % s for s in sheets),
                                       ("`%s`" % tbl) if tbl else "**not referenced by the pbix**"))
    w("")
    w("---")
    w("")

    for rel, mode, skip, tbl, p in present:
        if mode == SAMPLE and skip_big:
            continue
        t0 = time.time()
        print("reading %s ..." % rel, flush=True)
        w("## `sources/%s`" % rel)
        w("")
        w("%s bytes \u00b7 pbix table %s \u00b7 mode `%s`%s" % (
            fmt(os.path.getsize(p)),
            ("`%s`" % tbl) if tbl else "**none - not referenced by the pbix**",
            mode,
            " \u00b7 M does `Table.Skip(%d)` before PromoteHeaders" % skip if skip else ""))
        w("")
        try:
            wb = load_workbook(p, read_only=True, data_only=True)
        except Exception as e:                       # noqa: BLE001
            w("**could not open: %s**" % e)
            w("")
            continue
        for ws in wb.worksheets:
            hdr, n, first5, profiles, allrows, colcount = profile_sheet(ws, skip, mode)
            w("### sheet `%s`" % ws.title)
            w("")
            dims = getattr(ws, "calculate_dimension", None)
            try:
                dimtxt = dims() if dims else "?"
            except Exception:                        # noqa: BLE001
                dimtxt = "?"
            w("* declared dimension `%s`, max_row=%s, max_col=%s" % (
                dimtxt, ws.max_row, ws.max_column))
            w("* non-blank data rows after the header%s: **%s**" % (
                " (and after Table.Skip(%d))" % skip if skip else "", fmt(n)))
            w("* header as `Table.PromoteHeaders` sees it (%d fields): %s" % (
                len(hdr), ", ".join("`%s`" % esc(h) for h in hdr) if hdr else "_(none)_"))
            if len(colcount) > 1:
                w("* ragged row widths: %s" % ", ".join(
                    "%d\u2192%s" % (k, fmt(v)) for k, v in sorted(colcount.items())))
            w("")
            if first5:
                w("First %d data rows:" % len(first5))
                w("")
                w("| " + " | ".join("`%s`" % esc(h) for h in hdr[:14]) + (" | \u2026" if len(hdr) > 14 else "") + " |")
                w("|" + "---|" * (min(len(hdr), 14) + (1 if len(hdr) > 14 else 0)))
                for r in first5:
                    cells = [esc(r[j]) if j < len(r) else "" for j in range(min(len(hdr), 14))]
                    w("| " + " | ".join(cells) + (" | \u2026" if len(hdr) > 14 else "") + " |")
                w("")
            if mode == SAMPLE:
                extra = []
                for i, row in enumerate(ws.iter_rows(values_only=True)):
                    if i < skip + 1 + 5:
                        continue
                    vals = [cell(v) for v in row]
                    if not any(vals):
                        continue
                    extra.append(vals)
                    if len(extra) >= 15:
                        break
                if extra:
                    w("Rows 6-%d (sample only - this workbook is not fully profiled):" % (5 + len(extra)))
                    w("")
                    w("```")
                    for r in extra:
                        w(" | ".join(r[:14])[:300])
                    w("```")
                    w("")
            elif profiles:
                w("| # | column | non-empty | blank | distinct | max len | top values |")
                w("|---:|---|---:|---:|---:|---:|---|")
                for j, pr in enumerate(profiles):
                    c = pr["counter"]
                    top = ", ".join("`%s`\u00d7%s" % (esc(v), fmt(k)) for v, k in c.most_common(15))
                    w("| %d | `%s` | %s | %s | %s | %s | %s |" % (
                        j + 1, esc(pr["name"]), fmt(pr["nonempty"]), fmt(pr["blank"]),
                        fmt(len(c)), pr["maxlen"], top))
                w("")
            if mode == FULL and rel in TREND_JSON and allrows and ws is wb.worksheets[0]:
                with open(os.path.join(OUT, TREND_JSON[rel]), "w") as fh:
                    json.dump(dict(file=rel, sheet=ws.title, header=hdr,
                                   rows=allrows), fh, indent=1)
        wb.close()
        w("_(%.1fs)_" % (time.time() - t0))
        w("")
        w("---")
        w("")

    # ---------------------------------------------------------- plain text
    w("## Plain-text files beside the workbooks")
    w("")
    for rel, delim in TEXTS:
        p = os.path.join(SRC, rel)
        w("### `sources/%s`" % rel)
        w("")
        if not os.path.exists(p):
            w("**MISSING**")
            w("")
            continue
        raw = open(p, "rb").read()
        try:
            txt = raw.decode("utf-8")
            enc = "utf-8"
        except UnicodeDecodeError:
            txt = raw.decode("cp1252", errors="replace")
            enc = "cp1252"
        lines = txt.splitlines()
        w("%s bytes, %d lines, decoded as `%s`. **Not referenced by any Power Query "
          "in analysis/pbix/model.md.**" % (fmt(len(raw)), len(lines), enc))
        w("")
        w("```")
        for ln in lines[:25]:
            w(ln[:200])
        if len(lines) > 25:
            w("... (+%d more lines)" % (len(lines) - 25))
        w("```")
        w("")
    with open(os.path.join(OUT, "workbooks.md"), "w") as fh:
        fh.write("\n".join(A) + "\n")
    print("wrote analysis/sources2/workbooks.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
