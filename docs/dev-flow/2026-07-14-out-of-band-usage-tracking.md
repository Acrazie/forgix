# Out-of-band usage tracking

Status: `deferred`

Deferred on 2026-07-14 until routing decisions are proven to be applied at runtime and reliable Dev Flow run/stage boundaries exist. Tasks 3 through 7 must not start. Task 2c OpenTelemetry remains the preferred future observation-source probe, but it is intentionally postponed.

Preserved capability results:

- `skill_lifecycle_unavailable`
- `app_server_cross_process_observation_unavailable`
- `observation_unavailable`
- `run_lifecycle_unavailable`
- `routing_application_status = declared_only`

## 1. Context and outcome

Codex Dev Flow needs optional local usage collection so future routing-policy revisions can compare successful outcomes against raw token consumption. Exact passive skill attribution is unavailable in the current runtime, but that must block only per-skill measurement, not every trustworthy observation.

The invariant remains:

> Usage observability is strictly out-of-band. Tracking must never add model-visible context, invoke a model, create an additional turn, or alter routing decisions during the active run.

V1 therefore separates three layers:

1. Exact session/turn observations from host/runtime identifiers and a separately proven passive observation source.
2. Dev Flow run attribution only when a host-owned run lifecycle maps those observations to a `devFlowRunId` without inference.
3. Exact per-stage attribution deferred to a separately approved controlled benchmark mode with runtime-owned boundaries.

Tracking adds zero additional model tokens only when correlation comes exclusively from reliable host/runtime events. Missing correlation produces an explicit unavailable or unattributed state; it never produces guessed attribution.

### Audit findings

- App Server exposes `thread/tokenUsage/updated` with `threadId`, `turnId`, cumulative totals, latest usage, and raw input, cached-input, output, reasoning-output, and total token counters. Task 2b proved that a separately resumed App Server does not receive those live events from a native CLI turn, so this is not a passive cross-process source.
- Current hooks expose `session_id`; turn-scoped hooks expose `turn_id`. The current process exports neither `CODEX_THREAD_ID` nor `CODEX_TURN_ID`.
- No documented current hook or App Server event identifies bundled skill start or completion. Result: `skill_lifecycle_unavailable`.
- `$dev-flow` is an instruction-driven parent skill. Its standalone CLI computes and returns one routing snapshot plus six routing decisions, but does not execute the stage skills.
- Production references to `routingDecisions`, `delegateStage`, and `addRoutingDecision` stop at calculation, data helpers, exports, and tests. No runtime consumer applies a decision's `model` or `effort` to a stage.
- Stage skill metadata contains no model or reasoning configuration. The parent skill only states that assignments must be used.
- Current Dev Flow source has state constructors and transition helpers but no production persistence for `.codex/tasks/.../state.yaml`, no generated `devFlowRunId`, and no host-owned run completion event.
- Consequently, current six-route policy is `declared_only`, not proven `applied`. Comparing current policy versions as causal routing experiments would be invalid.
- Codex supports model and reasoning selection for custom subagents, but subagents add token/runtime overhead and change workflow behavior. They remain a V2 controlled-benchmark candidate, not a silent change to normal Dev Flow.
- Node `>=22.18.0` and built-in `node:sqlite` are available; no ORM is needed.

### Required outcome

V1 collects exact raw session/turn usage only after both identifier correlation and live passive delivery are certified for one source. No source currently passes both gates. A Dev Flow run record is created only when a separate run-lifecycle adapter supplies exact boundaries and identifiers. Otherwise tracking stays unavailable; it never substitutes inferred data.

No V1 view claims per-skill usage. No routing-policy effectiveness comparison includes records whose routing application is only declared or unknown.

## 2. Scope and non-goals

### In scope

