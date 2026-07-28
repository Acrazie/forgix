import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const config = { schemaVersion: 1 };
const policy = { schemaVersion: 1, requirements: {}, prohibitions: {}, bounds: {}, locks: [] };

async function api() {
  return import(bundle);
}

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-benchmark-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function survey(comment) {
  return {
    satisfaction: 4,
    conformance: "partial",
    pluginValue: "useful",
    ...(comment ? { comment } : {})
  };
}

test("--benchmark is new-run-only and benchmark summary is deterministic", async () => {
  const { parseInvocation } = await api();
  assert.deepEqual(parseInvocation(["--benchmark", "standard", "implement", "intake"]), {
    command: "run",
    mode: "standard",
    objective: "implement intake",
    flags: { benchmark: true }
  });
  assert.deepEqual(parseInvocation(["benchmark", "summary"]), { command: "benchmark_summary" });
  assert.throws(() => parseInvocation(["resume", "--benchmark", "task-1"]));
  assert.throws(() => parseInvocation(["standard", "--benchmark", "task"]));
});

test("benchmark flag persists in task state and appears through status", async (t) => {
  const { createState, createTaskStateStore, runInvocation } = await api();
  const root = await workspace(t);
  const state = createState({
    taskId: "bench-status",
    mode: "quick",
    modeEvidenceRef: "request:mode",
    configSnapshot: config,
    policySnapshot: policy,
    benchmarkEnabled: true
  });
  await createTaskStateStore(root).save(state.taskId, state);
  const status = await runInvocation(["status", state.taskId], { workspaceRoot: root });
  assert.equal(status.data.benchmarkEnabled, true);
  assert.equal(status.data.macroPhase, "INTAKE");
  const resume = await runInvocation(["resume", state.taskId], {
    workspaceRoot: root,
    captureSnapshot: async () => ({
      available: true,
      snapshot: {
        schemaVersion: 1,
        capturedAt: "2026-07-28T12:00:00.000Z",
        plan: "plus",
        account: {},
        quota: { windowDurationMins: 300, usedPercent: 10, pressure: "normal", source: "app-server" },
        models: [
          { id: "gpt-5.6-luna", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] },
          { id: "gpt-5.6-terra", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] },
          { id: "gpt-5.6-sol", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] }
        ],
        warnings: [],
        provenance: { plan: "account/read", quota: "account/rateLimits/read", models: "model/list" }
      }
    })
  });
  assert.equal(resume.data.benchmarkEnabled, true);
  assert.equal(resume.data.taskId, state.taskId);
});

test("survey offer is terminal and opt-in; unanswered survey writes nothing", async (t) => {
  const {
    createBenchmarkStore,
    shouldOfferBenchmarkSurvey,
    tryWriteBenchmarkRecord
  } = await api();
  assert.equal(shouldOfferBenchmarkSurvey({ benchmarkEnabled: true, status: "finished" }), true);
  assert.equal(shouldOfferBenchmarkSurvey({ benchmarkEnabled: true, status: "cancelled" }), false);
  assert.equal(shouldOfferBenchmarkSurvey({ benchmarkEnabled: false, status: "finished" }), false);
  const root = await workspace(t);
  const store = createBenchmarkStore(root);
  assert.deepEqual(await tryWriteBenchmarkRecord(store, undefined), { written: false });
  await assert.rejects(readdir(join(root, ".codex", "benchmarks")), { code: "ENOENT" });
});

test("complete local record is redacted, bounded, atomic, and summarized", async (t) => {
  const {
    createBenchmarkRecord,
    createBenchmarkStore,
    runInvocation,
    tryWriteBenchmarkRecord
  } = await api();
  const root = await workspace(t);
  const record = createBenchmarkRecord({
    taskId: "bench-1",
    mode: "standard",
    outcome: "finished_local",
    survey: survey("token=local-secret"),
    approvedChangeArtifact: {
      plannedFiles: ["src/intake.ts"],
      validationRequired: true,
      handoffRequired: false
    },
    actual: {
      createdFiles: ["src/intake.ts", "src/extra.ts"],
      validationComplete: true,
      handoffComplete: false
    },
    recordedAt: "2026-07-28T12:00:00.000Z"
  });
  assert.equal(record.survey.comment.includes("local-secret"), false);
  assert.deepEqual(record.deviations, [{ code: "unplanned_new_file", surfaceRef: "src/extra.ts" }]);

  const store = createBenchmarkStore(root);
  const unsafe = { ...record, survey: { ...record.survey, comment: "token=must-not-persist" } };
  assert.deepEqual(await tryWriteBenchmarkRecord(store, unsafe), { written: true });
  assert.deepEqual(await readdir(join(root, ".codex", "benchmarks")), ["bench-1.json"]);
  assert.equal((await readFile(join(root, ".codex", "benchmarks", "bench-1.json"), "utf8")).includes("must-not-persist"), false);
  assert.deepEqual(await tryWriteBenchmarkRecord(store, {
    ...record,
    survey: { ...record.survey, prompt: "forbidden" }
  }), { written: false, error: "benchmark_write_failed" });
  const summary = await store.summary();
  assert.equal(summary.recordCount, 1);
  assert.equal(summary.satisfactionAverage, 4);
  assert.equal(summary.deviations.unplanned_new_file, 1);

  const cli = await runInvocation(["benchmark", "summary"], { workspaceRoot: root });
  assert.deepEqual(cli.data, summary);
});

test("benchmark write failure is non-fatal and authority follows mode", async () => {
  const { classifyBenchmarkDeviations, createBenchmarkRecord, tryWriteBenchmarkRecord } = await api();
  assert.deepEqual(classifyBenchmarkDeviations({}, {
    createdFiles: ["permitted.txt"],
    validationComplete: true,
    handoffComplete: true
  }), []);
  assert.throws(() => createBenchmarkRecord({
    taskId: "bad-authority",
    mode: "critical",
    outcome: "failed",
    survey: survey(),
    intakeBrief: {},
    actual: { createdFiles: [], validationComplete: false, handoffComplete: false }
  }), /approved Change Artifact/);

  const record = createBenchmarkRecord({
    taskId: "write-failure",
    mode: "quick",
    outcome: "failed",
    survey: survey(),
    intakeBrief: { forbidNewFiles: true },
    actual: { createdFiles: ["new.txt"], validationComplete: false, handoffComplete: false }
  });
  const result = await tryWriteBenchmarkRecord({ write: async () => { throw new Error("disk full"); } }, record);
  assert.deepEqual(result, { written: false, error: "benchmark_write_failed" });
  assert.deepEqual(record.deviations, [{ code: "forbidden_new_file", surfaceRef: "new.txt" }]);
});
