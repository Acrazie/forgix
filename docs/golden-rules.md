# Forgix Golden Rules

Normative engineering invariants for developing the Forgix repository (`src/`, `skills/`,
`scripts/`, and `test/`).

A **`Golden Rule`** is not a soft guideline: wherever mechanically possible, it is enforced by
a deterministic **`Mechanical Guardrail`** and protected against regression by a monotonic
**`Quality Ratchet`**. Rules that cannot be checked mechanically are explicitly marked as
review invariants.

> **Scope & Status**: Repository development governance only (excluded from the published npm
> tarball). All deterministic guardrails specified here and in
> [ADR 0038](adr/0038-enforce-ai-first-golden-rules-with-fallow-quality-ratchets.md) are `Active`
> across Fast Gate (`check:staged`), Full Gate (`bun run check`), and Diff Gate (`bun run check:diff`).
> Canonical terminology lives in [docs/glossary/forgix.md](glossary/forgix.md).

---

## 1. AI-First & Lightweight

Tools built in the AI era must be designed for both AI agents executing them and AI agents
maintaining their source code.

1. **Deterministic JSON-first CLI surface**: Interactive commands (`help`, `init`) render for
   humans; every machine command emits compact, schema-valid JSON on `stdout`
   (`{command, status, data}`, with `Next-Action Envelope` on lifecycle commands), maps
   failures solely through `EXIT_CODES`, and writes human/error diagnostics only to `stderr`.
2. **Zero external runtime dependencies and zero runtime network**: `package.json` `dependencies`
   must stay empty/absent, the shipped CLI remains a single self-contained Node.js ESM bundle
   (`dist/forgix.mjs`), and `src/**` must never import or invoke network APIs (`fetch`,
   `globalThis.fetch`, `WebSocket`, `node:http`, `node:https`, `node:net`, `node:tls`,
   `node:http2`, `node:dgram`, `node:dns`, or bare equivalents).
3. **Minimalism by subtraction**: Prefer deleting, simplifying, or reusing existing code over
   adding new abstractions, flags, or dependencies. Any new `devDependency` requires an explicit
   justification (and an ADR if it shapes architecture or CI).
4. **Strict artifact and prompt budgets**: Bundle size, tarball size, unpacked size, `AGENTS.md`
   (`<= 100` lines), every `skills/**/SKILL.md` (`<= 160` lines), and total `promptBytes`
   (`<= 22,000` bytes) are hard-gated by `check:size`.
5. **No prose where a guardrail fits**: Never duplicate rules across docs or add long prose to
   `AGENTS.md` when a linter rule, schema, Fallow check, or test can enforce the invariant
   deterministically.

---

## 2. Modularity & Granularity

Code files must stay small enough for an agent to read, reason over, and edit without saturating
context windows or conflating unrelated responsibilities.

1. **Bounded file length (`Quality Ratchet`)**:
   - `src/**`: **<= 300 physical lines** per file.
   - `scripts/**`: **<= 400 physical lines** per file.
   - `test/**`, `.dagger/**`, and `vite.config.ts`: exempt from file/function line and
     complexity caps (`health.ignore` excludes them from `fallow health`; tests share builders
     under `test/support/`).
   - **Legacy monolith non-growth**: Because `fallow health --baseline` matches by file/function
     identity and does not fail when an already-baselined file grows, committed per-file line
     ceilings in `fallow-baselines/file-lines.json` (checked by `scripts/check-golden-rules.ts`)
     freeze each legacy file at its current line count so monoliths can only shrink.
2. **Bounded function length and complexity (`Quality Ratchet`)**:
   - `src/**` and `scripts/**`: **<= 60 lines** per function (enforced via Oxlint
     `eslint/max-lines-per-function` with explicit legacy overrides in `vite.config.ts`, since
     `fallow health.maxUnitSize` is informational only), **cyclomatic complexity <= 15**, and
     **cognitive complexity <= 15** (enforced via `fallow health --baseline-mode identity`
     against `fallow-baselines/health.json`, with static-estimated `complexity-crap` disabled
     via `health.maxCrap: 0` until measured coverage is wired).
