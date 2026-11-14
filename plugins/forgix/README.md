# Forgix

> Turn a software objective into an approved, implemented, and verified change.

Forgix is a portable plugin and workflow CLI for **Codex**, **Claude Code**, and **Antigravity**.
It combines product clarification, repository discovery, explicit approval, implementation,
and fresh verification without treating a plausible answer as completed work.

## Requirements

For plugin or CLI use:

- **Codex**, **Claude Code**, or **Antigravity** (with plugin support);
- Node.js 24 or newer;
- Git; and
- Linux or macOS. Windows is unsupported.

The distributed ESM runtime installs no dependencies and performs no network access by
itself. Bun is required only for repository development.

## Existing projects

Use `forgix` (`$forgix` on Codex, `/forgix:forgix` on Claude Code, `/forgix` on Antigravity);
former commands have no aliases. Internal `.codex/` state directories (`tasks/`,
`benchmarks/`, `project-init/`, `roadmap/`) keep their paths across all three harnesses,
while configuration, profiles, diagrams, owned domain markers, and Plan projections use
`forgix` names without fallback:

1. **CLI configuration**: rename `~/.codex/dev-flow.yaml`, `.codex/dev-flow.yaml`, and
   `.codex/dev-flow.local.yaml` to `forgix.yaml` / `forgix.local.yaml`, or re-run
   `npx @acrasie/forgix init` (legacy filenames are ignored silently).
2. **Project Engineering Profile**: re-run `$forgix init` (`/forgix:forgix init` or
   `/forgix init`) and re-approve rather than hand-renaming signed
   `.codex/dev-flow.project.yaml` files (especially when `diagramRefs` point below
   `.codex/forgix/diagrams/`), and rename `.codex/dev-flow.project.local.yaml` to
   `.codex/forgix.project.local.yaml`.
3. **Plan projections and domain markers**: move retained `docs/dev-flow/` plan files to
   `docs/forgix/`, and replace or remove legacy `<!-- dev-flow:... -->` markers in domain
   documents so the next projection does not append a second `<!-- forgix:... -->` block.

## Install

### Codex

Add the marketplace and install the plugin:

```bash
codex plugin marketplace add Acrazie/forgix
codex plugin add forgix@acrazie
```

Alternatively, open `/plugins`, select **Acrazie**, and install **Forgix**.
Start a new Codex session after installation or upgrade.

### Claude Code

Add the marketplace and install the plugin from inside Claude Code:

```text
/plugin marketplace add Acrazie/forgix
/plugin install forgix@acrazie
```

Or via the `claude` CLI:

```bash
claude plugin marketplace add Acrazie/forgix
claude plugin install forgix@acrazie
```

### Antigravity

Clone the repository and install the plugin directory with `agy`:

```bash
git clone https://github.com/Acrazie/forgix.git
agy plugin install ./forgix/plugins/forgix
```

Alternatives on Antigravity: `agy plugin import claude` (after installing in Claude Code) or
copying `./forgix/plugins/forgix/` into `~/.gemini/config/plugins/forgix/`.

### Standalone CLI

```bash
npx @acrasie/forgix init
npx @acrasie/forgix status
npx @acrasie/forgix resume <task-id>
npx @acrasie/forgix config validate
```

## Quick start

Open your repository in Codex, Claude Code, or Antigravity. First, create or reconcile
its durable engineering conventions:

```text
# Codex
$forgix init

# Claude Code
/forgix:forgix init

# Antigravity
/forgix init
```

Project INIT inspects the repository before asking questions. It asks one material
question at a time, recommends an answer, and publishes nothing until explicit Profile
Approval.

Then run a real objective:

```text
# Codex
$forgix Add rate limiting to the public authentication endpoints

# Claude Code
/forgix:forgix Add rate limiting to the public authentication endpoints

# Antigravity
/forgix Add rate limiting to the public authentication endpoints
```

Forgix carries the objective through product decisions, technical shaping, one plan
approval, implementation, and fresh assurance.

The optional Configuration wizard customizes plugin operation such as target harness,
worktree, subscription, quota, and integrations:

```bash
npx @acrasie/forgix init
```

The npm package is named `@acrasie/forgix` and the installed command is named `forgix`; the primary skill is `$forgix`
(Codex), `/forgix:forgix` (Claude Code), or `/forgix` (Antigravity).
Neither `dev-flow` nor `codex-dev-flow` is shipped as a CLI alias.
Existing installations of the old npm package, marketplace source, or `dev-flow` files are
not automatically migrated. Replace or re-add the Acrazie marketplace source as
`Acrazie/forgix`, install `forgix@acrazie`, and replace the old plugin installation rather
than installing both plugin identities side by side. Rename existing CLI configuration files
to `~/.codex/forgix.yaml`, `.codex/forgix.yaml`, and `.codex/forgix.local.yaml` (or re-run
`npx @acrasie/forgix init`), regenerate and re-approve shared project profiles with
`$forgix init` (`/forgix:forgix init` or `/forgix init`), and update retained `docs/forgix/`
paths and `<!-- forgix:... -->` domain markers; `.codex/tasks/`, `benchmarks/`,
`project-init/`, and `roadmap/` remain unchanged.

