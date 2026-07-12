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
