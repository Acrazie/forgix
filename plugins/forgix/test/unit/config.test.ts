// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { expect, test } from "bun:test";
import { expectThrown } from "../support/expect-error.ts";

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
