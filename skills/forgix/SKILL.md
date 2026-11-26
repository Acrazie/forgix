---
name: forgix
description: Use when shaping, implementing, debugging, reviewing, or assuring a repository change through the Forgix lifecycle.
---

# Forgix

Follow [lifecycle contract](../../docs/lifecycle-contract.md): exactly INTAKE, SHAPE, GATE,
BUILD, ASSURE. ASSURE is final; never invent another phase or success status. Obey the
deterministic `Next-Action Envelope` (`nextAction: { role, phase, allowedCommands, activeInvariants }`)
emitted by every state-transition CLI command. Never claim a transition, Approval binding, or
Assurance Receipt without deterministic evidence.

Exact `$forgix init` (Codex), `/forgix:forgix init` (Claude Code), or `/forgix init`
(Antigravity) runs Project INIT. Exact `$forgix sync` (`/forgix:forgix sync`, `/forgix sync`)
runs Config SYNC. Exact `$forgix roadmap` runs Roadmap Ideation; `$forgix run-issue <#num>`
/ `$forgix run-roadmap` run Autonomous Roadmap Execution; `$forgix retro` runs `forgix retro`
and follows `retro-factory` (confirmation required before edits). Parse every other invocation with the bundled CLI before
acting (never run `npx @acrasie/forgix` during a lifecycle turn):

Use `node "<skill_dir>/../../dist/forgix.mjs"` relative to this loaded `skills/forgix/SKILL.md`.
Do not substitute a `PATH` command or repo build; stop if unavailable. Pass
`--harness codex|claude|antigravity` matching the active host (or omit for `auto`).

## Skill isolation and Agent-First Golden Rule

Use bundled Forgix skills by default. Do not invoke skills from other plugins unless configured
in `integrations.plugins` or `integrations.skills`. **Agent-First Golden Rule**: Forgix is
strictly agent-first (never direct human CLI operation); bare `forgix init` refuses.

## Project INIT

Outside task lifecycle and GATE. Use bundled `project-profile` (`inspect`, `validate`, `publish`,
`view [--local]`) and `init` (`check`, `plan`, `apply`):

1. Auto-discover repo facts with zero questions (greenfield defaults: active harness, `balanced`
   hooks, directory name as project id/name). Run read-only `forgix project-profile inspect`,
   `forgix init check`, `forgix project-profile validate`, and `forgix init plan`.
2. If `inSync: true` and profile is `unchanged: true`, report "already up to date" (0 prompts, 0
   writes). Block on hard safety conflicts (`invalid_json`, `invalid_yaml`, `symlink_or_non_file`,
   malformed markers).
3. Present one consolidated preview (profile, bootstrap plan, and any `unmanaged_file_collision`
   diffs) and ask for **one explicit approval**. On user adjustments, update candidates, re-run
   read-only `validate`/`plan`, and re-ask. Rejection leaves `.forgix/project.yaml` byte-for-byte unchanged.
4. After approval, run `forgix init apply` **first** (prefer `adoptPaths` for specific approved
   collisions, or `--adopt`), then `forgix project-profile publish` **second** (idempotent;
   portable shared profile, local paths in `--local`).

## Config SYNC

Outside task lifecycle and GATE. Run read-only `forgix init check`, `forgix init sync --plan`,
and `forgix project-profile inspect`. If `.forgix/config.yaml` is absent, refuse and direct to
`$forgix init`. If `inSync: true`, 0 actions, and `project.yaml` is valid/current, report
"already up to date" (0 prompts, 0 writes). Block on hard conflicts. Else show one consolidated
preview (bootstrap/hooks/pin, `project.yaml` updates, collision diffs) and ask **one explicit
approval**. Then run `forgix init sync --apply` (add `--adopt-path=<path>` per approved collision) and
`forgix project-profile publish` if changed.

## INTAKE and routing

INTAKE owns Product Baseline (`objective`, `users_value`, `scope`, `success`, `risks_constraints`),
glossary deltas, domain rules, and scenarios; SHAPE owns repo evidence and technical decisions.

1. Parse invocation via bundled CLI, read cheap entry sources and approved profile, and return
   baseline progress, domain deltas, and at most one `ActiveDesignQuestion` (no transcript persisted).
2. INTAKE completes when all five dimensions are resolved or `not_applicable`, no open
   question/contradiction/stale node remains, and domain deltas have explicit disposition.
3. Resolve one immutable routing snapshot (`2026-08-13.taskstate-v6.v1`) at run/resume start:
   - **Host-native (`claude`, `antigravity`)**: `status: "routed"` (`host-native:<harness>`).
   - **Codex (`codex-app-server`)**: on `routing_permission_required`, request explicit user approval
     to rerun outside sandbox. Retry the same invocation at most once. Never escalate silently.
     If approval is denied or the retry fails, block. Use only `gpt-5.6-luna`, `gpt-5.6-terra`,
     `gpt-5.6-sol` (`low|medium|high|xhigh`) and 300-min quota window.
     Never substitute a fallback model or effort. Do not refresh account, quota, or model data between skills.

