# Dev Flow lifecycle contract

This document is normative. `src/state-machine.ts` and generated
`lifecycle-contract.projection.json` are executable projection.

## Macro-phases

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE -> finished
```

Successful tasks traverse all five phases. Cancelled or failed tasks stop truthfully at
their source phase. Quick/Plan is preparation profile selected inside SHAPE, not
lifecycle mode. Risk/policy controls safety.

## INTAKE

Owns objective, observable success, determining constraints, product decisions, and
risk. It never chooses preparation profile or performs deep technical discovery.
Complete Intake always enters Discovery.

Statuses: `new`, `intaking`, plus `awaiting_intake_decision` when Shape needs explicit
product decision. Rich escalation stores evidence/provenance, product impact, 2–3
options, recommendation/basis, affected dependency roots, and prior Shape role.

## SHAPE

### Discovery

Only Discovery reads repository. Work is bounded by structured targets. Evidence carries
provenance, exact source fingerprints, and dependency identity. One evaluation may
resolve related targets; widening requires material impact.

`discovery_sufficient` requires semantic receipt and deterministic proof: current Intake
binding, valid DAG, no open/blocked/stale/escalated target, no stale supporting evidence,
no active escalation, and no unresolved budget checkpoint. No routine second model
judgment.

### Profile choice

After Discovery receipt and before Planning, persist compact checkpoint and Quick/Plan
recommendation. Unless explicit Plan request/policy lock preselects Plan, exact user
answer is mandatory. Silence never selects. Choice survives later Discovery widening
unless policy or user explicitly changes it.

### Planning

Planning cannot read repository. It consumes fresh structured Discovery evidence.
Missing fact creates targeted Discovery Target.

Quick and Plan share canonical contract. Every task maps criteria; every criterion maps
task coverage and validation. `contract_complete` requires semantic implementability and
deterministic freshness, graph, coverage, profile, guide, and digest checks.

Plan adds deterministic Markdown projection. Manual drift requires explicit
integrate/regenerate. Material integration invalidates Approval.

### Cost/resume

Nominal cost: one Discovery session plus one Planning session. Extra call needs new
material/invalidated target. Soft-budget exhaustion preserves all work and offers
continue, reduce scope, cancel. No reset-all operation exists.

## GATE

GATE is one short pre-BUILD validation and approval step. Pure deterministic preflight
checks current SHAPE completion, exact canonical digest, criterion/task/validation
coverage, risk controls, evidence freshness, escalation closure, and current receipt
reuse. It performs no model, network, repository discovery, or subprocess work.

One deterministic five-line card shows objective, plan counts, risks/controls, short
digest, and actions. Only explicit user intent is valid:

- approve -> persist compact Plan Approval Receipt and enter `executing`;
- change with non-empty instruction -> enter `planning` and invalidate prior receipt;
- reject -> enter `cancelled`;
- view -> remain `awaiting_approval` with no mutation.

Missing/stale facts return only to affected SHAPE role; product choices may escalate to
INTAKE. Non-interactive runs remain `awaiting_approval`. No bypass exists. Receipt binds
user, task/artifact identity, state revision/fingerprint, complete local contract digest,
and time. Exact digest change invalidates it; time alone does not. Approval never covers
Git, GitHub, registry, or release actions.

## BUILD

BUILD executes one approved atomic task at a time. Current Plan Approval Receipt and
contract digest are mandatory before writes. Targeted validation follows every task.
Material scope/behavior change stops writes and returns through SHAPE then GATE.

## ASSURE

ASSURE validates applicable risk and every acceptance criterion with fresh evidence.
Risk/policy—not preparation profile—selects review lanes. Successful verification
persists compact Verification Receipt bound to current contract and evidence, then
transitions directly to `finished`, sole success terminal. External delivery is outside
Dev Flow task state and uses native Codex authorization afterward.

## Canonical statuses

```text
new
intaking
discovering
awaiting_profile_choice
planning
awaiting_intake_decision
awaiting_approval
executing
validating
resolving_build
reviewing
resolving_assure
verifying
blocked
cancelled
failed
finished
```

Primary Shape edges:

```text
new -> intaking
intaking -> discovering
discovering -> awaiting_profile_choice
awaiting_profile_choice -> planning
planning -> discovering
planning|discovering -> awaiting_intake_decision
awaiting_intake_decision -> discovering|planning
planning -> awaiting_approval
```

`blocked` retains exact `resumeTo` and `resumeReason`. Resume reconciles inputs and
continues exact state with existing `ShapeState`. V1/V2/V3 state is incompatible and fails
with `state_schema_incompatible`; no migration occurs.

## Guards

Shape boundary guards: `task_initialized`, `effective_constraints_valid`,
`intake_complete`, `routing_ready`, `workspace_ready`, `discovery_sufficient`,
`profile_selected`, `contract_complete`. Discovery and Planning guards require trusted
state-bound evaluator receipts. Raw attestations cannot prove them.

Downstream guards remain listed in generated projection. `gate_decision_valid` accepts
only structurally valid decision receipt bound to current contract and target semantics.

## Events

SHAPE events: `discovery.target_recorded`, `discovery.evidence_recorded`,
`discovery.completed`, `profile.choice_requested`, `profile.choice_recorded`,
`decision.escalated`, `contract.projected`, `projection.reconciliation_requested`,
`evidence.invalidated`, `shape.checkpoint`, `state.transition`.

Parent alone persists events, Shape state, and projection.

## Privacy and metrics

Metrics allow only opaque run identity, preparation profile/unselected, macro-phase,
allowlisted numeric counters, measurement/source enums, and allowlisted routing
dimensions. Never objective, code, evidence prose, command output, raw model response, or
user answer.
