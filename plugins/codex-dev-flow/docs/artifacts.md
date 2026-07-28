# Dev Flow Artifact Contract

## Status

This document projects the artifact rules from the normative
[lifecycle contract](lifecycle-contract.md). It describes the roadmap target, not a
claim that the current runtime already persists or reconciles these records. P0.3 now
provides strict in-memory V2 state and registry contracts; durable artifact/state
alignment and command reconciliation remain roadmap units P1 and P3.

## Ownership model

Dev Flow separates three kinds of data:

- one versioned change artifact owns detailed objective, scope, non-goals, acceptance
  criteria, implementation plan, risks, and detailed evidence references;
- local task state under `.codex/tasks/` will own compact status, checkpoints, events,
  fingerprints, and references needed to resume;
- the Context Capsule is a compact invalidable projection. It never becomes a second
  owner for approved prose or detailed evidence.

The change artifact is a logical contract with a stable `artifactIdentity` and canonical
digest. It may be one file, several files, or a repository-native record selected by
repository policy. Dev Flow must not infer Approval identity from a pathname or from a
mutable `approved: true` flag. See [ADR 0002](adr/0002-share-an-invalidable-context-capsule.md)
and [ADR 0003](adr/0003-bind-approvals-to-canonical-contracts.md).

## Required logical projection

Before a Standard or Critical pre-build gate, the artifact projection contains:

1. objective and effective constraints;
2. scope and non-goals;
3. stable acceptance criteria;
4. confirmed mode and risk;
5. an executable plan mapping each atomic task to acceptance criteria;
6. risks and rollback controls required by applicable policy;
7. artifact identity and canonical digest.

Critical also requires applicable threat, operational-risk, and rollback records. Their
physical filenames are not fixed by the lifecycle contract.

During BUILD and ASSURE, detailed evidence stays with its versioned owner. Compact state
stores fingerprints and references. Verification produces an acceptance-criterion to
fresh-evidence map. Handoff adds external receipts without rewriting approved intent.

## Mode rules

- **Quick:** no mandatory artifact while scope remains explicit, bounded,
  non-destructive, and policy-compatible. If Quick escalates through SHAPE/GATE, it uses
  the same logical contract as Standard.
- **Standard:** one logical change artifact is mandatory before implementation Approval;
  no canonical filename or monolithic Markdown template is imposed.
- **Critical:** the same logical artifact plus required risk records and separate human
  gates. Physical separation is policy-selected, not lifecycle-selected.

Repository policy may require stronger retention or a specific projection. It cannot
weaken Critical requirements or evidence freshness.

## Lifecycle rules

- SHAPE authors the canonical contract; GATE owns immutable Approval records.
- The parent workflow is the sole artifact writer. Delegated discovery, planning,
  review, and verification return structured content and remain read-only.
- Approval binds gate type, actor, time, artifact identity, and canonical digest.
- Material changes to objective, scope, acceptance criteria, mode, risk, plan behavior,
  or required Critical controls invalidate affected Approval records before BUILD.
- Resume reuses the artifact identity, reconciles its fingerprint, and selectively
  invalidates dependent capsule data. It never creates a duplicate artifact for one
  task.
- The artifact belongs to the active worktree and follows repository retention policy
  into the resulting commit or handoff.
- A separate ADR records only a durable architectural decision.

## Legacy layouts

Earlier documentation prescribed a monolithic Standard record at
`docs/dev-flow/YYYY-MM-DD-<slug>.md` and a fixed Critical directory containing
`spec.md`, `plan.md`, `risk-and-rollback.md`, and `verification.md`. Those layouts are
supported repository choices, not canonical mode requirements. Existing repositories
may keep them, but orchestration must reason from artifact identity, canonical fields,
and policy rather than those paths.

## Implementation boundary

Current release contains skills and partial deterministic primitives, but not complete
artifact persistence, Approval binding, Context Capsule invalidation, or resume
reconciliation. Until those roadmap units land, documentation and skills express the
target contract; they do not prove end-to-end enforcement.

Definitions: [Artifact, Approval, Change artifact, Context Capsule, and Gate](glossary/dev-flow.md).
