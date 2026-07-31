import assert from "node:assert/strict";
import { test } from "node:test";
const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const api = () => import(bundle);
const quickPath = ["new", "intaking", "discovering", "awaiting_profile_choice", "planning", "awaiting_approval", "executing", "validating", "verifying", "finished_local"];
const planPath = ["new", "intaking", "discovering", "awaiting_profile_choice", "planning", "awaiting_approval", "executing", "validating", "reviewing", "verifying", "finished_local"];

test("metric events use allowlisted profile/SHAPE facts and reject payloads", async () => {
  const a = await api(); const runId = a.createMetricRunId();
  const event = a.createLifecycleMetricEvent({ runId, preparationProfile: "quick", phase: "SHAPE", metric: "shape_discovery_sessions", value: 1, measurement: "measured", source: "orchestrator_counter" });
  assert.equal(event.preparationProfile, "quick");
  assert.equal("objective" in event, false);
  assert.equal(a.tryCreateLifecycleMetricEvent({ ...event, schemaVersion: undefined, objective: "secret" }).accepted, false);
});

test("model-call metrics retain strict allowlisted dimensions", async () => {
  const a = await api(); const runId = a.createMetricRunId();
  assert.equal(a.createLifecycleMetricEvent({ runId, preparationProfile: "plan", phase: "SHAPE", metric: "model_calls", value: 1, measurement: "measured", source: "orchestrator_counter", model: "gpt-5.6-sol", effort: "high", quotaPressure: "normal" }).model, "gpt-5.6-sol");
  assert.throws(() => a.createLifecycleMetricEvent({ runId, preparationProfile: "plan", phase: "SHAPE", metric: "model_calls", value: 1, measurement: "measured", source: "orchestrator_counter", model: "unknown", effort: "high", quotaPressure: "normal" }), /allowlisted/);
});

test("trace summary validates profile-neutral canonical paths", async () => {
  const a = await api();
  const quick = a.summarizeLifecycleTrace({ runId: "fixture-quick", preparationProfile: "quick", source: "contract_fixture", statuses: quickPath, falseSuccessDetections: 0, falseSuccessDetectionSource: "contract_tests" });
  const plan = a.summarizeLifecycleTrace({ runId: "fixture-plan", preparationProfile: "plan", source: "contract_fixture", statuses: planPath, falseSuccessDetections: 0, falseSuccessDetectionSource: "contract_tests" });
  assert.deepEqual(quick.phases, ["INTAKE", "SHAPE", "GATE", "BUILD", "ASSURE", "HANDOFF"]);
  assert.equal(plan.reviewRuns, 1);
  assert.throws(() => a.summarizeLifecycleTrace({ runId: "bad", preparationProfile: "quick", source: "contract_fixture", statuses: ["new", "executing"], falseSuccessDetections: 0, falseSuccessDetectionSource: "contract_tests" }), /illegal/);
});

test("baseline covers Quick and Plan without content payloads", async () => {
  const a = await api(); const traces = [
    { runId: "quick-1", preparationProfile: "quick", source: "contract_fixture", statuses: quickPath, falseSuccessDetections: 0, falseSuccessDetectionSource: "contract_tests" },
    { runId: "plan-1", preparationProfile: "plan", source: "contract_fixture", statuses: planPath, falseSuccessDetections: 0, falseSuccessDetectionSource: "contract_tests" },
    { runId: "plan-2", preparationProfile: "plan", source: "contract_fixture", statuses: planPath, falseSuccessDetections: 0, falseSuccessDetectionSource: "contract_tests" }
  ];
  const report = a.buildBaselineReport({ baselineId: "shape-v3", capturedAt: "2026-07-29T00:00:00.000Z", contractVersion: "P0", source: "contract_fixture", limitations: ["contract_fixture_not_runtime", "token_telemetry_unavailable", "latency_telemetry_unavailable"], traces });
  assert.equal(a.validateBaselineReport(report).valid, true);
  assert.equal(JSON.stringify(report).includes("objective"), false);
});
