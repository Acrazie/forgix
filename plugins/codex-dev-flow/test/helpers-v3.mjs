export const config = { schemaVersion: 1 };
export const policy = {
  schemaVersion: 1,
  requirements: {},
  prohibitions: {},
  bounds: {},
  locks: [],
};

export function completeIntake(risk = "medium", objective = "Implement adaptive SHAPE") {
  return {
    schemaVersion: 1,
    brief: {
      schemaVersion: 1,
      objective,
      successSignal: {
        description: "Expected behavior observed",
        observationMethod: "Automated tests",
      },
      risk,
      provenance: {
        sourceRefs: ["request"],
        capturedAt: "2026-07-29T00:00:00.000Z",
        freshnessRefs: ["test"],
      },
      technicalUnknowns: [],
    },
    decisions: [],
    answeredDecisionKeys: [],
    invalidations: [],
    contradictions: [],
    semanticComplete: true,
    deterministicComplete: true,
    checkpointDue: false,
    semanticRetryCount: 0,
    metrics: {
      modelCalls: 1,
      questionsAsked: 0,
      questionsAvoided: 0,
      distinctQuestions: 0,
      recommendationsAccepted: 0,
      recommendationsModified: 0,
      zeroQuestionPath: true,
      lateReopenings: 0,
    },
  };
}

export function taskInput(taskId = "task-v3", risk = "medium") {
  return {
    taskId,
    risk,
    configSnapshot: config,
    policySnapshot: policy,
    intake: completeIntake(risk),
    verificationRequirements: {
      schemaVersion: 1,
      sourceDigest: "shape:canonical-contract",
      criterionIds: ["criterion:1"],
      mandatoryCheckIds: ["test"],
    },
  };
}

export function attest(api, state, ...guards) {
  return guards.map((guard) =>
    api.createGuardAttestation(state, guard, {
      observedFingerprint: `observed:${guard}:${state.revision}`,
      evidenceRefs: [`evidence:${guard}:${state.revision}`],
      provenance: guard.includes("approval") ? "human-approval" : "deterministic-check",
      ...(guard === "review_satisfied" ? { result: "not_applicable" } : {}),
    }),
  );
}

export function discoveryEvaluation() {
  return {
    targets: [
      {
        id: "target:surface",
        question: "Which surface changes?",
        createdBecause: "Intake technical unknown requires repository evidence.",
        createdAt: "2026-07-29T00:00:00.000Z",
        materialImpacts: ["plan", "validation"],
        candidateSourceRefs: ["src/feature.ts"],
        status: "resolved",
        evidenceIds: ["evidence:surface"],
        dependencyNodeId: "target:surface",
      },
    ],
    evidence: [
      {
        id: "evidence:surface",
        fact: "Feature is localized",
        provenanceRefs: ["src/feature.ts"],
        sourceFingerprintIds: ["source:feature"],
        dependencyNodeId: "evidence:surface",
      },
    ],
    sourceFingerprints: [
      {
        id: "source:feature",
        kind: "git_blob",
        value: "blob:feature",
        provenanceRef: "git:src/feature.ts",
        dependencyNodeId: "source:feature",
      },
    ],
    dependencyNodes: [
      { id: "source:feature", kind: "source", dependsOn: [] },
      { id: "evidence:surface", kind: "evidence", dependsOn: ["source:feature"] },
      { id: "target:surface", kind: "evidence", dependsOn: ["evidence:surface"] },
    ],
    semanticSufficient: true,
  };
}

export function planningEvaluation(profile = "quick") {
  return {
    semanticImplementable: true,
    dependencyNodes: [
      { id: "criterion:1", kind: "criterion", dependsOn: ["evidence:surface"] },
      { id: "task:1", kind: "task", dependsOn: ["criterion:1"] },
      { id: "validation:1", kind: "validation", dependsOn: ["task:1"] },
    ],
    contract: {
      schemaVersion: 1,
      artifactId: "change:1",
      revision: 1,
      profile,
      scope: ["Update feature"],
      nonGoals: profile === "plan" ? ["No unrelated refactor"] : [],
      acceptanceCriteria: [
        {
          id: "criterion:1",
          description: "Feature works",
          validationIds: ["validation:1"],
          dependencyNodeId: "criterion:1",
        },
      ],
      tasks: [
        {
          id: "task:1",
          description: "Implement feature",
          criterionIds: ["criterion:1"],
          dependsOnTaskIds: [],
          dependencyNodeId: "task:1",
        },
      ],
      validations: [
        {
          id: "validation:1",
          description: "Run tests",
          criterionIds: ["criterion:1"],
          command: "bun test",
          dependencyNodeId: "validation:1",
        },
      ],
      risks: [],
    },
  };
}

export async function toDiscovering(api, taskId = "flow", risk = "medium") {
  let state = api.createState(taskInput(taskId, risk));
  state = api.transition(state, "intaking", {
    guardEvidence: attest(api, state, "effective_constraints_valid"),
  });
  state = api.transition(state, "discovering", {
    guardEvidence: [
      api.attestIntakeComplete(state, "intake:test"),
      ...attest(api, state, "routing_ready", "workspace_ready"),
    ],
  });
  return state;
}

export async function toPlanning(api, profile = "quick", taskId = `flow-${profile}`) {
  let state = await toDiscovering(api, taskId);
  let shape = api.applyDiscoveryEvaluation(state.shape, discoveryEvaluation());
  const discoveryReceipt = api.attestDiscoverySufficient(shape);
  shape = api.requestPreparationProfileChoice(shape, {
    recommendation: profile,
    recommendationBasis: "Evidence-backed surface size",
    checkpoint: {
      changeShape: "Localized",
      surfaceCategories: ["source", "tests"],
      materialFacts: ["No migration"],
    },
    discoveryReceipt,
  });
  state = api.updateShapeState(state, shape, {
    type: "profile.choice_requested",
    refs: [{ kind: "receipt", ref: discoveryReceipt.receiptDigest }],
  });
  state = api.transition(state, "awaiting_profile_choice", {
    guardEvidence: [api.evaluateDiscoveryGuard(state, discoveryReceipt)],
  });
  shape = api.selectPreparationProfile(state.shape, {
    profile,
    evidenceRef: `user:profile:${profile}`,
  });
  state = api.updateShapeState(state, shape, {
    type: "profile.choice_recorded",
    refs: [{ kind: "decision", ref: `profile:${profile}` }],
  });
  state = api.transition(state, "planning", {
    guardEvidence: attest(api, state, "profile_selected"),
  });
  return state;
}

export async function toGate(api, profile = "quick", taskId = `gate-${profile}`) {
  let state = await toPlanning(api, profile, taskId);
  const shape = api.applyPlanningEvaluation(state.shape, planningEvaluation(profile));
  const receipt = api.attestContractComplete(shape);
  state = api.updateShapeState(state, shape, {
    type: "contract.projected",
    refs: [{ kind: "artifact", ref: shape.contract.artifactId }],
  });
  state = api.transition(state, "awaiting_approval", {
    contractDigest: shape.contract.digest,
    guardEvidence: [
      api.evaluateDiscoveryGuard(
        state,
        shape.evaluatorReceipts.find((item) => item.evaluator === "discovery"),
      ),
      api.createGuardAttestation(state, "profile_selected", {
        observedFingerprint: "profile:selected",
        evidenceRefs: ["profile:selected"],
        provenance: "deterministic-check",
      }),
      api.evaluatePlanningGuard(state, receipt),
    ],
  });
  return state;
}
