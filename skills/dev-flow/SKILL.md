---
name: dev-flow
description: Use when planning, implementing, debugging, reviewing, or verifying a repository change through the Codex Dev Flow lifecycle.
---

# Dev Flow

Parse invocation with the bundled deterministic script before acting.

- If mode is absent, inspect read-only context, propose quick, standard, or critical, then follow effective confirmation policy.
- Quick may write directly only for an explicit, bounded, non-destructive request.
- Standard requires discovery, plan, approval, execution, review, and verification.
- Critical requires a worktree, threat model, rollback analysis, human gates, and read-only reviewers.
- Keep state under .codex/tasks and durable artifacts under docs/dev-flow.
- Apply effective policy after configuration resolution. Never merge. Never claim success without evidence.
- Resume dev-flow state with $dev-flow resume; this differs from codex resume.
