# Dev Flow Glossary

## Artifact

A versioned owner or repository-native record for detailed task contract and evidence
references. One logical artifact may project to one file, several files, or another
policy-selected representation.

## Approval

An immutable human authorization bound to complete local canonical contract digest. In
TaskState V5 this is one Plan Approval Receipt.

## Change artifact

The sole versioned logical owner of stable intent, scope, acceptance criteria,
implementation plan, risks, and detailed evidence references. Its identity and canonical
digest—not its pathname—bind Approval. Plan profile does not prescribe one physical
layout.

## Plan profile

The durable-preparation choice made after SHAPE Discovery and before Planning. It
projects the canonical Change Contract to one versioned document containing
specification, plan, and evidence-required implementation guidance. Risk and policy,
not the profile, determine safety controls.

## Change record

Legacy name for a file-based projection of a Change artifact. It is a supported
repository choice, not a canonical Docs-profile convention.

## Benchmark record

An opt-in, local, gitignored post-task record containing a completed satisfaction
survey, allowlisted execution metrics, and deterministic deviation facts. It is outside
the lifecycle, never changes task outcome, and is never uploaded automatically.

## BUILD

The thin lifecycle boundary in which native Codex implements the complete approved plan.
Dev Flow verifies current Approval and exact digest before writes or resume, but adds no
execution skill, checkpoint, progress tracker, validation loop, or persisted BUILD
output. Material contract change returns to SHAPE then GATE; completion enters ASSURE
automatically.

## Bun test suite

The repository's sole automated test suite, discovered and executed by `bun:test`.
Its success proves behavior under Bun but is not, by itself, Node.js runtime
compatibility evidence.

## Cachebuster

The timestamp-derived suffix in the Codex plugin manifest version that gives one plugin
snapshot a new installation identity without treating the suffix as a separate semantic
product version.

## Configuration provenance

The source that supplied an effective configuration value.

## Coverage ratchet

The Full Gate rule that initializes Bun source-coverage thresholds from a measured
post-migration baseline, blocks regressions below them, and allows increases without
allowing silent decreases.

## Context Capsule

A compact, structured, and invalidable projection of task context shared across
lifecycle phases. It contains provenance and freshness fingerprints, but does not own
detailed evidence or approved scope.

## Decision Question

One active, resumable INTAKE question bound to a stable decision key and a determining
lifecycle impact. It offers mutually exclusive choices, one sourced recommendation, and
free-form input. A recommendation is never a user decision until explicitly answered.

## Decision Escalation

A structured SHAPE request for an explicit INTAKE decision when repository discovery
reveals feasible technical alternatives with different product effects. It carries a
stable decision key, technical evidence and provenance, product impact, mutually
exclusive options, an evidence-backed recommendation, and the SHAPE sections that may
depend on the answer. It transfers evidence, not decision authority.

## Dependency closure

The transitive set of discovery evidence and contract sections that depend on a changed
decision, source, or section. SHAPE invalidates this set selectively while retaining
fresh independent work; it never uses invalidation as a reason to reset all shaping.

## Dependency graph

The persisted acyclic graph connecting stable decision, source-fingerprint, discovery,
and contract-section identities through explicit `dependsOn` references. The model
proposes semantic links; deterministic runtime validates structure and computes
selective invalidation.

## Determining constraint

A constraint whose violation or change can alter the expected outcome, success signal,
risk, scope, solution, validation, or lifecycle transition. Preferences without
such impact are not INTAKE questions.

## Deterministic size budget

The blocking Full Gate cap for bundle, packed-package, or unpacked-package bytes,
derived from a committed baseline with explicit headroom and changed only through a
reviewed explanation.

## Discovery target

One stable, resumable SHAPE investigation unit containing a precise technical question,
its possible material contract impact, candidate sources, its evidence-backed result,
provenance, and explicit dependencies. A target widens discovery only when its result
creates another material uncertainty.

## Discovery role

The read-only SHAPE role allowed to inspect repository sources and resolve Discovery
Targets into provenance-bound evidence. It does not author the canonical plan.

## Diff Capsule

The ASSURE projection of approved criteria, applicable risks, changed surfaces,
dependency impact, and fresh validation evidence.

## Failure

A failed validation, review, or verification check tracked by a stable `issue_id`.

## Fast Gate

The low-latency, non-authoritative pre-commit quality gate. It checks formatting and
linting only for staged supported files, never mutates them, and delegates all quality
policy to repository scripts.

## Finding

An actionable review issue tracked by a stable `issue_id`.

## Fresh evidence

SHAPE evidence whose exact source fingerprints still match. Freshness is evaluated per
referenced source; unrelated repository changes do not make an evidence item stale.

## Formatting policy

The repository-wide conservative Oxfmt contract that normalizes presentation while
preserving prose wrapping, import order, and package-manifest field order.

## Full Gate

The authoritative repository-wide CI quality gate. It checks formatting, linting, type
correctness, build output, the complete automated test suite, and distribution behavior
regardless of whether a local hook ran.

## Gate

