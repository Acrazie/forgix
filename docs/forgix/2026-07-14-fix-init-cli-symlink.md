# Fix standalone init CLI symlink execution

## 1. Context and outcome

`codex-dev-flow init` exits successfully without output when invoked through the executable symlink created by `npm link`. The CLI entrypoint compares the invoked symlink URL with the resolved bundle URL, decides it is being imported, and never calls `main()`.

Outcome: invoking the installed or linked terminal command starts the CLI reliably and allows the interactive initialization wizard to create `.codex/dev-flow.yaml`.

## 2. Scope and non-goals

In scope:

- Make executable-entry detection work through package-manager symlinks.
- Add a distribution-level regression test that invokes the bundle through a symlink.
- Clarify how the standalone binary is exposed from a source checkout if documentation needs adjustment.

Non-goals:

- Publish the package to npm.
- Make plugin-marketplace installation modify the user's global `PATH`.
- Redesign wizard questions, configuration schema, or `$dev-flow` chat commands.

## 3. Constraints and decisions

- Preserve import safety: importing `dist/dev-flow.mjs` must not execute the CLI.
- Preserve Node.js 22.18 minimum and ESM-only distribution.
- Keep runtime offline and bundled, without install lifecycle scripts.
- Use runtime-native main-module detection or equivalent canonical-path comparison that supports symlink invocation.
- Tests must exercise the executable boundary, not only call `runInit()` directly.

## 4. Acceptance criteria with stable identifiers

- **AC-1:** A symlink to `dist/dev-flow.mjs` executes `config validate --json` and returns valid CLI JSON with exit code 0.
- **AC-2:** Importing `dist/dev-flow.mjs` remains side-effect free.
- **AC-3:** `codex-dev-flow init` no longer exits silently when invoked through the `npm link` binary.
- **AC-4:** Existing init, parsing, routing, and distribution tests remain green.
- **AC-5:** Supported installation/linking instructions accurately describe terminal availability.

## 5. Implementation plan mapping tasks to acceptance criteria

1. Update CLI entrypoint detection to recognize direct and symlinked executable invocation while retaining safe imports. Covers AC-2, AC-3.
2. Extend distribution tests with a temporary executable symlink and a non-interactive CLI subcommand; retain existing import test. Covers AC-1, AC-2, AC-3.
3. Review standalone CLI documentation and make the source-link versus marketplace-install distinction explicit where needed. Covers AC-5.
4. Rebuild bundle, run targeted tests, full project check, and manual isolated symlink reproduction. Covers AC-1 through AC-5.

Dependencies: task 1 precedes rebuilt-distribution verification. Tasks 2 and 3 may be prepared independently after task 1 behavior is defined.

## 6. Risks and rollback

- Risk: an overly broad main-module check could run the CLI during library import. Mitigation: retain explicit import regression coverage.
- Risk: symlink creation differs on Windows. Mitigation: scope Unix symlink regression appropriately while retaining platform-neutral direct/import tests.
- Risk: generated bundle can drift from source. Mitigation: rebuild through the existing build script and verify the committed distribution.

Rollback: revert entrypoint, regression-test, documentation, and rebuilt-bundle changes together. No configuration migration or user-data rollback is required.

## 7. Verification evidence

Discovery evidence before implementation:

- `codex-dev-flow init` through the linked global binary exited 0 with no output.
- The global binary is a symlink resolving to this checkout's `dist/dev-flow.mjs`.
- Direct bundle execution reached `main()` and reported the expected interactive-terminal error under captured stdin/stdout.
- Existing targeted suite passed: 11 tests, 0 failures.

Implementation evidence:

- Approval received before implementation.
- Red-phase regression: `node --test test/distribution.test.mjs` failed because the symlinked executable returned empty stdout.
- Targeted distribution suite after correction: 5 tests passed, 0 failed, including ESM import and package-manager symlink execution.
- `npm run check`: typecheck passed, bundle rebuilt, 45 tests passed, 0 failed.
- Global linked `codex-dev-flow config validate --json`: exit 0 with `command: "config_validate"` and `status: "valid"`.
- Global linked `codex-dev-flow init` under non-interactive captured streams: exit 10 with `init requires an interactive terminal.` This confirms the linked entrypoint executes instead of exiting silently; interactive wizard behavior remains covered by init tests.
- `git diff --check`: exit 0.
- Review against AC-1 through AC-5 found no actionable regression, security issue, maintainability issue, uncovered criterion, or unapproved scope deviation.
- Node 22 and 24 CI were not run locally; compatibility is enforced by the Node 22.18 build target, `import.meta.main` runtime floor, and existing CI matrix.
- Material deviations: none.
