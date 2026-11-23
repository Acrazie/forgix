# Maintainer Release Runbook

## Entire migration: read-only preflight

The new `publish-entire-npm.yml` workflow is currently a manual connectivity and
evidence check, not a publisher. After its reviewed PR is merged into GitHub
`main`, launch a new run from Actions on `main`. Native reruns are rejected;
start a fresh manual run instead. The `entire-release-read` environment must
allow only `main` and contain `BUILDKITE_READ_TOKEN` with only `read_builds` and
`read_artifacts`, with a future expiry.

The first job uses the pinned official Entire action and the repository-scoped
reader identity to resolve the annotated `npm-v4.0.0` witness tag. The second,
without OIDC permissions, inspects Buildkite builds 81 and 82 and the tag build's
artifact metadata. It checks the distinction between a branch commit and an
annotated tag object. Build 82's overall failure is recorded, not treated as
permission to publish. No candidate scripts run, source objects are not exported,
artifacts are not downloaded, and no npm publication or mirror write is possible.

A successful preflight establishes only these read paths and witness identities.
It does not prove tag immutability, mirror write restrictions, smoke-to-artifact
binding, npm OIDC, or recovery after publication. These remain prerequisites for
the later publisher implementation and cutover. Do not enable a schedule or
create a new npm release tag as part of this check.

The sections below describe the legacy GitHub-only release path. Do not use
their activation instructions to re-enable the old publisher during this migration.

## Ownership and release identities

GitHub Actions is the only publication authority. `bun run release` prepares a PR;
it never commits, pushes, creates a tag, publishes a package, or installs a plugin.
Release Please and the former local publication/resume path are retired.

| Target        | Tag                                  | Publication                                     |
| ------------- | ------------------------------------ | ----------------------------------------------- |
| npm + plugins | `vX.Y.Z`                             | npmjs, GitHub Release, GitHub Packages mirror   |
| npm only      | `npm-vX.Y.Z`                         | npmjs, GitHub Release, GitHub Packages mirror   |
| plugins only  | `plugin-vX.Y.Z-codex.YYYYMMDDhhmmss` | GitHub Release; plugin files are already in Git |

Only stable npm versions are supported. Plugin-only preparation keeps the existing
semantic base and rotates the Codex UTC cachebuster. It does not promise equivalent
update notifications in Claude Code or Antigravity. npm-only preparation leaves plugin
manifests unchanged. Combined preparation aligns all semantic bases.

npmjs `@acrasie/forgix` remains canonical. GitHub Packages `@acrazie/forgix` is a mirror
of that npmjs tarball, with only the package name transformed. No package is renamed.

## One-time activation, before any new release tag

A maintainer must verify these settings separately from merging this migration:

1. Keep `Acrazie/forgix` and the npmjs package public. Provenance is mandatory; a
   private source repository must block publication rather than silently disabling it.
2. On npmjs, configure the existing package's trusted publisher: GitHub user `Acrazie`,
   repository `forgix`, workflow filename `release.yml`, direct `npm publish` allowed.
   Set its environment name to `release`. Before tagging, create that GitHub environment
   and restrict deployment branches/tags to the protected release tag patterns only;
   branches, including `main`, must not be eligible. Do not rely on automatic environment
   creation: a name without protection is not a security boundary. Verify only authorized
   maintainers can modify these rules. No long-lived npm token is used.
3. Confirm effective tag rules restrict creation of all three release families to
   authorized maintainers and prevent updates/deletions. Protecting `main` alone is not
   proof of tag protection. Do not weaken branch or tag rules to make a run succeed.
4. Inventory tags, GitHub Releases and npm versions; reconcile any partial publication
   before activation. Migration inspection found only `v1.0.0` and `v1.0.1` tags/releases,
   npm stable versions `1.0.0`/`1.0.1`, and historical `0.0.0-stage`. Recheck live state.
   No historical tags need alias configuration or automatic backfill.
5. Confirm Actions can write GitHub Releases and GitHub Packages with repository-scoped
   `GITHUB_TOKEN`. Set the mirror package's visibility separately if needed; this
   workflow does not administer package or repository settings.

Bun and Node use repository pins. Preparation requires `git-cliff 2.14.1` on PATH.
CI installs that same version and npm `11.21.1` (OIDC requires npm >=11.5.1).
`npm whoami` and a dry run do not establish that trusted publishing works.

## Prepare and approve

On a clean work branch based on current `main`, run from the repository root:

```bash
bun run release
```

