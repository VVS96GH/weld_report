# T.EN design system — as integrated into the Welding Statistics Dashboard

> **Integration header (orchestrator rulings, 2026-09-05).** The prompt below is the
> user-supplied T.EN specification, kept verbatim. It targets a React + Vite + Tailwind 3 app
> with i18n/RTL; this project is Next.js 16 App Router + React 19 + TypeScript + Tailwind 4.
> The mapping used here:
> - The spec's `data-theme="ten"` axis is our existing **mood** axis: `data-mood="ten"`
>   (moods are "colour + font set"). `ten` is the **default** mood; the five mockup moods
>   (pastel / ocean / desert / upsidedown / powerbi) remain selectable and untouched.
> - The spec's `data-scheme` (dark · light) is our existing `data-theme` (dark · light).
>   Dark is the default. The density axis is added as `data-density` (normal · compact · board).
> - Direction / i18n (§9: `dir`, RTL, i18next) are **out of scope** for this integration;
>   new CSS uses logical properties so RTL can be added later without rework.
> - Tokens live in `app/styles/tokens.css`, scoped to `[data-mood="ten"]`; components keep
>   consuming the mockup-era variables (`--bg-card`, `--accent-primary`, `--color-N` …),
>   which the `ten` block maps onto the spec's semantic tokens. Tailwind 4 has no
>   `tailwind.config.ts`; §5's extend block is expressed as `@theme inline` in
>   `app/globals.css`. Fonts are self-hosted through `next/font/google` (no font CDN at runtime).
> - Chart colours (`--color-1..8` under `ten`) were derived from the brand hues with the
>   `dataviz` skill's validator, because the raw brand hexes fail the categorical checks
>   (the spec itself marks lime/sage/amber/coral as fill-only colours).

---

# T.EN design system — implementation prompt (paste-ready, self-contained)

> Lifted 2026-09-05 from the live Feedback Studio (`studio/web`) and the approved design
> language page (`source_md/ten-design-system.html`). Everything below is what the Studio
> actually ships, not a proposal. Paste the whole block between the rules into a fresh
> session in the target project and fill the three `<...>` placeholders in the first
> paragraph. When `studio/web/src/styles/tokens.css` changes, re-lift §2 by hand.

---

You are implementing the **T.EN (Technip Energies) design system** in `Welding Statistics Dashboard`, a
`Next.js 16 App Router + React 19 + TypeScript + Tailwind 4` application whose users are
`welding/NDE engineers and construction managers reading weekly progress on site and in the office`. Build it exactly as
specified here. Where this prompt and an existing file in the project disagree, this
prompt wins; where this prompt is silent, follow the principles in §1 and ask before
inventing a new colour, font or component.

## 1. Identity — what makes it read as T.EN

The look is not a colour scheme. It is six repeated gestures, taken from the T.EN Capital
Markets Day deck and ten.com. Reproduce these and the app inherits the identity; the
palette alone would not.

1. **Two worlds, one system.** Vivid, expressive content lives on a luminous navy radial
   gradient; dense data lives on light grey. Same tokens, two surface schemes, never a
   third. **Dark is the default scheme**; light is opt-in from the user menu. Auth and
   splash screens are dark only.
2. **Circles carry meaning.** Perfect circles, concentric hairline rings around the core
   mark, small target-dot markers on callout leader lines. Roundness is the signature:
   pill buttons, pill chips, round icon buttons, 14 px / 22 px card radii.
3. **Chevron flows mean process.** Any sequence (lifecycle, readiness levels, value chain)
   is a row of pointed segments, gradient-coloured start→end. Order is encoded, not
   decorated.
4. **Coral is the highlighter.** Blue is structure; coral is where the eye should land:
   big numbers, "look here" banners, attention states. Sparingly, it does all the emphasis
   work.
5. **Green means progression.** Teal → sage → lime is a maturity gradient (nascent →
   proven). Green is never random; it always signals "further along".
6. **Heavy display, quiet labels.** A bold geometric sans (Poppins) for titles and big
   numbers; small uppercase letter-spaced eyebrows and pill tags for everything
   structural. Contrast in weight, not clutter.

Hard rules that follow from these: no colour-only status (always colour + icon + label);
numerics always in the mono face with tabular figures; chrome (header, nav rail, bottom
bar) stays navy in both schemes; nothing is centred by default except titles and the
login card.

## 2. Token architecture — two layers, four orthogonal axes

**Layer 1** `--ten-*` = the ten brand hexes (operator-supplied; swap for a rebrand).
**Layer 2** = semantic tokens (`--accent`, `--ok`, `--fg`, …). **Components use layer 2
only.** No component, class or inline style ever carries a hex; brand hexes live in one
file, `src/styles/tokens.css`.

Four independent axes, each a data attribute on `<html>`, never coupled:

