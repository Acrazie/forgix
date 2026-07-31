# Dev Flow Glossary

## Artifact

A versioned owner or repository-native record for detailed task contract and evidence
references. One logical artifact may project to one file, several files, or another
policy-selected representation.

## Approval

An immutable human authorization bound to a gate type and canonical contract digest.
It is invalidated when a material field of that contract changes.

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

## Cachebuster

The timestamp-derived suffix in the Codex plugin manifest version that gives one plugin
snapshot a new installation identity without treating the suffix as a separate semantic
product version.

## Configuration provenance

The source that supplied an effective configuration value.

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

## Finding

An actionable review issue tracked by a stable `issue_id`.

## Fresh evidence

SHAPE evidence whose exact source fingerprints still match. Freshness is evaluated per
referenced source; unrelated repository changes do not make an evidence item stale.

## Gate

A control that authorizes a transition after checking required evidence and, when
applicable, a content-bound Approval.

## Hand-off

The Git or GitHub work required after code and verification are complete.

## Handoff receipt

A structured identity and observed result for a commit, push, or pull-request action,
used to reconcile retries without duplicating external work.

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

## Late Intake decision

An explicit product decision requested after SHAPE discovery reveals a
product-impacting technical choice. It is presented in `awaiting_intake_decision`,
selectively invalidates its dependency closure, and resumes the prior SHAPE work without
rerunning initial INTAKE.

## Macro-phase

One of the six public lifecycle stages: INTAKE, SHAPE, GATE, BUILD, ASSURE, or HANDOFF.
It is derived from internal task status and is never persisted independently.

## Issue ID

A stable hash identity for a failure or finding across workflow runs.

## Occurrence ID

An identifier for one observation of an issue in one workflow run.

## Policy

A schema-approved requirement, prohibition, bound, or lock applied after configuration resolution.

## Preparation profile choice

The explicit Quick-or-Plan choice made after `discovery_sufficient` and before Planning.
It is persisted with its evidence-backed recommendation in
`awaiting_profile_choice`. An explicit plan request or policy lock may resolve it
without presenting a redundant or false choice.

## Planning role

The read-only SHAPE role that projects the canonical contract only from fresh structured
evidence. It cannot inspect the repository directly; missing evidence becomes a new
Discovery Target.

## Partial release

A release whose Git, npm-registry, GitHub Release, or local Codex installation actions
have not all reached their intended state. It is resumed by reconciling external state
and performing only the missing idempotent action, never by rolling back published
artifacts.

## Phase contract

The uniform declaration of a macro-phase's intent, preconditions, consumed and produced
capsule fields, ownership, events, proof, failures, resume rules, invalidation, and
metrics.

## Ready for handoff

A resumable state where code and verification are complete but an external Git or GitHub action cannot run.

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

## Shape State

The aggregate owning SHAPE discovery targets, evidence, source fingerprints, decision
escalations, preparation profile, canonical contract, dependency graph, and semantic
evaluator receipts. It is the resumable boundary shared by Discovery and Planning.

## State snapshot

The effective configuration and policy retained when a task starts, used to detect behavior changes on resume.

## Stable state

A non-progressing state that waits for a user action or external-state change. A stable
state may be resumable, such as `blocked` or `ready_for_handoff`, or terminal.

## Terminal source

The operational status recorded in a `cancelled` or `failed` terminal event and used to
derive its last active macro-phase without persisting that phase.
