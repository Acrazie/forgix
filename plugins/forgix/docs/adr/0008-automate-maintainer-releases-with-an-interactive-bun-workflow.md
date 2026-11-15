# ADR 0008: Automate Maintainer Releases with an Interactive Bun Workflow

## Status

Superseded for preparation/publication by the [tag-based CI release design](../../../../docs/forgix/2026-11-15-git-cliff-release.md) and current [maintainer runbook](../runbooks/maintainer-release.md). The historical decision below is retained; local publishing and resume are no longer supported.

## Context

Releasing Codex Dev Flow currently requires the maintainer to remember unrelated Git,
plugin-cache, npm-registry, and Codex marketplace commands. Some commands depend on
machine-specific absolute paths, and the Codex plugin and npm package have different
publication mechanisms. This makes an otherwise routine release error-prone and leaves
partial-release recovery implicit.

The maintainer needs a self-service release flow with one memorable command, explicit
authority before irreversible actions, deterministic recommendations, and no model call.

## Decision

The repository will expose this command from its root:

```bash
bun run release
```

A private root `package.json` delegates to a TypeScript release program in the plugin
package. The program runs with Bun and uses `@clack/prompts`. V1 guarantees macOS
support, avoids shell-specific implementation, is expected to work on Linux, and does
not claim tested Windows support. The repository migrates from `package-lock.json` to a
single committed `bun.lock`.

The first prompt selects one release target:

- Codex plugin;
- npm package;
- Codex plugin and npm package, selected by default.

The next prompt selects publication or read-only preview. Preview performs discovery,
version recommendation, preflight checks, and summary generation without modifying the
workspace or any remote system.

V1 publishes stable versions only. A deterministic Conventional Commits analysis
recommends the version increment:

- `fix:` recommends patch;
- `feat:` recommends minor;
- `!` or `BREAKING CHANGE:` recommends major;
- unclassified commits recommend patch.

The maintainer may choose patch, minor, major, or a greater unpublished custom stable
version. For a plugin-only release, the semantic base remains unchanged and only the
Codex cachebuster changes. For an npm-only release, only the package semantic version
changes. A combined release gives both artifacts the same semantic base and adds the
cachebuster only to the plugin manifest.

Release identities are target-specific:

```text
combined:    v0.2.0
npm only:    npm-v0.2.0
plugin only: plugin-v0.2.0-codex.20260728...
```

The corresponding commit uses `chore(release): <release-identity>`. The Git tag is
annotated and follows the local Git signing configuration.

Before changing files, the program requires a clean `main`, fetches `origin/main`, and
fast-forwards when safe. It refuses local commits, divergence, conflicts, or another
branch. It never resets, rebases, or merges automatically.

All applicable validation is mandatory and has no force-publish bypass:

- frozen Bun dependency installation;
- typecheck, deterministic build, and tests;
- plugin manifest validation;
- npm package-content dry run;
- target-version availability;
- GitHub and npm authentication;
- expected clean or allowlisted generated-file state.

The release commit may contain only the plugin manifest, affected package metadata,
`bun.lock` when required, and the deterministic distribution bundle. Any other generated
change blocks the release.

Authentication is checked before mutation. The program never reads, prompts for, logs,
or stores credentials. Missing authentication produces an exact corrective command and
requires the maintainer to rerun the release. OTP handling remains inside `bun publish`.

The program generates GitHub release notes before publication, displays a non-editable
preview, and lets the maintainer accept or abort. The final Clack confirmation defaults
to `No` and summarizes target, versions, tag, files, checks, publication order, and
planned local installation.

Before the first successful push, cancellation, `Ctrl+C`, or failure restores the exact
original bytes and removes only local commit or tag objects created by the program. Once
an external publication succeeds, the program never attempts automatic rollback.

Publication order is:

1. push the release commit and tag;
2. publish the npm package with `bun publish` when applicable;
3. create the GitHub Release from the previewed notes;
4. optionally refresh marketplace `acrazie`, reinstall `codex-dev-flow`, and remind the
   maintainer to start a new Codex thread.

Git and registry state form the recovery record. A later `bun run release` detects a
partial release and offers the single missing idempotent action instead of creating a
new version. No local state file or secret is required.

## Consequences

- Routine release operation becomes one short command with maintainer-controlled
  decisions and no model dependency.
- Plugin and npm releases may remain independent without ambiguous Git tags.
- Strict preflight and generated-file allowlists reduce accidental publication.
- Git, npm, and GitHub cannot form one atomic transaction, so explicit partial-release
  detection and resume behavior are required.
- Root release orchestration, Bun lockfile migration, subprocess isolation, cancellation,
  and recovery paths require dedicated deterministic tests.
- V1 intentionally excludes prereleases, editable release notes, Windows guarantees, and
  validation bypasses.
