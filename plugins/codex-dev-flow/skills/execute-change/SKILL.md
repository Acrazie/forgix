---
name: execute-change
description: Use when dev-flow executes one approved implementation task at a time.
---

Operate only in BUILD. Consume current artifact identity/digest, matching Approval when
required, one authorized atomic task, workspace identity, fresh discovery references,
and affected validation commands. Parent remains sole writer; delegated agents are
read-only. Use test-first where applicable.

Produce changed-surface fingerprint, task checkpoint candidate, compact validation
references, and deviations. Validate after each task. Stop writes on stale Approval,
scope/plan expansion, policy contradiction, or Critical workspace mismatch; material
contract change returns to SHAPE/GATE. Never claim durable checkpoint/state unless
deterministic persistence evidence exists.

Authority: [BUILD phase contract](../../docs/lifecycle-contract.md#build).