A control that authorizes a transition after checking required evidence. In the accepted
V5 design, GATE is exactly one deterministic pre-BUILD validation and explicit user
approval of the canonical implementation contract.

## Gate preflight

The accepted V5 pure deterministic check that validates current SHAPE completion,
contract digest, criterion coverage, evidence freshness, and escalation closure before
asking the user to approve the plan. It performs no model, network, discovery, or
subprocess operation.

## External delivery

Git, GitHub, registry, or release work performed after Dev Flow reaches `finished`. It is
outside TaskState V5 and requires native Codex authorization.

## Intake Brief

The compact, structured output of INTAKE. It owns the canonical objective, observable
success signal, risk, provenance, completeness state, and only the conditional
context that determines workflow behavior. It is not an interview transcript or a
Change Artifact.

## Implementation Guide

The optional Change Contract section containing only evidence-backed architectural
constraints, required patterns, migration rules, or sequencing details needed to
prevent implementation drift. It is not a second plan and does not contain decorative
prose or redundant pseudo-code.

## Integration Test Layer

The `bun:test` layer that exercises the built bundle or a complete composed workflow
when module composition, generated artifacts, or cross-module behavior is material to
the contract.

## Late Intake decision

An explicit product decision requested after SHAPE discovery reveals a
product-impacting technical choice. It is presented in `awaiting_intake_decision`,
selectively invalidates its dependency closure, and resumes the prior SHAPE work without
rerunning initial INTAKE.

## Lint policy

The version-pinned Oxlint contract that blocks correctness, suspicious, and performance
diagnostics plus unused disable directives, while leaving style, pedantic, restriction,
and nursery categories disabled initially.

## Macro-phase

One public lifecycle stage derived from internal task status and never persisted
independently. V5 has INTAKE, SHAPE, GATE, BUILD, and ASSURE.

## Issue ID

A stable hash identity for a failure or finding across workflow runs.

## Occurrence ID

An identifier for one observation of an issue in one workflow run.

## Policy

A schema-approved requirement, prohibition, bound, or lock applied after configuration resolution.

## Platform contract

The operating-system compatibility claim backed by targeted CI evidence. The current
contract supports Linux and macOS; Windows remains explicitly unsupported.

## Preparation profile choice

The explicit Quick-or-Plan choice made after `discovery_sufficient` and before Planning.
It is persisted with its evidence-backed recommendation in
`awaiting_profile_choice`. An explicit plan request or policy lock may resolve it
without presenting a redundant or false choice.

## Quality scope

The repository-wide set of maintained source, configuration, schema, workflow, and
documentation files governed by the Fast and Full Gates. Generated, vendored, cached,
lock, and distribution files are excluded explicitly when not safely excluded by the
quality tool itself.

## Planning role

The read-only SHAPE role that projects the canonical contract only from fresh structured
evidence. It cannot inspect the repository directly; missing evidence becomes a new
Discovery Target.

## Partial release

A release whose Git, npm-registry, or GitHub Release actions have not all reached their
intended state. It is resumed by reconciling external state and performing only the
missing idempotent action, never by rolling back published artifacts. Optional local
Codex installation is not publication state; retry it directly when needed.

## Phase contract

The uniform declaration of a macro-phase's intent, preconditions, consumed and produced
capsule fields, ownership, events, proof, failures, resume rules, invalidation, and
metrics.

## Plan Approval Receipt

The accepted V5 immutable user authorization for the complete local canonical change
contract. It is bound to task/artifact identity, full contract digest, state revision,
state fingerprint, actor, and timestamp. Any digest change invalidates it. It never
authorizes an external Git, GitHub, registry, or release action.

## Quick profile

The compact-preparation choice made after SHAPE Discovery and before Planning. It uses a
minimal SHAPE contract persisted in workflow state rather than requiring a
repository-versioned planning document. Risk and policy may still require strong gates
and assurance.

## Schema break

An intentional state-contract replacement with no compatibility migration. Legacy task
state is rejected clearly and never treated as current proof, Approval, or resumable
workflow evidence.

## Release preparation

The reversible portion of an interactive release: discovery, version recommendation,
preflight, temporary metadata generation, validation, package inspection, notes preview,
and final maintainer confirmation.

## Release publication

The irreversible portion of an interactive release beginning with the first successful
remote push and continuing through applicable npm publication, GitHub Release creation,
and optional local Codex plugin refresh.

## Release target

The maintainer-selected artifact set for one release: Codex plugin, npm package, or both.
It determines version mutation, tag namespace, validation, publication, and recovery
steps.

## Root cause ID

An identifier associating related issues after explicit investigation.

## Randomized test seed

The Bun-generated value that determines one CI test order, is retained in logs, and
allows an order-dependent failure to be reproduced exactly without retries.

## Runtime Smoke Suite

The narrow Full Gate suite that exercises the built and packaged CLI with the supported
Node.js runtime. It covers bundle import, CLI execution, configuration validation, and
package binary resolution without duplicating the Bun test suite.

## Assurance lane

An independent review concern activated by applicable risk. Critical lanes may be
omitted only through an evidence-backed non-applicability decision.

