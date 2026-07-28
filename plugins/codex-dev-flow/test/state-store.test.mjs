import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { stringify } from "yaml";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const config = { schemaVersion: 1 };
const policy = { schemaVersion: 1, requirements: {}, prohibitions: {}, bounds: {}, locks: [] };

async function api() {
  return import(bundle);
}

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-state-store-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function input(taskId) {
  return { taskId, mode: "quick", modeEvidenceRef: `request:${taskId}:mode`, configSnapshot: config, policySnapshot: policy };
}

function legacy(taskId, overrides = {}) {
  return {
    schemaVersion: 1,
    taskId,
    status: "executing",
    configSnapshot: config,
    policySnapshot: policy,
    issues: [],
    reviewCycle: 0,
    remainingActions: [],
    history: [
      { from: "new", to: "awaiting_mode_confirmation" },
      { from: "awaiting_mode_confirmation", to: "executing" }
    ],
    ...overrides
  };
}

async function writeRawState(store, taskId, raw) {
  const paths = store.paths(taskId);
  await mkdir(dirname(paths.statePath), { recursive: true });
  await writeFile(paths.statePath, raw);
  return paths;
}

test("V2 state round-trips through YAML and leaves no temporary file", async (t) => {
  const { createState, createTaskStateStore } = await api();
  const root = await workspace(t);
  const store = createTaskStateStore(root);
  const state = createState(input("roundtrip"));

  await store.save("roundtrip", state);
  const loaded = await store.load("roundtrip");

  assert.deepEqual(loaded, { state, migrationRequired: false });
  assert.match(await readFile(store.paths("roundtrip").statePath, "utf8"), /^schemaVersion: 2$/m);
  assert.deepEqual((await readdir(store.paths("roundtrip").directory)).filter((name) => name.endsWith(".tmp")), []);
});

test("save rejects V1 and invalid V2 before any filesystem write", async (t) => {
  const { StateMigrationError, StateStoreError, createState, createTaskStateStore } = await api();
  const root = await workspace(t);
  const store = createTaskStateStore(root);

  await assert.rejects(store.save("legacy", legacy("legacy")), (error) => (
    error instanceof StateStoreError && error.code === "state_save_requires_v2"
  ));
  const invalid = { ...createState(input("invalid")), revision: 1 };
  await assert.rejects(store.save("invalid", invalid), (error) => (
    error instanceof StateMigrationError && error.code === "state_invalid"
  ));
  await assert.rejects(stat(join(root, ".codex")), { code: "ENOENT" });
});

test("read-only load validates and migrates V1 only in memory", async (t) => {
  const { StateMigrationError, createState, createTaskStateStore } = await api();
  const root = await workspace(t);
  const store = createTaskStateStore(root);
  const raw = `# keep exact V1 bytes\n${stringify(legacy("read-only"))}`;
  const paths = await writeRawState(store, "read-only", raw);

  const loaded = await store.load("read-only");

  assert.equal(loaded.migrationRequired, true);
  assert.equal(loaded.state.schemaVersion, 2);
  assert.equal(loaded.state.status, "executing");
  assert.equal(await readFile(paths.statePath, "utf8"), raw);
  await assert.rejects(stat(paths.backupPath), { code: "ENOENT" });

  const invalidV2 = stringify({ ...createState(input("invalid-load")), revision: 1 });
  const invalidPaths = await writeRawState(store, "invalid-load", invalidV2);
  await assert.rejects(store.load("invalid-load"), (error) => (
    error instanceof StateMigrationError && error.code === "state_invalid"
  ));
  assert.equal(await readFile(invalidPaths.statePath, "utf8"), invalidV2);
});

