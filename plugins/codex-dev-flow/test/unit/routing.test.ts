// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/routing.ts";
import { expect, test } from "bun:test";

const models = [
  { id: "gpt-5.6-luna", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] },
  { id: "gpt-5.6-terra", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] },
  { id: "gpt-5.6-sol", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] },
];

function snapshot(plan = "pro_20x", overrides = {}) {
  return {
    schemaVersion: 1,
    capturedAt: "2026-07-14T10:00:00.000Z",
    plan,
    account: { planType: plan },
    quota: { windowDurationMins: 300, usedPercent: 20, pressure: "normal", source: "app-server" },
    models,
    warnings: [],
    provenance: { plan: "account/read", quota: "account/rateLimits/read", models: "model/list" },
    ...overrides,
  };
}

const standardMatrix = {
  plus: {
    discover: ["gpt-5.6-terra", "medium"],
    plan: ["gpt-5.6-sol", "medium"],
    review: ["gpt-5.6-sol", "medium"],
    verify: ["gpt-5.6-luna", "medium"],
    debug: ["gpt-5.6-sol", "high"],
  },
  pro_5x: {
    discover: ["gpt-5.6-terra", "high"],
    plan: ["gpt-5.6-sol", "high"],
    review: ["gpt-5.6-sol", "high"],
    verify: ["gpt-5.6-luna", "medium"],
    debug: ["gpt-5.6-sol", "xhigh"],
  },
  pro_20x: {
    discover: ["gpt-5.6-sol", "medium"],
    plan: ["gpt-5.6-sol", "xhigh"],
    review: ["gpt-5.6-sol", "xhigh"],
    verify: ["gpt-5.6-terra", "medium"],
    debug: ["gpt-5.6-sol", "xhigh"],
  },
};

test("profile-neutral routing matches every skill and subscription cell", async () => {
  const { chooseRoute } = sourceApi;
  for (const [plan, routes] of Object.entries(standardMatrix)) {
    for (const [stage, [model, effort]] of Object.entries(routes)) {
      const decision = chooseRoute(snapshot(plan), { stage, risk: "medium", ambiguity: "medium" });
      expect(decision.model, `${plan}/${stage} model`).toBe(model);
      expect(decision.effort, `${plan}/${stage} effort`).toBe(effort);
    }
  }
});

test("risk or ambiguity raises effort; preparation profile never affects routing", async () => {
  const { chooseRoute } = sourceApi;
  expect(
    chooseRoute(snapshot("plus"), { stage: "plan", risk: "medium", ambiguity: "medium" }).effort,
  ).toBe("medium");
  expect(
    chooseRoute(snapshot("plus"), { stage: "plan", risk: "high", ambiguity: "medium" }).effort,
  ).toBe("high");
  expect(
    chooseRoute(snapshot("pro_20x"), { stage: "plan", risk: "critical", ambiguity: "medium" })
      .effort,
  ).toBe("xhigh");
});

test("initial quota pressure deterministically lowers the effective subscription row", async () => {
  const { chooseRoute } = sourceApi;
  const warning = snapshot("pro_20x", {
    quota: { windowDurationMins: 300, usedPercent: 60, pressure: "warning", source: "app-server" },
  });
  const critical = snapshot("pro_20x", {
    quota: { windowDurationMins: 300, usedPercent: 90, pressure: "critical", source: "app-server" },
  });
  const unknown = snapshot("pro_20x", {
    quota: { pressure: "unknown", source: "unknown" },
    warnings: ["quota_unknown"],
  });
  expect([
    chooseRoute(warning, { stage: "review", risk: "medium", ambiguity: "medium" }).model,
    chooseRoute(warning, { stage: "review", risk: "medium", ambiguity: "medium" }).effort,
  ]).toEqual(standardMatrix.pro_5x.review);
  expect([
    chooseRoute(critical, { stage: "review", risk: "medium", ambiguity: "medium" }).model,
    chooseRoute(critical, { stage: "review", risk: "medium", ambiguity: "medium" }).effort,
  ]).toEqual(standardMatrix.plus.review);
  expect([
    chooseRoute(unknown, { stage: "review", risk: "medium", ambiguity: "medium" }).model,
    chooseRoute(unknown, { stage: "review", risk: "medium", ambiguity: "medium" }).effort,
  ]).toEqual(standardMatrix.plus.review);
});

test("unknown plan uses Plus baseline with explicit provenance warning", async () => {
  const { chooseRoute } = sourceApi;
  const decision = chooseRoute(
    snapshot("unknown", {
      account: {},
      provenance: { plan: "unknown", quota: "account/rateLimits/read", models: "model/list" },
    }),
    {
      stage: "review",
      risk: "medium",
      ambiguity: "medium",
    },
  );
  expect([decision.model, decision.effort]).toEqual(standardMatrix.plus.review);
  expect(decision.warnings.includes("plan_unknown")).toBeTruthy();
});

test("exact model and effort are required with no fallback", async () => {
  const { chooseRoute } = sourceApi;
  const missingModel = chooseRoute(
    snapshot("pro_5x", { models: models.filter((model) => model.id !== "gpt-5.6-sol") }),
    {
      stage: "plan",
      risk: "medium",
      ambiguity: "medium",
    },
  );
  expect(missingModel.model).toBe(null);
  expect(missingModel.effort).toBe(null);
  expect(missingModel.warnings.includes("required_route_unavailable")).toBeTruthy();

  const missingEffort = chooseRoute(
    snapshot("pro_5x", {
      models: models.map((model) =>
        model.id === "gpt-5.6-sol"
          ? Object.assign({}, model, { supportedReasoningEfforts: ["low", "medium", "high"] })
          : model,
      ),
    }),
    { stage: "debug", risk: "medium", ambiguity: "medium" },
  );
  expect(missingEffort.model).toBe(null);
  expect(missingEffort.effort).toBe(null);
  expect(missingEffort.warnings.includes("required_route_unavailable")).toBeTruthy();
});

test("catalog normalization excludes max and ultra and accepts xhigh objects", async () => {
  const { buildRoutingSnapshot } = sourceApi;
  const built = buildRoutingSnapshot({
    rateLimits: { windowDurationMins: 300, usedPercent: 10 },
    models: [
      {
        id: "gpt-5.6-sol",
        supportedReasoningEfforts: ["low", "max", "ultra", { reasoningEffort: "xhigh" }],
      },
    ],
  });
  expect(built.snapshot.models[0].supportedReasoningEfforts).toEqual(["low", "xhigh"]);
});

test("quota pressure uses only the exact five-hour window", async () => {
  const { classifyQuotaPressure, selectFiveHourWindow } = sourceApi;
  expect(classifyQuotaPressure(49.99)).toBe("normal");
  expect(classifyQuotaPressure(50)).toBe("warning");
  expect(classifyQuotaPressure(80)).toBe("critical");
  expect(selectFiveHourWindow({ primary: { windowDurationMins: 10080, usedPercent: 99 } })).toBe(
    undefined,
  );
  expect(
    selectFiveHourWindow({ nested: { windowDurationMins: 300, usedPercent: 37 } }).usedPercent,
  ).toBe(37);
});
