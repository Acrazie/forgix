# Codex Dev Flow

Portable Codex plugin for evidence-based software changes.

Runtime requires Node.js 22.18 or newer. The distributed ESM bundle contains its runtime dependencies and performs no package installation, lifecycle hook, or network access.

Public interface: $dev-flow, $dev-flow resume, $dev-flow status, and $dev-flow config.

Configuration resolves defaults, user, repository, local, then flags. Repository policy applies afterward and cannot be weakened. Task state is local under .codex/tasks; durable artifacts live under docs/dev-flow. The workflow never merges automatically.
