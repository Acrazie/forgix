# Unified design interview and domain modeling

## Status

Proposed implementation plan for the accepted target in
[ADR 0030](../../plugins/codex-dev-flow/docs/adr/0030-unify-product-domain-and-technical-design-interviews.md).
Public behavior remains unchanged until all increments land together.

## Objective

Complete unreleased TaskState V5 with one dependency-directed interview across INTAKE
product/domain design and SHAPE technical design. Persist normalized domain knowledge,
approve durable deltas through the existing GATE digest, and project them safely during
native BUILD without copying the source brainstorming skills or introducing a parallel
workflow.

## Authorities

- [ADR 0030](../../plugins/codex-dev-flow/docs/adr/0030-unify-product-domain-and-technical-design-interviews.md)
- [Target INTAKE and SHAPE contract](../../plugins/codex-dev-flow/docs/target-intake-shape-contract.md)
- [Lifecycle contract](../../plugins/codex-dev-flow/docs/lifecycle-contract.md)
- [Project Engineering Profile contract](../../plugins/codex-dev-flow/docs/project-profile-contract.md)
- [ADR 0029](../../plugins/codex-dev-flow/docs/adr/0029-make-build-a-native-execution-boundary.md)

## Current repository evidence

- `src/types.ts` and `src/intake.ts` still persist `IntakeBrief`, `DecisionQuestion`, and
  `IntakeState`; deterministic completeness does not represent five typed Product
  Baseline dimensions.
- `src/shape.ts` owns `DecisionEscalation`, Discovery targets/evidence, Quick/Plan, and
  Planning. It has no ordinary user-owned Technical Decision interview.
- `src/shape-dependencies.ts` already validates an acyclic graph and deterministic
  dependency closure, but graph lives inside `ShapeState` and lacks product/domain node
  kinds and ownership-edge validation.
- `src/state-machine.ts` has `awaiting_intake_decision` but no
  `awaiting_shape_decision`; one task-wide question invariant is absent.
- `schemas/state.schema.json` and `src/state-validator.ts` already identify TaskState V5
  after ADR 0029. V5 is unreleased after tag `v0.3.0` and may be replaced atomically.
- `src/project-profile.ts` and `schemas/project-profile.schema.json` support approved
  project decisions/topology but no `domain_documentation` facet.
- routing currently has `discover|plan|debug|review|verify`; no persisted `design` route.
- skills contain `dev-flow`, `discover-change`, and `plan-change`; no lifecycle-bound
  semantic design-decision protocol exists.
- schema, lifecycle, state, Intake, SHAPE, profile, routing, distribution, documentation,
  and runtime-smoke tests already provide the main verification seams.

## Scope

### Included

- replace current V5 Intake and SHAPE decision structures without migration;
- task-level typed design graph and one active question;
- Product Baseline, glossary deltas, business rules/scenarios, durable decision
  candidates, and Technical Decisions;
- deterministic frontier validation/ranking tie-break, atomic answer application,
  selective invalidation, completion, and exact resume;
- adaptive domain-documentation facet in Project INIT/profile;
- domain-delta coverage in canonical contract, GATE digest, native BUILD work, and
  ASSURE verification;
- route `design`, bounded metrics, skill updates, contractual fixtures, model eval
  corpus/check, schemas, docs, distribution, and full tests;
- deletion of obsolete `IntakeBrief`, `DecisionQuestion`, `DecisionEscalation`, and
  ADR 0026 target branches rather than compatibility aliases.

### Excluded

- an autonomous brainstorming/domain-modeling command outside `$dev-flow`;
- transcript or hidden-reasoning persistence;
- product-source writes before GATE;
- whole-file domain-document regeneration;
- mandatory `$dev-flow init` when portable defaults are unambiguous;
- automatic conversion of every scenario to executable test;
- V4 or earlier partial-V5 migration/compatibility;
- changes to native BUILD orchestration or external Git/GitHub/release ownership.

## Acceptance criteria

- **DESIGN-V5-AC-01:** Explicit request content resolves any of five Product Baseline
  dimensions without redundant questions; every unresolved dimension is typed and
  cannot be bypassed.
