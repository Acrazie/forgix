# ADR 0029: Make BUILD a native execution boundary

## Status

Accepted and implemented in TaskState V5.

## Context

Codex already chooses effective edit order, tools, local corrections, and useful
implementation-time checks. A separate `execute-change` skill repeated that native
behavior through atomic-task orchestration, checkpoints, validation after every task,
fingerprints, and a BUILD correction loop. This increased context and state complexity
without adding a product decision or final correctness proof. ASSURE already owns fresh
review and criterion-linked verification.

Users still need an explicit lifecycle boundary between approved planning and assurance,
plus visible phase changes. Codex does not expose a documented plugin API for a custom
dynamic footer item, so Dev Flow cannot promise a permanent native status-line field.

## Decision

Keep BUILD as one public macro-phase with one internal status: `executing`.

- Announce `[DEV FLOW · GATE → BUILD]` and `[DEV FLOW · BUILD → ASSURE]` only at phase
  transitions.
- Before first write or resume, require a current Plan Approval Receipt bound to the exact
  canonical contract digest.
- Let native Codex implement the complete approved plan. Dev Flow adds no BUILD-specific
  skill, model route, orchestration, task checkpoint, progress tracker, validation
  requirement, fingerprint, or persisted output.
- Continue local technical corrections natively. Material scope, product behavior,
  approved architecture, or risk changes stop writes and return through SHAPE then GATE.
- Transition automatically from `executing` to the applicable ASSURE review or
  verification lane.
- Reserve `debug-root-cause` for repeated stable ASSURE failures.

Remove `validating` and `resolving_build`. This changes accepted persisted statuses, so
TaskState advances from V4 to V5. Older task state fails explicitly; no ambiguous
migration guesses whether implementation or BUILD validation had completed.

## Consequences

- BUILD prompt and runtime surface become smaller.
- Worktree diff is implementation truth; ASSURE derives its Diff Capsule from current
  state rather than consuming a BUILD summary.
- Formal validation moves entirely to ASSURE. Native Codex may still run useful checks
  while implementing.
- Resume remains safe through exact approval/digest reconciliation without BUILD
  checkpoints.
- Plugin UI remains honest: phase transitions are visible in conversation, but no custom
  persistent Codex footer is claimed.
