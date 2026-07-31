# Adaptive SHAPE and post-Discovery Quick/Plan profile

## Objective

Replace the declarative, mode-split SHAPE behavior with one resumable adaptive SHAPE
runtime that:

- consumes the compact adaptive Intake output without repeating product discovery;
- performs only material, evidence-backed repository discovery;
- separates repository-reading Discovery from repository-blind Planning;
- asks the user to choose Quick or Plan after Discovery is sufficient;
- persists explicit dependencies so invalidation never resets all SHAPE work;
- produces one canonical contract at profile-appropriate depth;
- proves `discovery_sufficient` and `contract_complete` without routine model
  re-verification;
- deliberately replaces the legacy `quick|standard|critical` state contract rather
  than migrating it.

Decision authority:

- [ADR 0009](../../plugins/codex-dev-flow/docs/adr/0009-separate-intake-decisions-from-shape-discovery.md)
- [ADR 0010](../../plugins/codex-dev-flow/docs/adr/0010-choose-quick-or-plan-after-discovery.md)

## Current repository evidence

- `src/types.ts`, `schemas/state.schema.json`, `src/state-machine.ts`, and `src/state.ts`
  persist `TaskMode`, mode confirmation, mode-bound transition tables, and V1-to-V2
  migration.
- `src/intake.ts` owns mode selection and lets legacy Quick bypass SHAPE/GATE.
- No dedicated SHAPE state or runtime exists. Current SHAPE behavior is limited to
  registry declarations plus `discover-change` and `plan-change` skill prose.
- `discover-change` and `plan-change` are both read-only, but no deterministic contract
  prevents Planning from compensating for missing evidence or proves structured
  Discovery-to-Planning handoff.
- Freshness is repository-level or reference-level, not source-granular per evidence
  item.
- Metrics, benchmarks, routing, worktree decisions, lifecycle fixtures, documentation,
  and artifact tests all encode legacy modes.
- State storage automatically migrates legacy state; the accepted design requires a
  clear hard schema rejection instead.

## Scope

### Included

- strict task state V3 with no `TaskMode`;
- removal of legacy invocation mode arguments and migration paths;
- Intake boundary adjustment: Intake keeps product context and risk, then always enters
  Discovery;
- canonical `ShapeState`, source fingerprints, explicit dependency graph, targeted
  invalidation, and soft-budget checkpoints;
- adaptive Discovery runtime and trusted `discovery_sufficient` receipt;
- rich SHAPE-to-INTAKE Decision Escalation and exact late-decision resume;
- stable post-Discovery Quick/Plan choice;
- Planning runtime, canonical contract, trusted `contract_complete` receipt, Quick
  compact projection, Plan Markdown projection, and manual-edit reconciliation;
- canonical state-machine statuses, guards, events, capsule contracts, and resume rules
  through the GATE boundary;
- minimal mechanical adaptations in routing, worktree, benchmark, metrics, and
  downstream consumers required to compile and consume the new risk/profile contract;
- skills and normative/public documentation for INTAKE and SHAPE;
- deterministic unit, schema, state, resume, lifecycle, artifact, and distribution
  tests.

### Excluded

- redesigning GATE approval UX beyond accepting the new canonical contract/profile;
- redesigning BUILD correction policy;
- redesigning ASSURE lanes;
- redesigning HANDOFF intent or receipts;
- compatibility aliases for old invocation modes;
- V1/V2 task-state import or migration;
- benchmark-derived default numeric SHAPE budgets before runtime samples exist;
- automatic upload of metrics or benchmark records.

Later phase passes may replace their behavior, but this change must leave their inputs
coherent and the package validation suite green.

## Invariants

1. INTAKE owns product intent, observable success, determining constraints, and risk.
   It does not own preparation profile or deep technical discovery.
2. Discovery alone may read repository sources. Planning receives structured fresh
   evidence and cannot silently reread the repository.
3. A technical alternative with product impact becomes a rich Decision Escalation and
   an explicit INTAKE decision.
