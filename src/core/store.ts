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
import { DatabaseSync } from "node:sqlite";
import { StateStoreError } from "./schema.js";
import type {
  FactoryEvolutionProposal,
  FactoryTelemetryEvent,
  FactoryTelemetrySummary,
  RecurringIssueStat,
} from "../types.js";

interface WorkspaceWriteHandle {
  writeFile(data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}

interface WorkspaceFileSystem {
  readFile(path: string, maxBytes?: number): Promise<Buffer>;
  mkdir(path: string, options: { mode: number }): Promise<unknown>;
  openForAtomicWrite(path: string, mode: number): Promise<WorkspaceWriteHandle>;
  writeFile?(
    path: string,
    data: string | Buffer,
    options: { flag: "wx"; mode: number },
  ): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  link(from: string, to: string): Promise<void>;
  lstat(path: string): Promise<Stats>;
  realpath(path: string): Promise<string>;
  unlink(path: string): Promise<void>;
}

export interface WorkspaceStoreOptions {
  fileSystem?: Partial<WorkspaceFileSystem>;
  temporaryId?: () => string;
}

const DEFAULT_FILE_SYSTEM: WorkspaceFileSystem = {
  readFile: async (path, maxBytes) => {
    const handle = await nodeFs.open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile()) {
        throw Object.assign(new Error("Target path is not a regular file."), { code: "EINVAL" });
      }
      if (maxBytes !== undefined && metadata.size > maxBytes) {
        throw new StateStoreError("state_blocked", "Review source exceeds its byte limit.");
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
  link: (from, to) => nodeFs.link(from, to),
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

  async ensureSafeDirectory(
    relativeDir: string,
    options: { dirMode?: number } = {},
  ): Promise<string> {
    if (!relativeDir || relativeDir === ".") return this.workspaceRoot;
    const segments = splitSafeRelativePath(relativeDir);
    const dirMode = options.dirMode ?? 0o700;
    await this.#ensureSegments(this.workspaceRoot, segments, 0, dirMode);
    const fullDir = resolve(this.workspaceRoot, ...segments);
    await this.#assertRealpathContained(fullDir);
    return fullDir;
  }

  async #resolveExistingLeaf(
    relativePath: string,
    allowMissing: boolean,
  ): Promise<string | undefined> {
    const segments = splitSafeRelativePath(relativePath);
    const fullPath = resolve(this.workspaceRoot, ...segments);
    assertContained(this.workspaceRoot, fullPath);

    const parentExists = await this.#assertExistingDirectories(
      this.workspaceRoot,
      segments.slice(0, -1),
      0,
      allowMissing,
    );
    if (!parentExists || !(await this.#assertLeafFile(fullPath, allowMissing))) return undefined;
    await this.#assertRealpathContained(fullPath);
    return fullPath;
  }

  async readText(
    relativePath: string,
    allowMissing = false,
    maxBytes?: number,
  ): Promise<string | undefined> {
    const fullPath = await this.#resolveExistingLeaf(relativePath, allowMissing);
    if (!fullPath) return undefined;

    try {
      const content = await this.#fs.readFile(fullPath, maxBytes);
      return content.toString("utf8");
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
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

  async writeTextAtomically(
    relativePath: string,
    content: string,
    options: { mode?: number; dirMode?: number } = {},
  ): Promise<string> {
    const segments = splitSafeRelativePath(relativePath);
    const fullPath = resolve(this.workspaceRoot, ...segments);
    assertContained(this.workspaceRoot, fullPath);

    const fileMode = options.mode ?? 0o600;
    const dirMode = options.dirMode ?? 0o700;
    const parentSegments = segments.slice(0, -1);
    const parentDir =
      parentSegments.length > 0
        ? await this.ensureSafeDirectory(parentSegments.join("/"), { dirMode })
        : this.workspaceRoot;

    await this.#assertLeafFile(fullPath, true);

    const tempId = this.#temporaryId();
    if (
      !tempId ||
      tempId === "." ||
      tempId === ".." ||
      tempId.includes("\0") ||
      /[\\/]/.test(tempId)
    ) {
      throw new StateStoreError("state_path_invalid", "Temporary identifier is invalid.");
    }

    const temporary = join(parentDir, `.${basename(fullPath)}.${tempId}.tmp`);
    let owns = true;
    try {
      if (this.#customWriteFile && !this.#customOpenForAtomicWrite) {
        await this.#customWriteFile(temporary, content, { flag: "wx", mode: fileMode });
      } else {
        const handle = await this.#fs.openForAtomicWrite(temporary, fileMode);
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
    const fullPath = await this.#resolveExistingLeaf(relativePath, true);
    if (!fullPath) return false;

    try {
      await this.#fs.unlink(fullPath);
      return true;
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) return false;
      throw new StateStoreError("state_write_failed", `Unable to remove ${relativePath}.`);
    }
  }

  async fileIdentity(relativePath: string): Promise<string | undefined> {
    const segments = splitSafeRelativePath(relativePath);
    const path = this.resolvePath(relativePath);
    if (
      !(await this.#assertExistingDirectories(this.workspaceRoot, segments.slice(0, -1), 0, true))
    )
      return undefined;
    if (!(await this.#assertLeafFile(path, true))) return undefined;
    await this.#assertRealpathContained(path);
    const { dev, ino, birthtimeMs } = await this.#fs.lstat(path);
    return `${dev}:${ino}:${birthtimeMs}`;
  }

  async linkFileIfAbsent(
    source: string,
    destination: string,
    canPublish: () => Promise<boolean>,
  ): Promise<boolean> {
    const sourcePath = this.resolvePath(source);
    const destinationPath = this.resolvePath(destination);
    await this.ensureSafeDirectory(splitSafeRelativePath(destination).slice(0, -1).join("/"));
    if (!(await this.fileIdentity(source))) {
      throw new StateStoreError("state_not_found", "Staged projection is missing.");
    }
    if (!(await canPublish())) return false;
    try {
      await this.#fs.link(sourcePath, destinationPath);
      return true;
    } catch (error) {
      if (hasErrorCode(error, "EEXIST")) return false;
      throw new StateStoreError(
        "state_write_failed",
        `Unable to create ${destination} without replacement.`,
      );
    }
  }

  async withWriteLock<T>(lockPath: string, action: () => Promise<T>): Promise<T> {
    await this.ensureSafeDirectory(splitSafeRelativePath(lockPath).slice(0, -1).join("/"));
    await this.fileIdentity(lockPath);
    // SQLite's OS-backed lock is released even if the writer exits before finalizing its files.
    const connection = new DatabaseSync(this.resolvePath(lockPath));
    try {
      try {
        connection.exec("BEGIN IMMEDIATE");
      } catch (error) {
        if (error instanceof Error && /database is locked/i.test(error.message)) {
          throw new StateStoreError("state_conflict", "Another writer is updating this task.");
        }
        throw error;
      }
      return await action();
    } finally {
      connection.close();
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
    dirMode: number,
  ): Promise<void> {
    if (index >= segments.length) return;
    const segment = segments[index]!;
    const next = join(current, segment);
    try {
      await this.#fs.mkdir(next, { mode: dirMode });
    } catch (error) {
      if (!hasErrorCode(error, "EEXIST")) {
        throw new StateStoreError("state_write_failed", `Directory could not be created: ${next}.`);
      }
    }
    await this.#assertDirectory(next, false);
    await this.#ensureSegments(next, segments, index + 1, dirMode);
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

  async #assertEntry(path: string, allowMissing: boolean, isDir: boolean): Promise<boolean> {
    const label = isDir ? "Directory" : "File";
    try {
      const metadata = await this.#fs.lstat(path);
      const valid = isDir ? metadata.isDirectory() : metadata.isFile();
      if (metadata.isSymbolicLink() || !valid) {
        throw new StateStoreError(
          "state_path_invalid",
          isDir
            ? `Path contains symlink or non-directory: ${path}.`
            : `Path is a symlink or non-file: ${path}.`,
        );
      }
      return true;
    } catch (error) {
      if (error instanceof StateStoreError) throw error;
      if (allowMissing && hasErrorCode(error, "ENOENT")) return false;
      if (hasErrorCode(error, "ENOENT")) {
        throw new StateStoreError("state_not_found", `${label} does not exist: ${path}.`);
      }
      throw new StateStoreError(
        "state_read_failed",
        `${isDir ? "Directory" : "Path"} could not be inspected: ${path}.`,
      );
    }
  }

  #assertDirectory(path: string, allowMissing: boolean): Promise<boolean> {
    return this.#assertEntry(path, allowMissing, true);
  }

  #assertLeafFile(path: string, allowMissing: boolean): Promise<boolean> {
    return this.#assertEntry(path, allowMissing, false);
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

export function globToRegex(pattern: string): RegExp {
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

export const TELEMETRY_RUNS_PATH = ".forgix/telemetry/runs.jsonl";

const TELEMETRY_SECRET_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: "[REDACTED]" },
  { pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/g, replacement: "[REDACTED]" },
  { pattern: /github_pat_[A-Za-z0-9_]{20,}/g, replacement: "[REDACTED]" },
  { pattern: /\bsk-[A-Za-z0-9_-]{8,}\b/g, replacement: "[REDACTED]" },
  {
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
    replacement: "[REDACTED]",
  },
  { pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g, replacement: "[REDACTED]" },
  {
    pattern: /\b((?:api[_-]?key|token|password|secret)\s*[:=]\s*)\S+/gi,
    replacement: "$1[REDACTED]",
  },
];

export function redactTelemetryText(value: string): string {
  let output = value;
  for (const rule of TELEMETRY_SECRET_PATTERNS) {
    output = output.replace(rule.pattern, rule.replacement);
  }
  return output;
}

function resolveTelemetryStore(
  workspaceOrStore: string | WorkspaceStore,
  options?: WorkspaceStoreOptions,
): WorkspaceStore {
  return typeof workspaceOrStore === "string"
    ? createWorkspaceStore(workspaceOrStore, options)
    : workspaceOrStore;
}

function sanitizeTelemetryEvent(
  rawEvent: Partial<FactoryTelemetryEvent> & Record<string, unknown>,
): FactoryTelemetryEvent {
  if (typeof rawEvent !== "object" || rawEvent === null || Array.isArray(rawEvent)) {
    throw new StateStoreError("state_invalid", "Telemetry event must be an object.");
  }
  const type = typeof rawEvent.type === "string" ? rawEvent.type.trim() : "";
  if (!type) {
    throw new StateStoreError("state_invalid", "Telemetry event requires a non-empty type.");
  }
  const at =
    typeof rawEvent.at === "string" && rawEvent.at.trim().length > 0
      ? rawEvent.at.trim()
      : new Date().toISOString();
  const eventId =
    typeof rawEvent.eventId === "string" && rawEvent.eventId.trim().length > 0
      ? redactTelemetryText(rawEvent.eventId.trim())
      : randomUUID();

  const event: FactoryTelemetryEvent = {
    schemaVersion: 1,
    eventId,
    at,
    type: redactTelemetryText(type),
    ...(typeof rawEvent.taskId === "string" && rawEvent.taskId.trim()
      ? { taskId: redactTelemetryText(rawEvent.taskId.trim()) }
      : {}),
    ...(typeof rawEvent.workItemId === "string" && rawEvent.workItemId.trim()
      ? { workItemId: redactTelemetryText(rawEvent.workItemId.trim()) }
      : {}),
    ...(typeof rawEvent.phase === "string" ? { phase: rawEvent.phase } : {}),
    ...(typeof rawEvent.issueId === "string" && rawEvent.issueId.trim()
      ? { issueId: redactTelemetryText(rawEvent.issueId.trim()) }
      : {}),
    ...(typeof rawEvent.firstPassAssure === "boolean"
      ? { firstPassAssure: rawEvent.firstPassAssure }
      : {}),
    ...(typeof rawEvent.phaseBounces === "number" && Number.isFinite(rawEvent.phaseBounces)
      ? { phaseBounces: Math.max(0, Math.trunc(rawEvent.phaseBounces)) }
      : {}),
    ...(typeof rawEvent.escapeHatchKind === "string" && rawEvent.escapeHatchKind.trim()
      ? { escapeHatchKind: redactTelemetryText(rawEvent.escapeHatchKind.trim()) }
      : {}),
    ...(typeof rawEvent.surfacePath === "string" && rawEvent.surfacePath.trim()
      ? { surfacePath: redactTelemetryText(rawEvent.surfacePath.trim()) }
      : {}),
    ...(typeof rawEvent.contractId === "string" && rawEvent.contractId.trim()
      ? { contractId: redactTelemetryText(rawEvent.contractId.trim()) }
      : {}),
    ...(typeof rawEvent.checkpointId === "string" && rawEvent.checkpointId.trim()
      ? { checkpointId: redactTelemetryText(rawEvent.checkpointId.trim()) }
      : {}),
    ...(typeof rawEvent.durationMs === "number" && Number.isFinite(rawEvent.durationMs)
      ? { durationMs: Math.max(0, Math.round(rawEvent.durationMs)) }
      : {}),
    ...(typeof rawEvent.detail === "string" && rawEvent.detail.trim()
      ? { detail: redactTelemetryText(rawEvent.detail.trim()) }
      : {}),
  };
  return event;
}

export async function appendTelemetryEvent(
  workspaceOrStore: string | WorkspaceStore,
  rawEvent: Partial<FactoryTelemetryEvent> & Record<string, unknown>,
  options?: WorkspaceStoreOptions,
): Promise<FactoryTelemetryEvent> {
  const store = resolveTelemetryStore(workspaceOrStore, options);
  const sanitized = sanitizeTelemetryEvent(rawEvent);
  const existing = (await store.readText(TELEMETRY_RUNS_PATH, true)) ?? "";
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? `${existing}\n` : existing;
  await store.writeTextAtomically(TELEMETRY_RUNS_PATH, `${prefix}${JSON.stringify(sanitized)}\n`);
  return sanitized;
}

export async function readTelemetryEvents(
  workspaceOrStore: string | WorkspaceStore,
  options?: WorkspaceStoreOptions,
): Promise<FactoryTelemetryEvent[]> {
  const store = resolveTelemetryStore(workspaceOrStore, options);
  const raw = await store.readText(TELEMETRY_RUNS_PATH, true);
  if (!raw || !raw.trim()) return [];
  const events: FactoryTelemetryEvent[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<FactoryTelemetryEvent> &
        Record<string, unknown>;
      events.push(sanitizeTelemetryEvent(parsed));
    } catch {
      throw new StateStoreError("state_invalid", "Corrupted telemetry JSONL record.");
    }
  }
  return events;
}

export function summarizeFactoryTelemetry(
  events: readonly FactoryTelemetryEvent[],
): FactoryTelemetrySummary {
  const byType: Record<string, number> = {};
  const issueCounts = new Map<string, number>();
  const failedSubjectKeys = new Set<string>();
  const completedSubjectKeys = new Set<string>();
  let explicitAssureRuns = 0;
  let explicitFirstPassCount = 0;
  let implicitCompletedFirstPass = 0;
  let implicitCompletedTotal = 0;
  let unkeyedFailedAssure = 0;
  let phaseBounces = 0;
  let escapeHatchBlocks = 0;
  let debugRootCauseActivations = 0;
  let sharedContractDrifts = 0;
  let checkpointFailures = 0;

  for (const event of events) {
    byType[event.type] = (byType[event.type] ?? 0) + 1;
    if (event.issueId) {
      issueCounts.set(event.issueId, (issueCounts.get(event.issueId) ?? 0) + 1);
    }
    if (typeof event.phaseBounces === "number") {
      phaseBounces += Math.max(0, event.phaseBounces);
    } else if (event.type === "phase.bounce" || event.type === "gate.rejected") {
      phaseBounces += 1;
    }
    if (event.type === "escape_hatch.blocked" || Boolean(event.escapeHatchKind)) {
      escapeHatchBlocks += 1;
    }
    if (event.type === "debug_root_cause.activated") {
      debugRootCauseActivations += 1;
    }
    if (event.type === "shared_contract.drift") {
      sharedContractDrifts += 1;
    }
    if (event.type === "checkpoint.failed") {
      checkpointFailures += 1;
    }

    const runKey = event.taskId ?? event.workItemId;
    if (typeof event.firstPassAssure === "boolean") {
      explicitAssureRuns += 1;
      if (event.firstPassAssure) explicitFirstPassCount += 1;
      if (runKey) completedSubjectKeys.add(runKey);
    } else if (event.type === "assure.check_failed") {
      if (runKey) failedSubjectKeys.add(runKey);
      else unkeyedFailedAssure += 1;
    } else if (event.type === "assure.completed") {
      implicitCompletedTotal += 1;
      if (runKey) {
        completedSubjectKeys.add(runKey);
        if (!failedSubjectKeys.has(runKey)) implicitCompletedFirstPass += 1;
      } else if (unkeyedFailedAssure === 0) {
        implicitCompletedFirstPass += 1;
      }
    }
  }

  let unresolvedFailedKeys = 0;
  for (const failedKey of failedSubjectKeys) {
    if (!completedSubjectKeys.has(failedKey)) unresolvedFailedKeys += 1;
  }

  const totalAssureRuns =
    explicitAssureRuns + implicitCompletedTotal + unresolvedFailedKeys + unkeyedFailedAssure;
  const firstPassAssureCount = explicitFirstPassCount + implicitCompletedFirstPass;
  const firstPassAssureRate =
    totalAssureRuns > 0 ? Number((firstPassAssureCount / totalAssureRuns).toFixed(4)) : 0;

  const recurringIssues: RecurringIssueStat[] = [...issueCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([issueId, count]) => ({ issueId, count }))
    .toSorted(
      (left, right) => right.count - left.count || left.issueId.localeCompare(right.issueId),
    );

  return {
    totalEvents: events.length,
    totalAssureRuns,
    firstPassAssureCount,
    firstPassAssureRate,
    recurringIssues,
    recurringIssueIds: recurringIssues.map((entry) => entry.issueId),
    phaseBounces,
    escapeHatchBlocks,
    debugRootCauseActivations,
    sharedContractDrifts,
    checkpointFailures,
    byType,
  };
}

export function proposeFactoryEvolution(
  input: FactoryTelemetrySummary | readonly FactoryTelemetryEvent[],
): FactoryEvolutionProposal[] {
  const summary = Array.isArray(input)
    ? summarizeFactoryTelemetry(input)
    : (input as FactoryTelemetrySummary);

  const guardrailTriggers: string[] = [];
  if (summary.escapeHatchBlocks > 0) {
    guardrailTriggers.push(`escapeHatchBlocks:${summary.escapeHatchBlocks}`);
  }
  for (const issueId of summary.recurringIssueIds) {
    guardrailTriggers.push(`issue:${issueId}`);
  }
  if (summary.debugRootCauseActivations > 0) {
    guardrailTriggers.push(`debugRootCause:${summary.debugRootCauseActivations}`);
  }
  if (guardrailTriggers.length === 0) {
    guardrailTriggers.push("baseline:mechanical-hygiene");
  }

  const surfaceTriggers: string[] = [];
  if (summary.totalAssureRuns > 0 && summary.firstPassAssureRate < 1) {
    surfaceTriggers.push(`firstPassAssureRate:${summary.firstPassAssureRate}`);
  }
  if (summary.sharedContractDrifts > 0) {
    surfaceTriggers.push(`sharedContractDrifts:${summary.sharedContractDrifts}`);
  }
  if (summary.checkpointFailures > 0) {
    surfaceTriggers.push(`checkpointFailures:${summary.checkpointFailures}`);
  }
  if (surfaceTriggers.length === 0) {
    surfaceTriggers.push("baseline:surface-verification");
  }

  const docTriggers: string[] = [];
  if (summary.phaseBounces > 0) {
    docTriggers.push(`phaseBounces:${summary.phaseBounces}`);
  }
  if ((summary.byType["gate.rejected"] ?? 0) > 0) {
    docTriggers.push(`gateRejected:${summary.byType["gate.rejected"]}`);
  }
  if (docTriggers.length === 0) {
    docTriggers.push("baseline:thin-skill-budget");
  }

  return [
    {
      id: "proposal-mechanical-guardrail",
      priority: 1,
      category: "mechanical_guardrail",
      kind: "mechanical_guardrail",
      targetPath: ".oxlintrc.json",
      title: "Tighten deterministic lint, schema, or escape-hatch Mechanical Guardrail",
      rationale:
        summary.recurringIssueIds.length > 0 || summary.escapeHatchBlocks > 0
          ? `Observed ${summary.escapeHatchBlocks} escape-hatch block(s) and recurring issue(s) (${summary.recurringIssueIds.join(", ") || "none"}); encode as a deterministic check instead of prompt prose.`
          : "Maintain deterministic lint, type, and diff-scanner guardrails as the primary line of defense.",
      triggeredBy: guardrailTriggers,
    },
    {
      id: "proposal-surface-verification-rule",
      priority: 2,
      category: "surface_verification_rule",
      kind: "surface_verification_rule",
      targetPath: ".forgix/project.yaml",
      title:
        "Update Surface Verification Rules and Protected Surfaces in Project Engineering Profile",
      rationale:
        summary.totalAssureRuns > 0 && summary.firstPassAssureRate < 1
          ? `First-pass ASSURE rate is ${summary.firstPassAssureRate}; bind touched path globs to mandatory Runtime Evidence and formal verifier lanes.`
          : "Ensure changed runtime and formal specification globs require deterministic verification lanes.",
      triggeredBy: surfaceTriggers,
    },
    {
      id: "proposal-skill-budget-bounded-doc",
      priority: 3,
      category: "skill_budget_bounded_doc",
      kind: "skill_budget_bounded_doc",
      targetPath: "skills/forgix/SKILL.md",
      title: "Refine thin-skill routing note within strict prompt size budget",
      rationale:
        summary.phaseBounces > 0
          ? `Observed ${summary.phaseBounces} phase bounce(s); clarify Next-Action Envelope transition routing while staying under test/artifact-budget.json limits.`
          : "Keep skill instructions compact and delegated to CLI Next-Action Envelopes within prompt size budgets.",
      triggeredBy: docTriggers,
    },
  ];
}
