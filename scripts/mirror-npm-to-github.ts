#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SOURCE_PACKAGE = "dev-flow";
export const DESTINATION_PACKAGE = "@acrazie/dev-flow";
export const SOURCE_REGISTRY = "https://registry.npmjs.org";
export const DESTINATION_REGISTRY = "https://npm.pkg.github.com";

const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const EXPECTED_REPOSITORY = "github.com/acrazie/codex-dev-flow";

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

type RunCommand = (command: string, args: readonly string[]) => CommandResult;

export class MirrorError extends Error {
  override name = "MirrorError";
}

function stableParts(version: string): [number, number, number] | null {
  const match = STABLE_VERSION.exec(version);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function requireStableVersion(value: string): string {
  if (!stableParts(value)) throw new MirrorError(`Invalid stable npm version "${value}".`);
  return value;
}

function compareStableVersions(left: string, right: string): number {
  const leftParts = stableParts(left);
  const rightParts = stableParts(right);
  if (!leftParts || !rightParts) throw new MirrorError("Cannot compare invalid stable versions.");
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

export function parsePublishedVersions(output: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new MirrorError("npm returned invalid JSON while listing source versions.");
  }

  const values = typeof parsed === "string" ? [parsed] : parsed;
  if (!Array.isArray(values)) {
    throw new MirrorError("npm source version listing must be a string or array.");
  }

  const versions = values.filter(
    (value): value is string => typeof value === "string" && stableParts(value) !== null,
  );
  const unique = [...new Set(versions)].toSorted(compareStableVersions);
  if (unique.length === 0) throw new MirrorError("npm source has no stable versions to mirror.");
  return unique;
}

export function versionsForSelector(
  rawSelector: string,
  publishedVersions: readonly string[] = [],
): string[] {
  const selector = rawSelector.trim();
  if (!selector) throw new MirrorError("Mirror selector is required.");
  if (selector === "all") {
    if (publishedVersions.length === 0) {
      throw new MirrorError('Selector "all" requires discovered npm source versions.');
    }
    return [...new Set(publishedVersions.map(requireStableVersion))].toSorted(
      compareStableVersions,
    );
  }
  if (selector.startsWith("plugin-v")) return [];
  if (selector.startsWith("npm-v")) return [requireStableVersion(selector.slice(5))];
  if (selector.startsWith("v")) return [requireStableVersion(selector.slice(1))];
  return [requireStableVersion(selector)];
}

function repositoryUrl(manifest: Record<string, unknown>): string | null {
  const repository = manifest.repository;
  if (typeof repository === "string") return repository;
  if (
    repository &&
    typeof repository === "object" &&
    "url" in repository &&
    typeof repository.url === "string"
  ) {
    return repository.url;
  }
  return null;
}

function normalizedRepository(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "")
    .replace(/^https?:\/\//, "");
}

export function transformPackageManifest(source: string, expectedVersion: string): string {
  requireStableVersion(expectedVersion);
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new MirrorError("Source tarball contains invalid package.json JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new MirrorError("Source tarball package.json must contain an object.");
  }

  const manifest = parsed as Record<string, unknown>;
  if (manifest.name !== SOURCE_PACKAGE) {
    throw new MirrorError(`Source package name must be "${SOURCE_PACKAGE}".`);
  }
  if (manifest.version !== expectedVersion) {
    throw new MirrorError(`Source package version must be "${expectedVersion}".`);
  }
  const repository = repositoryUrl(manifest);
  if (!repository || normalizedRepository(repository) !== EXPECTED_REPOSITORY) {
    throw new MirrorError(`Source package repository must be "${EXPECTED_REPOSITORY}".`);
  }

  const namePattern = /("name"\s*:\s*)"dev-flow"/;
  if (!namePattern.test(source)) {
    throw new MirrorError("Cannot replace source package name without rewriting manifest bytes.");
  }
  const transformed = source.replace(namePattern, `$1"${DESTINATION_PACKAGE}"`);
  const transformedManifest = JSON.parse(transformed) as Record<string, unknown>;
  if (transformedManifest.name !== DESTINATION_PACKAGE) {
    throw new MirrorError("Destination package name transformation failed.");
  }
  return transformed;
}

export function destinationVersionState(
  result: Pick<CommandResult, "status" | "stdout" | "stderr">,
  expectedVersion: string,
): "exists" | "missing" {
  requireStableVersion(expectedVersion);
  if (result.status === 0) {
    let published: unknown;
    try {
      published = JSON.parse(result.stdout);
    } catch {
      throw new MirrorError("GitHub Packages returned invalid version JSON.");
    }
    if (published !== expectedVersion) {
      throw new MirrorError(`GitHub Packages returned unexpected version ${String(published)}.`);
    }
    return "exists";
  }

  const detail = `${result.stderr}\n${result.stdout}`;
  if (/\bE404\b|\b404\b.*\bNot Found\b/i.test(detail)) return "missing";
  throw new MirrorError(`Cannot query GitHub Packages: ${detail.trim() || "unknown npm error"}`);
}

function defaultRunCommand(command: string, args: readonly string[]): CommandResult {
  const result = spawnSync(command, [...args], {
    encoding: "utf8",
    env: process.env,
    shell: false,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error ? { error: result.error } : {}),
  };
}

function requireSuccess(
  label: string,
  command: string,
  args: readonly string[],
  run: RunCommand,
): CommandResult {
  const result = run(command, args);
  if (result.error) throw new MirrorError(`${label} failed: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    throw new MirrorError(`${label} failed${detail ? `: ${detail}` : "."}`);
  }
  return result;
}

function discoverPublishedVersions(run: RunCommand): string[] {
  const result = requireSuccess(
    "List canonical npm versions",
    "npm",
    ["view", SOURCE_PACKAGE, "versions", "--json", `--registry=${SOURCE_REGISTRY}`],
    run,
  );
  return parsePublishedVersions(result.stdout);
}

function destinationHasVersion(version: string, run: RunCommand): boolean {
  const result = run("npm", [
    "view",
    `${DESTINATION_PACKAGE}@${version}`,
    "version",
    "--json",
    `--registry=${DESTINATION_REGISTRY}`,
  ]);
  if (result.error) throw new MirrorError(`Query GitHub Packages failed: ${result.error.message}`);
  return destinationVersionState(result, version) === "exists";
}

function mirrorVersion(version: string, run: RunCommand): "published" | "skipped" {
  if (destinationHasVersion(version, run)) {
    console.log(`Skip ${DESTINATION_PACKAGE}@${version}: already published.`);
    return "skipped";
  }

  const directory = mkdtempSync(join(tmpdir(), "dev-flow-github-package-"));
  try {
    requireSuccess(
      `Download ${SOURCE_PACKAGE}@${version}`,
      "npm",
      [
        "pack",
        `${SOURCE_PACKAGE}@${version}`,
        "--ignore-scripts",
        "--json",
        `--pack-destination=${directory}`,
        `--registry=${SOURCE_REGISTRY}`,
      ],
      run,
    );
    const archives = readdirSync(directory).filter((entry) => entry.endsWith(".tgz"));
    if (archives.length !== 1) {
      throw new MirrorError(`Expected one npm tarball for ${version}; found ${archives.length}.`);
    }
    const archive = join(directory, archives[0]!);
    requireSuccess(
      `Extract ${SOURCE_PACKAGE}@${version}`,
      "tar",
      ["-xzf", archive, "-C", directory],
      run,
    );

    const packageDirectory = join(directory, "package");
    const manifestPath = join(packageDirectory, "package.json");
    const sourceManifest = readFileSync(manifestPath, "utf8");
    writeFileSync(manifestPath, transformPackageManifest(sourceManifest, version));

    requireSuccess(
      `Publish ${DESTINATION_PACKAGE}@${version}`,
      "npm",
      [
        "publish",
        packageDirectory,
        "--ignore-scripts",
        "--access=public",
        `--registry=${DESTINATION_REGISTRY}`,
      ],
      run,
    );
    console.log(`Published ${DESTINATION_PACKAGE}@${version}.`);
    return "published";
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function mirrorSelector(rawSelector: string, run: RunCommand = defaultRunCommand): void {
  const publishedVersions = rawSelector.trim() === "all" ? discoverPublishedVersions(run) : [];
  const versions = versionsForSelector(rawSelector, publishedVersions);
  if (versions.length === 0) {
    console.log(`Skip "${rawSelector}": plugin-only release has no npm version to mirror.`);
    return;
  }

  let published = 0;
  let skipped = 0;
  for (const version of versions) {
    if (mirrorVersion(version, run) === "published") published += 1;
    else skipped += 1;
  }
  console.log(`GitHub Packages mirror complete: ${published} published, ${skipped} skipped.`);
}

if (import.meta.main) {
  const [selector, ...extra] = process.argv.slice(2);
  if (!selector || extra.length > 0) {
    throw new MirrorError("Usage: bun scripts/mirror-npm-to-github.ts <version|tag|all>");
  }
  mirrorSelector(selector);
}
