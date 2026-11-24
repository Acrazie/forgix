# Test Architecture

`bun:test` owns the automated suite. Tests run in randomized order, print their seed,
and never retry failures.

## Layers

- `unit/`: deterministic contracts imported directly from `src/core/*.ts`, `src/task/index.ts`,
  `src/profile/index.ts`, `src/roadmap/index.ts`, `src/cli.ts`, and `scripts/*.ts`.
- `integration/`: filesystem, process, schema, workflow-composition, bundle, and package
  boundaries.
- `support/`: layer-neutral behavioral fixtures and assertion helpers (`expect-error.ts`,
  `helpers-v6.ts`, `project-profile.ts`).
- `fixtures/`: subprocess and infrastructure fixtures excluded from normal discovery.
- `runtime/`: packed tarball verification executed under Node 24 (`npm run test:runtime` /
  `bun run test:runtime`).

The distribution bundle (`dist/forgix.mjs`) is imported only where bundle composition or package
behavior is material. Unit tests do not require `dist/forgix.mjs`.

## Suite inventory

| Layer       | Files                                                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit        | `artifact-budget`, `config`, `digest`, `parse`, `project-profile`, `roadmap`, `routing`, `schema`, `store`, `task`, `test-order`                                                                                                                 |
| Integration | `app-server`, `cli-routing`, `config-loading`, `distribution`, `documentation`, `exit-codes`, `init`, `lifecycle-paths`, `project-profile-cli`, `project-profile-store`, `release`, `roadmap-cli`, `schema`, `state-store`, `workflow-artifacts` |
| Runtime     | `runtime-smoke.test.mjs`                                                                                                                                                                                                                         |

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
lines and 75% functions. The observed aggregate baseline is recorded in
`coverage-baseline.json`.
