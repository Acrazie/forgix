---
name: forgix
description: Use when shaping, implementing, debugging, reviewing, or assuring a repository change through the Forgix lifecycle.
---

# Forgix

Follow [lifecycle contract](../../docs/lifecycle-contract.md): exactly INTAKE, SHAPE,
GATE, BUILD, ASSURE. ASSURE is final phase; never invent or persist another phase or
success status. Canonical registry, strict V6 state, durable state store, unified design protocol,
and local benchmark store are available primitives. Never claim a durable transition,
Approval binding, or Assurance Receipt without deterministic evidence.

Exact `$forgix init` follows Project INIT below. Parse every other invocation with
bundled deterministic script before acting.

## Skill isolation and configured integrations

When `$forgix` is explicitly invoked, use bundled Forgix skills by default.
Do not invoke skills from other plugins merely because descriptions match.

External skills are eligible only when repository configuration lists plugin identifier
in `integrations.plugins` or fully qualified skill identifier in `integrations.skills`.
Allowlisting is not activation; selected skill must still be relevant. System,
developer, repository, and effective policy instructions remain authoritative.

`npx forgix init` remains standalone CLI command and interactive
plugin-configuration wizard.
It is separate from agentic `$forgix init`; never substitute one for other.

## Project INIT

Exact `$forgix init` is agentic project-engineering profile transaction, outside task
lifecycle and task GATE. It creates no TaskState and no product scaffold. Use bundled
dependency-free CLI `project-profile` commands as deterministic backend; never install
or fetch another package.

1. Run `forgix project-profile session-view`, then `project-profile inspect`.
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
    Pipe it to `forgix project-profile validate`. Render adaptive summary,
    changed/stale decisions, topology, exceptions, sources, exact content digest, and
    exact canonical YAML on `view`. Validation must be read-only. Save
    `awaiting_approval` session bound to returned candidate content digest.
11. Ask one explicit final Profile Approval over exact validated digest and projections.
    Approval is separate from task GATE. Only after approval, pipe unchanged candidate
    to `forgix project-profile publish`; backend creates receipt and publishes
    projections then shared profile atomically. Validate and publish local overlay with
    `--local`. Any candidate change requires validation and approval again. After all
    approved publications succeed, run `project-profile session-clear`.

`forgix project-profile view [--local]` renders published canonical YAML.
Backend validation, digest, revision, privacy, receipt, symlink, and atomic-write errors
are blocking; never bypass them with direct file write. Ordinary SHAPE consumes approved profile and domain-documentation conventions through
portable digest-bound references. Task-local exceptions never mutate shared authority.

## INTAKE and routing

INTAKE owns Product Baseline, terminology, business rules, domain scenarios, and
business-context boundaries. SHAPE owns repository evidence and material technical
decisions. Optimize tokens without weakening user authority, privacy, or truthful
completion.

1. Parse invocation; persist leading `--benchmark` only for new runs. Read cheap entry
   sources, approved Project Profile/domain conventions, and user-cited documents. Do
   not inspect implementation generally.
2. In same initial model processing, return Product Baseline progress, domain deltas,
   frontier scores, and at most one `ActiveDesignQuestion`. Explicit request content may
   resolve several dimensions and yield zero questions. No second sufficiency call.
3. Product Baseline requires objective, affected users/value, scope/boundaries,
   observable success/validator, and risks/determining constraints. Every dimension is
   resolved or has justified `not_applicable`, provenance, freshness, and dependency ID.
   Missing/unknown is incomplete.
4. Model terminology as contextual glossary deltas. Model rules separately with actors,
   conditions, invariant/outcome, exceptions, and nominal/boundary/exception/
   contradiction scenarios. Code/tests prove current behavior, never desired meaning.
5. Rank only eligible unblocked frontier. Runtime validates 0–5 impact, irreversibility,
   risk, uncertainty, and branches-unlocked scores, then uses stable deterministic
   tie-break. Persist exactly one question before display. Resume reuses it unless a
   dependency changed.
6. Choice questions offer 2–3 non-dominated options, recommendation, basis, confidence,
   consequences, and free-form path. Open elicitation is required when options would
   invent business meaning. Silence, “choose for me”, deferral, or advance never resolves
   material decision. One answer may atomically resolve several explicit nodes.
7. Material normalization requires targeted confirmation; editorial normalization does
   not. Contradiction never closes silently. User may answer, reduce scope, or cancel.
   No transcript, raw prompt/model output, credentials, arbitrary question cap, or
   periodic checkpoint is persisted.
8. Validate all typed identities, ownership edges, bounds, redaction, acyclic graph, and
   selective dependency closure. Use deterministic syntax repair, then one targeted
   semantic retry; second invalid output blocks with `semantic_output_invalid`.
