---
name: dev-flow
description: Use when planning, implementing, debugging, reviewing, or verifying a repository change through the Codex Dev Flow lifecycle.
---

# Dev Flow

Follow [lifecycle contract](../../docs/lifecycle-contract.md): exactly INTAKE, SHAPE,
GATE, BUILD, ASSURE, then `finished`. Macro-phase derives from internal status; never
invent or persist another phase. Canonical registry, strict V5 state, durable state store, adaptive
INTAKE runtime, and local benchmark store are available primitives; full provider
orchestration remains incomplete. Never claim a durable transition, Approval binding,
or verification receipt without deterministic evidence.

Exact `$dev-flow init` follows Project INIT below. Parse every other invocation with
bundled deterministic script before acting.

## Skill isolation and configured integrations

When `$dev-flow` is explicitly invoked, use bundled Dev Flow skills by default.
Do not invoke skills from other plugins merely because descriptions match.

External skills are eligible only when repository configuration lists plugin identifier
in `integrations.plugins` or fully qualified skill identifier in `integrations.skills`.
Allowlisting is not activation; selected skill must still be relevant. System,
developer, repository, and effective policy instructions remain authoritative.

`npx codex-dev-flow init` remains standalone CLI command and interactive
plugin-configuration wizard.
It is separate from agentic `$dev-flow init`; never substitute one for other.

## Project INIT

Exact `$dev-flow init` is agentic project-engineering profile transaction, outside task
lifecycle and task GATE. It creates no TaskState and no product scaffold. Use bundled
dependency-free CLI `project-profile` commands as deterministic backend; never install
or fetch another package.

1. Run `codex-dev-flow project-profile session-view`, then `project-profile inspect`.
   Resume exact persisted active question unless dependency evidence changed; otherwise
   invalidate affected closure and return to Discovery. Before first session save, ensure
   `/.codex/project-init/` is ignored; if repository does not already cover it, request
   one scoped approval to add exact ignore rule. Read applicable repository guidance,
   manifests, locks, architecture sources, tests, contracts, representative code, and
   configured accessible service roots before asking. Existing profile is authoritative
   default, not proof that fingerprints remain current.
2. Core Discovery covers stack, source structure, architecture boundaries, dependency
   direction, naming, error handling, testing, and quality. Activate frontend, API,
   data, security, concurrency, performance, compatibility, migration, observability,
   deployment, rollback, and operations only when evidence or user input makes them
   applicable. Greenfield repository is valid; create profile only, never application
   code.
3. Ask only missing, contradictory, stale, or material decisions. Ask exactly one
   question per interaction. Show 2–3 viable non-dominated options, recommended option
   first, evidence/reason/confidence, direct consequences, and free-form path. Discover
   facts instead of asking. No hard question cap, five-question checkpoint, progress
   permission, or cost-estimation prompt. After each answer/Discovery boundary, pipe
   compact normalized registry and exact active question to `project-profile session-save`.
   Persist no transcript or hidden reasoning.
4. Use cheapest useful visual: ASCII for simple structure, Mermaid for non-trivial
   architecture/state/sequence, isolated temporary HTML/CSS for material UI decisions,
   Excalidraw/image only when requested or necessary. YAML remains canonical; Mermaid
   is generated projection. Temporary prototypes never enter product source.
5. Keep shared `.codex/dev-flow.project.yaml` durable and portable. It may contain only
   logical project/service identities, stack, topology/contracts, approved conventions,
   provenance, source fingerprints, relative diagram refs, revision, digest, and
   receipt. Keep volatile observations in temporary INIT registry. Never place absolute
   paths in shared profile.
6. Keep `.codex/dev-flow.project.local.yaml` gitignored. It contains only absolute local
   service-path mappings and non-contractual preferences. Before local publication,
   propose exact `/.codex/dev-flow.project.local.yaml` ignore rule if absent and obtain
   approval with profile diff. Local preferences cannot override shared decisions.
7. Multi-service Discovery is progressive. Root shared profile owns logical topology,
   responsibilities, contracts, and external profile refs. Each repository owns own
   profile. Absolute roots live only in local overlay. An inaccessible service statement
   is `user_asserted`, never verified evidence. Modifying external repository profile
   requires separate validation and publication transaction.
8. Reconcile drift selectively. Rediscover stale facts. Re-interview user-owned stale
   conventions. Invalidate only dependent decision closure. Accumulate all answers in
   temporary proposal; never update shared file after each answer. Rejected update
   leaves shared profile byte-for-byte unchanged and writes no shared stale marker.
9. Authority is: system/repository policy -> INTAKE product decisions when task-scoped
   -> explicit task exception -> shared engineering profile -> local non-contractual
   preferences -> agent defaults. Lower authority never weakens higher authority.
10. Build candidate transaction containing `profile` and optional exact `projections`.
    Pipe it to `codex-dev-flow project-profile validate`. Render adaptive summary,
    changed/stale decisions, topology, exceptions, sources, exact content digest, and
    exact canonical YAML on `view`. Validation must be read-only. Save
    `awaiting_approval` session bound to returned candidate content digest.
