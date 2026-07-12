import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("workflow schemas are strict and versioned", () => {
  for (const name of ["config", "policy", "state"]) {
    const path = new URL("../schemas/" + name + ".schema.json", import.meta.url);
    assert.equal(existsSync(path), true);
    const schema = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties.schemaVersion.type, "integer");
  }
});

test("routing state schema accepts snapshot and decisions but rejects foreign models", async () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  const { validateSchema } = await import(bundle);
  const minimal = {
    schemaVersion: 1,
    taskId: "task-1",
    status: "new",
    configSnapshot: {},
    policySnapshot: {},
    issues: [],
    reviewCycle: 0,
    remainingActions: [],
    history: [],
    routingSnapshot: {
      schemaVersion: 1,
      capturedAt: "2026-07-12T10:00:00.000Z",
      plan: "plus",
      account: { planType: "plus" },
      quota: { pressure: "unknown", source: "unknown" },
      models: [{ id: "gpt-5.6-luna", supportedReasoningEfforts: ["medium"] }],
      warnings: ["quota_unknown"],
      provenance: { plan: "account/read", quota: "unknown", models: "model/list" }
    },
    routingDecisions: [{ stage: "discover", model: "gpt-5.6-luna", effort: "medium", quotaPressure: "unknown", reason: "safe", warnings: [] }]
  };
  assert.equal(validateSchema("state", minimal).valid, true);
  assert.equal(validateSchema("state", { ...minimal, routingSnapshot: { ...minimal.routingSnapshot, models: [{ id: "gpt-5.5", supportedReasoningEfforts: [] }] } }).valid, false);
});
