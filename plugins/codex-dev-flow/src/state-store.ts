import { randomUUID } from "node:crypto";
import { constants, lstatSync, realpathSync, type Stats } from "node:fs";
import * as nodeFs from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { parse, stringify } from "yaml";
import {
  StateMigrationError,
  migrateStateToV2,
  type MigrationOptions,
  type StateMigrationResult
} from "./state.js";
import type { TaskState } from "./types.js";

export const STATE_FILENAME = "state.yaml";
export const STATE_V1_BACKUP_FILENAME = "state.v1.yaml";

export type StateStoreErrorCode =
  | "state_path_invalid"
  | "state_not_found"
  | "state_yaml_invalid"
  | "state_task_mismatch"
  | "state_save_requires_v2"
  | "state_backup_conflict"
  | "state_read_failed"
  | "state_write_failed";

export class StateStoreError extends Error {
  constructor(readonly code: StateStoreErrorCode, message: string) {
    super(message);
    this.name = "StateStoreError";
  }
}

export interface StateStoreFileSystem {
  readFile(path: string): Promise<Buffer>;
  mkdir(path: string, options: { mode: number }): Promise<unknown>;
  writeFile(path: string, data: string | Buffer, options: { flag: "wx"; mode: number }): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  link(from: string, to: string): Promise<void>;
  lstat(path: string): Promise<Stats>;
  realpath(path: string): Promise<string>;
  unlink(path: string): Promise<void>;
}

export interface StateStoreOptions {
  fileSystem?: Partial<StateStoreFileSystem>;
  temporaryId?: () => string;
}

export interface TaskStatePaths {
  directory: string;
  statePath: string;
  backupPath: string;
}

export interface PersistedMigrationResult extends StateMigrationResult {
  persisted: boolean;
  backupPath?: string;
}

const DEFAULT_FILE_SYSTEM: StateStoreFileSystem = {
  readFile: async (path) => {
    const handle = await nodeFs.open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile()) throw Object.assign(new Error("State path is not a regular file."), { code: "EINVAL" });
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  },
  mkdir: (path, options) => nodeFs.mkdir(path, options),
  writeFile: (path, data, options) => nodeFs.writeFile(path, data, options),
  rename: (from, to) => nodeFs.rename(from, to),
  link: (from, to) => nodeFs.link(from, to),
  lstat: (path) => nodeFs.lstat(path),
  realpath: (path) => nodeFs.realpath(path),
  unlink: (path) => nodeFs.unlink(path)
};

export class TaskStateStore {
  readonly workspaceRoot: string;
  readonly tasksRoot: string;
  readonly #fileSystem: StateStoreFileSystem;
  readonly #temporaryId: () => string;

  constructor(workspaceRoot: string, options: StateStoreOptions = {}) {
    if (typeof workspaceRoot !== "string" || !workspaceRoot || workspaceRoot.includes("\0")) {
      throw new StateStoreError("state_path_invalid", "Workspace root is invalid.");
    }
    try {
      this.workspaceRoot = realpathSync(resolve(workspaceRoot));
      if (!lstatSync(this.workspaceRoot).isDirectory()) throw new Error("Workspace root is not a directory.");
    } catch {
      throw new StateStoreError("state_path_invalid", "Workspace root must be an existing accessible directory.");
    }
    this.tasksRoot = resolve(this.workspaceRoot, ".codex", "tasks");
    this.#fileSystem = { ...DEFAULT_FILE_SYSTEM, ...options.fileSystem };
    this.#temporaryId = options.temporaryId ?? randomUUID;
  }

  paths(taskId: string): TaskStatePaths {
    assertSafeTaskId(taskId);
    const directory = resolve(this.tasksRoot, taskId);
    const fromTasksRoot = relative(this.tasksRoot, directory);
    if (!fromTasksRoot || fromTasksRoot.startsWith(`..${sep}`) || fromTasksRoot === ".." || isAbsolute(fromTasksRoot)) {
      throw new StateStoreError("state_path_invalid", "Task ID resolves outside task state root.");
    }
    return {
      directory,
      statePath: join(directory, STATE_FILENAME),
      backupPath: join(directory, STATE_V1_BACKUP_FILENAME)
    };
  }

  async load(taskId: string, migrationOptions: MigrationOptions = {}): Promise<StateMigrationResult> {
    const paths = this.paths(taskId);
    await this.#assertExistingTaskDirectory(paths);
    await this.#assertRegularFile(paths.statePath, false);
    const source = await this.#readState(paths.statePath);
    const parsed = parseStateYaml(source);
    const result = migrateStateToV2(parsed, migrationOptions);
    assertMatchingTaskId(taskId, result.state);
    return result;
  }

