# Forgix lifecycle contract

This document is normative. `src/task/index.ts` and `schemas/state.schema.json` enforce
TaskState V6 lifecycle validation and gate transitions deterministically.

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

New Plan contracts use version 2 with a publishable design snapshot and a
deterministic Markdown projection. The parent resolves permission and uses
`task project` before GATE; Planning itself does not write. Manual drift requires
reconciliation. Material integration invalidates Approval. See the
[artifact and upgrade contract](artifacts.md).

### Cost/resume

Nominal cost: one Discovery session plus one Planning session. Extra call needs new
material/invalidated target. Soft-budget exhaustion preserves all work and offers
continue, reduce scope, cancel. No reset-all operation exists.

### Contract Review

New and remade contracts require SHAPE Contract Review (`review-contract`). Quick reviews its
compact contract; Plan reviews its canonical render and contract, adding specialists only for
distinct material risks. Historical contracts and ASSURE `review-change` keep their protocols.

On `codex`, `claude`, or `antigravity`, run
`forgix --harness <codex|claude|antigravity> task review <id>` with JSON on stdin and the last
`expectedRevision`. Omitted/`auto` harnesses are rejected; block unsupported hosts intact.

- **prepare**: pass authorized Discovery `sources` and, in Plan only, `specialists` (`id`,
  `reason`, `sections`, `sources`). Give reviewers only the returned frozen snapshot and
  `review-contract`—never transcripts or edited projections. Source text is not persisted.
- **reserve** / **claim**: claim the reserved `round` once. Dispatch read-only fresh-context
  subagents (`spawn_agent` `fork_turns: "none"` on Codex, `Agent` on Claude Code,
  `invoke_subagent` on Antigravity). Timeouts/failures are `not run`, never clean passes. Use
  `recheck` roles on reserve to refute a major/blocker. Never retry an uncertain send under the
  same round; maximum five rounds.
- **record**: pass `round`, `permit`, `role`, `nativeId`, `capsule`, `contractDigest`, `read`
  digests, optional `paraphrase` (`proposal`, `existingSystem`), and `findings` (`id`,
  `severity`: `blocker|major|nit`, `description`, optional `source`) with `completed: true` and
  `freshContext: true` from native evidence only.
- **accept**: only with explicit human consent in SHAPE (`finding`, `contractDigest`, `capsule`,
  `rationale`, `confirmedByUser: true`). `blocker` cannot be waived; GATE never waives findings.

Approve with `--approve --digest=<contract-digest> --review-digest=<review-digest>` and explicit
`--harness <codex|claude|antigravity>`. Approval rechecks manifest bytes. Before first write,
run `check-build` with `receipt`; after a real native write, send `record-write` with `receipt`,
`nativeWriteRef`, `completed: true`, and the correlated native hook `postCheck` verdict (first
post-check allows no Escape Hatch exemptions). Without write proof, recheck on resume; drift
returns to SHAPE without reverting work.

## GATE

GATE is one short pre-BUILD validation and approval step. Pure deterministic preflight
checks current SHAPE completion, exact canonical digest, criterion/task/validation
coverage, risk controls, evidence freshness, escalation closure, and current receipt
reuse. It performs no model, network, repository discovery, or subprocess work. For Contract
Review, the mutation boundary checks only the files named by the approved source manifest.

One deterministic five-line card shows objective, plan counts, risks/controls, short
digest, and actions. Only explicit user intent is valid:

- approve -> persist compact Plan Approval Receipt and enter `executing`;
- change with non-empty instruction -> enter `planning` and invalidate prior receipt;
- reject -> enter `cancelled`;
- view -> remain `awaiting_approval` with no mutation.

The view displays exact Protected Surface and Escape Hatch allowances. Every human
approval requires `--approve --digest=<full-digest-shown>`; Contract Review also requires
the shown review digest. Missing or stale views do not issue approval. GATE writes
the v2 receipt and matching transition atomically; `task save` cannot mint them.
V1 states remain readable history and require fresh human GATE before BUILD.

Missing/stale facts return only to affected SHAPE role; product choices may escalate to
INTAKE. Non-interactive runs remain `awaiting_approval`. No bypass exists. Receipt binds
user, task/artifact identity, state revision/fingerprint, complete local contract digest,
and time. Exact digest change invalidates it; time alone does not. Approval never covers
Git, GitHub, registry, or release actions.

## BUILD

BUILD is one thin `executing` boundary. A valid current v2 approval bound to the
canonical worktree and contract is required before first write and resume. Use the
[same installed v2 bundle](getting-started.md#5-configuration-and-harness-guardrails)
in the skill and actual registered native hooks before activating BUILD. The active host agent (Codex, Claude Code,
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
For Plan v2, every applicable operation in the approved contract requires fresh,
operation-bound evidence. A passing operation cannot replace another that covers
the same criterion. Conditional non-applicability requires its own evidence and
cannot waive acceptance criteria.
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
`profile_selected`, `contract_complete`. Discovery and Planning are validated
deterministically against canonical state digests and source fingerprints.

Downstream guards follow canonical TaskState V6 rules. `gate_decision_valid` accepts
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

Exact `$forgix init` / `/forgix:forgix init` / `/forgix init` performs agentic Discovery,
convention interview, and digest-bound profile publication after Profile Approval—creating no
TaskState or task GATE. Normative details:
[Project Engineering Profile contract](project-profile-contract.md). SHAPE may consume approved
profiles by digest reference.

## Roadmap ideation and autonomous Work Items

Exact `$forgix roadmap` runs outside `TaskState`, publishing approved `Feature` and `Work Item`
issues with `blocked-by` edges while keeping durable vision/domain rules in Git.

When `$forgix run-issue <#num>` or `$forgix run-roadmap` executes a `Work Item`:

- Each `Work Item` reserves a task ID, branch, and isolated worktree from `main` before status
  change; reuse coordinates on resume without replacing absent/inconsistent worktrees.
- `INTAKE` seeds from the live issue, vision, domain rules, and profile; `SHAPE` discovers live code.
- Every `Work Item` pauses at human GATE (issue references never authorize autonomously).
  Checkpoint evidence must name the observed Roadmap digest.
- On `ASSURE ✓` (or green automated checks with only `user-observation` pending), delivery opens
  a Draft PR (`Closes #<num>`) and moves the issue to `In Review` (`Done` only on merge).
