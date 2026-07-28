# Codex Dev Flow Lifecycle Contract

## Status and authority

This document specifies the six public macro-phases and projects the complete internal
state machine for implementation task `T0`.

Since `P0.3`, [`src/state-machine.ts`](../src/state-machine.ts) is the executable source
of truth required by decision D-01. This Markdown table and
[`state.schema.json`](../schemas/state.schema.json) are mechanically validated
projections. The exact normalized registry projection is stored in
[`lifecycle-contract.projection.json`](lifecycle-contract.projection.json). `npm run
check` fails when registry states, per-edge guards, conditional guards, capsule fields,
events, phase/stability/terminality, documented transitions, or schema enums diverge.

Normative decision details remain in:

- [ADR 0002](adr/0002-share-an-invalidable-context-capsule.md) for Context Capsule
  reuse and invalidation;
- [ADR 0003](adr/0003-bind-approvals-to-canonical-contracts.md) for Approval identity
  and materiality;
- [ADR 0004](adr/0004-scale-assurance-lanes-by-applicable-risk.md) for risk-adaptive
  assurance;
- [ADR 0005](adr/0005-make-handoff-intent-aware-and-idempotent.md) for handoff
  terminality and idempotency;
- [ADR 0006](adr/0006-make-intake-adaptive-user-authoritative-and-token-efficient.md)
  for adaptive, user-authoritative, token-efficient INTAKE;
- [ADR 0007](adr/0007-collect-opt-in-local-benchmark-feedback.md) for opt-in local
  post-task benchmark feedback.

This document references those decisions without redefining them.

## Global invariants

1. Public lifecycle contains exactly `INTAKE`, `SHAPE`, `GATE`, `BUILD`, `ASSURE`, and
   `HANDOFF`.
2. Internal status is persisted. Macro-phase is derived and is never persisted.
3. Every transition must exist in the canonical registry and satisfy all named guards.
4. Quota and token consumption are optimization goals. Reliability and absence of false
   success are hard constraints.
5. No success state is reachable without fresh required evidence.
6. Scope expansion, mode change, risk change, or material contract change invalidates
   affected Approval records before further writes.
7. Critical requires a ready worktree before repository mutation, required risk records,
   human gates, and independent read-only assurance.
8. `merge: never` is non-bypassable.
9. Missing, stale, ambiguous, or contradictory context causes reinspection or a block,
   never silent trust.
10. Detailed approved scope and evidence have one versioned artifact owner. Local state
    stores compact projections and references, not duplicate prose.
11. Every human decision requested during INTAKE requires an explicit user answer or
    cancellation. A model recommendation never becomes a user decision silently.
12. Interview work must have determining impact on outcome, success, constraints, risk,
    mode, or transition. Clear requests may incur zero interview questions.
13. Post-task benchmark feedback is opt-in and out-of-band. It cannot add a lifecycle
    phase, change terminality, invoke a comparison run, or upload task data.

## Canonical vocabulary

### Macro-phases

| Macro-phase | Intent | Required for modes |
| --- | --- | --- |
| `INTAKE` | Establish valid request, effective constraints, confirmed mode and safe route. | Quick, Standard, Critical |
| `SHAPE` | Discover only enough repository context to create an implementable contract. | Standard, Critical; Quick records a bounded not-applicable decision unless escalated |
| `GATE` | Bind required human authorization to canonical contract projections. | Standard, Critical; Quick only when ambiguity, destructive work, policy, or escalation requires it |
| `BUILD` | Execute approved atomic tasks and obtain progressive local validation. | Quick, Standard, Critical |
| `ASSURE` | Review applicable risk and verify every acceptance criterion with fresh evidence. | Quick verification; Standard review plus verification; Critical independent lanes plus verification |
| `HANDOFF` | Resolve delivery intent, reconcile external state, perform idempotent actions, and report truthful terminality. | Quick, Standard, Critical |

Quick skips operational `SHAPE` and `GATE` states only while its bounded-scope and
non-destructive guards remain true. These phases remain part of the common contract as
explicit not-applicable decisions. A material ambiguity or expansion removes that
exemption and routes through shaping and approval.

### Capsule field groups

Field names below are logical contract paths. Exact V2 storage shape belongs to `P1`.

