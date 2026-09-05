#!/usr/bin/env python3
"""
Mechanical, read-only extractor for mockups/welding-dashboard 1.html.

Produces:
  - analysis/mockups/welding-spec.json
  - analysis/mockups/welding-spec.md
  - analysis/mockups/welding-metrics.md

Uses only the Python standard library (html.parser, re, json).
This script does NOT hand-transcribe values; every number/label in the
outputs is read out of the HTML/JS source at run time.
"""
import json
import re
import sys
from html.parser import HTMLParser
from html import unescape
from collections import OrderedDict, defaultdict
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC_PATH = os.path.join(REPO_ROOT, "mockups", "welding-dashboard 1.html")
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# Elements that never carry nested content relevant here / are void-ish in this doc.
VOID_TAGS = {"meta", "link", "br", "img", "hr", "input", "col", "source"}


class Node:
    __slots__ = ("tag", "attrs", "children", "parent")

    def __init__(self, tag, attrs, parent=None):
        self.tag = tag
        self.attrs = dict(attrs)
        self.children = []  # list of Node or str
        self.parent = parent

    def cls(self):
        return self.attrs.get("class", "")

    def has_class(self, name):
        return name in self.cls().split()

    def text(self):
        """Concatenate all descendant text, collapse whitespace."""
        parts = []

        def walk(n):
            if isinstance(n, str):
                parts.append(n)
            else:
                for c in n.children:
                    walk(c)

        walk(self)
        return re.sub(r"\s+", " ", "".join(parts)).strip()

    def find_all(self, tag, cls=None):
        out = []

        def walk(n):
            for c in n.children:
                if isinstance(c, Node):
                    if c.tag == tag and (cls is None or c.has_class(cls)):
                        out.append(c)
                    walk(c)

        walk(self)
        return out

    def find(self, tag, cls=None):
        r = self.find_all(tag, cls)
        return r[0] if r else None

    def elem_children(self):
        return [c for c in self.children if isinstance(c, Node)]


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root", {})
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, parent=self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        node = Node(tag, attrs, parent=self.stack[-1])
        self.stack[-1].children.append(node)

    def handle_endtag(self, tag):
        # pop until matching tag found; ignore stray/unmatched end tags
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        if data:
            self.stack[-1].children.append(data)


def parse_dom(html_text):
    tb = TreeBuilder()
    tb.feed(html_text)
    return tb.root


# ---------------------------------------------------------------------------
# JS chart-config extraction (regex, operating on raw text of the <script> block)
# ---------------------------------------------------------------------------

def extract_balanced(text, start_idx, open_ch="{", close_ch="}"):
    """Given text[start_idx] == open_ch, return the substring including the
    matching close_ch, honoring string literals so braces inside quotes/JS
    strings don't confuse the balance count."""
    assert text[start_idx] == open_ch
    depth = 0
    i = start_idx
    in_str = None  # None or the quote char
    n = len(text)
    while i < n:
        ch = text[i]
        if in_str:
            if ch == "\\":
                i += 2
                continue
            if ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            in_str = ch
            i += 1
            continue
        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return text[start_idx:i + 1]
        i += 1
    raise ValueError("Unbalanced braces starting at %d" % start_idx)


def parse_js_string_array(arr_text):
    """arr_text is the inside of [...] (no brackets), a flat list of
    'string' or number literals. Returns list of python values (str for
    strings, else raw literal text as-is for numbers/other)."""
    items = []
    i = 0
    n = len(arr_text)
    while i < n:
        ch = arr_text[i]
        if ch in " \t\r\n,":
            i += 1
            continue
        if ch in ("'", '"'):
            q = ch
            j = i + 1
            buf = []
            while j < n and arr_text[j] != q:
                if arr_text[j] == "\\" and j + 1 < n:
                    buf.append(arr_text[j + 1])
                    j += 2
                    continue
                buf.append(arr_text[j])
                j += 1
            items.append("".join(buf))
            i = j + 1
            continue
        # bare token (number, null, etc.) up to next comma at depth 0
        j = i
        depth = 0
        while j < n:
            c = arr_text[j]
            if c in "([{":
                depth += 1
            elif c in ")]}":
                depth -= 1
            elif c == "," and depth == 0:
                break
            j += 1
        token = arr_text[i:j].strip()
        if token:
            items.append(token)
        i = j + 1
    return items