test("resume migration preserves byte-identical V1 backup then atomically installs valid V2", async (t) => {
  const { createTaskStateStore } = await api();
  const root = await workspace(t);
  const store = createTaskStateStore(root);
  const raw = Buffer.from(`# byte-preserving backup\n${stringify(legacy("resume"))}`, "utf8");
  const paths = await writeRawState(store, "resume", raw);

  const migrated = await store.migrateForResume("resume");

  assert.equal(migrated.persisted, true);
  assert.equal(migrated.backupPath, paths.backupPath);
  assert.deepEqual(await readFile(paths.backupPath), raw);
  assert.deepEqual(await store.load("resume"), { state: migrated.state, migrationRequired: false });
  assert.deepEqual((await readdir(paths.directory)).filter((name) => name.endsWith(".tmp")), []);

  const v2Bytes = await readFile(paths.statePath);
  const second = await store.migrateForResume("resume");
  assert.equal(second.persisted, false);
  assert.deepEqual(await readFile(paths.statePath), v2Bytes);
  assert.deepEqual(await readFile(paths.backupPath), raw);
});

test("ambiguous V1, future schema, and invalid YAML never modify state or create backup", async (t) => {
  const { StateMigrationError, StateStoreError, createTaskStateStore } = await api();
  const root = await workspace(t);
  const store = createTaskStateStore(root);
  const cases = [
    {
      taskId: "ambiguous",
      raw: stringify(legacy("ambiguous", {
        status: "discovering",
        history: [
          { from: "new", to: "awaiting_mode_confirmation" },
          { from: "awaiting_mode_confirmation", to: "discovering" }
        ]
      })),
      check: (error) => error instanceof StateMigrationError && error.code === "state_migration_ambiguous"
    },
    {
      taskId: "future",
      raw: "schemaVersion: 99\ntaskId: future\n",
      check: (error) => error instanceof StateMigrationError && error.code === "state_version_unsupported"
    },
    {
      taskId: "invalid-v1",
      raw: stringify(legacy("invalid-v1", { status: "blocked", remainingActions: [] })),
      check: (error) => error instanceof StateMigrationError && error.code === "state_invalid"
    },
    {
      taskId: "broken-yaml",
      raw: "schemaVersion: 1\ntaskId: [unterminated\nsecret: do-not-echo\n",
      check: (error) => error instanceof StateStoreError
        && error.code === "state_yaml_invalid"
        && !error.message.includes("do-not-echo")
    }
  ];

  for (const item of cases) {
    const paths = await writeRawState(store, item.taskId, item.raw);
    await assert.rejects(store.migrateForResume(item.taskId), item.check);
    assert.equal(await readFile(paths.statePath, "utf8"), item.raw);
    await assert.rejects(stat(paths.backupPath), { code: "ENOENT" });
  }
});

test("failed atomic rename preserves last valid state and cleans temporary file", async (t) => {
  const { StateStoreError, createState, createTaskStateStore } = await api();
  const root = await workspace(t);
  const originalStore = createTaskStateStore(root);
  const original = createState(input("atomic"));
  await originalStore.save("atomic", original);
  const paths = originalStore.paths("atomic");
  const originalBytes = await readFile(paths.statePath);

  const failingStore = createTaskStateStore(root, {
    temporaryId: () => "forced-failure",
    fileSystem: { rename: async () => { throw Object.assign(new Error("injected rename failure"), { code: "EIO" }); } }
  });
  const replacement = createState({ ...input("atomic"), configSnapshot: { schemaVersion: 2 } });
  await assert.rejects(failingStore.save("atomic", replacement), (error) => (
    error instanceof StateStoreError && error.code === "state_write_failed"
  ));

  assert.deepEqual(await readFile(paths.statePath), originalBytes);
  assert.deepEqual((await readdir(paths.directory)).filter((name) => name.endsWith(".tmp")), []);
});

test("partial temporary write failure is cleaned without touching destination", async (t) => {
  const { StateStoreError, createState, createTaskStateStore } = await api();
  const root = await workspace(t);
  const normalStore = createTaskStateStore(root);
  const original = createState(input("partial-write"));
  await normalStore.save("partial-write", original);
  const paths = normalStore.paths("partial-write");
  const originalBytes = await readFile(paths.statePath);
  const temporaryPath = join(paths.directory, ".state.yaml.partial.tmp");

  const failingStore = createTaskStateStore(root, {
    temporaryId: () => "partial",
    fileSystem: {
      writeFile: async (path) => {
        await writeFile(path, "partial");
        throw Object.assign(new Error("injected partial write"), { code: "EIO" });
      }
    }
  });
  await assert.rejects(failingStore.save("partial-write", original), (error) => (
    error instanceof StateStoreError && error.code === "state_write_failed"
  ));

  assert.deepEqual(await readFile(paths.statePath), originalBytes);
  await assert.rejects(stat(temporaryPath), { code: "ENOENT" });
});

