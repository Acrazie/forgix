# Routing application remediation

Status: `approved — implementation blocked on dual capability gate`

## 1. Context and outcome

Dev Flow currently computes a frozen routing decision for each stage, but no production runtime consumer proves that the selected model and reasoning effort are applied when the stage runs. The current status is therefore:

```text
routing_application_status = declared_only
```

This plan answers one question only:

> How can Dev Flow reliably apply the selected model and reasoning effort for each stage while remaining lightweight and close to native Codex behavior?

The preferred target is exclusively a lightweight current-thread settings bridge that uses the same host-owned primitive as `/model`: update `model` and `effort` on the active thread between existing turns. This preserves the native thread and adds no model invocation for the settings change itself. In Codex CLI `0.144.4`, `thread/settings/update` is verified in the version-specific generated App Server protocol and TUI implementation. It is not a stable plugin or host API contract. Current Dev Flow cannot automate it because the TUI's internal App Server session is not exposed to a skill/plugin runtime tool.

Full App Server-controlled execution is fallback C only. It is outside the primary remediation scope and requires separate approval.

This is a design recommendation, not implementation approval. No routing code or runtime behavior changes in this task.

## 2. Current path audit

| Boundary | Owner | Data actually transmitted | Current Codex primitive | Model changed? | Effort changed? | Exactly observable/testable? |
| --- | --- | --- | --- | --- | --- | --- |
| `$dev-flow` invocation | Codex host plus parent `SKILL.md` | User objective and workflow instructions | Skill instructions loaded into the active agent context | No | No | Invocation is visible; no host-owned stage lifecycle |
| Routing snapshot | `AppServerClient` and `runInvocation` | Account plan, quota windows, model catalog | App Server `account/read`, `account/rateLimits/read`, `model/list` | No | No | Yes, as snapshot data only |
| Per-stage routing decision | `routing.ts::chooseRoute` and `cli.ts::runInvocation` | `{ stage, model, effort, reason, warnings }` returned in CLI data | Local TypeScript calculation | No | No | Yes, decision calculation is unit-tested |
| `delegateStage` | `bridge.ts` | Optional `RoutingDecision` passed to a caller-provided callback | Plain function call `runner(decision)` | No | No | Function behavior is testable, but no production caller exists |
| Stage skill invocation | Parent model following `SKILL.md` instructions | Stage instructions become context in the same active agent workflow | Skill selection/instruction loading | No | No | Skill use is visible to the model, not a reliable host-owned runtime boundary |
| Codex model selection | Codex runtime | Current thread/turn/agent configuration | None invoked by production Dev Flow | No; current model continues | N/A | No applied-route evidence exists |
| Codex reasoning selection | Codex runtime | Current thread/turn/agent configuration | None invoked by production Dev Flow | N/A | No; current effort continues | No applied-route evidence exists |

Additional findings:

- `delegateStage` is exported and tested but absent from production orchestration callers.
- `ROUTED_STAGES` excludes `execute`; `delegateStage` rejects mutation/validation stages. The parent text says execution is routed but parent-owned, yet no runtime primitive applies its route.
- The standalone CLI ends after returning the snapshot and six decisions. It does not invoke stage skills or the Codex runtime.
- A skill is an instruction bundle, not a model-call boundary. Multiple skill phases inside one model turn cannot run on different models.
- Therefore the current pipeline stops at declared metadata. Tests prove matrix selection, schema validity, and callback forwarding—not runtime model or effort application.

## 3. Official runtime primitives found

Current Codex documentation and the generated protocol schema expose three enforceable configuration boundaries:

1. Custom agent files may set `model` and `model_reasoning_effort`. Each spawned subagent runs its own model and tool work, has its own agent thread, and consumes more tokens than a comparable single-agent run.
2. App Server `turn/start` accepts `model` and `effort` overrides for that turn and subsequent turns. `thread/settings/update` can also change both for subsequent turns. App Server emits explicit turn lifecycle events.
3. `codex exec` and `codex exec resume` accept `--model`; `-c model_reasoning_effort=...` supplies the corresponding config override. Profiles can pin both values.

The `/model` audit found a version-specific internal runtime primitive for the current thread: in CLI `0.144.4`, the TUI sends generated-protocol `thread/settings/update` with `model` and `effort`. It changes subsequent turns without invoking a model. It does not alter the already-running turn, and the TUI's internal event/session handle is not exposed to an instruction-only skill. This proves current-thread reconfiguration inside that release's TUI implementation, not a stable plugin/host integration contract.

