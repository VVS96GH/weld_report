#!/usr/bin/env python3
"""
Read-only profiler for the batch-3 workbooks in `sources/`
(Acciona, Inco, Weld Length, Welders) + the re-copied exclusion list.

Same contract as `analysis/sources2/profile_xlsx.py`, extended for two things
that batch 2 did not need:

  1. **Named Excel Tables.**  Three of the M queries read
     `Source{[Item="X",Kind="Table"]}` — a *ListObject*, not a sheet.  openpyxl's
     read-only mode does not expose `ws.tables`, so we parse
     `xl/tables/*.xml` + the sheet rels out of the zip ourselves to find which
     sheet each table lives on and what range it covers, then read exactly that
     range.  `Kind="Table"` means the header is the table's first row and there
     is NO `Table.PromoteHeaders` step in the M.
  2. **Legacy BIFF `.xls`** (`SCTR NFE WELDERS APPLIED.xls`) via `xlrd`.
     exceljs (the Node loader library) cannot read BIFF at all — see welders.md.

openpyxl `read_only=True, data_only=True` → cached formula values, which is what
Power Query's `Excel.Workbook` sees.

Writes ONLY  analysis/sources3/workbooks.md  and  analysis/sources3/*.json.

Usage:  uv run analysis/sources3/profile_xlsx.py
        uv run analysis/sources3/profile_xlsx.py --skip-big   (skips Weld Length Sheet1)
"""

from __future__ import annotations

import collections
import datetime as dt
import hashlib
import json
import os
import re
import sys
import time
import zipfile

from openpyxl import load_workbook
from openpyxl.utils import range_boundaries

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(REPO, "sources")
OUT = os.path.join(REPO, "analysis", "sources3")

MAX_TOP = 15          # top-N values per column
MAX_FULL_ROWS = 800_000

# ---------------------------------------------------------------------------
# TARGETS.  (relative path, [(kind, name, skip, pbix_table, pbix_rows), ...])
#   kind: "table" = named ListObject (M: Kind="Table", no PromoteHeaders)
#         "sheet" = worksheet       (M: Kind="Sheet", + Table.Skip(skip) then
#                                       Table.PromoteHeaders)
#   pbix_rows: the row count stored in the pbix model, or None
# ---------------------------------------------------------------------------
TARGETS = [
    ("Acciona/Acciona_Latest Add to Query.xlsx", [
        ("table", "Acciona_Query", 0, "Acciona_Query", 13_313),
        # The M for `Acciona Joint Summary` promotes twice, skips twice,
        # RemoveLastN(1), then keeps rows with `No. of Joints Welded ` non-null
        # and `Material <> "Grand Total ==>"`.  Reproduced as MFILTER.
        ("sheet", "Joint Summary", 2, "Acciona Joint Summary", 29),
    ]),
    ("Inco/Master Weld_Latest.xlsx", [
        ("sheet", "Overall Weld Log Query", 0, "Inco Weld Log", 10_327),
    ]),
    ("Weld Length/Weld Length.xlsx", [
        ("sheet", "Sheet1", 0, "Weld Length", 728_550),
        ("sheet", "Sheet2", 0, None, None),
    ]),
    ("Weld Length/Rework code.xlsx", [
        ("sheet", "Rework code", 0, None, None),
        ("sheet", "Sheet1", 0, None, None),
    ]),
    ("Welders/Welders Power Q for PBI .xlsx", [
        ("table", "WELDERS_Qualification", 0, "WELDERS_Qualification", 5_484),
        ("sheet", "WEEK #   STATUS", 1, "WEEK #   STATUS", 8),
        ("sheet", "CUM WEEK # Status", 0, "CUM WEEK # Status", 1_016),
    ]),
    ("Welders/SCTR NFE WELDERS APPLIED.xls", [
        ("xls", "SCTR OVERALL APPLIED WELDERS", 1, "SCTR OVERALL APPLIED WELDERS", 16),
    ]),
    ("TO BE EXLUDE FROM DATA.xlsx", [
        ("sheet", "TO BE Exlude from Data", 0, None, 596),
        ("sheet", "Sheet1", 0, None, 20),
    ]),
]

