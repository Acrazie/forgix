import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

function routingResult() {
  return {
    available: true,
    snapshot: {
      schemaVersion: 1,
      capturedAt: "2026-07-12T10:00:00.000Z",
      plan: "plus",
      account: { planType: "plus" },
      quota: { windowDurationMins: 300, usedPercent: 10, pressure: "normal", source: "app-server" },
      models: [
        { id: "gpt-5.6-luna", supportedReasoningEfforts: ["low", "medium", "high", "max"] },
        { id: "gpt-5.6-terra", supportedReasoningEfforts: ["low", "medium", "high", "max"] },
        { id: "gpt-5.6-sol", supportedReasoningEfforts: ["low", "medium", "high", "max", "ultra"] }
      ],
      warnings: [],
      provenance: { plan: "account/read", quota: "account/rateLimits/read", models: "model/list" }
    }
  };
}

test("run and resume capture one routing snapshot per invocation", async () => {
  const { runInvocation } = await import(bundle);
  let calls = 0;
  const captureSnapshot = async () => {
    calls += 1;
    return routingResult();
  };
  const run = await runInvocation(["standard", "change", "thing"], { captureSnapshot });
  assert.equal(calls, 1);
  assert.equal(run.status, "routed");
  assert.equal(run.data.routingDecisions.length, 5);
  assert.deepEqual(run.data.routingDecisions.map((decision) => decision.stage), ["discover", "plan", "debug", "review", "verify"]);
  await runInvocation(["resume", "task-1"], { captureSnapshot });
  assert.equal(calls, 2);
});

test("config show explain stays read-only and exposes provenance", async () => {
  const { runInvocation } = await import(bundle);
  const result = await runInvocation(["config", "show", "--explain"]);
  assert.equal(result.data.provenance["subscription.quota.warningPercent"], "defaults");
  assert.equal(result.data.value.subscription.plan, "auto");
});
