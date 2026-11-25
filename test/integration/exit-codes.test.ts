// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import { expect, test } from "bun:test";

test("bundle exports stable workflow exit codes", async () => {
  const bundle = new URL("../../dist/forgix.mjs", import.meta.url);
  const { EXIT_CODES } = await import(bundle);
  expect(EXIT_CODES).toEqual({
    SUCCESS: 0,
    INVALID_INVOCATION: 2,
    INVALID_CONFIGURATION: 3,
    POLICY_CONTRADICTION: 4,
    STATE_CONFLICT: 5,
    BLOCKED: 6,
    INTERNAL_ERROR: 10,
  });
});
