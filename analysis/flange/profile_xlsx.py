#!/usr/bin/env python3
"""
Read-only profiler for the two delivered flange workbooks.

    sources/Flange Progress.xlsx   -> pbix table `Flange Progress`   (363,245 rows)
    sources/ovAssets_1619.xlsx     -> pbix table `Flange ovAssets_1619` (226,504 rows)

Two things happen here:

1. FULL per-column profile of every sheet the pbix Power Query actually reads
   (`FlangeJointProgress`, `Exported from SC`), plus the tiny unused
   `Referential` sheet for completeness: type mix, non-empty, distinct,
   top-15 values.

2. A re-implementation of the pbix M pipeline + the DAX calculated columns and
   measures, so the flange-dashboard mockup's own numbers can be checked
   against the delivered data:

     Flange Progress  = FlangeJointProgress
                        |> Table.Skip(5) |> PromoteHeaders
                        |> exclude Iso Number in {0, 1M03}
                        |> exclude Flange Subcontractor = ACCIONA
                        |> Joint ID  = [Iso Number] & "-" & [BT No.]
                        |> Joint Method normalisation
                        |> Table.Combine with `Flange ovAssets_1619`
                        |> exclude Joint Date = 2026-11-20
     HA               = second character of [System] -> HA1..HA4 (DAX calc col)
     measures         = the seven the mockup's tables/donuts use.

Writes ONLY:  analysis/flange/workbooks.md   (the profile)
              analysis/flange/metrics.json   (machine-readable computed numbers)

Usage:  uv run analysis/flange/profile_xlsx.py
        uv run analysis/flange/profile_xlsx.py --quick   (profile 40k rows/sheet)
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
OUT = os.path.join(REPO, "analysis", "flange")

FP_XLSX = os.path.join(SRC, "Flange Progress.xlsx")
OV_XLSX = os.path.join(SRC, "ovAssets_1619.xlsx")

# pbix row counts, from analysis/pbix/model.md
PBIX_ROWS = {"Flange Progress": 363245, "Flange ovAssets_1619": 226504}

DISTINCT_CAP = 300_000
QUICK = "--quick" in sys.argv
QUICK_ROWS = 40_000


# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------

def norm(v):
    """openpyxl cell -> ('' | str | int | float | datetime.date)."""
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    return v


def kind(v) -> str:
    if v == "":
        return "blank"
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, dt.date):
        return "date"
    if isinstance(v, int):
        return "int"
    if isinstance(v, float):
        return "float"
    return "str"


def show(v, width=48) -> str:
    if v == "":
        return "(blank)"
    s = v.isoformat() if isinstance(v, dt.date) else str(v)
    s = s.replace("\n", "\\n").replace("|", "\\|")
    return s if len(s) <= width else s[: width - 1] + "…"


class ColProfile:
    __slots__ = ("name", "n", "nonempty", "kinds", "counter", "capped")

    def __init__(self, name: str):
        self.name = name
        self.n = 0
        self.nonempty = 0
        self.kinds = collections.Counter()
        self.counter = collections.Counter()
        self.capped = False

    def add(self, v):
        self.n += 1
        k = kind(v)
        self.kinds[k] += 1
        if k != "blank":
            self.nonempty += 1
        if v in self.counter or not self.capped:
            self.counter[v] += 1
            if len(self.counter) >= DISTINCT_CAP:
                self.capped = True

    @property
    def distinct_nonblank(self):
        return sum(1 for k in self.counter if k != "")


def as_date(v):
    """Coerce a cell to a date the way the M's `Changed Type` does. Repairs the
    four `dd-Mmm-0024` typos the M patches by hand (year 24 -> 2024)."""
    if v == "" or v is None:
        return None
    if isinstance(v, dt.date):
        if v.year < 100:                       # 02-Oct-0024 -> 02-Oct-2024
            try:
                return v.replace(year=v.year + 2000)
            except ValueError:
                return None
        return v
    if isinstance(v, (int, float)):
        try:                                   # excel serial
            return (dt.date(1899, 12, 30) + dt.timedelta(days=int(v)))
        except Exception:
            return None
    s = str(v).strip()
    if not s:
        return None
    s = s.replace("'", "").replace(" 12:00:00 AM", "").replace(" 0:00", "").strip()
    for fmt in ("%d-%b-%Y", "%Y-%m-%d", "%Y/%m/%d", "%d-%b-%y", "%m/%d/%Y", "%d/%m/%Y",
                "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%m/%d/%Y %H:%M:%S"):
        try:
            d = dt.datetime.strptime(s, fmt).date()
            if d.year < 100:
                d = d.replace(year=d.year + 2000)
            return d
        except ValueError:
            continue
    return None


# --------------------------------------------------------------------------
# sheet reader
# --------------------------------------------------------------------------

def read_sheet(path, sheet, skip, want_cols=None, profile=True, limit=None):
    """Stream one sheet. Returns (header, profiles|None, rows_iter_materialised).

    `want_cols` restricts what is kept in the returned row dicts (memory);
    profiling still covers every column."""
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet]
    it = ws.iter_rows(values_only=True)
    for _ in range(skip):
        next(it, None)
    header_raw = next(it, None) or ()
    header = []
    for i, h in enumerate(header_raw):
        # ovAssets_1619's headers carry embedded newlines ("PCC Remarks -\n Field045
        # (Custom)"); the M refers to them as "#(lf)". Collapse every whitespace run so
        # the names are usable as dict keys and printable in a markdown table.
        h = "" if h is None else " ".join(str(h).split())
        header.append(h if h else f"Column{i + 1}")
    profs = [ColProfile(h) for h in header] if profile else None
    idx = {h: i for i, h in enumerate(header)}
    keep = [(c, idx[c]) for c in (want_cols or []) if c in idx]
    rows = []
    n = 0
    for r in it:
        if not r or all(c is None or (isinstance(c, str) and not c.strip()) for c in r):
            continue
        n += 1
        vals = [norm(r[i]) if i < len(r) else "" for i in range(len(header))]
        if profs:
            for i, p in enumerate(profs):
                p.add(vals[i])
        if keep:
            rows.append({c: vals[i] for c, i in keep})
        if limit and n >= limit:
            break
    wb.close()
    return header, profs, rows, n


# --------------------------------------------------------------------------
# the pbix pipeline
# --------------------------------------------------------------------------

FP_KEEP = ["Test Pack", "System", "SubSystem", "Iso Number", "BT No.", "Diam",
           "Joint Method", "Joint Timing", "Cat.", "Joint Date", "Report Nbr",
           "Control %", "Flange Joint Status", "Control Inspection Date",
           "Status - A/R ", "Status - A/R", "Reason for De-Tightening",
           "Flange Subcontractor", "ACC/REJ", "BTC01", "Joint Point"]

OV_KEEP = ["FlangeJointName", "WeldAreaName", "PipingIsometricNum - Field026 (Custom)",
           "Test Pack No - Field029 (Custom)",
           "Category for final tightening - Field030 (Custom)",
           "Process Plant", "System", "Subsystem", "Joint Size",
           "FL - Tightening Method", "Tightening Method",
           "Tightening Date - Field027 (Custom)",
           "Verified Date - Field024 (Custom)",
           "Report Number - Field031 (Custom)",
           "PCC Tightening Date - Field039 (Custom)",
           "PCC Remarks - Field045 (Custom)"]


def norm_method_fp(m):
    """`Flange Progress`'s five Table.ReplaceValue steps on [Joint Method]."""
    if m == "" or m is None:
        return "TBN"
    s = str(m)
    s = s.replace("Tensionning", "Tensioning")
    s = s.replace("Manual Torquing", "Manual")
    s = s.replace("Hydraulic Torquing", "Torquing")
    s = s.replace("Torquing Critical", "Torquing")
    return s.strip() or "TBN"


