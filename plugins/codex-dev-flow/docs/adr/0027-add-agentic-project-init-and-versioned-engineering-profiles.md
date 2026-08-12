# ADR 0027: Add Agentic Project INIT and Versioned Engineering Profiles

## Status

Accepted and implemented for Project INIT and profile transactions. Ordinary SHAPE
profile consumption and domain-documentation integration remain pending ADR 0030.

## Context

Material technical questions should not recur on every task when a project already has
approved architecture and development conventions. Existing repository files prove many
facts, but implicit conventions can be inconsistent or incomplete. The standalone
`npx codex-dev-flow init` configures plugin operation through a deterministic terminal
wizard; it cannot perform model-assisted repository discovery and a dependency-aware
architecture interview.

Projects may also span several repositories. Shared topology and contracts must be
portable, while absolute filesystem paths and personal preferences must remain local.
Any persisted profile must distinguish stable decisions from volatile task evidence,
detect drift, and never overwrite team conventions without explicit validation.

## Decision

### Add a separate agentic command

The plugin adds `$dev-flow init`. It is distinct from the existing standalone
`npx codex-dev-flow init` configuration wizard.

`$dev-flow init` discovers before asking. It reads applicable guidance, manifests,
configuration, architecture sources, tests, contracts, and representative code. It asks
only missing, contradictory, or material decisions, exactly one at a time, using the
recommendation and dependency rules now refined by ADR 0030. There is no hard question cap or
periodic progress checkpoint.

The command is adaptive. Every project uses a common core covering stack, source
structure, architectural boundaries, dependency direction, naming, error handling, and
quality/testing. Discovery or user input activates applicable modules for frontend,
APIs, data, security, concurrency, performance, compatibility, migrations,
observability, deployment, rollback, and operations. Non-applicable domains are not
asked.

Greenfield repositories are supported. With no code to inspect, INIT interviews the
applicable decisions and produces only profile and optional diagram artifacts. It never
scaffolds product code.

Long interviews persist gitignored `.codex/project-init/state.yaml` containing compact
normalized decisions, stale keys, exact active question, status, and candidate digest.
It contains no transcript or hidden reasoning. Resume restores same question unless
dependency evidence changed.

### Persist shared and local profiles separately

The canonical shared profile is `.codex/dev-flow.project.yaml`. It is versioned and
schema-validated. It stores only durable knowledge:

- logical project and service identities;
- supported stack/runtime choices;
- architecture, boundaries, and dependency rules;
- stable API/data/security/operations conventions when applicable;
- source layout, naming, error, testing, and quality conventions;
- decision provenance and durable source fingerprints;
- references to optional diagram projections; and
- content revision, digest, and `ProfileApprovalReceipt`.

The local overlay `.codex/dev-flow.project.local.yaml` is gitignored. It stores
non-contractual personal preferences and maps logical service identities to absolute
local paths. It cannot weaken repository policy or the shared profile.

The authority order is:

```text
system instructions and repository policy
-> INTAKE product decisions
-> explicitly approved task exception
-> shared engineering profile
-> non-contractual local preferences
-> agent defaults
```

A lower layer cannot weaken a higher layer. Repository observations, task-local file
facts, command results, and other volatile evidence stay in ShapeState rather than
inflating the project profile.

### Model multi-service topology without portable-path leaks

Each repository owns its own engineering profile. A root profile may describe logical
service topology, responsibilities, inter-service dependencies, and contracts, and may
reference profiles owned by other repositories. Local overlays map those service IDs to
available filesystem roots.

Discovery first inspects cheap guidance, manifests, contracts, and structure across
declared accessible services. It reads implementation deeply only when a live decision
can change the profile or current task. An inaccessible service statement is retained
as `user_asserted`, never fabricated as verified evidence.

INIT does not modify a profile owned by another repository without a separate explicit
profile transaction and validation for that owner. Absolute paths never enter shared
profiles.

### Reconcile profile drift transactionally

Profile decisions are authoritative defaults, not unbreakable rules. If fresh evidence
contradicts a profile, runtime identifies the affected dependency closure and interviews
only stale decisions. Facts are refreshed through Discovery; user-owned conventions are
never rewritten automatically.

Answers accumulate in a local proposed profile. No shared file is changed after each
question. At the end, INIT renders an adaptive human summary of changed decisions,
topology, exceptions, sources, and any useful Mermaid projection. The exact canonical
YAML remains available through `view`.

Profile validation is distinct from task GATE because it affects future tasks. Approval
creates a compact `ProfileApprovalReceipt` bound to user actor, timestamp, profile
identity, revision, and exact content digest. The receipt is outside the content digest
to avoid a digest cycle. One atomic write publishes profile and projections only after
that validation.

If the user rejects a global update, the shared profile remains byte-for-byte unchanged.
The mismatch and any explicitly approved task-local exception remain local. Future tasks
redetect drift from fingerprints. A task may proceed through a local exception unless
repository policy forbids it.

When no profile exists, ordinary `$dev-flow <objective>` remains usable. SHAPE discovers
only task-relevant conventions. Durable decisions are accumulated silently and offered
once as a proposed profile transaction before final SHAPE synthesis; promotion is never
automatic or asked after every answer.

### Project diagrams are projections

The YAML profile remains canonical. Non-trivial architecture may produce a deterministic
Mermaid document referenced by profile. Simple projects do not receive mandatory
diagrams. A diagram never becomes a second authority; manual drift requires explicit
reconciliation.

## Consequences

- Approved conventions are discovered once and reused without repeated SHAPE questions.
- Shared architecture stays portable across machines and multi-repository workspaces.
- Local paths and preferences remain private and non-contractual.
- Profile drift becomes selective, reviewable, and user-authoritative rather than a
  full reinitialization or silent overwrite.
- `$dev-flow init` uses strict profile schemas, deterministic digest/receipt logic, safe
  multi-root discovery, atomic authority publication, and negative path/privacy tests.
- The existing `npx codex-dev-flow init` remains compatible and keeps its current purpose.
- Project INIT/profile behavior is normative in the Project Engineering Profile contract.
  Ordinary task SHAPE profile consumption remains governed by current lifecycle until
  ADR 0030 implementation lands.
