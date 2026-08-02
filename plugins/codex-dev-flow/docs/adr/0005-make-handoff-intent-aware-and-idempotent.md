# ADR 0005: Make Handoff Intent-Aware and Idempotent

## Status

Accepted for TaskState V3. Superseded for V4 by ADR 0025.

## Context

Local completion, requested external delivery, and completed external delivery are
different outcomes. Treating missing Git or GitHub permission as success creates false
assurance. Retrying without reconciliation can duplicate commits or pull requests.

## Decision

Terminality depends on effective handoff intent:

- `finished_local`: no external handoff is required or selected;
- `ready_for_handoff`: external handoff is required or explicitly selected, but an
  authorization, recoverable action, or permission is still missing;
- `finished`: every required or selected external handoff action is complete;
- `failed`: a non-recoverable handoff failure prevents the required outcome.

Commit, push, and pull-request attempts use persisted identities and structured receipts.
Resume reconciles local and remote state before performing an action. It reuses an
existing matching result and never creates a duplicate merely because local state is
stale.

Final summaries are projected deterministically from acceptance criteria, evidence, and
handoff receipts. They do not require a new reasoning-model call.

## Consequences

- Missing authorization cannot appear as complete success.
- Resume can finish delivery without replaying BUILD or ASSURE.
- Handoff preferences must resolve to explicit selected/not-selected intent.
- Reconciliation and idempotency identities need provider-specific tests.
- External state may be ambiguous; ambiguity blocks with an actionable diagnostic rather
  than guessing.
