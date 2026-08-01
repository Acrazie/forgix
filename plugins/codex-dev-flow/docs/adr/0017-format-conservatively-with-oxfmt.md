# ADR 0017: Format Conservatively with Oxfmt

## Status

Accepted.

## Context

Repository-wide formatting should remove presentation drift without introducing
unrelated ordering changes or rewriting documentation prose. Oxfmt enables package JSON
sorting by default and offers optional import sorting, but either behavior expands the
initial migration and can obscure review of the formatting adoption.

Import order can also be observable for modules with side effects. Formatting does not
need to own that policy.

## Decision

Commit one explicit JSON Oxfmt configuration at the repository root with conservative,
stable choices:

- `printWidth: 100`
- `semi: true`
- `singleQuote: false`
- `trailingComma: "all"`
- `proseWrap: "preserve"`
- `sortImports: false`
- `sortPackageJson: false`

Use the same configuration in editors, the Fast Gate, and the Full Gate. Apply the
initial repository-wide formatting change in a dedicated commit so later functional
diffs are not mixed with formatter churn.

Import and manifest ordering remain outside formatter ownership unless a later decision
adds them with dedicated compatibility evidence.

## Consequences

- Source, configuration, schema, workflow, and documentation layout becomes
  deterministic without broad ordering churn.
- Markdown prose retains author-selected wrapping where possible.
- Package manifests keep their intentional field order.
- Imports with side effects retain their authored order.
- More configuration is explicit, reducing reliance on tool defaults that may differ
  from Prettier or change across tooling generations.