Official evidence:

- [Codex subagents and custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents.md)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server.md)
- [Codex advanced configuration and profiles](https://learn.chatgpt.com/docs/config-advanced.md)

## 4. Architecture classification

Ratings are relative and qualitative until measured. “Additional model tokens” compares against today's instruction-only single-agent flow; no numeric claim is made before a controlled benchmark.

| Criterion | A. Native skill-only | B. Custom agents per stage | C. App Server-controlled stage turns | D. Separate `codex exec` per stage | E. Current-thread `/model` primitive |
| --- | --- | --- | --- | --- | --- |
| Routing correctness | Fails: no config boundary | Conditional-high: requires deterministic agent-type selection | High: `turn/start` carries exact model/effort | High: process flags/config pin route | High manually; automation blocked until host bridge exists |
| Additional model tokens | None, because route is not applied | High risk: parent plus independent agent work and handoffs | Medium: separate stage turns, but host orchestration needs no model | Medium-high: separate runs plus process/session framing | Zero for settings update; selected route starts on the next normal model turn |
| Context duplication | None | High: each agent has separate context; handoff summaries needed | Low relative to B/D: one thread history, subject to normal context growth | Medium: resumed persisted history, repeated process setup | None: same native thread |
| Context preservation | Excellent but single route only | Partial: explicit handoffs between threads | High: all stage turns stay in one thread | Medium-high when resume is reliable; process boundary remains | Highest: active thread settings are mutated in place |
| Runtime overhead | Minimal | Medium-high | Medium-high, one local server plus controller | High, repeated process startup | Negligible manually; unknown for a future host bridge |
| Latency | Lowest | High unless safe stages parallelize | Sequential stage latency | Highest startup overhead | Negligible settings latency; stage still needs its normal next turn |
| Implementation complexity | Low but invalid | Medium; agent catalog and handoff protocol | High; controller, lifecycle, approvals, recovery, UI connection | Medium-high; launcher, resume, locking, output protocol | Low manually; currently blocked for automatic plugin use |
| Failure recovery | Current model best effort | Per-agent status exists; cross-thread recovery needed | Strong if state machine checkpoints each completed turn | Process exit is clear; session/process recovery is awkward | User can retry `/model`; automatic acknowledgement contract unavailable to plugin |
| Native Codex UX preservation | Highest | High: subagent UI is native | Conditional; separately approved controller UX required | Low: fragmented nested/noninteractive runs | Highest |
| Model/reasoning configurability | None per stage | High in custom agent files | High per turn | High per process/resumed turn | High for subsequent turns |
| Stage lifecycle observability | Unavailable | High: agent thread lifecycle | Highest: explicit stage turn ids and completion | High: process plus JSONL events | Settings boundary observable by host; Dev Flow stage boundary still unavailable |
| Future benchmarkability | Invalid | High, but benchmark includes subagent overhead | Highest; exact route and stage boundaries share one thread | High, but process overhead contaminates results | High only after host acknowledgement and stage lifecycle are exposed |

### A. Native skill-only routing

Reject as an effective routing architecture. It is the lightest and preserves context perfectly only because it never crosses a runtime configuration boundary. Prompt text asserting a model name is not application proof.

### B. Custom agents or subagents per stage

Keep as a fallback and controlled benchmark architecture, not the default recommendation. It uses a native Codex feature and exposes agent lifecycle, but each stage becomes independent model/tool work. Context must be re-supplied or summarized, parent orchestration also consumes tokens, and write-stage coordination becomes harder. The currently exposed spawn surface must additionally prove deterministic custom-agent selection; a task label alone is not route enforcement.

### C. App Server-controlled stage turns

Keep as an architectural fallback if no supported current-thread bridge can be exposed. It is excluded from this remediation's primary implementation scope and requires separate approval. A separately approved controller could preserve one thread, create exact stage `turnId` boundaries, apply the frozen route with `turn/start`, and observe `turn/completed`. That option adds stage turns and substantial ownership/runtime complexity.

This recommendation does not reuse the rejected passive-observer architecture. Here App Server owns and executes the routed thread; it is not expected to observe another native CLI process passively.

### D. Separate Codex exec/process per stage

Keep as a portability fallback or test harness. `codex exec resume --model ... -c model_reasoning_effort=...` can pin configuration and reuse persisted history, but repeated startup, nested process management, approvals, hooks, concurrency/locking, and fragmented UX make it too heavy for the preferred path.

### E. Current-thread `/model` primitive

Prefer this target if Codex exposes a supported host/plugin bridge. In Codex CLI `0.144.4`, `/model` is handled entirely by the TUI: model selection emits internal `UpdateModel` and `UpdateReasoningEffort` events, then the active TUI App Server session sends `thread/settings/update` for the same thread. Persistence is a separate config edit. The settings action starts no model turn and preserves all thread context.

Two hard limits remain:

- The update applies to subsequent turns, never retroactively to the in-flight turn. Distinct stage models therefore still require stage execution to cross a normal model-turn boundary.
- Dev Flow skills cannot access the TUI's private `AppEvent` bus, `AppServerSession`, or active thread handle. No model-callable `set_model`/`set_reasoning_effort` tool or plugin command surface was found in the exact release.

## 5. Recommendation

### Recommended architecture

Target a supported current-thread settings bridge before building a separate execution controller:

```text
native Codex TUI + current thread
                 │
        host-owned stage boundary
                 │
       frozen routing decision
                 │
                 ▼
thread/settings/update(model, effort)
                 │
       acknowledged by same host
                 │
                 ▼
next normal stage turn on same thread
```

The current `$dev-flow` skill remains `declared_only`. The preferred automated design is blocked until Codex exposes both a supported plugin/host capability equivalent to the TUI's internal `thread/settings/update` path and a host-owned stage/turn lifecycle. Until then, a manual mode may list the next stage route and ask the user to select it through `/model`; this is honest but not automatic. A Dev Flow-owned App Server controller remains fallback C and requires separate approval.

### Hard capability gates

Automatic routed mode is available only when both capabilities are proven:

```text
current_thread_settings_bridge_available
AND
host_stage_turn_lifecycle_available
```

The required host-owned sequence is:

```text
host-owned stage boundary
→ acknowledged model/effort update
→ next stage turn
→ runtime route proof
```

A settings bridge alone is insufficient because its update applies only to subsequent model requests. If multiple stages execute inside one existing turn, per-stage routing remains impossible. If either gate is unavailable:

```text
routing_application_status = declared_only
automatic routed mode = unavailable
```

For Codex CLI `0.144.4`, both gates are currently unproven/unavailable. Tasks 2–6 must not start.

### Why

- It reuses the exact runtime path already exercised by native `/model`.
- The settings mutation itself adds zero model tokens and duplicates no context.
- It preserves the current native thread and avoids subagent orchestration, exploration repetition, and handoffs.
- It keeps custom subagents exceptional—potentially useful for `review-change` and `debug-root-cause`, where independent perspective can justify their cost.

### Token overhead

The `/model`-equivalent settings update has zero model-token overhead. However, a model chosen for a stage can only act on a subsequent model invocation. If current Dev Flow performs several stages inside one assistant turn, exact per-stage routing requires splitting those stages across normal turns. That is unavoidable; no runtime can replace the model already executing an in-flight turn. If stages already align with user/host turns, the settings change adds no extra turn beyond those stage turns.

### Known tradeoffs

- The needed TUI/App Server session bridge is not a supported plugin surface today.
- Skills still lack reliable host-owned stage boundaries.
- Automatic routing cannot be implemented by printing `/model`, editing config mid-turn, or asking the model to self-report a switch.
- Separate stage models require normal turn boundaries, which can increase latency compared with a single-turn workflow.
- App Server protocol/version drift still matters if a future bridge exposes raw protocol rather than a stable host API.

### Migration impact

- First request or identify a stable Codex host capability: active thread id plus atomic `setThreadModelEffort` and acknowledgement for subsequent turns.
- Define explicit stage-turn boundaries; do not treat skill loading inside one turn as a boundary.
- Keep a manual `/model` confirmation mode as an optional low-complexity bridge, clearly labelled non-automatic.
- Introduce durable `devFlowRunId`, `taskId`, `stageRunId`, selected route, acknowledged route, and stage status only after the host bridge exists.
- Preserve current frozen snapshot calculation and exact-route-unavailable behavior.
- Keep the full App Server controller as a separately approved fallback, not an implicit migration.

### Exact per-stage usage attribution

Potentially. A host bridge can record the acknowledged model/effort before the next stage turn without adding model context. Exact attribution still requires host-owned `stageRunId` and turn boundaries; `/model` alone does not provide Dev Flow stage lifecycle. Usage tracking and Task 2c OTel remain deferred until both route acknowledgement and lifecycle are proven.

## 6. Scope and non-goals

### In scope for remediation

- Explicit routed mode architecture and runtime capability gates.
- Supported current-thread settings bridge on the existing native thread.
- Host-owned stage and next-turn lifecycle.
- Frozen exact route application and acknowledgement before every stage turn.
- Honest compatibility path for current skill-only mode.
- Proof that runtime model and effort equal the routing decision.

### Non-goals

- Usage collection, OTel receiver, SQLite usage reporting, or benchmark statistics.
- Dynamic routing changes during an active run.
- Automatic subagent fan-out.
- Rewriting current routing matrix values.
- Silent conversion of `$dev-flow` into an orchestrator.
- Monetary cost estimation.
- Parallel write stages.
- App Server-controlled execution or remote-TUI ownership in the primary remediation.
- Tasks 2–6 on Codex CLI `0.144.4` unless both hard capability gates are proven.

## 7. Acceptance criteria

- **AC-1 — Honest status:** Existing skill-only mode remains `declared_only` and makes no applied-routing claim.
- **AC-2 — Exact application:** Before each routed stage turn, the host atomically applies and acknowledges the frozen decision's exact `model` and `effort`; missing capability blocks before model invocation.
- **AC-3 — Runtime proof:** Integration evidence records requested route, host acknowledgement, runtime thread/turn ids, and effective model/effort without transcript inference.
- **AC-4 — One-thread context:** All normal stage turns remain on the current native thread; no summary handoff is required between stages.
- **AC-5 — No model coordinator:** Stage transitions, retries, and terminal state are host-state-machine decisions and invoke no orchestration model.
- **AC-6 — Lifecycle:** Host-owned run and stage ids cover start, completion, failure, cancellation, retry, resume, and abandonment.
- **AC-7 — Native UX:** Automatic mode reuses the native current thread and TUI. If no supported host bridge exists, it remains blocked rather than replacing the UX silently.
- **AC-8 — Token transparency:** Documentation states that per-stage turns add model work; no zero-overhead or caching claim is made without measurement.
- **AC-9 — Compatibility:** Existing init/config/routing calculation and native skill mode remain functional unless a separately approved migration changes them.
- **AC-10 — Host boundary:** Dev Flow uses only a supported host/plugin capability or a separately approved versioned App Server adapter; private TUI events are never imported or patched.
- **AC-11 — Recovery:** A process restart resumes only from a persisted completed boundary and never repeats a mutating stage without explicit recovery policy.
- **AC-12 — Benchmark readiness:** Stable `devFlowRunId`, `taskId`, `stageRunId`, thread id, and turn ids exist before usage tracking resumes.
- **AC-13 — Dual gate:** Automatic routed mode is enabled only when both `current_thread_settings_bridge_available` and `host_stage_turn_lifecycle_available` are proven; otherwise routing remains `declared_only` and automatic mode remains unavailable.

## 8. Implementation plan

Implementation requires separate approval.

### Task 1 — Prove both current-thread capabilities

Likely files: isolated experimental scripts/tests under `plugins/codex-dev-flow/test/fixtures/` or temporary paths; no production command.

- Determine whether Codex exposes a supported plugin/host call equivalent to `/model` for the active native thread; private Rust `AppEvent` access does not qualify.
- Determine whether the host exposes explicit stage and next-turn lifecycle boundaries; skill instructions or inferred stage order do not qualify.
- Prove the call adds no user item, model-visible context, `turn/start`, or model invocation.
- Prove the complete sequence: host stage boundary, atomic model/effort acknowledgement, next stage turn, and runtime effective-route evidence.
- Prove an in-flight turn is unchanged and unsupported hosts fail closed.
- If either capability is unavailable, stop Tasks 2–6. Keep `declared_only`, expose automatic routed mode as unavailable, and choose explicitly between manual `/model`, an upstream Codex capability request, or separately approved fallback C.

Covers AC-2, AC-3, AC-6, AC-7, AC-8, AC-10, AC-13. Dependency: none. Current CLI `0.144.4` audit result: version-specific TUI primitive verified; supported bridge unavailable; host stage/turn lifecycle unavailable.

### Task 2 — Define run/stage domain and state machine

Likely files: new domain modules and schemas under `plugins/codex-dev-flow/src/runtime/`, state migrations, fixtures, and transition tests.

- Define ids, stage attempts, immutable route decisions, statuses, retry lineage, and recovery rules.
- Define stage graph including optional discovery/debug paths and parent-owned mutation safety.
- Make invalid transitions and duplicate mutating execution impossible by construction.

Covers AC-5, AC-6, AC-11, AC-12. Depends on Task 1.

### Task 3 — Introduce the current-thread route applier

Likely files: `src/runtime/current-thread-route-applier.ts`, supported host adapter, fixtures, and integration tests. Exact files depend on Task 1 exposing a public capability.

- Apply exact `model`/`effort` to the existing active thread before the next stage turn.
- Record host acknowledgement and normalize effective-route evidence.
- Implement unsupported-host, rejected-route, cancellation, and resume behavior without touching private TUI internals.

Covers AC-2, AC-3, AC-4, AC-6, AC-10. Depends on Tasks 1–2.

### Task 4 — Extract versioned stage contracts

Likely files: stage contract modules/templates, existing bundled skills, output schemas, and contract tests.

- Convert stage inputs/outputs into concise deterministic contracts without embedding repository content unnecessarily.
- Keep skills human-readable and compatible with native mode.
- Define execute/retry idempotency and artifact handoff rules.

Covers AC-4, AC-5, AC-9, AC-11. Depends on Task 2.

### Task 5 — Integrate explicit stage-turn routing into native Dev Flow

Likely files: parent skill/runtime integration, CLI/state interfaces, docs, and end-to-end tests.

- Add automatic current-thread routing behind an experimental capability gate; do not claim support on older hosts.
- Keep manual `/model` confirmation available as a separate honest fallback if desired.
- Persist/resume stage state and surface selected versus acknowledged route locally.

Covers AC-1, AC-6, AC-7, AC-9. Depends on Tasks 3–4.

### Task 6 — Prove application and migrate claims

Likely files: routing integration tests, README, skill contract, schemas, release notes, and this evidence section.

- Run end-to-end route matrix samples and prove effective model/effort per stage.
- Mark only routed records `applied`; retain native mode as `declared_only`.
- Verify build, typecheck, tests, distribution, interruption, reconnect, and recovery.

Covers AC-1 through AC-13. Depends on Tasks 1–5.

### Dependency summary

Task 1 contains two hard feasibility gates. Tasks 2–6 do not proceed unless both `current_thread_settings_bridge_available` and `host_stage_turn_lifecycle_available` are proven. Passing only one gate is a failure. After both pass, Task 2 defines the lifecycle domain; Tasks 3 and 4 may proceed in parallel after Task 2 where files do not overlap. Task 5 requires both route applier and contracts. Task 6 is the release gate. App Server-controlled execution is a separately approved fallback C, not part of this plan. Usage tracking Task 2c OTel remains deferred until Task 6 proves `routing_application_status = applied` and stable lifecycle ids.

## 9. Risks and rollback

- **Protocol drift:** Generate version-specific fixtures, validate capabilities, and fail closed. Roll back by disabling routed mode.
- **Token regression:** Keep routed mode opt-in, measure against native baseline, and expose turn count. Do not claim efficiency before data exists.
- **Context growth:** Keep stage contracts concise, checkpoint artifacts structurally, and test compaction behavior.
- **Duplicate mutation after crash:** Persist pre/post mutation boundaries and require explicit recovery when completion is ambiguous.
- **Boundary collapse:** Reject automatic routing when multiple stages share one existing turn; never infer a stage boundary.
- **Private API coupling:** A version-specific generated protocol/TUI path is evidence, not permission to depend on private internals.
- **Fallback scope creep:** App Server ownership and remote-TUI concerns require a separate proposal and approval.
- **False application proof:** Accept only runtime/protocol evidence, never prompt text, expected order, or model self-report.
- **Scope creep into telemetry:** No usage collector work belongs in this plan.

Rollback removes or disables the routed entrypoint and runtime controller while leaving current native skills and routing calculation intact. Durable routed state remains inert user data and is never deleted automatically.

## 10. Open questions requiring prototype evidence

- Which stable notification or response field proves the effective model and effort, rather than only the requested values?
- Which supported host/plugin contract can expose current-thread model/effort update plus acknowledgement?
- Which supported host lifecycle event creates an exact boundary before the next stage turn?
- How should ambiguous execute-stage completion be recovered after controller failure?
- What is the measured token delta of sequential same-thread turns versus custom-agent and `codex exec resume` baselines?
- Can stage output schemas remain stable across model families without forcing verbose handoff text?

The first two questions are Task 1 gates, not reasons to infer correctness. App Server transport, remote-TUI ownership, and controller approval routing belong only to a separately approved fallback C analysis.

## 11. Discovery and verification evidence

- Audited the parent and six bundled stage skills, plugin manifest, standalone CLI entrypoint, routing calculation, bridge, state helpers, schemas, README, and routing/bridge/CLI tests.
- Repository search found production routing references only in calculation, exports, state helpers, and data return paths; no production caller invokes `delegateStage` or applies its optional decision to Codex runtime configuration.
- Inspected the current official Codex manual for subagents, custom agents, profiles, noninteractive execution, remote TUI, and App Server lifecycle.
- Generated the experimental App Server TypeScript schema from Codex CLI `0.144.4` in a temporary directory. `TurnStartParams` and `ThreadSettingsUpdateParams` both expose `model` and `effort` overrides; generated files were removed after audit.
- Inspected `codex exec` and `codex exec resume` help. Both support model/config overrides; no model invocation was made.
- Corrected the approved primary scope to the current-thread settings bridge only. App Server-controlled execution and remote-TUI ownership remain separately approved fallback concerns.
- Added the conjunctive settings-bridge plus host-stage-turn-lifecycle gate; Tasks 2–6 are explicitly blocked on CLI `0.144.4` while either capability is unavailable.
- Review confirmed all five requested architecture classes, eleven comparison dimensions, thirteen acceptance criteria, six dependency-mapped tasks, token overhead, tradeoffs, migration impact, and per-stage attribution consequences are covered.
- No routing source, config, skill, test, or runtime behavior was modified. Only this proposed design and the deferred status of the usage plan changed.

Verification status: `architecture_approved`; implementation remains blocked until both Task 1 capability gates are proven.

## 12. `/model` runtime audit

Audit target: official `openai/codex` tag `rust-v0.144.4`, commit `8c68d4c87dc54d38861f5114e920c3de2efa5876`, matching the installed CLI.

Verified chain:

```text
/model TUI popup
    ↓
apply_model_and_effort
    ↓
AppEvent::UpdateModel
AppEvent::UpdateReasoningEffort
    ↓
active_thread_model_setting_update_params
active_thread_reasoning_setting_update_params
    ↓
same TUI AppServerSession
    ↓
thread/settings/update(threadId, model, effort)
    ↓
subsequent turns use updated thread settings
```

The picker also emits `PersistModelSelection`, but persistence is separate from live thread mutation. Writing `config.toml` is therefore not the primitive that changes the active thread.

Capability results for Codex CLI `0.144.4`:

- `current_thread_settings_update_version_verified`: the version-specific generated App Server protocol and TUI implementation can change model and effort on the active thread for subsequent turns; this is not a stable plugin/host API contract.
- `slash_model_zero_model_turn`: `/model` itself emits settings events and no user/model turn.
- `in_flight_model_switch_unavailable`: the already-running model invocation is not replaced; the update applies only to a later turn.
- `current_thread_settings_bridge_unavailable`: Codex Dev Flow skills/plugins have no supported access to the TUI's private `AppEvent`, `AppServerSession`, or active thread settings call in this release.
- `host_stage_turn_lifecycle_unavailable`: Dev Flow has no supported host-owned boundary that separates each stage, applies settings, and starts the next stage turn in this release.
- `model_callable_route_switch_unavailable`: no current model tool for setting the root thread's model/effort was found. The upstream request for such a capability remains a feature request, not an available contract.

Consequent answer:

> Codex CLI `0.144.4` internally changes model and reasoning on the current thread without a model invocation for the settings operation, but Dev Flow cannot access that path through a supported contract and cannot create reliable host-owned stage/turn boundaries. Automatic per-stage routing therefore remains unavailable and `declared_only`.

Official source evidence:

- [`/model` selection emits live update and persistence events](https://github.com/openai/codex/blob/rust-v0.144.4/codex-rs/tui/src/chatwidget/model_popups.rs)
- [TUI forwards model/effort to active-thread settings](https://github.com/openai/codex/blob/rust-v0.144.4/codex-rs/tui/src/app/thread_settings.rs)
- [TUI dispatches updates through its App Server session](https://github.com/openai/codex/blob/rust-v0.144.4/codex-rs/tui/src/app/event_dispatch.rs)
- [Codex App Server thread/turn lifecycle](https://learn.chatgpt.com/docs/app-server.md)
- [Open model-callable reasoning control request](https://github.com/openai/codex/issues/20855)

The official source clone was temporary and removed after the audit. No interactive `/model` change, user configuration write, or model turn was performed.
