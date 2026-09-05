#!/usr/bin/env node
// token-lint: CI guard for the T.EN design system.
//
// Checks WCAG contrast ratios of the token pairs defined in
// app/styles/tokens.css (dark scheme = `:root[data-mood="ten"]`, light
// scheme = `:root[data-mood="ten"][data-theme="light"]`), and scans
// component source for raw colours, Tailwind opacity-modifier "alpha
// traps" on semantic tokens, and physical (non-logical) direction
// utilities.
//
// See scripts/README-token-lint.md for the rule table and escape hatches.
//
// Usage:
//   node scripts/token-lint.mjs [--tokens <path>] [--src <glob,glob,...>] [--json]
//
// Exit codes: 0 = clean, 1 = one or more FAILs, 2 = tokens file missing.

import { existsSync, readFileSync } from "node:fs";
import { globSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { tokens: "app/styles/tokens.css", src: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tokens") out.tokens = argv[++i];
    else if (a === "--src") out.src = argv[++i];
    else if (a === "--json") out.json = true;
  }
  return out;
}

const DEFAULT_SRC_GLOBS = [
  "app/**/*.tsx",
  "components/**/*.tsx",
  "lib/**/*.ts",
  "lib/**/*.tsx",
];

// ---------------------------------------------------------------------------
// Colour parsing
// ---------------------------------------------------------------------------

const KEYWORD_COLORS = {
  white: "#ffffff",
  black: "#000000",
  transparent: "rgba(0,0,0,0)",
};

/** Parse a fully-resolved CSS colour literal into {r,g,b,a} (0-255, 0-1). */
export function parseColor(raw) {
  if (typeof raw !== "string") return null;
  let value = raw.trim();
  if (value === "") return null;

  const kw = KEYWORD_COLORS[value.toLowerCase()];
  if (kw) value = kw;

  // #rgb / #rgba / #rrggbb / #rrggbbaa
  let m = /^#([0-9a-fA-F]{3,8})$/.exec(value);
  if (m) {
    const hex = m[1];
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    return null;
  }

  // rgb()/rgba(), both comma and modern space/slash syntax.
  m = /^rgba?\(\s*([^)]+)\s*\)$/i.exec(value);
  if (m) {
    const body = m[1];
    const parts = body.includes(",")
      ? body.split(",").map((s) => s.trim())
      : body.replace("/", " ").split(/\s+/).filter(Boolean);
    if (parts.length < 3) return null;
    const chan = (s) => {
      if (s === undefined) return null;
      if (s.endsWith("%")) return (parseFloat(s) / 100) * 255;
      return parseFloat(s);
    };
    const alphaChan = (s) => {
      if (s === undefined) return 1;
      if (s.endsWith("%")) return parseFloat(s) / 100;
      return parseFloat(s);
    };
    const r = chan(parts[0]);
    const g = chan(parts[1]);
    const b = chan(parts[2]);
    const a = alphaChan(parts[3]);
    if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
    return { r, g, b, a };
  }

  return null;
}

/** Alpha-composite `fg` (with alpha) over an opaque `bg`. */
export function compositeOver(fg, bg) {
  if (fg.a >= 1) return { r: fg.r, g: fg.g, b: fg.b, a: 1 };
  // If bg itself carries alpha (unusual for a page background), flatten it
  // over white first so we always end with an opaque colour to blend onto.
  const bgOpaque =
    bg.a < 1 ? compositeOver(bg, { r: 255, g: 255, b: 255, a: 1 }) : bg;
  const a = fg.a;
  return {
    r: fg.r * a + bgOpaque.r * (1 - a),
    g: fg.g * a + bgOpaque.g * (1 - a),
    b: fg.b * a + bgOpaque.b * (1 - a),
    a: 1,
  };
}

// ---------------------------------------------------------------------------
// WCAG contrast
// ---------------------------------------------------------------------------

function srgbToLinear(c8) {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }) {
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  );
}

/**
 * WCAG 2.x contrast ratio between two CSS colour strings (hex, rgb()/rgba(),
 * or the `white`/`black`/`transparent` keywords). Colours are assumed
 * already opaque (alpha compositing over a page background is a separate
 * step done by the token-resolution pass, not this function).
 */