- Opt-in configuration, disabled by default, with 400-day retention.
- Passive, exact session/turn usage observations.
- Capability-gated Dev Flow run attribution.
- Raw token breakdown, cumulative snapshot validation, delta calculation, reconnect/resume handling, and anomaly reporting.
- Structural metadata without user content.
- Routing snapshot and decisions as declared metadata plus explicit application status.
- Local SQLite outside repositories, direct versioned SQL migrations, restrictive permissions, recovery markers, and lazy retention.
- Local `codex-dev-flow usage`, JSON/CSV export, and purge.
- `completed`, `failed`, `cancelled`, and `abandoned` only when a reliable run lifecycle supplies those outcomes; otherwise lifecycle status remains unavailable rather than inferred.
- Tests enforcing zero model-visible context, zero model invocation, zero additional turn, and routing independence.

### Non-goals

- Passive per-skill or per-task attribution in V1.
- Artificial distribution of session/turn tokens across six skills.
- `codex-dev-flow benchmark` or statistical route recommendations in V1.
- Repairing or redesigning normal Dev Flow routing application inside this telemetry change.
- Treating `declared_only` routing decisions as applied experiments.
- Custom stage subagents in normal Dev Flow.
- Monetary cost, quota conversion, or billable-token claims.
- Transcript parsing, expected-stage inference, tool-call inference, model-output parsing, or model-visible measurement markers.
- App Server orchestration, `turn/start`, daemon, cron, event sourcing, remote telemetry, or network export.
- Prompt, response, reasoning, source, command output, file content, transcript path, credential, or account-identity persistence.

## 3. Constraints and decisions

### Observation and attribution model

- `UsageObservation` is an exact quantitative record keyed by certified session/thread and optional turn identifiers. It does not imply a Dev Flow run.
- `DevFlowRunUsage` aggregates linked observations only when a host/runtime adapter supplies exact `devFlowRunId`, start, terminal boundary, and status.
- `taskId`, `skillRunId`, and skill are absent from V1 usage records. Their exact attribution remains deferred.
- Unlinked observations use `attributionStatus = unattributed`; they are still useful for raw local consumption views but excluded from Dev Flow policy comparisons.
- Run records include `routingApplicationStatus = applied | declared_only | unknown`. Current implementation is `declared_only` until a separate verified runtime change applies each route.
- Policy comparisons require both exact run attribution and `routingApplicationStatus = applied`.

### Capability gates

Two independent gates prevent false claims:

1. **Observation gate:** a host/runtime source must both map reliable session/turn identifiers and deliver usage from the active native CLI turn without `turn/start`, model invocation, or model-visible context.
2. **Run-attribution gate:** host/runtime events must supply exact Dev Flow invocation start, continuation/resume lineage, and terminal boundary. Explicit `$dev-flow` text, transcript contents, expected ordering, and model output are not accepted as lifecycle proof.

If only the observation gate passes, V1 stores exact unattributed session/turn observations. If neither passes, tracking reports a local non-blocking unavailable reason and writes no measurement.

`skill_lifecycle_unavailable` remains recorded but no longer blocks session/turn collection. It blocks only per-skill attribution.

### Routing audit constraint

Telemetry must not hide the current routing execution gap:

- Six routing decisions are computed and may be stored as declared metadata.
- Until a separate change proves runtime application, their status is `declared_only`.
- V1 reports and exports this provenance.
- Benchmark or comparison queries must reject `declared_only` and `unknown` records rather than implying that model/reasoning assignments affected execution.
- Fixing route application requires a separate architectural decision because supported mechanisms such as custom agents or App Server-controlled turns alter normal workflow characteristics.

### Observation adapters and counters

- Keep current frozen routing snapshot behavior unchanged.
- App Server is rejected as the passive V1 observation adapter after Task 2b: `thread/resume` returns the same identifier, but a separate process receives no live token update from the native CLI.
- OpenTelemetry remains a candidate only. It requires a separate proof of exact event fields, turn/conversation correlation, local exporter behavior, and lifecycle before implementation.
- Normalize raw protocol payloads immediately into an internal cumulative snapshot; never persist raw payloads.
- Ignore unknown fields. Reject missing, non-finite, negative, or malformed required counters.
- Cumulative `total` counters are authoritative; never sum `last`.
- Equal snapshots are duplicates. Component-wise monotonic snapshots replace the latest snapshot.
- Lower components produce reset/stale anomalies. Never compute negative deltas or silently repair values.
- Final deltas use `end - start` only for a valid monotonic pair.
- Unavailable measurements use nullable counters plus `measurementStatus` and `anomalyCode`; zero means measured zero.

