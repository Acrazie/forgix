# Project Engineering Profile Contract

This document is normative for agentic `$forgix init`, shared project profiles, local
overlays, validation, reconciliation, and publication. It is outside TaskState lifecycle
and does not yet make project profiles part of ordinary SHAPE completion.

## Interfaces

- `$forgix init` (`/forgix:forgix init` on Claude Code, `/forgix init` on Antigravity):
  sole initialization and drift-reconciliation entry point under the
  `Agent-First Plugin Principle` (zero-question auto-discovery, read-only validation/planning,
  one consolidated preview and user approval, then atomic bootstrap apply and profile publish).
  Invoking bare `forgix init` in a terminal refuses with `EXIT_CODES.INVALID_INVOCATION` (`2`).
- `forgix init plan|apply [--adopt]` / `forgix init check`: deterministic bootstrap primitives
  that validate a declarative stdin manifest (`plan`, `apply`), preview diffs and blocking
  conflicts (`plan`), atomically and idempotently apply Forgix-owned repository artifacts
  (`apply`, with explicit opt-in `--adopt` or manifest `adoptPaths` for approved
  `unmanaged_file_collision` targets), or detect configuration/rule/hook/hygiene drift (`check`).
- `forgix hook <harness> <event>`: deterministic `Harness Lifecycle Hook` entrypoint
  (`session-start`, `pre-tool-use`, `post-tool-use` on `codex`/`claude`; `session-start`,
  `pre-tool-use`, `post-invocation` on `antigravity`) emitting raw harness-native stdout JSON.
- `forgix project-profile inspect`: read existing shared/local profiles and
  ignore status.
- `forgix project-profile validate [--local]`: validate stdin without writing.
- `forgix project-profile publish [--local]`: publish validated stdin after
  agent confirms explicit user approval (idempotent: returns `status: "unchanged"` when
  `contentDigest` is unchanged and auto-increments `revision` when changed).
- `forgix project-profile view [--local]`: render exact published canonical
  YAML.

`project-profile`, `init`, and `hook` commands are deterministic backend primitives. They
perform no model call, repository discovery, interview, or approval inference.

## Agentic INIT

INIT auto-discovers repository facts with zero upfront questions, including installed harnesses
(`.codex/`, `.claude/`, `.agents/` plus the active harness), stack/quality commands (to
propose repo-specific `protectedSurfaces` and `surfaceVerificationRules`), existing
ecosystem tools/plugins (Entire, Dagger, Fallow, Context7, etc.) to pre-populate
`integrations` without duplicating hooks, and optional lazy `domainDocumentation` when
absent. On greenfield repositories, INIT defaults to the active harness,
`hooks.enforcement: balanced`, and the directory name as project identity—producing only
configuration and profile files, never product scaffold.

Before asking the user, INIT runs read-only `forgix project-profile inspect`,
`forgix init check`, `forgix project-profile validate`, and `forgix init plan`. When
`init check` reports `inSync: true` and `project-profile validate` reports `unchanged: true`,
INIT reports "already up to date" with zero approval prompts and zero writes. Otherwise, it
presents one consolidated preview (including any `unmanaged_file_collision` diffs) and obtains
one explicit approval before writing `forgix init apply` first and
`forgix project-profile publish` second. If the user requests adjustments at the approval
prompt, the agent updates candidates, re-runs read-only validation/planning, and re-asks
approval on the updated summary.

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

- stable project identity (`content.project.{id,name}`);
- optional `stack`, logical service `topology`, `decisions` (across core and optional categories
  when applicable), `domainDocumentation`, `protectedSurfaces`, `surfaceVerificationRules`, and
  relative Markdown `diagramRefs` below `.forgix/diagrams/`; and
- monotonic revision, canonical content digest, and Profile Approval Receipt.

When present, the decision dependency graph is acyclic and `user_asserted` decisions cannot carry
verified fingerprints. Shared profile rejects secret-like values, local absolute filesystem
paths, duplicate identities, and unknown service/dependency refs. Volatile task observations
never belong here.

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

Revision 1 creates profile. Update preserves `profileId` and increments revision by one
(auto-incrementing to `previous.revision + 1` when `revision` is omitted or equal to current,
while rejecting explicit revisions lower than `previous.revision`). Same-content publication is
idempotent and returns `status: "unchanged"` with exit code `0`.

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
unchanged status, decision/topology/stack diff, and projection paths. Agent shows one
consolidated preview (combining profile summary and `forgix init plan`) and exact YAML on
request, then asks one explicit approval. Candidate or projection change requires validation
and approval again.

After approval, `$forgix init` runs `forgix init apply` first (so `.gitignore` includes
`.forgix/project.local.yaml` before any `--local` publish) and `forgix project-profile publish`
second. Backend publishes new immutable projection paths first and shared profile through one
final atomic rename. Shared profile rename is authority boundary; failed rename leaves prior
profile current, while any orphan new projection remains non-authoritative. Existing projection
path can be reused only with byte-identical content. Symlinked profile or projection path is
rejected. Local overlay uses separate atomic write after ignore and authority validation.

Direct file write bypass is forbidden.

## Harness bootstrap and lifecycle hooks

As part of the single-approval `$forgix init` flow, repository-versioned harness configuration
is previewed with `forgix init plan` and applied first via `forgix init apply`. Normative
contracts for bootstrap execution, locking, permissions, and hook I/O live in
[ADR 0037](adr/0037-agent-first-plugin-and-harness-bootstrap.md),
`docs/adr/0042-simplify-forgix-init-single-approval.md`, and the
repository design document `docs/forgix/2026-11-21-agent-first-init-bootstrap.md`.

- **Bootstrap manifest** (`schemas/init-bootstrap.schema.json`): declarative stdin payload
  (`harnesses`, optional `configPatch`, modular `rules`, optional `agents`/`skills`, `hooks`,
  `gitignore`, `worktreeInclude`, optional `adoptPaths`). `plan` previews diffs/conflicts;
  `apply` writes atomically under lock (`.forgix/config.yaml` last); `check` verifies
  `.forgix/factory/`, `factoryPolicies`, projections, and `managedPaths`.
- **Factory as Code & ownership**: `.forgix/factory/{rules/<id>.md,agents/<id>.md,skills/<id>/SKILL.md}`
  replaces `.forgix/rules.md`. Projections place `<!-- forgix:managed ... -->` after `---`
  under `.claude/`/`.agents/`/`.codex/` (`forgix-<id>*`) and an `AGENTS.md`
  `<!-- forgix:start -->`…`<!-- forgix:end -->` index (`CLAUDE.md` never written). Unmanaged
  files fail with `unmanaged_file_collision` by default (with diff preview) and are adopted only
  when explicitly approved via `--adopt` or `adoptPaths`; `bootstrap.managedPaths` governs cleanup.
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
