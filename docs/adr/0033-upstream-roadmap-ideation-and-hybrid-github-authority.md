# ADR 0033: Repo-First Roadmap Ideation, Shared Architectural Contracts, and Adversarial Plan Audit

## Status

Proposed as an upstream architectural decision; implementation is pending.

## Context

Forgix separates `$forgix init` (durable engineering conventions in `.forgix/project.yaml`)
from `$forgix <objective>` (single-change `TaskState` V6 lifecycle
`INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE ✓`). Its distributed ESM runtime also remains
network-free and free of runtime dependencies.

For AI coding agents to execute multi-step initiatives reliably, upstream planning is
critical. Purely product-level tickets without shared architectural boundaries cause
independent agent runs to invent conflicting interfaces during `SHAPE`, while frozen
line-by-line file plans go stale after the first merge. Furthermore, a single-pass draft
without independent critique produces oversized or underspecified slices, and coupling
roadmap authority exclusively to GitHub Project v2 prevents offline deterministic validation
and native usage on non-GitHub repositories (such as Entire Trails or local-first repos).

## Decision

### Upstream workflow outside `TaskState`, symmetric with `$forgix init`

Maintain `$forgix roadmap` as a dedicated upstream workflow outside `TaskState`, in the
same family as `$forgix init`. It supports both initial roadmap creation and incremental
wave/milestone evolution across greenfield and existing repositories, consuming the
`Project Engineering Profile` (`.forgix/project.yaml`), domain glossary/rules, and
targeted read-only codebase discovery when present.

### Repo-First canonical authority with separated session, specification, and runtime states

To give agents fast, offline, deterministic access while preventing Git merge conflicts
across parallel `Work Item` branches, roadmap state is split into three distinct files:

- **`.forgix/roadmap/session.yaml` (gitignored `Roadmap Session State`)**: persists the
  in-progress 4-phase ideation session, the single crash-resumable `ActiveRoadmapQuestion`,
  candidate decomposition, and `Roadmap Plan Audit` findings before approval.
- **`.forgix/roadmap.yaml` (versioned canonical `Roadmap`)**: published atomically after
  explicit human approval (`RoadmapApprovalReceipt`) together with human-readable
  projections (e.g., `docs/roadmap.md`, `docs/product-vision.md`, and Mermaid/ASCII DAG).
  Owns `Feature`s, `Work Item`s, `Shared Contract`s, `Verification Checkpoint`s, and the
  verified `RoadmapAuditReceipt`.
- **`.forgix/roadmap/runtime.yaml` (gitignored `Roadmap Runtime State`)**: tracks live
  orchestration statuses (`Ready | In Progress | Blocked | In Review | Done`), active
  worktree bindings, `VerificationCheckpointReceipt`s, and external tracker sync mappings
  (`local` by default, with optional `github` Issues/Projects v2 and `entire` Trails
  adapters), reconciled deterministically against merged `main` history.

### Two-level backlog with typed `Shared Contract`s (`provides` / `consumes`)

Model the backlog as `Feature`s decomposed into atomic `Work Item`s (each sized for one
Forgix `TaskState` execution and one reviewable increment), bridged by explicit
`Shared Contract`s rather than frozen file lists:

- Each **`Shared Contract`** defines `id`, `title`, `kind` (`interface | schema | api |
  domain-invariant | module-boundary`), `status` (`planned | existing | verified`),
  `summary`, verifiable `invariants`, `verificationHint`, and a content digest.
- Each **`Work Item`** declares `providesContractIds` and `consumesContractIds` alongside
  its `objective`, `scopeIn`/`scopeOut`, `linkedRuleIds`, `acceptanceCriteria`, `risk`,
  `priority` (`P0`–`P3`), `wave`, and `blockedBy`.
- **Deterministic contract-DAG invariants**: every consumed contract must be either
  `existing` or provided by another `Work Item`; every consumer must depend (directly or
  transitively via `blockedBy`) on its provider `Work Item` and cannot sit in an earlier
  `Wave`. When a `Shared Contract` is updated in a later `$forgix roadmap` session,
  Forgix selectively invalidates only unfinished consumer `Work Item`s and dependent
  `Verification Checkpoint`s.

### Four-phase resumable ideation with mandatory independent `Roadmap Plan Audit`

`$forgix roadmap` progresses through four deterministic phases:

1. **Divergence (`divergence`)**: read-only codebase discovery and product/architecture
   clarification via one structured `ActiveRoadmapQuestion` per turn (2–3 non-dominated
   options, recommended choice, consequences).
2. **Convergence (`convergence`)**: decomposition into `Feature`s, `Shared Contract`s,
   atomic `Work Item`s, and inter-wave/feature `Verification Checkpoint`s.
3. **Independent Plan Audit (`audit`)**: an independent read-only reviewer subagent audits
   the candidate DAG across five agent-readiness dimensions (`slicing_atomicity`,
   `contract_completeness`, `dag_soundness`, `verifiability`, `scope_alignment`). Entering
   `synthesis` requires a `RoadmapAuditReceipt` bound to the `candidateDigest` with zero
   unresolved `blocking` findings (every `blocking` finding must be fixed in `convergence`
   or explicitly `waived` with user rationale).
4. **Synthesis & Publication (`synthesis -> published`)**: visual DAG rendering (`tree` or
   `mermaid`), explicit human approval (`RoadmapApprovalReceipt`), atomic publication of
   `.forgix/roadmap.yaml` + Markdown projections via `forgix roadmap publish`, and
   optional idempotent external synchronization via `forgix roadmap sync-plan` /
   `sync-record` (`local | github | entire`).

## Considered Options

- **GitHub-only authority (previous ADR 0033 draft)**: rejected because it breaks offline
  deterministic tooling, couples Forgix to a single hosting provider, and deprives agents
  of a canonical versioned roadmap specification inside the repository.
- **Purely product-only Work Items vs upfront file-by-file technical plans**: rejected
  both extremes in favor of `Shared Contract`s (`provides`/`consumes`), which preserve
  cross-item architectural coherence for agents without freezing volatile file paths.
- **Mutating live execution status inside versioned `.forgix/roadmap.yaml` on feature
  branches**: rejected because concurrent `Work Item` branches would create artificial Git
  merge conflicts; separating `.forgix/roadmap/runtime.yaml` + `main` reconciliation keeps
  branches conflict-free.
- **Skipping independent pre-approval plan review**: rejected because single-context
  planning routinely overlooks implicit couplings and oversized work items.

## Consequences

- `TaskState` V6 single-task guarantees and the network-free CLI runtime remain intact.
- `.forgix/roadmap.yaml` becomes a first-class, schema-validated, versioned artifact
  symmetric with `.forgix/project.yaml`.
- `$forgix roadmap` works 100% locally out of the box (`local` mode) while supporting
  idempotent synchronization to GitHub Issues/Projects v2 and Entire Trails.
