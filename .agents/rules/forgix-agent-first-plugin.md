---
trigger: always_on
description: Enforce the Agent-First Plugin invariant, JSON-first CLI, and zero
  runtime deps/network.
---

<!-- forgix:managed kind="rule" id="agent-first-plugin" source=".forgix/factory/rules/agent-first-plugin.md" -->

- Forgix is strictly agent-first (never direct human CLI operation); bare `forgix init` must refuse.
- Keep `package.json` `dependencies` empty, `dist/forgix.mjs` self-contained, and `src/**` strictly network-free.
- Machine CLI commands emit compact JSON `{command, status, data}` on `stdout` and errors on `stderr` using `EXIT_CODES`.
