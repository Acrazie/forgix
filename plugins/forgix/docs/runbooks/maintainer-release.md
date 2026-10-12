# Maintainer Release Runbook

## Purpose and ownership

This runbook is the canonical production-release procedure for Forgix. A
maintainer runs it from a trusted local workstation. CI validates releases but does not
publish the canonical npm package or the Codex plugin. After an npm-bearing GitHub
Release is published, a separate GitHub Actions workflow mirrors its canonical npmjs
tarball to GitHub Packages as `@acrazie/forgix`.

Use the repository release program rather than invoking `npm publish`, creating tags,
or editing release versions manually:

```bash
bun run release
```

The release design and safety rationale are recorded in
[ADR 0008](../adr/0008-automate-maintainer-releases-with-an-interactive-bun-workflow.md).

## Supported release targets

| Target       | Version change                                                   | Tag                                     | Publication                                                  |
| ------------ | ---------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| Plugin + npm | Increment npm SemVer; give plugin same base plus UTC cachebuster | `v<version>`                            | Git push, npm, GitHub Release, optional local plugin refresh |
| Codex plugin | Keep semantic base; replace plugin UTC cachebuster               | `plugin-v<version>-codex.<cachebuster>` | Git push, GitHub Release, optional local plugin refresh      |
| npm package  | Increment npm SemVer; leave plugin manifest unchanged            | `npm-v<version>`                        | Git push, npm, GitHub Release                                |

Only stable npm versions are supported. The program recommends patch, minor, or major
from Conventional Commits; maintainer retains final version authority.

## Preconditions

- Run on Linux or macOS. Windows is rejected.
- Install Node.js 24 or newer.
- Install repository-pinned Bun version from root `package.json`.
- Install `git` and GitHub CLI `gh`.
- Have push permission for `origin/main` and release creation permission on GitHub.
- For npm or combined release, have publish permission for `forgix`.
- Keep `main` clean, with no staged, unstaged, or untracked files.
- Ensure local `main` can fast-forward to `origin/main`; release program never rebases,
  resets, or creates a merge commit.

Authenticate without placing credentials in repository files:

```bash
gh auth status
cd plugins/forgix
bun pm whoami
cd ../..
```

`bun pm whoami` is unnecessary for a plugin-only release. OTP, when required, remains
inside interactive `bun publish`.

## Recommended procedure

### 1. Prepare local `main`

```bash
git switch main
git pull --ff-only
git status --short
```

`git status --short` must produce no output. Do not stash unrelated work inside the
release procedure; finish or move it before starting.

### 2. Run read-only preview

```bash
bun run release
```

Choose intended target, then **Preview only**. Preview still requires GitHub and, when
applicable, npm authentication plus network access. It checks version availability and
runs validation, but restores generated bundle bytes and changes no remote state.

Confirm preview shows expected:

- target;
- npm and plugin versions;
- tag and release identity;
- changed-file allowlist;
- publication order.

Preview requires local `main` to equal `origin/main`. If it refuses, reconcile with
`git pull --ff-only`, inspect result, then rerun preview.

### 3. Publish

Run same command again, choose same target, then **Prepare and publish**:

```bash
bun run release
```

Before any publication, program performs:

1. Git branch, cleanliness, synchronization, authentication, and version-availability
   checks;
2. frozen dependency installation;
3. typecheck and deterministic build;
4. main and release test suites;
5. plugin-manifest validation;
6. npm package inspection and publish dry-run when applicable;
7. generated-file allowlist validation;
8. release commit, annotated tag, and generated GitHub release-note preview.

Review final summary. Final publication confirmation defaults to **No**. Approval starts
publication in this order:

1. atomically push release commit and tag;
2. run `bun publish --access public` when target includes npm;
3. create GitHub Release from generated notes;
4. optionally refresh locally installed Codex plugin.

Publishing the GitHub Release asynchronously starts `Publish GitHub package mirror`
for combined `v<version>` and npm-only `npm-v<version>` tags. Plugin-only tags have no
npm artifact and do not start the mirror. The release program does not wait for or
include this asynchronous mirror in its partial-release state.

Start a new Codex thread after local plugin refresh so new plugin version loads.

## Verification

Use tag printed by release program:

```bash
git show --no-patch <tag>
gh release view <tag>
```

For npm or combined target, use npm version printed by release program:

```bash
npm view forgix@<version> version
```

After the mirror workflow succeeds, an authenticated GitHub Packages client can verify
the scoped alias:

```bash
npm view @acrazie/forgix@<version> version \
  --registry=https://npm.pkg.github.com
```

Expected final state:

- local and remote `main` point to release commit;
- annotated tag points to same commit;
- GitHub Release exists for tag;
- selected npm version exists when applicable;
- matching `@acrazie/forgix` version exists after the asynchronous mirror;
- worktree is clean.

