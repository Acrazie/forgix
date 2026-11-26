# Maintainer Release Runbook

## Automated release on `main` merge (default)

Every release publishes **plugin manifests and npm (`@acrasie/forgix`) together** under a single
stable tag `vX.Y.Z` (ADR 0043: `docs/adr/0043-automate-package-releases-on-main-merge.md`). Separate
`npm-v*` and `plugin-v*-codex.*` release modes are retired.
npmjs `@acrasie/forgix` remains canonical. No package is renamed.
GitHub Actions is the intended npm publisher via Trusted Publishing.

By default, releases are automated by Buildkite (`.buildkite/pipeline.yml` + `scripts/release-auto.ts`)
in three event-driven phases:

1. **Phase 1 — Prepare (`release-main` on `main`)**:
   - After `quality-gate`, `runtime-smoke`, and `release-contract` pass on `main`, calculates the
     filtered SemVer bump over `--first-parent` commits since the last `vX.Y.Z` tag:
     - `!:` or `BREAKING CHANGE:` -> `major`
     - `feat` -> `minor`
     - `fix`, `perf`, `revert` -> `patch`
     - `docs`, `chore`, `ci`, `test`, `refactor`, `style`, `build` only -> `none` (no release)
   - Generates the 8 `ALLOWED_RELEASE_PATHS` inside Dagger (`prepare-release-files`, pinned
     `git-cliff 2.14.1` and Node `26.8.1`), commits as `forgix-release[bot]`, pushes
     `release/vX.Y.Z`, cleans up any superseded unreleased `release/v*` branch, and opens or
     updates the Entire Trail via OIDC (`forgix/buildkite-release`).
2. **Phase 2 — Auto-merge (`release-merge` on `release/v*`)**:
   - Once `quality-gate`, `runtime-smoke`, and `release-contract` pass on `release/vX.Y.Z`:
     - For `patch` and `minor` bumps: automatically runs
       `entire trail merge --branch release/vX.Y.Z --delete-branch`.
     - For `major` bumps: logs an explicit skip and exits `0`, leaving the Trail open for human
       review and manual merge (`entire trail merge --branch release/vX.Y.Z --delete-branch`).
3. **Phase 3 — Tag & Mirror (`release-main` + `release-mirror`)**:
   - **3a (`release-main` on `main`)**: detects any untagged `chore(release): vX.Y.Z` commit on
     `origin/main` (including ancestors whose build was cancelled), validates manifests on that
     commit, and pushes annotated tag `vX.Y.Z` to Entire. Re-runs on already-tagged release commits
     exit `0` immediately (anti-loop guard).
   - **3b (`release-mirror` on tag `vX.Y.Z`)**: after `quality-gate` (`release-candidate`) and
     `runtime-smoke` (`scripts/release-smoke.sh`) pass, verifies tag context and `origin/main`
     ancestry, then runs `scripts/sync-github-mirror.ts --apply` using Buildkite Cluster Secret
     `GITHUB_MIRROR_TOKEN` to sync `main` + `vX.Y.Z` to `Acrazie/forgix` (preserving `.github/`),
     triggering `.github/workflows/release.yml` (npm OIDC + GitHub Release).

## Manual fallback (`bun run release`)

`bun run release` (`scripts/release.ts`) remains available as a local maintainer fallback for
emergency recovery or manual version overrides.

From a clean, up-to-date `main` branch at the repository root:

```bash
bun run release            # interactive version prompt (recommended bump preselected)
bun run release patch      # or: minor | major | X.Y.Z
bun run release patch --dry-run   # preview notes + full gate, then restore all files
```

### What `bun run release` does

1. Verifies Linux/macOS, clean worktree, branch `main`, and `HEAD == origin/main` after
   `git fetch origin main --tags`.
2. Bumps `package.json`, `bun.lock`, `.codex-plugin/plugin.json` (`X.Y.Z+codex.YYYYMMDDhhmmss`),
   `.claude-plugin/plugin.json`, `plugin.json`, and `.claude-plugin/marketplace.json`.
