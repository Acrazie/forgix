import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { chmod, readFile, stat, unlink, writeFile } from "node:fs/promises";

export type ReleaseTarget = "plugin" | "npm" | "both";
export type ReleaseMode = "preview" | "publish";
export type VersionBump = "patch" | "minor" | "major";

export interface StableVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface ReleasePlan {
  target: ReleaseTarget;
  packageVersion: string;
  pluginVersion: string;
  identity: string;
  tag: string;
  commitMessage: string;
  cachebuster?: string;
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

export interface PublicationState {
  pushed: boolean;
  npmPublished: boolean;
  githubRelease: boolean;
}

export type PublicationStep = "push" | "npm" | "github-release";

export class ReleaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseError";
  }
}

const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PLUGIN_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\+codex\.(\d{14})$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
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

export function formatStableVersion(version: StableVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
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
  const stable = STABLE_VERSION.exec(pluginVersion);
  if (stable) return pluginVersion;
  const plugin = PLUGIN_VERSION.exec(pluginVersion);
  if (!plugin) throw new ReleaseError(`Invalid plugin version "${pluginVersion}".`);
  return `${plugin[1]}.${plugin[2]}.${plugin[3]}`;
}

export function replaceJsonVersion(contents: string, nextVersion: string): string {
  semanticBase(nextVersion);
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new ReleaseError("Cannot update version in invalid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ReleaseError("Cannot update version outside a JSON object.");
  }
  const currentVersion = (parsed as Record<string, unknown>).version;
  if (typeof currentVersion !== "string") {
    throw new ReleaseError('Cannot update missing JSON "version" string.');
  }

  const matches = [...contents.matchAll(/^([ \t]*"version"[ \t]*:[ \t]*)("(?:\\.|[^"\\])*")/gm)];
  if (matches.length !== 1) {
    throw new ReleaseError('Cannot locate one top-level JSON "version" field.');
  }
  const match = matches[0]!;
  if (JSON.parse(match[2]!) !== currentVersion) {
    throw new ReleaseError('Located JSON "version" does not match parsed value.');
  }
  const valueStart = match.index + match[1]!.length;
  const valueEnd = valueStart + match[2]!.length;
  return `${contents.slice(0, valueStart)}${JSON.stringify(nextVersion)}${contents.slice(valueEnd)}`;
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
  target: ReleaseTarget;
  currentPackageVersion: string;
  currentPluginVersion: string;
  nextPackageVersion?: string;
  now: Date;
}): ReleasePlan {
  const { target, currentPackageVersion, currentPluginVersion } = input;
  parseStableVersion(currentPackageVersion);
  const currentPluginBase = semanticBase(currentPluginVersion);

  let packageVersion = currentPackageVersion;
  let pluginVersion = currentPluginVersion;
  let cachebuster: string | undefined;

  if (target !== "plugin") {
    if (!input.nextPackageVersion)
      throw new ReleaseError("npm release requires a next package version.");
    parseStableVersion(input.nextPackageVersion);
    if (compareVersions(input.nextPackageVersion, currentPackageVersion) <= 0) {
      throw new ReleaseError("Next npm version must be greater than current package version.");
    }
    packageVersion = input.nextPackageVersion;
  }

  if (target !== "npm") {
    cachebuster = formatCachebuster(input.now);
    const base = target === "both" ? packageVersion : currentPluginBase;
    pluginVersion = `${base}+codex.${cachebuster}`;
  }

  const identity =
    target === "both"
      ? `v${packageVersion}`
      : target === "npm"
        ? `npm-v${packageVersion}`
        : `plugin-v${semanticBase(pluginVersion)}-codex.${cachebuster}`;

  return {
    target,
    packageVersion,
    pluginVersion,
    identity,
    tag: identity,
    commitMessage: `chore(release): ${identity}`,
    ...(cachebuster ? { cachebuster } : {}),
  };
}

export function allowedReleasePaths(target: ReleaseTarget): ReadonlySet<string> {
  const paths = new Set<string>(["plugins/forgix/dist/forgix.mjs"]);
  if (target !== "npm") {
    paths.add("plugins/forgix/.codex-plugin/plugin.json");
    paths.add("plugins/forgix/.claude-plugin/plugin.json");
    paths.add("plugins/forgix/plugin.json");
    paths.add(".claude-plugin/marketplace.json");
  }
  if (target !== "plugin") {
    paths.add("plugins/forgix/package.json");
    paths.add("bun.lock");
  }
  return paths;
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

export function unexpectedReleasePaths(paths: readonly string[], target: ReleaseTarget): string[] {
  const allowed = allowedReleasePaths(target);
  return paths.filter((path) => !allowed.has(path));
}

export type PluginManifestKind = "codex" | "claude" | "antigravity";

export function validatePluginManifest(
  value: unknown,
  kind: PluginManifestKind = "codex",
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReleaseError("Plugin manifest must be a JSON object.");
  }
  const manifest = value as Record<string, unknown>;
  for (const field of ["name", "version", "description", "license"]) {
    if (typeof manifest[field] !== "string" || manifest[field] === "") {
      throw new ReleaseError(`Plugin manifest field "${field}" must be a non-empty string.`);
    }
  }
  if (manifest.name !== "forgix") {
    throw new ReleaseError('Plugin manifest name must be "forgix".');
  }

  if (kind === "codex") {
    semanticBase(String(manifest.version));
  } else {
    parseStableVersion(String(manifest.version));
  }

  if (kind === "claude") {
    if ("interface" in manifest) {
      throw new ReleaseError('Claude plugin manifest must not contain "interface".');
    }
    if (typeof manifest.skills !== "string" || manifest.skills === "") {
      throw new ReleaseError('Plugin manifest field "skills" must be a non-empty string.');
    }
    if (!manifest.skills.endsWith("/")) {
      throw new ReleaseError('Plugin manifest "skills" path must end with "/".');
    }
  } else if (kind === "codex") {
    if (typeof manifest.skills !== "string" || manifest.skills === "") {
      throw new ReleaseError('Plugin manifest field "skills" must be a non-empty string.');
    }
    if (!manifest.skills.endsWith("/")) {
      throw new ReleaseError('Plugin manifest "skills" path must end with "/".');
    }
  } else if (manifest.skills !== undefined) {
    if (
      typeof manifest.skills !== "string" ||
      manifest.skills === "" ||
      !manifest.skills.endsWith("/")
    ) {
      throw new ReleaseError(
        'Plugin manifest "skills" path must be a non-empty string ending with "/".',
      );
    }
  }
}

