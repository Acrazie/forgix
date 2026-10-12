// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/shape-projection.ts";
import { expect, test } from "bun:test";

test("Plan renderer is deterministic, path-safe, and detects manual drift", async () => {
  const { approvePlanProjection, detectPlanProjectionDrift, renderPlanProjection } = sourceApi;
  const contract = {
    schemaVersion: 1,
    artifactId: "artifact.pagination",
    revision: 1,
    profile: "plan",
    risk: "medium",
    productBaselineRef: "design:product-baseline:1",
    discoveryReceiptDigest: "receipt:discovery:1",
    scope: ["Add pagination."],
    nonGoals: ["Do not change authentication."],
    acceptanceCriteria: [
      {
        id: "criterion.page",
        description: "Endpoint paginates results.",
        validationIds: ["validation.page"],
        dependencyNodeId: "criterion.page",
      },
    ],
    tasks: [
      {
        id: "task.page",
        description: "Implement pagination.",
        criterionIds: ["criterion.page"],
        dependsOnTaskIds: [],
        dependencyNodeId: "task.page",
      },
    ],
    validations: [
      {
        id: "validation.page",
        description: "Run API test.",
        criterionIds: ["criterion.page"],
        command: "bun test test/api.test.mjs",
        dependencyNodeId: "validation.page",
      },
    ],
    risks: [],
    digest: "a".repeat(64),
  };
  const first = renderPlanProjection(contract, { date: "2026-07-29", slug: "pagination" });
  const second = renderPlanProjection(contract, { date: "2026-07-29", slug: "pagination" });
  expect(first).toEqual(second);
  expect(first.path).toBe("docs/dev-flow/2026-07-29-pagination.md");
  expect(first.status).toBe("Proposed");
  expect(detectPlanProjectionDrift(first, first.markdown)).toBe(false);
  expect(detectPlanProjectionDrift(first, `${first.markdown}\nmanual edit`)).toBe(true);
  expect(approvePlanProjection(first).status).toBe("Approved");
  expect(() => renderPlanProjection(contract, { path: "../outside.md" })).toThrow(
    /safe repository-relative/,
  );
});
