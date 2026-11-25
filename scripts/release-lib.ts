import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { chmod, readFile, stat, unlink, writeFile } from "node:fs/promises";

export type VersionBump = "patch" | "minor" | "major";

export interface StableVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface ReleasePlan {
  version: string;
  pluginVersion: string;
  tag: string;
  commitMessage: string;
  cachebuster: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  status: number;
}

export interface FileSnapshot {
  path: string;
  existed: boolean;
  bytes?: Buffer;
  mode?: number;
}

export class ReleaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseError";
  }
}

const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PLUGIN_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\+codex\.(\d{14})$/;
const RELEASE_TAG = /^v((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$/;

export const ALLOWED_RELEASE_PATHS: ReadonlySet<string> = new Set([
  "package.json",
  "bun.lock",
  ".codex-plugin/plugin.json",
  ".claude-plugin/plugin.json",
  "plugin.json",
  ".claude-plugin/marketplace.json",
  "dist/forgix.mjs",
  "CHANGELOG.md",
]);

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function assertObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReleaseError(message);
  }
}

function assertNonEmptyString(value: unknown, message: string): asserts value is string {
  if (typeof value !== "string" || value === "") {
    throw new ReleaseError(message);
  }
}

function assertSkillsPath(value: unknown): void {
  assertNonEmptyString(value, 'Plugin manifest field "skills" must be a non-empty string.');
  if (!value.endsWith("/")) {
    throw new ReleaseError('Plugin manifest "skills" path must end with "/".');
  }
}

export function parseStableVersion(value: string): StableVersion {
  const match = STABLE_VERSION.exec(value);
  if (!match) throw new ReleaseError(`Expected stable semantic version, received "${value}".`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compareVersions(left: string, right: string): number {
  const a = parseStableVersion(left);
  const b = parseStableVersion(right);
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export function incrementVersion(current: string, bump: VersionBump): string {
  const version = parseStableVersion(current);
  if (bump === "major") return `${version.major + 1}.0.0`;
  if (bump === "minor") return `${version.major}.${version.minor + 1}.0`;
  return `${version.major}.${version.minor}.${version.patch + 1}`;
}

export function semanticBase(pluginVersion: string): string {
  if (STABLE_VERSION.test(pluginVersion)) return pluginVersion;
  const plugin = PLUGIN_VERSION.exec(pluginVersion);
  if (!plugin) throw new ReleaseError(`Invalid plugin version "${pluginVersion}".`);
  return `${plugin[1]}.${plugin[2]}.${plugin[3]}`;
}

function spliceJsonStringMatch(
  contents: string,
  match: RegExpMatchArray | null,
  expected: string,
  nextVersion: string,
  errorMessage: string,
): string {
  if (!match || JSON.parse(match[2]!) !== expected) {
    throw new ReleaseError(errorMessage);
  }
  const valueStart = (match.index ?? 0) + match[1]!.length;
  const valueEnd = valueStart + match[2]!.length;
  return `${contents.slice(0, valueStart)}${JSON.stringify(nextVersion)}${contents.slice(valueEnd)}`;
}

export function replaceJsonVersion(contents: string, nextVersion: string): string {
  semanticBase(nextVersion);
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new ReleaseError("Cannot update version in invalid JSON.");
  }
  assertObject(parsed, "Cannot update version outside a JSON object.");
  const currentVersion = parsed.version;
  if (typeof currentVersion !== "string") {
    throw new ReleaseError('Cannot update missing JSON "version" string.');
  }

  const matches = [...contents.matchAll(/^([ \t]*"version"[ \t]*:[ \t]*)("(?:\\.|[^"\\])*")/gm)];
  if (matches.length !== 1) {
    throw new ReleaseError('Cannot locate one top-level JSON "version" field.');
  }
  return spliceJsonStringMatch(
    contents,
    matches[0]!,
    currentVersion,
    nextVersion,
    'Located JSON "version" does not match parsed value.',
  );
}

export function formatCachebuster(date: Date): string {
  if (Number.isNaN(date.getTime()))
    throw new ReleaseError("Cannot create cachebuster from invalid date.");
  return [
    date.getUTCFullYear(),
    pad2(date.getUTCMonth() + 1),
    pad2(date.getUTCDate()),
    pad2(date.getUTCHours()),
    pad2(date.getUTCMinutes()),
    pad2(date.getUTCSeconds()),
  ].join("");
}

export function recommendBump(commits: readonly string[]): VersionBump {
  const text = commits.join("\n");
  if (/(?:^[a-z]+(?:\([^)]+\))?!:|BREAKING CHANGE:)/im.test(text)) return "major";
  if (/^feat(?:\([^)]+\))?:/im.test(text)) return "minor";
  return "patch";
}

export function createReleasePlan(input: {
  currentPackageVersion: string;
  nextVersion: string;
  now: Date;
}): ReleasePlan {
  parseStableVersion(input.currentPackageVersion);
  parseStableVersion(input.nextVersion);
  if (compareVersions(input.nextVersion, input.currentPackageVersion) <= 0) {
    throw new ReleaseError("Next version must be greater than current package version.");
  }
  const cachebuster = formatCachebuster(input.now);
  const tag = `v${input.nextVersion}`;
  return {
    version: input.nextVersion,
    pluginVersion: `${input.nextVersion}+codex.${cachebuster}`,
    tag,
    commitMessage: `chore(release): ${tag}`,
    cachebuster,
  };
}

export function normalizeGitOutput(output: string): string {
  return output.trimEnd();
}

export function parsePorcelainPaths(output: string): string[] {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const path = line.slice(3);
      const renameSeparator = path.indexOf(" -> ");
      return renameSeparator === -1 ? path : path.slice(renameSeparator + 4);
    });
}

