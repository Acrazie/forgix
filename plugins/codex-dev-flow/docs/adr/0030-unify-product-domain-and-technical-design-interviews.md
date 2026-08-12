# ADR 0030: Unify Product, Domain, and Technical Design Interviews

## Status

Accepted target design; implementation pending in unreleased TaskState V5.

## Context

Current INTAKE captures an adaptive brief and current SHAPE discovers repository facts,
but the workflow has no durable domain-modeling discipline and no ordinary interview for
material technical choices. ADR 0026 proposed a dependency-directed technical interview,
yet kept the dependency graph inside SHAPE and did not model terminology, business rules,
scenarios, documentation promotion, or a shared question boundary.

Useful design-interview practices include sharpening ambiguous language, confronting
claims with code and documentation, probing rules with edge cases, discovering facts
instead of asking the user, and traversing decisions by prerequisite. Copying an external
workflow would be wrong for Dev Flow: its lifecycle requires one active resumable
question, strict phase authority, deterministic state validation, read-only shaping,
digest-bound approval, and selective invalidation.

TaskState V5 already exists on `main` for the native BUILD boundary but has not been
released after v0.3.0. This target may therefore replace obsolete V5 structures without
supporting or migrating earlier local state.

## Decision

### Use one lifecycle-bound semantic protocol

Add internal `design-decisions` skill. It is not an autonomous brainstorming command.
The parent Dev Flow skill supplies typed state, phase ownership, evidence, and current
frontier; the parent alone persists results.

The protocol:

- detects material ambiguity and decisions;
- proposes domain scenarios and technical alternatives;
- ranks the currently unblocked frontier;
- emits at most one active question;
- normalizes explicit answers into typed records; and
- declares semantic coverage when no material uncertainty remains.

The protocol does not require a second routine model call. Initial INTAKE evaluation
returns Product Baseline progress, domain deltas, frontier analysis, and an optional
question together. SHAPE Discovery returns evidence, technical decision candidates,
frontier analysis, and an optional question together. A dedicated reevaluation occurs
only after an answer, material invalidation, or new evidence.

### Share orchestration, preserve authority

TaskState gains transversal `design` state containing one active question and one typed,
acyclic dependency graph. Payloads remain in their owning records:

- INTAKE owns `ProductBaseline`, terminology, business rules, domain scenarios, and
  business-context boundaries needed by the task;
- SHAPE owns repository evidence and material technical decisions;
- the canonical Change Contract owns approved implementation and documentation work.

Question variants are `product`, `terminology`, `domain_rule`, and `technical`. Product
and domain questions run in `intaking` or `awaiting_intake_decision`; technical questions
run in new `awaiting_shape_decision`. Exactly one question may be active across the task.
Every question persists its owner, prerequisites, prior role, direct consequences,
recommendation data where applicable, and selection reason before display.

The full unblocked frontier remains internal. A model scores impact, irreversibility,
risk, uncertainty, and branches unlocked with bounded reasons. Runtime rejects blocked
or authority-invalid candidates, then applies stable deterministic tie-breaking. Resume
re-renders the exact selected question without another model call unless a dependency
changed.

### Replace Intake Brief with a stable Product Baseline

`ProductBaseline` has five mandatory task-bounded dimensions:

1. objective;
2. affected users and product value;
3. scope and boundaries;
4. observable success and validator; and
5. product risks and determining constraints.

Each dimension has value or justified `not_applicable`, provenance, status, and graph
dependencies. Missing and unknown are not complete. Explicit request content can resolve
dimensions without redundant prompts.

INTAKE performs targeted documentary discovery of applicable guidance, an approved
Project Engineering Profile, domain documents, ADRs, and directly relevant contracts.
It does not scan implementation generally. A question is required only when a product
or domain answer can change observable behavior, actors or permissions, an invariant or
exception, a bounded-context boundary, data meaning, success, scope, risk, or
compatibility.

When viable interpretations exist, questions present two or three non-dominated choices,
one recommendation, confidence, consequences, and free-form input. If choices would
invent unknown business meaning, use a targeted open elicitation question. A material
normalization of free-form input requires targeted confirmation; editorial rewriting
does not.

### Model domain knowledge as three separate registries

The design state owns task-local candidate records:

- `DomainGlossaryDelta`: canonical contextual term, definition, accepted aliases,
  rejected or deprecated terms with reasons, related terms, optional examples and
  non-examples, provenance, status, and dependencies. It contains no implementation
  detail.
- `DomainRule`: context, linked terms, actors, conditions, outcome or invariant,
  exceptions and limits, provenance, status, dependencies, and child `DomainScenario`
  records. Scenarios describe starting situation, action/event, expected or forbidden
  result, and nominal, boundary, exception, or contradiction angle.
- `DecisionCandidate`: durable decision context, forces, viable and excluded
  alternatives, evidence, recommendation, confidence, explicit selection,
  consequences, ADR qualification, dependencies, status, and proposed destination.

Domain modeling activates by default only when a material trigger exists. It is bounded
to current task. Adjacent observations without material dependency do not enter the
graph or silently widen scope.

A domain rule becomes resolved through adaptive stress testing: positive behavior,
material boundary or counter-example, and confrontation with available evidence. A
trivial explicit rule may close without another user question when one strong source
proves it. A contradiction cannot close silently. Existing domain documentation is the
product baseline; code and tests prove current behavior, not desired behavior. The user
may explicitly change the baseline, producing dependent domain and technical deltas.

