# Minimal GATE and five-phase lifecycle

## Status

Approved design for TaskState V4. Runtime implementation pending.

## Objective

Make GATE a deterministic, extremely short user validation of the implementation plan,
then end dev-flow immediately after verified ASSURE. Delegate conversation resume and
external Git/GitHub/release actions to native Codex behavior.

## Authorities

- [ADR 0024](../../plugins/codex-dev-flow/docs/adr/0024-make-gate-a-minimal-plan-approval.md)
- [ADR 0025](../../plugins/codex-dev-flow/docs/adr/0025-end-the-lifecycle-after-assure.md)
- [ADR 0009](../../plugins/codex-dev-flow/docs/adr/0009-separate-intake-decisions-from-shape-discovery.md)
- [ADR 0010](../../plugins/codex-dev-flow/docs/adr/0010-choose-quick-or-plan-after-discovery.md)

## Scope

- replace TaskState V3 with an explicit V4 schema;
- reduce lifecycle to INTAKE, SHAPE, GATE, BUILD, ASSURE;
- make GATE one pre-BUILD plan approval with deterministic preflight and rendering;
- add bounded decision parsing and a read-only full-contract view;
- bind one compact Plan Approval Receipt to the full canonical contract digest;
- route GATE failures and requested changes without losing valid SHAPE work;
- remove completion approval and every HANDOFF state, guard, capsule, event, receipt,
  configuration, metric, benchmark field, and public claim;
- transition successful ASSURE directly to `finished` with verification evidence;
- update generated schemas, lifecycle projections, distribution bundle, skills, docs,
  metrics allowlists, fixtures, and tests.

## Non-goals

- implementing commit, push, pull request, merge, publication, or release orchestration;
- storing external actions for later resume;
- adding a replacement DELIVERY phase;
- adding model review, repository discovery, network access, or subprocess checks to
  GATE;
- migrating V1, V2, or V3 task state;
- weakening native Codex confirmation requirements for external or destructive actions;
- changing SHAPE discovery/planning ownership beyond targeted return seams.

## Target domain model

### PlanApprovalReceipt

One immutable active authorization exists only after `approved` and contains:

- schema version;
- decision actor fixed to `user`;
- decision timestamp;
- task ID and canonical artifact ID;
- full contract digest;
- source state revision and fingerprint;
- receipt digest.

Decision history records `approved`, `change_requested`, or `rejected` without raw chat
content. A change instruction uses the existing bounded/redacted structured input path.

### GatePreflight

One pure deterministic evaluation returns either `ready` or one typed targeted route:

- `discovering` for stale or incomplete evidence;
- `planning` for incomplete contract, coverage failure, or digest mismatch;
- `awaiting_intake_decision` for an open product decision;
- `blocked` for malformed persisted state.

### GateCard

One deterministic projection is limited to five lines:

```text
Objectif : <bounded objective>
Plan : <tasks> tâches · <criteria> critères · <validations> validations
Risque : <level> · <controls> contrôles
Contrat : <short digest>
[Approuver] [Modifier] [Rejeter]
```

`view` renders the canonical contract read-only and does not change state, revision,
history, or approval.

### VerificationReceipt

ASSURE success persists bounded criterion coverage, validation identities/results,
freshness fingerprint, timestamp, and receipt digest before entering `finished`.

## Target lifecycle

```text
new -> intaking -> discovering -> awaiting_profile_choice -> planning
     -> awaiting_approval -> executing -> validating/reviewing/verifying -> finished
```

Existing correction, block, cancellation, and exact-resume paths remain only where they
belong to the five retained phases. There is no completion GATE and no post-ASSURE phase.

## Acceptance criteria

- **GATE-V4-AC-01:** Quick and Plan enter the same `awaiting_approval` contract after a
  current complete SHAPE contract.
- **GATE-V4-AC-02:** GATE preflight performs zero model, network, discovery, and
  subprocess operations.
- **GATE-V4-AC-03:** Preflight proves current planning receipt, canonical digest,
  criterion-validation coverage, evidence freshness, and absence of open escalation.
- **GATE-V4-AC-04:** Each preflight failure returns to its exact owner without resetting
  unrelated SHAPE state.
- **GATE-V4-AC-05:** GateCard rendering is deterministic, bounded to five lines, and
  shows objective, counts, risk/control count, and short digest.
- **GATE-V4-AC-06:** Only explicit approve, change-with-instruction, reject, and read-only
  view intents are accepted; ambiguous continuation is rejected without a model call.
- **GATE-V4-AC-07:** View does not mutate persisted state or approval history.
- **GATE-V4-AC-08:** Approval creates one receipt bound to user, time, task/artifact,
  full digest, revision, and fingerprint; raw conversation is absent.
