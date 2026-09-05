# Orchestrating with Opus 4.8 + Sonnet 5 subagents — paste-ready prompt pack

Distilled 2026-07-09 from the ten_qa build sessions (doc-14 protocol + what
measurably worked across ~30 gated checkpoints in one day). Two worker tiers:
**Opus 4.8** makes judgment calls inside a problem; **Sonnet 5** executes
precise briefs. The orchestrator's core skill is knowing which one a task
needs — the test is one question:

> **Can I write every ruling into the brief myself?**
> Yes → Sonnet. No (the agent must MAKE rulings) → Opus.

Copy §1 into the new project's CLAUDE.md (or the session opener); §2 is the
brief skeleton; §3 is the routing table; §4 the per-tier tuning; §5 the mixed
patterns that compound the two.

---

## §1 — Orchestrator operating prompt (paste into CLAUDE.md)

```
## Orchestration protocol (Opus 4.8 + Sonnet 5 subagents)

You are the ORCHESTRATOR. Subagents implement; you decide, gate, commit,
deploy, and run anything live. Iron rules:

MODELS
- Every Agent spawn passes model EXPLICITLY — subagents never inherit the
  session model. Route by the ruling test: if the brief can pre-decide
  every design choice → "sonnet"; if the agent must diagnose, design,
  review adversarially, or reconcile → "opus".

DIVISION OF LABOR
- Subagents: research read-only → implement per brief (TDD red-first) →
  verify → deliver a FROZEN CHECKPOINT. They NEVER commit, never push,
  never touch permission/config files, never run live servers/DB writes.
- Orchestrator: writes briefs, rules on every flagged deviation,
  independently RE-RUNS the verification before committing (both tiers —
  trust the work, re-run the numbers), owns commits/pushes/deploys/live
  runs, and live-verifies after every deploy (offline suites cannot prove
  deployment or data-shape correctness).

PROTOCOL per unit: R (read-only recon) → P (proposal — REQUIRED for Opus
design tasks, SKIPPED for pre-decided Sonnet briefs) → G (gate: numbered
rulings) → I (implement, TDD) → V (verify) → C (checkpoint) → orchestrator
commits.

CHECKPOINT FORMAT (require verbatim, both tiers):
1. What shipped, per numbered scope item, with evidence.
2. Verification outputs pasted (test counts, lint, build, drift).
3. Exact changed-file list + an explicit "NOT MINE" list if the tree holds
   anyone else's work.
4. Flagged deviations (deviate-and-flag is rewarded; silent workarounds
   are the only sin; for Opus also: killed alternatives WITH evidence).
5. A drafted commit message.
The agent's final message IS the deliverable.

PARALLELISM
- One writer per lane; parallel workstreams in ISOLATED WORKTREES; the
  orchestrator merges sequentially.
- Pre-assign ownership of shared concerns (nav/state mechanisms, generated
  contract files, locale files) BEFORE spawning — two agents WILL invent
  two mechanisms for the same concern otherwise.
- Generated artifacts (OpenAPI dumps, generated types, lockfiles) are
  REGENERATED from merged source at every merge — never hand-merged;
  paired artifacts travel in the same commit.
- Merge conflicts go to ONE designated OPUS agent with numbered
  reconciliation rulings ("mechanism X wins; union elsewhere").

HONESTY RULES (both tiers, in every brief)
- Emit only what the data supports; absence = honest-empty, never a
  fabricated zero/default. Everything excluded is COUNTED and reported.
- Failed items are excluded and the run exits non-zero.
- Every displayed rate carries its denominator/window; outputs carry
  provenance (model, prompt/weights version).

MESSAGE DISCIPLINE
- Crossed messages get an explicit supersede reconciliation ("ruling X
  stands; section Y superseded") — never two ambiguous instruction sets.
- Gate replies are numbered rulings. Long-lived agents are RE-ENGAGED via
  SendMessage (context intact) instead of respawned — a continued Opus
  agent holds quality across a full day of rounds.

KNOWN TRAPS (check mechanically)
- Shell cwd persists between calls: `cd <absolute repo root>` first.
- Chained `git commit && push` can silently drop a commit when a
  pre-commit fixer edits files: verify `git log` after EVERY commit.
- No partial commits during a merge; unstage unrelated work first.
- An untracked file blocks a merge carrying its tracked version.
- Docker builds from the WORKING TREE — a deploy can contain uncommitted
  code; keep tree state and git state reconciled.
- Agents get write permission only if the brief says so; if a "read-only"
  agent ships a fix anyway, gate it on its merits and note the breach.
```

---

## §2 — Brief skeleton (fill per task; tier-notes inline)

