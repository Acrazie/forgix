# Codex Dev Flow V1 Implementation Plan

**Goal:** Build an installable codex-dev-flow plugin whose public $dev-flow skill orchestrates portable, evidence-based change workflows without a Superpowers runtime dependency.

**Architecture:** Strict TypeScript owns deterministic workflow utilities. yaml parses configuration; Ajv validates strict JSON Schemas. Node native APIs own arguments, files, processes, and tests. A locked development-only bundler emits an ESM JavaScript artifact containing production dependencies, so the installed plugin needs Node 22.18 or newer but no package installation, lifecycle hook, or network access.

**Tech Stack:** Node.js >=22.18, TypeScript strict mode, node:test, yaml, Ajv, esbuild, GitHub Actions on Node 22 and 24.

## Global Constraints

- Public skill surface is $dev-flow only. Internal stages are not user-facing commands.
- Runtime dependencies are yaml and Ajv only, bundled into distribution. All versions are locked.
- No runtime network access, package installation, or lifecycle postinstall.
- JSON goes to stdout; diagnostics go to stderr. Exit codes are stable.
- Configuration resolves defaults < user < repository < local < flags, then policy applies.
- No action bypasses merge prohibition, mandatory critical worktree, human gates, or evidence before success.
- One writer performs repository mutations. Subagents are absent in quick, optional read-only in standard, and read-only in critical.

---

