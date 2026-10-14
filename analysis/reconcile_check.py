#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
reconcile_check.py — plausibility check of the DAX formulas in
`analysis/calculation-logic.md` against `sources/Weld Dump.txt`.

Stdlib only. Single streaming pass. Re-runnable.

WHAT IT DOES
------------
1. Re-implements the Power Query `Weld Dump` load exactly as the .pbix does
   (see analysis/pbix/model.md -> "Power Query (M) per table -> Weld Dump"):
     - 226 header names, 223 data fields, ';' separated, QuoteStyle.None
     - records are assembled by counting ';' until the modal width 223,
       because 1,236 bare LFs and 17 embedded CRLFs live inside field values
       (same logic as analysis/dump/profile.py)
     - keep [Area Classification] <> 0 and <> ""
     - keep [Revision Status] = ""            <- cancelled welds dropped
     - keep [Sub-Contractor] <> ""
     - Weld Type: "BW_"->"BW", "SW_"->"SW"
     - drop [Weld Date] in {2026-12-30} (29/30-Aug-2026 dropped only by the August pbix; counted since the October delivery)
     - add  Spool ID  = ISO Number & "-" & Spool No.
     - add  Joint ID  = ISO Number & "-" & Spool No. & "-" & Weld No.
     - add  RT Film Total = [Total No of films Acc] + [Total No of films Rej]
     - add  Repair & Reweld  (calc column, right(Weld No.,2) in R1/R2/RW)
2. Evaluates the "EP"/"WD" measures (the ones the GAC / TEKFEN / MEDGULF
   pages of the mockup are bound to) per sub-contractor.
3. Prints them next to the mockup's 16-Jan-26 numbers.

CAVEAT the caller must keep in mind: the mockup is a 16-Jan-2026 snapshot,
this dump is a 30-Aug-2026 export.  Numbers are NOT expected to match; only
order of magnitude and shape are.

Usage:  python3 analysis/reconcile_check.py [--asof YYYY-MM-DD] [--src PATH]
"""

import argparse
import collections
import datetime as dt
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_SRC = os.path.join(ROOT, "sources", "Weld Dump.txt")
OUT_JSON = os.path.join(HERE, "reconcile_results.json")

# ----------------------------------------------------------------- vocab ---
# verbatim from the DAX (analysis/pbix/measures.md)
RT_BACKLOG_STATUS = {
    "H", "HS", "HS CCC", "SS", "T", "T1", "T1S", "T1-1", "T1-1S",
    "T1-2S", "T2", "T3", "T2-1", "T2-1S", "T2-2S", "T2S",
}
# the second branch of every RT-backlog measure: RT% = 100 and status blank/?
RT_BACKLOG_STATUS_100 = {"?", "", "S"}
PWHT_BACKLOG_STATUS = {
    "H", "HS", "SS", "T", "T1", "T1S", "T1-1", "T1-1S", "T1-2S",
    "T2", "T3", "T2-1", "T2-1S", "T2-2S", "T2S",
}
PWHT_BACKLOG_STATUS_PRALL = PWHT_BACKLOG_STATUS | {"T1-2", "HS CCC"}
RT_WELD_TYPES = ("BW", "GW", "CLET", "MW")

# Weld Dates the M query throws away (bad future dates in the source system)
DROP_WELD_DATES = {"30-DEC-2026"}

MONTHS = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}


def parse_date(v):
    """dd-MON-yyyy -> datetime.date, else None. The dump's only date format."""
    if not v or len(v) != 11:
        return None
    try:
        d = int(v[0:2])
        m = MONTHS.get(v[3:6].upper())
        y = int(v[7:11])
        if m is None:
            return None
        return dt.date(y, m, d)
    except ValueError:
        return None


def numf(v):
    if not v:
        return 0.0
    try:
        return float(v)
    except ValueError:
        return 0.0


def numi(v):
    if not v:
        return 0
    try:
        return int(float(v))
    except ValueError:
        return 0