  async save(taskId: string, state: unknown): Promise<void> {
    const paths = this.paths(taskId);
    const validated = validateSaveState(state);
    assertMatchingTaskId(taskId, validated);
    const serialized = serializeValidatedState(validated);
    await this.#ensureTaskDirectory(paths);
    await this.#assertRegularFile(paths.statePath, true);
    await this.#atomicWrite(paths, paths.statePath, serialized);
  }

  async migrateForResume(taskId: string, migrationOptions: MigrationOptions = {}): Promise<PersistedMigrationResult> {
    const paths = this.paths(taskId);
    await this.#assertExistingTaskDirectory(paths);
    await this.#assertRegularFile(paths.statePath, false);
    const source = await this.#readState(paths.statePath);
    const parsed = parseStateYaml(source);
    const result = migrateStateToV2(parsed, migrationOptions);
    assertMatchingTaskId(taskId, result.state);

    if (!result.migrationRequired) return { ...result, persisted: false };

    const serialized = serializeValidatedState(result.state);
    await this.#preserveV1Backup(paths, source);
    await this.#atomicWrite(paths, paths.statePath, serialized);
    return { ...result, persisted: true, backupPath: paths.backupPath };
  }

  async #readState(path: string): Promise<Buffer> {
    try {
      return await this.#fileSystem.readFile(path);
    } catch (error) {
      if (hasCode(error, "ENOENT")) throw new StateStoreError("state_not_found", "Task state file does not exist.");
      throw new StateStoreError("state_read_failed", "Task state file could not be read.");
    }
  }

  async #preserveV1Backup(paths: TaskStatePaths, source: Buffer): Promise<void> {
    await this.#assertRegularFile(paths.backupPath, true);
    const temporaryPath = createTemporaryPath(paths.directory, STATE_V1_BACKUP_FILENAME, this.#temporaryId());
    let ownsTemporary = true;
    let stage: "write" | "link" = "write";
    try {
      await this.#fileSystem.writeFile(temporaryPath, source, { flag: "wx", mode: 0o600 });
      stage = "link";
      await this.#fileSystem.link(temporaryPath, paths.backupPath);
    } catch (error) {
      if (stage === "write" && hasCode(error, "EEXIST")) ownsTemporary = false;
      if (stage === "link" && hasCode(error, "EEXIST")) {
        await this.#assertRegularFile(paths.backupPath, false);
        const existing = await this.#readBackup(paths.backupPath);
        if (!existing.equals(source)) {
          throw new StateStoreError("state_backup_conflict", "Existing V1 backup differs from current V1 state.");
        }
        return;
      }
      throw new StateStoreError("state_write_failed", "V1 backup could not be published safely.");
    } finally {
      if (ownsTemporary) await this.#unlinkBestEffort(temporaryPath);
    }
  }

  async #atomicWrite(paths: TaskStatePaths, destination: string, data: string | Buffer): Promise<void> {
    const temporaryPath = createTemporaryPath(paths.directory, STATE_FILENAME, this.#temporaryId());
    let ownsTemporary = true;
    let stage: "write" | "rename" = "write";
    try {
      await this.#fileSystem.writeFile(temporaryPath, data, { flag: "wx", mode: 0o600 });
      stage = "rename";
      await this.#fileSystem.rename(temporaryPath, destination);
      ownsTemporary = false;
    } catch (error) {
      if (stage === "write" && hasCode(error, "EEXIST")) ownsTemporary = false;
      throw new StateStoreError("state_write_failed", "Task state could not be written atomically.");
    } finally {
      if (ownsTemporary) await this.#unlinkBestEffort(temporaryPath);
    }
  }

  async #ensureTaskDirectory(paths: TaskStatePaths): Promise<void> {
    for (const path of [join(this.workspaceRoot, ".codex"), this.tasksRoot, paths.directory]) {
      try {
        await this.#fileSystem.mkdir(path, { mode: 0o700 });
      } catch (error) {
        if (!hasCode(error, "EEXIST")) {
          throw new StateStoreError("state_write_failed", "Task state directory could not be created.");
        }
      }
      await this.#assertDirectory(path, false);
    }
    await this.#assertCanonicalContainment(paths.directory);
  }

  async #assertExistingTaskDirectory(paths: TaskStatePaths): Promise<void> {
    for (const path of [join(this.workspaceRoot, ".codex"), this.tasksRoot, paths.directory]) {
      await this.#assertDirectory(path, false);
    }
    await this.#assertCanonicalContainment(paths.directory);
  }

  async #assertDirectory(path: string, optional: boolean): Promise<void> {
    try {
      const metadata = await this.#fileSystem.lstat(path);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new StateStoreError("state_path_invalid", "Task state path contains a symlink or non-directory component.");
      }
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      if (optional && hasCode(error, "ENOENT")) return;
      if (hasCode(error, "ENOENT")) throw new StateStoreError("state_not_found", "Task state directory does not exist.");
      throw new StateStoreError("state_read_failed", "Task state directory could not be inspected.");
    }
  }

  async #assertRegularFile(path: string, optional: boolean): Promise<void> {
    try {
      const metadata = await this.#fileSystem.lstat(path);
      if (metadata.isSymbolicLink() || !metadata.isFile()) {
        throw new StateStoreError("state_path_invalid", "Task state path is a symlink or non-regular file.");
      }
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      if (optional && hasCode(error, "ENOENT")) return;
      if (hasCode(error, "ENOENT")) throw new StateStoreError("state_not_found", "Task state file does not exist.");
      throw new StateStoreError("state_read_failed", "Task state path could not be inspected.");
    }
  }

  async #assertCanonicalContainment(taskDirectory: string): Promise<void> {
    // Node exposes no portable openat/renameat dirfd API. lstat + canonical containment
    // + O_NOFOLLOW protect normal/adversarial paths, but cannot eliminate a privileged
    // concurrent parent-directory swap between this check and path-based write/rename.
    try {
      const [canonicalTasksRoot, canonicalTaskDirectory] = await Promise.all([
        this.#fileSystem.realpath(this.tasksRoot),
        this.#fileSystem.realpath(taskDirectory)
      ]);
      const fromTasksRoot = relative(canonicalTasksRoot, canonicalTaskDirectory);
      if (!fromTasksRoot || fromTasksRoot === ".." || fromTasksRoot.startsWith(`..${sep}`) || isAbsolute(fromTasksRoot)) {
        throw new StateStoreError("state_path_invalid", "Task state directory resolves outside canonical task root.");
      }
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      throw new StateStoreError("state_path_invalid", "Task state directory could not be resolved safely.");
    }
  }

  async #readBackup(path: string): Promise<Buffer> {
    try {
      return await this.#fileSystem.readFile(path);
    } catch {
      throw new StateStoreError("state_read_failed", "Existing V1 backup could not be read.");
    }
  }

  async #unlinkBestEffort(path: string): Promise<void> {
    try {
      await this.#fileSystem.unlink(path);
    } catch {
      // Best effort only. Destination remains valid and temporary name is never reused.
    }
  }
}

