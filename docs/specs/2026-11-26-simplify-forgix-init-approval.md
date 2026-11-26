# Spec: Simplify `forgix init` to a Single-Approval, Low-Friction Flow

## 1. Starting point

### Why

Running `$forgix init` currently creates excessive user friction and avoidable execution conflicts due to five compounded causes:

1. **Multi-turn interview + double approval**: `skills/forgix/SKILL.md:30-50` mandates an open-ended one-question-at-a-time interview, followed by Profile Approval (`forgix project-profile publish`) and a second separate Bootstrap Plan confirmation (`forgix init apply`).
2. **Session state conflicts**: `.forgix/init/state.yaml` (`src/profile/index.ts:649-678, 720-735`) blocks `project-profile publish` with `profile_session_conflict` whenever a stale or digest-mismatched session exists.
3. **Rigid profile schema & re-run traps**: `schemas/project-profile.schema.json:15, 78-163` and `src/profile/index.ts:29-38, 688-714, 743-749, 919-962` require all 8 core categories (~509 lines / 26,688 bytes in `.forgix/project.yaml` on this repo), fail re-runs on `profile_no_change` / manual `profile_revision_conflict`, and reject `publish --local` with `profile_local_not_ignored` before `init apply` updates `.gitignore`.
4. **Hard blocks on unmanaged collisions**: `src/init/factory-plan.ts:180, 204-208, 225-226, 251-256` and `src/init/index.ts:942-948` fail the entire `init apply` (`state_conflict`, exit 5) on any `unmanaged_file_collision` without an explicit adoption path.
5. **Broken `SessionStart` project summary**: `src/hooks/context.ts:229-244` reads top-level `parsed.value.project` / `stack` / `protectedSurfaces` instead of `parsed.value.content.*`, causing `SessionStart` to print `project "unnamed"` on an initialized repository.

### Current state (verified 2026-11-26)

- `skills/forgix/SKILL.md` is 132/160 lines; `bun run check:size` reports `promptBytes=23484/24000` (516 bytes headroom).
- `fallow-baselines/file-lines.json` freezes `src/cli.ts` at 2144/2144 LOC (0 headroom), `src/profile/index.ts` at 1162/1162 LOC (0 headroom), and `src/init/index.ts` at 967/1079 LOC (112 headroom).
- Fallow zone boundaries (`docs/golden-rules.md:83-94`): `profile -> [types, core]`, `init -> [types, core, hooks]`; peer imports between `profile` and `init` are forbidden.
- `skills/retro-factory/SKILL.md:16-17` relies on `.forgix/project.yaml` (`protectedSurfaces` / `surfaceVerificationRules`) and `forgix project-profile validate`.
- `bun test test/integration/init.test.ts test/integration/init-bootstrap.test.ts test/unit/init-bootstrap.test.ts test/integration/project-profile-cli.test.ts` passes (30/30). `node dist/forgix.mjs init check` exits `0` (`inSync: true`).

### First task, before any code

Re-probe `bun run check:size`, `bun test`, and `fallow guard` on the target files under `src/init/`, `src/profile/`, `src/hooks/`, and `src/cli.ts`. If any baseline, budget, or zone rule has shifted since 2026-11-26, stop and report before editing.

## 2. Goals and non-goals

### Goals

