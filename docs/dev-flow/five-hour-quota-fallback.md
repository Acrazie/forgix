# Five-hour quota fallback

## Objective

Keep model routing deterministic and conservative when `codex app-server` does not return the exact five-hour quota window.

## Scope

- Parse the current app-server model reasoning-effort shape.
- Preserve exact five-hour reset timestamps when supplied.
- Cache only a valid five-hour reset timestamp; never reuse a stale usage percentage.
- Reuse a non-expired cached reset timestamp when the live five-hour window is absent.
- Keep quota pressure `unknown` during fallback so routing stays conservative.
- Expose another available quota window as informational context only.
- Add unit, integration, and CLI tests using live-shaped app-server fixtures.
- Update plugin guidance and reinstall the local plugin through the supported cachebuster flow.

## Exclusions

- No conversion of weekly quota usage into five-hour quota usage.
- No model-family fallback outside the GPT-5.6 allowlist.
- No automatic merge.
- No claim that the parent Codex thread changed model or reasoning effort.

## Implementation tasks

1. Extend routing types with reset timestamp, last-known source, and informational observed window.
2. Make quota-window discovery tolerate nested app-server response containers.
3. Parse reasoning effort objects as well as the legacy string fixture shape.
4. Add an atomic, sanitized reset cache under `.codex/tasks` and integrate it into run/resume routing.
5. Add explicit fallback warnings and provenance.
6. Update fixtures, tests, README, and skill instructions.
7. Validate typecheck, build, tests, plugin manifest, and the bundled CLI against the live app-server.

## Acceptance criteria

- Exact 300-minute live window remains authoritative.
- Missing live five-hour window with a valid cached reset reports `source: "last-known"`, retains `pressure: "unknown"`, and selects the conservative model with a supported effort.
- Expired or malformed cache is ignored.
- Weekly data is visible but never used to classify five-hour quota pressure.
- Current object-shaped `supportedReasoningEfforts` produces non-null routing efforts.
- No raw app-server payload, credential, email, or token is persisted.

## Verification

- `npm run check` from `plugins/codex-dev-flow`.
- Plugin structural validation.
- Bundled CLI smoke test with sanitized live app-server output.
- `git diff --check` and focused diff review.

## Rollback

Revert the change commit. The reset cache is optional and ignored when absent or invalid, so rollback requires no data migration.

## Outcome

- Implemented the conservative last-known reset fallback without caching usage percentage.
- Normalized live object-shaped reasoning efforts.
- Preserved weekly quota data as informational context only.
- Made cache failures non-fatal and explicit.
- Passed typecheck, build, 35 tests, skill validation, plugin validation, live app-server smoke testing, and whitespace checks.
