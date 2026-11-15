# Getting Started with Forgix

This guide installs Forgix, creates durable project engineering conventions,
runs a first task, and explains how to resume safely. Normative behavior remains in the
[Lifecycle contract](lifecycle-contract.md) and
[Project Engineering Profile contract](project-profile-contract.md).

## 1. Check requirements

Plugin and CLI users need:

- **Codex**, **Claude Code**, or **Antigravity** (with plugin support);
- Node.js 26 or newer;
- Git; and
- Linux or macOS. Windows is unsupported.

Check the runtime before installation:

```bash
node --version
```

The distributed ESM runtime installs no dependencies and performs no network access by
itself. Bun is not required to use the published plugin. It is a contributor dependency only.

## 2. Install the plugin

Choose your agent harness:

### Codex

```bash
codex plugin marketplace add Acrazie/forgix
codex plugin add forgix@acrazie
```

The same installation is available interactively through `/plugins`: select
**Acrazie**, install **Forgix**, then start a new Codex session.

### Claude Code

```text
/plugin marketplace add Acrazie/forgix
/plugin install forgix@acrazie
```

Or via CLI: `claude plugin marketplace add Acrazie/forgix && claude plugin install forgix@acrazie`.

### Antigravity

```bash
git clone https://github.com/Acrazie/forgix.git
agy plugin install ./forgix/plugins/forgix
```

You can also import an existing Claude Code installation (`agy plugin import claude`) or
copy `./forgix/plugins/forgix/` into `~/.gemini/config/plugins/forgix/`.

### Standalone CLI

```bash
npx @acrasie/forgix init
npx @acrasie/forgix status
npx @acrasie/forgix resume <task-id>
npx @acrasie/forgix config validate
```

## 3. Run Project INIT

Open your repository in Codex (`$forgix init`), Claude Code (`/forgix:forgix init`), or
Antigravity (`/forgix init`) and invoke:

```text
$forgix init
```

Project INIT is an agentic repository discovery and interview workflow:

```mermaid
flowchart TD
  E[Repository evidence] --> D[Discover stack, topology, and conventions]
  D --> Q{Missing, stale, contradictory, or material decision?}
  Q -- yes --> I[Ask one question with recommendation]
  I --> D
  Q -- no --> V[Validate candidate profile]
  V --> A{Explicit Profile Approval?}
  A -- approve --> P[Atomically publish profile and projections]
  A -- reject --> U[Leave shared profile unchanged]
```

It inspects available guidance, manifests, configuration, architecture sources, tests,
contracts, and representative code before asking. Questions cover only unresolved or
material decisions and appear one at a time. There is no fixed question count.

An abbreviated interaction can look like this:

```text
You:      $forgix init
Forgix: Discovery found a Node.js API with HTTP handlers and no explicit error envelope.
          Recommended: one stable JSON error shape at the transport boundary.
          A. Stable JSON envelope (Recommended)
          B. Handler-specific payloads
You:      A
Forgix: Profile candidate validated. Review summary ...
          Approve publication of this exact profile digest?
You:      Approve
```

The wording and decisions adapt to repository evidence. The final explicit approval—not
the sample answer—authorizes profile publication.

### Project INIT outputs

| File                            | Content                                                     | Git policy                      |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| `.forgix/project.yaml`          | Portable shared architecture, topology, stack, and rules.   | Review and commit when desired. |
| `.forgix/project.local.yaml`    | Absolute service paths and personal non-contractual prefs.  | Gitignored.                     |
| `.forgix/init/state.yaml`       | Compact resumable interview state; no transcript/reasoning. | Gitignored and temporary.       |
| `.forgix/diagrams/*.mermaid.md` | Optional canonical-profile projection.                      | Commit with shared profile.     |

Secrets, secret-like values, and absolute machine paths are rejected from the shared
profile. A local preference cannot weaken repository policy or an approved shared
convention. Project INIT creates neither application code nor Forgix task state.

## 4. Run the first task

Invoke a concrete software objective (`$forgix` on Codex, `/forgix:forgix` on Claude Code,
`/forgix` on Antigravity):

```text
$forgix Add rate limiting to the public authentication endpoints
```

