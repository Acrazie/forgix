import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const config = { schemaVersion: 1 };
const policy = { schemaVersion: 1, requirements: {}, prohibitions: {}, bounds: {}, locks: [] };

async function api() {
  return import(bundle);
}

function question(key, clarificationCount = 0) {
  return {
    schemaVersion: 1,
    id: `question-${key}`,
    decisionKey: key,
    missingInformation: `Missing ${key}`,
    determiningImpact: `${key} changes output behavior`,
    prompt: `Choose ${key}`,
    options: [
      { id: "recommended", label: "Recommended", impact: "Smallest safe scope" },
      { id: "alternative", label: "Alternative", impact: "Broader scope" }
    ],
    recommendedOptionId: "recommended",
    recommendationBasis: "Repository convention",
    recommendationConfidence: "medium",
    freeFormAllowed: true,
    clarificationCount
  };
}

function brief(mode = "standard") {
  return {
    schemaVersion: 1,
    objective: "Implement adaptive intake",
    successSignal: {
      description: "Intake runtime rejects unanswered decisions",
      observationMethod: "Automated test passes"
    },
    mode,
    risk: mode === "critical" ? "critical" : "medium",
    provenance: {
      sourceRefs: ["request"],
      capturedAt: "2026-07-28T10:00:00.000Z",
      freshnessRefs: ["git:head"]
    },
    technicalUnknowns: [
      { key: "implementation-location", kind: "code", description: "Locate integration seam", owner: "shape" }
    ]
  };
}

function decision(key, value = "recommended") {
  return {
    key,
    value,
    source: "user",
    provenanceRef: "answer:current",
    recommendationDisposition: value === "recommended" ? "accepted" : "modified",
    dependsOn: []
  };
}

function evaluation(key, overrides = {}) {
  return {
    brief: brief(),
    resolvedDecisions: [decision(key)],
    contradictions: [],
    semanticComplete: true,
    ...overrides
  };
}

async function awaiting(intake) {
  const { createGuardAttestation, createState, transition } = await api();
  const state = createState({
    taskId: "intake-task",
    mode: "standard",
    modeEvidenceRef: "request:mode",
    configSnapshot: config,
    policySnapshot: policy,
    intake
  });
  return transition(state, "awaiting_mode_confirmation", {
    guardEvidence: [createGuardAttestation(state, "effective_constraints_valid", {
      observedFingerprint: "config:valid",
      evidenceRefs: ["config:effective"],
      provenance: "deterministic-check"
    })]
  });
}

test("zero-question complete request produces Intake Brief and intake_complete evidence", async () => {
  const {
    applyInitialIntakeEvaluation,
    attestIntakeComplete,
    createGuardAttestation,
    createIntakeState,
    transition
  } = await api();
  let state = await awaiting(createIntakeState({
    mode: "standard",
    risk: "medium",
    sourceRefs: ["request"],
    capturedAt: "2026-07-28T10:00:00.000Z"
  }));
  const result = applyInitialIntakeEvaluation(state, {
    brief: brief(),
    resolvedDecisions: [
      { ...decision("objective", "Implement adaptive intake"), provenanceRef: "request" },
      { ...decision("success_signal", "Automated test passes"), provenanceRef: "request" }
    ],
    contradictions: [],
    semanticComplete: true,
    questionsAvoided: 3
  }, "2026-07-28T10:00:01.000Z");
  state = result.state;
  assert.equal(result.completeness.complete, true);
  assert.equal(state.intake.metrics.zeroQuestionPath, true);
  assert.equal(state.intake.metrics.questionsAsked, 0);
  assert.equal(state.intake.metrics.questionsAvoided, 3);
  assert.equal("activeQuestion" in state.intake, false);

  state = transition(state, "discovering", {
    guardEvidence: [
      attestIntakeComplete(state, "intake:brief:1"),
      ...["mode_confirmed", "routing_ready"].map((guard) => createGuardAttestation(state, guard, {
        observedFingerprint: `observed:${guard}`,
        evidenceRefs: [`evidence:${guard}`],
        provenance: "deterministic-check"
      }))
    ]
  });
  assert.equal(state.status, "discovering");
});

test("intake_complete cannot be forged without trusted complete projection", async () => {
  const { createGuardAttestation, createState } = await api();
  const state = createState({
    taskId: "forged-intake",
    mode: "standard",
    modeEvidenceRef: "request:mode",
    configSnapshot: config,
    policySnapshot: policy
  });
  assert.throws(() => createGuardAttestation(state, "intake_complete", {
    observedFingerprint: "claimed",
    evidenceRefs: ["claimed"],
    provenance: "deterministic-check"
  }), /semantically and deterministically complete/);
});