3. **Single cohesive responsibility**: Each module owns one narrow concern; avoid "god index"
   or catch-all utility files. Refactor legacy monoliths incrementally in dedicated PRs and
   tighten `fallow-baselines/` in the same PR.

---

## 3. Architecture & Module Boundaries

The runtime dependency graph must remain an explicit, acyclic, layered DAG verifiable by
`fallow architecture --cycles --boundaries --policy --no-cache --fail-on-parse-error` (and
inspectable before edits via `fallow guard <files>`).

1. **Zero import cycles**: No circular dependencies or re-export cycles anywhere in the repo.
2. **Strict `src/` zone isolation (`boundaries.coverage.requireAllFiles: true`)**: Every
   analyzed source file must belong to an explicit zone with allowed downstream imports only:

   ```text
   types   (src/types.ts)       -> []
   core    (src/core/**)        -> [types]
   profile (src/profile/**)     -> [types, core]
   task    (src/task/**)        -> [types, core]
   roadmap (src/roadmap/**)     -> [types, core]
   hooks   (src/hooks/**)       -> [types, core]
   init    (src/init/**)        -> [types, core, hooks]
   cli     (src/cli.ts)         -> [types, core, profile, task, roadmap, hooks, init]
   tooling (scripts/**, test/**, .dagger/**, vite.config.ts)
                                -> never imported by any src/** zone
   ```

3. **Domain isolation**: Peer domains (`profile`, `task`, `roadmap`) must not import one another.
   Any contract or helper genuinely shared across domains belongs in `types` or `core`.
4. **Single composition root**: `src/cli.ts` is the sole composition root; no module under
   `src/**` may import `src/cli.ts` (tests under `tooling` may import `src/cli.ts` directly).
   Skills interact with the runtime exclusively through the built CLI (`dist/forgix.mjs`).
5. **Declarative network ban (`rulePacks`)**: A standalone Fallow rule pack
   (`fallow-rules/no-network.json`, referenced via `.fallowrc.json` `rulePacks`) scoped to
   `files: ["src/**"]` enforces `banned-import` (Node network modules), `banned-call`
   (`fetch`, `globalThis.fetch`, `WebSocket`), and `banned-effect: ["network"]` with
   `"severity": "error"`, paired with `.fallowrc.json`
   `rules: { "policy-violation": "error", "re-export-cycle": "error" }` so neither network
   usage nor re-export cycles can fail open under `fallow architecture --cycles --boundaries
   --policy --no-cache --fail-on-parse-error`.

---

## 4. Hygiene & Zero Duplication

Dead code and copy-pasted logic waste tokens, create silent drift, and mislead agents editing
only one copy.

1. **Zero new dead code (`Quality Ratchet`)**: A dedicated blocking gate
   (`bun run check:dead-code:gate` running
   `fallow dead-code --fail-on-issues --no-cache --fail-on-parse-error --baseline fallow-baselines/dead-code.json`)
   blocks any new unused file, unused export, unused type, duplicate export, unlisted binary, or
   misplaced dependency. The advisory JSON report script (`check:dead-code` used by
   `dagger call dead-code-report` for `.fallow/dead-code.json`) stays separate so Buildkite
   artifact generation never breaks.
2. **Zero new code duplication (`Quality Ratchet`)**:
   `fallow dupes --fail-on-issues --no-cache --baseline fallow-baselines/dupes.json`
   scoped strictly to `src/**` and `scripts/**` (`duplicates.ignore` excludes `test/**`,
   `.dagger/**`, and `vite.config.ts`; `mode: "mild"`, `minLines: 6`, `minTokens: 50`,
   `ignoreImports: true`) blocks any new clone beyond the committed baseline.
3. **Strict typing and high-signal linting**: TypeScript strict mode (`tsc --noEmit` for both
   runtime and tooling), `vp fmt --check`, and `vp lint` (native + `--type-aware`,
   `maxWarnings: 0`) must pass cleanly.

