# Target INTAKE and SHAPE Contract

## Contract status

This document specifies implemented V6 behavior from
[ADR 0030](adr/0030-unify-product-domain-and-technical-design-interviews.md). It is
normative together with [lifecycle contract](lifecycle-contract.md).

V6 replaces published TaskState V5. V5 and earlier state is
not migrated and must fail with a clear diagnostic.

## Purpose and ownership

The target establishes one dependency-directed design interview across product, domain,
and technical uncertainty without erasing phase authority:

| Owner           | Owns                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| INTAKE          | Product Baseline, task-relevant terminology, business rules, scenarios, and business-context boundaries.             |
| SHAPE Discovery | Repository and service facts, evidence, source fingerprints, profile applicability, and candidate technical choices. |
| SHAPE Planning  | Canonical Change Contract derived only from structured current evidence and resolved decisions.                      |
| GATE            | One final approval of exact contract digest, including durable domain dispositions.                                  |
| BUILD           | Native implementation plus approved targeted documentation projections.                                              |
| ASSURE          | Criterion-linked assurance and conditional review, including documentation fidelity.                                 |

Facts are discovered. Material choices are explicit. Reversible repository-conforming
implementation details remain agent-owned.

## Target lifecycle

```text
INTAKE: Product Baseline <-> product/domain design questions
   |
   v
SHAPE: Discovery <-> technical design questions -> Quick|Plan -> Planning
   |                                                    |
   +-- product/domain contradiction -> INTAKE ----------+
   |
   v
GATE -> BUILD -> ASSURE ✓
```

Question ownership produces these resumable states:

```text
intaking <-> product|terminology|domain_rule question
discovering|planning -> awaiting_shape_decision -> discovering|planning
discovering|planning -> awaiting_intake_decision -> discovering|planning
discovering -> awaiting_profile_choice -> planning
planning -> awaiting_approval
```

Exactly one `ActiveDesignQuestion` exists across entire task.

## Canonical task records

### ProductBaseline

`ProductBaseline` is canonical INTAKE record. It contains five dimensions:

1. objective;
2. affected users and product value;
3. scope and boundaries;
4. observable success and validator;
5. product risks and determining constraints.

Each dimension contains stable ID, status, value or justified `not_applicable`,
provenance, and dependency node. Missing or unknown dimensions remain open. Baseline
also references contradictions, task-relevant domain records, and technical unknowns
owned by SHAPE.

### DesignState

Task-level `design` state owns transversal orchestration:

```text
DesignState
├── activeQuestion?
├── dependencyGraph
├── glossaryDeltas[]
├── domainRules[]
├── decisionCandidates[]
├── invalidations[]
└── semanticRetryCount
```

The graph owns only typed IDs and `dependsOn` edges. Payload authority stays in
`ProductBaseline`, design registries, SHAPE evidence/decisions, and Change Contract.

### DomainGlossaryDelta

Required fields:

- stable ID, canonical term, concise business definition, and domain context;
- accepted aliases and rejected/deprecated terms with reasons;
- related term IDs;
- optional examples and non-examples when needed for disambiguation;
- provenance, dependencies, lifecycle status, and durable disposition;
- proposed projection destination when disposition is `project`.

Implementation details are invalid glossary content.

### DomainRule and DomainScenario

`DomainRule` contains stable ID, context, linked terms, actors, application conditions,
outcome/invariant, exceptions/limits, evidence/provenance, dependencies, lifecycle
status, durable disposition, and child scenario IDs. A non-applicable field requires a
reason rather than silent omission.

`DomainScenario` contains stable ID, initial situation, event/action, expected or
forbidden result, angle (`nominal|boundary|exception|contradiction`), provenance, and
evidence references. It may become acceptance or validation evidence but is not
automatically an executable test.

### DecisionCandidate

A candidate for durable decision documentation contains stable ID, title, scope/context,
problem, forces in tension, viable and excluded alternatives, evidence, recommendation,
confidence, explicit user selection, consequences, dependencies, lifecycle status,
destination, and ADR qualification:

- durable beyond current task;
- materially costly to reverse;
- real trade-off among viable alternatives;
- surprising without recorded rationale.

All four gates are required for ADR projection.

### TechnicalDecision

SHAPE technical choice contains stable ID, question, materiality reason, prerequisite
and dependent IDs, fresh evidence, viable and excluded options, recommendation,
confidence, consequences, explicit selection, status, and prior SHAPE role. No separate
escalation record exists.

### ActiveDesignQuestion

Common envelope contains:

- stable question and decision IDs;
- variant `product|terminology|domain_rule|technical`;
- owner `intake|shape` and exact prior role;
- prerequisite and affected dependency roots;
- prompt, parent context, direct consequences, and priority explanation;
- mode `choice|elicitation`;
- for `choice`, two or three non-dominated options, recommendation, reason, confidence;
- free-form capability and bounded clarification count.

Question is persisted before display. UI is an adapter: native interactive choice when
appropriate, text fallback with equivalent meaning, and targeted text for open
elicitation.

## INTAKE contract

### Discovery boundary

