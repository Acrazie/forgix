// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as configApi from "../../src/core/config.ts";
import * as routingApi from "../../src/core/routing.ts";
import * as schemaApi from "../../src/core/schema.ts";
import * as storeApi from "../../src/core/store.ts";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { expectThrown } from "../support/expect-error.ts";

const sourceApi = { ...configApi, ...routingApi, ...schemaApi, ...storeApi };

test("resolves config in source order and records leaf provenance", async () => {
  const { resolveConfig } = sourceApi;
  const resolved = resolveConfig([
    {
      source: "defaults",
      value: {
        schemaVersion: 1,
        worktree: { mode: "auto" },
        merge: "never",
      },
    },
    { source: "user", value: { worktree: { mode: "required" } } },
    { source: "repo", value: { integrations: { plugins: ["impeccable"] } } },
    { source: "local", value: { worktree: { mode: "auto" } } },
  ]);

  expect(resolved.value.worktree.mode).toBe("auto");
  expect(resolved.provenance["worktree.mode"]).toBe("local");
  expect(resolved.provenance["integrations.plugins"]).toBe("repo");
  expect(resolved.value.merge).toBe("never");
});

test("accepts explicit external plugin and skill allowlists", async () => {
  const { resolveConfig } = sourceApi;
  const resolved = resolveConfig([
    {
      source: "repo",
      value: {
        schemaVersion: 1,
        integrations: {
          plugins: ["impeccable"],
          skills: ["impeccable:frontend-design"],
        },
      },
    },
  ]);
  expect(resolved.value.integrations).toEqual({
    plugins: ["impeccable"],
    skills: ["impeccable:frontend-design"],
  });
});

test("rejects an attempt to weaken a locked policy", async () => {
  const { EXIT_CODES, PolicyError, applyPolicy, resolveConfig } = sourceApi;
  const resolved = resolveConfig([
    {
      source: "defaults",
      value: {
        schemaVersion: 1,
        worktree: { mode: "auto" },
        merge: "never",
      },
    },
    { source: "local", value: { worktree: { mode: "auto" } } },
  ]);

  expectThrown(
    () =>
      applyPolicy(resolved, {
        schemaVersion: 1,
        requirements: { "worktree.mode": "required" },
        prohibitions: {},
        bounds: {},
        locks: ["worktree.mode"],
      }),
    (error) =>
      error instanceof PolicyError &&
      error.exitCode === EXIT_CODES.POLICY_CONTRADICTION &&
      error.path === "worktree.mode" &&
      error.source === "local",
  );
});

test("subscription config is strict, versioned, and explainable", async () => {
  const {
    DEFAULT_CONFIG,
    explainConfig,
    resolveConfig,
    resolveSubscriptionMultiplier,
    validateSchema,
  } = sourceApi;
  const valid = validateSchema("config", DEFAULT_CONFIG);
  expect(valid.valid).toBe(true);
  expect(
    validateSchema("config", {
      schemaVersion: 1,
      subscription: { ...DEFAULT_CONFIG.subscription, modelAllowlist: ["gpt-5.5"] },
    }).valid,
  ).toBe(false);
  expect(
    validateSchema("config", {
      schemaVersion: 1,
      subscription: { ...DEFAULT_CONFIG.subscription, unexpected: true },
    }).valid,
  ).toBe(false);
  const explained = explainConfig(
    resolveConfig([{ source: "user", value: { subscription: { plan: "plus" } } }]),
  );
  expect(explained.value.subscription.plan).toBe("plus");
  expect(explained.provenance["subscription.plan"]).toBe("user");
  expect(explained.provenance["subscription.quota.warningPercent"]).toBe("defaults");
  expect(resolveSubscriptionMultiplier("pro_5x")).toBe(5);
  expect(resolveSubscriptionMultiplier("pro_20x", 7)).toBe(7);
});

test("validates optional roadmap config section strictly", async () => {
  const { validateSchema } = sourceApi;
  expect(
    validateSchema("config", {
      schemaVersion: 1,
      roadmap: {
        project: {
          owner: "acrazie",
          number: 12,
          title: "Product Roadmap",
          productVisionPath: "docs/product-vision.md",
        },
        fields: {
          status: "Status",
          kind: "Kind",
          risk: "Risk",
          priority: "Priority",
          wave: "Wave",
        },
        autonomous: {
          enabled: true,
          maxRisk: "medium",
          defaultParallel: 1,
          worktreeBaseBranch: "main",
          requireExistingWorktree: false,
        },
      },
    }).valid,
  ).toBe(true);

  expect(
    validateSchema("config", {
      schemaVersion: 1,
      roadmap: {
        autonomous: {
          maxRisk: "high",
        },
      },
    }).valid,
  ).toBe(false);
});

test("harness config option accepts supported harnesses and rejects unknown values", async () => {
  const { validateSchema } = sourceApi;
  for (const harness of ["auto", "codex", "claude", "antigravity"]) {
    expect(validateSchema("config", { schemaVersion: 1, harness }).valid).toBe(true);
  }
  expect(validateSchema("config", { schemaVersion: 1, harness: "cursor" }).valid).toBe(false);
});

