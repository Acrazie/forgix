# Codex Dev Flow

<p align="center">
  <img
    src="./docs/assets/codex-dev-flow-hero.png"
    alt="Underwater view toward the light, representing a guided path through complex software changes"
    width="100%"
  />
</p>

> Portable Codex plugin for planned, reviewed, and evidence-backed software changes.

Codex Dev Flow exposes one `$dev-flow` workflow and six internal lifecycle skills. It
optimizes quota and token use while treating reliability and absence of false success as
hard constraints.

## Current contract

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE -> finished
```

- **INTAKE** resolves product objective, observable success, determining constraints,
  and risk.
- **SHAPE** performs adaptive repository Discovery, asks Quick/Plan after sufficient
  evidence, then performs repository-blind Planning.
- **GATE** runs pure deterministic preflight and requires explicit user approval of
  exact canonical implementation contract.
- **BUILD** executes approved atomic tasks with targeted validation.
- **ASSURE** performs risk-selected review and fresh criterion-linked verification,
  records compact receipt, then reaches sole success terminal `finished`.

Task state is strict V4. V1, V2, and V3 are intentionally incompatible and never
migrated. Runtime primitives are deterministic; full model/provider orchestration remains
partial. Current green tests prove implemented surfaces, not unsupported orchestration.

## Install

Requirements: Codex plugin support, Node.js 24 or newer for bundled runtime, and Git.
Linux and macOS are supported; Windows is unsupported.

```bash
codex plugin marketplace add Acrazie/codex-dev-flow
```

Then open `/plugins`, select **Acrazie**, install **Codex Dev Flow**, and start a new
Codex session.

Initialize repository configuration:

```bash
cd /path/to/project
npx codex-dev-flow init
```

## Commands

```text
$dev-flow <objective>
$dev-flow --benchmark <objective>
$dev-flow resume <task-id>
$dev-flow status [task-id]
$dev-flow config show [--explain]
$dev-flow config validate [--json]
npx codex-dev-flow benchmark summary
```

`quick`, `standard`, and `critical` at objective start are plain objective text—not modes
or aliases. Preparation profile is selected only after Discovery:

- **Quick:** compact canonical contract in task state.
- **Plan:** detailed canonical contract plus deterministic Markdown projection.

Both traverse same five phases. Risk/policy—not profile—controls worktree, security,
rollback, approval, and assurance safeguards.

## GATE boundary

GATE card has exactly five lines: objective; plan counts; risks/controls; short digest;
actions. Valid intents are approve, change with instruction, reject, and read-only view.
Silence, ambiguity, or non-interactive execution never approves. Any exact contract
digest change invalidates approval.

Approval covers complete local implementation contract only. It never authorizes commit,
push, pull request, registry, release, or other external action. Delivery remains outside
Dev Flow task state and may be performed afterward through native Codex authorization.

## State, routing, and metrics

State lives at `.codex/tasks/<task-id>/state.yaml`. Macro-phase derives from internal
status and is never persisted independently. `blocked`, `cancelled`, `failed`, and
`finished` preserve truthful lifecycle outcomes.

Routing uses risk, ambiguity, policy, subscription, quota, and model availability.
Preparation profile never selects safety level. Worktree requirement derives from risk,
policy, explicit request, concurrency, or unsafe checkout.

Metrics accept allowlisted numeric/enumerated fields only. Objective, evidence prose,
code, command output, raw model output, and user answers are forbidden. Local benchmark
feedback is opt-in and available only after `finished` or `failed`.

## Configuration

Configuration resolves broad defaults to local overrides:

```text
internal defaults
  < ~/.codex/dev-flow.yaml
  < .codex/dev-flow.yaml
  < .codex/dev-flow.local.yaml
  < invocation flags
```

Repository policy applies afterward and cannot be weakened by local configuration or
flags.

```yaml
schemaVersion: 1
worktree:
  mode: auto
merge: never
subscription:
  plan: auto
  quota:
    warningPercent: 50
    criticalPercent: 80
    unknownPolicy: conservative
```

Use `$dev-flow config show --explain` for effective-value provenance and `$dev-flow
config validate` for schema validation. `npx codex-dev-flow init` provides interactive
configuration. `integrations.plugins` and `integrations.skills` explicitly allow
compatible external capabilities.

## Quality

Repository uses Bun tests, Oxfmt, Oxlint, TypeScript, a lightweight staged-file script,
Husky pre-commit, Node.js 24 runtime smoke tests, deterministic size budgets, and full CI
checks. Local hook is fast and non-authoritative; CI runs full repository gate.

## Documentation

- [Lifecycle contract](./plugins/codex-dev-flow/docs/lifecycle-contract.md)
- [Design](./plugins/codex-dev-flow/docs/design.md)
- [Artifact contract](./plugins/codex-dev-flow/docs/artifacts.md)
- [Measurement protocol](./plugins/codex-dev-flow/docs/metrics-protocol.md)
- [Maintainer release runbook](./plugins/codex-dev-flow/docs/runbooks/maintainer-release.md)
- [ADR index](./plugins/codex-dev-flow/docs/adr/)
- [Glossary](./plugins/codex-dev-flow/docs/glossary/dev-flow.md)
- [Contributing](./CONTRIBUTING.md)