| Field group | Sole owner | Main consumers |
| --- | --- | --- |
| `request.objective`, `request.successSignals`, `request.successValidator`, `request.determiningConstraints`, `request.intakeBrief`, `request.activeQuestion` | User input and compact decisions captured by `INTAKE` | all phases |
| `constraints.config`, `constraints.policy`, `constraints.repositoryGuidance` | `INTAKE` resolution | all phases |
| `classification.mode`, `classification.risk` | `INTAKE` classifier plus human confirmation | all phases |
| `routing.snapshot`, `routing.decisions` | `INTAKE` router | reasoning stages |
| `workspace.identity`, `workspace.worktree` | `INTAKE` workspace guard | `SHAPE` through `HANDOFF` |
| `discovery.surfaces`, `discovery.dependencies`, `discovery.commands`, `discovery.uncertainties` | `SHAPE` | `GATE`, `BUILD`, `ASSURE` |
| `contract.artifactIdentity`, `contract.digest`, `contract.scope`, `contract.nonGoals`, `contract.acceptanceCriteria`, `contract.plan`, `contract.risks` | versioned change artifact authored in `SHAPE` | `GATE` through `HANDOFF` |
| `approvals.records`, `approvals.pendingGate` | `GATE` | transition guards, `BUILD`, `HANDOFF` |
| `build.currentTask`, `build.checkpoints`, `build.changedSurfaces`, `build.validationEvidence`, `issues.active` | `BUILD` | `ASSURE`, resume |
| `assurance.diffCapsule`, `assurance.laneDecisions`, `assurance.findings`, `assurance.verificationEvidence` | `ASSURE` | `GATE`, `HANDOFF` |
| `handoff.intent`, `handoff.identities`, `handoff.receipts` | `HANDOFF` | resume, terminal summary |
| `freshness.git`, `freshness.config`, `freshness.policy`, `freshness.artifact`, `freshness.commands` | phase observing the source; deterministic fingerprint code arbitrates | every relying phase |

### Guard identifiers

Registry and tests use stable identifiers rather than prose-only conditions.

| Guard | Condition |
| --- | --- |
| `task_initialized` | Task identity and minimum local state are valid. |
| `effective_constraints_valid` | Configuration and policy resolve without contradiction. |
| `mode_confirmed` | Effective Quick, Standard, or Critical mode has explicit valid confirmation when required. |
| `intake_complete` | Semantic sufficiency and deterministic Intake Brief checks both pass; no active question or contradiction remains. |
| `intake_reopened` | A later phase persisted a product-context invalidation requiring return to INTAKE; technical uncertainty alone cannot satisfy it. |
| `routing_ready` | Post-confirmation routing snapshot exists and satisfies policy; no silent downgrade occurred. |
| `quick_scope_bounded` | Quick work remains explicit, bounded, non-destructive, and policy-compatible. |
| `critical_workspace_ready` | Critical worktree identity is present, safe, and reconciled before any repository write. |
| `discovery_sufficient` | All uncertainties capable of changing scope, risk, mode, acceptance criteria, plan, or validation are resolved or explicitly blocked. |
| `contract_complete` | Canonical artifact projection contains objective, scope, non-goals, acceptance criteria, mode, risk, and executable plan; Critical risk records also exist. |
| `approval_current` | Every required Approval matches current canonical projection and gate type. |
| `task_authorized` | Current atomic task maps to approved plan and does not expand scope. |
| `validation_fresh` | Required targeted and policy-mandated checks cover current changed surface and fingerprints. |
| `review_satisfied` | Required review lanes completed, or each omission has fresh evidence-backed non-applicability. |
| `verification_complete` | Every acceptance criterion maps to fresh evidence and all globally mandatory checks passed. |
| `correction_budget_available` | Correction and global review-cycle limits permit another controlled attempt. |
| `resume_metadata_valid` | `resumeTo` is operational, non-terminal, non-stable, non-recursive, and `remainingActions` is non-empty. |
| `resume_reconciled` | Current Git/config/policy/artifact/evidence observations match the resumed state fingerprint and are referenced by fresh structured evidence. |
| `terminal_source_recorded` | Terminal event records the operational source needed for deterministic macro-phase derivation. |
| `gate_context_valid` | Bound gate decision matches current `pendingGate`, state revision/fingerprint, contract digest, evidence reference, decision and authorized target. |
| `handoff_intent_resolved` | Every external action is explicitly required, selected, or not selected. |
| `handoff_reconciled` | Local and remote observations are unambiguous and persisted identities prevent duplicate work. |
| `critical_completion_approved` | Critical completion-evidence Approval matches fresh verification projection. |

## State-to-phase derivation

