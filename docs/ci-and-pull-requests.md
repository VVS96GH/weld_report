# CI, pull requests and releases — Weld report

How code gets from a personal branch into `main` and out as a release in
`anatoly/welding_report`, what is automated, where it runs, and how to administer and debug it.
The short version for day-to-day work is in [`CONTRIBUTING.md`](../CONTRIBUTING.md).

All of this lives in three places:

| Piece | Where |
|---|---|
| CI + automatic PR | `.gitea/workflows/ci.yml` |
| Releases | `.gitea/workflows/release.yml` |
| Who may push / merge, required checks | Gitea → repository **Settings → Branches → `main`** (branch protection) |

## 1. The flow

```
 vik/dev ─push─▶ CI ─green─▶ auto-pr job opens PR vik/dev → main
                  │                          │
                  └─red: fix and push again  ▼
                                  PR checks (CI on pull_request) must be green
                                  PR must be up to date with main
                                             │
                                 anatoly reviews and merges
                                             ▼
                                           main ─tag vX.Y.Z─▶ release
```

## 2. Branches and who may do what

| Ref | Who pushes | Force-push | CI | Automatic PR |
|---|---|---|---|---|
| `main` | **anatoly only** | blocked (also deletion) | on every push | — |
| `<name>/dev` | its owner | allowed | on every push | yes, when green |
| `<name>/fix` | its owner | allowed | on every push | yes, when green |
| `<name>/test` | its owner | allowed | on every push | **no** (experiments) |
| tag `vX.Y.Z` | anatoly | — | release workflow | — |

Personal branches exist for `vik` and `anatoly` (`/dev`, `/test`, `/fix` each). They are not
protected: the rule "only the owner commits there" is a team convention, not enforced by Gitea.

**Merging into `main` is enforced by branch protection** (Settings → Branches → `main`):

| Setting | Value | Effect |
|---|---|---|
| Push allow-list | `anatoly` | anyone else's `git push origin main` is rejected |
| Merge allow-list | `anatoly` | only anatoly sees an active **Merge** button |
| Required status checks | `ci / checks (pull_request)`, `ci / db-migrate (pull_request)`, `ci / build-e2e (pull_request)` | a PR cannot be merged until these are green |
| Block merge on outdated branch | on | the PR head must contain the latest `main` — use **Update branch** on the PR |
| Block admin merge override | on | repository admins cannot bypass the rules above |
| Force-push / deletion of `main` | off | history of `main` is never rewritten |
| Required approvals | 0 | anatoly's merge *is* the review; he cannot approve his own PRs, so an approval rule would block him |

## 3. CI — `.gitea/workflows/ci.yml`

**Triggers**

```yaml
"on":
  push:
    branches: [main, '*/dev', '*/test', '*/fix']
  pull_request:
```

- `*` does not cross `/`: `vik/dev` matches, `feature/x/dev` and `dev` do not. A branch
  with another name gets CI only through a pull request.
- A pushed branch runs the workflow **as it is in that branch**. A personal branch created
  before this file existed runs nothing until `main` is merged into it.
- An open PR runs CI again on `pull_request` — so a push to `vik/dev` with an open PR runs
  twice (once per event). The `pull_request` run is the one the merge rule looks at.

**Jobs**

| Job id | Status shown on the commit / PR | What it does |
|---|---|---|
| `checks` | `ci / checks (…)` | typecheck, eslint, token lint, SQL column read-through, vitest (DB suites skip), mockup extractor round-trip. |
| `db-migrate` | `ci / db-migrate (…)` | every migration on an empty `postgres:17` service, re-run is a no-op, calendar seed and schema shape. |
| `build-e2e` | `ci / build-e2e (…)` | `next build` in fixture mode, Playwright layout + navigation matrix at 1280 and 360 px; report uploaded as an artifact. |
| `auto-pr` | `ci / Open PR to main (…)` | see §4; runs after checks, db-migrate, build-e2e |

Details of each job, what CI deliberately does not run, and the lessons from the first runs are in [`ci.md`](ci.md).

**Status names** follow Gitea's pattern `<workflow name> / <job name> (<event>)`, e.g.
`ci / checks (push)` and `… (pull_request)`. The required checks in §2 are
these names verbatim — **renaming a job or the workflow changes the name and blocks every PR**
until the protection rule is updated (see §7).

**Where it runs.** Jobs ask for `runs-on: ubuntu-latest`. On git.mantalis.qa that label is
served by the runner `doha01-build-runner` only (Docker jobs on doha01). One job at a time:
when several pushes arrive together, runs queue — the Actions tab shows them as *waiting*.

**Where to see results.** The green/red mark next to the commit or on the PR → *Details*;
or the repository's **Actions** tab; or the API:
`GET /api/v1/repos/anatoly/welding_report/commits/<sha>/status`.

**Before pushing, locally:**

```bash
npm run typecheck && npm run lint && npm run lint:tokens && npm test
node --import tsx scripts/check-sql-columns.ts
```

## 4. Automatic pull request — job `auto-pr`

- **When:** a `push` to a branch ending in `/dev` or `/fix`, after every other job succeeded.
  Not on `/test`, not on `main`, not on `pull_request` events (it shows as *skipped* there).
- **What:** `POST /api/v1/repos/anatoly/welding_report/pulls` with `head=<branch>`, `base=main`,
  title `<branch> -> main`, authenticated as the Gitea user **`ci-bot`** through the
  repository secret **`CI_BOT_TOKEN`**.