```
You are <name> doing <one-line goal> in <repo> (worktree isolation: yes/no).
READ FIRST: <3–6 files/docs defining the patterns to follow>.

SCOPE — CLOSED LIST:
1. <deliverable>  [Sonnet: with the design decision already made.
                   Opus: with the PROBLEM + constraints + "propose before
                   building" when the shape is genuinely open.]
2. <...>
Each item: what, where (paths), the pattern to reuse ("compose, don't
fork" — name the module), and the tests that pin it (red first).

CONSTRAINTS: <tooling>; never touch <frozen files, config, other lanes>;
contract files regenerate together; anything outside this scope → STOP and
flag in the checkpoint instead of reaching across the boundary.
[Opus addition: "if you find the brief is WRONG about the system, stop and
report with evidence — we rule first." This is where Opus earns its cost.]

VERIFICATION BAR: <exact commands + expected counts — list ALL of them>.
CHECKPOINT: the 5-part format. You never commit. Your final message is the
deliverable.
```

---

## §3 — Routing table (session-validated)

| Task | Tier | Why / evidence |
|---|---|---|
| New feature with open design space (screen, service, pipeline) | **Opus** | made correct unforced calls (SSE reuse, compose-don't-fork, no-fabrication guards) |
| Root-cause debugging | **Opus** | found the non-obvious causes: embedding-basis asymmetry, role-switch race, FTS-only-hit join — where the orchestrator's own guess was wrong twice |
| Adversarial / promotion review | **Opus** | full-file sweeps + true-negative proofs + load-order verification |
| Merge-conflict reconciliation | **Opus** | judgment unions; rejected two duplicate nav mechanisms |
| R-phase recon of unknown data | **Opus** | measured-coverage findings (two-population split, 85%-dirty raw data) |
| Docs authoring (NEW practices/architecture) | Opus first time, **Sonnet** once the format exists | Sonnet executed an 8-item docs wave cleanly against an established format |
| Docs/CLAUDE stale-sweeps, doc-map rows | **Sonnet** | pure pattern application |
| i18n sweeps, locale fills | **Sonnet** | judgment was pre-decided (canonical-noun policy) — flagged the one real open question (Arabic) instead of guessing: exactly the wanted behavior |
| Scripted UI testing / regression rounds | **Sonnet** | 14-step browser regression with honest PASS/PARTIAL evidence; also delivered precise contrast measurements |
| Tightly-scoped fixes (a color token, a toast, a label) | **Sonnet** | with the ruling in the brief |
| Mechanical refactors / codemods | **Sonnet** | closed scope + tests |

---

## §4 — Per-tier tuning

**Opus 4.8** (judgment inside the problem):
- Give the PROBLEM, the constraints, and the guardrails — not the solution.
  Require a proposal (R→P→G) when the shape is open; skip P when it isn't.
- Demand evidence-based kills: alternatives rejected WITH measurements, not
  vibes ("area_ref stayed 0/6,158 even with the confirm-set expanded").
- Expect and reward stop-and-report: "if the exclusion turns out deliberate,
  STOP — we rule first." Opus uses this correctly.
- Long multi-item rounds are fine (6–8 items) and long-lived continuation
  works — re-engage the same agent for follow-on rounds in its area; it
  compounds context (the same agent did fixes → S2 → merges → papercuts).
- Still verify independently. Opus is convincing when wrong, too.

**Sonnet 5** (execution of precise briefs):
- Pre-decide more. "Dense basis = body only, symmetric" beats "choose a
  basis". If you can't pre-decide it, it's an Opus task.
- Smaller units, more checkpoints (two 4-item briefs > one 8-item brief).
- Escalation is cheap — say so explicitly; Sonnet flags well when told to.
- The verification bar is the contract: Sonnet runs exactly the commands
  you list and skips what you don't. List ALL of them.
- Reviews work on Sonnet when the checklist is explicit (per-check evidence
  table); keep OPEN-ENDED adversarial review on Opus.

---

## §5 — Mixed patterns that compound the tiers

- **Opus builds → Sonnet regression-tests → Opus fixes.** The Sonnet
  browser round found 6 real papercuts in Opus-built screens; the Opus fixer
  root-caused them. Different failure modes, mutual coverage.
- **Opus authors the format → Sonnet extends it.** Practices doc, evidence
  tables, checkpoint formats: expensive to invent, cheap to follow.
- **Opus proposes → orchestrator gates → Sonnet executes the ruled plan**
  when the P-phase output is precise enough to become a closed brief.
- **One standing Opus "fixer/reconciler" + ephemeral Sonnet specialists.**
  The continued Opus agent absorbs merge duty, papercuts, and cross-lane
  fixes; Sonnet agents spawn fresh per mechanical task and stand down.
- **Escalate mid-task, don't push through:** when a Sonnet agent's flag
  reveals open design space, take the ruling yourself or hand THAT slice to
  Opus — don't ask Sonnet to improvise it.
- Cost intuition from the session: Sonnet handled ~a third of the work
  units at a fraction of the token cost with zero quality incidents —
  BECAUSE routing kept every open judgment call off its plate.
```