---

## 5. Zero Regression & Testing Discipline

Zero regressions require deterministic tests paired with every behavioral change.

1. **Behavior and regression test pairing**:
   - Every behavioral change in `src/**` or `scripts/**` must add or update focused tests in
     `test/**` asserting public behavior and invariants (not incidental internals).
   - Every bug fix (`fix:`) must include a **regression test** that fails before the fix and
     passes after it.
   - **Deterministic Diff Gate rule (`bun run check:diff`)**: Any diff touching `src/**` or
     `scripts/**` must also touch at least one file under `test/**`, with a narrow deterministic
     exemption only when all commits on the branch are `refactor:`, zero public exports are
     added/removed/changed, and the full test suite plus coverage ratchet pass.
2. **Randomized, zero-retry execution**: All Bun tests run with `randomize = true` and
   `retry = 0` (`bunfig.toml`) so order dependence and flakiness fail immediately.
3. **Monotonic `Coverage ratchet`**: `bunfig.toml` per-file coverage floors (`lines` and
   `functions`, enforced per file by Bun per ADR 0014 and ratcheted to measured per-file
   reality: `0.72` lines / `0.90` functions, with measured aggregate `90.72%` lines / `97.73%`
   functions) may only move upward, never downward.
4. **Zero new structural coverage gaps (`Quality Ratchet`)**: Because `fallow health --baseline`
   tracks complexity findings only, `scripts/check-golden-rules.ts` parses
   `fallow health --coverage-gaps --format json --no-cache` against
   `fallow-baselines/coverage-gaps.json` and fails if any new runtime file or export under
   `src/**` lacks a dependency path from `test/**`.
5. **Runtime and audit verification**:
   - Any CLI, build, or packaging change must pass `bun run test:runtime` (`node --test` on the
     packed tarball) as `Runtime Evidence`.
   - `fallow mutation --plan --base main` is available as an opt-in audit check for high-risk
     changes (not part of the default gate).

---

## 6. Contracts, Security & Anti-Bypass

Guardrails fail if an agent can silence them or mutate their own thresholds.

