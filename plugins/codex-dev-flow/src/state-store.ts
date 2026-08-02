import { randomUUID } from "node:crypto";
import { constants, lstatSync, realpathSync, type Stats } from "node:fs";
import * as nodeFs from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { parse, stringify } from "yaml";
import { StateValidationError, loadStateV4 } from "./state.js";
import type { TaskState } from "./types.js";

export const STATE_FILENAME = "state.yaml";
export type StateStoreErrorCode =
  | "state_path_invalid"
  | "state_not_found"
  | "state_yaml_invalid"
  | "state_task_mismatch"
  | "state_schema_incompatible"
  | "state_invalid"
  | "state_read_failed"
  | "state_write_failed";
export class StateStoreError extends Error {
  constructor(
    readonly code: StateStoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StateStoreError";
  }
}

export interface StateStoreFileSystem {
  readFile(path: string): Promise<Buffer>;
  mkdir(path: string, options: { mode: number }): Promise<unknown>;
  writeFile(
    path: string,
    data: string | Buffer,
    options: { flag: "wx"; mode: number },
  ): Promise<void>;
  rename(from: string, to: string): Promise<void>;
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
}

const DEFAULT_FILE_SYSTEM: StateStoreFileSystem = {
  readFile: async (path) => {
    const handle = await nodeFs.open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile()) throw Object.assign(new Error("not regular"), { code: "EINVAL" });
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  },
  mkdir: (path, options) => nodeFs.mkdir(path, options),
  writeFile: (path, data, options) => nodeFs.writeFile(path, data, options),
  rename: (from, to) => nodeFs.rename(from, to),
  lstat: (path) => nodeFs.lstat(path),
  realpath: (path) => nodeFs.realpath(path),
  unlink: (path) => nodeFs.unlink(path),
};

