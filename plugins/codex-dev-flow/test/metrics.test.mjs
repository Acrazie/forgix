import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const baselineUrl = new URL("../docs/baselines/2026-07-18-p0-lifecycle.json", import.meta.url);
const protocolUrl = new URL("../docs/metrics-protocol.md", import.meta.url);

async function api() {
  return import(bundle);
}

test("metric events are allowlisted, redacted, and reject best-effort without workflow failure", async () => {
  const { createLifecycleMetricEvent, createMetricRunId, tryCreateLifecycleMetricEvent } = await api();
  const runId = createMetricRunId();
  const event = createLifecycleMetricEvent({
    runId,
    mode: "standard",
    phase: "BUILD",
    metric: "validation_runs",
    value: 1,
    measurement: "measured",
    source: "state_history"
  });
  assert.equal(event.runId, runId);
  assert.equal(JSON.stringify(event).includes("private-task-name"), false);
  const modelCall = createLifecycleMetricEvent({
    runId,
    mode: "standard",
    phase: "ASSURE",
    metric: "model_calls",
    value: 1,
    measurement: "measured",
    source: "orchestrator_counter",
    model: "gpt-5.6-terra",
    effort: "high",
    quotaPressure: "warning"
  });
  assert.deepEqual([modelCall.model, modelCall.effort, modelCall.quotaPressure], ["gpt-5.6-terra", "high", "warning"]);
  assert.throws(() => createLifecycleMetricEvent({
    runId,
    mode: "quick",
    phase: "ASSURE",
    metric: "model_calls",
    value: 1,
    measurement: "measured",
    source: "state_history",
    prompt: "secret"
  }), /Unknown metric event fields: prompt/);
  assert.deepEqual(tryCreateLifecycleMetricEvent({ prompt: "secret", rawOutput: "full output" }), {
    accepted: false,
    errorCode: "metric_rejected"
  });
  assert.equal(createLifecycleMetricEvent({
    runId,
    mode: "standard",
    phase: "INTAKE",
    metric: "intake_zero_question_paths",
    value: 1,
    measurement: "measured",
    source: "orchestrator_counter"
  }).value, 1);
});

test("token observations cannot confuse measured, estimated, and unavailable data", async () => {
  const { createLifecycleMetricEvent } = await api();
  assert.equal(createLifecycleMetricEvent({
    runId: "00000000-0000-4000-8000-000000000001",
    mode: "quick",
    phase: "ASSURE",
    metric: "input_tokens",
    value: 42,
    measurement: "measured",
    source: "native_token_api"
  }).measurement, "measured");
  assert.equal(createLifecycleMetricEvent({
    runId: "00000000-0000-4000-8000-000000000001",
    mode: "quick",
    phase: "ASSURE",
    metric: "input_tokens",
    value: 42,
    measurement: "estimated",
    source: "explicit_token_estimate"
  }).measurement, "estimated");
  assert.throws(() => createLifecycleMetricEvent({
    runId: "00000000-0000-4000-8000-000000000001",
    mode: "quick",
    phase: "ASSURE",
    metric: "input_tokens",
    value: 42,
    measurement: "measured",
    source: "explicit_token_estimate"
  }), /measurement\/source mismatch/);
});

test("trace summary validates canonical paths and reports unavailable telemetry honestly", async () => {
  const { summarizeLifecycleTrace } = await api();
  const summary = summarizeLifecycleTrace({
    runId: "standard-fixture",
    mode: "standard",
    source: "contract_fixture",
    falseSuccessDetections: 0,
    falseSuccessDetectionSource: "contract_tests",
    statuses: [
      "new", "awaiting_mode_confirmation", "discovering", "planning",
      "awaiting_approval", "executing", "validating", "reviewing",
      "verifying", "finished_local"
    ]
  });
  assert.equal(summary.transitions, 9);
  assert.equal(summary.gates, 1);
  assert.deepEqual(summary.phases, ["INTAKE", "SHAPE", "GATE", "BUILD", "ASSURE", "HANDOFF"]);
  assert.deepEqual(summary.tokenUsage, { availability: "unavailable" });
  assert.deepEqual(summary.latency, { availability: "unavailable" });
  assert.throws(() => summarizeLifecycleTrace({
    runId: "mislabeled-latency",
    mode: "standard",
    source: "contract_fixture",
    falseSuccessDetections: 0,
    falseSuccessDetectionSource: "contract_tests",
    statuses: ["new", "cancelled"],
    latency: { value: 12, measurement: "estimated", source: "wall_clock" }
  }), /mislabeled/);
  assert.throws(() => summarizeLifecycleTrace({
    runId: "00000000-0000-4000-8000-000000000002",
    mode: "quick",
    source: "runtime",
    falseSuccessDetections: 0,
    falseSuccessDetectionSource: "contract_tests",
    statuses: ["new", "cancelled"]
  }), /requires false-success source operator_audit/);
  assert.throws(() => summarizeLifecycleTrace({
    runId: "illegal",
    mode: "critical",
    source: "contract_fixture",
    falseSuccessDetections: 0,
    falseSuccessDetectionSource: "contract_tests",
    statuses: ["new", "awaiting_mode_confirmation", "executing"]
  }), /illegal for mode critical/);
});

test("P0 baseline is strict, readable, covers all modes, and stores no sensitive payload fields", async () => {
  const { validateBaselineReport } = await api();
  const report = JSON.parse(await readFile(baselineUrl, "utf8"));
  assert.deepEqual(validateBaselineReport(report), { valid: true, errors: [] });
  assert.deepEqual(report.samples.map((sample) => sample.mode), ["quick", "standard", "critical"]);
  assert.equal(report.samples.every((sample) => sample.tokenUsage.availability === "unavailable"), true);
  assert.equal(report.limitations.includes("contract_fixture_not_runtime"), true);
  const serialized = JSON.stringify(report);
  for (const forbidden of ["prompt", "sourceCode", "secret", "rawOutput", "private-task-name"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("measurement protocol requires baseline, budget, after, delta, and reliability gates for P1-P7", async () => {
  const protocol = await readFile(protocolUrl, "utf8");
  for (const field of ["baselineRef", "budget", "after", "delta", "falseSuccessMax: 0"]) {
    assert.equal(protocol.includes(field), true, `missing protocol field ${field}`);
  }
  assert.match(protocol, /P1.*P2.*P3.*P4.*P5.*P6.*P7/s);
});
