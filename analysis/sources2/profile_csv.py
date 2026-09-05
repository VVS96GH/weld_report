#!/usr/bin/env python3
"""
Read-only streaming profiler for the five big delimited sources dropped into
`sources/` in the second batch.  Adapted from analysis/dump/profile.py: same
output shape (one <slug>.columns.json per file + one section per file in
profile.md), same null-token / type-classification vocabulary, same
record-framing hazard checks.

  sources/CSVExport_Welder Record.csv          , 119 cols, utf-8   (CCC welds)
  sources/AllTrain_CSVExport_Joint Record.csv  , 143 cols, utf-8   (CCC joints)
  sources/Spool Dump.txt                       ; 102 cols, cp1252  (spools)
  sources/Joint.csv                            ,  62 cols, cp1252  (Talisman)
  sources/Spool.csv                            ,  22 cols, cp1252  (Talisman)

The delimiter / column count / encoding of each are taken verbatim from the
Power Query `Csv.Document(...)` call in analysis/pbix/model.md; the script
verifies them rather than trusting them.

Usage:  uv run analysis/sources2/profile_csv.py --all
        uv run analysis/sources2/profile_csv.py welder-record joint-record
        uv run analysis/sources2/profile_csv.py --all --limit 200000   (smoke)

Stdlib only.  Writes ONLY under analysis/sources2/.
"""

from __future__ import annotations

import collections
import json
import os
import re
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(REPO, "sources")
OUT = os.path.join(REPO, "analysis", "sources2")

# ------------------------------------------------------------------- tunables
# One dict per column, capped so 119 columns x 5.4 M rows still fits in RAM.
# Values past the cap are counted (`over_cap`) but not keyed, so top-values and
# the type histogram cover `counted / nonempty` of the column - reported.
CAP = 60_000
TOPN = 15

# ---------------------------------------------------------------- null tokens
NULL_TOKENS = {
    "null", "n/a", "na", "n.a.", "n\\a", "-", "--", "---", ".", "nil",
    "none", "#n/a", "#null!", "?", "nan", "(blank)", "no data", "not applicable",
}