export class TaskStateStore {
  readonly workspaceRoot: string;
  readonly tasksRoot: string;
  readonly #fs: StateStoreFileSystem;
  readonly #temporaryId: () => string;
  constructor(workspaceRoot: string, options: StateStoreOptions = {}) {
    if (!workspaceRoot || workspaceRoot.includes("\u0000"))
      throw new StateStoreError("state_path_invalid", "Workspace root is invalid.");
    try {
      this.workspaceRoot = realpathSync(resolve(workspaceRoot));
      if (!lstatSync(this.workspaceRoot).isDirectory()) throw new Error();
    } catch {
      throw new StateStoreError("state_path_invalid", "Workspace root must be existing directory.");
    }
    this.tasksRoot = resolve(this.workspaceRoot, ".codex", "tasks");
    this.#fs = { ...DEFAULT_FILE_SYSTEM, ...options.fileSystem };
    this.#temporaryId = options.temporaryId ?? randomUUID;
  }
  paths(taskId: string): TaskStatePaths {
    assertSafeTaskId(taskId);
    const directory = resolve(this.tasksRoot, taskId);
    const rel = relative(this.tasksRoot, directory);
    if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel))
      throw new StateStoreError("state_path_invalid", "Task ID resolves outside task root.");
    return { directory, statePath: join(directory, STATE_FILENAME) };
  }
  async load(taskId: string): Promise<TaskState> {
    const paths = this.paths(taskId);
    await this.#assertExistingDirectory(paths.directory);
    await this.#assertRegularFile(paths.statePath, false);
    let source: Buffer;
    try {
      source = await this.#fs.readFile(paths.statePath);
    } catch (error) {
      if (hasCode(error, "ENOENT"))
        throw new StateStoreError("state_not_found", "Task state does not exist.");
      throw new StateStoreError("state_read_failed", "Task state could not be read.");
    }
    let parsed: unknown;
    try {
      parsed = parse(source.toString("utf8"));
    } catch {
      throw new StateStoreError("state_yaml_invalid", "Task state is not valid YAML.");
    }
    let state: TaskState;
    try {
      state = loadStateV4(parsed);
    } catch (error) {
      if (error instanceof StateValidationError)
        throw new StateStoreError(error.code, error.message);
      throw error;
    }
    if (state.taskId !== taskId)
      throw new StateStoreError(
        "state_task_mismatch",
        "Task state taskId differs from requested task.",
      );
    return state;
  }
  async save(taskId: string, value: unknown): Promise<void> {
    const paths = this.paths(taskId);
    let state: TaskState;
    try {
      state = loadStateV4(value);
    } catch (error) {
      if (error instanceof StateValidationError)
        throw new StateStoreError(error.code, error.message);
      throw error;
    }
    if (state.taskId !== taskId)
      throw new StateStoreError(
        "state_task_mismatch",
        "Task state taskId differs from requested task.",
      );
    const serialized = stringify(state);
    try {
      loadStateV4(parse(serialized));
    } catch {
      throw new StateStoreError("state_invalid", "Serialized V4 state failed validation.");
    }
    await this.#ensureDirectory(paths.directory);
    await this.#assertRegularFile(paths.statePath, true);
    await this.#atomicWrite(paths.statePath, paths.directory, serialized);
  }
  async #atomicWrite(destination: string, directory: string, data: string): Promise<void> {
    const id = this.#temporaryId();
    // oxlint-disable-next-line eslint/no-control-regex -- temporary path segments must reject NUL.
    if (!id || /[\\/\u0000]/.test(id))
      throw new StateStoreError("state_path_invalid", "Temporary identifier is invalid.");
    const temporary = join(directory, `.${STATE_FILENAME}.${id}.tmp`);
    let owns = true;
    try {
      await this.#fs.writeFile(temporary, data, { flag: "wx", mode: 0o600 });
      await this.#fs.rename(temporary, destination);
      owns = false;
    } catch (error) {
      if (hasCode(error, "EEXIST")) owns = false;
      throw new StateStoreError(
        "state_write_failed",
        "Task state could not be written atomically.",
      );
    } finally {
      if (owns) await this.#fs.unlink(temporary).catch(() => undefined);
    }
  }
  async #ensureDirectory(taskDirectory: string): Promise<void> {
    for (const path of [join(this.workspaceRoot, ".codex"), this.tasksRoot, taskDirectory]) {
      try {
        await this.#fs.mkdir(path, { mode: 0o700 });
      } catch (error) {
        if (!hasCode(error, "EEXIST"))
          throw new StateStoreError("state_write_failed", "Task directory could not be created.");
      }
      await this.#assertDirectory(path, false);
    }
    await this.#assertContainment(taskDirectory);
  }
  async #assertExistingDirectory(taskDirectory: string): Promise<void> {
    for (const path of [join(this.workspaceRoot, ".codex"), this.tasksRoot, taskDirectory])
      await this.#assertDirectory(path, false);
    await this.#assertContainment(taskDirectory);
  }
  async #assertDirectory(path: string, optional: boolean): Promise<void> {
    try {
      const stat = await this.#fs.lstat(path);
      if (stat.isSymbolicLink() || !stat.isDirectory())
        throw new StateStoreError(
          "state_path_invalid",
          "State path contains symlink or non-directory.",
        );
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      if (optional && hasCode(error, "ENOENT")) return;
      if (hasCode(error, "ENOENT"))
        throw new StateStoreError("state_not_found", "Task state directory does not exist.");
      throw new StateStoreError("state_read_failed", "Task directory could not be inspected.");
    }
  }
  async #assertRegularFile(path: string, optional: boolean): Promise<void> {
    try {
      const stat = await this.#fs.lstat(path);
      if (stat.isSymbolicLink() || !stat.isFile())
        throw new StateStoreError("state_path_invalid", "State path is symlink or non-file.");
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      if (optional && hasCode(error, "ENOENT")) return;
      if (hasCode(error, "ENOENT"))
        throw new StateStoreError("state_not_found", "Task state file does not exist.");
      throw new StateStoreError("state_read_failed", "Task state path could not be inspected.");
    }
  }
  async #assertContainment(taskDirectory: string): Promise<void> {
    try {
      const [root, task] = await Promise.all([
        this.#fs.realpath(this.tasksRoot),
        this.#fs.realpath(taskDirectory),
      ]);
      const rel = relative(root, task);
      if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel))
        throw new StateStoreError(
          "state_path_invalid",
          "Task directory resolves outside task root.",
        );
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      throw new StateStoreError(
        "state_path_invalid",
        "Task directory could not be resolved safely.",
      );
    }
  }
}

export function createTaskStateStore(
  workspaceRoot: string,
  options: StateStoreOptions = {},
): TaskStateStore {
  return new TaskStateStore(workspaceRoot, options);
}
function assertSafeTaskId(value: string): void {
  // oxlint-disable-next-line eslint/no-control-regex -- task path segments must reject NUL.
  if (!value || value === "." || value === ".." || /[\\/\u0000]/.test(value))
    throw new StateStoreError("state_path_invalid", "Task ID must be one non-traversing segment.");
}
function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
