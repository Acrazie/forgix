# Forgix Design

## Goal

Portable five-phase workflow for **Codex**, **Claude Code**, and **Antigravity** with high
correctness and low token waste. Deterministic code owns state, validation, harness-aware
routing, fingerprints, dependency closure, projections, and guards. Skills own scoped
reasoning. Each phase uses native host agent capabilities unless its contract requires a
narrower read-only role.

## Multi-harness distribution and routing

Forgix ships a single plugin root (``) backed by harness-specific manifests:

- **Codex**: `.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`
- **Claude Code**: `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`
- **Antigravity**: `plugin.json`
- **Standalone / bundled CLI**: `dist/forgix.mjs` (`bin.forgix`)

Runtime routing selects `codex-app-server` on Codex (quota-aware `gpt-5.6-luna` / `terra` / `sol`
routing from `account/read`, `account/rateLimits/read`, and `model/list`) and `host-native` on
Claude Code and Antigravity (`model: null`, `effort: null`, `reason: "host-native:<harness>"`),
while keeping `.forgix/` repository paths shared across harnesses.

## Public surface

```text
# Codex ($forgix), Claude Code (/forgix:forgix), Antigravity (/forgix)
$forgix <objective>
$forgix resume <task-id>
$forgix status [task-id]

# Standalone or bundled CLI
forgix [--harness auto|codex|claude|antigravity] <objective>
forgix task validate [task-id]
forgix task save <task-id>
forgix task gate <task-id> [--view | --approve --digest=<shown-digest> | --reject | --change=<instruction> | --autonomous [--issue=<ref>]]
```

No invocation mode exists. Entire run text is objective. State V6 rejects V1–V5 without
migration.

## Lifecycle

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE ✓
```

Canonical Shape path:

```text
new -> intaking -> discovering -> awaiting_profile_choice -> planning -> awaiting_approval
                         |                                  |
                         +-> awaiting_intake_decision <-----+
```

`awaiting_intake_decision` is INTAKE. It presents linked product question, then resumes
Discovery or Planning. No technical rediscovery is repeated.

## INTAKE/SHAPE boundary

INTAKE owns objective, success signal, determining constraints, scope product decisions,
and risk. It does not choose preparation profile or perform deep repository discovery.
Every complete Intake enters Discovery.

Discovery is repository-reading role. It resolves bounded targets, records technical
facts with provenance and source fingerprints, and creates new targets only for material
impact. `discovery_sufficient` requires semantic sufficiency plus deterministic
freshness, dependency, and unresolved-target checks.

After sufficient Discovery, user chooses:

- **Quick:** compact canonical contract; no Markdown projection.
- **Plan:** detailed canonical contract and one deterministic Proposed Markdown.

Planning is repository-blind. Missing evidence produces targeted Discovery Target.
Quick and Plan share one contract schema and same correctness minimum.

## GATE and completion

GATE performs one pure deterministic preflight, renders one five-line card, and requires
explicit user approve/change/reject intent. Approval covers complete local canonical
contract and exact digest. Contract change invalidates receipt. It never authorizes an
external action.

BUILD verifies only current approval and exact digest, then the active host agent (Codex,
Claude Code, or Antigravity) implements the complete approved plan without a Forgix
execution skill, checkpoint, progress tracker, validation loop, or persisted BUILD output.
Local technical corrections stay native; material contract changes return to SHAPE then GATE. ASSURE derives current worktree diff,
records fresh criterion-linked evidence, and atomically derives `success` inside final
ASSURE phase. Git, GitHub, registry, and release delivery remains outside lifecycle
state.

## Selective invalidation

`ShapeState` persists Discovery targets, evidence, source fingerprints, Decision
Escalations, profile choice, contract, projection, dependency DAG, invalidations, budget,
semantic retries, and receipts. Changed input invalidates only transitive dependency
closure. No full Shape reset API exists.

Supported source identities: Git blob, content digest, command plus input/result digest,
and external source with observation/TTL. Resume reuses fresh evidence without model
call and creates refresh work only for stale live evidence.

## Safety and cost

Risk/policy controls worktree, threat, rollback, approvals, and assurance. Preparation
profile controls contract depth/durable projection only.

Nominal SHAPE uses one Discovery reasoning session and one Planning session. Extra calls
require new material or invalidated target. Soft limit checkpoint preserves all work and
requires explicit continue, reduce-scope, or cancel decision.

## Artifacts

Canonical state owns logical contract. Plan Markdown is deterministic projection, not
second owner. Manual edit triggers integrate-or-regenerate reconciliation; material
integration changes digest and invalidates Approval.

See [lifecycle-contract.md](lifecycle-contract.md), [artifacts.md](artifacts.md),
[ADR 0009](adr/0009-separate-intake-decisions-from-shape-discovery.md),
[ADR 0010](adr/0010-choose-quick-or-plan-after-discovery.md),
[ADR 0033](https://github.com/Acrazie/forgix/blob/main/docs/adr/0033-upstream-roadmap-ideation-and-hybrid-github-authority.md), and
[ADR 0034](https://github.com/Acrazie/forgix/blob/main/docs/adr/0034-risk-conditioned-autonomous-execution-for-roadmap-work-items.md).

## Upstream roadmap and risk-conditioned autonomy

Forgix separates concentrated upstream planning (`$forgix roadmap`) from individual task
execution (`$forgix <objective>` or `$forgix run-issue <#num>`). The bundled CLI owns
deterministic validation, DAG acyclicity checks, candidate digesting, visual synthesis
(`tree` / `mermaid`), idempotent publication planning, and `Ready` / `blocked-by` selection
with zero network dependencies, while GitHub Project v2 mutations run through `gh` in the
agent skill after explicit user approval. Work Items reserve an isolated worktree
and task identity, then require normal human GATE. Eligibility does not authorize
autonomous issuance.
