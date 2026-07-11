# ADR 0001: Use a Hybrid Portable Workflow

## Status

Accepted.

## Context

The workflow must replace Superpowers for Codex while remaining portable across repositories and avoiding parallel write conflicts. Prompt-only workflows do not provide reliable state or policy enforcement. A monolithic command-line state machine would be too rigid for varied codebases.

## Decision

Publish `codex-dev-flow` as a Codex plugin with a single public `$dev-flow` skill. Internal skills own reasoning. Versioned scripts own deterministic operations: command parsing, configuration resolution, policy enforcement, state validation, fingerprints, and durable artifact handling.

The plugin reads repository guidance first, then inspects manifests, CI, and existing tests. It does not require an `AGENTS.md`, but repository guidance wins when present.

## Consequences

- One primary workflow avoids duplicated lifecycle rules.
- Scripts make safety-critical behavior testable and reproducible.
- Skills remain adaptable to repository-specific architecture.
- The plugin must keep schemas, scripts, and skill instructions compatible.
- The plugin cannot infer or grant Git or GitHub permissions.
