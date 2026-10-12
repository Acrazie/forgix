# Repository Git & Delivery Workflow

This document serves as the authoritative source of truth for Git operations, branching strategy, commit standards, quality gates, and Pull Request procedures for `forgix`. Contributors and coding agents must adhere strictly to these policies.

---

## 1. Branching Model & Environments

- **Default / Trunk Branch**: `main` (reflects production-ready code).
- **Direct Commits Prohibited**: Committing directly or pushing directly to `main` is forbidden.
- **Branch Naming Conventions**:
  - `feat/<topic>`: New features or capabilities
  - `fix/<topic>`: Bug fixes and patches
  - `chore/<topic>`: Dependencies, tooling, and refactoring
  - `docs/<topic>`: Documentation changes only
  - `refactor/<topic>`: Non-functional code changes

---

## 2. Parallel Development with Git Worktrees

To isolate concurrent tasks and avoid dirty working tree collisions (especially when working with AI agents or multiple tasks):

- All parallel feature work should be conducted inside dedicated worktrees under `.worktrees/<branch-name>`.
- The directory `.worktrees/` is gitignored.
- Use `./scripts/worktree.sh add <branch-name>` to create an isolated worktree branch based on `origin/main`.
- List active worktrees with `./scripts/worktree.sh list`.
- Remove the worktree once the PR is merged: `./scripts/worktree.sh remove <branch-name>`.

---

## 3. Commit Conventions

This repository strictly enforces [Conventional Commits](https://www.conventionalcommits.org/):

- **Format**: `<type>(<optional-scope>): <concise description>`
- **Types**: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `perf`, `style`, `build`, `revert`.
- **Imperative Mood**: Use present tense ("add feature" instead of "added feature").
- **Attribution Invariant**: NEVER include automated co-author trailers (`Co-authored-by: ...` or equivalent automated attributions).

---

## 4. Pre-Commit Quality Gates

Before staging or committing any code:

1. **Hygiene**: Ensure no secrets, `.env*` files, build caches, or temporary directories are staged.
2. **Quality Verification**: Execute the repository quality checks:
   - `bun run check:staged` (runs automatically on commit via Lefthook)
   - Full gate validation: `bun run check`
3. Do not bypass hooks with `--no-verify`.

---

## 5. Delivery & Pull Request Protocol

When a task is complete:

1. **Push**: Push the feature branch to the remote: `git push -u origin <branch-name>`.
2. **PR Creation**: Open a Pull Request using GitHub CLI or the GitHub UI:
   - **Default State**: Open as **Draft** (`gh pr create --draft`) for review and verification unless explicitly requested as ready.
   - **Template**: Fill out all sections defined in `.github/PULL_REQUEST_TEMPLATE.md`.
   - **Target**: PR must target `main`.
3. **Merge Strategy**: Squash-merge into `main` with a clean Conventional Commit title.

---

## 6. Agent Autonomy Boundaries

- **Autonomous Actions**: Creating local branches or worktrees, staging relevant files, running tests/linters, and creating local commits.
- **Approval-Gated Actions**: Pushing to remote (`git push`), opening Pull Requests (`gh pr create`), deleting branches, or any destructive git operations require explicit confirmation.