test("runner config resolves defaults, precedence, and schema validation", async () => {
  const { DEFAULT_CONFIG, applyPolicy, resolveConfig, validateSchema } = sourceApi;
  expect(DEFAULT_CONFIG.runner).toEqual({
    mode: "worktree",
    assureRunner: "auto",
  });
  for (const mode of ["worktree", "dagger", "auto"]) {
    expect(
      validateSchema("config", {
        schemaVersion: 1,
        runner: { mode, assureRunner: mode },
      }).valid,
    ).toBe(true);
  }
  expect(
    validateSchema("config", {
      schemaVersion: 1,
      runner: { mode: "docker" },
    }).valid,
  ).toBe(false);

  const resolved = resolveConfig([
    { source: "repo", value: { runner: { mode: "dagger", assureRunner: "dagger" } } },
    { source: "local", value: { runner: { mode: "worktree" } } },
  ]);
  expect(resolved.value.runner).toEqual({ mode: "worktree", assureRunner: "dagger" });
  expect(resolved.provenance["runner.mode"]).toBe("local");
  expect(resolved.provenance["runner.assureRunner"]).toBe("repo");

  expect(() =>
    applyPolicy(resolved, {
      schemaVersion: 1,
      requirements: { "runner.mode": "dagger" },
      prohibitions: {},
      bounds: {},
      locks: ["runner.mode"],
    }),
  ).toThrow(/runner\.mode/);
});

test("scanDiffForEscapeHatches detects lint, type, fallow, test, Lean 4, and TLA+ escape hatches unless approved", () => {
  const { scanDiffForEscapeHatches } = sourceApi;
  const oxlintToken = ["oxlint", "disable"].join("-");
  const eslintToken = ["eslint", "disable"].join("-");
  const tsIgnoreToken = ["@ts", "ignore"].join("-");
  const tsExpectToken = ["@ts", "expect", "error"].join("-");
  const tsNocheckToken = ["@ts", "nocheck"].join("-");
  const fallowIgnoreToken = ["fallow", "ignore"].join("-");
  const expectedUnusedToken = ["@expected", "unused"].join("-");
  const asAnyToken = ["as", "any"].join(" ");
  const unknownCastToken = ["as", "unknown", "as"].join(" ");
  const skipToken = [".sk", "ip("].join("");
  const todoToken = [".to", "do("].join("");
  const sorryToken = ["sor", "ry"].join("");
  const admitToken = ["adm", "it"].join("");
  const unsafeToken = ["unsa", "fe"].join("");
  const axiomToken = ["axi", "om"].join("");
  const deadlockToken = ["CHECK_DEADLOCK", "FALSE"].join(" ");

  const diff = [
    "diff --git a/src/example.ts b/src/example.ts",
    "--- a/src/example.ts",
    "+++ b/src/example.ts",
    "@@ -1,2 +1,13 @@",
    `-// removed ${tsIgnoreToken} is ignored`,
    `+ // ${oxlintToken}-next-line`,
    `+ // ${eslintToken}`,
    `+ // ${tsIgnoreToken}`,
    `+ // ${tsExpectToken}`,
    `+ // ${tsNocheckToken}`,
    `+ // ${fallowIgnoreToken}-next-line`,
    `+ // ${expectedUnusedToken}`,
    `+ const loose = input ${asAnyToken};`,
    `+ const value = input ${unknownCastToken} number;`,
    `+ test${skipToken}"skipped", () => {});`,
    `+ test${todoToken}"later");`,
    "diff --git a/formal/lean/Kernel.lean b/formal/lean/Kernel.lean",
    "--- a/formal/lean/Kernel.lean",
    "+++ b/formal/lean/Kernel.lean",
    "@@ -10,1 +10,4 @@",
    `+ theorem broken : True := by ${sorryToken}`,
    `+ theorem hole : True := by ${admitToken}`,
    `+ ${unsafeToken} def backdoor : Nat := 0`,
    `+ ${axiomToken} magic : False`,
    "diff --git a/formal/tla/TaskLifecycleV6.cfg b/formal/tla/TaskLifecycleV6.cfg",
    "--- a/formal/tla/TaskLifecycleV6.cfg",
    "+++ b/formal/tla/TaskLifecycleV6.cfg",
    "@@ -1,1 +1,2 @@",
    `+ ${deadlockToken}`,
  ].join("\n");

  const result = scanDiffForEscapeHatches(diff);
  expect(result.clean).toBe(false);
  expect(result.passed).toBe(false);
  expect(result.findings.map((f) => f.kind)).toEqual([
    oxlintToken,
    eslintToken,
    tsIgnoreToken,
    tsExpectToken,
    tsNocheckToken,
    fallowIgnoreToken,
    expectedUnusedToken,
    asAnyToken,
    unknownCastToken,
    skipToken,
    todoToken,
    sorryToken,
    admitToken,
    unsafeToken,
    axiomToken,
    deadlockToken,
  ]);

  const approvedAll = scanDiffForEscapeHatches(diff, [
    "src/example.ts",
    `formal/lean/Kernel.lean:${sorryToken}`,
    admitToken,
    unsafeToken,
    axiomToken,
    deadlockToken,
  ]);
  expect(approvedAll.clean).toBe(true);
  expect(approvedAll.findings).toHaveLength(0);
});