## SHAPE

Every task uses adaptive SHAPE: `Discovery -> Quick|Plan choice -> Planning`.
Quick and Plan share canonical contract: scope, non-goals, stable criteria, ordered tasks,
criterion-linked validation, risks/controls, explicit dependencies, and digest.
Quick keeps compact state only. Plan creates one parent-rendered Proposed Markdown.
Parent alone writes ShapeState and Plan projection.

1. Discovery gathers repo evidence and fingerprints. Contract Review reads only its approved
   snapshot; Planning is read-only without repo inspection. Material technical choices enter
   `awaiting_shape_decision`; product infeasibility links an INTAKE question.
2. After `discovery_sufficient`, present the Quick/Plan checkpoint (`awaiting_profile_choice`).
3. Planning follows `plan-change`. Parent saves Plan v2 and new/remade contracts with
   `task save <id> --expected-revision=<last-read-revision>` (`--adopt-design` only to adopt
   historical Plan v1). Use expected revision on every Plan v2 or Contract Review save.
4. Preview Plan v2 via `task gate <id> --view`. Verify path/document authorization by policy or
   user (never infer from secret scan or GATE). Write only via
   `task project <id> --path=<path> --authorize=<full-contract-digest>`. Preserve existing files
   on reconciliation; use resulting revision for later saves.
5. For `review-contract` or `contractReview` state, follow `review-contract` and
   [Contract Review](../../docs/lifecycle-contract.md#contract-review) before approval. Use native
   fresh-context reviewers (`spawn_agent` on Codex, `Agent` on Claude Code, `invoke_subagent` on
   Antigravity) and actual results only; refresh only affected reviews after changes.

## GATE, BUILD, and ASSURE

1. **GATE**: Show ready view and exact allowances. Human approval requires
   `--approve --digest=<shown-digest>`, plus `--review-digest=<shown-review-digest>` for Contract
   Review. Verify BUILD installation below before approving. Live refusal overrides hints; drift
   returns to SHAPE. No delivery authority.
2. **BUILD**: Require current worktree-bound GATE v2 proof and matching installed CLI/native
   hooks. Before first edit in a host-created worktree, require `worktree check-base [base-branch]`
   to return `verified` (never reset/switch on failure). Contract Review must pass `check-build`
   before first write and record only a correlated post-check. Implement without BUILD-specific skill;
   honor Protected Surface and Escape Hatch policy.
3. **ASSURE**: Enter `assuring`. Run missing/invalidated checks, `forgix guardrails check [--strict]`,
   `review-change` when policy-activated, and `debug-root-cause` on 2-strike failures. For Plan v2,
   use `task validate <id>` verifier digests and current worktree fingerprint. Record evidence per
   operation (activation ref only for verified non-applicability). Persist pending `user-observation`
   and wait for the human respondent. Atomic completion creates Assurance Receipt and renders
   `[FORGIX · ASSURE ✓]`.

Before GATE approval or BUILD entry/resume, follow
[managed BUILD installation](../../docs/getting-started.md#managed-build-installation): stop
unless `init check-build` and native SessionStart/pre-write/post evidence agree on the installed
v2 bundle.

## Roadmap, Telemetry, and Artifacts

- **`$forgix roadmap`**: 4-phase session (`divergence -> convergence -> audit -> synthesis`) in
  `.forgix/roadmap/session.yaml` (`roadmap session-view|session-save|session-clear|validate|publish|view|sync-plan|sync-record`).
  Supports `Shared Contract` (`interface|schema|api|domain-invariant|module-boundary|formal-spec`)
  and `Verification Checkpoint`s.
- **`$forgix run-issue` / `$forgix run-roadmap`**: Select via `roadmap select-ready`, reserve via
  `roadmap prepare-local <id>` (`--dry-run` previews). Stop on `reconcile`/conflict; otherwise
  resume in reserved worktree, pause at human GATE, and record checkpoints with observed Roadmap digest.
- **Artifacts**: State in `.forgix/tasks/<task-id>.json` (`task validate|save|gate`); versioned
  artifact belongs to active worktree and follows repository retention policy. Reuse existing artifact
  identity; `docs/forgix/YYYY-MM-DD-<slug>.md` is default, while `spec.md`, `plan.md`,
  `risk-and-rollback.md`, and `verification.md` are repository choices only. Definitions:
  [glossary](../../docs/glossary/forgix.md). ADRs: [Context Capsule](../../docs/adr/0002-share-an-invalidable-context-capsule.md),
  [assurance](../../docs/adr/0004-scale-assurance-lanes-by-applicable-risk.md),
  [minimal GATE](../../docs/adr/0024-make-gate-a-minimal-plan-approval.md),
  [ASSURE boundary](../../docs/adr/0031-make-assure-the-success-boundary.md).
