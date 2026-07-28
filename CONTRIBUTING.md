# Contributing to Codex Dev Flow

Thanks for helping improve Codex Dev Flow. This guide covers repository development; user installation and usage belong in the [README](./README.md).

## Prerequisites

- Node.js 22.18 or newer.
- Bun 1.3 or newer.
- Git.
- GitHub CLI (`gh`) for releases.

## Set up the project

```bash
git clone https://github.com/Acrazie/codex-dev-flow.git
cd codex-dev-flow/plugins/codex-dev-flow
bun install --frozen-lockfile
bun run check
```

To test the terminal wizard from a source checkout, link the package during local development only:

```bash
cd plugins/codex-dev-flow
bun link
cd /path/to/project
codex-dev-flow init
```

End users should run `npx codex-dev-flow init`; `npm link` is not part of the published installation flow.

`bun run check` runs TypeScript checks, creates the bundled ESM distribution, and executes the test suite.

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
bun run check
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

Runtime tests use Node.js's built-in test runner. Release orchestration tests use Bun.

Prefer tests that assert public behavior or stable invariants. Avoid coupling tests to incidental implementation details.

Useful commands:

```bash
bun run typecheck
bun run build
bun run test
bun run release:test
bun run check
```

## Releases

From repository root:

```bash
bun run release
```

Interactive flow selects plugin, npm, or combined release; previews without durable
changes; checks GitHub/npm authentication; validates release; and asks before publishing.
It requires clean, synchronized `main`. Missing auth prints corrective command. Partial
publication is detected on next run and can resume without creating another version.
Release automation is supported on macOS, expected to work on Linux, and not guaranteed
on Windows.

## Pull requests

Keep pull requests focused and include:

- Problem and intended behavior.
- Important design or policy decisions.
- Verification commands and results.
- Known limitations or deferred work.
- Documentation changes for user-visible behavior.

Do not include generated dependencies, credentials, local task state, or `.codex/dev-flow.local.yaml`.
