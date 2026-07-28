# Codex Dev Flow

<p align="center">
  <img
    src="./docs/assets/codex-dev-flow-hero.png"
    alt="Underwater view toward the light, representing a guided path through complex software changes"
    width="100%"
  />
</p>

> Portable Codex plugin for planned, reviewed, and evidence-backed software changes.

Codex Dev Flow exposes one `$dev-flow` workflow and six internal lifecycle skills. Its
target lifecycle optimizes quota and token use while treating reliability and absence of
false success as hard constraints.

## Implementation status

Version `0.1.0` is a partial foundation, not complete end-to-end lifecycle orchestration.

- **Available:** installed skills; deterministic invocation parsing; strict configuration
  and policy schemas; subscription-aware routing; issue fingerprinting; worktree
  decisions; verification-command discovery; standalone `init` CLI.
- **Available primitives:** canonical 18-state registry, strict durable V2 state,
  adaptive INTAKE, local opt-in benchmark feedback, state-bound guard attestations,
  macro-phase derivation, and pure V1→V2 migration.
- **Still partial:** full provider orchestration, actionable resume reconciliation,
  content-bound Approvals, and handoff receipts.

Read the [normative lifecycle contract](./plugins/codex-dev-flow/docs/lifecycle-contract.md).
Current green tests prove covered primitives only, not complete provider orchestration.

## Install

Requirements: Codex plugin support, Node.js 22.18 or newer for bundled runtime, and Git
for repository/worktree operations.

```bash
codex plugin marketplace add Acrazie/codex-dev-flow
```

Then open `/plugins`, select the **Acrazie** marketplace, install **Codex Dev Flow**, and
start a new Codex session.

Initialize repository configuration from a project directory:

```bash
cd /path/to/project
npx codex-dev-flow init
```

The npm CLI configures a repository. `$dev-flow` runs the installed workflow inside
Codex. Installing the plugin does not add a standalone binary to shell `PATH`.

## Quick start

```text
$dev-flow Add request rate limiting to the public API
$dev-flow quick Fix the typo in the installation heading
$dev-flow standard Add pagination to the users endpoint
$dev-flow critical Rotate the authentication scheme without downtime
$dev-flow --benchmark standard Add pagination and collect local feedback
```

When mode is omitted, skill workflow inspects cheap read-only context and proposes one.
Full provider orchestration remains incomplete.

| Mode | Intended use | Contract path |
| --- | --- | --- |
| `quick` | Explicit, bounded, non-destructive edit | INTAKE, BUILD, ASSURE, HANDOFF; SHAPE/GATE recorded N/A while bounded guard remains true |
| `standard` | Normal feature, fix, or refactor | All six phases with pre-build Approval, review, and verification |
| `critical` | Security-sensitive, destructive, or high-impact work | All six phases with worktree, risk records, human gates, independent applicable assurance lanes |

Ambiguity, scope expansion, destructive impact, or policy conflict stops or escalates
work; it never silently weakens process.

## Canonical lifecycle

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE -> HANDOFF
```

These six macro-phases are public. Internal statuses provide precise progress and derive
macro-phase; macro-phase is never persisted independently. BUILD contains execute,
validate, and build-resolution loops. ASSURE contains review, assurance resolution, and
verification. HANDOFF distinguishes local completion, resumable external delivery, and
receipted external completion.

Exact states, guards, transitions, mode paths, failures, resume rules, capsule fields,
and metrics live in the [lifecycle contract](./plugins/codex-dev-flow/docs/lifecycle-contract.md).
Metric privacy/label rules and fixture baseline live in the
[measurement protocol](./plugins/codex-dev-flow/docs/metrics-protocol.md).

## Artifacts and state

Target contract uses one logical versioned change artifact as sole owner of detailed
scope, criteria, plan, risks, and evidence references. Standard does **not** mandate one
fixed Markdown path or template. Critical requires risk records, but filenames/layout
come from repository policy. Quick has no mandatory artifact while its bounded-scope
exemption remains valid.

Local `.codex/tasks/` state will hold compact status, fingerprints, checkpoints, events,
and references—not duplicate approved prose or detailed evidence. Complete persistence,
selective invalidation, and real resume are not yet implemented. See the
[artifact contract](./plugins/codex-dev-flow/docs/artifacts.md),
[Context Capsule decision](./plugins/codex-dev-flow/docs/adr/0002-share-an-invalidable-context-capsule.md),
and [Approval decision](./plugins/codex-dev-flow/docs/adr/0003-bind-approvals-to-canonical-contracts.md).

## Commands

```text
$dev-flow <objective>
$dev-flow quick|standard|critical <objective>
$dev-flow --benchmark [quick|standard|critical] <objective>
$dev-flow resume <task-id>
$dev-flow status [task-id]
$dev-flow config show [--explain]
$dev-flow config validate [--json]
npx codex-dev-flow benchmark summary
```

Parser supports these surfaces. `$dev-flow resume` is distinct from `codex resume`;
full workflow reconciliation remains incomplete.

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
finish:
  pullRequest: optional
merge: never
subscription:
  plan: auto
  quota:
    warningPercent: 50
    criticalPercent: 80
    unknownPolicy: conservative
```

Use `$dev-flow config show --explain` for effective-value provenance and `$dev-flow
config validate` for schema validation. `npx codex-dev-flow init` provides an interactive
configuration wizard. Bundled skills are isolated by default; `integrations.plugins`
and `integrations.skills` explicitly allow compatible external capabilities.

## Routing available today

One `codex app-server` snapshot freezes account, exact five-hour quota observation, model
catalog, and six stage routes for a run/resume. Unknown or critical quota routes
conservatively. Missing exact model/effort assignment blocks without fallback.
Execution and validation remain parent-owned.

If restrictive sandbox denies app-server state writes under `CODEX_HOME`, result is
`routing_permission_required`. Workflow may ask for one elevated retry; it never
escalates silently or persists failed attempt as snapshot.

## Safety target

- Fresh validation/review/verification failure blocks completion.
- Pre-existing failure may support only explicitly incomplete/draft handoff, never
  success.
- Critical requires safe worktree and content-bound human gates.
- Missing external permission yields `ready_for_handoff`, not completion.
- Commit, push, or pull request requires effective intent, policy, and permission.
- Automatic merge is forbidden.

Some items above are contractual targets awaiting executable enforcement. See
[risk-adaptive assurance ADR](./plugins/codex-dev-flow/docs/adr/0004-scale-assurance-lanes-by-applicable-risk.md)
and [idempotent handoff ADR](./plugins/codex-dev-flow/docs/adr/0005-make-handoff-intent-aware-and-idempotent.md).

## Documentation

- [Lifecycle contract](./plugins/codex-dev-flow/docs/lifecycle-contract.md)
- [Design](./plugins/codex-dev-flow/docs/design.md)
- [Artifact contract](./plugins/codex-dev-flow/docs/artifacts.md)
- [Measurement protocol](./plugins/codex-dev-flow/docs/metrics-protocol.md)
- [ADR index](./plugins/codex-dev-flow/docs/adr/)
- [Glossary](./plugins/codex-dev-flow/docs/glossary/dev-flow.md)
- [Contributing](./CONTRIBUTING.md)
