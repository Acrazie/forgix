---
name: review-change
description: Use when dev-flow reviews an approved change for actionable regressions, security, tests, and maintainability.
---

Operate only in ASSURE and remain read-only. Consume current Diff Capsule: approved
criteria/risks, changed and impacted surfaces, dependency map, fresh validation evidence,
and active/resolved Issue fingerprints. Compare implementation with current artifact
identity/digest; report uncovered criteria and unapproved deviations.

Return lane applicability, structured findings, and freshness/invalidation references.
Each finding includes stable identity inputs, severity, symbolic location, evidence,
impact, reproduction, fix, and confidence. Standard uses one structured review. Critical
uses independent lanes by applicable risk; omission requires evidence-backed N/A and
ambiguity activates lane. Reviewers never write. Known deterministic failure blocks
expensive review. Limit global review to three cycles.

Authority: [ASSURE phase contract](../../docs/lifecycle-contract.md#assure) and
[risk-adaptive assurance decision](../../docs/adr/0004-scale-assurance-lanes-by-applicable-risk.md).
