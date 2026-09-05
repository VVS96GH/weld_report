#!/usr/bin/env python3
"""
Mechanical, read-only extractor for mockups/flange-dashboard 1.html.

Reads the mockup HTML+JS as text, pulls out:
  - the page structure (filters, KPI tiles, tables, charts) as "sections" of
    "widgets" in DOM order,
  - every JS data literal (rawData, palettes) verbatim, converted from
    JS-object-literal syntax to JSON,
  - a hand-written but source-verified description of every named function
    in <script>, including exact formula expressions copied from source,
  - global theme/mood/CSS-variable/external-resource info.

Writes:
  analysis/mockups/flange-spec.json
  analysis/mockups/flange-spec.md

Does not modify mockups/, sources/, app/, or any config. Stdlib only.
"""
import json
import re
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(REPO_ROOT, "mockups", "flange-dashboard 1.html")
OUT_JSON = os.path.join(REPO_ROOT, "analysis", "mockups", "flange-spec.json")
OUT_MD = os.path.join(REPO_ROOT, "analysis", "mockups", "flange-spec.md")

with open(SRC, "r", encoding="utf-8") as f:
    HTML = f.read()


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def find_balanced(text, open_idx):
    """Given the index of an opening '{', return the index just past its
    matching closing '}' (simple depth counter, no string/regex awareness
    needed for this file's data literals)."""
    depth = 0
    i = open_idx
    n = len(text)
    while i < n:
        c = text[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    raise ValueError("unbalanced braces starting at %d" % open_idx)


def js_object_literal_to_json(js_src):
    """Convert a *simple* JS object/array literal (as used in this file:
    unquoted or single-quoted keys, single-quoted strings, numbers, null,
    nested objects/arrays, no functions/comments/template strings inside)
    into valid JSON text."""
    s = js_src
    # 1) single-quoted strings -> double-quoted (values contain no quotes
    #    or backslashes in this file, verified by inspection)
    s = re.sub(r"'([^'\\]*)'", r'"\1"', s)
    # 2) unquoted identifier keys -> quoted keys
    s = re.sub(r'([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:', r'\1"\2":', s)
    # 3) trailing commas before } or ]
    s = re.sub(r',(\s*[}\]])', r'\1', s)
    return s


def extract_const_object(var_name):
    """Find `const <var_name> = {` ... matching `}` ... `;` and return the
    raw JS text of the object literal plus its [start,end] source line
    numbers (1-based, inclusive)."""
    m = re.search(r'const\s+' + re.escape(var_name) + r'\s*=\s*(\{)', HTML)
    if not m:
        return None, None
    open_idx = m.start(1)
    end_idx = find_balanced(HTML, open_idx)
    raw = HTML[open_idx:end_idx]
    start_line = HTML.count('\n', 0, m.start()) + 1
    end_line = HTML.count('\n', 0, end_idx) + 1
    return raw, (start_line, end_line)


def line_of(idx):
    return HTML.count('\n', 0, idx) + 1


# --------------------------------------------------------------------------
# 1. Global: doctype/theme/mood attrs, external resources, CSS vars, palettes
# --------------------------------------------------------------------------

def extract_global():
    g = {}
    m = re.search(r'<html[^>]*data-theme="([^"]+)"[^>]*data-mood="([^"]+)"', HTML)
    g["html_data_theme_default"] = m.group(1) if m else None
    g["html_data_mood_default"] = m.group(2) if m else None

    g["external_scripts"] = re.findall(r'<script src="([^"]+)"', HTML)
    g["external_stylesheets"] = re.findall(r'<link[^>]+href="([^"]+)"[^>]*rel="stylesheet"', HTML)

    style_block_m = re.search(r'<style>(.*?)</style>', HTML, re.S)
    style_text = style_block_m.group(1) if style_block_m else ""

    # Generic pass: every top-level selector block in <style> whose body is
    # ONLY custom-property declarations (contains '--', no other CSS
    # properties) is treated as a theme/mood CSS-variable block.
    css_vars = {}
    for sel_m in re.finditer(r'([^\{\}]+)\{([^{}]*)\}', style_text):
        selector = sel_m.group(1).strip()
        body = sel_m.group(2)
        decls = [d.strip() for d in body.split(';') if d.strip()]
        if not decls:
            continue
        if not all(d.startswith('--') for d in decls):
            continue
        vars_dict = {}
        for d in decls:
            name, _, value = d.partition(':')
            vars_dict[name.strip()] = value.strip()
        # selector may repeat (shouldn't in this file) -> keep first
        css_vars.setdefault(selector, vars_dict)
    g["css_variable_blocks"] = css_vars

    return g


# --------------------------------------------------------------------------
# 2. Data literals: rawData, palettes
# --------------------------------------------------------------------------

def extract_data():
    data = {}
    unresolved = []
    for var in ["rawData", "palettes"]:
        raw, lines = extract_const_object(var)
        if raw is None:
            unresolved.append({"kind": "unresolved", "note": "const %s not found in script" % var})
            continue
        json_text = js_object_literal_to_json(raw)
        try:
            parsed = json.loads(json_text)
        except json.JSONDecodeError as e:
            unresolved.append({
                "kind": "unresolved",
                "note": "const %s found (source lines %s) but failed JS->JSON conversion: %s" % (var, lines, e),
            })
            continue
        data[var] = parsed
    return data, unresolved, {
        "rawData": extract_const_object("rawData")[1],
        "palettes": extract_const_object("palettes")[1],
    }


# --------------------------------------------------------------------------
# 3. Page structure: filters, KPIs, tables, charts -> sections/widgets
# --------------------------------------------------------------------------

def widget_filter(select_id):
    m = re.search(r'<select id="%s">(.*?)</select>' % re.escape(select_id), HTML, re.S)
    body = m.group(1)
    options = re.findall(r'<option value="([^"]*)">([^<]*)</option>', body)
    return {
        "kind": "filter",
        "id": select_id,
        "options": [{"value": v, "label": l} for v, l in options],
        "default": options[0][0] if options else None,
    }


def widget_kpi(label, value_id, value_text, sub_text, sub_id=None):
    return {
        "kind": "kpi",
        "label": label,
        "value_id": value_id,
        "value": value_text,
        "sub": sub_text,
        "sub_id": sub_id,
    }


def find_card_line_with_id(dom_id):
    """Return the single HTML line (physical line, this file lays out one
    card per line) that contains the given element id, plus its own
    line number."""
    for i, line in enumerate(HTML.split('\n'), start=1):
        if 'id="%s"' % dom_id in line:
            return line, i
    return None, None


def nearest_h3(line):
    m = re.search(r'<h3[^>]*>([^<]*)</h3>', line)
    return m.group(1) if m else None


def nearest_badge(line):
    m = re.search(r'<span class="badge"[^>]*(?:id="([^"]+)")?[^>]*>([^<]*)</span>', line)
    if not m:
        return None, None
    return m.group(1), m.group(2)


CHART_TYPE_BY_CANVAS = {
    "inspectionDonut": "doughnut",
    "ha1ProgressDonut": "doughnut",
    "repairedDonut": "doughnut",
    "leakedTimelineChart": "line",
    "monthlyChart": "bar",
    "siteRepairChart": "bar",
    "vendorRepairChart": "bar",
}

RENDER_FN_BY_CANVAS = {
    "inspectionDonut": "renderInspectionDonut",
    "ha1ProgressDonut": "renderHA1ProgressDonut",
    "repairedDonut": "renderRepairedDonut",
    "leakedTimelineChart": "renderLeakedTimelineChart",
    "monthlyChart": "renderMonthlyChart",
    "siteRepairChart": "renderSiteRepairChart",
    "vendorRepairChart": "renderVendorRepairChart",
}


def widget_chart(canvas_id, labels, datasets, default_data_key, computed_by):
    line, ln = find_card_line_with_id(canvas_id)
    title = nearest_h3(line) if line else None
    badge_id, badge_text = nearest_badge(line) if line else (None, None)
    return {
        "kind": "chart",
        "canvas_id": canvas_id,
        "title": title,
        "chart_type": CHART_TYPE_BY_CANVAS[canvas_id],
        "labels": labels,
        "datasets": datasets,
        "source_line": ln,
        "render_function": RENDER_FN_BY_CANVAS[canvas_id],
        "default_filter_state": {"subco": "All", "ha": "All", "method": "All"},
        "default_data_source": default_data_key,
        "note": (
            "Chart is NOT a static hardcoded config (unlike welding-dashboard charts): "
            "labels/datasets above are the INITIAL render only, computed here in Python by "
            "replaying the exact source formula (see `logic.%s`) against `data.rawData` "
            "for the default filter state {subco:All, ha:All, method:All}. Changing any "
            "filter re-derives different values client-side; the full space of possible "
            "values is the data already captured in `data.rawData`." % computed_by
        ),
    }


def widget_table(tbody_id, title, columns, rows, computed_by, source_line, notes=None):
    return {
        "kind": "table",
        "id": tbody_id,
        "title": title,
        "columns": columns,
        "rows": rows,
        "source_line": source_line,
        "render_function": computed_by,
        "default_filter_state": {"subco": "All", "ha": "All", "method": "All"},
        "note": notes or (
            "Table body is populated by JS from `data.rawData` at runtime (empty <tbody> in "
            "static HTML). Rows above are the INITIAL render, computed here in Python by "
            "replaying the exact source formula in `logic.%s` for the default filter state." % computed_by
        ),
    }


def fmt(n):
    return "{:,}".format(n) if n else "0"


def pct2(numerator, denominator):
    if not denominator:
        return "0"
    return "{:.2f}".format((numerator / denominator) * 100)


# ---- Python re-implementation of the exact JS aggregation logic (see
# logic.getFilteredData / logic.renderSubcoTable / logic.renderHATable /
# logic.renderHA1SubcoTable / logic.renderInspectionDonut etc.), used ONLY
# to populate the "initial render" (all filters = 'All') values of chart
# and table widgets from the already-extracted rawData literal. ----

def get_filtered_data(raw, subco='All', ha='All', method='All'):
    result = {"total": 0, "constn": 0, "pcc": 0, "inspected": 0, "leaked": 0,
              "subcoList": [], "haList": [], "jointMethods": []}
    subcos = ["CCC", "GAC", "MEDGULF", "TEKFEN"] if subco == 'All' else [subco]
    has = ["HA1", "HA2", "HA3", "HA4"] if ha == 'All' else [ha]

    for s in subcos:
        if s not in raw["subco"]:
            continue
        row = {"name": s, "total": 0, "constn": 0, "pcc": 0, "inspected": 0, "leaked": 0}
        for h in has:
            if h not in raw["ha"] or s not in raw["ha"][h]["subco"]:
                continue
            d = raw["ha"][h]["subco"][s]
            if method == 'All':
                for k in ("total", "constn", "pcc", "inspected", "leaked"):
                    row[k] += d[k]
            else:
                md = d.get("methods", {}).get(method)
                if md:
                    for k in ("total", "constn", "pcc", "inspected", "leaked"):
                        row[k] += md[k]
        if row["total"] > 0:
            row["pct"] = pct2(row["inspected"], row["total"])
            result["subcoList"].append(row)
            for k in ("total", "constn", "pcc", "inspected", "leaked"):
                result[k] += row[k]

    for h in has:
        if h not in raw["ha"]:
            continue
        harow = {"name": h, "total": 0, "constn": 0, "pcc": 0, "inspected": 0, "leaked": 0, "details": []}
        methods = ["Manual", "TBN", "Tensioning", "Torquing"] if method == 'All' else [method]
        if subco == 'All':
            for m in methods:
                md = raw["ha"][h]["methods"].get(m)
                if not md:
                    continue
                for k in ("total", "constn", "pcc", "inspected", "leaked"):
                    harow[k] += md[k]
                harow["details"].append({
                    "method": m, "total": md["total"], "constn": md["constn"], "pcc": md["pcc"],
                    "inspected": md["inspected"],
                    "pct": pct2(md["inspected"], md["total"]) if md["total"] > 0 else 0,
                    "leaked": md["leaked"],
                })
        else:
            sd = raw["ha"][h]["subco"].get(subco)
            if not sd:
                continue
            if method == 'All':
                for k in ("total", "constn", "pcc", "inspected", "leaked"):
                    harow[k] = sd[k]
                if sd.get("methods"):
                    for m in methods:
                        if m in sd["methods"]:
                            md = sd["methods"][m]
                            harow["details"].append({
                                "method": m, "total": md["total"], "constn": md["constn"], "pcc": md["pcc"],
                                "inspected": md["inspected"],
                                "pct": pct2(md["inspected"], md["total"]) if md["total"] > 0 else 0,
                                "leaked": md["leaked"],
                            })
            else:
                md = sd.get("methods", {}).get(method)
                if md:
                    for k in ("total", "constn", "pcc", "inspected", "leaked"):
                        harow[k] = md[k]
                    harow["details"].append({
                        "method": method, "total": md["total"], "constn": md["constn"], "pcc": md["pcc"],
                        "inspected": md["inspected"],
                        "pct": pct2(md["inspected"], md["total"]) if md["total"] > 0 else 0,
                        "leaked": md["leaked"],
                    })
        if harow["total"] > 0:
            harow["pct"] = pct2(harow["inspected"], harow["total"])
            result["haList"].append(harow)

    jmethods = ["Manual", "Torquing", "Tensioning"] if method == 'All' else [method]
    for m in jmethods:
        mtotal = 0
        for h in has:
            if h not in raw["ha"]:
                continue
            if subco == 'All':
                if m in raw["ha"][h]["methods"]:
                    mtotal += raw["ha"][h]["methods"][m]["inspected"]
            else:
                sd = raw["ha"][h]["subco"].get(subco)
                if sd and sd.get("methods", {}).get(m):
                    mtotal += sd["methods"][m]["inspected"]
        if mtotal > 0:
            result["jointMethods"].append({"name": m, "value": mtotal, "pct": 0})
    jm_total = sum(x["value"] for x in result["jointMethods"])
    for jm in result["jointMethods"]:
        jm["pct"] = pct2(jm["value"], jm_total) if jm_total > 0 else 0

    result["pct"] = pct2(result["inspected"], result["total"]) if result["total"] > 0 else 0
    result["leakedPct"] = pct2(result["leaked"], result["inspected"]) if result["inspected"] > 0 else 0
    return result


def totals_row(rows, keys=("total", "constn", "pcc", "inspected", "leaked")):
    t = {k: sum(r[k] for r in rows) for k in keys}
    t["pct"] = pct2(t["inspected"], t["total"]) if t["total"] > 0 else 0
    return t


# --------------------------------------------------------------------------
# 4. Logic: hand-written (source-verified) description of every named
#    function, with exact formula strings copied from HTML.
# --------------------------------------------------------------------------

def build_logic():
    fn_lines = {}
    for m in re.finditer(r'function\s+(\w+)\s*\(([^)]*)\)', HTML):
        name = m.group(1)
        params = [p.strip() for p in m.group(2).split(',') if p.strip()]
        fn_lines[name] = {"line": line_of(m.start()), "parameters": params}

    descriptions = {
        "resetFilters": (
            "Sets filters.{subco,ha,method} back to 'All', resets the three <select> "
            "elements to 'All', and calls applyFilters(). No formula (state reset only).",
            [],
        ),
        "getFilteredData": (
            "The core aggregator. Given the current `filters` (subco/ha/method), sums "
            "rawData.ha[<HA>].subco[<Subco>] (or its .methods[<Method>] sub-object when a "
            "method filter is active) across the selected HA(s) and subcontractor(s) into "
            "result.{total,constn,pcc,inspected,leaked}, plus per-subco rows (subcoList), "
            "per-HA rows with per-method detail rows (haList), and per-method inspected "
            "totals for the donut (jointMethods). Also computes overall %, leaked % and "
            "(within jointMethods) each method's share of the joint-method total.",
            [
                "subcoRow.pct = ((subcoRow.inspected / subcoRow.total) * 100).toFixed(2)",
                "haRow.pct = ((haRow.inspected / haRow.total) * 100).toFixed(2)",
                "detail.pct = md.total > 0 ? ((md.inspected / md.total) * 100).toFixed(2) : 0",
                "jm.pct = jmTotal > 0 ? ((jm.value / jmTotal) * 100).toFixed(2) : 0",
                "result.pct = result.total > 0 ? ((result.inspected / result.total) * 100).toFixed(2) : 0",
                "result.leakedPct = result.inspected > 0 ? ((result.leaked / result.inspected) * 100).toFixed(2) : 0",
            ],
        ),
        "applyFilters": (
            "Orchestrator run on load, on any filter change, and on theme/mood switch. Calls "
            "getFilteredData(), writes the summary-card / bubble text nodes from the result, "
            "relabels the HA1 section title to the selected HA (or 'HA 1' when HA filter is "
            "'All'), then calls rebuildCharts(d).",
            [
                "pccPct = d.total > 0 ? ((d.pcc / d.total) * 100).toFixed(2) : 0",
            ],
        ),
        "rebuildCharts": (
            "Destroys every live Chart.js instance in `charts`, clears the registry, then "
            "re-renders all charts/tables after a 50ms setTimeout (renderAll(d)). No formula.",
            [],
        ),
        "renderAll": (
            "Calls, in order: renderInspectionDonut, renderSubcoTable, renderHATable, "
            "renderHA1SubcoTable, renderHA1ProgressDonut, renderLeakedTimelineChart, "
            "renderRepairedDonut, renderMonthlyChart, renderSiteRepairChart, "
            "renderVendorRepairChart. No formula (dispatcher only).",
            [],
        ),
        "toggleTheme": (
            "Flips currentTheme between 'dark'/'light', persists to localStorage, updates the "
            "sun/moon icon, and re-runs applyFilters() (so charts re-read CSS var colors). No "
            "formula.",
            [],
        ),
        "toggleMoodDropdown": (
            "Toggles the .open class on the mood dropdown menu. No formula (UI only).",
            [],
        ),
        "selectMood": (
            "Sets currentMood, persists to localStorage, updates the mood icon/label/active "
            "option, restarts the Christmas-garland animation if mood is 'upsidedown', and "
            "re-runs applyFilters(). No formula.",
            [],
        ),
        "getColors": (
            "Returns palettes[currentMood].colors, the 8-color array charts pull "
            "backgroundColor/borderColor entries from by index. No formula.",
            [],
        ),
        "startGarland": (
            "Every 800ms, lights a random 6-10 subset of .garland-bulb elements (cosmetic "
            "'Upside Down' mood effect). Formula: n = Math.floor(Math.random() * 5) + 6 "
            "(random integer in [6,10]); not data-driven.",
            ["n = Math.floor(Math.random() * 5) + 6"],
        ),
        "renderInspectionDonut": (
            "Builds the 'Project Flange Inspected' doughnut from d.jointMethods (falls back "
            "to a single 'No Data' slice of value 1 when empty), sets #donutCenter to "
            "fmt(d.inspected), and rebuilds the outside legend with each slice's value and %. "
            "d.jointMethods itself is produced by getFilteredData().",
            ["d.jointMethods.length > 0 ? d.jointMethods : [{ name: 'No Data', value: 1, pct: 100 }]"],
        ),
        "renderHA1ProgressDonut": (
            "Picks a lookup key into rawData.ha1Progress: '<HA>_<Subco>' if both HA and "
            "subco filters are set, else '<HA>' if only HA is set, else '<Subco>' if only "
            "subco is set, else 'All'. If that key maps to null/undefined (e.g. HA2-4 with no "
            "subco filter), shows '(Blank)'. Otherwise splits total into Inspected Const / "
            "Inspected PCC / Remains (dropping any zero-value slice) and renders the donut + "
            "legend.",
            [
                "progressKey = filters.ha + '_' + filters.subco  (both set)",
                "pct = total > 0 ? ((constn / total) * 100).toFixed(2) : 0   // Inspected Const slice",
                "pct = total > 0 && pcc > 0 ? ((pcc / total) * 100).toFixed(2) : 0   // Inspected PCC slice",
                "pct = total > 0 ? ((Math.max(0, remains) / total) * 100).toFixed(2) : 0   // Remains slice",
            ],
        ),
        "renderRepairedDonut": (
            "Picks a lookup key into rawData.repair using the same "
            "'<HA>_<Subco>' > '<Subco>' > '<HA>' > 'All' precedence as the timeline/monthly "
            "charts (falls back through rawData.repair[filters.subco]/[filters.ha]/.All if the "
            "combo key is absent). Renders a 2-slice donut (Repaired vs To be Repaired) with "
            "rounded percentages, or a single grey 'No Data' slice if total is 0.",
            [
                "pct = total > 0 ? Math.round((repairData.repaired / total) * 100) : 0",
                "pct = total > 0 ? Math.round((repairData.toRepair / total) * 100) : 0",
            ],
        ),
        "renderLeakedTimelineChart": (
            "Same key-lookup precedence as renderRepairedDonut but against "
            "rawData.leakedTimeline, to get a list of {date, pct} points for the line chart "
            "(min 0 / max 0.06 y-axis, tooltip shows pct to 2dp with a '%' suffix). The "
            "#leakedBadge text uses `d.leaked` from a *fresh* getFilteredData() call, not the "
            "timeline series itself.",
            ["ctx => `${ctx.parsed.y.toFixed(2)}%`  // tooltip label"],
        ),
        "renderMonthlyChart": (
            "Key precedence: '<HA>_<Subco>' > '<HA>_<Method>' > '<Subco>' > '<HA>' > 'All' "
            "into rawData.monthly, to get an [{month, value}] series rendered as a single bar "
            "series labelled 'Inspected'. No percentage formula (raw counts only).",
            [],
        ),
        "renderSiteRepairChart": (
            "Same '<HA>_<Subco>' > '<Subco>' > '<HA>' > 'All' precedence into rawData.repair, "
            "reading .site (grouped by month, split into CCC/GAC bar series). Badge = sum of "
            "ccc+gac across all months in the selected .site array.",
            ["total = repairData.site.reduce((a, x) => a + (x.ccc || 0) + (x.gac || 0), 0)"],
        ),
        "renderVendorRepairChart": (
            "Identical to renderSiteRepairChart but reads .vendor instead of .site (Flange "
            "Repair - Vendor Issue chart).",
            ["total = repairData.vendor.reduce((a, x) => a + (x.ccc || 0) + (x.gac || 0), 0)"],
        ),
        "renderSubcoTable": (
            "Renders the 'Subcontractor Flange Status' table body from d.subcoList (the "
            "current filtered per-subco rows from getFilteredData), plus a totals row summed "
            "across subcoList.",
            [
                "t.pct = t.total > 0 ? ((t.inspected / t.total) * 100).toFixed(2) : 0",
            ],
        ),
        "renderHA1SubcoTable": (
            "Renders the 'HA1 Subcontractor Flange Status' table independently of "
            "getFilteredData: target HA = filters.ha, or 'HA1' when filters.ha is 'All'; for "
            "each subco in scope, reads rawData.ha[<target>].subco[<Subco>] directly (ignores "
            "the method filter entirely) and computes each row's % plus a totals row.",
            [
                "pct = ((sd.inspected / sd.total) * 100).toFixed(2)   // per subco row, method filter ignored",
                "t.pct = t.total > 0 ? ((t.inspected / t.total) * 100).toFixed(2) : 0",
            ],
        ),
        "toggleHADetails": (
            "Flips expandedHAs[haName] and re-runs applyFilters() to redraw the HA table with "
            "that HA's method detail rows shown/hidden. No formula.",
            [],
        ),
        "renderHATable": (
            "Renders the 'HA Flange Status' table body from d.haList (rows), with each row's "
            "d.details sub-array rendered as extra (initially hidden) detail rows when that HA "
            "is expanded, plus a totals row summed across haList.",
            [
                "t.pct = t.total > 0 ? ((t.inspected / t.total) * 100).toFixed(2) : 0",
            ],
        ),
        "fmt": (
            "Number -> locale string formatter used everywhere a count is displayed: "
            "n ? n.toLocaleString() : '0' (so 0/undefined/null all render as the string '0').",
            ["n ? n.toLocaleString() : '0'"],
        ),
        "exportData": (
            "Builds one big CSV string (10 sections: subco summary, HA-by-subco breakdown, HA "
            "methods summary, HA>subco>method detail, ha1Progress, monthly, repair summary, "
            "site repair by month, vendor repair by month, leaked timeline) by iterating "
            "Object.entries() over the *entire* rawData object (all filter-key combinations, "
            "not just the current filter selection), then triggers a client-side download via "
            "a Blob + <a download>. Only formula: the subcontractor-summary totals row's "
            "leaked %.",
            [
                "subcoTotal.total > 0 ? ((subcoTotal.leaked / subcoTotal.inspected) * 100).toFixed(2) : 0",
            ],
        ),
    }

    logic = {}
    for name, meta in fn_lines.items():
        desc, formulas = descriptions.get(name, ("UNRESOLVED: no hand-written description authored for this function.", []))
        logic[name] = {
            "name": name,
            "parameters": meta["parameters"],
            "source_line": meta["line"],
            "description": desc,
            "formulas": formulas,
        }
    return logic


# --------------------------------------------------------------------------
# 5. Assemble sections/widgets
# --------------------------------------------------------------------------

def build_sections(raw_data):
    default = get_filtered_data(raw_data)

    sections = []

    # -- Section: Filters --------------------------------------------------
    reset_line, _ = None, None
    for i, line in enumerate(HTML.split('\n'), start=1):
        if 'onclick="resetFilters()"' in line:
            reset_line = i
        if 'onclick="exportData()"' in line:
            export_line = i
    sections.append({
        "id": "filterBar",
        "title": "Filters",
        "title_source": "synthesized (container has no h2/h3; class=\"filter-bar\")",
        "widgets": [
            widget_filter("filterSubco"),
            widget_filter("filterHA"),
            widget_filter("filterMethod"),
            {"kind": "text", "text": "✕ Reset", "role": "button", "onclick": "resetFilters()", "source_line": reset_line},
            {"kind": "text", "text": "\U0001F4CA Export", "role": "button", "onclick": "exportData()", "source_line": export_line},
        ],
    })

    # -- Section: Summary highlights ----------------------------------------
    sections.append({
        "id": "summaryHighlights",
        "title": "Summary Highlights",
        "title_source": "synthesized (container has no h2/h3; class=\"summary-highlights\", 4 .summary-card tiles)",
        "widgets": [
            widget_kpi("Total Register", "sumTotal", fmt(default["total"]), "Flanges"),
            widget_kpi("Total Inspected", "sumInspected", fmt(default["inspected"]), default["pct"] + "%", sub_id="sumInspectedPct"),
            widget_kpi("Inspected Const-n", "sumConstn", fmt(default["constn"]), "Construction"),
            widget_kpi("Leaked Flange Break", "sumLeaked", fmt(default["leaked"]) if default["leaked"] else "(Blank)", default["leakedPct"] + "%", sub_id="sumLeakedPct"),
        ],
        "note": "Values shown are the initial render (filters=All), computed in Python via getFilteredData(rawData) mirroring the JS applyFilters() DOM writes.",
    })

    # -- Section: Inspection donut + subco/HA tables -------------------------
    jm = default["jointMethods"]
    subco_rows = default["subcoList"]
    subco_total = totals_row(subco_rows)
    ha_rows = default["haList"]
    ha_total = totals_row(ha_rows)

    sections.append({
        "id": "dashboardGrid1",
        "title": "Project Inspection & Status Tables",
        "title_source": "synthesized (container has no h2/h3; class=\"dashboard-grid\", first grid, 3 cards each with its own h3)",
        "widgets": [
            widget_chart(
                "inspectionDonut",
                labels=[x["name"] for x in jm],
                datasets=[{"data": [x["value"] for x in jm], "pct": [x["pct"] for x in jm]}],
                default_data_key="rawData.ha[HA1..HA4].methods[Manual|Torquing|Tensioning].inspected, summed",
                computed_by="renderInspectionDonut",
            ),
            widget_table(
                "subcoBody", "Subcontractor Flange Status",
                columns=["Subcontractor", "Total", "Const-n", "PCC", "Inspected", "%", "Leaked"],
                rows={"subcontractors": subco_rows, "total": subco_total},
                computed_by="renderSubcoTable",
                source_line=364,
            ),
            widget_table(
                "haBody", "HA Flange Status",
                columns=["HA / Method", "Total", "Const-n", "PCC", "Inspected", "%", "Leaked"],
                rows={"ha_rows_with_method_detail": ha_rows, "total": ha_total},
                computed_by="renderHATable",
                source_line=365,
                notes="Each HA row carries a `details` list of per-method rows (Manual/TBN/Tensioning/Torquing), "
                      "shown/hidden client-side by toggleHADetails() -- not separate table rows in the source markup.",
            ),
        ],
    })

    # -- Section: HA1 focus (id="ha1Section" in source) ----------------------
    ha1_target = "HA1"
    ha1_rows = []
    for s in ["CCC", "GAC", "MEDGULF", "TEKFEN"]:
        sd = raw_data["ha"][ha1_target]["subco"].get(s)
        if sd:
            ha1_rows.append({
                "name": s, "total": sd["total"], "constn": sd["constn"], "pcc": sd["pcc"],
                "inspected": sd["inspected"], "pct": pct2(sd["inspected"], sd["total"]), "leaked": sd["leaked"],
            })
    ha1_total = totals_row(ha1_rows)
    ha1p = raw_data["ha1Progress"]["All"]
    progress = []
    for name, value in (("Inspected Const", ha1p["constn"]), ("Inspected PCC", ha1p["pcc"]), ("Remains", ha1p["remains"])):
        if value > 0:
            progress.append({"name": name, "value": value, "pct": pct2(value, ha1p["total"])})

    sections.append({
        "id": "ha1Section",
        "title": "HA1 Subcontractor & Progress",
        "title_source": "synthesized (grid container DOES carry id=\"ha1Section\" but no own h2/h3; the 2 cards inside have their own h3, dynamically retitled to the selected HA)",
        "widgets": [
            widget_table(
                "ha1SubcoBody", "HA 1 Subcontractor Flange Status",
                columns=["Subcontractor", "Total", "Const-n", "PCC", "Inspected", "%", "Leaked"],
                rows={"subcontractors": ha1_rows, "total": ha1_total},
                computed_by="renderHA1SubcoTable",
                source_line=369,
                notes="Title/badge relabel to the selected HA when the HA filter != All (source: applyFilters(), "
                      "elements #ha1SubcoTitle/#ha1Badge). Method filter is ignored by this table (see logic.renderHA1SubcoTable).",
            ),
            widget_chart(
                "ha1ProgressDonut",
                labels=[x["name"] for x in progress],
                datasets=[{"data": [x["value"] for x in progress], "pct": [x["pct"] for x in progress]}],
                default_data_key="rawData.ha1Progress.All",
                computed_by="renderHA1ProgressDonut",
            ),
        ],
    })

    # -- Section: Leaked timeline (standalone full-width card, real h3) ------
    timeline = raw_data["leakedTimeline"]["All"]
    sections.append({
        "id": "leakedTimelineCard",
        "title": "Leaked Flange Break % Timeline",
        "title_source": "h3",
        "widgets": [
            widget_chart(
                "leakedTimelineChart",
                labels=[t["date"] for t in timeline],
                datasets=[{"label": "Leaked Flg Break %", "data": [t["pct"] for t in timeline]}],
                default_data_key="rawData.leakedTimeline.All",
                computed_by="renderLeakedTimelineChart",
            ),
        ],
    })

    # -- Section: Repair overview (grid-3, 3 cards each with own h3) --------
    repair_all = raw_data["repair"]["All"]
    rd_total = repair_all["repaired"] + repair_all["toRepair"]
    rd = [
        {"name": "Repaired", "value": repair_all["repaired"], "pct": round(repair_all["repaired"] / rd_total * 100) if rd_total else 0},
        {"name": "To be Repaired", "value": repair_all["toRepair"], "pct": round(repair_all["toRepair"] / rd_total * 100) if rd_total else 0},
    ]
    site = repair_all["site"]
    vendor = repair_all["vendor"]
    sections.append({
        "id": "repairGrid",
        "title": "Repair Overview",
        "title_source": "synthesized (container has no h2/h3; class=\"grid-3\", 3 cards each with own h3)",
        "widgets": [
            widget_chart(
                "repairedDonut",
                labels=[x["name"] for x in rd],
                datasets=[{"data": [x["value"] for x in rd], "pct": [x["pct"] for x in rd]}],
                default_data_key="rawData.repair.All",
                computed_by="renderRepairedDonut",
            ),
            widget_chart(
                "siteRepairChart",
                labels=[m["month"] for m in site],
                datasets=[
                    {"label": "CCC", "data": [m.get("ccc", 0) for m in site]},
                    {"label": "GAC", "data": [m.get("gac", 0) for m in site]},
                ],
                default_data_key="rawData.repair.All.site",
                computed_by="renderSiteRepairChart",
            ),
            widget_chart(
                "vendorRepairChart",
                labels=[m["month"] for m in vendor],
                datasets=[
                    {"label": "CCC", "data": [m.get("ccc", 0) for m in vendor]},
                    {"label": "GAC", "data": [m.get("gac", 0) for m in vendor]},
                ],
                default_data_key="rawData.repair.All.vendor",
                computed_by="renderVendorRepairChart",
            ),
        ],
    })

    # -- Section: Inspection Progress Overview (bubbles, standalone card) ---
    pcc_pct = pct2(default["pcc"], default["total"]) if default["total"] else "0"
    sections.append({
        "id": "inspectionProgressOverview",
        "title": "Inspection Progress Overview",
        "title_source": "h3",
        "widgets": [
            widget_kpi("Inspected", "bubbleInspVal", fmt(default["inspected"]), default["pct"] + "%", sub_id="bubbleInspPct"),
            {
                **widget_kpi("PCC", "bubblePccVal", fmt(default["pcc"]), pcc_pct + "%", sub_id="bubblePccPct"),
                "note": (
                    "DEVIATION FOUND IN SOURCE: the static HTML placeholder for #bubblePccPct/#legendPcc is "
                    "1.83 percent (= pcc/inspected = 2276/124188), but the live JS formula at source line 745 "
                    "(`pccPct = d.total > 0 ? ((d.pcc / d.total) * 100).toFixed(2) : 0`) computes pcc/total = "
                    "2276/358342 = " + pcc_pct + " percent, and DOMContentLoaded always calls applyFilters() on "
                    "load, so the 1.83 percent placeholder is immediately overwritten and never actually shown "
                    "to a user. The value above (" + pcc_pct + "%) is the JS-computed one; the static markup's "
                    "1.83% is stale/wrong."
                ),
            },
            widget_kpi("Leaked", "bubbleLeakVal", fmt(default["leaked"]) if default["leaked"] else "(Blank)", default["leakedPct"] + "%", sub_id="bubbleLeakPct"),
        ],
        "note": "Rendered twice in the source markup as differently-styled 'bubbles' + an outside legend "
                "with identical values (#legendInsp/#legendPcc/#legendLeak) -- captured once here as 3 kpi widgets.",
    })

    # -- Section: Monthly inspection (standalone full-width card, real h3) --
    monthly_all = raw_data["monthly"]["All"]
    sections.append({
        "id": "monthlyChartCard",
        "title": "Monthly Inspection",
        "title_source": "h3",
        "widgets": [
            widget_chart(
                "monthlyChart",
                labels=[m["month"] for m in monthly_all],
                datasets=[{"label": "Inspected", "data": [m["value"] for m in monthly_all]}],
                default_data_key="rawData.monthly.All",
                computed_by="renderMonthlyChart",
            ),
        ],
    })

    return sections


# --------------------------------------------------------------------------
# 6. Markdown rendering
# --------------------------------------------------------------------------

def distinct(records, key):
    vals = set()
    for r in records:
        if isinstance(r, dict) and key in r:
            vals.add(r[key])
    return sorted(vals)


def describe_data_literal(name, obj):
    lines = [f"### `{name}`", ""]
    if name == "rawData":
        lines.append("Top-level keys: `" + "`, `".join(obj.keys()) + "`")
        lines.append("")
        lines.append("- `rawData.subco` -- 1 record per subcontractor (4 records). Distinct subcontractors: "
                      + ", ".join(obj["subco"].keys()) + ". Fields per record: "
                      + ", ".join(next(iter(obj["subco"].values())).keys()) + ".")
        ha_keys = list(obj["ha"].keys())
        lines.append(f"- `rawData.ha` -- 1 record per HA ({len(ha_keys)} records: {', '.join(ha_keys)}), each with "
                      "`.subco{CCC,GAC,MEDGULF,TEKFEN}` (present only where non-zero) and `.methods{Manual,TBN,Tensioning,Torquing}` "
                      "sub-objects; each `.subco[x]` in turn carries its own `.methods{...}` breakdown. Leaf fields: "
                      "total, constn, pcc, inspected, leaked.")
        n_timeline_keys = len(obj["leakedTimeline"])
        n_timeline_points = sum(len(v) for v in obj["leakedTimeline"].values())
        lines.append(f"- `rawData.leakedTimeline` -- {n_timeline_keys} filter-key series (`All`, each HA, each Subco, "
                      f"and `HA1_<Subco>` combos), {n_timeline_points} `{{date, pct}}` points total. Fields: date (string, "
                      "e.g. '05-Dec-25'), pct (number, %).")
        n_repair_keys = len(obj["repair"])
        lines.append(f"- `rawData.repair` -- {n_repair_keys} filter-key records (same key shape as leakedTimeline). "
                      "Fields per record: repaired (int), toRepair (int), site (array of {month, ccc, gac}), "
                      "vendor (array of {month, ccc, gac}).")
        n_monthly_keys = len(obj["monthly"])
        lines.append(f"- `rawData.monthly` -- {n_monthly_keys} filter-key series (`All`, each Subco, each HA, "
                      "`HA1_<Subco>` combos, plus one `HA1_Manual` method combo), each an array of 6 `{{month, value}}` "
                      "points (Aug-Jan). Distinct months: " + ", ".join(distinct(obj["monthly"]["All"], "month")) + ".")
        n_progress_keys = len(obj["ha1Progress"])
        n_progress_null = sum(1 for v in obj["ha1Progress"].values() if v is None)
        lines.append(f"- `rawData.ha1Progress` -- {n_progress_keys} filter-key records ({n_progress_null} are `null`: "
                      "HA2/HA3/HA4 with no matching progress breakdown). Fields per non-null record: total, constn, pcc, remains.")
    elif name == "palettes":
        lines.append(f"{len(obj)} mood palettes: " + ", ".join(obj.keys()) + ". Each record has fields: "
                      + ", ".join(next(iter(obj.values())).keys()) + " (colors is an 8-entry hex array).")
    return "\n".join(lines) + "\n"


def render_markdown(spec):
    lines = []
    lines.append("# Flange Management Dashboard -- extracted spec")
    lines.append("")
    lines.append(f"Source: `mockups/flange-dashboard 1.html` (single-page, filter-driven via "
                  f"`filterHA`/`filterSubco`/`filterMethod`). Extracted by `analysis/mockups/extract_flange.py`.")
    lines.append("")

    lines.append("## Global")
    lines.append("")
    g = spec["global"]
    lines.append(f"- `<html data-theme=\"{g['html_data_theme_default']}\" data-mood=\"{g['html_data_mood_default']}\">` "
                  "(dark theme, pastel mood by default; both are toggled client-side and persisted to localStorage).")
    lines.append("- External scripts: " + ", ".join(g["external_scripts"]))
    lines.append("- External stylesheets: " + ", ".join(g["external_stylesheets"]))
    lines.append(f"- {len(g['css_variable_blocks'])} CSS custom-property blocks found in `<style>` "
                  "(`:root` + one block per mood, plus a `[data-theme=\"light\"]` variant of each mood): "
                  + ", ".join(f"`{k}`" for k in g["css_variable_blocks"].keys()))
    lines.append(f"- JS `palettes` object mirrors the moods: {', '.join(spec['data']['palettes'].keys())} "
                  "(each gives colors[8], icon, label -- charts read colors via getColors()/palettes[currentMood].colors).")
    lines.append("")

    lines.append("## Sections & widgets")
    lines.append("")
    n_chart = n_table = n_filter = n_kpi = n_text = 0
    for sec in spec["sections"]:
        lines.append(f"### {sec['title']}  (`id={sec['id']}`, title source: {sec['title_source']})")
        lines.append("")
        for w in sec["widgets"]:
            k = w["kind"]
            if k == "filter":
                n_filter += 1
                opts = ", ".join(f"{o['value']}" for o in w["options"])
                lines.append(f"- **filter** `#{w['id']}` -- options: [{opts}], default: `{w['default']}`")
            elif k == "kpi":
                n_kpi += 1
                lines.append(f"- **kpi** {w['label']} (`#{w['value_id']}`) = {w['value']}"
                              + (f", sub = {w['sub']} (`#{w['sub_id']}`)" if w.get("sub_id") else f", sub = {w['sub']}" if w.get("sub") else ""))
            elif k == "table":
                n_table += 1
                lines.append(f"- **table** \"{w['title']}\" (`#{w['id']}`, populated by `{w['render_function']}()`) -- "
                              f"columns: {w['columns']}")
            elif k == "chart":
                n_chart += 1
                lines.append(f"- **chart** \"{w['title']}\" (`#{w['canvas_id']}`, `{w['chart_type']}`, rendered by "
                              f"`{w['render_function']}()`) -- initial labels: {w['labels']}")
            elif k == "text":
                n_text += 1
                lines.append(f"- **text/button** \"{w['text']}\" -- `onclick=\"{w.get('onclick')}\"`")
        lines.append("")

    lines.append(f"Widget totals: {n_chart} chart, {n_table} table, {n_filter} filter, {n_kpi} kpi, {n_text} text/button.")
    lines.append("")

    lines.append("## Data")
    lines.append("")
    lines.append("All values are hardcoded JS object/array literals (const `rawData`, const `palettes`) parsed "
                  "verbatim out of the `<script>` block -- there is no server call and no `<table>` markup carrying "
                  "the numbers (the 3 `<table>` elements in the HTML all ship with empty `<tbody>`, filled by JS).")
    lines.append("")
    for name, obj in spec["data"].items():
        lines.append(describe_data_literal(name, obj))

    lines.append("## Logic")
    lines.append("")
    lines.append(f"{len(spec['logic'])} named `function` declarations found in `<script>` (no top-level named "
                  "arrow-function declarations exist in this file -- all arrow functions are inline callbacks to "
                  "forEach/map/reduce/addEventListener, documented inline within the owning function's entry below "
                  "rather than separately).")
    lines.append("")
    for name, meta in spec["logic"].items():
        lines.append(f"### `{name}({', '.join(meta['parameters'])})`  (line {meta['source_line']})")
        lines.append("")
        lines.append(meta["description"])
        if meta["formulas"]:
            lines.append("")
            lines.append("Formulas (verbatim from source):")
            for f in meta["formulas"]:
                lines.append(f"- `{f}`")
        lines.append("")

    return "\n".join(lines)


SOURCE_GAP_MD = """## Source data gap

This dashboard's entire dataset lives in the JS literal `rawData` embedded in the mockup HTML
(see "Data" above) -- it is a static snapshot, not a live query. To port it, the app needs to
compute the following fields, none of which exist in `sources/`:

- **Per-flange join facts** the mockup implies but never lists individually: Sub-Contractor
  (CCC / GAC / MEDGULF / TEKFEN), HA (HA1-HA4), Joint Method (Manual / Torquing / Tensioning /
  TBN), an inspection/construction/PCC/"leaked" status, and an inspection date (for the monthly
  and weekly-timeline breakdowns) and repair date + repair-cause (site vs vendor) for repaired
  flanges. `rawData` only ever holds pre-aggregated counts (total / constn / pcc / inspected /
  leaked / repaired / toRepair) sliced by these dimensions -- never row-level records.
- **`sources/Weld Dump.txt`** (per CLAUDE.md: ~630MB, 1,002,373 rows, 226 columns,
  semicolon-delimited) is a **weld** register: one row = one weld, with weld-level columns
  (`ISO Number`, `Spool No.`, `Weld No.`, `Weld Cat`, `Weld Type`, `Sub-Contractor`, `WPS No.`,
  `Welder`, `Weld Date`, and the repeating PWHT/HT/RT/UT/MT/PMI/PT/FN/PADLT/ORIF inspection-method
  block). It has no flange-identity column, no "HA" column, no joint method
  (Manual/Torquing/Tensioning/TBN) column, and no flange leak/repair status column.
- **`sources/*.pbix`** (~1GB Power BI file) is reference-only and not machine-readable as text
  per CLAUDE.md, so it cannot be inspected here to confirm whether it contains a flange register.

**No flange source file is present in this repo.** `sources/` contains only the weld dump and the
`.pbix`; neither was inspected further for this task beyond what CLAUDE.md already documents,
per the read-only/no-`sources/`-modification scope of this extraction. Porting this dashboard to
live data requires locating (or being handed) a flange register with the fields listed above --
this extraction cannot and does not speculate about where such a register would come from.
"""


def main():
    global_ = extract_global()
    data, unresolved, data_lines = extract_data()
    logic = build_logic()
    sections = build_sections(data["rawData"])

    spec = {
        "sections": sections,
        "data": data,
        "logic": logic,
        "global": global_,
        "unresolved": unresolved,
        "_meta": {
            "source_file": "mockups/flange-dashboard 1.html",
            "data_literal_source_lines": data_lines,
        },
    }

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(spec, f, indent=2, ensure_ascii=False)
        f.write("\n")

    md = render_markdown(spec)
    md += "\n" + SOURCE_GAP_MD
    with open(OUT_MD, "w", encoding="utf-8") as f:
        f.write(md)

    # ---- console summary for the verification bar ----
    n_canvas_html = len(re.findall(r'<canvas', HTML))
    n_table_html = len(re.findall(r'<table', HTML))
    n_select_html = len(re.findall(r'<select', HTML))
    n_chart_json = sum(1 for s in sections for w in s["widgets"] if w["kind"] == "chart")
    n_table_json = sum(1 for s in sections for w in s["widgets"] if w["kind"] == "table")
    n_filter_json = sum(1 for s in sections for w in s["widgets"] if w["kind"] == "filter")
    n_fn_html = len(re.findall(r'function ', HTML))
    n_fn_json = len(logic)
    n_data_literals = len(data)
    record_counts = {
        "rawData.subco": len(data["rawData"]["subco"]),
        "rawData.ha": len(data["rawData"]["ha"]),
        "rawData.leakedTimeline": len(data["rawData"]["leakedTimeline"]),
        "rawData.repair": len(data["rawData"]["repair"]),
        "rawData.monthly": len(data["rawData"]["monthly"]),
        "rawData.ha1Progress": len(data["rawData"]["ha1Progress"]),
        "palettes": len(data["palettes"]),
    }

    print("canvas in HTML:", n_canvas_html, "| chart widgets in JSON:", n_chart_json)
    print("<table in HTML:", n_table_html, "| table widgets in JSON:", n_table_json)
    print("<select in HTML:", n_select_html, "| filter widgets in JSON:", n_filter_json)
    print("functions ('function ' count) in HTML:", n_fn_html, "| functions documented in JSON:", n_fn_json)
    print("data literals captured:", n_data_literals, "->", data.keys())
    print("record counts:", record_counts)
    print("unresolved items:", len(unresolved))
    for u in unresolved:
        print("  -", u)
    print("wrote", OUT_JSON)
    print("wrote", OUT_MD)


if __name__ == "__main__":
    main()
