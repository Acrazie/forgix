# ADR 0032: Consolidate Development Tooling with Vite+

## Status

Accepted for quality and packaging. Hook activation and replacement of Commitlint
remain separately gated pending installation approval and policy parity evidence.

## Context

The repository maintains separate Oxfmt, Oxlint, type-aware lint integration, and
esbuild dependencies. Keeping them is viable, but the approved modernization aims
to consolidate ownership and configuration using the VoidZero toolchain without
changing the published CLI contract or replacing the existing test oracle.

## Decision

Use pinned Vite+ 1.6.0 for formatting, linting, and tsdown/Rolldown packaging. Root
`vite.config.ts` owns their settings. The plugin declares the same Vite+ version
because its build directly imports the public `vite-plus/pack` API. No separate
tsdown or Rolldown dependency is needed.

Keep the Node ESM distribution as one executable `dist/forgix.mjs`, with all
non-platform runtime dependencies bundled, no sourcemap, and a Node 24 compilation
target. Repository development uses Node 26; packed-runtime CI tests Node 24 and
Node 26 on Linux and macOS. Do not raise the public `engines.node` minimum.

Retain Bun 1.4.4, the isolated workspace linker, existing `bun:test` suites,
randomization verification, coverage thresholds, and artifact budgets. Retain the
site's Astro build and TypeScript 6 checker separately from repository TypeScript 7. Do not apply a workspace-wide Vite alias merely to consolidate an independent,
working website build, and do not migrate tests to the bundled Vitest runner.

The staged adapter calls check-only Vite+ formatter and native linter commands
without shell interpolation, fixes, stashing, or restaging. Keep this adapter
rather than adding lint-staged's index-management behavior. Existing exclusion
rules and lint severities remain authoritative.

Vite+ hooks are the approved destination for hook orchestration. Remove Lefthook
only after the replacement is verified and activation is separately approved.
CLINT is the intended commit validator only if policy compatibility is established
or exact policy changes are explicitly accepted. Do not silently remove current
Commitlint protections: exploratory checks already show differences in terminal
punctuation, header length, fixup messages, and body separation.

## Consequences

- Fewer independently selected tool versions and one quality/packaging config.
- The unified development dependency also contains tools this repository does not
  use; consolidation does not imply a smaller dependency installation.
- Formatter-version changes may require narrowly scoped formatting-only updates.
- The build adapter retains in-memory generation for byte-for-byte source/bundle
  verification, explicitly prevents cleanup, and disposes native build resources.
- Published artifacts must remain reproducible and inside unchanged size limits.
- No speed improvement is claimed without comparable measurements.

## Evidence

Checked 2026-11-15 against Vite+ 1.6.0's installed public exports, type declarations,
and documentation; build and compatibility outcomes are recorded separately in
migration validation evidence, not inferred from documentation alone.

- [Vite+ local CLI](https://viteplus.dev/guide/local-cli)
- [Vite+ packaging](https://viteplus.dev/guide/pack)
- [Vite+ commit hooks](https://viteplus.dev/guide/commit-hooks)
- [tsdown programmatic usage](https://tsdown.dev/advanced/programmatic-usage)
