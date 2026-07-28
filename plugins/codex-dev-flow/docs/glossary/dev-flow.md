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
digest—not its pathname—bind Approval. Standard mode does not prescribe one physical
layout.

## Change record

Legacy name for a file-based projection of a Change artifact. It is a supported
repository choice, not a canonical Standard-mode convention.

## Benchmark record

An opt-in, local, gitignored post-task record containing a completed satisfaction
survey, allowlisted execution metrics, and deterministic deviation facts. It is outside
the lifecycle, never changes task outcome, and is never uploaded automatically.

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

## Determining constraint

A constraint whose violation or change can alter the expected outcome, success signal,
mode/risk, scope, solution, validation, or lifecycle transition. Preferences without
such impact are not INTAKE questions.

## Diff Capsule

The ASSURE projection of approved criteria, applicable risks, changed surfaces,
dependency impact, and fresh validation evidence.

## Failure

A failed validation, review, or verification check tracked by a stable `issue_id`.

## Finding

An actionable review issue tracked by a stable `issue_id`.

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
success signal, mode/risk, provenance, completeness state, and only the conditional
context that determines workflow behavior. It is not an interview transcript or a
Change Artifact.

## Macro-phase

One of the six public lifecycle stages: INTAKE, SHAPE, GATE, BUILD, ASSURE, or HANDOFF.
It is derived from internal task status and is never persisted independently.

## Issue ID

A stable hash identity for a failure or finding across workflow runs.

## Occurrence ID

An identifier for one observation of an issue in one workflow run.

## Policy

A schema-approved requirement, prohibition, bound, or lock applied after configuration resolution.

## Phase contract

The uniform declaration of a macro-phase's intent, preconditions, consumed and produced
capsule fields, ownership, events, proof, failures, resume rules, invalidation, and
metrics.

## Ready for handoff

A resumable state where code and verification are complete but an external Git or GitHub action cannot run.

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

## State snapshot

The effective configuration and policy retained when a task starts, used to detect behavior changes on resume.

## Stable state

A non-progressing state that waits for a user action or external-state change. A stable
state may be resumable, such as `blocked` or `ready_for_handoff`, or terminal.

## Terminal source

The operational status recorded in a `cancelled` or `failed` terminal event and used to
derive its last active macro-phase without persisting that phase.