4. A changed decision, source, evidence item, or contract section invalidates only its
   transitive dependency closure. SHAPE has no reset-all operation.
5. Quick and Plan share the same minimum Discovery required for correct BUILD.
6. Profile choice occurs after `discovery_sufficient` and before Planning.
7. Quick and Plan share one canonical contract schema. Profile changes required depth
   and durable projection, not safety.
8. Risk and policy own worktree, threat, rollback, approval, and assurance controls.
9. Model semantic judgments require deterministic structural checks, but never a
   routine second model judgment.
10. Parent workflow alone persists state and writes the Plan projection.
11. State V1/V2 is rejected with an explicit incompatible-schema error. No legacy data
    is treated as current evidence.

## Canonical data model

### Task state V3

`TaskState.schemaVersion` becomes `3`. Remove:

- `mode`;
- `modeEvidenceRef`;
- `modeConfirmed`;
- mode fields from transition/history summaries;
- V1/V2 migration metadata and APIs.

Add:

- canonical task `risk`;
- `shape?: ShapeState`;
- generic risk/policy-derived workspace readiness;
- GATE entry contract references independent of legacy mode.

`IntakeBrief` retains `risk` and removes `mode`. Intake metrics remove `modeChanges`.

### Shape aggregate

```text
ShapeState
├── schemaVersion
├── discoveryTargets[]
├── evidence[]
├── sourceFingerprints[]
├── decisionEscalations[]
├── preparationProfileChoice?
├── contract?
├── dependencyGraph
├── invalidations[]
├── projection?
├── budget
├── semanticRetryCounts
└── evaluatorReceipts
```

All identifiers use stable bounded IDs. Persisted strings use existing redaction and
length controls.

### Discovery target

Each `DiscoveryTarget` contains:

- stable ID and technical question;
- possible material impact categories:
  `scope|risk|acceptance|plan|validation|profile_recommendation`;
- candidate source references;
- status: `open|resolved|escalated|blocked|stale`;
- resulting evidence IDs;
- dependency node ID;
- creation reason and timestamps.

A Discovery session may resolve multiple related targets. A target can widen Discovery
only by creating another target with a material impact.

### Evidence and freshness

Each `EvidenceItem` contains a bounded technical fact, provenance references, exact
source fingerprint IDs, dependency node ID, and freshness status.

Supported source fingerprints:

- tracked file: Git blob identity;
- untracked/config file: content digest;
- command: command identity, relevant input digests, and observed-result digest;
- external source: stable identity, observed time, and policy TTL when applicable.

Resume checks only fingerprints referenced by live evidence. A mismatch creates one
targeted refresh target and invalidates its dependency closure.

### Dependency graph

Persist one canonical acyclic graph:

```text
DependencyNode {
  id
  kind: decision|source|evidence|criterion|task|risk|validation|guide|projection
  dependsOn[]
}
```

Runtime must reject:

- missing references;
- duplicate IDs;
- self-dependencies;
- cycles;
- node-kind mismatches;
- invalidated nodes used by a completion receipt.

Closure traversal must be deterministic and bounded. Ambiguous dependency impact creates
a targeted Discovery Target or block; it never broadens to a reset-all operation.

### Decision escalation

`DecisionEscalation` contains:

- stable escalation and decision keys;
- evidence/provenance references;
- product impact;
- two or three feasible mutually exclusive options;
- recommended option and evidence-backed basis;
- affected dependency roots;
- exact prior SHAPE substate.

Opening an escalation enters `awaiting_intake_decision`. Intake presents the linked
Decision Question without repeating repository discovery. After answer, runtime
invalidates the decision closure and resumes `discovering` when evidence is missing,
otherwise `planning`.

### Preparation profile choice

After a valid Discovery receipt, persist:

```text
PreparationProfileChoice {
  status: pending|selected
  recommendation: quick|plan
  recommendationBasis
  discoveryReceiptDigest
  checkpoint
  selectedProfile?
  selectionEvidenceRef?
}
```

The checkpoint contains only change shape, surface categories/count, material
dependency/migration/validation facts, and one short reason. Full evidence stays in
state.