| Internal status | Derived macro-phase | Stable | Terminal | Derivation rule |
| --- | --- | --- | --- | --- |
| `new` | `INTAKE` | no | no | direct |
| `awaiting_mode_confirmation` | `INTAKE` | no | no | direct; also owns post-confirmation routing and Critical entry guard until departure |
| `discovering` | `SHAPE` | no | no | direct |
| `planning` | `SHAPE` | no | no | direct |
| `awaiting_approval` | `GATE` | no | no | direct; `approvals.pendingGate` distinguishes pre-build and Critical completion gates |
| `executing` | `BUILD` | no | no | direct |
| `validating` | `BUILD` | no | no | direct |
| `resolving_build` | `BUILD` | no | no | direct; replaces ambiguous V1 `resolving` for local validation failures |
| `reviewing` | `ASSURE` | no | no | direct |
| `resolving_assure` | `ASSURE` | no | no | direct; replaces ambiguous V1 `resolving` for review or verification failures |
| `verifying` | `ASSURE` | no | no | direct |
| `handing_off` | `HANDOFF` | no | no | direct |
| `ready_for_handoff` | `HANDOFF` | yes | no | direct; resume target is `handing_off` |
| `blocked` | target phase | yes | no | derive recursively from valid `resumeTo`; `resumeTo` cannot be `blocked`, `ready_for_handoff`, or terminal |
| `cancelled` | source phase | yes | yes | derive from source status in current terminal event; source must satisfy `terminal_source_recorded` |
| `failed` | source phase | yes | yes | same rule as `cancelled` |
| `finished_local` | `HANDOFF` | yes | yes | direct |
| `finished` | `HANDOFF` | yes | yes | direct |

`stable` means no automatic forward work occurs without a new user action or external
state change. Terminal states have no outgoing transitions. `ready_for_handoff` is
stable but not terminal because delivery can resume.

## State entry and exit contracts

`blocked` may resume into any operational state named below when its target guards pass;
that generic resume entry is omitted from repeated source lists. Universal cancellation,
non-recoverable failure, and recoverable block routes are defined in the next section.

| State | Authorized normal entry | Invariant while active | Required output before normal exit | Correctable-error route |
| --- | --- | --- | --- | --- |
| `new` | task creation only | task identity and initial snapshots remain valid | persisted deterministic mode proposal | none; recoverable initialization obstacle blocks |
| `awaiting_mode_confirmation` | `new` | no costly routing before required confirmation; no repository mutation | confirmation/rejection event; after confirmation, frozen route and Critical workspace readiness when applicable | routing/workspace obstacle blocks; rejection cancels |
| `discovering` | confirmed Standard/Critical intake; `planning` widening | discovery reads only and follows material-uncertainty stop rule | fresh relevant surfaces, dependencies, commands, and explicit uncertainties | missing required context widens or blocks |
| `planning` | `discovering`; material change from BUILD/ASSURE; rejected pre-build gate | artifact remains sole owner of contract prose | complete canonical contract projection and digest | material uncertainty returns to `discovering` |
| `awaiting_approval` | `planning`; fresh Critical `verifying` evidence | pending gate type and projection identity are fixed; no unauthorized write | immutable matching Approval or explicit rejection/change request | rejected pre-build gate returns `planning`; rejected completion gate returns `resolving_assure` or `verifying` |
| `executing` | approved pre-build gate; next task from `validating` | exactly one atomic approved task is writable | changed-surface fingerprint and checkpoint candidate for current task | scope/plan change returns `planning`; execution obstacle blocks |
| `validating` | `executing`; code correction from either resolution state | checks apply to current fingerprints and broaden only by impact/policy | fresh check evidence, stable Issue, or identified next approved task | failed local check enters `resolving_build` |
| `resolving_build` | correctable failure from `validating` | correction remains within approved contract and budget | correction fingerprint plus invalidated check set | unresolved/material change returns `planning`; exhausted budget blocks |
| `reviewing` | completed Standard/Critical BUILD; policy/risk-required Quick review; review-only correction | review consumes current Diff Capsule; writer independence is preserved | structured findings or fresh satisfied-review decision | actionable finding enters `resolving_assure` |
| `resolving_assure` | finding/verification failure; rejected Critical completion gate | correction maps to stable Issue and remains within approved contract/budget | code, review-only, or evidence-only correction with invalidation set | material change returns `planning`; exhausted budget blocks |
| `verifying` | Quick validation; satisfied review; evidence-only correction | every claim maps to current acceptance criterion and fresh evidence | complete AC-to-evidence map or stable correctable Issue | correctable failure enters `resolving_assure`; material change returns `planning` |
| `handing_off` | verified non-Critical flow; approved Critical completion; resumed ready state | reconcile before side effect; identities remain idempotent; `merge: never` | receipt for each completed action or explicit remaining recoverable action | recoverable permission/action enters `ready_for_handoff`; unrecoverable required outcome fails |
| `ready_for_handoff` | `verifying`, approved completion gate, or incomplete `handing_off` | verification remains complete and remaining external intent stays explicit | reconciliation proving completion or capability to retry through `handing_off` | ambiguity remains ready or blocks; non-recoverable required outcome fails |
| `blocked` | recoverable obstacle from any non-terminal state | valid exact `resumeTo`, non-empty remaining actions, obstacle evidence | reconciled target guards or deferred-resume observation | unchanged obstacle remains blocked; newly non-recoverable outcome fails |
| `cancelled` | explicit cancellation from any non-terminal state | terminal source event remains valid | deterministic cancellation summary | none; terminal |
| `failed` | classified non-recoverable outcome from any non-terminal state | terminal source and failure classification remain valid | deterministic failure summary and actionable evidence reference | none; terminal |
| `finished_local` | verified flow or approved Critical completion with no external intent | every criterion remains proved and no external action is selected/required | deterministic AC-to-evidence summary | none; terminal |
| `finished` | completed or reconciled `handing_off`/`ready_for_handoff` | every selected/required external action has matching receipt | deterministic AC-to-evidence-to-receipt summary | none; terminal |

