import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const config = { schemaVersion: 1 };
const policy = { schemaVersion: 1, requirements: {}, prohibitions: {}, bounds: {}, locks: [] };

async function api() {
  return import(bundle);
}

function input(mode, suffix) {
  const sourceDigest = `sha256:contract:${mode}:${suffix}`;
  return {
    taskId: `path-${mode}-${suffix}`,
    mode,
    modeEvidenceRef: `request:${mode}:mode`,
    configSnapshot: config,
    policySnapshot: policy,
    intake: completeIntake(mode, suffix),
    verificationRequirements: {
      schemaVersion: 1,
      sourceDigest,
      criterionIds: ["criterion-1"],
      mandatoryCheckIds: ["typecheck", "test"]
    }
  };
}

function completeIntake(mode, suffix) {
  return {
    schemaVersion: 1,
    brief: {
      schemaVersion: 1,
      objective: `Exercise ${suffix}`,
      successSignal: { description: "Lifecycle completes", observationMethod: "Path assertions pass" },
      mode,
      risk: mode === "critical" ? "critical" : mode === "standard" ? "medium" : "low",
      provenance: { sourceRefs: ["request"], capturedAt: "2026-07-28T00:00:00.000Z", freshnessRefs: ["test"] },
      technicalUnknowns: []
    },
    decisions: [], answeredDecisionKeys: [], invalidations: [], contradictions: [],
    semanticComplete: true, deterministicComplete: true, checkpointDue: false, semanticRetryCount: 0,
    metrics: {
      modelCalls: 1, questionsAsked: 0, questionsAvoided: 0, distinctQuestions: 0,
      recommendationsAccepted: 0, recommendationsModified: 0, zeroQuestionPath: true,
      lateReopenings: 0, modeChanges: 0
    }
  };
}

function attest(createGuardAttestation, state, ...guards) {
  return guards.map((guard) => createGuardAttestation(state, guard, {
    observedFingerprint: `observed:${guard}:${state.revision}`,
    evidenceRefs: [`evidence:${guard}:${state.revision}`],
    provenance: guard.includes("approval") ? "human-approval" : "deterministic-check",
    ...(guard === "review_satisfied" ? { result: "not_applicable" } : {})
  }));
}

function observation(state, id, exitCode = 0) {
  return {
    id,
    stateRevision: state.revision,
    observedFingerprint: `sha256:${state.taskId}:${id}:result`,
    evidenceRef: `evidence:${state.taskId}:${id}`,
    exitCode
  };
}

function verificationInput(state) {
  return {
    criteria: [observation(state, "criterion-1")],
    mandatoryChecks: [observation(state, "typecheck"), observation(state, "test")]
  };
}

function intentInput(state, delivery = "local") {
  return {
    delivery,
    intentEvidenceRef: `intent:${delivery}:${state.revision}`,
    actions: delivery === "local"
      ? [{ id: "push", disposition: "not_selected", stateRevision: state.revision, observedFingerprint: `intent:push:local:${state.revision}`, evidenceRef: `intent:push:${state.revision}` }]
      : [{ id: "push", disposition: "selected", stateRevision: state.revision, observedFingerprint: `intent:push:external:${state.revision}`, evidenceRef: `intent:push:${state.revision}` }]
  };
}

async function enterBuild(mode, suffix) {
  const { createGateDecision, createGuardAttestation, createState, transition } = await api();
  let state = createState(input(mode, suffix));
  state = transition(state, "awaiting_mode_confirmation", {
    guardEvidence: attest(createGuardAttestation, state, "effective_constraints_valid")
  });
  if (mode === "quick") {
    return transition(state, "executing", {
      guardEvidence: attest(createGuardAttestation, state, "intake_complete", "mode_confirmed", "routing_ready", "quick_scope_bounded")
    });
  }
  state = transition(state, "discovering", {
    guardEvidence: attest(
      createGuardAttestation,
      state,
      "intake_complete",
      "mode_confirmed",
      "routing_ready",
      ...(mode === "critical" ? ["critical_workspace_ready"] : [])
    )
  });
  state = transition(state, "planning", {
    guardEvidence: attest(createGuardAttestation, state, "discovery_sufficient")
  });
  state = transition(state, "awaiting_approval", {
    contractDigest: `sha256:contract:${mode}:${suffix}`,
    guardEvidence: attest(createGuardAttestation, state, "discovery_sufficient", "contract_complete")
  });
  const decision = createGateDecision(state, { decision: "approved", evidenceRef: `approval:pre:${suffix}` });
  return transition(state, "executing", {
    gateDecision: decision,
    guardEvidence: attest(createGuardAttestation, state, "approval_current", "task_authorized")
  });
}

