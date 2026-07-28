# Codex Dev Flow

Portable Codex plugin for evidence-based software changes. Runtime requires Node.js
22.18 or newer. Distributed ESM bundle contains runtime dependencies and performs no
package installation, lifecycle hook, or network access by itself.

## Status

Release `0.1.0` ships skills and deterministic primitives, not complete lifecycle
orchestration.

- Available: invocation/config/policy parsing, adaptive/resumable INTAKE primitives,
  opt-in local benchmark records/summary, app-server routing snapshots, issue
  fingerprints, worktree decisions, verification-command discovery, `init` CLI,
  canonical registry, strict durable V2 state, guard-specific evaluator
  receipts, macro-phase derivation, pure V1→V2 migration, complete state-machine path
  tests, and redacted lifecycle measurement primitives/P0 fixture baseline.
- Partial: evaluator contracts exist but are not wired to full command/provider
  orchestration. Status reads durable state; actionable resume reconciliation,
  full-path orchestration, artifact reconciliation, and handoff receipts remain
  incomplete.
- Target: six-phase lifecycle defined by
  [docs/lifecycle-contract.md](docs/lifecycle-contract.md).

Green tests prove covered primitives and complete in-memory state paths. They do not
prove full repository/provider orchestration.

## Interfaces

Conversation surface:

```text
$dev-flow [quick|standard|critical] <objective>
$dev-flow --benchmark [quick|standard|critical] <objective>
$dev-flow resume <task-id>
$dev-flow status [task-id]
$dev-flow config show [--explain]
$dev-flow config validate [--json]
npx codex-dev-flow benchmark summary
```

Standalone configuration CLI:

```bash
cd /path/to/project
npx codex-dev-flow init
```

Installing plugin exposes skills inside Codex; it does not install shell command
globally. Parser recognizes status/resume surfaces; task status can load persisted V2
state, while full resume reconciliation remains incomplete.

## Lifecycle contract

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE -> HANDOFF
```

Macro-phase derives from internal status and is never persisted. Quick may record SHAPE
and GATE as N/A only for bounded, non-destructive work. Standard traverses all phases.
Critical adds safe worktree, risk records, content-bound pre-build and completion gates,
and independent applicable assurance lanes.

INTAKE asks zero or more lazy Decision Questions. Each question supplies 2–3 choices,
justified recommendation, and free-form input; user must answer or cancel. Complete
Standard/Critical intake advances automatically to SHAPE. Requests to advance cannot
bypass missing context.

Leading `--benchmark` opts a new task into three deterministic post-task questions.
Complete answers stay local under gitignored `.codex/benchmarks/`; non-response creates
no record. No A/B or duplicate model execution occurs.

Exact states, named guards, correction loops, terminality, resume, capsule ownership,
and phase metrics are normative only in [docs/lifecycle-contract.md](docs/lifecycle-contract.md).
Measurement labels, privacy boundary, and P0 fixture baseline are defined in
[docs/metrics-protocol.md](docs/metrics-protocol.md).

## Artifact contract

Target lifecycle uses one logical versioned change artifact as sole owner of detailed
scope, criteria, plan, risks, and evidence references. Standard has no canonical
filename or mandatory monolithic template. Critical risk records may be physically
separate when repository policy chooses. Quick has no mandatory artifact while its
bounded-scope guard remains true.

Compact task state under `.codex/tasks/` will reference artifact identity and freshness;
it must not duplicate detailed prose/evidence. Complete persistence is not shipped yet.
See [docs/artifacts.md](docs/artifacts.md),
[ADR 0002](docs/adr/0002-share-an-invalidable-context-capsule.md), and
[ADR 0003](docs/adr/0003-bind-approvals-to-canonical-contracts.md).

## Configuration and isolation

Configuration resolves defaults, user, repository, local, then flags. Repository policy
applies afterward and cannot be weakened. Strict schemas reject unknown values.
External skills stay disabled unless `integrations.plugins` or `integrations.skills`
explicitly allow them. Allowlisting eligibility does not activate irrelevant skills.

```yaml
schemaVersion: 1
subscription:
  plan: auto
  quota:
    warningPercent: 50
    criticalPercent: 80
    unknownPolicy: conservative
```

## Routing available today

One V1 routing snapshot is captured at start of each run/resume through `codex
app-server`: `initialize`/`initialized`, `account/read`, `account/rateLimits/read`, and
`model/list`. Snapshot freezes six routes; quota is not refreshed between skills.

Accepted models are `gpt-5.6-luna`, `gpt-5.6-terra`, and `gpt-5.6-sol`; accepted efforts
are `low`, `medium`, `high`, and `xhigh`. Five-hour pressure uses only an exact 300-minute
window. A cached reset timestamp may be reused, never cached percentage. Unknown quota
routes conservatively. Missing exact model/effort blocks without fallback.

Parent workflow retains execute, validate, and verification-command mutations. Routed
read-only stages do not mutate repository.

If app-server needs denied SQLite writes under `CODEX_HOME`, result is
`routing_permission_required`. Workflow must request explicit approval before one retry,
never escalate silently, and persist only a successful snapshot.

## Reliability target

No success without fresh acceptance-criterion evidence. Missing external permission
means `ready_for_handoff`; local-only completion means `finished_local`; fully receipted
selected/required external work means `finished`. Resume reconciles before side effects.
Automatic merge is forbidden.

Risk-adaptive assurance and idempotent handoff are accepted designs, not yet complete
runtime behavior. See [ADR 0004](docs/adr/0004-scale-assurance-lanes-by-applicable-risk.md),
[ADR 0005](docs/adr/0005-make-handoff-intent-aware-and-idempotent.md), and the
[glossary](docs/glossary/dev-flow.md).
