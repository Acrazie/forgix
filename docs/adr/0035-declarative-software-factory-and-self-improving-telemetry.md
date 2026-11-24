# ADR 0035: Declarative Software Factory, Mechanical Guardrails, and Self-Improving Telemetry

## Status

Implemented.

## Context

AI coding agents can generate code faster than humans can review line-by-line diffs, but
scaling autonomous execution without strict structural boundaries produces compounding
"AI slop," prompt bloat, silent lint suppressions, and unmonitored host-privilege risks.
Conversely, platforms that centralize factory definitions into proprietary cloud control
planes or monolithic configuration files break Forgix's core invariants: a portable,
network-free, zero-dependency ESM CLI across Codex, Claude Code, and Antigravity.

Forgix already establishes a canonical engineering profile (`.forgix/project.yaml`),
operator and harness configuration (`.forgix/config.yaml` + `policy.yaml`), and a
repo-first roadmap backlog (`.forgix/roadmap.yaml`). However, it still relies on a
375-line monolithic router skill (`skills/forgix/SKILL.md`), permits `model-inspection`
without enforcing a deterministic proof floor for autonomous runs, lacks diff-level
enforcement against agent escape hatches, and has no closed-loop mechanism to turn
recurring execution friction into deterministic repository guardrails.

## Decision

### Tripartite declarative `Factory Definition` (no separate `factory.yaml`)

Represent the repository's `Factory Definition` through Forgix's existing tripartite
separation of authority rather than introducing a fourth root `factory.yaml` manifest:

- **`.forgix/project.yaml` (`Project Engineering Profile`)**: owns durable engineering
  laws, architecture boundaries, `Protected Surface` globs, and `Surface Verification
  Rule` mappings from changed file globs to mandatory `ASSURE` verification lanes and
  `Runtime Evidence` commands.
- **`.forgix/config.yaml` and `.forgix/policy.yaml`**: own the execution machinery—active
  `Harness`, `Factory Runner` selection (`worktree` vs hermetic `dagger` container),
  quota/model routing, autonomous execution ceilings, and non-weakenable repository policy
  locks.
- **`.forgix/roadmap.yaml`**: owns the work backlog (`Feature`s, `Work Item`s,
  `Shared Contract`s, and `Verification Checkpoint`s).

### Thin-Skill orchestration via CLI `Next-Action Envelope` and prompt size budgets

Shift agent guidance from prose instructions to deterministic CLI transitions:

- Every state-transition CLI command (`forgix task ...`, `forgix roadmap ...`,
  `forgix project-profile ...`) emits a deterministic `Next-Action Envelope` (`nextAction`)
  in its JSON output specifying the active lifecycle role, exact invariants applicable to
  the current transition, and allowed next commands.
- `skills/forgix/SKILL.md` is reduced to a thin router that delegates to phase-specific
  references on demand, keeping unrelated lifecycle phases out of active model context.
- `AGENTS.md` and `skills/**/SKILL.md` are governed by explicit line and byte budgets in
  `test/artifact-budget.json` so the factory cannot accumulate instructional bloat over
  time.

### Dual `Factory Runner` and `Protected Surface` write-deny

Separate fast local editing from hermetic verification:

- **`worktree` runner**: isolates each task or `Work Item` branch on the host filesystem
  while treating repository guardrails (`.forgix/policy.yaml`, `.forgix/project.yaml`,
  `.vite-hooks/`, `.oxlintrc.json`, `test/artifact-budget.json`, `.dagger/`, and formal
  specifications in `formal/`) as `Protected Surface`s. `ASSURE` deterministically fails
  if any `Protected Surface` is modified in the worktree diff unless explicitly authorized
  by the approved `Change Contract`.
- **`dagger` runner**: executes `Full Gate`, `Runtime Evidence` smoke suites, and
  `Verification Checkpoint`s inside reproducible, credential-free containers defined in
  `.dagger/` whenever a change touches runtime/packaging/CI surfaces or runs as an
  autonomous `Verification Checkpoint`.

### Triple Anti-Slop lock in `GATE` and `ASSURE`

Enforce deterministic code and verification hygiene without human line-by-line review:

1. **Diff-level `Escape Hatch` scanner**: `ASSURE` (and `bun run check`) scans the task
   diff and blocks any unapproved lint suppression (`oxlint-disable`, `eslint-disable`),
   type suppression (`@ts-ignore`, `@ts-expect-error`, `as unknown as`), or skipped test
   (`.skip`, `.todo`) unless explicitly listed in the approved `Change Contract`.
2. **`Surface Verification Rule` enforcement**: modifying `src/**` or build scripts
   mandates fresh `Runtime Evidence` against the packed artifact (`bun run pack:runtime &&
   bun run test:runtime`) in `ASSURE`.
3. **`Autonomous Proof Floor`**: `forgix task gate --autonomous` rejects eligibility for
   an `Autonomous Gate Receipt` if any acceptance criterion relies solely on
   `model-inspection` or `user-observation` where an executable command or runtime check
   is applicable.

### Closed-loop `Factory Telemetry` and `$forgix retro`

Enable the software factory to improve itself without persisting transcripts, prompts, or
secrets:

- The CLI appends compact, model-free event records to gitignored
  `.forgix/telemetry/runs.jsonl` on lifecycle friction (gate rejections, `ASSURE` check
  failures, `Escape Hatch` blocks, `debug-root-cause` activations, `Shared Contract`
  drift, and `Verification Checkpoint` failures).
- `forgix telemetry summary` deterministically aggregates first-pass `ASSURE` rates,
  recurring `AssuranceIssue` IDs, and phase bounce counts.
- `$forgix retro` (invoked on demand or at `Wave` boundaries) consumes this summary to
  produce reviewable `Factory Evolution Proposal`s ordered by a strict mechanical
  hierarchy: (1) new deterministic lint/test/schema `Mechanical Guardrail`, (2) updated
  `Surface Verification Rule` or convention in `.forgix/project.yaml`, and (3) last-resort
  skill/doc edits bounded by the prompt size budget.

## Considered Options

- **Introducing a standalone `factory.yaml` alongside `project.yaml`, `config.yaml`, and
  `roadmap.yaml`**: rejected because it duplicates engineering, runner, and backlog
  concerns across four files and creates dual-authority drift.
- **Growing `AGENTS.md` and `SKILL.md` with natural-language rules after each agent
  mistake**: rejected because larger instruction files increase token waste and reduce
  model adherence compared to deterministic linters, hooks, and CLI envelopes.
- **Running LLM-as-a-judge scorers after every task**: rejected as a default gate because
  probabilistic grading is costly, non-deterministic, and inferior to `Runtime Evidence`
  and static `Mechanical Guardrail`s.

## Consequences

- Agents operate with smaller context windows via `Next-Action Envelope` routing while
  facing stricter, non-bypassable deterministic verification in `GATE` and `ASSURE`.
- Autonomous `Work Item` runs cannot pass by weakening tests, inserting lint suppressions,
  mutating guardrail configs, or substituting `model-inspection` for executable proof.
- Recurring agent failures systematically compile into permanent `Mechanical Guardrail`s
  via `Factory Telemetry` and `$forgix retro`.
