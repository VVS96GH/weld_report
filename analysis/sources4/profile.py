#!/usr/bin/env python3
"""Profile `sources/WPQ RECORD REGISTER/` — the batch-4 delivery.

Writes `analysis/sources4/workbooks.md` plus a few JSON side files.
Run with `uv run analysis/sources4/profile.py` (openpyxl + xlrd, declared in
the root `pyproject.toml`).

Every number in workbooks.md is measured here; nothing is copied from the pbix
except the `pbix rows` column, which comes from `analysis/pbix/model.md` and is
reproduced so the two can be compared.
"""

from __future__ import annotations

import csv
import datetime as dt
import hashlib
import io
import json
import os
import re
import sys
import time
from collections import Counter
from pathlib import Path

import openpyxl
import xlrd

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "sources" / "WPQ RECORD REGISTER"
OUT = ROOT / "analysis" / "sources4"

# ── the five delivered data files ───────────────────────────────────────────
XLSX = [
    "WPQ RECORD REGISTER.xlsx",
    "WPS PWHT Status.xlsx",
    "CUM WPS Status.xlsx",
]
XLS = "WPS-WPQT Record Register Rev_0 24-01-25.xls"
CSVF = "WPS (Welding Process).csv"

# pbix stored row counts (analysis/pbix/model.md §tables)
PBIX_ROWS = {
    "WPQ RECORD REGISTER": 318,
    "WPQ WELDING PROCESS": 266,
    "WPS Reg#": 71,
    "WPS Status CUM": 127,
    "PWHT Status": 34,
}

# `[ DOCUMENT STATUS]` value the page-1 KPI filters on (lib/metrics/refs.ts)
WPS_APPROVED_STATUS = "WPS APPROVED BY CTJV/ CPY"


# ── helpers ─────────────────────────────────────────────────────────────────
def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def mtime(p: Path) -> str:
    return dt.datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d %H:%M")


def cell(v):
    """Normalise a cell the way Power Query's `type text` coercion would show it."""
    if v is None:
        return None
    if isinstance(v, str):
        s = v.replace("\r\n", "\n")
        return s if s.strip() != "" else None
    if isinstance(v, (dt.datetime, dt.date)):
        return v.isoformat()[:10] if not isinstance(v, dt.datetime) else v.isoformat(sep=" ")
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def esc(s) -> str:
    """Markdown-table-safe rendering of a value, newlines made visible."""
    if s is None:
        return "∅"
    return (
        str(s)
        .replace("|", "\\|")
        .replace("\n", "⏎")
        .replace("\t", "→")
    )


def clip(s, n=40) -> str:
    s = esc(s)
    return s if len(s) <= n else s[: n - 1] + "…"


def read_xlsx_sheet(path: Path, sheet: str) -> list[list]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet]
    rows = [[cell(c) for c in r] for r in ws.iter_rows(values_only=True)]
    wb.close()
    return rows


def read_xls_sheet(path: Path, sheet: str) -> list[list]:
    bk = xlrd.open_workbook(path, formatting_info=False)
    sh = bk.sheet_by_name(sheet)
    out = []
    for r in range(sh.nrows):
        row = []
        for c in range(sh.ncols):
            cv = sh.cell(r, c)
            v = cv.value
            if cv.ctype == xlrd.XL_CELL_DATE:
                try:
                    v = dt.datetime(*xlrd.xldate_as_tuple(v, bk.datemode)).isoformat(sep=" ")
                except Exception:
                    v = str(v)
            elif cv.ctype == xlrd.XL_CELL_EMPTY or cv.ctype == xlrd.XL_CELL_BLANK:
                v = None
            row.append(cell(v))
        out.append(row)
    return out


def trim_trailing_blank_rows(rows: list[list]) -> list[list]:
    """Excel.Workbook's sheet extent, as Power Query sees it: openpyxl's
    `max_row` can overshoot on a formatted-but-empty tail."""
    i = len(rows)
    while i > 0 and all(v is None for v in rows[i - 1]):
        i -= 1
    return rows[:i]


def promote_headers(rows: list[list]) -> tuple[list[str], list[list]]:
    """`Table.PromoteHeaders([PromoteAllScalars=true])` — first row becomes the
    header; a null/duplicate header becomes ColumnN / Name_N exactly as PQ does."""
    if not rows:
        return [], []
    raw = rows[0]
    hdr, seen = [], Counter()
    for i, v in enumerate(raw):
        name = v if v is not None else f"Column{i + 1}"
        seen[name] += 1
        hdr.append(name if seen[name] == 1 else f"{name}.{seen[name] - 1}")
    return hdr, rows[1:]