# ------------------------------------------------------- record assembly ---
def iter_records(path, chunk_bytes=1 << 24):
    """Yield the header list, then every logical data record as a list of
    fields.  A record is complete only once it holds NF-1 ';' separators
    (same rule as analysis/dump/profile.py); this is what makes the 17
    embedded-CRLF rows and the 1,236 embedded-LF rows parse correctly."""
    with open(path, "r", encoding="utf-8", newline="") as fh:
        tail = ""
        header = None
        nf = None
        buf = None
        while True:
            chunk = fh.read(chunk_bytes)
            if not chunk:
                break
            data = tail + chunk
            pieces = data.split("\r\n")
            tail = pieces.pop()          # incomplete trailing piece
            for p in pieces:
                if header is None:
                    header = p.split(";")
                    nf = 223             # data width; header carries 226 names
                    yield header
                    continue
                buf = p if buf is None else buf + "\n" + p
                if buf.count(";") + 1 >= nf:
                    yield buf.split(";")
                    buf = None
        if tail:
            if header is None:
                header = tail.split(";")
                yield header
            else:
                buf = tail if buf is None else buf + "\n" + tail
                if buf.strip():
                    yield buf.split(";")


# ------------------------------------------------------------ aggregator ---
class Agg(object):
    """Distinct-count buckets (sets of interned joint ids) + plain sums."""

    def __init__(self):
        self.sets = collections.defaultdict(set)
        self.sums = collections.Counter()

    def add(self, key, joint):
        self.sets[key].add(joint)

    def inc(self, key, v):
        if v:
            self.sums[key] += v

    def n(self, key):
        return len(self.sets.get(key, ()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=DEFAULT_SRC)
    ap.add_argument("--asof", default=None,
                    help="date used for TODAY() in the aging buckets "
                         "(default: max Weld Date in the file)")
    args = ap.parse_args()

    t0 = time.time()
    src = args.src
    if not os.path.exists(src):
        sys.exit("source not found: %s" % src)

    it = iter_records(src)
    header = [h.strip() for h in next(it)]
    idx = {}
    for i, h in enumerate(header[:223]):
        idx.setdefault(h, i)

    def C(name):
        return idx[name]

    I_ISO = C("ISO Number")
    I_SPOOL = C("Spool No.")
    I_WELD = C("Weld No.")
    I_CAT = C("Weld Cat")
    I_TYPE = C("Weld Type")
    I_DIA = C("Dia inch")
    I_SVCCLASS = C("Service class")
    I_SVCCAT = C("Service Cat")
    I_WELDDATE = C("Weld Date")
    I_SUB = C("Sub-Contractor")
    I_WELDPT = C("WeldPoint No.")
    I_WPS = C("WPS No.")
    I_AREACL = C("Area Classification")
    I_REV = C("Revision Status")
    I_PWHTYN = C("PWHT Y/N")
    I_PWHTWS = C("PWHT Weld Status")
    I_PWHTREP = C("PWHT Report")
    I_RTPCT = C("RT%")
    I_RTWS = C("RT Weld Status")
    I_RTREP = C("RT Report")
    I_RTAR = C("RT Acc/Rej")
    I_FILMA = C("Total No of films Acc")
    I_FILMR = C("Total No of films Rej")
    I_WLEN = C("Weld Length")
    I_UTWS = C("UT Weld Status")
    I_UTREP = C("UT Report")
    I_UTAR = C("UT Acc/Rej")

    intern = sys.intern
    agg = Agg()
    n_records = 0
    n_after_m = 0
    dropped = collections.Counter()
    max_weld_date = None
    subcon_rows = collections.Counter()
    subcon_rows_raw = collections.Counter()
    rtpct_vocab = collections.Counter()

    for rec in it:
        n_records += 1
        if len(rec) < 223:
            dropped["short_record"] += 1
            continue

        subcon_rows_raw[rec[I_SUB].strip()] += 1

        # ---- Power Query `Weld Dump` filters --------------------------
        ac = rec[I_AREACL].strip()
        if ac == "" or ac == "0":
            dropped["area_class_0_or_blank"] += 1
            continue
        if rec[I_REV].strip() != "":
            dropped["revision_status_cancelled"] += 1
            continue
        sub = rec[I_SUB].strip()
        if sub == "":
            dropped["subcontractor_blank"] += 1
            continue
        wd_raw = rec[I_WELDDATE].strip().upper()
        if wd_raw == "NA":
            wd_raw = ""
        if wd_raw in DROP_WELD_DATES:
            dropped["weld_date_excluded_by_M"] += 1
            continue

        n_after_m += 1
        subcon_rows[sub] += 1

        wtype = rec[I_TYPE].strip()
        if wtype == "BW_":
            wtype = "BW"
        elif wtype == "SW_":
            wtype = "SW"

        joint = intern(rec[I_ISO] + "-" + rec[I_SPOOL] + "-" + rec[I_WELD])
        wcat = rec[I_CAT].strip()
        weld_no = rec[I_WELD].strip()
        rr = ""
        tail2 = weld_no[-2:].upper()
        if tail2 in ("R1", "R2"):
            rr = "Repair"
        elif tail2 == "RW":
            rr = "Reweld"

        wdate = parse_date(wd_raw)
        if wdate and (max_weld_date is None or wdate > max_weld_date):
            max_weld_date = wdate
        welded = wdate is not None

        rtpct = rec[I_RTPCT].strip()
        rtpct_vocab[rtpct] += 1
        rtws = rec[I_RTWS].strip()
        rtrep = rec[I_RTREP].strip()
        rtar = rec[I_RTAR].strip()
        pwhtyn = rec[I_PWHTYN].strip()
        pwhtws = rec[I_PWHTWS].strip()
        pwhtrep = rec[I_PWHTREP].strip()
        utws = rec[I_UTWS].strip()
        utrep = rec[I_UTREP].strip()
        utar = rec[I_UTAR].strip()
        weldpt = rec[I_WELDPT].strip()
        wps = rec[I_WPS].strip()
        svccat = rec[I_SVCCAT].strip()
        film_a = numi(rec[I_FILMA])
        film_r = numi(rec[I_FILMR])
        film_tot = film_a + film_r                 # M: "Added RT Film Total"
        wlen = numf(rec[I_WLEN])

        is_rt_type = wtype in RT_WELD_TYPES

        # GAC is split by Service Cat = SG (slug catcher) on the report pages
        scopes = [(sub, "ALL")]
        if sub == "GAC":
            scopes.append((sub, "SG" if svccat == "SG" else "NONSG"))

        for sc in scopes:
            # ---------- welding progress -------------------------------
            if welded and rr == "":
                agg.add(sc + ("joints_welded",), joint)
                agg.add(sc + ("joints_welded_cat", wcat), joint)
                agg.add(sc + ("joints_welded_type", wtype), joint)
                agg.add(sc + ("joints_welded_rtpct", rtpct), joint)
            if welded:
                agg.add(sc + ("joints_welded_incl_rr",), joint)

            # ---------- NDE: RT / UT joints ----------------------------
            # [Numb RT/UT]  = Weld Date>0, RT Report<>"", RT Acc/Rej<>"RS"
            tested = welded and rtrep != "" and rtar != "RS"
            if tested:
                agg.add(sc + ("rt_tested",), joint)
                agg.add(sc + ("rt_tested_cat", wcat), joint)
                agg.add(sc + ("rt_tested_rtpct", rtpct), joint)
                if is_rt_type:
                    agg.add(sc + ("rt_tested_rttypes",), joint)
                    agg.add(sc + ("rt_tested_rttypes_cat", wcat), joint)
            # [Numb RT/UT "R"] = RT Acc/Rej = "R"   (no other predicate!)
            if rtar == "R":
                agg.add(sc + ("rt_rej",), joint)
                agg.add(sc + ("rt_rej_cat", wcat), joint)
                agg.add(sc + ("rt_rej_rtpct", rtpct), joint)
                if is_rt_type:
                    agg.add(sc + ("rt_rej_rttypes",), joint)
                    agg.add(sc + ("rt_rej_rttypes_cat", wcat), joint)

            # ---------- films ------------------------------------------
            # [RT Total Films by Joint "EP"]: WeldPoint No.=1, Acc/Rej<>"RS"
            if weldpt == "1" and rtar != "RS":
                agg.inc(sc + ("films_by_joint",), film_tot)
                agg.inc(sc + ("films_by_joint_A",), film_a)
                agg.inc(sc + ("films_by_joint_cat_%s" % wcat,), film_tot)
                agg.inc(sc + ("films_by_joint_A_cat_%s" % wcat,), film_a)
            # [RT Total Films by Joint "R" "EP"]: WeldPoint No.=1 only
            if weldpt == "1":
                agg.inc(sc + ("films_by_joint_R",), film_r)
                agg.inc(sc + ("films_by_joint_R_cat_%s" % wcat,), film_r)
            # [RT Total Films] (no WeldPoint filter) - used by the WPS pages
            if rtar != "RS":
                agg.inc(sc + ("films_all",), film_tot)
                agg.inc(sc + ("films_all_A",), film_a)
            agg.inc(sc + ("films_all_R",), film_r)

            # ---------- UT ---------------------------------------------
            ut_done = utws == "NR" and utrep != ""
            if ut_done:
                agg.add(sc + ("ut_done",), joint)
                if utar == "A":
                    agg.add(sc + ("ut_acc",), joint)
                if utar == "R":
                    agg.add(sc + ("ut_rej",), joint)
            if weldpt == "1" and utrep != "":
                agg.inc(sc + ("ut_weld_len_m",), wlen)

            # ---------- RT backlog -------------------------------------
            branch_a = (is_rt_type and welded and rtrep == ""
                        and rtws in RT_BACKLOG_STATUS)
            branch_b = (is_rt_type and welded and rtpct == "100"
                        and rtrep == "" and rtws in RT_BACKLOG_STATUS_100)
            if branch_a or branch_b:
                agg.add(sc + ("rt_backlog",), joint)
                agg.add(sc + ("rt_backlog_cat", wcat), joint)
                agg.add(sc + ("rt_backlog_rtpct", rtpct), joint)
                # aging buckets — DATEDIFF(Weld Date, TODAY(), DAY)
                agg.add(sc + ("rt_backlog_aging", joint), wd_raw)
                # + PWHT combinations (measure names in the .md)
                if pwhtyn in ("Y", "25.01") and pwhtrep != "":
                    agg.add(sc + ("rt_backlog_pwht_y_done",), joint)
                if pwhtyn in ("N", "25.01") and pwhtws == "":
                    agg.add(sc + ("rt_backlog_pwht_n",), joint)
                if (pwhtyn in ("Y", "25.01") and pwhtws in ("H", "HS")
                        and pwhtrep == ""):
                    agg.add(sc + ("rt_backlog_pwht_y_notdone",), joint)
            # [RT 100% Backlog Joints Weld Status "EP"]
            if is_rt_type and rtpct == "100" and welded and rtrep == "":
                agg.add(sc + ("rt100_backlog",), joint)

            # ---------- PWHT -------------------------------------------
            pwht_backlog = pwhtws in PWHT_BACKLOG_STATUS and pwhtrep == ""
            if pwht_backlog:
                agg.add(sc + ("pwht_backlog_all_types",), joint)
                agg.add(sc + ("pwht_backlog_all_types_cat", wcat), joint)
                if is_rt_type:
                    agg.add(sc + ("pwht_backlog_rt_types",), joint)
                if rtpct == "100" and is_rt_type:
                    agg.add(sc + ("pwht_backlog_rt100",), joint)
                agg.add(sc + ("pwht_backlog_aging", joint), wd_raw)
            if pwhtrep != "":
                agg.add(sc + ("pwht_done",), joint)

        # ---------- WPS-level rejection table (GAC, non-SG) -------------
        if sub == "GAC" and svccat != "SG" and wtype != "DMY" and wps:
            if welded and rr == "":
                agg.add(("WPS", wps, "welded"), joint)
            if tested:
                agg.add(("WPS", wps, "tested"), joint)
            if rtar == "R":
                agg.add(("WPS", wps, "rej"), joint)
            if rtar != "RS":
                agg.inc(("WPS", wps, "films"), film_tot)
                agg.inc(("WPS", wps, "films_A"), film_a)
            agg.inc(("WPS", wps, "films_R"), film_r)

    asof = (dt.date.fromisoformat(args.asof) if args.asof
            else (max_weld_date or dt.date.today()))

    # ------------------------------------------------------ aging rollup ---
    def aging(prefix_scope, kind):
        """Bucket the backlog joints by DATEDIFF(Weld Date, asof, DAY)."""
        out = collections.Counter()
        key = prefix_scope + ("%s_aging" % kind,)
        for k, dates in agg.sets.items():
            if len(k) != 4 or k[0] != prefix_scope[0] or k[1] != prefix_scope[1]:
                continue
            if k[2] != "%s_aging" % kind:
                continue
            best = None
            for ds in dates:
                d = parse_date(ds)
                if d is None:
                    continue
                if best is None or d > best:
                    best = d
            if best is None:
                out["no_weld_date"] += 1
                continue
            n = (asof - best).days
            if n <= 3:
                out["within_3"] += 1
            elif n <= 7:
                out["3_to_7"] += 1
            elif n <= 15:
                out["7_to_15"] += 1
            elif n <= 30:
                out["15_to_30"] += 1
            else:
                out["above_30"] += 1
        return out

    # ---------------------------------------------------------- reporting --
    def div(a, b):
        return (a / b) if b else None

    results = {
        "generated": dt.datetime.now().isoformat(timespec="seconds"),
        "source": os.path.basename(src),
        "asof_used_for_TODAY": asof.isoformat(),
        "max_weld_date_in_file": max_weld_date.isoformat() if max_weld_date else None,
        "records_read": n_records,
        "records_after_powerquery_filters": n_after_m,
        "rows_dropped": dict(dropped),
        "rows_per_subcontractor_before_filters": dict(subcon_rows_raw),
        "rows_per_subcontractor_after_filters": dict(subcon_rows),
        "rt_pct_vocabulary": dict(rtpct_vocab),
        "scopes": {},
        "wps_gac_nonsg": {},
    }

    scope_list = [("GAC", "ALL"), ("GAC", "NONSG"), ("GAC", "SG"),
                  ("TEKFEN", "ALL"), ("MEDGULF", "ALL")]

    for sc in scope_list:
        name = "%s/%s" % sc
        rt_tested = agg.n(sc + ("rt_tested",))
        rt_rej = agg.n(sc + ("rt_rej",))
        rt_tested_t = agg.n(sc + ("rt_tested_rttypes",))
        rt_rej_t = agg.n(sc + ("rt_rej_rttypes",))
        films = agg.sums[sc + ("films_by_joint",)]
        films_a = agg.sums[sc + ("films_by_joint_A",)]
        films_r = agg.sums[sc + ("films_by_joint_R",)]
        ut_done = agg.n(sc + ("ut_done",))
        ut_rej = agg.n(sc + ("ut_rej",))
        d = {
            "joints_welded": agg.n(sc + ("joints_welded",)),
            "joints_welded_incl_repair_reweld": agg.n(sc + ("joints_welded_incl_rr",)),
            "joints_welded_by_weld_cat": {
                k[3]: len(v) for k, v in agg.sets.items()
                if len(k) == 4 and k[:3] == sc + ("joints_welded_cat",)},
            "joints_welded_by_weld_type": dict(sorted(
                ((k[3], len(v)) for k, v in agg.sets.items()
                 if len(k) == 4 and k[:3] == sc + ("joints_welded_type",)),
                key=lambda x: -x[1])),
            "rt_tested_joints": rt_tested,
            "rt_accepted_joints": rt_tested - rt_rej,
            "rt_rejected_joints": rt_rej,
            "rt_tested_joints_BW_GW_CLET_MW": rt_tested_t,
            "rt_accepted_joints_BW_GW_CLET_MW": rt_tested_t - rt_rej_t,
            "rt_rejected_joints_BW_GW_CLET_MW": rt_rej_t,
            "rt_joint_rejection_pct": div(rt_rej, rt_tested),
            "films_taken_by_joint": films,
            "films_accepted_by_joint": films - films_r,
            "films_rejected_by_joint": films_r,
            "film_rejection_pct": div(films_r, films),
            "films_taken_all_rows": agg.sums[sc + ("films_all",)],
            "films_rejected_all_rows": agg.sums[sc + ("films_all_R",)],
            "ut_done": ut_done,
            "ut_accepted": agg.n(sc + ("ut_acc",)),
            "ut_rejected": ut_rej,
            "ut_joint_rejection_pct": div(ut_rej, ut_done),
            "ut_weld_length_m": round(agg.sums[sc + ("ut_weld_len_m",)], 2),
            "rt_backlog_total": agg.n(sc + ("rt_backlog",)),
            "rt100_backlog": agg.n(sc + ("rt100_backlog",)),
            "rt_backlog_plus_pwht_Y_done": agg.n(sc + ("rt_backlog_pwht_y_done",)),
            "rt_backlog_plus_pwht_N": agg.n(sc + ("rt_backlog_pwht_n",)),
            "rt_backlog_and_pwht_Y_not_done": agg.n(sc + ("rt_backlog_pwht_y_notdone",)),
            "rt_backlog_aging": dict(aging(sc, "rt_backlog")),
            "pwht_backlog_all_types": agg.n(sc + ("pwht_backlog_all_types",)),
            "pwht_backlog_BW_GW_CLET_MW": agg.n(sc + ("pwht_backlog_rt_types",)),
            "pwht_backlog_by_RT100": agg.n(sc + ("pwht_backlog_rt100",)),
            "pwht_done": agg.n(sc + ("pwht_done",)),
            "pwht_backlog_aging": dict(aging(sc, "pwht_backlog")),
            "by_rt_pct": {},
        }
        for k, v in agg.sets.items():
            if len(k) == 4 and k[:3] == sc + ("joints_welded_rtpct",):
                d["by_rt_pct"].setdefault(k[3] or "(blank)", {})["joints_welded"] = len(v)
            if len(k) == 4 and k[:3] == sc + ("rt_tested_rtpct",):
                d["by_rt_pct"].setdefault(k[3] or "(blank)", {})["tested"] = len(v)
            if len(k) == 4 and k[:3] == sc + ("rt_rej_rtpct",):
                d["by_rt_pct"].setdefault(k[3] or "(blank)", {})["rejected"] = len(v)
            if len(k) == 4 and k[:3] == sc + ("rt_backlog_rtpct",):
                d["by_rt_pct"].setdefault(k[3] or "(blank)", {})["rt_backlog"] = len(v)
        for b in d["by_rt_pct"].values():
            b.setdefault("tested", 0)
            b.setdefault("rejected", 0)
            b.setdefault("rt_backlog", 0)
            b.setdefault("joints_welded", 0)
            b["accepted"] = b["tested"] - b["rejected"]
        results["scopes"][name] = d

    # WPS table (GAC, excluding slug catcher)
    wps_names = sorted({k[1] for k in agg.sets if k[0] == "WPS"} |
                       {k[1] for k in agg.sums if k[0] == "WPS"})
    for w in wps_names:
        tested = agg.n(("WPS", w, "tested"))
        rej = agg.n(("WPS", w, "rej"))
        films = agg.sums[("WPS", w, "films")]
        films_r = agg.sums[("WPS", w, "films_R")]
        welded = agg.n(("WPS", w, "welded"))
        results["wps_gac_nonsg"][w] = {
            "joints_welded": welded,
            "tested_joints": tested,
            "rt_ut_ratio_pct": div(tested, welded),
            "accepted": tested - rej,
            "rejected": rej,
            "rt_total_films": films,
            "rt_films_A": films - films_r,
            "rt_films_R": films_r,
            "rt_film_ratio_pct": div(films_r, films),
            "rejection_rate_joint": div(rej, tested),
        }

    results["runtime_seconds"] = round(time.time() - t0, 1)

    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=1, sort_keys=False)

    # --------------------------------------------------------- stdout ------
    P = print
    P("=" * 78)
    P("reconcile_check.py — %s" % results["generated"])
    P("=" * 78)
    P("source                         : %s" % src)
    P("logical data records read      : %d" % n_records)
    P("rows after Power Query filters : %d" % n_after_m)
    for k, v in sorted(dropped.items(), key=lambda x: -x[1]):
        P("  dropped %-30s : %d" % (k, v))
    P("rows per Sub-Con (raw)         : %s" %
      ", ".join("%s=%d" % kv for kv in sorted(subcon_rows_raw.items(),
                                              key=lambda x: -x[1])))
    P("rows per Sub-Contractor        : %s" %
      ", ".join("%s=%d" % kv for kv in sorted(subcon_rows.items(),
                                              key=lambda x: -x[1])))
    P("max Weld Date in file          : %s" % results["max_weld_date_in_file"])
    P("date used for TODAY()          : %s" % asof.isoformat())
    P("RT%% values seen                : %s" %
      ", ".join("%r=%d" % kv for kv in sorted(rtpct_vocab.items(),
                                              key=lambda x: -x[1])))
    P("")

    # --- mockup reference values (Week Ending 16-Jan-26), from
    #     analysis/mockups/welding-spec.md pages 4/8, 5/10, 6/11, 9
    MOCK = {
        "GAC/NONSG": dict(joints_welded=375152, rt_tested_joints=34895,
                          rt_accepted_joints=34342, rt_rejected_joints=553,
                          films_taken_by_joint=123887, films_rejected_by_joint=534,
                          film_rejection_pct=0.0043, ut_done=1447, ut_rejected=80,
                          ut_weld_length_m=3269.79, rt_backlog_total=177,
                          rt100_backlog=147, pwht_backlog_all_types=407,
                          pwht_backlog_BW_GW_CLET_MW=86),
        "GAC/SG": dict(joints_welded=1466, rt_tested_joints=933,
                       rt_accepted_joints=920, rt_rejected_joints=13,
                       films_taken_by_joint=9662, films_rejected_by_joint=2,
                       film_rejection_pct=0.0002, ut_done=187, ut_rejected=11,
                       ut_weld_length_m=672.50, rt_backlog_total=45,
                       rt100_backlog=45, pwht_backlog_all_types=47,
                       pwht_backlog_BW_GW_CLET_MW=47),
        "TEKFEN/ALL": dict(joints_welded=349667, rt_tested_joints=22918,
                           rt_accepted_joints=22292, rt_rejected_joints=626,
                           films_taken_by_joint=81851, films_rejected_by_joint=801,
                           film_rejection_pct=0.0098, ut_done=2433, ut_rejected=182,
                           ut_weld_length_m=3681.20, rt_backlog_total=17,
                           rt100_backlog=12, pwht_backlog_all_types=123,
                           pwht_backlog_BW_GW_CLET_MW=36),
        "MEDGULF/ALL": dict(joints_welded=69843, rt_tested_joints=5408,
                            rt_accepted_joints=5384, rt_rejected_joints=24,
                            films_taken_by_joint=16862, films_rejected_by_joint=32,
                            film_rejection_pct=0.0019, ut_done=0, ut_rejected=0,
                            ut_weld_length_m=0.0, rt_backlog_total=22,
                            rt100_backlog=22, pwht_backlog_all_types=54,
                            pwht_backlog_BW_GW_CLET_MW=36),
    }

    rows = ["joints_welded", "rt_tested_joints", "rt_accepted_joints",
            "rt_rejected_joints", "rt_joint_rejection_pct",
            "films_taken_by_joint", "films_rejected_by_joint",
            "film_rejection_pct", "ut_done", "ut_rejected",
            "ut_weld_length_m", "rt_backlog_total", "rt100_backlog",
            "rt_backlog_plus_pwht_Y_done", "rt_backlog_plus_pwht_N",
            "rt_backlog_and_pwht_Y_not_done",
            "pwht_backlog_all_types", "pwht_backlog_BW_GW_CLET_MW",
            "pwht_backlog_by_RT100", "pwht_done"]

    for name in ["GAC/ALL", "GAC/NONSG", "GAC/SG", "TEKFEN/ALL", "MEDGULF/ALL"]:
        d = results["scopes"][name]
        m = MOCK.get(name, {})
        P("-" * 78)
        P("%s   (dump 30-Aug-2026   vs   mockup 16-Jan-2026)" % name)
        P("-" * 78)
        P("  %-34s %14s %14s" % ("metric", "dump", "mockup 16-Jan"))
        for r in rows:
            v = d.get(r)
            mv = m.get(r, "")
            if isinstance(v, float):
                vs = "%.4f" % v if v < 1 else "%.2f" % v
            elif v is None:
                vs = "-"
            else:
                vs = "{:,}".format(v)
            if isinstance(mv, float):
                mvs = "%.4f" % mv if mv < 1 else "%.2f" % mv
            elif mv == "":
                mvs = "n/a"
            else:
                mvs = "{:,}".format(mv)
            P("  %-34s %14s %14s" % (r, vs, mvs))
        P("  rt_backlog aging (%s)  : %s" % (asof, d["rt_backlog_aging"]))
        P("  pwht_backlog aging (%s): %s" % (asof, d["pwht_backlog_aging"]))
        P("  by RT%%:")
        for k in sorted(d["by_rt_pct"], key=lambda x: (len(x), x)):
            b = d["by_rt_pct"][k]
            P("     RT%%=%-8s welded=%-9s tested=%-8s acc=%-8s rej=%-6s backlog=%s"
              % (k, "{:,}".format(b["joints_welded"]),
                 "{:,}".format(b["tested"]), "{:,}".format(b["accepted"]),
                 "{:,}".format(b["rejected"]), "{:,}".format(b["rt_backlog"])))
        P("")

    P("-" * 78)
    P("WPS-level rejection table — GAC excl. Slug Catcher (mockup page 42)")
    P("-" * 78)
    P("  %-24s %10s %8s %8s %7s %9s %8s %8s"
      % ("WPS No.", "welded", "tested", "acc", "rej", "films", "filmsR", "rej%jt"))
    tot = collections.Counter()
    for w, r in sorted(results["wps_gac_nonsg"].items(),
                       key=lambda x: -(x[1]["rejection_rate_joint"] or 0)):
        P("  %-24s %10s %8s %8s %7s %9s %8s %8s"
          % (w[:24], "{:,}".format(r["joints_welded"]),
             "{:,}".format(r["tested_joints"]), "{:,}".format(r["accepted"]),
             "{:,}".format(r["rejected"]), "{:,}".format(r["rt_total_films"]),
             "{:,}".format(r["rt_films_R"]),
             ("%.2f%%" % (100 * r["rejection_rate_joint"]))
             if r["rejection_rate_joint"] is not None else "-"))
        for k in ("joints_welded", "tested_joints", "accepted", "rejected",
                  "rt_total_films", "rt_films_R"):
            tot[k] += r[k]
    P("  %-24s %10s %8s %8s %7s %9s %8s %8s"
      % ("TOTAL (sum of rows)", "{:,}".format(tot["joints_welded"]),
         "{:,}".format(tot["tested_joints"]), "{:,}".format(tot["accepted"]),
         "{:,}".format(tot["rejected"]), "{:,}".format(tot["rt_total_films"]),
         "{:,}".format(tot["rt_films_R"]),
         "%.2f%%" % (100 * tot["rejected"] / tot["tested_joints"])
         if tot["tested_joints"] else "-"))
    P("  mockup page 42 total     371,613   34,908   34,357     551   171,021"
      "      548    1.58%")
    P("")
    P("NOTE: no CCC rows exist in this dump — every CCC page of the mockup is")
    P("      unreproducible from sources/ until the Talisman exports arrive.")
    P("")
    P("results written to %s   (%.1fs)" % (OUT_JSON, results["runtime_seconds"]))


if __name__ == "__main__":
    main()
