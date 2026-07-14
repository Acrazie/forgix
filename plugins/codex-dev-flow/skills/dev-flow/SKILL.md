---
name: dev-flow
description: Use when planning, implementing, debugging, reviewing, or verifying a repository change through the Codex Dev Flow lifecycle.
---

# Dev Flow

Parse invocation with the bundled deterministic script before acting.

## Skill isolation and configured integrations

When `$dev-flow` is explicitly invoked, use only skills bundled with Codex Dev Flow by default. Do not invoke skills from other plugins or standalone skill sets merely because their descriptions match the task.

External skills are allowed only when repository configuration explicitly lists either their plugin identifier in `integrations.plugins` or their fully qualified skill identifier in `integrations.skills`. Treat these entries as allowlists, not automatic activation: an allowed external skill must still be relevant to the requested task. System and developer instructions remain authoritative.

Use terminal command `codex-dev-flow init` to configure these allowlists interactively. This is a standalone CLI command, not a `$dev-flow` skill subcommand. If initialization is requested through chat, tell user to run that command in their project terminal; do not launch or emulate wizard. Tools are not skills and remain available under normal permission and policy rules.

At the beginning of every run and resume, create exactly one routing snapshot through `codex app-server`: complete `initialize`/`initialized`, then read `account/read`, `account/rateLimits/read`, and `model/list`. Keep the snapshot and routing decisions in durable task state. Never log or persist credentials or raw protocol payloads.

Use only `gpt-5.6-luna`, `gpt-5.6-terra`, and `gpt-5.6-sol`, with reasoning limited to `low`, `medium`, `high`, and `xhigh`. Ignore `max`, `ultra`, and unknown efforts from `model/list`. Recognize quota pressure from the exact five-hour window (`windowDurationMins === 300`), with warning at 50% and critical at 80%.

If the exact live five-hour window is absent, reuse only a non-expired cached five-hour reset timestamp. Never reuse a cached usage percentage. Keep pressure `unknown`, route conservatively, and report `quota_fallback_last_known`. Treat any other available window as informational only. Normalize both string and object-shaped `supportedReasoningEfforts` entries from `model/list`.

Resolve all six skill routes exactly once from that immutable snapshot using routing policy `2026-07-14.skill-first.v1`: `discover`, `plan`, `execute`, `debug`, `review`, and `verify`. An unresolved account plan uses the Plus baseline. Warning quota lowers one subscription tier; critical or unknown quota uses the Plus row. Quick lowers reasoning one level; Critical or high risk/ambiguity raises it one level, capped at `xhigh`.

Require the exact assigned model and reasoning effort in the initial catalog. Never substitute a fallback model or effort. Mark the route unavailable and block that skill when the exact assignment is absent. Keep `execute`, `validate`, and parent-owned verification commands in the workflow parent; route `execute` but never delegate mutations. Do not refresh account, quota, or model data between skills.

## Durable workflow artifacts

Keep resumable machine state under `.codex/tasks/`. Keep human-readable, versioned change records under `docs/dev-flow/` in the repository's active worktree.

- Quick has no mandatory artifact. Create one only when repository policy or the user requires it.
- Standard uses one change record at `docs/dev-flow/YYYY-MM-DD-<slug>.md`.
- Critical uses `docs/dev-flow/YYYY-MM-DD-<slug>/spec.md`, `plan.md`, `risk-and-rollback.md`, and `verification.md`.
- Create an ADR separately only when the change makes a durable architectural decision.

For Standard, the parent workflow creates the change record after read-only discovery and planning, before implementation approval. Creating or updating required Dev Flow artifacts is the only permitted repository write before implementation approval. Delegated discovery, planning, review, and verification stages remain read-only and return content to the parent.

The Standard change record must contain these sections:

1. Context and outcome
2. Scope and non-goals
3. Constraints and decisions
4. Acceptance criteria with stable identifiers
5. Implementation plan mapping tasks to acceptance criteria
6. Risks and rollback
7. Verification evidence

Show the saved artifact path when requesting approval. After approval, execute against that artifact. Keep plans at task and contract level; include complete code or brittle line references only when indispensable. Record approved scope changes in the artifact. Append final commands, results, skipped checks, and material deviations under verification evidence.

On resume, reuse the existing artifact and reconcile it with task state; never create a duplicate for the same task. Artifacts belong to the active worktree and must be included in the resulting commit or handoff unless repository policy explicitly forbids versioning them.

- If mode is absent, inspect read-only context, propose quick, standard, or critical, then follow effective confirmation policy.
- Quick may write directly only for an explicit, bounded, non-destructive request.
- Standard requires discovery, plan, approval, execution, review, and verification.
- Critical requires a worktree, threat model, rollback analysis, human gates, and read-only reviewers.
- Keep state under .codex/tasks and durable artifacts under docs/dev-flow.
- Apply effective policy after configuration resolution. Never merge. Never claim success without evidence.
- Resume dev-flow state with $dev-flow resume; this differs from codex resume.
- If app-server is unavailable, continue with `quota_unknown` or `allowed_model_unavailable`; do not escalate cost automatically.
