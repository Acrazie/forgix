---
id: golden-rules-guardrails
description: Enforce Fallow architecture zones, modularity limits, zero inline
  Escape Hatches, and test pairing.
globs:
  - src/**
  - scripts/**
  - test/**
enforce:
  protectedSurfaces:
    - docs/golden-rules.md
    - .fallowrc.json
    - fallow-baselines/**
    - fallow-rules/**
    - vite.config.ts
    - bunfig.toml
    - test/artifact-budget.json
    - .forgix/config.yaml
    - .forgix/policy.yaml
    - .forgix/project.yaml
    - .vite-hooks/**
    - .dagger/**
    - .buildkite/pipeline.yml
    - formal/**/*.tla
    - formal/**/*.cfg
    - formal/**/*.lean
---

- Run `fallow guard <files>` before editing unfamiliar modules; keep `src/` acyclic and zone-isolated.
- Keep `src/` <= 300 LOC, `scripts/` <= 400 LOC, functions <= 60 LOC, CC/Cog <= 15, and zero new dead code or dupes.
- Zero inline Escape Hatches in `src/**`; pair behavioral edits with tests in `test/**` and `fix:` with regression tests.
