import { existsSync, readFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { scanDiffForEscapeHatches, verifyProtectedSurfaces } from "../core/config.js";
import {
  detectFactorySessionDrift,
  evaluateFactoryBlockedCommands,
  resolveEffectiveProtectedSurfaces,
  scanDiffForFactoryEscapeHatches,
} from "../core/factory-policy.js";
import type { FactoryPoliciesConfig } from "../core/factory-types.js";
import type { HarnessId, HookEnforcementMode } from "../types.js";
import { buildHookCommand, HARNESS_HOOK_EVENTS } from "./command.js";
import {
  getCurrentGitBranch,
  getOriginTrunkBranch,
  isLinkedGitWorktree,
  toRepoRelativePath,
  type ActiveTaskResolution,
  type HookProjectSummary,
  type HookRuntimeConfig,
} from "./context.js";

export interface PreToolUseDecision {
  decision: "allow" | "warn" | "deny";
  reason?: string;
}

export interface PostCheckDecision {
  status: "clean" | "warn" | "block";
  message?: string;
}

const DEFAULT_TRUNK_BRANCHES = new Set(["main", "master", "trunk"]);
const GIT_GLOBAL_OPTS_WITH_VALUE = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--super-prefix",
  "--config-env",
]);
const GIT_COMMIT_OPTS_WITH_VALUE = new Set([
  "-m",
  "--message",
  "-F",
  "--file",
  "-C",
  "--reuse-message",
  "-c",
  "--reedit-message",
  "--fixup",
  "--squash",
  "--author",
  "--date",
  "-t",
  "--template",
  "-u",
  "--untracked-files",
  "-S",
  "--gpg-sign",
  "--cleanup",
  "--trailer",
  "--pathspec-from-file",
]);

function splitShellSegments(command: string): string[][] {
  const segments: string[][] = [];
  let currentTokens: string[] = [];
  let currentToken = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  const pushToken = () => {
    if (currentToken.length > 0) {
      currentTokens.push(currentToken);
      currentToken = "";
    }
  };

  const pushSegment = () => {
    pushToken();
    if (currentTokens.length > 0) {
      segments.push(currentTokens);
      currentTokens = [];
    }
  };

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i]!;
    if (escaped) {
      currentToken += ch;
      escaped = false;
      continue;
    }
    if (inSingle) {
      if (ch === "'") inSingle = false;
      else currentToken += ch;
      continue;
    }
    if (inDouble) {
      if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inDouble = false;
      } else {
        currentToken += ch;
      }
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === ";" || ch === "\n") {
      pushSegment();
      continue;
    }
    if (ch === "&" || ch === "|") {
      pushSegment();
      if (command[i + 1] === ch) i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      pushToken();
      continue;
    }
    currentToken += ch;
  }

  pushSegment();
  return segments;
}

function isEnvAssignment(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function parseGitSegment(
  tokens: readonly string[],
  defaultCwd: string,
): { subcommand: string; args: string[]; gitCwd: string } | undefined {
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (isEnvAssignment(token) || token === "env" || token === "command" || token === "sudo") {
      index += 1;
      continue;
    }
    break;
  }

  const executable = tokens[index];
  if (!executable) return undefined;
  if (executable !== "git" && basename(executable) !== "git") return undefined;

  let gitCwd = defaultCwd;
  index += 1;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (token === "--") {
      index += 1;
      break;
    }
    if (token === "-C" && tokens[index + 1]) {
      const targetDir = tokens[index + 1]!;
      gitCwd = isAbsolute(targetDir) ? resolve(targetDir) : resolve(gitCwd, targetDir);
      index += 2;
      continue;
    }
    if (GIT_GLOBAL_OPTS_WITH_VALUE.has(token)) {
      index += 2;
      continue;
    }
    if (token.startsWith("-")) {
      index += 1;
      continue;
    }
    return {
      subcommand: token,
      args: tokens.slice(index + 1),
      gitCwd,
    };
  }
  return undefined;
}