def extract_chart_configs(script_text):
    """Find every `charts.<name> = new Chart(<ctxvar>, { ... });` block and
    parse out type / labels / datasets / a few options notes."""
    charts = {}
    for m in re.finditer(r"charts\.(\w+)\s*=\s*new Chart\(\s*\w+\s*,\s*", script_text):
        name = m.group(1)
        brace_start = script_text.index("{", m.end() - 1)
        # verify the { is right after (allow whitespace)
        between = script_text[m.end():brace_start]
        if between.strip() not in ("",):
            # skip odd formatting, still attempt
            pass
        block = extract_balanced(script_text, brace_start)

        chart_type = None
        tm = re.search(r"type:\s*'([^']+)'", block)
        if tm:
            chart_type = tm.group(1)

        # labels: find `labels:` then a balanced [ ... ]
        labels = []
        lm = re.search(r"\blabels\s*:\s*\[", block)
        if lm:
            lb_start = block.index("[", lm.start())
            lb_text = extract_balanced(block, lb_start, "[", "]")
            labels = parse_js_string_array(lb_text[1:-1])

        # datasets: find `datasets:` then balanced [ ... ], then split into
        # top-level {...} objects
        datasets = []
        dm = re.search(r"\bdatasets\s*:\s*\[", block)
        if dm:
            ds_start = block.index("[", dm.start())
            ds_text = extract_balanced(block, ds_start, "[", "]")
            inner = ds_text[1:-1]
            # split inner into top-level {...} object substrings
            i = 0
            n = len(inner)
            while i < n:
                if inner[i] == "{":
                    obj_text = extract_balanced(inner, i)
                    ds = {}
                    lbl = re.search(r"label\s*:\s*'([^']*)'", obj_text)
                    if lbl:
                        ds["label"] = lbl.group(1)
                    dat = re.search(r"\bdata\s*:\s*\[", obj_text)
                    if dat:
                        d_start = obj_text.index("[", dat.start())
                        d_text = extract_balanced(obj_text, d_start, "[", "]")
                        ds["data"] = parse_js_string_array(d_text[1:-1])
                    stk = re.search(r"\bstack\s*:\s*'([^']*)'", obj_text)
                    if stk:
                        ds["stack"] = stk.group(1)
                    datasets.append(ds)
                    i += len(obj_text)
                else:
                    i += 1

        # options notes: stacked axes, indexAxis, percent-formatted ticks
        notes = []
        if re.search(r"scales:\s*\{\s*x:\s*\{\s*stacked:\s*true", block):
            notes.append("stacked (x)")
        if re.search(r"y:\s*\{\s*stacked:\s*true", block):
            notes.append("stacked (y)")
        im = re.search(r"indexAxis:\s*'([^']+)'", block)
        if im:
            notes.append("indexAxis=%s" % im.group(1))
        if "v + '%'" in block or "ticks.callback" in block.replace(" ", ""):
            if "%" in block:
                notes.append("percent-axis")
        if "datalabels" in block:
            notes.append("has datalabels plugin")

        charts[name] = {
            "canvas_id": name,
            "chart_type": chart_type,
            "labels": labels,
            "datasets": datasets,
            "options_notes": notes,
            "raw_block_found": True,
        }
    return charts


def extract_palettes(script_text):
    m = re.search(r"const palettes\s*=\s*\{", script_text)
    if not m:
        return {}
    brace_start = script_text.index("{", m.start())
    block = extract_balanced(script_text, brace_start)
    inner = block[1:-1]
    moods = {}
    # split top-level `name: { ... }` entries
    i = 0
    n = len(inner)
    while i < n:
        mm = re.match(r"\s*(\w+)\s*:\s*\{", inner[i:])
        if mm:
            name = mm.group(1)
            obj_start = i + mm.end() - 1
            obj_text = extract_balanced(inner, obj_start)
            colors = []
            cm = re.search(r"colors\s*:\s*\[", obj_text)
            if cm:
                c_start = obj_text.index("[", cm.start())
                c_text = extract_balanced(obj_text, c_start, "[", "]")
                colors = parse_js_string_array(c_text[1:-1])
            primary = None
            pm = re.search(r"primary\s*:\s*'([^']+)'", obj_text)
            if pm:
                primary = pm.group(1)
            secondary = None
            sm = re.search(r"secondary\s*:\s*'([^']+)'", obj_text)
            if sm:
                secondary = sm.group(1)
            icon = None
            imn = re.search(r"icon\s*:\s*'([^']+)'", obj_text)
            if imn:
                icon = imn.group(1)
            label = None
            lmn = re.search(r"label\s*:\s*'([^']+)'", obj_text)
            if lmn:
                label = lmn.group(1)
            moods[name] = {
                "colors": colors,
                "primary": primary,
                "secondary": secondary,
                "icon": icon,
                "label": label,
            }
            i = obj_start + len(obj_text)
        else:
            i += 1
    return moods