test("temporary EEXIST keeps foreign write collision but cleans owned rename collision", async (t) => {
  const { StateStoreError, createState, createTaskStateStore } = await api();
  const root = await workspace(t);
  const normalStore = createTaskStateStore(root);
  const state = createState(input("eexist"));
  await normalStore.save("eexist", state);
  const paths = normalStore.paths("eexist");
  const originalBytes = await readFile(paths.statePath);
  const collisionPath = join(paths.directory, ".state.yaml.collision.tmp");
  await writeFile(collisionPath, "foreign-temp");

  const writeCollisionStore = createTaskStateStore(root, { temporaryId: () => "collision" });
  await assert.rejects(writeCollisionStore.save("eexist", state), (error) => (
    error instanceof StateStoreError && error.code === "state_write_failed"
  ));
  assert.equal(await readFile(collisionPath, "utf8"), "foreign-temp");

  await unlink(collisionPath);
  const renameCollisionStore = createTaskStateStore(root, {
    temporaryId: () => "collision",
    fileSystem: { rename: async () => { throw Object.assign(new Error("rename EEXIST"), { code: "EEXIST" }); } }
  });
  await assert.rejects(renameCollisionStore.save("eexist", state), (error) => (
    error instanceof StateStoreError && error.code === "state_write_failed"
  ));
  await assert.rejects(stat(collisionPath), { code: "ENOENT" });
  assert.deepEqual(await readFile(paths.statePath), originalBytes);
});

test("symlinked directory components are rejected before writes outside task root", async (t) => {
  const { StateStoreError, createState, createTaskStateStore } = await api();
  for (const component of [".codex", "tasks", "task"]) {
    const root = await workspace(t);
    const outside = await workspace(t);
    if (component === ".codex") {
      await symlink(outside, join(root, ".codex"), "dir");
    } else if (component === "tasks") {
      await mkdir(join(root, ".codex"));
      await symlink(outside, join(root, ".codex", "tasks"), "dir");
    } else {
      await mkdir(join(root, ".codex", "tasks"), { recursive: true });
      await symlink(outside, join(root, ".codex", "tasks", "symlink-task"), "dir");
    }
    const taskId = component === "task" ? "symlink-task" : "safe-task";
    const store = createTaskStateStore(root);
    for (const operation of [
      () => store.load(taskId),
      () => store.save(taskId, createState(input(taskId))),
      () => store.migrateForResume(taskId)
    ]) {
      await assert.rejects(operation(), (error) => error instanceof StateStoreError && error.code === "state_path_invalid");
    }
    assert.deepEqual(await readdir(outside), []);
  }
});

test("state and backup symlinks are rejected for load, save, and migration", async (t) => {
  const { StateStoreError, createState, createTaskStateStore } = await api();
  const root = await workspace(t);
  const outside = await workspace(t);
  const store = createTaskStateStore(root);
  const state = createState(input("file-link"));
  await store.save("file-link", state);
  const paths = store.paths("file-link");
  const outsideState = join(outside, "outside-state.yaml");
  await writeFile(outsideState, "outside-state");
  await unlink(paths.statePath);
  await symlink(outsideState, paths.statePath);

  for (const operation of [
    () => store.load("file-link"),
    () => store.save("file-link", state),
    () => store.migrateForResume("file-link")
  ]) {
    await assert.rejects(operation(), (error) => error instanceof StateStoreError && error.code === "state_path_invalid");
  }
  assert.equal(await readFile(outsideState, "utf8"), "outside-state");

  const raw = Buffer.from(stringify(legacy("backup-link")));
  const backupPaths = await writeRawState(store, "backup-link", raw);
  const outsideBackup = join(outside, "outside-backup.yaml");
  await writeFile(outsideBackup, "outside-backup");
  await symlink(outsideBackup, backupPaths.backupPath);
  await assert.rejects(store.migrateForResume("backup-link"), (error) => (
    error instanceof StateStoreError && error.code === "state_path_invalid"
  ));
  assert.deepEqual(await readFile(backupPaths.statePath), raw);
  assert.equal(await readFile(outsideBackup, "utf8"), "outside-backup");
});