function hasCommitNoVerify(args: readonly string[]): boolean {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === "--") break;
    if (arg === "--no-verify" || arg === "-n") return true;
    if (GIT_COMMIT_OPTS_WITH_VALUE.has(arg)) {
      i += 1;
      continue;
    }
    if (arg.startsWith("-") && !arg.startsWith("--") && arg.length > 1) {
      const flags = arg.slice(1);
      // Stop inspecting short-flag cluster at 'm'/'F'/'C'/'c'/'t'/'u' since remainder is its argument.
      for (const flag of flags) {
        if (flag === "n") return true;
        if ("mFCctuS".includes(flag)) break;
      }
    }
  }
  return false;
}

function hasPushForce(args: readonly string[]): boolean {
  for (const arg of args) {
    if (arg === "--") break;
    if (arg === "--force-with-lease" || arg.startsWith("--force-with-lease=")) continue;
    if (arg === "--force-if-includes") continue;
    if (arg === "--force" || arg === "-f") return true;
    if (arg.startsWith("-") && !arg.startsWith("--") && arg.length > 1) {
      if (arg.slice(1).includes("f")) return true;
    }
  }
  return false;
}

function isMergeControlFlag(args: readonly string[]): boolean {
  return args.some((arg) => arg === "--abort" || arg === "--continue" || arg === "--quit");
}

export function evaluateDestructiveShellCommand(
  command: string,
  cwd: string,
  mergePolicy: string,
  enforcement: HookEnforcementMode,
  factoryPolicies?: FactoryPoliciesConfig,
): PreToolUseDecision {
  const segments = splitShellSegments(command);
  const violations: string[] = [];

  for (const tokens of segments) {
    const parsed = parseGitSegment(tokens, cwd);
    if (!parsed) continue;

    if (parsed.subcommand === "commit" && hasCommitNoVerify(parsed.args)) {
      violations.push(
        "Destructive git command: `git commit --no-verify` / `-n` bypasses repository verification hooks.",
      );
    } else if (parsed.subcommand === "push" && hasPushForce(parsed.args)) {
      violations.push(
        "Destructive git command: `git push --force` / `-f` is forbidden (use `--force-with-lease` instead).",
      );
    } else if (
      parsed.subcommand === "merge" &&
      mergePolicy === "never" &&
      !isMergeControlFlag(parsed.args)
    ) {
      const currentBranch = getCurrentGitBranch(parsed.gitCwd);
      const originTrunk = getOriginTrunkBranch(parsed.gitCwd);
      if (
        currentBranch &&
        (DEFAULT_TRUNK_BRANCHES.has(currentBranch) || currentBranch === originTrunk)
      ) {
        violations.push(
          `Direct \`git merge\` on trunk branch "${currentBranch}" is forbidden (merge: never).`,
        );
      }
    }
  }

  if (violations.length === 0) {
    return evaluateFactoryBlockedCommands(command, factoryPolicies, enforcement);
  }

  const reason = `Forgix hook: ${violations.join(" ")}`;
  return {
    decision: enforcement === "warn" ? "warn" : "deny",
    reason,
  };
}