async function reachVerifying(mode, suffix) {
  const { createGuardAttestation, transition } = await api();
  let state = await enterBuild(mode, suffix);
  state = transition(state, "validating", {
    guardEvidence: attest(createGuardAttestation, state, "task_authorized")
  });
  if (mode === "quick") {
    return transition(state, "verifying", {
      guardEvidence: attest(createGuardAttestation, state, "validation_fresh", "review_satisfied")
    });
  }
  state = transition(state, "reviewing", {
    guardEvidence: attest(createGuardAttestation, state, "validation_fresh")
  });
  return transition(state, "verifying", {
    guardEvidence: attest(createGuardAttestation, state, "review_satisfied")
  });
}

async function finishLocal(state) {
  const { evaluateHandoffIntent, evaluateVerification, transition } = await api();
  return transition(state, "finished_local", {
    guardEvidence: [
      evaluateVerification(state, verificationInput(state)),
      evaluateHandoffIntent(state, intentInput(state))
    ]
  });
}

test("P0.4 Quick and Standard traverse complete happy paths to finished_local", async () => {
  const { migrateStateToV2 } = await api();
  for (const mode of ["quick", "standard"]) {
    const finished = await finishLocal(await reachVerifying(mode, "happy"));
    assert.equal(finished.status, "finished_local");
    assert.equal(finished.history.at(-1).guardEvidence.every((evidence) => evidence.evaluatorReceipt), true);
    assert.equal(migrateStateToV2(finished).state.status, "finished_local");
    const tampered = structuredClone(finished);
    tampered.history.at(-1).guardEvidence[0].evaluatorReceipt.inputDigest = "tampered";
    assert.throws(() => migrateStateToV2(tampered), /invalid digest/);
  }
});

test("P0.4 Critical requires worktree, both gates, and verified completion", async () => {
  const {
    createGateDecision,
    createGuardAttestation,
    evaluateCriticalCompletionApproval,
    evaluateHandoffIntent,
    evaluateVerification,
    transition
  } = await api();
  let state = await reachVerifying("critical", "happy");
  state = transition(state, "awaiting_approval", {
    guardEvidence: [evaluateVerification(state, verificationInput(state))]
  });
  assert.equal(state.pendingGate, "critical_completion");
  state = transition(state, "blocked", {
    resumeTo: "awaiting_approval",
    remainingActions: ["Wait for completion approver."]
  });
  state = transition(state, "awaiting_approval", {
    guardEvidence: attest(createGuardAttestation, state, "resume_reconciled", "contract_complete")
  });
  const decision = createGateDecision(state, { decision: "approved", evidenceRef: "approval:critical:happy" });
  state = transition(state, "finished_local", {
    gateDecision: decision,
    guardEvidence: [
      evaluateVerification(state, verificationInput(state)),
      evaluateCriticalCompletionApproval(state, decision),
      evaluateHandoffIntent(state, intentInput(state))
    ]
  });
  assert.equal(state.status, "finished_local");
});

test("P0.4 traverses validation and review resolution loops", async () => {
  const { createGuardAttestation, transition } = await api();
  let state = await enterBuild("standard", "loops");
  state = transition(state, "validating", { guardEvidence: attest(createGuardAttestation, state, "task_authorized") });
  state = transition(state, "resolving_build", { guardEvidence: attest(createGuardAttestation, state, "correction_budget_available") });
  state = transition(state, "validating", { guardEvidence: attest(createGuardAttestation, state, "correction_budget_available") });
  state = transition(state, "reviewing", { guardEvidence: attest(createGuardAttestation, state, "validation_fresh") });
  state = transition(state, "resolving_assure", { guardEvidence: attest(createGuardAttestation, state, "correction_budget_available") });
  state = transition(state, "reviewing", { guardEvidence: attest(createGuardAttestation, state, "correction_budget_available") });
  state = transition(state, "verifying", { guardEvidence: attest(createGuardAttestation, state, "review_satisfied") });
  assert.equal((await finishLocal(state)).status, "finished_local");
});

