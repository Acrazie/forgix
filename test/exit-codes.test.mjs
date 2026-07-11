import assert from "node:assert/strict";
import { test } from "node:test";

test("bundle exports stable workflow exit codes", async () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  const { EXIT_CODES } = await import(bundle);
  assert.deepEqual(EXIT_CODES, {
    SUCCESS: 0,
    INVALID_INVOCATION: 2,
    INVALID_CONFIGURATION: 3,
    POLICY_CONTRADICTION: 4,
    STATE_CONFLICT: 5,
    BLOCKED: 6,
    HANDOFF_REQUIRED: 7,
    INTERNAL_ERROR: 10
  });
});
