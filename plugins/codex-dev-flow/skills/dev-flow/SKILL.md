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

Use only `gpt-5.6-luna`, `gpt-5.6-terra`, and `gpt-5.6-sol`. Recognize quota pressure from the exact five-hour window (`windowDurationMins === 300`), with warning at 50% and critical at 80%. Unknown quota is conservative. `max` and `ultra` require a critical task, normal quota, and explicit support in `model/list`.

If the exact live five-hour window is absent, reuse only a non-expired cached five-hour reset timestamp. Never reuse a cached usage percentage. Keep pressure `unknown`, route conservatively, and report `quota_fallback_last_known`. Treat any other available window as informational only. Normalize both string and object-shaped `supportedReasoningEfforts` entries from `model/list`.

Route only `discover`, `plan`, `debug`, `review`, and `verify`. Keep `execute`, `validate`, and parent-owned verification commands in the workflow parent; never delegate mutations.

- If mode is absent, inspect read-only context, propose quick, standard, or critical, then follow effective confirmation policy.
- Quick may write directly only for an explicit, bounded, non-destructive request.
- Standard requires discovery, plan, approval, execution, review, and verification.
- Critical requires a worktree, threat model, rollback analysis, human gates, and read-only reviewers.
- Keep state under .codex/tasks and durable artifacts under docs/dev-flow.
- Apply effective policy after configuration resolution. Never merge. Never claim success without evidence.
- Resume dev-flow state with $dev-flow resume; this differs from codex resume.
- If app-server is unavailable, continue with `quota_unknown` or `allowed_model_unavailable`; do not escalate cost automatically.
