import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

test("only analysis and review stages are delegable; execute and validate stay with parent", async () => {
  const { ROUTED_STAGES, isDelegableStage } = await import(bundle);
  assert.deepEqual(ROUTED_STAGES, ["discover", "plan", "debug", "review", "verify"]);
  for (const stage of ROUTED_STAGES) assert.equal(isDelegableStage(stage), true);
  assert.equal(isDelegableStage("execute"), false);
  assert.equal(isDelegableStage("validate"), false);
});

test("bridge rejects mutation delegation", async () => {
  const { delegateStage } = await import(bundle);
  await assert.rejects(
    () => delegateStage("execute", async () => "must not run"),
    /parent workflow/,
  );
});
