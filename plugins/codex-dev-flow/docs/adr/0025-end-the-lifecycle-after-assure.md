# ADR 0025: End the Lifecycle After ASSURE

## Status

Accepted for TaskState V4; implementation pending.

## Context

V3 HANDOFF distinguishes local completion from external Git or GitHub delivery, stores
remaining actions and provider receipts, and reconciles retries. In the intended Codex
product flow, conversation resume and external actions already belong to the parent
Codex interaction. Keeping those concerns inside dev-flow duplicates native behavior
and adds statuses, policy, metrics, and failure paths after implementation is already
verified.

## Decision

TaskState V4 has five public macro-phases:

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE -> finished
```

ASSURE persists a compact verification receipt containing criterion coverage, executed
validation identities and results, freshness fingerprint, and timestamp. Successful
ASSURE transitions directly to the single success terminal `finished`. Parent Codex,
not a dev-flow phase, renders the conversational completion response.

HANDOFF and its public/internal contract are removed, including `handing_off`,
`ready_for_handoff`, `finished_local`, `remainingActions`, handoff intent and
reconciliation receipts, HANDOFF capsule/events/guards, handoff configuration, and
handoff metrics.

Commit, push, pull request, merge, publication, and release occur outside the dev-flow
lifecycle through native Codex behavior and native confirmations. A combined request
such as “implement, commit, and open a pull request” is split implicitly: dev-flow owns
implementation through verified `finished`; parent Codex may then execute requested
external actions. TaskState does not persist those external actions.

No GATE approval authorizes an external action. Removing HANDOFF therefore does not
weaken the confirmation boundary for Git, GitHub, registry, or release operations.

V4 is an explicit schema break. V1, V2, and V3 task states fail with a typed incompatible
schema error. The runtime does not guess how an old completion approval or partial
handoff maps to the five-phase lifecycle.

## Consequences

- Verified implementation has one unambiguous success terminal.
- Resume and metrics no longer model external delivery state.
- Native Codex remains responsible for external-action authorization, retries, and
  conversational summaries.
- ADR 0005 is superseded for V4; its idempotent delivery model remains historical V3
  behavior only.
- The state schema, registry, projections, skills, configuration, benchmark protocol,
  documentation, generated bundle, and deterministic tests must change atomically.
