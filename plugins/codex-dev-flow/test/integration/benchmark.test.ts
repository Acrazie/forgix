// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { taskInput } from "../support/helpers-v5.ts";
const api = async () => sourceApi;
const survey = { satisfaction: 5, conformance: "yes", pluginValue: "useful" };
const actual = { createdFiles: ["src/a.ts"], validationComplete: true };
const authority = { plannedFiles: ["src/a.ts"], validationRequired: true };

test("--benchmark remains new-run-only", async () => {
  const a = await api();
  expect(a.parseInvocation(["--benchmark", "Add", "feature"]).flags.benchmark).toBe(true);
  expect(() => a.parseInvocation(["resume", "task", "--benchmark"])).toThrow(
    /exactly one task id/i,
  );
});

test("benchmark uses canonical Shape contract for Quick and Plan", async () => {
  const a = await api();
  for (const preparationProfile of ["quick", "plan"]) {
    const record = a.createBenchmarkRecord({
      taskId: `bench-${preparationProfile}`,
      preparationProfile,
      outcome: "finished",
      survey,
      actual,
      canonicalChangeContract: authority,
      recordedAt: "2026-07-29T00:00:00.000Z",
    });
    expect(record.preparationProfile).toBe(preparationProfile);
    expect(record.authority).toBe("canonical_change_contract");
    expect(record.deviations).toEqual([]);
  }
});

test("benchmark records remain bounded, redacted, atomic, and summarizable", async () => {
  const a = await api();
  const root = await mkdtemp(join(tmpdir(), "benchmark-v5-"));
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
  expect(persisted.includes("secret-value")).toBe(false);
  expect((await store.summary()).recordCount).toBe(1);
});

test("benchmark opt-in persists in V5 status without mode", async () => {
  const a = await api();
  const root = await mkdtemp(join(tmpdir(), "benchmark-status-"));
  const state = a.createState({ ...taskInput("bench-status"), benchmarkEnabled: true });
  await a.createTaskStateStore(root).save("bench-status", state);
  const result = await a.runInvocation(["status", "bench-status"], { workspaceRoot: root });
  expect(result.data.benchmarkEnabled).toBe(true);
  expect(result.data.risk).toBe("medium");
  expect("mode" in result.data).toBe(false);
});