| Axis | Attribute | Values | Default |
|---|---|---|---|
| theme (colour + font set) | `data-theme` | `ten` | `ten` |
| scheme | `data-scheme` | `dark` · `light` | **`dark`** |
| density (rem base) | `data-density` | `normal` 16 px · `compact` 14 px · `board` 18 px | `normal` |
| direction | `dir` | `ltr` · `rtl` | follows language (`ar` → `rtl`) |

Persist each axis in `localStorage` under `ten.theme`, `ten.scheme`, `ten.density`,
`ten.dir`, `ten.lang`. Apply them **pre-paint** with one inline `<script>` in
`index.html` so there is no flash, and paint the `<html>` background with the dark
gradient literal in a `<style>` so the first frame is never white:

```html
<html lang="en" dir="ltr" data-theme="ten" data-scheme="dark" data-density="normal">
<head>
  <meta name="theme-color" content="#00284C" />
  <style>
    html { background: linear-gradient(150deg, #0a2c4e 0%, #081f3a 55%, #06192c 100%); }
  </style>
  <script>
    (function () {
      try {
        var d = document.documentElement, ls = localStorage;
        var scheme = ls.getItem('ten.scheme'); if (scheme === 'light' || scheme === 'dark') d.dataset.scheme = scheme;
        var dens = ls.getItem('ten.density'); if (['normal','compact','board'].indexOf(dens) >= 0) d.dataset.density = dens;
        var lang = ls.getItem('ten.lang'); if (lang) { d.lang = lang; d.dir = lang === 'ar' ? 'rtl' : 'ltr'; }
      } catch (e) {}
    })();
  </script>
</head>
```

### 2.1 `src/styles/tokens.css` — ship verbatim

```css
:root {
  /* ---- Layer 1 — brand (operator-supplied) ---- */
  --ten-accent: #0070ef;
  --ten-navy: #004c84;
  --ten-teal: #3d98b7;
  --ten-lime: #a2c61c;
  --ten-sage: #80c7a0;
  --ten-coral: #ee7766;
  --ten-amber: #fdc300;
  --ten-red: #e84242;
  --ten-grey: #878787;
  --ten-light-grey: #dedede;

  /* ---- Layer 2 — brand/structure (scheme-independent) ---- */
  --accent: var(--ten-accent);
  --brand-dark: var(--ten-navy);
  --brand-2: var(--ten-teal);
  --info: var(--ten-teal);

  /* ---- Layer 2 — status (meaning fixed; always paired with icon + text) ---- */
  --ok: var(--ten-lime);
  --ok-soft: var(--ten-sage);
  --attention: var(--ten-coral);
  --warn: var(--ten-amber);
  --bad: var(--ten-red);
  --danger: var(--ten-red);
  /* dark ink placed ON each status fill */
  --on-ok: #2b3707;
  --on-ok-soft: #1e3d2c;
  --on-attention: #3a140f;
  --on-warn: #4a3900;
  --on-bad: #ffffff;
  --on-none: #4b5560;
  /* filled FAIL badge: white on the brand red is 3.97:1 (sub-AA), so filled badges
     use a deeper red; --bad stays the brand red for icons, meter overflow, borders */
  --bad-fill: #c62f2f;
  --on-bad-fill: #ffffff;

  /* ---- Type ---- */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Poppins', 'Inter', sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace;

  /* ---- Form / elevation ---- */
  --r: 14px;
  --r-lg: 22px;
  --pill: 999px;
  --focus-ring-color: rgba(0, 112, 239, 0.4);
  --accent-a08: rgba(0, 112, 239, 0.08);
  --accent-a15: rgba(0, 112, 239, 0.15);
  --attention-a20: rgba(238, 119, 102, 0.2);
  --scrim: rgba(2, 10, 20, 0.6);          /* every dialog backdrop */
  --mark-bg: var(--heading);              /* search/citation <mark> */
  --mark-fg: var(--brand-dark);

  /* ---- Density (rem base; overridden by data-density) ---- */
  --density-rem-base: 16px;

  /* ============ DARK scheme = the DEFAULT. Luminous navy. ============ */
  color-scheme: dark;
  --bg: #06192c;
  --bg-gradient:
    radial-gradient(75% 60% at 40% -10%, rgba(56, 148, 240, 0.42) 0%, rgba(18, 81, 140, 0.18) 42%, rgba(6, 25, 44, 0) 70%),
    radial-gradient(45% 40% at 6% 100%, rgba(48, 175, 142, 0.16) 0%, rgba(6, 25, 44, 0) 62%),
    radial-gradient(130% 140% at 95% 40%, rgba(2, 8, 16, 0) 45%, rgba(2, 8, 16, 0.5) 82%),
    linear-gradient(150deg, #0a2c4e 0%, #081f3a 55%, #06192c 100%);
  --surface: #102d49;
  --surface-2: #0c2540;
  --border: #274863;
  --fg: #eaf2fa;
  --muted: #a8c0d6;
  --faint: #7c97ae;
  --heading: #bcd3e8;       /* card/section heading — navy would vanish on a dark card */
  --bad-text: #ff9d9d;      /* red AS TEXT (errors, required marks), AA-tuned per scheme */
  /* magnitude / risk bands (5×5 threat × probability chart), lightened for navy */
  --mag-green: var(--ok);          --on-mag-green: var(--on-ok);
  --mag-yellow: var(--warn);       --on-mag-yellow: var(--on-warn);
  --mag-orange: #ff9d4d;           --on-mag-orange: #3a1a05;
  --mag-crimson: #ff7a9c;          --on-mag-crimson: #3d0a19;
  --mag-red: #ff6b6b;              --on-mag-red: #3a0b0b;
  --mag-dark-red: #e05252;         --on-mag-dark-red: #2a0505;
  --shadow-card: 0 18px 46px -22px rgba(2, 10, 20, 0.7);
  /* chrome (header/nav) stays navy in BOTH schemes — the brand anchor */
  --chrome-bg: var(--brand-dark);
  --chrome-fg: #eaf2fa;
}

html { font-size: var(--density-rem-base); }
:root[data-density='compact'] { --density-rem-base: 14px; }
:root[data-density='board']   { --density-rem-base: 18px; }

/* ============ LIGHT scheme — opt-in ============ */
:root[data-scheme='light'] {
  color-scheme: light;
  --bg: #eef1f4;
  --bg-gradient: var(--bg);
  --surface: #ffffff;
  --surface-2: #f7f9fb;
  --border: #e4e9ee;
  --fg: #0a1c2e;
  --muted: #52606b;         /* grey #878787 fails AA at small size — never use it as text */
  --faint: #78848c;
  --heading: var(--brand-dark);
  --bad-text: #c62f2f;
  --mag-orange: var(--attention);  --on-mag-orange: var(--on-attention);
  --mag-crimson: #f4728f;          --on-mag-crimson: #37091a;
  --mag-red: var(--bad-fill);      --on-mag-red: var(--on-bad-fill);
  --mag-dark-red: #8c1b1b;         --on-mag-dark-red: #ffffff;
  --shadow-card: 0 12px 34px -26px rgba(3, 20, 40, 0.5);
  --chrome-bg: var(--brand-dark);
  --chrome-fg: #ffffff;
  --mark-bg: var(--brand-dark);
  --mark-fg: #ffffff;
}

/* ============ PRINT — ink-saving light palette, chrome dropped ============ */
@media print {
  :root { --bg: #fff; --bg-gradient: #fff; --surface: #fff; --surface-2: #f4f6f8;
          --border: #c7ced6; --fg: #10202e; --muted: #33414d; --faint: #55616c; --heading: #10202e; }
  .no-print { display: none !important; }
  [class*='shadow-card'] { box-shadow: none !important; }
  @page { margin: 14mm; }
}
```

