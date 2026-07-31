# ADR 0010: Choose Quick or Plan After Discovery

## Status

Accepted.

## Context

The `quick`, `standard`, and `critical` mode set mixes preparation depth with risk.
Requiring a mode argument also asks the user to choose before repository discovery can
show whether detailed planning is useful.

Quick currently bypasses operational SHAPE and GATE work. That creates a second
workflow rather than a lower-cost execution of the same lifecycle, and lets BUILD own
localization or design work that belongs to SHAPE.

The user-facing distinction is simpler: after technical discovery, either project a
compact execution contract or emit a durable detailed plan. Safety remains independent.

## Decision

The invocation has no mode argument:

`$dev-flow <objective>`

Every task traverses all six operational phases:

`INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE -> HANDOFF`

SHAPE contains two strictly separated roles with one explicit profile choice between
them:

`Discovery -> Quick|Plan choice -> Planning`

Discovery runs adaptively until `discovery_sufficient`. It then presents one structured,
evidence-backed preparation choice:

- **Quick:** project a compact canonical execution contract in workflow state.
- **Plan:** project a detailed canonical contract and one repository-versioned Markdown
  plan containing the spec, implementation plan, and any required implementation
  guidance.

The recommendation uses only fresh Discovery evidence. Quick is recommended for
localized, linear work with obvious validation. Plan is recommended for material
cross-surface dependencies, migration, non-obvious sequencing, coordination, or other
evidence that a durable artifact will reduce implementation drift. Policy may require
Plan and must explain the exact constraint rather than presenting a false choice.

An explicit initial request for a durable plan resolves Plan without a redundant
question. A policy lock resolves Plan with an explanation rather than a false choice.
Otherwise the workflow enters stable `awaiting_profile_choice`, persists the exact
Quick/Plan choice and evidence-backed recommendation, and requires an explicit user
answer. Silence cannot select the recommendation. Crash/resume restores the same choice
unless its Discovery inputs changed. Producing the choice uses the existing Discovery
result and does not require another model call.

The visible choice is a compact Discovery checkpoint, not an evidence dump. It states
the change shape, relevant surface count or categories, material dependency/migration/
validation facts, the recommendation, and one short evidence-backed reason. Full
Discovery evidence remains in state and is shown only on request.

The selected profile remains valid through later Planning-to-Discovery loops. New
technical complexity does not automatically ask the user again. Quick may gain whatever
internal contract detail correctness requires without becoming Plan, and Plan remains
Plan if later evidence simplifies the work. Only a fresh policy that forbids the
selection or an explicit user change invalidates the profile choice.

The profile choice happens before Planning and GATE. Choosing after all of SHAPE would
either make Quick pay for a detailed plan it discards or force Plan to reopen SHAPE.
Planning consumes the chosen profile and fresh Discovery evidence; it never rereads the
repository.

Quick and Plan share the same adaptive minimum Discovery required for safe executable
planning: relevant behavior, surfaces, dependencies, repository constraints, validation
commands, and material risks. Quick never saves tokens by moving unresolved technical
discovery into BUILD.

Plan may cause later targeted Discovery only when detailed Planning exposes a missing
fact needed by the durable contract. It cannot widen discovery merely to add explanatory
prose. Any evidence required for correctness, safety, or risk controls belongs to the
common minimum and is therefore required for Quick too.

Preparation profile controls artifact depth only. Risk and policy independently control
safeguards, approvals, worktree requirements, threat modeling, rollback planning,
assurance lanes, and other safety controls. The old Critical mode disappears; critical
remains a valid risk level.

This redesign uses a hard schema break. Legacy `quick`, `standard`, and `critical` task
states, invocations, approvals, artifacts, and receipts are not migrated or accepted as
current workflow evidence. Implementation replaces old mode branches directly rather
than carrying compatibility aliases or migration paths. Existing adaptive INTAKE
semantics remain, but its contract stops owning mode and hands risk plus product context
to SHAPE.

Quick and Plan share one contract schema. Quick's compact completion profile requires
Intake references, affected surfaces, testable acceptance criteria, ordered execution
steps, criterion-linked validation, applicable risks, and explicit dependencies. It
does not repeat Intake or Discovery prose.

Quick omits the Markdown projection, long rationale, obvious non-goals, a detailed task
DAG when linear order is sufficient, and implementation guidance without a material
architectural constraint. The smallest valid contract may contain one criterion, one
execution step, and one validation. Compactness cannot remove coverage, freshness, or
risk-driven requirements.

Plan uses the same logical structure at greater depth:

- **Spec:** expected behavior, scope, non-goals, and acceptance criteria.
- **Plan:** atomic tasks, dependencies, and verification mapping.
- **Implementation Guide:** only evidence-backed architectural constraints, patterns,
  migration rules, or sequencing details needed to prevent implementation drift.

Planning creates an Implementation Guide only when evidence proves at least one material
implementation constraint: an architectural boundary, compatible API/schema/data
migration, non-obvious execution ordering, security/concurrency/performance invariant,
mandatory repository pattern not inferable from tasks, or complex rollback/deployment.
The contract records `guideRequiredBecause` references to supporting evidence or risks.
Without an admissible linked reason, the section is absent rather than rendered as
`N/A`.

The structured contract in workflow state is canonical. Plan automatically projects it
to one repository-versioned Markdown document. The projection is generated from
canonical fields and is never an independently edited second source of truth. Its
default location is `docs/dev-flow/YYYY-MM-DD-<slug>.md`; repository configuration or
policy may select another native representation or location.

Planning renders the document as `Proposed` before GATE. Approval binds the canonical
logical digest, then projection status becomes `Approved` without changing contract
content. A manual projection edit triggers explicit Planning reconciliation; the
workflow neither imports nor overwrites it silently.

GATE always executes and binds to the canonical logical digest. Quick may satisfy it
through a lightweight policy/risk check when no explicit human approval is required.
Plan requires approval of the durable content-bound contract before BUILD. Risk or
policy may require stronger human gates for either profile.

BUILD always consumes the exact current SHAPE contract and never performs hidden
shaping. ASSURE scales by applicable risk rather than profile. HANDOFF behavior is
profile-independent.

## Consequences

- The common invocation is one short command with no mode vocabulary.
- Recommendation quality improves because repository complexity is known before choice.
- Explicit plan requests and policy locks avoid redundant questions; all other choices
  remain user-authoritative and resumable.
- Quick pays only for necessary discovery and compact planning while still traversing
  every lifecycle phase.
- Quick avoids hidden BUILD-time shaping; Plan spends extra Discovery tokens only on
  evidence genuinely required by its durable contract.
- Quick and Plan share contract parsing, BUILD inputs, and completion guards.
- Plan produces one predictable review artifact without splitting spec, plan, and
  guidance into drift-prone files.
- The state machine needs a stable SHAPE state for the explicit profile choice.
- The state machine no longer needs Standard- or Critical-only mode paths, but retains
  critical risk semantics.
- Invocation parsing, configuration, schemas, migration, docs, tests, metrics, and
  benchmarks must replace task mode with a post-Discovery preparation profile.
- Existing in-progress state becomes intentionally incompatible; the new schema and
  validators must fail it clearly instead of guessing a conversion.
