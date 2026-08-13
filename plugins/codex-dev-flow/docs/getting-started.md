# Getting Started with Codex Dev Flow

This guide installs Codex Dev Flow, creates durable project engineering conventions,
runs a first task, and explains how to resume safely. Normative behavior remains in the
[Lifecycle contract](lifecycle-contract.md) and
[Project Engineering Profile contract](project-profile-contract.md).

## 1. Check requirements

Plugin users need:

- Codex with plugin support;
- Node.js 24 or newer;
- Git; and
- Linux or macOS.

Check the runtime before installation:

```bash
node --version
```

Bun is not required to use the published plugin. It is a contributor dependency only.

## 2. Install the plugin

```bash
codex plugin marketplace add Acrazie/codex-dev-flow
codex plugin add codex-dev-flow@acrazie
```

The same installation is available interactively through `/plugins`: select
**Acrazie**, install **Codex Dev Flow**, then start a new Codex session.

## 3. Run Project INIT

Open Codex from the project repository and invoke:

```text
$dev-flow init
```

Project INIT is an agentic repository discovery and interview workflow:

```mermaid
flowchart TD
  E[Repository evidence] --> D[Discover stack, topology, and conventions]
  D --> Q{Missing, stale, contradictory, or material decision?}
  Q -- yes --> I[Ask one question with recommendation]
  I --> D
  Q -- no --> V[Validate candidate profile]
  V --> A{Explicit Profile Approval?}
  A -- approve --> P[Atomically publish profile and projections]
  A -- reject --> U[Leave shared profile unchanged]
```

It inspects available guidance, manifests, configuration, architecture sources, tests,
contracts, and representative code before asking. Questions cover only unresolved or
material decisions and appear one at a time. There is no fixed question count.

An abbreviated interaction can look like this:

```text
You:      $dev-flow init
Dev Flow: Discovery found a Node.js API with HTTP handlers and no explicit error envelope.
          Recommended: one stable JSON error shape at the transport boundary.
          A. Stable JSON envelope (Recommended)
          B. Handler-specific payloads
You:      A
Dev Flow: Profile candidate validated. Review summary ...
          Approve publication of this exact profile digest?
You:      Approve
```

The wording and decisions adapt to repository evidence. The final explicit approval—not
the sample answer—authorizes profile publication.

### Project INIT outputs

| File                                    | Content                                                     | Git policy                      |
| --------------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| `.codex/dev-flow.project.yaml`          | Portable shared architecture, topology, stack, and rules.   | Review and commit when desired. |
| `.codex/dev-flow.project.local.yaml`    | Absolute service paths and personal non-contractual prefs.  | Gitignored.                     |
| `.codex/project-init/state.yaml`        | Compact resumable interview state; no transcript/reasoning. | Gitignored and temporary.       |
| `.codex/dev-flow/diagrams/*.mermaid.md` | Optional canonical-profile projection.                      | Commit with shared profile.     |

Secrets, secret-like values, and absolute machine paths are rejected from the shared
profile. A local preference cannot weaken repository policy or an approved shared
convention. Project INIT creates neither application code nor Dev Flow task state.

## 4. Run the first task

Invoke a concrete software objective:

```text
$dev-flow Add rate limiting to the public authentication endpoints
```

The normal task path is:

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE ✓
```

1. **INTAKE** establishes product objective, observable success, constraints, and risk.
2. **SHAPE** reads repository evidence, resolves technical uncertainty, and prepares a
   Quick or Plan implementation contract.
3. **GATE** displays a compact validation card and requires explicit approval of the
   exact contract.
4. **BUILD** lets native Codex implement the complete approved plan. Dev Flow only
   checks the current approval/digest boundary and returns material changes to SHAPE.
5. **ASSURE** reviews the result and runs fresh criterion-linked verification.

GATE approval covers local implementation only. It never authorizes commit, push, pull
request, registry publication, or release.

## 5. Optional Configuration wizard

Project INIT owns project engineering knowledge. The separate deterministic
Configuration wizard owns plugin operating preferences:

```bash
npx codex-dev-flow init
```

Use it to customize worktree behavior, subscription/quota hints, or allowlisted
integrations. Defaults already exist, so the wizard is optional. Inspect or validate the
resolved configuration from Codex:

```text
$dev-flow config show --explain
$dev-flow config validate --json
```

Configuration precedence is:

```text
internal defaults
  < ~/.codex/dev-flow.yaml
  < .codex/dev-flow.yaml
  < .codex/dev-flow.local.yaml
  < invocation flags
  < non-weakenable repository policy
```

## Resume and troubleshoot

### Project INIT was interrupted

Run `$dev-flow init` again in the same repository. Dev Flow reads the compact local
session and resumes the exact active question unless its dependency evidence changed.

### Project evidence changed

Run `$dev-flow init` again. Fingerprints identify stale decisions and reconcile only
their dependent closure. Repository facts are rediscovered; user-owned conventions are
re-interviewed. Rejected changes leave the shared profile byte-for-byte unchanged.

### Profile validation or approval failed

No shared publication occurs. Review the reported schema, privacy, authority, revision,
or digest error, correct the candidate through Project INIT, validate again, then approve
the new exact digest. Never edit around validation with a direct profile write.

### Shared and local profiles conflict

The shared profile has higher authority. Remove the conflicting local preference, or run
Project INIT to propose a separately validated shared-profile update. Absolute service
paths belong only in the local overlay.

### A task was interrupted

Inspect or resume it from Codex:

```text
$dev-flow status [task-id]
$dev-flow resume <task-id>
```

Resume reconciles durable state before continuing. It does not infer approval from a
previously displayed but changed implementation contract.

### Node.js is rejected

Run `node --version` and install Node.js 24 or newer. Node.js 22 and older are outside the
supported runtime contract.

## Next references

- [Plugin README](../README.md)
- [Lifecycle contract](lifecycle-contract.md)
- [Project Engineering Profile contract](project-profile-contract.md)
- [Configuration schema](../schemas/config.schema.json)
- [Project profile schema](../schemas/project-profile.schema.json)
- [Glossary](glossary/dev-flow.md)
