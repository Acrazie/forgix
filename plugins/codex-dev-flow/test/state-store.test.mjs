import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { test } from "node:test";
import { taskInput } from "./helpers-v3.mjs";
const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const api = () => import(bundle);
const workspace = () => mkdtemp(join(tmpdir(), "dev-flow-v3-"));

test("V3 state round-trips atomically through YAML", async () => {
  const a = await api(); const root = await workspace(); const store = a.createTaskStateStore(root);
  const state = a.createState(taskInput("roundtrip"));
  await store.save("roundtrip", state);
  assert.deepEqual(await store.load("roundtrip"), state);
  assert.equal((await readFile(store.paths("roundtrip").statePath, "utf8")).includes("schemaVersion: 3"), true);
});

test("V1 and V2 load fail with explicit incompatible-schema code; no migration files exist", async () => {
  const a = await api();
  for (const schemaVersion of [1, 2]) {
    const root = await workspace(); const store = a.createTaskStateStore(root); const paths = store.paths(`old-${schemaVersion}`);
    await mkdir(paths.directory, { recursive: true }); await writeFile(paths.statePath, stringify({ schemaVersion, taskId: `old-${schemaVersion}` }));
    await assert.rejects(() => store.load(`old-${schemaVersion}`), (error) => error instanceof a.StateStoreError && error.code === "state_schema_incompatible");
    assert.equal("backupPath" in paths, false);
  }
  assert.equal(a.STATE_V1_BACKUP_FILENAME, undefined);
});

test("save rejects invalid or mismatched state before publication", async () => {
  const a = await api(); const root = await workspace(); const store = a.createTaskStateStore(root);
  await assert.rejects(() => store.save("bad", { schemaVersion: 2 }), (error) => error.code === "state_schema_incompatible");
  await assert.rejects(() => store.save("other", a.createState(taskInput("actual"))), (error) => error.code === "state_task_mismatch");
});

test("failed atomic rename preserves prior valid state", async () => {
  const a = await api(); const root = await workspace(); const normal = a.createTaskStateStore(root); const original = a.createState(taskInput("atomic")); await normal.save("atomic", original);
  const failing = a.createTaskStateStore(root, { fileSystem: { rename: async () => { throw Object.assign(new Error("fail"), { code: "EIO" }); } }, temporaryId: () => "failed" });
  await assert.rejects(() => failing.save("atomic", { ...original, benchmarkEnabled: true }), (error) => error.code === "state_write_failed");
  assert.deepEqual(await normal.load("atomic"), original);
});

test("path traversal and symlinked task directory are rejected", async () => {
  const a = await api(); const root = await workspace(); const store = a.createTaskStateStore(root);
  for (const id of ["../escape", "a/b", "..", "a\\b"]) assert.throws(() => store.paths(id), /one non-traversing|outside/);
  await mkdir(join(root, ".codex", "tasks"), { recursive: true }); await symlink(root, join(root, ".codex", "tasks", "linked"));
  await assert.rejects(() => store.save("linked", a.createState(taskInput("linked"))), (error) => error.code === "state_path_invalid");
});