9. INTAKE completes only when semantic no-material-uncertainty declaration agrees with
   deterministic proof: five dimensions closed, no question/contradiction/stale node,
   and every durable domain delta has explicit disposition. Late product changes reopen
   only affected INTAKE branch; technical uncertainty stays SHAPE.

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
`2026-08-13.taskstate-v6.v1`: `design`, `discover`, `plan`, `debug`, `review`.
Unknown plan uses Plus baseline. Warning quota lowers one subscription tier; critical or
unknown quota uses Plus. High risk/ambiguity raises reasoning one level, capped `xhigh`.

Require exact assigned model/effort in initial catalog.
Never substitute a fallback model or effort. Missing assignment blocks that skill.
Do not refresh account, quota, or model data between skills. Native Codex owns BUILD
execution; parent owns ASSURE deterministic commands and evidence persistence.

## SHAPE

Every task uses adaptive SHAPE:

```text
Discovery -> Quick|Plan choice -> Planning
```

Discovery alone reads repository. It consumes Product Baseline/domain registries plus current
Discovery Targets and resolves related targets in one session. Evidence carries exact
provenance, source-granular fingerprints, and explicit dependency nodes. Widen only for
uncertainty capable of changing scope, risk, acceptance, plan, validation, or profile
recommendation.

Material architecture, dependency, data/migration, security/privacy, compatibility,
concurrency/performance, operations, or profile-exception choices create one evidence-first
Technical Decision and enter `awaiting_shape_decision`. Product infeasibility creates a
linked INTAKE-owned question without copying payload. Answer selectively invalidates
dependency closure and resumes exact prior Discovery or Planning role. Reversible
repository-conforming implementation detail remains agent-owned. SHAPE has no reset-all
operation.

`discovery_sufficient` combines model semantic judgment with deterministic checks:
targets resolved, no active technical decision/block/stale evidence, fingerprints fresh,
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
completeness/coverage, risk controls, fresh evidence, no open design question, and current
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

Enter sole internal status `assuring`. Reuse current BUILD evidence first, then execute
only missing/invalidated deterministic operations in assurance-contract DAG order.
Known-red prerequisites block dependants and model work. Check identity, success
predicate, scope, freshness, concurrency, and budgets come from approved canonical
contract; ASSURE invents none.

Run `review-change` only when precompiled policy predicate activates it. Use one bounded,
independent, read-only consolidated review. Corrections remain native ASSURE operations
and invalidate only overlapping declared evidence. Same stable issue after two failed
corrections invokes `debug-root-cause`; no arbitrary global cycle cap.

Batch required non-automatable user observations once. Missing response/external
dependency blocks with exact `resumeTo: assuring`; model never substitutes human proof.
Runtime computes exact coverage without final model synthesis. Atomic completion freezes
completion index, creates minimal Assurance Receipt, appends `assure.completed`, and
renders `[DEV FLOW · ASSURE ✓]` with derived `success`.

Commit, push, pull request, registry, release, and other delivery work is outside Dev
Flow lifecycle/state. Native Codex may perform it afterward under its own explicit
authorization. GATE approval grants no authority for those actions.

### Opt-in local benchmark

Benchmark is out-of-band and never changes lifecycle outcome.

- Offer only when persisted `benchmarkEnabled=true` and truthful outcome is `success`
  or `failed`. Never offer for blocked or cancelled.
- Ask exactly three deterministic, no-model questions: satisfaction 1–5; conformance
  yes/partial/no; plugin value useful/neutral/counterproductive. Optional comment follows.
- No response or incomplete three required answers means no record and total exclusion.
- Compute deviation facts deterministically against canonical Shape contract for both
  profiles. New file is deviation only when forbidden or unplanned by that authority.
- Write complete allowlisted/redacted record atomically to
  `.codex/benchmarks/<task-id>.json`. Never upload it. Write failure is non-fatal.
- `npx forgix benchmark summary` aggregates complete local records without model
  calls.

## Resume, evidence, and artifacts

Target local state lives under `.codex/tasks/`; versioned artifact belongs to active
worktree and follows repository retention policy. Reuse existing artifact
identity; never duplicate task artifact. Legacy paths such as
`docs/dev-flow/YYYY-MM-DD-<slug>.md`, `spec.md`, `plan.md`,
`risk-and-rollback.md`, and `verification.md` are repository choices only.

Resume must validate strict V6 state, reconcile config/policy/routing/artifact/Git/evidence,
selectively invalidate stale projections, then continue first unproved action. Never claim success without fresh evidence. Record commands, results, skipped checks,
material deviations, issue identities, and unresolved work. Detailed contract/evidence
has one owner; compact state stores references. Definitions:
[glossary](../../docs/glossary/forgix.md). Decisions:
[Context Capsule](../../docs/adr/0002-share-an-invalidable-context-capsule.md),
[assurance](../../docs/adr/0004-scale-assurance-lanes-by-applicable-risk.md),
[minimal GATE](../../docs/adr/0024-make-gate-a-minimal-plan-approval.md), and
[ASSURE success boundary](../../docs/adr/0031-make-assure-the-success-boundary.md).
