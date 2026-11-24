# Forgix Artifact Contract

## Canonical owner

Persisted `ShapeState.contract` is sole logical owner of implementation contract. It
contains artifact identity/revision, Intake and Discovery receipt references, selected
profile, risk, scope, applicable non-goals, stable criteria, ordered tasks, validation
coverage, applicable risks/controls, dependency nodes, and canonical digest.

Quick and Plan share the canonical contract fields:

- **Quick:** compact valid contract in state; minimum may be one criterion, one task, one
  validation. No Markdown required.
- **Plan:** new contracts use version 2 with a frozen design summary and selected
  choices. Historical version 1 contracts retain their format until explicit adoption.
  Version 2 adds one deterministic Markdown projection with a Definition of Done derived
  from ASSURE operations. Non-goals and
  atomic dependencies required. Implementation Guide allowed only with evidence-linked
  material trigger.

## Projection

Parent renders Plan projection at safe repository-relative path, default
`docs/forgix/YYYY-MM-DD-<slug>.md`.

1. Preview the canonical Plan v2 document with `task gate <id> --view`; this does not write.
2. Confirm that repository policy permits the exact content and path, or obtain confirmation
   from the authorized respondent if the policy permits it. Use
   `task project <id> --path=<path> --authorize=<full-contract-digest>`. This authorizes local
   projection only, not GATE, commit or publication. Protected destinations are denied.
3. Journal the pending fingerprint before publication and record the published fingerprint
   only after the file exists. Recovery authenticates the file against the journal; identical
   content at a third-party path is not ownership.
4. GATE approves the logical digest, not the file. It marks the projection `Approved` without
   changing logical content. Any accepted material change requires a new approval.
5. An existing file is never blindly replaced. Where compare-and-replace cannot be guaranteed,
   reconcile the change in SHAPE and have the owner move the existing file aside before
   regenerating at the same path. Keep the owner's edits. Do not adopt a third-party collision.

Projection is never second source of truth.

## Ownership and invalidation

- Discovery/Planning skills remain read-only; parent alone persists state/projection.
- Dependency DAG links decisions, sources, evidence, criteria, tasks, risks, validation,
  guides, and projection.
- Change invalidates only transitive dependency closure. Shape is never reset wholesale.
- Resume reconciles fingerprints and continues first unproved targeted action.
- Approval binds gate, actor evidence, state revision/fingerprint, artifact identity, and
  digest—not pathname or boolean.
- Durable task state lives at `.forgix/tasks/<task-id>.json` and is validated, saved,
  and gated via `forgix task validate`, `forgix task save <task-id>`, and
  `forgix task gate <task-id>`.

## Upgrade and rollback

Before allowing the new runtime to write, stop older clients and keep them from
writing in that task workspace. Mixed-version writers are unsupported: an older
runtime refuses to load a version 2 contract but a cached older payload can still
overwrite it through the older save command. Do not point the old runtime at an
upgraded task workspace. For rollback, preserve it intact and use a distinct
workspace with only compatible states. Resume new Plan contracts with a compatible
runtime. No automatic downgrade or state synchronization is supported.

## Legacy layouts

Earlier `spec.md`, `plan.md`, `risk-and-rollback.md`, and `verification.md` layouts remain
repository choices only. They are non-canonical and cannot replace persisted contract
identity/digest.