- **Outcome by HTTP code:** `201` PR opened · `409` a PR for this branch is already open
  (it now carries the new commits — nothing else to do) · `422` no difference to `main` ·
  anything else fails the job.
- **Without the secret** the job prints a notice and succeeds, so CI stays green; PRs are
  then opened by hand (Pull Requests → New Pull Request, base `main`).
- One branch = one open PR. After it is merged, the next green push opens a new one.
- Why a bot and not the built-in Actions token: events caused by the built-in token do not
  start further workflows (Gitea prevents workflow loops), so a PR opened with it would never
  get its required `pull_request` checks.
  `ci-bot` has **write** access only (it can open PRs; merging `main` is anatoly's).

## 5. Pull requests and merging

1. The PR is opened automatically (§4) or by hand. Give it a clear title if the automatic
   one (`vik/dev -> main`) says too little — edit it on the PR page.
2. CI runs on the PR. All required checks (§2) must be green.
3. If `main` moved in the meantime, the PR shows *out of date*: press **Update branch**
   (merges `main` into the PR branch) or, locally, `git merge origin/main` and push.
4. anatoly reviews and merges. Merge commit, squash and rebase are all allowed; use
   **squash** for a branch full of work-in-progress commits, **merge** otherwise.
5. After the merge, the author brings `main` back into the personal branch before
   continuing: `git fetch origin && git checkout vik/dev && git merge origin/main`.

## 6. Releases — `.gitea/workflows/release.yml`

A release is a tag `vX.Y.Z` on a commit of `main`, pushed by anatoly:

```bash
git checkout main && git pull
git tag -a v0.4.0 -m "v0.4.0: <one line>"
git push origin v0.4.0
```

(or Gitea → Releases → New release, choosing a new tag on `main`).

The workflow then:

1. refuses the tag if its commit is not on `main`;
2. builds `<repo>-<tag>.tar.gz` from exactly that commit (`git archive`) and `SHA256SUMS`;
3. writes release notes: commit, source digest, and every non-merge commit since the previous tag;
4. creates the Gitea release (or reuses the one made in the UI) and attaches both files.

The **tag + SHA-256** are what the LNG platform pins when it takes this module. Verify a
download with `sha256sum -c SHA256SUMS`. Versioning: `MAJOR` for a breaking change of what
the platform consumes (schema, API, contract), `MINOR` for features, `PATCH` for fixes —
a fix merged from `<name>/fix` becomes the next patch tag.

Container images are not built yet; that step is added when the platform host and
registry are settled.

## 7. Administration (anatoly)

**Branch protection via API** (admin token in `GITEA_TOKEN`):

```bash
G=https://git.mantalis.qa/api/v1; H="Authorization: token $GITEA_TOKEN"
curl -s -H "$H" $G/repos/anatoly/welding_report/branch_protections/main | jq          # read
curl -s -X PATCH -H "$H" -H 'Content-Type: application/json' \
  $G/repos/anatoly/welding_report/branch_protections/main \
  -d '{"status_check_contexts":["ci / checks (pull_request)", "ci / db-migrate (pull_request)", "ci / build-e2e (pull_request)"]}'   # after renaming a job
```

**`ci-bot` and `CI_BOT_TOKEN`** — created once by `~/lng/_bootstrap/setup-ci-bot.sh` on the
lead's machine: the user `ci-bot` (write on `lng/frb`, `anatoly/ccm`,
`anatoly/welding_report`), a token with `write:repository`, stored as the Actions secret
`CI_BOT_TOKEN` in each repository (Settings → Actions → Secrets). To rotate: create a new
token as `ci-bot`, overwrite the secret, delete the old token.

**Adding a person** to this repository:

1. Gitea user (`gitea admin user create --must-change-password`), VPN/NetBird peer.
2. Access: collaborator with **write** (never admin — an admin can edit the protection rule).
3. Branches `<name>/dev`, `<name>/test`, `<name>/fix` from `main`.
4. Nothing to change in `ci.yml` or the protection rule — the triggers are patterns and the
   allow-lists name only anatoly.
5. Point them to [`CONTRIBUTING.md`](../CONTRIBUTING.md) and this document.

**Runners.** `ubuntu-latest` = `doha01-build-runner`. The lead's workstation runner
(`anatoly-omarchy`) carries only `ubuntu-24.04` and `anatoly-omarchy`, so module CI never
executes on it. A second `ubuntu-latest` runner (more parallel jobs) is registered with that
label on any Docker host; nothing in the workflows changes.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `git push origin main` → *protected branch* / *not allowed to push* | only anatoly pushes `main` | push your branch, let the PR carry it |
| No CI on my branch | branch predates the workflow, or its name is not `<name>/dev\|test\|fix` | `git merge origin/main` and push; or open a PR |
| CI green but no PR appeared | pushed to `/test`; or `CI_BOT_TOKEN` not set (job log: *skipping automatic PR*); or a PR is already open (409) | check the `auto-pr` job log; open the PR by hand |
| PR: *required status checks* not satisfied / waiting forever | a check is red, still queued, or a job was renamed | open *Details*; for a rename update the protection rule (§7) |
| PR: *out of date with base branch* | `main` moved | **Update branch** on the PR |
| Release job: *is not on main* | tag set on a personal branch commit | delete the tag, tag the merged commit on `main` |
| Jobs *waiting* a long time | one runner, jobs queue | wait; or add a runner (§7) |