### 2.2 Where each colour may be used (measured contrast)

| Token | vs white | vs navy | Allowed as |
|---|---|---|---|
| accent `#0070EF` | 4.60 | 1.93 | text on light; fills; focus ring |
| navy `#004C84` | 8.87 | 1.00 | text on light; chrome fill |
| teal `#3D98B7` | 3.29 | 2.69 | large text / UI only |
| lime `#A2C61C` | 1.98 | 4.49 | **fill only** (with dark ink) |
| sage `#80C7A0` | 1.98 | 4.48 | fill only |
| coral `#EE7766` | 2.81 | 3.15 | fill only; display numbers ≥ 40 px on dark |
| amber `#FDC300` | 1.62 | 5.48 | fill only |
| red `#E84242` | 3.97 | 2.23 | icons, borders, meter overflow; text via `--bad-text` |
| grey `#878787` | 3.59 | 2.47 | never small text; use `--muted` |
| light grey `#DEDEDE` | 1.35 | 6.59 | surfaces and borders |

Only accent and navy clear AA as body text on white. Every other colour lives inside a
chip, a dot, a fill or a big display number, with text supplied by dark ink.

## 3. Typography

Install `@fontsource/inter`, `@fontsource/poppins`, `@fontsource/ibm-plex-mono` (self-
hosted; no font CDN) and import the weights you use (Inter 400/500/600/700, Poppins
600/700/800, Plex Mono 400/600).