An explicit initial request for a durable plan or a policy lock may pre-resolve Plan.
Otherwise `awaiting_profile_choice` requires an explicit answer. Silence never chooses
the recommendation. Once selected, the profile survives later
Planning-to-Discovery loops unless fresh policy forbids it or the user explicitly
changes it.

### Canonical change contract

Quick and Plan share:

- artifact identity and revision;
- Intake and Discovery receipt references;
- selected profile and risk;
- scope and applicable non-goals;
- stable acceptance criteria;
- ordered tasks with criterion coverage;
- validation mapped to every criterion;
- applicable risks and controls;
- explicit dependency nodes;
- canonical digest.

Quick permits a compact linear contract and no Markdown projection. Minimum valid Quick
contract may be one criterion, one task, and one validation.

Plan additionally requires detailed scope/non-goals, atomic task dependencies, rationale
only where evidence-backed, and one Markdown projection. An Implementation Guide is
allowed only with `guideRequiredBecause` references for an architectural boundary,
compatibility/migration rule, non-obvious order, security/concurrency/performance
invariant, mandatory repository pattern, or complex rollback/deployment.

### Plan projection

Canonical state owns contract content. Parent renders
`docs/dev-flow/YYYY-MM-DD-<slug>.md` by default, with config/policy override subject to
safe repository-relative path validation.

Projection lifecycle:

1. render `Proposed` from canonical content;
2. persist projection fingerprint;
3. present projection and logical digest to GATE;
4. mark `Approved` without changing logical contract content;
5. on manual edit, block silent overwrite/import and return to Planning for explicit
   integrate-or-regenerate reconciliation;
6. invalidate Approval for any integrated material change.

## State-machine projection

Required INTAKE/SHAPE statuses:

```text
new
intaking
discovering
awaiting_profile_choice
planning
awaiting_intake_decision
```

Primary edges:

```text
new -> intaking
intaking -> discovering
discovering -> awaiting_profile_choice
awaiting_profile_choice -> planning
planning -> discovering
discovering|planning -> awaiting_intake_decision
awaiting_intake_decision -> discovering|planning
planning -> GATE entry
```

The GATE pass may rename or expand its entry state. This change must expose one generic
GATE boundary rather than a mode-specific shortcut.

Required guards:

- `task_initialized`;
- `effective_constraints_valid`;
- `intake_complete`;
- `routing_ready`;
- `workspace_ready`;
- `discovery_sufficient`;
- `profile_selected`;
- `contract_complete`;
- existing generic resume/terminal guards.

Remove:

- `mode_confirmed`;
- `quick_scope_bounded`;
- `critical_workspace_ready`;
- mode arrays and mode-conditional transition definitions.

Required trusted evaluators:

- `intake`;
- `discovery`;
- `planning`;
- existing downstream evaluators until their later redesign.

Required SHAPE events:

- `discovery.target_recorded`;
- `discovery.evidence_recorded`;
- `discovery.completed`;
- `profile.choice_requested`;
- `profile.choice_recorded`;
- `decision.escalated`;
- `contract.projected`;
- `projection.reconciliation_requested`;
- `evidence.invalidated`;
- `shape.checkpoint`;
- `state.transition`.

## Acceptance criteria

### Boundary and hard break

- **SHAPE-AC-01:** Run invocation accepts one objective with optional existing benchmark
  opt-in, but no task mode argument or compatibility alias.
- **SHAPE-AC-02:** Task state V3 and Intake Brief contain risk but no mode,
  mode-confirmation, or Quick-bypass fields.
- **SHAPE-AC-03:** State V1/V2 load fails with a typed, explicit incompatible-schema
  diagnostic; no migration file or inferred conversion is produced.
- **SHAPE-AC-04:** Every complete Intake enters Discovery. No task enters BUILD directly
  from INTAKE.

### Discovery and dependencies

- **SHAPE-AC-05:** Discovery accepts only bounded structured targets/evidence with
  provenance, source fingerprints, material impact, and valid dependency identities.
