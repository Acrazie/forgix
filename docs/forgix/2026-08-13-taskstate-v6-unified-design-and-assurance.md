# TaskState V6: unified design and ASSURE

## Status

Implemented and verified for
[ADR 0030](../../plugins/codex-dev-flow/docs/adr/0030-unify-product-domain-and-technical-design-interviews.md)
and
[ADR 0031](../../plugins/codex-dev-flow/docs/adr/0031-make-assure-the-success-boundary.md).
V6 source, schema, documentation, bundle, and archive activate together.

## Objective

Ship one TaskState V6 transition that:

- unifies product, domain, and material technical design through one dependency-directed
  interview;
- compiles the approved Change Contract into deterministic implementation and assurance
  obligations;
- ends the five-phase lifecycle in ASSURE without persisted `finished`; and
- removes routine final model verification while reducing review input tokens without
  permitting false success.

Canonical lifecycle:

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE
```

## Authorities

- [ADR 0030](../../plugins/codex-dev-flow/docs/adr/0030-unify-product-domain-and-technical-design-interviews.md)
- [ADR 0031](../../plugins/codex-dev-flow/docs/adr/0031-make-assure-the-success-boundary.md)
- [ADR 0029](../../plugins/codex-dev-flow/docs/adr/0029-make-build-a-native-execution-boundary.md)
- [Target INTAKE and SHAPE contract](../../plugins/codex-dev-flow/docs/target-intake-shape-contract.md)
- [Lifecycle contract](../../plugins/codex-dev-flow/docs/lifecycle-contract.md)
- [Project Engineering Profile contract](../../plugins/codex-dev-flow/docs/project-profile-contract.md)

## Fresh repository evidence

- Package `0.3.1` publishes TaskState V5. V6 therefore requires an explicit incompatible
  schema diagnostic; the earlier assumption that V5 was unreleased is obsolete.
- Current INTAKE persists `IntakeBrief` and `DecisionQuestion`; SHAPE owns
  `DecisionEscalation` and its dependency graph. There is no transversal design state,
  Product Baseline, domain registry, or ordinary Technical Decision interview.
- Current lifecycle ends `reviewing -> resolving_assure -> verifying -> finished` and
  uses `review_satisfied`, `correction_budget_available`, and
  `verification_complete` guards.
- Current state duplicates `verificationRequirements`, detailed
  `VerificationReceipt` lists, `reviewCycle`, and transition-derived ASSURE metrics.
- Routing exposes `discover|plan|debug|review|verify`. `design` is absent and
  `verify-change` still performs a routed final model pass.
- Existing schema parity, state-store, lifecycle, routing, metrics, benchmark,
  documentation, distribution, randomization, coverage, and runtime-smoke tests are the
  principal activation seams.

## Scope

### Included

- all ADR 0030 Product Baseline, domain-modeling, Technical Decision, dependency,
  document-projection, Project Profile, routing, privacy, and eval behavior;
- V6 state/status/event/guard/schema changes from ADR 0031;
- canonical `assuranceContract`, evidence index, operation DAG, freshness/invalidation,
  conditional review, human observation, and `AssuranceReceipt`;
- success-derived metrics/benchmark behavior and token/error benchmark contract;
- removal of obsolete V5 structures, `verify` routing, and `verify-change`;
- atomic normative docs, generated projection, bundle, archive, and package activation.

### Excluded

- migration or permanent compatibility for V5 and older task state;
- autonomous brainstorming/domain-modeling outside `$dev-flow`;
- product-source writes before GATE or whole-file domain-document regeneration;
- BUILD orchestration, task checkpoints, or a BUILD-specific execution skill;
- routine model verification or unconditional model review;
- external commit, push, PR, registry, publication, or release work;
- live model calls inside ordinary CI.

## Acceptance criteria

- **V6-AC-01 — Product completeness:** Explicit request content may resolve any of five
  Product Baseline dimensions without redundant questions. Missing/unknown dimensions
  cannot be treated as complete.
- **V6-AC-02 — One design frontier:** Exactly one task-wide active product, terminology,
  domain-rule, or technical question is valid. Eligibility and tie-breaking are
  deterministic; fresh resume re-renders the exact question without another model call.
- **V6-AC-03 — Domain and decision authority:** Material glossary deltas, rules,
  scenarios, Decision Candidates, and Technical Decisions remain task-bounded,
  provenance-linked, stress-tested where required, and explicitly user-owned when they
  change product or material technical behavior.
- **V6-AC-04 — Selective invalidation:** Typed acyclic dependencies invalidate only the
  transitive affected closure across design, evidence, contract, projection, and
  assurance. Multi-node answers and completion writes are atomic.
- **V6-AC-05 — Approved contract:** Every material rule has criterion/disposition
  coverage. The canonical Change Contract solely owns domain work and a digest-bound
  `assuranceContract`; GATE blocks incomplete or stale coverage.
- **V6-AC-06 — Five-phase state:** Runtime contains one ASSURE status, `assuring`, and no
  `reviewing`, `resolving_assure`, `verifying`, or `finished`. `blocked` resumes exactly;
  `cancelled` and demonstrated irreparable `failed` remain truthful terminals.
- **V6-AC-07 — Derived success:** Exact current coverage atomically freezes the canonical
  completion index, creates minimal `AssuranceReceipt`, and appends
  `assure.completed`. Valid paired proof makes `assuring` immutable and derives public
  `ASSURE ✓` / outcome `success`.
- **V6-AC-08 — Compiled assurance:** Before GATE, SHAPE compiles stable `subjects`,
  `operations`, `covers`, and `dependsOn` plus activation/success predicates, budgets,
  check identities, scopes, and policy snapshots. ASSURE runs no coverage solver and
  invents no late requirement.
- **V6-AC-09 — Fresh evidence reuse:** Current BUILD/ASSURE evidence is reused by exact
  normalized identity and global or predeclared scoped fingerprint. Relevant writes
  invalidate only overlapping evidence; costly operations checkpoint atomically.
- **V6-AC-10 — Efficient deterministic work:** Required checks are deduplicated, ordered
  by cost/signal dependencies, concurrent only when declared safe, and evaluated by
  preapproved deterministic predicates. Passing output stays structured; failures expose
  only the shortest decisive excerpt plus log reference.
- **V6-AC-11 — Bounded independent review:** Policy-triggered concerns produce one
  consolidated read-only review with structured verdict/findings. It uses the least-cost
  qualified model, bounded sliced capsule, and at most one qualifying escalation.
  Non-required style/preferences do not block or trigger automatic edits.
- **V6-AC-12 — Correction and human evidence:** Stable repeated issues invoke
  `debug-root-cause` after two failed corrections without a global cycle cap. Required
  non-automatable observations are batched; absence/refusal/external dependency blocks,
  and negative human evidence cannot be overridden by green automated checks.
- **V6-AC-13 — Safe domain projection:** GATE-approved semantic patches preserve
  unrelated content and follow policy, approved profile, detected convention, then
  portable defaults. ASSURE covers paths, fingerprints, identities/links, and semantic
  fidelity.
- **V6-AC-14 — Routing, privacy, and metrics:** Routing adds reusable `design`, retains
  conditional `review`, and removes `verify`. Persisted state/metrics contain bounded
  structured records and counters—never transcript, hidden reasoning, raw prompts,
  secrets, large diffs, or command logs. Benchmark outcome uses `success|failed`.
- **V6-AC-15 — Measured efficiency:** No-review ASSURE scenarios use zero model tokens.
  Every review scenario reduces model input tokens by at least 40% from captured V5
  baseline, uses one normal call, and allows at most one qualifying escalation. Current
  checks never rerun.
- **V6-AC-16 — No false success:** Fault fixtures for stale/missing evidence, failed
  checks, false predicates, material drift, malformed reviewer output, negative human
  evidence, and interrupted completion produce no success.
- **V6-AC-17 — Atomic V6 activation:** V5 state fails with typed incompatibility. Source,
  schemas, skills, normative/public docs, lifecycle projection, metrics, bundle, packed
  archive, and runtime expose only coherent V6 behavior; complete quality gates pass.

## Implementation Guide

### Ownership

- `TaskState.design` owns graph identities, one active question, invalidations, and
  task-local Product/domain/decision registries by their lifecycle authority.
- Canonical Change Contract is sole owner of approved plan, domain projection work, and
  `assuranceContract`. Markdown and other repository artifacts are projections.
- TaskState ASSURE data owns only compact evidence index, active issues/pending human
  request, and minimal receipt. Detailed output remains in referenced logs/artifacts.

### Terminal rule

Keep terminal logic closed:

```text
cancelled
failed
assuring + valid(AssuranceReceipt, assure.completed)
```

Do not add generic configurable terminal predicates or a hidden success status.

### Compatibility and activation

V5 is published. `loadStateV6` must reject other versions with existing typed
`state_schema_incompatible` behavior. Internal lots may land green, but current public
claims remain unchanged until final source/schema/docs/bundle activation is coherent.

## Ordered implementation lots

### 1. Establish V6 state and design foundations

Primary surfaces:

- add `src/design.ts` and extend `src/shape-dependencies.ts`;
- update `src/types.ts`, `src/state.ts`, `src/state-validator.ts`,
  `src/state-machine.ts`, `schemas/state.schema.json`, state helpers/store, and CLI
  exports.

Work:

- advance schema/load/assert helpers to V6 with no migration;
- introduce transversal design registries, typed owner/node edges, one active question,
  atomic invalidation records, and bounds/redaction validation;
- add `awaiting_shape_decision` and single incomplete `assuring`; remove old ASSURE and
  success statuses/guards while keeping final receipt creation for later lot;
- make terminal calculation a state-aware closed function rather than static success
  status metadata.

Validation:

- schema/source parity and V5 incompatibility;
- cycles, illegal ownership edges, duplicate/unknown IDs, active-question/status
  mismatch, selective closure, state-store round trip, lifecycle projection fixtures.

Coverage: V6-AC-02, V6-AC-04, V6-AC-06, V6-AC-17.

### 2. Replace INTAKE brief with Product Baseline and domain registries

Primary surfaces:

- rewrite `src/intake.ts` and Intake-owned types;
- extend `src/design.ts`; add focused domain fixtures/tests.

Work:

- implement five Product Baseline dimensions with value or justified N/A, provenance,
  state, and dependencies;
- add glossary delta, domain rule/scenario, Decision Candidate, contradiction,
  lifecycle/disposition, and atomic answer normalization contracts;
- preserve zero-question explicit paths and forbid transcript/raw-model persistence.

Validation:

- explicit/missing/N/A dimensions; terminology ambiguity; nominal/boundary/exception/
  contradiction rules; multi-context cases; normalization confirmation; scope reduction;
  refusal and privacy cases.

Coverage: V6-AC-01, V6-AC-03, V6-AC-04, V6-AC-14.

### 3. Add deterministic frontier, design protocol, and route

Primary surfaces:

- add `skills/design-decisions/SKILL.md` and optional focused
  `src/design-frontier.ts`;
- update `skills/dev-flow/SKILL.md`, `src/routing.ts`, `src/bridge.ts`, init/routing
  surfaces, and route tests.

Work:

- compute eligible unblocked frontier and validate bounded model scores before stable
  runtime tie-break;
- fuse frontier/question work into existing INTAKE or Discovery evaluation when inputs
  changed; reuse persisted question otherwise;
- add one immutable-snapshot `design` route and targeted semantic retry/block behavior.

Validation:

- deterministic order, authority filtering, exact resume, dependency invalidation,
  malformed semantic output, route matrix/snapshot reuse, missing-model block, bounded
  usage/privacy.

Coverage: V6-AC-02, V6-AC-03, V6-AC-14.

### 4. Replace Decision Escalation with Technical Decision interview

Primary surfaces:

- rewrite decision portions of `src/shape.ts` and `src/shape-freshness.ts`;
- update state transitions, Discovery/Planning skills, CLI rendering, and resume tests.

Work:

- delete `DecisionEscalation`; add evidence-first material Technical Decisions with
  viable/excluded options, explicit selection, consequences, and exact prior SHAPE role;
- route product infeasibility to linked INTAKE ownership without copying payload;
- let Planning request one missing Discovery Target or Technical Decision, never inspect
  repository facts itself.

Validation:

- architecture, dependency, data/migration, security/privacy, compatibility,
  concurrency/performance, and profile-exception fixtures; reversible implementation
  detail negative cases; targeted reopen/resume.

Coverage: V6-AC-02, V6-AC-03, V6-AC-04, V6-AC-06.

### 5. Add domain-document conventions and destination resolver

Primary surfaces:

- update `src/project-profile.ts` and project-profile schemas/contract;
- add `src/domain-projection.ts`; update profile CLI/store/test support.

Work:

- add optional approved `domain_documentation` facet with portable paths, context mode,
  language, identity/link conventions, provenance, digest, and drift reconciliation;
- resolve destinations by policy, profile, detected convention, then portable defaults;
- define targeted semantic operations with source fingerprint and owned identity;
  prohibit pre-GATE writes and whole-file replacement.

Validation:

- absent/mono/multi-context profiles, existing conventions, custom paths, language/link
  rules, digest/drift, ambiguous destination, atomic publication, unrelated-content
  preservation, and pre-GATE rejection.

Coverage: V6-AC-03, V6-AC-13, V6-AC-14.

### 6. Compile canonical Change Contract and assurance graph before GATE

Primary surfaces:

- update canonical contract/planning logic in `src/shape.ts`,
  `src/shape-projection.ts`, `src/gate.ts`, state types/schema, and planning tests.

Work:

- add domain refs/dispositions, semantic documentation patches, rule-to-criterion and
  scenario-to-validation mapping;
- replace `verificationRequirements` with canonical `assuranceContract` containing
  `subjects`, deduplicated `operations`, `covers`, `dependsOn`, activation/success
  predicates, scopes, identities, budgets, evidence preference, and policy snapshots;
- compile conditional review/human observation and mandatory global checks before GATE;
- block Planning/GATE for missing design disposition, assurance coverage, freshness, or
  invalid DAG/digest.

Validation:

- digest sensitivity/stability, exact subject coverage, operation deduplication,
  dependency ordering, conditional N/A constraints, invalid predicate/scope/budget,
  uncovered rule/risk/check, and pure no-model GATE tests.

Coverage: V6-AC-05, V6-AC-08, V6-AC-13.

### 7. Implement evidence index, check execution, and invalidation

Primary surfaces:

- add focused `src/assurance.ts` and, if needed, `src/assurance-executor.ts`;
- integrate command observation, fingerprints, history checkpointing, schema, and tests.

Work:

- normalize operation identity from executable, argv, logical cwd, allowlisted env, and
  tool/config fingerprints; exclude secrets, absolute paths, and volatile values;
- reuse exact BUILD evidence; apply global fingerprint unless SHAPE/policy declared a
  scoped dependency; invalidate overlapping records after writes;
- execute fresh/missing DAG operations cheap-first, skip dependants after failure, and
  run same-layer concurrency only when declared read-only/safe under policy cap;
- persist compact evidence records after costly operations; keep logs/prose external and
  pass only structured success or decisive failure excerpt to model context.

Validation:

- identity normalization/privacy, BUILD reuse, global/scoped invalidation, config/tool
  drift, checkpoints/resume, DAG skip/concurrency, success predicates/warnings/artifacts,
  unplanned command exact matching, and supplemental-evidence exclusion.

Coverage: V6-AC-08, V6-AC-09, V6-AC-10, V6-AC-15.

### 8. Reduce review to one conditional bounded operation

Primary surfaces:

- simplify `skills/review-change/SKILL.md` and review contracts;
- update routing policy/model matrix and remove `skills/verify-change/SKILL.md`, `verify`
  route, exports, tests, and artifact-budget entry.

Work:

- evaluate precompiled deterministic review activation after green prerequisites;
- build fresh capsule from triggered subjects, related hunks/symbols, direct
  dependencies, and summarized evidence;
- require structured verdict/findings with stable issue ID, severity, location,
  evidence, correction, and confidence; policy alone classifies blockers;
- route least-cost qualified reviewer and permit one escalation only for invalid schema
  or below-threshold confidence; enforce snapshotted call/input/output ceilings;
- remove review lanes, arbitrary three-cycle cap, and final model synthesizer.

Validation:

- no-trigger zero call, consolidated multi-risk call, blocker classification,
  non-blocking style, malformed/low-confidence escalation, budget/capsule slicing,
  specialist policy exception, and removed-route negative assertions.

Coverage: V6-AC-11, V6-AC-14, V6-AC-15.

### 9. Complete ASSURE, correction, human observation, and derived success

Primary surfaces:

- complete `src/assurance.ts`, `src/state.ts`, `src/state-machine.ts`, schema/store, CLI,
  issue/debug integration, lifecycle/resume tests.

Work:

- orchestrate reuse -> deterministic checks -> conditional review -> batched human
  observation -> exact coverage without adding phase statuses;
- track stable issues; after two failed corrections on same stable issue route
  `debug-root-cause`; use `blocked` only for pending human/external dependency and
  `failed` only for demonstrated irreparable outcome;
- reject criterion N/A inside ASSURE and send material applicability/scope/policy change
  through SHAPE/GATE;
- atomically validate canonical completion index, freeze it, create minimal
  `AssuranceReceipt`, and append `assure.completed`;
- render `ASSURE ✓`, concise bounded summary, and immutable historical success for the
  verified snapshot.

Validation:

- correction/invalidation/re-entry, repeated-root-cause, pending/negative human
  observation and exact resume, scope return, atomic interruption, receipt/event pairing,
  closed terminal logic, post-success immutability, and bounded final response fixtures.

Coverage: V6-AC-06, V6-AC-07, V6-AC-09, V6-AC-12, V6-AC-16.

### 10. Update metrics, benchmark, privacy, and eval contracts

Primary surfaces:

- update `src/metrics.ts`, `src/benchmark.ts`, metrics docs/tests;
- add/extend design and ASSURE contractual fixtures, controlled eval receipts, and
  benchmark baseline/check scripts.

Work:

- derive outcome `success|failed`; replace status-transition ASSURE counters with
  allowlisted operation/reuse/review/escalation/correction counters;
- reject evidence prose, decision content, paths, prompts, and logs from telemetry;
- retain ADR 0030 design materiality/question/non-invention eval thresholds;
- capture V5 scenario baseline, compare deterministic CI capsule/call fixtures, and link
  controlled actual model-token receipts by scenario identity;
- add complete false-success injection matrix.

Validation:

- metric allowlist/privacy negatives, benchmark eligibility/summary, stale eval/baseline
  receipts, per-scenario 40% review-input reduction, zero-call no-review path, one normal
  review/one max escalation, no fresh-check rerun, and every V6-AC-16 injected fault.

Coverage: V6-AC-02, V6-AC-03, V6-AC-14, V6-AC-15, V6-AC-16.

### 11. Activate normative/public/package surfaces atomically

Primary surfaces:

- lifecycle/design/artifact/metrics/profile docs, glossary, READMEs, skills, schemas,
  generated lifecycle projection, baseline generator, artifact budget, build bundle,
  archive, and release/runtime tests.

Work:

- switch all current lifecycle copy to `INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE` and
  `ASSURE ✓` / `success`; retain superseded ADRs only as historical context;
- remove obsolete V5 symbols/routes/statuses and update ADR 0030/0031 status to
  implemented only after full evidence passes;
- regenerate `dist/dev-flow.mjs` and packed artifact; verify intended skills/schemas/docs
  and absence of `verify-change` in package.

Validation:

- focused tests after each lot, then root `bun run check`;
- plugin typecheck/build, randomized tests, coverage, size gate, runtime smoke,
  release tests, pack/runtime archive inspection, `git diff --check`, and negative
  obsolete-symbol/current-doc search;
- acceptance-criterion-to-evidence trace for all V6-AC-01 through V6-AC-17.

Coverage: V6-AC-17 and final integration evidence for every criterion.

## Dependency order

```text
1 -> 2 -> 3 -> 4
1 ----------> 5
2 + 4 + 5 -> 6 -> 7
6 ---------> 8
7 + 8 -----> 9 -> 10 -> 11
3 ----------------> 10
5 ----------------------> 11
```

Lots 3 and 5 may proceed independently after lot 1. Lot 8 may begin after assurance
contract shape stabilizes in lot 6 while lot 7 implements deterministic evidence.

## Main risks and controls

- **Combined-state size:** one graph of identities, strict payload ownership, bounded
  registries, compact evidence, and schema limits prevent transcript-shaped state.
- **False success:** exact coverage, preapproved predicates, conservative fingerprints,
  atomic receipt/event, and fault injection guard completion.
- **Model overreach/cost:** deterministic work first, conditional independent review,
  bounded slicing, least-cost routing, one qualifying escalation, and no verify pass.
- **Graph or invalidation corruption:** typed owner edges, acyclicity, stable IDs,
  deterministic closure, atomic answer/completion transactions, and property fixtures.
- **Premature/destructive docs:** GATE-bound dispositions, targeted semantic patches,
  source fingerprints, unrelated-content preservation, and exact destination policy.
- **Human-observation deadlock:** one persisted batched request, exact blocked resume, and
  no model substitution.
- **Cross-surface drift:** one final activation across source, schema, docs, skills,
  metrics, projection, bundle, package, runtime, and negative obsolete-symbol checks.
- **Large delivery:** independently green lots, stable interfaces before dependants, and
  no public activation until complete full-gate evidence.

## Delivery constraints

1. Each lot must remain focused, reviewable, and green before dependent work starts.
2. Material design change returns to ADR review and invalidates affected plan sections.
3. No V5 compatibility branch, hidden success status, unconditional reviewer, or final
   model verifier may survive activation.
4. No publish/tag/release claim occurs until complete V6 evidence passes.
5. Commit, push, PR, publication, and release remain separate explicit actions.
