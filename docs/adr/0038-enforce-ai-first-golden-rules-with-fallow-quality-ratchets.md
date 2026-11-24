# ADR 0038: Enforce AI-First Golden Rules with Fallow Quality Ratchets

## Status

Implemented. Supersedes the advisory-only Fallow posture in
`docs/forgix/2026-11-18-fallow-factory-guardrails.md`.

## Context

Forgix is built and maintained primarily through AI coding agents working across Codex, Claude
Code, and Antigravity. Earlier quality tooling established strong formatting, linting,
type-checking, randomized testing, and artifact/prompt size budgets, while Fallow (`3.43.2`) was
introduced mostly in advisory mode: only a coarse `src/**` ↛ `scripts/test/.dagger` boundary
blocked `bun run check`, while dead code (39 findings), complexity (87 high-complexity
functions, 112 functions > 60 lines), and duplication (347 lines / 1.9%) were report-only.

Meanwhile, a prior consolidation of `src/` into 13 files created multi-thousand-line modules
(`src/roadmap/index.ts` at 2,822 lines, `src/cli.ts` at 2,028 lines, `src/task/index.ts` at
1,765 lines), and `bunfig.toml` coverage floors (`lines: 0.72, functions: 0.75`) lagged far
behind measured coverage (`92.12%` lines / `97.28%` functions), leaving ~20 points of
unprotected regression headroom. Advisory reports and prose guidelines alone do not reliably
stop agents from growing monoliths, duplicating code, leaking cross-domain imports, or slipping
in inline lint suppressions (`Escape Hatch`es).

## Decision

1. **Establish a canonical, deterministic `Golden Rule` contract**:
   - Create [docs/golden-rules.md](../golden-rules.md) as the single repository-development
     authority across six pillars: AI-First & Lightweight, Modularity & Granularity,
     Architecture & Module Boundaries, Hygiene & Zero Duplication, Zero Regression & Testing
     Discipline, and Contracts/Security/Anti-Bypass.
   - Keep `docs/golden-rules.md`, this ADR, and committed baselines under `fallow-baselines/`
     out of the published npm tarball (`package.json` `files`) so internal governance adds zero
     bytes to user installs, and out of `.fallow/` (which `.gitignore` and Dagger exclude).
   - Reference `docs/golden-rules.md` concisely from `AGENTS.md` (preserving the 100-line
     `promptBudget`) and `CONTRIBUTING.md` without duplicating rule text or misstating planned
     gates as already active.