export function evaluateProtectedSurfaceWrite(
  filePaths: readonly string[],
  cwd: string,
  workspaceRoot: string,
  protectedSurfaces: readonly string[],
  taskResolution: ActiveTaskResolution,
  enforcement: HookEnforcementMode,
  factoryPolicies?: FactoryPoliciesConfig,
): PreToolUseDecision {
  const worktreeRef =
    taskResolution.kind === "active" ? taskResolution.task.worktreeRef : undefined;
  const relPaths = filePaths
    .map((filePath) => toRepoRelativePath(filePath, cwd, workspaceRoot, worktreeRef))
    .filter((relPath): relPath is string => relPath !== undefined);

  if (relPaths.length === 0) {
    return { decision: "allow" };
  }

  const effectiveGlobs = resolveEffectiveProtectedSurfaces(protectedSurfaces, factoryPolicies);
  const approvedPaths =
    taskResolution.kind === "active" ? taskResolution.task.approvedProtectedPaths : [];

  const result = verifyProtectedSurfaces(relPaths, effectiveGlobs, approvedPaths);
  if (result.allowed) {
    return { decision: "allow" };
  }

  const pathsSummary = result.unapprovedPaths.join(", ");

  if (taskResolution.kind === "active") {
    const reason = `Forgix hook: Protected Surface write to ${pathsSummary} is not approved in active task "${taskResolution.task.taskId}" (contract.approvedProtectedPaths).`;
    return {
      decision: enforcement === "warn" ? "warn" : "deny",
      reason,
    };
  }

  const context =
    taskResolution.kind === "ambiguous"
      ? `has no authorization: multiple active tasks (${taskResolution.taskIds.join(", ")}).`
      : taskResolution.kind === "unverified"
        ? "has no authorization: no current worktree-bound GATE v2 approval."
        : "outside an active Forgix BUILD task.";
  return {
    decision:
      enforcement === "strict" || (enforcement === "balanced" && taskResolution.kind !== "none")
        ? "deny"
        : "warn",
    reason: `Forgix hook: Protected Surface write to ${pathsSummary} ${context}`,
  };
}

function normalizeDiffHeaders(
  diffText: string,
  cwd: string,
  workspaceRoot: string,
  worktreeRef?: string,
): string {
  return diffText
    .split(/\r?\n/)
    .map((line) => {
      if (!line.startsWith("+++ ")) return line;
      const target = line.slice(4).trim();
      if (!target || target === "/dev/null" || target === "b/unknown") return line;
      const rawPath = target.startsWith("b/") ? target.slice(2) : target;
      const rel = toRepoRelativePath(rawPath, cwd, workspaceRoot, worktreeRef);
      return rel ? `+++ b/${rel}` : line;
    })
    .join("\n");
}

export function evaluateEscapeHatches(
  diffText: string,
  cwd: string,
  workspaceRoot: string,
  taskResolution: ActiveTaskResolution,
  enforcement: HookEnforcementMode,
  factoryPolicies?: FactoryPoliciesConfig,
): PostCheckDecision {
  if (!diffText.trim()) {
    return { status: "clean" };
  }

  const worktreeRef =
    taskResolution.kind === "active" ? taskResolution.task.worktreeRef : undefined;
  const normalizedDiff = normalizeDiffHeaders(diffText, cwd, workspaceRoot, worktreeRef);

  const approvedEscapeHatches =
    taskResolution.kind === "active" ? taskResolution.task.approvedEscapeHatches : [];

  const scan = scanDiffForEscapeHatches(normalizedDiff, approvedEscapeHatches);
  const extraFindings = scanDiffForFactoryEscapeHatches(
    normalizedDiff,
    factoryPolicies,
    approvedEscapeHatches,
  );
  const allFindings = [...scan.findings, ...extraFindings];
  if (allFindings.length === 0) {
    return { status: "clean" };
  }

  const maxListed = 5;
  const listed = allFindings
    .slice(0, maxListed)
    .map((finding) => `${finding.file}:${finding.line} (${finding.kind})`)
    .join(", ");
  const overflow =
    allFindings.length > maxListed ? ` (+${allFindings.length - maxListed} more)` : "";
  const taskNote =
    taskResolution.kind === "ambiguous"
      ? ` Multiple executing tasks (${taskResolution.taskIds.join(", ")}) prevented implicit escape-hatch authorization.`
      : "";
  const message = `Forgix hook: unapproved Escape Hatch detected in ${listed}${overflow}.${taskNote}`;

  return {
    status: enforcement === "strict" ? "block" : "warn",
    message,
  };
}

function readTextSafe(filePath: string): string | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
}

function collectCommandStrings(value: unknown, output: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectCommandStrings(item, output);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      if (key === "command" && typeof entry === "string") {
        output.add(entry);
      } else {
        collectCommandStrings(entry, output);
      }
    }
  }
}