export function validateClaudeMarketplaceManifest(
  value: unknown,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReleaseError("Claude marketplace manifest must be a JSON object.");
  }
  const manifest = value as Record<string, unknown>;
  if (manifest.name !== "acrazie") {
    throw new ReleaseError('Claude marketplace manifest "name" must be "acrazie".');
  }
  if (
    !manifest.owner ||
    typeof manifest.owner !== "object" ||
    Array.isArray(manifest.owner) ||
    typeof (manifest.owner as Record<string, unknown>).name !== "string" ||
    (manifest.owner as Record<string, unknown>).name === ""
  ) {
    throw new ReleaseError('Claude marketplace manifest "owner.name" must be a non-empty string.');
  }
  if (typeof manifest.description !== "string" || manifest.description === "") {
    throw new ReleaseError('Claude marketplace manifest "description" must be a non-empty string.');
  }
  if (!Array.isArray(manifest.plugins) || manifest.plugins.length === 0) {
    throw new ReleaseError('Claude marketplace manifest "plugins" must be a non-empty array.');
  }
  const forgix = manifest.plugins.find(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      (entry as Record<string, unknown>).name === "forgix",
  );
  if (!forgix) {
    throw new ReleaseError('Claude marketplace manifest must include a "forgix" plugin entry.');
  }
  if (forgix.source !== "./plugins/forgix") {
    throw new ReleaseError(
      'Claude marketplace manifest "forgix" entry source must be "./plugins/forgix".',
    );
  }
  if (typeof forgix.description !== "string" || forgix.description === "") {
    throw new ReleaseError(
      'Claude marketplace manifest "forgix" entry must have a non-empty description.',
    );
  }
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
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ReleaseError("Cannot update plugin version outside a JSON object marketplace.");
  }
  const plugins = (parsed as Record<string, unknown>).plugins;
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
  const entryPattern = new RegExp(
    `("name"\\s*:\\s*${escapeRegex(JSON.stringify(pluginName))}[\\s\\S]*?"version"\\s*:\\s*)("(?:\\\\.|[^"\\\\])*")`,
  );
  const match = entryPattern.exec(contents);
  if (!match || JSON.parse(match[2]!) !== entry.version) {
    throw new ReleaseError(
      `Cannot locate formatted version field for "${pluginName}" in marketplace JSON.`,
    );
  }
  const valueStart = match.index + match[1]!.length;
  const valueEnd = valueStart + match[2]!.length;
  return `${contents.slice(0, valueStart)}${JSON.stringify(nextVersion)}${contents.slice(valueEnd)}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseReleaseCommit(subject: string): {
  target: ReleaseTarget;
  identity: string;
  version: string;
} | null {
  const match = /^chore\(release\): (v|npm-v|plugin-v)(\d+\.\d+\.\d+)(?:-codex\.\d{14})?$/.exec(
    subject,
  );
  if (!match) return null;
  const prefix = match[1];
  const identity = subject.slice("chore(release): ".length);
  return {
    target: prefix === "v" ? "both" : prefix === "npm-v" ? "npm" : "plugin",
    identity,
    version: match[2]!,
  };
}

export function existingNpmReleaseVersion(tag: string, name: string, version: string): string {
  if (name !== "forgix") throw new ReleaseError("Existing release must contain package forgix.");
  parseStableVersion(version);
  if (tag !== `forgix-v${version}`) {
    throw new ReleaseError("Existing release tag does not match package name and version.");
  }
  return version;
}

export function missingPublicationSteps(
  target: ReleaseTarget,
  state: PublicationState,
): PublicationStep[] {
  const steps: PublicationStep[] = [];
  if (!state.pushed) steps.push("push");
  if (target !== "plugin" && !state.npmPublished) steps.push("npm");
  if (!state.githubRelease) steps.push("github-release");
  return steps;
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
  for (const entry of snapshots) {
    if (!entry.existed) {
      try {
        await unlink(entry.path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      continue;
    }
    await writeFile(entry.path, entry.bytes!);
    if (entry.mode !== undefined) await chmod(entry.path, entry.mode);
  }
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
