// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { expect, test } from "bun:test";
import { taskInput } from "../support/helpers-v6.ts";
const api = async () => sourceApi;

function productInput(risk = "medium", objective = "Add export") {
  return {
    schemaVersion: 1,
    objective,
    successSignal: { description: "Export works", observationMethod: "Automated test" },
    affectedUsers: ["Operators"],
    scopeBoundaries: ["Export surface only"],
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
    productInput: productInput(),
    resolvedDecisions: [],
    contradictions: [],
    semanticComplete: true,
  });
  expect(result.completeness.complete).toBe(true);
  expect("mode" in result.state.design.productBaseline).toBe(false);
  expect("preparationProfile" in result.state.design.productBaseline).toBe(false);
  expect(a.attestIntakeComplete(result.state, "intake:zero").guard).toBe("intake_complete");
});

test("semantic confidence cannot bypass missing Product Baseline dimensions", async () => {
  const a = await api();
  const input = productInput();
  delete input.affectedUsers;
  delete input.scopeBoundaries;
  const result = a.applyInitialIntakeEvaluation(
    a.createState({ ...taskInput("intake-incomplete"), intake: undefined, design: undefined }),
    {
      productInput: input,
      resolvedDecisions: [],
      contradictions: [],
      semanticComplete: true,
    },
  );
  expect(result.completeness.complete).toBe(false);
  expect(result.completeness.missingDecisionKeys).toEqual(["users_value", "scope"]);
  expect(() => a.attestIntakeComplete(result.state, "intake:false-success")).toThrow(
    /INTAKE incomplete/,
  );
});

test("Active Design Question persists, redacts secrets, and requires explicit answer", async () => {
  const a = await api();
  let state = a.createState({ ...taskInput("intake-question"), intake: undefined });
  state = a.applyInitialIntakeEvaluation(state, {
    productInput: productInput(),
    resolvedDecisions: [],
    contradictions: [],
    semanticComplete: false,
    nextQuestion: question(),
  }).state;
  expect(state.intake.activeQuestionId).toBe(state.design.activeQuestion?.id);
  expect(state.design.activeQuestion?.decisionKey).toBe("scope");
  expect(() =>
    a.applyIntakeResponse(state, "continue", {
      productInput: productInput(),
      resolvedDecisions: [],
      contradictions: [],
      semanticComplete: false,
    }),
  ).toThrow(/Explicit answer required/);
  const response = a.applyIntakeResponse(state, "narrow sk-secretvalue", {
    productInput: productInput(),
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
    productInput: productInput("medium"),
    resolvedDecisions: [],
    contradictions: [],
    semanticComplete: false,
    nextQuestion: question("risk"),
  }).state;
  expect(() =>
    a.applyIntakeResponse(state, "high", {
      productInput: productInput("high"),
      resolvedDecisions: [],
      contradictions: [],
      semanticComplete: true,
    }),
  ).toThrow(/risk change requires/);
  const response = a.applyIntakeResponse(state, "high", {
    productInput: productInput("high"),
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

test("revising one product answer invalidates matching Product Baseline branch only", async () => {
  const a = await api();
  const state = a.createState(taskInput("intake-reopen"));
  const reopened = a.invalidateIntakeDecisions(state, ["scope"], "User revised scope");
  expect(
    reopened.design.productBaseline.dimensions.find((item) => item.key === "scope")?.status,
  ).toBe("unknown");
  expect(
    reopened.design.productBaseline.dimensions.find((item) => item.key === "objective")?.status,
  ).toBe("resolved");
});