export function createTaskStateStore(workspaceRoot: string, options: StateStoreOptions = {}): TaskStateStore {
  return new TaskStateStore(workspaceRoot, options);
}

function parseStateYaml(source: Buffer): unknown {
  try {
    return parse(source.toString("utf8"));
  } catch {
    throw new StateStoreError("state_yaml_invalid", "Task state file is not valid YAML.");
  }
}

function validateSaveState(value: unknown): TaskState {
  let result: StateMigrationResult;
  try {
    result = migrateStateToV2(value);
  } catch (error) {
    if (error instanceof StateMigrationError) throw error;
    throw new StateStoreError("state_save_requires_v2", "Only valid V2 task state can be saved.");
  }
  if (result.migrationRequired) {
    throw new StateStoreError("state_save_requires_v2", "V1 task state requires explicit resume migration.");
  }
  return result.state;
}

function serializeValidatedState(state: TaskState): string {
  const serialized = stringify(state);
  const reparsed = parseStateYaml(Buffer.from(serialized, "utf8"));
  const validated = migrateStateToV2(reparsed);
  if (validated.migrationRequired) {
    throw new StateStoreError("state_save_requires_v2", "Serialized task state is not V2.");
  }
  return serialized;
}

function assertMatchingTaskId(expected: string, state: TaskState): void {
  if (state.taskId !== expected) {
    throw new StateStoreError("state_task_mismatch", "Task state taskId does not match requested task ID.");
  }
}

function assertSafeTaskId(taskId: string): void {
  if (
    typeof taskId !== "string"
    || !taskId
    || taskId === "."
    || taskId === ".."
    || taskId.includes("/")
    || taskId.includes("\\")
    || taskId.includes("\0")
  ) throw new StateStoreError("state_path_invalid", "Task ID must be one non-traversing path segment.");
}

function createTemporaryPath(directory: string, basename: string, temporaryId: string): string {
  if (!temporaryId || temporaryId.includes("/") || temporaryId.includes("\\") || temporaryId.includes("\0")) {
    throw new StateStoreError("state_path_invalid", "Temporary state identifier must be one non-traversing path segment.");
  }
  return join(directory, `.${basename}.${temporaryId}.tmp`);
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