## Canonical transitions

Universal error transitions are written explicitly here:

- Any non-terminal operational state may enter `blocked` only for a recoverable obstacle
  and only with `resume_metadata_valid`.
- Any non-terminal state may enter `cancelled` only on explicit human cancellation or
  an applicable cancellation policy, with `terminal_source_recorded`.
- Any non-terminal state may enter `failed` only for a classified non-recoverable
  outcome, with `terminal_source_recorded`.
- A failed check that can be corrected is not `failed`; it enters the applicable
  resolution state.

The registry must expand these universal rules into inspectable transitions; it must
not implement an unchecked wildcard.

| From | Allowed normal targets | Required guards and meaning |
| --- | --- | --- |
| `new` | `awaiting_mode_confirmation` | `task_initialized`, `effective_constraints_valid`; persist proposed deterministic mode before costly routing |
| `awaiting_mode_confirmation` | `executing`, `discovering` | both exits require `intake_complete`; `executing` only for `mode_confirmed + routing_ready + quick_scope_bounded`; `discovering` for Standard/Critical with `mode_confirmed + routing_ready`, plus `critical_workspace_ready` for Critical |
| `discovering` | `planning`, `awaiting_mode_confirmation` | `discovery_sufficient` enters planning; product-context invalidation returns with `intake_reopened` |
| `planning` | `discovering`, `awaiting_approval`, `awaiting_mode_confirmation` | technical uncertainty returns to discovery; complete contract enters gate; product-context invalidation returns with `intake_reopened` |
| `awaiting_approval` | `planning`, `resolving_assure`, `verifying`, `executing`, `handing_off`, `ready_for_handoff`, `finished_local`, `awaiting_mode_confirmation` | normal gate exits need `gate_context_valid`; product-context invalidation exits with `intake_reopened` and invalidates gate authority |
| `executing` | `validating`, `planning`, `awaiting_mode_confirmation` | checkpoint enters validation; material contract change returns to planning; product-context invalidation returns with `intake_reopened` |
| `validating` | `executing`, `resolving_build`, `reviewing`, `verifying`, `planning`, `awaiting_mode_confirmation` | normal validation routing applies; product-context invalidation returns with `intake_reopened` |
| `resolving_build` | `validating`, `planning`, `awaiting_mode_confirmation` | correction returns through validation; changed contract returns to planning; product-context invalidation returns with `intake_reopened` |
| `reviewing` | `resolving_assure`, `verifying`, `planning`, `awaiting_mode_confirmation` | finding resolution, verification, or planning routing applies; product-context invalidation returns with `intake_reopened` |
| `resolving_assure` | `validating`, `reviewing`, `verifying`, `planning`, `awaiting_mode_confirmation` | correction returns through owning phase; product-context invalidation returns with `intake_reopened` |
| `verifying` | `resolving_assure`, `planning`, `awaiting_approval`, `handing_off`, `ready_for_handoff`, `finished_local`, `awaiting_mode_confirmation` | normal verification and handoff routing applies; product-context invalidation returns with `intake_reopened` |
| `handing_off` | `ready_for_handoff`, `finished`, `awaiting_mode_confirmation` | reconciliation reaches action-required or finished; product-context invalidation returns with `intake_reopened` |
| `ready_for_handoff` | `handing_off`, `finished`, `awaiting_mode_confirmation` | resume reconciles first; product-context invalidation returns with `intake_reopened` |
| `blocked` | exact `resumeTo` | `resume_metadata_valid + resume_reconciled` plus explicit target-entry guards from registry; resume reconciles fingerprints and rechecks those guards before transition |
| `cancelled` | none | terminal |
| `failed` | none | terminal |
| `finished_local` | none | terminal |
| `finished` | none | terminal |

Remaining in the same stable or waiting state after a denied gate, unavailable
permission, or unchanged obstacle is not a transition. It records a typed observation
without fabricating progress.

## Mode paths

### Quick

```text
new → awaiting_mode_confirmation → executing ↔ validating → verifying
  → finished_local
  → handing_off → finished
  → ready_for_handoff → handing_off|finished
```

