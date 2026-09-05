# Remote and CI

## Remote

- Origin: `https://git.mantalis.qa/anatoly/welding_report.git` (Gitea 1.27, private,
  default branch `main`). SSH alternative: `ssh://git@git.mantalis.qa:2222/anatoly/welding_report.git`.
- Authenticate with a **personal access token**, never the account password. Keep the
  token out of the remote URL: `git config credential.helper store` and enter the token
  when prompted (it lands in `~/.git-credentials`, outside the repo).
- Commit identity: `git config user.name vik && git config user.email vik@mantalis.qa`.
- **Never commit credentials** — no tokens in `.env` (git‑ignored), in workflows, or in
  docs. `git diff --cached` before every commit that touched configuration.

## Size guard

The host rejects any pushed blob over **100 MB** (`pre-receive` guard). This repo keeps
well below it: the largest tracked blob is ~9 MB (`analysis/pbix/raw/model/columns.json`),
the whole history is ~6 MB. `sources/` (4+ GB of client exports), `.next/`,
`playwright-report/`, `test-results/` and `.venv/` are git‑ignored. Do not commit datasets,
extracts of the `DataModel`, or screenshots; put them in the scratchpad or object storage.

## CI — `.gitea/workflows/ci.yml`

Runs on pushes to `main` and on pull requests (GitHub‑Actions‑compatible syntax):

| Job | What it proves |
|---|---|
| `checks` | `typecheck`, `lint`, `lint:tokens` (WCAG contrast + no raw hex), `check-sql-columns` (every column the loaders and views name exists in the effective schema), `vitest` (DB‑backed suites skip themselves — the dump is never in CI), and the mockup extractors reproduce the committed spec JSON byte‑for‑byte (`uv run`) |
| `db-migrate` | All migrations apply to an empty `postgres:17` service, re‑running is a no‑op, the calendar seed has 2,064 rows and `weld_source` has ≥ 5 values |
| `build-e2e` | `next build` in fixture mode, then the Playwright layout + navigation matrix at 1280 and 360 px against the built app; the HTML report is uploaded as an artifact |

What CI deliberately does **not** do: load `Weld Dump.txt` or the CCC exports (they are
client data and 4 GB), run the live metric pins (`tests/metrics*.test.ts` need a loaded
database — run them locally with `npm test` after `npm run db:load`), or the full
five‑viewport Playwright matrix (run `npm run test:e2e` locally).

### Runner health

The Gitea runner on `git.mantalis.qa` was reported unhealthy since 2026‑07‑31. **Confirm a
workflow actually executed** in the repository's Actions tab (or
`GET /api/v1/repos/anatoly/welding_report/actions/runs`) before trusting a green state.
Until a run is observed, the local verification commands in `README.md` are the gate.

## Local gate before pushing

```bash
npm run typecheck && npm run lint && npm run lint:tokens && npm test
node --import tsx scripts/check-sql-columns.ts
git diff --cached --stat        # and grep the diff for tokens / passwords
```
