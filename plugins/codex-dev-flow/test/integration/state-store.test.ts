// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { expect, test } from "bun:test";
import { taskInput } from "../support/helpers-v5.ts";
import { expectRejected } from "../support/expect-error.ts";
const api = async () => sourceApi;
const workspace = () => mkdtemp(join(tmpdir(), "dev-flow-v5-"));

test("V5 state round-trips atomically through YAML", async () => {
  const a = await api();
  const root = await workspace();
  const store = a.createTaskStateStore(root);
  const state = a.createState(taskInput("roundtrip"));
  await store.save("roundtrip", state);
  expect(await store.load("roundtrip")).toEqual(state);
  expect(
    (await readFile(store.paths("roundtrip").statePath, "utf8")).includes("schemaVersion: 5"),
  ).toBe(true);
});

test("V1 through V4 load fail with explicit incompatible-schema code; no migration exists", async () => {
  const a = await api();
  for (const schemaVersion of [1, 2, 3, 4]) {
    const root = await workspace();
    const store = a.createTaskStateStore(root);
    const paths = store.paths(`old-${schemaVersion}`);
    await mkdir(paths.directory, { recursive: true });
    await writeFile(paths.statePath, stringify({ schemaVersion, taskId: `old-${schemaVersion}` }));
    await expectRejected(
      () => store.load(`old-${schemaVersion}`),
      (error) => error instanceof a.StateStoreError && error.code === "state_schema_incompatible",
    );
    expect("backupPath" in paths).toBe(false);
  }
  expect(a.STATE_V1_BACKUP_FILENAME).toBe(undefined);
});

test("save rejects invalid or mismatched state before publication", async () => {
  const a = await api();
  const root = await workspace();
  const store = a.createTaskStateStore(root);
  await expectRejected(
    () => store.save("bad", { schemaVersion: 2 }),
    (error) =>
      error instanceof Error && "code" in error && error.code === "state_schema_incompatible",
  );
  await expectRejected(
    () => store.save("other", a.createState(taskInput("actual"))),
    (error) => error instanceof Error && "code" in error && error.code === "state_task_mismatch",
  );
});

test("failed atomic rename preserves prior valid state", async () => {
  const a = await api();
  const root = await workspace();
  const normal = a.createTaskStateStore(root);
  const original = a.createState(taskInput("atomic"));
  await normal.save("atomic", original);
  const failing = a.createTaskStateStore(root, {
    fileSystem: {
      rename: async () => {
        throw Object.assign(new Error("fail"), { code: "EIO" });
      },
    },
    temporaryId: () => "failed",
  });
  await expectRejected(
    () => failing.save("atomic", { ...original, benchmarkEnabled: true }),
    (error) => error instanceof Error && "code" in error && error.code === "state_write_failed",
  );
  expect(await normal.load("atomic")).toEqual(original);
});

test("path traversal and symlinked task directory are rejected", async () => {
  const a = await api();
  const root = await workspace();
  const store = a.createTaskStateStore(root);
  for (const id of ["../escape", "a/b", "..", "a\\b"])
    expect(() => store.paths(id)).toThrow(/one non-traversing|outside/);
  await mkdir(join(root, ".codex", "tasks"), { recursive: true });
  await symlink(root, join(root, ".codex", "tasks", "linked"));
  await expectRejected(
    () => store.save("linked", a.createState(taskInput("linked"))),
    (error) => error instanceof Error && "code" in error && error.code === "state_path_invalid",
  );
});