test("P0.4 traverses block/resume and external handoff without false success", async () => {
  const {
    createGuardAttestation,
    evaluateHandoffIntent,
    evaluateHandoffReconciliation,
    evaluateVerification,
    transition
  } = await api();
  let state = await enterBuild("standard", "external");
  state = transition(state, "blocked", { resumeTo: "executing", remainingActions: ["Restore write access."] });
  state = transition(state, "executing", {
    guardEvidence: attest(createGuardAttestation, state, "resume_reconciled", "approval_current", "task_authorized")
  });
  state = transition(state, "validating", { guardEvidence: attest(createGuardAttestation, state, "task_authorized") });
  state = transition(state, "reviewing", { guardEvidence: attest(createGuardAttestation, state, "validation_fresh") });
  state = transition(state, "verifying", { guardEvidence: attest(createGuardAttestation, state, "review_satisfied") });

  let intent = evaluateHandoffIntent(state, intentInput(state, "external"));
  state = transition(state, "handing_off", {
    guardEvidence: [evaluateVerification(state, verificationInput(state)), intent]
  });
  intent = evaluateHandoffIntent(state, intentInput(state, "external"));
  const pending = evaluateHandoffReconciliation(state, intent, {
    observations: [{
      actionId: "push",
      status: "pending",
      stateRevision: state.revision,
      observedFingerprint: `remote:missing:${state.revision}`,
      evidenceRef: `remote:check:${state.revision}`
    }]
  });
  state = transition(state, "ready_for_handoff", {
    remainingActions: ["Push branch."],
    guardEvidence: [intent, pending]
  });
  assert.equal(state.status, "ready_for_handoff");

  intent = evaluateHandoffIntent(state, intentInput(state, "external"));
  const actionable = evaluateHandoffReconciliation(state, intent, {
    observations: [{
      actionId: "push",
      status: "pending",
      stateRevision: state.revision,
      observedFingerprint: `remote:still-missing:${state.revision}`,
      evidenceRef: `remote:check:${state.revision}`
    }]
  });
  state = transition(state, "handing_off", { guardEvidence: [intent, actionable] });
  intent = evaluateHandoffIntent(state, intentInput(state, "external"));
  const complete = evaluateHandoffReconciliation(state, intent, {
    observations: [{
      actionId: "push",
      status: "completed",
      stateRevision: state.revision,
      observedFingerprint: `remote:present:${state.revision}`,
      evidenceRef: `remote:check:${state.revision}`,
      receiptRef: "provider:push:receipt-1"
    }]
  });
  state = transition(state, "finished", { guardEvidence: [intent, complete] });
  assert.equal(state.status, "finished");
});

test("P0.4 trusted guards reject raw attestations, failed checks, stale observations, and target mismatch", async () => {
  const {
    createGuardAttestation,
    evaluateHandoffIntent,
    evaluateVerification,
    transition
  } = await api();
  const state = await reachVerifying("quick", "adversarial");
  assert.throws(() => createGuardAttestation(state, "verification_complete", {
    observedFingerprint: "fake",
    evidenceRefs: ["fake"],
    provenance: "deterministic-check"
  }), /requires trusted evaluator/);
  const failed = verificationInput(state);
  failed.criteria[0].exitCode = 1;
  assert.throws(() => evaluateVerification(state, failed), /did not pass/);
  const incomplete = verificationInput(state);
  incomplete.mandatoryChecks.pop();
  assert.throws(() => evaluateVerification(state, incomplete), /exactly cover required IDs/);
  const changedRequirements = {
    ...state,
    verificationRequirements: { ...state.verificationRequirements, criterionIds: ["different-criterion"] }
  };
  assert.throws(() => evaluateVerification(changedRequirements, verificationInput(changedRequirements)), /digest does not match/);
  const stale = verificationInput(state);
  stale.criteria[0].stateRevision -= 1;
  assert.throws(() => evaluateVerification(state, stale), /stale/);
  const external = evaluateHandoffIntent(state, intentInput(state, "external"));
  assert.throws(() => transition(state, "finished_local", {
    guardEvidence: [evaluateVerification(state, verificationInput(state)), external]
  }), /local-only handoff intent/);
  const detachedVerification = structuredClone(evaluateVerification(state, verificationInput(state)));
  assert.throws(() => transition(state, "finished_local", {
    guardEvidence: [detachedVerification, evaluateHandoffIntent(state, intentInput(state))]
  }), /current runtime/);
});