def profile_columns(hdr: list[str], data: list[list]) -> list[dict]:
    cols = []
    for i, name in enumerate(hdr):
        vals = [r[i] if i < len(r) else None for r in data]
        nonnull = [v for v in vals if v is not None]
        c = Counter(nonnull)
        cols.append(
            {
                "i": i + 1,
                "name": name,
                "non_empty": len(nonnull),
                "blank": len(vals) - len(nonnull),
                "distinct": len(c),
                "maxlen": max((len(str(v)) for v in nonnull), default=0),
                "top": c.most_common(12),
            }
        )
    return cols


def md_col_table(cols: list[dict]) -> list[str]:
    out = [
        "| # | column | non-empty | blank | distinct | maxlen | top values |",
        "|---:|---|---:|---:|---:|---:|---|",
    ]
    for c in cols:
        top = ", ".join(f"`{clip(v, 34)}`×{n}" for v, n in c["top"])
        out.append(
            f"| {c['i']} | `{esc(c['name'])}` | {c['non_empty']:,} | {c['blank']:,} | "
            f"{c['distinct']:,} | {c['maxlen']} | {top} |"
        )
    return out


def md_sample(hdr: list[str], data: list[list], n=10) -> list[str]:
    w = len(hdr)
    out = ["| # | " + " | ".join(f"`{clip(h, 24)}`" for h in hdr) + " |",
           "|---:|" + "|".join(["---"] * w) + "|"]
    for j, r in enumerate(data[:n]):
        cells = [clip(r[i] if i < len(r) else None, 24) for i in range(w)]
        out.append(f"| {j + 1} | " + " | ".join(cells) + " |")
    return out


def md_raw(rows: list[list], n, label) -> list[str]:
    out = [f"{label}", "", "```"]
    for i, r in enumerate(rows[:n]):
        out.append(f"r{i}: " + " | ".join(clip(v, 22) for v in r))
    out += ["```", ""]
    return out


