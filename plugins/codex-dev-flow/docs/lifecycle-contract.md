# Dev Flow lifecycle contract

This document is normative. `src/state-machine.ts` and generated
`lifecycle-contract.projection.json` are executable projection.

## Macro-phases

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE -> HANDOFF
```

All tasks traverse all six phases. Quick/Plan is preparation profile selected inside
SHAPE, not lifecycle mode. Risk/policy controls safety.

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

## GATE, BUILD, ASSURE, HANDOFF

GATE consumes canonical contract/profile/risk and creates content-bound Approval. BUILD
executes one authorized atomic task at time. ASSURE validates applicable risk and every
criterion with fresh evidence. HANDOFF resolves local/external intent and receipts.
These phases retain current behavior until their dedicated redesign passes; they must
not infer safety from Quick/Plan.

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
handing_off
ready_for_handoff
blocked
cancelled
failed
finished_local
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

`blocked` retains exact `resumeTo` and remaining actions. Resume reconciles inputs and
continues exact state with existing `ShapeState`. V1/V2 state is incompatible and fails
with `state_schema_incompatible`; no migration occurs.

## Guards

Shape boundary guards: `task_initialized`, `effective_constraints_valid`,
`intake_complete`, `routing_ready`, `workspace_ready`, `discovery_sufficient`,
`profile_selected`, `contract_complete`. Discovery and Planning guards require trusted
state-bound evaluator receipts. Raw attestations cannot prove them.

Downstream generic guards remain listed in generated projection.

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
