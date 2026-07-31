import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { taskInput } from "./helpers-v3.mjs";
const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const api = () => import(bundle);
const survey = { satisfaction: 5, conformance: "yes", pluginValue: "useful" };
const actual = { createdFiles: ["src/a.ts"], validationComplete: true, handoffComplete: true };
const authority = { plannedFiles: ["src/a.ts"], validationRequired: true, handoffRequired: true };

test("--benchmark remains new-run-only", async () => {
  const a = await api();
  assert.equal(a.parseInvocation(["--benchmark", "Add", "feature"]).flags.benchmark, true);
  assert.throws(() => a.parseInvocation(["resume", "task", "--benchmark"]), /exactly one task id/i);
});

test("benchmark uses canonical Shape contract for Quick and Plan", async () => {
  const a = await api();
  for (const preparationProfile of ["quick", "plan"]) {
    const record = a.createBenchmarkRecord({
      taskId: `bench-${preparationProfile}`,
      preparationProfile,
      outcome: "finished_local",
      survey,
      actual,
      canonicalChangeContract: authority,
      recordedAt: "2026-07-29T00:00:00.000Z",
    });
    assert.equal(record.preparationProfile, preparationProfile);
    assert.equal(record.authority, "canonical_change_contract");
    assert.deepEqual(record.deviations, []);
  }
});

test("benchmark records remain bounded, redacted, atomic, and summarizable", async () => {
  const a = await api();
  const root = await mkdtemp(join(tmpdir(), "benchmark-v3-"));
  const store = a.createBenchmarkStore(root);
  const record = a.createBenchmarkRecord({
    taskId: "bench-safe",
    preparationProfile: "quick",
    outcome: "finished",
    survey: { ...survey, comment: "token=secret-value user@example.com" },
    actual,
    canonicalChangeContract: authority,
  });
  await store.write(record);
  const persisted = await readFile(store.path("bench-safe"), "utf8");
  assert.equal(persisted.includes("secret-value"), false);
  assert.equal((await store.summary()).recordCount, 1);
});

test("benchmark opt-in persists in V3 status without mode", async () => {
  const a = await api();
  const root = await mkdtemp(join(tmpdir(), "benchmark-status-"));
  const state = a.createState({ ...taskInput("bench-status"), benchmarkEnabled: true });
  await a.createTaskStateStore(root).save("bench-status", state);
  const result = await a.runInvocation(["status", "bench-status"], { workspaceRoot: root });
  assert.equal(result.data.benchmarkEnabled, true);
  assert.equal(result.data.risk, "medium");
  assert.equal("mode" in result.data, false);
});
