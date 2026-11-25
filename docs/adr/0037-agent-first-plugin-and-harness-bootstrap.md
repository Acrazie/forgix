# ADR 0037: Agent-First Plugin Principle and Harness-Native Project INIT Bootstrap

## Status

Accepted.

## Context

Previously, Forgix exposed two separate `init` surfaces: a human-facing interactive terminal
wizard (`forgix init` using `@clack/prompts` to write `.forgix/config.yaml`) and an agentic
`$forgix init` workflow (`Project INIT`) limited to publishing `.forgix/project.yaml`.

This split had two structural weaknesses:

1. **Product identity conflict**: Forgix is designed to be operated by AI agents on behalf of
   humans, not as a human-driven terminal wizard. Maintaining an interactive TUI contradicts
   that principle and bloats the bundled CLI (`dist/forgix.mjs`) with TUI dependencies.
2. **Incomplete repository bootstrap**: Initializing a repository with `.forgix/project.yaml`
   alone still relied on prompt compliance to remember project conventions, protect
   `Protected Surface`s, block destructive Git commands, catch `Escape Hatch`es early, and keep
   Git/worktree hygiene intact across Codex, Claude Code, and Antigravity.

## Decision

### 1. Golden Rule: Agent-First Plugin Principle (Non-Negotiable)

Forgix is built exclusively for AI agents, never for direct human terminal operation. Humans
interact through their agent (`$forgix init`, `/forgix:forgix init`, `/forgix init`). The
bundled `forgix` CLI exists strictly as a deterministic, machine-readable mechanical backend
for agents and `Harness Lifecycle Hook`s.

- Remove the legacy interactive terminal wizard (`runInit` TUI and `@clack/prompts`).
- Invoking bare `forgix init` in a terminal exits with `EXIT_CODES.INVALID_INVOCATION` (`2`)
  and directs the caller to run `$forgix init` / `/forgix:forgix init` / `/forgix init` inside
  their AI agent.

### 2. Deterministic CLI Primitives for Agentic `Project INIT` and Hooks

Add two deterministic CLI surfaces invoked by `$forgix init` and harness hooks:

- `forgix init plan|apply|check`: reads a declarative bootstrap manifest from stdin, computes
  diffs or drift (`check`/`plan`), and atomically, idempotently writes or removes Forgix-owned
  artifacts (`apply`) without clobbering user-authored content:
  - `.forgix/config.yaml` (including selected `harnesses` and `hooks.enforcement`)
  - `Harness Lifecycle Hook` entries (`.codex/hooks.json`, `.claude/settings.json`,
    `.agents/hooks.json` merged non-destructively alongside existing hooks such as Entire)
  - `Harness Rule` files (canonical `.forgix/rules.md` plus lightweight harness stubs:
    `.claude/rules/forgix.md`, `.agents/rules/forgix.md`, and/or a delimited
    `<!-- forgix:start --> ... <!-- forgix:end -->` block in `AGENTS.md` without breaking
    existing symlinks like `CLAUDE.md -> AGENTS.md`)
  - Git and worktree hygiene (delimited `# forgix:start ... # forgix:end` block in `.gitignore`
    and idempotent entries in `.worktreeinclude`)
- `forgix hook <harness> <event>`: single mechanical entrypoint for `session-start`,
  `pre-tool-use`, `post-tool-use` (Codex, Claude Code), and `post-invocation` (Antigravity),
  parsing harness-specific stdin JSON and emitting raw harness-specific stdout JSON.

### 3. Repository-Versioned Hooks, Fail-Open Execution, and Hybrid Enforcement

- **Versioned in repository**: hooks and rules are installed into the target repository for the
  auto-detected and user-confirmed harness(es), ensuring consistent, PR-auditable guardrails
  across Codex, Claude Code, and Antigravity.
- **Safe cascading resolution and fail-open**: generated hook commands resolve `forgix` in
  order (`$CLAUDE_PLUGIN_ROOT/dist/forgix.mjs` when `node` is available → `forgix` on `$PATH`
  → opt-in `$FORGIX_CLI_PATH` when `node` is available, never untrusted `./dist/forgix.mjs`
  from CWD) and fail open (`exit 0`, with a `SessionStart` warning) if `forgix` or `node` is
  missing or broken on a teammate's machine.
- **Enforcement policy (`hooks.enforcement: balanced | strict | warn`, default `balanced`)**:
  - Universal invariants (`git commit --no-verify`, `git push --force`, `merge: never`,
    `SessionStart` context, immediate `Escape Hatch` feedback via `PostToolUse` on Codex/Claude
    and `PostInvocation` on Antigravity) stay active even outside an active Forgix task.
  - `Protected Surface` writes are hard-blocked in `PreToolUse` during an active Forgix `BUILD`
    unless explicitly listed in optional `CanonicalChangeContract.approvedProtectedPaths`
    (backward-compatible optional fields on `schemas/state.schema.json`), and emit a
    non-blocking warning outside an active task.

### 4. Full Agentic Discovery and Reconciliation in `$forgix init`

`$forgix init` orchestrates:

1. Auto-detection of harnesses, repository stack/quality commands (to propose repo-specific
   `protectedSurfaces` and `surfaceVerificationRules`), existing ecosystem tools (Entire,
   Dagger, Fallow, Context7, etc.) to pre-populate `integrations` without duplicating hooks,
   and optional lazy `domainDocumentation` setup.
2. Profile validation and digest-bound Profile Approval via `forgix project-profile`.
3. Bootstrap diff preview and atomic application via `forgix init plan` / `forgix init apply`.
4. Drift detection and selective reconciliation on re-invocation via `forgix init check` +
   `forgix project-profile inspect`.

## Considered Options

- **Keep and expand the human terminal TUI (`@clack/prompts`)**: rejected because it violates
  the `Agent-First Plugin Principle`, duplicates onboarding logic between TUI and agent, and
  increases the CLI bundle size.
- **Plugin-only hooks without repo-versioned configuration**: rejected because Codex relies on
  repository `.codex/hooks.json`, and repo-versioned hooks/rules make project-specific
  guardrails explicit, portable, and reviewable in version control.
- **Zero new CLI primitives (pure LLM file edits)**: rejected because LLM-edited JSON hook
  merges and `.gitignore` updates are fragile and non-idempotent compared to a tested
  deterministic backend.
- **Fail-closed hooks when `forgix` is absent**: rejected because Forgix targets polyglot
  repositories where teammates or CI environments may not have `forgix` installed locally.

## Consequences

- `dist/forgix.mjs` drops `@clack/prompts`, reducing bundle weight while gaining
  `forgix init plan|apply|check` and `forgix hook <harness> <event>`.
- Any repository initialized with `$forgix init` gets versioned, idempotent, multi-harness
  `Mechanical Guardrail`s with zero duplication between harnesses and safe coexistence with
  tools like Entire.
- Breaking change for callers invoking bare `forgix init` in a terminal; documentation and
  tests must reflect the agent-only entrypoint.
