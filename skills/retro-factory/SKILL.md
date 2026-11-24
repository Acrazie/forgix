---
name: retro-factory
description: Use when forgix runs a post-work retrospective to turn recurring local signals into human-approved factory improvements.
user-invocable: false
---

Operate only as the `$forgix retro` self-improvement loop outside the 5-phase lifecycle
(never add a phase after ASSURE).

1. Run `node "<skill_dir>/../../dist/forgix.mjs" retro` to collect deterministic local
   signals (`.forgix/telemetry/runs.jsonl`, recent Git `fix:`/`revert:` commits, optional
   `entire/checkpoints/v1` checkpoints) and clusters (≥ 2 occurrences). Never read or
   persist raw conversation transcripts.
2. Route each recurring cluster strictly by the inverted pyramid:
   - **1. `mechanical_guardrail`**: linter, typechecker, schema, escape-hatch rule, or hook.
   - **2. `surface_verification_rule`**: `.forgix/project.yaml` `protectedSurfaces` /
     `surfaceVerificationRules` (validate via `forgix project-profile validate`).
   - **3. `skill_budget_bounded_doc`**: thin skill note within `promptBudget`, or
     `AGENTS.md` last resort while pruning stale entries.
3. Present concise proposed `git diff` previews linked to `clusters`/`triggeredBy`, then
   **stop for explicit human confirmation** before editing any file.
