# Codex Dev Flow Design

## Status

Approved design. Implementation has not started.

## Goal

`codex-dev-flow` is a portable Codex plugin for disciplined software changes. Its only public workflow is `$dev-flow`. It replaces the lifecycle value of Superpowers without depending on Superpowers.

## Public Interface

```text
$dev-flow [quick|standard|critical] "<objective>"
$dev-flow resume <task-id>
$dev-flow status [task-id]
$dev-flow config show --explain
$dev-flow config validate
```

When the mode is omitted, `$dev-flow` performs read-only classification and proposes `quick`, `standard`, or `critical`. Confirmation follows the effective policy. `$dev-flow resume` resumes a durable dev-flow task state; it is distinct from `codex resume`, which resumes a Codex conversation.

Modes, subcommands, and flags are parsed by a deterministic, versioned script.

## Plugin Architecture

The plugin uses a hybrid architecture:

- Skills own reasoning, discovery, planning, execution, debugging, review, and verification.
- Scripts own deterministic parsing, configuration resolution, policy enforcement, state validation, issue fingerprinting, and artifact handling.
- `$dev-flow` is the sole public entry point. Internal stages are not user-facing commands.

Internal skills are `discover-change`, `plan-change`, `execute-change`, `debug-root-cause`, `review-change`, and `verify-change`.

## Execution Policy

`quick` performs an explicit, bounded, non-destructive write directly. It asks for confirmation if scope is ambiguous, destructive, or expands during execution.

`standard` requires discovery, planning, approval before implementation, review, and verification. Read-only subagents are optional and only support independent research.

`critical` adds a mandatory worktree, threat model, rollback analysis, human gates, and parallel read-only reviewers. No subagent writes files.

Worktree policy is `auto`: create one when the task is critical, explicitly requests it, the repository policy requires it, a concurrent dev-flow task is detected, or the current checkout is unsafe. A worktree is otherwise optional. Never merge automatically.

## Durable Artifacts and Local State

Local, gitignored state lives at:

```text
.codex/tasks/<task-id>/state.yaml
```

Versioned task artifacts live at:

```text
docs/dev-flow/<task-id>/spec.md
docs/dev-flow/<task-id>/plan.md
docs/dev-flow/<task-id>/findings.md
docs/dev-flow/<task-id>/verification.md
```

`quick` normally omits durable artifacts. `standard` and `critical` version them with the task branch and PR.

## Configuration and Policy

Configuration sources resolve in this order:

```text
internal defaults < user < repository < local < invocation flags
```

```text
~/.codex/dev-flow.yaml
.codex/dev-flow.yaml
.codex/dev-flow.local.yaml
```

The local file is gitignored. A strict, versioned JSON Schema validates every source and rejects unknown keys, invalid types, and forbidden values. `config show --explain` reports each effective value and its provenance.

Policy is separate from configuration. It has schema-limited `requirements`, `prohibitions`, `bounds`, and `locks`. Configuration is resolved first, then policy is applied. Local configuration and flags may strengthen a locked rule but cannot weaken it. A contradiction blocks before writing and reports the requested value, provenance, and violated policy.

Non-bypassable invariants include `merge: never`, a mandatory critical worktree, required human gates, and evidence before a success claim. A policy may require a pull request but never grants Git or GitHub permission.

## State Machine

```text
new
awaiting_mode_confirmation
discovering
planning
awaiting_approval
executing
validating
reviewing
resolving
verifying
handing_off
ready_for_handoff
blocked
cancelled
failed
finished_local
finished
```

`awaiting_mode_confirmation` transitions to `executing` for an accepted quick task, to `discovering` for standard, and to worktree creation followed by `discovering` for critical. Rejection transitions to `cancelled`.

Correctable failures from validation, review, or verification transition to `resolving`. `blocked` and `ready_for_handoff` are stable, resumable states with `resume_to`. `blocked` is only for an obstacle that prevents implementation or verification. `ready_for_handoff` means code and proofs are complete but a Git or GitHub authorization is missing. `cancelled`, `failed`, `finished_local`, and `finished` are terminal.

`finished` requires every effective policy, including a required PR. `finished_local` is allowed only when no external handoff is required.

## Reliability and Review

Failures and findings use a deterministic, versioned fingerprint script.

- `issue_id` is stable between runs.
- `occurrence_id` is unique to one run.
- `root_cause_id` associates multiple issues after investigation.

The fingerprint script hashes a sanitized canonical payload and stores both payload and hash. For failures, identity uses check, test or stage, error type, relative path, symbol, and normalized message pattern. For findings, identity uses rule, category, symbolic location, and problem type. Raw messages, line numbers, and evidence are metadata, not sufficient identity.

Corrections are counted per stable issue. Transient reruns without code changes use a separate counter. Two failed corrections trigger root-cause debugging or reconsideration of the plan. A third correction requires recorded investigation. If it fails, a human gate on the specification, plan, or architecture is required before a fourth attempt. Review is limited to three global cycles.

Standard review checks specification conformance, correctness and regressions, security, missing tests, and maintainability. Critical review runs independent read-only reviewers for correctness, security and data integrity, and tests and maintainability. Findings include severity, location, evidence, impact, reproduction, recommended fix, and confidence.

## Finishing

Commit, push, and PR creation are configurable preferences or repository requirements. New verification failures block finish. A documented pre-existing failure may allow a draft PR. Missing Git or GitHub authorization produces `ready_for_handoff`, not a false success.

## Validation Strategy

V1 includes automated tests for parsing, state transitions, policy enforcement, configuration provenance, resume compatibility, and fingerprints. It includes one complete Node fixture repository to validate project discovery and command selection. Python and Rust fixtures follow after field validation.

## Deferred Work

- Plugin scaffold and skills.
- GitHub repository publication.
- Python and Rust fixtures.
- Stockli task-router migration. This happens only after successful dogfooding of the standalone plugin.
