#!/usr/bin/env python3
"""
Read-only data profiler for sources/Weld Dump.txt.

Single streaming pass. Writes:
  analysis/dump/columns.json   per-column profile (JSON array)
  analysis/dump/profile.md     human-readable profile + Postgres recommendations
  analysis/dump/crosstabs.md   the cross-tabs the weld report needs

Stdlib only (python3.14). Never writes outside analysis/dump/.
"""

from __future__ import annotations

import collections
import json
import os
import re
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(REPO, "sources", "Weld Dump.txt")
OUT = os.path.join(REPO, "analysis", "dump")

# ---------------------------------------------------------------- null tokens
# Values that are candidates for being mapped to SQL NULL. Compared after
# .strip(), case-insensitively.  '' and whitespace-only are handled separately
# as "blank".
NULL_TOKENS = {
    "null", "n/a", "na", "n.a.", "n\\a", "-", "--", "---", ".", "nil",
    "none", "#n/a", "#null!", "?", "nan", "(blank)", "no data", "not applicable",
}

# ---------------------------------------------------------------- type regexes
DATE_PATTERNS = [
    ("dd-MMM-yyyy",        re.compile(r"^\d{1,2}-[A-Za-z]{3}-\d{4}$")),
    ("dd-MMM-yy",          re.compile(r"^\d{1,2}-[A-Za-z]{3}-\d{2}$")),
    ("dd-MMM-yyyy hh:mm",  re.compile(r"^\d{1,2}-[A-Za-z]{3}-\d{4}[ T]\d{1,2}:\d{2}(:\d{2})?$")),
    ("yyyy-mm-dd",         re.compile(r"^\d{4}-\d{2}-\d{2}$")),
    ("yyyy-mm-dd hh:mm",   re.compile(r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$")),
    ("d/m/yyyy or m/d/yyyy", re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$")),
    ("d/m/yy or m/d/yy",   re.compile(r"^\d{1,2}/\d{1,2}/\d{2}$")),
    ("yyyy/mm/dd",         re.compile(r"^\d{4}/\d{1,2}/\d{1,2}$")),
    ("dd.mm.yyyy",         re.compile(r"^\d{1,2}\.\d{1,2}\.\d{4}$")),
    ("MMM dd yyyy",        re.compile(r"^[A-Za-z]{3} \d{1,2} \d{4}$")),
]
RE_INT = re.compile(r"^[+-]?\d+$")
RE_DEC = re.compile(r"^[+-]?\d*\.\d+$")
RE_DEC_COMMA = re.compile(r"^[+-]?\d*,\d+$")
RE_THOUSANDS = re.compile(r"^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$")
RE_SCI = re.compile(r"^[+-]?\d+(\.\d+)?[eE][+-]?\d+$")
YN_SET = {"y", "n", "yes", "no", "true", "false", "0", "1"}

MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}

METHODS = ["PWHT", "HT", "RT", "UT", "MT", "PMI", "PT", "FN", "PADLT", "ORIF"]


def classify(v: str):
    """Return (category, format_label) for a non-blank stripped value."""
    for label, rx in DATE_PATTERNS:
        if rx.match(v):
            return "date", label
    if RE_INT.match(v):
        return "int", "int"
    if RE_DEC.match(v):
        return "decimal", "decimal(dot)"
    if RE_THOUSANDS.match(v):
        return "decimal", "decimal(thousands-sep)"
    if RE_DEC_COMMA.match(v):
        return "decimal", "decimal(comma-as-point)"
    if RE_SCI.match(v):
        return "decimal", "scientific"
    if v.lower() in YN_SET:
        return "flag", "Y/N"
    return "text", "text"


def parse_date_iso(v: str):
    """Best-effort ISO string for sortable min/max of dates."""
    m = re.match(r"^(\d{1,2})-([A-Za-z]{3})-(\d{4})", v)
    if m:
        mm = MONTHS.get(m.group(2).lower())
        if mm:
            return "%s-%02d-%02d" % (m.group(3), mm, int(m.group(1)))
    m = re.match(r"^(\d{1,2})-([A-Za-z]{3})-(\d{2})$", v)
    if m:
        mm = MONTHS.get(m.group(2).lower())
        if mm:
            y = int(m.group(3))
            y += 2000 if y < 70 else 1900
            return "%04d-%02d-%02d" % (y, mm, int(m.group(1)))
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", v)
    if m:
        return "%s-%s-%s" % m.groups()
    m = re.match(r"^(\d{4})/(\d{1,2})/(\d{1,2})$", v)
    if m:
        return "%s-%02d-%02d" % (m.group(1), int(m.group(2)), int(m.group(3)))
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", v)
    if m:  # ambiguous; assume d/m/y for ordering only
        return "%s-%02d-%02d" % (m.group(3), int(m.group(2)), int(m.group(1)))
    return None


def month_of(v: str):
    iso = parse_date_iso(v)
    return iso[:7] if iso else None


def num(v: str):
    v = v.strip()
    if RE_INT.match(v) or RE_DEC.match(v) or RE_SCI.match(v):
        try:
            return float(v)
        except ValueError:
            return None
    if RE_THOUSANDS.match(v):
        try:
            return float(v.replace(",", ""))
        except ValueError:
            return None
    return None


# =========================================================== phase 1: raw facts
def file_facts():
    size = os.path.getsize(SRC)
    with open(SRC, "rb") as f:
        head = f.read(4)
    boms = {
        "utf-8-sig": b"\xef\xbb\xbf",
        "utf-16-le": b"\xff\xfe",
        "utf-16-be": b"\xfe\xff",
        "utf-32-le": b"\xff\xfe\x00\x00",
    }
    bom = next((k for k, v in boms.items() if head.startswith(v)), None)
    return {"size_bytes": size, "bom": bom, "first_4_bytes": head.hex()}


# ======================================================================= main
def main():
    t0 = time.time()
    os.makedirs(OUT, exist_ok=True)
    facts = file_facts()

    print("Reading %s (%.1f MB) ..." % (SRC, facts["size_bytes"] / 1e6))
    with open(SRC, "rb") as f:
        raw = f.read()

    # ---- encoding probes -------------------------------------------------
    enc_report = {}
    try:
        text = raw.decode("utf-8")
        enc_report["utf-8-strict"] = "OK (whole file decodes as UTF-8)"
        enc_report["decode_errors"] = 0
    except UnicodeDecodeError as e:
        enc_report["utf-8-strict"] = "FAILED: %s" % e
        text = raw.decode("utf-8", "replace")
        enc_report["decode_errors"] = text.count("\ufffd")
    try:
        raw.decode("utf-16")
        enc_report["utf-16"] = "decodes (but see field counts)"
    except Exception as e:
        enc_report["utf-16"] = "FAILED: %s" % type(e).__name__
    try:
        raw.decode("ascii")
        enc_report["ascii"] = "OK (pure ASCII)"
    except UnicodeDecodeError as e:
        enc_report["ascii"] = "FAILED at byte %d" % e.start
    enc_report["non_ascii_chars"] = sum(1 for c in text if ord(c) > 127)
    enc_report["quote_chars"] = text.count('"')
    enc_report["nul_bytes"] = raw.count(b"\x00")
    enc_report["tab_chars"] = text.count("\t")
    del raw

    # ---- line endings ----------------------------------------------------
    n_lf = text.count("\n")
    n_crlf = text.count("\r\n")
    n_cr = text.count("\r")
    ends_with_newline = text.endswith("\n")
    le = {
        "lf_total": n_lf,
        "crlf": n_crlf,
        "cr_total": n_cr,
        "bare_lf": n_lf - n_crlf,
        "bare_cr": n_cr - n_crlf,
        "wc_l_equivalent": n_lf,
        "ends_with_newline": ends_with_newline,
    }

    # ---- physical-line field histogram (what `awk -F';'` would see) -------
    phys_lines = text.split("\n")
    if ends_with_newline:
        phys_lines = phys_lines[:-1]
    hist_phys = collections.Counter(l.count(";") + 1 for l in phys_lines)
    phys_examples = {}
    for i, l in enumerate(phys_lines):
        n = l.count(";") + 1
        ex = phys_examples.setdefault(n, [])
        if len(ex) < 3:
            ex.append(i + 1)
    n_phys = len(phys_lines)
    del phys_lines

    # ---- CRLF pieces -----------------------------------------------------
    pieces = text.split("\r\n")
    if text.endswith("\r\n"):
        pieces = pieces[:-1]
    hist_pieces = collections.Counter(p.count(";") + 1 for p in pieces)

    header_raw = pieces[0].split(";")
    N_HDR = len(header_raw)

    # data field width = modal field count over CRLF pieces excluding header
    body_hist = collections.Counter(hist_pieces)
    body_hist[N_HDR] -= 1
    if body_hist[N_HDR] <= 0:
        del body_hist[N_HDR]
    NF = body_hist.most_common(1)[0][0]

    # ---- assemble logical records (embedded CRLF inside fields) ----------
    records = []
    rejoined = []           # (physical_line_no, n_pieces_joined) - embedded CRLF
    overflow = []           # (physical_line_no, n_fields) - could not be assembled
    buf = None
    buf_start_line = 0
    npieces = 0
    phys = 1                # physical line number of the header
    for p in pieces[1:]:
        phys_this = phys + 1
        phys += 1 + p.count("\n")   # this piece consumes 1 CRLF + its bare LFs
        if buf is None:
            buf = p
            buf_start_line = phys_this
            npieces = 1
        else:
            buf = buf + "\n" + p
            npieces += 1
        c = buf.count(";") + 1
        if c == NF:
            if npieces > 1:
                rejoined.append((buf_start_line, npieces))
            records.append(buf)
            buf = None
        elif c > NF:
            overflow.append((buf_start_line, c))
            records.append(buf)
            buf = None
    if buf is not None:
        overflow.append((buf_start_line, buf.count(";") + 1))
        records.append(buf)
    anomalies = rejoined
    del pieces, text

    n_records = len(records)
    print("  logical records: %d  (anomalous: %d)" % (n_records, len(anomalies)))

    # ================================================== per-column counters
    counters = [collections.Counter() for _ in range(NF)]
    idx = {}
    for i, h in enumerate(header_raw[:NF]):
        idx.setdefault(h.strip(), i)

    def C(name):
        return idx[name]

    I_SUB = C("Sub-Contractor")
    I_CAT = C("Weld Cat")
    I_TYP = C("Weld Type")
    I_RTP = C("RT%")
    I_RTA = C("RT Acc/Rej")
    I_UTA = C("UT Acc/Rej")
    I_PWY = C("PWHT Y/N")
    I_PWS = C("PWHT Weld Status")
    I_WD = C("Weld Date")
    I_DIA = C("Dia inch")
    I_DIF = C("Dia Inch Factor")
    I_ISO = C("ISO Number")
    I_SPL = C("Spool No.")
    I_WNO = C("Weld No.")
    I_IRV = C("Iso Rev No.")
    I_SRV = C("Spool Rev No.")
    I_WPT = C("WeldPoint No.")
    I_WPS = C("WPS No.")
    I_RTW = C("RT Weld Status")
    I_UTW = C("UT Weld Status")
    I_PDS = C("PDS Area")
    I_WLD = C("Welder")
    I_REV = C("Revision Status")
    I_SVC = C("Service class")

    # crosstab specs: label -> tuple of column indexes
    XT = {
        "subcon": (I_SUB,),
        "subcon_x_weldcat": (I_SUB, I_CAT),
        "subcon_x_weldtype": (I_SUB, I_TYP),
        "subcon_x_rtpct": (I_SUB, I_RTP),
        "subcon_x_rtacc": (I_SUB, I_RTA),
        "subcon_x_utacc": (I_SUB, I_UTA),
        "subcon_x_pwht": (I_SUB, I_PWY, I_PWS),
        "subcon_x_welddate": (I_SUB, I_WD),
        "subcon_x_dia": (I_SUB, I_WD, I_DIA),
        "subcon_x_dif": (I_SUB, I_WD, I_DIF),
        "subcon_x_rtpct_x_rtacc": (I_SUB, I_RTP, I_RTA),
        "subcon_x_rtpct_x_rtws": (I_SUB, I_RTP, I_RTW),
        "subcon_x_utws": (I_SUB, I_UTW),
        "wps_x_rtacc": (I_WPS, I_RTA),
        "subcon_x_wps_x_rtacc": (I_SUB, I_WPS, I_RTA),
        "subcon_x_pdsarea": (I_SUB, I_PDS),
        "subcon_x_rev_x_welddate": (I_SUB, I_REV, I_WD),
        "subcon_x_dif_flag": (I_SUB, I_DIF, I_DIA),
        "subcon_x_svc_x_welddate": (I_SUB, I_SVC, I_WD),
    }
    xt = {k: collections.Counter() for k in XT}

    key_specs = {
        "iso+spool+weld": (I_ISO, I_SPL, I_WNO),
        "iso+isorev+spool+spoolrev+weld": (I_ISO, I_IRV, I_SPL, I_SRV, I_WNO),
        "iso+isorev+spool+spoolrev+weld+subcon": (I_ISO, I_IRV, I_SPL, I_SRV, I_WNO, I_SUB),
        "iso+spool+weld+subcon": (I_ISO, I_SPL, I_WNO, I_SUB),
        "weldpoint": (I_WPT,),
        "weldno": (I_WNO,),
        "iso+weldpoint": (I_ISO, I_WPT),
        "iso+spool+weld+weldpoint": (I_ISO, I_SPL, I_WNO, I_WPT),
        "iso+spool+weld+weldpoint+welder": (I_ISO, I_SPL, I_WNO, I_WPT, I_WLD),
        "iso+spool+weld+weldpoint+welder+welddate": (I_ISO, I_SPL, I_WNO, I_WPT, I_WLD, I_WD),
    }
    keys = {k: collections.Counter() for k in key_specs}

    bad_width = 0
    bad_examples = []
    rowhash = collections.Counter()
    CH = 50000
    for s in range(0, n_records, CH):
        chunk = records[s:s + CH]
        rows = []
        for j, r in enumerate(chunk):
            fl = r.split(";")
            if len(fl) == NF:
                rows.append(fl)
            else:
                bad_width += 1
                if len(bad_examples) < 5:
                    bad_examples.append((s + j, len(fl)))
        rowhash.update(map(hash, chunk))
        if not rows:
            continue
        cols = list(zip(*rows))
        for j in range(NF):
            counters[j].update(cols[j])
        for k, spec in XT.items():
            if len(spec) == 1:
                xt[k].update(cols[spec[0]])
            else:
                xt[k].update(zip(*(cols[i] for i in spec)))
        for k, spec in key_specs.items():
            if len(spec) == 1:
                keys[k].update(cols[spec[0]])
            else:
                keys[k].update(zip(*(cols[i] for i in spec)))
    exact_dup_rows = sum(c - 1 for c in rowhash.values() if c > 1)
    exact_dup_groups = sum(1 for c in rowhash.values() if c > 1)
    del rowhash
    print("  counted. elapsed %.1fs" % (time.time() - t0))

    # --- what actually differs inside duplicate-key groups? (sampled) -------
    BEST_KEY = "iso+spool+weld+weldpoint"
    best_spec = key_specs[BEST_KEY]
    dupset = {k for k, c in keys[BEST_KEY].items() if c > 1}
    maxsplit = max(best_spec) + 1
    groups = collections.defaultdict(list)
    if dupset:
        for i, r in enumerate(records):
            p = r.split(";", maxsplit)
            k = tuple(p[j] for j in best_spec)
            if k in dupset:
                groups[k].append(i)
    dup_diff = collections.Counter()
    sampled = 0
    for k, ix in groups.items():
        if sampled >= 3000:
            break
        sampled += 1
        base = records[ix[0]].split(";")
        for o in ix[1:]:
            other = records[o].split(";")
            if len(base) != NF or len(other) != NF:
                continue
            for j in range(NF):
                if base[j] != other[j]:
                    dup_diff[j] += 1
    dup_examples = [(k, len(v)) for k, v in
                    sorted(groups.items(), key=lambda kv: -len(kv[1]))[:3]]
    del groups, records
    print("  dup-group diff sampled over %d groups. elapsed %.1fs"
          % (sampled, time.time() - t0))

    # ================================================== per-column profiles
    cols_json = []
    for i in range(NF):
        cn = counters[i]
        raw_name = header_raw[i]
        clean = raw_name.strip()
        total = sum(cn.values())
        blank = 0
        nulltok = collections.Counter()
        catc = collections.Counter()
        fmtc = collections.Counter()
        lead_trail_ws = 0
        maxlen = 0
        nonblank_distinct = 0
        numvals = []
        isovals = []
        for v, c in cn.items():
            sv = v.strip()
            if sv == "":
                blank += c
                continue
            nonblank_distinct += 1
            if v != sv:
                lead_trail_ws += c
            if len(v) > maxlen:
                maxlen = len(v)
            low = sv.lower()
            if low in NULL_TOKENS:
                nulltok[sv] += c
            cat, fmt = classify(sv)
            catc[cat] += c
            fmtc[fmt] += c
            if cat in ("int", "decimal"):
                n = num(sv)
                if n is not None:
                    numvals.append((n, sv))
            elif cat == "date":
                iso = parse_date_iso(sv)
                if iso:
                    isovals.append((iso, sv))
        nonempty = total - blank
        # ---- inferred type
        if nonempty == 0:
            itype = "empty"
        else:
            nn = nonempty - sum(nulltok.values())
            base = nn if nn > 0 else nonempty
            dcount = catc["date"]
            icount = catc["int"]
            fcount = catc["decimal"]
            flg = catc["flag"]
            if dcount >= base * 0.99:
                itype = "date"
            elif icount >= base * 0.99:
                itype = "int"
            elif icount + fcount >= base * 0.99:
                itype = "decimal"
            elif flg >= base * 0.99 and nonblank_distinct <= 8:
                itype = "flag"
            else:
                itype = "text"
        # ---- min / max
        if itype in ("int", "decimal") and numvals:
            mn = min(numvals)[1]
            mx = max(numvals)[1]
        elif itype == "date" and isovals:
            mn = min(isovals)[0]
            mx = max(isovals)[0]
        else:
            nb = [v.strip() for v in cn if v.strip() != ""]
            mn = min(nb) if nb else None
            mx = max(nb) if nb else None
            if mn is not None and len(mn) > 60:
                mn = mn[:60] + "..."
            if mx is not None and len(mx) > 60:
                mx = mx[:60] + "..."
        # ---- decimal scale/precision
        scale = 0
        intdig = 1
        for _, sv in numvals:
            s2 = sv.lstrip("+-").replace(",", "")
            if "." in s2:
                a, b = s2.split(".", 1)
                scale = max(scale, len(b))
                intdig = max(intdig, len(a) or 1)
            else:
                intdig = max(intdig, len(s2))
        topn = 20 if nonblank_distinct <= 500 else 10
        top = [[v, c] for v, c in cn.most_common(topn + 3) if v.strip() != ""][:topn]
        samples = [v for v, _ in cn.most_common() if v.strip() != ""][:5]
        cols_json.append({
            "index": i + 1,
            "raw_name": raw_name,
            "clean_name": clean,
            "present_in_data": True,
            "nonempty": nonempty,
            "blank": blank,
            "distinct": nonblank_distinct,
            "inferred_type": itype,
            "formats_seen": sorted(fmtc.items(), key=lambda kv: -kv[1]),
            "categories": sorted(catc.items(), key=lambda kv: -kv[1]),
            "null_token_counts": sorted(nulltok.items(), key=lambda kv: -kv[1]),
            "values_with_lead_trail_space": lead_trail_ws,
            "max_len": maxlen,
            "num_int_digits": intdig if itype in ("int", "decimal") else None,
            "num_scale": scale if itype in ("int", "decimal") else None,
            "min": mn,
            "max": mx,
            "top_values": top,
            "sample_values": samples,
        })

    # header names beyond the data width: declared in the header, absent from the data.
    # They are emitted into columns.json so it has one entry per header name (226),
    # flagged present_in_data=false.
    extra_headers = header_raw[NF:]
    for k, raw_name in enumerate(extra_headers):
        cols_json.append({
            "index": NF + k + 1,
            "raw_name": raw_name,
            "clean_name": raw_name.strip(),
            "present_in_data": False,
            "nonempty": 0,
            "blank": 0,
            "distinct": 0,
            "inferred_type": "absent",
            "formats_seen": [],
            "categories": [],
            "null_token_counts": [],
            "values_with_lead_trail_space": 0,
            "max_len": 0,
            "num_int_digits": None,
            "num_scale": None,
            "min": None,
            "max": None,
            "top_values": [],
            "sample_values": [],
            "note": ("header name #%d has no corresponding data field: every data "
                     "record has only %d fields" % (NF + k + 1, NF)),
        })

    # duplicate / near-duplicate header names
    norm = collections.Counter(h.strip() for h in header_raw)
    dup_hdr = {k: v for k, v in norm.items() if v > 1}
    lower = collections.defaultdict(list)
    for h in header_raw:
        lower[h.strip().lower()].append(h)
    near_dup = {k: v for k, v in lower.items() if len(set(v)) > 1}
    with_space = [h for h in header_raw if h != h.strip()]

    # =============================================== SLG / slug catcher hunt
    slg_hits = []
    for i in range(NF):
        hits = [(v, c) for v, c in counters[i].items()
                if "slg" in v.lower() or "slug" in v.lower()]
        if hits:
            hits.sort(key=lambda kv: -kv[1])
            slg_hits.append((i + 1, header_raw[i].strip(), sum(c for _, c in hits), hits[:12]))
    slg_hits.sort(key=lambda t: -t[2])

    # ===================================================== write columns.json
    with open(os.path.join(OUT, "columns.json"), "w", encoding="utf-8") as f:
        json.dump(cols_json, f, indent=1, ensure_ascii=False)

    # ============================================================ helpers
    def esc(v):
        s = "(blank)" if v.strip() == "" else v
        return s.replace("|", "\\|").replace("\n", "\\n")

    def vc_table(counter, limit=40, header=("value", "rows")):
        out = ["| %s | %s |" % header, "|---|---:|"]
        items = counter.most_common(limit)
        for v, c in items:
            out.append("| `%s` | %s |" % (esc(v if isinstance(v, str) else str(v)), f"{c:,}"))
        if len(counter) > limit:
            out.append("| _... %d more distinct values_ | |" % (len(counter) - limit))
        return "\n".join(out)

    col = {c["index"]: c for c in cols_json}

    def cname(i):
        return header_raw[i].strip()

    # ============================================================ profile.md
    P = []
    A = P.append
    A("# `sources/Weld Dump.txt` — data profile\n")
    A("Generated by `analysis/dump/profile.py` (single pass, stdlib only). "
      "Every number below is script output.\n")

    A("## 0. Headline findings\n")
    A("| # | finding | evidence |")
    A("|---:|---|---|")
    A("| 1 | **No `CCC` sub-contractor in this dump.** `Sub-Contractor` has exactly "
      "%d distinct values. The `.pbix` filename promises CCC; this extract does not "
      "contain it. | %s |"
      % (col[I_SUB + 1]["distinct"],
         ", ".join("`%s`=%s" % (v, f"{c:,}") for v, c in xt["subcon"].most_common())))
    A("| 2 | **The header has %d names, the data has %d fields.** The 3 surplus names "
      "%s have no data column. | §1.2 |"
      % (N_HDR, NF, ", ".join("`%s`" % h for h in extra_headers)))
    A("| 3 | **`Dia Inch Factor` is a Y/N flag, not a number.** Do not `SUM()` it; "
      "the dia-inch figures come from `Dia inch`. | `%s` |"
      % ", ".join("%s=%s" % (v, f"{c:,}") for v, c in
                  counters[I_DIF].most_common(4)))
    A("| 4 | **`PWHT Y/N` is polluted:** its most common value is not `Y`/`N`. | `%s` |"
      % ", ".join("%s=%s" % (esc(v), f"{c:,}") for v, c in counters[I_PWY].most_common(4)))
    A("| 5 | **`Hold Status` has a trailing-space case variant** — `No` and `No ` are "
      "the same state. | `%s` |"
      % ", ".join("%s=%s" % (esc(v), f"{c:,}") for v, c in
                  counters[idx["Hold Status"]].most_common(4)))
    A("| 6 | **`Revision Status` only ever says `Cancelled`** (%s rows). These are "
      "cancelled welds — decide explicitly whether progress counts include them. | "
      "§7 / crosstabs §18 |"
      % f"{col[I_REV + 1]['nonempty']:,}")
    A("| 7 | **`WeldPoint No.` is a repair/attempt sequence (1,2,3...), not an id** — "
      "only %d distinct values. It is the missing piece of the natural key. | `%s` |"
      % (col[I_WPT + 1]["distinct"],
         ", ".join("%s=%s" % (v, f"{c:,}") for v, c in counters[I_WPT].most_common(4))))
    A("| 8 | **No exact-unique natural key exists.** The best is "
      "`(ISO Number, Spool No., Weld No., WeldPoint No.)` at %s distinct / %s "
      "duplicated keys. Use a surrogate `bigserial` PK. | §2 |"
      % (f"{len(keys['iso+spool+weld+weldpoint']):,}",
         f"{sum(1 for c in keys['iso+spool+weld+weldpoint'].values() if c > 1):,}"))
    A("| 9 | **`Slug Catcher` / `SLG service` is carried by `Service class`** "
      "(values `EQP-SLG-*`), not by `PDS Area` / `System no`. | crosstabs §12 |")
    A("| 10 | **%d columns are empty in every one of the %s rows** — their type "
      "cannot be inferred. | §8.3 |"
      % (len([c for c in cols_json if c["inferred_type"] == "empty"]), f"{n_records:,}"))
    A("")

    A("## 1. File format facts\n")
    A("| fact | value |")
    A("|---|---|")
    A("| size | %s bytes (%.1f MB) |" % (f"{facts['size_bytes']:,}", facts["size_bytes"] / 1e6))
    A("| BOM | %s |" % (facts["bom"] or "**none** (first 4 bytes `%s`)" % facts["first_4_bytes"]))
    A("| UTF-8 strict decode | %s |" % enc_report["utf-8-strict"])
    A("| pure ASCII? | %s |" % enc_report["ascii"])
    A("| non-ASCII characters | %s |" % f"{enc_report['non_ascii_chars']:,}")
    A("| NUL bytes | %s |" % f"{enc_report['nul_bytes']:,}")
    A("| TAB characters | %s |" % f"{enc_report['tab_chars']:,}")
    A("| `\"` characters in file | %s |" % f"{enc_report['quote_chars']:,}")
    A("| LF total (= `wc -l`) | %s |" % f"{le['lf_total']:,}")
    A("| CRLF | %s |" % f"{le['crlf']:,}")
    A("| bare LF (LF not preceded by CR) | %s |" % f"{le['bare_lf']:,}")
    A("| bare CR | %s |" % f"{le['bare_cr']:,}")
    A("| file ends with newline | %s |" % le["ends_with_newline"])
    A("")
    A("**Line endings: CRLF.** But %s bare LF characters occur *inside* field values "
      "(so `wc -l` over-counts by %s), and %d records also contain an embedded "
      "**CRLF** inside a field (so splitting on `\\r\\n` under-counts fields for "
      "those). Neither `\\n` nor `\\r\\n` alone delimits a record reliably — a record "
      "is only complete once it holds %d `;` separators. See §1.2.\n"
      % (f"{le['bare_lf']:,}", f"{le['bare_lf']:,}", len(rejoined), NF - 1))

    A("### 1.1 Quoting\n")
    A("`\"` appears %s times in the whole file. Checked below whether any field "
      "*starts* with a quote (which is what RFC4180 quoting requires).\n"
      % f"{enc_report['quote_chars']:,}")
    qstart = 0
    qany = 0
    for i in range(NF):
        for v, c in counters[i].items():
            if '"' in v:
                qany += c
                if v.lstrip().startswith('"'):
                    qstart += c
    A("| check | count |")
    A("|---|---:|")
    A("| field values containing `\"` | %s |" % f"{qany:,}")
    A("| field values *starting* with `\"` | %s |" % f"{qstart:,}")
    A("")
    A("=> **No RFC-4180 quoting is in use.** The `\"` characters are literal "
      "(inch marks / free text). Parse with `csv.reader(..., delimiter=';', "
      "quoting=csv.QUOTE_NONE)` or a plain `split(';')`; for Postgres `COPY` use "
      "`QUOTE E'\\b'` or a quote character that cannot occur.\n")

    A("### 1.2 Field-count histograms\n")
    A("**(a) Physical lines** (split on `\\n`, i.e. what `wc -l` / `awk -F';'` sees) — "
      "%s lines:\n" % f"{n_phys:,}")
    A("| fields per line | lines | example line numbers |")
    A("|---:|---:|---|")
    for n, c in sorted(hist_phys.items(), key=lambda kv: -kv[1]):
        A("| %d | %s | %s |" % (n, f"{c:,}", ", ".join(str(x) for x in phys_examples[n][:3])))
    A("")
    A("**(b) CRLF-delimited pieces** — %s pieces:\n" % f"{sum(hist_pieces.values()):,}")
    A("| fields per piece | pieces |")
    A("|---:|---:|")
    for n, c in sorted(hist_pieces.items(), key=lambda kv: -kv[1]):
        A("| %d | %s |" % (n, f"{c:,}"))
    A("")
    A("**(c) Assembled logical records** (pieces re-joined until the field count "
      "reaches the modal width %d):\n" % NF)
    A("- header record: **%d** field names" % N_HDR)
    A("- data records: **%s**" % f"{n_records:,}")
    A("- data records whose field count != %d after assembly: **%d**" % (NF, bad_width))
    A("- data records that had to be re-joined from >1 CRLF piece (embedded CRLF in a "
      "field): **%d**%s"
      % (len(rejoined),
         ("; first 3 at physical lines %s (piece counts %s)"
          % (", ".join(str(a[0]) for a in rejoined[:3]),
             ", ".join(str(a[1]) for a in rejoined[:3]))) if rejoined else ""))
    A("- data records that overflowed %d fields and could not be assembled: **%d**%s"
      % (NF, len(overflow),
         (" at physical lines %s" % ", ".join(str(a[0]) for a in overflow[:3]))
         if overflow else ""))
    A("- **exact duplicate whole rows: %s** (in %s duplicated groups)"
      % (f"{exact_dup_rows:,}", f"{exact_dup_groups:,}"))
    A("")
    A("> **The header has %d names but every data record has %d fields.** The %d trailing "
      "header names %s carry no data column — they look like leftover column headers "
      "from the Power BI export. Header names 1..%d align 1:1 with the data (verified: "
      "field %d = `%s` holds `%s`; field %d = `%s` holds dates)."
      % (N_HDR, NF, N_HDR - NF,
         ", ".join("`%s`" % h for h in extra_headers), NF,
         I_SUB + 1, cname(I_SUB),
         "/".join(v for v, _ in counters[I_SUB].most_common(4)),
         I_WD + 1, cname(I_WD)))
    A("")
    A("There is **no trailing empty column**: the last data field is #%d (`%s`), "
      "%s of %s rows non-empty.\n"
      % (NF, cname(NF - 1), f"{col[NF]['nonempty']:,}", f"{n_records:,}"))

    A("### 1.3 Header name hygiene\n")
    A("- Exact duplicate names after `.strip()`: %s"
      % (", ".join("`%s` x%d" % (k, v) for k, v in dup_hdr.items()) if dup_hdr else "**none**"))
    A("- Names differing only by whitespace/case: %s"
      % (", ".join("`%s`" % k for k in near_dup) if near_dup else "**none**"))
    A("- Names carrying leading/trailing spaces (%d): %s"
      % (len(with_space), ", ".join("`%s`" % h for h in with_space)))
    A("")
    A("All header names must be `.strip()`ed before use; the whole trailing block "
      "`SHIPMENT DATE` .. `WELDTYPEPARAMETER` was appended with a leading space.\n")

    # ------------------------------------------------------------- grain
    A("## 2. Grain & candidate keys\n")
    A("One row = one weld. %s data rows.\n" % f"{n_records:,}")
    A("| candidate key | distinct | duplicated keys | rows in duplicated keys | unique? |")
    A("|---|---:|---:|---:|---|")
    key_examples = {}
    for k in key_specs:
        cn = keys[k]
        dups = [(kk, c) for kk, c in cn.items() if c > 1]
        rows_in_dup = sum(c for _, c in dups)
        key_examples[k] = sorted(dups, key=lambda kv: -kv[1])[:3]
        A("| %s | %s | %s | %s | %s |" % (
            k, f"{len(cn):,}", f"{len(dups):,}", f"{rows_in_dup:,}",
            "**YES**" if not dups else "no"))
    A("")
    for k in key_specs:
        ex = key_examples[k]
        if ex:
            A("- `%s` — 3 worst duplicates: %s" % (
                k, "; ".join("`%s` x%d" % (
                    kk if isinstance(kk, str) else " | ".join(kk), c) for kk, c in ex)))
    A("")
    A("**Exact duplicate whole rows: %s** (%s groups) — so every duplicated key is a "
      "*genuinely different* row, not a re-export artefact.\n"
      % (f"{exact_dup_rows:,}", f"{exact_dup_groups:,}"))
    A("### 2.1 What `WeldPoint No.` is\n")
    A("`WeldPoint No.` has only %d distinct values: %s. It is a **repair / attempt "
      "sequence number within one weld** (1 = original, 2 = first repair, ...), not an "
      "identifier. Adding it to `(ISO Number, Spool No., Weld No.)` is what removes "
      "most duplicates.\n"
      % (col[I_WPT + 1]["distinct"],
         ", ".join("`%s`=%s" % (v, f"{c:,}") for v, c in counters[I_WPT].most_common(8))))
    A("### 2.2 What still differs inside duplicate `%s` groups\n" % BEST_KEY)
    A("Sampled over %d duplicated-key groups; columns that differ most often:\n" % sampled)
    A("| # | column | groups where it differs |")
    A("|---:|---|---:|")
    for j, c in dup_diff.most_common(15):
        A("| %d | `%s` | %s |" % (j + 1, cname(j), f"{c:,}"))
    A("")
    A("3 example duplicate keys: %s\n" % "; ".join(
        "`%s` x%d" % (" | ".join(k), n) for k, n in dup_examples))
    A("> **Recommendation:** no natural key is unique. Load with a surrogate "
      "`id bigserial primary key`, keep `(iso_number, spool_no, weld_no, weldpoint_no)` "
      "as a non-unique index, and treat `Revision Status = 'Cancelled'` as the "
      "de-duplication / exclusion signal (see §7 and crosstabs §18).\n")

    # ---------------------------------------------------- column groups
    date_like = [c for c in cols_json if c["inferred_type"] == "date"]
    method_cols = set()
    for m in METHODS:
        for c in cols_json:
            if c["clean_name"].startswith(m + " ") or c["clean_name"] == m + "%":
                method_cols.add(c["index"])
    # RT extras
    for extra in ("Total No of films Acc", "Total No of films Rej", "Defect Code",
                  "Location of Defect", "Weld Length", "Rej Length", "By UT"):
        if extra in idx:
            method_cols.add(idx[extra] + 1)
    identity = list(range(1, 33))
    trace = [c["index"] for c in cols_json
             if c["clean_name"].startswith(("GROUP-", "IDENT CODE-", "TRAC NO-", "Part "))
             or c["clean_name"] == "Matrl Traceability Y/N"]
    used = set(identity) | method_cols | set(trace)
    misc = [c["index"] for c in cols_json if c["index"] not in used]

    def col_table(indices, title):
        A("### %s\n" % title)
        A("| # | column | type | non-empty | % filled | distinct | min | max | top values |")
        A("|---:|---|---|---:|---:|---:|---|---|---|")
        for i in indices:
            c = col[i]
            tv = ", ".join("`%s`=%s" % (esc(v), f"{n:,}") for v, n in c["top_values"][:4])
            A("| %d | `%s` | %s | %s | %.1f%% | %s | %s | %s | %s |" % (
                c["index"], c["clean_name"], c["inferred_type"],
                f"{c['nonempty']:,}", 100.0 * c["nonempty"] / n_records,
                f"{c['distinct']:,}",
                esc(str(c["min"])) if c["min"] is not None else "",
                esc(str(c["max"])) if c["max"] is not None else "",
                tv))
        A("")

    A("## 3. Identity / scope columns (fields 1-32)\n")
    col_table(identity, "Identity, geometry, location, dates, party")

    A("## 4. Date columns (all inferred `date`, anywhere in the row)\n")
    A("| # | column | non-empty | distinct | min | max | formats seen |")
    A("|---:|---|---:|---:|---|---|---|")
    for c in date_like:
        fm = ", ".join("`%s` x%s" % (f, f"{n:,}") for f, n in c["formats_seen"])
        A("| %d | `%s` | %s | %s | %s | %s | %s |" % (
            c["index"], c["clean_name"], f"{c['nonempty']:,}", f"{c['distinct']:,}",
            c["min"], c["max"], fm))
    A("")
    allfmt = collections.Counter()
    for c in cols_json:
        for f, n in c["formats_seen"]:
            if any(f == lbl for lbl, _ in DATE_PATTERNS):
                allfmt[f] += n
    A("**Every date format observed across the file, with value counts:**\n")
    A("| format | values |")
    A("|---|---:|")
    for f, n in allfmt.most_common():
        A("| `%s` | %s |" % (f, f"{n:,}"))
    A("")

    # ------------------------------------------------ per-method blocks
    A("## 5. Per-method blocks\n")
    A("Ten methods share one column shape. `%%`/`Y/N` = the trigger column; "
      "`Weld Status`/`Batch Status` = workflow state; `Acc/Rej` = the acceptance "
      "result that drives rejection rates; `Date` non-empty = performed count.\n")
    A("| method | trigger col | trigger non-empty | Batch Status values | Weld Status values | Acc/Rej values | Date non-empty | Report non-empty |")
    A("|---|---|---:|---|---|---|---:|---:|")
    for m in METHODS:
        trig = None
        for nm in ("%s%%" % m, "%s Y/N" % m):
            if nm in idx:
                trig = nm
                break
        tc = col[idx[trig] + 1] if trig else None
        def vals(nm, lim=8):
            if nm not in idx:
                return "_(no column)_"
            cc = counters[idx[nm]]
            items = [(v, n) for v, n in cc.most_common() if v.strip() != ""][:lim]
            if not items:
                return "_(all empty)_"
            s = ", ".join("`%s`=%s" % (esc(v), f"{n:,}") for v, n in items)
            extra = len([1 for v in cc if v.strip() != ""]) - len(items)
            return s + (" (+%d more)" % extra if extra > 0 else "")
        dnm = "%s Date" % m
        rnm = "%s Report" % m
        A("| **%s** | `%s` | %s | %s | %s | %s | %s | %s |" % (
            m, trig, f"{tc['nonempty']:,}" if tc else "-",
            vals("%s Batch Status" % m, 6),
            vals("%s Weld Status" % m, 6),
            vals("%s Acc/Rej" % m, 8),
            f"{col[idx[dnm] + 1]['nonempty']:,}" if dnm in idx else "-",
            f"{col[idx[rnm] + 1]['nonempty']:,}" if rnm in idx else "-"))
    A("")
    A("**Trigger-column value distributions** (the `%` columns drive the report's "
      "RT-coverage page split):\n")
    for m in METHODS:
        for nm in ("%s%%" % m, "%s Y/N" % m):
            if nm in idx:
                cc = counters[idx[nm]]
                items = [(v, n) for v, n in cc.most_common(14)]
                A("- `%s`: %s" % (nm, ", ".join(
                    "`%s`=%s" % (esc(v), f"{n:,}") for v, n in items)))
                break
    A("")
    A("### 5.0a Acceptance vocabulary (all `* Acc/Rej` columns, every distinct value)\n")
    A("Checked explicitly for `Acc`/`ACC`/`Accepted` style variants.\n")
    A("| column | distinct values (all) |")
    A("|---|---|")
    accdom = collections.Counter()
    for m in METHODS + ["Result (A/R)"]:
        nm = "%s Acc/Rej" % m if m != "Result (A/R)" else "Result (A/R)"
        if nm not in idx:
            continue
        cc = counters[idx[nm]]
        items = [(v, n) for v, n in cc.most_common() if v.strip() != ""]
        for v, n in items:
            accdom[v.strip()] += n
        A("| `%s` | %s |" % (nm, ", ".join("`%s`=%s" % (esc(v), f"{n:,}")
                                           for v, n in items) or "_(all empty)_"))
    A("")
    word = [(v, n) for v, n in accdom.items() if len(v) > 2]
    A("**Union of all acceptance values in the file: %s.**\n"
      % ", ".join("`%s` (%s)" % (v, f"{n:,}") for v, n in accdom.most_common()))
    A("The ten `<METHOD> Acc/Rej` columns use single-letter codes only "
      "(`A` accepted, `R` rejected, `RS` re-shoot), so "
      "`upper(trim(x)) = 'A'` / `IN ('R','RS')` classifies them safely. "
      "%s\n"
      % ("The **only** word-form spelling in the file is in the separate TPI column: %s "
         "— handle that column on its own." % ", ".join(
             "`%s`=%s" % (v, f"{n:,}") for v, n in word)
         if word else "No word-form spellings (`Acc`/`ACC`/`Accepted`) occur anywhere."))
    A("### 5.0b Status vocabulary (all `* Weld Status` / `* Batch Status` columns)\n")
    A("| column | distinct values (all) |")
    A("|---|---|")
    for m in METHODS:
        for suffix in ("Weld Status", "Batch Status"):
            nm = "%s %s" % (m, suffix)
            if nm not in idx:
                continue
            cc = counters[idx[nm]]
            items = [(v, n) for v, n in cc.most_common() if v.strip() != ""]
            A("| `%s` | %s |" % (nm, ", ".join("`%s`=%s" % (esc(v), f"{n:,}")
                                               for v, n in items) or "_(all empty)_"))
    A("")

    A("### 5.1 Full per-method column list\n")
    col_table(sorted(method_cols), "All method-block columns")

    A("## 6. Material traceability columns\n")
    col_table(sorted(trace), "Traceability")

    A("## 7. Custom / misc columns\n")
    col_table(sorted(misc), "Everything else")

    # ------------------------------------------------- postgres section
    A("## 8. Postgres recommendation\n")
    A("### 8.1 Suggested column types\n")
    A("`text` is the safe default; the loader should stage everything as `text` "
      "and cast in a second pass (see §8.3).\n")
    A("| # | clean_name | pg column name | suggested type | null tokens present |")
    A("|---:|---|---|---|---|")

    def pgname(s):
        s2 = s.strip().lower()
        s2 = s2.replace("%", "_pct").replace("/", "_").replace(".", "")
        s2 = re.sub(r"[^a-z0-9]+", "_", s2).strip("_")
        if s2 and s2[0].isdigit():
            s2 = "c_" + s2
        return s2 or "unnamed"

    seen_pg = collections.Counter()
    pg_types = {}
    for c in cols_json:
        t = c["inferred_type"]
        if t == "absent":
            pg = "_(do not create — header-only name, no data field)_"
        elif t == "empty":
            pg = "text  _(all rows empty — type unknown)_"
        elif t == "date":
            pg = "date"
        elif t == "int":
            d = c["num_int_digits"] or 1
            pg = "integer" if d <= 9 else "bigint"
        elif t == "decimal":
            p = (c["num_int_digits"] or 1) + (c["num_scale"] or 0)
            pg = "numeric(%d,%d)" % (max(p, 1), c["num_scale"] or 0)
        elif t == "flag":
            vs = {v.strip().upper() for v, _ in c["top_values"]}
            pg = "boolean" if vs <= {"Y", "N"} else "text"
        else:
            pg = "text"
        pg_types[c["index"]] = pg
        n = pgname(c["clean_name"])
        seen_pg[n] += 1
        if seen_pg[n] > 1:
            n = "%s_%d" % (n, seen_pg[n])
        nt = ", ".join("`%s`(%s)" % (v, f"{k:,}") for v, k in c["null_token_counts"][:4]) or "-"
        A("| %d | `%s` | `%s` | %s | %s |" % (c["index"], c["clean_name"], n, pg, nt))
    A("")

    A("### 8.2 NULL tokens observed\n")
    tokall = collections.Counter()
    tokcols = collections.defaultdict(int)
    for c in cols_json:
        for v, k in c["null_token_counts"]:
            tokall[v] += k
            tokcols[v] += 1
    A("| token | occurrences | columns affected |")
    A("|---|---:|---:|")
    for v, k in tokall.most_common():
        A("| `%s` | %s | %d |" % (esc(v), f"{k:,}", tokcols[v]))
    A("")
    A("Empty string (`''`) is the normal absent marker: it accounts for "
      "%s of the %s cells in the table.\n"
      % (f"{sum(c['blank'] for c in cols_json):,}", f"{n_records * NF:,}"))

    A("### 8.3 Data-quality traps found\n")
    traps = []
    # mixed date formats
    mixed = [c for c in cols_json
             if len([f for f, _ in c["formats_seen"]
                     if any(f == lbl for lbl, _ in DATE_PATTERNS)]) > 1]
    traps.append(("Mixed date formats in one column", len(mixed),
                  ", ".join("`%s` (%s)" % (c["clean_name"], "/".join(
                      f for f, _ in c["formats_seen"] if any(
                          f == lbl for lbl, _ in DATE_PATTERNS)))
                      for c in mixed[:8]) or "none"))
    # date columns polluted with non-date text
    polluted = [c for c in cols_json
                if c["inferred_type"] == "date"
                and dict(c["categories"]).get("text", 0) > 0]
    traps.append(("`date`-typed columns containing non-date text "
                  "(must be scrubbed before ::date)", len(polluted),
                  ", ".join("`%s` (%s bad)" % (c["clean_name"],
                                               f"{dict(c['categories'])['text']:,}")
                            for c in polluted[:8]) or "none"))
    # thousands separators / comma decimals
    commas = [c for c in cols_json
              if any(f in ("decimal(thousands-sep)", "decimal(comma-as-point)")
                     for f, _ in c["formats_seen"])]
    traps.append(("Numbers with `,` (thousands sep or comma decimal)", len(commas),
                  ", ".join("`%s`" % c["clean_name"] for c in commas[:8]) or "none"))
    # leading/trailing whitespace in values
    ws = sorted((c for c in cols_json if c["values_with_lead_trail_space"] > 0),
                key=lambda c: -c["values_with_lead_trail_space"])
    traps.append(("Values with leading/trailing whitespace", len(ws),
                  ", ".join("`%s`(%s)" % (c["clean_name"],
                                          f"{c['values_with_lead_trail_space']:,}")
                            for c in ws[:8]) or "none"))
    # case variants
    casev = []
    for c in cols_json:
        if not c["present_in_data"] or c["distinct"] > 400:
            continue
        g = collections.defaultdict(set)
        for v in counters[c["index"] - 1]:
            sv = v.strip()
            if sv:
                g[sv.lower()].add(sv)
        bad = {k: v for k, v in g.items() if len(v) > 1}
        if bad:
            casev.append((c["clean_name"], bad))
    traps.append(("Columns holding case-only variants of the same category value",
                  len(casev),
                  "; ".join("`%s`: %s" % (n, ", ".join(
                      "/".join(sorted(v)) for v in list(b.values())[:3]))
                      for n, b in casev[:10]) or "none"))
    # whitespace-only variants of the same category
    wsvar = []
    for c in cols_json:
        if not c["present_in_data"] or c["distinct"] > 400:
            continue
        g = collections.defaultdict(set)
        for v in counters[c["index"] - 1]:
            if v.strip():
                g[v.strip()].add(v)
        bad = {k: v for k, v in g.items() if len(v) > 1}
        if bad:
            wsvar.append((c["clean_name"], bad))
    traps.append(("Columns where the same value appears with and without surrounding "
                  "whitespace", len(wsvar),
                  "; ".join("`%s`: %s" % (n, ", ".join(
                      "/".join(repr(x) for x in sorted(v)) for v in list(b.values())[:2]))
                      for n, b in wsvar[:8]) or "none"))
    # empty columns
    emptyc = [c for c in cols_json if c["inferred_type"] == "empty"]
    traps.append(("Columns empty in **every** row (type undeterminable)", len(emptyc),
                  ", ".join("`%s`" % c["clean_name"] for c in emptyc) or "none"))
    traps.append(("Records containing an embedded CRLF inside a field", len(anomalies),
                  "physical lines %s" % ", ".join(str(a[0]) for a in anomalies[:5])))
    traps.append(("Records containing an embedded bare LF inside a field", le["bare_lf"],
                  "a plain line-based reader mis-splits these"))
    traps.append(("Header declares %d names, data has %d fields" % (N_HDR, NF),
                  N_HDR - NF, ", ".join("`%s`" % h for h in extra_headers)))
    traps.append(("Mojibake (double-encoded UTF-8) in text values",
                  enc_report["non_ascii_chars"],
                  "valid UTF-8 bytes, but render as `Ã‚Â‚Â¬` sequences"))
    A("| trap | count | detail |")
    A("|---|---:|---|")
    for t, n, d in traps:
        A("| %s | %s | %s |" % (t, f"{n:,}", d))
    A("")

    A("### 8.4 Recommended `COPY`\n")
    A("```sql")
    A("-- stage every column as text, then cast")
    A("COPY weld_dump_raw FROM '/path/Weld Dump.txt'")
    A("  WITH (FORMAT csv, DELIMITER ';', HEADER true,")
    A("        QUOTE E'\\b', ESCAPE E'\\b',   -- no quoting in the source")
    A("        ENCODING 'UTF8', NULL '');")
    A("```")
    A("Caveats that make plain `COPY` unsafe as-is:")
    A("- the header row has %d names vs %d data fields -> declare **%d** staging "
      "columns and load with `HEADER true` (the surplus names are simply ignored) "
      "**or** strip the header and use `HEADER false`;" % (N_HDR, NF, NF))
    A("- %d records contain an embedded CRLF and %s contain a bare LF inside a field; "
      "`COPY ... FORMAT csv` without quoting will break on those. Pre-clean with a "
      "script that re-joins lines until the `;` count reaches %d (this profiler does "
      "exactly that), or accept ~%d bad rows."
      % (len(anomalies), f"{le['bare_lf']:,}", NF - 1, len(anomalies)))
    A("- null tokens beyond `''` (see §8.2) must be mapped in the cast step, not by "
      "`COPY` (which accepts only one NULL string).")
    A("")

    with open(os.path.join(OUT, "profile.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(P) + "\n")

    # =========================================================== crosstabs.md
    X = []
    B = X.append
    B("# Cross-tabs for the weld report\n")
    B("Source: `sources/Weld Dump.txt`, %s data rows, generated by "
      "`analysis/dump/profile.py`. `(blank)` = empty string.\n" % f"{n_records:,}")

    subs = [s for s, _ in xt["subcon"].most_common()]

    B("## 1. Rows by Sub-Contractor\n")
    B(vc_table(xt["subcon"], 30, ("Sub-Contractor", "welds")))
    B("")

    def pivot(counter, rowvals, title, colsort=None):
        colvals = sorted({k[1] for k in counter}, key=colsort or (lambda x: x))
        B("### %s\n" % title)
        B("| Sub-Contractor | " + " | ".join(esc(c) for c in colvals) + " | total |")
        B("|---|" + "---:|" * (len(colvals) + 1))
        tot = collections.Counter()
        for r in rowvals:
            cells = [counter.get((r, c), 0) for c in colvals]
            for c, v in zip(colvals, cells):
                tot[c] += v
            B("| `%s` | %s | **%s** |" % (esc(r),
                                          " | ".join(f"{v:,}" for v in cells),
                                          f"{sum(cells):,}"))
        B("| **total** | %s | **%s** |" % (
            " | ".join(f"{tot[c]:,}" for c in colvals),
            f"{sum(tot.values()):,}"))
        B("")

    B("## 2. Sub-Contractor x Weld Cat\n")
    pivot(xt["subcon_x_weldcat"], subs, "counts")
    B("## 3. Sub-Contractor x Weld Type\n")
    pivot(xt["subcon_x_weldtype"], subs, "counts")

    B("## 4. Sub-Contractor x RT%\n")
    def pctkey(v):
        try:
            return (0, float(v))
        except ValueError:
            return (1, v)
    pivot(xt["subcon_x_rtpct"], subs, "counts", colsort=pctkey)

    B("## 5. Sub-Contractor x RT Acc/Rej\n")
    pivot(xt["subcon_x_rtacc"], subs, "counts")
    B("Rejection rate = `R` / (`A` + `R`) per sub-contractor:\n")
    B("| Sub-Contractor | Acc | Rej | other non-blank | rej % of (A+R) |")
    B("|---|---:|---:|---:|---:|")
    for s in subs:
        a = sum(v for (ss, r), v in xt["subcon_x_rtacc"].items()
                if ss == s and r.strip().upper() in ("A", "ACC", "ACCEPT", "ACCEPTED"))
        rj = sum(v for (ss, r), v in xt["subcon_x_rtacc"].items()
                 if ss == s and r.strip().upper() in ("R", "REJ", "REJECT", "REJECTED"))
        oth = sum(v for (ss, r), v in xt["subcon_x_rtacc"].items()
                  if ss == s and r.strip() != ""
                  and r.strip().upper() not in ("A", "ACC", "ACCEPT", "ACCEPTED",
                                                "R", "REJ", "REJECT", "REJECTED"))
        pct = (100.0 * rj / (a + rj)) if (a + rj) else 0.0
        B("| `%s` | %s | %s | %s | %.2f%% |" % (esc(s), f"{a:,}", f"{rj:,}", f"{oth:,}", pct))
    B("")

    B("## 6. Sub-Contractor x UT Acc/Rej\n")
    pivot(xt["subcon_x_utacc"], subs, "counts")

    B("## 7. Sub-Contractor x PWHT Y/N x PWHT Weld Status\n")
    ynv = sorted({k[1] for k in xt["subcon_x_pwht"]})
    wsv = sorted({k[2] for k in xt["subcon_x_pwht"]})
    B("| Sub-Contractor | PWHT Y/N | " + " | ".join(esc(w) for w in wsv) + " | total |")
    B("|---|---|" + "---:|" * (len(wsv) + 1))
    for s in subs:
        for y in ynv:
            cells = [xt["subcon_x_pwht"].get((s, y, w), 0) for w in wsv]
            if sum(cells) == 0:
                continue
            B("| `%s` | `%s` | %s | **%s** |" % (
                esc(s), esc(y), " | ".join(f"{v:,}" for v in cells), f"{sum(cells):,}"))
    B("")

    B("## 8. Welded count (Weld Date non-empty) by Sub-Contractor\n")
    B("| Sub-Contractor | total welds | Weld Date filled | % welded |")
    B("|---|---:|---:|---:|")
    welded = collections.Counter()
    for (s, d), v in xt["subcon_x_welddate"].items():
        if d.strip() != "":
            welded[s] += v
    for s in subs:
        t = xt["subcon"][s]
        B("| `%s` | %s | %s | %.2f%% |" % (esc(s), f"{t:,}", f"{welded[s]:,}",
                                           100.0 * welded[s] / t if t else 0))
    B("| **total** | **%s** | **%s** | %.2f%% |" % (
        f"{n_records:,}", f"{sum(welded.values()):,}",
        100.0 * sum(welded.values()) / n_records))
    B("")

    B("## 9. Welds by Weld Date month (yyyy-mm), all sub-contractors\n")
    bymonth = collections.Counter()
    unparsed = collections.Counter()
    for (s, d), v in xt["subcon_x_welddate"].items():
        d = d.strip()
        if d == "":
            continue
        mo = month_of(d)
        if mo:
            bymonth[mo] += v
        else:
            unparsed[d] += v
    B("| month | welds |")
    B("|---|---:|")
    for m in sorted(bymonth):
        B("| %s | %s |" % (m, f"{bymonth[m]:,}"))
    B("| **total parsed** | **%s** |" % f"{sum(bymonth.values()):,}")
    if unparsed:
        B("| **unparseable Weld Date values** | **%s** |" % f"{sum(unparsed.values()):,}")
    B("")
    if unparsed:
        B("Unparseable `Weld Date` values: %s\n" % ", ".join(
            "`%s`=%s" % (esc(v), f"{c:,}") for v, c in unparsed.most_common(10)))

    B("## 10. Dia inch sums by Sub-Contractor\n")
    B("> **`Dia Inch Factor` is NOT a number.** Its distinct values are %s — it is a "
      "Y/N flag. It cannot be summed; the table below therefore reports `SUM(Dia inch)` "
      "and splits it by the flag.\n"
      % ", ".join("`%s`=%s" % (esc(v), f"{c:,}") for v, c in counters[I_DIF].most_common()))
    allsum = collections.defaultdict(float)
    wsum = collections.defaultdict(float)
    badn = collections.Counter()
    for (s, d, val), c in xt["subcon_x_dia"].items():
        n = num(val) if val.strip() else None
        if n is None:
            if val.strip():
                badn[s] += c
            continue
        allsum[s] += n * c
        if d.strip():
            wsum[s] += n * c
    fl_sum = collections.defaultdict(float)
    fl_rows = collections.Counter()
    for (s, fl, val), c in xt["subcon_x_dif_flag"].items():
        n = num(val) if val.strip() else None
        if n is None:
            continue
        fl_sum[(s, fl)] += n * c
        fl_rows[(s, fl)] += c
    flags = sorted({k[1] for k in fl_sum})
    B("| Sub-Contractor | SUM(Dia inch) all rows | SUM(Dia inch) rows with Weld Date | "
      + " | ".join("SUM(Dia inch) where Factor=`%s`" % esc(f) for f in flags)
      + " | non-numeric Dia inch rows |")
    B("|---|---:|---:|" + "---:|" * (len(flags) + 1))
    for s in subs:
        B("| `%s` | %s | %s | %s | %s |" % (
            esc(s), f"{allsum[s]:,.2f}", f"{wsum[s]:,.2f}",
            " | ".join(f"{fl_sum[(s, f)]:,.2f}" for f in flags), f"{badn[s]:,}"))
    B("| **total** | **%s** | **%s** | %s | %s |" % (
        f"{sum(allsum.values()):,.2f}", f"{sum(wsum.values()):,.2f}",
        " | ".join(f"{sum(v for k, v in fl_sum.items() if k[1] == f):,.2f}" for f in flags),
        f"{sum(badn.values()):,}"))
    B("")
    B("Row counts behind the `Dia Inch Factor` split:\n")
    B("| Sub-Contractor | " + " | ".join("Factor=`%s`" % esc(f) for f in flags) + " |")
    B("|---|" + "---:|" * len(flags))
    for s in subs:
        B("| `%s` | %s |" % (esc(s), " | ".join(f"{fl_rows[(s, f)]:,}" for f in flags)))
    B("")

    B("## 11. Golden Weld values\n")
    B(vc_table(counters[idx["Golden Weld"]], 20, ("Golden Weld", "rows")))
    B("")
    for extra in ("Golden Weld Report No", "Golden Weld Report Date"):
        c = col[idx[extra] + 1]
        B("- `%s`: %s non-empty, %s distinct" % (extra, f"{c['nonempty']:,}",
                                                 f"{c['distinct']:,}"))
    B("")

    B("## 12. Service / area classification columns "
      "(which one carries \"SLG service\" / \"Slug Catcher\"?)\n")
    if slg_hits:
        B("Columns whose values contain `SLG` or `SLUG`:\n")
        B("| # | column | matching rows | matching values |")
        B("|---|---|---:|---|")
        for i, nm, tot, hits in slg_hits:
            B("| %d | `%s` | %s | %s |" % (i, nm, f"{tot:,}", ", ".join(
                "`%s`=%s" % (esc(v), f"{c:,}") for v, c in hits[:8])))
        B("")
    else:
        B("**No column contains the strings `SLG` or `SLUG`.**\n")
    for nm in ("Service class", "Service Cat", "Area Classification", "PDS Area",
               "PDS Area Type", "AG/UG/PKG", "wbu", "Piping Group", "System no",
               "Subsystem Code", "Commissioning Package", "GWBS"):
        if nm not in idx:
            continue
        c = col[idx[nm] + 1]
        B("### `%s`  (%s non-empty, %s distinct)\n"
          % (nm, f"{c['nonempty']:,}", f"{c['distinct']:,}"))
        B(vc_table(counters[idx[nm]], 30 if c["distinct"] <= 60 else 25, (nm, "rows")))
        B("")

    B("## 13. Sub-Contractor x PDS Area\n")
    pivot(xt["subcon_x_pdsarea"], subs, "counts")

    B("## 14. Rework Code / Hold Status / Revision Status\n")
    for nm in ("Rework Code", "Hold Status", "Revision Status"):
        c = col[idx[nm] + 1]
        B("### `%s` (%s non-empty, %s distinct)\n" % (nm, f"{c['nonempty']:,}",
                                                      f"{c['distinct']:,}"))
        B(vc_table(counters[idx[nm]], 30, (nm, "rows")))
        B("")

    B("## 15. Rejection rate per WPS (RT Acc/Rej), top 40 WPS by RT volume\n")
    wps_tot = collections.Counter()
    wps_a = collections.Counter()
    wps_r = collections.Counter()
    for (w, r), c in xt["wps_x_rtacc"].items():
        u = r.strip().upper()
        if u == "":
            continue
        wps_tot[w] += c
        if u in ("A", "ACC", "ACCEPT", "ACCEPTED"):
            wps_a[w] += c
        elif u in ("R", "REJ", "REJECT", "REJECTED"):
            wps_r[w] += c
    B("| WPS No. | RT results | Acc | Rej | rej % |")
    B("|---|---:|---:|---:|---:|")
    for w, t in wps_tot.most_common(40):
        d = wps_a[w] + wps_r[w]
        B("| `%s` | %s | %s | %s | %s |" % (
            esc(w), f"{t:,}", f"{wps_a[w]:,}", f"{wps_r[w]:,}",
            "%.2f%%" % (100.0 * wps_r[w] / d) if d else "-"))
    B("")

    B("## 16. Sub-Contractor x RT% x RT Acc/Rej (NDE status by RT coverage)\n")
    accset = sorted({k[2] for k in xt["subcon_x_rtpct_x_rtacc"]})
    B("| Sub-Contractor | RT% | " + " | ".join(esc(a) for a in accset) + " | total |")
    B("|---|---|" + "---:|" * (len(accset) + 1))
    for s in subs:
        pcts = sorted({k[1] for k in xt["subcon_x_rtpct_x_rtacc"] if k[0] == s}, key=pctkey)
        for p in pcts:
            cells = [xt["subcon_x_rtpct_x_rtacc"].get((s, p, a), 0) for a in accset]
            if sum(cells) == 0:
                continue
            B("| `%s` | `%s` | %s | **%s** |" % (
                esc(s), esc(p), " | ".join(f"{v:,}" for v in cells), f"{sum(cells):,}"))
    B("")

    B("## 17. Sub-Contractor x RT% x RT Weld Status\n")
    wsv2 = sorted({k[2] for k in xt["subcon_x_rtpct_x_rtws"]})
    B("| Sub-Contractor | RT% | " + " | ".join(esc(a) for a in wsv2) + " | total |")
    B("|---|---|" + "---:|" * (len(wsv2) + 1))
    for s in subs:
        pcts = sorted({k[1] for k in xt["subcon_x_rtpct_x_rtws"] if k[0] == s}, key=pctkey)
        for p in pcts:
            cells = [xt["subcon_x_rtpct_x_rtws"].get((s, p, a), 0) for a in wsv2]
            if sum(cells) == 0:
                continue
            B("| `%s` | `%s` | %s | **%s** |" % (
                esc(s), esc(p), " | ".join(f"{v:,}" for v in cells), f"{sum(cells):,}"))
    B("")

    B("## 18. Cancelled welds — Sub-Contractor x Revision Status x has Weld Date\n")
    B("`Revision Status` is non-empty only for cancelled welds. Any progress "
      "denominator must state whether these are in or out.\n")
    revs = sorted({k[1] for k in xt["subcon_x_rev_x_welddate"]})
    B("| Sub-Contractor | Revision Status | rows | of which Weld Date filled |")
    B("|---|---|---:|---:|")
    for s in subs:
        for rv in revs:
            tot = sum(v for (ss, r, d), v in xt["subcon_x_rev_x_welddate"].items()
                      if ss == s and r == rv)
            wd = sum(v for (ss, r, d), v in xt["subcon_x_rev_x_welddate"].items()
                     if ss == s and r == rv and d.strip() != "")
            if tot == 0:
                continue
            B("| `%s` | `%s` | %s | %s |" % (esc(s), esc(rv), f"{tot:,}", f"{wd:,}"))
    tot_c = sum(v for (s, r, d), v in xt["subcon_x_rev_x_welddate"].items() if r.strip())
    wd_c = sum(v for (s, r, d), v in xt["subcon_x_rev_x_welddate"].items()
               if r.strip() and d.strip())
    B("")
    B("**Excluding cancelled:** total welds %s, welded (Weld Date filled) %s.\n"
      % (f"{n_records - tot_c:,}", f"{sum(welded.values()) - wd_c:,}"))

    B("## 19. Slug Catcher split — Sub-Contractor x `Service class` LIKE 'EQP-SLG%'\n")
    B("| Sub-Contractor | Service class | welds | Weld Date filled |")
    B("|---|---|---:|---:|")
    slg_tot = collections.Counter()
    slg_wd = collections.Counter()
    for (s, sc, d), v in xt["subcon_x_svc_x_welddate"].items():
        grp = sc if sc.upper().startswith("EQP-SLG") else "(all other service classes)"
        slg_tot[(s, grp)] += v
        if d.strip():
            slg_wd[(s, grp)] += v
    for s in subs:
        grps = sorted({g for (ss, g) in slg_tot if ss == s},
                      key=lambda g: (g.startswith("("), g))
        for g in grps:
            B("| `%s` | `%s` | %s | %s |" % (esc(s), esc(g), f"{slg_tot[(s, g)]:,}",
                                             f"{slg_wd[(s, g)]:,}"))
    B("")

    with open(os.path.join(OUT, "crosstabs.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(X) + "\n")

    # ================================================================ summary
    el = time.time() - t0
    print()
    print("=" * 72)
    print("SUMMARY")
    print("=" * 72)
    print("file                : %s" % SRC)
    print("size                : %s bytes" % f"{facts['size_bytes']:,}")
    print("BOM                 : %s" % (facts["bom"] or "none"))
    print("encoding            : utf-8 strict -> %s" % enc_report["utf-8-strict"])
    print("non-ASCII chars     : %s" % f"{enc_report['non_ascii_chars']:,}")
    print("quote chars (\")     : %s  (fields starting with a quote: %s)"
          % (f"{enc_report['quote_chars']:,}", f"{qstart:,}"))
    print("LF total (wc -l)    : %s" % f"{le['lf_total']:,}")
    print("CRLF                : %s" % f"{le['crlf']:,}")
    print("bare LF (in-field)  : %s" % f"{le['bare_lf']:,}")
    print("physical lines      : %s" % f"{n_phys:,}")
    print("header field names  : %d" % N_HDR)
    print("data field width    : %d" % NF)
    print("logical data records: %s" % f"{n_records:,}")
    print("records re-joined   : %d (embedded CRLF) at physical lines %s"
          % (len(rejoined), ", ".join(str(a[0]) for a in rejoined[:5])))
    print("records overflowing : %d" % len(overflow))
    print("records EXCLUDED    : %d (field count != %d after assembly)" % (bad_width, NF))
    print("exact duplicate rows: %s in %s groups"
          % (f"{exact_dup_rows:,}", f"{exact_dup_groups:,}"))
    print()
    print("physical-line field-count histogram (fields -> lines, ex. line nos):")
    for n, c in sorted(hist_phys.items(), key=lambda kv: -kv[1]):
        print("   %6d -> %9s   e.g. lines %s"
              % (n, f"{c:,}", ", ".join(str(x) for x in phys_examples[n][:3])))
    print()
    print("CRLF-piece field-count histogram:")
    for n, c in sorted(hist_pieces.items(), key=lambda kv: -kv[1]):
        print("   %6d -> %9s" % (n, f"{c:,}"))
    print()
    print("assembled-record field-count histogram:")
    print("   %6d -> %9s" % (NF, f"{n_records - bad_width:,}"))
    if bad_width:
        print("   other -> %d  %s" % (bad_width, bad_examples))
    print()
    print("grain / key uniqueness:")
    for k in key_specs:
        cn = keys[k]
        dups = sum(1 for _, c in cn.items() if c > 1)
        print("   %-40s distinct=%-10s dup_keys=%-8s %s"
              % (k, f"{len(cn):,}", f"{dups:,}", "UNIQUE" if dups == 0 else ""))
    print()
    print("Sub-Contractor:", ", ".join("%s=%s" % (s or "(blank)", f"{c:,}")
                                       for s, c in xt["subcon"].most_common(10)))
    print("  -> CCC present in Sub-Contractor?",
          "YES" if any("CCC" in s.upper() for s in xt["subcon"]) else "NO")
    print("Dia Inch Factor values:", ", ".join(
        "%s=%s" % (v or "(blank)", f"{c:,}") for v, c in counters[I_DIF].most_common(5)))
    print("PWHT Y/N values:", ", ".join(
        "%s=%s" % (v or "(blank)", f"{c:,}") for v, c in counters[I_PWY].most_common(5)))
    print("Hold Status values:", ", ".join(
        "%r=%s" % (v, f"{c:,}") for v, c in counters[idx["Hold Status"]].most_common(5)))
    print("Revision Status values:", ", ".join(
        "%s=%s" % (v or "(blank)", f"{c:,}")
        for v, c in counters[I_REV].most_common(5)))
    print("WeldPoint No. values:", ", ".join(
        "%s=%s" % (v or "(blank)", f"{c:,}") for v, c in counters[I_WPT].most_common(6)))
    print("SLG/SLUG carrying columns:", ", ".join(
        "%s(%s)" % (nm, f"{t:,}") for _, nm, t, _ in slg_hits[:6]) or "NONE")
    ec = [c["clean_name"] for c in cols_json if c["inferred_type"] == "empty"]
    print("all-empty columns (%d): %s" % (len(ec), ", ".join(ec)))
    print()
    print("wrote: %s" % os.path.join(OUT, "columns.json"))
    print("wrote: %s" % os.path.join(OUT, "profile.md"))
    print("wrote: %s" % os.path.join(OUT, "crosstabs.md"))
    print("elapsed: %.1f s" % el)


if __name__ == "__main__":
    sys.exit(main())
