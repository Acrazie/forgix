# Adaptive INTAKE and opt-in local benchmark

## Status

Design approved through a user-authoritative grilling session on `2026-07-27`.
Implementation approved and completed on `2026-07-28`; verification evidence recorded
below.

## Context and outcome

Codex Dev Flow must add more value than direct Codex use while consuming as few tokens
as possible. Improve INTAKE so it gathers every determining piece of user context before
SHAPE without duplicating technical discovery. Add a separate opt-in local benchmark
facility so the maintainer can measure satisfaction and conformance on real tasks
without running duplicate model executions.

## Scope and non-goals

### Scope

- adaptive, one-question-at-a-time INTAKE interview;
- user-authoritative choices with a justified recommendation and free-form answer;
- compact Intake Brief and resumable active question;
- semantic completeness plus deterministic exit checks;
- automatic INTAKE-to-SHAPE transition when complete;
- selective return to INTAKE when later phases discover missing product context;
- token, privacy, deduplication, contradiction, and retry controls;
- public `--benchmark` flag for new tasks;
- deterministic post-task questionnaire, deviation facts, local records, and summary
  command.

### Non-goals

- exhaustive technical discovery during INTAKE;
- a fixed questionnaire;
- silent model decisions on behalf of the user;
- a second routine model call for sufficiency review;
- multi-model, A/B, or vanilla-Codex comparison runs;
- production telemetry or automatic upload;
- changing SHAPE, GATE, BUILD, ASSURE, or HANDOFF behavior beyond required ownership,
  transition, and benchmark integration seams;
- implementing both lots in one unverified change.

## Constraints and decisions

- Token/quota cost is an optimization objective; reliability, user authority, privacy,
  and absence of false success are hard constraints.
- INTAKE and SHAPE form a two-level interview: product intent first, technical shaping
  second.
- A clear request may exit INTAKE with zero questions.
- Every asked question requires an explicit answer or cancellation.
- Every question declares its decision key and determining impact.
- Questions are lazy, deduplicated, and generated one at a time.
- One model evaluation per response updates the brief, resolves all explicit decisions,
  evaluates sufficiency, and emits at most one next question.
- Runtime validates structure and never treats a model assertion alone as completion.
- After five distinct questions, show a compact checkpoint; do not impose a hard cap.
- Never persist interview transcript, prompt, code, diff, secrets, or raw external
  payloads.
- Standard/Critical advance automatically to SHAPE only when completeness checks pass.
  User requests cannot force the transition.
- INTAKE responses never count as BUILD Approval.
- Quick remains available only when the request is already bounded, executable, and
  verifiable without SHAPE decisions.
- Benchmark implementation is a second lot after INTAKE implementation is verified.
- Decisions are recorded in
  [ADR 0006](../../plugins/codex-dev-flow/docs/adr/0006-make-intake-adaptive-user-authoritative-and-token-efficient.md)
  and
  [ADR 0007](../../plugins/codex-dev-flow/docs/adr/0007-collect-opt-in-local-benchmark-feedback.md).

## Canonical Intake Brief

Required logical fields:

- canonical objective;
- primary observable success signal;
- effective mode and risk;
- provenance/freshness;
- question/completeness state.

Conditional fields exist only when they influence workflow:

- success validator;
- success guardrails;
- determining constraints;
- affected users, motivation, urgency, or scope boundaries;
- technical unknowns transferred to SHAPE.

No reversible model hypothesis is stored as a user decision.

## Acceptance criteria

### Adaptive INTAKE

- **INTAKE-AC-01:** A complete explicit request can reach SHAPE or bounded Quick BUILD
  without an interview question or extra sufficiency model call.
- **INTAKE-AC-02:** An incomplete request exposes exactly one active Decision Question
  with 2–3 mutually exclusive choices, a justified recommendation, and free-form input.
- **INTAKE-AC-03:** No active question can be bypassed by silence, “decide for me”, or a
  request to advance; answer or cancellation is required.