test("active Decision Question is durable, user-authoritative, redacted, and not bypassable", async () => {
  const {
    applyIntakeResponse,
    createIntakeState,
    rejectPrematureAdvance,
    setDecisionQuestion
  } = await api();
  let state = await awaiting(createIntakeState({
    mode: "standard",
    risk: "medium",
    objective: "Implement adaptive intake",
    capturedAt: "2026-07-28T10:00:00.000Z"
  }));
  state = setDecisionQuestion(state, question("success_signal"), "2026-07-28T10:00:01.000Z");
  assert.equal(state.intake.activeQuestion.decisionKey, "success_signal");
  assert.equal(state.history.at(-1).type, "intake.question_recorded");
  assert.throws(() => setDecisionQuestion(state, question("scope")), /must be answered/);
  assert.throws(() => applyIntakeResponse(state, "décide pour moi", evaluation("success_signal")), /Explicit answer required/);
  assert.throws(() => applyIntakeResponse(state, "passe à l’étape suivante", evaluation("success_signal")), /Explicit answer required/);

  const rejected = rejectPrematureAdvance(state, "2026-07-28T10:00:02.000Z");
  assert.equal(rejected.history.at(-1).type, "advance.rejected");
  assert.equal(rejected.history.at(-1).refs[0].ref, "success_signal");

  const result = applyIntakeResponse(state, "recommended", evaluation("success_signal", {
    resolvedDecisions: [
      decision("success_signal", "token=super-secret-value"),
      decision("success_validator", "test runner")
    ]
  }), "2026-07-28T10:00:03.000Z");
  assert.equal(result.completeness.complete, true);
  assert.deepEqual(result.state.intake.answeredDecisionKeys, ["success_signal", "success_validator"]);
  assert.equal(result.state.intake.decisions[0].value.includes("super-secret-value"), false);
  assert.equal(result.state.intake.metrics.recommendationsModified, 2);
  assert.equal(result.state.intake.activeQuestion, undefined);
});

test("active question and compact brief survive durable crash/resume without transcript", async (t) => {
  const { createIntakeState, createTaskStateStore, setDecisionQuestion } = await api();
  const root = await mkdtemp(join(tmpdir(), "dev-flow-intake-resume-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let state = await awaiting(createIntakeState({
    mode: "standard",
    risk: "medium",
    objective: "Implement adaptive intake",
    capturedAt: "2026-07-28T10:00:00.000Z"
  }));
  state = setDecisionQuestion(state, question("success_signal"));
  const store = createTaskStateStore(root);
  await store.save(state.taskId, state);
  const loaded = (await store.load(state.taskId)).state;
  assert.deepEqual(loaded.intake.activeQuestion, state.intake.activeQuestion);
  assert.deepEqual(loaded.intake.brief, state.intake.brief);
  assert.equal("transcript" in loaded.intake, false);
});

test("clarification stays on same decision and blocks after two insufficient answers", async () => {
  const { applyIntakeResponse, createIntakeState, setDecisionQuestion } = await api();
  let state = await awaiting(createIntakeState({
    mode: "standard",
    risk: "medium",
    objective: "Implement adaptive intake",
    capturedAt: "2026-07-28T10:00:00.000Z"
  }));
  state = setDecisionQuestion(state, question("scope"));
  const clarify = (current) => applyIntakeResponse(current, "cela dépend", {
    brief: brief(),
    resolvedDecisions: [],
    contradictions: [],
    semanticComplete: false,
    nextQuestion: question("scope")
  }).state;
  state = clarify(state);
  assert.equal(state.intake.activeQuestion.clarificationCount, 1);
  state = clarify(state);
  assert.equal(state.intake.activeQuestion.clarificationCount, 2);
  assert.equal(state.intake.blockedReason, "answer_required");
});

test("five distinct decisions emit compact checkpoint without hard cap", async () => {
  const { applyIntakeResponse, createIntakeState, setDecisionQuestion } = await api();
  let state = await awaiting(createIntakeState({
    mode: "standard",
    risk: "medium",
    objective: "Implement adaptive intake",
    capturedAt: "2026-07-28T10:00:00.000Z"
  }));
  let last;
  for (let index = 1; index <= 5; index += 1) {
    const key = `decision_${index}`;
    state = setDecisionQuestion(state, question(key));
    last = applyIntakeResponse(state, "recommended", evaluation(key, { semanticComplete: index === 5 }));
    state = last.state;
  }
  assert.equal(state.intake.metrics.distinctQuestions, 5);
  assert.equal(last.checkpoint.answeredDecisionKeys.length, 5);
  assert.equal(state.history.at(-1).type, "intake.checkpoint");
  state = setDecisionQuestion(state, question("decision_6"));
  assert.equal(state.intake.metrics.distinctQuestions, 6);
});

