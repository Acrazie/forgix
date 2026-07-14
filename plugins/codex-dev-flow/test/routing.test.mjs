import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

const models = [
  { id: "gpt-5.6-luna", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] },
  { id: "gpt-5.6-terra", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] },
  { id: "gpt-5.6-sol", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] }
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
    ...overrides
  };
}

const standardMatrix = {
  plus: {
    discover: ["gpt-5.6-terra", "medium"], plan: ["gpt-5.6-sol", "medium"],
    execute: ["gpt-5.6-terra", "high"], review: ["gpt-5.6-sol", "medium"],
    verify: ["gpt-5.6-luna", "medium"], debug: ["gpt-5.6-sol", "high"]
  },
  pro_5x: {
    discover: ["gpt-5.6-terra", "high"], plan: ["gpt-5.6-sol", "high"],
    execute: ["gpt-5.6-terra", "xhigh"], review: ["gpt-5.6-sol", "high"],
    verify: ["gpt-5.6-luna", "medium"], debug: ["gpt-5.6-sol", "xhigh"]
  },
  pro_20x: {
    discover: ["gpt-5.6-sol", "medium"], plan: ["gpt-5.6-sol", "xhigh"],
    execute: ["gpt-5.6-sol", "high"], review: ["gpt-5.6-sol", "xhigh"],
    verify: ["gpt-5.6-terra", "medium"], debug: ["gpt-5.6-sol", "xhigh"]
  }
};

test("standard routing matches every skill and subscription cell", async () => {
  const { chooseRoute } = await import(bundle);
  for (const [plan, routes] of Object.entries(standardMatrix)) {
    for (const [stage, [model, effort]] of Object.entries(routes)) {
      const decision = chooseRoute(snapshot(plan), { stage, risk: "medium", ambiguity: "medium", mode: "standard" });
      assert.equal(decision.model, model, `${plan}/${stage} model`);
      assert.equal(decision.effort, effort, `${plan}/${stage} effort`);
    }
  }
});

test("quick lowers and critical or high-risk work raises effort within low..xhigh", async () => {
  const { chooseRoute } = await import(bundle);
  assert.equal(chooseRoute(snapshot("plus"), { stage: "plan", risk: "medium", ambiguity: "medium", mode: "quick" }).effort, "low");
  assert.equal(chooseRoute(snapshot("plus"), { stage: "plan", risk: "medium", ambiguity: "medium", mode: "critical" }).effort, "high");
  assert.equal(chooseRoute(snapshot("pro_20x"), { stage: "plan", risk: "critical", ambiguity: "medium", mode: "standard" }).effort, "xhigh");
});

test("initial quota pressure deterministically lowers the effective subscription row", async () => {
  const { chooseRoute } = await import(bundle);
  const warning = snapshot("pro_20x", { quota: { windowDurationMins: 300, usedPercent: 60, pressure: "warning", source: "app-server" } });
  const critical = snapshot("pro_20x", { quota: { windowDurationMins: 300, usedPercent: 90, pressure: "critical", source: "app-server" } });
  const unknown = snapshot("pro_20x", { quota: { pressure: "unknown", source: "unknown" }, warnings: ["quota_unknown"] });
  assert.deepEqual([chooseRoute(warning, { stage: "execute", risk: "medium", ambiguity: "medium" }).model,
    chooseRoute(warning, { stage: "execute", risk: "medium", ambiguity: "medium" }).effort], standardMatrix.pro_5x.execute);
  assert.deepEqual([chooseRoute(critical, { stage: "execute", risk: "medium", ambiguity: "medium" }).model,
    chooseRoute(critical, { stage: "execute", risk: "medium", ambiguity: "medium" }).effort], standardMatrix.plus.execute);
  assert.deepEqual([chooseRoute(unknown, { stage: "execute", risk: "medium", ambiguity: "medium" }).model,
    chooseRoute(unknown, { stage: "execute", risk: "medium", ambiguity: "medium" }).effort], standardMatrix.plus.execute);
});

test("unknown plan uses Plus baseline with explicit provenance warning", async () => {
  const { chooseRoute } = await import(bundle);
  const decision = chooseRoute(snapshot("unknown", { account: {}, provenance: { plan: "unknown", quota: "account/rateLimits/read", models: "model/list" } }), {
    stage: "review", risk: "medium", ambiguity: "medium"
  });
  assert.deepEqual([decision.model, decision.effort], standardMatrix.plus.review);
  assert.ok(decision.warnings.includes("plan_unknown"));
});

test("exact model and effort are required with no fallback", async () => {
  const { chooseRoute } = await import(bundle);
  const missingModel = chooseRoute(snapshot("pro_5x", { models: models.filter((model) => model.id !== "gpt-5.6-sol") }), {
    stage: "plan", risk: "medium", ambiguity: "medium"
  });
  assert.equal(missingModel.model, null);
  assert.equal(missingModel.effort, null);
  assert.ok(missingModel.warnings.includes("required_route_unavailable"));

  const missingEffort = chooseRoute(snapshot("pro_5x", { models: models.map((model) =>
    model.id === "gpt-5.6-terra" ? { ...model, supportedReasoningEfforts: ["low", "medium", "high"] } : model
  ) }), { stage: "execute", risk: "medium", ambiguity: "medium" });
  assert.equal(missingEffort.model, null);
  assert.equal(missingEffort.effort, null);
  assert.ok(missingEffort.warnings.includes("required_route_unavailable"));
});

test("catalog normalization excludes max and ultra and accepts xhigh objects", async () => {
  const { buildRoutingSnapshot } = await import(bundle);
  const built = buildRoutingSnapshot({
    rateLimits: { windowDurationMins: 300, usedPercent: 10 },
    models: [{ id: "gpt-5.6-sol", supportedReasoningEfforts: ["low", "max", "ultra", { reasoningEffort: "xhigh" }] }]
  });
  assert.deepEqual(built.snapshot.models[0].supportedReasoningEfforts, ["low", "xhigh"]);
});

test("quota pressure uses only the exact five-hour window", async () => {
  const { classifyQuotaPressure, selectFiveHourWindow } = await import(bundle);
  assert.equal(classifyQuotaPressure(49.99), "normal");
  assert.equal(classifyQuotaPressure(50), "warning");
  assert.equal(classifyQuotaPressure(80), "critical");
  assert.equal(selectFiveHourWindow({ primary: { windowDurationMins: 10080, usedPercent: 99 } }), undefined);
  assert.equal(selectFiveHourWindow({ nested: { windowDurationMins: 300, usedPercent: 37 } }).usedPercent, 37);
});
