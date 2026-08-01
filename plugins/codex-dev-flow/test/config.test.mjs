import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

test("resolves config in source order and records leaf provenance", async () => {
  const { resolveConfig } = await import(bundle);
  const resolved = resolveConfig([
    {
      source: "defaults",
      value: {
        schemaVersion: 1,
        finish: { pullRequest: "optional" },
        worktree: { mode: "auto" },
        merge: "never",
      },
    },
    { source: "user", value: { finish: { pullRequest: "required" } } },
    { source: "repo", value: { worktree: { mode: "required" } } },
    { source: "local", value: { finish: { pullRequest: "optional" } } },
  ]);

  assert.equal(resolved.value.finish.pullRequest, "optional");
  assert.equal(resolved.provenance["finish.pullRequest"], "local");
  assert.equal(resolved.value.worktree.mode, "required");
  assert.equal(resolved.provenance["worktree.mode"], "repo");
  assert.equal(resolved.value.merge, "never");
});

test("accepts explicit external plugin and skill allowlists", async () => {
  const { resolveConfig } = await import(bundle);
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
  assert.deepEqual(resolved.value.integrations, {
    plugins: ["impeccable"],
    skills: ["impeccable:frontend-design"],
  });
});

test("rejects an attempt to weaken a locked policy", async () => {
  const { EXIT_CODES, PolicyError, applyPolicy, resolveConfig } = await import(bundle);
  const resolved = resolveConfig([
    {
      source: "defaults",
      value: {
        schemaVersion: 1,
        finish: { pullRequest: "optional" },
        worktree: { mode: "auto" },
        merge: "never",
      },
    },
    { source: "local", value: { finish: { pullRequest: "optional" } } },
  ]);

  assert.throws(
    () =>
      applyPolicy(resolved, {
        schemaVersion: 1,
        requirements: { "finish.pullRequest": "required" },
        prohibitions: {},
        bounds: {},
        locks: ["finish.pullRequest"],
      }),
    (error) =>
      error instanceof PolicyError &&
      error.exitCode === EXIT_CODES.POLICY_CONTRADICTION &&
      error.path === "finish.pullRequest" &&
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
  } = await import(bundle);
  const valid = validateSchema("config", DEFAULT_CONFIG);
  assert.equal(valid.valid, true);
  assert.equal(
    validateSchema("config", {
      schemaVersion: 1,
      subscription: { ...DEFAULT_CONFIG.subscription, modelAllowlist: ["gpt-5.5"] },
    }).valid,
    false,
  );
  assert.equal(
    validateSchema("config", {
      schemaVersion: 1,
      subscription: { ...DEFAULT_CONFIG.subscription, unexpected: true },
    }).valid,
    false,
  );
  const explained = explainConfig(
    resolveConfig([{ source: "user", value: { subscription: { plan: "plus" } } }]),
  );
  assert.equal(explained.value.subscription.plan, "plus");
  assert.equal(explained.provenance["subscription.plan"], "user");
  assert.equal(explained.provenance["subscription.quota.warningPercent"], "defaults");
  assert.equal(resolveSubscriptionMultiplier("pro_5x"), 5);
  assert.equal(resolveSubscriptionMultiplier("pro_20x", 7), 7);
});