- **DESIGN-V5-AC-02:** Exactly one task-wide `ActiveDesignQuestion` is valid, its owner
  matches status, and resume re-renders it without model work while dependencies remain
  fresh.
- **DESIGN-V5-AC-03:** Frontier contains only unblocked required nodes; model scoring is
  bounded and runtime applies deterministic eligibility and stable tie-break rules.
- **DESIGN-V5-AC-04:** Material terminology and Domain Rules are task-bounded,
  provenance-linked, stress-tested, and never polluted by implementation detail.
- **DESIGN-V5-AC-05:** Material Technical Decisions are discovered before questioning,
  explicitly selected by user, and distinguished from product/domain contradictions.
- **DESIGN-V5-AC-06:** One answer transaction resolves all and only explicit nodes or
  persists none; material normalization requires targeted confirmation.
- **DESIGN-V5-AC-07:** Revisions and stale evidence invalidate only transitive dependent
  closure across product, domain, evidence, technical choice, contract, and projection.
- **DESIGN-V5-AC-08:** No Product/domain or SHAPE completion receipt can exist with an
  open required branch, active contradiction/question, stale evidence/profile, invalid
  graph, or missing durable disposition.
- **DESIGN-V5-AC-09:** Every material Domain Rule maps to criterion/disposition, every
  durable delta maps to `project|already_documented|task_local|policy_forbidden`, and
  projected content participates in complete contract digest.
- **DESIGN-V5-AC-10:** Domain documents are unchanged before GATE; native BUILD applies
  only approved semantic patches; ASSURE verifies path, fingerprint, IDs/links, content
  preservation, and semantic fidelity.
- **DESIGN-V5-AC-11:** Destination resolution follows policy, profile, detected
  convention, then portable default; missing safe setup emits one non-blocking
  `$dev-flow init` recommendation.
- **DESIGN-V5-AC-12:** Project profile can own approved `domain_documentation`
  conventions with portable paths, provenance/fingerprints, exact digest, and drift
  reconciliation.
- **DESIGN-V5-AC-13:** `design` routing is selected once per immutable snapshot, reused
  by fused design evaluations, scales effort by risk/ambiguity/graph depth, and emits no
  decision content in metrics.
- **DESIGN-V5-AC-14:** Persisted state contains normalized bounded/redacted records and
  exact active question, never transcript, raw prompt/answer, hidden reasoning, secret,
  PII, large code/diff, or external payload.
- **DESIGN-V5-AC-15:** No hard question cap, periodic permission checkpoint, automatic
  “choose for me”, fake progress percentage, or duplicate SHAPE approval exists.
- **DESIGN-V5-AC-16:** TaskState/schema/skills/contracts/package expose one coherent V5;
  old local state fails clearly and no compatibility implementation remains.
- **DESIGN-V5-AC-17:** Deterministic tests, contractual fixtures, model-eval threshold,
  full `bun run check`, runtime smoke, and packed distribution all pass before release.

## Implementation plan

### 1. Replace V5 core design state and graph ownership

Files:

- add `plugins/codex-dev-flow/src/design.ts`;
- update `src/types.ts`, `src/shape-dependencies.ts`, `src/state.ts`,
  `src/state-validator.ts`, `src/cli.ts`, and `schemas/state.schema.json`;
- update `test/support/helpers-v5.ts`, `test/unit/shape-dependencies.test.ts`,
  `test/unit/state.test.ts`, `test/integration/schema.test.ts`, and
  `test/integration/state-store.test.ts`.

Work:

- define `DesignState`, typed graph node kinds/owners, `ActiveDesignQuestion`, domain
  record lifecycle/dispositions, bounded provenance, and atomic invalidation records;
- move canonical graph from `ShapeState` to `TaskState.design`; keep payloads in owner
  registries and replace Shape graph references with task-level references;
- validate allowed owner/status/question combinations, graph edges, uniqueness, bounds,
  redaction, lifecycle transitions, and absence of partial records;
- reject prior schema shapes explicitly; provide no migration or alias.

Verification:

