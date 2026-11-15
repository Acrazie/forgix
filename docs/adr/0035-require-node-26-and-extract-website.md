# 0035. Require Node.js 26 and Extract the Public Website

## Status

Accepted. Amends Node.js 24 baseline in plugin ADRs 0012, 0013, 0020, and 0032; supersedes [ADR 0032](0032-keep-the-public-website-in-the-product-repository.md).

## Context

The repository previously pinned Node.js 24 (`>=24.0.0`) for the `forgix` CLI and repository CI lanes while running the Astro public website scaffold (`site/`) on Node 26 via Bun's isolated linker in `bunfig.toml`. Keeping `site/` inside the monorepo required isolated workspace linking, a separate `website` CI lane, root `site:*` scripts, and coupling between product releases and the public showcase.

## Decision

1. **Require Node.js 26 (`>=26.0.0`) across the plugin and repository**:
   - Keep `.node-version` on Node 26 (`26.8.1`), update `runtime-smoke` CI matrix to `[26]`, `plugins/forgix/package.json` `engines.node` to `>=26.0.0`, `vite.config.ts` `distribution.target` to `node26.0`, and `@types/node` to `26.6.6`.
   - Amend plugin ADRs `0012`, `0013`, `0020`, and `0032` in place with the `Node.js >=26.0.0` floor without renaming packaged files.
2. **Extract the public website to a standalone project**:
   - Move `site/` out of `forgix` into standalone `/Users/acrazie/Fluidise/forgix-site` on Node 26 without `.git/` history or GitHub Actions CI coupling.
   - Remove `site` from root `package.json` workspaces and scripts, remove `[install] linker = "isolated"` from `bunfig.toml`, remove `site/.astro/` from `.gitignore`, and remove the `website` job from `.github/workflows/ci.yml`.
   - Keep `forgix`'s own Git workflow, GitHub Actions CI, and GitHub Packages publish workflows intact.

## Consequences

- `forgix` drops support for Node.js 25 and older (`engines.node: ">=26.0.0"`), which represents a breaking SemVer major runtime floor change for the next release.
- Root dependency installation returns to Bun's default workspace layout without `site/`-specific isolated linker overhead or `site` CI coupling.
- The public website evolves independently under `/Users/acrazie/Fluidise/forgix-site`.