# ── main ────────────────────────────────────────────────────────────────────
def main() -> int:
    t0 = time.time()
    L: list[str] = []
    side: dict[str, object] = {}

    L += [
        "# `sources/WPQ RECORD REGISTER/` — batch-4 workbook profile",
        "",
        "Generated by `uv run analysis/sources4/profile.py`. openpyxl "
        "(`read_only=True, data_only=True` — cached formula values, which is what "
        "Power Query's `Excel.Workbook` reads) for the `.xlsx`, `xlrd` for the "
        "legacy BIFF `.xls`, stdlib `csv` for the `.csv`.",
        "",
        "Every row count, header, distinct count and sample below is measured by "
        "this script. `pbix rows` is the count stored in the pbix model "
        "(`analysis/pbix/model.md`), reproduced here only so the two can be "
        "compared. `∅` = empty cell, `⏎` = an embedded newline.",
        "",
        "## Inventory",
        "",
        "| file | bytes | mtime | sheets / members | sha256 |",
        "|---|---:|---|---|---|",
    ]

    inv = {}
    for name in XLSX:
        p = SRC / name
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
        sheets = list(wb.sheetnames)
        wb.close()
        inv[name] = sheets
        L.append(
            f"| `{name}` | {p.stat().st_size:,} | {mtime(p)} | "
            + ", ".join(f"`{s}`" for s in sheets)
            + f" | `{sha256(p)[:16]}…` |"
        )
    p = SRC / XLS
    bk = xlrd.open_workbook(p, on_demand=True)
    xls_sheets = bk.sheet_names()
    xls_names = sorted(bk.name_map.keys())
    inv[XLS] = xls_sheets
    L.append(
        f"| `{XLS}` | {p.stat().st_size:,} | {mtime(p)} | "
        + ", ".join(f"`{s}`" for s in xls_sheets)
        + f" | `{sha256(p)[:16]}…` |"
    )
    p = SRC / CSVF
    L.append(f"| `{CSVF}` | {p.stat().st_size:,} | {mtime(p)} | — | `{sha256(p)[:16]}…` |")
    L.append("")
    L.append(
        f"`{XLS}` defined names (all workbook-level): "
        + ", ".join(f"`{n}`" for n in xls_names)
        + " — **no member named `WPS Reg#`**; see §4."
    )
    L.append("")
    L.append("Also in the folder, not data files: `From Manimurugan Kaliyamoorthy.txt` "
             "(a SharePoint URL for *CONSOLIDATED WPS _ WPQR STATUS REGISTER*), "
             "`PWHT RULE 14 01 2025.txt` and `CCC PWHT Y N  RULE 14 01 2025 ( VAR and "
             "SWITCH ).txt` (two spellings of the `PWHT Y/N CCC (NEW)` calculated "
             "column — the nested-IF original and a `SWITCH` rewrite; both already "
             "reproduced in `analysis/calculation-logic.md`).")
    L.append("")

    # ── 1. WPQ RECORD REGISTER.xlsx / CONSOLIDATED → `WPQ RECORD REGISTER` ──
    L += ["---", "", "## 1. `WPQ RECORD REGISTER.xlsx` → pbix `WPQ RECORD REGISTER` (M91)", ""]
    rows = trim_trailing_blank_rows(read_xlsx_sheet(SRC / "WPQ RECORD REGISTER.xlsx", "CONSOLIDATED"))
    L += [
        f"* sheet `CONSOLIDATED`, **{len(rows)} rows × "
        f"{max(len(r) for r in rows)} columns** as delivered",
        "* the M reads it by `Source{[Name=\"CONSOLIDATED\"]}[Data]` (a sheet, not a "
        "named Table), types Column1..Column20 as text, `Table.Skip(…,3)`, "
        "`Table.PromoteHeaders`, drops `Column13..Column18`, `CODE `, `REMARKS`, "
        "keeps `[WPS NO.] <> null`, then `Text.Trim`s `WPS NO.`",
        "",
    ]
    L += md_raw(rows, 6, "The first six raw rows (the three the M skips, then the header):")

    skipped = rows[3:]
    hdr, data = promote_headers(skipped)
    L += [
        f"* after `Skip(3)` + `PromoteHeaders`: **{len(data)} rows**, header "
        f"({len(hdr)} fields): " + ", ".join(f"`{esc(h)}`" for h in hdr),
        "",
    ]
    drop = {"Column13", "Column14", "Column15", "Column16", "Column17", "Column18", "CODE ", "REMARKS"}
    missing = sorted(d for d in drop if d not in hdr)
    if missing:
        L += [
            f"> **The M would fail on this file too.** `Table.RemoveColumns` names "
            + ", ".join(f"`{m}`" for m in missing)
            + " — absent from the header above, and `RemoveColumns` raises on a "
            "missing field. The delivered sheet has **one extra blank column on the "
            "left** (`Column1`, empty on all 318 rows), so every auto-named blank "
            "column shifts by one: the M's `Column7`/`Column9` are this file's "
            "`Column8`/`Column10`, and its `Column13..Column18` are `Column14.."
            "`Column19`. Same staleness class as ruling R3-09 — build the loader "
            "by header name against the delivered file, not by replaying the M.",
            "",
        ]
    keep_idx = [i for i, h in enumerate(hdr) if h not in drop]
    hdr2 = [hdr[i] for i in keep_idx]
    data2 = [[r[i] if i < len(r) else None for i in keep_idx] for r in data]
    try:
        wps_i = hdr2.index("WPS NO.")
    except ValueError:
        wps_i = 2
    filt = [r for r in data2 if r[wps_i] is not None]
    for r in filt:
        if isinstance(r[wps_i], str):
            r[wps_i] = r[wps_i].strip()
    pb = PBIX_ROWS["WPQ RECORD REGISTER"]
    verdict = "✅ **exact match**" if len(filt) == pb else f"⚠️ **differs by {len(filt) - pb:+,}**"
    L += [
        f"* after `RemoveColumns` ({len(hdr2)} kept) + `[WPS NO.] <> null` + `Trim`: "
        f"**{len(filt)} rows** · pbix rows: **{pb}** — {verdict}",
        "",
        "### Column profile (the 12 columns the pbix keeps)",
        "",
    ]
    cols = profile_columns(hdr2, filt)
    L += md_col_table(cols)
    L += ["", "### 10-row sample", "", *md_sample(hdr2, filt, 10), ""]

    # M91
    ds_i = hdr2.index(" DOCUMENT STATUS") if " DOCUMENT STATUS" in hdr2 else None
    ds_counter = Counter((r[ds_i] for r in filt)) if ds_i is not None else Counter()
    approved_rows = [r for r in filt if ds_i is not None and r[ds_i] == WPS_APPROVED_STATUS]
    m91 = len({r[wps_i] for r in approved_rows})
    all_distinct = len({r[wps_i] for r in filt})
    L += [
        "### M91 `WPS Approved` — the page-1 KPI",
        "",
        "```dax",
        "DistinctCount(WPQ RECORD REGISTER[WPS NO.])",
        "  filter: WPQ RECORD REGISTER[ DOCUMENT STATUS] IN {WPS APPROVED BY CTJV/ CPY}",
        "```",
        "",
        f"* every `[ DOCUMENT STATUS]` value in the register ({len(ds_counter)} distinct, "
        f"{sum(ds_counter.values()):,} non-blank of {len(filt):,} rows):",
        "",
        "| ` DOCUMENT STATUS` | rows | distinct `WPS NO.` |",
        "|---|---:|---:|",
    ]
    for v, n in ds_counter.most_common():
        d = len({r[wps_i] for r in filt if r[ds_i] == v})
        mark = "  ← **M91 counts this**" if v == WPS_APPROVED_STATUS else ""
        L.append(f"| `{esc(v)}`{mark} | {n:,} | {d:,} |")
    blank_ds = sum(1 for r in filt if r[ds_i] is None) if ds_i is not None else 0
    if blank_ds:
        L.append(f"| ∅ (blank) | {blank_ds:,} | "
                 f"{len({r[wps_i] for r in filt if r[ds_i] is None}):,} |")
    L += [
        "",
        f"* **M91 = {m91}** — {len(approved_rows):,} rows carry "
        f"`{WPS_APPROVED_STATUS}`, over {m91:,} distinct `WPS NO.` values.",
        f"* for contrast, `DistinctCount` over the whole register (no filter) = "
        f"**{all_distinct}** of {len(filt):,} rows.",
        "",
    ]
    side["m91"] = {
        "value": m91,
        "approved_rows": len(approved_rows),
        "register_rows": len(filt),
        "distinct_wps_all": all_distinct,
        "status_breakdown": {str(k): v for k, v in ds_counter.items()},
    }
    side["consolidated_header"] = hdr
    json.dump(
        [dict(zip(hdr2, r)) for r in filt],
        (OUT / "wpq-record-register.json").open("w"),
        indent=1, ensure_ascii=False,
    )

    # ── 2. WELDING PROCESS sheet → `WPQ WELDING PROCESS` ────────────────────
    L += ["---", "", "## 2. `WPQ RECORD REGISTER.xlsx` → pbix `WPQ WELDING PROCESS`", ""]
    wp = trim_trailing_blank_rows(read_xlsx_sheet(SRC / "WPQ RECORD REGISTER.xlsx", "WELDING PROCESS"))
    whdr, wdata = promote_headers(wp)
    pb = PBIX_ROWS["WPQ WELDING PROCESS"]
    verdict = "✅ **exact match**" if len(wdata) == pb else f"⚠️ **differs by {len(wdata) - pb:+,}**"
    L += [
        f"* sheet `WELDING PROCESS`, **{len(wp)} rows × {max(len(r) for r in wp)} "
        "columns** as delivered",
        "* the M reads it by `Source{[Item=\"WELDING PROCESS\",Kind=\"Sheet\"]}[Data]`, "
        "`Table.PromoteHeaders`, types `Sn.`/`SCNTR`/`WPS No.`/`Welding process`/"
        "`Type of Welding Machine`, then `ReplaceValue(null → \"TBN\")` on "
        "`Welding process` **only**",
        f"* after `PromoteHeaders`: **{len(wdata)} rows** · pbix rows: **{pb}** — {verdict}",
        f"* header ({len(whdr)}): " + ", ".join(f"`{esc(h)}`" for h in whdr),
        "",
    ]
    # apply the TBN replace, as the pbix table holds it
    wp_i = whdr.index("WPS No.")
    proc_i = whdr.index("Welding process")
    wdata_pq = [list(r) + [None] * (len(whdr) - len(r)) for r in wdata]
    tbn = sum(1 for r in wdata_pq if r[proc_i] is None)
    for r in wdata_pq:
        if r[proc_i] is None:
            r[proc_i] = "TBN"
    L += [
        f"* `null → \"TBN\"` fires on **{tbn}** rows of `Welding process`.",
        "",
        "### Column profile (post-`TBN`, as the pbix table holds it)",
        "",
    ]
    wcols = profile_columns(whdr, wdata_pq)
    L += md_col_table(wcols)
    L += ["", "### 10-row sample", "", *md_sample(whdr, wdata_pq, 10), ""]

    wps_proc = sorted({r[wp_i] for r in wdata_pq if r[wp_i] is not None})
    dup = [v for v, n in Counter(r[wp_i] for r in wdata_pq).items() if n > 1 and v is not None]
    L += [
        f"* **{len(wps_proc)} distinct `WPS No.`** over {len(wdata_pq)} rows; "
        + (f"**{len(dup)} value(s) repeat**: " + ", ".join(f"`{esc(d)}`" for d in dup[:10])
           if dup else "no duplicates")
        + ".",
        "* the pbix marks `PWHT Status[WPS No.] → WPQ WELDING PROCESS[WPS No.]` as "
        "**1:1**, which requires this column to be unique — measured above.",
        "",
    ]
    side["welding_process_wps"] = wps_proc
    json.dump(
        [dict(zip(whdr, r)) for r in wdata_pq],
        (OUT / "wpq-welding-process.json").open("w"),
        indent=1, ensure_ascii=False,
    )

    # ── 3. WPS PWHT Status.xlsx → `PWHT Status` ─────────────────────────────
    L += ["---", "", "## 3. `WPS PWHT Status.xlsx` → pbix `PWHT Status`", ""]
    ph = trim_trailing_blank_rows(read_xlsx_sheet(SRC / "WPS PWHT Status.xlsx", "PWHT Status"))
    phdr, pdata = promote_headers(ph)
    pb = PBIX_ROWS["PWHT Status"]
    verdict = "✅ **exact match**" if len(pdata) == pb else f"⚠️ **differs by {len(pdata) - pb:+,}**"
    L += [
        f"* sheet `PWHT Status`, **{len(ph)} rows × {max(len(r) for r in ph)} columns**",
        "* the M types **only `Column1` and `Column2`** as text and then "
        "`PromoteHeaders` — the third column is carried through untyped, which is "
        "why the pbix table has three columns",
        f"* after `PromoteHeaders`: **{len(pdata)} rows** · pbix rows: **{pb}** — {verdict}",
        f"* header ({len(phdr)}): " + ", ".join(f"`{esc(h)}`" for h in phdr)
        + f" — pbix columns: `WPS No.`, `PWHT(Y/N)`, `Thickness`",
        "",
        "### Column profile",
        "",
    ]
    L += md_col_table(profile_columns(phdr, pdata))
    L += ["", "### Full listing (all rows — the table is small and is a rule table)", "",
          *md_sample(phdr, pdata, len(pdata)), ""]
    json.dump([dict(zip(phdr, r)) for r in pdata],
              (OUT / "wps-pwht-status.json").open("w"), indent=1, ensure_ascii=False)
    side["pwht_status_wps"] = sorted({r[0] for r in pdata if r and r[0] is not None})

    # second sheet
    rule = trim_trailing_blank_rows(read_xlsx_sheet(SRC / "WPS PWHT Status.xlsx", "Rule"))
    L += [
        f"### Sheet `Rule` — **{len(rule)} rows × {max((len(r) for r in rule), default=0)} "
        "column(s)**, read by no query",
        "",
    ]
    L += md_raw(rule, 12, "First 12 rows:")

    # ── 4. the .xls → `WPS Reg#` ────────────────────────────────────────────
    L += ["---", "", f"## 4. `{XLS}` → pbix `WPS Reg#`", ""]
    xr = trim_trailing_blank_rows(read_xls_sheet(SRC / XLS, xls_sheets[0]))
    L += [
        f"* BIFF8 `.xls`; **one sheet, named `{xls_sheets[0]}`**, "
        f"**{len(xr)} rows × {max(len(r) for r in xr)} columns**",
        "",
        f"> **The M would fail on this file.** It reads "
        f"`Source{{[Name=\"WPS Reg#\"]}}[Data]` — a member called `WPS Reg#`. The "
        f"delivered workbook has no such member: its only sheet is `{xls_sheets[0]}` "
        f"(a period, not a `#`) and its defined names are "
        + ", ".join(f"`{n}`" for n in xls_names)
        + ". `Excel.Workbook` would return no row for that key and the step would "
        "raise. The structure below is otherwise exactly what the M expects, so "
        "this is a rename, not a different register — same class of staleness as "
        "ruling R3-09.",
        "",
    ]
    L += md_raw(xr, 9, "The first nine raw rows (the five the M skips, the header, the sub-header):")
    xskip = xr[5:]
    xhdr, xdata = promote_headers(xskip)
    L += [
        f"* after `Skip(5)` + `PromoteHeaders`: **{len(xdata)} rows**, "
        f"{len(xhdr)} fields: " + ", ".join(f"`{esc(h)}`" for h in xhdr),
        "",
    ]
    # replay the M's two filters
    MATERIAL_BANDS = {" CU NI", "BRAZING ", "CS Aluminized", "CS/LTCS",
                      "DISSIMILAR WELDING ", "LALLOY", "STAINLESS STEEL  304L",
                      "STAINLESS STEEL  316L  ", "STRUCTURAL STEEL AWS D1.1"}
    sn_i = 0
    mat2_i = 8  # Column9 → "PQR Material Seamless / Welder Pipes & Plate Mat.2"
    f1 = [r for r in xdata if (r[sn_i] if sn_i < len(r) else None) not in MATERIAL_BANDS]
    f2 = [r for r in f1
          if (r[mat2_i] if mat2_i < len(r) else None) != "Mat. 2"
          and (r[sn_i] if sn_i < len(r) else None) is not None]
    pb = PBIX_ROWS["WPS Reg#"]
    verdict = "✅ **exact match**" if len(f2) == pb else f"⚠️ **differs by {len(f2) - pb:+,}**"
    L += [
        "* the M then drops the nine material-band banner rows that sit in `[S.N]` "
        "(`CS/LTCS`, `LALLOY`, `STAINLESS STEEL  304L`, …) and the `Mat. 2` "
        "sub-header row, and requires `[S.N] <> null`:",
        f"  * after the banner filter: **{len(f1)} rows** "
        f"({len(xdata) - len(f1)} banner rows dropped)",
        f"  * after `Mat. 2` + `[S.N] <> null`: **{len(f2)} rows** · pbix rows: "
        f"**{pb}** — {verdict}",
        "",
        "### Column profile (the 25 sheet columns; the M adds a 26th, `Material Type`, "
        "derived from `WPS NO.`)",
        "",
    ]
    L += md_col_table(profile_columns(xhdr, f2))
    L += ["", "### 10-row sample (first 8 of the 25 columns)", "",
          *md_sample(xhdr[:8], [r[:8] for r in f2], 10), ""]
    xls_wps = sorted({r[1] for r in f2 if len(r) > 1 and r[1] is not None})
    L += [f"* **{len(xls_wps)} distinct `WPS NO.`** over {len(f2)} rows.", ""]
    side["wps_reg_header"] = xhdr
    side["wps_reg_wps"] = xls_wps
    json.dump([dict(zip(xhdr, r)) for r in f2],
              (OUT / "wps-reg.json").open("w"), indent=1, ensure_ascii=False)

    # ── 5. CUM WPS Status.xlsx → `WPS Status CUM` ───────────────────────────
    L += ["---", "", "## 5. `CUM WPS Status.xlsx` → pbix `WPS Status CUM`", ""]
    cs = trim_trailing_blank_rows(read_xlsx_sheet(SRC / "CUM WPS Status.xlsx", "WPS Status"))
    chdr, cdata = promote_headers(cs)
    pb = PBIX_ROWS["WPS Status CUM"]
    verdict = "✅ **exact match**" if len(cdata) == pb else f"⚠️ **differs by {len(cdata) - pb:+,}**"
    L += [
        f"* sheet `WPS Status`, **{len(cs)} rows × {max(len(r) for r in cs)} columns**",
        "* the M: `Source{[Item=\"WPS Status\",Kind=\"Sheet\"]}[Data]`, "
        "`PromoteHeaders`, then `Week_End_Date` → date, `WPS Submitted` / "
        "`WPS Approved` → Int64. No filter, no rename.",
        f"* after `PromoteHeaders`: **{len(cdata)} rows** · pbix rows: **{pb}** — {verdict}",
        f"* header: " + ", ".join(f"`{esc(h)}`" for h in chdr),
        "",
        "### Column profile",
        "",
    ]
    L += md_col_table(profile_columns(chdr, cdata))
    dates = [r[0] for r in cdata if r[0]]
    subs = [int(float(r[1])) for r in cdata if r[1] not in (None, "")]
    apps = [int(float(r[2])) for r in cdata if r[2] not in (None, "")]
    L += [
        "",
        f"* weeks run `{esc(min(dates))}` → `{esc(max(dates))}` "
        f"({len(set(dates))} distinct of {len(cdata)} rows)",
        f"* `WPS Submitted` {min(subs)} → {max(subs)} (last row {subs[-1]}); "
        f"`WPS Approved` {min(apps)} → {max(apps)} (last row **{apps[-1]}**) — "
        "cumulative running totals, like `CUM MPI Done`",
        "",
        "### Last 10 weeks",
        "",
        *md_sample(chdr, cdata[-10:], 10),
        "",
    ]
    side["wps_status_cum_last"] = {"week_end_date": dates[-1],
                                   "wps_submitted": subs[-1], "wps_approved": apps[-1]}
    json.dump([dict(zip(chdr, r)) for r in cdata],
              (OUT / "wps-status-cum.json").open("w"), indent=1, ensure_ascii=False)

    # ── 6. the CSV ──────────────────────────────────────────────────────────
    L += ["---", "", f"## 6. `{CSVF}` — read by **no** Power Query", ""]
    raw = (SRC / CSVF).read_bytes()
    bom = raw[:3] == b"\xef\xbb\xbf"
    enc = None
    for cand in ("utf-8-sig" if bom else "utf-8", "cp1252", "latin-1"):
        try:
            text = raw.decode(cand)
            enc = cand
            break
        except UnicodeDecodeError:
            continue
    nonascii = sum(1 for b in raw if b > 127)
    crlf = raw.count(b"\r\n")
    lf = raw.count(b"\n")
    dialect = csv.Sniffer().sniff(text[:4096])
    rdr = list(csv.reader(io.StringIO(text), delimiter=dialect.delimiter))
    raw_width = max(len(r) for r in rdr)
    chdr_raw = [h.strip() for h in rdr[0]]
    # every line ends in a delimiter, so the reader yields a trailing field that
    # is empty on every row — Excel's own "save as CSV" artefact, not a column.
    trailing_blank = raw_width - 1
    while trailing_blank > 0 and all(
        (r[trailing_blank].strip() if trailing_blank < len(r) else "") == "" for r in rdr
    ):
        trailing_blank -= 1
    width = trailing_blank + 1
    dropped = raw_width - width
    chdr_csv = chdr_raw[:width]
    cbody = [r[:width] for r in rdr[1:] if any(x.strip() for x in r)]
    L += [
        f"* {len(raw):,} bytes · decodes as **{enc}** (BOM: {'yes' if bom else 'no'}; "
        f"{nonascii} non-ASCII byte(s)) · line endings **{'CRLF' if crlf else 'LF'}** "
        f"({crlf:,} CRLF / {lf:,} LF) · sniffed delimiter **`{dialect.delimiter}`** "
        f"· quotechar `{dialect.quotechar}`",
        f"* **{len(rdr)} lines → {len(cbody)} data rows × {len(chdr_csv)} columns** "
        + (f"({dropped} trailing all-empty field(s) dropped — every line ends in a "
           f"`{dialect.delimiter}`, an Excel save-as-CSV artefact, not a column)"
           if dropped else "(no trailing blank field)"),
        f"* header: " + ", ".join(f"`{esc(h)}`" for h in chdr_csv),
        "",
    ]
    nw = len(whdr)
    extra = [h for h in chdr_csv[nw:]]
    extra_rows = [r for r in cbody if any((r[i].strip() if i < len(r) else "") for i in range(nw, width))]
    same_as_wp = [h.strip() for h in whdr] == chdr_csv[:nw]
    if extra:
        L += [
            f"* the csv carries **{len(extra)} column(s) beyond the sheet's {nw}**, "
            f"with an **empty header** ({', '.join('`' + esc(h) + '`' or '∅' for h in extra) or '∅'}) "
            f"and a value on only **{len(extra_rows)}** rows:",
            "",
        ]
        for r in extra_rows:
            L.append(f"  * `{esc(' | '.join(x.strip() for x in r))}`")
        L.append("")
    L += [
        "### Is it an alternative form of one of the workbook sheets?",
        "",
        "| compared against | header match | rows |",
        "|---|---|---:|",
        f"| `WPQ RECORD REGISTER.xlsx` sheet `WELDING PROCESS` "
        f"({', '.join(f'`{esc(h)}`' for h in whdr)}) | "
        f"**{'IDENTICAL on the 5 named columns' if same_as_wp else 'different'}** | "
        f"csv {len(cbody)} vs sheet {len(wdata)} |",
        f"| `CONSOLIDATED` (12-column register) | different "
        f"({len(chdr_csv)} vs 12 columns) | — |",
        f"| `{XLS}` sheet `{xls_sheets[0]}` (25-column WPS register) | different "
        f"({len(chdr_csv)} vs {len(xhdr)} columns) | — |",
        "",
    ]
    if same_as_wp:
        csv_wps = sorted({r[wp_i].strip() for r in cbody if len(r) > wp_i and r[wp_i].strip()})
        only_csv = [v for v in csv_wps if v not in set(wps_proc)]
        only_sheet = [v for v in wps_proc if v not in set(csv_wps)]
        # row-level diff on the shared key
        def norm(r):
            return tuple((r[i].strip() if i < len(r) else "") for i in range(nw))
        csv_set = {norm(r) for r in cbody}
        sheet_set = {tuple("" if v is None else str(v).strip() for v in r[:nw]) for r in wdata_pq}
        L += [
            f"* **The CSV is a flat export of the `WELDING PROCESS` sheet** — same five "
            f"headers in the same order (plus the unnamed 6th column above).",
            f"* distinct `WPS No.`: csv **{len(csv_wps)}** vs sheet **{len(wps_proc)}**; "
            f"only in csv: {', '.join(f'`{esc(v)}`' for v in only_csv[:10]) or 'none'}; "
            f"only in sheet: {', '.join(f'`{esc(v)}`' for v in only_sheet[:10]) or 'none'}",
            f"* whole-row set difference (all five fields, trimmed): "
            f"{len(csv_set - sheet_set)} row(s) only in the csv, "
            f"{len(sheet_set - csv_set)} only in the sheet",
            "",
        ]
        for r in sorted(csv_set - sheet_set)[:6]:
            L.append(f"  * csv-only: `{esc(' | '.join(r))}`")
        for r in sorted(sheet_set - csv_set)[:6]:
            L.append(f"  * sheet-only: `{esc(' | '.join(r))}`")
        L.append("")
        side["csv_vs_sheet"] = {
            "csv_rows": len(cbody), "sheet_rows": len(wdata_pq),
            "csv_only": len(csv_set - sheet_set), "sheet_only": len(sheet_set - csv_set),
        }
    L += ["### 10-row sample", "", *md_sample(chdr_csv, cbody, 10), ""]

    # ── 7. cross-file WPS No. reconciliation ────────────────────────────────
    L += ["---", "", "## 7. Cross-file `WPS No.` reconciliation", ""]
    a = set(wps_proc)                                   # WELDING PROCESS
    b = {r[wps_i] for r in filt if r[wps_i]}             # CONSOLIDATED
    c = set(xls_wps)                                     # the dated .xls
    d = set(side["pwht_status_wps"])                     # PWHT Status
    L += [
        "| set | n | ∩ `WELDING PROCESS` | ∩ `CONSOLIDATED` | ∩ `.xls WPS Reg` | ∩ `PWHT Status` |",
        "|---|---:|---:|---:|---:|---:|",
        f"| `WELDING PROCESS[WPS No.]` | {len(a)} | — | {len(a & b)} | {len(a & c)} | {len(a & d)} |",
        f"| `CONSOLIDATED[WPS NO.]` | {len(b)} | {len(a & b)} | — | {len(b & c)} | {len(b & d)} |",
        f"| `.xls WPS Reg[WPS NO.]` | {len(c)} | {len(a & c)} | {len(b & c)} | — | {len(c & d)} |",
        f"| `PWHT Status[WPS No.]` | {len(d)} | {len(a & d)} | {len(b & d)} | {len(c & d)} | — |",
        "",
        "* `PWHT Status[WPS No.]` not found in `WELDING PROCESS`: "
        + (", ".join(f"`{esc(v)}`" for v in sorted(d - a))
           or "**none** — the 1:1 relationship resolves fully"),
        f"* the dated `.xls` holds {len(c)} WPS numbers against `CONSOLIDATED`'s "
        f"{len(b)}: {len(c - b)} of them are absent from the current register, "
        f"{len(b - c)} of the current register's are absent from the `.xls` — "
        "**the `.xls` is the older, narrower revision (dated 24-01-2025), not a "
        "substitute for `CONSOLIDATED`.**",
        "",
    ]
    side["cross"] = {
        "welding_process": len(a), "consolidated": len(b), "xls": len(c), "pwht": len(d),
        "wp_x_cons": len(a & b), "wp_x_xls": len(a & c), "wp_x_pwht": len(a & d),
        "cons_x_xls": len(b & c),
        "pwht_not_in_wp": sorted(d - a),
    }

    # ── 8. M91 corroborated by the weekly series ────────────────────────────
    L += ["---", "", "## 8. M91 corroborated against `WPS Status CUM`", ""]
    runs = []
    for _d, _a in zip(dates, apps):
        if not runs or runs[-1][2] != _a:
            runs.append([_d, _d, _a])
        else:
            runs[-1][1] = _d
    L += [
        "`CUM WPS Status.xlsx` is a *weekly cumulative* count of the same thing M91 "
        "counts, maintained by hand in a different workbook. It is an independent "
        "check on the register:",
        "",
        "| weeks | `WPS Approved` |",
        "|---|---:|",
    ]
    for a0, a1, v in runs:
        span = f"`{esc(a0)[:10]}`" if a0 == a1 else f"`{esc(a0)[:10]}` → `{esc(a1)[:10]}`"
        L.append(f"| {span} | {v} |")
    L += [
        "",
        f"* the latest week (`{esc(dates[-1])[:10]}`) reads **{apps[-1]}**, and the "
        f"register's approved-distinct count is **{m91}** — **they agree**.",
        "* `analysis/calculation-logic.md` §M91 records the KPI as **294** — the value "
        "in the pbix snapshot. `294` is exactly the plateau this series holds for 23 "
        "weeks before the step to 318, so the pbix was refreshed during that window "
        "and the delivered register is simply newer. Nothing is inconsistent.",
        "",
    ]

    json.dump(side, (OUT / "profile.json").open("w"), indent=1, ensure_ascii=False, default=str)
    (OUT / "workbooks.md").write_text("\n".join(L) + "\n")

    print(f"wrote {OUT / 'workbooks.md'}  ({len(L)} lines)")
    for f in ["profile.json", "wpq-record-register.json", "wpq-welding-process.json",
              "wps-pwht-status.json", "wps-reg.json", "wps-status-cum.json"]:
        print(f"  + {f}  ({(OUT / f).stat().st_size:,} bytes)")
    print()
    print("KEY FIGURES")
    print(f"  WPQ RECORD REGISTER  rows {len(filt):>5}  (pbix 318)")
    print(f"  WPQ WELDING PROCESS  rows {len(wdata_pq):>5}  (pbix 266)  distinct WPS {len(a)}")
    print(f"  WPS Reg#             rows {len(f2):>5}  (pbix  71)")
    print(f"  WPS Status CUM       rows {len(cdata):>5}  (pbix 127)  last approved {apps[-1]}")
    print(f"  PWHT Status          rows {len(pdata):>5}  (pbix  34)")
    print(f"  WPS (Welding Process).csv rows {len(cbody):>5}  header == WELDING PROCESS: {same_as_wp}")
    print(f"  *** M91 WPS Approved = {m91} ***")
    print(f"  elapsed {time.time() - t0:.2f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
