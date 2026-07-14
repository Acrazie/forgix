# Rich interactive initialization TUI

## Context and outcome

`codex-dev-flow init` currently asks eight terse line-oriented questions and ends with raw YAML. Choices have no descriptions, selection requires typing exact internal values, model selection is absent, and the preview does not explain how the subscription plan, quota pressure, models, and reasoning effort affect task routing.

Replace this flow with a polished terminal UI that guides users through configuration and ends with a configuration-specific routing summary before any file is written. The user selects a subscription plan; Dev Flow remains solely responsible for assigning models and reasoning effort.

Current routing only partially distinguishes plans, is not keyed by the six actual skills, omits `execute-change`, accepts obsolete `max` and `ultra` efforts, and silently falls back across models. This change makes routing skill-first, lightweight, deterministic, and budget-aware through one initial workflow snapshot plus a static versioned policy.

## Scope and non-goals

In scope:

- Structured terminal wizard with progress, section headings, explanatory copy, defaults, validation, and graceful cancellation.
- Arrow-key single-selection for worktree, pull-request, and subscription choices.
- Numeric quota thresholds with contextual help and cross-field validation.
- Existing free-form plugin and skill allowlists, with examples and validation feedback.
- Final review screen containing human-readable configuration, routing matrix, warnings, target path, and explicit confirm/cancel/revisit actions.
- Deterministic tests through a prompt adapter plus focused terminal-level coverage.
- Documentation and rebuilt distributable.

Non-goals:

- Desktop, browser, or full-screen alternate-screen UI.
- Changing supported subscription plans, model identifiers, or model cost profiles.
- Per-skill quota refresh, token forecasting, dynamic cost optimization, or runtime route recalculation.
- Discovering or installing third-party plugins and skills during initialization.
- Guaranteeing a model or reasoning effort unavailable from the live Codex model catalog.
- Adding full product localization in this change; prompt copy remains English, consistent with current CLI and documentation.

## Constraints and decisions

- Treat “graphical interface” as a rich TUI inside the normal terminal. It must work in common Unix and Windows terminals supported by Node.
- Use the maintained `@clack/prompts` package for polished `select`, `text`, `confirm`, grouped flow, notes, boxes, progress, and cancellation handling. Pin an exact compatible version, matching repository dependency policy.
- Keep prompt mechanics behind a small internal adapter. Business logic, configuration building, routing-preview generation, validation, and persistence remain independently testable.
- Preserve atomic `0600` configuration writes and never alter an existing file until final confirmation.
- Preserve current values when re-running `init`; show them as defaults in the appropriate controls.
- Do not ask users to choose models or reasoning effort. Dev Flow owns those decisions.
- Capture account plan, exact five-hour quota window, and model catalog exactly once at workflow start. Compute and persist every skill route from that immutable snapshot. Never refresh quota between skills.
- Keep budget awareness deliberately static: versioned skill/plan matrix plus simple workflow-mode, risk, and initial-quota modifiers. No token estimator, reservation system, or cost solver.
- Route by stable skill identifiers: `discover-change`, `plan-change`, `execute-change`, `review-change`, `verify-change`, and `debug-root-cause`.
- Allow only `low`, `medium`, `high`, and `xhigh`. Remove `max` and `ultra` from types, model normalization, schemas, policy, prompts, documentation, and tests.
- Resolve `auto` from the initial account snapshot. If plan remains absent or unknown, use the Plus row and preserve explicit provenance/warning.
- Require the exact matrix model and effort to exist in the initial model catalog. Do not substitute another model or effort. Return an explicit unavailable route and block that skill when the exact route is unavailable.
- Standard, normal-quota matrix:
  - Discover: Plus Terra/medium; Pro 5x Terra/high; Pro 20x Sol/medium.
  - Plan: Plus Sol/medium; Pro 5x Sol/high; Pro 20x Sol/xhigh.
  - Execute: Plus Terra/high; Pro 5x Terra/xhigh; Pro 20x Sol/high.
  - Review: Plus Sol/medium; Pro 5x Sol/high; Pro 20x Sol/xhigh.
  - Verify: Plus Luna/medium; Pro 5x Luna/medium; Pro 20x Terra/medium.
  - Debug root cause: Plus Sol/high; Pro 5x Sol/xhigh; Pro 20x Sol/xhigh.
