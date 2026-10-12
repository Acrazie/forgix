// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/worktree.ts";
import { expect, test } from "bun:test";

test("worktree derives from risk, policy, request, concurrency, and safety—not profile", async () => {
  const { decideWorktree } = sourceApi;
  expect(
    decideWorktree({ risk: "critical", requested: false, concurrent: false, checkoutSafe: true }),
  ).toEqual({ required: true, reason: "critical_risk" });
  expect(
    decideWorktree({
      risk: "low",
      policyRequired: true,
      requested: false,
      concurrent: false,
      checkoutSafe: true,
    }),
  ).toEqual({ required: true, reason: "policy" });
  expect(
    decideWorktree({ risk: "low", requested: true, concurrent: false, checkoutSafe: true }),
  ).toEqual({ required: true, reason: "requested" });
  expect(
    decideWorktree({ risk: "low", requested: false, concurrent: false, checkoutSafe: true }),
  ).toEqual({ required: false, reason: "none" });
});