Quick records `SHAPE` and `GATE` as not applicable only while
`quick_scope_bounded` remains true. Policy/risk-required review routes
`validating → reviewing → verifying`; otherwise Quick routes `validating → verifying`.
Ambiguity, destructive impact, scope expansion, or mode escalation routes
to `planning → awaiting_approval`; Critical escalation also requires worktree readiness
before further writes.

### Standard

```text
new → awaiting_mode_confirmation → discovering ↔ planning → awaiting_approval
  → executing ↔ validating → reviewing ↔ resolving_assure
  → verifying → finished_local|handing_off|ready_for_handoff
  → finished
```

`resolving_build` loops through `validating`. Any material contract change loops through
`planning → awaiting_approval` before execution resumes.

### Critical

Critical follows Standard path with these mandatory differences:

1. `critical_workspace_ready` before leaving `awaiting_mode_confirmation`.
2. Threat and rollback records included by `contract_complete`.
3. Distinct immutable pre-build Approvals recorded while in `awaiting_approval`.
4. Independent applicable-risk assurance lanes before `review_satisfied`.
5. `verifying → awaiting_approval` for distinct completion-evidence Approval.
6. `merge: never` remains enforced during `HANDOFF`.

## Control loops

### Validate and resolve during BUILD

1. `executing` changes one approved atomic task.
2. `validating` runs narrow deterministic checks first, then package or repository checks
   when impact or policy requires them.
3. Green evidence creates checkpoint. More tasks return to `executing`.
4. Correctable failure creates or updates stable Issue and enters `resolving_build`.
5. Resolution reruns invalidated checks. It cannot reuse stale green evidence.
6. Correction limits trigger root-cause investigation or human block; they never turn a
   failure into success.

### Review, resolve, and verify during ASSURE

1. Known deterministic failures block reviewer calls.
2. `reviewing` consumes fresh Diff Capsule. Standard runs one structured review;
   Critical runs required independent lanes.
3. Actionable findings enter `resolving_assure` and retain stable fingerprints.
4. Code corrections return to `validating`, then review resumes with selectively
   invalidated findings and evidence.
5. `verifying` maps every acceptance criterion to fresh evidence and reruns globally
   mandatory or invalidated checks.
6. Verification failures enter `resolving_assure`; the third failed global cycle blocks
   for human decision. No cycle cap permits false success.

## Uniform phase contracts

### INTAKE

- **Intent:** determine whether task can safely enter workflow before costly reasoning or
  mutation.
- **Preconditions:** parseable invocation; repository boundary identifiable.
- **Consumes:** `request.*`, configuration sources, policy sources, repository guidance,
  current workspace identity, account/quota/model observations only after mode
  confirmation.
- **Produces:** `constraints.*`, `classification.*`, frozen `routing.snapshot`, initial
  freshness fingerprints, confirmed workspace/worktree reference, SHAPE/GATE
  applicability decisions.
- **Owner:** model owns semantic sufficiency/question wording; deterministic runtime owns
  structure/completeness; human owns every asked decision and mode confirmation.
- **Events:** `task.created`, `intake.question_recorded`, `intake.answer_recorded`,
  `intake.checkpoint`, `advance.rejected`, `intake.reopened`, `mode.proposed`, `mode.confirmed`, `mode.rejected`,
  `routing.snapshot_captured`, `workspace.reconciled`, `worktree.ready`,
  `state.transition`, or typed block/failure/cancellation.
- **Proof and exit:** `intake_complete`, effective config/policy valid, mode confirmed
  when required, routing captured after confirmation, Critical worktree ready. Quick
  also needs `quick_scope_bounded`; Standard and Critical exit to SHAPE automatically.
- **Failure/resume:** contradictions block before write; routing or worktree ambiguity
  blocks with exact retry target. Resume rereads mutable sources and reconciles them.
- **Invalidation:** request, config, policy, repository identity, quota/model catalog, or
  worktree changes invalidate affected classification/routing/workspace fields.
- **Metrics:** model calls before confirmation, routing calls, context bytes, estimated or
  measured tokens labeled by source, latency, blocks, cancellations, and mode changes.

#### Accepted adaptive interview evolution

This subsection is implemented per
[ADR 0006](adr/0006-make-intake-adaptive-user-authoritative-and-token-efficient.md).

- INTAKE and SHAPE are a two-level interview. INTAKE owns product intent, observable
  success, determining constraints, and mode/risk. SHAPE owns repository and technical
  uncertainty and turns success signals into acceptance criteria.
- INTAKE first extracts explicit information and inspects only cheap entry sources. It
  asks no question when the request already satisfies semantic and deterministic
  completeness.
