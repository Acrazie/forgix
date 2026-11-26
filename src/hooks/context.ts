import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseFactoryPolicies } from "../core/factory-policy.js";
import type { FactoryBootstrapConfig, FactoryPoliciesConfig } from "../core/factory-types.js";
import {
  HARNESS_IDS,
  HOOK_ENFORCEMENT_MODES,
  type HarnessId,
  type HookEnforcementMode,
} from "../types.js";

export interface HookRuntimeConfig {
  enforcement: HookEnforcementMode;
  merge: string;
  harnesses?: HarnessId[];
  bootstrap?: FactoryBootstrapConfig;
  factoryPolicies?: FactoryPoliciesConfig;
  warning?: string;
}

export interface HookProjectSummary {
  present: boolean;
  projectName?: string;
  stackIds: string[];
  protectedSurfaces: string[];
  warning?: string;
}

export interface ActiveTaskContext {
  taskId: string;
  status: "executing";
  worktreeRef?: string;
  approvedProtectedPaths: readonly string[];
  approvedEscapeHatches: readonly string[];
  contractReviewReceipt?: string;
}

export type ActiveTaskResolution =
  | { kind: "none" }
  | { kind: "unverified" }
  | { kind: "active"; task: ActiveTaskContext }
  | { kind: "ambiguous"; taskIds: string[] };

const GIT_TIMEOUT_MS = 2000;
const GIT_DIFF_MAX_BUFFER = 2 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function canonicalizePath(targetPath: string): string {
  let current = resolve(targetPath);
  const trailing: string[] = [];
  while (true) {
    try {
      const real = realpathSync(current);
      return trailing.length > 0 ? join(real, ...trailing.toReversed()) : real;
    } catch {
      const parent = dirname(current);
      if (parent === current) {
        return trailing.length > 0 ? join(current, ...trailing.toReversed()) : current;
      }
      trailing.push(basename(current));
      current = parent;
    }
  }
}

function canonicalPath(pathValue: string, baseDir: string): string {
  const resolved = isAbsolute(pathValue) ? resolve(pathValue) : resolve(baseDir, pathValue);
  return canonicalizePath(resolved);
}

export function toRepoRelativePath(
  rawPath: string,
  cwd: string,
  workspaceRoot: string,
  worktreeRef?: string,
): string | undefined {
  const resolvedTarget = isAbsolute(rawPath) ? resolve(rawPath) : resolve(cwd, rawPath);
  const canonicalTarget = canonicalizePath(resolvedTarget);

  const candidateRoots: string[] = [];
  if (worktreeRef) {
    candidateRoots.push(canonicalPath(worktreeRef, workspaceRoot));
  }
  candidateRoots.push(canonicalizePath(workspaceRoot));
  candidateRoots.push(canonicalPath(cwd, workspaceRoot));

  for (const root of candidateRoots) {
    const rel = relative(root, canonicalTarget).replaceAll("\\", "/");
    if (rel && rel !== "." && rel !== ".." && !rel.startsWith("../")) {
      return rel;
    }
  }
  return undefined;
}

function parseYamlRecord(filePath: string): { value?: Record<string, unknown>; error?: string } {
  if (!existsSync(filePath)) return {};
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed: unknown = parseYaml(raw);
    if (!isRecord(parsed)) {
      return { error: `Configuration at ${filePath} is not a YAML object.` };
    }
    return { value: parsed };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { error: `Failed to parse ${filePath}: ${detail}` };
  }
}

function parseHarnesses(value: unknown): HarnessId[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: HarnessId[] = [];
  for (const item of value) {
    if (
      typeof item === "string" &&
      (HARNESS_IDS as readonly string[]).includes(item) &&
      !result.includes(item as HarnessId)
    ) {
      result.push(item as HarnessId);
    }
  }
  return result;
}

function parseBootstrapConfig(value: unknown): FactoryBootstrapConfig | undefined {
  if (!isRecord(value)) return undefined;
  const bootstrap: FactoryBootstrapConfig = {};
  if (typeof value.rules === "boolean") bootstrap.rules = value.rules;
  if (typeof value.agents === "boolean") bootstrap.agents = value.agents;
  if (typeof value.skills === "boolean") bootstrap.skills = value.skills;
  if (typeof value.hooks === "boolean") bootstrap.hooks = value.hooks;
  if (typeof value.gitignore === "boolean") bootstrap.gitignore = value.gitignore;
  if (typeof value.worktreeInclude === "boolean") bootstrap.worktreeInclude = value.worktreeInclude;
  if (Array.isArray(value.managedPaths)) bootstrap.managedPaths = stringList(value.managedPaths);
  return bootstrap;
}