- **SHAPE-AC-06:** One Discovery evaluation may resolve multiple related targets and
  emit new targets only with a material widening reason.
- **SHAPE-AC-07:** `discovery_sufficient` requires semantic sufficiency plus no live open,
  blocked, or stale material target and no stale supporting evidence.
- **SHAPE-AC-08:** Changed sources invalidate only the exact transitive dependency
  closure; unrelated evidence and contract nodes retain identity and freshness.
- **SHAPE-AC-09:** Missing, duplicate, self-referential, cyclic, or invalid-kind
  dependencies fail closed.
- **SHAPE-AC-10:** Resume reuses unchanged evidence without a Discovery model call and
  creates targeted refresh work only for stale live evidence.

### Intake escalation

- **SHAPE-AC-11:** A product-impacting technical choice persists one rich Decision
  Escalation and exact INTAKE question before display.
- **SHAPE-AC-12:** Answering an escalation does not repeat technical discovery, performs
  selective invalidation, and resumes the correct SHAPE role.
- **SHAPE-AC-13:** A pure technical uncertainty cannot reopen INTAKE.

### Profile choice

- **SHAPE-AC-14:** Profile choice occurs only after a current Discovery receipt and
  before Planning.
- **SHAPE-AC-15:** Visible checkpoint is compact, evidence-backed, and recommends Quick
  for localized linear work or Plan for material durable-planning value.
- **SHAPE-AC-16:** Explicit plan request or policy lock avoids a redundant choice;
  otherwise an exact persisted Quick/Plan answer is mandatory and crash-resumable.
- **SHAPE-AC-17:** Later Discovery widening retains the selected profile unless fresh
  policy or explicit user change invalidates it.

### Planning and contract

- **SHAPE-AC-18:** Planning consumes only fresh structured Discovery evidence. Missing
  evidence produces a new Discovery Target rather than a repository read or invented
  fact.
- **SHAPE-AC-19:** Quick and Plan contracts share one schema and map every task to a
  criterion and every criterion to both task coverage and validation.
- **SHAPE-AC-20:** Quick accepts the compact minimum without Markdown while preserving
  all correctness, freshness, and risk requirements.
- **SHAPE-AC-21:** Plan emits one canonical detailed contract and one deterministic
  Proposed Markdown projection; Implementation Guide presence requires an admissible
  evidence-linked trigger.
- **SHAPE-AC-22:** `contract_complete` requires semantic implementability plus fresh
  evidence, complete coverage, valid dependencies, selected profile, and
  profile/policy-applicable sections.
- **SHAPE-AC-23:** Manual Plan projection drift cannot be silently imported or
  overwritten; material reconciliation changes invalidate digest and Approval.

### Cost, privacy, and integration

- **SHAPE-AC-24:** Nominal SHAPE records one Discovery session and one Planning session;
  additional calls require a new material or invalidated target.
- **SHAPE-AC-25:** Soft-budget exhaustion persists all work and offers continue,
  scope-reduction, or cancellation without reset or silent overspend.
- **SHAPE-AC-26:** Metrics contain only allowlisted numeric/enumerated profile/SHAPE
  facts; no objective, code, evidence prose, raw command output, or user answer payload.
- **SHAPE-AC-27:** Lifecycle fixtures prove both Quick and Plan traverse all six phases,
  while critical safeguards derive from risk/policy rather than profile.
- **SHAPE-AC-28:** Full package check passes with strict schema, distribution, docs,
  state, resume, lifecycle, and release tests.

## Implementation plan

### Lot 1 — Hard state-contract replacement

1. **Define V3 public types and remove mode**
   Files: `src/types.ts`, `schemas/state.schema.json`.
   Add risk, `PreparationProfile`, Shape types, graph/fingerprint/contract types, new
   statuses/events/receipts. Remove `TaskMode`, mode confirmation, legacy history fields,
   and mode-bound benchmark/metric fields.
   Covers: `AC-02`, `AC-05`, `AC-09`, `AC-19`, `AC-26`.

