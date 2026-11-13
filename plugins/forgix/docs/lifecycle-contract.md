# Forgix lifecycle contract

This document is normative. `src/state-machine.ts` and generated
`lifecycle-contract.projection.json` are executable projection.

## Macro-phases

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE ✓
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

After complete INTAKE, `ROUTING_SNAPSHOT` resolves once per run or resume using
`2026-08-13.taskstate-v6.v1`:

- On `codex` (`mode: "codex-app-server"`), snapshot captures `account/read`,
  `account/rateLimits/read`, and `model/list` and assigns exact `gpt-5.6-luna`,
  `gpt-5.6-terra`, or `gpt-5.6-sol` routes without silent fallback.
- On `claude` and `antigravity` (`mode: "host-native"`), snapshot records `harness` with
  `model: null`, `effort: null`, and `reason: "host-native:<harness>"`, bypassing
  `codex app-server` and quota caches so the host session runs stages directly.

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

BUILD is one thin `executing` boundary. Current Plan Approval Receipt and exact contract
digest are mandatory before first write and resume. The active host agent (Codex, Claude Code,
or Antigravity) implements the complete approved plan without a Forgix execution skill,
checkpoint, progress tracker, validation requirement, or persisted BUILD output. Current
command evidence may be checkpointed for later reuse. Local technical corrections continue
natively. Material scope, product behavior, approved architecture, or risk change stops
writes and returns through SHAPE then GATE. Completion transitions automatically to
`assuring`.

## ASSURE

ASSURE is final phase and has one internal status, `assuring`. Canonical
`assuranceContract`—approved before BUILD—defines subjects, operations, coverage,
dependencies, predicates, scopes, budgets, and policy snapshot.

Reuse fresh BUILD evidence, then run only missing/invalidated deterministic operations.
Known failures block dependent checks and model work. Policy may activate one bounded
independent consolidated review. Non-automatable human observations are batched once;
missing response blocks with exact `resumeTo: assuring`.

Exact coverage atomically freezes completion index, creates minimal Assurance Receipt,
and appends `assure.completed`. Valid paired proof makes `assuring` immutable and derives
public `ASSURE ✓` / `success`; no separate success status exists. External delivery is
outside Forgix task state and uses the active host agent's own authorization afterward.

## Canonical statuses

```text
new
intaking
discovering
awaiting_shape_decision
awaiting_profile_choice
planning
awaiting_intake_decision
awaiting_approval
executing
assuring
blocked
cancelled
failed
```

Primary Shape edges:

```text
new -> intaking
intaking -> discovering
discovering -> awaiting_profile_choice
discovering -> awaiting_shape_decision
awaiting_profile_choice -> planning
planning -> discovering
planning|discovering -> awaiting_intake_decision
awaiting_intake_decision -> discovering|planning
planning -> awaiting_approval
```

`blocked` retains exact `resumeTo` and `resumeReason`. Resume reconciles inputs and
continues exact state with existing design/Shape/ASSURE state. V1 through V5 state is incompatible and
fails with `state_schema_incompatible`; no migration occurs.

## Guards

Shape boundary guards: `task_initialized`, `effective_constraints_valid`,
`intake_complete`, `routing_ready`, `workspace_ready`, `discovery_sufficient`,
`profile_selected`, `contract_complete`. Discovery and Planning guards require trusted
state-bound evaluator receipts. Raw attestations cannot prove them.

Downstream guards remain listed in generated projection. `gate_decision_valid` accepts
only structurally valid decision receipt bound to current contract and target semantics.
`approval_current` protects BUILD resume. ASSURE completion is not a transition guard;
runtime validates exact evidence coverage in one atomic receipt/event transaction.

## Events

SHAPE events: `discovery.target_recorded`, `discovery.evidence_recorded`,
`discovery.completed`, `profile.choice_requested`, `profile.choice_recorded`,
`design.question_recorded`, `design.answer_recorded`, `design.invalidated`,
`contract.projected`, `projection.reconciliation_requested`,
`evidence.invalidated`, `shape.checkpoint`, `state.transition`.

ASSURE events: `assurance.evidence_recorded`, `assurance.evidence_invalidated`,
`assurance.human_observation_requested`, and `assure.completed`. Parent alone persists
events, canonical state, and projections.

## Project INIT outside task lifecycle

Exact `$forgix init` (Codex), `/forgix:forgix init` (Claude Code), or `/forgix init`
(Antigravity) performs agentic repository Discovery and adaptive engineering convention
interview, then validates and publishes digest-bound shared/local project profiles after
explicit Profile Approval. It creates no TaskState, product scaffold, or task GATE
approval. Deterministic `npx @acrasie/forgix init` remains separate plugin configuration wizard.

Normative profile schema, authority, reconciliation, privacy, and atomic publication:
[Project Engineering Profile contract](project-profile-contract.md). Ordinary SHAPE may
consume approved profile and domain-documentation conventions by digest-bound reference.

## Roadmap ideation and autonomous Work Items

Exact `$forgix roadmap` also runs outside `TaskState`. It maintains a local gitignored
3-phase session draft (`.codex/roadmap/state.yaml`) and publishes approved `Feature` and
atomic `Work Item` issues with native `blocked-by` edges into a GitHub Project v2 while
keeping durable vision/domain rules and light project binding in Git.

When `$forgix run-issue <#num>` or `$forgix run-roadmap` executes a pre-specified `Work Item`:

- Each `Work Item` runs in its own branch and isolated Git worktree created fresh from `main`.
- `INTAKE` is seeded from the live GitHub issue plus repository vision, domain rules, and
  profile conventions; `SHAPE` discovers live code dynamically without relying on frozen file
  lists.
- `low` and `medium` risk `Work Item`s without unresolved `INTAKE` contradictions or
  irreversible (`adrQualified`) technical decisions may bypass interactive human `GATE` by
  persisting a digest-bound `Autonomous Gate Receipt` (`actor: "autonomous_policy"`,
  `issueRef: "#<num>"`).
- `high` and `critical` `Work Item`s, or lower-risk items that escalate during `INTAKE`/`SHAPE`,
  still require explicit human `GATE` approval (`actor: "user"`).
- On `ASSURE ✓` (or green automated checks with only `user-observation` pending), delivery
  opens a Draft PR (`Closes #<num>`) and moves the issue to `In Review` (`Done` only on merge).

## Privacy and metrics

Metrics allow only opaque run identity, preparation profile/unselected, macro-phase,
allowlisted numeric counters, measurement/source enums, and allowlisted routing
dimensions. Never objective, code, evidence prose, command output, raw model response, or
user answer.
