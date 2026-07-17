# Codex Dev Flow

Portable Codex plugin for evidence-based software changes.

Runtime requires Node.js 22.18 or newer. The distributed ESM bundle contains its runtime dependencies and performs no package installation, lifecycle hook, or network access.

Conversation workflow: `$dev-flow`, `$dev-flow resume`, `$dev-flow status`, and `$dev-flow config`.

Standalone terminal CLI: `codex-dev-flow init`.

Configuration resolves defaults, user, repository, local, then flags. Repository policy applies afterward and cannot be weakened. Task state is local under .codex/tasks; durable artifacts live under docs/dev-flow. The workflow never merges automatically.

Artifact depth follows mode. Quick has no mandatory artifact. Standard creates one `docs/dev-flow/YYYY-MM-DD-<slug>.md` change record before implementation approval. Critical creates separate `spec.md`, `plan.md`, `risk-and-rollback.md`, and `verification.md` records. Resume reuses existing records. See [docs/artifacts.md](docs/artifacts.md).

V1 routing reads exactly one `codex app-server` snapshot at the start of each run or resume. It calls `initialize`/`initialized`, `account/read`, `account/rateLimits/read`, and `model/list`, then freezes all six skill routes for the workflow. It never refreshes quota between skills. Only `gpt-5.6-luna`, `gpt-5.6-terra`, and `gpt-5.6-sol` plus `low`, `medium`, `high`, and `xhigh` reasoning are accepted. The five-hour quota window is recognized only when `windowDurationMins` is exactly `300`.

When the live response omits that exact window, DevFlow may reuse a non-expired five-hour reset timestamp from `.codex/tasks/five-hour-quota-reset.json`. It never reuses the cached usage percentage: pressure remains `unknown`, routing stays conservative, and `quota_fallback_last_known` is emitted. Cache read and write failures remain non-fatal. Another available window, such as the weekly window, is exposed as `observedWindow` for information only and never drives five-hour quota pressure. Model catalogs may provide reasoning efforts as strings or as `{ reasoningEffort, description }` objects; both shapes are normalized before routing.

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

Installing the Codex plugin exposes its skills inside Codex but does not add the standalone binary to your shell `PATH`. Run the published CLI through npm directly in the project terminal you want to configure. No global installation, source checkout, Codex session, or Claude Code session is required:

```bash
cd /path/to/project
npx codex-dev-flow init
```

The Clack-powered wizard uses arrow-key menus, explanatory hints, validation, and a final review screen. The review shows workflow settings plus automatic model/reasoning assignments for every skill. Choose Create/Update, cancel, or revisit any section. `Ctrl+C` cancels without changing files. The wizard writes `.codex/dev-flow.yaml` only after final confirmation. External skills stay disabled by default. Add whole plugins or specific skills explicitly:

```yaml
schemaVersion: 1
integrations:
  plugins:
    - impeccable
  skills:
    - impeccable:frontend-design
```

`discover`, `plan`, `execute`, `debug`, `review`, and `verify` receive deterministic model/effort decisions. `execute`, `validate`, and verification commands remain controlled by the parent workflow; execution is routed but never delegated. Unknown plans use the Plus baseline. Warning quota lowers one plan tier; critical or unknown quota uses Plus. Missing exact model/effort assignments are unavailable and block instead of falling back.

Standard normal-quota routing policy `2026-07-14.skill-first.v1`:

| Skill | Plus | Pro 5x | Pro 20x |
| --- | --- | --- | --- |
| Discover | Terra / medium | Terra / high | Sol / medium |
| Plan | Sol / medium | Sol / high | Sol / xhigh |
| Execute | Terra / high | Terra / xhigh | Sol / high |
| Review | Sol / medium | Sol / high | Sol / xhigh |
| Verify | Luna / medium | Luna / medium | Terra / medium |
| Debug root cause | Sol / high | Sol / xhigh | Sol / xhigh |
