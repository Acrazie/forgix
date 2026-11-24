import { execFileSync } from "node:child_process";
import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateStoreError } from "../../src/core/schema.ts";
import { createTaskStateStore } from "../../src/task/index.ts";
import { expectRejected } from "../support/expect-error.ts";
import { makeTaskState, seedLegacyTask } from "../support/helpers-v6.ts";

const makeWorkspace = () => mkdtemp(join(tmpdir(), "forgix-v6-store-"));

test("V6 state round-trips atomically through .forgix/tasks/<taskId>.json", async () => {
  const root = await makeWorkspace();
  try {
    const store = createTaskStateStore(root);
    const state = makeTaskState({ taskId: "roundtrip" });
    await store.save("roundtrip", state);
    expect(await store.load("roundtrip")).toEqual(state);
    const statePath = join(root, ".forgix", "tasks", "roundtrip.json");
    const parsed = JSON.parse(await readFile(statePath, "utf8")) as { schemaVersion: number };
    expect(parsed.schemaVersion).toBe(6);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("V1 through V5 load fails with explicit incompatible-schema code; no migration exists", async () => {
  const checks = [1, 2, 3, 4, 5].map(async (schemaVersion) => {
    const root = await makeWorkspace();
    try {
      const store = createTaskStateStore(root);
      const tasksDir = join(root, ".forgix", "tasks");
      const statePath = join(tasksDir, `old-${schemaVersion}.json`);
      await mkdir(tasksDir, { recursive: true });
      await writeFile(statePath, JSON.stringify({ schemaVersion, taskId: `old-${schemaVersion}` }));
      await expectRejected(
        () => store.load(`old-${schemaVersion}`),
        (error) => error instanceof StateStoreError && error.code === "state_schema_incompatible",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  await Promise.all(checks);
});

test("save rejects invalid, mismatched, or revision-conflicting state before publication", async () => {
  const root = await makeWorkspace();
  try {
    const store = createTaskStateStore(root);
    await expectRejected(
      () => store.save("bad", { schemaVersion: 2 }),
      (error) => error instanceof StateStoreError && error.code === "state_schema_incompatible",
    );
    await expectRejected(
      () => store.save("other", makeTaskState({ taskId: "actual" })),
      (error) => error instanceof StateStoreError && error.code === "state_task_mismatch",
    );

    const saved = await store.save("conflict-task", makeTaskState({ taskId: "conflict-task" }));
    await expectRejected(
      () =>
        store.save("conflict-task", saved, {
          expectedRevision: saved.revision + 1,
        }),
      (error) => error instanceof StateStoreError && error.code === "state_conflict",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failed atomic rename preserves prior valid state", async () => {
  const root = await makeWorkspace();
  try {
    const normal = createTaskStateStore(root);
    const original = makeTaskState({ taskId: "atomic" });
    await normal.save("atomic", original);
    const failing = createTaskStateStore(root, {
      fileSystem: {
        rename: async () => {
          throw Object.assign(new Error("fail"), { code: "EIO" });
        },
      },
      temporaryId: () => "failed",
    });
    const updated = makeTaskState({ taskId: "atomic", status: "intaking" });
    await expectRejected(
      () => failing.save("atomic", updated),
      (error) => error instanceof StateStoreError && error.code === "state_write_failed",
    );
    expect(await normal.load("atomic")).toEqual(original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("path traversal and symlinked task path are rejected", async () => {
  const root = await makeWorkspace();
  try {
    const store = createTaskStateStore(root);
    await Promise.all(
      ["../escape", "a/b", "..", "a\\b"].map((id) =>
        expectRejected(
          () => store.load(id),
          (error) => error instanceof StateStoreError && error.code === "state_path_invalid",
        ),
      ),
    );
    await mkdir(join(root, ".forgix", "tasks"), { recursive: true });
    await symlink(root, join(root, ".forgix", "tasks", "linked.json"));
    await expectRejected(
      () => store.save("linked", makeTaskState({ taskId: "linked" })),
      (error) => error instanceof StateStoreError && error.code === "state_path_invalid",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("store.gate views and applies approval atomically", async () => {
  const root = await makeWorkspace();
  execFileSync("git", ["init", "-q", root]);
  try {
    const store = createTaskStateStore(root);
    const awaiting = makeTaskState({
      taskId: "gate-store",
      status: "awaiting_approval",
      profile: "plan",
    });
    await seedLegacyTask(root, awaiting);

    const viewed = await store.gate("gate-store");
    expect(viewed.preflight.ready).toBe(true);
    expect(viewed.state.status).toBe("awaiting_approval");

    const approved = await store.gate("gate-store", {
      decision: "approve",
      expectedDigest: viewed.preflight.contractDigest!,
      decidedAt: "2026-08-02T00:00:00.000Z",
    });
    expect(approved.state.status).toBe("executing");
    expect(approved.state.planApproval?.actor).toBe("user");
    expect((await store.load("gate-store")).status).toBe("executing");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