- **INTAKE-AC-04:** One user answer can resolve multiple explicit decision keys, while
  ambiguous, conditional, contradictory, or insufficient answers are clarified without
  inventing a decision.
- **INTAKE-AC-05:** Questions without determining impact are rejected; answered or
  semantically duplicate questions are not repeated unless invalidated with a recorded
  reason.
- **INTAKE-AC-06:** Exact active question and compact brief survive crash/resume without
  replaying or persisting the full conversation.
- **INTAKE-AC-07:** `intake_complete` requires objective, observable success, coherent
  constraints/mode/risk, no contradiction, no unanswered question, and typed transfer of
  every remaining technical unknown.
- **INTAKE-AC-08:** Standard/Critical transition automatically to SHAPE only after both
  semantic and deterministic completeness; a premature advance request is refused with
  the exact missing decision.
- **INTAKE-AC-09:** Quick exits directly only when bounded-scope enforcement also proves
  it is technically localizable, executable without design choice, and verifiable.
- **INTAKE-AC-10:** Later phases route missing product intent/success/constraint/mode
  context back to INTAKE and selectively invalidate dependent data; technical unknowns
  remain in SHAPE.
- **INTAKE-AC-11:** SHAPE consumes only the compact Intake Brief, structured decisions,
  freshness/provenance, source references, and transferred unknowns—not interview
  transcript.
- **INTAKE-AC-12:** Sensitive data is never requested and is redacted before state,
  events, metrics, or brief persistence.
- **INTAKE-AC-13:** After five distinct questions, a compact checkpoint appears without
  ending or weakening the interview.
- **INTAKE-AC-14:** Invalid model output uses deterministic repair where possible, at
  most one targeted semantic retry, then a typed block.
- **INTAKE-AC-15:** Metrics distinguish zero-question paths, questions, avoided
  questions, accepted/modified recommendations, tokens/calls, latency, late reopenings,
  and mode changes without content payloads.

### Local benchmark

- **BENCH-AC-01:** `--benchmark` is accepted only for new tasks, defaults off, persists
  across resume, and is visible through status.
- **BENCH-AC-02:** Only `finished_local`, `finished`, and `failed` offer the fixed
  three-question survey; survey execution makes no model call and cannot alter outcome.
- **BENCH-AC-03:** No record exists until satisfaction, conformance, and perceived-value
  answers are all complete; non-response is excluded.
- **BENCH-AC-04:** Deterministic deviation facts use the Intake Brief for Quick and the
  approved Change Artifact for Standard/Critical.
- **BENCH-AC-05:** `.codex/benchmarks/<task-id>.json` is atomic, gitignored, excluded
  from product-diff analysis, allowlisted, redacted, bounded, and never uploaded.
- **BENCH-AC-06:** `npx codex-dev-flow benchmark summary` aggregates only complete local
  records without a model call.
- **BENCH-AC-07:** Benchmark write or summary failure cannot change a truthful terminal
  task result.

## Implementation plan

### Lot 1 — Adaptive INTAKE

1. **Contract and schema surfaces** (`INTAKE-AC-02` through `INTAKE-AC-15`)
   - Add canonical types for Intake Brief, success signals/validators, determining
     constraints, Decision Question, normalized answer, decision provenance,
     completeness result, and invalidation.
   - Extend strict state schema and V2 compatibility/migration rules without persisting
     macro-phase or transcript.
   - Add registry guards/events/transitions required for resumable INTAKE and controlled
     return from later phases.

2. **Deterministic interview runtime** (`INTAKE-AC-02` through `INTAKE-AC-08`,
   `INTAKE-AC-12` through `INTAKE-AC-14`)
   - Validate one active question, answer requirement, options/recommendation,
     decision-key impact, deduplication, contradiction, redaction, retries, checkpoint,
     and completion.
   - Persist before presenting a question; atomically persist normalized decisions after
     answers.