## Success guardrail

An observable outcome that must not regress while the primary success signal is
achieved.

## Success signal

The primary observable result that lets a named person or deterministic system judge
whether the requested outcome exists. SHAPE refines it into testable acceptance
criteria.

## Success validator

The person, role, test, metric, or system authorized to judge a success signal when
multiple validation authorities could require different proof.

## Type-aware linting

The Full Gate Oxlint profile that builds TypeScript type information through
`oxlint-tsgolint` to run semantic rules. It supplements rather than replaces
`tsc --noEmit`.

## Unit Test Layer

The `bun:test` layer that imports TypeScript source modules directly and proves isolated
deterministic behavior, boundaries, and failure contracts without requiring a bundle.

## Workspace root

The private Bun package that owns the repository-wide lockfile, quality dependencies,
hook installation, and orchestration scripts while leaving publishable plugin
dependencies declared by the plugin workspace.

## Shape State

The aggregate owning SHAPE discovery targets, evidence, source fingerprints, decision
escalations, preparation profile, canonical contract, dependency graph, and semantic
evaluator receipts. It is the resumable boundary shared by Discovery and Planning.

## State snapshot

The effective configuration and policy retained when a task starts, used to detect behavior changes on resume.

## Stable state

A non-progressing state that waits for a user action or external-state change. A stable
state may be resumable, such as `blocked`, or terminal.

## Staged-file adapter

The tested Bun script that converts Git's NUL-delimited staged path set into safe,
batched Oxfmt and Oxlint arguments for the Fast Gate. It never mutates working-tree or
index content.

## Terminal source

The operational status recorded in a `cancelled` or `failed` terminal event and used to
derive its last active macro-phase without persisting that phase.

## Project INIT and profile terms

Following terms are implemented for agentic `$dev-flow init` and deterministic Project
Engineering Profile backend. Ordinary SHAPE consumption remains pending.

### Configuration Wizard

The optional deterministic terminal workflow invoked through
`npx codex-dev-flow init`. It writes validated plugin operating configuration such as
worktree, subscription/quota, and integration preferences. It performs no model-assisted
repository Discovery and is distinct from Project INIT.

### Local Profile Overlay

The gitignored `.codex/dev-flow.project.local.yaml` file containing non-contractual
personal preferences and mappings from logical service identities to absolute local
paths. It cannot weaken repository policy or shared project conventions.

### Profile Approval Receipt

Immutable approval for shared Project Engineering Profile update. It binds actor,
timestamp, profile identity, revision, and exact content digest. Receipt remains outside
content digest to avoid a digest cycle and does not approve task implementation.

### Profile Reconciliation

Process comparing durable profile fingerprints with fresh project evidence,
rediscovering stale facts, re-interviewing user-owned conventions, and proposing only
affected updates. Rejection leaves shared profile byte-for-byte unchanged.

### Project Engineering Profile

Versioned `.codex/dev-flow.project.yaml` record containing durable shared architecture,
project boundaries, stack, development conventions, logical topology, source
fingerprints, revision, digest, and Profile Approval Receipt. Volatile task evidence
and absolute local paths are forbidden.

### Project INIT

The agentic `$dev-flow init` workflow that discovers repository facts, interviews one
material engineering decision at a time, validates a candidate Project Engineering
Profile, and publishes it only after explicit digest-bound Profile Approval. It creates
no product scaffold or TaskState.

### Project Topology

Shared logical model of services, responsibilities, dependencies, contracts, and owned
profile references. Filesystem paths resolving logical services belong only to Local
Profile Overlay.

### User Assertion

Provenance type for information supplied by user but unavailable for independent
verification. It may inform scoped profile decisions but never silently counts as
verified technical evidence.

### Visual Projection

Generated Mermaid document derived from canonical Project Engineering Profile. It is
published with profile transaction, uses immutable relative reference, and never becomes
second architecture authority. Broader task-decision visuals remain target behavior.

## Remaining accepted target design terms

Following INTAKE and ordinary SHAPE terms remain conceptual until runtime, schema,
skills, and normative lifecycle contract implement ADR 0026 atomically.

### Decision Graph

Target acyclic graph connecting Product Baseline decisions, Technical Decisions,
evidence, profile conventions, and contract sections. It orders unblocked questions and
computes selective transitive invalidation. It extends current SHAPE Dependency graph
rather than creating second independent authority.

### Product Baseline

Target stable INTAKE record covering objective, affected users and product value, scope
and boundaries, observable success and validator, and product risks and determining
constraints. These are five mandatory completeness dimensions, not five mandatory
prompts.

### Shape Decision Question

Target single active, resumable SHAPE question for one material Technical Decision.
It carries parent context, fresh evidence, recommendation and confidence, two or three
viable options, direct consequences, and free-form input.

### Technical Decision

Target user-owned SHAPE choice whose alternatives materially affect architecture,
runtime or major dependencies, data or migration, cross-service contracts, security,
compatibility, concurrency, performance, cost, operations, rollback, or approved
profile conventions. Reversible repository-conforming implementation details remain
agent-owned.