3. Prepends the `## [vX.Y.Z] - YYYY-MM-DD` section to `CHANGELOG.md` using `git-cliff 2.14.1`.
4. Runs `bun run check` (including `bun run build` so `dist/forgix.mjs` is rebuilt and verified).
5. Stops and restores all files if `--dry-run` is set or any check fails.
6. Commits `chore(release): vX.Y.Z` on a temporary `release/vX.Y.Z` branch, opens an Entire Trail,
   waits for Buildkite CI to pass and merges via `entire trail merge --delete-branch`, pulls `main`,
   and only then creates and pushes annotated tag `vX.Y.Z` to `origin` (Entire).
7. Synchronizes `main` + tag `vX.Y.Z` to the public GitHub mirror
   (`git@github.com:Acrazie/forgix.git` by default, override via `--mirror-target` or
   `FORGIX_MIRROR_TARGET`, skip via `--no-mirror`), preserving `.github/` on the mirror.

Pushing `vX.Y.Z` to GitHub triggers `.github/workflows/release.yml`, which packs the tarball,
runs the Node runtime smoke test, publishes `@acrasie/forgix` via **npm Trusted Publishing (OIDC)**
with provenance (zero local npm token), and creates the GitHub Release.

## Prerequisites

- `git-cliff 2.14.1` on `PATH` (same version pinned in CI).
- Push access to `origin` (`entire://.../et/forgix/forgix`) and the GitHub mirror
  (`git@github.com:Acrazie/forgix.git`).
- npm Trusted Publishing configured on `npmjs.com` for `@acrasie/forgix` pointing to repository
  `Acrazie/forgix`, workflow `release.yml`, environment `release`.

## GitHub mirror workflow (`.github/workflows/release.yml`)

Because `.github/` is preserved exclusively on the public GitHub mirror (`Acrazie/forgix`), keep
`.github/workflows/release.yml` aligned with this minimal OIDC publisher:

```yaml
name: Release

on:
  push:
    tags: ["v*"]

permissions:
  contents: read

concurrency:
  group: forgix-release
  cancel-in-progress: false

jobs:
  publish:
    name: Smoke test and publish @acrasie/forgix (OIDC)
    environment: release
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          registry-url: https://registry.npmjs.org
      - name: Verify version matches tag
        run: |
          TAG="${GITHUB_REF_NAME}"
          VER="${TAG#v}"
          node -e "
            const p = require('./package.json');
            if (p.version !== '${VER}') process.exit(1);
          "
      - name: Pack and run runtime smoke test
        run: |
          mkdir -p .artifacts
          TARBALL="$(npm pack --ignore-scripts --pack-destination .artifacts | tail -n 1)"
          mv ".artifacts/${TARBALL}" .artifacts/forgix.tgz
          node --test test/runtime/runtime-smoke.test.mjs
      - name: Publish to npm via Trusted Publishing (OIDC)
        run: npm publish .artifacts/forgix.tgz --provenance --access public
      - name: Create GitHub Release
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release create "${GITHUB_REF_NAME}" --generate-notes --verify-tag
```

## Buildkite CI validation

On tag `vX.Y.Z`, Buildkite runs `quality-gate` (full gate + `scripts/release-ci.ts candidate`) and
`runtime-smoke` (`scripts/release-smoke.sh`). Buildkite never holds npm credentials or publishes.

## Failure recovery

- **Failure before `git push origin`**: all modified files are automatically restored; fix the issue
  and rerun `bun run release`.
- **GitHub mirror sync fails after Entire push**: rerun the exact idempotent command printed by
  `bun run release`:

```bash
bun scripts/sync-github-mirror.ts --target git@github.com:Acrazie/forgix.git --source-ref vX.Y.Z --tag vX.Y.Z --apply
```

- **After publication**: prefer forward correction with a new `vX.Y.Z` patch release. Never
  unpublish, rewrite `main`, or move an existing release tag.
