# Contributing to Weld report

## Branches, CI and releases

Full description — CI jobs, the automatic PR, required checks, releases, administration and
troubleshooting: [`docs/ci-and-pull-requests.md`](docs/ci-and-pull-requests.md).

| branch / ref | owner | rule |
|---|---|---|
| `main` | **anatoly (lead)** | Protected. Only anatoly pushes or merges. Everything else arrives as a pull request, and a PR can be merged only when CI is green. |
| `<name>/dev` | each person | Everyday work. Push freely. CI runs on every push; when it is green, a PR `<name>/dev → main` is opened automatically (or the open one is updated). |
| `<name>/fix` | each person | Urgent fixes. Same as `dev`: CI, then an automatic PR. |
| `<name>/test` | each person | Experiments. CI runs, but no PR is opened. |
| tag `vX.Y.Z` | anatoly | A release, cut on `main`. The release workflow publishes it with the source archive and its SHA-256 — the tag and digest are what the platform pins. |

Personal branches are yours: force-push is allowed there, and nobody else commits to them.
`main` rejects direct pushes from everyone except anatoly — that rejection is expected.

**Day to day:**

```bash
git fetch origin
git checkout <name>/dev
git merge origin/main              # bring main in before you start (or: git rebase origin/main)
# ... work, commit ...
git push origin <name>/dev         # CI runs; if green, the PR to main appears by itself
```

A fix that must go out on its own: branch it from `main` into `<name>/fix`, push, and it
arrives as its own PR. After anatoly merges and tags it, that tag is the final version.

Access: git.mantalis.qa is VPN-only; use an SSH key (Settings → SSH / GPG Keys, port 2222)
or an HTTPS access token (Settings → Applications, `repository: Read and Write`).