## File Structure

    .codex-plugin/plugin.json
    package.json
    package-lock.json
    tsconfig.json
    scripts/build.mjs
    schemas/{config,policy,state}.schema.json
    src/{cli,types,exit-codes,parse,config,policy,state,fingerprint,artifacts,worktree,commands}.ts
    skills/{dev-flow,discover-change,plan-change,execute-change,debug-root-cause,review-change,verify-change}/SKILL.md
    dist/dev-flow.mjs
    test/*.test.ts
    test/fixtures/node-project/{package.json,AGENTS.md}
    .github/workflows/ci.yml
    README.md

## Task 1: Establish Plugin and Distribution Contract

**Files:**

- Create .codex-plugin/plugin.json, package.json, package-lock.json, tsconfig.json, scripts/build.mjs, README.md, .gitignore, and .github/workflows/ci.yml.
- Create test/distribution.test.ts.

**Produces:** dist/dev-flow.mjs, runnable with Node and requiring no installed runtime dependencies.

- [ ] Create the package manifest with engines.node >=22.18.0, type module, exact yaml and Ajv versions, and development-only exact esbuild and TypeScript versions. Do not define preinstall, install, postinstall, prepare, or prepublishOnly.
- [ ] Configure strict TypeScript with noUncheckedIndexedAccess and exactOptionalPropertyTypes.
- [ ] Create scripts/build.mjs using esbuild bundle=true, platform=node, format=esm, target=node22.18, output=dist/dev-flow.mjs.
- [ ] Add a plugin manifest exposing the skills directory only, no hooks and no public scripts.
- [ ] Add Node 22 and 24 CI jobs running npm ci and npm run check.
- [ ] Test that build produces an importable bundle without unresolved yaml or Ajv imports.
- [ ] Run npm run check. Commit: chore: scaffold plugin distribution.

## Task 2: Define Versioned Contracts, Schemas, and Exit Codes

**Files:**

- Create src/types.ts, src/exit-codes.ts, schemas/config.schema.json, schemas/policy.schema.json, schemas/state.schema.json.
- Create test/schema.test.ts and test/exit-codes.test.ts.

**Produces:** EffectiveConfig, Policy, TaskState, IssueIdentity, CliResult, and validateSchema(name, value).

- [ ] Define stable codes: 0 success, 2 invalid invocation, 3 invalid configuration, 4 policy contradiction, 5 state conflict, 6 blocked workflow, 7 handoff required, 10 unexpected failure.
- [ ] Use strict schemas with schemaVersion, no unknown keys, and explicit enums for modes, states, policy operators, and finish behavior.
- [ ] Represent policy with requirements, prohibitions, bounds, and locks restricted to approved configuration paths.
- [ ] Require task-state taskId, status, resumeTo, snapshots, issues, reviewCycle, remainingActions, and history.
- [ ] Test valid minima, unknown-key rejection, invalid enums, and all exit-code constants.
- [ ] Run npm test -- test/schema.test.ts test/exit-codes.test.ts. Commit: feat: add workflow schemas and exit codes.

## Task 3: Implement Deterministic Public Command Parsing

**Files:**

- Create src/parse.ts and src/cli.ts.
- Create test/parse.test.ts.

**Produces:** parseInvocation(argv) returning run, resume, status, or config invocation variants.

- [ ] Parse implicit run, explicit quick/standard/critical run, resume task-id, optional status task-id, config show --explain, and config validate.
- [ ] Preserve absent mode for read-only classification.
- [ ] Reject unknown flags, duplicate scalar flags, missing values, and attempts to alter invariants with exit code 2.
- [ ] Serialize successful results as JSON with command, status, data, and provenance where relevant.
- [ ] Test valid examples, malformed calls, every subcommand, mode omission, and invariant-bypass attempts.
- [ ] Run npm test -- test/parse.test.ts. Commit: feat: parse dev flow commands deterministically.

## Task 4: Resolve Configuration and Enforce Policy

**Files:**

- Create src/config.ts, src/policy.ts, and src/commands.ts.
- Create test/config.test.ts and test/policy.test.ts.

**Produces:** resolveConfig(sources), applyPolicy(config, policy), and explainConfig(result).

- [ ] Load YAML from defaults, user, repository, local, and flags in required precedence order.
- [ ] Validate each source with Ajv strict mode before merge. Report filename, path, schema error, and code 3.
- [ ] Preserve provenance for every effective leaf, including defaults.
- [ ] Apply policy after resolution. Allow strengthening locks; reject weakening with requested value, provenance, violated rule, and code 4.
- [ ] Implement read-only config show --explain and config validate.
- [ ] Test precedence, provenance, errors, locks, bounds, prohibitions, and a required PR that grants no authorization.
- [ ] Run npm test -- test/config.test.ts test/policy.test.ts. Commit: feat: resolve configuration and policy.

## Task 5: Implement State, Resume Safety, and Artifacts

**Files:**

- Create src/state.ts and src/artifacts.ts.
- Create test/state.test.ts and test/artifacts.test.ts.

**Produces:** createState, transition, compareSnapshot, writeArtifacts, and a read-only status query.

- [ ] Implement every approved state and transition, including awaiting_mode_confirmation to quick execution, standard discovery, critical worktree then discovery, and cancellation.
- [ ] Route correctable validation, review, and verification failures to resolving.
- [ ] Require resumeTo and remainingActions for blocked and ready_for_handoff; protect terminal states.
- [ ] Persist local state at .codex/tasks/task-id/state.yaml and durable standard/critical documents at docs/dev-flow/task-id.
- [ ] Store sanitized configuration and policy snapshots. Require confirmation when resume detects effective behavior changes.
- [ ] Test allowed/forbidden transitions, terminal behavior, snapshots, paths, and missing resume metadata.
- [ ] Run npm test -- test/state.test.ts test/artifacts.test.ts. Commit: feat: persist resumable workflow state.

## Task 6: Implement Fingerprints and Escalation

**Files:**

- Create src/fingerprint.ts.
- Create test/fingerprint.test.ts.

**Produces:** fingerprintFailure, fingerprintFinding, and recordOccurrence.

- [ ] Canonicalize and redact payloads before hashing with Node crypto.
- [ ] Build failure identity from check, test or stage, error type, relative path, symbol, and normalized message pattern.
- [ ] Build finding identity from rule, category, symbolic location, and problem type.
- [ ] Persist canonical payload, hash, stable issueId, per-run occurrenceId, optional rootCauseId, code-change attempts, and separate transient retries.
- [ ] Enforce two failures to trigger debugging or replan, third attempt with investigation, fourth attempt only after a human gate, and three global review cycles.
- [ ] Test stability across line/raw-message changes, redaction, material identity changes, root-cause association, and every escalation boundary.
- [ ] Run npm test -- test/fingerprint.test.ts. Commit: feat: add stable issue fingerprinting.

## Task 7: Implement Worktree and Finish Decisions

**Files:**

- Create src/worktree.ts.
- Modify src/commands.ts and src/state.ts.
- Create test/worktree.test.ts and test/finish.test.ts.

**Produces:** decideWorktree(context) and decideFinish(context).

- [ ] Decide worktree from critical mode, explicit request, repository policy, concurrent task, checkout safety, and existing linked worktree.
- [ ] Do not create a worktree for read-only commands. Do not permit disabling a critical worktree.
- [ ] Represent commit, push, PR, draft PR, ready_for_handoff, finished_local, and finished as decisions, not implicit network actions.
- [ ] Allow draft PR only for a documented pre-existing failure. New failures stay resolving or blocked.
- [ ] Transition missing remote or authorization to ready_for_handoff with remaining action and resumeTo handing_off.
- [ ] Test every trigger, override, PR requirement, documented failure, and authorization-missing handoff.
- [ ] Run npm test -- test/worktree.test.ts test/finish.test.ts. Commit: feat: decide isolation and handoff safely.

## Task 8: Package the Public Orchestrator and Internal Skills

**Files:**

- Create every named skills directory and SKILL.md.
- Create skills/dev-flow/agents/openai.yaml.
- Create test/skill-contract.test.ts.

**Produces:** one public $dev-flow workflow with internal discovery, plan, execute, debug, review, and verify stages.

- [ ] Write the public dev-flow skill with approved modes, gates, worktree policy, artifacts, subagents, finishing, and resume behavior.
- [ ] Write concise internal skills with selective context input. Internal skills do not parse public invocations.
- [ ] Mark internal stages non-public using validated plugin metadata or instructions.
- [ ] Generate public agents/openai.yaml from final metadata.
- [ ] Test exactly one public skill, all internal names, no Superpowers invocation, and critical reviewers constrained to read-only.
- [ ] Run npm test -- test/skill-contract.test.ts. Commit: feat: package dev flow skills.

## Task 9: Add Node Discovery Fixture

**Files:**

- Create test/fixtures/node-project/package.json and AGENTS.md.
- Create test/discovery.test.ts.
- Modify src/commands.ts.

**Produces:** discoverVerificationCommands(root) returning commands, provenance, and limited-verification reason.

- [ ] Implement precedence: repository guidance, then CI and package manifest, then an explicit limited-verification result.
- [ ] Add conflicting AGENTS.md and package scripts to prove guidance wins.
- [ ] Test Node discovery, repository override, missing manifest, and no silent command invention.
- [ ] Run npm test -- test/discovery.test.ts. Commit: feat: discover repository verification commands.

## Task 10: Verify and Prepare V1

**Files:**

- Modify README.md, package.json, and CI.
- Create test/release.test.ts.

**Produces:** npm run check, full offline validation, and documented installation/configuration behavior.

- [ ] Document Node minimum, Bun development-only status, offline runtime, configuration precedence, policies, state locations, public API, and no-merge guarantee.
- [ ] Test ESM import, runtime config commands, stable JSON output, absent lifecycle scripts, and bundled runtime imports.
- [ ] Run on Node 22 and 24: npm ci, npm run check, node dist/dev-flow.mjs config validate --json, and all fixture tests.
- [ ] Review the diff for public internal skills, secrets, network calls, lifecycle scripts, and unbundled production imports.
- [ ] Commit: chore: prepare v1 release.

## Plan Self-Review

- Tasks 1-10 cover all approved design areas.
- No task requires a Python/Rust fixture, GitHub publication, or Stockli router migration; these remain deferred.
- Every task names files, outputs, tests, commands, and commit boundaries.
