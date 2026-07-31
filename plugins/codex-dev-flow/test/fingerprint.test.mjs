import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

test("failure identity ignores raw messages and line numbers", async () => {
  const { fingerprintFailure } = await import(bundle);
  const common = {
    check: "test",
    stage: "verification",
    errorType: "AssertionError",
    path: "src/auth.ts",
    symbol: "rotateToken",
    messagePattern: "expected token to rotate",
  };
  const first = fingerprintFailure({ ...common, line: 14, rawMessage: "expected 1 got 0" });
  const second = fingerprintFailure({ ...common, line: 22, rawMessage: "expected true got false" });
  assert.equal(first.issueId, second.issueId);
  assert.notEqual(first.occurrenceId, second.occurrenceId);
  assert.equal(first.canonical.rawMessage, "[redacted]");
});

test("escalates repeated code corrections per stable issue", async () => {
  const { nextCorrectionAction } = await import(bundle);
  assert.equal(nextCorrectionAction({ codeChanges: 1, investigated: false }), "debug");
  assert.equal(nextCorrectionAction({ codeChanges: 2, investigated: false }), "investigate");
  assert.equal(nextCorrectionAction({ codeChanges: 2, investigated: true }), "retry");
  assert.equal(nextCorrectionAction({ codeChanges: 3, investigated: true }), "human_gate");
});
