---
name: dev-flow
description: Use when planning, implementing, debugging, reviewing, or verifying a repository change through the Codex Dev Flow lifecycle.
---

# Dev Flow

Follow [lifecycle contract](../../docs/lifecycle-contract.md): exactly INTAKE, SHAPE,
GATE, BUILD, ASSURE, HANDOFF. Macro-phase derives from internal status; never invent or
persist another phase. Canonical registry, strict V2 state, durable state store, adaptive
INTAKE runtime, and local benchmark store are available primitives; full provider
orchestration remains incomplete. Never claim a durable transition, Approval binding,
or handoff receipt without deterministic evidence.

Parse invocation with bundled deterministic script before acting.

## Skill isolation and configured integrations

When `$dev-flow` is explicitly invoked, use bundled Dev Flow skills by default.
Do not invoke skills from other plugins merely because descriptions match.

External skills are eligible only when repository configuration lists plugin identifier
in `integrations.plugins` or fully qualified skill identifier in `integrations.skills`.
Allowlisting is not activation; selected skill must still be relevant. System,
developer, repository, and effective policy instructions remain authoritative.

Use terminal command `npx codex-dev-flow init` for interactive configuration. This is a
standalone CLI command, not a `$dev-flow` subcommand. If requested in chat, tell user to
run it in project terminal; do not emulate wizard.

## INTAKE and routing

INTAKE owns product intent; SHAPE owns deep technical discovery. Optimize tokens without
weakening user authority, privacy, or truthful completion.

1. Parse invocation. For new runs, persist whether leading `--benchmark` is enabled.
2. Read only cheap entry sources: applicable guidance, effective Dev Flow
   config/policy, primary manifests, Git/workspace identity, and documents explicitly
   cited by user. Do not scan implementation code merely to avoid an INTAKE question.
3. In same model processing of initial request, emit structured Intake Brief,
   completeness result, and at most one Decision Question. Complete explicit requests
   may emit zero questions; never add a separate sufficiency model call.
4. Ask only information with declared `decisionKey`, missing information, and possible
   output impact. Question has 2–3 mutually exclusive options, recommended option first,
   one-line impact per option, recommendation basis/confidence, and free-form answer.
   Persist exact active question before display.
   Use interactive question UI when available; text fallback must preserve same options,
   recommendation, impacts, and free-form path. Preserve user's dominant language;
   internal IDs remain English.
5. User must answer or cancel. Silence, “decide for me”, and requests to advance never
   choose a default. Free-form response remains authoritative; normalize it without
   inventing meaning. One response may resolve multiple explicit decisions.
6. Process each answer once: update compact brief and normalized decisions, evaluate
   semantic sufficiency, then emit at most one next question. No transcript,
   re-summarization, or second routine model call.
   Off-topic/insufficient answer keeps same decision active and rephrases it. After two
   insufficient answers, explain exact block and offer answer or cancellation.
7. Do not repeat answered/duplicate questions unless a persisted dependency invalidation
   explains why. After five distinct answered questions, display one compact checkpoint;
   no hard question cap.
8. Invalid structured output: deterministic syntax repair when possible, otherwise one
   targeted semantic retry. Second semantic failure creates typed
   `semantic_output_invalid` block.

User may revise an earlier answer. Persist selective invalidation and recompute only
dependent decisions. Do not recap after each answer. Show compact checkpoint only at
five-question boundaries, contradiction/interpretation confirmation when necessary, and
Intake Brief once at exit.

Every persisted string passes bounds and secret redaction. Never request or store
credentials, raw prompts, code, diffs, or external payloads. A repository fact may
populate a decision with repository provenance; reversible model hypothesis may not.

`intake_complete` requires semantic sufficiency plus deterministic presence of canonical
objective, observable success signal/method, coherent risk, no contradiction or active
question, and typed SHAPE ownership for remaining technical unknowns. Every task enters
SHAPE when guard passes. User request to advance cannot bypass missing context; record
`advance.rejected` and re-ask exact missing decision. INTAKE answer is never GATE
Approval.

