---
id: git-delivery-workflow
description: Enforce worktree base verification, Conventional Commits, Full
  Gate, and Human-Reviewed boundaries.
alwaysApply: true
---

- Verify worktree base (`forgix worktree check-base`) before editing; never bypass Git hooks (`--no-verify`).
- Use Conventional Commits without AI attribution trailers; run `bun run check` (and `dagger call check --source=.` when available) before pushing.
- Pause for explicit human approval before pushing/creating Trails on Human-Reviewed or Protected Surface changes, and always before `entire trail merge`.