| Role | Face | Rules |
|---|---|---|
| UI and body | Inter (`--font-sans`) | body 16 px / line-height 1.55, antialiased; running text ≤ ~72 ch |
| Display: page titles, card `h3`, big numbers, table heads | Poppins (`--font-display`) | letter-spacing −0.01em; weights 600–800; `text-wrap: balance` on headings |
| Numerics: percentages, scores, counts, dates, ids | IBM Plex Mono (`--font-mono`) | always through a `.num` class with `font-variant-numeric: tabular-nums` |
| Eyebrow / section tag | Inter 12 px 700 | uppercase, letter-spacing 0.13–0.16em, colour `--muted` (light) / `#7fb2e0`-class pale blue (dark) |
| Card header | Poppins 12 px 700 | uppercase, tracking-wider, colour `--heading` |
| Lead paragraph | Inter 17 px | max-width 74 ch |
| Big stat | Poppins 44 px 800, colour `--attention` (coral) | caption 13 px `--muted`, max 22 ch |

Base CSS (`globals.css`):

```css
body { margin:0; min-height:100dvh; background:var(--bg); color:var(--fg);
       font-family:var(--font-sans); line-height:1.55; -webkit-font-smoothing:antialiased; }
.num { font-family:var(--font-mono); font-variant-numeric:tabular-nums; }
h1,h2,h3 { font-family:var(--font-display); letter-spacing:-.01em; margin:0; }
```

Paint the app surface with `--bg-gradient` on the shell's outermost element (body keeps
the flat `--bg` so the print palette and overlays compose correctly).

## 4. Shape, elevation, focus, motion

- Radii: `--r` 14 px (cards, inputs 10 px), `--r-lg` 22 px (feature cards), `--pill` for
  every button, chip, badge and meter. Never `rounded-lg` everywhere; the two card radii
  and the pill are the whole vocabulary.
- Elevation: one card shadow token `--shadow-card`; cards are `bg-surface border
  border-border`; nested panels use `bg-surface-2`. No other shadows.
- Focus (WCAG 2.2 SC 1.4.11): the global rule is a solid 2 px outline in the accent plus
  the soft halo. Never `outline: none` without a replacement.
  ```css
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px;
                   box-shadow: 0 0 0 3px var(--focus-ring-color); }
  ```
- Form controls: `.field-control` = 1.5 px `--border`, radius 10 px, padding 10/12 px,
  background `--surface-2`, placeholder `--faint`; on focus border `--accent` + 3 px
  `--accent-a15` halo. Textareas min-height 9.5 rem, vertical resize.
- Touch: every interactive element clears 44 × 44 px (`min-h-touch` / `min-w-touch`).
- Motion: card slide-in and meter sweep only, 150–500 ms ease-out; skeleton shimmer
  1.4 s; one quiet 8 px rise on the login card. Everything is neutralised under
  `prefers-reduced-motion: reduce` (animation and transition durations → 0.001 ms,
  `scroll-behavior: auto`). Hover styles enhance, never gate a function.
- Modal backdrop: `--scrim` for every dialog; focus trap; body scroll lock. One
  stacking-order module is the single source of truth, consumed as classes, never
  re-typed: sticky header 30 < bottom bar 40 < toast 50 < board 90 < card modal 100 <
  lightbox 110 < modal 115 < floating panel 120 < menu 130.

## 5. Tailwind — `tailwind.config.ts` extend block, verbatim

```ts
theme: {
  extend: {
    screens: { wide: '1440px' },
    colors: {
      bg: 'var(--bg)', surface: 'var(--surface)', 'surface-2': 'var(--surface-2)',
      border: 'var(--border)', fg: 'var(--fg)', muted: 'var(--muted)', faint: 'var(--faint)',
      heading: 'var(--heading)', accent: 'var(--accent)', 'brand-dark': 'var(--brand-dark)',
      'brand-2': 'var(--brand-2)', 'chrome-bg': 'var(--chrome-bg)', 'chrome-fg': 'var(--chrome-fg)',
      info: 'var(--info)', ok: 'var(--ok)', 'ok-soft': 'var(--ok-soft)',
      attention: 'var(--attention)', warn: 'var(--warn)', bad: 'var(--bad)',
      'bad-text': 'var(--bad-text)', danger: 'var(--danger)',
    },
    fontFamily: { sans: 'var(--font-sans)', display: 'var(--font-display)', mono: 'var(--font-mono)' },
    borderRadius: { DEFAULT: 'var(--r)', lg: 'var(--r-lg)', pill: 'var(--pill)' },
    boxShadow: { card: 'var(--shadow-card)' },
    ringColor: { focus: 'var(--focus-ring-color)' },
    minHeight: { touch: '44px' },
    minWidth: { touch: '44px' },
  },
},
```

Rules the config implies:

- These colours resolve to bare `var()` with no `<alpha-value>`, so `bg-accent/20`
  compiles to **nothing**. For tints use the dedicated alpha tokens
  (`bg-[color:var(--accent-a15)]`) or `opacity-NN`.