### Persistence, privacy, and configuration

- Linux path: `${XDG_DATA_HOME:-~/.local/share}/codex-dev-flow/usage.sqlite`; use platform-native equivalents elsewhere.
- Share one resolver between trusted hooks and CLI. Never fall back into a repository.
- Create directories restrictively and enforce database mode `0600` on Unix.
- Use `node:sqlite`, short transactions, ordered SQL migrations, and `PRAGMA user_version`; no ORM.
- Index observation time, session/thread, turn, Dev Flow run, routing policy, application status, and run status.
- Persist minimal open-run markers only after the run-attribution gate passes. Raw observation-source events stay in memory and are discarded after normalization.
- Recovery marks stale attributable runs abandoned; unknown usage remains null.
- Configuration follows current YAML/camelCase convention:

```yaml
usage:
  enabled: false
  retentionDays: 400
```

### CLI

- `codex-dev-flow usage` is local. Interactive TTY output may use Clack.
- `--json` emits a versioned schema; `--csv` emits stable documented columns and never invokes Clack.
- Periods: current session, today, 7 days, 30 days, 6 months, 1 year, all time.
- Dimensions available for observations: total and time/session/turn. Dimensions available for exact attributed runs: subscription plan, workflow mode, routing policy, status, and routing-application status.
- Skill/model/reasoning breakdown is not presented as measured V1 attribution. Declared routing matrices may appear only under clearly labelled metadata.
- `usage purge` removes expired records. `usage purge --all` requires explicit confirmation.
- Lazy purge runs on usage commands and enabled collector startup; no background process.

## 4. Acceptance criteria

- **AC-1 — Disabled default:** Configuration defaults to `usage.enabled = false` and `usage.retentionDays = 400`; existing configurations remain valid.
- **AC-2 — Zero-token invariant:** Tracking adds no model-visible output/instruction, model invocation, turn, or routing mutation; tests reject `turn/start` and non-empty model-visible hook output.
- **AC-3 — Exact observation gate:** Measurements start only after certified session/turn correlation and live passive delivery from the selected source. Unsupported observation yields a local reason and no fabricated record.
- **AC-4 — Honest attribution:** Exact observations and Dev Flow run records are distinct. Missing run lifecycle produces `unattributed`, never an inferred `devFlowRunId`.
- **AC-5 — Per-skill deferral:** `skill_lifecycle_unavailable` blocks only per-skill/per-task attribution. V1 schema, CLI, and exports make no per-skill usage claim.
- **AC-6 — Protocol normalization:** Valid usage notifications normalize to internal cumulative snapshots; unknown fields are ignored and invalid required fields degrade gracefully.
- **AC-7 — Correct deltas:** Duplicate, monotonic, stale/out-of-order, reset, reconnect, and resume fixtures never cause summed `last`, negative values, guessing, or silent correction.
- **AC-8 — Private local persistence:** Versioned direct SQL migrations create platform-local storage with restrictive permissions, required indexes, nullable unavailable counters, and no forbidden content.
- **AC-9 — Capability-gated run lifecycle:** Run status, duration, retries, and recovery markers exist only when exact host-owned run boundaries are available; otherwise they remain unavailable.
- **AC-10 — Routing provenance:** Every attributed run marks routing as `applied`, `declared_only`, or `unknown`. Current routes default to `declared_only`; comparison eligibility requires `applied`.
- **AC-11 — Local reporting:** CLI supports requested periods, deterministic JSON/CSV, honest unattributed totals, and no unsupported skill breakdown.
- **AC-12 — Retention and purge:** Lazy cleanup honors retention; purge and guarded purge-all are transactional and report deleted counts.
- **AC-13 — Routing independence:** Tracking states cannot modify the frozen snapshot, routing decisions, model, reasoning effort, or active workflow.
- **AC-14 — Distribution and privacy:** Build, tests, plugin/skill validation, docs, and standalone CLI distribution work without external SQLite packages or persisted user content.