# The M's own row filters, reproduced so the measured count is comparable with
# the pbix's stored count.  (workbook, object) -> list of (column, op, value).
#   "notblank" -> Table.SelectRows(each [c] <> null)
#   "ne"       -> Table.SelectRows(each [c] <> v)
MFILTER = {
    ("Acciona/Acciona_Latest Add to Query.xlsx", "Joint Summary"): [
        ("No. of Joints Welded ", "notblank", None),
        ("Material", "ne", "Grand Total ==>"),
    ],
    ("Welders/SCTR NFE WELDERS APPLIED.xls", "SCTR OVERALL APPLIED WELDERS"): [
        ("STRUCTURAL / PIPING", "ne", "TOTAL"),
    ],
}

# Back-ups / dated copies: sheet names + row counts + does the header match the
# M-named file?  Nothing else.  (path, comparison target path, sheet to compare)
SHAPE_ONLY = [
    ("Acciona/Acciona_Latest.xlsx",                      "Acciona/Acciona_Latest Add to Query.xlsx"),
    ("Acciona/Acciona Latest 19 April.xlsx",             "Acciona/Acciona_Latest Add to Query.xlsx"),
    ("Acciona/Acciona_Latest 12 jan.xlsx",               "Acciona/Acciona_Latest Add to Query.xlsx"),
    ("Acciona/Back up/Acciona_Latest Add to Query.xlsx", "Acciona/Acciona_Latest Add to Query.xlsx"),
    ("Acciona/Back up/Acciona_Latest.xlsx",              "Acciona/Acciona_Latest Add to Query.xlsx"),
    ("Acciona/Back up/Acciona_Latest 10 Aug.xlsx",       "Acciona/Acciona_Latest Add to Query.xlsx"),
    ("Inco/Back up/Master Weld_Latest.xlsx",             "Inco/Master Weld_Latest.xlsx"),
    ("Inco/01. Master Weld Log as on 24 APRIL 2025.xlsx", "Inco/Master Weld_Latest.xlsx"),
    ("Inco/01. Master Weld Log as on 01st May 2025.xlsx", "Inco/Master Weld_Latest.xlsx"),
    ("Inco/01. Master Weld Log as on 17th July 2025.xlsx", "Inco/Master Weld_Latest.xlsx"),
    ("Welders/Back up/Welders Power Q for PBI .xlsx",     "Welders/Welders Power Q for PBI .xlsx"),
    ("Welders/Back up/Welders Power Q for PBI  - Copy.xlsx", "Welders/Welders Power Q for PBI .xlsx"),
    ("Welders/Back up/SCTR NFE WELDERS APPLIED.xls",      "Welders/SCTR NFE WELDERS APPLIED.xls"),
    ("Welders/Back up/SCTR NFE WELDERS APPLIED - Copy.xls", "Welders/SCTR NFE WELDERS APPLIED.xls"),
]

# R-01 files that should still be absent — confirmed, not assumed.
STILL_MISSING = [
    "UT TRACKER (GAC)_Master.xlsx",
    "UT TRACKER (TEK).xlsx",
    "WPQ RECORD REGISTER.xlsx",
    "WPQ RECORD REGISTER/WPQ RECORD REGISTER.xlsx",
]