# ---------------------------------------------------------------- type regexes
DATE_PATTERNS = [
    ("dd-MMM-yyyy",          re.compile(r"^\d{1,2}-[A-Za-z]{3}-\d{4}$")),
    ("dd-MMM-yy",            re.compile(r"^\d{1,2}-[A-Za-z]{3}-\d{2}$")),
    ("dd-MMM-yyyy hh:mm",    re.compile(r"^\d{1,2}-[A-Za-z]{3}-\d{4}[ T]\d{1,2}:\d{2}(:\d{2})?$")),
    ("yyyy-mm-dd",           re.compile(r"^\d{4}-\d{2}-\d{2}$")),
    ("yyyy-mm-dd hh:mm",     re.compile(r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$")),
    ("d/m/yyyy or m/d/yyyy", re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$")),
    ("d/m/yyyy hh:mm",       re.compile(r"^\d{1,2}/\d{1,2}/\d{4}[ T]\d{1,2}:\d{2}(:\d{2})?$")),
    ("d/m/yy or m/d/yy",     re.compile(r"^\d{1,2}/\d{1,2}/\d{2}$")),
    ("yyyy/mm/dd",           re.compile(r"^\d{4}/\d{1,2}/\d{1,2}$")),
    ("dd.mm.yyyy",           re.compile(r"^\d{1,2}\.\d{1,2}\.\d{4}$")),
    ("MMM dd yyyy",          re.compile(r"^[A-Za-z]{3} \d{1,2} \d{4}$")),
]
RE_INT = re.compile(r"^[+-]?\d+$")
RE_DEC = re.compile(r"^[+-]?\d*\.\d+$")
RE_DEC_COMMA = re.compile(r"^[+-]?\d*,\d+$")
RE_THOUSANDS = re.compile(r"^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$")
RE_SCI = re.compile(r"^[+-]?\d+(\.\d+)?[eE][+-]?\d+$")
YN_SET = {"y", "n", "yes", "no", "true", "false", "0", "1"}
MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def classify(v):
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


def parse_date_iso(v):
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
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", v)
    if m:
        return "%s-%02d-%02d" % (m.group(1), int(m.group(2)), int(m.group(3)))
    m = re.match(r"^(\d{4})/(\d{1,2})/(\d{1,2})$", v)
    if m:
        return "%s-%02d-%02d" % (m.group(1), int(m.group(2)), int(m.group(3)))
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", v)
    if m:            # ambiguous; d/m/y assumed for ordering only
        return "%s-%02d-%02d" % (m.group(3), int(m.group(2)), int(m.group(1)))
    return None


# ==================================================================== the files
# `cols`/`delim`/`enc` come from the Csv.Document call in
# analysis/pbix/model.md (line numbers in `m_line`).  `pbix_rows` is the row
# count the pbix stores for the table that reads the file.
FILES = [
    dict(slug="welder-record", file="CSVExport_Welder Record.csv",
         delim=",", enc="utf-8", cols=119, m_line=3794,
         pbix_table="CSVExport_Welder Record", pbix_rows=5_433_009,
         keys=[("Joint ID  (M: ISO-Spool-WeldNo+RepairSuffix)",
                ["QC ISO DWG. No.", "Spool No.", "Joint No.", "Repair Suffix"], "-,-,-,"),
               ("Joint ID + Welder + WeldPoint",
                ["QC ISO DWG. No.", "Spool No.", "Joint No.", "Repair Suffix",
                 "Welder No.", "Welded(Weld Point)"], "-,-,-,,|,|"),
               ("Spool ID  (ISO-Spool)", ["QC ISO DWG. No.", "Spool No."], "-")],
         ),
    dict(slug="joint-record", file="AllTrain_CSVExport_Joint Record.csv",
         delim=",", enc="utf-8", cols=143, m_line=3760,
         pbix_table="AllTrain_CSVExport_Joint Record (+ NOT WELDED)",
         pbix_rows=1_560_273 + 130_994,
         keys=[("Joint ID  (M: ISO-Spool-JointNo+RepairSuffix)",
                ["QC ISO DWG No", "Spool No", "Joint No", "Repair Suffix"], "-,-,-,"),
               ("Spool ID  (ISO-Spool)", ["QC ISO DWG No", "Spool No"], "-")],
         ),
    dict(slug="spool-dump", file="Spool Dump.txt",
         delim=";", enc="cp1252", cols=102, m_line=3734,
         pbix_table="Spool Dump", pbix_rows=198_647,
         keys=[("Spool ID  (M: ISO-Spool)", ["ISO Number", "Spool No."], "-")],
         ),
    dict(slug="talisman-joint", file="Joint.csv",
         delim=",", enc="cp1252", cols=62, m_line=5223,
         pbix_table="TALISMAN DATA", pbix_rows=3_098_341,
         keys=[("Joint ID  (M: QCISO-SPOOL-JOINT)",
                ["QCISO NO", "SPOOL NO", "JOINT NO"], "-,-"),
               ("Joint ID + WELDER ID 1",
                ["QCISO NO", "SPOOL NO", "JOINT NO", "WELDER ID 1"], "-,-,-")],
         ),
    dict(slug="talisman-spool", file="Spool.csv",
         delim=",", enc="cp1252", cols=22, m_line=5264,
         pbix_table="Talisman Spool Dump", pbix_rows=331_979,
         keys=[("Spool ID  (M: QCISO-SPOOL)", ["QCISO NO", "SPOOL NO"], "-")],
         ),
]

# Columns whose full value vocabulary we want printed in profile.md regardless
# of where they land in the column order (matched case-insensitively, exact).
KEY_COLUMN_HINTS = [
    "sub-con code", "subcon code", "sub-contractor", "spool shop sub contractor",
    "spool field sub contractor", "shop sub contractor", "field sub contractor",
    "del flag", "original repair delete flag", "revision status",
    "weld date", "rt/ut date", "rt/ut result", "rt/ut(%)", "rt1 result",
    "rt2 result", "ut1 result", "ut2 result", "pwht", "pwht date",
    "repair suffix", "original joint", "weld point code", "welded(weld point)",
    "weld type", "work category", "rt/ut", "tracer shot", "ndt remarks",
    "weld point first", "latest joint", "fabricated", "qc release",
]


# ============================================================ the streaming pass
def profile_file(spec, limit=None):
    path = os.path.join(SRC, spec["file"])
    delim = spec["delim"]
    enc = spec["enc"]
    ncols_m = spec["cols"]
    t0 = time.time()
    size = os.path.getsize(path)

    with open(path, "rb") as fh:
        head4 = fh.read(4)
    boms = {"utf-8-sig": b"\xef\xbb\xbf", "utf-16-le": b"\xff\xfe",
            "utf-16-be": b"\xfe\xff", "utf-32-le": b"\xff\xfe\x00\x00"}
    bom = next((k for k, v in boms.items() if head4.startswith(v)), None)

    # --- header -----------------------------------------------------------
    with open(path, "r", encoding=enc, errors="replace", newline="") as fh:
        header_line = fh.readline()
    crlf_header = header_line.endswith("\r\n")
    header = header_line.rstrip("\r\n").split(delim)
    nh = len(header)
    # Power Query's PromoteHeaders de-duplicates repeated names with `_1`,
    # `_2`, ... - reproduce so the map onto the model's column list lines up.
    seen = collections.Counter()
    names = []
    for h in header:
        seen[h] += 1
        names.append(h if seen[h] == 1 else "%s_%d" % (h, seen[h] - 1))
    dupes = [h for h, n in seen.items() if n > 1]

    NF = ncols_m                      # Csv.Document(Columns=NF): pad/truncate
    idx = {n: i for i, n in enumerate(names)}

    # --- accumulators ------------------------------------------------------
    counts = [dict() for _ in range(NF)]   # value -> n  (capped at CAP keys)
    over_cap = [0] * NF                    # nonempty values not keyed
    nonempty = [0] * NF
    blank = [0] * NF
    maxlen = [0] * NF

    field_hist = collections.Counter()     # fields-per-physical-line
    phys_lines = 0
    quoted_field_lines = 0
    dq_lines = 0                            # lines containing a '"' at all
    repl_lines = 0                          # lines with U+FFFD (decode damage)
    short_lines = 0
    long_lines = 0
    crlf = 0
    lf_only = 0
    ragged_examples = []

    # separator-count record assembly (the Weld-Dump loader's rule), so we can
    # say whether embedded newlines exist at all
    sep_records = 0
    sep_rejoins = 0

    keyspecs = spec.get("keys", [])
    keysets = [set() for _ in keyspecs]
    keyidx = []
    for _, colnames, _sep in keyspecs:
        keyidx.append([idx.get(c) for c in colnames])
    keyrows = [0] * len(keyspecs)

    CAPL = CAP
    buf = None
    bufsep = 0

    with open(path, "r", encoding=enc, errors="replace", newline="") as fh:
        fh.readline()                                   # skip header
        for raw in fh:
            if raw.endswith("\r\n"):
                crlf += 1
                line = raw[:-2]
            elif raw.endswith("\n"):
                lf_only += 1
                line = raw[:-1]
            else:
                line = raw
            if not line:
                continue
            phys_lines += 1

            nsep = line.count(delim)
            field_hist[nsep + 1] += 1

            # separator-count framing, independent of the newline framing
            if buf is None:
                buf, bufsep = line, nsep
            else:
                buf, bufsep = buf + "\n" + line, bufsep + nsep
                sep_rejoins += 1
            if bufsep + 1 >= NF:
                sep_records += 1
                buf, bufsep = None, 0

            if '"' in line:
                dq_lines += 1
                if line.startswith('"') or (delim + '"') in line:
                    quoted_field_lines += 1
            if "\ufffd" in line:
                repl_lines += 1

            f = line.split(delim)
            n = len(f)
            if n < NF:
                short_lines += 1
                if len(ragged_examples) < 5:
                    ragged_examples.append([phys_lines, n, line[:160]])
                f = f + [""] * (NF - n)
            elif n > NF:
                long_lines += 1
                if len(ragged_examples) < 5:
                    ragged_examples.append([phys_lines, n, line[:160]])
                f = f[:NF]

            i = 0
            for v in f:
                if v:
                    nonempty[i] += 1
                    d = counts[i]
                    c = d.get(v)
                    if c is not None:
                        d[v] = c + 1
                    elif len(d) < CAPL:
                        d[v] = 1
                    else:
                        over_cap[i] += 1
                else:
                    blank[i] += 1
                i += 1

            for k, (kname, cn, sep) in enumerate(keyspecs):
                ii = keyidx[k]
                if None in ii:
                    continue
                parts = sep.split(",")
                s = f[ii[0]]
                for j in range(1, len(ii)):
                    s += (parts[j - 1] if j - 1 < len(parts) else "") + f[ii[j]]
                keysets[k].add(hash(s))
                keyrows[k] += 1

            if limit and phys_lines >= limit:
                break

    if buf is not None:          # trailing incomplete separator-record
        sep_records += 1

    elapsed = time.time() - t0

    # --- derive per-column facts ------------------------------------------
    cols_json = []
    for i in range(NF):
        d = counts[i]
        ne = nonempty[i]
        cat = collections.Counter()
        fmt = collections.Counter()
        toks = collections.Counter()
        mn = mx = None
        dmn = dmx = None
        nmin = nmax = None
        intdig = 0
        scale = 0
        lead = 0
        for v, c in d.items():
            L = len(v)
            if L > maxlen[i]:
                maxlen[i] = L
            s = v.strip()
            if not s:
                cat["blank-after-strip"] += c
                continue
            if s != v:
                lead += c
            if s.lower() in NULL_TOKENS:
                toks[s] += c
            k, lab = classify(s)
            cat[k] += c
            fmt[lab] += c
            if mn is None or s < mn:
                mn = s
            if mx is None or s > mx:
                mx = s
            if k == "date":
                iso = parse_date_iso(s)
                if iso:
                    if dmn is None or iso < dmn:
                        dmn = iso
                    if dmx is None or iso > dmx:
                        dmx = iso
            elif k in ("int", "decimal"):
                try:
                    f_ = float(s.replace(",", "")) if "," in s else float(s)
                except ValueError:
                    f_ = None
                if f_ is not None:
                    if nmin is None or f_ < nmin:
                        nmin = f_
                    if nmax is None or f_ > nmax:
                        nmax = f_
                    ip = s.lstrip("+-").split(".")[0].replace(",", "")
                    intdig = max(intdig, len(ip))
                    if "." in s:
                        scale = max(scale, len(s.split(".")[1]))

        counted = sum(cat.values())
        if ne == 0:
            itype = "empty"
        else:
            dom = cat.most_common(1)[0][0] if cat else "text"
            if dom in ("int", "decimal") and cat.get("text", 0) == 0 and cat.get("date", 0) == 0:
                itype = "int" if cat.get("decimal", 0) == 0 else "decimal"
            elif dom == "date" and cat.get("text", 0) == 0:
                itype = "date"
            else:
                itype = dom
        top = [[v, c] for v, c in collections.Counter(d).most_common(TOPN)]
        cols_json.append(dict(
            index=i + 1,
            raw_name=header[i] if i < nh else None,
            name=names[i] if i < len(names) else "(padded col %d)" % (i + 1),
            present_in_header=i < nh,
            nonempty=ne, blank=blank[i],
            distinct_keyed=len(d),
            distinct_capped=(len(d) >= CAP),
            values_over_cap=over_cap[i],
            profiled_coverage=(round(counted / ne, 6) if ne else None),
            inferred_type=itype,
            categories=cat.most_common(),
            formats_seen=fmt.most_common(6),
            null_token_counts=toks.most_common(),
            values_with_lead_trail_space=lead,
            max_len=maxlen[i],
            min=mn, max=mx,
            date_min=dmn, date_max=dmx,
            num_min=nmin, num_max=nmax,
            num_int_digits=intdig or None, num_scale=scale or None,
            top_values=top,
        ))

    facts = dict(
        file=spec["file"], slug=spec["slug"], size_bytes=size, bom=bom,
        first_4_bytes=head4.hex(), encoding_used=enc, delimiter=delim,
        m_columns=ncols_m, m_line=spec["m_line"],
        header_fields=nh, header_names_deduped=names,
        duplicate_header_names=dupes,
        header_line_ending=("CRLF" if crlf_header else "LF"),
        physical_data_lines=phys_lines,
        line_endings=dict(crlf=crlf, lf_only=lf_only),
        field_count_histogram=sorted(field_hist.items()),
        modal_field_count=(field_hist.most_common(1)[0][0] if field_hist else None),
        lines_short_of_m_columns=short_lines,
        lines_over_m_columns=long_lines,
        ragged_examples=ragged_examples,
        lines_containing_double_quote=dq_lines,
        lines_with_quoted_looking_field=quoted_field_lines,
        lines_with_decode_replacement_char=repl_lines,
        sepcount_records=sep_records, sepcount_rejoins=sep_rejoins,
        pbix_table=spec["pbix_table"], pbix_rows=spec["pbix_rows"],
        keys=[dict(name=k[0], columns=k[1], rows=keyrows[j],
                   distinct=len(keysets[j]),
                   unique=(len(keysets[j]) == keyrows[j]))
              for j, k in enumerate(keyspecs)],
        seconds=round(elapsed, 1),
        limit=limit,
    )
    return facts, cols_json


# ======================================================================= report
def fmt(n):
    return "{:,}".format(n) if isinstance(n, int) else str(n)


def esc(v):
    return str(v).replace("|", "\\|").replace("\n", "\\n").replace("\r", "\\r")


def md_section(facts, cols):
    A = []
    w = A.append
    w("## `sources/%s`" % facts["file"])
    w("")
    w("### Framing and encoding")
    w("")
    w("| fact | value |")
    w("|---|---|")
    w("| size | %s bytes |" % fmt(facts["size_bytes"]))
    w("| BOM | %s |" % (facts["bom"] or "**none** (first 4 bytes `%s`)" % facts["first_4_bytes"]))
    w("| encoding used (from the M) | `%s` |" % facts["encoding_used"])
    w("| lines with U+FFFD after decode | %s |" % fmt(facts["lines_with_decode_replacement_char"]))
    w("| delimiter (from the M) | `%s` |" % facts["delimiter"])
    w("| M `Columns=` (model.md line %d) | %d |" % (facts["m_line"], facts["m_columns"]))
    w("| header fields counted | %d |" % facts["header_fields"])
    w("| duplicate header names | %s |" % (", ".join("`%s`" % d for d in facts["duplicate_header_names"]) or "none"))
    w("| line endings | CRLF %s / bare-LF %s |" % (fmt(facts["line_endings"]["crlf"]), fmt(facts["line_endings"]["lf_only"])))
    w("| physical data lines | **%s** |" % fmt(facts["physical_data_lines"]))
    w("| records if assembled by separator count | %s (re-joins %s) |" % (
        fmt(facts["sepcount_records"]), fmt(facts["sepcount_rejoins"])))
    w("| pbix stored rows (`%s`) | %s |" % (facts["pbix_table"], fmt(facts["pbix_rows"])))
    w("| delta vs pbix | %s |" % fmt(facts["physical_data_lines"] - facts["pbix_rows"]))
    w("| lines containing a `\"` | %s |" % fmt(facts["lines_containing_double_quote"]))
    w("| lines that *look* quoted (field starts `\"`) | %s |" % fmt(facts["lines_with_quoted_looking_field"]))
    w("| lines with < %d fields | %s |" % (facts["m_columns"], fmt(facts["lines_short_of_m_columns"])))
    w("| lines with > %d fields | %s |" % (facts["m_columns"], fmt(facts["lines_over_m_columns"])))
    w("| profiling wall time | %ss |" % facts["seconds"])
    w("")
    w("Field-count histogram (fields per physical line): %s" % ", ".join(
        "%d\u2192%s" % (k, fmt(v)) for k, v in facts["field_count_histogram"][:12]))
    if len(facts["field_count_histogram"]) > 12:
        w("(+%d more buckets)" % (len(facts["field_count_histogram"]) - 12))
    w("")
    if facts["ragged_examples"]:
        w("First ragged lines (line no, fields, first 160 chars):")
        w("")
        w("```")
        for ln, n, s in facts["ragged_examples"]:
            w("%d  %d  %s" % (ln, n, s))
        w("```")
        w("")
    if facts["sepcount_rejoins"] == 0 and facts["lines_short_of_m_columns"] == 0 and facts["lines_over_m_columns"] == 0:
        w("**Framing verdict: clean.** Every physical line carries exactly %d fields, "
          "no embedded newlines, no quoting. One line = one record; a `COPY ... CSV` "
          "or text-format load is safe." % facts["m_columns"])
    else:
        w("**Framing verdict: NOT clean** - see the ragged-line counts above. "
          "Power Query with `QuoteStyle.None` pads/truncates each *physical line* to "
          "%d fields, so an ETL that re-joins on separator count will NOT reproduce "
          "the pbix row count." % facts["m_columns"])
    w("")
    w("### Grain / key uniqueness")
    w("")
    w("| candidate key | rows | distinct | unique? |")
    w("|---|---:|---:|---|")
    for k in facts["keys"]:
        w("| %s | %s | %s | %s |" % (
            k["name"], fmt(k["rows"]), fmt(k["distinct"]),
            "**yes**" if k["unique"] else "no (%s dup rows)" % fmt(k["rows"] - k["distinct"])))
    w("")
    w("### Columns")
    w("")
    w("`distinct` is exact up to the %s-key cap; a capped column shows `>=cap` and "
      "`coverage` says what fraction of its non-empty values the top-values/type "
      "histogram actually saw." % fmt(CAP))
    w("")
    w("| # | column | type | non-empty | blank | distinct | cov | range / top values |")
    w("|---:|---|---|---:|---:|---:|---:|---|")
    for c in cols:
        dist = ("\u2265%s" % fmt(c["distinct_keyed"])) if c["distinct_capped"] else fmt(c["distinct_keyed"])
        cov = "%.3f" % c["profiled_coverage"] if c["profiled_coverage"] is not None else "-"
        if c["inferred_type"] == "empty":
            detail = "_(all rows empty)_"
        elif c["date_min"]:
            detail = "%s \u2026 %s  \u00b7 fmt %s" % (
                c["date_min"], c["date_max"],
                ", ".join("`%s`\u00d7%s" % (f, fmt(n)) for f, n in c["formats_seen"][:3]))
        elif c["num_min"] is not None and c["inferred_type"] in ("int", "decimal"):
            detail = "%s \u2026 %s  \u00b7 %s" % (
                c["num_min"], c["num_max"],
                ", ".join("`%s`\u00d7%s" % (esc(v), fmt(n)) for v, n in c["top_values"][:5]))
        else:
            detail = ", ".join("`%s`\u00d7%s" % (esc(v), fmt(n)) for v, n in c["top_values"][:8])
        if c["null_token_counts"]:
            detail += "  \u00b7 null-ish: " + ", ".join(
                "`%s`=%s" % (esc(v), fmt(n)) for v, n in c["null_token_counts"][:4])
        A.append("| %d | `%s` | %s | %s | %s | %s | %s | %s |" % (
            c["index"], esc(c["name"]), c["inferred_type"], fmt(c["nonempty"]),
            fmt(c["blank"]), dist, cov, detail))
    w("")
    # full vocabulary for the columns the metrics layer keys on
    hints = [c for c in cols if c["name"].strip().lower() in KEY_COLUMN_HINTS]
    if hints:
        w("### Full value vocabulary of the decision columns")
        w("")
        for c in hints:
            if c["inferred_type"] == "empty":
                w("* `%s` \u2014 **empty in all %s rows**" % (c["name"], fmt(c["blank"])))
                continue
            items = c["top_values"]
            more = "" if not c["distinct_capped"] else " \u2026 (+%s more distinct)" % fmt(c["distinct_keyed"] - len(items))
            if c["date_min"]:
                w("* `%s` \u2014 date, %s \u2026 %s, %s non-empty, %s blank; formats %s" % (
                    c["name"], c["date_min"], c["date_max"], fmt(c["nonempty"]), fmt(c["blank"]),
                    ", ".join("`%s`\u00d7%s" % (f, fmt(n)) for f, n in c["formats_seen"])))
            else:
                w("* `%s` \u2014 %s distinct: %s%s" % (
                    c["name"], fmt(c["distinct_keyed"]),
                    ", ".join("`%s`=%s" % (esc(v), fmt(n)) for v, n in items), more))
        w("")
    return "\n".join(A)


def main():
    args = [a for a in sys.argv[1:]]
    limit = None
    if "--limit" in args:
        i = args.index("--limit")
        limit = int(args[i + 1])
        del args[i:i + 2]
    run_all = "--all" in args
    args = [a for a in args if not a.startswith("--")]
    todo = FILES if (run_all or not args) else [f for f in FILES if f["slug"] in args]
    if not todo:
        print("no matching slug; known: %s" % ", ".join(f["slug"] for f in FILES))
        return 1

    os.makedirs(OUT, exist_ok=True)
    sections = []
    summary = []
    t_all = time.time()
    for spec in todo:
        p = os.path.join(SRC, spec["file"])
        if not os.path.exists(p):
            print("MISSING %s" % p)
            continue
        print("profiling %-16s %s ..." % (spec["slug"], spec["file"]), flush=True)
        facts, cols = profile_file(spec, limit=limit)
        with open(os.path.join(OUT, "%s.columns.json" % spec["slug"]), "w") as fh:
            json.dump(dict(facts=facts, columns=cols), fh, indent=1, default=str)
        sections.append(md_section(facts, cols))
        summary.append((spec["slug"], spec["file"], facts["physical_data_lines"],
                        facts["m_columns"], facts["pbix_rows"], facts["seconds"]))
        print("   %s lines, %d cols, %ss" % (
            "{:,}".format(facts["physical_data_lines"]), facts["m_columns"], facts["seconds"]),
            flush=True)

    # only rewrite profile.md when the whole set ran, so a single-file re-run
    # cannot silently truncate the document
    if run_all or len(todo) == len(FILES):
        head = ["# sources/ batch 2 - delimited-file profile",
                "",
                "Generated by `uv run analysis/sources2/profile_csv.py --all`"
                "%s.  Read-only single streaming pass per file." % (
                    " (--limit %d, PARTIAL)" % limit if limit else ""),
                "",
                "| slug | file | data lines | cols | pbix rows | secs |",
                "|---|---|---:|---:|---:|---:|"]
        for s in summary:
            head.append("| `%s` | `%s` | %s | %d | %s | %s |" % (
                s[0], s[1], fmt(s[2]), s[3], fmt(s[4]), s[5]))
        head += ["", "Total wall time %.1fs." % (time.time() - t_all), "", "---", ""]
        with open(os.path.join(OUT, "profile.md"), "w") as fh:
            fh.write("\n".join(head) + "\n\n---\n\n".join(sections) + "\n")
        print("wrote analysis/sources2/profile.md")
    print("total %.1fs" % (time.time() - t_all))
    return 0


if __name__ == "__main__":
    sys.exit(main())
