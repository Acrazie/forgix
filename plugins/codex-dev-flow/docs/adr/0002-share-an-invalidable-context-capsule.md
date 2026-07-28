# ADR 0002: Share an Invalidable Context Capsule Across Lifecycle Phases

## Status

Accepted.

## Context

Discovery, planning, execution, review, and verification can repeatedly inspect and
restate the same repository facts. This consumes quota and tokens without adding
assurance. Reusing unconstrained summaries would reduce cost but could also propagate
stale or unsupported claims across phases.

Codex Dev Flow optimizes quota and token consumption subject to two hard constraints:
reliability and absence of false success.

## Decision

Each durable Dev Flow task owns one compact Context Capsule. Lifecycle phases consume
the capsule and enrich it instead of independently reconstructing all prior context.

The capsule carries structured references to:

- objective, approved scope, mode, and risk;
- relevant files and symbols;
- effective constraints and policy;
- acceptance criteria and validation commands;
- decisions and evidence already obtained;
- Git, configuration, policy, and artifact fingerprints.

Every material claim records provenance and freshness inputs. Fingerprint changes
invalidate affected sections, not necessarily the whole capsule. A phase must reinspect
invalid, missing, or insufficient context before relying on it. It may never interpret
stale context as proof.

The capsule is a compact workflow projection, not a second owner for detailed evidence,
architecture decisions, or approved scope. Versioned change records and ADRs retain
those responsibilities.

## Consequences

- Repeated repository reading and prompt restatement decrease.
- Resume can reconstruct less conversational context.
- Phase contracts must declare capsule fields consumed and produced.
- Capsule schema, provenance, fingerprints, invalidation, and compaction require
  deterministic code and tests.
- Selective invalidation is more complex than a single opaque summary.
- Missing assurance data blocks or triggers reinspection; it never permits degraded
  success.

## Follow-up Decisions

- Define exact schema and storage projection with durable state work in P1.
- Define invalidation matrix for each fingerprint and phase contract.
- Define token and cache-hit metrics before dogfooding.