1. **Single-approval, zero-question `$forgix init`**: Auto-discover repository facts (including greenfield repositories with minimal defaults: active harness, `hooks.enforcement: balanced`, directory name as project identity), pre-validate both `project-profile validate` and `init plan` read-only, and present **one consolidated preview + one user approval** before any write.
2. **Clean no-op on synced re-runs & single-turn adjustment**: When `init check` is `inSync: true` and the proposed profile has no change, report "already up to date" with zero approval prompts and zero writes. When the user requests an adjustment at the approval prompt, update the candidate, re-run read-only validation/planning, and re-ask approval on the updated summary.
3. **Remove session state machine & relax profile ceremony**:
   - Remove `.forgix/init/state.yaml`, CLI subcommands `forgix project-profile session-view|session-save|session-clear`, and `schemas/project-init-state.schema.json`.
   - Relax `schemas/project-profile.schema.json` so only `content.project` (`id`, `name`) is required; `stack`, `topology`, `decisions` (and its 8 core categories), and `diagramRefs` become optional / allow empty arrays while keeping full validation when present.
   - Make `forgix project-profile publish` idempotent: return `{ status: "unchanged" }` (exit `0`) when `contentDigest` is unchanged, and auto-increment `revision` to `previous.revision + 1` when `contentDigest` changes and `revision` is omitted or equal to current (still rejecting explicit revisions lower than `previous.revision`).
4. **Safe, explicit adoption for `unmanaged_file_collision`**: Keep hard-blocking real safety/corruption guards (`invalid_json`, `invalid_yaml`, `symlink_or_non_file`, corrupted markers). For `unmanaged_file_collision`, surface the diff in the single consolidated preview and allow explicit adoption via opt-in (flag `--adopt` or manifest `adoptPaths`, off by default) or excluding the item—never silently overwrite.
5. **Fix `SessionStart` project summary**: Update `loadHookProjectSummary` (`src/hooks/context.ts:213-252`) to read `content.project`, `content.stack`, and `content.protectedSurfaces` from `.forgix/project.yaml`.

### Non-goals

- Do not add a human-facing interactive terminal TUI (`Agent-First Golden Rule` remains intact).
- Do not extract a dedicated init sub-skill or separate public skill; keep `Project INIT` condensed (~10–12 lines) in `skills/forgix/SKILL.md`.
- Do not merge `init` and `project-profile` into a single combined manifest CLI command or build cross-store rollback between them.
- Do not modify `roadmap session-*`, the task lifecycle (`INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE`), or `init check-build`.
- Do not add runtime `dependencies` or network calls in `src/**`.

## 3. Constraints

### Invariants

| Invariant                                                                                                                                                                                                                                           | Where enforced or detected                                                                        | Type    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------- |
| `Agent-First Golden Rule` (`ADR 0037`): bare `forgix init` exits `2`                                                                                                                                                                                | `src/init/invocation.ts`, `test/integration/init.test.ts`                                         | Machine |
| No silent overwrite of unmanaged files, third-party hooks (e.g. Entire), or `CLAUDE.md` symlink                                                                                                                                                     | `src/init/factory-plan.ts`, `src/init/hooks-config.ts`, `test/integration/init-bootstrap.test.ts` | Machine |
| Hard-block on corrupt JSON/YAML, symlinks/non-files, and malformed markers                                                                                                                                                                          | `src/init/index.ts`, `src/init/markers.ts`, `test/integration/init-bootstrap.test.ts`             | Machine |
| Golden Rules (`docs/golden-rules.md`): Fallow zones (`profile` / `init` decoupled), non-growing `fallow-baselines/*`, `src/** <= 300` LOC (new files), functions `<= 60` LOC, CC/Cog `<= 15`, zero inline Escape Hatches, zero runtime deps/network | `bun run check`, `bun run check:diff`, `fallow guard`                                             | Machine |
| Prompt and artifact budgets (`promptBytes <= 24000`, `SKILL.md <= 160` lines)                                                                                                                                                                       | `bun run check:size`                                                                              | Machine |
| Read compatibility with existing v1 `.forgix/project.yaml` files                                                                                                                                                                                    | `test/unit/project-profile.test.ts`, `test/integration/project-profile-cli.test.ts`               | Machine |

### Compatibility & removed readers

