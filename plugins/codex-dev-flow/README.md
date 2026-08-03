# Codex Dev Flow

Portable Codex plugin for evidence-based software changes. Runtime requires Node.js
24+. Linux and macOS are supported; Windows is unsupported. Distributed ESM bundle
installs nothing and performs no network access by itself.

## Current contract

Successful task path uses five phases:

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE -> finished
```

- **INTAKE** owns product objective, observable success, determining constraints, and
  risk.
- **SHAPE** performs adaptive repository Discovery, asks Quick/Plan after sufficient
  evidence, then performs repository-blind Planning.
- **GATE** deterministically validates and explicitly approves canonical implementation
  contract.
- **BUILD** executes approved atomic tasks.
- **ASSURE** reviews and verifies change, records compact verification receipt, then
  reaches sole success terminal `finished`.

State is strict V4. V1/V2/V3 are intentionally incompatible and never migrated. Legacy
`quick|standard|critical` invocation modes are removed.

## Interfaces

```text
$dev-flow <objective>
$dev-flow --benchmark <objective>
$dev-flow resume <task-id>
$dev-flow status [task-id]
$dev-flow config show [--explain]
$dev-flow config validate [--json]
npx codex-dev-flow benchmark summary
```

`quick`, `standard`, and `critical` at objective start are ordinary objective text—not
flags or aliases. Preparation profile is chosen only after Discovery:

- **Quick:** compact canonical contract in state; no Markdown required.
- **Plan:** detailed canonical contract plus one deterministic Markdown projection.

Both use same Discovery minimum and same five-phase success path. Risk/policy—not profile—controls
worktree, security, rollback, approval, and assurance safeguards.

## SHAPE guarantees

- Discovery alone reads repository; Planning consumes structured fresh evidence.
- Product-impacting technical choices return rich persisted Decision Escalation to
  INTAKE. Pure technical uncertainty stays in SHAPE.
- Explicit acyclic dependency graph enables selective invalidation. No reset-all Shape
  operation exists.
- Quick/Plan choice is explicit, persisted, and crash-resumable unless explicit Plan
  request or policy preselects Plan.
- Soft budget checkpoints preserve work and offer continue, reduce scope, or cancel.
- Plan projection drift cannot be silently overwritten or imported.
- Parent workflow alone writes state and Plan projection.

## State, routing, metrics

State lives at `.codex/tasks/<task-id>/state.yaml`. Status reports risk, selected
preparation profile or `unselected`, macro-phase, and benchmark opt-in.

Routing uses risk, ambiguity, policy, subscription, quota, and model availability.
Preparation profile never selects safety level. Worktree requirement derives from
critical risk, policy, explicit request, concurrency, or unsafe checkout.

Metrics accept allowlisted numeric/enumerated fields only, including preparation profile
and SHAPE counters. Objective, evidence prose, code, command output, and user answers are
forbidden.

Commit, push, pull request, registry, and release actions remain outside Dev Flow task
state. Native Codex may perform them afterward under their own explicit authorization.

Normative behavior: [lifecycle contract](docs/lifecycle-contract.md). Shape decisions:
[ADR 0009](docs/adr/0009-separate-intake-decisions-from-shape-discovery.md),
[ADR 0010](docs/adr/0010-choose-quick-or-plan-after-discovery.md). Artifact rules:
[docs/artifacts.md](docs/artifacts.md). Maintainer publication procedure:
[release runbook](docs/runbooks/maintainer-release.md).

Accepted next target, not yet implemented or normative: dependency-directed technical
interview and stable product baseline in
[ADR 0026](docs/adr/0026-keep-intake-product-stable-and-interview-shape-by-dependency.md),
agentic project INIT and engineering profiles in
[ADR 0027](docs/adr/0027-add-agentic-project-init-and-versioned-engineering-profiles.md),
and their [target contract](docs/target-intake-shape-contract.md).
