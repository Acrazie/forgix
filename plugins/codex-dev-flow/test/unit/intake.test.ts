// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { expect, test } from "bun:test";
import { taskInput } from "../support/helpers-v5.ts";
const api = async () => sourceApi;

function brief(risk = "medium", objective = "Add export") {
  return {
    schemaVersion: 1,
    objective,
    successSignal: { description: "Export works", observationMethod: "Automated test" },
    risk,
    provenance: {
      sourceRefs: ["request"],
      capturedAt: "2026-07-29T00:00:00.000Z",
      freshnessRefs: ["request"],
    },
    technicalUnknowns: [],
  };
}
function question(key = "scope") {
  return {
    schemaVersion: 1,
    id: `question:${key}`,
    decisionKey: key,
    missingInformation: "Boundary missing",
    determiningImpact: "Changes acceptance",
    prompt: "Which boundary?",
    options: [
      { id: "narrow", label: "Narrow", impact: "Smaller scope" },
      { id: "broad", label: "Broad", impact: "Larger scope" },
    ],
    recommendedOptionId: "narrow",
    recommendationBasis: "Lower risk",
    recommendationConfidence: "high",
    freeFormAllowed: true,
    clarificationCount: 0,
  };
}

test("Intake owns objective, success, constraints, and risk—but never preparation profile", async () => {
  const a = await api();
  const state = a.createState({ ...taskInput("intake-zero"), intake: undefined });
  const result = a.applyInitialIntakeEvaluation(state, {
    brief: brief(),
    resolvedDecisions: [],
    contradictions: [],
    semanticComplete: true,
  });
  expect(result.completeness.complete).toBe(true);
  expect("mode" in result.state.intake.brief).toBe(false);
  expect("preparationProfile" in result.state.intake.brief).toBe(false);
  expect(a.attestIntakeComplete(result.state, "intake:zero").guard).toBe("intake_complete");
});

test("Decision Question persists, redacts secrets, and requires explicit answer", async () => {
  const a = await api();
  let state = a.createState({ ...taskInput("intake-question"), intake: undefined });
  state = a.applyInitialIntakeEvaluation(state, {
    brief: brief(),
    resolvedDecisions: [],
    contradictions: [],
    semanticComplete: false,
    nextQuestion: question(),
  }).state;
  expect(state.intake.activeQuestion.decisionKey).toBe("scope");
  expect(() =>
    a.applyIntakeResponse(state, "continue", {
      brief: brief(),
      resolvedDecisions: [],
      contradictions: [],
      semanticComplete: false,
    }),
  ).toThrow(/Explicit answer required/);
  const response = a.applyIntakeResponse(state, "narrow sk-secretvalue", {
    brief: brief(),
    resolvedDecisions: [
      {
        key: "scope",
        value: "narrow sk-secretvalue",
        source: "user",
        provenanceRef: "request",
        recommendationDisposition: "accepted",
        dependsOn: [],
      },
    ],
    contradictions: [],
    semanticComplete: true,
  });
  expect(response.completeness.complete).toBe(true);
  expect(JSON.stringify(response.state).includes("sk-secretvalue")).toBe(false);
});

test("risk change requires explicit user decision and invalidates routing", async () => {
  const a = await api();
  let state = a.createState({ ...taskInput("risk-change"), intake: undefined });
  state = a.applyInitialIntakeEvaluation(state, {
    brief: brief("medium"),
    resolvedDecisions: [],
    contradictions: [],
    semanticComplete: false,
    nextQuestion: question("risk"),
  }).state;
  expect(() =>
    a.applyIntakeResponse(state, "high", {
      brief: brief("high"),
      resolvedDecisions: [],
      contradictions: [],
      semanticComplete: true,
    }),
  ).toThrow(/risk change requires/);
  const response = a.applyIntakeResponse(state, "high", {
    brief: brief("high"),
    resolvedDecisions: [
      {
        key: "risk",
        value: "high",
        source: "user",
        provenanceRef: "request",
        recommendationDisposition: "modified",
        dependsOn: [],
      },
    ],
    contradictions: [],
    semanticComplete: true,
  });
  expect(response.state.risk).toBe("high");
  expect(response.state.routingDecisions).toEqual([]);
});

test("invalid semantic output gets one retry then typed block", async () => {
  const a = await api();
  let state = a.createState(taskInput("semantic-retry"));
  state = a.recordInvalidIntakeModelOutput(state).state;
  expect(state.intake.semanticRetryCount).toBe(1);
  state = a.recordInvalidIntakeModelOutput(state).state;
  expect(state.intake.blockedReason).toBe("semantic_output_invalid");
});

test("late product decision returns to INTAKE; technical unknown remains SHAPE", async () => {
  const a = await api();
  expect(a.routeLateUnknown("product")).toBe("INTAKE");
  expect(a.routeLateUnknown("technical")).toBe("SHAPE");
});
