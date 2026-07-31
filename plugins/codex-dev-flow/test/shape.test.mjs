import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

async function api() {
  return import(bundle);
}

function initialShape(createShapeState) {
  return createShapeState({
    risk: "medium",
    intakeBriefRef: "intake:brief:1",
    budget: { maxReasoningCalls: 4, maxContextBytes: 10000 }
  });
}

function completeDiscoveryEvaluation() {
  return {
    targets: [{
      id: "target.auth",
      question: "Where is authentication enforced?",
      createdBecause: "Authentication boundary affects scope and validation.",
      createdAt: "2026-07-29T00:00:00.000Z",
      materialImpacts: ["scope", "validation"],
      candidateSourceRefs: ["repo:src/auth.ts"],
      status: "resolved",
      evidenceIds: ["evidence.auth"],
      dependencyNodeId: "target.auth"
    }],
    evidence: [{
      id: "evidence.auth",
      fact: "Authentication is enforced in src/auth.ts.",
      provenanceRefs: ["repo:src/auth.ts"],
      sourceFingerprintIds: ["fingerprint.auth"],
      dependencyNodeId: "evidence.auth"
    }],
    sourceFingerprints: [{
      id: "fingerprint.auth",
      kind: "git_blob",
      value: "blob:auth-v1",
      provenanceRef: "repo:src/auth.ts",
      dependencyNodeId: "source.auth"
    }],
    dependencyNodes: [
      { id: "source.auth", kind: "source", dependsOn: [] },
      { id: "target.auth", kind: "evidence", dependsOn: ["source.auth"] },
      { id: "evidence.auth", kind: "evidence", dependsOn: ["source.auth"] }
    ],
    semanticSufficient: true,
    usage: { reasoningCalls: 1, inputTokens: 100, outputTokens: 50, contextBytes: 1000 }
  };
}

test("Discovery persists structured evidence and produces one bound sufficiency receipt", async () => {
  const {
    applyDiscoveryEvaluation,
    attestDiscoverySufficient,
    createShapeState,
    evaluateDiscoveryCompleteness
  } = await api();
  const state = applyDiscoveryEvaluation(initialShape(createShapeState), completeDiscoveryEvaluation());
  assert.equal(evaluateDiscoveryCompleteness(state).complete, true);
  const receipt = attestDiscoverySufficient(state);
  assert.equal(receipt.evaluator, "discovery");
  assert.deepEqual(receipt.completedIds, ["target.auth"]);
  assert.equal(state.budget.usage.reasoningCalls, 1);
});

test("Discovery refuses semantic sufficiency with open targets or stale evidence", async () => {
  const { applyDiscoveryEvaluation, createShapeState } = await api();
  const open = completeDiscoveryEvaluation();
  open.targets[0].status = "open";
  open.targets[0].evidenceIds = [];
  assert.throws(
    () => applyDiscoveryEvaluation(initialShape(createShapeState), open),
    /semantic sufficiency contradicts unresolved targets/
  );
});

test("product-impacting discovery creates rich escalation and targeted resume", async () => {
  const {
    applyDiscoveryEvaluation,
    createDecisionEscalation,
    createShapeState,
    resolveDecisionEscalation,
    validateShapeState
  } = await api();
  const evaluation = completeDiscoveryEvaluation();
  evaluation.semanticSufficient = false;
  evaluation.targets[0].status = "open";
  evaluation.targets[0].evidenceIds = [];
  let state = applyDiscoveryEvaluation(initialShape(createShapeState), evaluation);
  state = createDecisionEscalation(state, {
    id: "escalation.auth-ux",
    decisionKey: "auth.user-experience",
    targetId: "target.auth",
    productImpact: "Choice changes login experience.",
    evidenceIds: ["evidence.auth"],
    options: [
      { id: "keep", label: "Keep current login", impact: "No user migration." },
      { id: "replace", label: "Replace login", impact: "Users must migrate." }
    ],
    recommendedOptionId: "keep",
    recommendationBasis: "Existing clients depend on current login.",
    affectedDependencyRootIds: ["evidence.auth"],
    priorRole: "discovering"
  });
  assert.equal(state.discoveryTargets[0].status, "escalated");
  assert.equal(state.activeEscalationId, "escalation.auth-ux");

  const resolved = resolveDecisionEscalation(state, {
    escalationId: "escalation.auth-ux",
    selectedOptionId: "keep",
    evidenceRef: "user:answer:1"
  });
  assert.equal(resolved.resumeRole, "discovering");
  assert.equal(resolved.state.activeEscalationId, undefined);
  assert.ok(resolved.invalidatedNodeIds.includes("evidence.auth"));
  assert.doesNotThrow(() => validateShapeState(resolved.state));
});