# Rows dumped to JSON for the mapping / seed docs.
JSON_DUMP = {
    ("Weld Length/Weld Length.xlsx", "Sheet2"): "weld-length-sheet2.json",
    ("Weld Length/Rework code.xlsx", "Rework code"): "rework-code.json",
    ("Weld Length/Rework code.xlsx", "Sheet1"): "rework-code-sheet1.json",
    ("Welders/SCTR NFE WELDERS APPLIED.xls", "SCTR OVERALL APPLIED WELDERS"): "sctr-applied-welders.json",
    ("Welders/Welders Power Q for PBI .xlsx", "WEEK #   STATUS"): "week-status.json",
    ("Welders/Welders Power Q for PBI .xlsx", "CUM WEEK # Status"): "cum-week-status.json",
    ("Acciona/Acciona_Latest Add to Query.xlsx", "Joint Summary"): "acciona-joint-summary.json",
}
# Header-only JSON (too many rows to dump).
HEADER_JSON = {
    ("Acciona/Acciona_Latest Add to Query.xlsx", "Acciona_Query"): "acciona-query.columns.json",
    ("Inco/Master Weld_Latest.xlsx", "Overall Weld Log Query"): "inco-weld-log.columns.json",
    ("Welders/Welders Power Q for PBI .xlsx", "WELDERS_Qualification"): "welders-qualification.columns.json",
}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
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
    return str(v).replace("|", "\\|").replace("\n", "#(lf)").replace("\r", "")


def fmt(n):
    return "{:,}".format(n) if isinstance(n, int) else str(n)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def xlsx_tables(path):
    """{table display name: (sheet name, ref)} by parsing the zip directly.

    openpyxl read_only cannot see ListObjects; and we must know the exact range
    because `Kind="Table"` in the M means header = the table's first row.
    """
    out = {}
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())
        if "xl/workbook.xml" not in names:
            return out
        wb = z.read("xl/workbook.xml").decode("utf-8", "replace")
        rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8", "replace")
        rid2target = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
        sheet_parts = {}          # "xl/worksheets/sheet1.xml" -> sheet name
        for m in re.finditer(r'<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"', wb):
            tgt = rid2target.get(m.group(2), "")
            tgt = tgt if tgt.startswith("xl/") else "xl/" + tgt.lstrip("/")
            sheet_parts[tgt] = m.group(1)
        for part, sname in sheet_parts.items():
            rp = part.replace("xl/worksheets/", "xl/worksheets/_rels/") + ".rels"
            if rp not in names:
                continue
            srels = z.read(rp).decode("utf-8", "replace")
            for tgt in re.findall(r'Target="([^"]*tables/[^"]*)"', srels):
                tpart = os.path.normpath(os.path.join("xl/worksheets", tgt)).replace("\\", "/")
                if tpart not in names:
                    tpart = "xl/tables/" + os.path.basename(tgt)
                if tpart not in names:
                    continue
                t = z.read(tpart).decode("utf-8", "replace")
                dn = re.search(r'displayName="([^"]*)"', t)
                ref = re.search(r'\sref="([^"]*)"', t)
                hdr = re.search(r'headerRowCount="([0-9]+)"', t)
                if dn and ref:
                    out[dn.group(1)] = (sname, ref.group(1),
                                        int(hdr.group(1)) if hdr else 1)
    return out


def xlsx_sheets(path):
    with zipfile.ZipFile(path) as z:
        wb = z.read("xl/workbook.xml").decode("utf-8", "replace")
    return re.findall(r'<sheet[^>]*name="([^"]*)"', wb)


def iter_rows_xlsx(path, sheet, ref=None):
    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        ws = wb[sheet]
        if ref:
            c1, r1, c2, r2 = range_boundaries(ref)
            it = ws.iter_rows(min_row=r1, max_row=r2, min_col=c1, max_col=c2,
                              values_only=True)
        else:
            it = ws.iter_rows(values_only=True)
        dim = None
        try:
            dim = ws.calculate_dimension()
        except Exception:                                     # noqa: BLE001
            pass
        meta = (dim, ws.max_row, ws.max_column)
        for row in it:
            yield row, meta
    finally:
        wb.close()


