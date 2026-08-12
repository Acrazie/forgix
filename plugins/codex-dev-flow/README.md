# Codex Dev Flow

> Turn a software objective into an approved, implemented, and verified change.

Codex Dev Flow is a portable Codex plugin for evidence-backed software changes. It
combines product clarification, repository discovery, explicit approval, implementation,
and fresh verification without treating a plausible answer as completed work.

## Requirements

For plugin use:

- Codex with plugin support;
- Node.js 24 or newer;
- Git; and
- Linux or macOS. Windows is unsupported.

The distributed ESM runtime installs no dependencies and performs no network access by
itself. Bun is required only for repository development.

## Install

Add the marketplace and install the plugin:

```bash
codex plugin marketplace add Acrazie/codex-dev-flow
codex plugin add codex-dev-flow@acrazie
```

Alternatively, open `/plugins`, select **Acrazie**, and install **Codex Dev Flow**.
Start a new Codex session after installation or upgrade.

## Quick start

Open Codex in the project repository. First, create or reconcile its durable engineering
conventions:

```text
$dev-flow init
```

Project INIT inspects the repository before asking questions. It asks one material
question at a time, recommends an answer, and publishes nothing until explicit Profile
Approval.

Then run a real objective:

```text
$dev-flow Add rate limiting to the public authentication endpoints
```

Dev Flow carries the objective through product decisions, technical shaping, one plan
approval, implementation, and fresh assurance.

The optional Configuration wizard customizes plugin operation such as worktree,
subscription, quota, and integrations:

```bash
npx codex-dev-flow init
```

Project INIT and the Configuration wizard are separate interfaces; neither aliases the
other. See the [Getting Started guide](docs/getting-started.md) for a complete
walkthrough.

## How Dev Flow works

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE -> finished
```

- **INTAKE** resolves the product objective, observable success, constraints, and risk.
- **SHAPE** discovers repository facts, resolves technical uncertainty, and prepares a
  Quick or Plan implementation contract.
- **GATE** validates that exact contract and asks for one explicit approval.
- **BUILD** lets native Codex implement the complete approved plan. Dev Flow adds no
  execution skill, checkpoint, progress tracker, or validation loop.
- **ASSURE** reviews and verifies the change with fresh command-backed evidence.

Use Dev Flow when a change needs product or technical decisions, implementation, or
proof. Plain questions, read-only exploration, and Git/GitHub delivery do not need a Dev
Flow task.

## Commands

| Interface                              | Purpose                                                       |
| -------------------------------------- | ------------------------------------------------------------- |
| `$dev-flow <objective>`                | Start a software change.                                      |
| `$dev-flow init`                       | Discover and approve durable project engineering conventions. |
| `$dev-flow resume <task-id>`           | Resume an interrupted task.                                   |
| `$dev-flow status [task-id]`           | Inspect task status.                                          |
| `$dev-flow --benchmark <objective>`    | Run a task with local benchmark measurement enabled.          |
| `$dev-flow config show [--explain]`    | Show effective configuration and optional provenance.         |
| `$dev-flow config validate [--json]`   | Validate effective configuration.                             |
| `npx codex-dev-flow init`              | Run the optional Configuration wizard.                        |
| `npx codex-dev-flow benchmark summary` | Summarize allowlisted local benchmark data.                   |

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
[Project Engineering Profile contract](docs/project-profile-contract.md).

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
$dev-flow config show --explain
$dev-flow config validate --json
```

## Safety guarantees

- Implementation never starts before explicit GATE approval.
- Success requires fresh verification evidence.
- Task state is durable and resumable.
- Local configuration cannot weaken repository policy.
- Commit, push, pull request, registry, and release operations are never authorized
  implicitly by Dev Flow approval.

Normative details live in the [Lifecycle contract](docs/lifecycle-contract.md).

## Documentation

- [Getting Started](docs/getting-started.md)
- [Lifecycle contract](docs/lifecycle-contract.md)
- [Project Engineering Profile contract](docs/project-profile-contract.md)
- [Design](docs/design.md)
- [Artifact contract](docs/artifacts.md)
- [Measurement protocol](docs/metrics-protocol.md)
- [Maintainer release runbook](docs/runbooks/maintainer-release.md)
- [ADR directory](docs/adr/)
- [Glossary](docs/glossary/dev-flow.md)