INTAKE may read only task-relevant guidance, effective policy/configuration, approved
Project Engineering Profile, domain documents, ADRs, relevant contracts, primary
manifests, and workspace identity. It does not scan implementation to avoid a question.
Current code behavior needed to validate a term or rule becomes one typed SHAPE unknown.

### Material domain triggers

Domain modeling activates only when an answer can change observable behavior, actor,
permission, responsibility, invariant, exception, domain-context boundary, data meaning,
success, scope, risk, or compatibility. Editorial wording, obvious aliases, and
reversible details remain model-owned. Every semantic classification carries a bounded
`materialityReason`.

An ambiguous term required to understand a baseline dimension becomes an elicitation
prerequisite for that dimension. No inverse dependency is permitted. INTAKE is complete
for current task only; it never attempts to model whole project.

### Domain stress testing

A material rule is tested adaptively through:

1. positive expected behavior;
2. a material boundary, exception, or counter-example;
3. confrontation with current applicable documentation and available technical evidence.

The model chooses useful scenarios rather than imposing fixed prompts. A trivial
explicit rule may close from one decisive source. Any contradiction remains open.
Existing approved domain docs describe desired baseline; code/tests describe current
behavior. User can explicitly revise baseline, producing deltas and dependent technical
work.

### Question and answer rules

Use a `choice` question when viable interpretations/options exist. Use targeted
`elicitation` only when offering options would invent business meaning. Material
normalization of free-form input requires exact targeted confirmation; faithful
editorial normalization does not.

One response may explicitly resolve multiple nodes. Model returns exact normalized
records; runtime validates whole transaction, authority, prerequisites, and
contradictions before applying it atomically. No partial success is persisted.

Silence, deferral, “choose for me”, or advance request cannot resolve material choice.
Available exits are answer, scope reduction that removes branch, or cancellation.

### INTAKE completion

`intake_complete` requires:

- five baseline dimensions resolved or justifiably not applicable;
- every task-material terminology/rule/context node resolved;
- no active INTAKE question or contradiction;
- valid graph and fresh documentary evidence;
- typed ownership for all remaining technical unknowns;
- semantic declaration that product/domain uncertainty is sufficient for SHAPE.

No question cap or periodic progress gate exists. Runtime shows global synthesis only
on request, at a real context/quota boundary, for material reinterpretation, or at SHAPE
exit.

## SHAPE contract

### Discovery before choice

Discovery inspects repository guidance, profiles, manifests/locks, configuration,
contracts, tests, representative code, configured service roots, safe commands, and
official primary documentation when local version-sensitive facts are insufficient.
Every evidence record carries source, fingerprint/version, observation time, freshness
rule, and dependency node. Unverifiable user information remains `user_asserted`.

Discovery and technical interview interleave. Explore only enough of a branch to decide
viability and materiality. Product writes, installs, migrations, and external effects
remain forbidden before GATE; isolated reversible task-space experiments are allowed.

### Technical materiality

Explicit user choice is required when alternatives materially affect architecture,
major framework/runtime/dependency, schema/migration, cross-service contract,
security/privacy, compatibility, concurrency, performance, cost, operations, rollback,
or approved profile convention. Another category requires persisted material impact
reason. Agent owns compatible reversible detail.

More than three options are reduced to two or three viable non-dominated choices.
Excluded alternatives remain recorded and available on request. Low-confidence
recommendation names irreducible trade-off.

Evidence showing selected technical option incompatible while another compatible
option exists invalidates technical branch. Evidence proving product infeasibility or
materially different product outcome creates one linked INTAKE question. Product payload
is not duplicated in `TechnicalDecision`.

### Frontier selection

Frontier contains unresolved required nodes whose prerequisites are current and
resolved. Model scores each candidate using:

- whether it blocks objective or success;
- authority;
- number and importance of branches unlocked;
- impact and irreversibility;
- risk;
- remaining uncertainty.

Runtime validates eligibility and bounded scoring, then uses stable ID tie-breaking.
Selected question and reason persist. Only answer, material invalidation, or new evidence
recomputes frontier through model. Full graph is hidden by default and shown on request
or when materially useful.

### Planning and profile choice

Quick/Plan choice occurs after main material technical decisions. Small local domain
deltas do not force Plan. Multiple contexts, ADR projection, migration, broad dependency
fan-out, or complex projection support Plan recommendation.

Planning reads structured state only. Missing facts return one Discovery Target; new
material choices return one Technical Decision. Each material Domain Rule maps to at
least one acceptance criterion or explicit durable disposition. Observable scenarios
become validation candidates classified as automated, manual, or documentary with
reason.

### SHAPE completion

Completion requires model declaration of no material uncertainty plus deterministic
proof:

- graph valid and acyclic;
- no open/invalidated required branch or active question;
- no active contradiction, stale evidence, or stale profile dependency;
- criteria cover Product Baseline success and material Domain Rules;
- tasks and validations cover criteria;
- applicable risks, compatibility, migration, operations, and rollback resolved;
- every durable domain delta has disposition and proof/reason;
- contract digest includes domain records and projection work.

SHAPE renders one compact synthesis then existing GATE card in same interaction. It asks
no duplicate final approval.

