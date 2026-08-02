# ADR 0003: Bind Approvals to Canonical Contract Projections

## Status

Accepted for TaskState V3. Superseded for V4 by ADR 0024.

## Context

A boolean approval cannot prove what a person approved. Repeating full approval prompts
after every update wastes tokens and attention, while reusing an approval after scope,
risk, or acceptance criteria changed creates false assurance.

## Decision

Represent every approval as an immutable record referencing a canonical projection of
the contract being approved. The projection contains the fields relevant to the gate:
objective, scope and non-goals, acceptance criteria, mode and risk, implementation plan,
and Critical risk documents when applicable.

An Approval records gate type, actor, time, canonical contract digest, and artifact
identity. A plain `approved: true` is not sufficient.

Material changes invalidate affected approvals. Material fields include objective,
scope, acceptance criteria, mode, risk, plan behavior, and required Critical threat or
rollback controls. Evidence additions and progress updates do not invalidate approval.
Known non-semantic representation changes may preserve it only through deterministic
canonicalization; unknown changes are material by default.

When reapproval is required, the gate presents the structured delta from the last
approved projection rather than repeating the full unchanged contract.

## Consequences

- Resume can prove whether an approval still applies.
- Scope expansion cannot silently reuse an older gate.
- Delta prompts reduce token and reviewer cost.
- Gate-specific projection, canonicalization, and materiality rules require schemas and
  tests.
- Conservative handling may request approval for an unusual but harmless change; it
  must never preserve approval through an ambiguous change.
