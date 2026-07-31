# Codex Dev Flow Design

## Goal

Portable six-phase workflow with high correctness and low token waste. Deterministic
code owns state, validation, routing, fingerprints, dependency closure, projections, and
guards. Skills own scoped reasoning. Parent workflow is sole writer.

## Public surface

```text
$dev-flow <objective>
$dev-flow --benchmark <objective>
$dev-flow resume <task-id>
$dev-flow status [task-id]
```

No invocation mode exists. Entire run text is objective. State V3 rejects V1/V2 without
migration.

## Lifecycle

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE -> HANDOFF
```

Canonical Shape path:

```text
new -> intaking -> discovering -> awaiting_profile_choice -> planning -> awaiting_approval
                         |                                  |
                         +-> awaiting_intake_decision <-----+
```

`awaiting_intake_decision` is INTAKE. It presents linked product question, then resumes
Discovery or Planning. No technical rediscovery is repeated.

## INTAKE/SHAPE boundary

INTAKE owns objective, success signal, determining constraints, scope product decisions,
and risk. It does not choose preparation profile or perform deep repository discovery.
Every complete Intake enters Discovery.

Discovery is repository-reading role. It resolves bounded targets, records technical
facts with provenance and source fingerprints, and creates new targets only for material
impact. `discovery_sufficient` requires semantic sufficiency plus deterministic
freshness, dependency, and unresolved-target checks.

After sufficient Discovery, user chooses:

- **Quick:** compact canonical contract; no Markdown projection.
- **Plan:** detailed canonical contract and one deterministic Proposed Markdown.

Planning is repository-blind. Missing evidence produces targeted Discovery Target.
Quick and Plan share one contract schema and same correctness minimum.

## Selective invalidation

`ShapeState` persists Discovery targets, evidence, source fingerprints, Decision
Escalations, profile choice, contract, projection, dependency DAG, invalidations, budget,
semantic retries, and receipts. Changed input invalidates only transitive dependency
closure. No full Shape reset API exists.

Supported source identities: Git blob, content digest, command plus input/result digest,
and external source with observation/TTL. Resume reuses fresh evidence without model
call and creates refresh work only for stale live evidence.

## Safety and cost

Risk/policy controls worktree, threat, rollback, approvals, and assurance. Preparation
profile controls contract depth/durable projection only.

Nominal SHAPE uses one Discovery reasoning session and one Planning session. Extra calls
require new material or invalidated target. Soft limit checkpoint preserves all work and
requires explicit continue, reduce-scope, or cancel decision.

## Artifacts

Canonical state owns logical contract. Plan Markdown is deterministic projection, not
second owner. Manual edit triggers integrate-or-regenerate reconciliation; material
integration changes digest and invalidates Approval.

See [lifecycle-contract.md](lifecycle-contract.md), [artifacts.md](artifacts.md),
[ADR 0009](adr/0009-separate-intake-decisions-from-shape-discovery.md), and
[ADR 0010](adr/0010-choose-quick-or-plan-after-discovery.md).
