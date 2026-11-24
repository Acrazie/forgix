# ADR 0012: Use Bun Test and Require Node 24

## Status

Accepted (Amended: the minimum runtime floor was raised from Node.js 24 to Node.js `>=26.0.0` per root `docs/adr/0035-require-node-26-and-extract-website.md`; historical references to Node.js 24 below reflect the original baseline).

## Context

The test suite currently mixes `node:test` for most tests with `bun:test` for release
tests. Maintaining two runner APIs and two test commands adds complexity. The published
CLI executes on Node.js, while Bun already serves as the repository package manager and
script runner.

Node.js 22 remains in Maintenance LTS until April 30, 2027, but retaining it expands the
CI matrix and constrains use of newer runtime facilities. Node.js 24 has a longer support
horizon and is sufficient for the plugin's intended users.

## Decision

Use `bun:test` as the sole automated test-suite runner and migrate existing `node:test`
tests to its native API.

Raise the published runtime floor from Node.js `>=22.18.0` to Node.js `>=24.0.0`. Remove
Node.js 22 from the CI matrix and repository compatibility contract.

The Full Gate supplements Bun test execution with a narrow Node.js 24 Runtime Smoke
Suite. After building and packaging, that suite uses the real Node binary to import the
bundle, execute the CLI, validate configuration, and execute the package-manager binary
symlink. It tests the published runtime boundary without duplicating the complete Bun
test suite.

## Consequences

- Test files may use Bun's native TypeScript, mocks, snapshots, watch mode, randomized
  ordering, and coverage without another test framework.
- The Full Gate needs one test command instead of separate Node and Bun suites.
- Users on Node.js 22 must upgrade even though that release remains maintained upstream.
- Bun test execution cannot, by itself, prove compatibility with the Node.js runtime;
  the narrow Runtime Smoke Suite supplies that evidence at the distribution boundary.
- The smoke suite must remain small and contract-focused. General behavior belongs in
  the Bun test suite and is not duplicated under Node.js.
