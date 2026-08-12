# ADR 0026: Keep INTAKE Product-Stable and Interview SHAPE by Dependency

## Status

Superseded as target design by
[ADR 0030](0030-unify-product-domain-and-technical-design-interviews.md). Current runtime
behavior introduced before ADR 0030 remains documented by ADRs 0006, 0009, and 0010
until the replacement target lands atomically.

## Context

INTAKE and SHAPE already separate product intent from repository discovery, but current
SHAPE primarily asks only the Quick/Plan choice and escalated product decisions. A
complex change can still contain material technical alternatives whose consequences
should be chosen explicitly rather than inferred during Planning or BUILD.

A fixed questionnaire is also wrong. Facts available from repositories, tools, or
official documentation should be discovered, while decisions remain user-owned. Asking
several questions together hides dependencies and makes answers ambiguous. Conversely,
an arbitrary question cap can leave a material branch unresolved.

INTAKE needs a stronger stability rule without becoming a mandatory five-prompt form.
Five product dimensions must be resolved, but explicit input should not be asked again.
SHAPE needs a dependency-directed interview with exact resume semantics and no periodic
interaction that exists only to report progress or estimated cost.

## Decision

### INTAKE owns a stable product baseline

INTAKE resolves five mandatory dimensions:

1. objective;
2. affected users and product value;
3. scope and boundaries;
4. observable success and its validator; and
5. product risks and determining constraints.

These are five completeness dimensions, not five mandatory prompts. Input already
stated explicitly satisfies its dimension. Questions remain adaptive, one at a time,
and include two or three viable options, an evidence-based recommendation, and a
free-form path.

The Product Brief becomes stable when every dimension is resolved. A dedicated
confirmation is shown only when the brief contains a material interpretation,
normalized free-form decision, or resolved contradiction. Otherwise explicit request
and answers are sufficient; the final GATE approval still covers the complete contract.

SHAPE never mutates INTAKE. Fresh technical evidence may reopen only the affected
product decision. Product intent remains authoritative while a compatible technical
alternative exists. A contradiction is resolved by source:

- stale evidence returns to targeted Discovery;
- an incompatible technical choice with a viable alternative invalidates that SHAPE
  choice;
- proven infeasibility or materially different product outcomes reopen the dependent
  INTAKE decision; and
- only the transitive dependency closure is invalidated.

### SHAPE interviews only material technical decisions

SHAPE looks up facts before asking. It may inspect repositories, configured service
roots, safe command results, and primary external documentation. Missing factual
evidence creates a Discovery Target. User-provided information that cannot be verified
is retained as `user_asserted` provenance and cannot silently become technical proof.

A user question is required only for a material technical decision. Deterministic
triggers include architecture boundaries, framework/runtime or major dependency,
schema/data migration, cross-service contract, security/privacy, compatibility,
concurrency, material performance/cost/operations, and an exception to an approved
project profile. The model may add another material decision only with an explicit
impact reason.

Reversible details already implied by repository conventions remain agent-owned. The
user cannot delegate a material decision with “choose for me”; selecting the recommended
option explicitly is a valid decision.

SHAPE maintains an acyclic decision graph. It resolves the highest-impact unblocked root
before dependent branches. Discovery and interview are interleaved so eliminated
branches are not explored:

```text
Discovery -> technical decision -> targeted Discovery -> technical decision -> ...
```

Each visible interaction contains exactly one question. The runtime may normalize other
unambiguous decisions volunteered in the same answer and skip their future questions.
The full graph stays internal; the question shows only its parent context, evidence,
recommendation, confidence, viable options, and direct consequences. More than three
feasible options are reduced to two or three non-dominated choices; excluded choices
remain viewable and free-form input remains available.

There is no hard question cap and no periodic five-question checkpoint. State persists
silently after each answer. A warning appears only when a real context or quota boundary
threatens continuation. User revisions invalidate only dependent decisions, evidence,
and contract sections.

### Stable question state and completion

A new `awaiting_shape_decision` status belongs to SHAPE. It persists one exact active
question, its evidence and dependencies, and the exact prior role
`discovering|planning`. `awaiting_profile_choice` remains separate because Quick/Plan
controls preparation depth rather than technical design.

Quick/Plan is chosen after the main material technical branches are resolved and before
Planning. Planning may still create a targeted Discovery Target or Technical Decision
when a new material dependency appears.

SHAPE completion is hybrid. The model declares no material uncertainty remains;
deterministic runtime requires a valid decision DAG, no open required decision, current
evidence, current applicable project profile, complete criterion/task/validation
coverage, and resolved risks. An open mandatory branch cannot be bypassed by a request
to advance.

SHAPE then renders one compact synthesis of decisions, architecture, exceptions, risks,
and validation. The existing five-line GATE card follows in the same interaction. GATE
approval is the single final confirmation of shared understanding and authorization to
BUILD; SHAPE adds no duplicate confirmation.

### Adaptive visual evidence

Visuals use the least expensive representation that can resolve the decision:

- ASCII for simple flows, trees, and rough wireframes;
- Mermaid for architecture, state, sequence, and dependency diagrams;
- isolated HTML/CSS for material UI layout or interaction decisions; and
- Excalidraw or generated images only when explicitly requested or higher fidelity is
  necessary.

Two or three visual variants may appear inside one question when comparison is
material. HTML/CSS prototypes and executable spikes live in isolated temporary task
space, never product source. They are not promoted before GATE. Safe inspection,
non-mutating checks, and temporary experiments are allowed; installs, migrations,
external effects, and product writes are not.

Product-visible UX decisions remain INTAKE-owned. Component structure, layout
implementation, responsive mechanics, and frontend architecture remain SHAPE-owned.

## Consequences

- INTAKE becomes stable without imposing redundant prompts on explicit requests.
- Complex technical work can be interviewed deeply without asking repository facts or
  overwhelming the user with multiple simultaneous questions.
- The decision DAG provides deterministic question order, selective invalidation, and
  exact resume.
- Long interviews persist compact normalized decisions, active question, provenance,
  recommendations, and invalidations—not transcript or hidden reasoning.
- The new status and records extend unreleased TaskState V4 before publication rather
  than creating an immediate V5 break.
- Current runtime behavior remains authoritative until the lifecycle contract, schema,
  state machine, skills, and tests implement this ADR atomically.
