import { expect, test } from "bun:test";
import {
  compileAssuranceContract,
  completeAssurance,
  createAssuranceState,
  invalidateAssuranceEvidence,
  planAssuranceExecution,
  recordAssuranceIssue,
  recordCorrectionAttempt,
  recordAssuranceEvidence,
  resolveAssuranceIssue,
  reviewRequiresEscalation,
  validateConsolidatedReviewResult,
  validateAssuranceContract,
} from "../../src/assurance.ts";

function contract() {
  return compileAssuranceContract({
    schemaVersion: 1,
    sourceDigest: "shape:contract",
    policyDigest: "policy:snapshot",
    subjects: [
      { id: "criterion:works", kind: "criterion" },
      { id: "risk:security", kind: "risk" },
    ],
    operations: [
      {
        id: "check:test",
        kind: "command",
        dependsOn: [],
        covers: ["criterion:works"],
        cost: "low",
        scopeRefs: ["scope:source"],
        fingerprintMode: "scoped",
        readOnly: true,
        concurrencySafe: true,
        conditional: false,
        checkIdentity: {
          executable: "bun",
          argv: ["test"],
          logicalCwd: ".",
          environment: {},
          toolFingerprintRefs: ["tool:bun"],
        },
        successPredicate: { exitCodes: [0] },
      },
      {
        id: "review:security",
        kind: "model-inspection",
        dependsOn: ["check:test"],
        covers: ["risk:security"],
        cost: "high",
        scopeRefs: ["scope:source"],
        fingerprintMode: "global",
        readOnly: true,
        concurrencySafe: false,
        conditional: true,
        activationPredicateRef: "policy:security-review",
      },
    ],
    evidencePreference: ["check:test", "review:security"],
    reviewBudget: {
      maxInputTokens: 4_000,
      maxOutputTokens: 1_000,
      maxCalls: 2,
      maxConcurrency: 2,
    },
  });
}

test("assurance contract rejects cycles, unsafe identities, and criterion N/A", () => {
  const valid = contract();
  expect(() =>
    validateAssuranceContract({
      ...valid,
      operations: valid.operations.map((item) =>
        item.id === "check:test" ? { ...item, dependsOn: ["review:security"] } : item,
      ),
    }),
  ).toThrow(/digest|cycle/);
  expect(() =>
    recordAssuranceEvidence(valid, createAssuranceState(), {
      evidenceId: "evidence:test",
      operationId: "check:test",
      result: "not_applicable",
      verifierDigest: "verifier:test",
      observedFingerprint: "scope:v1",
      detailRef: "log:test",
    }),
  ).toThrow(/conditional|criteria/i);
});

test("execution reuses fresh evidence, orders cheap DAG work, and skips failed dependants", () => {
  const assuranceContract = contract();
  let state = recordAssuranceEvidence(assuranceContract, undefined, {
    evidenceId: "evidence:test",
    operationId: "check:test",
    result: "passed",
    verifierDigest: "verifier:test",
    observedFingerprint: "scope:v1",
    detailRef: "log:test",
  });
  expect(
    planAssuranceExecution(assuranceContract, state, {
      currentFingerprints: { "check:test": "scope:v1", "review:security": "workspace:v1" },
      activationPredicates: { "policy:security-review": true },
    }),
  ).toEqual({
    reusedOperationIds: ["check:test"],
    notApplicableOperationIds: [],
    skippedOperationIds: [],
    batches: [["review:security"]],
  });
  state = recordAssuranceEvidence(assuranceContract, state, {
    evidenceId: "evidence:test-failed",
    operationId: "check:test",
    result: "failed",
    verifierDigest: "verifier:test",
    observedFingerprint: "scope:v2",
    detailRef: "log:test-failed",
  });
  expect(
    planAssuranceExecution(assuranceContract, state, {
      currentFingerprints: { "check:test": "scope:v2", "review:security": "workspace:v2" },
      activationPredicates: { "policy:security-review": true },
    }).skippedOperationIds,
  ).toEqual(["review:security"]);
});

