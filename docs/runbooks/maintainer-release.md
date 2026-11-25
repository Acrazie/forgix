# Maintainer Release Runbook

## One-step release (plugin + npm)

Every release publishes **plugin manifests and npm (`@acrasie/forgix`) together** under a single
stable tag `vX.Y.Z`. Separate `npm-v*` and `plugin-v*-codex.*` release modes are retired.
npmjs `@acrasie/forgix` remains canonical. No package is renamed.
GitHub Actions is the intended npm publisher via Trusted Publishing.

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
