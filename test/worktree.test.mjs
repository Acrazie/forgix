import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

test("critical mode always requires a worktree", async () => {
  const { decideWorktree } = await import(bundle);
  assert.deepEqual(decideWorktree({ mode: "critical", requested: false, concurrent: false, checkoutSafe: true }), {
    required: true,
    reason: "critical"
  });
});