def norm_method_ov(m):
    """`Flange ovAssets_1619`: Torqueing -> Torquing, null -> TBN."""
    if m == "" or m is None:
        return "TBN"
    return str(m).replace("Torqueing", "Torquing").strip() or "TBN"


def ha_of(system):
    """DAX calc column `Flange Progress`[HA] — WITHOUT the `HA l0_abs_guide`
    fallback, which is not in sources/."""
    s = "" if system == "" else str(system)
    if not s or s == "System-NA - Not Applicable":
        return ""                     # LOOKUPVALUE on the absent guide
    d = s[1:2]
    return {"1": "HA1", "2": "HA2", "3": "HA3", "4": "HA4"}.get(d, "")


def build_fact(fp_rows, ov_rows):
    """Table.Combine({Flange Progress, Flange ovAssets_1619}) + the calc columns."""
    fact = []
    for r in fp_rows:
        iso = str(r.get("Iso Number", "") or "")
        if iso in ("0", "1M03"):
            continue
        sub = str(r.get("Flange Subcontractor", "") or "").strip()
        if sub.upper() == "ACCIONA":
            continue
        jd = as_date(r.get("Joint Date"))
        if jd == dt.date(2026, 11, 20):
            continue
        cat = str(r.get("Cat.", "") or "").strip() or "TBN"
        ar = r.get("Status - A/R ", r.get("Status - A/R", ""))
        fact.append({
            "src": "FP",
            "jid": iso + "-" + str(r.get("BT No.", "") or ""),
            "sub": sub,
            "ha": ha_of(r.get("System", "")),
            "method": norm_method_fp(r.get("Joint Method")),
            "cat": cat,
            "jd": jd,
            "cid": as_date(r.get("Control Inspection Date")),
            "pcc": None,                      # column absent from this sheet
            "leak": str(r.get("Reason for De-Tightening", "") or "").upper(),
            "ar": str(ar or "").strip(),
            "ha_pp": "",
        })
    for r in ov_rows:
        jd = as_date(r.get("Tightening Date - Field027 (Custom)"))
        if jd == dt.date(2026, 11, 20):
            continue
        cat = str(r.get("Category for final tightening - Field030 (Custom)", "") or "").strip() or "TBN"
        remark = str(r.get("PCC Remarks - Field045 (Custom)", "") or "")
        leak = remark.replace("Flange leaking", "FLANGE LEAKAGE").replace("Flange leakage", "FLANGE LEAKAGE")
        fact.append({
            "src": "OV",
            "jid": str(r.get("FlangeJointName", "") or ""),
            "sub": "CCC",                     # M hard-codes it
            "ha": ha_of(r.get("System", "")),
            "method": norm_method_ov(r.get("FL - Tightening Method")),
            "cat": cat,
            "jd": jd,
            "cid": as_date(r.get("Verified Date - Field024 (Custom)")),
            "pcc": as_date(r.get("PCC Tightening Date - Field039 (Custom)")),
            "leak": leak.upper(),
            "ar": "",
            "ha_pp": (str(r.get("Process Plant", "") or "")[:3]
                      if str(r.get("Process Plant", "") or "").startswith("HA") else ""),
        })
    return fact


