import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const config = { schemaVersion: 1 };
const policy = { schemaVersion: 1, requirements: {}, prohibitions: {}, bounds: {}, locks: [] };

test("transitions through approval and requires resumable blocked state", async () => {
  const { createState, transition } = await import(bundle);
  let state = createState({ taskId: "task-1", configSnapshot: config, policySnapshot: policy });
  state = transition(state, "awaiting_mode_confirmation");
  state = transition(state, "executing");
  assert.equal(state.status, "executing");
  assert.throws(() => transition(state, "blocked"));
  const blocked = transition(state, "blocked", {
    resumeTo: "executing",
    remainingActions: ["Provide repository access."]
  });
  assert.equal(blocked.resumeTo, "executing");
  assert.deepEqual(blocked.remainingActions, ["Provide repository access."]);
});

test("detects changed configuration snapshots on resume", async () => {
  const { compareSnapshot } = await import(bundle);
  assert.deepEqual(compareSnapshot({ configSnapshot: config, policySnapshot: policy }, { config, policy }), {
    changed: false,
    reasons: []
  });
  assert.deepEqual(compareSnapshot({ configSnapshot: config, policySnapshot: policy }, {
    config: { schemaVersion: 1, finish: { pullRequest: "required" } },
    policy
  }).changed, true);
});

test("persists routing snapshot and decisions, and detects resume routing changes", async () => {
  const { addRoutingDecision, createState, compareSnapshot } = await import(bundle);
  const routingSnapshot = {
    schemaVersion: 1,
    capturedAt: "2026-07-12T10:00:00.000Z",
    plan: "plus",
    account: { planType: "plus" },
    quota: { windowDurationMins: 300, usedPercent: 20, pressure: "normal", source: "app-server" },
    models: [{ id: "gpt-5.6-luna", supportedReasoningEfforts: ["low", "medium"] }],
    warnings: [],
    provenance: { plan: "account/read", quota: "account/rateLimits/read", models: "model/list" }
  };
  const state = createState({ taskId: "task-route", configSnapshot: config, policySnapshot: policy, routingSnapshot });
  assert.deepEqual(state.routingSnapshot, routingSnapshot);
  const decision = {
    stage: "discover",
    model: "gpt-5.6-luna",
    effort: "medium",
    quotaPressure: "normal",
    reason: "routine task on plus plan",
    warnings: []
  };
  assert.deepEqual(addRoutingDecision(state, decision).routingDecisions, [decision]);
  assert.equal(compareSnapshot(state, { config, policy, routingSnapshot: { ...routingSnapshot, capturedAt: "2026-07-12T11:00:00.000Z" } }).changed, false);
  assert.equal(compareSnapshot(state, { config, policy, routingSnapshot: { ...routingSnapshot, plan: "pro_5x" } }).changed, true);
});
