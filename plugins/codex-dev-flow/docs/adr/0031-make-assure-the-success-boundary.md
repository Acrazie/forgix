# ADR 0031: Make ASSURE the Success Boundary

Supersedes ADR 0025.

## Status

Implemented in TaskState V6.

## Context

Before TaskState V6, public lifecycle presented five macro-phases followed by `finished`:

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE -> finished
```

`finished` is not a phase, but persisting it as a sixth visible lifecycle node duplicates
the success already proved by a valid Assurance Receipt. ASSURE also spreads its work
across `reviewing`, `resolving_assure`, and `verifying`, even though review, correction,
and verification are operations inside one user-facing phase. Re-running fresh BUILD
checks in ASSURE wastes tokens and time when no later write invalidated them.

## Decision

The public lifecycle has exactly five phases and ends in ASSURE:

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE
```

- Remove persisted `finished`. A valid current Assurance Receipt derives successful
  completion; status and receipt cannot disagree.
- Replace `reviewing`, `resolving_assure`, and `verifying` with one internal `assuring`
  status. Review, correction, and checks are operations, not states.
- Every acceptance criterion receives during SHAPE an expected outcome, verifier kind
  (`command`, `model-inspection`, or `user-observation`), and evidence requirement.
- Checks executed during BUILD count when their command identity, result, and workspace
  fingerprint remain current. A later relevant write invalidates their evidence.
- ASSURE runs only missing or invalidated checks. Deterministic checks run before any
  required model review.
- Deterministic policy, never unconstrained agent choice, triggers model review from
  verifier requirements, applicable risk, out-of-scope diff, or insufficient
  deterministic evidence.
- Combine triggered model concerns into one bounded review call. Use separate specialist
  passes only when policy explicitly requires expertise or isolation.
- Do not impose a global ASSURE correction budget. Track stable `issue_id` identities;
  after two failed corrections for the same stable issue, invoke `debug-root-cause`.
  Use `blocked` only for an external dependency and `failed` only for a demonstrated
  irreparable outcome.
- Persist only a compact structured evidence index in TaskState: evidence identity,
  covered subjects, verifier kind and identity, result, observed fingerprint, detail
  reference, and digest. Keep command output and explanatory prose in the logical
  artifact or logs. The Assurance Receipt summarizes the evidence index.
- Use `user-observation` only when proof cannot be automated. Batch all outstanding
  human observations into one request and persist the explicit answer as evidence; a
  model cannot substitute for the user.
- A policy-triggered model review uses one independent read-only reviewer with a fresh,
  bounded capsule containing only triggered criteria, risks, diff, and evidence. The
  implementing parent owns corrections; full conversation history is excluded.
- Keep the Assurance Receipt minimal: task identity, contract digest, verified
  snapshot fingerprint, evidence-index digest, completion time, and receipt digest.
  Runtime proves exact coverage before emission; the receipt does not duplicate
  criteria, checks, or evidence references.
- Evidence freshness is conservative and hybrid. Scoped fingerprints are allowed only
  for a scope declared deterministically by SHAPE or policy; all other evidence uses the
  global workspace fingerprint. The final receipt always binds the complete snapshot.
- Completing ASSURE appends `assure.completed` without changing status from `assuring`.
  A valid receipt makes that state terminal and immutable. Render the public boundary as
  `[DEV FLOW · ASSURE ✓]`; do not introduce an `assured` or other success status.
- After success, return a bounded user summary: result, major changes, validation/review
  performed, and material limits. Link to detailed evidence instead of repeating the
  complete criterion-to-evidence map.
- Metrics and benchmark use derived outcome `success` when the receipt is valid. They do
  not retain `finished` as an outcome alias; explicit irreparable termination remains
  outcome `failed`.
- Atomically checkpoint the compact evidence index after every costly operation: command
  check, model review, or human observation. Resume reuses each still-fresh checkpoint;
  it does not wait until ASSURE completion or write redundant per-criterion checkpoints.
