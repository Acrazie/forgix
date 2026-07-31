# ADR 0016: Use Husky with a Tested Bun Staged-File Adapter

## Status

Accepted.

## Context

The Fast Gate needs the exact set of staged, supported files. Husky installs and invokes
Git hooks but does not own robust staged-file discovery. Shell word splitting is unsafe
for valid paths containing whitespace or newline characters.

`lint-staged` supplies mature file selection and argument handling, but its mutation,
backup, and restoration features are unnecessary for a check-only gate. Adding it would
also add another dependency and configuration surface.

## Decision

Install Husky at the Git repository root as the pre-commit hook adapter. The hook
contains only a call to the root `check:staged` package script.

Implement `check:staged` as a small tested Bun script that:

1. obtains added, copied, modified, and renamed staged paths from Git with NUL-delimited
   output;
2. excludes deletions and configured generated, vendored, cached, lock, and distribution
   paths;
3. classifies supported formatter files separately from JavaScript and TypeScript lint
   files;
4. invokes Oxfmt in check mode and native Oxlint without shell interpolation;
5. batches arguments or falls back safely before platform argument limits;
6. preserves tool exit status; and
7. never edits a file or the Git index.

Do not add `lint-staged`. Test path parsing, classification, batching, empty sets,
renames, unusual valid path characters, and failing child-process status.

## Consequences

- The Fast Gate adds Husky but no staged-file orchestration dependency.
- Repository code owns a small security- and correctness-sensitive adapter and must test
  it as production-quality tooling.
- Hook behavior remains a thin projection of package scripts and cannot diverge into a
  second quality policy.
- Check-only behavior avoids partial-staging backup and restoration complexity.
