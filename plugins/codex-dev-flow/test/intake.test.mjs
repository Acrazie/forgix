import assert from "node:assert/strict";
import { test } from "node:test";
import { taskInput } from "./helpers-v3.mjs";
const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const api = () => import(bundle);

function brief(risk = "medium", objective = "Add export") {
  return { schemaVersion: 1, objective, successSignal: { description: "Export works", observationMethod: "Automated test" }, risk, provenance: { sourceRefs: ["request"], capturedAt: "2026-07-29T00:00:00.000Z", freshnessRefs: ["request"] }, technicalUnknowns: [] };
}
function question(key = "scope") {
  return { schemaVersion: 1, id: `question:${key}`, decisionKey: key, missingInformation: "Boundary missing", determiningImpact: "Changes acceptance", prompt: "Which boundary?", options: [{ id: "narrow", label: "Narrow", impact: "Smaller scope" }, { id: "broad", label: "Broad", impact: "Larger scope" }], recommendedOptionId: "narrow", recommendationBasis: "Lower risk", recommendationConfidence: "high", freeFormAllowed: true, clarificationCount: 0 };
}

test("Intake owns objective, success, constraints, and risk—but never preparation profile", async () => {
  const a = await api();
  const state = a.createState({ ...taskInput("intake-zero"), intake: undefined });
  const result = a.applyInitialIntakeEvaluation(state, { brief: brief(), resolvedDecisions: [], contradictions: [], semanticComplete: true });
  assert.equal(result.completeness.complete, true);
  assert.equal("mode" in result.state.intake.brief, false);
  assert.equal("preparationProfile" in result.state.intake.brief, false);
  assert.equal(a.attestIntakeComplete(result.state, "intake:zero").guard, "intake_complete");
});

test("Decision Question persists, redacts secrets, and requires explicit answer", async () => {
  const a = await api();
  let state = a.createState({ ...taskInput("intake-question"), intake: undefined });
  state = a.applyInitialIntakeEvaluation(state, { brief: brief(), resolvedDecisions: [], contradictions: [], semanticComplete: false, nextQuestion: question() }).state;
  assert.equal(state.intake.activeQuestion.decisionKey, "scope");
  assert.throws(() => a.applyIntakeResponse(state, "continue", { brief: brief(), resolvedDecisions: [], contradictions: [], semanticComplete: false }), /Explicit answer required/);
  const response = a.applyIntakeResponse(state, "narrow sk-secretvalue", { brief: brief(), resolvedDecisions: [{ key: "scope", value: "narrow sk-secretvalue", source: "user", provenanceRef: "request", recommendationDisposition: "accepted", dependsOn: [] }], contradictions: [], semanticComplete: true });
  assert.equal(response.completeness.complete, true);
  assert.equal(JSON.stringify(response.state).includes("sk-secretvalue"), false);
});

test("risk change requires explicit user decision and invalidates routing", async () => {
  const a = await api();
  let state = a.createState({ ...taskInput("risk-change"), intake: undefined });
  state = a.applyInitialIntakeEvaluation(state, { brief: brief("medium"), resolvedDecisions: [], contradictions: [], semanticComplete: false, nextQuestion: question("risk") }).state;
  assert.throws(() => a.applyIntakeResponse(state, "high", { brief: brief("high"), resolvedDecisions: [], contradictions: [], semanticComplete: true }), /risk change requires/);
  const response = a.applyIntakeResponse(state, "high", { brief: brief("high"), resolvedDecisions: [{ key: "risk", value: "high", source: "user", provenanceRef: "request", recommendationDisposition: "modified", dependsOn: [] }], contradictions: [], semanticComplete: true });
  assert.equal(response.state.risk, "high");
  assert.deepEqual(response.state.routingDecisions, []);
});

test("invalid semantic output gets one retry then typed block", async () => {
  const a = await api();
  let state = a.createState(taskInput("semantic-retry"));
  state = a.recordInvalidIntakeModelOutput(state).state;
  assert.equal(state.intake.semanticRetryCount, 1);
  state = a.recordInvalidIntakeModelOutput(state).state;
  assert.equal(state.intake.blockedReason, "semantic_output_invalid");
});

test("late product decision returns to INTAKE; technical unknown remains SHAPE", async () => {
  const a = await api();
  assert.equal(a.routeLateUnknown("product"), "INTAKE");
  assert.equal(a.routeLateUnknown("technical"), "SHAPE");
});
