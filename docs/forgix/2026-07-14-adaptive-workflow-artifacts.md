# Adaptive Workflow Artifacts

## Context and outcome

Dev Flow documents three risk modes but previously only stated that durable artifacts belonged under `docs/dev-flow/`. Standard mode did not define when, how, or by whom its specification and plan were written, so they could remain conversation-only.

The workflow now uses artifact depth adapted to risk: no mandatory record for Quick, one compact change record for Standard, and separate gated documents for Critical.

## Scope and non-goals

In scope:

- Define artifact layouts and lifecycle rules for all modes.
- Persist Standard intent, plan, rollback, and evidence in one versioned record.
- Align internal stage skills with a parent-owned write model.
- Protect the contract with automated tests and public documentation.

Out of scope:

- Add a new CLI artifact writer or state schema.
- Change routing, configuration, worktree selection, or Git permissions.
- Require artifacts for Quick changes.
- Copy SuperPower's implementation-heavy plan format.

## Constraints and decisions

- Delegated stages remain read-only; the parent workflow owns artifact writes.
- Standard artifact creation is permitted before implementation approval, but implementation is not.
- Standard plans contain task boundaries, contracts, dependencies, and verification rather than complete patches or brittle line references.
- Critical keeps separate documents because specification, operational risk, execution, and verification have distinct human gates.
- ADRs remain conditional on durable architectural decisions.

## Acceptance criteria

- AC-1: Quick has no mandatory artifact.
- AC-2: Standard creates `docs/dev-flow/YYYY-MM-DD-<slug>.md` before implementation approval.
- AC-3: Standard records context, scope, decisions, stable acceptance criteria, mapped tasks, rollback, and verification evidence.
- AC-4: Required artifact writes are the only repository changes permitted before approval.
- AC-5: Artifacts live in the active worktree and are included in the resulting commit or handoff.
- AC-6: Resume reuses an existing task artifact instead of creating a duplicate.
- AC-7: Critical uses separate `spec.md`, `plan.md`, `risk-and-rollback.md`, and `verification.md` files.
- AC-8: Plans avoid complete implementations and exact line references unless indispensable.
- AC-9: Verification records commands, results, skipped checks, failures, and material deviations.
- AC-10: Automated tests protect the artifact contract.

## Implementation plan

- Task 1 (covers AC-1 through AC-10): Add failing workflow contract tests.
- Task 2 (covers AC-1 through AC-9): Define the central artifact lifecycle in the public Dev Flow skill.
- Task 3 (covers AC-3, AC-8, AC-9): Align discovery, planning, execution, review, and verification skills.
- Task 4 (covers AC-1 through AC-9): Publish the artifact contract and update README and glossary documentation.
- Task 5 (covers AC-2 through AC-6): Create this Standard change record as a dogfooding check.
- Task 6 (covers AC-9, AC-10): Run focused and complete verification, review the diff, and record evidence.

Dependencies: Task 1 precedes Tasks 2–4. Tasks 2–4 precede Tasks 5–6.

## Risks and rollback

Prompt contracts cannot mechanically guarantee agent behavior, but explicit ownership, timing, paths, and tests remove the previous ambiguity without expanding the CLI surface.

Rollback consists of reverting the skill, documentation, test, and change-record edits. No schema or persisted machine-state migration is involved.

## Verification evidence

- `node --test test/workflow-artifacts.test.mjs`: 4 tests passed, 0 failed.
- `npm run check`: typecheck passed, distribution build passed, 44 tests passed, 0 failed.
- `git diff --check`: passed with no whitespace errors.
- Review: no actionable regression, security issue, uncovered acceptance criterion, or unapproved scope deviation found.
- Skipped checks: none.
- Material deviations: none. The two untracked SuperPower example files remained unchanged and outside this change.