test("profile choice is post-Discovery, explicit, and stable through widening", async () => {
  const {
    applyDiscoveryEvaluation,
    attestDiscoverySufficient,
    createShapeState,
    requestPreparationProfileChoice,
    selectPreparationProfile
  } = await api();
  let state = applyDiscoveryEvaluation(initialShape(createShapeState), completeDiscoveryEvaluation());
  const receipt = attestDiscoverySufficient(state);
  state = requestPreparationProfileChoice(state, {
    recommendation: "quick",
    recommendationBasis: "One localized surface with direct validation.",
    checkpoint: {
      changeShape: "localized",
      surfaceCategories: ["auth"],
      materialFacts: ["Existing auth test command is available."]
    },
    discoveryReceipt: receipt
  });
  assert.equal(state.preparationProfileChoice.status, "pending");
  assert.throws(() => requestPreparationProfileChoice(
    applyDiscoveryEvaluation(initialShape(createShapeState), completeDiscoveryEvaluation()),
    {
      recommendation: "quick",
      recommendationBasis: "Localized",
      checkpoint: { changeShape: "localized", surfaceCategories: ["auth"], materialFacts: ["No migration"] },
      discoveryReceipt: receipt,
      preselectedProfile: "quick",
      selectionEvidenceRef: "policy:quick"
    }
  ), /preselect Plan/);
  assert.throws(() => selectPreparationProfile(state, { profile: "quick", evidenceRef: "" }), /evidence/);
  state = selectPreparationProfile(state, { profile: "quick", evidenceRef: "user:profile:quick" });
  assert.equal(state.preparationProfileChoice.selectedProfile, "quick");
  state = applyDiscoveryEvaluation(state, {
    targets: [{
      id: "target.widened", question: "Does another surface change?", materialImpacts: ["plan"],
      createdBecause: "Planning found a material cross-surface dependency.",
      createdAt: "2026-07-29T00:01:00.000Z",
      candidateSourceRefs: ["repo:src/other.ts"], status: "open", evidenceIds: [],
      dependencyNodeId: "target.widened"
    }],
    evidence: [],
    sourceFingerprints: [],
    dependencyNodes: [{ id: "target.widened", kind: "evidence", dependsOn: [] }],
    semanticSufficient: false
  });
  assert.equal(state.preparationProfileChoice.selectedProfile, "quick");
});

test("soft budget checkpoint preserves Shape work and routes scope reduction to INTAKE", async () => {
  const { applyDiscoveryEvaluation, createShapeState, resolveShapeBudgetCheckpoint, resolveShapeBudgetCheckpointWithRouting } = await api();
  const state = applyDiscoveryEvaluation(
    createShapeState({
      risk: "low",
      intakeBriefRef: "intake:brief:budget",
      budget: { maxReasoningCalls: 1 }
    }),
    completeDiscoveryEvaluation()
  );
  assert.equal(state.budget.checkpoint?.reason, "reasoning_calls");
  const continued = resolveShapeBudgetCheckpoint(state, "continue");
  assert.equal(continued.budget.checkpoint, undefined);
  assert.equal(continued.budget.continuations, 1);
  const reduction = resolveShapeBudgetCheckpointWithRouting(state, "reduce_scope");
  assert.equal(reduction.nextAction, "return_to_intake_scope_reduction");
  assert.deepEqual(reduction.state.discoveryTargets, state.discoveryTargets);
});

test("resume reuses fresh evidence without reasoning and targets only stale branch", async () => {
  const { applyDiscoveryEvaluation, createShapeState, reconcileShapeResume } = await api();
  const evaluation = completeDiscoveryEvaluation();
  evaluation.targets.push({
    id: "target.other", question: "Where is validation?",
    createdBecause: "Validation location affects executable checks.",
    createdAt: "2026-07-29T00:02:00.000Z", materialImpacts: ["validation"],
    candidateSourceRefs: ["repo:test/auth.test.ts"], status: "resolved",
    evidenceIds: ["evidence.other"], dependencyNodeId: "target.other"
  });
  evaluation.evidence.push({
    id: "evidence.other", fact: "Validation is isolated.", provenanceRefs: ["repo:test/auth.test.ts"],
    sourceFingerprintIds: ["fingerprint.other"], dependencyNodeId: "evidence.other"
  });
  evaluation.sourceFingerprints.push({
    id: "fingerprint.other", kind: "git_blob", value: "blob:other-v1",
    provenanceRef: "repo:test/auth.test.ts", dependencyNodeId: "source.other"
  });
  evaluation.dependencyNodes.push(
    { id: "source.other", kind: "source", dependsOn: [] },
    { id: "target.other", kind: "evidence", dependsOn: ["source.other"] },
    { id: "evidence.other", kind: "evidence", dependsOn: ["source.other"] }
  );
  const state = applyDiscoveryEvaluation(createShapeState({ risk: "medium", intakeBriefRef: "intake:brief" }), evaluation);
  const fresh = reconcileShapeResume(state, {
    "fingerprint.auth": "blob:auth-v1",
    "fingerprint.other": "blob:other-v1"
  });
  assert.equal(fresh.reasoningRequired, false);
  assert.equal(fresh.state, state);

  const stale = reconcileShapeResume(state, {
    "fingerprint.auth": "blob:changed",
    "fingerprint.other": "blob:other-v1"
  });
  assert.equal(stale.reasoningRequired, true);
  assert.deepEqual(stale.staleEvidenceIds, ["evidence.auth"]);
  assert.deepEqual(stale.reusedEvidenceIds, ["evidence.other"]);
  assert.deepEqual(stale.refreshTargetIds, ["refresh:evidence.auth"]);
  assert.equal(stale.state.evidence.some((item) => item.id === "evidence.other"), true);
  assert.equal(stale.state.preparationProfileChoice, undefined);
});
