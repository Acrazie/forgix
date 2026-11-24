# ADR 0014: Ratchet Source Coverage with Bun

## Status

Accepted.

## Context

The existing bundle-first suite cannot provide representative TypeScript source
coverage. Selecting a fixed percentage before migrating tests would create an arbitrary
target and could reward low-value tests written only to satisfy the number.

Coverage still provides useful regression evidence when its scope is stable and its
floor cannot silently decrease.

## Decision

Use Bun's built-in coverage reporting and threshold enforcement. Do not add a hosted
coverage service or third-party instrumentation dependency.

After the layered test migration from ADR 0013:

1. Measure lines, functions, and statements for maintained `src/**/*.ts` files.
2. Exclude tests, generated output, distribution files, fixtures, and vendored files.
3. Set the initial enforced thresholds from the measured baseline, rounded down only
   enough to avoid nondeterministic decimal noise.
4. Reject any later change that falls below an enforced threshold.
5. Raise thresholds when durable new coverage permits it. Never lower them without an
   explicit documented decision explaining lost executable behavior or a corrected
   measurement scope.

Coverage is a Full Gate signal. The Fast Gate does not collect it.

## Consequences

- Coverage cannot regress silently after the source-test migration.
- Initial thresholds reflect repository reality rather than an arbitrary percentage.
- CI stays self-contained and lightweight.
- Coverage does not replace behavior contracts, boundary tests, integration tests, or
  the Runtime Smoke Suite.
- Test or source-scope changes that legitimately alter measurement require an explicit
  baseline review.

## Implementation note

Bun 1.3.14 reports and enforces line and function coverage, but its installed text and
LCOV reporters do not expose statement coverage and its documented statement threshold
key does not affect the gate. PR2 therefore records statement coverage as unavailable
rather than claiming a false signal. Per-file line and function floors are enforced and
the measured aggregate is recorded. Statement enforcement remains required when Bun
exposes a verifiable metric.
