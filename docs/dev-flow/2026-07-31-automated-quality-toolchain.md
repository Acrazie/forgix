# Automated quality toolchain

## Status

Proposed implementation plan. Product and architecture decisions are accepted in ADRs
0011 through 0023.

## Objective

Create a fast, reliable, lightweight repository-wide quality system using Oxfmt,
Oxlint, Bun, Husky, TypeScript, and a narrow Node.js 24 compatibility suite, without
adding runtime dependencies to the published plugin.

## Decision authority

- [ADR 0011](../../plugins/codex-dev-flow/docs/adr/0011-separate-fast-local-and-authoritative-ci-quality-gates.md): Fast and Full Gates.
- [ADR 0012](../../plugins/codex-dev-flow/docs/adr/0012-use-bun-test-and-require-node-24.md): Bun test and Node.js 24.
- [ADR 0013](../../plugins/codex-dev-flow/docs/adr/0013-layer-source-distribution-and-runtime-tests.md): three test layers.
- [ADR 0014](../../plugins/codex-dev-flow/docs/adr/0014-ratchet-source-coverage-with-bun.md): source coverage ratchet.
- [ADR 0015](../../plugins/codex-dev-flow/docs/adr/0015-split-fast-and-type-aware-linting.md): native and type-aware lint profiles.
- [ADR 0016](../../plugins/codex-dev-flow/docs/adr/0016-use-husky-with-a-tested-bun-staged-file-adapter.md): lightweight pre-commit adapter.
- [ADR 0017](../../plugins/codex-dev-flow/docs/adr/0017-format-conservatively-with-oxfmt.md): conservative formatting.
- [ADR 0018](../../plugins/codex-dev-flow/docs/adr/0018-use-a-high-signal-oxlint-policy.md): high-signal linting.
- [ADR 0019](../../plugins/codex-dev-flow/docs/adr/0019-gate-deterministic-size-and-observe-timing.md): size budgets and timing observations.
- [ADR 0020](../../plugins/codex-dev-flow/docs/adr/0020-support-linux-and-macos-with-targeted-ci.md): platform evidence.
- [ADR 0021](../../plugins/codex-dev-flow/docs/adr/0021-randomize-tests-without-retries.md): flaky-test policy.
- [ADR 0022](../../plugins/codex-dev-flow/docs/adr/0022-use-one-root-bun-workspace.md): workspace ownership.
- [ADR 0023](../../plugins/codex-dev-flow/docs/adr/0023-deliver-quality-toolchain-in-three-pull-requests.md): delivery sequence.

## Current evidence

- Root `package.json` is private but has no workspace declaration, lockfile, or quality
  dependencies.
- Plugin `package.json` and `bun.lock` own the current independent installation.
- CI installs inside `plugins/codex-dev-flow` and runs Node.js 22 and 24 on Ubuntu.
- Current check is `tsc -> build -> 106 node:test cases -> 15 bun:test cases` and took
  about 1.54 seconds on the discovery machine.
- Twenty-six of twenty-seven JavaScript test files import `dist/dev-flow.mjs`; only the
  release test imports TypeScript source directly.
- Generated bundle size was 805,435 bytes during discovery.
- No formatter, linter, coverage threshold, pre-commit hook, or size gate exists.

## Invariants

1. Published runtime remains Node.js; Bun remains development package manager and main
   test runtime.
2. No formatter, linter, hook, test, or coverage package enters published runtime files.
3. Fast Gate is check-only, staged-only, non-authoritative, and targets sub-two-second
   feedback.
4. Full Gate is repository-wide and authoritative.
5. CI always exercises the packed distribution with Node.js 24 on Linux and macOS.
6. Windows remains unsupported until separately designed and proven.
7. Formatting never owns import or package-manifest ordering.
8. Coverage and artifact-size baselines cannot be reset silently.
9. Automatic test retries never convert an observed failure into a successful gate.
10. Every pull request in the migration is independently green and reversible.

## Pull request 1: Toolchain foundation

### Scope

1. Convert root `package.json` into workspace owner for `plugins/*`.
2. Move lock ownership to root `bun.lock`; verify resolved versions before removing
   `plugins/codex-dev-flow/bun.lock`.
3. Add exact root development dependencies for Husky, Oxfmt, Oxlint, and
   `oxlint-tsgolint`.
4. Add root repository scripts for format write/check, native lint, type-aware lint,
   Fast Gate, and orchestration.
5. Add root `.oxfmtrc.json` with ADR 0017 values and explicit ignore patterns.
6. Add one root Oxlint configuration implementing ADR 0018. Native Fast Gate disables
   type-aware analysis; Full profile enables it without enabling experimental type
   checking.
7. Implement the staged-file adapter as dependency-injected TypeScript so Git output,
   classification, batching, and child status can be unit tested without modifying the
   real index.
8. Add root Husky installation and a pre-commit hook containing only the Fast Gate
   script call.
9. Adjust existing CI only as required to install the new root workspace and preserve
   the current green validation contract.