- Each unresolved human decision becomes one active `DecisionQuestion`. It has a stable
  decision key, determining impact, 2–3 mutually exclusive choices, one sourced
  recommendation, and free-form input. The user must answer or cancel.
- Questions are generated lazily. One model evaluation per answer updates all explicit
  decisions in that answer, evaluates semantic sufficiency, and emits at most one next
  question. Runtime validates structure, deduplication, contradictions, redaction, and
  completion without a routine second model call.
- An answered decision is not asked again unless a fresh source invalidates it and the
  workflow reports why. An active question is persisted before display and is presented
  exactly on resume unless its inputs changed.
- After five distinct questions, INTAKE displays a compact checkpoint of resolved and
  remaining decisions. This is not a hard cap and does not permit unresolved context to
  advance.
- The compact Intake Brief contains the canonical objective, primary success signal,
  mode/risk, provenance/freshness, and question state. Success validator, guardrails,
  determining constraints, affected users, motivation, urgency, scope boundaries, and
  transferred technical unknowns exist only when they influence workflow. The brief
  never contains the interview transcript or an unconfirmed model hypothesis.
- Standard and Critical advance automatically to SHAPE only when semantic sufficiency
  and deterministic `intake_complete` both pass. An instruction to move
  on cannot bypass missing context. The transition is not BUILD Approval.
- Quick may advance directly only when `quick_scope_bounded` also proves the request is
  technically localizable, executable without a design decision, and verifiable from
  its success signal.
- Missing objective, success, determining-constraint, or mode/risk context discovered
  later returns to INTAKE and selectively invalidates dependent projections. Technical
  uncertainty remains owned by SHAPE.
- SHAPE consumes the Intake Brief, structured decisions, provenance/fingerprints, source
  references, and explicitly transferred unknowns—not the original interview.
- Invalid model output uses deterministic repair where possible, at most one targeted
  semantic retry, then a typed block. Sensitive data is never requested or persisted.
- INTAKE metrics include zero-question paths, question count, avoided questions,
  recommendation acceptance/modification, tokens/calls, latency, late reopenings, and
  mode changes without content payloads.

### SHAPE

- **Intent:** create smallest sufficient, testable change contract.
- **Preconditions:** confirmed mode, valid constraints/routing, reconciled workspace, and
  Critical worktree when applicable.
- **Consumes:** constraints, classification, routing decision, repository guidance,
  relevant manifests/config/CI/architecture/tests, existing fresh discovery capsule.
- **Produces:** relevant surfaces/dependencies/commands, explicit remaining uncertainty,
  canonical artifact identity/digest, scope/non-goals, acceptance criteria, plan, risks,
  Critical threat and rollback records.
- **Owner:** discovery and plan skills propose; parent workflow alone writes artifact.
- **Events:** `discovery.started`, `discovery.widened`, `discovery.completed`,
  `contract.projected`, `artifact.updated`, `capsule.section_updated`,
  `state.transition`.
- **Proof and exit:** `discovery_sufficient + contract_complete`. Exploration widens only
  when uncertainty can change scope, risk, mode, criteria, plan, or validation.
- **Failure/resume:** missing evidence triggers targeted reinspection; contradictory or
  unavailable required context blocks. Resume reuses only fingerprint-valid sections.
- **Invalidation:** Git, config, policy, guidance, request, artifact, dependency, or test
  command changes invalidate only dependent discovery/contract sections; ambiguous
  impact invalidates conservatively.
- **Metrics:** inspected surfaces, widening reasons, capsule reuse/invalidation counts,
  reasoning calls/effort, context bytes/tokens, latency, and unresolved blocks.

### GATE

- **Intent:** prove human authorization applies to exact material contract or completion
  evidence.
- **Preconditions:** canonical projection and digest exist; requested gate type and actor
  are known.
- **Consumes:** contract projection, artifact identity, prior Approval records and delta;
  Critical completion gate also consumes fresh verification projection.
- **Produces:** immutable Approval record, pending-gate update, rejection/change request,
  or structured delta for re-gate.
- **Owner:** human authorizes; deterministic canonicalizer owns digest/delta; parent
  workflow persists record.
- **Events:** `gate.requested`, `approval.recorded`, `approval.rejected`,
  `approval.invalidated`, `gate.delta_presented`, `state.transition`.
- **Proof and exit:** every gate required by mode/policy has current matching Approval.
  Pre-build gate exits to BUILD; Critical completion gate exits to HANDOFF outcome.
- **Failure/resume:** denial stays waiting or returns to appropriate SHAPE/ASSURE state;
  missing actor/permission blocks. Resume recomputes projection before trusting approval.
- **Invalidation:** objective, scope, non-goals, criteria, mode, risk, behavioral plan, and
  Critical risk controls are material. Evidence/progress alone are not. Ambiguity is
  material.
