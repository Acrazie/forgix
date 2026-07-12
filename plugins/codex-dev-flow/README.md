# Codex Dev Flow

Portable Codex plugin for evidence-based software changes.

Runtime requires Node.js 22.18 or newer. The distributed ESM bundle contains its runtime dependencies and performs no package installation, lifecycle hook, or network access.

Public interface: $dev-flow, $dev-flow resume, $dev-flow status, and $dev-flow config.

Configuration resolves defaults, user, repository, local, then flags. Repository policy applies afterward and cannot be weakened. Task state is local under .codex/tasks; durable artifacts live under docs/dev-flow. The workflow never merges automatically.

V1 routing reads one `codex app-server` snapshot at the start of each run or resume. It calls `initialize`/`initialized`, `account/read`, `account/rateLimits/read`, and `model/list`. Only `gpt-5.6-luna`, `gpt-5.6-terra`, and `gpt-5.6-sol` are accepted. The five-hour quota window is recognized only when `windowDurationMins` is exactly `300`; unknown quota is conservative.

Example additive configuration:

```yaml
schemaVersion: 1
subscription:
  plan: auto
  quota:
    warningPercent: 50
    criticalPercent: 80
    unknownPolicy: conservative
```

`discover`, `plan`, `debug`, `review`, and `verify` receive deterministic model/effort decisions. `execute`, `validate`, and verification commands remain controlled by the parent workflow. App-server failure continues with an explicit warning; it never silently selects another model family.
