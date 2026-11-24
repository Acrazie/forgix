# ADR 0009: Separate Intake Decisions from Shape Discovery

## Status

Accepted for current runtime. Replacement target is recorded by ADR 0030; ADR 0026 is
superseded as target design.

## Context

Adaptive INTAKE now owns product intent, observable success, determining constraints,
and risk before SHAPE performs deeper repository discovery. Without a stronger
downstream boundary, SHAPE can duplicate the interview, silently choose among outcomes
that need human authority, or send an unstructured ambiguity back to INTAKE and force
the same technical investigation to run twice.

The boundary cannot depend only on whether a choice first appears technical. Repository
discovery can reveal alternatives whose effects change user experience, cost, delivery
time, scope, or the observable definition of success.

## Decision

Phase ownership follows decision impact:

- INTAKE owns every unresolved choice that can change product intent, user experience,
  cost, delivery time, scope, determining constraints, risk, or observable success.
- SHAPE owns repository discovery and purely technical uncertainty that does not change
  those product outcomes.
- SHAPE never silently resolves a product-impacting technical choice. It suspends
  shaping and requests an explicit INTAKE decision.
- SHAPE does not repeat an INTAKE decision unless fresh evidence invalidates it.

The SHAPE-to-INTAKE return uses a rich, structured Decision Escalation rather than a
plain missing-context signal. It contains:

- a stable decision key;
- technical evidence and provenance;
- the product impact;
- two or three feasible, mutually exclusive options;
- an evidence-backed recommendation;
- the SHAPE sections that may depend on the answer.

INTAKE validates this escalation and presents the explicit Decision Question. It does
not repeat the underlying repository discovery merely to reconstruct options. The user
remains the authority for the answer; a recommendation is not a decision.

SHAPE invalidation is always selective. Opening an escalation suspends
`contract_complete` and marks only the declared dependent sections as unreliable.
Fresh, independent discovery evidence and contract sections remain reusable. After the
INTAKE answer, the workflow invalidates the transitive dependency closure of the
decision and resumes targeted discovery or planning.

SHAPE is never reset wholesale. If dependency impact is ambiguous, the workflow widens
targeted discovery to resolve that ambiguity or blocks with the unresolved dependency;
it does not discard unrelated evidence. This rule prevents already-paid repository
reasoning from being repeated solely because one product decision changed.

Selective invalidation uses an explicit persisted dependency graph. Decisions, source
fingerprints, discovery evidence, and contract sections have stable identities. Every
derived discovery item and contract section declares `dependsOn` references to the
items required for its validity. The runtime validates that references exist, rejects
cycles, and computes the transitive dependency closure when a root changes.

The model proposes dependency links while shaping because it owns their semantic
meaning. The deterministic runtime owns structural validation and invalidation. It
never reconstructs the graph by asking a model to reread all SHAPE output during
resume.

SHAPE discovery is adaptive and targeted, not a fixed repository checklist. It starts
from the Intake Brief, structured decisions, transferred technical unknowns, and fresh
reusable evidence. Each discovery target has a stable key, a precise technical question,
its possible material impact, candidate sources, a result with provenance, and explicit
dependencies.

Discovery widens only when fresh evidence exposes an uncertainty capable of changing
scope, risk, acceptance criteria, implementation plan, validation, or the preparation
profile recommendation. SHAPE stops
exploring when no material technical uncertainty remains and every required contract
section has sufficient fresh supporting evidence.

SHAPE retains two strictly separated roles over one shared structured state:

- Discovery may read the repository and resolve Discovery Targets into fresh,
  provenance-bound evidence. It does not author the canonical implementation plan.
- Planning may project the canonical contract from fresh evidence. It does not read the
  repository or silently supplement missing evidence.

After Discovery proves `discovery_sufficient`, the workflow obtains the explicit Quick
or Plan preparation choice before Planning starts. This is a SHAPE projection choice,
not a product decision. Planning uses the selected profile without repeating Discovery.

When Planning lacks evidence, it creates a new Discovery Target and yields to Discovery.
After that target is resolved, Planning resumes from shared state. The transfer is
structured and dependency-linked, never a prose summary that causes either role to
repeat the other's work.

The nominal SHAPE path uses one Discovery reasoning session, one profile choice, and one
Planning reasoning session. One Discovery session may resolve multiple related targets.
There is no routine semantic re-review call: deterministic runtime verifies structure,
freshness, coverage, and dependencies. Additional reasoning is allowed only for a new
material Discovery Target or an invalidated evidence closure, and receives only the
relevant state subset. Planning never rereads repository sources.