test("review output is exact and repeated stable issue requires root-cause debug", () => {
  const result = validateConsolidatedReviewResult(
    {
      schemaVersion: 1,
      subjectVerdicts: [{ subjectId: "risk:security", verdict: "finding" }],
      findings: [
        {
          issueId: "issue:authz",
          subjectId: "risk:security",
          severity: "blocking",
          locationRef: "symbol:authorize",
          evidence: "Missing deny branch.",
          requiredCorrection: "Add deny-by-default branch.",
          confidence: "low",
        },
      ],
    },
    ["risk:security"],
  );
  expect(reviewRequiresEscalation(result)).toBe(true);
  const assuranceContract = contract();
  let state = recordAssuranceIssue(assuranceContract, createAssuranceState(), {
    issueId: "issue:authz",
    operationId: "review:security",
    evidenceRef: "review:finding",
  });
  state = recordCorrectionAttempt(assuranceContract, state, "issue:authz");
  state = recordCorrectionAttempt(assuranceContract, state, "issue:authz");
  expect(state.issues?.[0]).toMatchObject({ correctionAttempts: 2, rootCauseRequired: true });
  expect(resolveAssuranceIssue(assuranceContract, state, "issue:authz").issues?.[0]).toMatchObject({
    status: "resolved",
    rootCauseRequired: false,
  });
});

test("fresh scoped evidence survives unrelated writes; global evidence does not", () => {
  const assuranceContract = contract();
  let state = recordAssuranceEvidence(assuranceContract, undefined, {
    evidenceId: "evidence:test",
    operationId: "check:test",
    result: "passed",
    verifierDigest: "verifier:test",
    observedFingerprint: "scope:v1",
    detailRef: "log:test",
  });
  state = recordAssuranceEvidence(assuranceContract, state, {
    evidenceId: "evidence:review",
    operationId: "review:security",
    result: "passed",
    verifierDigest: "review:model",
    observedFingerprint: "workspace:v1",
    detailRef: "review:result",
  });
  expect(
    invalidateAssuranceEvidence(assuranceContract, state, ["scope:docs"]).evidenceIndex,
  ).toHaveLength(1);
  expect(
    invalidateAssuranceEvidence(assuranceContract, state, ["scope:source"]).evidenceIndex,
  ).toHaveLength(0);
});

test("completion binds canonical fresh evidence and rejects stale coverage", () => {
  const assuranceContract = contract();
  let state = recordAssuranceEvidence(assuranceContract, undefined, {
    evidenceId: "evidence:test",
    operationId: "check:test",
    result: "passed",
    verifierDigest: "verifier:test",
    observedFingerprint: "scope:v1",
    detailRef: "log:test",
  });
  state = recordAssuranceEvidence(assuranceContract, state, {
    evidenceId: "evidence:review",
    operationId: "review:security",
    result: "passed",
    verifierDigest: "review:model",
    observedFingerprint: "workspace:v1",
    detailRef: "review:result",
  });
  expect(() =>
    completeAssurance(assuranceContract, state, {
      taskId: "task:1",
      contractDigest: "contract:v1",
      verifiedSnapshotFingerprint: "workspace:v1",
      currentFingerprints: {
        "check:test": "scope:stale",
        "review:security": "workspace:v1",
      },
    }),
  ).toThrow(/coverage incomplete/);
  expect(() =>
    completeAssurance(assuranceContract, state, {
      taskId: "task:1",
      contractDigest: "contract:v1",
      verifiedSnapshotFingerprint: "workspace:v2",
      currentFingerprints: {
        "check:test": "scope:v1",
        "review:security": "workspace:v1",
      },
    }),
  ).toThrow(/coverage incomplete/);
  const completed = completeAssurance(assuranceContract, state, {
    taskId: "task:1",
    contractDigest: "contract:v1",
    verifiedSnapshotFingerprint: "workspace:v1",
    currentFingerprints: {
      "check:test": "scope:v1",
      "review:security": "workspace:v1",
    },
  });
  expect(completed.completionIndex).toEqual(["evidence:test", "evidence:review"]);
  expect(completed.receipt?.evidenceIndexDigest).toMatch(/^sha256:/);
});