| Surface                                                            | Before                                                                    | After                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `$forgix init`                                                     | Multi-turn interview + Profile Approval + Bootstrap Plan confirmation     | Zero-question discovery + 1 consolidated approval (0 prompts if already `inSync`)                                            |
| `forgix project-profile session-view\|session-save\|session-clear` | Manages `.forgix/init/state.yaml`                                         | Removed; exits `2` (`EXIT_CODES.INVALID_INVOCATION`)                                                                         |
| `schemas/project-init-state.schema.json`                           | Shipped in package manifest                                               | Removed (update `test/artifact-budget.json` manifest)                                                                        |
| `schemas/project-profile.schema.json`                              | Requires all 8 core categories, `stack`, `topology`, `diagramRefs`        | Only `content.project` required; existing v1 profiles remain 100% valid                                                      |
| `forgix project-profile publish`                                   | Fails on `profile_no_change`, manual `revision`, or `state.yaml` mismatch | Idempotent (`status: "unchanged"` on no-op), auto-increments `revision`                                                      |
| `forgix init apply` on `unmanaged_file_collision`                  | Always fails with `state_conflict` (exit `5`)                             | Still fails by default; succeeds when caller passes explicit adoption opt-in (`--adopt` or `adoptPaths`) after user approval |
| `SessionStart` hook (`src/hooks/context.ts`)                       | Reads top-level `project` → prints `"unnamed"`                            | Reads `content.{project,stack,protectedSurfaces}`                                                                            |

All readers of removed `session-*` / `project-init-state` to update in the same PR:

- `src/core/schema.ts:22`
- `src/cli.ts:89, 145, 222-224, 529-536, 1218, 1222, 1239, 1256, 1297-1332, 1347`
- `src/profile/index.ts:26, 181, 414-415, 551-606, 644-686, 725-735, 763-769`
- `test/unit/schema.test.ts:64`, `test/unit/project-profile.test.ts:10, 217-222`, `test/integration/project-profile-store.test.ts:186-192`, `test/integration/project-profile-cli.test.ts:160-187`, `test/integration/distribution.test.ts:107, 164`, `test/integration/cli.test.ts:165`, `test/integration/documentation.test.ts:29`, `test/support/project-profile.ts:3, 75`, `test/artifact-budget.json:78`
- `skills/forgix/SKILL.md:32-36, 43, 50`, `docs/project-profile-contract.md:28, 53-55`, `docs/getting-started.md:163`, `docs/repository-guide.md:179`

### Entrypoints & single owners

- **`$forgix init` / `/forgix:forgix init` / `/forgix init`** (`skills/forgix/SKILL.md`): orchestrates read-only preflight (`inspect` + `check` + `validate` + `plan`) -> 1 user approval -> `init apply` -> `project-profile publish`. Refuses to proceed on hard safety conflicts; no-ops when `inSync` with zero changes.
- **`forgix init plan|apply|check`** (`src/init/index.ts`): **sole owner** of `.forgix/config.yaml`, `.forgix/factory/**`, harness projections, harness hooks, `AGENTS.md` Forgix block, `.gitignore` Forgix block, `.worktreeinclude` Forgix block, and explicit adoption of `unmanaged_file_collision` paths.
- **`forgix project-profile inspect|view|validate|publish [--local]`** (`src/profile/index.ts`): **sole owner** of `.forgix/project.yaml`, `.forgix/diagrams/*.md`, and `.forgix/project.local.yaml`.
- **`forgix hook <harness> session-start`** (`src/hooks/context.ts`): read-only consumer of `.forgix/project.yaml`.

### Ordering and cutover

1. Read-only pre-validation: run `forgix project-profile validate` and `forgix init plan` before presenting the single approval preview.
2. Obtain explicit user approval on the consolidated summary (including any `unmanaged_file_collision` diffs if adoption is proposed).
3. Run `forgix init apply` **first** (atomic under lock, `.forgix/config.yaml` written last; updates `.gitignore` so `.forgix/project.local.yaml` is ignored before any `--local` publish).
4. Run `forgix project-profile publish` **second** (atomic, idempotent). If an I/O error interrupts step 4, bootstrap state remains consistent and recovery is an idempotent re-run of `forgix project-profile publish`.