def extract_page_titles(script_text):
    m = re.search(r"const pageTitles\s*=\s*\[", script_text)
    if not m:
        return []
    start = script_text.index("[", m.start())
    arr_text = extract_balanced(script_text, start, "[", "]")
    return parse_js_string_array(arr_text[1:-1])


def extract_total_pages(script_text):
    m = re.search(r"const totalPages\s*=\s*(\d+)", script_text)
    return int(m.group(1)) if m else None


def extract_css_vars(head_text):
    """Extract --var names defined in the first (and, per inspection, only)
    :root { ... } block."""
    m = re.search(r":root\s*\{", head_text)
    if not m:
        return []
    start = head_text.index("{", m.start())
    block = extract_balanced(head_text, start)
    return sorted(set(re.findall(r"--([a-zA-Z0-9-]+)\s*:", block)))


def extract_external_resources(head_text):
    scripts = re.findall(r'<script[^>]*\bsrc="([^"]+)"', head_text)
    stylesheets = re.findall(r'<link[^>]*\bhref="([^"]+)"[^>]*>', head_text)
    return scripts, stylesheets


# ---------------------------------------------------------------------------
# Widget extraction from the parsed DOM
# ---------------------------------------------------------------------------

def table_widget(div_table_scroll, title):
    table = div_table_scroll.find("table")
    if table is None:
        return {"kind": "unresolved", "note": "table-scroll with no <table> found"}
    thead = table.find("thead")
    columns = []
    if thead is not None:
        for th in thead.find_all("th"):
            columns.append(th.text())
    tbody = table.find("tbody")
    rows = []
    total_row = None
    if tbody is not None:
        for tr in tbody.elem_children():
            if tr.tag != "tr":
                continue
            cells = [td.text() for td in tr.elem_children() if td.tag in ("td", "th")]
            rows.append(cells)
            cls = tr.cls()
            if "row-header" in cls.split() or "total" in cls.split():
                total_row = cells
    widget = {
        "kind": "table",
        "title": title,
        "columns": columns,
        "rows": rows,
    }
    if total_row is not None:
        widget["total_row"] = total_row
    return widget


def legend_card_widget(card):
    header = card.find("div", "card-header")
    title = header.text() if header is not None else None
    lines = []
    for child in card.elem_children():
        if child is header:
            continue
        # each remaining top-level div's text is one legend line
        if isinstance(child, Node):
            t = child.text()
            if t:
                lines.append(t)
    text = title + ": " + "; ".join(lines) if title else "; ".join(lines)
    return {"kind": "text", "text": text}


def chart_card_widget(card, chart_configs):
    header = card.find("div", "card-header")
    title = header.text() if header is not None else None
    canvas = card.find("canvas")
    if canvas is None:
        return None
    canvas_id = canvas.attrs.get("id")
    cfg = chart_configs.get(canvas_id)
    if cfg is None:
        return {
            "kind": "unresolved",
            "note": "canvas id '%s' has no matching `charts.<id> = new Chart(...)` block found in <script>" % canvas_id,
        }
    widget = {
        "kind": "chart",
        "canvas_id": canvas_id,
        "title": title,
        "chart_type": cfg["chart_type"],
        "labels": cfg["labels"],
        "datasets": cfg["datasets"],
        "options_notes": cfg["options_notes"],
    }
    return widget