1. **Zero inline `Escape Hatch`es in `src/**`**:
   - `scripts/check-golden-rules.ts` asserts `fallow suppressions --format json` returns `0`
     entries (since `fallow suppressions` itself always exits `0`).
   - Inline directives (`oxlint-disable`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error`,
     `@ts-nocheck`, `fallow-ignore`, `@expected-unused`, `as any`) are forbidden in `src/**`.
     Staged-file checking (`check:staged`) reads staged Git index blobs (`git show :<path>`) so
     unstaged edits cannot mask staged suppressions. Legitimate exceptions must live centrally in
     versioned config (`vite.config.ts` or `.fallowrc.json`) with a rationale comment.
   - Git hooks must never be bypassed (`--no-verify` / `git commit -n` is forbidden).
2. **`Protected Surface` lock**: The following governance, policy, and gate files are
   `Protected Surface`s—reconciled across `docs/golden-rules.md`, `src/core/config.ts`
   (`DEFAULT_PROTECTED_SURFACES`), and `docs/git-workflow.md` (`Human-Reviewed` triggers)—so no
   agent in `BUILD` or `Fast-Track` delivery may relax thresholds, expand baselines, or remove
   checks without explicit contract and human approval:
   - `docs/golden-rules.md`
   - `.fallowrc.json`, `fallow-baselines/**`, and `fallow-rules/**`
   - `vite.config.ts` and `bunfig.toml`
   - `test/artifact-budget.json`
   - `.forgix/config.yaml`, `.forgix/policy.yaml`, and `.forgix/project.yaml`
   - `.vite-hooks/**`, `.dagger/**`, `.buildkite/pipeline.yml`, and `formal/**`
3. **Security, privacy, and non-bypassable invariants**:
   - Preserve `merge: never` as a non-bypassable invariant.
   - Never persist credentials, raw `codex app-server` payloads, hidden reasoning, or absolute
     local paths in shared artifacts.
   - Keep durable state schema-validated, digest-bound, and atomically written.
   - Never claim success without command-backed evidence.
4. **Independent review on structural changes**: Architectural, boundary, or `Protected Surface`
   changes require independent review (separate review context / human approval).

---

## Enforcement Matrix & Gate Placement

Committed Fallow baselines live under **`fallow-baselines/`** (`dead-code.json`, `health.json`,
`dupes.json`, `file-lines.json`, `coverage-gaps.json`) at repository root—outside `.fallow/`
(ignored by Git and excluded from Dagger containers) and outside `package.json` `files` (zero
tarball impact). `.fallowrc.json` maps `audit.{deadCode,health,dupes}Baseline` to the same paths
so `fallow baselines prune` stays aligned.

| Rule Area                                            | Deterministic `Mechanical Guardrail`                                                                                                                                                                               | Gate Placement                                                           | Status           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------- |
| Formatting & high-signal lint                        | `vp fmt --check`, `vp lint`, `vp lint --type-aware`                                                                                                                                                                | Fast Gate (`pre-commit`) + Full Gate (`bun run check`)                   | Active           |
| Inline `Escape Hatch` ban                            | Staged index-blob scan (`check:staged`) + full scan (`scripts/check-golden-rules.ts`) + `fallow suppressions --format json` = 0                                                                                    | Fast Gate (`pre-commit`) + Full Gate (`bun run check`)                   | Active           |
| Bundle & prompt budgets                              | `bun run check:size` (`test/artifact-budget.json`)                                                                                                                                                                 | Full Gate (`bun run check`)                                              | Active           |
| Zero runtime deps                                    | `scripts/check-golden-rules.ts` asserts `package.json` `dependencies` is absent/empty                                                                                                                              | Full Gate (`bun run check`)                                              | Active           |
| Architecture zones, zero cycles & `src/` network ban | `fallow architecture --cycles --boundaries --policy --no-cache --fail-on-parse-error` (7 zones + `requireAllFiles: true` + `fallow-rules/no-network.json` + `policy-violation`/`re-export-cycle` set to `"error"`) | Full Gate (`bun run check`)                                              | Active           |
| File length & legacy monolith non-growth             | `fallow health --no-cache --fail-on-parse-error` (`maxFileLines` 300/400) + `scripts/check-golden-rules.ts` per-file ratchet (`fallow-baselines/file-lines.json`)                                                  | Full Gate (`bun run check`)                                              | Active           |
| Function length & complexity                         | Oxlint `eslint/max-lines-per-function` (<= 60 + legacy overrides) + `fallow health --no-cache --fail-on-parse-error --baseline-mode identity --baseline fallow-baselines/health.json` (CC/Cog <= 15, `maxCrap: 0`) | Full Gate (`bun run check`)                                              | Active           |
| Zero new dead code                                   | `bun run check:dead-code:gate` (`fallow dead-code --fail-on-issues --no-cache --fail-on-parse-error --baseline fallow-baselines/dead-code.json`)                                                                   | Full Gate (`bun run check`)                                              | Active           |
| Zero new duplication                                 | `fallow dupes --fail-on-issues --no-cache --baseline fallow-baselines/dupes.json` (`src/**`, `scripts/**`)                                                                                                         | Full Gate (`bun run check`)                                              | Active           |
| Structural coverage gaps                             | `scripts/check-golden-rules.ts` parsing `fallow health --coverage-gaps --format json --no-cache` vs `fallow-baselines/coverage-gaps.json`                                                                          | Full Gate (`bun run check`)                                              | Active           |
| Randomized tests & `Coverage ratchet`                | `bun run test:randomization` + `bun run test:coverage` (per-file `lines >= 0.72`, `functions >= 0.90` per ADR 0014; aggregate `90.72%` / `97.73%`)                                                                 | Full Gate (`bun run check`)                                              | Active           |
| Baseline non-growth & diff→test pairing              | `bun run check:diff` (`--fail-on-baseline-growth --baseline-base origin/main` per Fallow baseline + monotonic check on `file-lines.json`/`coverage-gaps.json` + diff→test rule)                                    | Diff Gate (`.vite-hooks/pre-push` + PR CI after `git fetch origin main`) | Active           |
| Packed CLI `Runtime Evidence`                        | `bun run test:runtime` (`node --test` on packed tarball)                                                                                                                                                           | CI runtime lane + required for CLI/packaging changes                     | Active           |
| Bugfix regression test & structural review           | Regression test failing before fix + independent review on `Protected Surface` / architecture edits                                                                                                                | Review / `ASSURE` invariant                                              | Active (process) |

### Ratchet Rules

1. **Baselines may only shrink**: A PR may keep `fallow-baselines/*` unchanged or reduce them;
   adding new findings or raising per-file line caps fails `bun run check:diff`.
2. **Legacy cleanup stays separate**: Do not mix unrelated legacy file splitting with feature
   commits—retire baseline entries in focused refactoring PRs and tighten the baseline in the
   same PR.
3. **Agent pre-edit reflex**: Run `fallow guard <files>` before editing unfamiliar modules to
   inspect active boundary rules before writing code.

---

## Definition of Done (Implementation Handoff)

These delivery conditions govern a separately authorized implementation pass; approval of this
design does not authorize code edits or publication.

### Target Write Boundary & Safe Rollout Order

1. **Pre-gate cleanup (must land before activating blocking gates)**:
   - Decouple `src/roadmap/index.ts:15` from `src/task/index.ts` (move shared eligibility helper
     into `src/core/` and deduplicate `NextActionEnvelope` to `src/types.ts`).
   - Remove the lone inline `oxlint-disable-next-line` at `src/core/store.ts:187` (replace the
     control-character regex with an explicit `\0` check).
   - Reconcile `DEFAULT_PROTECTED_SURFACES` and `ESCAPE_HATCH_RULES` in `src/core/config.ts`
     (and reconcile `as unknown as` in `src/core/digest.ts:31` if kept in `ESCAPE_HATCH_RULES`).
   - Document rationale comments on existing overrides in `vite.config.ts`
     (`no-unsafe-type-assertion`, `no-await-in-loop`) and add `eslint/max-lines-per-function`
     with legacy overrides.
2. **Gate & baseline configuration**:
   - Create `fallow-baselines/{dead-code,health,dupes,file-lines,coverage-gaps}.json` and
     `fallow-rules/no-network.json` (standalone Fallow rule pack with `"severity": "error"`).
   - Update `.fallowrc.json` (7 zones + `requireAllFiles: true`, `rulePacks:
     ["fallow-rules/no-network.json"]`, `rules: { "policy-violation": "error",
     "re-export-cycle": "error" }`, `health` 300/400/15/15/`maxCrap: 0`/`health.ignore`,
     `duplicates` scope, `audit.*Baseline`).
   - Create `scripts/check-golden-rules.ts` and `scripts/check-diff.ts`; extend
     `scripts/check-staged.ts` to scan staged index blobs for inline `Escape Hatch`es.
   - Wire scripts in `package.json` (keeping `check:dead-code` advisory for
     `dagger call dead-code-report` while adding `check:dead-code:gate` and `check:diff`),
     extend `.vite-hooks/pre-push`, add a `diffGate` function in `.dagger/src/index.ts` (using
     `RELEASE_IGNORE` so `.git` is mounted), invoke it from `.buildkite/pipeline.yml` on
     PR/branch builds after fetching `origin/main`, and lift `bunfig.toml` per-file floors to
     `lines = 0.72, functions = 0.90`.
3. **Tests & docs currency**:
   - Update `test/fallow.test.ts` (align fixture with `requireAllFiles: true`), add canary tests
     for every new gate (positive + negative/failure cases: zone violation, cycle, network call
     & bare network import, >60-LOC function, monolith growth, `fallow-ignore` / `@expected-unused`
     / `@ts-nocheck` / `as any`, `dependencies` non-empty, coverage-gap addition, baseline growth,
     and diff→test violation vs pure `refactor:` exemption).
   - Update `docs/git-workflow.md` (`Human-Reviewed` triggers + Diff Gate), `CONTRIBUTING.md`,
     `AGENTS.md`, `docs/golden-rules.md` (flip `Planned` -> `Active`), and `ADR 0038` status.

### Observable Acceptance Criteria

- **AC-1 (No fail-open on modularity)**: Canary tests prove a new >300-LOC `src/` file, a +1
  line edit to a baselined legacy monolith, a new >60-LOC linear function, and a new CC/Cog >15
  function all exit non-zero in `bun run check`.
- **AC-2 (Strict architecture & zero network)**: Canary tests prove cross-domain imports
  (`roadmap -> task`, `profile -> task`), cycles, unzoned `src/` files, `fetch(...)`, and bare
  `import "node:http"` all fail `fallow architecture --cycles --boundaries --policy`.
- **AC-3 (Dead code, dupes & coverage gaps)**: Canary tests prove new unused exports, new
  duplication in `src/`/`scripts/`, and new untested `src/` exports fail `bun run check`, while
  `dagger call dead-code-report` still emits `.fallow/dead-code.json` cleanly.
- **AC-4 (Zero `Escape Hatch` & zero runtime deps)**: Canary tests prove `fallow-ignore`,
  `@expected-unused`, `oxlint-disable`, `@ts-ignore`, `@ts-nocheck`, `as any` (both staged and
  committed) and non-empty `package.json` `dependencies` all fail.
- **AC-5 (Diff Gate & CI parity)**: `bun run check` and `dagger call check --source=.` pass
  cleanly with `fallow-baselines/` mounted; `bun run check:diff` fails on baseline growth or
  untested behavioral diffs and passes on pure `refactor:` diffs; `bun run check:size` passes
  with zero tarball additions.

### Delivery Gates

- **Design approved**: Independent review coverage is complete with zero unresolved Blockers or
  Majors, and the human explicitly approves this exact revision. Neither implementation nor
  publication is authorized by design approval.
- **Implementation verified**: Under a separate mandate, all acceptance criteria pass within
  the approved write boundary (`bun run check`, `bun run check:diff`, `bun run test:runtime`,
  and `dagger call check --source=.` recorded after the final edit).
- **PR delivered**: After human review of the implementation and verification evidence, publish
  via branch/Trail under [docs/git-workflow.md](git-workflow.md) with all remote CI checks green.

---

## Review State

- **Status**: Implemented and enforced across Fast Gate (`check:staged`), Full Gate
  (`bun run check`), and Diff Gate (`bun run check:diff`).
- **Resolved from Round 1**: All 4 Blockers (unit-size/monolith non-growth/CRAP,
  `fallow suppressions` exit-0 wrapper, `coverage-gaps`/`dupes` gating, `fallow-baselines/`
  Dagger-safe path) and 6 Majors (`vite.config.ts` zone + `rulePacks` network ban, Diff Gate &
  `deadCodeReport` CI contract, `src/core/config.ts` & `docs/git-workflow.md` `Protected Surface`
  reconciliation, `AGENTS.md`/`CONTRIBUTING.md` status accuracy & ADR 0037 file count,
  `fallow health` ignore scope, `Definition of Done` handoff).
- **Live CLI adjustments verified during implementation**: `fallow dupes` does not accept
  `--fail-on-parse-error` (exit 2), and Bun 1.4.4 enforces `bunfig.toml` `coverageThreshold`
  per-file per ADR 0014 (`lines = 0.72, functions = 0.90`, matching `src/init/index.ts` at
  `72.41%` lines and `src/cli.ts` at `90.20%` functions; aggregate `90.72%` lines / `97.73%`
  functions).