function detectBootstrapDrift(workspaceRoot: string, config: HookRuntimeConfig): string[] {
  const harnesses = config.harnesses;
  if (!harnesses) return [];

  const bootstrap = config.bootstrap;
  const checkHooks = bootstrap?.hooks !== false;
  const checkGitignore = bootstrap?.gitignore !== false;
  const checkWorktreeInclude = bootstrap?.worktreeInclude === true;

  const findings: string[] = [];

  if (harnesses.length > 0) {
    findings.push(...detectFactorySessionDrift(workspaceRoot, harnesses, bootstrap));
  }

  if (checkHooks && harnesses.length > 0) {
    const hookFiles: Record<HarnessId, string> = {
      antigravity: join(workspaceRoot, ".agents", "hooks.json"),
      codex: join(workspaceRoot, ".codex", "hooks.json"),
      claude: join(workspaceRoot, ".claude", "settings.json"),
    };
    for (const harness of harnesses) {
      const content = readTextSafe(hookFiles[harness]);
      if (!content) {
        findings.push(`missing ${harness} hooks config`);
        continue;
      }
      let parsedHooks: unknown;
      try {
        parsedHooks = JSON.parse(content);
      } catch {
        findings.push(`invalid ${harness} hooks JSON`);
        continue;
      }
      const commands = new Set<string>();
      collectCommandStrings(parsedHooks, commands);
      const missingEvent = HARNESS_HOOK_EVENTS[harness].some(
        (spec) => !commands.has(buildHookCommand(harness, spec.event)),
      );
      if (missingEvent) {
        findings.push(`stale ${harness} hooks`);
      }
    }
  }

  if (checkGitignore) {
    const gitignore = readTextSafe(join(workspaceRoot, ".gitignore"));
    if (
      !gitignore ||
      !gitignore.includes("# forgix:start") ||
      !gitignore.includes(".forgix/config.local.yaml")
    ) {
      findings.push(".gitignore drift");
    }
  }

  if (checkWorktreeInclude) {
    const wt = readTextSafe(join(workspaceRoot, ".worktreeinclude"));
    if (
      !wt ||
      !wt.includes("# forgix:start") ||
      !wt.includes(".forgix/project.local.yaml") ||
      !wt.includes(".forgix/config.local.yaml")
    ) {
      findings.push(".worktreeinclude drift");
    }
  }

  return findings;
}

export function buildSessionStartMessage(
  workspaceRoot: string,
  cwd: string,
  config: HookRuntimeConfig,
  project: HookProjectSummary,
  taskResolution: ActiveTaskResolution,
  parseWarning?: string,
): string {
  const parts: string[] = [];

  if (project.present) {
    const name = project.projectName ?? "unnamed";
    const stackText = project.stackIds.length > 0 ? ` [${project.stackIds.join(", ")}]` : "";
    const surfaceCount = resolveEffectiveProtectedSurfaces(
      project.protectedSurfaces,
      config.factoryPolicies,
    ).length;
    parts.push(
      `Forgix (${config.enforcement}): project "${name}"${stackText}, ${surfaceCount} protected surfaces.`,
    );
  } else {
    parts.push(
      `Forgix (${config.enforcement}): .forgix/project.yaml not initialized (run $forgix init).`,
    );
  }

  if (taskResolution.kind === "active") {
    parts.push(`Active task: ${taskResolution.task.taskId} (executing).`);
  } else if (taskResolution.kind === "ambiguous") {
    parts.push(
      `Warning: multiple executing tasks (${taskResolution.taskIds.join(", ")}); no implicit authorization.`,
    );
  }

  if (isLinkedGitWorktree(cwd)) {
    parts.push("Worktree detected: run `forgix worktree check-base` before editing.");
  }

  const drift = detectBootstrapDrift(workspaceRoot, config);
  if (drift.length > 0) {
    parts.push(
      `Bootstrap drift (${drift.join(", ")}); run $forgix sync (or \`forgix init check\`).`,
    );
  }

  if (config.warning) {
    parts.push(`Config warning: ${config.warning}`);
  }
  if (project.warning) {
    parts.push(`Project profile warning: ${project.warning}`);
  }
  if (parseWarning) {
    parts.push(`Hook input warning: ${parseWarning}`);
  }

  return parts.join(" ");
}
