# Forgix

<p align="center">
  <img
    src="./docs/assets/brand/svg/symbol-color.svg"
    alt="Forgix"
    width="128"
  />
</p>

> Turn a software objective into an approved, implemented, and verified change.

Forgix is a portable Codex plugin for evidence-backed software changes. It
combines product clarification, repository discovery, explicit approval, implementation,
and fresh verification without treating a plausible answer as completed work.

## Requirements

For plugin use:

- Codex with plugin support
- Node.js 24 or newer
- Git
- Linux or macOS. Windows is unsupported.

The distributed ESM runtime installs no dependencies and performs no network access by
itself. Bun is required only for repository development.

## Existing projects

Use `forgix` and `$forgix`; former commands have no aliases. Existing configurations,
profiles and task documents keep their paths. No data migration is required.
GitHub repository and website hosting URL are unchanged.

## Install

Add the marketplace and install the plugin:

```bash
codex plugin marketplace add Acrazie/codex-dev-flow
codex plugin add forgix@acrazie
```

Alternatively, open `/plugins`, select **Acrazie**, and install **Forgix**.
Start a new Codex session after installation or upgrade.

## Quick start

Open Codex in the project repository. First, create or reconcile its durable engineering
conventions:

```text
$forgix init
```

Project INIT inspects the repository before asking questions. It asks one material
question at a time, recommends an answer, and publishes nothing until explicit Profile
Approval.

Then run a real objective:

```text
$forgix Add rate limiting to the public authentication endpoints
```

Forgix carries the objective through product decisions, technical shaping, one plan
approval, implementation, and fresh assurance.

The optional Configuration wizard customizes plugin operation such as worktree,
subscription, quota, and integrations:

```bash
npx forgix init
```

The npm package and installed command are named `forgix`; the primary skill is `$forgix`.
Neither `dev-flow` nor `codex-dev-flow` is shipped as a CLI alias.
Existing installations of the old npm package are not automatically migrated.
Upgrade the Acrazie marketplace and install `forgix@acrazie` to use the renamed
plugin; existing `.codex/` project configuration and state remain unchanged.
Replace the old plugin installation rather than installing both plugin identities
side by side.

Project INIT and the Configuration wizard are separate interfaces; neither aliases the
other. See the [Getting Started guide](./plugins/forgix/docs/getting-started.md)
for a complete walkthrough.

## How Forgix works

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE ✓
```

- **INTAKE** resolves the product objective, observable success, constraints, and risk.
- **SHAPE** discovers repository facts, resolves technical uncertainty, and prepares a
  Quick or Plan implementation contract.
- **GATE** validates that exact contract and asks for one explicit approval.
- **BUILD** lets native Codex implement the complete approved plan. Forgix adds no
  execution skill, checkpoint, progress tracker, or validation loop.
- **ASSURE** reviews and verifies the change with fresh command-backed evidence.

Use Forgix when a change needs product or technical decisions, implementation, or
proof. Plain questions, read-only exploration, and Git/GitHub delivery do not need a Forgix task.

## Commands

| Interface                          | Purpose                                                       |
| ---------------------------------- | ------------------------------------------------------------- |
| `$forgix <objective>`              | Start a software change.                                      |
| `$forgix init`                     | Discover and approve durable project engineering conventions. |
| `$forgix resume <task-id>`         | Resume an interrupted task.                                   |
| `$forgix status [task-id]`         | Inspect task status.                                          |
| `$forgix --benchmark <objective>`  | Run a task with local benchmark measurement enabled.          |
| `$forgix config show [--explain]`  | Show effective configuration and optional provenance.         |
| `$forgix config validate [--json]` | Validate effective configuration.                             |
| `npx forgix init`                  | Run the optional Configuration wizard.                        |
| `npx forgix benchmark summary`     | Summarize allowlisted local benchmark data.                   |

`quick`, `standard`, and `critical` at objective start are plain objective text, not
modes or aliases. Quick or Plan is selected only after Discovery. Risk and policy—not
that preparation profile—control safety safeguards.

## Project INIT

Project INIT separates portable team conventions from private machine details:

```text
repository evidence + user decisions
                 |
                 v
       validation + Profile Approval
                 |
       +---------+----------+
       |                    |
       v                    v
shared engineering     local overlay
profile                and session state
```

| File                                    | Role                                                        | Git policy                      |
| --------------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| `.codex/dev-flow.project.yaml`          | Shared architecture, topology, stack, and conventions.      | Review and commit when desired. |
| `.codex/dev-flow.project.local.yaml`    | Absolute service paths and personal, non-contractual prefs. | Gitignored.                     |
| `.codex/project-init/state.yaml`        | Compact resumable INIT session.                             | Gitignored and temporary.       |
| `.codex/dev-flow/diagrams/*.mermaid.md` | Optional projection of approved profile architecture.       | Commit with shared profile.     |

Shared profiles reject secret-like values and absolute local paths. Project INIT creates
no product scaffold and no task state. Full schema, authority, reconciliation, and
atomic publication rules live in the
[Project Engineering Profile contract](./plugins/forgix/docs/project-profile-contract.md).

## Configuration

Configuration resolves from broad defaults to invocation-specific values:

```text
internal defaults
  < ~/.codex/dev-flow.yaml
  < .codex/dev-flow.yaml
  < .codex/dev-flow.local.yaml
  < invocation flags
```

Repository policy applies afterward and cannot be weakened by local configuration or
flags. Use the optional Configuration wizard for guided setup, or validate existing
configuration directly:

```text
$forgix config show --explain
$forgix config validate --json
```

## Safety guarantees

- Implementation never starts before explicit GATE approval.
- Success requires fresh verification evidence.
- Task state is durable and resumable.
- Local configuration cannot weaken repository policy.
- Commit, push, pull request, registry, and release operations are never authorized
  implicitly by Forgix approval.

Normative details live in the [Lifecycle contract](./plugins/forgix/docs/lifecycle-contract.md).

## Documentation

- [Getting Started](./plugins/forgix/docs/getting-started.md)
- [Lifecycle contract](./plugins/forgix/docs/lifecycle-contract.md)
- [Project Engineering Profile contract](./plugins/forgix/docs/project-profile-contract.md)
- [Design](./plugins/forgix/docs/design.md)
- [Artifact contract](./plugins/forgix/docs/artifacts.md)
- [Measurement protocol](./plugins/forgix/docs/metrics-protocol.md)
- [Maintainer release runbook](./plugins/forgix/docs/runbooks/maintainer-release.md)
- [ADR directory](./plugins/forgix/docs/adr/)
- [Glossary](./plugins/forgix/docs/glossary/forgix.md)

## Development and quality

Contributors need the Bun version pinned in `package.json` in addition to user runtime
requirements:

```bash
git clone https://github.com/Acrazie/codex-dev-flow.git
cd codex-dev-flow
bun install --frozen-lockfile
bun run check
```

The full gate runs formatting, native and type-aware linting, tool typechecking, tests,
plugin typechecking/build, randomized test-order verification, coverage, and deterministic
artifact size checks. The lightweight Lefthook pre-commit hook runs the staged-file Bun
adapter; CI remains authoritative.

See [Contributing](./CONTRIBUTING.md) for repository structure, focused commands, design
constraints, and release workflow.
