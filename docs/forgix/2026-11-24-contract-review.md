# Plan Projection: Contract Review

- Profile: plan
- Risk: medium
- Date: 2026-11-24

## Objective

Rename Forgix's pre-GATE SHAPE review stage from Goldfish Review to **Contract Review** (`contractReview` / `contract-review` / `review-contract`), add an internal `skills/review-contract/SKILL.md` incorporating high-signal review lenses and Paraphrase-First checks inspired by Google's Elephant-Goldfish Model, and enable Contract Review across all three supported harnesses (`codex`, `claude`, `antigravity`).

## Scope

- Rename `goldfish` identifiers, files, schema properties, hook receipts, error/blocker codes, Lean gate vectors, diagrams, and normative documentation to `contractReview` / `contract-review` with zero legacy aliases.
- Split `src/task/goldfish.ts` into `src/task/contract-review.ts` and `src/task/contract-review-actions.ts` under the 300 LOC file and 60 LOC function Golden Rules, removing obsolete Fallow baselines and lint exemptions.
- Add optional `paraphrase` (`proposal`, `existingSystem`) support on recorded review results, validated for length and hygiene and included in the review view digest.
- Enable explicit `--harness codex | claude | antigravity` for Contract Review and post-check hook signaling across all three harnesses.
- Add internal skill `skills/review-contract/SKILL.md` (`user-invocable: false`) and register it in `test/artifact-budget.json` and distribution tests.

## Non-Goals

- Rewriting historical dated plan records (`docs/forgix/2026-11-*.md`), historical ADRs, or `CHANGELOG.md`.
- Adding runtime dependencies or adopting EGM's 5-stage sequential review orchestration or `synthesizer`/`structural` personas.

## Acceptance Criteria & Validations

- **AC-1**: `src/core/contract-review-sources.ts`, `src/task/contract-review.ts`, and `src/task/contract-review-actions.ts` pass `fallow guard` and respect all Golden Rules without baseline weakening.
- **AC-2**: Contract Review accepts explicit `codex`, `claude`, and `antigravity` harnesses, rejects omitted/`auto` harness, and records optional `paraphrase` in review views.
- **AC-3**: `skills/review-contract/SKILL.md` is bundled, `user-invocable: false`, and passes distribution and prompt-budget checks.
- **AC-4**: `bun run check` and `bun run pack:runtime` pass with zero active `goldfish` references outside historical archives.
