# Project Engineering Profile Contract

This document is normative for agentic `$forgix init`, shared project profiles, local
overlays, validation, reconciliation, and publication. It is outside TaskState lifecycle
and does not yet make project profiles part of ordinary SHAPE completion.

## Interfaces

- `$forgix init` (`/forgix:forgix init` on Claude Code, `/forgix init` on Antigravity):
  sole initialization and drift-reconciliation entry point under the
  `Agent-First Plugin Principle` (agentic Discovery, adaptive interview, Profile Approval,
  and harness bootstrap). Invoking bare `forgix init` in a terminal refuses with
  `EXIT_CODES.INVALID_INVOCATION` (`2`).
- `forgix init plan|apply|check`: deterministic bootstrap primitives that validate a
  declarative stdin manifest (`plan`, `apply`), preview diffs and blocking conflicts
  (`plan`), atomically and idempotently apply Forgix-owned repository artifacts (`apply`),
  or detect configuration/rule/hook/hygiene drift (`check`).
- `forgix hook <harness> <event>`: deterministic `Harness Lifecycle Hook` entrypoint
  (`session-start`, `pre-tool-use`, `post-tool-use` on `codex`/`claude`; `session-start`,
  `pre-tool-use`, `post-invocation` on `antigravity`) emitting raw harness-native stdout JSON.
- `forgix project-profile inspect`: read existing shared/local profiles and
  ignore status.
- `forgix project-profile validate [--local]`: validate stdin without writing.
- `forgix project-profile publish [--local]`: publish validated stdin after
  agent confirms explicit Profile Approval.
- `forgix project-profile view [--local]`: render exact published canonical
  YAML.
- `forgix project-profile session-view|session-save|session-clear`: resume,
  persist, or remove compact local INIT interview state.

`project-profile`, `init`, and `hook` commands are deterministic backend primitives. They
perform no model call, repository discovery, interview, or approval inference.

## Agentic INIT

INIT discovers repository facts before asking, including installed harnesses
(`.codex/`, `.claude/`, `.agents/` plus the active harness), stack/quality commands (to
propose repo-specific `protectedSurfaces` and `surfaceVerificationRules`), existing
ecosystem tools/plugins (Entire, Dagger, Fallow, Context7, etc.) to pre-populate
`integrations` without duplicating hooks, and optional lazy `domainDocumentation` when
absent. Core scope is stack, source structure,
architecture boundaries, dependency direction, naming, error handling, testing, and
quality. Frontend, API, data, security, concurrency, performance, compatibility,
migration, observability, deployment, rollback, and operations activate only when
applicable.

Questions are limited to missing, contradictory, stale, or material decisions and
appear exactly one at a time. Each carries evidence, recommendation and confidence,
2–3 viable options, direct consequences, and free-form path. There is no hard question
cap, periodic progress checkpoint, or cost-estimation prompt. Greenfield INIT produces
profile and optional generated diagram only, never product scaffold.

Compact local `.forgix/init/state.yaml` persists normalized decisions, stale
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
.forgix/project.yaml
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
- optional relative Markdown diagram refs below `.forgix/diagrams/`; and
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
.forgix/project.local.yaml
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
  - path: .forgix/diagrams/example-r1.mermaid.md
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

## Harness bootstrap and lifecycle hooks

After Profile Approval, `$forgix init` previews and applies repository-versioned harness
configuration through `forgix init plan|apply|check`. Normative contracts for bootstrap
execution, locking, permissions, and hook I/O live in
[ADR 0037](adr/0037-agent-first-plugin-and-harness-bootstrap.md) and the
repository design document `docs/forgix/2026-11-21-agent-first-init-bootstrap.md`.

- **Bootstrap manifest** (`schemas/init-bootstrap.schema.json`): declarative stdin payload
  (`harnesses`, optional `configPatch`, modular `rules`, optional `agents`/`skills`, `hooks`,
  `gitignore`, `worktreeInclude`). `plan` previews diffs/conflicts; `apply` writes atomically
  under lock (`.forgix/config.yaml` last); `check` verifies `.forgix/factory/`,
  `factoryPolicies`, projections, and `managedPaths`.
- **Factory as Code & ownership**: `.forgix/factory/{rules/<id>.md,agents/<id>.md,skills/<id>/SKILL.md}`
  replaces `.forgix/rules.md`. Projections place `<!-- forgix:managed ... -->` after `---`
  under `.claude/`/`.agents/`/`.codex/` (`forgix-<id>*`) and an `AGENTS.md`
  `<!-- forgix:start -->`…`<!-- forgix:end -->` index (`CLAUDE.md` never written). Unmanaged
  files fail with `unmanaged_file_collision`; `bootstrap.managedPaths` governs cleanup.
  `.gitignore`/`.worktreeinclude` use `# forgix:start`…`# forgix:end`; hooks merge cleanly.
- **Compiled `factoryPolicies`**: rule `enforce` clauses (`protectedSurfaces`,
  `blockedCommands`, `escapeHatchPatterns`) compile into `.forgix/config.yaml` (never
  overridable by `config.local.yaml`) and run in `PreToolUse` / `PostToolUse` /
  `PostInvocation` while preserving `DEFAULT_PROTECTED_SURFACES` and `approvedEscapeHatches`.
- **Fail-open hooks**: generated POSIX `sh -c` wrappers run only the absolute
  `FORGIX_CLI_PATH` pin inherited from the native host. There is no `forgix` on
  `PATH` or working-directory fallback. Ordinary hooks fail open if the pin or
  Node is unavailable (`exit 0`, with a `SessionStart` warning); this never
  proves installation readiness for managed BUILD. Use `init check-build <harness>`
  and verify the actual registered native callbacks.
- **Enforcement modes** (`hooks.enforcement`: `balanced` default, `strict`, `warn`):
  universal invariants (`git commit --no-verify`, `git push --force`, direct trunk
  `git merge`) block in `balanced`/`strict` and warn in `warn`. `Protected Surface` writes
  block during an active `BUILD` unless matched by
  `CanonicalChangeContract.approvedProtectedPaths` (warning outside a task in
  `balanced`/`warn`, blocking only in `strict`). `PostToolUse` (Codex/Claude) and
  `PostInvocation` (Antigravity) scan additions for `Escape Hatch`es outside
  `approvedEscapeHatches`, warning in `balanced`/`warn` and blocking/terminating in `strict`.