def measures(rows):
    """The seven DAX measures the mockup's cards/tables/donuts read.
    Every one is DISTINCTCOUNT('Flange Progress'[Joint ID])."""
    total, jointed, constn, pcc, leaked, remainder = (set() for _ in range(6))
    for r in rows:
        j = r["jid"]
        total.add(j)
        if r["jd"]:
            jointed.add(j)
        else:
            remainder.add(j)                                    # Total Flanges ID Remainder
        # Total Flanges ID Tightening Constraction "CCC no cat"
        if r["jd"] and not r["pcc"]:
            if r["sub"] == "CCC" or r["cat"] in ("X", "Y"):
                constn.add(j)
        # Total Flanges ID Tightening PCC "CCC no cat"
        if r["pcc"]:
            pcc.add(j)
        elif r["jd"] and r["sub"] != "CCC" and r["cat"] in ("Z", "A", "B"):
            pcc.add(j)
        if r["leak"] == "FLANGE LEAKAGE":
            leaked.add(j)
    t, ins = len(total), len(jointed)
    return {
        "total": t,
        "constn": len(constn),
        "pcc": len(pcc),
        "inspected": ins,
        "leaked": len(leaked),
        "remains": len(remainder),
        "pct": round(ins / t * 100, 2) if t else 0,
        "leakedPct": round(len(leaked) / ins * 100, 2) if ins else 0,
    }