### Interview material technical decisions inside SHAPE

`TechnicalDecision` replaces the narrow Decision Escalation record. It stores
materiality reason, prerequisites, evidence, viable and excluded options,
recommendation, confidence, consequences, selection, status, and exact resume role.

Architecture boundaries, major frameworks or dependencies, data or migration,
cross-service contracts, security/privacy, compatibility, concurrency, material
performance/cost/operations/rollback, and approved profile exceptions are material.
Repository-conforming reversible implementation details remain agent-owned.

Discovery obtains facts before questions. Planning cannot inspect the repository; a new
fact creates one targeted Discovery Target and a new material choice creates one
Technical Decision. Evidence proving product infeasibility creates a linked INTAKE
question rather than duplicating product authority inside SHAPE.

### Make invalidation and completion deterministic

The task-level graph contains typed identities and dependencies only; registry payloads
are never copied into it. Runtime validates acyclicity, allowed ownership edges, one
active question, frontier eligibility, and transitive invalidation. Changing one answer
invalidates only dependent decisions, evidence, criteria, tasks, validations, risks, and
projections.

One response may resolve several explicitly answered nodes as one atomic transaction.
A material inferred normalization requires confirmation. Partial application is
forbidden. “Choose for me”, silence, deferral, or a request to advance never resolves a
material decision. User may answer, reduce scope so the branch disappears, or cancel.

Interview completion requires both a semantic declaration of no material uncertainty
and deterministic proof: all required nodes resolved, no active contradiction or stale
dependency, current evidence/profile, and an explicit disposition for every durable
domain delta. Planning may reopen only a targeted branch. No question cap, periodic
checkpoint, estimated-cost gate, or duplicate SHAPE approval exists.

### Approve before projecting domain knowledge

Resolved domain records use this lifecycle:

```text
proposed -> resolved -> approved -> projected
               \-> invalidated
```

Before GATE, all records remain structured task state. Each durable delta must have one
disposition: `project`, `already_documented`, `task_local`, or `policy_forbidden`, with
proof or reason. Material rules trace to acceptance criteria; observable scenarios are
validation candidates. Decision Candidates become ADR work only when all four gates
hold: durable beyond the task, materially costly to reverse, real trade-off among viable
alternatives, and surprising without recorded rationale.

GATE includes deltas and dispositions in the canonical contract digest. BUILD applies
approved documentation work through targeted semantic patches, never whole-file
regeneration. ASSURE verifies allowed paths, fingerprints, expected identities and
links, preservation of unrelated human content, and semantic fidelity. Successfully
projected repository documents become durable authority; task state retains references,
fingerprints, and receipts.

Destination resolution follows policy/configuration, approved Project Engineering
Profile, detected repository convention, then portable defaults. If no setup exists,
Dev Flow recommends `$dev-flow init` once but does not block unless policy or an
irreducible destination conflict requires it. Portable defaults are
`docs/domain/glossary.md`, `docs/domain/rules.md`, and `docs/adr/`, with context-specific
subdirectories and `docs/domain/context-map.md` when needed.

Project INIT gains adaptive `domain_documentation` profile data for context mode,
document paths, ADR location/format, language, identities, and link conventions. It
discovers existing conventions first and asks only unresolved durable choices.

### Bound persistence, failures, visuals, and testing

Add routing stage `design`. Its route is resolved once from the immutable run snapshot
and reused by fused INTAKE/domain evaluations and SHAPE technical-decision evaluations.
Effort scales with risk, ambiguity, and dependency-graph depth. Discovery keeps its
separate fact-finding route; a short prompt never justifies silently substituting a less
capable design route. Routing identity and bounded usage counters persist without
decision content.

Persist normalized records, source references, exact active question, invalidations,
and compact selection reasons—never transcript, hidden reasoning, raw prompts, large
code excerpts, credentials, or external payloads. Stable IDs and enums use English;
questions use the user's dominant language; projections follow repository language.

Use the cheapest visual that materially resolves a decision: ASCII, Mermaid, isolated
HTML/CSS, then Excalidraw or generated image. Full graph is shown only on request or
when complexity makes it necessary. No fake progress percentage is derived from a
frontier that may grow.

Invalid semantic output receives deterministic syntax repair when meaning is unchanged,
otherwise one targeted retry. Second failure preserves previous state and creates a
typed block. Testing combines deterministic schema/DAG/frontier/transition/invalidation
tests, contractual fixtures, and versioned model evals for materiality, question quality,
scenario quality, recommendation quality, and non-invention.

### Deliver as one coherent V5 contract

Implementation may proceed in verified internal layers, but public activation is
atomic across runtime, state schema, skills, normative contracts, projections, tests,
and distribution. TaskState remains V5 because the existing V5 change is unreleased.
No compatibility path or migration is provided for earlier local V4/V5 task state;
legacy state fails with a clear diagnostic. Obsolete structures and branches are
removed rather than retained behind compatibility code.

## Consequences

- INTAKE becomes a task-bounded product and domain design boundary rather than a brief
  field collector.
- SHAPE gains explicit user ownership for material technical choices without asking for
  discoverable facts.
- Domain terminology, rules, scenarios, technical decisions, acceptance criteria, and
  documentation share traceable dependencies without sharing payload ownership.
- Stronger state and eval requirements increase implementation size, but prevent
  invisible assumptions, lossy resume, and uncontrolled documentation writes.
- The existing target in ADR 0026 is superseded. Current runtime remains authoritative
  until this target lands atomically.
