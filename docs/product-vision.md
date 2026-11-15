# Forgix Product Vision

## Mission

Turn software objectives and multi-wave product roadmaps into approved, implemented, and freshly verified changes across **Codex**, **Claude Code**, and **Antigravity**—without treating plausible answers as completed work and without introducing regressions into the interactive `TaskState` V6 lifecycle.

## Target Outcomes

1. **Concentrated Upstream Ideation (`$forgix roadmap`)**: Capture product vision, domain boundaries, `Feature` capabilities, and atomic `Work Item` contracts in a living GitHub Project v2 roadmap while keeping technical code discovery and implementation planning fresh at execution time (`SHAPE`).
2. **Risk-Conditioned Autonomous Execution (`$forgix run-issue`, `$forgix run-roadmap`)**: Let autonomous agents deliver well-specified, `low`/`medium` risk `Work Item`s in isolated worktrees as evidence-backed Draft PRs (`In Review`), while halting safely before `BUILD` whenever missing semantics, architectural decisions, or `high`/`critical` risks require human judgment (`Blocked`).
3. **Zero-Regression Safety & Multi-Harness Parity**: Preserve interactive `TaskState` V6 human `GATE` guarantees, zero-runtime-dependency and network-free Node.js 24+ CLI invariants, deterministic quality gates, and identical behavior across Codex (`$forgix`), Claude Code (`/forgix:forgix`), and Antigravity (`/forgix`).

## Core Operating Rules

- **Hybrid Authority**: Git owns cross-cutting product vision, glossary/rules, engineering profile, and Project binding; GitHub Project v2 and Issues own the living `Roadmap` (`Feature`s, `Work Item`s, native `blocked-by` edges, and live `Status`).
- **Product-Complete, Code-Unfrozen Tickets**: `Work Item`s specify objective, `scopeIn`/`scopeOut`, `acceptanceCriteria`, `risk`, `priority`, and `blockedBy`, never frozen target file lists or line-level plans.
- **Dependency & Merge Discipline**: Dependent `Work Item`s wait until upstream blockers reach `Done` (merged into `main`); `In Review` still blocks downstream execution.
- **Explicit Pre-`BUILD` Gate**: Interactive runs always require a user `Plan Approval Receipt`; autonomous runs require an `Autonomous Gate Receipt` (`actor: "autonomous_policy"`) eligible only at `low`/`medium` confirmed risk with zero open questions.
- **Evidence-First Delivery**: Draft PRs open only after `ASSURE ✓` (or green automated checks with only `user-observation` checks pending); failed or halted runs move to `Blocked`, post structured diagnostics on the Issue, and retain the local worktree.

## Roadmap Waves

- **Wave 1 — Sequential & Single-Item Autonomous Execution + Zero-Regression Guardrails**: Deterministic `run-issue` and `run-roadmap --parallel 1` CLI parsing, live GitHub state hydration, `INTAKE` seeding, risk-conditioned `SHAPE` → `GATE` bridging, isolated worktree lifecycle, Draft PR/`Blocked` reporting, multi-harness skill sync, and full regression/budget/coverage verification.
- **Wave 2 — Concurrent Execution & Recovery**: Bounded parallel execution (`--parallel M > 1`) with per-issue locks and idempotent recovery/reconciliation for interrupted runs.

## Non-Goals

- Unconditional autonomous execution of `high` or `critical` risk items without human `GATE` approval.
- Embedding HTTP clients, GitHub tokens, or runtime npm dependencies inside the distributed CLI bundle.
- Auto-merging pull requests (`merge: never` remains enforced).