def iter_rows_xls(path, sheet):
    import xlrd
    book = xlrd.open_workbook(path, on_demand=True)
    sh = book.sheet_by_name(sheet)
    meta = ("A1:%s%d" % (chr(64 + min(sh.ncols, 26)), sh.nrows), sh.nrows, sh.ncols)
    dm = book.datemode
    for r in range(sh.nrows):
        vals = []
        for c in range(sh.ncols):
            cl = sh.cell(r, c)
            if cl.ctype == 3:                                 # XL_CELL_DATE
                try:
                    vals.append(xlrd.xldate_as_datetime(cl.value, dm))
                    continue
                except Exception:                             # noqa: BLE001
                    pass
            if cl.ctype in (0, 6):                            # empty / blank
                vals.append(None)
            else:
                vals.append(cl.value)
        yield tuple(vals), meta
    book.release_resources()


def profile(rows_iter, skip, promote, keep_rows=False, sample_n=10):
    """Consume an (row, meta) iterator.  Returns a dict of measurements.

    `promote=True` reproduces `Table.PromoteHeaders` after `Table.Skip(skip)`:
    the first non-blank row becomes the header.  `promote=False` (a named Table)
    takes row 1 of the range as the header verbatim.
    """
    header, profiles, sample, allrows = None, None, [], []
    n = 0
    widths = collections.Counter()
    meta = (None, None, None)
    for i, (row, meta) in enumerate(rows_iter):
        if i < skip:
            continue
        vals = [cell(v) for v in row]
        while vals and vals[-1] == "":
            vals.pop()
        if header is None:
            if promote and not any(vals):
                continue
            header = vals
            profiles = [dict(name=(h or "(unnamed col %d)" % (j + 1)),
                             nonempty=0, blank=0, maxlen=0,
                             counter=collections.Counter(), numeric=0,
                             datelike=0)
                        for j, h in enumerate(header)]
            continue
        if not any(vals):
            continue
        n += 1
        widths[len(vals)] += 1
        if len(sample) < sample_n:
            sample.append(vals)
        if keep_rows:
            allrows.append(vals)
        if n > MAX_FULL_ROWS:
            continue
        for j, p in enumerate(profiles):
            v = vals[j] if j < len(vals) else ""
            if v:
                p["nonempty"] += 1
                if len(p["counter"]) < 30000 or v in p["counter"]:
                    p["counter"][v] += 1
                if len(v) > p["maxlen"]:
                    p["maxlen"] = len(v)
                try:
                    float(v)
                    p["numeric"] += 1
                except ValueError:
                    if re.match(r"^\d{4}-\d{2}-\d{2}", v):
                        p["datelike"] += 1
            else:
                p["blank"] += 1
    return dict(header=header or [], rows=n, sample=sample, profiles=profiles or [],
                widths=widths, meta=meta, allrows=allrows,
                sample_all=allrows)


def coltype(p, n):
    if not p["nonempty"]:
        return "empty"
    if p["numeric"] == p["nonempty"]:
        return "number"
    if p["datelike"] == p["nonempty"]:
        return "date"
    if p["datelike"]:
        return "text/date"
    return "text"