- Proposed lightweight modifiers pending approval:
  - Quick or low-risk work lowers effort one level, floored at `low`.
  - Standard uses the matrix unchanged.
  - Critical or high-risk/high-ambiguity work raises effort one level, capped at `xhigh`.
  - Initial warning quota uses the next lower subscription row; Plus stays Plus.
  - Initial critical or unknown quota uses the Plus row.
- Generate final summary by calling the same routing policy used by workflows. Show six exact model/effort assignments, snapshot provenance, quota pressure, policy version, and unavailable routes.
- Respect `NO_COLOR` and non-color terminals through library behavior. Keep meaningful text/symbols without relying on color alone.
- `Ctrl+C` returns a clean cancelled result without stack trace or file mutation.
- Non-TTY invocation keeps the existing explicit error.

## Acceptance criteria

- AC-1: Every fixed-choice question uses keyboard navigation, a human label, concise impact description, visible default/current value, and no requirement to type internal enum values.
- AC-2: Wizard never asks a normal user to choose a model or reasoning effort. Dev Flow automatically assigns both from skill, plan, workflow mode/risk, initial quota pressure, and exact initial availability.
- AC-3: Subscription choices explain auto-detection, Plus, Pro 5x, and Pro 20x, including their distinct routing tiers and quota multiplier without claiming guaranteed live availability.
- AC-4: Quota and integration questions explain purpose, examples, defaults, validation failures, and consequences in plain language.
- AC-5: Final review shows target file, workflow choices, plan, thresholds, integrations, model cost multipliers, and all six automatically generated skill routes derived from the same versioned routing policy.
- AC-6: Final review lets user write, cancel, or revisit a section; cancellation and `Ctrl+C` preserve existing configuration byte-for-byte.
- AC-7: Generated YAML validates against current schema, preserves unrelated existing keys, and writes atomically with mode `0600`.
- AC-8: Prompt adapter tests cover defaults, custom selections, validation, revisit, cancellation, and overwrite. Terminal-level tests cover keyboard selection, clean `Ctrl+C`, and non-TTY behavior.
- AC-9: Routing tests prove exact decisions for every skill/plan cell plus quick, critical, risk, warning, critical-quota, unknown-plan, and unknown-quota modifiers from one immutable snapshot.
- AC-9a: `execute-change` is a first-class routed skill in types, CLI decisions, durable state, workflow instructions, and documentation.
- AC-9b: Only `low`, `medium`, `high`, and `xhigh` are accepted. `max` and `ultra` are rejected or ignored at every boundary.
- AC-9c: Missing exact model or effort produces an explicit unavailable decision. No cross-model or cross-effort fallback occurs.
- AC-10: README documents controls, wizard stages, automatic routing matrix, summary meaning, and live-catalog caveat. Built `dist/dev-flow.mjs` contains the new UI and linked executable remains functional.
- AC-11: Typecheck, full test suite, distribution tests, `git diff --check`, and focused interactive tests pass on local supported Node; CI compatibility remains Node 22 and 24.

## Implementation plan