- **Logical utilities only** for anything horizontal: `ps-/pe-`, `ms-/me-`,
  `border-s/-e`, `start-/end-`, `text-start/-end`, `inset-inline-start`. Physical
  `pl-/pr-/ml-/mr-/border-l/border-r/left-/right-` are forbidden (the app ships RTL).
- No arbitrary colour values (`bg-[#…]`, `text-[rgb(…)]`) anywhere in components.

## 6. Component contracts (build these primitives first, then compose)

Status classes in `globals.css` (fill + dark ink; the `none` sign is an outline chip):

```css
.badge { display:inline-flex; align-items:center; gap:.375rem; border-radius:var(--pill);
         padding:.25rem .625rem; font-size:.75rem; font-weight:600; line-height:1; white-space:nowrap; }
.badge-ok        { background:var(--ok);        color:var(--on-ok); }
.badge-ok-soft   { background:var(--ok-soft);   color:var(--on-ok-soft); }
.badge-warn      { background:var(--warn);      color:var(--on-warn); }
.badge-attention { background:var(--attention); color:var(--on-attention); }
.badge-bad       { background:var(--bad-fill);  color:var(--on-bad-fill); }
.badge-none      { background:transparent; color:var(--muted); border:1px solid var(--border); }
```

| Primitive | Contract |
|---|---|
| `Button` | variants `primary` (`bg-accent text-white hover:brightness-110`), `ghost` (`border border-border text-fg hover:border-accent`), `subtle` (`bg-surface-2 hover:bg-border`); always `inline-flex min-h-touch rounded-pill px-4 text-sm font-semibold`, optional leading icon (`aria-hidden`), `disabled:opacity-50`. A round coral icon button (46 px) exists for the one "act now" affordance per screen. |
| `StatusBadge` | `sign` ∈ `ok · ok-soft · warn · bad · attention · none`; `label` required; default icons: ok/ok-soft ✓ check, warn clock, bad ✗, attention target, none minus; optional `srLabel`. Meaning is fixed: ok = approved/complete, ok-soft = in progress/passed with note, attention = needs a human to read something (approved with comments, existing-match banner), warn = pending/due (the clock is running), bad = rejected/critical, none = no state yet. Review outcome (green → coral → red) and schedule state (amber) are separate axes; never let amber mean two things. |
| `Chip` | neutral meta only (refs, area tags, org labels); variants `evidence` (`rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-fg`) and `facet` (`border border-border text-faint`). Carries no sign semantics; for status use `StatusBadge`. |
| `CardShell` | `<section class="min-w-0 rounded border border-border bg-surface p-4 shadow-card">` with a header `h3` in `font-display text-xs font-bold uppercase tracking-wider text-heading` and an optional `meta` at `ms-auto text-[10px] text-muted`; states `idle · loading (Skeleton) · empty (EmptyState) · error (retry chip, role=alert) · ready`. Cards degrade independently and never block the page. |
| `Meter` | pill track `h-2.5 bg-surface-2`, fill gradient accent → sage from `start-0`, a 2 px pass-threshold tick positioned with `inset-inline-start`, percent above at `end-0` in `text-accent font-bold` through `Num`. |
| `Field` | label 12 px 700 `--muted`; control = `.field-control`; error text `text-bad-text` + icon; every control has an `InfoTip` (what · does · default · affects). |
| `Num` | `<span class="num">` for every numeric; inside RTL text add `dir="ltr"` / `unicode-bidi: isolate`. |
| `EmptyState` | icon + title + one helper sentence that says what is true ("No similar cases found — this may be genuinely new"). Never mock content; never serve stale as fresh. |
| `Skeleton` | shimmer `surface-2 → border → surface-2`, radius 8 px; reduced-motion safe. |
| `Modal` / `Sheet` (bottom, mobile) / `Drawer` (inline-end) | `--scrim` backdrop, focus trap, body scroll lock, Escape closes, `aria-modal`, title in display face. |
| `Toast` | bottom, `bg-surface border-border`, sign icon + text, auto-dismiss ≥ 5 s, never the only record of an error. |
| Icons | inline SVG, `stroke: currentColor`, `aria-hidden`, `focusable=false`, 16 px default; status icons never mirror in RTL, directional icons do. |

Deck motifs, reusable as UI (use where the content is genuinely that shape):

