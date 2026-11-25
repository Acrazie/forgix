# ADR 0034: Risk-Conditioned Autonomous Execution and Independent Verification Checkpoints

## Status

Proposed as an upstream architectural decision; implementation is pending.

## Context

Forgix's interactive lifecycle contract forbids resolving `INTAKE` decisions silently,
forbids preselecting `Quick` in `SHAPE` profile choice, binds `GATE` decisions to
`actor: "user"`, and keeps non-interactive runs blocked in `awaiting_approval`.

Once a repository-canonical `Roadmap` (`.forgix/roadmap.yaml`) has been audited and
approved with explicit `Shared Contract`s and `Verification Checkpoint`s (ADR 0033),
agents need to execute eligible `Work Item`s autonomously on demand—while halting safely on
contract drift or elevated risk, and verifying cross-item integration through an
independent agent context before unlocking subsequent waves.

## Decision

### On-demand runner, isolated worktrees, and conflict-free runtime tracking

Provide local dispatch workflows (`$forgix run-issue <id|#num>` and
`$forgix run-roadmap [--limit N] [--parallel M]`, defaulting to `--parallel 1`) backed by
deterministic CLI commands (`forgix roadmap select-ready` and
`forgix roadmap checkpoint-record`).

The runner reconciles `.forgix/roadmap.yaml` with `.forgix/roadmap/runtime.yaml` and merged
`main` history, selects `Ready` `Work Item`s whose `blockedBy` dependencies and upstream
`Verification Checkpoint`s are all `Done`/`Passed`, and creates one isolated branch and Git
worktree per `Work Item` directly from up-to-date `main`. Execution statuses are recorded
in gitignored `.forgix/roadmap/runtime.yaml` (and optionally synced to `github` or
`entire`) so `Work Item` branches never conflict on `.forgix/roadmap.yaml`.

### Risk-conditioned lifecycle bridge and `Shared Contract` enforcement

When a pre-specified roadmap `Work Item` runs under autonomous policy:

- **`INTAKE`**: seeds `ProductBaseline` from the approved `Work Item` specification, its
  linked `Shared Contract`s (`providesContractIds` and `consumesContractIds`), and
  repository vision/glossary/rules. Missing blocking product semantics or contradictions
  halt the run (`Blocked`).
- **`SHAPE`**: performs fresh repository Discovery on live `main` code, verifying that all
  consumed `Shared Contract`s exist as specified and planning the implementation to satisfy
  all provided `Shared Contract` invariants. Under autonomous policy, `Profile choice`
  follows Discovery's `Quick | Plan` recommendation (`autonomous_policy` provenance). If
  discovered risk escalates to `high` or `critical`, if an `adrQualified`
  `TechnicalDecision` outside `.forgix/project.yaml` emerges, or if implementing the item
  requires breaking an approved `Shared Contract`, execution halts before `BUILD` and marks
  the item `Blocked` with structured diagnostics.
- **`GATE`**: when confirmed risk remains `low` or `medium` with zero open questions,
  zero scope drift, and full `Shared Contract` alignment, Forgix issues a typed
  `Autonomous Gate Receipt` (`actor: "autonomous_policy"`, bound to contract digest and
  work-item/issue reference) and enters `BUILD -> ASSURE ✓`. `Work Item`s rated `high` or
  `critical` always pause at human `GATE` (`awaiting_approval`) before `BUILD`.

### Independent `Verification Checkpoint`s between Features and Waves

In addition to per-item `ASSURE`, `.forgix/roadmap.yaml` includes first-class
`Verification Checkpoint` nodes in the execution DAG (scoped to a `Feature` or `Wave`
boundary):

- A `Verification Checkpoint` becomes `Ready` in `forgix roadmap select-ready` only when
  all of its prerequisite `Work Item`s are `Done` (merged into `main`).
- It is executed on `main` by an **independent agent context** (separate from the agents
  that implemented the constituent `Work Item`s).
- The independent verifier runs the checkpoint's deterministic integration commands,
  validates end-to-end conformance of every `Shared Contract` provided in that scope (using
  each contract's `invariants` and `verificationHint`), and checks for cross-item
  architectural drift.
- On success, `forgix roadmap checkpoint-record` persists a digest-bound
  `VerificationCheckpointReceipt` (`status: "Passed"`) in `.forgix/roadmap/runtime.yaml`,
  unlocking downstream `Wave`s and dependent `Work Item`s. On failure (`status: "Failed"`),
  autonomous execution halts before downstream items start and records the offending
  contract or `Work Item` IDs.

### Post-`ASSURE` delivery and blocker handling

Upon `ASSURE ✓` (or when automated checks are green and only `user-observation` checks
remain), the runner commits the worktree branch, records the reviewable branch/PR/Trail
according to the configured adapter (`local`, `github`, or `entire`), and transitions the
`Work Item` to `In Review` (`Done` occurs only once merged into `main`). If `ASSURE` fails
after bounded `debug-root-cause` or a phase blocks, the item moves to `Blocked` with
structured `issue_id`/decision diagnostics and the local worktree is retained for
inspection.

## Considered Options

- **Relying solely on per-item `ASSURE` without inter-item `Verification Checkpoint`s**:
  rejected because individual `Work Item`s can pass their local tests in isolation while
  still exhibiting integration mismatches or subtle contract drift across a `Feature` or
  `Wave`.
- **Running `Verification Checkpoint`s in the same agent context that built the code**:
  rejected to prevent confirmation bias; split-context verification ensures contracts and
  integration invariants are checked objectively against `.forgix/roadmap.yaml`.
- **Allowing agents to silently mutate `Shared Contract`s during `SHAPE`/`BUILD`**:
  rejected because silent contract changes invalidate downstream `Work Item` assumptions.

## Consequences

- Introduces two explicit, auditable verification boundaries for multi-agent roadmaps:
  `Autonomous Gate Receipt` (pre-`BUILD` per item) and `VerificationCheckpointReceipt`
  (post-merge integration gate across items).
- Downstream `Work Item`s and subsequent `Wave`s cannot compound integration errors from
  earlier waves.
- Works seamlessly across local Git workflows, GitHub Draft PRs, and Entire Trails.