Choose target, preview or retained preparation, and the npm version when applicable.
The first Node >=26 migration npm release must account for its breaking runtime floor;
the tool recommends a major while the maintainer retains final version authority.
The command prepares targeted manifests, lockfile when needed, deterministic committed
bundle and a new `plugins/forgix/CHANGELOG.md` section. It runs the full local gate.
Preview, failure or cancellation restores the prepared files; it never changes remotes.
Unexpected generated files block preparation and must be inspected, not blindly deleted.

Notes use separate npm and plugin predecessor histories. A plugin-only tag never hides
changes from subsequent npm notes. Combined notes share a section only when ranges are
identical. The changelog stores the chosen date and predecessor tags; CI regenerates
and compares notes without rewriting historical entries. Breaking changes are preserved.

Review the diff and notes, then ship a preparation PR using the normal repository Git
workflow. Squash-merge with the exact `chore(release): <tag>` title printed by preparation.
No automatic release PR is created. If `main` advances with included changes, refresh
preparation and rerun checks; CI rejects stale notes or a bundle differing from Git.

After merge and validation, verify the exact main commit and the printed tag. Creation
and push of that tag explicitly authorize publication; do not tag an unreviewed branch.
Use the reviewed literal tag and commit, never a guessed version:

```bash
git fetch origin main --tags
git tag -a <printed-tag> <validated-main-sha> -m "chore(release): <printed-tag>"
git push origin refs/tags/<printed-tag>
```

These are operator steps, not authorization for an agent to execute a release. Do not
reuse old `forgix-v*` tags, move tags, push commits directly to `main`, or publish locally.

## CI and evidence

The release workflow resolves the tag to an immutable SHA, checks its integration into
`main`, validates target manifests and version ownership, and runs the full Ubuntu/macOS
CI on that source. Release validation compares the committed bundle and prepared notes.
For npm, it packs once with lifecycle scripts disabled, tests that exact tarball on
Ubuntu/macOS, then promotes it without rebuilding or installing project dependencies.

The npm job alone receives OIDC permission and must pass the protected `release`
environment. Binding the npm trusted publisher to that environment prevents a modified
workflow dispatched from an unmerged branch from acquiring publication authority. After publish, native npm signature and
provenance verification must establish package integrity, repository, workflow, tag and
source SHA. Verification installs the published package only in an empty temporary
sandbox, with lifecycle scripts and bin links disabled. The GitHub job then publishes
or reconciles the stable Release and calls the mirror explicitly. No reliance on a
`release: published` event generated by `GITHUB_TOKEN` remains.

Read the separate source, validation, npm, GitHub and mirror results in the Actions run
summary. A failed mirror does not undo npm or GitHub publication. Actions artifacts
include release metadata, notes and, for npm, the tested tarball with SHA-512 integrity.
Successful local tests or workflow parsing are not evidence of actual OIDC publication.

## Retry and failure handling

Prefer rerunning the original run for the same immutable tag. A manual retry must use
that tag as **both** the workflow reference and the `tag` input:

```bash
gh workflow run release.yml --ref <existing-tag> -f tag=<existing-tag>
```

The workflow must exist on default branch for dispatch availability. Dispatching from
`main` with only a tag input is rejected: checking out a tag does not fix the workflow's
source SHA used in provenance. A moved tag, incompatible manifests, different tarball
integrity, conflicting tag ownership or missing provenance blocks automatic recovery.

If npm accepted a version before a timeout, rerun reconciles registry state and verifies
its exact bytes and provenance before skipping publication. Never retry a raw publish
blindly. If GitHub Release is missing, the workflow creates only that missing step after
reverification. Existing incompatible notes/releases are not overwritten. Old retries
cannot regress npm `latest` or promote an old/plugin-only GitHub Release to latest.

If only the mirror failed, rerun its job or dispatch the exact stable npm version:

```bash
gh workflow run publish-github-package.yml -f versions=<exact-stable-version>
```

Manual `versions=all` remains available only for separately authorized historical
backfill. Plugin-only release never calls the mirror. Release runs share a serialization
queue across tag families; up to 100 runs can wait, surplus runs are cancelled. Dispatch
order is not guaranteed. Recover a cancelled tag explicitly rather than recreating it.

Before any publication, revert the migration through a normal reviewed PR if needed.
After publication, prefer forward correction with a new stable version or plugin
cachebuster. Never unpublish, rewrite `main`, retag or attempt automatic remote rollback.
The former `--publish-existing` option cannot publish locally anymore.