2. **Delete migration behavior and fail old state clearly**
   Files: `src/state.ts`, `src/state-store.ts`, `src/state-validator.ts`, CLI exports,
   state-store/state tests.
   Replace V1/V2 migration with strict V3 loading and typed
   `state_schema_incompatible`; remove backup/migration APIs and fixtures.
   Covers: `AC-03`, `AC-28`.

3. **Remove mode invocation and Intake ownership**
   Files: `src/parse.ts`, `src/cli.ts`, `src/intake.ts`, types, schemas, parse/CLI/Intake
   tests.
   Parse the entire run text as objective, remove mode decisions and metrics, keep risk,
   and route complete Intake only to Discovery.
   Covers: `AC-01`, `AC-02`, `AC-04`.

4. **Move mechanical safety/routing dimensions off mode**
   Files: `src/routing.ts`, `src/worktree.ts`, `src/metrics.ts`, `src/benchmark.ts`,
   config/policy integration and tests.
   Use risk/ambiguity/policy for routing and workspace safeguards; use optional
   `preparationProfile`/`unselected` for post-Discovery metrics; benchmark every completed
   task against canonical SHAPE contract.
   Covers: `AC-04`, `AC-26`, `AC-27`.

Verification:

```bash
bun run typecheck
bun run build
node --test test/parse.test.mjs test/intake.test.mjs test/state-store.test.mjs
```

### Lot 2 — Dependency and freshness primitives

1. **Implement graph validation and closure**
   Add focused module such as `src/shape-dependencies.ts`.
   Provide canonical graph construction, cycle/reference/kind validation, deterministic
   transitive closure, and selective invalidation. No reset-all API.
   Covers: `AC-08`, `AC-09`.

2. **Implement source-granular fingerprints**
   Add focused module such as `src/shape-freshness.ts`; reuse hashing primitives without
   mixing issue identity and evidence identity.
   Support Git blob, content, command-input/result, and external TTL records. Reconcile
   only live referenced sources.
   Covers: `AC-05`, `AC-07`, `AC-08`, `AC-10`.

3. **Add adversarial tests**
   New `test/shape-dependencies.test.mjs` and `test/shape-freshness.test.mjs`: cycles,
   missing IDs, stale independent branches, ambiguous impact, bounded closure, unchanged
   resume, and command input changes.
   Covers: `AC-08`, `AC-09`, `AC-10`, `AC-28`.

Verification:

```bash
node --test test/shape-dependencies.test.mjs test/shape-freshness.test.mjs
```

### Lot 3 — Adaptive Discovery and Decision Escalation

1. **Create SHAPE runtime and strict model-evaluation contract**
   Add `src/shape.ts` with creation, Discovery evaluation application, target/evidence
   validation, semantic retry/block behavior, metrics, and trusted
   `discovery_sufficient` evaluation.
   Covers: `AC-05`, `AC-06`, `AC-07`, `AC-24`, `AC-25`.

2. **Implement rich escalation**
   Validate option feasibility/evidence, persist escalation before question display,
   enter `awaiting_intake_decision`, link exact Intake question, and restore prior role
   with selective closure invalidation.
   Covers: `AC-11`, `AC-12`, `AC-13`.

3. **Implement soft-budget checkpoints**
   Add configurable counters/limits without invented defaults. Persist
   continue/reduce-scope/cancel checkpoint and make scope reduction a typed INTAKE
   return.
   Covers: `AC-24`, `AC-25`.

4. **Test nominal, widening, invalid output, escalation, and resume paths**
   New `test/shape.test.mjs` plus state-store crash/resume fixtures. Assert one nominal
   Discovery evaluation, multi-target resolution, one targeted semantic retry, rich
   escalation, no technical reopening, and no full-state replay.
   Covers: `AC-05` through `AC-13`, `AC-24`, `AC-25`.

Verification:

```bash
node --test test/shape.test.mjs test/resume-context.test.mjs
```

### Lot 4 — Post-Discovery Quick/Plan choice

1. **Create deterministic checkpoint and recommendation contract**
   Derive compact allowed fields from current Discovery receipt; validate evidence-linked
   reason and policy lock behavior without a new model call.
   Covers: `AC-14`, `AC-15`, `AC-16`, `AC-24`.