- **Category pill**: white 12.5 px 700 text on `linear-gradient(90deg, var(--accent), var(--brand-2))`; the sustainability variant runs teal → sage.
- **Chevron flow**: segments `clip-path: polygon(0 0, calc(100% - 13px) 0, 100% 50%, calc(100% - 13px) 100%, 0 100%, 13px 50%)`, 11.5 px 700 uppercase, coloured start → end: pale (`#F2F6FA` with navy text) → accent → `linear-gradient(90deg,#1E7BEA,#35A7C9)` → teal → sage (dark ink).
- **Orb + rings**: 118 px circle in accent (white text) or coral (dark ink) with a 10 px 14 %-alpha halo; concentric 1 px rings at 28 % / 16 % alpha pale blue; connector = 1 px line ending in a 7 px hollow dot.
- **Maturity strip (TRL-style)**: uppercase stage labels (early = accent, late = sage-green), 34 px numbered dots progressing outline-accent → accent → accent-teal gradient → teal-sage gradient → sage.
- **Table**: head `bg-brand-dark text-white` Poppins 12 px 600 uppercase tracking 0.04em; cells 11/13 px padding, hairline `--border` rows; numeric columns right-aligned `.num`.
- **Medallion**: 110 px conic ring accent → teal → sage → teal → accent around a radial navy core; for proof-point cards only.

## 7. Responsive by construction — one app on every device

The app is used on a phone on site, a tablet in a workshop, a laptop in the office, a
wide monitor in a control room and a projector in a review. The same content is served to
all of them; **width chooses the presentation, never a second component tree.** These
rules are the mechanism, in the order they are applied.

### 7.1 Foundations (index.html, globals, shell)

- `<meta name="viewport" content="width=device-width, initial-scale=1.0">`. Nothing
  disables zoom.
- Viewport heights use `dvh` (`min-h-dvh`, `h-dvh`, `max-h-[85dvh]`), never `vh` on
  anything that meets the mobile browser chrome or the keyboard.
- The shell is `flex min-h-dvh` → a nav rail (≥ 768 px) + a `flex min-w-0 flex-1
  flex-col` column with the sticky header and `<main class="flex-1 px-4 pb-24 pt-5
  md:pb-6 lg:px-6">`; the `pb-24` is what keeps the last card clear of the fixed bottom
  bar on phones.
- Safe areas: the bottom bar and every bottom sheet pad with
  `env(safe-area-inset-bottom)`; nothing fixed sits under a notch or a home indicator.
- Breakpoints are Tailwind's (`sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536)
  plus one named `wide` at 1440 for the three-pane band. Mobile-first: the bare utility
  is the phone; prefixes add, never subtract.
- **Floor: 360 px wide, zero horizontal body scroll.** This is asserted by a test on every
  screen, not assumed.

### 7.2 The three shell modes

| Range | Navigation | Secondary content (rail, filters, insight cards) | Density |
|---|---|---|---|
| < 768 (phone, portrait or landscape) | fixed **5-slot bottom bar** (four sections + "More" opens a sheet); the rail is `hidden` | collapses into a **summary strip of chips** under the primary content; each chip opens its card as a **bottom sheet** (`max-h-[85dvh]`, grab handle, safe-area padding) | `normal` |
| 768–1279 (tablet, small laptop) | sticky **icon rail** `w-16` (`md:flex`) | an **inline-end drawer** `w-[min(88vw,22rem)]` behind a persistent vertical **edge tab** (`fixed end-0 top-1/3`, `[writing-mode:vertical-rl]`, `min-h-touch`) that carries the badge counts | `compact` suggested at 1024–1279 |
| ≥ 1280 (desktop) | labelled rail `lg:w-56` | an always-visible **column** beside the content (`hidden min-w-0 xl:block`); ≥ 1536 its cards may go 2-up; ≥ 1440 (`wide:`) a third pane may open by default | `normal`; `board` on control-room screens |

Content panel split on desktop: main 7/12 + side 5/12 (≥ 1280), 8/12 + 4/12 at 1024–1279
when a column is shown at all. Reading and form panels are capped at ~72 ch; tables and
grids run full width; **never a global `max-w` on `<main>`** — a large monitor shows more
rows and more columns, not bigger type.

### 7.3 Input type is not width

- Hover affordances are gated: `@media (hover:hover) and (pointer:fine)` for anything
  that appears on hover; under `(pointer:coarse)` every target grows to `min-h-touch`
  (44 px). In Tailwind: `[@media(hover:hover)_and_(pointer:fine){&:hover}]:underline
  [@media(pointer:coarse)]:min-h-touch`. Hover never gates a function — everything
  reachable on hover is reachable by tap and by keyboard.
- Tooltips become tap-to-open InfoTips on coarse pointers; menus open on click, not
  hover, everywhere.
- A tablet with a keyboard and a laptop with a touch screen both exist; do not branch on
  user-agent.

### 7.4 Component-level rules (these are what actually prevent breakage)

- **`min-w-0` on every flex or grid child that holds text.** Without it a long
  reference id or a URL widens the column and the page scrolls sideways. This is the
  single most common responsive defect; the live app carries it on hundreds of nodes.
- **Wide content scrolls inside its own container**: tables, heat maps, code, wide
  charts get `overflow-x-auto` on a wrapper with a sticky first column
  (`sticky start-0 bg-surface`) and a scroll-fade at the inline-end edge; the page body
  never scrolls horizontally.
