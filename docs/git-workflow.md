# Repository Git & Delivery Workflow

This document serves as the authoritative source of truth for Git operations, branching strategy, commit standards, quality gates, and Pull Request procedures for `forgix`. Contributors and coding agents must adhere strictly to these policies.

---

## 1. Branching Model & Environments

- **Default / Trunk Branch**: `main` (reflects production-ready code, protected on Entire with `server-side merge only`).
- **Direct Commits Prohibited**: Committing directly or pushing directly to `main` is forbidden and rejected server-side (`HEAD` requires Entire Trail merges).
- **Branch Naming Conventions**:
  - `feat/<topic>`: New features or capabilities
  - `fix/<topic>`: Bug fixes and patches
  - `chore/<topic>`: Dependencies, tooling, and refactoring
  - `docs/<topic>`: Documentation changes only
  - `refactor/<topic>`: Non-functional code changes

---

## 2. Parallel Development with Git Worktrees

To isolate concurrent tasks and avoid dirty working tree collisions (especially when working with AI agents or multiple tasks):

- **When to use worktrees**: Consistent with `worktree.mode: auto` in `.forgix/config.yaml`, conduct parallel or isolated feature work inside dedicated worktrees under `.worktrees/<sanitized-branch-name>` (`scripts/worktree.sh` replaces `/` with `-`, e.g. `feat/<topic>` -> `.worktrees/feat-<topic>`). Simple, sequential tasks without concurrent working-tree conflicts may use a standard feature branch directly.
- The directory `.worktrees/` is gitignored.
- Use `./scripts/worktree.sh add <branch-name> [base-branch]` to create an isolated worktree branch. The script fetches branches from `origin` automatically and starts at the exact commit of the remote base (`main` by default). If the fetch fails or the remote branch is absent, it does not create a branch or worktree.
- Codex, Claude Code, and Antigravity can still create their own worktrees. Before the first edit in a host-created worktree, Forgix runs `forgix worktree check-base [base-branch]`. The command refreshes `origin` and requires `HEAD` to match the remote base exactly. It never switches or resets the worktree. This check stops Forgix, not the application's worktree creation.
- List active worktrees with `./scripts/worktree.sh list`.
- Remove the worktree once the Trail is merged: `./scripts/worktree.sh remove <branch-name>`.

### Local Environment & `.worktreeinclude`

To avoid manual setup in new worktrees, a repository-root `.worktreeinclude` file defines an explicit allowlist of gitignored local files or patterns (such as `.env`, `.env.local`, `.forgix/config.local.yaml`, or `.forgix/project.local.yaml`) to copy automatically from the primary checkout when creating a worktree via `./scripts/worktree.sh add <branch-name>`.

- **Format & Copy Semantics**:
  - `.worktreeinclude` lists relative paths or glob patterns (one per line; blank lines and `#` comments are ignored).
  - Absence of `.worktreeinclude` or of any listed file in the source checkout is non-fatal (skip silently without failing `worktree.sh add`).
  - Existing files in the destination worktree are never overwritten, and copying resolves from the primary checkout (via `git rev-parse --git-common-dir` parent) even if invoked from a linked worktree.
- **Runtime Hygiene & Security Enforcement**:
  - `scripts/worktree.sh` must verify that each matched candidate is gitignored (`git check-ignore -q`), not tracked (`! git ls-files --error-unmatch`), and does not escape the repository root (`..` or external symlinks).
  - Never include or copy private keys/certificates (`*.pem`, `*.key`) or build/dependency caches (`node_modules/`, `dist/`, `.artifacts/`).
  - Copied files must remain gitignored and must never be staged or committed.
- **Implementation Note**: `.worktreeinclude` and automated copy support in `scripts/worktree.sh` are part of this target workflow contract and require separate script/config implementation if not yet present in the repository.

---

## 3. Commit Conventions