- Deduplicate deterministic work by stable check identity. Execute the minimal set of
  checks covering all criteria plus repository/policy-mandatory global checks; one
  evidence record may cover multiple subjects.
- Independent review returns a bounded structure only: verdict per subject and findings
  containing stable `issue_id`, severity, location, evidence, and required correction.
  It does not restate the plan, diff, or conversational history.
- Deterministic policy classifies blocking findings. Acceptance violations, correctness
  regressions, security issues, and applicable-risk violations block completion. Style
  or preference without an approved requirement is non-blocking and is not corrected
  automatically; the reviewer cannot redefine this threshold.
- Before model review, classify out-of-scope diff deterministically. Correct an accidental
  local reversible change natively; send a material contract change through SHAPE and
  GATE; invoke review only when classification remains ambiguous.
- Execute deterministic checks through a policy/SHAPE-declared dependency DAG ordered by
  cost and signal. Run cheap prerequisites first; a failure skips its dependants and
  model review until corrected instead of spending work on knowingly stale inputs.
- Apply the same declared-scope invalidation to review evidence. A correction invalidates
  overlapping review subjects; a globally fingerprinted review reruns after any write.
  Unrelated scoped review evidence remains reusable.
- An approved acceptance criterion cannot become `not_applicable` inside ASSURE. A change
  in applicability returns through SHAPE and GATE. Only a predeclared conditional check
  may resolve `not_applicable`, with deterministic evidence for its condition.
- If the batched human-observation request receives no answer, persist the exact pending
  request and enter `blocked` with resume target `assuring`. Resume re-renders it without
  model work or rerunning still-fresh checks.
- A negative human observation creates a stable issue. Correct it locally when possible,
  then request only invalidated observations again. User refusal or an unmet external
  dependency blocks; green automated checks cannot override explicit negative evidence.
- Remove the routed `verify-change` model skill. SHAPE defines evidence requirements,
  the parent executes deterministic commands, and runtime computes exact coverage and
  emits the receipt. The only ASSURE model call is policy-triggered independent review;
  no final model synthesizer restates deterministic evidence.
- Retain the `review-change` skill and `review` route, but reduce them to one consolidated,
  structured, policy-triggered read-only review. Remove review lanes and the arbitrary
  three-cycle cap; repeated stable issues follow the shared root-cause rule.
- ASSURE completion is an immutable historical success for its verified snapshot. Later
  workspace changes neither reopen the task nor invalidate its receipt; further changes
  require a new task and contract.
- An unplanned BUILD command counts toward required coverage only when runtime can match
  its normalized identity and observed result exactly to a compatible predeclared
  evidence requirement. Otherwise it remains supplemental evidence and cannot replace
  required proof.
- Complete ASSURE in one atomic transaction: validate exact coverage, freeze the evidence
  index, create the receipt, and append `assure.completed`. No persisted state may expose
  an event without its receipt or a receipt without its event.
- Before GATE, SHAPE projects acceptance criteria, applicable risks, and mandatory global
  checks into one coverage graph bound to the approved contract. ASSURE cannot invent a
  late requirement; a material policy change invalidates approval and returns through
  SHAPE and GATE.
- At completion, runtime deterministically selects the canonical current passing evidence
  subset that covers the graph. The receipt binds this compact `completion index`;
  supplemental observations remain referenced outside the receipt.
- SHAPE compiles the coverage graph before GATE into a canonical deduplicated operation
  set and stable evidence preferences. ASSURE executes missing operations and applies
  those preferences; it runs no exact or heuristic set-cover solver at completion.
- Checks in one dependency-DAG layer may run concurrently only when declared read-only
  and concurrency-safe. Policy bounds concurrency; all other checks run sequentially.
- Do not inject full command output into model context. Passing checks return structured
  identity/result only; failures return the shortest decisive excerpt plus a reference
  to the complete log.