All criteria are mapped below.

## 5. Implementation plan mapping tasks to acceptance criteria

### Task 1 — Record routing and lifecycle audit; define capability contracts

Likely files: this record, focused interfaces under `src/usage/`, protocol/hook fixtures, and capability tests.

- Preserve `skill_lifecycle_unavailable` without blocking observation work.
- Encode independent observation and run-attribution capability results.
- Encode routing application provenance and current `declared_only` result.
- Prove no current production consumer applies six model/effort decisions and no current production writer owns durable Dev Flow run lifecycle.
- Keep route application remediation outside telemetry scope.

Covers AC-3, AC-4, AC-5, AC-9, AC-10, AC-13. Dependency: none.

### Task 2 — Prove session/turn observation source

Likely files: `src/usage/runtime-correlation.ts`, App Server/hook fixtures, and integration tests.

- Verify hook loading and whether `session_id` maps to App Server `threadId` by joining an existing test thread without `turn/start`.
- Independently prove that a separate observer receives live usage emitted by a normal native CLI turn for the same session/turn. Identifier equality alone is insufficient.
- If App Server live observation fails, compare but do not silently configure or implement an OpenTelemetry fallback. A separate proof is required before selecting it.
- Define stable unavailable reason codes for missing hook fields, unsupported protocol, failed join, and mismatched identifiers.
- Add spies proving zero model invocation, zero new turn, and empty model-visible hook output.
- If this gate fails, stop collector implementation; CLI/config documentation may still describe unavailable behavior.

Covers AC-2, AC-3, AC-6, AC-13. Depends on Task 1.

### Task 3 — Add observation domain, configuration, paths, and SQLite

Likely files: `src/types.ts`, `src/config.ts`, `src/init.ts`, `schemas/config.schema.json`, new modules under `src/usage/`, versioned usage migrations, and unit/integration tests.

- Add exact observation, optional run attribution, measurement/anomaly, capability, and routing-provenance types.
- Add disabled defaults and validation while preserving config precedence and unrelated keys.
- Resolve platform-local storage consistently for hooks and CLI.
- Create direct `node:sqlite` migrations, indexes, restrictive permissions, and repository APIs.
- Reject forbidden content fields by schema and tests.

Covers AC-1, AC-4, AC-5, AC-8, AC-10, AC-14. Depends on Task 2 gate.

### Task 4 — Build passive collector and cumulative delta engine

Likely files: isolated adapter for the source selected by the observation gate, normalized event parser, in-memory collector, delta engine, and fixtures under `src/usage/` and `test/`.

- Subscribe/join only the certified active thread.
- Normalize and discard raw payloads.
- Track start/latest cumulative snapshots in memory.
- Handle duplicate, monotonic, stale, reset, reconnect, resume, missing-field, and unsupported-version cases.
- Persist exact observations and explicit anomalies; never invent attribution.

Covers AC-2, AC-3, AC-6, AC-7, AC-8, AC-13. Depends on Task 3.

### Task 5 — Add optional exact Dev Flow run correlator

Likely files: `src/usage/run-correlation.ts`, trusted hook integration only if host events pass the gate, and lifecycle/recovery tests.

- Link observations to a run only from certified host-owned start/resume/terminal events.
- Create `devFlowRunId`, status, duration, retry count, and recovery marker only with exact lifecycle evidence.
- Store frozen routing snapshot/decisions as declared metadata and mark current application status `declared_only`.
- If exact run lifecycle remains unavailable, keep observations unattributed and continue Tasks 6-7; do not parse prompts/transcripts or add model-visible commands.

Covers AC-4, AC-9, AC-10, AC-13. Depends on Tasks 1 and 4.

### Task 6 — Add local usage, export, retention, and purge CLI

