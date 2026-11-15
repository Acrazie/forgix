# Forgix Artifact Contract

## Canonical owner

Persisted `ShapeState.contract` is sole logical owner of implementation contract. It
contains artifact identity/revision, Intake and Discovery receipt references, selected
profile, risk, scope, applicable non-goals, stable criteria, ordered tasks, validation
coverage, applicable risks/controls, dependency nodes, and canonical digest.

Quick and Plan share same schema:

- **Quick:** compact valid contract in state; minimum may be one criterion, one task, one
  validation. No Markdown required.
- **Plan:** detailed contract plus one deterministic Markdown projection. Non-goals and
  atomic dependencies required. Implementation Guide allowed only with evidence-linked
  material trigger.

## Projection

Parent renders Plan projection at safe repository-relative path, default
`docs/forgix/YYYY-MM-DD-<slug>.md`.

1. Render `Proposed` from canonical state.
2. Persist content fingerprint and logical contract digest.
3. GATE approves logical digest.
4. Mark projection `Approved` without changing logical content.
5. Manual drift blocks overwrite/import and returns to Planning.
6. Integrating material edit creates new digest and invalidates Approval.

Projection is never second source of truth.

## Ownership and invalidation

- Discovery/Planning skills remain read-only; parent alone persists state/projection.
- Dependency DAG links decisions, sources, evidence, criteria, tasks, risks, validation,
  guides, and projection.
- Change invalidates only transitive dependency closure. Shape is never reset wholesale.
- Resume reconciles fingerprints and continues first unproved targeted action.
- Approval binds gate, actor evidence, state revision/fingerprint, artifact identity, and
  digest—not pathname or boolean.
- Durable task state lives at `.forgix/tasks/<task-id>.json` and is validated, saved,
  and gated via `forgix task validate`, `forgix task save <task-id>`, and
  `forgix task gate <task-id>`.

## Legacy layouts

Earlier `spec.md`, `plan.md`, `risk-and-rollback.md`, and `verification.md` layouts remain
repository choices only. They are non-canonical and cannot replace persisted contract
identity/digest.
