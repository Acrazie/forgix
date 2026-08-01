# ADR 0023: Deliver the Quality Toolchain in Three Pull Requests

## Status

Accepted.

## Context

The quality-toolchain change crosses workspace ownership, dependency resolution,
repository-wide formatting, lint corrections, test APIs, test architecture, coverage,
runtime support, CI platforms, and deterministic budgets. Combining every concern into
one review would hide causality and make rollback expensive.

Splitting arbitrary files rather than coherent contracts could leave the repository
temporarily broken. Each delivery slice therefore needs its own green boundary.

## Decision

Deliver three ordered pull requests:

1. **Toolchain:** root Bun workspace and lockfile, Oxfmt, Oxlint profiles, Husky,
   staged-file adapter, Fast Gate, required CI installation adjustment, lint fixes, and
   a dedicated repository-wide formatting commit.
2. **Tests:** migrate to `bun:test`, establish Unit and Integration Test Layers,
   randomize ordering without retries, and capture then enforce the initial source
   coverage ratchet.
3. **CI and budgets:** require Node.js 24, add Linux/macOS Runtime Smoke evidence and
   targeted macOS release tests, enforce deterministic size budgets, record timing
   observations, and activate the final Full Gate.

Each pull request must pass its current and newly introduced checks independently. A
later slice cannot be required to repair an earlier slice's broken repository state.

## Consequences

- Reviews and regressions map to one quality concern at a time.
- Formatting churn stays isolated from test and CI behavior changes.
- The repository has temporary transition states, but each remains buildable and green.
- Later pull requests depend on merged contracts from earlier ones and must rebase if
  those contracts change.
- Full final enforcement arrives only after the third pull request.