test("Quick eligibility and late-unknown routing are deterministic", async () => {
  const { isQuickEligible, routeLateUnknown } = await api();
  assert.equal(isQuickEligible({
    boundedScope: true,
    nonDestructive: true,
    technicallyLocalizable: true,
    executableWithoutDesignDecision: true,
    verifiable: true
  }), true);
  assert.equal(isQuickEligible({
    boundedScope: true,
    nonDestructive: true,
    technicallyLocalizable: false,
    executableWithoutDesignDecision: true,
    verifiable: true
  }), false);
  assert.equal(routeLateUnknown("product"), "INTAKE");
  assert.equal(routeLateUnknown("technical"), "SHAPE");
});

test("invalid semantic output gets one retry then typed block", async () => {
  const {
    createIntakeState,
    recordInvalidIntakeModelOutput
  } = await api();
  let state = await awaiting(createIntakeState({
    mode: "standard",
    risk: "medium",
    objective: "Implement adaptive intake",
    capturedAt: "2026-07-28T10:00:00.000Z"
  }));
  let result = recordInvalidIntakeModelOutput(state);
  assert.equal(result.action, "retry_semantic");
  assert.equal(result.state.intake.semanticRetryCount, 1);
  result = recordInvalidIntakeModelOutput(result.state);
  assert.equal(result.action, "block");
  assert.equal(result.state.intake.blockedReason, "semantic_output_invalid");
});

test("mode changes only from explicit user decision before confirmation", async () => {
  const { applyIntakeResponse, createIntakeState, setDecisionQuestion } = await api();
  let state = await awaiting(createIntakeState({
    mode: "standard",
    risk: "medium",
    objective: "Implement adaptive intake",
    capturedAt: "2026-07-28T10:00:00.000Z"
  }));
  state = setDecisionQuestion(state, question("mode"));
  const quickBrief = brief("quick");
  quickBrief.risk = "low";
  state = applyIntakeResponse(state, "quick", {
    brief: quickBrief,
    resolvedDecisions: [{ ...decision("mode", "quick"), provenanceRef: "answer:mode" }],
    contradictions: [],
    semanticComplete: true
  }).state;
  assert.equal(state.mode, "quick");
  assert.equal(state.modeEvidenceRef, "answer:mode");
  assert.equal(state.intake.metrics.modeChanges, 1);
});

test("later product-context invalidation returns to INTAKE; technical unknown does not", async () => {
  const {
    applyInitialIntakeEvaluation,
    applyIntakeResponse,
    attestIntakeComplete,
    attestIntakeReopened,
    createGuardAttestation,
    createIntakeState,
    invalidateIntakeDecisions,
    setDecisionQuestion,
    transition
  } = await api();
  let state = await awaiting(createIntakeState({
    mode: "standard",
    risk: "medium",
    capturedAt: "2026-07-28T10:00:00.000Z"
  }));
  state = applyInitialIntakeEvaluation(state, {
    brief: brief(),
    resolvedDecisions: [{ ...decision("objective"), provenanceRef: "request" }],
    contradictions: [],
    semanticComplete: true
  }).state;
  state = transition(state, "discovering", {
    guardEvidence: [
      attestIntakeComplete(state, "intake:complete"),
      ...["mode_confirmed", "routing_ready"].map((guard) => createGuardAttestation(state, guard, {
        observedFingerprint: guard,
        evidenceRefs: [`evidence:${guard}`],
        provenance: "deterministic-check"
      }))
    ]
  });
  assert.throws(() => attestIntakeReopened(state, "late:technical"), /product-context invalidation/);
  state = invalidateIntakeDecisions(state, ["mode"], "Later evidence requires mode revision");
  state = transition(state, "awaiting_mode_confirmation", {
    guardEvidence: [attestIntakeReopened(state, "late:product")]
  });
  assert.equal(state.status, "awaiting_mode_confirmation");
  assert.equal(state.intake.deterministicComplete, false);
  state = setDecisionQuestion(state, question("mode"));
  const quickBrief = brief("quick");
  quickBrief.risk = "low";
  state = applyIntakeResponse(state, "quick", {
    brief: quickBrief,
    resolvedDecisions: [{ ...decision("mode", "quick"), provenanceRef: "answer:late-mode" }],
    contradictions: [],
    semanticComplete: true
  }).state;
  assert.equal(state.mode, "quick");
});
