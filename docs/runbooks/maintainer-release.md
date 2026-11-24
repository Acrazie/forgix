# Maintainer Release Runbook

## Ownership and release identities

Entire is the canonical source. Buildkite validates release candidates but does
not publish. GitHub Actions is the intended npm publisher via Trusted Publishing.
Do not create npm release tags until the new publisher has been verified and activated.
`bun run release` prepares a release branch;
it never commits, pushes, creates a tag, publishes a package, or installs a plugin.
Release Please and the former local publication/resume path are retired.

| Target        | Tag                                  | Publication                            |
| ------------- | ------------------------------------ | -------------------------------------- |
| npm + plugins | `vX.Y.Z`                             | npmjs (`@acrasie/forgix`)              |
| npm only      | `npm-vX.Y.Z`                         | npmjs (`@acrasie/forgix`)              |
| plugins only  | `plugin-vX.Y.Z-codex.YYYYMMDDhhmmss` | Git tag only; plugin files live in Git |

Only stable npm versions are supported. Plugin-only preparation keeps the existing
semantic base and rotates the Codex UTC cachebuster. It does not promise equivalent
update notifications in Claude Code or Antigravity. npm-only preparation leaves plugin
manifests unchanged. Combined preparation aligns all semantic bases.

npmjs `@acrasie/forgix` remains canonical. No package is renamed.

## One-time activation, before any new release tag

A maintainer must verify these settings separately from merging this migration:

1. Keep `/et/forgix/forgix` (`https://entire.com/et/forgix/forgix`) linked to the
   Buildkite pipeline (`.buildkite/pipeline.yml`) and keep the npmjs package public.
2. Verify all old publishing jobs are drained. Revoke the legacy npm token and
   remove `NPM_TOKEN` from Buildkite. Confirm that no build can obtain npm
   publication privileges before enabling the advisory TLC job.
3. Confirm effective tag rules restrict creation of all three release families to
   authorized maintainers and prevent updates/deletions. Protecting `main` alone is not
   proof of tag protection. Do not weaken branch or tag rules to make a run succeed.
4. Inventory tags and npm versions; reconcile any partial publication before activation.
5. Verify the GitHub mirror and the exact-tag Buildkite veto in an isolated
   publication trial. Enable npm Trusted Publishing only after the new workflow
   and its environment restrictions are verified.

Bun and Node use repository pins. Preparation requires `git-cliff 2.14.1` on PATH.
CI installs that same version. A successful Buildkite run does not establish
GitHub publication or registry acceptance.

## Prepare and approve

On a clean work branch based on current `main`, run from the repository root:

```bash
bun run release
```

Choose target, preview or retained preparation, and the npm version when applicable.
The first Node >=26 migration npm release must account for its breaking runtime floor;
the tool recommends a major while the maintainer retains final version authority.
The command prepares targeted manifests, lockfile when needed, deterministic committed
bundle and a new `CHANGELOG.md` section. It runs the full local gate.
Preview, failure or cancellation restores the prepared files; it never changes remotes.
Unexpected generated files block preparation and must be inspected, not blindly deleted.

Notes use separate npm and plugin predecessor histories. A plugin-only tag never hides
changes from subsequent npm notes. Combined notes share a section only when ranges are
identical. The changelog stores the chosen date and predecessor tags; CI regenerates
and compares notes without rewriting historical entries. Breaking changes are preserved.

Review the diff and notes, then ship the preparation branch through Entire Trails
(`entire trail create`) using the normal repository Git workflow. Merge with the exact
`chore(release): <tag>` title printed by preparation. No automatic release branch is
created. If `main` advances with included changes, refresh preparation and rerun checks;
CI rejects stale notes or a bundle differing from Git.

After merge, validation, and cutover, verify the exact main commit and printed
tag. Review the commit and its ancestry before authorizing export to public GitHub.
For an npm or combined tag, attest this review in the tag annotation. Do not
tag an unreviewed branch.
Use the reviewed literal tag and commit, never a guessed version:

```bash
git fetch origin main --tags
git tag -a <printed-tag> <validated-main-sha> -m "chore(release): <printed-tag>" -m "Mirror-Export: approved"
git push origin refs/tags/<printed-tag>
```

These are operator steps, not authorization for an agent to execute a release. Do not
reuse old `forgix-v*` tags, move tags, push commits directly to `main`, or publish locally.

### Synchronizing the public GitHub mirror

To publish the root-layout plugin tree (`plugin.json`, `skills/`, `dist/forgix.mjs`) to
`https://github.com/Acrazie/forgix` while preserving `.github/` workflows (including
`publish-entire-npm.yml`), preview first and then apply explicitly:

```bash
bun scripts/sync-github-mirror.ts --dry-run
bun scripts/sync-github-mirror.ts --target git@github.com:Acrazie/forgix.git --push-branch mirror/sync-root-layout --apply
```

## CI and evidence

The Buildkite release pipeline resolves `BUILDKITE_TAG` / `BUILDKITE_COMMIT` to an
immutable SHA, checks its integration into `main`, validates target manifests and version
ownership, and runs `bun run check` on that source. Release validation compares the
committed bundle and prepared notes. For npm, it packs once with lifecycle scripts
disabled. The runtime smoke job downloads the tarball from one specific
`quality-gate` job attempt. On success it uploads `.artifacts/runtime-smoke.json`
with the smoke job ID, producer job ID, tarball artifact ID, and SHA-512 of the
tested bytes. If `quality-gate` is retried, rerun smoke before relying on this
receipt for the new attempt. Buildkite does not have a publish step.

After publish, registry verification confirms the published package version and tarball
SHA-512 integrity against the packed artifact. Read the separate validation and npm
results in Buildkite and GitHub Actions respectively. Successful local tests
are not evidence of actual registry publication.

## Retry and failure handling

For a CI failure, verify the original immutable tag and review the failed Buildkite job.
A moved tag, incompatible manifests, different tarball integrity, or conflicting tag
ownership blocks automatic recovery.

If npm might have accepted a version before a timeout, reconcile the durable
intent against the registry and provenance before another publication attempt.
Never retry a raw publish or advance npm `latest` blindly.

Before any publication, revert the migration through a normal reviewed Entire Trail if
needed. After publication, prefer forward correction with a new stable version or plugin
cachebuster. Never unpublish, rewrite `main`, retag or attempt automatic remote rollback.
The former `--publish-existing` option cannot publish locally anymore.