# ---------------------------------------------------------------------------
def main():
    skip_big = "--skip-big" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    A, w = [], None
    A_ = A.append

    def w(s=""):
        A_(s)

    t_all = time.time()
    w("# `sources/` batch 3 — workbook profile")
    w()
    w("Generated by `uv run analysis/sources3/profile_xlsx.py`. openpyxl "
      "`read_only=True, data_only=True` (cached formula values — what Power "
      "Query's `Excel.Workbook` reads); `xlrd` for the legacy BIFF `.xls`.")
    w()
    w("Every row count, header and distinct count below is measured by this "
      "script. `pbix rows` is the count stored in the pbix model "
      "(`analysis/pbix/model.md`).")
    w()

    # ---------------- inventory ----------------
    w("## Inventory")
    w()
    w("| workbook | bytes | mtime | sheets | named Tables |")
    w("|---|---:|---|---|---|")
    for rel, _ in TARGETS:
        p = os.path.join(SRC, rel)
        if not os.path.exists(p):
            w("| `%s` | — | — | **MISSING** | — |" % rel)
            continue
        st = os.stat(p)
        mt = dt.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M")
        if rel.lower().endswith(".xls"):
            import xlrd
            bk = xlrd.open_workbook(p, on_demand=True)
            sh, tb = bk.sheet_names(), {}
            bk.release_resources()
        else:
            sh, tb = xlsx_sheets(p), xlsx_tables(p)
        w("| `%s` | %s | %s | %s | %s |" % (
            rel, fmt(st.st_size), mt,
            ", ".join("`%s`" % s for s in sh),
            ", ".join("`%s` %s" % (k, v[1]) for k, v in tb.items()) or "—"))
    w()

    # ---------------- still-missing check ----------------
    w("### R-01 files confirmed still absent")
    w()
    found_any = []
    for pat in STILL_MISSING:
        base = os.path.basename(pat).lower()
        hits = []
        for root, _dirs, files in os.walk(SRC):
            for f in files:
                if f.lower() == base:
                    hits.append(os.path.relpath(os.path.join(root, f), SRC))
        if hits:
            found_any.append((pat, hits))
    for pat in STILL_MISSING[:3]:
        hits = [h for p_, hs in found_any if p_ == pat for h in hs]
        w("* `%s` — %s" % (pat, ("**FOUND at** %s" % hits) if hits else
                           "**absent** (recursive search of `sources/` by basename)"))
    w()

    counts = {}

    # ---------------- per-target profiles ----------------
    for rel, items in TARGETS:
        p = os.path.join(SRC, rel)
        if not os.path.exists(p):
            continue
        w("---")
        w()
        w("## `sources/%s`" % rel)
        w()
        w("%s bytes · sha256 `%s`" % (fmt(os.path.getsize(p)), sha256(p)))
        w()
        tabs = {} if rel.lower().endswith(".xls") else xlsx_tables(p)
        for kind, name, skip, pbix_tbl, pbix_rows in items:
            if skip_big and (rel, name) == ("Weld Length/Weld Length.xlsx", "Sheet1"):
                w("### `%s` — skipped (`--skip-big`)" % name)
                w()
                continue
            t0 = time.time()
            print("  profiling %s :: %s ..." % (rel, name), flush=True)
            if kind == "table":
                if name not in tabs:
                    w("### named Table `%s` — **NOT FOUND in this workbook**" % name)
                    w()
                    w("The M reads `Source{[Item=\"%s\",Kind=\"Table\"]}`. "
                      "Tables present: %s. **STOP — shape contradicts the M.**"
                      % (name, list(tabs)))
                    w()
                    continue
                sheet, ref, hdrrows = tabs[name]
                res = profile(iter_rows_xlsx(p, sheet, ref), 0, promote=False,
                              keep_rows=(rel, name) in JSON_DUMP)
                origin = ("named Table `%s` on sheet `%s`, range `%s`, "
                          "headerRowCount=%d — the M uses `Kind=\"Table\"`, so "
                          "**no `Table.PromoteHeaders` step**: the header is the "
                          "table's own first row" % (name, sheet, ref, hdrrows))
            elif kind == "xls":
                res = profile(iter_rows_xls(p, name), skip, promote=True,
                              keep_rows=(rel, name) in JSON_DUMP)
                origin = ("BIFF sheet `%s` read with `xlrd`; M does "
                          "`Table.Skip(%d)` then `Table.PromoteHeaders`" % (name, skip))
            else:
                res = profile(iter_rows_xlsx(p, name), skip, promote=True,
                              keep_rows=(rel, name) in JSON_DUMP)
                origin = ("sheet `%s`%s then `Table.PromoteHeaders`"
                          % (name, (" · M does `Table.Skip(%d)`" % skip) if skip
                             else " · M does no `Table.Skip`"))
            mf = MFILTER.get((rel, name))
            raw_rows = res["rows"]
            mf_note = ""
            if mf:
                hdr0 = res["header"]
                keep = []
                for r in res["sample_all"]:
                    ok = True
                    for col, op, val in mf:
                        j = hdr0.index(col) if col in hdr0 else -1
                        v = (r[j] if 0 <= j < len(r) else "")
                        if op == "notblank" and v == "":
                            ok = False
                        elif op == "ne" and v == val:
                            ok = False
                    if ok:
                        keep.append(r)
                res["rows"] = len(keep)
                mf_note = ("; the M's own filters (%s) then leave **%s**"
                           % ("; ".join("`[%s] %s %r`" % (c, o, v) for c, o, v in mf),
                              fmt(len(keep))))
            dt_ = time.time() - t0
            counts[(rel, name)] = res["rows"]
            hdr, n = res["header"], res["rows"]
            w("### `%s`" % name)
            w()
            w("* %s" % origin)
            w("* pbix table: %s · pbix rows: %s · **measured data rows: %s**%s %s"
              % (("`%s`" % pbix_tbl) if pbix_tbl else
                 "**none — not referenced by any Power Query**",
                 fmt(pbix_rows) if pbix_rows else "—", fmt(raw_rows), mf_note,
                 ("✅ **exact match**" if pbix_rows == n else
                  ("⚠️ **differs by %+d**" % (n - pbix_rows)) if pbix_rows else "")))
            w("* declared dimension `%s`, max_row=%s, max_col=%s"
              % (res["meta"][0], res["meta"][1], res["meta"][2]))
            w("* header (%d fields): %s" % (
                len(hdr), ", ".join("`%s`" % esc(h) for h in hdr) if hdr else "_(none)_"))
            if len(res["widths"]) > 1:
                w("* ragged row widths: %s" % ", ".join(
                    "%d→%s" % (k, fmt(v)) for k, v in sorted(res["widths"].items())))
            w()
            if res["profiles"]:
                w("| # | column | type | non-empty | blank | distinct | maxlen | top %d values |"
                  % MAX_TOP)
                w("|---:|---|---|---:|---:|---:|---:|---|")
                for j, pr in enumerate(res["profiles"]):
                    c = pr["counter"]
                    top = ", ".join("`%s`×%s" % (esc(v)[:60], fmt(k))
                                    for v, k in c.most_common(MAX_TOP))
                    w("| %d | `%s` | %s | %s | %s | %s | %s | %s |" % (
                        j + 1, esc(pr["name"]), coltype(pr, n), fmt(pr["nonempty"]),
                        fmt(pr["blank"]), fmt(len(c)), pr["maxlen"], top))
                w()
            if res["sample"]:
                ncol = min(len(hdr), 12)
                w("First %d data rows (first %d of %d columns):"
                  % (len(res["sample"]), ncol, len(hdr)))
                w()
                w("```")
                w(" | ".join(esc(h)[:22] for h in hdr[:ncol]))
                for r in res["sample"]:
                    w(" | ".join((esc(r[j])[:22] if j < len(r) else "")
                                 for j in range(ncol)))
                w("```")
                w()
            key = (rel, name)
            if key in HEADER_JSON:
                with open(os.path.join(OUT, HEADER_JSON[key]), "w") as fh:
                    json.dump(dict(file=rel, object=name, rows=n, header=hdr,
                                   columns=[dict(name=pr["name"],
                                                 nonempty=pr["nonempty"],
                                                 blank=pr["blank"],
                                                 distinct=len(pr["counter"]),
                                                 maxlen=pr["maxlen"],
                                                 type=coltype(pr, n),
                                                 top=pr["counter"].most_common(30))
                                            for pr in res["profiles"]]), fh, indent=1)
            if key in JSON_DUMP:
                with open(os.path.join(OUT, JSON_DUMP[key]), "w") as fh:
                    json.dump(dict(file=rel, object=name, header=hdr,
                                   rows=res["allrows"]), fh, indent=1)
            w("_(%.1fs)_" % dt_)
            w()

    # ---------------- Weld Length: is it per joint or per dia? ----------------
    wl = os.path.join(SRC, "Weld Length/Weld Length.xlsx")
    if os.path.exists(wl) and not skip_big:
        t0 = time.time()
        print("  analysing Weld Length dia->length ...", flush=True)
        pairs = collections.Counter()          # (weld type, dia) -> n
        d2l = collections.defaultdict(set)     # dia -> {lengths}
        t2l = collections.defaultdict(set)     # (type,dia) -> {lengths}
        first = True
        for row, _m in iter_rows_xlsx(wl, "Sheet1"):
            if first:
                first = False
                continue
            v = [cell(x) for x in row]
            if len(v) < 3 or not any(v):
                continue
            pairs[(v[0], v[1])] += 1
            d2l[v[1]].add(v[2])
            t2l[(v[0], v[1])].add(v[2])
        multi = {k: v for k, v in d2l.items() if len(v) > 1}
        w("---")
        w()
        w("## `Weld Length` — per joint, or per dia?")
        w()
        w("* distinct `Dia inch` values: **%s**" % fmt(len(d2l)))
        w("* distinct (`Weld Type`, `Dia inch`) pairs: **%s**" % fmt(len(pairs)))
        w("* `Dia inch` values mapping to **more than one** `Weld Length`: **%s**%s"
          % (fmt(len(multi)),
             (" → " + ", ".join("`%s`→%s" % (k, sorted(v)) for k, v in
                                list(multi.items())[:5])) if multi else
             " — `Weld Length` is a **pure function of `Dia inch`**; `Weld Type` "
             "adds nothing, and the DAX `LOOKUPVALUE` keys on `Dia inch` alone"))
        w("* rows per (type, dia) pair: min %s, max %s — the sheet is an "
          "**exploded** copy of a %s-row lookup, not a per-joint table"
          % (fmt(min(pairs.values())), fmt(max(pairs.values())), fmt(len(d2l))))
        w()
        w("The %s distinct (dia → length) pairs, which is what "
          "`weld_length_by_dia` must hold:" % fmt(len(d2l)))
        w()
        w("| dia_inch | weld_length (m) | rows in Sheet1 |")
        w("|---:|---:|---:|")
        rows_by_dia = collections.Counter()
        for (t, d), n_ in pairs.items():
            rows_by_dia[d] += n_
        ordered = sorted(d2l, key=lambda x: float(x))
        for d in ordered[:12]:
            w("| %s | %s | %s |" % (d, sorted(d2l[d])[0], fmt(rows_by_dia[d])))
        w("| … | … | … |")
        for d in ordered[-3:]:
            w("| %s | %s | %s |" % (d, sorted(d2l[d])[0], fmt(rows_by_dia[d])))
        w()
        with open(os.path.join(OUT, "weld-length-by-dia.json"), "w") as fh:
            json.dump(dict(source="Weld Length/Weld Length.xlsx", sheet="Sheet1",
                           functional_dependency_dia_to_length=not multi,
                           rows=[dict(dia_inch=float(d),
                                      weld_length=float(sorted(d2l[d])[0]),
                                      sheet1_rows=rows_by_dia[d])
                                 for d in ordered]), fh, indent=1)
        w("_(%.1fs · written to `weld-length-by-dia.json`)_" % (time.time() - t0))
        w()

    # ---------------- back-ups / dated copies ----------------
    w("---")
    w()
    w("## Back-ups and dated copies — shape only")
    w()
    w("Sheet names, row counts of the M-relevant object, and whether the header "
      "matches the M-named file. Nothing else is profiled: these are provenance, "
      "not sources.")
    w()
    w("| file | bytes | mtime | sheets | M object | rows | header vs the M-named file |")
    w("|---|---:|---|---|---|---:|---|")
    ref_headers = {}
    for rel, items in TARGETS:
        p = os.path.join(SRC, rel)
        if not os.path.exists(p):
            continue
        tabs = {} if rel.lower().endswith(".xls") else xlsx_tables(p)
        for kind, name, skip, _t, _r in items[:1]:
            if kind == "table" and name in tabs:
                s, ref, _h = tabs[name]
                res = profile(iter_rows_xlsx(p, s, ref), 0, promote=False)
            elif kind == "xls":
                res = profile(iter_rows_xls(p, name), skip, promote=True)
            else:
                res = profile(iter_rows_xlsx(p, name), skip, promote=True)
            ref_headers[rel] = (kind, name, skip, res["header"])
    for rel, canon in SHAPE_ONLY:
        p = os.path.join(SRC, rel)
        if not os.path.exists(p):
            w("| `%s` | — | — | **MISSING** | — | — | — |" % rel)
            continue
        st = os.stat(p)
        mt = dt.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M")
        kind, name, skip, chdr = ref_headers.get(canon, (None, None, 0, []))
        if rel.lower().endswith(".xls"):
            import xlrd
            bk = xlrd.open_workbook(p, on_demand=True)
            sheets = bk.sheet_names()
            bk.release_resources()
            tabs = {}
        else:
            sheets, tabs = xlsx_sheets(p), xlsx_tables(p)
        rows, verdict, obj = "—", "—", "—"
        try:
            if kind == "table" and name in tabs:
                s, ref, _h = tabs[name]
                r = profile(iter_rows_xlsx(p, s, ref), 0, promote=False)
                obj = "Table `%s`" % name
            elif kind == "table":
                obj = "Table `%s` **absent**" % name
                r = None
            elif kind == "xls" and name in sheets:
                r = profile(iter_rows_xls(p, name), skip, promote=True)
                obj = "sheet `%s`" % name
            elif name in sheets:
                r = profile(iter_rows_xlsx(p, name), skip, promote=True)
                obj = "sheet `%s`" % name
            else:
                obj = "sheet `%s` **absent**" % name
                r = None
            if r:
                rows = fmt(r["rows"])
                if r["header"] == chdr:
                    verdict = "**identical** (%d cols)" % len(chdr)
                else:
                    extra = [h for h in r["header"] if h not in chdr]
                    miss = [h for h in chdr if h not in r["header"]]
                    verdict = "**differs**: %d vs %d cols; only here: %s; missing: %s" % (
                        len(r["header"]), len(chdr),
                        ", ".join("`%s`" % esc(x) for x in extra[:6]) or "—",
                        ", ".join("`%s`" % esc(x) for x in miss[:6]) or "—")
        except Exception as e:                                # noqa: BLE001
            verdict = "read failed: %s" % e
        w("| `%s` | %s | %s | %s | %s | %s | %s |" % (
            rel, fmt(st.st_size), mt,
            ", ".join("`%s`" % s for s in sheets), obj, rows, verdict))
    w()

    # ---------------- summary ----------------
    w("---")
    w()
    w("## Measured row counts vs the pbix")
    w()
    w("| workbook | object | pbix table | pbix rows | measured | delta |")
    w("|---|---|---|---:|---:|---:|")
    for rel, items in TARGETS:
        for kind, name, skip, tbl, pr in items:
            n = counts.get((rel, name))
            if n is None:
                continue
            w("| `%s` | `%s` | %s | %s | %s | %s |" % (
                rel, name, ("`%s`" % tbl) if tbl else "—",
                fmt(pr) if pr else "—", fmt(n),
                ("**%+d**" % (n - pr)) if pr else "—"))
    w()
    w("_total runtime %.1fs_" % (time.time() - t_all))
    w()

    with open(os.path.join(OUT, "workbooks.md"), "w") as fh:
        fh.write("\n".join(A) + "\n")
    print("wrote analysis/sources3/workbooks.md  (%.1fs)" % (time.time() - t_all))
    return 0


if __name__ == "__main__":
    sys.exit(main())
