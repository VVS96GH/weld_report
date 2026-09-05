# token-lint

CI guard for the T.EN design system (`app/styles/tokens.css`). Run with
`npm run lint:tokens`. Exit codes: `0` clean, `1` FAILs found, `2` tokens
file missing.

## Rules

| id | what | scope | threshold |
|----|------|-------|-----------|
| 1 | `--fg`/`--muted` vs `--bg`/`--surface`; `--faint` vs both | tokens/scheme | ≥4.5 (fg/muted), ≥3.0 (faint) |
| 2 | ordering: contrast(fg,bg) > contrast(muted,bg) > contrast(faint,bg) | tokens/scheme | strict `>` |
| 3 | status fill vs ink: (ok,on-ok) (ok-soft,on-ok-soft) (attention,on-attention) (warn,on-warn) (bad-fill,on-bad-fill) + 6 `mag-*`/`on-mag-*` bands | tokens/scheme | ≥4.5 |
| 4 | raw colour literal (`#hex`, `rgb(`, `hsl(`) outside a comment | `app,components/**/*.tsx`, `lib/**/*.ts{,x}` | none |
| 5 | `--mark-bg` vs `--surface`; `--mark-fg` vs `--mark-bg` | tokens/scheme | ≥3.0, ≥4.5 |
| 6 | alpha modifier on a semantic token, e.g. `bg-accent/20`, in a className string | same source globs | none |
| 7 | physical direction utility in a className string: `pl-`/`pr-`/`ml-`/`mr-`/`left-`/`right-`, `border-l`/`-r`, `text-left`/`-right`, `rounded-l`/`-r`, `rounded-tl-`/`tr-`/`bl-`/`br-` (top/bottom OK — use `ps-`/`pe-`/`border-s`/`-e` etc.) | same source globs | none |

"tokens/scheme" = checked once for `:root[data-mood="ten"]` (dark) and once
for `:root[data-mood="ten"][data-theme="light"]` (light inherits any dark
value it doesn't override). Rules 6/7 scan only quoted spans on a line, so
comment prose never trips them.

## Flags

- `--tokens <path>` (default `app/styles/tokens.css`)
- `--src <glob,glob,...>` (default `app/**/*.tsx,components/**/*.tsx,lib/**/*.ts,lib/**/*.tsx`)
- `--json` — machine-readable `{ ok, checks, failures, results }`

## Escape hatches

Rule 4: `// token-lint: allow-hex` on the line. Rule 7:
`// token-lint: allow-physical` on the line. Rule 6 has none — fix it.

## Adding a token pair

Add the properties to both blocks of `tokens.css`, then wire the pair into
`STATUS_PAIRS` (rule 3) or a `check(...)` call in `runContrastChecks`
(rules 1/5) in `token-lint.mjs`.