2. **Promote Fallow, Oxlint, and deterministic ratchet scripts to blocking `Quality Ratchet`s**:
   - Enforce strict layered zones (`types`, `core`, `profile`, `task`, `roadmap`, `cli`, and
     `tooling` including `vite.config.ts`) with `boundaries.coverage.requireAllFiles: true`,
     `--cycles`, and a standalone Fallow rule pack (`fallow-rules/no-network.json`, protected
     as a `Protected Surface`) banning network imports/calls/effects in `src/**` with
     `rules: { "policy-violation": "error", "re-export-cycle": "error" }` under `--policy`,
     strictly isolating peer domains (`profile`, `task`, `roadmap`) from importing each other.
   - Enforce modularity ceilings without fail-open gaps: `fallow health` (`maxFileLines` 300 for
     `src/**` and 400 for `scripts/**`, `maxCyclomatic: 15`, `maxCognitive: 15`, `maxCrap: 0`,
     `health.ignore` excluding `test/**`, `.dagger/**`, and `vite.config.ts`, using
     `--baseline-mode identity` against `fallow-baselines/health.json`), paired with Oxlint
     `eslint/max-lines-per-function` (`<= 60` with legacy overrides) and a per-file line-count
     ratchet (`fallow-baselines/file-lines.json` in `scripts/check-golden-rules.ts`) that blocks
     any growth in already-baselined legacy monoliths.
   - Gate dead code (`check:dead-code:gate` with `--fail-on-issues --baseline
     fallow-baselines/dead-code.json`, leaving advisory `check:dead-code` intact for Buildkite's
     `dagger call dead-code-report`), duplication (`fallow dupes --fail-on-issues --baseline
     fallow-baselines/dupes.json` over `src/**` + `scripts/**`), and structural coverage gaps
     (`scripts/check-golden-rules.ts` comparing `fallow health --coverage-gaps --format json`
     against `fallow-baselines/coverage-gaps.json`).
   - Ban inline `Escape Hatch`es in `src/**` (`scripts/check-golden-rules.ts` asserting
     `fallow suppressions --format json` = 0 plus scanning for `oxlint-disable`,
     `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `fallow-ignore`,
     `@expected-unused`, `as any`) and assert empty/absent `package.json` `dependencies`.
   - Lift `bunfig.toml` per-file `Coverage ratchet` floors (enforced per file by Bun per
     ADR 0014) to measured per-file reality (`0.72` lines / `0.90` functions, with measured
     aggregate `90.72%` lines / `97.73%` functions) and reconcile `Protected Surface`s across
     `docs/golden-rules.md`, `src/core/config.ts`, and `docs/git-workflow.md` (`Human-Reviewed`
     triggers).

3. **Separate tree-state checks from diff-relative checks**:
   - Keep **Fast Gate** (`pre-commit` / `check:staged`) instant: format, native lint, and
     staged index-blob (`git show :<path>`) `Escape Hatch` scan.
   - Keep **Full Gate** (`bun run check` / `dagger call check`) 100% deterministic over the
     working tree alone (safe for release tags and hermetic containers).
   - Add a **Diff Gate** (`bun run check:diff`, run in `.vite-hooks/pre-push` and PR CI after
     fetching `origin/main`): `--fail-on-baseline-growth --baseline-base origin/main` per Fallow
     baseline, monotonic non-growth on `file-lines.json`/`coverage-gaps.json`, and deterministic
     diff-to-test pairing (exempting only `refactor:`-only branches with unchanged public
     exports and non-decreasing coverage).

## Considered Options

- **Keep Fallow complexity, dead-code, and duplication advisory-only**: Rejected. Advisory
  reports are routinely ignored under time pressure or autonomous agent runs, allowing monoliths,
  dead exports, and copy-paste drift to accumulate silently.
- **Big-bang legacy refactoring before activating blocking gates**: Rejected. Splitting ~10,000
  lines of legacy `src/` monoliths in the same change mixes governance policy with high-risk
  structural refactors and delays zero-regression protection.
- **Rely solely on `fallow health` for function length, monolith non-growth, and coverage gaps**:
  Rejected after verifying `fallow@3.43.2` schemas and CLI output: `maxUnitSize` is
  informational only, `health --baseline` does not block growing an already-baselined file and
  does not store `coverage-gaps`, and `fallow suppressions` always exits `0`. Pairing Fallow
  with Oxlint `max-lines-per-function` and a small `scripts/check-golden-rules.ts` closes every
  fail-open gap deterministically.
- **Bundle `docs/golden-rules.md` into the npm package and embed rules in `forgix init`**:
  Rejected for now to preserve the lightweight published artifact and keep repository-internal
  governance decoupled from user-facing project templates.

## Consequences

- **Positive**: Every new file, function, import, export, or fix is mechanically checked from
  day one; legacy debt is strictly bounded and retired incrementally through dedicated PRs.
- **Positive**: Agents can query active boundaries before editing (`fallow guard <files>`) and
  work on small, self-contained modules that fit cleanly into context windows.
- **Trade-off**: Committed baselines under `fallow-baselines/` must be maintained as
  `Protected Surface`s and pruned whenever legacy modules are refactored; baseline growth
  requires explicit contract approval rather than silent regeneration.
- **Follow-up**: See the `Definition of Done` write boundary and rollout order in
  [docs/golden-rules.md](../golden-rules.md#definition-of-done-implementation-handoff).
  Resynchronizing the stale `.forgix/project.yaml` profile remains a separate task.
