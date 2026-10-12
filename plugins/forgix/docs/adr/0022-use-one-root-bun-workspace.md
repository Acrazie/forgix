# ADR 0022: Use One Root Bun Workspace

## Status

Accepted.

## Context

Repository-wide quality tools and Husky execute from the Git root, while the publishable
plugin currently owns a separate Bun installation and lockfile. Adding an independent
root installation would duplicate dependency resolution, cache state, and frozen-lock
validation.

Placing repository tooling inside the plugin package would invert ownership and require
commands to reach outside the package boundary.

## Decision

Convert the private root package into the Bun workspace owner with
`workspaces: ["plugins/*"]` and one committed root `bun.lock`.

The root package owns repository-level quality dependencies and orchestration scripts,
including Husky, Oxfmt, Oxlint, and the staged-file adapter. The plugin workspace remains
self-contained in its manifest and declares its build, test, release, and product-facing
development dependencies.

Install the repository once from the root with `bun install --frozen-lockfile`. Remove
the nested plugin lockfile after verifying identical or intentionally updated resolved
versions.

Publishing continues from `plugins/codex-dev-flow`; the private root package is never
packed or published.

## Consequences

- Local development and CI use one install and one dependency graph.
- Repository tools have the same scope as their owning package.
- Workspace isolation helps expose undeclared plugin dependencies.
- Release scripts and documentation must stop assuming a nested lockfile or plugin-local
  install.
- Lockfile migration requires reviewing resolved-version and platform-binary changes.
