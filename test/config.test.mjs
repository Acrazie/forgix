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
        merge: "never"
      }
    },
    { source: "user", value: { finish: { pullRequest: "required" } } },
    { source: "repo", value: { worktree: { mode: "required" } } },
    { source: "local", value: { finish: { pullRequest: "optional" } } }
  ]);

  assert.equal(resolved.value.finish.pullRequest, "optional");
  assert.equal(resolved.provenance["finish.pullRequest"], "local");
  assert.equal(resolved.value.worktree.mode, "required");
  assert.equal(resolved.provenance["worktree.mode"], "repo");
  assert.equal(resolved.value.merge, "never");
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
        merge: "never"
      }
    },
    { source: "local", value: { finish: { pullRequest: "optional" } } }
  ]);

  assert.throws(
    () =>
      applyPolicy(resolved, {
        schemaVersion: 1,
        requirements: { "finish.pullRequest": "required" },
        prohibitions: {},
        bounds: {},
        locks: ["finish.pullRequest"]
      }),
    (error) =>
      error instanceof PolicyError &&
      error.exitCode === EXIT_CODES.POLICY_CONTRADICTION &&
      error.path === "finish.pullRequest" &&
      error.source === "local"
  );
});
