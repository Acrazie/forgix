---
name: plan-change
description: Use when dev-flow needs an approved, independently verifiable implementation plan.
---

Operate only as SHAPE Planning and remain read-only. Consume selected Quick/Plan profile,
risk/policy requirements, current artifact identity, trusted Discovery receipt, fresh
structured evidence, and dependency graph. Never inspect repository files or silently
invent evidence. Missing material evidence becomes one new Discovery Target.

Produce one canonical contract schema for both profiles: Intake/Discovery references,
scope, applicable non-goals, stable acceptance criteria, ordered tasks, dependencies,
criterion-linked validation, risks/controls, and digest inputs. Map every task to at
least one criterion; map every criterion to task coverage and validation.

Quick returns smallest executable internal contract and no Markdown. Plan returns
detailed contract for one parent-rendered Markdown projection. Include Implementation
Guide only with evidence-linked reason: architecture boundary, compatibility/migration,
non-obvious ordering, security/concurrency/performance invariant, mandatory repository
pattern, or complex rollback/deployment.

Return semantic implementability, canonicalizable content, graph additions, and usage
counters. Do not embed complete implementations, decorative prose, or brittle line
references unless indispensable. Parent alone writes state/projection. Material
uncertainty returns to Discovery; material contract change invalidates affected
Approval.

Authority: [SHAPE phase contract](../../docs/lifecycle-contract.md#shape) and
[Approval decision](../../docs/adr/0003-bind-approvals-to-canonical-contracts.md).
