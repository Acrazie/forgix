# ADR 0024: Make GATE a Minimal Plan Approval

## Status

Accepted for TaskState V4; implementation pending.

## Context

SHAPE already proves that the canonical change contract is complete, evidence-backed,
fresh, internally consistent, and executable. Re-running discovery, planning, or model
review in GATE would duplicate SHAPE, add latency, and weaken phase ownership.

The V3 lifecycle also uses one generic approval mechanism for both pre-BUILD plan
authorization and post-ASSURE completion approval. This makes GATE broader than its
product purpose: let the user validate and authorize the implementation plan before
workspace mutation begins.

## Decision

GATE is one short pre-BUILD user decision over the exact current canonical contract.
Quick and Plan, and every risk level, use the same interaction. Risk and policy affect
the contract and its required controls, not the length or number of GATE prompts.

Before presenting a decision, GATE runs one deterministic preflight that proves:

- the current `contract_complete` receipt is valid;
- the recomputed canonical digest matches the stored contract digest;
- every acceptance criterion has validation coverage;
- referenced SHAPE evidence is fresh; and
- no Decision Escalation remains open.

The preflight performs no model call, network access, repository discovery, or
subprocess execution. Failure returns to the exact owner: stale evidence to Discovery,
an invalid contract or digest to Planning, an open product decision to INTAKE, and
malformed state to a typed block. It never resets SHAPE.

On success, GATE renders a deterministic card of at most five lines containing the
objective, task/criterion/validation counts, risk and control count, a short display
form of the contract digest, and these actions:

- `approuver` / `approve`;
- `modifier: <instruction>` / `change: <instruction>`;
- `rejeter` / `reject`.

Empty, ambiguous, or continuation-like answers are rejected. `voir` / `view` is a
read-only action that renders the full canonical contract and leaves the task in GATE.
No model interprets a GATE answer.

Approval authorizes the complete local implementation contract, not one task at a time.
It never authorizes commit, push, pull request, merge, publication, or release. The
approval is a compact `PlanApprovalReceipt` bound to user actor, timestamp, task and
artifact identity, full contract digest, state revision, and state fingerprint. Raw
conversation text is not persisted.

`change_requested` returns to SHAPE Planning with the structured, redacted instruction.
SHAPE decides whether a product-impacting change needs a Decision Escalation to INTAKE.
`rejected` ends the task as `cancelled`. All three decisions enter bounded history, but
only `approved` creates an active authorization.

Any canonical contract digest change invalidates approval. Unrelated progress does not.
Approval has no arbitrary wall-clock expiry; SHAPE evidence freshness remains the
validity boundary. Non-interactive execution stops in `awaiting_approval` and cannot
use a configuration, policy, or CLI bypass.

## Consequences

- Nominal GATE cost is one local preflight, one card, one user decision, and one state
  transition.
- Approval semantics become exact and auditable without storing user prose.
- `ApprovalGate`, `pendingGate`, and completion approval are removed in V4.
- The earlier gate-type and materiality rules in ADR 0003 are superseded for V4 by one
  full-digest plan approval.
- Metrics may record only allowlisted preflight outcomes, decision kinds, approval
  reuse, and targeted returns; they contain no objective, instruction, digest, or path.