- **Metrics:** gate count, delta size, approval reuse/invalidation, wait latency,
  reasoning calls avoided, and rejection/block causes.

### BUILD

- **Intent:** execute approved plan atomically with cheapest sufficient deterministic
  feedback.
- **Preconditions:** current pre-build Approvals, authorized task, fresh relevant context,
  safe workspace.
- **Consumes:** approved contract/plan, current atomic task, relevant discovery context,
  validation commands, prior checkpoints and active Issues.
- **Produces:** code/doc changes, task checkpoints, changed-surface fingerprints,
  progressive validation evidence, stable Issues, remaining actions.
- **Owner:** parent workflow is sole writer; execute skill changes one approved task;
  deterministic commands own check results.
- **Events:** `build.task_started`, `build.task_completed`, `check.started`,
  `check.completed`, `issue.observed`, `issue.corrected`, `checkpoint.recorded`,
  `scope_change.detected`, `state.transition`.
- **Proof and exit:** all approved tasks checkpointed; required local validation fresh;
  no unresolved blocking Issue. Standard/Critical exit to review; Quick exits to verify.
- **Failure/resume:** correctable checks enter `resolving_build`; material scope change
  stops writes and returns to SHAPE/GATE; limits trigger debug/human block. Resume starts
  first unproved action, never replays completed task blindly.
- **Invalidation:** contract/Approval, Git drift, relevant dependency/config/policy, test
  command, or corrected code changes invalidate affected checkpoints/evidence.
- **Metrics:** model calls/effort, tokens/context, tasks/checkpoints, checks by breadth,
  reruns, corrections, failures, capsule reuse, latency, and resume divergence.

### ASSURE

- **Intent:** independently inspect applicable risk and prove accepted behavior without
  reconstructing whole repository context.
- **Preconditions:** BUILD complete, validation fresh, Diff Capsule derivable, no known
  deterministic blocker.
- **Consumes:** approved criteria/risks, changed and impacted surfaces, dependency map,
  fresh validation evidence, active/resolved Issue fingerprints.
- **Produces:** Diff Capsule, lane applicability decisions, findings, resolution links,
  verification evidence mapped to every acceptance criterion.
- **Owner:** review skill or independent read-only Critical lanes own findings; verify
  skill owns evidence assessment; parent workflow alone records updates.
- **Events:** `diff_capsule.created`, `lane.activated`, `lane.not_applicable`,
  `review.completed`, `finding.observed`, `finding.resolved`, `verification.completed`,
  `evidence.invalidated`, `state.transition`.
- **Proof and exit:** `review_satisfied` where required and `verification_complete` for all
  modes. Critical then enters completion gate; other modes enter HANDOFF.
- **Failure/resume:** correctable issues enter `resolving_assure`; deterministic failures
  block expensive review; cycle limit blocks for human action. Resume reuses only fresh
  findings/evidence.
- **Invalidation:** diff, affected dependencies, criteria/risk, policy, command set, lane
  assumptions, or supporting fingerprints invalidate linked findings/evidence. Ambiguous
  lane applicability activates lane.
- **Metrics:** review lanes, N/A lanes, model calls/effort/tokens, context bytes, findings
  reused/invalidated, checks rerun, cycles, latency, and block causes.

### HANDOFF

- **Intent:** produce truthful local or external completion without duplicate side
  effects.
- **Preconditions:** fresh verification complete; Critical completion Approval current;
  handoff intent explicit.
- **Consumes:** acceptance criteria, verification references, workspace identity, handoff
  intent, persisted idempotency identities and receipts, local/remote observations.
- **Produces:** commit/push/PR receipts, reconciliation result, remaining external actions,
  deterministic final summary, truthful terminal state.
- **Owner:** deterministic Git/provider adapters own observations and receipts; parent
  workflow decides state from contract; no new reasoning call writes final summary.
- **Events:** `handoff.intent_resolved`, `handoff.reconciled`, `handoff.attempted`,
  `handoff.receipt_recorded`, `handoff.deferred`, `task.finished_local`, `task.finished`,
  `state.transition`.
- **Proof and exit:** no external intent gives `finished_local`; selected/required work
  fully receipted gives `finished`; recoverable missing permission/action gives
  `ready_for_handoff`; non-recoverable required-outcome failure gives `failed`.
- **Failure/resume:** reconcile before every retry; reuse matching result; ambiguity
  blocks/defer without guessing. `merge: never` always enforced.
- **Invalidation:** verification/diff, handoff intent, local commit/ref, remote ref, PR
  identity, permissions, or provider observations require reconciliation and may
  invalidate receipts or terminal eligibility.
- **Metrics:** Git/provider calls, retries avoided, reconciliations, duplicate attempts
  prevented, receipts, latency, blocks, model calls (target zero for summary), and false
  success count (target zero).

