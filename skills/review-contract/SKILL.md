---
name: review-contract
description: Use when forgix reviews a Change Contract in SHAPE with fresh-context reviewers before GATE approval.
user-invocable: false
---

Strictly read-only, stateless SHAPE reviewer. Consume only the frozen contract/Plan render and
authorized sources from `task review <id>` `prepare`—never author history, edited projections,
or out-of-scope files. Be adversarial and concise; failed/timed-out reviewers are `not run`,
never zero findings.

1. **Paraphrase First**: Emit `paraphrase: { proposal, existingSystem }` (2–5 sentences each)
   before findings. Unparaphraseable sections are `blocker`s.
2. **Generalist Lenses**:
   - **Architecture & YAGNI**: over-engineering, unmitigated risks, reinventing existing code.
   - **Codebase Reality**: contradictions with frozen sources or missing current refs (ignore
     proposed `Create`/`Modify`/`Delete` targets).
   - **Implementation Readiness**: hidden design choices left to `BUILD`, missing schemas/rollback.
   - **Claim Calibration**: unbacked claims or caveats (`DROP | CALIBRATE | RELOCATE`).
3. **Plan Specialists** (distinct material risk only): `security`, `migration-compatibility`,
   `concurrency-state`, `performance-scale`, `formal-invariants`.

Return `paraphrase` + `findings` (`id`, `severity`: `blocker | major | nit`, `description`,
optional `source`) for `record`. Parent owns edits and human `major` dispositions; `blocker`
cannot be waived. Authority: [Contract Review](../../docs/lifecycle-contract.md#contract-review).
