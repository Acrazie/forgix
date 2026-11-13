# ADR 0033: Upstream Roadmap Ideation and Hybrid GitHub Authority

## Status

Proposed as an upstream architectural decision; implementation is pending.

## Context

Forgix separates `$forgix init` (durable engineering conventions in `.codex/dev-flow.project.yaml`)
from `$forgix <objective>` (single-change `TaskState` V6 lifecycle
`INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE ✓`, with Git/GitHub delivery outside
`TaskState`). Its distributed ESM runtime also remains network-free and free of runtime
dependencies.

Developers need a concentrated upstream ideation phase to think through a full wave of
product capabilities in one sitting, persist decisions across days without context loss,
and build an actionable GitHub Project roadmap without turning upfront ideation into stale
technical waterfall plans.

## Decision

### Upstream workflow outside `TaskState`

Add `$forgix roadmap` as a dedicated upstream workflow outside `TaskState`, in the same
family as `$forgix init`. It supports both initial roadmap creation and later milestone
additions across greenfield and existing single-repository projects, reading the `Project
Engineering Profile`, domain docs, and lightweight codebase facts when present while
recommending `$forgix init` without blocking when absent.

### Two-level domain backlog

Model the backlog in two levels: `Feature` (parent GitHub Issue with `feature` label
representing one user-facing capability) decomposed into atomic `Work Item`s (GitHub
sub-issues linked by native `blocked-by` dependencies). Each `Work Item` maps to one
Forgix execution and one pull request.

### Hybrid authority boundary

- **Git repository owns durable cross-cutting context**: global product vision (e.g.
  `docs/product-vision.md`), glossary/domain rules via existing destination resolution,
  engineering conventions (`Project Engineering Profile`), and a lightweight GitHub Project
  binding in `.codex/dev-flow.yaml`.
- **GitHub Project v2 and GitHub Issues own the living `Roadmap`**: `Feature`s,
  `Work Item`s, per-item scope (in/out), linked rules, observable acceptance criteria,
  initial risk (`low | medium | high | critical`), dependencies (`blocked-by`), priority
  (`P0`–`P3`), optional `Wave`, `Kind`, and live `Status`
  (`Backlog | Ready | In Progress | Blocked | In Review | Done`).

### Product-complete, code-unfrozen Work Items

Ideation captures the full product and verification contract inside each `Work Item`
without freezing target files or implementation plans. Live code discovery and planning
remain in `SHAPE` at execution time so earlier merges never invalidate future tickets'
technical plans.

### Three-phase resumable ideation and idempotent publication

`$forgix roadmap` runs three fluid phases backed by a local gitignored draft
(`.codex/roadmap/state.yaml`, without transcript):

1. Divergence/braindump with codebase context and active product challenge;
2. Convergence/decomposition into `Feature`s, `Work Item`s, risks, and dependencies;
3. Global visual review (dependency tree / DAG) and explicit approval.

Before publication, unblocked Wave 1 `Work Item`s default to `Ready` (adjustable during
final review) while later waves start in `Backlog`. The `forgix` CLI runtime stays
network-free for deterministic graph/schema validation and stable-ID assignment; the agent
skill runs `gh` CLI preflight checks (`auth` and `project` scope), attaches an existing
Project v2 or creates a new one, and publishes incrementally using persisted created issue
numbers for idempotent partial-failure recovery.

## Considered Options

- **Extend `$forgix init` or embed multi-task orchestration inside `TaskState`**: rejected
  to keep `$forgix init` focused on technical conventions and `TaskState` focused on one
  verifiable code change.
- **100% GitHub-only authority vs repo-canonical YAML mirrored to GitHub**: rejected to
  avoid scattering shared domain invariants across issues and to prevent bidirectional sync
  conflicts when developers edit cards or issues directly in GitHub.
- **Upfront technical plans vs title-only tickets**: rejected because frozen file plans go
  stale across merges while thin titles force `INTAKE` to block during autonomous runs.
- **Direct GitHub HTTP calls inside the `forgix` Node runtime**: rejected to preserve the
  network-free, zero-runtime-dependency package invariant.

## Consequences

- `TaskState` V6 single-task guarantees and the network-free CLI runtime remain intact.
- Cross-cutting product knowledge lives beside code while execution status lives cleanly
  in GitHub without dual-source drift.
- Running `$forgix roadmap` requires `gh` CLI authentication with `project` scope on the
  operator environment.
- Placed in root `docs/adr/` as a `Proposed` design record (following ADR 0032) so the
  packaged plugin manifest and size budget (`plugins/forgix/test/artifact-budget.json`) stay
  untouched until implementation activates atomically.