The normal task path is:

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE ✓
```

1. **INTAKE** establishes product objective, observable success, constraints, and risk.
2. **SHAPE** reads repository evidence, resolves technical uncertainty, and prepares a
   Quick or Plan implementation contract.
3. **GATE** displays a compact validation card and requires explicit approval of the
   exact contract.
4. **BUILD** lets the active host agent (Codex, Claude Code, or Antigravity) implement the
   complete approved plan. Forgix only checks the current approval/digest boundary and
   returns material changes to SHAPE.
5. **ASSURE** reviews the result and runs fresh criterion-linked verification.

GATE approval covers local implementation only. It never authorizes commit, push, pull
request, registry publication, or release.

### Optional: Plan and run a GitHub Project roadmap

For multi-feature initiatives, run upstream roadmap ideation first:

```text
$forgix roadmap
$forgix run-issue 42
$forgix run-roadmap --limit 3 --parallel 1
```

`$forgix roadmap` guides a 3-phase ideation session (Divergence -> Convergence -> ASCII `tree`
or Mermaid DAG synthesis), publishes `Feature` parents and atomic `Work Item` sub-issues to
GitHub Project v2 (`gh auth status` with `project` scope required), and sets Wave-1 unblocked
items to `Ready`. `$forgix run-issue` / `$forgix run-roadmap` isolate each `Work Item` in a
fresh `main`-based worktree, apply autonomous `low`/`medium` Gate receipts when eligible (or
pause `high`/`critical` items for human approval), and hand off Draft PRs on `ASSURE ✓`.

## 5. Optional Configuration wizard

Project INIT owns project engineering knowledge. The separate deterministic
Configuration wizard owns plugin operating preferences (including target `harness`,
worktree behavior, subscription/quota hints for `codex`/`auto`, and allowlisted integrations):

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
to `~/.forgix/config.yaml`, `.forgix/config.yaml`, and `.forgix/config.local.yaml` (or re-run
`npx @acrasie/forgix init`), regenerate and re-approve shared project profiles with
`$forgix init` (`/forgix:forgix init` or `/forgix init`), and update retained `docs/forgix/`
paths and `<!-- forgix:... -->` domain markers. Local `.forgix/tasks/`, `.forgix/cache/`,
`.forgix/init/`, and `.forgix/roadmap/` store runtime state consistently across harnesses.

Use it to customize target harness, worktree behavior, subscription/quota hints, or allowlisted
integrations. Defaults already exist, so the wizard is optional. Inspect or validate the
resolved configuration from your harness (`$forgix`, `/forgix:forgix`, or `/forgix`) or CLI:

```text
$forgix config show --explain
$forgix config validate --json
```

Task validation, atomic persistence, and gate decisions can also be driven deterministically via
the bundled CLI:

```text
npx @acrasie/forgix task validate [task-id]
npx @acrasie/forgix task save <task-id>
npx @acrasie/forgix task gate <task-id> [--view | --approve | --reject | --change=<instruction> | --autonomous [--issue=<ref>]]
```

Configuration precedence is:

```text
internal defaults
  < ~/.forgix/config.yaml
  < .forgix/config.yaml
  < .forgix/config.local.yaml
  < invocation flags
  < non-weakenable repository policy
