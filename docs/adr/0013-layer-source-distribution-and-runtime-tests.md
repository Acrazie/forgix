# ADR 0013: Layer Source, Distribution, and Runtime Tests

## Status

Accepted (Amended: the minimum runtime smoke target was raised from Node.js 24 to Node.js `>=26.0.0` per root `docs/adr/0035-require-node-26-and-extract-website.md`).

## Context

Twenty-six of the repository's twenty-seven JavaScript test files import the generated
`dist/dev-flow.mjs` bundle. This gives broad distribution fidelity but couples nearly
every failure to the build artifact, makes failures less local, and prevents useful
source-oriented coverage.

Testing only source modules would be faster but could miss bundling, packaging, binary,
and Node.js compatibility regressions.

## Decision

Partition automated tests into three explicit layers:

1. **Unit Test Layer:** `bun:test` files import `src/*.ts` directly and validate isolated
   deterministic behavior, boundary conditions, and failure contracts.
2. **Integration Test Layer:** `bun:test` files exercise the built bundle and complete
   workflows where module composition or generated artifacts are material.
3. **Runtime Smoke Suite:** a narrow Node.js 24 suite exercises the packed distribution
   boundary as defined by ADR 0012.

Move tests to the lowest layer that can prove their contract. Do not repeat the same
behavior across layers merely to increase counts or coverage.

No additional test framework, transpiler, or coverage service is introduced. Bun owns
TypeScript test execution and the main test API.

## Consequences

- Most deterministic logic can run without rebuilding the distribution.
- Failures identify source behavior or distribution composition more precisely.
- Source coverage becomes meaningful.
- Integration tests retain evidence for bundle exports and workflow composition.
- Test naming and scripts must make layer ownership visible.
- Refactoring the current suite requires classifying existing cases rather than
  mechanically changing imports.