### Opt-in local benchmark follow-up

The benchmark follow-up accepted by
[ADR 0007](adr/0007-collect-opt-in-local-benchmark-feedback.md) is outside the six
macro-phases and is implemented as an out-of-band local facility.

- `$dev-flow --benchmark [quick|standard|critical] <objective>` opts a new task in. The
  flag persists across resume and is visible through status.
- After `finished_local`, `finished`, or `failed`, three fixed, deterministic questions
  collect satisfaction, conformance, and perceived Dev Flow value. No model call occurs.
- `blocked`, `ready_for_handoff`, and `cancelled` do not trigger the questionnaire.
- Only a complete questionnaire is written. Non-response creates no record and
  contributes no benchmark data.
- Deviation facts compare Quick against the canonical request/Intake Brief and
  Standard/Critical against the current approved Change Artifact.
- Complete local records live under gitignored `.codex/benchmarks/`, contain no task
  content, and are never uploaded. Benchmark failure cannot change the task outcome.
- `npx codex-dev-flow benchmark summary` aggregates complete records deterministically.

## Event and evidence rules

- Non-structural guards accept only versioned `GuardEvidence` attestations bound to
  current state revision and replayable fingerprint, with non-empty evidence references,
  observed fingerprint, provenance, and result. A caller-provided guard identifier is
  never proof. Attestations remain claims until a guard-specific trusted evaluator
  validates their source.
- Runtime exposes guard-specific evaluators for `intake_complete`, `verification_complete`,
  `handoff_intent_resolved`, `handoff_reconciled`, and
  `critical_completion_approved`. Verification requirements are fixed on task state,
  linked to the pre-build contract digest when that gate applies, and cannot be chosen
  by the completion call. Evaluators validate exact evidence sets, exit codes, freshness,
  outcomes, handoff target compatibility, and Critical approval/verification identity;
  generic `createGuardAttestation` cannot mint these guards.
- Trusted evaluator outputs are runtime-branded, deeply immutable records. Transition
  history stores a state-bound receipt containing evaluator/outcome, normalized input
  digest, evidence references, subject/completion sets, and receipt digest. Reload
  validation recomputes receipt integrity and semantic invariants; detached raw objects
  cannot authorize a live transition.
- Transition events retain compact guard-evidence summaries and gate decision
  reference/digest so success remains auditable after transition.
- Pure V1 migration accepts only exact V1 statuses and a continuous legal history whose
  latest target matches current status. It projects validated legacy edges into explicit
  `migration-history` evidence; missing, broken, ambiguous, or success-only histories
  are rejected rather than upgraded.
- V2 state records effective mode and provenance. `critical_workspace_ready` is
  conditionally required only when mode is `critical`; Standard never claims it passed.
- `awaiting_approval` records `pendingGate` as `pre_build` or
  `critical_completion`; a bound gate decision cannot cross those contexts.
- Every state change emits `state.transition` with monotonic sequence, source, target,
  timestamp, and relevant artifact/issue/receipt references.
- Block, resume, approval, terminality, Issue correction, and handoff events meet D-05
  retention and redaction rules.
- Event history proves progression, not detailed test output or approved prose.
- A terminal event for `cancelled` or `failed` records source status. Missing or invalid
  source makes state invalid rather than guessing phase.
- Evidence records command/check identity, result, observed fingerprint, time, and owner
  reference. They exclude secrets and full output.
- Estimated token/cost data is labeled `estimated`; native measured data is labeled
  `measured`. Neither changes success criteria.

## Resume contract

1. Validate and, where authorized, migrate state before action.
2. Reconcile config, policy, routing, artifact, Git/worktree, evidence, and handoff
   observations.
3. Selectively invalidate affected capsule sections.
4. For `blocked`, validate `resumeTo` and target guards, then transition only to exact
   target. An unchanged obstacle records deferred resume and remains `blocked`.
5. For `ready_for_handoff`, reconcile receipts and remote state. Enter `finished` only
   when matching completion already exists; otherwise enter `handing_off` when action is
   now possible or remain ready.
6. Never resume terminal state or replay a checkpointed task without invalidation proof.

## Projection requirements for P0.3 and P0.4

Executable registry must contain, for every state:

- direct or derived macro-phase rule;
- explicit outgoing transitions;
- stable and terminal flags;
- guard identifiers;
- legal block/resume and terminal-source rules;
- capsule groups consumed, produced, and invalidated;
- event types emitted.

`npm run check` must fail when registry, `TaskStatus`, JSON Schema enum/conditionals, or
this Markdown projection diverge. Tests must traverse Quick, Standard, Critical,
BUILD/ASSURE resolution loops, block/resume, Critical completion gate, every HANDOFF
outcome, and total deterministic macro-phase derivation.