3. **Parent skill orchestration** (`INTAKE-AC-01` through `INTAKE-AC-11`)
   - Update Dev Flow skill to inspect cheap entry sources, evaluate only the next
     question, compact context, reject premature advancement, render UI/text fallbacks,
     and pass only the Intake Brief to SHAPE.
   - Keep routing after final mode confirmation and preserve external-skill isolation.

4. **Mode and downstream ownership** (`INTAKE-AC-08` through `INTAKE-AC-11`)
   - Strengthen Quick eligibility.
   - Route product-context invalidation to INTAKE and technical uncertainty to SHAPE.
   - Ensure INTAKE answers cannot satisfy GATE Approval.

5. **Tests and measurement** (all `INTAKE-AC-*`)
   - Add unit, schema, state-machine, parser/orchestration, privacy, invalid-output,
     crash/resume, invalidation, Quick/Standard/Critical, and token-call-count tests.
   - Capture before/after P0-compatible measurements; do not claim token improvement
     when token source is unavailable.

### Lot 2 — Opt-in local benchmark

1. **Invocation and durable flag** (`BENCH-AC-01`)
   - Parse public new-run `--benchmark`, persist it, preserve it on resume, and expose it
     through status without changing normal runs.

2. **Deterministic survey and deviations** (`BENCH-AC-02` through `BENCH-AC-04`)
   - Offer fixed survey only after eligible outcomes.
   - Compare actual surfaces/evidence/handoff against the correct authoritative contract.

3. **Local record and summary** (`BENCH-AC-03` through `BENCH-AC-07`)
   - Write complete records atomically under gitignored benchmark root with strict
     allowlist, bounds, and secret redaction.
   - Add deterministic `benchmark summary` command.

4. **Tests** (all `BENCH-AC-*`)
   - Cover parser ordering, resume, no-response/no-file, eligible outcomes, deviation
     classification, privacy, atomic failure, diff exclusion, aggregation, and no model
     invocation.

## Dependencies

- Existing V2 state persistence and canonical state-machine projections.
- Existing CLI parsing/status surfaces and terminal outcome identities.
- Full provider orchestration remains outside this change.

## Risks and rollback

- **Token regression:** too many questions or context replay. Roll back new orchestration
  behind previous INTAKE behavior while retaining schema migration support.
- **Premature completeness:** model misses a determining ambiguity. Keep downstream
  reopen path and measure late reopenings.
- **User-control regression:** recommendation becomes implicit decision. Fail closed on
  missing answer/provenance.
- **State growth/privacy:** question payloads or comments grow or leak. Enforce strict
  bounds, redaction, no transcript, and local-only benchmark records.
- **Lifecycle divergence:** new states/guards drift from registry projections. Require
  generated projection and schema checks before merge.
- **Benchmark affects truth:** survey or write failure alters task result. Keep benchmark
  out-of-band and non-fatal.

Rollback must preserve readability of states written by any released schema. Public
`--benchmark` must not ship without either supported behavior or an explicit stable
invocation error.

## Verification evidence

Implemented on `2026-07-28`.

- Lot 1: strict Intake Brief/Decision Question state, trusted `intake_complete`,
  `intake_reopened`, one-question runtime, redaction, deduplication, checkpoints,
  retry/block behavior, mode revision provenance, Quick eligibility, later-phase return,
  metrics, skill orchestration, schema/projection, and tests.
- Lot 2: public new-run `--benchmark`, durable status/resume visibility, terminal survey
  eligibility, deterministic deviations, strict/redacted atomic local store, non-fatal
  write wrapper, summary command, gitignore, docs, and tests.
- `npm run typecheck`: passed.
- `npm run build`: passed; distribution bundle regenerated.
- Applicable automated suite: `114` tests passed, `0` failed.
- `git diff --check`: passed.
- Native token telemetry was unavailable; no token-reduction percentage is claimed.
  Tests instead prove one Intake evaluation per response and no model path in benchmark
  functions.