## Domain record lifecycle and projection

```text
proposed -> resolved -> approved -> projected
               \-> invalidated
```

Before GATE, domain records exist only in task state. Durable disposition is one of:

- `project`: contract contains targeted documentation task and validation;
- `already_documented`: fresh source fingerprint proves durable coverage;
- `task_local`: reason proves no durable knowledge should survive task;
- `policy_forbidden`: higher authority forbids projection.

GATE approval changes digest-bound records from `resolved` to `approved`. BUILD patches
only owned semantic entries/sections and preserves unrelated human content. Ambiguous
merge returns to owning decision rather than overwriting or appending duplicates.

ASSURE verifies path policy, changed file, fingerprint, expected IDs/links, semantic
fidelity, and content-specific rules: glossary has no implementation details; rules
retain conditions, results, and limits; ADR retains alternatives and consequences.
Assurance Receipt binds projection evidence to contract digest. Repository docs
become durable authority only after successful projection.

Destination resolver order:

1. explicit policy/configuration;
2. approved Project Engineering Profile;
3. detected repository convention;
4. portable defaults.

Portable defaults:

```text
docs/domain/glossary.md
docs/domain/rules.md
docs/adr/
```

Multiple contexts add `docs/domain/context-map.md` and
`docs/domain/<context>/{glossary,rules}.md`. Existing `CONTEXT.md`, context-map, glossary,
or ADR conventions remain respected when detected. Missing setup triggers one
non-blocking `$dev-flow init` recommendation; policy or irreducibly conflicting
destinations may block.

## Project INIT integration

Shared Project Engineering Profile gains optional `domain_documentation` facet:

- mono/multi-context mode and logical context identities;
- glossary, rule, context-map, and ADR paths/formats;
- identity/link conventions and projection language;
- provenance and source fingerprints.

Facet activates when evidence shows domain docs/contexts or user requests capability.
INIT discovers first and asks only contradictory or durable missing choices. Standalone
`npx @acrasie/dev-flow init` remains plugin configuration wizard and does not replace
agentic `$dev-flow init`.

## Privacy, language, and visuals

Routing adds stage `design`. Resolve it once from same immutable account/quota/model
snapshot as other routes. Fused INTAKE/domain and SHAPE technical-choice evaluations use
this route; repository fact-finding retains `discover`. Risk, ambiguity, and graph depth
raise effort within allowed bounds. Route, effort, and usage counters may persist;
decision content may not enter routing telemetry.

Persist normalized records, compact source refs, exact active question, and
invalidations. Do not persist transcript, hidden reasoning, prompt, raw answer after
normalization, large code/diff excerpts, credentials, or external payloads. Apply string
bounds, secret/PII redaction, and allowlisted provenance.

Stable IDs/enums remain English. Questions preserve dominant user language. Repository
projections preserve detected language; a new repository gets language choice through
setup. One answer never silently changes project documentation language.

Use cheapest useful visual: ASCII, Mermaid, isolated HTML/CSS, then Excalidraw/generated
image. Temporary prototypes never enter product source before GATE.

## Failure and resume

Invalid model output receives deterministic syntax repair only when meaning is intact,
otherwise one targeted semantic retry. Second failure creates typed block and preserves
prior state atomically.

Resume validates schema, active-question/status/owner combination, graph, source
fingerprints, profile, projection, config/policy, routing, and workspace. Fresh state
reuses exact question without reasoning. Changed dependency selectively invalidates
closure and returns to its owner.

## Implementation and acceptance

Public activation must update together:

- TaskState V6 types, schema, validator, state machine, guards, events, and projections;
- Product Baseline and design/technical/domain registries;
- graph kinds, frontier ranking, invalidation, persistence, and resume;
- `design-decisions`, `dev-flow`, `discover-change`, and `plan-change` skills;
- Project Engineering Profile schema/runtime for `domain_documentation`;
- lifecycle contract, glossary, public docs, metrics allowlist, and package artifacts;
- deterministic tests, fixtures, model evals, integration tests, and runtime smoke tests.

Acceptance requires:

- explicit input satisfies baseline dimensions without redundant questions;
- facts available from environment are discovered rather than asked;
- ambiguous task-critical language becomes prerequisite instead of assumed meaning;
- material domain and technical decisions have exactly one explicit resolution path;
- one active question and exact resume are enforced across task;
- frontier follows dependencies and selective invalidation;
- domain rules are stress-tested adaptively and trace to criteria/dispositions;
- no durable resolved delta disappears before GATE;
- docs are written only after approval and verified semantically;
- setup is recommended but non-blocking when safe defaults exist;
- no compatibility machinery remains for obsolete local state;
- current runtime remains unchanged until entire target increment lands.

## Decision records

- [ADR 0030](adr/0030-unify-product-domain-and-technical-design-interviews.md)
- [ADR 0029](adr/0029-make-build-a-native-execution-boundary.md)
- [ADR 0027](adr/0027-add-agentic-project-init-and-versioned-engineering-profiles.md)
- [ADR 0026 — superseded](adr/0026-keep-intake-product-stable-and-interview-shape-by-dependency.md)
