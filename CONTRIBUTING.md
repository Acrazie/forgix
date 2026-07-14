# Contributing to Codex Dev Flow

Thanks for helping improve Codex Dev Flow. This guide covers repository development; user installation and usage belong in the [README](./README.md).

## Prerequisites

- Node.js 22.18 or newer.
- npm.
- Git.

## Set up the project

```bash
git clone https://github.com/Acrazie/codex-dev-flow.git
cd codex-dev-flow/plugins/codex-dev-flow
npm ci
npm run check
```

`npm run check` runs TypeScript checks, creates the bundled ESM distribution, and executes the test suite.

## Repository layout

```text
.agents/plugins/marketplace.json       Local marketplace catalog
plugins/codex-dev-flow/
  .codex-plugin/plugin.json            Plugin manifest
  skills/                              Workflow reasoning and stage guidance
  src/                                 Deterministic runtime behavior
  schemas/                             Configuration, policy, and state schemas
  test/                                Node.js test suite
  docs/                                Design, ADRs, glossary, and plans
```

Skills own discovery, planning, execution guidance, debugging, review, and verification. TypeScript owns deterministic parsing, configuration resolution, policy enforcement, routing, state transitions, fingerprints, and artifact handling.

Keep `$dev-flow` as the only public workflow. Internal stage skills are implementation details, not separate user-facing commands.

## Make a change

1. Read the relevant design document, schema, source, and tests.
2. Add or update focused tests when behavior changes.
3. Keep implementation scoped to one concern.
4. Update user documentation when public behavior changes.
5. Run the complete verification command.

```bash
cd plugins/codex-dev-flow
npm run check
```

For configuration work, also validate the built CLI:

```bash
node dist/dev-flow.mjs config validate --json
```

## Design constraints

- Preserve `merge: never` as a non-bypassable invariant.
- Never claim success without command-backed evidence.
- Never let local configuration or invocation flags weaken repository policy.
- Keep critical changes isolated in a worktree.
- Keep delegated review and analysis stages read-only.
- Do not persist credentials or raw `codex app-server` protocol payloads.
- Keep state transitions resumable and schema-valid.

Architecture changes should update [the design document](./plugins/codex-dev-flow/docs/design.md). Durable trade-offs should receive an ADR under `plugins/codex-dev-flow/docs/adr/`.

## Tests

Tests use Node.js's built-in test runner. Name new files `test/*.test.mjs` so the project test script discovers them.

Prefer tests that assert public behavior or stable invariants. Avoid coupling tests to incidental implementation details.

Useful commands:

```bash
npm run typecheck
npm run build
npm test
npm run check
```

## Pull requests

Keep pull requests focused and include:

- Problem and intended behavior.
- Important design or policy decisions.
- Verification commands and results.
- Known limitations or deferred work.
- Documentation changes for user-visible behavior.

Do not include generated dependencies, credentials, local task state, or `.codex/dev-flow.local.yaml`.
