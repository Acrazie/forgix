# Contributing to Forgix

Thanks for helping improve Forgix. This guide covers repository development; user installation and usage belong in the [README](./README.md).

## Prerequisites

- Node.js 26.8.1 (`>=26.0.0`) for repository development and published CLI runtime, matching `.node-version`.
- Bun 1.4.4, matching `.bun-version` and `package.json`.
- Git.
- `fluidise-clint` 0.1.0 on `PATH` for commit-message validation. Install it through
  the [official CLINT distribution instructions](https://github.com/Fluidise/clint#installation).
  Repository setup does not download or replace global binaries.
- Linux or macOS. Windows is not supported.

## Set up the project

```bash
git clone entire://aws-eu-central-1.entire.io/et/forgix/forgix
cd forgix
./scripts/setup.sh
bun run check
```

For parallel work on features or fixes, use Git Worktrees:

```bash
./scripts/worktree.sh add feat/<branch-name>
```

To test the terminal wizard from a source checkout, link the package during local development only:

```bash
bun link
cd /path/to/project
forgix init
```

End users should run `npx @acrasie/forgix init`; `npm link` is not part of the published installation flow.

The setup script configures project-owned hooks (`pre-commit`, `commit-msg`, and `pre-push`).
Standard clones use the Vite+ dispatcher; linked worktrees configure only their
own Git hook scope and require an explicitly enabled `extensions.worktreeConfig`.
Existing foreign hooks are preserved; setup never edits agent instructions. See [docs/git-workflow.md](./docs/git-workflow.md) for full branch, worktree, and Conventional Commit guidelines. `bun run check` verifies
formatting, runs native and type-aware linting, checks tool scripts, builds the bundled
ESM distribution, and executes the default tooling and plugin unit/integration suites.

### Codebase analysis

Fallow is pinned in the development lockfile and enforced as blocking `Quality Ratchet`s in `bun run check` (`check:architecture`, `check:dead-code:gate`, `check:dupes`, `check:health`, and `check:golden-rules`) plus `bun run check:diff` in `.vite-hooks/pre-push` and PR CI. See [docs/golden-rules.md](./docs/golden-rules.md) and [ADR 0038](./docs/adr/0038-enforce-ai-first-golden-rules-with-fallow-quality-ratchets.md) for zone rules, baselines under `fallow-baselines/`, and ratchet invariants. To inspect advisory reports separately:

```bash
bun run --silent check:dead-code
bun run report:complexity
bun run report:duplication
```

`check:dead-code` stays advisory so Buildkite can publish `.fallow/dead-code.json` outside the release artifacts, while `check:dead-code:gate` blocks new dead code beyond `fallow-baselines/dead-code.json`. Append `--production` to `check:dead-code` to compare reachability without tests or support entry points.

## Repository layout

```text
.agents/plugins/marketplace.json       Codex marketplace catalog
.claude-plugin/marketplace.json        Claude Code marketplace catalog
.buildkite/                            Repository CI and release pipeline
.vite-hooks/                          Project-owned pre-commit, commit-msg, and pre-push scripts
fluidise.toml                         Explicit CLINT commit policy
vite.config.ts                        Shared Vite+ quality and packaging configuration
scripts/                              Repository quality & workflow tooling
test/                                 Repository tooling tests

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

1. Read [docs/golden-rules.md](./docs/golden-rules.md) along with the relevant design document, schema, source, and tests.
2. Check active module boundaries with `fallow guard <files>` before editing unfamiliar modules.
3. Add or update focused tests when behavior changes, and include a regression test for every `fix:`.
4. Keep implementation modular, lightweight, and scoped to one concern.
5. Update user documentation when public behavior changes.
6. Run the complete verification command.

```bash
bun run check
```

For configuration work, also validate the built CLI:

```bash
node dist/forgix.mjs config validate --json
```

## Design constraints

- Preserve `merge: never` as a non-bypassable invariant.
- Never claim success without command-backed evidence.
- Never let local configuration or invocation flags weaken repository policy.
- Keep critical changes isolated in a worktree.
- Keep delegated review and analysis stages read-only.
- Do not persist credentials or raw `codex app-server` protocol payloads.
- Keep state transitions resumable and schema-valid.

Architecture changes should update [the design document](./docs/design.md). Durable trade-offs should receive an ADR under `docs/adr/`. Repository-wide engineering invariants and quality ratchets are defined in [the Golden Rules](./docs/golden-rules.md) and [ADR 0038](./docs/adr/0038-enforce-ai-first-golden-rules-with-fallow-quality-ratchets.md).

Public documentation follows
[ADR 0028](./docs/adr/0028-make-public-documentation-user-first-and-current.md):
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
bun run typecheck
bun run test
bun run test:coverage
bun run test:randomization
bun run check:size
bun run test:runtime
bun run release:test
bun run check
```

For hook or commit-policy changes, also run `bun run test:hooks`. This native
integration suite requires CLINT 0.1.0 on `PATH`; it is not part of the default CI
gate and does not install binaries. It tests the real Vite+ dispatcher in temporary
repositories and the explicit policy differences documented in
[the Git workflow](./docs/git-workflow.md).

Quality and packaging configuration lives in root `vite.config.ts`. Vite+ 1.6.0
provides Oxfmt, Oxlint, and tsdown/Rolldown through one pinned dependency. The
plugin build uses its public `vite-plus/pack` API, retaining an in-memory rebuild
for distribution tests. Bun remains the package manager and test runner.

The pre-commit hook runs `bun run check:staged`. Its small Bun adapter passes only staged,
supported files to Vite+ `vp fmt --check` and native `vp lint`. It never formats files or
mutates the index; the complete root check remains the authoritative gate.

Artifact budgets block deterministic bundle, packed package, or unpacked package growth
beyond recorded headroom. Fast Gate, Full Gate, and cold CLI-start timings are reported
for observation only; timing noise never changes a command's exit status.

## Releases

From repository root:

```bash
bun run release
```

The command prepares npm, multi-harness plugins, or combined releases on a clean work
branch. Preview restores prepared files. Retained preparation is reviewed and merged
through an Entire Trail; the command never commits, pushes, tags, publishes, or installs a plugin.
Install the pinned git-cliff 2.14.1 before preparation. Buildkite publishes only after
an authorized maintainer pushes the exact validated release tag. npm publication uses
`NPM_TOKEN` configured in Buildkite. Linux and macOS release
preparation are supported; Windows is unsupported.

Follow the [maintainer release runbook](docs/runbooks/maintainer-release.md)
for one-time npm/tag-protection setup, supported tag identities, exact-source CI and
partial-release recovery. Settings changes and publication require separate authorization.

## Entire Trails

Keep Trails focused and include:

- Problem and intended behavior.
- Important design or policy decisions.
- Verification commands and results.
- Known limitations or deferred work.
- Documentation changes for user-visible behavior.

Do not include generated dependencies, credentials, local task state, or `.forgix/config.local.yaml`.
