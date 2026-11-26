# ADR 0042: Simplify `$forgix init` to a Single-Approval, Low-Friction Flow

- Status: Accepted
- Date: 2026-11-26
- Amends: [ADR 0027](0027-add-agentic-project-init-and-versioned-engineering-profiles.md), [ADR 0037](0037-agent-first-plugin-and-harness-bootstrap.md)

## Context

Running `$forgix init` accumulated five sources of friction and avoidable execution conflicts:

1. A mandatory multi-turn interview followed by two separate approval gates (Profile Approval and
   Bootstrap Plan confirmation).
2. Local `.forgix/init/state.yaml` session state (`project-profile session-view|session-save|session-clear`)
   that frequently failed publication with `profile_session_conflict` on stale or mismatched digests.
3. A rigid profile schema requiring all eight core decision categories, stack, topology, and
   `diagramRefs`, plus non-idempotent `project-profile publish` failures (`profile_no_change`,
   manual `revision` tracking, and `profile_local_not_ignored` before `.gitignore` was updated).
4. Hard blocking on `unmanaged_file_collision` in `forgix init apply` with no explicit opt-in
   adoption path.
5. `loadHookProjectSummary` reading top-level `project`/`stack`/`protectedSurfaces` instead of
   `content.*`, printing `project "unnamed"` on `SessionStart`.

## Decision

1. **Zero-question discovery + single approval**: `$forgix init` auto-discovers repository facts
   (using minimal defaults on greenfield repos), runs read-only `inspect`, `check`, `validate`,
   and `plan`, and presents one consolidated preview for one explicit user approval. Synced
   re-runs with no profile change no-op with zero prompts and zero writes.
2. **Remove `.forgix/init/state.yaml` session machine**: Delete
   `schemas/project-init-state.schema.json` and remove `project-profile session-view|session-save|session-clear`
   (which now exit `2` as invalid invocations).
3. **Relax profile schema and make `publish` idempotent**: Only `content.project` (`id`, `name`)
   is required in `schemas/project-profile.schema.json` while keeping 100% read compatibility with
   existing v1 profiles. `project-profile publish` returns `status: "unchanged"` (exit `0`) when
   `contentDigest` is unchanged and auto-increments `revision` to `previous.revision + 1` when
   omitted or equal to current (still rejecting revisions lower than `previous.revision`).
4. **Explicit opt-in collision adoption**: `unmanaged_file_collision` remains blocked by default
   (now surfacing a diff preview in `init plan`), and may be adopted explicitly via `--adopt` or
   manifest `adoptPaths` after user approval. Real safety guards (`invalid_json`, `invalid_yaml`,
   `symlink_or_non_file`, corrupted markers) remain strictly blocking.
5. **Write order**: `$forgix init` runs `forgix init apply` first (updating `.gitignore` and
   harness files atomically) and `forgix project-profile publish` second (idempotent).
6. **Fix `SessionStart` summary**: `loadHookProjectSummary` reads `content.{project,stack,protectedSurfaces}`.

## Consequences

- First-time and repeat `$forgix init` runs require at most one approval turn (zero when already
  in sync) and never fail on stale session files or unchanged profile re-runs.
- The `Agent-First Golden Rule` (bare `forgix init` exits `2`), Fallow zone boundaries
  (`profile` and `init` decoupled), and all safety/corruption guards remain intact.
