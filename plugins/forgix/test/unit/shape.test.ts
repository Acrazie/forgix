// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/shape.ts";
import { expect, test } from "bun:test";

async function api() {
  return sourceApi;
}

function initialShape(createShapeState) {
  return createShapeState({
    risk: "medium",
    productBaselineRef: "design:product-baseline:1",
    budget: { maxReasoningCalls: 4, maxContextBytes: 10000 },
  });
}

function completeDiscoveryEvaluation() {
  return {
    targets: [
      {
        id: "target.auth",
        question: "Where is authentication enforced?",
        createdBecause: "Authentication boundary affects scope and validation.",
        createdAt: "2026-07-29T00:00:00.000Z",
        materialImpacts: ["scope", "validation"],
        candidateSourceRefs: ["repo:src/auth.ts"],
        status: "resolved",
        evidenceIds: ["evidence.auth"],
        dependencyNodeId: "target.auth",
      },
    ],
    evidence: [
      {
        id: "evidence.auth",
        fact: "Authentication is enforced in src/auth.ts.",
        provenanceRefs: ["repo:src/auth.ts"],
        sourceFingerprintIds: ["fingerprint.auth"],
        dependencyNodeId: "evidence.auth",
      },
    ],
    sourceFingerprints: [
      {
        id: "fingerprint.auth",
        kind: "git_blob",
        value: "blob:auth-v1",
        provenanceRef: "repo:src/auth.ts",
        dependencyNodeId: "source.auth",
      },
    ],
    dependencyNodes: [
      { id: "source.auth", kind: "source", dependsOn: [] },
      { id: "target.auth", kind: "evidence", dependsOn: ["source.auth"] },
      { id: "evidence.auth", kind: "evidence", dependsOn: ["source.auth"] },
    ],
    semanticSufficient: true,
    usage: { reasoningCalls: 1, inputTokens: 100, outputTokens: 50, contextBytes: 1000 },
  };
}

test("Discovery persists structured evidence and produces one bound sufficiency receipt", async () => {
  const {
    applyDiscoveryEvaluation,
    attestDiscoverySufficient,
    createShapeState,
    evaluateDiscoveryCompleteness,
  } = await api();
  const state = applyDiscoveryEvaluation(
    initialShape(createShapeState),
    completeDiscoveryEvaluation(),
  );
  expect(evaluateDiscoveryCompleteness(state).complete).toBe(true);
  const receipt = attestDiscoverySufficient(state);
  expect(receipt.evaluator).toBe("discovery");
  expect(receipt.completedIds).toEqual(["target.auth"]);
  expect(state.budget.usage.reasoningCalls).toBe(1);
});

test("Discovery refuses semantic sufficiency with open targets or stale evidence", async () => {
  const { applyDiscoveryEvaluation, createShapeState } = await api();
  const open = completeDiscoveryEvaluation();
  open.targets[0].status = "open";
  open.targets[0].evidenceIds = [];
  expect(() => applyDiscoveryEvaluation(initialShape(createShapeState), open)).toThrow(
    /semantic sufficiency contradicts unresolved targets/,
  );
});

test("product-impacting discovery creates rich technicalDecision and targeted resume", async () => {
  const {
    applyDiscoveryEvaluation,
    createTechnicalDecision,
    createShapeState,
    resolveTechnicalDecision,
    validateShapeState,
  } = await api();
  const evaluation = completeDiscoveryEvaluation();
  evaluation.semanticSufficient = false;
  evaluation.targets[0].status = "open";
  evaluation.targets[0].evidenceIds = [];
  let state = applyDiscoveryEvaluation(initialShape(createShapeState), evaluation);
  state = createTechnicalDecision(state, {
    id: "technical-decision.auth-ux",
    decisionKey: "auth.user-experience",
    targetId: "target.auth",
    materialityReason: "Choice changes login experience.",
    evidenceIds: ["evidence.auth"],
    options: [
      { id: "keep", label: "Keep current login", impact: "No user migration." },
      { id: "replace", label: "Replace login", impact: "Users must migrate." },
    ],
    recommendedOptionId: "keep",
    recommendationBasis: "Existing clients depend on current login.",
    confidence: "high",
    adrQualified: true,
    proposedDestination: "docs/adr/auth-login.md",
    affectedDependencyRootIds: ["evidence.auth"],
    priorRole: "discovering",
  });
  expect(state.discoveryTargets[0].status).toBe("escalated");
  expect(state.activeTechnicalDecisionId).toBe("technical-decision.auth-ux");

  const resolved = resolveTechnicalDecision(state, {
    technicalDecisionId: "technical-decision.auth-ux",
    selectedOptionId: "keep",
    evidenceRef: "user:answer:1",
  });
  expect(resolved.resumeRole).toBe("discovering");
  expect(resolved.state.activeTechnicalDecisionId).toBe(undefined);
  expect(resolved.invalidatedNodeIds.includes("evidence.auth")).toBeTruthy();
  expect(() => validateShapeState(resolved.state)).not.toThrow();
});