- **GATE-V4-AC-09:** Approval covers the whole local contract and never authorizes an
  external Git, GitHub, registry, or release action.
- **GATE-V4-AC-10:** Change request returns to Planning; SHAPE alone escalates
  product-impacting instructions to INTAKE.
- **GATE-V4-AC-11:** Reject transitions to `cancelled` and never enters BUILD.
- **GATE-V4-AC-12:** Resume reuses approval only while the contract and referenced SHAPE
  evidence remain current; there is no arbitrary time expiry.
- **GATE-V4-AC-13:** Any canonical contract digest change invalidates approval.
- **GATE-V4-AC-14:** Non-interactive execution remains `awaiting_approval`; no flag,
  config, or policy bypass exists.
- **GATE-V4-AC-15:** Successful ASSURE persists a compact VerificationReceipt and
  transitions directly to `finished`.
- **GATE-V4-AC-16:** Public and runtime contracts contain exactly five macro-phases and
  no HANDOFF state, capsule, guard, event, receipt, metric, or configuration.
- **GATE-V4-AC-17:** `finished` is the sole success terminal; `finished_local` and
  `ready_for_handoff` are rejected.
- **GATE-V4-AC-18:** V1, V2, and V3 state load fails with the existing typed incompatible
  schema class and no migration API exists.
- **GATE-V4-AC-19:** Metrics contain only allowlisted preflight outcomes, decision kinds,
  approval reuse, and targeted returns; no content, digest, or path is emitted.
- **GATE-V4-AC-20:** Full typecheck, build, Bun tests, runtime smoke, package/release
  tests, source coverage ratchet, and deterministic size budget pass.

## Implementation plan

1. **Introduce V4 types and strict schema boundary**
   - Define PlanApprovalReceipt, GateDecisionHistory, GatePreflightResult, GateCard, and
     VerificationReceipt.
   - Remove ApprovalGate, pendingGate, HANDOFF types, remaining actions, and V3-only
     terminal outcomes.
   - Regenerate strict state schema and reject V1/V2/V3 explicitly.
   - Verify AC-08, AC-16, AC-17, and AC-18 with focused schema/state tests.

2. **Build pure GATE primitives**
   - Implement deterministic preflight, five-line card renderer, explicit intent parser,
     read-only canonical view, receipt creation, and full-digest invalidation.
   - Keep adapters absent from these functions so model/network/subprocess use is
     structurally impossible.
   - Verify AC-02 through AC-08 and AC-12 through AC-14 with unit tests.

3. **Rewire lifecycle transitions atomically**
   - Make one GATE path from Planning to BUILD for both preparation profiles.
   - Route change, reject, stale evidence, open escalation, and malformed state exactly.
   - Remove completion GATE and transition verified ASSURE directly to `finished`.
   - Verify AC-01, AC-04, AC-09 through AC-11, and AC-15 with lifecycle fixtures.

4. **Delete HANDOFF ownership**
   - Remove states, registry entries, guards, capsules, events, receipts, resume paths,
     exit codes, config, metrics, benchmark fields, and provider-oriented tests owned
     solely by HANDOFF.
   - Preserve native release tooling as repository tooling outside TaskState lifecycle.
   - Verify AC-16, AC-17, and AC-19 with negative symbol/schema assertions.

5. **Align public projections and generated artifacts**
   - Update lifecycle contract, README, design, glossary, public and stage skills, ADR
     cross-references, metrics protocol, benchmark docs, schema projection, fixtures,
     and distribution bundle.
   - State clearly that external delivery occurs after dev-flow through native Codex and
     is not covered by Plan Approval.

6. **Run complete evidence gates**
   - Run `bun install --frozen-lockfile`.
   - Run `bun run check`.
   - Run `bun run pack:runtime` and plugin runtime smoke.
   - Run plugin release tests and inspect package contents/size budget.
   - Confirm generated files are current and `git diff --check` passes.

## Delivery

1. Land this design documentation independently.
2. Land one atomic runtime V4 pull request; do not publish a mixed V3/V4 package.
3. Release `0.3.0` only after all acceptance criteria and CI lanes pass.

## Risks and controls

- **False approval reuse:** bind full digest, revision, fingerprint, and evidence
  freshness; invalidate on any contract digest change.
- **GATE scope creep:** enforce structural zero-call/no-adapter tests and five-line
  rendering.
- **Lost product ownership:** route all requested changes to Planning, which alone may
  escalate product impact to INTAKE.
- **External-action confusion:** state repeatedly that approval is local-only and native
  Codex owns post-lifecycle delivery confirmations.
- **Unsafe legacy resume:** reject V3 instead of guessing partial completion/handoff
  semantics.
- **Cross-surface drift:** generate schema/projection/bundle only after registry, types,
  fixtures, skills, and normative docs agree.
