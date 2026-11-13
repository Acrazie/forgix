# ADR 0034: Risk-Conditioned Autonomous Execution for Roadmap Work Items

## Status

Proposed as an upstream architectural decision; implementation is pending.

## Context

Forgix's current lifecycle contract strictly forbids resolving `INTAKE` decisions silently,
forbids preselecting `Quick` in `SHAPE` profile choice, binds `GATE` decisions to
`actor: "user"`, and keeps non-interactive runs blocked in `awaiting_approval`.

Concentrated upfront roadmap ideation only solves daily developer triage friction if
well-scoped `Work Item`s can subsequently be executed by autonomous agents on demand,
producing verifiable pull requests without daily interactive Q&A—while still stopping
before code writes when risk or unforeseen technical/product ambiguity makes autonomy
unsafe.

## Decision

### On-demand local runner and isolated per-item worktrees

Add local dispatch commands/skills (`$forgix run-issue <#num>` and
`$forgix run-roadmap [--limit N] [--parallel M]`, defaulting to sequential
`--parallel 1`). The runner queries `Ready` `Work Item`s whose `blocked-by` dependencies
are all `Done` (merged into `main`), reads live GitHub Issue content, derives parent
`Feature` status (`In Progress` / `Done`), and creates one isolated branch and Git worktree
per `Work Item` directly from up-to-date `main`.

### Risk-conditioned lifecycle bridge

When a pre-specified roadmap `Work Item` runs under explicit autonomous runner policy:

- **`INTAKE`**: seeds `ProductBaseline` from the approved `Work Item` contract and
  repository vision/glossary/rules. Missing blocking product semantics or contradictions
  halt the run (`Blocked` with question/options commented on the Issue).
- **`SHAPE`**: performs fresh repository Discovery. Under autonomous policy, `Profile
choice` automatically follows Discovery's `Quick | Plan` recommendation
  (`autonomous_policy` provenance), and reversible profile-conforming technical details
  stay agent-owned. If discovered risk escalates to `high` or `critical`, or an
  irreversible/material `TechnicalDecision` outside the `Project Engineering Profile`
  emerges, execution stops before `BUILD` and comments options on the Issue (`Blocked`).
- **`GATE`**: when confirmed risk remains `low` or `medium` with zero open questions or
  scope drift, Forgix issues a distinct typed `Autonomous Gate Receipt`
  (`actor: "autonomous_policy"`, bound to contract digest and issue reference) and enters
  `BUILD -> ASSURE ✓`. `Work Item`s rated `high` or `critical` always pause at human
  `GATE` (`awaiting_approval`) before `BUILD`.

### Post-`ASSURE` Draft PR delivery and blocker handling

Upon `ASSURE ✓` (or when automated checks are green and only `user-observation` checks
remain), the runner commits, pushes the worktree branch, opens a Draft PR
(`Closes #<issue>`) containing verified criteria, `ASSURE` evidence summary, and any manual
verification checklist, and moves the `Work Item` to `In Review` (`Done` occurs only once
merged). If `ASSURE` fails after `debug-root-cause` or a phase blocks, no PR is opened:
the item moves to `Blocked` with structured `issue_id`/decision diagnostics commented on
the Issue, and the local worktree is retained for inspection.

## Considered Options

- **Unconditional autonomous execution across all risk levels**: rejected because high-risk
  migrations, security changes, or breaking changes still require pre-`BUILD` human
  `GATE` authorization.
- **Pausing every roadmap item at `GATE` before `BUILD`**: rejected because it forces
  manual plan approval before any coding begins on low-risk pre-specified items.
- **Long-lived `Feature` branch/worktree or stacking unmerged `In Review` PRs**: rejected
  because long-lived branches drift from `main` and compound merge conflicts, while stacked
  branches trigger cascade rebases on review feedback. Isolating one short-lived worktree
  from updated `main` per `Work Item` and unblocking dependents only on `Done` keeps PRs
  small and conflicts minimal.

## Consequences

- Introduces an explicit, auditable boundary (`Autonomous Gate Receipt`) separate from human
  `Plan Approval Receipt`, leaving interactive `$forgix <objective>` unaffected.
- Downstream `Work Item`s with `blocked-by` dependencies wait until upstream PRs merge
  (`Done`), prioritizing merge-conflict avoidance over speculative parallelism.
- Human review for `low`/`medium` autonomous runs shifts from pre-`BUILD` `GATE` to the
  evidence-backed Draft PR (`In Review`).
- Placed in root `docs/adr/` as a `Proposed` design record so the packaged plugin manifest
  and size budget stay untouched until implementation activates atomically.
