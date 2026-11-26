# ADR 0043: Automate Package Releases on `main` Merge

- Status: Accepted
- Date: 2026-11-26
- Amends: [ADR 0008](0008-automate-maintainer-releases-with-an-interactive-bun-workflow.md)

## Context

Unified releases of `@acrasie/forgix` and its plugin manifests (Codex, Claude Code, Antigravity)
previously required a maintainer to run `bun run release` manually on `main`. That left merged
changes unpublished until manual intervention, treated internal-only commits (`docs:`, `chore:`,
`ci:`, `test:`, `refactor:`, `style:`, `build:`) as `patch` bumps via `recommendBump()`, and relied
on a 15-minute synchronous CI polling loop inside `scripts/release.ts` that would deadlock or time
out on ephemeral Buildkite Hosted Agents.

At the same time, `main` is protected (`server-side merge only`), local AI agents must remain
strictly bound by `merge: never` in `.forgix/config.yaml`, and npm publication must remain
exclusive to GitHub Actions Trusted Publishing (OIDC) without storing any npm token in Buildkite.

## Decision

1. **Event-driven three-phase release pipeline on Buildkite**:
   - **Phase 1 (`release-main` on `main`, non-release commits)**: computes the filtered SemVer bump
     over `--first-parent` commits since the last `vX.Y.Z` tag. When releasable changes exist,
     prepares the 8 `ALLOWED_RELEASE_PATHS` (including `dist/forgix.mjs` and `CHANGELOG.md` via
     pinned `git-cliff 2.14.1` in Dagger), pushes `release/vX.Y.Z` as `forgix-release[bot]`,
     cleans up superseded unreleased `release/v*` branches, and creates or updates the Entire Trail.
   - **Phase 2 (`release-merge` on `release/v*`)**: after `quality-gate`, `runtime-smoke`, and
     `release-contract` pass, runs `entire trail merge --branch release/vX.Y.Z --delete-branch`
     automatically for `patch` and `minor` releases. `major` bumps (`next.major > prev.major`) are
     never auto-merged and remain open for explicit human review and merge.
   - **Phase 3a (`release-main` on `main`, `chore(release): vX.Y.Z`)**: detects any untagged
     `chore(release): vX.Y.Z` commit on `--first-parent` (including ancestors whose build was
     cancelled by `cancel_running_branch_builds: true`), validates manifests on that commit, and
     creates/pushes annotated tag `vX.Y.Z` idempotently. When `HEAD` is a release commit, exits `0`
     immediately after ensuring the tag exists (anti-loop guard).
   - **Phase 3b (`release-mirror` on tag `vX.Y.Z`)**: after `quality-gate` (`release-candidate`)
     and `runtime-smoke` (`scripts/release-smoke.sh`) succeed, verifies Buildkite tag context and
     `origin/main` ancestry, then runs `scripts/sync-github-mirror.ts --apply` using the Buildkite
     Cluster Secret `GITHUB_MIRROR_TOKEN` over HTTPS (via ephemeral `GIT_CONFIG_COUNT` env headers,
     never written to `.git/config` or logs) while preserving `.github/` on `Acrazie/forgix`.
2. **Filtered Conventional Commits bump rules (`computeAutomatedBump`)**:
   - `!:` in header or `BREAKING CHANGE:` / `BREAKING-CHANGE:` footer -> `major`
   - `feat` -> `minor`
   - `fix`, `perf`, `revert` -> `patch`
   - `docs`, `chore`, `ci`, `test`, `refactor`, `style`, `build` only -> `none` (no release)
3. **Scoped CI-bot governance exception**:
   - Buildkite authenticates to Entire via OIDC token exchange against Service Account
     `forgix/buildkite-release` (`svc_01M8CHF4WWEXY2Z6R92SBEJSNC`, role `writer`, bound to
     `organization=acrazie`, `pipeline=forgix`).
   - Only Buildkite CI is authorized to auto-merge `release/v*` `patch`/`minor` Trails and push
     `vX.Y.Z` tags. Local AI agents remain strictly under `merge: never`.
4. **Skip formal lanes on release commits**:
   - `formal-lean` and `formal-tla` are skipped on `release/v*` branches and `chore(release):`
     commits to limit CI amplification; `quality-gate`, `runtime-smoke`, and `release-contract`
     remain mandatory.
5. **Preserve manual fallback**:
   - `bun run release` (`scripts/release.ts`) remains intact as a local maintainer fallback.

## Consequences

- Every releasable merge to `main` automatically publishes `@acrasie/forgix` and aligned plugin
  manifests end-to-end without manual maintainer intervention or synchronous CI polling.
- Breaking (`major`) releases retain a mandatory human approval gate before merge.
- Buildkite still holds zero npm tokens; npm Trusted Publishing (OIDC) on `Acrazie/forgix` remains
  the sole npm publisher.