- unit cases for cycles, unknown refs, forbidden authority edges, duplicate IDs, one
  active question, closure ordering, and selective invalidation;
- schema/source validator parity and round-trip state-store tests;
- proves AC-02, AC-07, AC-14, AC-16.

### 2. Replace Intake Brief with Product Baseline and domain registries

Files:

- rewrite `src/intake.ts` and Intake-owned types in `src/types.ts`;
- extend `src/design.ts` with glossary/rule/scenario/candidate validators and answer
  transaction primitives;
- update `test/unit/intake.test.ts` and add `test/unit/design-domain.test.ts`.

Work:

- implement five typed baseline dimensions with value or justified `not_applicable`,
  status, provenance, and dependency nodes;
- accept zero-question explicit paths, targeted documentary sources, open elicitation,
  choice questions, material normalization confirmation, contradictions, revisions, and
  task-bounded domain triggers;
- validate `DomainGlossaryDelta`, `DomainRule`, child `DomainScenario`,
  `DecisionCandidate`, ADR four-gate qualification, and lifecycle/disposition rules;
- apply multi-node answer resolution atomically and preserve prior state on invalid
  semantic output or partial normalization.

Verification:

- explicit/missing/not-applicable five-dimension fixtures;
- ambiguous terminology prerequisite, domain-rule nominal/boundary/contradiction,
  multi-context, material normalization, delegation refusal, scope reduction, and
  no-transcript/redaction cases;
- proves AC-01, AC-04, AC-06, AC-08, AC-14, AC-15.

### 3. Add deterministic frontier and lifecycle-bound semantic protocol

Files:

- extend `src/design.ts` or add focused `src/design-frontier.ts` if size requires;
- add `plugins/codex-dev-flow/skills/design-decisions/SKILL.md`;
- update `skills/dev-flow/SKILL.md`;
- add `test/unit/design-frontier.test.ts` and contractual fixtures below
  `test/fixtures/design-decisions/`.

Work:

- compute unblocked required frontier from graph and current evidence;
- validate model scores for authority, blocking impact, fan-out, irreversibility, risk,
  and uncertainty; rank with stable deterministic tie-break;
- persist exact selected question and bounded priority explanation before rendering;
- specify fused evaluation payload/output contracts so `design-decisions` adds no
  routine second call and cannot run without Dev Flow capsule/parent persistence;
- implement one targeted semantic retry with atomic typed block after second failure.

Verification:

- same input produces same eligible order/tie-break; blocked descendants never surface;
- fresh resume reuses exact question; changed prerequisite recomputes only affected
  closure; semantic output failure never partially mutates state;
- proves AC-02, AC-03, AC-06, AC-08, AC-15.

### 4. Replace SHAPE escalation with Technical Decision interview

Files:

- rewrite decision portions of `src/shape.ts`;
- update `src/shape-freshness.ts`, `src/state-machine.ts`, `src/state.ts`,
  `schemas/state.schema.json`, and `src/cli.ts`;
- update `skills/discover-change/SKILL.md` and `skills/plan-change/SKILL.md`;
- update `test/unit/shape.test.ts`, `test/unit/shape-freshness.test.ts`,
  `test/unit/state.test.ts`, `test/integration/lifecycle-paths.test.ts`, and resume tests.

Work:

- delete `DecisionEscalation`; add full `TechnicalDecision` registry and
  `awaiting_shape_decision` state with exact `discovering|planning` prior role;
- make Discovery return evidence, candidate technical decisions, frontier analysis, and
  optional question in one semantic evaluation;
- route compatible alternative changes within SHAPE and product/domain infeasibility to
  linked `awaiting_intake_decision` without payload duplication;
- make Planning emit one Discovery Target or Technical Decision when structured input
  is materially insufficient.

Verification:

- architecture/data/security/profile-exception materiality fixtures plus reversible
  convention-owned detail;
- exact status/owner/prior-role transitions, contradiction routing, stale evidence, and
  selective resume cases;
- proves AC-02, AC-05, AC-07, AC-08, AC-15.

### 5. Extend Planning, contract digest, and GATE preflight

Files:

