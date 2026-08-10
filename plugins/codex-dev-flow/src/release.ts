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
  const paths = new Set<string>(["plugins/codex-dev-flow/dist/dev-flow.mjs"]);
  if (target !== "npm") paths.add("plugins/codex-dev-flow/.codex-plugin/plugin.json");
  if (target !== "plugin") {
    paths.add("plugins/codex-dev-flow/package.json");
    paths.add("plugins/codex-dev-flow/bun.lock");
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

export function validatePluginManifest(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReleaseError("Plugin manifest must be a JSON object.");
  }
  const manifest = value as Record<string, unknown>;
  for (const field of ["name", "version", "description", "license", "skills"]) {
    if (typeof manifest[field] !== "string" || manifest[field] === "") {
      throw new ReleaseError(`Plugin manifest field "${field}" must be a non-empty string.`);
    }
  }
  if (manifest.name !== "codex-dev-flow") {
    throw new ReleaseError('Plugin manifest name must be "codex-dev-flow".');
  }
  semanticBase(String(manifest.version));
  if (!String(manifest.skills).endsWith("/")) {
    throw new ReleaseError('Plugin manifest "skills" path must end with "/".');
  }
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