### Promote on merge

- Add `docs/adr/0042-simplify-forgix-init-single-approval.md` in the same PR, amending `ADR 0027` (removing multi-turn interview and `.forgix/init/state.yaml`, relaxing mandatory profile categories) and `ADR 0037` (consolidating into one user approval and explicit collision adoption).

### Stop and ask / left to the agent

- **Stop and ask**: if removing `schemas/project-init-state.schema.json` from `test/artifact-budget.json` (a Protected Surface) or shrinking `fallow-baselines/` requires adjusting any unrelated ratchet, or if a pre-existing test outside the listed readers fails unexpectedly.
- **Left to the agent**: internal TypeScript helper decomposition under `src/init/` and `src/profile/` (respecting Fallow LOC/complexity caps), exact phrasing of the condensed `Project INIT` block in `skills/forgix/SKILL.md`, and internal test case layout.

## 4. Proof

### Verifies on

Local Bun test runner, Fallow architecture/quality gates, artifact size/prompt budget check, and Node.js packed tarball runtime smoke (`bun run test:runtime`) — all verified operational on 2026-11-26.

| #   | Proves                                                                                                                                                                | Surface                        | Check                                                                                                                                                             | Where it runs | Pass signal                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Bare `forgix init` and removed `project-profile session-*` exit `2`                                                                                                   | CLI `forgix`                   | `bun test test/integration/init.test.ts test/integration/project-profile-cli.test.ts`                                                                             | Local / CI    | All assertions pass, 0 failures                                                                 |
| 2   | Relaxed profile schema, v1 backward compatibility, idempotent `publish` (`unchanged` + auto-revision)                                                                 | CLI `project-profile` & schema | `bun test test/unit/schema.test.ts test/unit/project-profile.test.ts test/integration/project-profile-cli.test.ts test/integration/project-profile-store.test.ts` | Local / CI    | All assertions pass, 0 failures                                                                 |
| 3   | `unmanaged_file_collision` blocks by default, adopts cleanly with explicit opt-in; safety guards block; third-party hooks & `CLAUDE.md` symlink preserved             | CLI `init plan\|apply\|check`  | `bun test test/unit/init-bootstrap.test.ts test/integration/init-bootstrap.test.ts`                                                                               | Local / CI    | All assertions pass, 0 failures                                                                 |
| 4   | End-to-end single-approval sequence (`init apply` -> `project-profile publish` -> `publish --local` -> `init check` -> no-op re-run) on fresh and greenfield fixtures | CLI end-to-end                 | Integration test exercising full sequence on fresh repo, greenfield repo, and synced re-run                                                                       | Local / CI    | `inSync: true`, `--local` succeeds without manual `.gitignore` edit, re-run returns `unchanged` |
| 5   | `SessionStart` reads `content.{project,stack,protectedSurfaces}` without `"unnamed"`                                                                                  | Hook `SessionStart`            | `bun test test/unit/hooks.test.ts test/integration/hooks.test.ts`                                                                                                 | Local / CI    | Banner outputs real project name and protected surface count                                    |
| 6   | `skills/forgix/SKILL.md` and docs reflect single-approval flow with zero multi-turn/`session-*` directives and fit `promptBudget`                                     | `SKILL.md` & docs              | `bun test test/integration/documentation.test.ts test/integration/distribution.test.ts && bun run check:size`                                                     | Local / CI    | Doc/distribution checks pass and `promptBytes <= 24000`                                         |
| 7   | Golden Rules, Fallow zones, non-growing baselines, and packed CLI binary                                                                                              | Repo & npm tarball             | `bun run check && bun run check:diff && bun run pack:runtime && bun run test:runtime`                                                                             | Local / CI    | Exit `0` on every command                                                                       |