- Task 1 (covers AC-1, AC-4, AC-6, AC-8): Add exact `@clack/prompts` dependency and a typed prompt adapter. Implement production terminal controls plus scripted test adapter, including graceful `Ctrl+C` and revisit navigation.
- Task 2 (covers AC-1, AC-2, AC-3, AC-4, AC-6, AC-7): Refactor initialization into section-level configuration collection and validation. Preserve current values and advanced model overrides, atomic persistence, and non-TTY behavior.
- Task 3 (covers AC-2, AC-3, AC-5, AC-9, AC-9a, AC-9b, AC-9c): Replace generic routing heuristic with versioned skill-first matrix and lightweight modifiers. Add `execute-change`, migrate reasoning enum to `xhigh`, remove all fallbacks, apply Plus baseline for unresolved plans, and add pure routing-preview builder using the same policy.
- Task 4 (covers AC-5, AC-6): Build final review screen with configuration cards, routing summary, target path, and write/cancel/revisit action menu.
- Task 5 (covers AC-7, AC-8, AC-9): Expand unit tests for configuration construction, prompt flows, summaries, plan tiers, preservation, and cancellation. Add pseudo-terminal or controlled-stream distribution coverage for keyboard selection and interrupts.
- Task 6 (covers AC-3, AC-5, AC-10): Document wizard controls, automatic assignments, summary semantics, and runtime caveats in plugin README and root documentation where relevant. Rebuild distributable.
- Task 7 (covers AC-11): Run focused red/green tests, full checks, linked-binary smoke tests, diff review, and verification. Record exact evidence here.

Dependencies: Task 1 precedes Tasks 2 and 4. Task 2 precedes Tasks 3 and 5. Tasks 3 and 4 precede final tests and documentation.

## Risks and rollback

- Bundled CLI size grows. Mitigation: modular prompt dependency, inspect bundle size, retain single-file distribution.
- Interactive tests can be flaky across terminals. Mitigation: keep most behavior behind deterministic adapter tests; use minimal terminal-level smoke coverage.
- Summary could drift from routing. Mitigation: call routing policy directly and exhaustively test matrix cells and modifiers.
- One frozen quota snapshot can become stale during a long workflow. Accepted tradeoff: zero extra app-server calls, lower latency/token overhead, deterministic routing for the complete workflow.
- ANSI rendering may degrade in narrow, colorless, or Windows terminals. Mitigation: text-first content, bounded labels, no color-only meaning, supported stream behavior.
- Revisit flow may accidentally persist partial state. Mitigation: hold draft in memory and perform one validated atomic write only after final confirmation.

Rollback: remove prompt dependency and adapter, restore line-oriented collector, restore prior tests/docs/dist. Configuration schema stays compatible, so files created by new wizard remain readable.

## Verification evidence

- `npm run check` in `plugins/codex-dev-flow`: passed typecheck, rebuilt distribution, 52 tests passed, 0 failed.
- Focused routing/init suites: 17 tests passed after red-phase failures proved the previous heuristic, missing execute route, obsolete efforts, and fallback behavior.
- Real TTY smoke test in an isolated `/tmp` project: Clack rendered all three sections, defaults, hints, configuration card, and six-skill routing card. `Ctrl+C` at final review exited cleanly with status 0 and created no `.codex` file.
- Distribution smoke: globally linked `codex-dev-flow config validate --json` returned `status: valid`; package-manager symlink and non-TTY init tests passed.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `git diff --check`: passed.
- Built bundle contains `REASONING_EFFORTS = ["low", "medium", "high", "xhigh"]`, routing policy `2026-07-14.skill-first.v1`, and explicit `required_route_unavailable` handling.
- Bundle size changed from 571,300 bytes to 629,934 bytes (+58,634 bytes, about 10.3%) after adding Clack. Single-file distribution and zero runtime installation remain intact.
- Review cycle 1: no remaining actionable regression, security, maintainability, scope, or acceptance-coverage findings. Review added durable policy-version state and explicit `routing_unavailable` CLI status before final verification.
- Node 22 and Node 24 CI were not run locally; local supported Node and repository suite passed. Existing CI remains responsible for those version lanes.
- Untracked user-owned `plugins/codex-dev-flow/.codex/` was not read, modified, or removed. No commit was created.