- update canonical contract logic in `src/shape.ts`, `src/shape-projection.ts`,
  `src/gate.ts`, `src/state.ts`, and `schemas/state.schema.json`;
- update `test/unit/shape-planning.test.ts`, `test/unit/shape-projection.test.ts`, and
  `test/unit/gate.test.ts`.

Work:

- add domain-record refs/dispositions, rule-to-criterion coverage, scenario validation
  candidates, and targeted documentation work to canonical contract/digest;
- recommend Quick/Plan from graph complexity without forcing Plan for every domain delta;
- block `contract_complete` and GATE when required design branches, disposition proof,
  evidence freshness, profile binding, or projection coverage is missing;
- bind approval to exact domain-aware digest without adding second SHAPE confirmation.

Verification:

- digest changes on semantic delta/disposition/projection changes and remains stable on
  rendering-only changes;
- Quick local delta and Plan multi-context/ADR fixtures; uncovered rule and lost delta
  negative cases; pure GATE still performs no model/network/subprocess work;
- proves AC-08, AC-09, AC-15.

### 6. Add domain-document resolver, semantic patches, and verification evidence

Files:

- add `src/domain-projection.ts`;
- connect deterministic projection planning to `src/shape.ts`, `src/gate.ts`, and ASSURE
  verification types/functions in `src/state.ts`;
- export public primitives from `src/cli.ts`;
- add `test/unit/domain-projection.test.ts` and integration fixtures for existing
  glossary/rules/ADR conventions.

Work:

- resolve destination by policy/config, approved profile, detected conventions, then
  portable defaults; emit one setup recommendation when using safe fallback;
- represent targeted semantic operations (`add|modify|deprecate|conflict`) with source
  fingerprint and owned entry/section identity;
- forbid product writes before approval and whole-file replacement; make ambiguous
  human-content merges return to owning question;
- produce ASSURE evidence for path policy, changed fingerprint, identities/links,
  unrelated-content preservation, and content-type semantic rules.

Verification:

- mono/multi-context defaults, existing `CONTEXT.md`, custom glossary/ADR path,
  conflicting destinations, manual drift, unrelated-content preservation, and
  pre-GATE-write rejection cases;
- proves AC-09, AC-10, AC-11.

### 7. Extend Project INIT and Engineering Profile conventions

Files:

- update `src/project-profile.ts`, `schemas/project-profile.schema.json`,
  `schemas/project-profile-local.schema.json` only if local non-contractual preferences
  need a bounded display preference, and `src/cli.ts` profile commands;
- update `docs/project-profile-contract.md`;
- update `test/support/project-profile.ts`, `test/unit/project-profile.test.ts`,
  `test/integration/project-profile-cli.test.ts`, and
  `test/integration/project-profile-store.test.ts`.

Work:

- add optional approved `domain_documentation` facet for context mode/IDs, paths/formats,
  language, identity/link conventions, provenance, and fingerprints;
- discover facet adaptively from repository conventions; never ask when evidence already
  decides or when facet is irrelevant;
- include facet in content digest, diff, reconciliation, selective stale-decision
  closure, validation, rendering, and atomic publication;
- keep absolute paths out of shared profile and keep standalone configuration wizard
  separate.

Verification:

- absent facet backward shape within unreleased V5, mono/multi-context facet,
  path-language validation, digest binding, drift invalidation, atomic publication, and
  privacy tests;
- proves AC-11, AC-12, AC-14.

### 8. Add design routing and privacy-safe metrics

Files:

- update `src/types.ts`, `src/routing.ts`, `src/bridge.ts`, `src/metrics.ts`, config/policy
  schema only where a route allowlist is represented, and `skills/dev-flow/SKILL.md`;
- update `test/unit/routing.test.ts`, `test/integration/cli-routing.test.ts`,
  `test/unit/metrics.test.ts`, and app-server routing fixtures.

Work:

- add `design` to routing stages/matrix and bump routing policy version;
- resolve once from immutable snapshot; reuse for fused INTAKE/domain and SHAPE choice
  evaluations; scale effort through bounded risk/ambiguity/graph-depth signal;