test("profile choice is post-Discovery, explicit, and stable through widening", async () => {
  const {
    applyDiscoveryEvaluation,
    attestDiscoverySufficient,
    createShapeState,
    requestPreparationProfileChoice,
    selectPreparationProfile,
  } = await api();
  let state = applyDiscoveryEvaluation(
    initialShape(createShapeState),
    completeDiscoveryEvaluation(),
  );
  const receipt = attestDiscoverySufficient(state);
  state = requestPreparationProfileChoice(state, {
    recommendation: "quick",
    recommendationBasis: "One localized surface with direct validation.",
    checkpoint: {
      changeShape: "localized",
      surfaceCategories: ["auth"],
      materialFacts: ["Existing auth test command is available."],
    },
    discoveryReceipt: receipt,
  });
  expect(state.preparationProfileChoice.status).toBe("pending");
  expect(() =>
    requestPreparationProfileChoice(
      applyDiscoveryEvaluation(initialShape(createShapeState), completeDiscoveryEvaluation()),
      {
        recommendation: "quick",
        recommendationBasis: "Localized",
        checkpoint: {
          changeShape: "localized",
          surfaceCategories: ["auth"],
          materialFacts: ["No migration"],
        },
        discoveryReceipt: receipt,
        preselectedProfile: "quick",
        selectionEvidenceRef: "policy:quick",
      },
    ),
  ).toThrow(/preselect Plan/);
  expect(() => selectPreparationProfile(state, { profile: "quick", evidenceRef: "" })).toThrow(
    /evidence/,
  );
  state = selectPreparationProfile(state, { profile: "quick", evidenceRef: "user:profile:quick" });
  expect(state.preparationProfileChoice.selectedProfile).toBe("quick");
  state = applyDiscoveryEvaluation(state, {
    targets: [
      {
        id: "target.widened",
        question: "Does another surface change?",
        materialImpacts: ["plan"],
        createdBecause: "Planning found a material cross-surface dependency.",
        createdAt: "2026-07-29T00:01:00.000Z",
        candidateSourceRefs: ["repo:src/other.ts"],
        status: "open",
        evidenceIds: [],
        dependencyNodeId: "target.widened",
      },
    ],
    evidence: [],
    sourceFingerprints: [],
    dependencyNodes: [{ id: "target.widened", kind: "evidence", dependsOn: [] }],
    semanticSufficient: false,
  });
  expect(state.preparationProfileChoice.selectedProfile).toBe("quick");
});

test("soft budget checkpoint preserves Shape work and routes scope reduction to INTAKE", async () => {
  const {
    applyDiscoveryEvaluation,
    createShapeState,
    resolveShapeBudgetCheckpoint,
    resolveShapeBudgetCheckpointWithRouting,
  } = await api();
  const state = applyDiscoveryEvaluation(
    createShapeState({
      risk: "low",
      productBaselineRef: "design:product-baseline:budget",
      budget: { maxReasoningCalls: 1 },
    }),
    completeDiscoveryEvaluation(),
  );
  expect(state.budget.checkpoint?.reason).toBe("reasoning_calls");
  const continued = resolveShapeBudgetCheckpoint(state, "continue");
  expect(continued.budget.checkpoint).toBe(undefined);
  expect(continued.budget.continuations).toBe(1);
  const reduction = resolveShapeBudgetCheckpointWithRouting(state, "reduce_scope");
  expect(reduction.nextAction).toBe("return_to_intake_scope_reduction");
  expect(reduction.state.discoveryTargets).toEqual(state.discoveryTargets);
});

test("resume reuses fresh evidence without reasoning and targets only stale branch", async () => {
  const { applyDiscoveryEvaluation, createShapeState, reconcileShapeResume } = await api();
  const evaluation = completeDiscoveryEvaluation();
  evaluation.targets.push({
    id: "target.other",
    question: "Where is validation?",
    createdBecause: "Validation location affects executable checks.",
    createdAt: "2026-07-29T00:02:00.000Z",
    materialImpacts: ["validation"],
    candidateSourceRefs: ["repo:test/auth.test.ts"],
    status: "resolved",
    evidenceIds: ["evidence.other"],
    dependencyNodeId: "target.other",
  });
  evaluation.evidence.push({
    id: "evidence.other",
    fact: "Validation is isolated.",
    provenanceRefs: ["repo:test/auth.test.ts"],
    sourceFingerprintIds: ["fingerprint.other"],
    dependencyNodeId: "evidence.other",
  });
  evaluation.sourceFingerprints.push({
    id: "fingerprint.other",
    kind: "git_blob",
    value: "blob:other-v1",
    provenanceRef: "repo:test/auth.test.ts",
    dependencyNodeId: "source.other",
  });
  evaluation.dependencyNodes.push(
    { id: "source.other", kind: "source", dependsOn: [] },
    { id: "target.other", kind: "evidence", dependsOn: ["source.other"] },
    { id: "evidence.other", kind: "evidence", dependsOn: ["source.other"] },
  );
  const state = applyDiscoveryEvaluation(
    createShapeState({ risk: "medium", productBaselineRef: "design:product-baseline" }),
    evaluation,
  );
  const fresh = reconcileShapeResume(state, {
    "fingerprint.auth": "blob:auth-v1",
    "fingerprint.other": "blob:other-v1",
  });
  expect(fresh.reasoningRequired).toBe(false);
  expect(fresh.state).toBe(state);

  const stale = reconcileShapeResume(state, {
    "fingerprint.auth": "blob:changed",
    "fingerprint.other": "blob:other-v1",
  });
  expect(stale.reasoningRequired).toBe(true);
  expect(stale.staleEvidenceIds).toEqual(["evidence.auth"]);
  expect(stale.reusedEvidenceIds).toEqual(["evidence.other"]);
  expect(stale.refreshTargetIds).toEqual(["refresh:evidence.auth"]);
  expect(stale.state.evidence.some((item) => item.id === "evidence.other")).toBe(true);
  expect(stale.state.preparationProfileChoice).toBe(undefined);
});
