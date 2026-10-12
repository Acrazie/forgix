# ADR 0006: Make Intake Adaptive, User-Authoritative, and Token-Efficient

## Status

Accepted for current runtime. Replacement target is recorded by ADR 0030; ADR 0026 is
superseded as target design.

## Context

INTAKE must establish enough shared understanding to classify a request safely before
SHAPE explores the repository. A fixed questionnaire wastes tokens on already explicit
requests. Letting the model silently fill gaps is cheaper in the short term but removes
user control and can create expensive rework later. Moving full technical discovery into
INTAKE would duplicate SHAPE and spend quota before mode and risk are confirmed.

The workflow therefore needs an interview that can be relentless about unresolved
decisions without becoming exhaustive about irrelevant context.

## Decision

INTAKE uses a two-level interview boundary:

- INTAKE resolves product intent, an observable success signal, determining constraints,
  mode/risk, and only the scope boundaries needed to classify the request.
- SHAPE resolves repository and implementation uncertainty, then turns the success
  signal into testable acceptance criteria and an executable contract.

The interview is adaptive. A sufficiently explicit request may require zero questions.
Every generated question must identify the unresolved decision and the lifecycle outputs
its answer can change. Questions without determining impact are forbidden.

Questions are generated lazily, one at a time. Each question has two or three mutually
exclusive choices, one clearly justified recommendation, and a free-form answer path.
The user must answer or cancel. Silence, “decide for me”, or a request to advance cannot
bypass an unresolved question. Recommendations reduce interaction cost but never become
decisions without an explicit answer.

The model owns semantic sufficiency and question wording. Deterministic runtime checks
own structure, active-question uniqueness, required answers, contradictions,
deduplication, redaction, and the exit guard. One model evaluation per user response
integrates the answer, resolves every explicit decision it contains, evaluates
completeness, and emits at most the next question. A second model is not called merely
to verify the first.

INTAKE inspects only cheap entry context: repository guidance, Dev Flow configuration
and policy, primary manifests, workspace/Git identity, and explicitly cited documents.
Deeper code, dependency, test, and architecture exploration belongs to SHAPE.

INTAKE persists a compact Intake Brief and one active Decision Question, never the full
conversation. SHAPE consumes this structured projection and source references rather
than the interview transcript. If a later phase discovers missing objective, success,
determining-constraint, or mode/risk context, the workflow returns to INTAKE and
selectively invalidates dependent outputs.

Standard and Critical move automatically to SHAPE when semantic and deterministic
completeness checks pass. An explicit “move on” request is refused while context is
incomplete. Answering INTAKE questions is not implementation Approval; BUILD remains
guarded by the canonical GATE contract. Quick may bypass SHAPE only when its existing
bounded-scope guard also proves the request is already executable and verifiable without
a design decision.

After five distinct questions, INTAKE presents a compact checkpoint of resolved and
remaining decisions. This is a control point, not a hard question limit.

## Consequences

- Clear requests pay near-zero interview overhead.
- Ambiguous requests spend tokens only on decisions capable of changing outcome, risk,
  mode, or downstream work.
- The user remains the authority for every human decision.
- Resume can re-present the exact active question without replaying the conversation.
- SHAPE receives smaller, more stable context and can detect ownership violations.
- A hybrid question engine and new persisted fields require schema, state-machine,
  migration, validation, and crash/resume tests.
- Model sufficiency can still be wrong; deterministic guards, downstream reopening, and
  benchmark feedback expose that risk without a routine second model call.
