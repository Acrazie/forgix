# ADR 0019: Gate Deterministic Size and Observe Timing

## Status

Accepted.

## Context

The plugin aims to remain performant and lightweight. Artifact size is deterministic
enough for a blocking CI contract, while wall-clock measurements on shared CI runners
vary with host load and can make an otherwise correct gate flaky.

The current bundle is 805,435 bytes and the pre-migration Full Gate completes in about
1.54 seconds on one maintainer machine. These are observations, not yet portable
thresholds.

## Decision

After the quality-toolchain migration, measure and commit baselines for:

- uncompressed `dist/dev-flow.mjs` bytes;
- packed npm tarball bytes; and
- unpacked npm package bytes.

Create deterministic blocking budgets from those baselines with explicit headroom
recorded alongside each value. A change may update a size budget only with a reviewed
explanation of the user-visible capability or required asset responsible for the growth.

Record Fast Gate, Full Gate, and cold CLI-start timing observations. Do not make timing
blocking until repeated CI data establishes a stable measurement method and a threshold
with enough tolerance to avoid runner-noise failures.

Do not combine timing and size into one score. A deterministic size regression remains
blocking even when execution happens to become faster.

## Consequences

- Artifact growth becomes visible and reviewable.
- Shared-runner timing noise cannot fail otherwise correct changes initially.
- Performance timing remains observable and can become a ratcheted gate after a stable
  baseline exists.
- Size-budget updates require explicit review rather than an unexplained baseline reset.
- The implementation must define reproducible pack inputs before capturing package
  budgets.