2. **Persist and answer exact choice**
   Add `awaiting_profile_choice`, selected-profile provenance, crash/resume behavior,
   explicit-plan pre-resolution, and no silent default selection.
   Covers: `AC-14`, `AC-16`, `AC-17`.

3. **Test recommendation and persistence**
   Cover localized Quick, cross-surface Plan, explicit Plan, policy-required Plan,
   silence rejection, stale Discovery receipt, exact resume, and later widening that
   retains selection.
   Covers: `AC-14` through `AC-17`.

Verification:

```bash
node --test test/shape-profile.test.mjs
```

### Lot 5 — Planning, completeness, and projection

1. **Implement profile-aware Planning contract**
   Accept only fresh evidence IDs, create canonical Quick/Plan contract, create a
   Discovery Target for missing evidence, enforce criterion/task/validation coverage,
   and validate optional guide triggers.
   Covers: `AC-18` through `AC-22`.

2. **Implement trusted Planning evaluator**
   Add `planning` to trusted evaluators and bind `contract_complete` receipt to state,
   Discovery receipt, selected profile, graph, contract digest, and required section IDs.
   Covers: `AC-19`, `AC-22`.

3. **Implement deterministic Plan projection**
   Add focused renderer/reconciler module. Validate safe path, render Proposed/Approved
   status separately from logical digest, fingerprint projection, detect manual drift,
   and require explicit integrate/regenerate reconciliation.
   Covers: `AC-21`, `AC-23`.

4. **Test compact and detailed contracts**
   New `test/shape-planning.test.mjs` and `test/shape-projection.test.mjs`: one-item Quick,
   complete Plan, missing coverage, stale evidence, forbidden guide, safe path, stable
   rendering, manual edit, reconciliation, digest/Approval invalidation.
   Covers: `AC-18` through `AC-23`, `AC-28`.

Verification:

```bash
node --test test/shape-planning.test.mjs test/shape-projection.test.mjs
```

### Lot 6 — Canonical state machine and resume

1. **Replace mode-bound registry**
   Files: `src/state-machine.ts`, `src/state.ts`, schema projection.
   Add `intaking`, `awaiting_profile_choice`, `awaiting_intake_decision`, and generic
   GATE entry; remove mode arrays/conditional mode guards and legacy shortcuts.
   Covers: `AC-02`, `AC-04`, `AC-12`, `AC-14`, `AC-27`.

2. **Bind guards/events to ShapeState**
   Trusted receipts must match current revision/fingerprint and referenced node IDs.
   Profile choice and contract projection events use bounded structured refs.
   Covers: `AC-07`, `AC-11`, `AC-16`, `AC-22`.

3. **Implement selective resume reconciliation**
   Validate Intake, policy, workspace, source, graph, choice, contract, and projection
   inputs; resume first unproved targeted action. Never reconstruct or reset ShapeState.
   Covers: `AC-10`, `AC-12`, `AC-17`, `AC-23`, `AC-25`.

4. **Rewrite lifecycle/state/schema fixtures**
   Prove Quick and Plan cross all phases and critical-risk controls are profile-neutral.
   Remove V1/V2 migration and mode-path assertions.
   Covers: `AC-03`, `AC-04`, `AC-27`, `AC-28`.

Verification:

```bash
node --test test/state.test.mjs test/schema.test.mjs test/lifecycle-paths.test.mjs test/resume-context.test.mjs
```

### Lot 7 — Skill orchestration and artifact ownership

1. **Rewrite `discover-change` contract**
   Consume Intake/risk/routing/workspace/ShapeState targets; batch related targets;
   return only structured evidence, fingerprints, dependencies, escalation, widening,
   sufficiency, and usage counters. Remain read-only.
   Covers: `AC-05` through `AC-13`, `AC-24`.

2. **Rewrite `plan-change` contract**
   Consume selected profile plus fresh structured evidence only; forbid repository reads;
   return canonical contract or a material Discovery Target. Remain read-only.
   Covers: `AC-18` through `AC-22`.