test("existing identical V1 backup is reused while divergent backup blocks migration", async (t) => {
  const { StateStoreError, createTaskStateStore } = await api();
  const root = await workspace(t);
  const store = createTaskStateStore(root);

  const identicalRaw = Buffer.from(stringify(legacy("identical-backup")));
  const identicalPaths = await writeRawState(store, "identical-backup", identicalRaw);
  await writeFile(identicalPaths.backupPath, identicalRaw);
  const identicalResult = await store.migrateForResume("identical-backup");
  assert.equal(identicalResult.persisted, true);
  assert.deepEqual(await readFile(identicalPaths.backupPath), identicalRaw);

  const divergentRaw = Buffer.from(stringify(legacy("divergent-backup")));
  const divergentPaths = await writeRawState(store, "divergent-backup", divergentRaw);
  await writeFile(divergentPaths.backupPath, "older-different-v1");
  await assert.rejects(store.migrateForResume("divergent-backup"), (error) => (
    error instanceof StateStoreError && error.code === "state_backup_conflict"
  ));
  assert.deepEqual(await readFile(divergentPaths.statePath), divergentRaw);
  assert.equal(await readFile(divergentPaths.backupPath, "utf8"), "older-different-v1");
});

test("racing divergent backup cannot be overwritten by publication", async (t) => {
  const { StateStoreError, createTaskStateStore } = await api();
  const root = await workspace(t);
  const raw = Buffer.from(stringify(legacy("backup-race")));
  const normalStore = createTaskStateStore(root);
  const paths = await writeRawState(normalStore, "backup-race", raw);
  const racingStore = createTaskStateStore(root, {
    temporaryId: () => "backup-race",
    fileSystem: {
      link: async (from, to) => {
        await writeFile(to, "racing-divergent-backup", { flag: "wx" });
        await link(from, to);
      }
    }
  });

  await assert.rejects(racingStore.migrateForResume("backup-race"), (error) => (
    error instanceof StateStoreError && error.code === "state_backup_conflict"
  ));
  assert.deepEqual(await readFile(paths.statePath), raw);
  assert.equal(await readFile(paths.backupPath, "utf8"), "racing-divergent-backup");
  assert.deepEqual((await readdir(paths.directory)).filter((name) => name.endsWith(".tmp")), []);
});

test("migration retries safely after state rename failure with backup already published", async (t) => {
  const { StateStoreError, createTaskStateStore } = await api();
  const root = await workspace(t);
  const raw = Buffer.from(stringify(legacy("migration-retry")));
  const normalStore = createTaskStateStore(root);
  const paths = await writeRawState(normalStore, "migration-retry", raw);
  const failingStore = createTaskStateStore(root, {
    fileSystem: { rename: async () => { throw Object.assign(new Error("state rename failure"), { code: "EIO" }); } }
  });

  await assert.rejects(failingStore.migrateForResume("migration-retry"), (error) => (
    error instanceof StateStoreError && error.code === "state_write_failed"
  ));
  assert.deepEqual(await readFile(paths.statePath), raw);
  assert.deepEqual(await readFile(paths.backupPath), raw);

  const retried = await normalStore.migrateForResume("migration-retry");
  assert.equal(retried.persisted, true);
  assert.equal((await normalStore.load("migration-retry")).migrationRequired, false);
  assert.deepEqual(await readFile(paths.backupPath), raw);
});

test("task IDs that can traverse paths are rejected", async (t) => {
  const { StateStoreError, createTaskStateStore } = await api();
  const store = createTaskStateStore(await workspace(t));
  for (const taskId of ["../escape", "nested/task", "..\\escape", ".", "..", ""]) {
    assert.throws(() => store.paths(taskId), (error) => error instanceof StateStoreError && error.code === "state_path_invalid");
  }
});
