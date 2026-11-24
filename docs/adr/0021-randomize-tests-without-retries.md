# ADR 0021: Randomize Tests Without Retries

## Status

Accepted.

## Context

Bun executes the test suite in one process. Fixed discovery order can hide shared-state,
fixture, environment, or cleanup dependencies between tests. Automatic retries make CI
appear stable while masking those defects.

Bun reports the seed used for randomized test order and accepts that seed for exact
reproduction.

## Decision

Run the Bun test suite in CI with randomized ordering and preserve the reported seed in
job logs. Do not enable global or per-test automatic retries as a normal gate policy.

Every randomized failure is a real failure. Reproduce it with the emitted seed, remove
the order dependency or leaked state, and add a regression test where useful.

Use repeated execution only in an explicit periodic stress job or during diagnosis. A
passing retry cannot replace the original failing Full Gate result.

## Consequences

- CI continually probes order independence at negligible dependency cost.
- A failure remains reproducible through its recorded seed.
- Tests must isolate temporary files, processes, environment variables, clocks, and
  global state.
- Intermittent failures cannot be hidden by retry-until-green behavior.
- Periodic repeated execution can detect low-probability failures without making every
  pull request pay the same cost.
