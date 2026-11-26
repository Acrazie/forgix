---
trigger: glob
description: Enforce Fallow architecture zones, modularity limits, zero inline
  Escape Hatches, and test pairing.
globs: src/**, scripts/**, test/**
---

<!-- forgix:managed kind="rule" id="golden-rules-guardrails" source=".forgix/factory/rules/golden-rules-guardrails.md" -->

- Run `fallow guard <files>` before editing unfamiliar modules; keep `src/` acyclic and zone-isolated.
- Keep `src/` <= 300 LOC, `scripts/` <= 400 LOC, functions <= 60 LOC, CC/Cog <= 15, and zero new dead code or dupes.
- Zero inline Escape Hatches in `src/**`; pair behavioral edits with tests in `test/**` and `fix:` with regression tests.