- **Tables**: column-priority hiding (`hidden md:table-cell`, `hidden lg:table-cell`) so
  the essential columns survive on a phone; sticky `<thead>`; never turn a table into
  wrapped flex rows; the same data must be reachable on every width, possibly behind a
  "details" sheet.
- **Truncation is a last resort and always recoverable**: `truncate` only with the full
  text reachable (title attribute, an expand, or the record view); `line-clamp` for
  multi-line snippets; never clip a number or a status.
- **Chips and pills wrap** (`flex-wrap gap-1`), never overflow; groups of selectors
  (scopes, filters) wrap into rows on phones instead of forming a horizontal strip.
- **Forms** go single-column and full-width below `md`; primary actions sit in a sticky
  action row above the keyboard on phones; a live meter docks as a sticky footer.
- **Modals** are `w-[min(92vw,480|640|820px)] max-h-[85vh] flex flex-col overflow-hidden`
  with a scrolling body and a fixed header; on phones a bottom sheet replaces the centred
  modal for anything chip-driven. Escape closes; focus is trapped.
- **Images and media**: `max-w-full h-auto`, explicit aspect ratios (`aspect-video`,
  `aspect-square`) so nothing jumps while loading; SVG for marks and icons.
- **Fluid display numbers**: big stats use `clamp(28px, 5vw, 44px)` so a coral hero
  number never wraps on a phone or shrinks on a wall screen; body text never scales with
  viewport — it scales with the density axis only.
- **No fixed widths** on cards, chips or labels (German, Russian and Arabic strings run
  30–40 % longer than English); widths are `minmax(0,1fr)`, `w-full`, `max-w-*` or
  `min()`.
- **Sticky is bounded**: sticky headers and action rows are `top-0`/`bottom-0` within
  their scroll container and never stack more than two deep on a phone (header + bar).

### 7.5 Orientation, zoom and large screens

- Landscape phones (height ≤ 500 px): the bottom bar stays, sheets keep `max-h-[85dvh]`,
  sticky action rows collapse to one line; nothing depends on a minimum height.
- **Browser zoom to 200 % must reflow, not scroll sideways** (WCAG 1.4.10 at 320 CSS px):
  the 360 px floor plus the rules above make this true; test it once per screen.
- Large monitors and projectors: `data-density="board"` (18 px base) for readability at
  distance; grids gain columns (`2xl:grid-cols-3`, `wide:` third pane) rather than
  stretching cards; line length still caps at ~72 ch.
- Print / save-as-PDF: the light print palette in `tokens.css`, `.no-print` on chrome,
  `break-inside: avoid` on sections, `@page { margin: 14mm }`.

### 7.6 Responsive testing is part of the definition of done

Playwright projects, run on the built app (build first, never a stale preview):

| Project | Viewport | Runs |
|---|---|---|
| `mobile-360` | 360 × 740 | layout specs + RTL spec |
| `tablet-768` | 768 × 1024 | layout specs + RTL spec |
| `desktop-1280` | 1280 × 800 | layout specs + RTL spec, and the full functional suite once |
| `wide-1536` | 1536 × 960 | layout specs + RTL spec |
| `mobile-375` | 375 × 812 | mobile-specific functional behaviour (bottom bar navigation, strip → sheet, modal fit, Escape) |

The layout spec asserts, on every screen and at every project:

```ts
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth)
expect(overflow).toBeLessThanOrEqual(1)                       // no sideways page scroll
// < md:  bottom-bar visible, nav-rail hidden, summary strip visible, column hidden
// md–xl: edge tab visible, strip hidden; tapping the tab opens role="dialog"
// ≥ xl:  column visible, strip and tab hidden
// wide content: container.scrollWidth > container.clientWidth AND page overflow ≤ 1
```

Then a real-device pass before each release: one iOS phone, one Android phone, one
tablet, one laptop trackpad, one external monitor at 150 % OS scaling, in both schemes
and in RTL. Screenshots are read, not counted.

## 8. Copy and content rules (words are design material)

- Sentence case everywhere except eyebrows and table heads (uppercase by CSS, not in the
  string). A control says exactly what happens ("Save changes", "Generate draft"); the
  same verb survives into its toast ("Saved").
- **Never a count without the thing counted.** "1 kinds across 9 records" is a defect;
  "Wrong fabrication — the cause recorded on 9 of 9 rows" is the rule.
- **No pipeline vocabulary on a reader surface.** Scores, thresholds, cosines, model or
  retrieval terms go into one closed "Technical" disclosure per card, reachable but never
  required.
- **Honest absence.** A missing value reads "not recorded" (once, not per slot); a
  register with no such field says so ("The SDR register records no cause"); an
  unreachable store shows its card collapsed with a retry chip and its reason. Omit,
  never mock.
