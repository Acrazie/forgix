# ADR 0018: Use a High-Signal Oxlint Policy

## Status

Accepted.

## Context

Oxlint's default correctness category is intentionally small. Enabling every available
category would increase noise, style debate, and false-positive pressure. The repository
needs defects and likely defects to block changes without turning linting into a broad
code-style policy already owned by Oxfmt.

Oxlint may add diagnostics in minor releases without treating them as breaking changes.
Unpinned upgrades could therefore change the gate unexpectedly.

## Decision

Configure one high-signal repository-wide policy:

- `correctness`, `suspicious`, and `perf` diagnostics are blocking;
- `pedantic`, `style`, `restriction`, and `nursery` categories are disabled initially;
- unused Oxlint disable directives are blocking;
- the gate permits zero warnings; and
- Oxlint and `oxlint-tsgolint` use exact versions recorded in the lockfile.

Tool upgrades are explicit review events. Review newly activated diagnostics and fix or
document specific rule exceptions; never weaken a whole high-signal category merely to
complete an upgrade.

Oxfmt owns formatting. Oxlint style rules remain disabled unless a later behavior-driven
decision establishes value not already supplied by deterministic formatting.

Initial compatibility exceptions stay narrow and documented in `.oxlintrc.json`:

- `typescript/no-unsafe-type-assertion` is disabled because validated runtime boundaries
  intentionally narrow unknown data after deterministic schema checks;
- `eslint/no-await-in-loop` is disabled only in files whose prompts, filesystem changes,
  or release operations must remain sequential; and
- `typescript/no-floating-promises` is disabled only for test files, where test
  registration calls intentionally return promises that the runner owns.

These exceptions do not disable their parent high-signal categories. Revisit them when
the affected APIs or Oxlint analysis improve.

## Consequences

- Likely defects and performance footguns fail both applicable gates.
- Style and experimental diagnostics do not create routine noise.
- Exact versioning keeps local and CI results reproducible.
- Dependency upgrades may require intentional code fixes or narrow documented rule
  exceptions.
- The repository must review the rule configuration as Oxlint's stable coverage grows.
