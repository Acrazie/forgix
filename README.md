# Codex Dev Flow

<p align="center">
  <img
    src="./docs/assets/codex-dev-flow-hero.png"
    alt="Underwater view toward the light, representing a guided path through complex software changes"
    width="100%"
  />
</p>

> A portable Codex plugin for planned, tested, reviewed, and evidence-backed software changes.

Codex Dev Flow turns a software change into a controlled lifecycle: understand the repository, agree on a plan, implement one scoped task at a time, review the result, and verify every completion claim with evidence.

## Why use it?

- Match process depth to change risk with `quick`, `standard`, and `critical` modes.
- Require approval before implementation for non-trivial changes.
- Keep repository policy stronger than user or invocation preferences.
- Preserve resumable task state and durable planning artifacts.
- Separate implementation, review, and verification concerns.
- Never merge automatically.

## Requirements

- A Codex environment with plugin support.
- Node.js 22.18 or newer for the bundled runtime.
- Git for repository and worktree operations.

## Install

Add this repository as a Codex plugin marketplace:

```bash
codex plugin marketplace add Acrazie/codex-dev-flow
```

Then:

1. Start Codex with `codex`.
2. Open the plugin browser with `/plugins`.
3. Select the **Acrazie** marketplace and install **Codex Dev Flow**.
4. Start a new Codex session so the bundled skills become available.

See the official [Codex plugin documentation](https://learn.chatgpt.com/docs/plugins) for plugin-browser and permission details.

## Quick start

Describe the outcome you want. When no mode is supplied, Dev Flow inspects the request and proposes one.

```text
$dev-flow Add request rate limiting to the public API
```

Choose a mode explicitly when the risk is already clear:

```text
$dev-flow quick Fix the typo in the installation heading
$dev-flow standard Add pagination to the users endpoint
$dev-flow critical Rotate the authentication scheme without downtime
```

## Choose a mode

| Mode | Best for | Workflow |
| --- | --- | --- |
| `quick` | Explicit, bounded, non-destructive edits | Confirm when needed, implement, verify |
| `standard` | Normal feature, fix, or refactor work | Discover, plan, approve, execute, review, verify |
| `critical` | Security-sensitive, destructive, or high-impact changes | Isolated worktree, threat model, rollback analysis, human gates, review, verification |

Scope expansion, destructive behavior, or policy conflicts always trigger a stop or confirmation instead of being silently accepted.

## Lifecycle

```text
request
  -> discover
  -> plan
  -> approve
  -> execute
  -> validate
  -> review
  -> resolve findings
  -> verify
  -> hand off
```

Dev Flow keeps local task state under `.codex/tasks/` and durable artifacts under `docs/dev-flow/`. Interrupted tasks can resume without rebuilding their context from scratch.

## Commands

```text
$dev-flow <objective>
$dev-flow quick|standard|critical <objective>
$dev-flow resume <task-id>
$dev-flow status [task-id]
$dev-flow config show [--explain]
$dev-flow config validate [--json]
```

`$dev-flow resume` resumes Dev Flow task state. It is separate from `codex resume`, which resumes a Codex conversation.

## Configuration

Configuration resolves from broad defaults to local overrides:

```text
internal defaults
  < ~/.codex/dev-flow.yaml
  < .codex/dev-flow.yaml
  < .codex/dev-flow.local.yaml
  < invocation flags
```

Repository policy is applied afterward and cannot be weakened by local configuration or flags.

Minimal repository configuration:

```yaml
schemaVersion: 1
worktree:
  mode: auto
finish:
  pullRequest: optional
merge: never
```

Example subscription-aware routing configuration:

```yaml
schemaVersion: 1
subscription:
  plan: auto
  quota:
    warningPercent: 50
    criticalPercent: 80
    unknownPolicy: conservative
```

Use `$dev-flow config show --explain` to inspect each effective value and its source. Use `$dev-flow config validate` before committing repository configuration.

## Safety and evidence

Dev Flow treats successful implementation and successful completion as different claims.

- New validation, review, or verification failures block completion.
- A documented pre-existing failure may permit a draft hand-off, never a false success.
- Missing Git or GitHub authorization produces a resumable `ready_for_handoff` state.
- Critical changes require worktree isolation and explicit human gates.
- The workflow may create a commit, push, or pull request only when configuration, repository policy, and granted permissions allow it.
- The workflow never merges automatically.

## Current scope

Version `0.1.0` provides the V1 lifecycle, strict configuration and policy schemas, worktree decisions, resumable state, failure fingerprinting, and subscription-aware analysis routing through `codex app-server`.

If account, quota, or model information is unavailable, routing remains conservative and reports a warning. Execution and validation stay controlled by the parent workflow; delegated stages never mutate the repository.

## Documentation

- [Design](./plugins/codex-dev-flow/docs/design.md)
- [Architecture decision record](./plugins/codex-dev-flow/docs/adr/0001-hybrid-portable-workflow.md)
- [Glossary](./plugins/codex-dev-flow/docs/glossary/dev-flow.md)
- [Contributing](./CONTRIBUTING.md)

## Contributing

Development setup, architecture boundaries, tests, and pull-request expectations live in [CONTRIBUTING.md](./CONTRIBUTING.md).
