---
name: plan-change
description: Use when forgix needs an approved, independently verifiable implementation plan.
user-invocable: false
---

Operate only as SHAPE Planning and remain read-only. Consume selected Quick/Plan profile,
risk/policy requirements, current artifact identity, trusted Discovery receipt, fresh
structured evidence, and dependency graph. Never inspect repository files or silently
invent evidence. Missing material evidence becomes one new Discovery Target.

Produce one canonical contract schema for both profiles: Intake/Discovery references,
scope, applicable non-goals, stable acceptance criteria, ordered tasks, dependencies,
criterion-linked validation, risks/controls, and digest inputs. Map every task to at
least one criterion; map every criterion to task coverage and validation.

Quick returns contract version 1 and no Markdown. Preserve existing Plan v1 unless
explicitly adopting version 2 in Planning. New Plan uses version 2: `planDesign`
contains a publishable `objective` and one `choices` entry per resolved technical
decision (`decisionId`, `optionId`, `summary`, optional established `rationale`).
Do not fill unknown justifications from recommendations or copy private context.
Omit `sourceFingerprint` when freshly compiling; runtime binds the source. Derive
criterion `validationIds` and validation entries from ASSURE operation IDs and
coverage. Each operation declares its success predicate and any applicability
condition. Do not duplicate commands in validation entries. Include Implementation
Guide only with evidence-linked reason: architecture boundary, compatibility/migration,
non-obvious ordering, security/concurrency/performance invariant, mandatory repository
pattern, or complex rollback/deployment.

Return semantic implementability, canonicalizable content, graph additions, and usage
counters. Do not embed complete implementations, decorative prose, or brittle line
references unless indispensable. Parent alone writes state/projection. Material
uncertainty returns to Discovery; material contract change invalidates affected
Approval.

Authority: [SHAPE phase contract](../../docs/lifecycle-contract.md#shape) and
[GATE approval decision](../../docs/adr/0024-make-gate-a-minimal-plan-approval.md).