Later missing product intent, success, or determining constraint context persists
selective invalidation and returns with `intake_reopened`. Pure technical uncertainty
stays in SHAPE. SHAPE receives only Intake Brief, normalized decisions,
provenance/freshness refs, and typed technical unknowns—not interview transcript.

After complete INTAKE, resolve routing and workspace. Risk/policy-required worktree must
be ready before any repository write.

At beginning of every run/resume, create exactly one routing snapshot through `codex
app-server`: complete `initialize`/`initialized`, then read `account/read`,
`account/rateLimits/read`, and `model/list`. Persist no credentials or raw protocol
payloads.

If parser returns `routing_permission_required`, request explicit user approval to rerun
same invocation outside restrictive sandbox. Retry the same invocation at most once.
Never escalate silently. Failed first attempt is not snapshot; persist only successful
retry. If approval is denied or the retry fails, block with structured diagnostic.

Use only `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol`; efforts `low`, `medium`, `high`,
`xhigh`. Recognize quota pressure only from exact five-hour window
`windowDurationMins === 300`, warning at 50%, critical at 80%.

If live five-hour window absent, reuse only non-expired cached reset timestamp. Never
reuse cached usage percentage. Keep pressure `unknown`, route conservatively, report
`quota_fallback_last_known`. Other windows stay informational. Normalize string and
object `supportedReasoningEfforts` entries.

Resolve six stage routes once from immutable snapshot using policy
`2026-07-14.skill-first.v1`: `discover`, `plan`, `execute`, `debug`, `review`, `verify`.
Unknown plan uses Plus baseline. Warning quota lowers one subscription tier; critical or
unknown quota uses Plus. High risk/ambiguity raises reasoning one level, capped `xhigh`.

Require exact assigned model/effort in initial catalog.
Never substitute a fallback model or effort. Missing assignment blocks that skill.
Do not refresh account, quota, or model data between skills. Parent owns execute,
validate, and verification commands; route execute but never delegate mutations.

## SHAPE

Every task uses adaptive SHAPE:

```text
Discovery -> Quick|Plan choice -> Planning
```

Discovery alone reads repository. It consumes compact Intake output plus current
Discovery Targets and resolves related targets in one session. Evidence carries exact
provenance, source-granular fingerprints, and explicit dependency nodes. Widen only for
uncertainty capable of changing scope, risk, acceptance, plan, validation, or profile
recommendation.

A product-impacting technical alternative creates one rich Decision Escalation and
enters `awaiting_intake_decision`. Intake presents explicit choice without repeating
technical discovery. Answer selectively invalidates dependency closure and resumes
Discovery or Planning. Pure technical uncertainty never reopens Intake. SHAPE has no
reset-all operation.

`discovery_sufficient` combines model semantic judgment with deterministic checks:
targets resolved, no active escalation/block/stale evidence, fingerprints fresh,
dependency graph valid. No routine second model call.

After sufficiency, present compact evidence-backed Quick/Plan checkpoint. Quick is
recommended for localized linear work; Plan for material dependencies, migration,
sequencing, or coordination. Explicit plan request/policy lock may preselect Plan;
otherwise answer is mandatory and crash-resumable.

Planning never reads repository. Missing evidence returns one material Discovery Target.
Quick and Plan share canonical contract: scope/non-goals as applicable, stable criteria,
ordered tasks, criterion-linked validation, risks/controls, explicit dependencies, and
digest. Quick keeps compact state only. Plan creates one parent-rendered Proposed
Markdown; Implementation Guide requires evidence-linked material reason.

`contract_complete` combines semantic implementability with deterministic freshness,
coverage, dependency, profile, and digest checks. Nominal cost is one Discovery session
plus one Planning session. Additional calls require new material/invalidated target.
Soft-budget checkpoint preserves all work and asks continue, reduce scope, or cancel.

Parent alone writes ShapeState and Plan projection. Manual projection drift returns to
Planning for explicit integrate/regenerate reconciliation and invalidates Approval on
material change.

## GATE

Quick and Plan both enter GATE with canonical contract. Bind Approval to gate type,
actor, time, artifact identity, and canonical contract digest—not boolean approval or
path. Risk/policy decides stronger or completion Approval; preparation profile never
weakens safety.

