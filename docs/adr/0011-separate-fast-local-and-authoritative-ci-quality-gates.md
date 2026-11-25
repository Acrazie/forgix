# ADR 0011: Separate Fast Local and Authoritative CI Quality Gates

## Status

Accepted.

## Context

The plugin needs automated formatting, linting, type checking, building, and testing
without making normal commits progressively slower as the repository grows.

A Git hook is useful for immediate feedback but is local, optional, and bypassable. It
cannot be the sole owner of release or merge correctness. Running every validation on
every commit would also couple commit latency to the future size of the complete test
suite.

## Decision

Use two quality gates with different latency and authority contracts:

- The **Fast Gate** runs before a commit, checks only staged supported files, performs
  formatting and linting checks, does not mutate files, and targets sub-two-second
  feedback.
- The **Full Gate** runs in CI over the complete repository and performs formatting,
  linting, type checking, build validation, the complete automated test suite, and
  distribution smoke checks.

The Fast Gate is developer feedback, not authoritative proof. CI remains the required
source of quality evidence even when the local hook succeeds or is bypassed.

Both gates cover the repository as one quality scope. Formatting includes supported
source, configuration, schema, workflow, and documentation files at the repository root
and under the plugin package. Linting applies to supported JavaScript and TypeScript
files across the same scope. Generated, vendored, cached, lock, and distribution files
are excluded explicitly where the tool does not already exclude them safely.

Package scripts own both gate commands. Any Git-hook tool is only an adapter that calls
those scripts and contains no independent quality policy.

## Consequences

- Commit latency stays bounded as the full test suite grows.
- Root documentation and configuration cannot drift from plugin formatting policy.
- A commit may exist locally before all tests run; merge safety therefore depends on
  required CI.
- Staged-file selection must be path-safe and must not silently omit supported renamed
  or copied files.
- Developers need an explicit command to run the Full Gate before pushing when desired.
- Hook installation or bypass behavior cannot change CI validation semantics.
