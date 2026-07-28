# Codex Dev Flow Design

## Status and authority

This document is a public design projection of the normative
[lifecycle contract](lifecycle-contract.md). It deliberately separates shipped
capabilities, partial primitives, and future targets.

- **Available:** plugin skills, deterministic invocation parsing, strict configuration
  and policy resolution, routing snapshots and decisions, issue fingerprinting,
  worktree decisions, verification-command discovery, standalone `init` CLI,
  canonical 18-state registry, strict durable V2 state, adaptive INTAKE, local benchmark
  storage/summary, guard-specific
  evaluator receipts, macro-phase derivation, pure V1→V2 migration, complete path tests,
  redacted metric events, and reproducible P0 contract-fixture baseline.
- **Partial:** evaluator/metric contracts exist without full command/provider
  orchestration. Full provider reconciliation and actionable resume remain incomplete.
- **Current target:** invalidable Context Capsule, content-bound Approvals, full
  orchestration, risk-adaptive assurance, and idempotent handoff.

## Goal

`codex-dev-flow` is a portable Codex plugin for disciplined software changes. Its public
workflow surface is `$dev-flow`; internal stage skills support that workflow rather than
acting as separate product commands.

Quota and token use are optimization goals. Reliability and absence of false success
remain hard constraints.

## Public interface

```text
$dev-flow [quick|standard|critical] "<objective>"
$dev-flow --benchmark [quick|standard|critical] "<objective>"
$dev-flow resume <task-id>
$dev-flow status [task-id]
$dev-flow config show --explain
$dev-flow config validate
npx codex-dev-flow benchmark summary
```

The deterministic parser recognizes these forms. `status <task-id>` reads durable V2
state; actionable resume reconciliation remains incomplete. Mode classification and full
lifecycle orchestration remain skill-directed.

Project initialization belongs to the standalone npm CLI:

```text
npx codex-dev-flow init
```

## Architecture

[ADR 0001](adr/0001-hybrid-portable-workflow.md) selects a hybrid architecture:

- skills own scoped reasoning for discovery, planning, execution, debugging, review,
  and verification;
- deterministic code owns parsing, configuration, policy, routing, fingerprints,
  worktree decisions, state validation, and eventually artifact/evidence arbitration;
- the parent `$dev-flow` workflow owns orchestration and every repository write;
- delegated stages are read-only except the single parent-owned BUILD writer.

Bundled internal skills are `discover-change`, `plan-change`, `execute-change`,
`debug-root-cause`, `review-change`, and `verify-change`. External plugins or skills are
eligible only when explicitly allowlisted through `integrations.plugins` or
`integrations.skills`; allowlisting never makes an irrelevant skill active.

## Canonical lifecycle

The public lifecycle has exactly six macro-phases:

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE -> HANDOFF
```

Macro-phase is derived from internal status and is never persisted. Quick records SHAPE
and GATE as not applicable only while its bounded, non-destructive guard remains true.
Standard traverses all six phases. Critical adds worktree readiness, risk records,
pre-build and completion Approvals, and independent read-only assurance lanes.

### Internal states

```text
new
awaiting_mode_confirmation
discovering
planning
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

The canonical transition table, named guards, state-to-phase derivation, mode paths, and
BUILD/ASSURE correction loops live only in the
[lifecycle contract](lifecycle-contract.md). Public prose must not invent shortcuts.

`blocked` and `ready_for_handoff` are stable, resumable, non-terminal states.
`cancelled`, `failed`, `finished_local`, and `finished` are terminal. A terminal
`cancelled` or `failed` event records its source state so the last active macro-phase is
derived without persisting it. `ready_for_handoff` resumes by reconciliation before any
external side effect.

## Uniform phase contract

Every macro-phase declares:

- intent and preconditions;
- Context/Diff Capsule fields consumed and produced;
- sole owners and consumers;
- events and proof required for exit;
- correctable errors, block/resume rules, and invalidation;
- quota, token, reliability, and false-success metrics.

The Context Capsule shares compact provenance and freshness references; it does not own
approved scope or detailed evidence. See
[ADR 0002](adr/0002-share-an-invalidable-context-capsule.md) and the
[glossary](glossary/dev-flow.md).

Metrics accept only allowlisted numeric/enumerated data and hashed task identity.
Measured, estimated, and unavailable values remain distinct. See
[measurement protocol](metrics-protocol.md).

## Mode and execution policy

- **Quick:** explicit, bounded, non-destructive work may enter BUILD directly after
  confirmed INTAKE. Ambiguity, expansion, destructive impact, or policy sends it through
  SHAPE/GATE before further writes.
- **Standard:** read-only SHAPE, complete canonical contract, content-bound pre-build
  Approval, one atomic BUILD task at a time, structured review, verification, and
  HANDOFF.
- **Critical:** safe worktree before repository mutation, threat/operational/rollback
  records, required pre-build Approval, independent applicable assurance lanes, fresh
  verification, and completion-evidence Approval before HANDOFF.

Configuration resolves before policy. Policy may strengthen but never weaken locked
rules. `merge: never`, evidence before success, Critical isolation, and required human
gates are non-bypassable target invariants.

## Artifacts and local state

One logical versioned change artifact owns detailed contract prose and evidence
references. Its physical layout is selected by repository policy, not by Standard or
Critical mode. `.codex/tasks/<task-id>/state.yaml` is the target location for compact,
gitignored resumable state; current runtime does not yet persist the complete V2 state.

The parent workflow alone writes artifacts. Approval is bound to canonical artifact
identity and digest, not a filename or boolean. See the
[artifact contract](artifacts.md) and
[ADR 0003](adr/0003-bind-approvals-to-canonical-contracts.md).

## Reliability and assurance

Failures and findings use stable deterministic fingerprints when supported by current
helpers. The target correction policy counts attempts per stable issue, requires
root-cause investigation after two failed corrections, and blocks for human action when
the correction budget is exhausted.

ASSURE consumes a compact Diff Capsule. Standard runs one structured risk-aware review.
Critical activates independent lanes by applicable risk; omission requires structured
evidence, and ambiguity activates the lane. See
[ADR 0004](adr/0004-scale-assurance-lanes-by-applicable-risk.md).

Fresh verification must map every acceptance criterion to evidence. A green narrow
test proves only its covered behavior, never the complete lifecycle.

## Handoff

Commit, push, and pull-request intent is explicit. `finished_local` means no external
action is selected or required; `finished` means every selected/required action has a
receipt. Recoverable missing permission produces `ready_for_handoff`, never success.
Retries reconcile identities and existing results before side effects. Automatic merge
is forbidden. See
[ADR 0005](adr/0005-make-handoff-intent-aware-and-idempotent.md).

Current Git/provider orchestration, receipt persistence, and reconciliation are roadmap
targets, not shipped end-to-end behavior.

## Configuration and routing available today

Configuration resolves in this order:

```text
internal defaults < user < repository < local < invocation flags
```

Strict schemas reject unknown or forbidden values. Policy applies afterward and cannot
grant Git/GitHub permission.

One `codex app-server` snapshot per run/resume supplies account, five-hour quota, and
model catalog observations. Routing is pure and deterministic, accepts only the exact
configured model/effort pairs, and blocks unavailable assignments instead of silently
substituting them. Parent workflow retains mutation and validation. Permission-related
app-server startup may receive one explicitly approved retry; silent elevation is
forbidden.

## Validation boundary

Current automated checks cover primitives, documentation contracts, and complete
in-memory Quick, Standard, Critical, correction, resume, gate, and HANDOFF paths. They do
not prove complete repository/provider orchestration or runtime token/latency telemetry.