This repository strictly enforces [Conventional Commits](https://www.conventionalcommits.org/):

- **Format**: `<type>(<optional-scope>): <concise description>`
- **Types**: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `perf`, `style`, `build`, `revert`.
- **Imperative Mood**: Use present tense ("add feature" instead of "added feature").
- **Attribution Invariant**: NEVER include automated co-author trailers (`Co-authored-by: ...` or equivalent automated attributions).

---

## 4. Quality Gates (Fast, Full & Diff Gates)

Before staging, committing, or pushing any code:

1. **Hygiene**: Ensure no secrets, `.env*` files, build caches, or temporary directories are staged.
2. **Local / Pre-Commit (Fast Gate)**:
   - `bun run check:staged` (runs automatically through `.vite-hooks/pre-commit`: scans staged `src/**` Git index blobs for inline `Escape Hatch`es, then runs `vp fmt --check` and native `vp lint` on staged files)
   - Targeted tests covering the modified scope.
3. **Pre-Push / Pre-Trail (Full Gate & Diff Gate)**:
   - Run the full repository validation (`bun run check`) before pushing or creating/updating an Entire Trail.
   - `.vite-hooks/pre-push` runs `bun run check:base` and `bun run check:diff` (Diff Gate: verifies zero Fallow/Golden Rules baseline growth against `origin/main` and deterministic diff-to-test pairing). PR/branch CI runs the same Diff Gate via `dagger call diff-gate --source=.` after fetching `origin/main`.
4. Do not bypass hooks with `--no-verify`.
5. For hook or commit-policy changes, also run `bun run test:hooks` with CLINT 0.1.0 installed.

Project hooks live in `.vite-hooks/`: check-only staged quality on `pre-commit`,
and CLINT with explicit `fluidise.toml` on `commit-msg`. Standard clones use the
Vite+ dispatcher. Linked worktrees use native Git `--worktree` scope pointing at
the same scripts; setup never changes shared hook settings from a linked worktree.

The approved CLINT policy limits titles to 100 Unicode code points, allows terminal
full stops and trailing title whitespace, and does not cap body/footer line length.
It rejects temporary `fixup!`/`squash!` messages and requires a blank line before a
body. Its exact merge/revert recognition is not equivalent to Commitlint's ignore
patterns; some non-conventional revert messages are rejected. These are explicit
policy changes, not claims of rule-for-rule parity.

---

## 5. Delivery, Risk Tiers & Entire Trail Protocol

Delivery speed is tiered by change risk so routine work ships with minimal friction while sensitive changes always receive human review:

### Risk Tiers

Any `Human-Reviewed` trigger below overrides `Fast-Track`, regardless of branch prefix (for example, a `docs/` change to `docs/git-workflow.md` or a `chore/` dependency update is `Human-Reviewed`):

- **Fast-Track (Low-Risk, Documented & Scoped)**:
  - Routine, reversible, and well-scoped changes within existing documented contracts (e.g., `docs/`, `chore/`, `refactor/`, or isolated `fix/`/`feat/` changes that trigger none of the `Human-Reviewed` criteria) with passing `bun run check`.
  - **Flow**: Autonomous `git push` and `entire trail create` / `entire trail link` targeting `main` once `bun run check` passes; merge once checks pass.
- **Human-Reviewed (Sensitive, Strategic, Undocumented, or Risky)**:
  - Changes touching security/authentication, public APIs/schemas/contracts, core workflow or autonomy policies, CI/CD or release pipelines, Git hooks or commit policies, `.forgix/` configuration, dependency additions/upgrades, undocumented architectural decisions, any `Protected Surface` defined in [docs/golden-rules.md](golden-rules.md) (`docs/golden-rules.md`, `.fallowrc.json`, `fallow-baselines/**`, `fallow-rules/**`, `vite.config.ts`, `bunfig.toml`, `test/artifact-budget.json`, `.forgix/{config,policy,project}.yaml`, `.vite-hooks/**`, `.dagger/**`, `.buildkite/pipeline.yml`, `formal/**`), or changes with material regression or data-loss risk.
  - **Flow**: Explicit human confirmation is required before `git push` or `entire trail create` / `entire trail link`, and explicit human review is mandatory before `entire trail merge`.

### Entire Trail Steps

1. **Push**: Push the feature branch to the remote: `git push -u origin <branch-name>`.
2. **Resolve Author Identity**: Verify authentication via `entire auth status --json` (`logged_in === true`) and read the active account ULID via `entire api /api/v1/me` (`global.accountId`, formatted as `ulid:<accountId>`). Note: `entire trail create --assignee` and `entire trail update --add-assignee` reject `github:<handle>` and `@<handle>` when no Entire username is set; `ulid:<accountId>` is the reliable format. If either command fails or `logged_in` is not `true`, stop and ask the user to authenticate (`entire login`) rather than guessing an assignee or creating an unassigned Trail.
3. **Trail Creation & Author Assignment**: Create or link an Entire Trail for the branch:
   - **Target**: Trail must target `main`.
   - **Create**: Run `entire trail create --assignee "ulid:<accountId>" ...` so the Trail is explicitly assigned to its author.
   - **Link**: Run `entire trail link <trail> ...` followed by `entire trail update <trail> --add-assignee "ulid:<accountId>"` (or `entire trail update --add-assignee "ulid:<accountId>"` on the current branch) — either unconditionally or when `assignees` is empty in `entire trail show <trail> --json`.
4. **Merge Strategy**: Merge into `main` through Entire (`entire trail merge`) once required checks and any required human review/approvals pass. (Note: `.forgix/config.yaml` sets `merge: never` for automated Forgix runs, keeping `entire trail merge` human-triggered for all local agents.)
   - **Scoped Buildkite CI Release Exception** ([ADR 0043](adr/0043-automate-package-releases-on-main-merge.md)): The Buildkite release pipeline (authenticated via OIDC Service Account `forgix/buildkite-release`) is exclusively authorized to run `entire trail merge --branch release/vX.Y.Z --delete-branch` on `patch` and `minor` release branches once `quality-gate`, `runtime-smoke`, and `release-contract` pass, and to push annotated `vX.Y.Z` tags for merged `chore(release): vX.Y.Z` commits. `major` release Trails are never auto-merged and always require explicit human review and merge.

---

## 6. Agent Autonomy Boundaries

- **Autonomous Actions**:
  - Creating local branches or worktrees, installing locked dependencies when `node_modules` is missing (`bun install --frozen-lockfile`), staging relevant files, running checks/tests, and creating local commits. Do not ask for confirmation on these steps.
  - For **Fast-Track** changes with passing `bun run check`: pushing the feature branch (`git push -u origin <branch-name>`) and creating/linking/assigning an Entire Trail (`entire trail create --assignee`, `entire trail link`, `entire trail update --add-assignee`).
- **Approval-Gated / Human-Review Actions**:
  - For any **Human-Reviewed** change (sensitive, strategic, undocumented, or risky): `git push`, `entire trail create` / `entire trail link` / `entire trail update`, and `entire trail merge` all require explicit human confirmation and review.
  - For all local AI agents (`.forgix/config.yaml` `merge: never`), merging any Trail (`entire trail merge`), creating or pushing release tags, deleting remote or unmerged branches, or any destructive Git operations (`reset --hard`, `push --force`, etc.) require explicit human confirmation. The scoped Buildkite CI exception in Section 5 applies solely to the CI release pipeline, never to local agents.
