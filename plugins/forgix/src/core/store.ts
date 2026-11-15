import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  type Stats,
} from "node:fs";
import * as nodeFs from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { StateStoreError } from "./schema.js";

export interface WorkspaceWriteHandle {
  writeFile(data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}

export interface WorkspaceFileSystem {
  readFile(path: string): Promise<Buffer>;
  mkdir(path: string, options: { mode: number }): Promise<unknown>;
  openForAtomicWrite(path: string, mode: number): Promise<WorkspaceWriteHandle>;
  writeFile?(
    path: string,
    data: string | Buffer,
    options: { flag: "wx"; mode: number },
  ): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  lstat(path: string): Promise<Stats>;
  realpath(path: string): Promise<string>;
  unlink(path: string): Promise<void>;
}

export interface WorkspaceStoreOptions {
  fileSystem?: Partial<WorkspaceFileSystem>;
  temporaryId?: () => string;
}

const DEFAULT_FILE_SYSTEM: WorkspaceFileSystem = {
  readFile: async (path) => {
    const handle = await nodeFs.open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile()) {
        throw Object.assign(new Error("Target path is not a regular file."), { code: "EINVAL" });
      }
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  },
  mkdir: (path, options) => nodeFs.mkdir(path, options),
  openForAtomicWrite: async (path, mode) => {
    const handle = await nodeFs.open(
      path,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      mode,
    );
    return {
      writeFile: (data, encoding = "utf8") =>
        typeof data === "string" ? handle.writeFile(data, encoding) : handle.writeFile(data),
      sync: () => handle.sync(),
      close: () => handle.close(),
    };
  },
  rename: (from, to) => nodeFs.rename(from, to),
  lstat: (path) => nodeFs.lstat(path),
  realpath: (path) => nodeFs.realpath(path),
  unlink: (path) => nodeFs.unlink(path),
};

export class WorkspaceStore {
  readonly workspaceRoot: string;
  readonly #fs: WorkspaceFileSystem;
  readonly #customWriteFile: WorkspaceFileSystem["writeFile"] | undefined;
  readonly #customOpenForAtomicWrite: boolean;
  readonly #temporaryId: () => string;

