import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

function snapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    capturedAt: "2026-07-12T10:00:00.000Z",
    plan: "pro_20x",
    account: { planType: "pro" },
    quota: {
      windowDurationMins: 300,
      usedPercent: 20,
      pressure: "normal",
      source: "app-server"
    },
    models: [
      { id: "gpt-5.6-luna", supportedReasoningEfforts: ["low", "medium", "high", "max"] },
      { id: "gpt-5.6-terra", supportedReasoningEfforts: ["low", "medium", "high", "max"] },
      { id: "gpt-5.6-sol", supportedReasoningEfforts: ["low", "medium", "high", "max", "ultra"] }
    ],
    warnings: [],
    ...overrides
  };
}

test("quota pressure uses only the exact five-hour window", async () => {
  const { classifyQuotaPressure, selectFiveHourWindow } = await import(bundle);
  assert.equal(classifyQuotaPressure(49.99), "normal");
  assert.equal(classifyQuotaPressure(50), "warning");
  assert.equal(classifyQuotaPressure(80), "critical");
  assert.equal(selectFiveHourWindow({
    primary: { windowDurationMins: 10080, usedPercent: 99 },
    secondary: { windowDurationMins: 300, usedPercent: 37 }
  }).usedPercent, 37);
  assert.equal(selectFiveHourWindow({ primary: { windowDurationMins: 10080, usedPercent: 99 } }), undefined);
});

test("chooseRoute is deterministic and stays inside the GPT-5.6 allowlist", async () => {
  const { chooseRoute } = await import(bundle);
  const decision = chooseRoute(snapshot(), { stage: "discover", risk: "low", ambiguity: "low" });
  assert.deepEqual(decision, {
    stage: "discover",
    model: "gpt-5.6-terra",
    effort: "medium",
    quotaPressure: "normal",
    reason: "routine task on pro_20x plan",
    warnings: []
  });
  assert.equal(chooseRoute(snapshot(), { stage: "discover", risk: "low", ambiguity: "low" }).model, decision.model);
  assert.ok(["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"].includes(decision.model));
});

test("high-risk task can select Sol, but warning or critical quota never escalates", async () => {
  const { chooseRoute } = await import(bundle);
  assert.equal(chooseRoute(snapshot(), { stage: "review", risk: "high", ambiguity: "high" }).model, "gpt-5.6-sol");
  assert.equal(chooseRoute(snapshot({ quota: { windowDurationMins: 300, usedPercent: 60, pressure: "warning", source: "app-server" } }), {
    stage: "review", risk: "high", ambiguity: "high"
  }).model, "gpt-5.6-luna");
  assert.equal(chooseRoute(snapshot({ quota: { windowDurationMins: 300, usedPercent: 90, pressure: "critical", source: "app-server" } }), {
    stage: "review", risk: "high", ambiguity: "high"
  }).model, "gpt-5.6-luna");
});

test("max and ultra require critical task, normal quota, and catalog support", async () => {
  const { chooseRoute } = await import(bundle);
  const decision = chooseRoute(snapshot(), { stage: "verify", risk: "critical", ambiguity: "high", critical: true });
  assert.equal(decision.model, "gpt-5.6-sol");
  assert.equal(decision.effort, "ultra");
  const noUltra = chooseRoute(snapshot({ models: snapshot().models.map((model) =>
    model.id === "gpt-5.6-sol" ? { ...model, supportedReasoningEfforts: ["low", "medium", "high", "max"] } : model
  ) }), { stage: "verify", risk: "critical", ambiguity: "high", critical: true });
  assert.equal(noUltra.effort, "max");
  const warning = chooseRoute(snapshot({ quota: { windowDurationMins: 300, usedPercent: 60, pressure: "warning", source: "app-server" } }), {
    stage: "verify", risk: "critical", ambiguity: "high", critical: true
  });
  assert.notEqual(warning.effort, "max");
  assert.notEqual(warning.effort, "ultra");
});

test("unknown quota and unavailable catalog produce explicit warnings, never a foreign model", async () => {
  const { chooseRoute } = await import(bundle);
  const unknown = chooseRoute(snapshot({
    quota: { windowDurationMins: undefined, usedPercent: undefined, pressure: "unknown", source: "unknown" }
  }), { stage: "review", risk: "high", ambiguity: "high" });
  assert.equal(unknown.model, "gpt-5.6-luna");
  assert.ok(unknown.warnings.includes("quota_unknown"));
  const noConservativeModel = chooseRoute(snapshot({
    models: [{ id: "gpt-5.6-sol", supportedReasoningEfforts: ["high"] }],
    quota: { windowDurationMins: undefined, usedPercent: undefined, pressure: "unknown", source: "unknown" }
  }), { stage: "review", risk: "low", ambiguity: "low" });
  assert.equal(noConservativeModel.model, null);
  assert.ok(noConservativeModel.warnings.includes("allowed_model_unavailable"));
  const unavailable = chooseRoute(snapshot({ models: [] }), { stage: "review", risk: "high", ambiguity: "high" });
  assert.equal(unavailable.model, null);
  assert.deepEqual(unavailable.warnings, ["allowed_model_unavailable"]);
});