3. **Rewrite parent `dev-flow` orchestration**
   Define nominal `Discovery ×1 -> choice -> Planning ×1 -> GATE`, parent-owned state and
   projection writes, exact retry/budget behavior, and no transcript/prose duplication.
   Export new runtime primitives through CLI bundle.
   Covers: `AC-04`, `AC-10` through `AC-25`.

4. **Adapt downstream skills mechanically**
   Replace confirmed mode references with risk, selected profile, current canonical
   contract, and matching Gate evidence. Do not redesign later-phase algorithms.
   Covers: `AC-02`, `AC-27`.

Verification:

```bash
node --test test/bridge.test.mjs test/workflow-artifacts.test.mjs test/distribution.test.mjs
```

### Lot 8 — Normative docs, measurement, and full verification

1. **Project accepted decisions into normative docs**
   Update lifecycle contract, design, artifact contract, README files, metrics protocol,
   config examples, and glossary references. Remove public legacy mode paths and link
   ADR 0009/0010.
   Covers: `AC-01`, `AC-02`, `AC-27`, `AC-28`.

2. **Update metrics and local benchmark**
   Add profile-choice/recommendation, Discovery target/reuse/invalidation, Shape calls,
   budgets, and projection reconciliation counters without payloads. Replace mode-grouped
   fixtures with unselected/Quick/Plan semantics.
   Covers: `AC-24`, `AC-25`, `AC-26`.

3. **Regenerate structural baseline**
   Generate new V3 lifecycle fixture baseline only after canonical tests pass. Label
   unavailable token/latency data truthfully. Do not claim performance improvement
   without runtime samples.
   Covers: `AC-26`, `AC-27`, `AC-28`.

4. **Run full package verification**
   Covers: all acceptance criteria.

Verification:

```bash
bun run check
git diff --check
```

## Dependency order

```text
Lot 1
  ├── Lot 2
  │     └── Lot 3
  │           └── Lot 4
  │                 └── Lot 5
  └────────────────────────┐
                           v
                         Lot 6
                           |
                         Lot 7
                           |
                         Lot 8
```

Do not start Planning/projection work before graph and freshness primitives are stable.
Do not regenerate baselines before the registry, schema, and lifecycle fixtures agree.

## Risks and controls

- **Cross-phase blast radius:** removing mode touches most runtime fixtures. Control:
  land by complete lots with explicit focused verification, then run full check.
- **Hidden duplicate ownership:** storing dependencies on entities and in a graph could
  diverge. Control: one canonical graph; entities reference node IDs only.
- **Token regression:** over-fragmented targets can cause many calls. Control: batch
  related targets, measure calls, and require material widening reasons.
- **False selective reuse:** stale evidence could survive. Control: source-granular
  fingerprints, live-node reconciliation, adversarial dependency tests.
- **Projection drift:** Markdown can diverge from state. Control: separate fingerprint,
  explicit reconciliation, digest invalidation.
- **Downstream premature redesign:** Shape work could silently decide GATE/ASSURE policy.
  Control: change only required input seams; defer phase-specific UX/algorithms.
- **Hard-break confusion:** old task state will not resume. Control: typed explicit
  schema error and release note; no guessed conversion.

## Rollback

Before release, rollback is a normal Git revert of the complete V3 change. Do not publish
a mixed V2/V3 package. After a V3 release creates task state, rollback to V2 cannot
resume V3 tasks and must be treated as another explicit incompatible schema change.

No runtime rollback path converts V3 ShapeState to legacy modes.

## Completion evidence

Implementation is complete only when:

- every `SHAPE-AC-*` criterion maps to passing deterministic tests;
- focused lot commands and `bun run check` pass;
- schema, registry, lifecycle Markdown projection, skills, and public docs agree;
- no runtime/public type accepts legacy task modes or V1/V2 state;
- nominal metrics prove one Discovery and one Planning session structurally, while
  measured token/latency claims remain unavailable until real telemetry exists.

