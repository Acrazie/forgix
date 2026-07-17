# Permission-aware app-server routing

## Context and outcome

`codex app-server` can require write access to SQLite state under `CODEX_HOME`, normally `~/.codex`. In a read-only sandbox it exited before returning account, quota, or model data, while Dev Flow reduced the cause to `app-server unavailable` and reported every exact route as unavailable.

Outcome: expose a safe structured permission failure, require approval before one retry outside the restrictive sandbox, and continue with the successful routing snapshot.

## Scope and non-goals

In scope: failure classification, bounded stderr capture, permission-specific CLI status, approval/retry orchestration guidance, tests, distribution bundle, and documentation.

Non-goals: model fallback, routing matrix changes, quota policy changes, benchmark collection, telemetry, or automatic privilege escalation.

## Constraints and decisions

- Preserve `app-server unavailable` for compatibility while adding structured failure metadata.
- Never expose raw stderr, credentials, or JSON-RPC payloads.
- Retry only state permission failures, once, after explicit approval.
- A failed attempt is not persisted as the workflow routing snapshot.
- Preserve exact model/effort routing without fallback.

## Acceptance criteria

- **AC1:** Distinguish timeout, state permission, spawn, RPC, and premature-close failures.
- **AC2:** Do not expose secrets, raw protocol errors, raw stderr, or absolute `CODEX_HOME` paths.
- **AC3:** State permission denial returns `routing_permission_required`, `app_server_permission_denied`, and an actionable sanitized path.
- **AC4:** Orchestration requires explicit approval and retries the same invocation at most once.
- **AC5:** Denied approval or failed retry blocks without silent escalation or retry loops.
- **AC6:** An approved successful retry returns all six exact routing decisions.
- **AC7:** Existing CLI behavior and exact-route policy remain compatible for other outcomes.

## Implementation plan

1. Add structured failure classification and bounded stderr handling in the app-server adapter. Covers AC1–AC3 and AC7.
2. Add permission-specific CLI status and failure metadata. Covers AC3 and AC7.
3. Add approval and one-retry rules to the public workflow skill. Covers AC4–AC6.
4. Add fixtures and tests for classification, sanitization, CLI behavior, and skill distribution. Covers AC1–AC7.
5. Document the permission model and recovery behavior. Covers AC3–AC7.

## Risks and rollback

Risk: misclassifying unrelated `EPERM` stderr as a state permission failure. Mitigation: retry still requires approval, occurs once, and does not weaken routing.

Risk: exposing sensitive subprocess output. Mitigation: stderr remains internal, bounded, and reduced to fixed codes plus `~/.codex`.

Rollback: revert additive failure metadata, permission-specific status, retry guidance, fixtures, and documentation. No state-schema or user configuration migration is required.

## Verification evidence

- `npm run check` — passed: typecheck, build, and 57 tests.
- `npm pack --dry-run --json --ignore-scripts` with temporary npm cache — passed; 21 packaged files.
- `git diff --check` — passed.
- Sandboxed manual invocation — returned `routing_permission_required` with `app_server_permission_denied` and `~/.codex`.
- Same invocation retried once after explicit approval outside sandbox — returned `routed`; all six routes had non-null exact model and effort assignments.

Material deviation: app-server routing initially blocked the Standard discovery/plan stages, so the plan was reviewed and approved in conversation. This required artifact was persisted after the permission-aware retry restored routing, rather than before implementation approval.