SHAPE uses configurable soft budgets for reasoning calls, estimated tokens, and context.
Defaults must come from benchmark evidence rather than arbitrary hard-coded counts. When
a budget approaches exhaustion, the workflow persists all current evidence and displays
a compact checkpoint offering explicit continuation, scope reduction through INTAKE, or
cancellation. It never discards SHAPE work or silently spends beyond the budget.

`ShapeState` is the aggregate root for `discoveryTargets`, `evidence`,
`sourceFingerprints`, `decisionEscalations`, `preparationProfile`, `contract`,
`dependencyGraph`, and semantic `evaluatorReceipts`. Its primary progression is:

`discovering -> awaiting_profile_choice -> planning -> awaiting_approval`

Planning returns to `discovering` only through a material Discovery Target. Discovery or
Planning enters `awaiting_intake_decision` only through a Decision Escalation. Required
events include `discovery.target_recorded`, `discovery.evidence_recorded`,
`discovery.completed`, `profile.choice_requested`, `profile.choice_recorded`,
`contract.projected`, and `evidence.invalidated`.

For the Plan profile, Planning first completes the canonical contract and the parent
workflow renders a Markdown projection marked `Proposed`. GATE presents that projection
with the canonical digest. Approval binds logical contract content; changing projection
status to `Approved` does not alter that content.

The projection has its own fingerprint. A manual file edit never silently overwrites
canonical state and is never silently discarded. It returns to Planning with an
explicit reconciliation choice: integrate the edit into the canonical contract or
regenerate the projection. Any integrated material change requires a new Gate digest
and Approval.

SHAPE completion uses two hybrid proofs:

- `discovery_sufficient`: the Discovery model declares that no material technical
  uncertainty remains; deterministic checks require every target to be resolved or
  escalated, every supporting item to be fresh and provenance-bound, and no relevant
  invalidation to remain open.
- `contract_complete`: the Planning model declares the contract implementable;
  deterministic checks require the profile- and policy-applicable contract sections,
  valid acyclic
  dependencies, criterion-to-task coverage, task-to-criterion coverage, and a
  verification method for every criterion. Risk or policy additionally requires threat
  and rollback records when applicable.

Exiting SHAPE requires both proofs. A second model does not re-evaluate another model's
semantic judgment merely for confirmation; deterministic runtime owns structural
verification.

A Decision Escalation moves the task to a distinct `awaiting_intake_decision` state
rather than overloading `awaiting_mode_confirmation`. The state persists the escalation
identity, active Decision Question, prior SHAPE substate, affected dependency roots, and
freshness references for retained evidence.

After an explicit answer, INTAKE integrates the decision and recomputes classification
or routing only when their declared dependencies are affected. Runtime invalidates the
decision's dependency closure. The task resumes `discovering` when required evidence is
missing; otherwise it resumes `planning`. It does not rerun initial INTAKE.

Freshness is tracked per evidence source rather than through one repository-wide Git
invalidation. Tracked files use blob identities; untracked files and configuration use
content digests; command evidence binds the command, relevant inputs, and observed
result; external evidence uses a stable identity plus policy-defined observation time
or TTL.

Resume checks only sources referenced by live evidence. A changed source invalidates
its transitive dependency closure and creates a targeted refresh Discovery Target.
Unchanged source evidence is reused without another model read. A broad Git change
alone is not sufficient reason to invalidate unrelated SHAPE work.

## Consequences

- INTAKE and SHAPE have an effect-based ownership boundary that also covers choices
  discovered late.
- Technical evidence crosses the boundary without transferring ownership of the human
  decision to SHAPE.
- Selective invalidation requires explicit dependency links between decisions,
  discovery evidence, and contract sections.
- Resume reuses fingerprint-valid independent evidence and spends tokens only on the
  invalidated dependency closure.
- Persisted dependency metadata grows with the contract, but makes invalidation
  deterministic and auditable.
- Small changes inspect few surfaces; complex changes widen only through recorded
  material reasons.
- Discovery and Planning can be tested and routed independently without paying for
  duplicate repository reads.
- Planning may require multiple resumable passes, but each additional pass must be
  justified by a new or invalidated Discovery Target.
- The common path pays for two SHAPE reasoning sessions rather than repeated discovery,
  planning, and model-verification passes.
- Budget exhaustion is resumable and user-authoritative rather than a lossy hard stop.
- Semantic sufficiency remains model-owned while structural completion and coverage are
  deterministic and testable.
- The lifecycle gains an internal INTAKE state whose name reflects late product
  decisions rather than mode confirmation.
- Crash/resume can re-present the exact escalated question and return to the correct
  SHAPE role.
- Source-granular fingerprints cost more metadata but prevent unrelated Git changes
  from causing expensive rediscovery.
- Persisted state and schemas need a resumable Decision Escalation linked to the active
  Decision Question.
