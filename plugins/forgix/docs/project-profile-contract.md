# Project Engineering Profile Contract

This document is normative for agentic `$forgix init`, shared project profiles, local
overlays, validation, reconciliation, and publication. It is outside TaskState lifecycle
and does not yet make project profiles part of ordinary SHAPE completion.

## Interfaces

- `$forgix init`: agentic Discovery, adaptive interview, validation, and explicit
  Profile Approval.
- `npx @acrasie/forgix init`: separate deterministic plugin-configuration wizard.
- `forgix project-profile inspect`: read existing shared/local profiles and
  ignore status.
- `forgix project-profile validate [--local]`: validate stdin without writing.
- `forgix project-profile publish [--local]`: publish validated stdin after
  agent confirms explicit Profile Approval.
- `forgix project-profile view [--local]`: render exact published canonical
  YAML.
- `forgix project-profile session-view|session-save|session-clear`: resume,
  persist, or remove compact local INIT interview state.

`project-profile` commands are deterministic backend primitives. They perform no model
call, repository discovery, interview, or approval inference.

## Agentic INIT

INIT discovers repository facts before asking. Core scope is stack, source structure,
architecture boundaries, dependency direction, naming, error handling, testing, and
quality. Frontend, API, data, security, concurrency, performance, compatibility,
migration, observability, deployment, rollback, and operations activate only when
applicable.

Questions are limited to missing, contradictory, stale, or material decisions and
appear exactly one at a time. Each carries evidence, recommendation and confidence,
2–3 viable options, direct consequences, and free-form path. There is no hard question
cap, periodic progress checkpoint, or cost-estimation prompt. Greenfield INIT produces
profile and optional generated diagram only, never product scaffold.

Compact local `.codex/project-init/state.yaml` persists normalized decisions, stale
keys, status, candidate digest, and at most one exact active question. Schema:
[project-init-state.schema.json](../schemas/project-init-state.schema.json). It contains
no transcript or hidden reasoning and is gitignored. Every save preserves session/profile
identity and increments revision exactly once. Resume reuses active question unless
dependency evidence changed. Successful publication clears session explicitly.

Multi-service Discovery is progressive. Each repository owns its profile. Root profile
contains logical topology, responsibilities, dependencies, contracts, and external
profile refs. Absolute service paths stay local. An inaccessible service claim is
`user_asserted`, never verified evidence. External repository update requires own
validation and approval transaction.

## Shared profile

Canonical shared file is versioned:

```text
.codex/forgix.project.yaml
```

Schema: [project-profile.schema.json](../schemas/project-profile.schema.json).

Required content:

- stable project identity and stack;
- logical service topology and contracts;
- all eight core convention categories plus applicable optional categories;
- decision rationale, provenance, durable fingerprints, and dependency edges;
- optional `domainDocumentation` conventions: single/multiple context mode, portable
  glossary/rules/ADR/context-map paths, language, stable identity/link conventions, and
  source fingerprints;
- optional relative Markdown diagram refs below `.codex/forgix/diagrams/`; and
- monotonic revision, canonical content digest, and Profile Approval Receipt.

Decision dependency graph is acyclic. `user_asserted` decisions cannot carry verified
fingerprints. Shared profile rejects secret-like values, local absolute filesystem
paths, duplicate identities, unknown service/dependency refs, and missing core domains.
Volatile task observations never belong here.

Canonical content digest is SHA-256 of recursively key-sorted JSON representation of
`content`. Receipt remains outside content digest to avoid cycle. Receipt binds actor
`user`, approval time, profile identity, revision, and exact content digest; receipt
digest binds those fields. Any mismatch makes profile invalid.

## Local overlay

Local file is gitignored:

```text
.codex/forgix.project.local.yaml
```

Schema: [project-profile-local.schema.json](../schemas/project-profile-local.schema.json).
Before publication repository `.gitignore` must contain exact path entry. Overlay may
contain only absolute local service paths and non-contractual preferences. Service IDs
must exist in shared topology when shared profile exists. A preference cannot override
shared decision key. Local profile identity and optional shared digest binding must
match shared profile.

## Authority

```text
system instructions and repository policy
-> INTAKE product decisions when task-scoped
-> explicitly approved task exception
-> shared engineering profile
-> non-contractual local preferences
-> agent defaults
```

Lower authority cannot weaken higher authority. Domain destination resolution uses
repository policy, approved profile, unambiguous detected convention, then portable
defaults. Task exceptions remain task-local and cannot silently rewrite shared profile.

## Reconciliation

Every decision and domain-documentation fingerprint source is rediscovered when accessible. Missing observations remain
unknown, never current proof. Changed fingerprint marks owning decision stale and
invalidates only transitive dependent closure. Repository facts are rediscovered;
user-owned conventions are re-interviewed. Proposed update accumulates outside shared
file. Rejection leaves shared profile byte-for-byte unchanged and creates no shared
stale marker.

Revision 1 creates profile. Update preserves `profileId`, increments revision exactly by
one, and must change content digest. Same-content and stale-revision publication fail.

## Validation and publication

Candidate stdin may be raw profile YAML/JSON or transaction object:

````yaml
profile: # profile proposal without approval
projections:
  - path: .codex/forgix/diagrams/example-r1.mermaid.md
    content: |-
      ```mermaid
      flowchart LR
        A --> B
      ```
````

Validation is read-only and returns exact canonical proposal YAML, digest, revision,
decision/topology/stack diff, and projection paths. Agent shows adaptive summary and
exact YAML on request, then asks one explicit Profile Approval. Candidate or projection
change requires validation and approval again.

Before shared publication, existing INIT session—when present—must be
`awaiting_approval` and bound to same candidate content digest. This prevents resume or
candidate drift from inheriting prior validation.

After approval, backend publishes new immutable projection paths first and shared
profile through one final atomic rename. Shared profile rename is authority boundary;
failed rename leaves prior profile current, while any orphan new projection remains
non-authoritative. Existing projection path can be reused only with byte-identical
content. Symlinked profile or projection path is rejected. Local overlay uses separate
atomic write after ignore and authority validation.

Direct file write bypass is forbidden.
