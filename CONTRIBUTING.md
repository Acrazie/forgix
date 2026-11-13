# Contributing to Forgix

Thanks for helping improve Forgix. This guide covers repository development; user installation and usage belong in the [README](./README.md).

## Prerequisites

- Node.js 24 or newer.
- Bun 1.4.4, matching `.bun-version` and `package.json`.
- Git.
- GitHub CLI (`gh`) for releases.
- Linux or macOS. Windows is not supported.

## Set up the project

```bash
git clone https://github.com/Acrazie/codex-dev-flow.git
cd codex-dev-flow
./scripts/setup.sh
bun run check
```

For parallel work on features or fixes, use Git Worktrees:

```bash
./scripts/worktree.sh add feat/<branch-name>
```

To test the terminal wizard from a source checkout, link the package during local development only:

```bash
cd plugins/forgix
bun link
cd /path/to/project
forgix init
```

End users should run `npx @acrasie/forgix init`; `npm link` is not part of the published installation flow.

The setup script activates Lefthook git hooks (`pre-commit` and `commit-msg`). See [docs/git-workflow.md](./docs/git-workflow.md) for full branch, worktree, and Conventional Commit guidelines. `bun run check` verifies
formatting, runs native and type-aware linting, checks tool scripts, builds the bundled
ESM distribution, and executes every current test suite.

## Repository layout

```text
.agents/plugins/marketplace.json       Codex marketplace catalog
.claude-plugin/marketplace.json        Claude Code marketplace catalog
.github/workflows/                    Repository CI and release workflows
lefthook.yml                          Git hooks (pre-commit & commit-msg)
scripts/                              Repository quality & workflow tooling
test/                                 Repository tooling tests
plugins/forgix/
  .claude-plugin/plugin.json           Claude Code plugin manifest
  .codex-plugin/plugin.json            Codex plugin manifest
  plugin.json                          Antigravity plugin manifest
  skills/                              Workflow reasoning and stage guidance
  src/                                 Deterministic runtime behavior
  schemas/                             Configuration, policy, and state schemas
  test/                                Bun unit, integration, support, and fixtures
  docs/                                User guide, contracts, ADRs, glossary, and runbooks
```

Skills own discovery, planning, execution guidance, debugging, review, and verification. TypeScript owns deterministic parsing, configuration resolution, policy enforcement, routing, state transitions, fingerprints, and artifact handling.

Keep Forgix (`$forgix` / `/forgix:forgix` / `/forgix`) as the only public workflow. Internal stage skills carry `user-invocable: false` and are implementation details, not separate user-facing commands.

## Make a change

1. Read the relevant design document, schema, source, and tests.
2. Add or update focused tests when behavior changes.
3. Keep implementation scoped to one concern.
4. Update user documentation when public behavior changes.
5. Run the complete verification command.

```bash
bun run check
```

For configuration work, also validate the built CLI:

```bash
node plugins/forgix/dist/forgix.mjs config validate --json
```

## Design constraints

- Preserve `merge: never` as a non-bypassable invariant.
- Never claim success without command-backed evidence.
- Never let local configuration or invocation flags weaken repository policy.
- Keep critical changes isolated in a worktree.
- Keep delegated review and analysis stages read-only.
- Do not persist credentials or raw `codex app-server` protocol payloads.
- Keep state transitions resumable and schema-valid.

Architecture changes should update [the design document](./plugins/forgix/docs/design.md). Durable trade-offs should receive an ADR under `plugins/forgix/docs/adr/`.

Public documentation follows
[ADR 0028](./plugins/forgix/docs/adr/0028-make-public-documentation-user-first-and-current.md):
README files teach current user behavior, the Getting Started guide owns the practical
walkthrough, contracts own normative details, and clearly labeled target documents own
unimplemented design. Keep the root and packaged README user journeys aligned.

## Tests

Plugin and repository tooling tests use `bun:test`. Plugin tests are split between
source-oriented unit tests and integration tests for composition, filesystem, process,
bundle, and package boundaries.

Prefer tests that assert public behavior or stable invariants. Avoid coupling tests to incidental implementation details.

Useful commands:

```bash
bun run format
bun run format:check
bun run lint
bun run lint:type-aware
bun run typecheck:tools
bun run test:tools
bun run build
bun run --cwd plugins/forgix typecheck
bun run --cwd plugins/forgix test
bun run --cwd plugins/forgix test:coverage
bun run --cwd plugins/forgix test:randomization
bun run --cwd plugins/forgix check:size
bun run --cwd plugins/forgix test:runtime
bun run --cwd plugins/forgix release:test
bun run check
```

The pre-commit hook runs `bun run check:staged`. Its small Bun adapter passes only staged,
supported files to Oxfmt in check-only mode and native Oxlint. It never formats files or
mutates the index; the complete root check remains the authoritative gate.

Artifact budgets block deterministic bundle, packed package, or unpacked package growth
beyond recorded headroom. Fast Gate, Full Gate, and cold CLI-start timings are reported
for observation only; timing noise never changes a command's exit status.

## Releases

From repository root:

```bash
bun run release
```

Interactive flow selects multi-harness plugins (`plugin`), `npm`, or combined (`both`) release; previews without durable
changes; checks GitHub/npm authentication; validates synchronized manifests; and asks before publishing.
It requires clean, synchronized `main`. Missing auth prints corrective command. Partial
publication is detected on next run and can resume without creating another version.
Release automation is supported on Linux and macOS. Windows is unsupported.

## Pull requests

Keep pull requests focused and include:

- Problem and intended behavior.
- Important design or policy decisions.
- Verification commands and results.
- Known limitations or deferred work.
- Documentation changes for user-visible behavior.

Do not include generated dependencies, credentials, local task state, or `.codex/dev-flow.local.yaml`.
