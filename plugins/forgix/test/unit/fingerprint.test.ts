// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/fingerprint.ts";
import { expect, test } from "bun:test";

test("failure identity ignores raw messages and line numbers", async () => {
  const { fingerprintFailure } = sourceApi;
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
  expect(first.issueId).toBe(second.issueId);
  expect(first.occurrenceId).not.toBe(second.occurrenceId);
  expect(first.canonical.rawMessage).toBe("[redacted]");
});

test("escalates repeated code corrections per stable issue", async () => {
  const { nextCorrectionAction } = sourceApi;
  expect(nextCorrectionAction({ codeChanges: 1, investigated: false })).toBe("debug");
  expect(nextCorrectionAction({ codeChanges: 2, investigated: false })).toBe("investigate");
  expect(nextCorrectionAction({ codeChanges: 2, investigated: true })).toBe("retry");
  expect(nextCorrectionAction({ codeChanges: 3, investigated: true })).toBe("human_gate");
});
