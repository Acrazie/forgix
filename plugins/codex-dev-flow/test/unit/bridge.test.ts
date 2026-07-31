// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/bridge.ts";
import { expect, test } from "bun:test";
import { expectRejected } from "../support/expect-error.ts";

test("only analysis and review stages are delegable; execute and validate stay with parent", async () => {
  const { ROUTED_STAGES, isDelegableStage } = sourceApi;
  expect(ROUTED_STAGES).toEqual(["discover", "plan", "debug", "review", "verify"]);
  for (const stage of ROUTED_STAGES) expect(isDelegableStage(stage)).toBe(true);
  expect(isDelegableStage("execute")).toBe(false);
  expect(isDelegableStage("validate")).toBe(false);
});

test("bridge rejects mutation delegation", async () => {
  const { delegateStage } = sourceApi;
  await expectRejected(
    () => delegateStage("execute", async () => "must not run"),
    (error) => error instanceof Error && /parent workflow/.test(error.message),
  );
});