Likely files: `src/parse.ts`, `src/cli.ts`, local query/export/presentation modules, and parser/query/export/purge tests.

- Add periods and exact observation totals.
- Add attributed-run dimensions only when run records exist.
- Label unattributed observations and routing provenance prominently.
- Exclude `declared_only` and `unknown` from policy-effectiveness comparisons; V1 provides no benchmark command.
- Add deterministic versioned JSON, CSV, interactive Clack output, retention, and guarded purge-all.

Covers AC-10, AC-11, AC-12, AC-14. Depends on Task 3; full observation views depend on Task 4.

### Task 7 — Verify invariants, compatibility, distribution, and docs

Likely files: repository/plugin READMEs, privacy/config documentation, skill invariant assertions, build inputs, distribution tests, and this evidence section.

- Test disabled, unavailable, unattributed, attributed, anomalous, database-failure, and protocol-drift states.
- Prove byte-equivalent routing decisions across tracking states.
- Document current routing execution gap and prohibit causal policy claims for `declared_only` records.
- Document V2 controlled benchmark direction using runtime-owned stage boundaries/custom agents only after separate approval.
- Rebuild and smoke-test standalone CLI and non-TTY exports.

Covers AC-1 through AC-14. Depends on implemented Tasks 2-6.

### Dependency summary

Task 1 records architecture truth. Task 2 is the collector feasibility gate. Tasks 3-4 follow only after one source passes identifier correlation and live passive delivery. Task 5 is optional and may remain unavailable without blocking exact session/turn observations. Task 6 follows persistence and can expose unavailable/unattributed states. Task 7 follows all implemented work.

Routing application remediation is a separate prerequisite for meaningful policy comparison, not a telemetry task.

## 6. Risks and rollback

- **Session/thread identifiers differ:** Disable observation collection; never scan local sessions or transcripts to guess.
- **No exact run lifecycle:** Keep exact observations unattributed. Do not synthesize `devFlowRunId`, success, retry, or duration.
- **Routing remains declared-only:** Store provenance but reject causal comparison. Open a separate architecture change before benchmark claims.
- **Hooks add context:** Hook stdout stays empty; tests enforce this.
- **Protocol drift:** Fail closed through adapter validation and versioned fixtures.
- **Counter resets/missing end:** Preserve anomaly with null measurement; do not report partial data as complete.
- **SQLite contention/corruption:** Use short transactions and non-blocking tracking failure; workflow continues.
- **Privacy regression:** Allowlisted schema and tests reject textual/content payload fields.
- **Misleading analytics:** Reports separate exact observations, attributed runs, and declared routing metadata.
- **Custom-agent benchmark overhead:** V2 must compare against native baseline and remain explicit; never enable silently.

Rollback: disable `usage.enabled`, remove hook declaration/entrypoint, usage modules, CLI commands, configuration schema, migrations, tests, docs, and rebuilt distribution. Existing local database remains inert user data and is never deleted automatically during code rollback.

## 7. Verification evidence

### Discovery and audit completed

- Repository was clean before this change record.
- Inspected parent and six stage skills, plugin metadata, CLI parsing/routing, App Server client, state helpers/schema, bridge, tests, build, and official current Codex hook/subagent/App Server documentation.
- Generated current App Server protocol bindings and confirmed token and turn notification shapes; temporary files were removed.
- Confirmed current process lacks `CODEX_THREAD_ID` and `CODEX_TURN_ID`.
- Confirmed hooks expose session and turn identifiers but no skill lifecycle event.
- Confirmed production code computes six decisions but contains no runtime consumer that applies model/reasoning assignments.
- Confirmed `delegateStage` is exported/tested but not called by production orchestration.
- Confirmed stage skill metadata does not select model/reasoning.
- Confirmed state persistence and `devFlowRunId` ownership are absent from production wiring.
- Confirmed custom agents can select model/reasoning but incur separate model work and remain outside normal V1.

### Current capability results