- add only numeric/enum design counters needed to benchmark questions, invalidations,
  frontier recomputes, and domain dispositions;
- reject question/term/rule/decision/path content from telemetry.

Verification:

- plan/quota/risk/ambiguity/depth route matrix, missing-model block, snapshot reuse, and
  metrics allowlist/privacy negative tests;
- proves AC-13, AC-14.

### 9. Add model eval contract and release threshold

Files:

- add `plugins/codex-dev-flow/evals/design-decisions/cases.json`, `rubric.md`, and
  `baseline.json`;
- add `scripts/check-design-evals.ts` and package scripts;
- add deterministic schema tests for eval corpus and result receipt.

Work:

- version cases covering materiality, ambiguity, contradiction, multi-context language,
  edge scenarios, technical alternatives, recommendation quality, non-invention,
  frontier choice, and irrelevant mechanical changes;
- define scored dimensions and minimum aggregate plus critical-case floors;
- let controlled live eval produce bounded result receipt keyed by skill/corpus/model
  digests; commit baseline summary without prompts, transcripts, or user data;
- make release check reject missing, stale, or below-threshold receipt while ordinary
  offline unit tests validate corpus/receipt structure deterministically.

Verification:

- corpus schema, digest staleness, threshold failure, critical-case failure, and passing
  baseline tests;
- proves semantic portion of AC-03–AC-05 and AC-17.

### 10. Align normative/public surfaces and activate atomically

Files:

- update `docs/lifecycle-contract.md`, `docs/glossary/dev-flow.md`,
  `docs/metrics-protocol.md`, `docs/design.md`, README/getting-started/artifact docs where
  behavior becomes public;
- finalize ADR 0030/target status from pending to implemented only after code passes;
- update all plugin skills, generated lifecycle projection, artifact budget, built
  `dist/dev-flow.mjs`, package artifact, documentation/distribution/runtime tests;
- remove obsolete target wording and runtime symbols through negative assertions.

Work:

- keep current runtime claims until final activation commit; then switch all normative
  and public projections together;
- remove obsolete `IntakeBrief`, generic Intake `DecisionQuestion`,
  `DecisionEscalation`, SHAPE-owned graph, ADR 0026 pending target claims, and old routing
  policy artifacts;
- regenerate bundle/package and confirm published package contains new skill, schemas,
  contracts, profile facet, and eval contract where intended.

Verification:

- `bun run typecheck`;
- focused unit/integration suites during each increment;
- `bun run build`;
- `bun run test:randomization`;
- `bun run test:coverage` and update ratchet only from measured legitimate new baseline;
- `bun run check:size`;
- `bun run test:runtime`;
- `bun run release:test`;
- `bun run pack:runtime` plus archive content inspection;
- `git diff --check` and negative symbol/doc search;
- proves AC-16 and AC-17, then all criteria through complete trace.

## Delivery constraints

1. Internal commits may follow steps above, each green and reviewable.
2. Do not publish, tag, or describe new behavior as current until all steps pass.
3. Do not carry compatibility branches for old local state; fail clearly instead.
4. Any material contract change returns to ADR/target review before implementation
   continues.
5. Commit/push/PR/release remain separate explicit actions after implementation and
   verification.

## Main risks and controls

- **State explosion:** typed registries, bounded strings/lists, payload ownership, and
  task-bounded materiality prevent transcript-shaped state.
- **Model overreach:** open elicitation for unknown business meaning, material
  normalization confirmation, explicit user selection, and non-invention eval floors.
- **Graph corruption:** one task-level graph, strict owner-edge validation, deterministic
  closure, and atomic transactions.
- **Question fatigue:** one highest-value frontier node, no periodic gate, zero-question
  paths, and domain activation only on material triggers.
- **Premature/destructive docs:** GATE-bound dispositions, targeted semantic patches,
  source fingerprints, and ASSURE preservation checks.
- **Profile scope creep:** adaptive optional facet, discovery-first setup, portable
  logical paths, and separate profile approval.
- **Cross-surface drift:** one final atomic activation verified through schemas, skills,
  docs, bundle, package, runtime smoke, and negative obsolete-symbol assertions.
