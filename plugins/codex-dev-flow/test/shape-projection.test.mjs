import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

test("Plan renderer is deterministic, path-safe, and detects manual drift", async () => {
  const {
    approvePlanProjection,
    detectPlanProjectionDrift,
    renderPlanProjection
  } = await import(bundle);
  const contract = {
    schemaVersion: 1,
    artifactId: "artifact.pagination",
    revision: 1,
    profile: "plan",
    risk: "medium",
    intakeBriefRef: "intake:brief:1",
    discoveryReceiptDigest: "receipt:discovery:1",
    scope: ["Add pagination."],
    nonGoals: ["Do not change authentication."],
    acceptanceCriteria: [{
      id: "criterion.page", description: "Endpoint paginates results.",
      validationIds: ["validation.page"], dependencyNodeId: "criterion.page"
    }],
    tasks: [{
      id: "task.page", description: "Implement pagination.", criterionIds: ["criterion.page"],
      dependsOnTaskIds: [], dependencyNodeId: "task.page"
    }],
    validations: [{
      id: "validation.page", description: "Run API test.", criterionIds: ["criterion.page"],
      command: "bun test test/api.test.mjs", dependencyNodeId: "validation.page"
    }],
    risks: [],
    digest: "a".repeat(64)
  };
  const first = renderPlanProjection(contract, { date: "2026-07-29", slug: "pagination" });
  const second = renderPlanProjection(contract, { date: "2026-07-29", slug: "pagination" });
  assert.deepEqual(first, second);
  assert.equal(first.path, "docs/dev-flow/2026-07-29-pagination.md");
  assert.equal(first.status, "Proposed");
  assert.equal(detectPlanProjectionDrift(first, first.markdown), false);
  assert.equal(detectPlanProjectionDrift(first, `${first.markdown}\nmanual edit`), true);
  assert.equal(approvePlanProjection(first).status, "Approved");
  assert.throws(
    () => renderPlanProjection(contract, { path: "../outside.md" }),
    /safe repository-relative/
  );
});