export function loadHookRuntimeConfig(workspaceRoot: string): HookRuntimeConfig {
  const repoPath = join(workspaceRoot, ".forgix", "config.yaml");
  const localPath = join(workspaceRoot, ".forgix", "config.local.yaml");

  const repoParsed = parseYamlRecord(repoPath);
  const localParsed = parseYamlRecord(localPath);
  const warnings: string[] = [];
  if (repoParsed.error) warnings.push(repoParsed.error);
  if (localParsed.error) warnings.push(localParsed.error);

  const merged: Record<string, unknown> = {
    ...repoParsed.value,
    ...localParsed.value,
  };

  if (isRecord(repoParsed.value?.hooks) || isRecord(localParsed.value?.hooks)) {
    merged.hooks = {
      ...(isRecord(repoParsed.value?.hooks) ? repoParsed.value.hooks : {}),
      ...(isRecord(localParsed.value?.hooks) ? localParsed.value.hooks : {}),
    };
  }
  if (isRecord(repoParsed.value?.bootstrap) || isRecord(localParsed.value?.bootstrap)) {
    merged.bootstrap = {
      ...(isRecord(repoParsed.value?.bootstrap) ? repoParsed.value.bootstrap : {}),
      ...(isRecord(localParsed.value?.bootstrap) ? localParsed.value.bootstrap : {}),
    };
  }

  let enforcement: HookEnforcementMode = "balanced";
  if (isRecord(merged.hooks) && merged.hooks.enforcement !== undefined) {
    const rawEnforcement = merged.hooks.enforcement;
    if (
      typeof rawEnforcement === "string" &&
      (HOOK_ENFORCEMENT_MODES as readonly string[]).includes(rawEnforcement)
    ) {
      enforcement = rawEnforcement as HookEnforcementMode;
    } else {
      warnings.push(`Unknown hooks.enforcement value; defaulting to "balanced".`);
    }
  }

  return buildRuntimeConfig(enforcement, merged, repoParsed.value, warnings);
}

function buildRuntimeConfig(
  enforcement: HookEnforcementMode,
  merged: Record<string, unknown>,
  repoValue: Record<string, unknown> | undefined,
  warnings: readonly string[],
): HookRuntimeConfig {
  const merge = typeof merged.merge === "string" ? merged.merge : "never";
  const harnesses = parseHarnesses(merged.harnesses);
  const bootstrap = parseBootstrapConfig(merged.bootstrap);
  const factoryPolicies = parseFactoryPolicies(repoValue?.factoryPolicies);
  return {
    enforcement,
    merge,
    ...(harnesses !== undefined ? { harnesses } : {}),
    ...(bootstrap !== undefined ? { bootstrap } : {}),
    ...(factoryPolicies ? { factoryPolicies } : {}),
    ...(warnings.length > 0 ? { warning: warnings.join(" ") } : {}),
  };
}

export function loadHookProjectSummary(workspaceRoot: string): HookProjectSummary {
  const projectPath = join(workspaceRoot, ".forgix", "project.yaml");
  if (!existsSync(projectPath)) {
    return { present: false, stackIds: [], protectedSurfaces: [] };
  }

  const parsed = parseYamlRecord(projectPath);
  if (parsed.error || !parsed.value) {
    return {
      present: true,
      stackIds: [],
      protectedSurfaces: [],
      ...(parsed.error ? { warning: parsed.error } : {}),
    };
  }

  const content = isRecord(parsed.value.content) ? parsed.value.content : parsed.value;
  const projectObj = isRecord(content.project) ? content.project : undefined;
  const projectName =
    (typeof projectObj?.name === "string" && projectObj.name) ||
    (typeof projectObj?.id === "string" && projectObj.id) ||
    undefined;

  const stackIds: string[] = [];
  if (Array.isArray(content.stack)) {
    for (const entry of content.stack) {
      if (isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0) {
        stackIds.push(entry.id);
      }
    }
  }

  const protectedSurfaces = stringList(content.protectedSurfaces);

  return {
    present: true,
    ...(projectName !== undefined ? { projectName } : {}),
    stackIds,
    protectedSurfaces,
  };
}

function runGitReadOnly(
  cwd: string,
  args: readonly string[],
  maxBuffer?: number,
): string | undefined {
  try {
    const result = spawnSync("git", [...args], {
      cwd,
      encoding: "utf8",
      timeout: GIT_TIMEOUT_MS,
      ...(maxBuffer !== undefined ? { maxBuffer } : {}),
    });
    if (result.status !== 0 || typeof result.stdout !== "string") return undefined;
    return result.stdout;
  } catch {
    return undefined;
  }
}

export function getCurrentGitBranch(cwd: string): string | undefined {
  const out = runGitReadOnly(cwd, ["symbolic-ref", "--short", "HEAD"]);
  const trimmed = out?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function getOriginTrunkBranch(cwd: string): string | undefined {
  const out = runGitReadOnly(cwd, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  const trimmed = out?.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith("origin/") ? trimmed.slice("origin/".length) : trimmed;
}

export function isLinkedGitWorktree(cwd: string): boolean {
  const gitDir = runGitReadOnly(cwd, ["rev-parse", "--git-dir"])?.trim();
  const commonDir = runGitReadOnly(cwd, ["rev-parse", "--git-common-dir"])?.trim();
  if (!gitDir || !commonDir) return false;
  return canonicalPath(gitDir, cwd) !== canonicalPath(commonDir, cwd);
}

export function readLightGitDiff(cwd: string): string {
  const againstHead = runGitReadOnly(
    cwd,
    ["diff", "--no-color", "--unified=0", "HEAD"],
    GIT_DIFF_MAX_BUFFER,
  );
  if (againstHead !== undefined) return againstHead;
  const unstaged = runGitReadOnly(cwd, ["diff", "--no-color", "--unified=0"], GIT_DIFF_MAX_BUFFER);
  return unstaged ?? "";
}
