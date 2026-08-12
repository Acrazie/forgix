// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/metrics.ts";
import { readFile } from "node:fs/promises";
import { expect, test } from "bun:test";
const api = async () => sourceApi;
const quickPath = [
  "new",
  "intaking",
  "discovering",
  "awaiting_profile_choice",
  "planning",
  "awaiting_approval",
  "executing",
  "verifying",
  "finished",
];
const planPath = [
  "new",
  "intaking",
  "discovering",
  "awaiting_profile_choice",
  "planning",
  "awaiting_approval",
  "executing",
  "reviewing",
  "verifying",
  "finished",
];

test("metric events use allowlisted profile/SHAPE facts and reject payloads", async () => {
  const a = await api();
  const runId = a.createMetricRunId();
  const event = a.createLifecycleMetricEvent({
    runId,
    preparationProfile: "quick",
    phase: "SHAPE",
    metric: "shape_discovery_sessions",
    value: 1,
    measurement: "measured",
    source: "orchestrator_counter",
  });
  expect(event.preparationProfile).toBe("quick");
  expect("objective" in event).toBe(false);
  expect(
    a.tryCreateLifecycleMetricEvent({ ...event, schemaVersion: undefined, objective: "secret" })
      .accepted,
  ).toBe(false);
});

test("model-call metrics retain strict allowlisted dimensions", async () => {
  const a = await api();
  const runId = a.createMetricRunId();
  expect(
    a.createLifecycleMetricEvent({
      runId,
      preparationProfile: "plan",
      phase: "SHAPE",
      metric: "model_calls",
      value: 1,
      measurement: "measured",
      source: "orchestrator_counter",
      model: "gpt-5.6-sol",
      effort: "high",
      quotaPressure: "normal",
    }).model,
  ).toBe("gpt-5.6-sol");
  expect(() =>
    a.createLifecycleMetricEvent({
      runId,
      preparationProfile: "plan",
      phase: "SHAPE",
      metric: "model_calls",
      value: 1,
      measurement: "measured",
      source: "orchestrator_counter",
      model: "unknown",
      effort: "high",
      quotaPressure: "normal",
    }),
  ).toThrow(/allowlisted/);
});

test("GATE metrics allow only numeric outcomes without contract content", async () => {
  const a = await api();
  const event = a.createLifecycleMetricEvent({
    runId: a.createMetricRunId(),
    preparationProfile: "quick",
    phase: "GATE",
    metric: "gate_preflight_passes",
    value: 1,
    measurement: "measured",
    source: "orchestrator_counter",
  });
  expect(event.metric).toBe("gate_preflight_passes");
  expect(
    a.tryCreateLifecycleMetricEvent({
      ...event,
      schemaVersion: undefined,
      contractDigest: "secret-digest",
      path: "src/private.ts",
    }).accepted,
  ).toBe(false);
});

test("trace summary validates profile-neutral canonical paths", async () => {
  const a = await api();
  const quick = a.summarizeLifecycleTrace({
    runId: "fixture-quick",
    preparationProfile: "quick",
    source: "contract_fixture",
    statuses: quickPath,
    falseSuccessDetections: 0,
    falseSuccessDetectionSource: "contract_tests",
  });
  const plan = a.summarizeLifecycleTrace({
    runId: "fixture-plan",
    preparationProfile: "plan",
    source: "contract_fixture",
    statuses: planPath,
    falseSuccessDetections: 0,
    falseSuccessDetectionSource: "contract_tests",
  });
  expect(quick.phases).toEqual(["INTAKE", "SHAPE", "GATE", "BUILD", "ASSURE"]);
  expect(plan.reviewRuns).toBe(1);
  expect(() =>
    a.summarizeLifecycleTrace({
      runId: "bad",
      preparationProfile: "quick",
      source: "contract_fixture",
      statuses: ["new", "executing"],
      falseSuccessDetections: 0,
      falseSuccessDetectionSource: "contract_tests",
    }),
  ).toThrow(/illegal/);
});

test("baseline covers Quick and Plan without content payloads", async () => {
  const a = await api();
  const traces = [
    {
      runId: "quick-1",
      preparationProfile: "quick",
      source: "contract_fixture",
      statuses: quickPath,
      falseSuccessDetections: 0,
      falseSuccessDetectionSource: "contract_tests",
    },
    {
      runId: "plan-1",
      preparationProfile: "plan",
      source: "contract_fixture",
      statuses: planPath,
      falseSuccessDetections: 0,
      falseSuccessDetectionSource: "contract_tests",
    },
    {
      runId: "plan-2",
      preparationProfile: "plan",
      source: "contract_fixture",
      statuses: planPath,
      falseSuccessDetections: 0,
      falseSuccessDetectionSource: "contract_tests",
    },
  ];
  const report = a.buildBaselineReport({
    baselineId: "shape-v5",
    capturedAt: "2026-07-29T00:00:00.000Z",
    contractVersion: "P0",
    source: "contract_fixture",
    limitations: [
      "contract_fixture_not_runtime",
      "token_telemetry_unavailable",
      "latency_telemetry_unavailable",
    ],
    traces,
  });
  expect(a.validateBaselineReport(report).valid).toBe(true);
  expect(JSON.stringify(report).includes("objective")).toBe(false);
  const committed = JSON.parse(
    await readFile(
      new URL("../../docs/baselines/2026-07-18-p0-lifecycle.json", import.meta.url),
      "utf8",
    ),
  );
  expect(a.validateBaselineReport(committed).valid).toBe(true);
  expect(committed.baselineId).toBe("p0-taskstate-v5-contract-fixture");
});