def process_section(section, chart_configs, page_num):
    h2_nodes = section.find_all("h2")
    title = h2_nodes[0].text() if h2_nodes else None

    subtitle = None
    # look for any h3 / .caption / .subtitle / "as of" text at top level
    for child in section.elem_children():
        if child.tag == "h3" or child.has_class("caption") or child.has_class("subtitle"):
            subtitle = child.text()
            break
        t = child.text()
        if t and re.search(r"\bas of\b", t, re.I):
            subtitle = t
            break

    widgets = []
    pending_title = None
    seen_first_h2 = False

    for child in section.elem_children():
        if child.tag == "div" and child.find("h2") is not None and not child.has_class("stats-row"):
            # page-header div (possibly a second/embedded one mid-page)
            h2 = child.find("h2")
            htext = h2.text() if h2 else None
            if not seen_first_h2:
                seen_first_h2 = True
                # this is the main page title; nothing to emit
                continue
            else:
                widgets.append({"kind": "text", "text": htext})
            continue

        if child.has_class("stats-row"):
            for sb in child.find_all("div", "stat-box"):
                val = sb.find("div", "stat-value")
                lbl = sb.find("div", "stat-label")
                widgets.append({
                    "kind": "kpi",
                    "label": lbl.text() if lbl is not None else None,
                    "value": val.text() if val is not None else None,
                    "sub": None,
                })
            continue

        if child.has_class("section-title"):
            pending_title = child.text()
            continue

        if child.has_class("table-scroll"):
            widgets.append(table_widget(child, pending_title))
            pending_title = None
            continue

        if child.has_class("dashboard-grid"):
            for card in child.find_all("div", "card"):
                if card.find("canvas") is not None:
                    w = chart_card_widget(card, chart_configs)
                    if w is not None:
                        widgets.append(w)
                else:
                    widgets.append(legend_card_widget(card))
            continue

        # anything else at top level of a page-section: flag for review
        txt = child.text()
        if txt:
            widgets.append({
                "kind": "unresolved",
                "note": "unrecognized top-level element <%s class=%r> in page%s" % (child.tag, child.cls(), page_num),
                "text": txt,
            })

    return title, subtitle, widgets


