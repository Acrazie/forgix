# ADR 0015: Split Fast and Type-Aware Linting

## Status

Accepted.

## Context

The pre-commit gate needs consistently low latency. The Full Gate also needs semantic
TypeScript lint rules, such as unhandled-promise checks, that syntax-only linting and the
TypeScript compiler do not provide alone.

Oxlint type-aware linting requires the additional `oxlint-tsgolint` development package
and remains an evolving feature. Oxlint's integrated type checking is experimental and
is not yet a sufficient replacement for the repository's TypeScript compiler contract.

## Decision

Use two Oxlint execution profiles:

- The Fast Gate runs native Oxlint rules without type-aware analysis over staged
  JavaScript and TypeScript files.
- The Full Gate runs Oxlint with type-aware rules over the repository and separately
  runs `tsc --noEmit`.

Install `oxlint-tsgolint` only as a development dependency. Do not enable Oxlint's
experimental `--type-check` mode and do not remove TypeScript compiler validation.

Both profiles consume one versioned Oxlint configuration. Differences in analysis mode
belong in repository scripts, not duplicated rule configurations.

## Consequences

- Commit feedback avoids type-program construction cost.
- CI detects semantic lint failures that syntax-only rules and `tsc` may miss.
- The development installation gains one native tooling dependency, but the published
  package remains unchanged.
- Full linting and type checking intentionally overlap where independent tools can catch
  different defects.
- Upgrades to evolving type-aware rules require reviewing new diagnostics rather than
  silently weakening the configured rules.