Project INIT and the Configuration wizard are separate interfaces; neither aliases the
other. See the [Getting Started guide](docs/getting-started.md) for a complete
walkthrough.

## How Forgix works

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE ✓
```

- **INTAKE** resolves the product objective, observable success, constraints, and risk.
- **SHAPE** discovers repository facts, resolves technical uncertainty, and prepares a
  Quick or Plan implementation contract.
- **GATE** validates that exact contract and asks for one explicit approval.
- **BUILD** lets the active host agent implement the complete approved plan. Forgix adds no
  execution skill, checkpoint, progress tracker, or validation loop.
- **ASSURE** reviews and verifies the change with fresh command-backed evidence.

On **Codex**, Forgix captures quota/model telemetry once via `codex app-server`
(`mode: "codex-app-server"`). On **Claude Code** and **Antigravity**, Forgix uses
host-native routing (`mode: "host-native"`, `model: null`, `effort: null`), skipping
`codex app-server` and quota caches so the host harness executes each stage directly.

Use Forgix when a change needs product or technical decisions, implementation, or
proof. Plain questions, read-only exploration, and Git/GitHub delivery do not need a Forgix task.

## Commands

| Codex                              | Claude Code                               | Antigravity                        | Purpose                                                         |
| ---------------------------------- | ----------------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| `$forgix <objective>`              | `/forgix:forgix <objective>`              | `/forgix <objective>`              | Start a software change.                                        |
| `$forgix init`                     | `/forgix:forgix init`                     | `/forgix init`                     | Discover and approve durable project engineering conventions.   |
| `$forgix roadmap`                  | `/forgix:forgix roadmap`                  | `/forgix roadmap`                  | Ideate and publish a GitHub Project v2 feature roadmap.         |
| `$forgix run-issue <#num>`         | `/forgix:forgix run-issue <#num>`         | `/forgix run-issue <#num>`         | Run one ready roadmap Work Item in an isolated worktree.        |
| `$forgix run-roadmap [flags]`      | `/forgix:forgix run-roadmap [flags]`      | `/forgix run-roadmap [flags]`      | Execute ready roadmap Work Items (`--limit N`, `--parallel M`). |
| `$forgix resume <task-id>`         | `/forgix:forgix resume <task-id>`         | `/forgix resume <task-id>`         | Resume an interrupted task.                                     |
| `$forgix status [task-id]`         | `/forgix:forgix status [task-id]`         | `/forgix status [task-id]`         | Inspect task status.                                            |
| `$forgix --benchmark <objective>`  | `/forgix:forgix --benchmark <objective>`  | `/forgix --benchmark <objective>`  | Run a task with local benchmark measurement enabled.            |
| `$forgix config show [--explain]`  | `/forgix:forgix config show [--explain]`  | `/forgix config show [--explain]`  | Show effective configuration and optional provenance.           |
| `$forgix config validate [--json]` | `/forgix:forgix config validate [--json]` | `/forgix config validate [--json]` | Validate effective configuration.                               |

Standalone CLI: `npx @acrasie/forgix init`, `npx @acrasie/forgix status`, `npx @acrasie/forgix resume <task-id>`,
`npx @acrasie/forgix config validate`, and `npx @acrasie/forgix benchmark summary`. Durable task state
is stored under `.codex/tasks/<task-id>.yaml` and `.codex/tasks/<task-id>.events.jsonl`.

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

| File                                  | Role                                                        | Git policy                      |
| ------------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| `.codex/forgix.project.yaml`          | Shared architecture, topology, stack, and conventions.      | Review and commit when desired. |
| `.codex/forgix.project.local.yaml`    | Absolute service paths and personal, non-contractual prefs. | Gitignored.                     |
| `.codex/project-init/state.yaml`      | Compact resumable INIT session.                             | Gitignored and temporary.       |
| `.codex/forgix/diagrams/*.mermaid.md` | Optional projection of approved profile architecture.       | Commit with shared profile.     |

Shared profiles reject secret-like values and absolute local paths. Project INIT creates
no product scaffold and no task state. Full schema, authority, reconciliation, and
atomic publication rules live in the
[Project Engineering Profile contract](docs/project-profile-contract.md).

## Configuration

Configuration resolves from broad defaults to invocation-specific values:

```text
internal defaults
  < ~/.codex/forgix.yaml
  < .codex/forgix.yaml
  < .codex/forgix.local.yaml
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
- [Glossary](docs/glossary/forgix.md)