# --------------------------------------------------------------------------
# markdown emitters
# --------------------------------------------------------------------------

def emit_profile(w, path, sheet, header, profs, nrows, pbix_table, note):
    w(f"### sheet `{sheet}`\n")
    w(f"* {len(header)} columns · **{nrows:,}** non-blank data rows"
      + (f" · pbix table `{pbix_table}` = {PBIX_ROWS[pbix_table]:,} rows" if pbix_table else ""))
    if note:
        w(f"* {note}")
    w("")
    w("| # | column | types | non-empty | % | distinct | top values (count) |")
    w("|---:|---|---|---:|---:|---:|---|")
    for i, p in enumerate(profs, 1):
        kinds = ", ".join(f"{k} {v:,}" for k, v in p.kinds.most_common() if k != "blank") or "—"
        dis = f"{p.distinct_nonblank:,}" + ("+ (capped)" if p.capped else "")
        top = "; ".join(f"`{show(v, 30)}` {c:,}" for v, c in p.counter.most_common(15) if v != "")[:520] or "—"
        pct = f"{p.nonempty / p.n * 100:.1f}%" if p.n else "—"
        w(f"| {i} | `{p.name}` | {kinds} | {p.nonempty:,} | {pct} | {dis} | {top} |")
    w("")


def main() -> int:
    t0 = time.time()
    os.makedirs(OUT, exist_ok=True)
    lines: list[str] = []
    w = lines.append
    limit = QUICK_ROWS if QUICK else None

    w("# The two delivered flange workbooks — full column profile")
    w("")
    w("Produced by `analysis/flange/profile_xlsx.py` (openpyxl read-only, `data_only=True`,")
    w("i.e. cached formula values — exactly what Power Query's `Excel.Workbook` sees).")
    w("**Read-only: nothing under `sources/` is written.**")
    if QUICK:
        w("")
        w(f"> ⚠ `--quick`: only the first {QUICK_ROWS:,} rows of each sheet were read. Counts are NOT final.")
    w("")

    # ---- Flange Progress.xlsx ------------------------------------------
    print("… Flange Progress.xlsx / FlangeJointProgress", file=sys.stderr, flush=True)
    ta = time.time()
    fp_hdr, fp_profs, fp_rows, fp_n = read_sheet(
        FP_XLSX, "FlangeJointProgress", skip=5, want_cols=FP_KEEP, limit=limit)
    fp_secs = time.time() - ta
    print(f"   {fp_n:,} rows in {fp_secs:.1f}s", file=sys.stderr, flush=True)

    print("… Flange Progress.xlsx / Referential", file=sys.stderr, flush=True)
    rf_hdr, rf_profs, _, rf_n = read_sheet(FP_XLSX, "Referential", skip=5, profile=True)

    print("… ovAssets_1619.xlsx / Exported from SC", file=sys.stderr, flush=True)
    tb = time.time()
    ov_hdr, ov_profs, ov_rows, ov_n = read_sheet(
        OV_XLSX, "Exported from SC", skip=0, want_cols=OV_KEEP, limit=limit)
    ov_secs = time.time() - tb
    print(f"   {ov_n:,} rows in {ov_secs:.1f}s", file=sys.stderr, flush=True)

    w("## `sources/Flange Progress.xlsx` — 26,100,221 bytes")
    w("")
    w("M: `Excel.Workbook(File.Contents(\"…\\Flange Managment\\Flange Progress.xlsx\"))`, sheet")
    w("`FlangeJointProgress`, `Table.Skip(5)` then `Table.PromoteHeaders`. The `Referential`")
    w("sheet is **not** referenced by any Power Query in the pbix.")
    w("")
    emit_profile(w, FP_XLSX, "FlangeJointProgress", fp_hdr, fp_profs, fp_n, None,
                 f"read in {fp_secs:.1f}s")
    emit_profile(w, FP_XLSX, "Referential", rf_hdr, rf_profs, rf_n, None,
                 "not used by any M query — profiled for completeness")

    w("## `sources/ovAssets_1619.xlsx` — 29,070,219 bytes")
    w("")
    w("M: `Excel.Workbook(File.Contents(\"…\\Flange Managment\\ovAssets_1619.xlsx\"))`, sheet")
    w("`Exported from SC`, headers on row 1, then ~120 rename/replace steps that re-shape it")
    w("into the `Flange Progress` column vocabulary and hard-code `Flange Subcontractor = \"CCC\"`.")
    w("")
    emit_profile(w, OV_XLSX, "Exported from SC", ov_hdr, ov_profs, ov_n, "Flange ovAssets_1619",
                 f"read in {ov_secs:.1f}s")

    # ---- row-count reconciliation --------------------------------------
    fact = build_fact(fp_rows, ov_rows)
    del fp_rows, ov_rows
    fp_kept = sum(1 for r in fact if r["src"] == "FP")
    ov_kept = sum(1 for r in fact if r["src"] == "OV")

    w("## Row-count reconciliation against the pbix")
    w("")
    w("| step | rows |")
    w("|---|---:|")
    w(f"| `FlangeJointProgress` non-blank data rows (after `Table.Skip(5)`) | {fp_n:,} |")
    w(f"| … after `Iso Number ∉ {{0, 1M03}}`, `Flange Subcontractor ≠ ACCIONA`, `Joint Date ≠ 2026-11-20` | {fp_kept:,} |")
    w(f"| `Exported from SC` non-blank data rows | {ov_n:,} |")
    w(f"| … kept | {ov_kept:,} |")
    w(f"| **combined = pbix `Flange Progress`** | **{fp_kept + ov_kept:,}** |")
    w(f"| pbix stores | {PBIX_ROWS['Flange Progress']:,} |")
    w(f"| delta | {fp_kept + ov_kept - PBIX_ROWS['Flange Progress']:+,} |")
    w("")
    w(f"`Flange ovAssets_1619` on its own: {ov_n:,} rows here vs "
      f"{PBIX_ROWS['Flange ovAssets_1619']:,} in the pbix "
      f"({ov_n - PBIX_ROWS['Flange ovAssets_1619']:+,}).")
    w("")

    # ---- join / overlap -------------------------------------------------
    fp_ids = {r["jid"] for r in fact if r["src"] == "FP"}
    ov_ids = {r["jid"] for r in fact if r["src"] == "OV"}
    inter = fp_ids & ov_ids
    all_ids = fp_ids | ov_ids
    w("## Do the two workbooks join?")
    w("")
    w("They are **appended, not joined** (`Table.Combine`). The candidate key on both sides is")
    w("`Joint ID` — built as `[Iso Number] & \"-\" & [BT No.]` in `Flange Progress`, and")
    w("read straight from `FlangeJointName` in `ovAssets_1619`.")
    w("")
    w("| set | distinct Joint IDs |")
    w("|---|---:|")
    w(f"| `Flange Progress` sheet | {len(fp_ids):,} |")
    w(f"| `ovAssets_1619` sheet | {len(ov_ids):,} |")
    w(f"| **intersection** | **{len(inter):,}** |")
    w(f"| union (= pbix `Total Flanges ID`) | {len(all_ids):,} |")
    w("")
    cov_fp = len(inter) / len(fp_ids) * 100 if fp_ids else 0
    cov_ov = len(inter) / len(ov_ids) * 100 if ov_ids else 0
    w(f"Coverage: {cov_fp:.2f}% of the `Flange Progress` keys and {cov_ov:.2f}% of the")
    w("`ovAssets_1619` keys appear on the other side.")
    if inter:
        w("")
        w("Sample of shared keys: " + ", ".join(f"`{k}`" for k in sorted(inter)[:10]))
    w("")

    # ---- computed mockup metrics ----------------------------------------
    overall = measures(fact)
    by_sub, by_ha, by_method, by_ha_method, by_ha_sub = {}, {}, {}, {}, {}
    buckets_sub = collections.defaultdict(list)
    buckets_ha = collections.defaultdict(list)
    buckets_m = collections.defaultdict(list)
    buckets_hm = collections.defaultdict(list)
    buckets_hs = collections.defaultdict(list)
    for r in fact:
        buckets_sub[r["sub"] or "(blank)"].append(r)
        buckets_ha[r["ha"] or "(blank)"].append(r)
        buckets_m[r["method"]].append(r)
        buckets_hm[(r["ha"] or "(blank)", r["method"])].append(r)
        buckets_hs[(r["ha"] or "(blank)", r["sub"] or "(blank)")].append(r)
    for k, v in buckets_sub.items():
        by_sub[k] = measures(v)
    for k, v in buckets_ha.items():
        by_ha[k] = measures(v)
    for k, v in buckets_m.items():
        by_method[k] = measures(v)
    for k, v in buckets_hm.items():
        by_ha_method[f"{k[0]}|{k[1]}"] = measures(v)
    for k, v in buckets_hs.items():
        by_ha_sub[f"{k[0]}|{k[1]}"] = measures(v)
    by_source = {s: measures([r for r in fact if r["src"] == s]) for s in ("FP", "OV")}
    leak_values = collections.Counter(r["leak"] for r in fact if r["leak"])

    monthly = collections.Counter()
    monthly_src = {"FP": collections.Counter(), "OV": collections.Counter()}
    for r in fact:
        if r["jd"]:
            monthly[r["jd"].strftime("%Y-%m")] += 1
            monthly_src[r["src"]][r["jd"].strftime("%Y-%m")] += 1
    dup_fp = fp_kept - len(fp_ids)
    dup_ov = ov_kept - len(ov_ids)
    weekly_leak = collections.Counter()
    for r in fact:
        if r["leak"] == "FLANGE LEAKAGE" and r["jd"]:
            weekly_leak[r["jd"].strftime("%Y-%m")] += 1

    w("## The mockup's own numbers, recomputed from the delivered data")
    w("")
    w("Measure definitions are the pbix DAX verbatim (see `analysis/flange/pbix-flange.md`).")
    w("`HA` is the DAX calc column *without* its `HA l0_abs_guide` fallback (that CSV is absent).")
    w("")
    w("### Overall")
    w("")
    w("| metric | computed | mockup `rawData` | delta |")
    w("|---|---:|---:|---:|")
    mk = {"total": 358342, "constn": 122867, "pcc": 2276, "inspected": 124188, "leaked": 44}
    for k, mv in mk.items():
        cv = overall[k]
        w(f"| {k} | {cv:,} | {mv:,} | {cv - mv:+,} |")
    w(f"| inspected % | {overall['pct']:.2f}% | 34.66% | — |")
    w("")

    w("### By sub-contractor")
    w("")
    w("| subcontractor | total | const-n | PCC | inspected | % | leaked | mockup total | mockup inspected |")
    w("|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    mock_sub = {"CCC": (227605, 59444), "GAC": (53550, 25022),
                "MEDGULF": (12561, 6705), "TEKFEN": (64626, 33017)}
    for k in sorted(by_sub, key=lambda x: -by_sub[x]["total"]):
        m = by_sub[k]
        ms = mock_sub.get(k.upper(), ("—", "—"))
        mt = f"{ms[0]:,}" if isinstance(ms[0], int) else ms[0]
        mi = f"{ms[1]:,}" if isinstance(ms[1], int) else ms[1]
        w(f"| {k} | {m['total']:,} | {m['constn']:,} | {m['pcc']:,} | {m['inspected']:,} | "
          f"{m['pct']:.2f}% | {m['leaked']:,} | {mt} | {mi} |")
    w("")

    w("### By HA")
    w("")
    w("| HA | total | const-n | PCC | inspected | % | leaked | remains |")
    w("|---|---:|---:|---:|---:|---:|---:|---:|")
    for k in sorted(by_ha):
        m = by_ha[k]
        w(f"| {k} | {m['total']:,} | {m['constn']:,} | {m['pcc']:,} | {m['inspected']:,} | "
          f"{m['pct']:.2f}% | {m['leaked']:,} | {m['remains']:,} |")
    w("")

    ov = [r for r in fact if r["src"] == "OV"]
    agree = sum(1 for r in ov if r["ha"] and r["ha"] == r["ha_pp"])
    disagree = sum(1 for r in ov if r["ha"] and r["ha_pp"] and r["ha"] != r["ha_pp"])
    only_pp = sum(1 for r in ov if not r["ha"] and r["ha_pp"] and r["ha_pp"] != "HA-")
    w("### HA cross-check: DAX `MID([System],2,1)` vs `ovAssets_1619[Process Plant]`")
    w("")
    w("`ovAssets_1619` carries the handover area **verbatim** in `Process Plant`")
    w("(`HA1 - Handover Area 1 (PHA-01, 02, 03, 04, 05)`), a column the pbix never uses for HA.")
    w("")
    w(f"* rows where the DAX rule and `Process Plant` agree: **{agree:,}** of {len(ov):,}")
    w(f"* rows where they disagree: **{disagree:,}**")
    w(f"* rows the DAX rule leaves blank but `Process Plant` resolves: **{only_pp:,}**")
    w("")
    w("### By joint method  (the `Project Flange Inspected` donut)")
    w("")
    w("| method | total | inspected | share of inspected |")
    w("|---|---:|---:|---:|")
    tot_ins = sum(v["inspected"] for v in by_method.values())
    for k in sorted(by_method, key=lambda x: -by_method[x]["inspected"]):
        m = by_method[k]
        w(f"| {k} | {m['total']:,} | {m['inspected']:,} | "
          f"{m['inspected'] / tot_ins * 100 if tot_ins else 0:.2f}% |")
    w("")

    w("### By source workbook")
    w("")
    w("| source | total | const-n | PCC | inspected | leaked | remains |")
    w("|---|---:|---:|---:|---:|---:|---:|")
    for k, lbl in (("FP", "`Flange Progress.xlsx` / FlangeJointProgress"),
                   ("OV", "`ovAssets_1619.xlsx` / Exported from SC (all CCC)")):
        m = by_source[k]
        w(f"| {lbl} | {m['total']:,} | {m['constn']:,} | {m['pcc']:,} | {m['inspected']:,} | "
          f"{m['leaked']:,} | {m['remains']:,} |")
    w("")
    w("### `Reason for De-Tightening` — top 15 non-blank values")
    w("")
    w("| value | rows |")
    w("|---|---:|")
    for v, c in leak_values.most_common(15):
        w(f"| `{show(v, 60)}` | {c:,} |")
    w("")
    w("### Monthly inspection  (`Total Flanges ID Jointed` by `Joint Date` month)")
    w("")
    w("| month | jointed | | month | jointed |")
    w("|---|---:|---|---|---:|")
    months = sorted(monthly)
    half = (len(months) + 1) // 2
    for i in range(half):
        a = months[i]
        b = months[i + half] if i + half < len(months) else None
        left = f"| {a} | {monthly[a]:,} |"
        right = f" | {b} | {monthly[b]:,} |" if b else " |  |  |"
        w(left + right)
    w("")

    w("### Grain: rows per Joint ID")
    w("")
    w(f"`Flange Progress.xlsx` contributes {fp_kept:,} rows for {len(fp_ids):,} distinct Joint IDs")
    w(f"(**{dup_fp:,} repeat rows** — the same flange re-jointed; see `Joint Point` `1FR`/`1FR2`…).")
    w(f"`ovAssets_1619.xlsx` contributes {ov_kept:,} rows for {len(ov_ids):,} distinct Joint IDs")
    w(f"({dup_ov:,} repeats). **Every mockup number is a DISTINCTCOUNT of `Joint ID`, never a row count.**")
    w("")
    w("### Monthly inspection by source workbook")
    w("")
    w("| month | `Flange Progress` | `ovAssets_1619` | total | mockup `rawData.monthly.All` |")
    w("|---|---:|---:|---:|---:|")
    mock_monthly = {"2025-08": 9344, "2025-09": 10044, "2025-10": 16764,
                    "2025-11": 15911, "2025-12": 13336, "2026-01": 4747}
    for m in sorted(monthly):
        if m < "2025-06":
            continue
        mm = mock_monthly.get(m)
        w(f"| {m} | {monthly_src['FP'][m]:,} | {monthly_src['OV'][m]:,} | {monthly[m]:,} | "
          + (f"{mm:,} |" if mm else "— |"))
    w("")

    # ---- json ------------------------------------------------------------
    payload = {
        "generated": dt.datetime.now().isoformat(timespec="seconds"),
        "quick": QUICK,
        "runtime_s": round(time.time() - t0, 1),
        "rows": {"flange_progress_sheet": fp_n, "flange_progress_kept": fp_kept,
                 "ovassets_sheet": ov_n, "ovassets_kept": ov_kept,
                 "combined": fp_kept + ov_kept, "pbix_combined": PBIX_ROWS["Flange Progress"]},
        "join": {"fp_distinct": len(fp_ids), "ov_distinct": len(ov_ids),
                 "intersection": len(inter), "union": len(all_ids)},
        "overall": overall,
        "by_subcontractor": by_sub,
        "by_ha": by_ha,
        "by_method": by_method,
        "by_ha_method": by_ha_method,
        "by_ha_subcontractor": by_ha_sub,
        "by_source": by_source,
        "leak_reason_values_top30": dict(leak_values.most_common(30)),
        "monthly_jointed": dict(sorted(monthly.items())),
        "monthly_jointed_by_source": {k: dict(sorted(v.items())) for k, v in monthly_src.items()},
        "duplicate_rows_per_joint_id": {"flange_progress": dup_fp, "ovassets": dup_ov},
        "monthly_leaked": dict(sorted(weekly_leak.items())),
    }
    with open(os.path.join(OUT, "metrics.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1, default=str)

    secs = time.time() - t0
    w(f"_Generated in {secs:.1f}s. Machine-readable copy: `analysis/flange/metrics.json`._")
    with open(os.path.join(OUT, "workbooks.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"\nwrote {OUT}/workbooks.md and {OUT}/metrics.json in {secs:.1f}s")
    print(f"combined rows {fp_kept + ov_kept:,} vs pbix {PBIX_ROWS['Flange Progress']:,}")
    print(f"Total Flanges ID {overall['total']:,} (mockup 358,342) · "
          f"Jointed {overall['inspected']:,} (mockup 124,188) · "
          f"Leaked {overall['leaked']:,} (mockup 44)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
