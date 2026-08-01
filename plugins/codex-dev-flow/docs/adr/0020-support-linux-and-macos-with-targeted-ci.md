# ADR 0020: Support Linux and macOS with Targeted CI

## Status

Accepted.

## Context

The plugin describes itself as portable. Existing release policy guarantees the
maintainer workflow on macOS, treats Linux as best-effort, and explicitly does not claim
Windows support. Running the complete quality toolchain on every operating system would
increase CI cost without equal value for platform-independent checks.

Ubuntu-only CI would leave the existing macOS release guarantee dependent on manual
maintainer testing.

## Decision

Define Linux and macOS as the supported platform contract. Windows remains explicitly
unsupported until a later decision supplies compatible behavior and CI evidence.

Use targeted GitHub Actions jobs:

- run the complete Bun Full Gate, coverage, lint, typecheck, build, size, and package
  checks on Ubuntu;
- run the Node.js 24 Runtime Smoke Suite on Ubuntu and macOS; and
- run maintainer-release integration tests on macOS in addition to their primary Bun
  execution on Ubuntu.

Do not duplicate platform-independent formatting, linting, type checking, coverage, or
unit tests across operating systems.

## Consequences

- Published runtime and maintainer release behavior gain automated Linux/macOS evidence.
- CI cost stays below a full operating-system matrix.
- Platform-specific failures are localized to narrow jobs.
- Windows users receive no compatibility guarantee and documentation must say so
  directly.
- Adding Windows later requires path, process, symlink, permission, and release-contract
  evidence before changing the support claim.