  constructor(workspaceRoot: string, options: WorkspaceStoreOptions = {}) {
    if (!workspaceRoot || workspaceRoot.includes("\u0000")) {
      throw new StateStoreError("state_path_invalid", "Workspace root is invalid.");
    }
    try {
      const candidate = realpathSync(resolve(workspaceRoot));
      const rootStat = lstatSync(candidate);
      if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
        throw new Error("Workspace root is not a non-symlink directory.");
      }
      this.workspaceRoot = candidate;
    } catch {
      throw new StateStoreError(
        "state_path_invalid",
        "Workspace root must be an existing directory.",
      );
    }
    this.#fs = { ...DEFAULT_FILE_SYSTEM, ...options.fileSystem };
    this.#customWriteFile = options.fileSystem?.writeFile;
    this.#customOpenForAtomicWrite = options.fileSystem?.openForAtomicWrite !== undefined;
    this.#temporaryId = options.temporaryId ?? randomUUID;
  }

  resolvePath(relativePath: string): string {
    const segments = splitSafeRelativePath(relativePath);
    const resolved = resolve(this.workspaceRoot, ...segments);
    assertContained(this.workspaceRoot, resolved);
    return resolved;
  }

  async ensureSafeDirectory(relativeDir: string): Promise<string> {
    if (!relativeDir || relativeDir === ".") return this.workspaceRoot;
    const segments = splitSafeRelativePath(relativeDir);
    await this.#ensureSegments(this.workspaceRoot, segments, 0);
    const fullDir = resolve(this.workspaceRoot, ...segments);
    await this.#assertRealpathContained(fullDir);
    return fullDir;
  }

  async readText(relativePath: string, allowMissing = false): Promise<string | undefined> {
    const segments = splitSafeRelativePath(relativePath);
    const fullPath = resolve(this.workspaceRoot, ...segments);
    assertContained(this.workspaceRoot, fullPath);

    const parentExists = await this.#assertExistingDirectories(
      this.workspaceRoot,
      segments.slice(0, -1),
      0,
      allowMissing,
    );
    if (!parentExists) return undefined;

    const leafExists = await this.#assertLeafFile(fullPath, allowMissing);
    if (!leafExists) return undefined;
    await this.#assertRealpathContained(fullPath);

    try {
      const content = await this.#fs.readFile(fullPath);
      return content.toString("utf8");
    } catch (error) {
      if (allowMissing && hasErrorCode(error, "ENOENT")) return undefined;
      if (hasErrorCode(error, "ENOENT")) {
        throw new StateStoreError("state_not_found", `File does not exist: ${relativePath}.`);
      }
      if (hasErrorCode(error, "ELOOP") || hasErrorCode(error, "EINVAL")) {
        throw new StateStoreError(
          "state_path_invalid",
          `Target path is a symlink or non-file: ${relativePath}.`,
        );
      }
      throw new StateStoreError("state_read_failed", `Unable to read ${relativePath}.`);
    }
  }

  async writeTextAtomically(relativePath: string, content: string): Promise<string> {
    const segments = splitSafeRelativePath(relativePath);
    const fullPath = resolve(this.workspaceRoot, ...segments);
    assertContained(this.workspaceRoot, fullPath);

    const parentSegments = segments.slice(0, -1);
    const parentDir =
      parentSegments.length > 0
        ? await this.ensureSafeDirectory(parentSegments.join("/"))
        : this.workspaceRoot;

    await this.#assertLeafFile(fullPath, true);

    const tempId = this.#temporaryId();
    // oxlint-disable-next-line eslint/no-control-regex -- temporary path segments must reject NUL.
    if (!tempId || tempId === "." || tempId === ".." || /[\\/\u0000]/.test(tempId)) {
      throw new StateStoreError("state_path_invalid", "Temporary identifier is invalid.");
    }

    const temporary = join(parentDir, `.${basename(fullPath)}.${tempId}.tmp`);
    let owns = true;
    try {
      if (this.#customWriteFile && !this.#customOpenForAtomicWrite) {
        await this.#customWriteFile(temporary, content, { flag: "wx", mode: 0o600 });
      } else {
        const handle = await this.#fs.openForAtomicWrite(temporary, 0o600);
        try {
          await handle.writeFile(content, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
      }
      await this.#fs.rename(temporary, fullPath);
      owns = false;
      return fullPath;
    } catch (error) {
      if (hasErrorCode(error, "EEXIST")) owns = false;
      throw new StateStoreError(
        "state_write_failed",
        `Unable to write ${relativePath} atomically.`,
      );
    } finally {
      if (owns) {
        await this.#fs.unlink(temporary).catch(() => undefined);
      }
    }
  }

  async removeFile(relativePath: string): Promise<boolean> {
    const segments = splitSafeRelativePath(relativePath);
    const fullPath = resolve(this.workspaceRoot, ...segments);
    assertContained(this.workspaceRoot, fullPath);

    const parentExists = await this.#assertExistingDirectories(
      this.workspaceRoot,
      segments.slice(0, -1),
      0,
      true,
    );
    if (!parentExists) return false;

    const leafExists = await this.#assertLeafFile(fullPath, true);
    if (!leafExists) return false;
    await this.#assertRealpathContained(fullPath);

    try {
      await this.#fs.unlink(fullPath);
      return true;
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) return false;
      throw new StateStoreError("state_write_failed", `Unable to remove ${relativePath}.`);
    }
  }

  async isGitignored(relativeTargetPath: string): Promise<boolean> {
    const normalizedTarget = normalizeGitignoreTarget(relativeTargetPath);
    const gitignore = await this.readText(".gitignore", true);
    if (gitignore === undefined) return false;
    return matchesGitignore(gitignore, normalizedTarget);
  }

  isGitignoredSync(relativeTargetPath: string): boolean {
    const normalizedTarget = normalizeGitignoreTarget(relativeTargetPath);
    const gitignorePath = this.resolvePath(".gitignore");
    let fd: number;
    try {
      fd = openSync(gitignorePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) return false;
      if (hasErrorCode(error, "ELOOP")) {
        throw new StateStoreError("state_path_invalid", ".gitignore cannot be a symlink.");
      }
      return false;
    }
    try {
      const metadata = fstatSync(fd);
      if (!metadata.isFile()) return false;
      const gitignore = readFileSync(fd, "utf8");
      return matchesGitignore(gitignore, normalizedTarget);
    } finally {
      closeSync(fd);
    }
  }

  async #ensureSegments(
    current: string,
    segments: readonly string[],
    index: number,
  ): Promise<void> {
    if (index >= segments.length) return;
    const segment = segments[index]!;
    const next = join(current, segment);
    try {
      await this.#fs.mkdir(next, { mode: 0o700 });
    } catch (error) {
      if (!hasErrorCode(error, "EEXIST")) {
        throw new StateStoreError("state_write_failed", `Directory could not be created: ${next}.`);
      }
    }
    await this.#assertDirectory(next, false);
    await this.#ensureSegments(next, segments, index + 1);
  }

  async #assertExistingDirectories(
    current: string,
    segments: readonly string[],
    index: number,
    allowMissing: boolean,
  ): Promise<boolean> {
    if (index >= segments.length) return true;
    const segment = segments[index]!;
    const next = join(current, segment);
    const exists = await this.#assertDirectory(next, allowMissing);
    if (!exists) return false;
    return this.#assertExistingDirectories(next, segments, index + 1, allowMissing);
  }

  async #assertDirectory(path: string, allowMissing: boolean): Promise<boolean> {
    try {
      const metadata = await this.#fs.lstat(path);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new StateStoreError(
          "state_path_invalid",
          `Path contains symlink or non-directory: ${path}.`,
        );
      }
      return true;
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      if (allowMissing && hasErrorCode(error, "ENOENT")) return false;
      if (hasErrorCode(error, "ENOENT")) {
        throw new StateStoreError("state_not_found", `Directory does not exist: ${path}.`);
      }
      throw new StateStoreError("state_read_failed", `Directory could not be inspected: ${path}.`);
    }
  }

  async #assertLeafFile(path: string, allowMissing: boolean): Promise<boolean> {
    try {
      const metadata = await this.#fs.lstat(path);
      if (metadata.isSymbolicLink() || !metadata.isFile()) {
        throw new StateStoreError("state_path_invalid", `Path is a symlink or non-file: ${path}.`);
      }
      return true;
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      if (allowMissing && hasErrorCode(error, "ENOENT")) return false;
      if (hasErrorCode(error, "ENOENT")) {
        throw new StateStoreError("state_not_found", `File does not exist: ${path}.`);
      }
      throw new StateStoreError("state_read_failed", `Path could not be inspected: ${path}.`);
    }
  }

  async #assertRealpathContained(targetPath: string): Promise<void> {
    let resolvedRoot: string;
    let resolvedTarget: string;
    try {
      [resolvedRoot, resolvedTarget] = await Promise.all([
        this.#fs.realpath(this.workspaceRoot),
        this.#fs.realpath(targetPath),
      ]);
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      throw new StateStoreError("state_path_invalid", "Target path could not be resolved safely.");
    }
    assertContained(resolvedRoot, resolvedTarget);
  }
}

