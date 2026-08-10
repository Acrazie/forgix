# Test Architecture

`bun:test` owns the automated suite. Tests run in randomized order, print their seed,
and never retry failures.

## Layers

- `unit/`: deterministic contracts imported directly from `src/*.ts`.
- `integration/`: filesystem, process, schema, workflow-composition, bundle, and package
  boundaries.
- `support/`: layer-neutral behavioral fixtures and assertion helpers.
- `fixtures/`: subprocess and infrastructure fixtures excluded from normal discovery.

The distribution bundle is imported only where bundle composition or package behavior
is material. Unit tests do not require `dist/dev-flow.mjs`.

## Migration disposition

All 121 existing cases were retained and rewritten from `node:test` plus
`node:assert/strict` to native `bun:test` APIs. No case was removed.

| Layer       | Rewritten files                                                                                                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `bridge`, `config`, `discovery`, `fingerprint`, `intake`, `metrics`, `parse`, `project-profile`, `resume-context`, `routing`, `shape-dependencies`, `shape-freshness`, `shape-planning`, `shape-projection`, `shape`, `state`, `worktree`      |
| Integration | `app-server`, `benchmark`, `cli-routing`, `config-loading`, `distribution`, `documentation`, `exit-codes`, `init`, `lifecycle-paths`, `project-profile-cli`, `project-profile-store`, `release`, `schema`, `state-store`, `workflow-artifacts` |

Former JavaScript behavioral fixtures retain `@ts-nocheck` because several cases
intentionally construct invalid or partial runtime values. The pre-existing TypeScript
release suite and maintained source remain strictly typechecked.

## Randomization

`bunfig.toml` enables random order with zero retries. Reproduce a failure with the seed
printed by Bun:

```bash
bun test --seed <seed> test/unit test/integration
```

`bun run test:randomization` verifies recorded seeds `1` and `3` against an excluded,
deliberately order-dependent fixture. Seed `1` passes; seed `3` reproduces its failure.
The complete suite also passes with recorded seeds `20260731` and `31072026`.

## Coverage

`bun run test:coverage` measures maintained source and enforces per-file floors of 72%
lines and 75% functions. The migration baseline is recorded in
`coverage-baseline.json`; aggregate observation was 93.86% lines and 92.17% functions.

Bun 1.3.14 does not expose statement coverage in text or LCOV output and does not enforce
its documented statement threshold key. The baseline records that metric as unavailable
instead of presenting line coverage as statement coverage.
