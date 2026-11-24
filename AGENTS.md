# Repository Instructions

- Do not read, cite, update, or use `docs/ROADMAP.md` unless the user explicitly asks
  to resume or work with that roadmap.
- Treat `docs/ROADMAP.md` as inactive by default, never as an automatic source of truth,
  prioritization, or next work.

---

# Forgix — Agent Guidelines

Instructions and standards for AI coding agents working on this repository.

## Mission & Architecture

`forgix` is a portable development workflow tool and multi-harness plugin (Codex, Claude Code, Antigravity) providing structured orchestration, lifecycle gates, and quality verification for coding workflows.

### Golden Rule: Agent-First Plugin (Non-Negotiable)

- **Forgix is built exclusively for AI agents, never for direct human terminal operation.** This rule must never be bypassed, weakened, or removed.
- Humans interact with Forgix through their AI agent (e.g., `$forgix init`, `$forgix ...`); the bundled `forgix` CLI (`dist/forgix.mjs`) exists solely as a deterministic, machine-readable mechanical backend invoked by agents and harness lifecycle hooks—never as a human-facing interactive TUI wizard.

## Golden Rules

Enforced by `check:staged`, `check`, and `check:diff` ([docs/golden-rules.md](docs/golden-rules.md), [ADR 0038](docs/adr/0038-enforce-ai-first-golden-rules-with-fallow-quality-ratchets.md)):

- **Boundaries & modularity**: Run `fallow guard <files>` first; keep `src/` acyclic/isolated, `src/` <= 300 LOC, `scripts/` <= 400 LOC, functions <= 60 LOC, CC/Cog <= 15, zero runtime `dependencies`, zero network in `src/`, zero new dead code/dupes.
- **Zero regression & anti-bypass**: Pair behavioral changes with tests and `fix:` with regression tests; zero inline `Escape Hatch`es in `src/`, no `--no-verify`, never weaken `Protected Surface`s or baselines.

## Git & Delivery Protocol

Follow the repository delivery workflow, Conventional Commits, worktrees isolation, and pull request policies defined in [docs/git-workflow.md](docs/git-workflow.md).
When starting work in a worktree branch, run `git fetch origin main` first and check `git rev-list --count HEAD..origin/main`; if `HEAD` is behind `origin/main`, rebase/merge `origin/main` before making edits.

### Operational Reflexes

- **Worktree bootstrap**: If `node_modules` is missing in a worktree, run `bun install --frozen-lockfile` automatically before running checks or tests—do not ask first.
- **Local Dagger CI check**: Before pushing changes (especially CI/CD, runtime, or cross-repo changes), run `dagger call check --source=.` locally when `dagger` and Docker are available to verify the CI pipeline matches before remote execution.
- **Fast-Track delivery**: When a **Fast-Track** task is done and `bun run check` passes, automatically commit, `git push -u origin <branch-name>`, and run `entire trail create` / `entire trail link` without asking; leave `entire trail merge` to human confirmation.
- **Human-Reviewed gate**: Pause for explicit human confirmation before `git push` / `entire trail create` only when a **Human-Reviewed** trigger applies (and always before `entire trail merge`, deleting branches, or destructive Git operations).

## Documentation & Library Guidance

Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