- Each operation declares a deterministic success predicate before GATE: exit code plus
  any required output, artifact, or threshold assertion. Warnings block only when policy
  explicitly classifies them; neither exit code alone nor free model interpretation is
  universally sufficient.
- Normalize check identity from executable, argv, logical working directory, allowlisted
  environment, and relevant configuration/tool-version fingerprints. Exclude secrets,
  absolute local paths, volatile values, raw shell strings, and human display names from
  canonical identity.
- Route independent review to the least-cost model qualified for applicable risk. Allow
  one escalation only when its structured output is invalid or confidence falls below a
  policy threshold; the implementing agent cannot freely select a larger model.
- Build review context deterministically from triggered subjects: related hunks or
  symbols, direct dependencies, and summarized evidence. Never send the full diff merely
  because slicing exceeds budget. If the bounded capsule remains too large, use only the
  specialist passes prescribed by policy; never truncate arbitrarily.
- Snapshot before GATE the policy ceilings for review input, output, and call count.
  Material policy changes invalidate approval; transient model/service failure remains
  safely resumable inside ASSURE.
- Advance TaskState from V5 to V6 and fail older state explicitly. Do not add runtime
  migration or dual-schema compatibility for removed ASSURE/success statuses.
- Implement ADR 0030 and this decision in one TaskState V6 schema transition because
  both reshape SHAPE and the canonical Change Contract. Deliver independently verifiable
  lots inside that change rather than causing two schema breaks and duplicate rewrites.
- Represent coverage compactly as stable `subjects`, `operations`, and `covers` lists,
  with operation ordering in separate `dependsOn` edges. Persist identifiers and
  deterministic contracts, not a repeated nested tree or narrative verification plan.
- Replace `verificationRequirements` with digest-bound `assuranceContract`, containing
  the compact coverage graph, canonical operations, activation/success predicates,
  budgets, and relevant policy snapshots.
- Make the canonical Change Contract the sole owner of `assuranceContract`. Repository
  documentation is a derived projection; TaskState/runtime uses the canonical structure
  and digest without maintaining a second narrative or independently editable copy.
- Precompile any diff-dependent review as a conditional operation before GATE. ASSURE
  evaluates its deterministic activation predicate; activating it does not invent or
  expand an approved requirement.
- Keep terminal computation closed and non-configurable: `cancelled` and `failed` are
  terminal, as is `assuring` with the atomically paired valid receipt and completion
  event. Do not add a generic conditional-terminal engine.
- Render completed work publicly as `ASSURE ✓` with derived result `success`. Keep raw
  internal status `assuring` only in diagnostic JSON, not user-facing lifecycle copy.
- Verify the optimization contract with committed scenarios: zero false success in the
  fault-injection suite; zero ASSURE model calls without a review trigger; one normal
  consolidated review and at most one qualifying escalation; no rerun of current checks;
  and enforced input/output token ceilings.
- Against the captured current baseline, require zero ASSURE model tokens on no-review
  scenarios and at least 40% lower review input tokens on each review scenario, not only
  as a favorable aggregate average.
- In CI, compare deterministic serialized capsules and call counts on fixtures. In a
  controlled benchmark, record actual model-reported token usage for the same scenario
  identities. Link both reports; do not make CI depend on live model calls or accept an
  uncorrelated rough estimate as proof.
- Fault-injection coverage must reject success for stale evidence, missing subjects,
  failed checks, false activation/success predicates, material scope drift, malformed
  review output, negative human observation, and interrupted completion transactions.
- Risk and correctness controls remain mandatory, but no model review runs without a
  policy-backed need.

## Consequences

- Workflow success has one source of truth: current complete evidence represented by the
  Assurance Receipt.
- Users see ASSURE complete rather than a misleading extra phase.
- ASSURE resume needs operation/evidence progress rather than multiple orchestration
  statuses.
- Benchmark eligibility, metrics, terminal handling, schemas, projections, skills, and
  tests must derive success from the receipt.
- Removing accepted statuses requires the explicit TaskState V6 schema break.
