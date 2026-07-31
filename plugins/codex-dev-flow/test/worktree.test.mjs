import assert from "node:assert/strict";
import { test } from "node:test";
const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

test("worktree derives from risk, policy, request, concurrency, and safety—not profile", async () => {
  const { decideWorktree } = await import(bundle);
  assert.deepEqual(decideWorktree({ risk: "critical", requested: false, concurrent: false, checkoutSafe: true }), { required: true, reason: "critical_risk" });
  assert.deepEqual(decideWorktree({ risk: "low", policyRequired: true, requested: false, concurrent: false, checkoutSafe: true }), { required: true, reason: "policy" });
  assert.deepEqual(decideWorktree({ risk: "low", requested: true, concurrent: false, checkoutSafe: true }), { required: true, reason: "requested" });
  assert.deepEqual(decideWorktree({ risk: "low", requested: false, concurrent: false, checkoutSafe: true }), { required: false, reason: "none" });
});