10. Fix high-signal lint violations without mixing unrelated refactors.
11. Apply repository-wide formatting in its own commit after formatter config and
    ignore behavior are tested.

### Verification

- Fresh root `bun install --frozen-lockfile` succeeds.
- A second frozen install produces no lockfile diff.
- Formatter check passes over the repository and excludes generated/lock content.
- Native and type-aware lint profiles pass; type-aware lint does not replace `tsc`.
- Staged adapter tests cover empty input, ACMR filtering, deletion exclusion, spaces,
  newline-containing names, renames, batching, spawn failure, and nonzero child status.
- A temporary staged formatting or lint defect blocks the hook without changing file or
  index bytes.
- Existing build, tests, release tests, and distribution checks remain green.

### Exit condition

Repository has one reproducible install, one formatting contract, one lint contract,
and a safe Fast Gate. Test architecture remains otherwise unchanged.

## Pull request 2: Bun test architecture

### Scope

1. Replace `node:test` imports and assertions with native `bun:test` APIs; use TypeScript
   test files.
2. Classify each existing case by its proof boundary instead of mechanically preserving
   bundle imports.
3. Move deterministic module contracts into the Unit Test Layer with direct
   `src/*.ts` imports.
4. Keep bundle exports, composed workflows, schemas, packaging preparation, and other
   material composition behavior in the Integration Test Layer.
5. Preserve fixtures and helpers behind explicit layer-neutral test utilities where
   sharing is justified.
6. Run CI tests with randomized order, logged seed, and no retries.
7. Configure Bun source coverage for maintained `src/**/*.ts`, excluding tests,
   fixtures, generated output, and distribution content.
8. Capture line, function, and statement baselines after classification; commit initial
   thresholds with decimal-noise tolerance only.
9. Add a periodic repeated-execution job only if existing cases demonstrate a
   low-probability concurrency, process, or filesystem risk worth its cost.

### Verification

- All existing behavioral contracts have an explicit retained, rewritten, or removed
  disposition.
- Unit tests pass without a pre-existing `dist/dev-flow.mjs`.
- Integration tests fail clearly when their required build artifact is absent or stale.
- Two recorded randomized seeds pass and a forced order-dependent fixture proves seed
  reproduction in the test infrastructure.
- Coverage includes maintained source rather than the generated bundle.
- Dropping coverage below any committed threshold fails the Full Gate.
- Typecheck, build, release behavior, and distribution checks remain green.

### Exit condition

One Bun runner owns all non-runtime-smoke tests; source coverage is meaningful and
ratcheted; bundle-specific tests remain only where bundle composition matters.

## Pull request 3: Runtime CI and measurable budgets

### Scope

1. Set plugin engine requirement and build target to Node.js 24; remove Node.js 22 from
   configuration, CI, documentation, fixtures, and generated metadata.
2. Add a narrow Runtime Smoke Suite that uses Node.js 24 to import the built bundle,
   execute CLI help/config validation, resolve the installed binary symlink, and run
   from the packed npm artifact.
3. Run complete Full Gate on Ubuntu.
4. Run Runtime Smoke on Ubuntu and macOS.
5. Run maintainer-release integration tests on macOS without duplicating unrelated
   unit, format, lint, typecheck, or coverage work.
6. Document Linux/macOS support and explicit Windows non-support.
7. Produce a reproducible npm pack manifest, then record bundle, packed, and unpacked
   size baselines plus explicit headroom in a versioned budget file.
8. Add a deterministic size checker that explains which budget failed and observed
   versus allowed bytes.
9. Record Fast Gate, Full Gate, and cold CLI-start timings in CI summaries without
   making timing blocking.
10. Make one stable Full Gate check required for merge outside the repository after the
    workflow name is final.

### Verification

- Ubuntu Full Gate passes from a clean checkout with one frozen root install.
- Node.js 24 Runtime Smoke passes on Ubuntu and macOS using the same packed artifact.
- macOS release tests exercise the supported maintainer path.
- Any Node.js 22 compatibility claim is absent from active package and user docs.
- Artificial one-byte-over-budget fixtures fail each deterministic size check.
- Repacking unchanged input produces identical measured sizes.
- Timing collection cannot change gate status.
- `npm pack --dry-run` or equivalent manifest inspection excludes tests, coverage,
  Husky, quality configs, and root-only tooling from the published package.

### Exit condition

Final Full Gate proves repository quality, source coverage, artifact budgets, packed
distribution behavior, and supported Node.js 24 execution on Linux and macOS.

## Not included

- Windows compatibility.
- Oxlint experimental type checking as a `tsc` replacement.
- Import sorting, package JSON sorting, or style/pedantic/nursery lint categories.
- Hosted coverage services.
- Mutation-testing frameworks.
- Automatic formatter writes during pre-commit.
- Retry-until-green test behavior.
- Blocking wall-clock thresholds before stable CI evidence exists.

## Completion evidence

The migration is complete only when all three pull requests satisfy their exit
conditions, documentation matches the effective scripts and CI, and no temporary dual
runner, nested lockfile, Node.js 22 matrix, or unenforced baseline remains.