Material objective, scope, acceptance-criteria, profile, risk, plan-behavior, or required
policy-control change invalidates affected Approval before further writes. Present
structured delta for reapproval. If deterministic Approval persistence is unavailable,
record limitation and do not claim bound Approval exists.

## BUILD

Use `execute-change` for one approved atomic task at a time. Parent is sole writer. After
each task, run targeted validation before next task. Fresh fingerprints and policy decide
broader checks.

Correctable local validation failure enters build resolution; use `debug-root-cause`
after two failed code corrections. Material contract change stops writes and returns to
SHAPE/GATE. Scope expansion never inherits old Approval.

## ASSURE

Every profile verifies. Review lanes derive only from policy/risk: localized low-risk
work may route `validating -> verifying`; broader applicable risk routes through one or
more read-only review lanes before verification. Omit lane only with structured
evidence-backed N/A; ambiguity activates lane.

Review consumes compact Diff Capsule: approved criteria/risks, changed surfaces,
dependency impact, and fresh validation evidence. Known deterministic failure blocks
expensive review. Findings keep stable identities. Code corrections return through
validation; review-only corrections return through review; evidence-only corrections
return through verification.

Use `verify-change` to map every acceptance criterion to fresh evidence. Narrow green
check proves only covered behavior. Policy may require completion GATE; otherwise
verification proceeds to HANDOFF.

## HANDOFF

Resolve every commit/push/PR action as required, selected, or not selected. Reconcile
local/remote state before each side effect. Persisted identities and receipts are target
requirements; without evidence, never claim idempotency or completion. Never merge.

- no external intent -> `finished_local`;
- selected/required actions all receipted -> `finished`;
- recoverable missing permission/action -> `ready_for_handoff`;
- non-recoverable required-outcome failure -> `failed`.

`ready_for_handoff` is stable and resumable, not terminal. Resume reconciles first and
may become `finished` directly only if matching receipts already prove completion.

### Opt-in local benchmark

Benchmark is out-of-band and never changes lifecycle outcome.

- Offer only when persisted `benchmarkEnabled=true` and truthful outcome is
  `finished_local`, `finished`, or `failed`. Never offer for blocked,
  ready-for-handoff, or cancelled.
- Ask exactly three deterministic, no-model questions: satisfaction 1–5; conformance
  yes/partial/no; plugin value useful/neutral/counterproductive. Optional comment follows.
- No response or incomplete three required answers means no record and total exclusion.
- Compute deviation facts deterministically against canonical Shape contract for both
  profiles. New file is deviation only when forbidden or unplanned by that authority.
- Write complete allowlisted/redacted record atomically to
  `.codex/benchmarks/<task-id>.json`. Never upload it. Write failure is non-fatal.
- `npx codex-dev-flow benchmark summary` aggregates complete local records without model
  calls.

## Resume, evidence, and artifacts

Target local state lives under `.codex/tasks/`; versioned artifact belongs to active
worktree and follows repository retention into commit or handoff. Reuse existing artifact
identity; never duplicate task artifact. Legacy paths such as
`docs/dev-flow/YYYY-MM-DD-<slug>.md`, `spec.md`, `plan.md`,
`risk-and-rollback.md`, and `verification.md` are repository choices only.

Resume must validate strict V3 state, reconcile config/policy/routing/artifact/Git/evidence,
selectively invalidate stale projections, then continue first unproved action. Current
runtime cannot yet enforce full provider resume. Report that limitation instead of fabricating
durability.

Never claim success without fresh evidence. Record commands, results, skipped checks,
material deviations, issue identities, and remaining actions. Detailed contract/evidence
has one owner; compact state stores references. Definitions:
[glossary](../../docs/glossary/dev-flow.md). Decisions:
[Context Capsule](../../docs/adr/0002-share-an-invalidable-context-capsule.md),
[Approval](../../docs/adr/0003-bind-approvals-to-canonical-contracts.md),
[assurance](../../docs/adr/0004-scale-assurance-lanes-by-applicable-risk.md),
[handoff](../../docs/adr/0005-make-handoff-intent-aware-and-idempotent.md).