export function createWorkspaceStore(
  workspaceRoot: string,
  options: WorkspaceStoreOptions = {},
): WorkspaceStore {
  return new WorkspaceStore(workspaceRoot, options);
}

function splitSafeRelativePath(relativePath: string): string[] {
  if (!relativePath || relativePath.includes("\u0000") || isAbsolute(relativePath)) {
    throw new StateStoreError("state_path_invalid", `Invalid workspace path: ${relativePath}.`);
  }
  const segments = relativePath.split(/[\\/]+/);
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new StateStoreError(
      "state_path_invalid",
      `Relative workspace path contains invalid segment: ${relativePath}.`,
    );
  }
  return segments;
}

function assertContained(root: string, target: string): void {
  const rel = relative(root, target);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new StateStoreError("state_path_invalid", "Path resolves outside workspace root.");
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function normalizeGitignoreTarget(target: string): string {
  const cleaned = target.replaceAll("\\", "/").replace(/^(?:\.\/|\/)+/, "");
  if (!cleaned || cleaned === "." || cleaned.startsWith("..") || isAbsolute(target)) {
    throw new StateStoreError("state_path_invalid", `Invalid gitignore target path: ${target}.`);
  }
  return cleaned;
}

function globToRegex(pattern: string): RegExp {
  let regex = "^";
  let index = 0;
  while (index < pattern.length) {
    const ch = pattern[index]!;
    if (ch === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          regex += "(?:.*/)?";
          index += 3;
        } else {
          regex += ".*";
          index += 2;
        }
      } else {
        regex += "[^/]*";
        index += 1;
      }
      continue;
    }
    if (ch === "?") {
      regex += "[^/]";
      index += 1;
      continue;
    }
    if ("\\^$.|+()[]{}".includes(ch)) {
      regex += `\\${ch}`;
    } else {
      regex += ch;
    }
    index += 1;
  }
  regex += "$";
  return new RegExp(regex);
}

function gitignoreLineMatches(rawPattern: string, target: string): boolean {
  const targetIsDir = target.endsWith("/");
  const cleanTarget = target.replace(/\/+$/, "");
  const directoryOnly = rawPattern.endsWith("/");
  const pattern = rawPattern.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!pattern) return false;

  const targetAncestors = cleanTarget.split("/");
  const prefixCandidates: string[] = [];
  for (let i = 1; i <= targetAncestors.length; i += 1) {
    const isLast = i === targetAncestors.length;
    if (directoryOnly && isLast && !targetIsDir) continue;
    prefixCandidates.push(targetAncestors.slice(0, i).join("/"));
  }

  const matcher = globToRegex(pattern);
  if (pattern.includes("/")) {
    return prefixCandidates.some((candidate) => matcher.test(candidate));
  }
  return prefixCandidates.some((candidate) => matcher.test(basename(candidate)));
}

function matchesGitignore(gitignore: string, normalizedTarget: string): boolean {
  let matched = false;
  for (const rawLine of gitignore.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const negated = trimmed.startsWith("!");
    const pattern = negated ? trimmed.slice(1).trim() : trimmed;
    if (!pattern) continue;
    if (gitignoreLineMatches(pattern, normalizedTarget)) {
      matched = !negated;
    }
  }
  return matched;
}