11. Ask one explicit final Profile Approval over exact validated digest and projections.
    Approval is separate from task GATE. Only after approval, pipe unchanged candidate
    to `codex-dev-flow project-profile publish`; backend creates receipt and publishes
    projections then shared profile atomically. Validate and publish local overlay with
    `--local`. Any candidate change requires validation and approval again. After all
    approved publications succeed, run `project-profile session-clear`.

`codex-dev-flow project-profile view [--local]` renders published canonical YAML.
Backend validation, digest, revision, privacy, receipt, symlink, and atomic-write errors
are blocking; never bypass them with direct file write. Ordinary SHAPE consumption,
domain-documentation conventions, and promotion of these profiles remain pending until
ADR 0030 runtime increment lands.

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

Resolve five reasoning-stage routes once from immutable snapshot using policy
`2026-08-12.native-build.v2`: `discover`, `plan`, `debug`, `review`, `verify`.
Unknown plan uses Plus baseline. Warning quota lowers one subscription tier; critical or
unknown quota uses Plus. High risk/ambiguity raises reasoning one level, capped `xhigh`.

Require exact assigned model/effort in initial catalog.
Never substitute a fallback model or effort. Missing assignment blocks that skill.
Do not refresh account, quota, or model data between skills. Native Codex owns BUILD
execution; parent owns ASSURE validation and verification commands.

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

Quick and Plan both enter one minimal GATE with canonical contract. Before display, run
pure deterministic preflight only: current SHAPE receipt, exact digest, contract
completeness/coverage, risk controls, fresh evidence, no open escalation, and current
approval reuse. No model call, network, Discovery, or subprocess.

Render exactly five concise lines: objective; task/criterion/validation counts; risks and
controls; short digest; actions. Accept only explicit user intent:

- approve current plan -> persist compact Plan Approval Receipt, enter `executing`;
- change with non-empty instruction -> enter `planning`, invalidating old receipt;
- reject -> enter `cancelled`;
- view -> show contract without mutation and return to same card.

Silence, ambiguity, or non-interactive execution never approves. Preflight failure
returns to targeted Discovery, Planning, or INTAKE decision route and reports exact
reason. Bind approval to actor, time, task/artifact identity, state revision/fingerprint,
and complete canonical contract digest. Exact digest change invalidates it; time alone
does not. Approval never authorizes commit, push, PR, registry, release, or other
external action.

## BUILD

Announce `[DEV FLOW · GATE → BUILD]`. Before first write or resume, require current Plan
Approval Receipt and exact contract digest. Then let native Codex implement the complete
approved plan without BUILD-specific skill, orchestration, checkpoint, progress tracker,
validation requirement, or persisted output. Local technical corrections remain native.
Material scope, product behavior, approved architecture, or risk change stops writes and
returns to SHAPE then GATE. When implementation is complete, transition automatically and
announce `[DEV FLOW · BUILD → ASSURE]`.

## ASSURE

Every profile verifies. Review lanes derive only from policy/risk: localized low-risk
work may route `executing -> verifying`; broader applicable risk routes through one or
more read-only review lanes before verification. Omit lane only with structured
evidence-backed N/A; ambiguity activates lane.

Review consumes compact Diff Capsule derived from approved criteria/risks, current
worktree diff, dependency impact, and fresh ASSURE evidence. Known deterministic failure
blocks expensive review. Findings keep stable identities. Corrections remain inside
ASSURE and re-enter only affected review or verification lane.

Use `verify-change` to map every acceptance criterion to fresh evidence. Narrow green
check proves only covered behavior. Successful verification persists compact
Verification Receipt bound to current contract/evidence and transitions directly to
sole success terminal `finished`.

Commit, push, pull request, registry, release, and other delivery work is outside Dev
Flow lifecycle/state. Native Codex may perform it afterward under its own explicit
authorization. GATE approval grants no authority for those actions.

### Opt-in local benchmark

Benchmark is out-of-band and never changes lifecycle outcome.

- Offer only when persisted `benchmarkEnabled=true` and truthful outcome is `finished`
  or `failed`. Never offer for blocked or cancelled.
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
worktree and follows repository retention policy. Reuse existing artifact
identity; never duplicate task artifact. Legacy paths such as
`docs/dev-flow/YYYY-MM-DD-<slug>.md`, `spec.md`, `plan.md`,
`risk-and-rollback.md`, and `verification.md` are repository choices only.

Resume must validate strict V5 state, reconcile config/policy/routing/artifact/Git/evidence,
selectively invalidate stale projections, then continue first unproved action. Current
runtime cannot yet enforce full provider resume. Report that limitation instead of fabricating
durability.

Never claim success without fresh evidence. Record commands, results, skipped checks,
material deviations, issue identities, and unresolved work. Detailed contract/evidence
has one owner; compact state stores references. Definitions:
[glossary](../../docs/glossary/dev-flow.md). Decisions:
[Context Capsule](../../docs/adr/0002-share-an-invalidable-context-capsule.md),
[assurance](../../docs/adr/0004-scale-assurance-lanes-by-applicable-risk.md),
[minimal GATE](../../docs/adr/0024-make-gate-a-minimal-plan-approval.md), and
[five-phase completion](../../docs/adr/0025-end-the-lifecycle-after-assure.md).