The release commit, tag, npm registry entry, and GitHub Release are durable audit
records. No separate local release-state file exists.

## Package rename

New releases target `forgix` on npmjs and `@acrazie/forgix` on GitHub Packages.
Historical `codex-dev-flow` and `@acrasie/dev-flow` packages remain separate; this
workflow does not republish, remove or migrate them. The `all` selector backfills
only versions published as `forgix`. The CLI and Codex plugin are also named `forgix`;
no former CLI alias is retained.

Before the first Forgix release, verify npm name availability and publication rights.
Set the GitHub package visibility after its first publication. No package is published
by the rename itself, and a registry 404 does not guarantee npm will accept the name.

## Initial GitHub Packages publication and historical backfill

The canonical release target is the public, unscoped `forgix` package on npmjs.
GitHub Packages contains a scoped mirror because its npm registry accepts only scoped
names. Mirror input always comes from the already-published npmjs tarball; the workflow
validates source name, version, and repository, then changes only the package name.

Because this repository is private, the first linked GitHub package initially inherits
private visibility. After separate approval, create a public mirror without racing the complete
backfill:

1. Merge the mirror workflow to the default branch.
2. Obtain separate authorization for package publication, then publish only the oldest
   version:

   ```bash
   gh workflow run publish-github-package.yml -f versions="<oldest-published-forgix-version>"
   ```

3. Wait for success. Open the new `@acrazie/forgix` package settings and change
   visibility to **Public**. This UI operation is deliberately manual.
4. Obtain confirmation immediately before the visibility change: making a GitHub
   package public cannot be reversed.
5. Backfill every stable npmjs version:

   ```bash
   gh workflow run publish-github-package.yml -f versions=all
   ```

The `all` selector discovers stable npmjs versions, skips exact versions already present
in GitHub Packages, and publishes missing versions oldest first. A precise stable
version, `v<version>`, or `npm-v<version>` may also be dispatched for targeted recovery.
Publishing the public package exposes only content already present in the public npmjs
tarball; it does not make the private source repository readable.

## Cancellation and failure recovery

### Complete npm publication for an existing Release Please release

When Release Please has already merged a release PR and published its GitHub release,
but the corresponding npm version is missing, use:

```bash
bun run release --publish-existing forgix-v1.0.1
```

This mode verifies the published stable GitHub release, the local and remote tag commit,
and ancestry on `origin/main`. It exports that exact commit into a temporary directory,
requires its pinned Bun version, installs frozen workspace dependencies, runs release
validations and the full quality gate, and previews npm publication before confirmation.
The invoking checkout is not published, so it may contain the recovery-tool correction
on a dedicated branch. No version, plugin manifest, tag, or GitHub release is changed.
An already-published npm version is skipped. Only the missing npm publication is performed.

The existing GitHub release event is not emitted again. If a GitHub Packages mirror is
required, dispatch the repository mirror workflow for the exact npm version after npm
publication is verified; do not create another release.

### Before first successful push

Cancellation, `Ctrl+C`, or validation failure restores original release files and
removes only commit or tag objects created by program. Inspect:

```bash
git status --short
git log -1 --oneline
```

Fix cause, ensure clean `main`, then restart with `bun run release`.

### After push, npm publication, or GitHub publication begins

Do not delete remote tag, rewrite `main`, unpublish package, or create replacement
release manually. Published systems are not one atomic transaction and program never
attempts remote rollback.

Keep checkout on clean release commit and rerun:

```bash
bun run release
```

Program recognizes release commit, reconciles Git, npm, and GitHub state, displays
missing steps, then asks whether to resume. Already completed publication steps are
skipped. This also handles case where npm accepted package but local command lost its
response.

If all remote publication steps succeeded and only optional local plugin refresh
failed, do **not** rerun release solely for that refresh. Run it directly:

```bash
codex plugin marketplace upgrade acrazie
codex plugin add forgix@acrazie
```

Then start a new Codex thread.

If the asynchronous GitHub Packages mirror fails, do not create another npm or GitHub
Release. Rerun the failed Actions job or dispatch its exact stable version. Existing
destination versions are verified and skipped, so recovery is idempotent. Authentication,
network, malformed metadata, and unexpected registry responses block instead of being
treated as a missing version.

### Bad release discovered after completion

Prefer forward correction: fix defect and publish a new patch or plugin-cachebuster
release. Published npm versions are immutable release identities and must never be
reused.

## Forbidden shortcuts

- No validation bypass or force-publish path.
- No manual version edits followed by direct publish.
- No direct `npm publish` or `bun publish` of the canonical npmjs package outside the
  release program. The repository-owned GitHub Packages mirror workflow is the only
  scoped-alias exception.
- No manual tag or GitHub Release for a new release.
- No automatic or manual merge/rebase/reset inside release procedure.
- Never commit npm tokens, GitHub tokens, OTP values, or generated credential files.