export function contrastRatio(a, b) {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return null;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function ratioBetween(colorA, colorB) {
  const la = relativeLuminance(colorA);
  const lb = relativeLuminance(colorB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// tokens.css parsing
// ---------------------------------------------------------------------------

/** Find the index just past the `{` matching a selector, and the index of the matching `}`. */
function findBlock(css, selectorRegex) {
  const m = selectorRegex.exec(css);
  if (!m) return null;
  const openIdx = m.index + m[0].length - 1; // index of the `{`
  let depth = 0;
  for (let i = openIdx; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return { start: openIdx + 1, end: i };
    }
  }
  return null;
}

/** Strip @media {...} blocks (brace-matched) out of the CSS text. */
function stripMediaBlocks(css) {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const m = /@media\b/.exec(css.slice(i));
    if (!m) {
      out += css.slice(i);
      break;
    }
    const atStart = i + m.index;
    out += css.slice(i, atStart);
    const braceIdx = css.indexOf("{", atStart);
    if (braceIdx === -1) {
      i = css.length;
      break;
    }
    let depth = 0;
    let j = braceIdx;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    i = j + 1;
  }
  return out;
}

/** Parse `--name: value;` declarations out of a block body into a Map. */
function parseDeclarations(body) {
  const map = new Map();
  // Drop comments inside the block.
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const decl of clean.split(";")) {
    const m = /^\s*(--[a-zA-Z0-9-]+)\s*:\s*([\s\S]+?)\s*$/.exec(decl);
    if (m) map.set(m[1], m[2].trim());
  }
  return map;
}

/**
 * Parse app/styles/tokens.css and return per-scheme raw (unresolved)
 * declaration maps: { dark: Map<name,value>, light: Map<name,value> }.
 * `light` already has dark's values merged in for anything it does not
 * override.
 */
