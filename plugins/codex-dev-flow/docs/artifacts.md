# Dev Flow Artifacts

Dev Flow separates local machine state from versioned change records. `.codex/tasks/` stores resumable task state. `docs/dev-flow/` stores reviewable intent, plans, risks, and evidence in the active worktree.

## Mode Matrix

| Mode | Required artifact |
| --- | --- |
| Quick | None by default |
| Standard | One adaptive change record |
| Critical | Separate specification, plan, risk, and verification records |

Repository policy may require more evidence. It may not silently weaken Critical requirements.

## Standard

Use one file:

```text
docs/dev-flow/YYYY-MM-DD-<slug>.md
```

Create it after discovery and planning, before requesting implementation approval. Artifact creation and updates are the only repository writes allowed before that approval.

Minimum template:

```markdown
# Change title

## Context and outcome

## Scope and non-goals

## Constraints and decisions

## Acceptance criteria
- AC-1: ...

## Implementation plan
- Task 1 (covers AC-1): ...

## Risks and rollback

## Verification evidence
Pending implementation.
```

Keep the plan at task and contract level. Add full code or exact line references only when the implementation depends on them. During verification, replace the pending marker with commands, results, skipped checks, and material deviations.

## Critical

Use one directory:

```text
docs/dev-flow/YYYY-MM-DD-<slug>/
  spec.md
  plan.md
  risk-and-rollback.md
  verification.md
```

These files support separate human gates for behavior, execution, operational risk, and completion evidence.

## Lifecycle Rules

- Delegated stages return content; the parent workflow owns artifact writes.
- Resume reuses the existing artifact for the task.
- Approved scope changes update acceptance criteria and plan before execution continues.
- The resulting commit or handoff includes the artifacts.
- Create a separate ADR only for a durable architectural decision.
