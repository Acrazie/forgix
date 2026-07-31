// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/shape.ts";
import { expect, test } from "bun:test";

async function api() {
  return sourceApi;
}

async function shaped(profile = "quick") {
  const {
    applyDiscoveryEvaluation,
    attestDiscoverySufficient,
    createShapeState,
    requestPreparationProfileChoice,
    selectPreparationProfile,
  } = await api();
  let state = createShapeState({ risk: "medium", intakeBriefRef: "intake:brief:planning" });
  state = applyDiscoveryEvaluation(state, {
    targets: [
      {
        id: "target.api",
        question: "Where is API behavior implemented?",
        createdBecause: "API surface affects contract scope.",
        createdAt: "2026-07-29T00:00:00.000Z",
        materialImpacts: ["scope", "validation"],
        candidateSourceRefs: ["repo:api"],
        status: "resolved",
        evidenceIds: ["evidence.api"],
        dependencyNodeId: "target.api",
      },
    ],
    evidence: [
      {
        id: "evidence.api",
        fact: "API behavior is in src/api.ts.",
        provenanceRefs: ["repo:api"],
        sourceFingerprintIds: ["fp.api"],
        dependencyNodeId: "evidence.api",
      },
    ],
    sourceFingerprints: [
      {
        id: "fp.api",
        kind: "git_blob",
        value: "blob:api",
        provenanceRef: "repo:api",
        dependencyNodeId: "source.api",
      },
    ],
    dependencyNodes: [
      { id: "source.api", kind: "source", dependsOn: [] },
      { id: "target.api", kind: "evidence", dependsOn: ["source.api"] },
      { id: "evidence.api", kind: "evidence", dependsOn: ["source.api"] },
    ],
    semanticSufficient: true,
  });
  const receipt = attestDiscoverySufficient(state);
  state = requestPreparationProfileChoice(state, {
    recommendation: profile,
    recommendationBasis: "Test fixture.",
    checkpoint: {
      changeShape: "localized",
      surfaceCategories: ["api"],
      materialFacts: ["API tests exist."],
    },
    discoveryReceipt: receipt,
  });
  return selectPreparationProfile(state, { profile, evidenceRef: `user:profile:${profile}` });
}

function quickPlanningEvaluation() {
  return {
    semanticImplementable: true,
    dependencyNodes: [
      { id: "criterion.api", kind: "criterion", dependsOn: ["evidence.api"] },
      { id: "task.api", kind: "task", dependsOn: ["criterion.api"] },
      { id: "validation.api", kind: "validation", dependsOn: ["criterion.api"] },
    ],
    contract: {
      schemaVersion: 1,
      artifactId: "artifact.api",
      revision: 1,
      profile: "quick",
      scope: ["Update API behavior."],
      nonGoals: [],
      acceptanceCriteria: [
        {
          id: "criterion.api",
          description: "API returns expected result.",
          validationIds: ["validation.api"],
          dependencyNodeId: "criterion.api",
        },
      ],
      tasks: [
        {
          id: "task.api",
          description: "Update API implementation.",
          criterionIds: ["criterion.api"],
          dependsOnTaskIds: [],
          dependencyNodeId: "task.api",
        },
      ],
      validations: [
        {
          id: "validation.api",
          description: "Run API tests.",
          criterionIds: ["criterion.api"],
          command: "bun test test/api.test.mjs",
          dependencyNodeId: "validation.api",
        },
      ],
      risks: [],
    },
  };
}

test("Quick Planning produces compact complete canonical contract", async () => {
  const { applyPlanningEvaluation, attestContractComplete, evaluateContractCompleteness } =
    await api();
  const state = applyPlanningEvaluation(await shaped("quick"), quickPlanningEvaluation());
  expect(evaluateContractCompleteness(state).complete).toBe(true);
  expect(state.contract.profile).toBe("quick");
  expect(state.contract.digest).toMatch(/^[a-f0-9]{64}$/);
  expect(attestContractComplete(state).evaluator).toBe("planning");
});

test("Planning rejects uncovered criteria and stale or invented evidence dependencies", async () => {
  const { applyPlanningEvaluation } = await api();
  const uncovered = quickPlanningEvaluation();
  uncovered.contract.tasks[0].criterionIds = [];
  const quick = await shaped("quick");
  expect(() => applyPlanningEvaluation(quick, uncovered)).toThrow(/criterion.*task_coverage/i);

  const invented = quickPlanningEvaluation();
  invented.dependencyNodes[0].dependsOn = ["missing.evidence"];
  expect(() => applyPlanningEvaluation(quick, invented)).toThrow(/unknown dependency/);
});

test("missing Planning evidence returns one material Discovery Target", async () => {
  const { applyPlanningEvaluation } = await api();
  const state = applyPlanningEvaluation(await shaped("plan"), {
    semanticImplementable: false,
    missingEvidenceTarget: {
      id: "target.migration",
      question: "Which migration pattern is required?",
      createdBecause: "Planning lacks material migration evidence.",
      createdAt: "2026-07-29T00:01:00.000Z",
      materialImpacts: ["plan", "validation"],
      candidateSourceRefs: ["repo:migrations"],
      status: "open",
      evidenceIds: [],
      dependencyNodeId: "target.migration",
    },
    dependencyNodes: [{ id: "target.migration", kind: "evidence", dependsOn: [] }],
  });
  expect(state.discoveryTargets.at(-1).id).toBe("target.migration");
  expect(state.contract).toBe(undefined);
});

test("Implementation Guide requires evidence-linked admissible reason", async () => {
  const { applyPlanningEvaluation } = await api();
  const evaluation = quickPlanningEvaluation();
  evaluation.contract.profile = "plan";
  evaluation.contract.nonGoals = ["Do not change unrelated endpoints."];
  evaluation.dependencyNodes.push({ id: "guide.api", kind: "guide", dependsOn: ["evidence.api"] });
  evaluation.contract.guide = {
    dependencyNodeId: "guide.api",
    content: ["Preserve public response compatibility."],
    requiredBecause: [
      {
        kind: "compatibility_migration",
        evidenceIds: ["evidence.api"],
        riskIds: [],
      },
    ],
  };
  const state = applyPlanningEvaluation(await shaped("plan"), evaluation);
  expect(state.contract.guide.requiredBecause[0].kind).toBe("compatibility_migration");

  const invalid = structuredClone(evaluation);
  invalid.contract.guide.requiredBecause[0].evidenceIds = [];
  const planned = await shaped("plan");
  expect(() => applyPlanningEvaluation(planned, invalid)).toThrow(
    /Guide reason requires evidence or risk/,
  );
});