- `skill_lifecycle_unavailable`: exact passive per-skill attribution deferred.
- `routing_application_status = declared_only`: current policy comparisons are not causally valid.
- `run_lifecycle_unavailable`: exact Dev Flow run attribution not yet proven; observations must remain unattributed unless Task 5 finds a host-owned primitive.
- `app_server_cross_process_observation_unavailable`: identifiers correlate, but a separate App Server does not observe native CLI token updates.
- `observation_unavailable`: no exact passive source has yet passed the complete gate; OpenTelemetry remains unproved.

### Required implementation verification

- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm run check`
- Plugin and skill validation used by distribution tests.
- Selected-source fixtures for valid, duplicate, out-of-order, reset, reconnect, resume, unsupported, and missing-field events.
- Hook tests proving empty stdout, non-blocking failure, and no model-visible output.
- Spy tests proving zero `turn/start`, zero model invocation, and unchanged routing.
- Temporary SQLite tests for migrations, indexes, permissions, recovery, retention, purge, JSON, and CSV.
- Real local observation smoke only after Task 2 passes, using an existing non-sensitive thread and no new turn.
- Distribution smoke for linked standalone CLI and non-TTY exports.

Implementation evidence and deviations must be appended here task by task.

### Task 2 observation gate result — inconclusive

The initial probe on Codex CLI `0.144.4` never loaded a hook and therefore never tested identifier correlation. Its result is retained only as an inconclusive setup failure, not evidence that correlation is impossible.

### Task 2b observation gate result — App Server rejected

Status: `app_server_cross_process_observation_unavailable` on Codex CLI `0.144.4`.

- Installed a temporary user-level hook for `SessionStart`, `UserPromptSubmit`, and `Stop`; `/debug-config` showed user hooks enabled and no managed-hooks-only requirement, while `/hooks` showed the user source discovered, enabled, active, and trusted.
- The hook wrote only event name, `session_id`, `turn_id`, and structural source to a mode-`0600` local file, emitted zero stdout, invoked no Codex command, and added no context.
- Normal native test turns produced `SessionStart`, `UserPromptSubmit`, and `Stop` captures with session and turn identifiers.
- A separate App Server initialized with the required experimental capability and resumed the captured session using `thread/resume`; the returned `threadId` exactly equalled hook `session_id`.
- The observer issued no `turn/start`, `thread/inject_items`, or `turn/steer` request.
- During a subsequent completed native CLI turn, the hook captured both prompt-submit and stop boundaries, but the separate App Server received no `thread/tokenUsage/updated` for 120 seconds. App Server stderr remained empty.
- Therefore identifier correlation is available, but passive live cross-process observation is not. App Server cannot be the V1 passive usage source.

### App Server versus OpenTelemetry verdict

| Criterion | Separate App Server | Native OpenTelemetry |
| --- | --- | --- |
| Additional model tokens | Zero | Zero |
| Runtime overhead | Extra local process; no live events observed | Native async telemetry plus local exporter/collector overhead |
| User setup | Hook trust plus observer lifecycle | Explicit user-level `otel` config plus local OTLP endpoint |
| Plugin transparency | Cannot observe native CLI live | Candidate runtime-native emission, but setup cannot be imposed by project config |
| Reliability | Fails the live-delivery gate | Not yet proven end-to-end in this environment |
| Cross-platform | Codex process available, but architecture fails | OTLP transports are cross-platform; local collector packaging/lifecycle remains unresolved |
| Protocol stability | Experimental App Server API | Standard OTLP transport, but Codex event schema remains version-sensitive |
| Privacy | Adapter could allowlist counters | Prompts are redacted by default; collector must still allowlist structural/token fields only |

Official current configuration documents OTel as disabled by default, user-configured, and able to export Codex events with conversation/model/version metadata and response token counts. That makes it the stronger candidate, but documentation is not accepted as proof of exact local delivery or correlation.

Conclusion: `observation source = unavailable` for the present implementation gate. App Server is rejected; OpenTelemetry requires a separately approved Task 2c proof using an explicit temporary user profile/config and local ephemeral OTLP receiver. Tasks 3 through 7 remain stopped.