export function unexpectedReleasePaths(paths: readonly string[]): string[] {
  return paths.filter((path) => !ALLOWED_RELEASE_PATHS.has(path));
}

export type PluginManifestKind = "codex" | "claude" | "antigravity";

export function validatePluginManifest(
  value: unknown,
  kind: PluginManifestKind = "codex",
): asserts value is Record<string, unknown> {
  assertObject(value, "Plugin manifest must be a JSON object.");
  for (const field of ["name", "version", "description", "license"]) {
    assertNonEmptyString(
      value[field],
      `Plugin manifest field "${field}" must be a non-empty string.`,
    );
  }
  if (value.name !== "forgix") {
    throw new ReleaseError('Plugin manifest name must be "forgix".');
  }
  if (kind === "codex") {
    semanticBase(String(value.version));
    assertSkillsPath(value.skills);
  } else if (kind === "claude") {
    parseStableVersion(String(value.version));
    if ("interface" in value) {
      throw new ReleaseError('Claude plugin manifest must not contain "interface".');
    }
    assertSkillsPath(value.skills);
  } else {
    parseStableVersion(String(value.version));
    if (value.skills !== undefined) assertSkillsPath(value.skills);
  }
}

export function validateClaudeMarketplaceManifest(
  value: unknown,
): asserts value is Record<string, unknown> {
  assertObject(value, "Claude marketplace manifest must be a JSON object.");
  if (value.name !== "acrazie") {
    throw new ReleaseError('Claude marketplace manifest "name" must be "acrazie".');
  }
  assertObject(value.owner, 'Claude marketplace manifest "owner.name" must be a non-empty string.');
  assertNonEmptyString(
    value.owner.name,
    'Claude marketplace manifest "owner.name" must be a non-empty string.',
  );
  assertNonEmptyString(
    value.description,
    'Claude marketplace manifest "description" must be a non-empty string.',
  );
  if (!Array.isArray(value.plugins) || value.plugins.length === 0) {
    throw new ReleaseError('Claude marketplace manifest "plugins" must be a non-empty array.');
  }
  const forgix = value.plugins.find(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      (entry as Record<string, unknown>).name === "forgix",
  );
  if (!forgix) {
    throw new ReleaseError('Claude marketplace manifest must include a "forgix" plugin entry.');
  }
  if (forgix.source !== "./") {
    throw new ReleaseError('Claude marketplace manifest "forgix" entry source must be "./".');
  }
  assertNonEmptyString(
    forgix.description,
    'Claude marketplace manifest "forgix" entry must have a non-empty description.',
  );
  if (typeof forgix.version !== "string") {
    throw new ReleaseError(
      'Claude marketplace manifest "forgix" entry must have a string version.',
    );
  }
  parseStableVersion(forgix.version);
}

