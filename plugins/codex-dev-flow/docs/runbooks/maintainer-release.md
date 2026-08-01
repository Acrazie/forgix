# Maintainer Release Runbook

## Purpose and ownership

This runbook is the canonical production-release procedure for Codex Dev Flow. A
maintainer runs it from a trusted local workstation. The repository currently has no
CI workflow and CI does not publish the npm package or the Codex plugin.

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

- Run on macOS. Linux is best-effort. Windows is rejected.
- Install repository-pinned Bun version from root `package.json`.
- Install `git` and GitHub CLI `gh`.
- Have push permission for `origin/main` and release creation permission on GitHub.
- For npm or combined release, have publish permission for `codex-dev-flow`.
- Keep `main` clean, with no staged, unstaged, or untracked files.
- Ensure local `main` can fast-forward to `origin/main`; release program never rebases,
  resets, or creates a merge commit.

Authenticate without placing credentials in repository files:

```bash
gh auth status
cd plugins/codex-dev-flow
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

Start a new Codex thread after local plugin refresh so new plugin version loads.

## Verification

Use tag printed by release program:

```bash
git show --no-patch <tag>
gh release view <tag>
```

For npm or combined target, use npm version printed by release program:

```bash
npm view codex-dev-flow@<version> version
```

Expected final state:

- local and remote `main` point to release commit;
- annotated tag points to same commit;
- GitHub Release exists for tag;
- selected npm version exists when applicable;
- worktree is clean.

The release commit, tag, npm registry entry, and GitHub Release are durable audit
records. No separate local release-state file exists.

## Cancellation and failure recovery

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
codex plugin add codex-dev-flow@acrazie
```

Then start a new Codex thread.

### Bad release discovered after completion

Prefer forward correction: fix defect and publish a new patch or plugin-cachebuster
release. Published npm versions are immutable release identities and must never be
reused.

## Forbidden shortcuts

- No validation bypass or force-publish path.
- No manual version edits followed by direct publish.
- No direct `npm publish` or `bun publish` outside release program.
- No manual tag or GitHub Release for a new release.
- No automatic or manual merge/rebase/reset inside release procedure.
- Never commit npm tokens, GitHub tokens, OTP values, or generated credential files.
