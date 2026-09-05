# T.EN brand assets — the shareable kit

**Copy this whole folder** into another project's `public/brand/` (or `public/brand/ten/`
if that project switches between several brands) and reference the files by URL. Nothing
here imports from the Studio; nothing here needs a font.

Two families live side by side:

| Family | Files | Origin |
|---|---|---|
| **Official** (first-party, from the T.EN brand kit `LOGO TEN.zip`, 2023-02-03, horizontal lockups; web-sized here, cropped to the artwork + 24 px, 1200 px wide, transparent) | `ten-lockup-colour.png` · `ten-lockup-negative.png` · `ten-lockup-mono-white.png` · `ten-lockup-mono-blue.png` · `ten-lockup-mono-black.png` · `ten-globe-official.png` (512 px, the globe cut from the colour lockup) | `source_native/TECHNIP_ENERGIES_LOGO_EXE_HORIZONTAL/` (untracked, operator-supplied). The official SVGs there are print exports with live `WorkSans` text and guide layers — not web assets; use the PNGs. |
| **Generated** (approximation built by `scripts/make_brand_assets.py` from the sampled palette; the T.EN letterforms are a licensed face, approximated with Poppins) | `ten-globe.svg` · `ten-lockup-dark.svg` · `ten-lockup-light.svg` · `favicon.svg` · `favicon-16/32.png` · `favicon.ico` · `apple-touch-icon.png` · `icon-192/512.png` · `site.webmanifest` | regenerate: `uv run --with cairosvg --with pillow python scripts/make_brand_assets.py` — the generator writes only its own files and never touches the official ones |

Sampled palette (the generator's inputs, also the app's brand tokens): bg navy `#00284C`
· globe top `#0070EE` (= `--ten-accent`) · bloom `#2483EF` · deep edge `#0348DD` · bottom
glow `#96D5B8`→`#A8DF8F`.

## Which file on which surface

| Surface | Lockup | Mark alone |
|---|---|---|
| navy / dark scheme (`--chrome-bg`, dark cards, login) | `ten-lockup-negative.png` (white wordmark) — or `ten-lockup-colour.png` when the blue wordmark is wanted on navy | `ten-globe-official.png` |
| white / light scheme, documents, decks | `ten-lockup-colour.png` (blue wordmark) | `ten-globe-official.png` |
| one-colour contexts (watermarks, embossing, monochrome print) | `ten-lockup-mono-blue.png` on light, `ten-lockup-mono-white.png` on dark, `ten-lockup-mono-black.png` for black-and-white print | — |
| favicons, PWA, spinners, avatars | — | `favicon.svg` / `ten-globe.svg` (vector) or `ten-globe-official.png` |

Rules: never recolour, stretch, rotate or add effects; keep clear space of at least the
globe's radius around the lockup; the negative lockup is invisible on white, so the choice
must follow the SURFACE it lands on, not the user's scheme (the header is navy in both
schemes — it always takes a dark-surface file).

## Switching the logo with the theme and the scheme

The app's appearance axes are attributes on `<html>`: `data-theme` (brand) and
`data-scheme` (`dark` | `light`). Key the asset on both with CSS custom properties, so a
component only ever references `var(--brand-lockup)` / `var(--brand-mark)`:

```css
/* tokens.css — one block per brand; the file paths are the only thing that differs */
:root[data-theme='ten'] {
  --brand-mark: url('/brand/ten-globe-official.png');
  --brand-lockup: url('/brand/ten-lockup-negative.png');   /* dark scheme = default */
  --brand-lockup-chrome: url('/brand/ten-lockup-negative.png'); /* chrome is navy in both */
}
:root[data-theme='ten'][data-scheme='light'] {
  --brand-lockup: url('/brand/ten-lockup-colour.png');
}
@media print { :root[data-theme='ten'] { --brand-lockup: url('/brand/ten-lockup-mono-black.png'); } }
```

```tsx
// BrandLockup.tsx — an <img> with a real alt, sized by height; the src follows the axes
import { useTheme } from '@/theme/useTheme'  // whatever exposes { theme, scheme }

const LOCKUP: Record<string, Record<'dark' | 'light', string>> = {
  ten: { dark: '/brand/ten-lockup-negative.png', light: '/brand/ten-lockup-colour.png' },
}
const MARK: Record<string, string> = { ten: '/brand/ten-globe-official.png' }

export function BrandLockup({ surface, className }: { surface?: 'dark' | 'light'; className?: string }) {
  const { theme, scheme } = useTheme()
  // the surface the logo LANDS ON decides, not the user's scheme; chrome passes 'dark'
  const src = LOCKUP[theme]?.[surface ?? scheme] ?? LOCKUP.ten.dark
  return <img src={src} alt="Technip Energies" className={className} style={{ height: '2rem', width: 'auto' }} />
}
export function BrandMark({ className }: { className?: string }) {
  const { theme } = useTheme()
  return <img src={MARK[theme] ?? MARK.ten} alt="" aria-hidden className={className} />
}
```

Adding a second brand is a second key in each map plus its own `public/brand/<brand>/`
folder; no component changes.

## `<head>` snippet

```html
<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<link rel="manifest" href="/brand/site.webmanifest">
<meta name="theme-color" content="#00284C">
```

In the Studio itself the header, login and password screens use the generated
`ten-globe.svg` beside the product name; the official files were added 2026-09-05 for
sharing with other projects and are not yet wired into the Studio's own chrome.