- **Consistency.** Every number on an open surface agrees with every other mention of it;
  a header with only a fold under it is an absence that must say so in one sentence.
- Errors explain what went wrong and what to do next, in the interface's voice; no
  apologies, no vagueness. Empty states invite an action.
- Provenance on anything generated (model, prompt name + version, time); every AI output
  is a draft the person edits before it is accepted.

## 9. Localization and RTL

- `i18next` + `react-i18next`; `en` is the source of truth and the fallback, shipped
  eagerly; every other locale is a lazily loaded chunk registered before the switch (never
  a flash of raw keys). Namespace per app, keys nested by screen.
- A **key-parity test** over every locale file and a **no-raw-strings test** over
  components are part of CI from day one. Count-aware plurals (`key_one` / `key`) for
  every number in prose.
- Language picker shows endonyms ("Deutsch", "العربية", "日本語"), never ISO codes.
- `dir` follows the language (`ar` → `rtl`); layout mirrors through logical utilities;
  numerics stay LTR inside RTL text; status icons do not mirror; no fixed widths so DE/RU/AR
  expansion cannot break a card.
- Domain nouns the organisation uses in English (record-type names) stay English in
  Latin-script locales; Arabic fully localises them. Decide this per noun once and pin it
  in a test.

## 10. Accessibility floor

- WCAG AA per scheme: `--fg` and `--muted` ≥ 4.5:1 against `--bg` and `--surface`,
  `--faint` ≥ 3.0:1, and the order fg > muted > faint by contrast must hold in both
  schemes. Every status fill ≥ 4.5:1 against its `--on-*` ink.
- Focus visible on everything (rule in §4); a full keyboard-only walk of every screen is
  part of acceptance.
- Colour + icon + text on every status; strip the colour (greyscale or a colour-blind
  simulation) and the state still reads.
- 44 px targets, `aria-modal` dialogs with focus trap, `role="alert"` on error content,
  `sr-only` labels on icon-only controls, `prefers-reduced-motion` honoured.

## 11. CI guards to implement (fail the build)

Write `scripts/token-lint.mjs` (pure Node, no deps) that parses `tokens.css` per scheme and
scans `src/**/*.{ts,tsx}`, and fails on any of:

1. AA contrast: `--fg`/`--muted` vs `--bg`/`--surface` < 4.5; `--faint` < 3.0 (per scheme).
2. Neutral ordering fg > muted > faint by contrast against `--bg` (per scheme).
3. Any status fill vs its `--on-*` ink < 4.5, including the six magnitude bands.
4. A raw hex or `rgb(`/`hsl(` in a component file (brand hexes live only in `tokens.css`).
5. `<mark>` legibility: `--mark-bg` vs `--surface` ≥ 3.0, `--mark-fg` vs `--mark-bg` ≥ 4.5.
6. The alpha trap: `(text|bg|border|ring)-<token>/<n>` on any token colour.
7. Physical direction utilities (`pl- pr- ml- mr- border-l border-r left- right- text-left
   text-right`) — top/bottom are fine.

Plus: `tsc --noEmit`, the l10n parity + no-raw-strings tests, unit tests for every
primitive (each state, each sign), and the Playwright matrix of §7.6 — the layout spec
(no sideways scroll, the three shell modes, wide content contained) across the four
bands, the functional suite at 1280, the mobile functional suite at 375, the RTL spec at
every band — with screenshots of every screen in both schemes read by a person.

## 12. Build order

1. `tokens.css` + `globals.css` + Tailwind config + fonts + the pre-paint script; a
   ThemeProvider that owns the four axes and the persisted keys; the ⋮ menu.
2. `token-lint` and the parity/no-raw-strings tests, proven to fail on a planted defect
   before they are trusted.
3. Primitives in this order: icons, Num, Button, StatusBadge, Chip, Field/field-control,
   CardShell + Skeleton + EmptyState + RetryChip, Meter, InfoTip, Toast, Modal/Sheet/Drawer.
4. Shell: Header, NavRail, BottomBar, More sheet; the grid and the breakpoint table.
5. Screens, one at a time, each accepted by reading it as its user in both schemes, in
   LTR and RTL, and at the five widths (360 · 768 · 1280 · 1536 · 375 functional): can
   they answer what happened, what it means, what to do, without a click; does every
   number agree with every other mention of it; does nothing scroll the page sideways;
   is every action reachable by tap, by keyboard and above the on-screen keyboard?

Brand assets to request from the operator: the globe mark alone (`ten-globe.svg`, for
rails, avatars, spinners), the lockup in a dark and a light variant, SVG-first favicons,
apple-touch and PWA icons, `site.webmanifest` with theme colour `#00284C`. The T.EN
letterforms are a licensed typeface; Poppins is the sanctioned substitute until it is
supplied, and swapping the two font stacks is the only change a real one needs.

---