```

## Resume and troubleshoot

### Project INIT was interrupted

Run `$forgix init` again in the same repository. Forgix reads the compact local
session and resumes the exact active question unless its dependency evidence changed.

### Project evidence changed

Run `$forgix init` again. Fingerprints identify stale decisions and reconcile only
their dependent closure. Repository facts are rediscovered; user-owned conventions are
re-interviewed. Rejected changes leave the shared profile byte-for-byte unchanged.

### Profile validation or approval failed

No shared publication occurs. Review the reported schema, privacy, authority, revision,
or digest error, correct the candidate through Project INIT, validate again, then approve
the new exact digest. Never edit around validation with a direct profile write.

### Shared and local profiles conflict

The shared profile has higher authority. Remove the conflicting local preference, or run
Project INIT to propose a separately validated shared-profile update. Absolute service
paths belong only in the local overlay.

### A task was interrupted

Inspect or resume it from Codex:

```text
$forgix status [task-id]
$forgix resume <task-id>
```

Resume reconciles durable state before continuing. It does not infer approval from a
previously displayed but changed implementation contract.

### Node.js is rejected

Run `node --version` and install Node.js 26 or newer. Node.js 25 and older are outside the
supported runtime contract.

## Existing projects

Use `forgix` (`$forgix` on Codex, `/forgix:forgix` on Claude Code, `/forgix` on Antigravity);
former commands have no aliases. Forgix state, configuration, profiles, diagrams,
and Plan projections live under `.forgix/` and `docs/forgix/` across all three
harnesses without fallback:

1. **CLI configuration**: migrate legacy `~/.codex/*.yaml` and `.codex/*.yaml`
   files to `~/.forgix/config.yaml`, `.forgix/config.yaml`, and
   `.forgix/config.local.yaml`, or re-run `npx @acrasie/forgix init` (legacy filenames
   are ignored silently).
2. **Project Engineering Profile**: re-run `$forgix init` (`/forgix:forgix init` or
   `/forgix init`) and re-approve rather than hand-renaming signed
   `.codex/*.project.yaml` files (keeping shared profiles at `.forgix/project.yaml` and
   diagrams below `.forgix/diagrams/`), and rename local overrides to
   `.forgix/project.local.yaml`.
3. **Plan projections and domain markers**: move retained `docs/dev-flow/` plan files to
   `docs/forgix/`, and replace or remove legacy `<!-- dev-flow:... -->` markers in domain
   documents so the next projection does not append a second `<!-- forgix:... -->` block.

## Command reference

| Codex                              | Claude Code                               | Antigravity                        | Purpose                                                         |
| ---------------------------------- | ----------------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| `$forgix <objective>`              | `/forgix:forgix <objective>`              | `/forgix <objective>`              | Start a software change.                                        |
| `$forgix init`                     | `/forgix:forgix init`                     | `/forgix init`                     | Discover and approve durable project engineering conventions.   |
| `$forgix roadmap`                  | `/forgix:forgix roadmap`                  | `/forgix roadmap`                  | Ideate and publish a GitHub Project v2 feature roadmap.         |
| `$forgix run-issue <#num>`         | `/forgix:forgix run-issue <#num>`         | `/forgix run-issue <#num>`         | Run one ready roadmap Work Item in an isolated worktree.        |
| `$forgix run-roadmap [flags]`      | `/forgix:forgix run-roadmap [flags]`      | `/forgix run-roadmap [flags]`      | Execute ready roadmap Work Items (`--limit N`, `--parallel M`). |
| `$forgix resume <task-id>`         | `/forgix:forgix resume <task-id>`         | `/forgix resume <task-id>`         | Resume an interrupted task.                                     |
| `$forgix status [task-id]`         | `/forgix:forgix status [task-id]`         | `/forgix status [task-id]`         | Inspect task status.                                            |
| `$forgix config show [--explain]`  | `/forgix:forgix config show [--explain]`  | `/forgix config show [--explain]`  | Show effective configuration and optional provenance.           |
| `$forgix config validate [--json]` | `/forgix:forgix config validate [--json]` | `/forgix config validate [--json]` | Validate effective configuration.                               |

Standalone CLI: `npx @acrasie/forgix init`, `npx @acrasie/forgix status`, `npx @acrasie/forgix resume <task-id>`,
`npx @acrasie/forgix task validate [task-id]`, `npx @acrasie/forgix task save <task-id>`,
`npx @acrasie/forgix task gate <task-id> [--view | --approve | --reject | --change=<instruction> | --autonomous [--issue=<ref>]]`,
and `npx @acrasie/forgix config validate`. Durable task state is stored under `.forgix/tasks/<task-id>.json`.

`quick`, `standard`, and `critical` at objective start are plain objective text, not
modes or aliases. Quick or Plan is selected only after Discovery. Risk and policy—not
that preparation profile—control safety safeguards.

### Harness routing and scope

On **Codex**, Forgix captures quota/model telemetry once via `codex app-server`
(`mode: "codex-app-server"`). On **Claude Code** and **Antigravity**, Forgix uses
host-native routing (`mode: "host-native"`, `model: null`, `effort: null`), skipping
`codex app-server` and quota caches so the host harness executes each stage directly.

Use Forgix when a change needs product or technical decisions, implementation, or
proof. Plain questions, read-only exploration, and Git/GitHub delivery do not need a Forgix task.

## Next references

- [Plugin README](../README.md)
- [Lifecycle contract](lifecycle-contract.md)
- [Project Engineering Profile contract](project-profile-contract.md)
- [Configuration schema](../schemas/config.schema.json)
- [Project profile schema](../schemas/project-profile.schema.json)
- [Glossary](glossary/forgix.md)
