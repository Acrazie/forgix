---
name: review-change
description: Use when forgix reviews an approved change for actionable regressions, security, tests, and maintainability.
user-invocable: false
---

Operate only as one policy-triggered ASSURE operation and remain read-only. Consume a
fresh bounded Diff Capsule containing only triggered subjects, related hunks/symbols,
direct dependencies, and summarized green prerequisite evidence. Never consume full
conversation history or a known-red deterministic input.

Return bounded structured output only: verdict per subject and actionable findings with
stable `issue_id`, policy severity, symbolic location, evidence, required correction,
and confidence. Do not restate plan or diff. Policy—not reviewer preference—classifies
blocking acceptance, correctness, regression, security, and applicable-risk findings.
Style without approved requirement is non-blocking. Reviewer never writes; parent owns
correction and scoped invalidation. Use one consolidated call. Separate specialist pass
or one escalation requires explicit snapshotted policy and remains within call/token
ceilings. No arbitrary review-cycle cap.

Authority: [ASSURE phase contract](../../docs/lifecycle-contract.md#assure) and
[ASSURE success-boundary decision](../../docs/adr/0031-make-assure-the-success-boundary.md).