def main():
    with open(SRC_PATH, "r", encoding="utf-8") as f:
        html_text = f.read()

    # --- global: html/head-level ---
    html_tag_m = re.search(r"<html\b[^>]*>", html_text)
    theme_attr = {}
    if html_tag_m:
        for am in re.finditer(r'(\w[\w-]*)="([^"]*)"', html_tag_m.group(0)):
            theme_attr[am.group(1)] = am.group(2)

    head_m = re.search(r"<head\b.*?</head>", html_text, re.S)
    head_text = head_m.group(0) if head_m else ""
    css_vars = extract_css_vars(head_text)
    external_scripts, external_stylesheets = extract_external_resources(head_text)

    # global report subtitle (header .subtitle, outside any page-section)
    header_m = re.search(r'<header class="header">.*?</header>', html_text, re.S)
    report_subtitle = None
    if header_m:
        sm = re.search(r'<div class="subtitle">(.*?)</div>', header_m.group(0), re.S)
        if sm:
            report_subtitle = re.sub(r"\s+", " ", unescape(sm.group(1))).strip()

    # --- script block (JS) ---
    script_m = re.search(r"<script>(.*)</script>\s*</body>", html_text, re.S)
    if not script_m:
        # fallback: last <script> ... </script>
        scripts = list(re.finditer(r"<script>(.*?)</script>", html_text, re.S))
        script_text = scripts[-1].group(1) if scripts else ""
    else:
        script_text = script_m.group(1)

    palettes = extract_palettes(script_text)
    page_titles = extract_page_titles(script_text)
    total_pages = extract_total_pages(script_text)
    chart_configs = extract_chart_configs(script_text)

    # --- DOM (body content only, for speed/robustness skip head) ---
    body_m = re.search(r"<body>.*</body>", html_text, re.S)
    body_text = body_m.group(0) if body_m else html_text
    dom_root = parse_dom(body_text)

    sections = dom_root.find_all("section", "page-section")

    pages = []
    unresolved_count = 0
    chart_widget_ids = set()

    for sec in sections:
        sec_id = sec.attrs.get("id", "")
        num_m = re.match(r"page(\d+)$", sec_id)
        page_num = int(num_m.group(1)) if num_m else None

        title, subtitle, widgets = process_section(sec, chart_configs, page_num)
        if title is None and page_num is not None and 1 <= page_num <= len(page_titles):
            title = page_titles[page_num - 1]

        for w in widgets:
            if w.get("kind") == "unresolved":
                unresolved_count += 1
            if w.get("kind") == "chart":
                chart_widget_ids.add(w["canvas_id"])

        pages.append({
            "page": page_num,
            "id": sec_id,
            "title": title,
            "subtitle": subtitle,
            "widgets": widgets,
        })

    spec = {
        "pages": pages,
        "global": {
            "pageTitles": page_titles,
            "totalPages": total_pages,
            "moods": palettes,
            "theme_attr": theme_attr,
            "css_vars": css_vars,
            "external_scripts": external_scripts,
            "external_stylesheets": external_stylesheets,
            "report_subtitle": report_subtitle,
        },
    }

    json_path = os.path.join(OUT_DIR, "welding-spec.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(spec, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # ------------------------------------------------------------------
    # Markdown rendering of the same JSON
    # ------------------------------------------------------------------
    md_lines = []
    md_lines.append("# Welding Dashboard Mockup Spec")
    md_lines.append("")
    md_lines.append("Source: `mockups/welding-dashboard 1.html`. Generated by "
                     "`analysis/mockups/extract_welding.py`. Do not hand-edit.")
    md_lines.append("")
    md_lines.append("Report subtitle: %s" % (report_subtitle or "(none)"))
    md_lines.append("")
    md_lines.append("Total pages: %s" % total_pages)
    md_lines.append("")

    for p in pages:
        md_lines.append("## Page %s — %s" % (p["page"], p["title"]))
        md_lines.append("")
        md_lines.append("id: `%s`" % p["id"])
        if p["subtitle"]:
            md_lines.append("")
            md_lines.append("Subtitle: %s" % p["subtitle"])
        md_lines.append("")
        for w in p["widgets"]:
            kind = w.get("kind")
            if kind == "kpi":
                md_lines.append("- **KPI** — %s: `%s`" % (w.get("label"), w.get("value")))
            elif kind == "table":
                md_lines.append("- **Table** — %s" % (w.get("title") or "(untitled)"))
                md_lines.append("")
                cols = w.get("columns") or []
                if cols:
                    md_lines.append("  | " + " | ".join(cols) + " |")
                    md_lines.append("  |" + "|".join(["---"] * len(cols)) + "|")
                for row in w.get("rows", []):
                    md_lines.append("  | " + " | ".join(c if c else " " for c in row) + " |")
                md_lines.append("")
            elif kind == "chart":
                md_lines.append("- **Chart** `%s` — %s (type: %s)" % (
                    w.get("canvas_id"), w.get("title"), w.get("chart_type")))
                md_lines.append("  - labels: %s" % json.dumps(w.get("labels"), ensure_ascii=False))
                for ds in w.get("datasets", []):
                    md_lines.append("  - dataset %r: %s" % (
                        ds.get("label"), json.dumps(ds.get("data"), ensure_ascii=False)))
                if w.get("options_notes"):
                    md_lines.append("  - options: %s" % ", ".join(w["options_notes"]))
            elif kind == "text":
                md_lines.append("- **Text** — %s" % w.get("text"))
            elif kind == "unresolved":
                md_lines.append("- **UNRESOLVED** — %s%s" % (
                    w.get("note", ""), (" :: " + w["text"]) if w.get("text") else ""))
            else:
                md_lines.append("- (unknown widget kind %r)" % kind)
        md_lines.append("")

    md_path = os.path.join(OUT_DIR, "welding-spec.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines) + "\n")

    # ------------------------------------------------------------------
    # Metrics catalogue
    # ------------------------------------------------------------------
    # metric name -> {"pages": set(), "kinds": set(), "grouped_by": set()}
    metrics = defaultdict(lambda: {"pages": set(), "kinds": set(), "grouped_by": set()})

    def grouping_dim_for_table(title, columns):
        dims = set()
        hay = " ".join([title or ""] + columns).lower()
        if "sub-contractor" in hay or "subcontractor" in hay:
            dims.add("subcontractor")
        if "wps" in hay or "service class" in hay:
            dims.add("WPS/service class")
        if "weld cat" in hay:
            dims.add("weld type (F/S weld category)")
        if "rt%" in hay or "rt 100" in hay.replace("%", "") or re.search(r"\brt\s*%|rt5|rt10|rt20|rt30|rt100", hay):
            dims.add("RT%")
        if re.search(r"\b\d{1,2}-\w{3}\b", hay):
            dims.add("week/date")
        return dims

    def grouping_dim_for_page(page_title):
        dims = set()
        t = (page_title or "").lower()
        for sub in ("ccc", "gac", "tekfen", "medgulf", "acciona"):
            if sub in t:
                dims.add("subcontractor")
        m = re.search(r"rt\s*(\d+)%", t)
        if m:
            dims.add("RT%")
        if "pwht" in t:
            dims.add("PWHT")
        if "slug catcher" in t or "slg service" in t:
            dims.add("area")
        if "wps" in t or "weld rejection detail" in t:
            dims.add("WPS")
        return dims

    for p in pages:
        page_dims = grouping_dim_for_page(p["title"])
        for w in p["widgets"]:
            kind = w.get("kind")
            if kind == "kpi":
                name = w.get("label")
                if name:
                    m = metrics[name]
                    m["pages"].add(p["page"])
                    m["kinds"].add("kpi")
                    m["grouped_by"] |= page_dims
            elif kind == "table":
                dims = grouping_dim_for_table(w.get("title"), w.get("columns") or []) | page_dims
                for col in (w.get("columns") or []):
                    if not col:
                        continue
                    m = metrics[col]
                    m["pages"].add(p["page"])
                    m["kinds"].add("table-column")
                    m["grouped_by"] |= dims
            elif kind == "chart":
                dims = set(page_dims)
                for ds in w.get("datasets", []):
                    lbl = ds.get("label")
                    if lbl:
                        m = metrics[lbl]
                        m["pages"].add(p["page"])
                        m["kinds"].add("chart-dataset")
                        m["grouped_by"] |= dims
                if w.get("title"):
                    m = metrics[w["title"]]
                    m["pages"].add(p["page"])
                    m["kinds"].add("chart-title")
                    m["grouped_by"] |= dims

    metrics_lines = []
    metrics_lines.append("# Welding Dashboard — Metric Catalogue")
    metrics_lines.append("")
    metrics_lines.append("De-duplicated list of every distinct metric name/label found across all "
                          "44 pages of `mockups/welding-dashboard 1.html`: KPI labels, table column "
                          "headers, chart dataset labels, and chart titles. Generated by "
                          "`analysis/mockups/extract_welding.py`; not an interpretation.")
    metrics_lines.append("")
    metrics_lines.append("| Metric | Seen as | Pages | Grouping dimension(s) observed |")
    metrics_lines.append("|---|---|---|---|")
    for name in sorted(metrics.keys(), key=lambda s: s.lower()):
        info = metrics[name]
        pages_str = ",".join(str(x) for x in sorted(info["pages"]))
        kinds_str = ", ".join(sorted(info["kinds"]))
        dims_str = ", ".join(sorted(info["grouped_by"])) if info["grouped_by"] else "(none detected)"
        safe_name = name.replace("|", "\\|")
        metrics_lines.append("| %s | %s | %s | %s |" % (safe_name, kinds_str, pages_str, dims_str))

    metrics_path = os.path.join(OUT_DIR, "welding-metrics.md")
    with open(metrics_path, "w", encoding="utf-8") as f:
        f.write("\n".join(metrics_lines) + "\n")

    # ------------------------------------------------------------------
    # Console summary (used for the verification bar)
    # ------------------------------------------------------------------
    n_tables = sum(1 for p in pages for w in p["widgets"] if w.get("kind") == "table")
    n_kpi = sum(1 for p in pages for w in p["widgets"] if w.get("kind") == "kpi")
    n_text = sum(1 for p in pages for w in p["widgets"] if w.get("kind") == "text")

    print("Pages extracted: %d" % len(pages))
    print("Total charts resolved with data: %d (of %d canvas ids found in script)" % (
        len(chart_widget_ids), len(chart_configs)))
    print("KPI widgets: %d" % n_kpi)
    print("Table widgets: %d" % n_tables)
    print("Text widgets: %d" % n_text)
    print("Unresolved widgets: %d" % unresolved_count)
    print("Distinct metrics catalogued: %d" % len(metrics))
    print("Wrote: %s" % json_path)
    print("Wrote: %s" % md_path)
    print("Wrote: %s" % metrics_path)


if __name__ == "__main__":
    main()