export function replaceMarketplacePluginVersion(
  contents: string,
  pluginName: string,
  nextVersion: string,
): string {
  parseStableVersion(nextVersion);
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new ReleaseError("Cannot update plugin version in invalid JSON marketplace.");
  }
  assertObject(parsed, "Cannot update plugin version outside a JSON object marketplace.");
  const plugins = parsed.plugins;
  if (!Array.isArray(plugins)) {
    throw new ReleaseError('Cannot locate "plugins" array in Claude marketplace manifest.');
  }
  const entry = plugins.find(
    (item): item is Record<string, unknown> =>
      Boolean(item) &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      (item as Record<string, unknown>).name === pluginName,
  );
  if (!entry || typeof entry.version !== "string") {
    throw new ReleaseError(
      `Cannot locate plugin "${pluginName}" version in Claude marketplace manifest.`,
    );
  }
  const escaped = JSON.stringify(pluginName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const entryPattern = new RegExp(
    `("name"\\s*:\\s*${escaped}[\\s\\S]*?"version"\\s*:\\s*)("(?:\\\\.|[^"\\\\])*")`,
  );
  return spliceJsonStringMatch(
    contents,
    entryPattern.exec(contents),
    entry.version,
    nextVersion,
    `Cannot locate formatted version field for "${pluginName}" in marketplace JSON.`,
  );
}

export function releaseIdentity(tag: string): { version: string } {
  const match = RELEASE_TAG.exec(tag);
  if (!match) throw new ReleaseError(`Expected stable release tag "vX.Y.Z", received "${tag}".`);
  const version = match[1]!;
  parseStableVersion(version);
  return { version };
}

const readReleaseJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

export function validateVersions(directory: string, tag: string): string {
  const { version } = releaseIdentity(tag);
  const pkg = readReleaseJson(join(directory, "package.json")) as {
    name: string;
    version: string;
  };
  if (pkg.name !== "@acrasie/forgix" || pkg.version !== version) {
    throw new ReleaseError("Tag and npm manifest differ.");
  }
  const codex = readReleaseJson(join(directory, ".codex-plugin/plugin.json")) as {
    version: string;
  };
  const claude = readReleaseJson(join(directory, ".claude-plugin/plugin.json")) as {
    version: string;
  };
  const agy = readReleaseJson(join(directory, "plugin.json")) as { version: string };
  const market = readReleaseJson(join(directory, ".claude-plugin/marketplace.json")) as {
    plugins: { name: string; version: string }[];
  };
  validatePluginManifest(codex);
  validatePluginManifest(claude, "claude");
  validatePluginManifest(agy, "antigravity");
  validateClaudeMarketplaceManifest(market);
  const base = semanticBase(codex.version);
  if (
    claude.version !== base ||
    agy.version !== base ||
    market.plugins.find((p) => p.name === "forgix")?.version !== base
  ) {
    throw new ReleaseError("Plugin plane versions differ.");
  }
  if (base !== version || !PLUGIN_VERSION.test(codex.version)) {
    throw new ReleaseError("Tag and plugin manifests differ.");
  }
  return codex.version;
}

export async function captureFileSnapshots(paths: readonly string[]): Promise<FileSnapshot[]> {
  return Promise.all(
    paths.map(async (path) => {
      try {
        const [bytes, metadata] = await Promise.all([readFile(path), stat(path)]);
        return { path, existed: true, bytes, mode: metadata.mode };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return { path, existed: false };
        throw error;
      }
    }),
  );
}

export async function restoreFileSnapshots(snapshots: readonly FileSnapshot[]): Promise<void> {
  await Promise.all(
    snapshots.map(async (entry) => {
      if (!entry.existed) {
        try {
          await unlink(entry.path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        return;
      }
      if (entry.bytes !== undefined) await writeFile(entry.path, entry.bytes);
      if (entry.mode !== undefined) await chmod(entry.path, entry.mode);
    }),
  );
}

export function runCommand(
  command: string,
  args: readonly string[],
  options: Omit<SpawnSyncOptionsWithStringEncoding, "encoding"> = {},
): CommandResult {
  const result = spawnSync(command, args, {
    ...options,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw new ReleaseError(`${command} unavailable: ${result.error.message}`);
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

export function requireCommand(
  command: string,
  args: readonly string[],
  options: Omit<SpawnSyncOptionsWithStringEncoding, "encoding"> = {},
): CommandResult {
  const result = runCommand(command, args, options);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    throw new ReleaseError(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : "."}`);
  }
  return result;
}
