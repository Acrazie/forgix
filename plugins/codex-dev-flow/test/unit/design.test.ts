import { expect, test } from "bun:test";
import {
  compileDesignState,
  createDesignState,
  designComplete,
  invalidateDesign,
  resolveProductBaseline,
  selectDesignFrontier,
  setActiveDesignQuestion,
} from "../../src/design.ts";

function design() {
  const nodes = ["objective", "users_value", "scope", "success", "risks_constraints"].map(
    (key) => ({ id: `product:${key}`, kind: "product" as const, dependsOn: [] }),
  );
  return compileDesignState({
    schemaVersion: 1,
    graph: { schemaVersion: 1, nodes },
    productBaseline: {
      schemaVersion: 1,
      dimensions: nodes.map((node) => ({
        key: node.id.slice("product:".length) as
          | "objective"
          | "users_value"
          | "scope"
          | "success"
          | "risks_constraints",
        status: "resolved" as const,
        value: node.id,
        provenance: { sourceRefs: ["request"], freshnessRefs: ["request:v1"] },
        dependencyNodeId: node.id,
      })),
    },
    glossaryDeltas: [],
    domainRules: [],
    decisions: [],
    invalidations: [],
    semanticComplete: true,
  });
}

function frontierQuestion(id: string, subjectId: string, prerequisiteIds: string[] = []) {
  return {
    question: {
      schemaVersion: 1 as const,
      id,
      decisionKey: id,
      kind: "product" as const,
      owner: "intake" as const,
      subjectIds: [subjectId],
      prerequisiteIds,
      prompt: `Resolve ${subjectId}?`,
      mode: "elicitation" as const,
      priorRole: "intaking" as const,
      selectionReason: "Material product decision.",
      directConsequences: ["Changes Product Baseline."],
      freeFormAllowed: true as const,
      clarificationCount: 0,
    },
    scores: { impact: 3, irreversibility: 1, risk: 2, uncertainty: 4, branchesUnlocked: 3 },
    scoreReason: "Bounded materiality score.",
  };
}

test("Product Baseline requires five resolved or justified dimensions", () => {
  const state = design();
  expect(designComplete(state)).toBe(true);
  expect(() =>
    compileDesignState({
      ...state,
      productBaseline: {
        ...state.productBaseline,
        dimensions: state.productBaseline.dimensions.slice(1),
      },
    }),
  ).toThrow(/five dimensions/);
});

test("frontier filters blocked candidates and uses deterministic scores and ID tie-break", () => {
  const state = createDesignState();
  expect(
    selectDesignFrontier(state, [
      frontierQuestion("question:z", "product:scope"),
      frontierQuestion("question:a", "product:success"),
      frontierQuestion("question:blocked", "product:users_value", ["product:objective"]),
    ])?.id,
  ).toBe("question:a");
});

test("one atomic Product Baseline answer may resolve several explicit dimensions", () => {
  const state = resolveProductBaseline(createDesignState(), [
    {
      key: "objective",
      status: "resolved",
      value: "Remove hidden success status.",
      provenance: { sourceRefs: ["request"], freshnessRefs: ["request:v1"] },
    },
    {
      key: "users_value",
      status: "not_applicable",
      notApplicableReason: "Internal workflow state only.",
      provenance: { sourceRefs: ["request"], freshnessRefs: ["request:v1"] },
    },
  ]);
  expect(state.productBaseline.dimensions.filter((item) => item.status !== "missing")).toHaveLength(
    2,
  );
  expect(() =>
    resolveProductBaseline(state, [
      {
        key: "scope",
        status: "resolved",
        value: "",
        provenance: { sourceRefs: [], freshnessRefs: [] },
      },
    ]),
  ).toThrow(/without value/);
});

test("one authority-valid design question persists and invalidates selectively", () => {
  const state = design();
  const waiting = setActiveDesignQuestion(state, {
    schemaVersion: 1,
    id: "question:scope",
    decisionKey: "scope",
    kind: "product",
    owner: "intake",
    subjectIds: ["product:scope"],
    prerequisiteIds: [],
    prompt: "Which scope?",
    mode: "choice",
    options: [
      { id: "small", label: "Small", consequences: ["Less work"] },
      { id: "broad", label: "Broad", consequences: ["More work"] },
    ],
    recommendedOptionId: "small",
    recommendationBasis: "Lower risk",
    confidence: "high",
    priorRole: "intaking",
    selectionReason: "Scope unlocks contract",
    directConsequences: ["Changes scope."],
    freeFormAllowed: true,
    clarificationCount: 0,
  });
  expect(() => setActiveDesignQuestion(waiting, waiting.activeQuestion!)).toThrow(/Only one/);
  const invalidated = invalidateDesign(waiting, ["product:scope"], "User changed scope");
  expect(invalidated.activeQuestion).toBeUndefined();
  expect(invalidated.invalidations[0]?.invalidatedNodeIds).toEqual(["product:scope"]);
});