export function parseTokensCss(cssText) {
  // Strip comments globally first (preserving newlines) so a comment that
  // merely *mentions* `@media` or a selector string can't be mistaken for
  // the real rule when we scan for block boundaries below.
  const noComments = cssText.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, " "),
  );
  const noMedia = stripMediaBlocks(noComments);

  const darkBlock = findBlock(noMedia, /:root\[data-mood="ten"\]\s*\{/g);
  const lightBlock = findBlock(
    noMedia,
    /:root\[data-mood="ten"\]\[data-theme="light"\]\s*\{/g,
  );

  const darkRaw = darkBlock
    ? parseDeclarations(noMedia.slice(darkBlock.start, darkBlock.end))
    : new Map();
  const lightOverrides = lightBlock
    ? parseDeclarations(noMedia.slice(lightBlock.start, lightBlock.end))
    : new Map();

  const lightRaw = new Map(darkRaw);
  for (const [k, v] of lightOverrides) lightRaw.set(k, v);

  return { dark: darkRaw, light: lightRaw };
}

/** Recursively substitute var(--x[, fallback]) references using `raw`. */
function resolveVars(value, raw, seen) {
  const VAR_RE = /var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/;
  let cur = value;
  let guard = 0;
  while (VAR_RE.test(cur) && guard++ < 20) {
    cur = cur.replace(VAR_RE, (_, name, fallback) => {
      if (seen.has(name)) return fallback ?? "";
      if (raw.has(name)) {
        const next = new Set(seen);
        next.add(name);
        return resolveVars(raw.get(name), raw, next);
      }
      return fallback ?? "";
    });
  }
  return cur.trim();
}

const NON_COLOR_HINTS = /gradient|url\(|^none$|^inherit$|^currentColor$/i;

/**
 * Build a fully-resolved colour map for one scheme: token name -> parsed,
 * still-possibly-alpha colour. Tokens that don't resolve to a recognised
 * colour literal (gradients etc.) are skipped.
 */
export function resolveScheme(raw) {
  const colors = new Map();
  for (const name of raw.keys()) {
    const resolved = resolveVars(raw.get(name), raw, new Set([name]));
    if (NON_COLOR_HINTS.test(resolved)) continue;
    const color = parseColor(resolved);
    // Keys are stored bare (without the leading `--`) so callers can look
    // up e.g. `colors.get("bg")` directly.
    if (color) colors.set(name.replace(/^--/, ""), color);
  }
  return colors;
}

/** Look up a token's colour, alpha-compositing it over `bg` if needed. */
function tokenColor(colors, name, bg) {
  const c = colors.get(name);
  if (!c) return null;
  if (c.a >= 1 || !bg) return { r: c.r, g: c.g, b: c.b, a: 1 };
  return compositeOver(c, bg);
}

// ---------------------------------------------------------------------------
// Contrast rule checks
// ---------------------------------------------------------------------------

const STATUS_PAIRS = [
  ["ok", "on-ok"],
  ["ok-soft", "on-ok-soft"],
  ["attention", "on-attention"],
  ["warn", "on-warn"],
  ["bad-fill", "on-bad-fill"],
  ["mag-green", "on-mag-green"],
  ["mag-yellow", "on-mag-yellow"],
  ["mag-orange", "on-mag-orange"],
  ["mag-crimson", "on-mag-crimson"],
  ["mag-red", "on-mag-red"],
  ["mag-dark-red", "on-mag-dark-red"],
];

function runContrastChecks(scheme, colors, results) {
  const bg = colors.get("bg");

  function check(rule, scheme_, a, b, min, ratioOverride) {
    const ca = a.color ?? tokenColor(colors, a, bg);
    const cb = b.color ?? tokenColor(colors, b, bg);
    const nameA = typeof a === "string" ? a : a.name;
    const nameB = typeof b === "string" ? b : b.name;
    if (!ca || !cb) {
      // Token missing/unresolvable — nothing to assert, but still counts so
      // a scheme that is silently incomplete doesn't pass by omission.
      results.push({
        rule,
        scheme: scheme_,
        a: nameA,
        b: nameB,
        ratio: null,
        min,
        pass: false,
        message: `FAIL ${rule} ${scheme_} --${nameA} vs --${nameB} = n/a (need ${min}) [token unresolved]`,
      });
      return;
    }
    const ratio = ratioOverride ?? ratioBetween(ca, cb);
    const pass = ratio >= min;
    results.push({
      rule,
      scheme: scheme_,
      a: nameA,
      b: nameB,
      ratio,
      min,
      pass,
      message: `FAIL ${rule} ${scheme_} --${nameA} vs --${nameB} = ${ratio.toFixed(2)} (need ${min})`,
    });
  }

  // Rule 1: fg/muted vs bg/surface >= 4.5; faint vs both >= 3.0.
  for (const tok of ["fg", "muted"]) {
    check("1", scheme, tok, "bg", 4.5);
    check("1", scheme, tok, "surface", 4.5);
  }
  check("1", scheme, "faint", "bg", 3.0);
  check("1", scheme, "faint", "surface", 3.0);

  // Rule 2: neutral ordering contrast(fg,bg) > contrast(muted,bg) > contrast(faint,bg).
  {
    const cfg = tokenColor(colors, "fg", bg);
    const cmuted = tokenColor(colors, "muted", bg);
    const cfaint = tokenColor(colors, "faint", bg);
    if (cfg && cmuted && bg) {
      const rFg = ratioBetween(cfg, bg);
      const rMuted = ratioBetween(cmuted, bg);
      const pass = rFg > rMuted;
      results.push({
        rule: "2",
        scheme,
        a: "fg",
        b: "muted",
        ratio: rFg,
        min: rMuted,
        pass,
        message: `FAIL 2 ${scheme} --fg vs --muted = ${rFg.toFixed(2)} (need > ${rMuted.toFixed(2)})`,
      });
    }
    if (cmuted && cfaint && bg) {
      const rMuted = ratioBetween(cmuted, bg);
      const rFaint = ratioBetween(cfaint, bg);
      const pass = rMuted > rFaint;
      results.push({
        rule: "2",
        scheme,
        a: "muted",
        b: "faint",
        ratio: rMuted,
        min: rFaint,
        pass,
        message: `FAIL 2 ${scheme} --muted vs --faint = ${rMuted.toFixed(2)} (need > ${rFaint.toFixed(2)})`,
      });
    }
  }

  // Rule 3: status fill vs ink >= 4.5.
  for (const [fill, ink] of STATUS_PAIRS) {
    check("3", scheme, fill, ink, 4.5);
  }

  // Rule 5: mark-bg vs surface >= 3.0; mark-fg vs mark-bg >= 4.5.
  check("5", scheme, "mark-bg", "surface", 3.0);
  check("5", scheme, "mark-fg", "mark-bg", 4.5);
}

// ---------------------------------------------------------------------------
// Source scanning (rules 4, 6, 7)
// ---------------------------------------------------------------------------

// Negative lookbehind excludes JSX numeric character entities like
// `&#9664;` — `#9664` alone is a syntactically valid 4-digit hex colour,
// but preceded by `&` it's `◄`, not a colour literal.
const HEX_RE = /(?<!&)#[0-9a-f]{3,8}\b/gi;
const RGB_HSL_RE = /\b(rgb|hsl)\(/gi;
const ALPHA_TRAP_RE =
  /\b(text|bg|border|ring|from|to|via)-(bg|surface|surface-2|border|fg|muted|faint|heading|accent|brand-dark|brand-2|chrome-bg|chrome-fg|info|ok|ok-soft|attention|warn|bad|bad-text|danger)\/\d+/g;
const PHYSICAL_RES = [
  /\b(pl|pr|ml|mr|left|right)-[^\s"'`]+/g,
  /\bborder-[lr]\b/g,
  /\bborder-[lr]-/g,
  /\btext-(left|right)\b/g,
  /\brounded-[lr]\b/g,
  /\b(rounded-[tb][lr])-/g,
];

function stripBlockComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function stripLineComment(line) {
  // Naive `//` strip — good enough for a lint heuristic; doesn't try to
  // understand strings/URLs containing `//`.
  const idx = line.indexOf("//");
  return idx === -1 ? line : line.slice(0, idx);
}

const QUOTED_SPAN_RE = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

/**
 * Rules 6 and 7 target Tailwind utilities, which only ever appear inside a
 * quoted className string (or a template literal built from one) — not in
 * prose. Concatenating just the quoted spans on a line keeps the check from
 * tripping on ordinary English ("left-aligned", "left-open, verbatim…") in
 * comments and doc strings.
 */
function quotedContent(line) {
  const spans = line.match(QUOTED_SPAN_RE);
  return spans ? spans.join(" ") : "";
}

function scanFile(relPath, content, results) {
  const noBlockComments = stripBlockComments(content);
  const lines = noBlockComments.split("\n");
  const rawLines = content.split("\n");

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    const rawLine = rawLines[i] ?? "";

    // Rule 4: raw colours, outside comments.
    const allowHex = rawLine.includes("token-lint: allow-hex");
    if (!allowHex) {
      const forHex = stripLineComment(line);
      const hexMatches = forHex.match(HEX_RE) ?? [];
      const rgbHslMatches = forHex.match(RGB_HSL_RE) ?? [];
      if (hexMatches.length || rgbHslMatches.length) {
        results.push({
          rule: "4",
          file: relPath,
          line: lineNo,
          pass: false,
          message: `FAIL 4 ${relPath}:${lineNo} raw colour literal (${[...hexMatches, ...rgbHslMatches].join(", ")})`,
        });
      } else {
        results.push({ rule: "4", file: relPath, line: lineNo, pass: true });
      }
    }

    // Rule 6: alpha trap on semantic tokens (className strings only).
    const quoted = quotedContent(rawLine);
    const alphaMatches = quoted.match(ALPHA_TRAP_RE) ?? [];
    if (alphaMatches.length) {
      results.push({
        rule: "6",
        file: relPath,
        line: lineNo,
        pass: false,
        message: `FAIL 6 ${relPath}:${lineNo} alpha modifier on semantic token (${alphaMatches.join(", ")})`,
      });
    } else {
      results.push({ rule: "6", file: relPath, line: lineNo, pass: true });
    }

    // Rule 7: physical direction utilities (className strings only).
    const allowPhysical = rawLine.includes("token-lint: allow-physical");
    if (!allowPhysical) {
      const hits = [];
      for (const re of PHYSICAL_RES) {
        const m = quoted.match(re);
        if (m) hits.push(...m);
      }
      if (hits.length) {
        results.push({
          rule: "7",
          file: relPath,
          line: lineNo,
          pass: false,
          message: `FAIL 7 ${relPath}:${lineNo} physical direction utility (${hits.join(", ")})`,
        });
      } else {
        results.push({ rule: "7", file: relPath, line: lineNo, pass: true });
      }
    }
  });
}

function isExcluded(p) {
  const norm = p.split(path.sep).join("/");
  return (
    norm.includes("node_modules/") ||
    norm.includes("/.next/") ||
    norm.startsWith(".next/") ||
    norm.includes("app/styles/")
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = [];

  if (!existsSync(args.tokens)) {
    console.error(
      `token-lint: tokens file not found at ${args.tokens} (the T.EN theme lane may not have landed yet) — skipping`,
    );
    process.exit(2);
  }

  const cssText = readFileSync(args.tokens, "utf8");
  const { dark, light } = parseTokensCss(cssText);
  const darkColors = resolveScheme(dark);
  const lightColors = resolveScheme(light);

  runContrastChecks("dark", darkColors, results);
  runContrastChecks("light", lightColors, results);

  const srcGlobs = args.src
    ? args.src.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_SRC_GLOBS;

  const files = globSync(srcGlobs).filter((p) => !isExcluded(p));
  for (const f of files) {
    const content = readFileSync(f, "utf8");
    scanFile(f, content, results);
  }

  const failures = results.filter((r) => r.pass === false);
  const totalChecks = results.length;

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          ok: failures.length === 0,
          checks: totalChecks,
          failures: failures.length,
          results,
        },
        null,
        2,
      ),
    );
  } else {
    for (const f of failures) console.log(f.message);
    console.log(`token-lint: ${totalChecks} checks, ${failures.length} failures`);
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

// Only run as a CLI when invoked directly (not when imported by tests).
const isMain = (() => {
  try {
    return path.resolve(process.argv[1] ?? "") === path.resolve(new URL(import.meta.url).pathname);
  } catch {
    return false;
  }
})();
if (isMain) main();