test("verifyProtectedSurfaces and evaluateSurfaceVerificationRules enforce factory boundaries", () => {
  const { evaluateSurfaceVerificationRules, verifyProtectedSurfaces } = sourceApi;

  const unapproved = verifyProtectedSurfaces([
    "src/cli.ts",
    ".oxlintrc.json",
    "docs/golden-rules.md",
    ".fallowrc.json",
    "fallow-baselines/health.json",
    "fallow-rules/no-network.json",
    "vite.config.ts",
    "bunfig.toml",
    ".forgix/config.yaml",
    ".forgix/policy.yaml",
    ".buildkite/pipeline.yml",
    "formal/tla/TaskLifecycleV6.tla",
    "formal/lean/ForgixKernel/Invariants.lean",
  ]);
  expect(unapproved.allowed).toBe(false);
  expect(unapproved.unapprovedPaths).toEqual([
    "docs/golden-rules.md",
    ".fallowrc.json",
    "fallow-baselines/health.json",
    "fallow-rules/no-network.json",
    "vite.config.ts",
    "bunfig.toml",
    ".forgix/config.yaml",
    ".forgix/policy.yaml",
    ".buildkite/pipeline.yml",
    "formal/tla/TaskLifecycleV6.tla",
    "formal/lean/ForgixKernel/Invariants.lean",
  ]);

  const authorized = verifyProtectedSurfaces(
    [".forgix/policy.yaml", "formal/tla/TaskLifecycleV6.tla"],
    undefined,
    [".forgix/policy.yaml", "formal/**/*.tla"],
  );
  expect(authorized.allowed).toBe(true);
  expect(authorized.violations).toHaveLength(0);

  const missingRuntime = evaluateSurfaceVerificationRules(
    ["src/core/config.ts", "formal/tla/TaskLifecycleV6.tla"],
    undefined,
    ["bun test"],
    ["command"],
  );
  expect(missingRuntime.passed).toBe(false);
  expect(missingRuntime.missingVerifierKinds).toEqual(["runtime-evidence", "tla-tlc"]);
  expect(missingRuntime.missingCommands).toContain("bun run pack:runtime");
  expect(missingRuntime.missingCommands).toContain("bun run test:runtime");

  const satisfied = evaluateSurfaceVerificationRules(
    ["src/core/config.ts", "formal/tla/TaskLifecycleV6.tla"],
    undefined,
    ["bun run pack:runtime && bun run test:runtime", "bun test test/unit/formal-kernel.test.ts"],
    ["runtime-evidence", "tla-tlc"],
  );
  expect(satisfied.passed).toBe(true);
  expect(satisfied.violations).toHaveLength(0);
});

test("telemetry store redacts secrets, summarizes runs.jsonl, and orders evolution proposals", async () => {
  const {
    appendTelemetryEvent,
    proposeFactoryEvolution,
    readTelemetryEvents,
    summarizeFactoryTelemetry,
  } = sourceApi;
  const root = await realpath(await mkdtemp(join(tmpdir(), "forgix-telemetry-unit-")));
  try {
    await appendTelemetryEvent(root, {
      at: "2026-11-18T10:00:00.000Z",
      type: "assure.completed",
      taskId: "task-1",
      firstPassAssure: true,
      detail: "token=sk-1234567890abcdef and ghp_abcdefghijklmnopqrstuvwxyz1234",
    });
    await appendTelemetryEvent(root, {
      at: "2026-11-18T10:05:00.000Z",
      type: "assure.check_failed",
      taskId: "task-2",
      issueId: "issue-lint-1",
      phaseBounces: 2,
    });
    await appendTelemetryEvent(root, {
      at: "2026-11-18T10:06:00.000Z",
      type: "escape_hatch.blocked",
      taskId: "task-2",
      issueId: "issue-lint-1",
      escapeHatchKind: ["oxlint", "disable"].join("-"),
    });

    const events = await readTelemetryEvents(root);
    expect(events).toHaveLength(3);
    expect(events[0]!.detail).not.toContain("sk-1234567890abcdef");
    expect(events[0]!.detail).toContain("[REDACTED]");

    const summary = summarizeFactoryTelemetry(events);
    expect(summary.totalEvents).toBe(3);
    expect(summary.totalAssureRuns).toBe(2);
    expect(summary.firstPassAssureCount).toBe(1);
    expect(summary.firstPassAssureRate).toBe(0.5);
    expect(summary.recurringIssueIds).toEqual(["issue-lint-1"]);
    expect(summary.phaseBounces).toBe(2);
    expect(summary.escapeHatchBlocks).toBe(1);

    const proposals = proposeFactoryEvolution(summary);
    expect(proposals.map((p) => p.category)).toEqual([
      "mechanical_guardrail",
      "surface_verification_rule",
      "skill_budget_bounded_doc",
    ]);
    expect(proposals.map((p) => p.priority)).toEqual([1, 2, 3]);
    expect(proposals[0]!.triggeredBy).toContain("issue:issue-lint-1");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
