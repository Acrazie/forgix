// Native Node.js only: must run without node_modules when Renovate reports no updates.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RENOVATE_BRANCH = "chore/renovate-deps";
export const BASE_BRANCH = "main";
export const COMMIT_TITLE = "chore(deps): update weekly dependencies";
export const DEFAULT_ENTIRE_PROJECT = "et/forgix";

const ALLOWED_SCOPE_FILES = [
  "package.json",
  "bun.lock",
  ".dagger/package.json",
  ".dagger/bun.lock",
  ".dagger/src/index.ts",
  "dagger.json",
  ".bun-version",
  ".node-version",
  ".buildkite/pipeline.yml",
  "dist/forgix.mjs",
] as const;

const PACKAGE_JSON_DEP_FIELDS = new Set([
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
]);

export class RenovateSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenovateSyncError";
  }
}

export interface RenovateUpdate {
  newValue: string;
  newVersion?: string;
  updateType?: string;
}

export interface RenovateDependency {
  depName: string;
  depType?: string;
  currentValue: string;
  replaceString?: string;
  updates: RenovateUpdate[];
}

export interface RenovatePackageFile {
  packageFile: string;
  deps: RenovateDependency[];
}

export interface RenovateReport {
  repositories: {
    local: {
      packageFiles: Record<string, RenovatePackageFile[]>;
    };
  };
}

export interface PlannedUpdate {
  manager: "bun" | "regex";
  packageFile: string;
  depName: string;
  depType: string | undefined;
  currentValue: string;
  newValue: string;
  replaceString: string | undefined;
}

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  program: string,
  args: readonly string[],
  cwd: string,
) => CommandResult;

export interface SyncDependencies {
  cwd?: string;
  project?: string;
  runCommand?: CommandRunner;
}

export interface SyncOutcome {
  status: "no-updates" | "no-op-main" | "no-op-remote" | "created-trail" | "commented-trail";
  updates: PlannedUpdate[];
  modifiedFiles: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertSafeRepoRelativePath(filePath: string): void {
  if (!filePath || isAbsolute(filePath)) {
    throw new RenovateSyncError(`Invalid packageFile path in report: "${filePath}".`);
  }
  const normalized = normalize(filePath);
  if (normalized.startsWith("..") || normalized === ".") {
    throw new RenovateSyncError(`Unsafe packageFile path in report: "${filePath}".`);
  }
}

export function validateRenovateReport(raw: unknown): RenovateReport {
  if (!isPlainObject(raw)) {
    throw new RenovateSyncError("Renovate report must be a JSON object.");
  }
  if (!isPlainObject(raw.repositories)) {
    throw new RenovateSyncError("Renovate report missing required 'repositories' object.");
  }
  if (!isPlainObject(raw.repositories.local)) {
    throw new RenovateSyncError("Renovate report missing required 'repositories.local' object.");
  }
  const { packageFiles } = raw.repositories.local;
  if (!isPlainObject(packageFiles)) {
    throw new RenovateSyncError(
      "Renovate report missing required 'repositories.local.packageFiles' object.",
    );
  }

  for (const [manager, entries] of Object.entries(packageFiles)) {
    if (!Array.isArray(entries)) {
      throw new RenovateSyncError(
        `Renovate report 'packageFiles.${manager}' must be an array of package file entries.`,
      );
    }
    for (const entry of entries) {
      if (!isPlainObject(entry) || typeof entry.packageFile !== "string") {
        throw new RenovateSyncError(
          `Renovate report entry in 'packageFiles.${manager}' must have a string 'packageFile'.`,
        );
      }
      assertSafeRepoRelativePath(entry.packageFile);
      if (!Array.isArray(entry.deps)) {
        throw new RenovateSyncError(
          `Renovate report entry '${entry.packageFile}' must have a 'deps' array.`,
        );
      }
      for (const dep of entry.deps) {
        if (
          !isPlainObject(dep) ||
          typeof dep.depName !== "string" ||
          typeof dep.currentValue !== "string" ||
          !Array.isArray(dep.updates)
        ) {
          throw new RenovateSyncError(
            `Invalid dependency entry in '${entry.packageFile}' (expected depName, currentValue, updates).`,
          );
        }
        if (dep.depType !== undefined && typeof dep.depType !== "string") {
          throw new RenovateSyncError(`Invalid 'depType' in '${entry.packageFile}'.`);
        }
        if (dep.replaceString !== undefined && typeof dep.replaceString !== "string") {
          throw new RenovateSyncError(`Invalid 'replaceString' in '${entry.packageFile}'.`);
        }
        for (const update of dep.updates) {
          if (!isPlainObject(update) || typeof update.newValue !== "string" || !update.newValue) {
            throw new RenovateSyncError(
              `Invalid update entry for '${dep.depName}' in '${entry.packageFile}'.`,
            );
          }
        }
      }
    }
  }

  return raw as unknown as RenovateReport;
}

export function extractPlannedUpdates(report: RenovateReport): PlannedUpdate[] {
  const updates: PlannedUpdate[] = [];
  const { packageFiles } = report.repositories.local;

  for (const [managerKey, entries] of Object.entries(packageFiles)) {
    const manager =
      managerKey === "bun"
        ? "bun"
        : managerKey === "regex" || managerKey === "custom.regex"
          ? "regex"
          : null;
    if (!manager) continue;

    for (const entry of entries) {
      for (const dep of entry.deps) {
        const chosen = dep.updates[0];
        if (!chosen || chosen.newValue === dep.currentValue) continue;
        updates.push({
          manager,
          packageFile: entry.packageFile,
          depName: dep.depName,
          depType: dep.depType,
          currentValue: dep.currentValue,
          newValue: chosen.newValue,
          replaceString: dep.replaceString,
        });
      }
    }
  }

  return updates;
}

function replaceExactSingle(
  haystack: string,
  needle: string,
  replacement: string,
  context: string,
): string {
  if (!needle) {
    throw new RenovateSyncError(`Empty search token when updating ${context}.`);
  }
  const firstIndex = haystack.indexOf(needle);
  if (firstIndex === -1) {
    throw new RenovateSyncError(`Expected value '${needle}' not found in ${context}.`);
  }
  if (haystack.indexOf(needle, firstIndex + needle.length) !== -1) {
    throw new RenovateSyncError(`Ambiguous multiple occurrences of '${needle}' in ${context}.`);
  }
  return haystack.slice(0, firstIndex) + replacement + haystack.slice(firstIndex + needle.length);
}

function formatPackageManagerValue(version: string): string {
  return version.startsWith("bun@") ? version : `bun@${version}`;
}

function stripBunPrefix(version: string): string {
  return version.startsWith("bun@") ? version.slice("bun@".length) : version;
}

function syncBunVersionFiles(cwd: string, rawVersion: string, modifiedFiles: Set<string>): void {
  const version = stripBunPrefix(rawVersion);
  const bunVersionPath = resolve(cwd, ".bun-version");
  if (existsSync(bunVersionPath)) {
    const current = readFileSync(bunVersionPath, "utf8");
    const trailingNewline = current.endsWith("\n") ? "\n" : "";
    const next = `${version}${trailingNewline}`;
    if (next !== current) {
      writeFileSync(bunVersionPath, next, "utf8");
      modifiedFiles.add(".bun-version");
    }
  }

  for (const pkgRelPath of ["package.json"]) {
    const pkgAbsPath = resolve(cwd, pkgRelPath);
    if (!existsSync(pkgAbsPath)) continue;
    const raw = readFileSync(pkgAbsPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.packageManager !== "string") continue;
    const expected = formatPackageManagerValue(version);
    if (parsed.packageManager !== expected) {
      parsed.packageManager = expected;
      writeFileSync(pkgAbsPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      modifiedFiles.add(pkgRelPath);
    }
  }

  syncDaggerConst(cwd, "BUN_VERSION", version, modifiedFiles);
}

function syncDaggerConst(
  cwd: string,
  constName: "NODE_VERSION" | "BUN_VERSION",
  version: string,
  modifiedFiles: Set<string>,
): void {
  const daggerIndexPath = resolve(cwd, ".dagger/src/index.ts");
  if (!existsSync(daggerIndexPath)) return;
  const content = readFileSync(daggerIndexPath, "utf8");
  const pattern = new RegExp(`(const ${constName} = ")[^"]+(";)`);
  const next = content.replace(pattern, `$1${version}$2`);
  if (next !== content) {
    writeFileSync(daggerIndexPath, next, "utf8");
    modifiedFiles.add(".dagger/src/index.ts");
  }
}

function syncDaggerEngineVersion(cwd: string, version: string, modifiedFiles: Set<string>): void {
  const daggerJsonPath = resolve(cwd, "dagger.json");
  if (!existsSync(daggerJsonPath)) return;
  const parsed = JSON.parse(readFileSync(daggerJsonPath, "utf8")) as Record<string, unknown>;
  const expected = version.startsWith("v") ? version : `v${version}`;
  if (parsed.engineVersion !== expected) {
    parsed.engineVersion = expected;
    writeFileSync(daggerJsonPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    modifiedFiles.add("dagger.json");
  }
}

export function applyUpdatesToWorkingTree(
  cwd: string,
  updates: readonly PlannedUpdate[],
): string[] {
  const modifiedFiles = new Set<string>();
  let syncedBunVersion: string | undefined;

  const bunByFile = new Map<string, PlannedUpdate[]>();
  const regexUpdates: PlannedUpdate[] = [];

  for (const update of updates) {
    if (update.manager === "bun") {
      const list = bunByFile.get(update.packageFile) ?? [];
      list.push(update);
      bunByFile.set(update.packageFile, list);
    } else {
      regexUpdates.push(update);
    }
  }

  for (const [relPath, fileUpdates] of bunByFile) {
    const absPath = resolve(cwd, relPath);
    if (!existsSync(absPath)) {
      throw new RenovateSyncError(`Target package file not found: ${relPath}`);
    }
    const pkg = JSON.parse(readFileSync(absPath, "utf8")) as Record<string, unknown>;
    let changed = false;

    for (const update of fileUpdates) {
      if (update.depType === "packageManager") {
        const nextPm = formatPackageManagerValue(update.newValue);
        if (pkg.packageManager !== nextPm) {
          pkg.packageManager = nextPm;
          changed = true;
        }
        syncedBunVersion = stripBunPrefix(update.newValue);
        continue;
      }

      if (!update.depType || !PACKAGE_JSON_DEP_FIELDS.has(update.depType)) {
        continue;
      }

      const section = pkg[update.depType];
      if (!isPlainObject(section) || typeof section[update.depName] !== "string") {
        throw new RenovateSyncError(
          `Dependency '${update.depName}' not found in ${relPath} (${update.depType}).`,
        );
      }
      if (section[update.depName] !== update.newValue) {
        section[update.depName] = update.newValue;
        changed = true;
      }
    }

    if (changed) {
      writeFileSync(absPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
      modifiedFiles.add(relPath);
    }
  }

  for (const update of regexUpdates) {
    const absPath = resolve(cwd, update.packageFile);
    if (!existsSync(absPath)) {
      throw new RenovateSyncError(`Target text file not found: ${update.packageFile}`);
    }
    const content = readFileSync(absPath, "utf8");
    let nextContent: string;

    if (update.replaceString !== undefined) {
      const nextSnippet = replaceExactSingle(
        update.replaceString,
        update.currentValue,
        update.newValue,
        `${update.packageFile} (${update.depName} snippet)`,
      );
      nextContent = replaceExactSingle(
        content,
        update.replaceString,
        nextSnippet,
        `${update.packageFile} (${update.depName})`,
      );
    } else {
      nextContent = replaceExactSingle(
        content,
        update.currentValue,
        update.newValue,
        `${update.packageFile} (${update.depName})`,
      );
    }

    if (nextContent !== content) {
      writeFileSync(absPath, nextContent, "utf8");
      modifiedFiles.add(update.packageFile);
    }

    if (update.packageFile === ".bun-version") {
      syncedBunVersion = update.newValue;
    } else if (update.packageFile === ".node-version") {
      syncDaggerConst(cwd, "NODE_VERSION", update.newValue, modifiedFiles);
    } else if (
      update.packageFile === ".buildkite/pipeline.yml" &&
      update.depName === "dagger/dagger"
    ) {
      syncDaggerEngineVersion(cwd, update.newValue, modifiedFiles);
    }
  }

  if (syncedBunVersion !== undefined) {
    syncBunVersionFiles(cwd, syncedBunVersion, modifiedFiles);
  }

  return [...modifiedFiles];
}

export function defaultRunCommand(
  program: string,
  args: readonly string[],
  cwd: string,
): CommandResult {
  const result = spawnSync(program, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    throw new RenovateSyncError(`Failed to execute '${program}': ${result.error.message}`);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function requireSuccess(
  run: CommandRunner,
  program: string,
  args: readonly string[],
  cwd: string,
): string {
  const res = run(program, args, cwd);
  if (res.status !== 0) {
    const detail = [res.stderr.trim(), res.stdout.trim()].filter(Boolean).join("\n");
    throw new RenovateSyncError(
      `Command '${program} ${args.join(" ")}' failed with exit code ${res.status}${detail ? `:\n${detail}` : ""}`,
    );
  }
  return res.stdout;
}

export function formatSummaryBody(updates: readonly PlannedUpdate[]): string {
  const lines = updates.map(
    (u) => `- \`${u.depName}\` (${u.packageFile}): \`${u.currentValue}\` -> \`${u.newValue}\``,
  );
  return ["Automated weekly dependency updates:", "", ...lines].join("\n");
}

export function formatTrailTable(updates: readonly PlannedUpdate[]): string {
  const rows = updates.map(
    (u) =>
      `| \`${u.depName}\` | \`${u.packageFile}\` | \`${u.currentValue}\` | \`${u.newValue}\` |`,
  );
  return [
    "Weekly dependency updates detected by Renovate:",
    "",
    "| Dependency | File | Current | New |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

interface TrailListItem {
  id?: string;
  number?: number;
  title?: string;
  status?: string;
  branch?: string;
  changes?: { branch?: string }[];
}

function findOpenRenovateTrail(rawJson: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    throw new RenovateSyncError(
      `Invalid JSON from 'entire trail list --json': ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const items: TrailListItem[] = Array.isArray(parsed)
    ? (parsed as TrailListItem[])
    : isPlainObject(parsed) && Array.isArray(parsed.items)
      ? (parsed.items as TrailListItem[])
      : [];

  const match = items.find((item) => {
    if (item.status && item.status !== "open") return false;
    if (item.branch === RENOVATE_BRANCH) return true;
    if (item.changes?.some((change) => change.branch === RENOVATE_BRANCH)) return true;
    return item.title === COMMIT_TITLE;
  });

  if (!match) return null;
  if (typeof match.number === "number") return String(match.number);
  if (typeof match.id === "string" && match.id) return match.id;
  return null;
}

export function runRenovateSync(reportPath: string, deps: SyncDependencies = {}): SyncOutcome {
  const cwd = deps.cwd ?? resolve(fileURLToPath(new URL("..", import.meta.url)));
  const project = deps.project ?? DEFAULT_ENTIRE_PROJECT;
  const run = deps.runCommand ?? defaultRunCommand;

  if (!existsSync(reportPath)) {
    throw new RenovateSyncError(`Renovate report file not found: ${reportPath}`);
  }

  let rawReport: unknown;
  try {
    rawReport = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (error) {
    throw new RenovateSyncError(
      `Failed to parse Renovate report JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const report = validateRenovateReport(rawReport);
  const updates = extractPlannedUpdates(report);

  if (updates.length === 0) {
    return { status: "no-updates", updates: [], modifiedFiles: [] };
  }

  requireSuccess(run, "git", ["fetch", "origin"], cwd);
  requireSuccess(run, "git", ["checkout", "-B", RENOVATE_BRANCH, `origin/${BASE_BRANCH}`], cwd);

  const appliedFiles = applyUpdatesToWorkingTree(cwd, updates);

  requireSuccess(run, "bun", ["install"], cwd);
  if (appliedFiles.includes(".dagger/package.json")) {
    requireSuccess(run, "bun", ["install", "--cwd", ".dagger"], cwd);
  }
  requireSuccess(run, "bun", ["run", "check"], cwd);

  const diffMain = run("git", ["diff", "--quiet", "HEAD", "--", ...ALLOWED_SCOPE_FILES], cwd);
  if (diffMain.status === 0) {
    return { status: "no-op-main", updates, modifiedFiles: [] };
  }

  const remoteRef = `refs/remotes/origin/${RENOVATE_BRANCH}`;
  const hasRemoteBranch =
    run("git", ["rev-parse", "--verify", "--quiet", remoteRef], cwd).status === 0;
  if (hasRemoteBranch) {
    const diffRemote = run(
      "git",
      ["diff", "--quiet", `origin/${RENOVATE_BRANCH}`, "--", ...ALLOWED_SCOPE_FILES],
      cwd,
    );
    if (diffRemote.status === 0) {
      return { status: "no-op-remote", updates, modifiedFiles: [] };
    }
  }

  const statusOut = requireSuccess(
    run,
    "git",
    ["status", "--porcelain", "--", ...ALLOWED_SCOPE_FILES],
    cwd,
  );
  const modifiedFiles = statusOut
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  if (modifiedFiles.length === 0) {
    return { status: "no-op-main", updates, modifiedFiles: [] };
  }

  requireSuccess(run, "git", ["add", "--", ...modifiedFiles], cwd);
  const commitBody = formatSummaryBody(updates);
  requireSuccess(run, "git", ["commit", "-m", COMMIT_TITLE, "-m", commitBody], cwd);
  requireSuccess(run, "git", ["push", "--force-with-lease", "origin", RENOVATE_BRANCH], cwd);

  const trailListOut = requireSuccess(
    run,
    "entire",
    ["trail", "list", "--project", project, "--status", "open", "--json"],
    cwd,
  );
  const existingTrail = findOpenRenovateTrail(trailListOut);
  const trailBody = formatTrailTable(updates);

  if (existingTrail) {
    requireSuccess(
      run,
      "entire",
      [
        "trail",
        "comment",
        "add",
        "--trail",
        existingTrail,
        "--branch",
        RENOVATE_BRANCH,
        "--body",
        trailBody,
        "--json",
      ],
      cwd,
    );
    return { status: "commented-trail", updates, modifiedFiles };
  }

  requireSuccess(
    run,
    "entire",
    [
      "trail",
      "create",
      "--title",
      COMMIT_TITLE,
      "--type",
      "task",
      "--base",
      BASE_BRANCH,
      "--branch",
      RENOVATE_BRANCH,
      "--body",
      trailBody,
      "--json",
    ],
    cwd,
  );
  return { status: "created-trail", updates, modifiedFiles };
}

export function parseReportPathArg(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): string {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--report-path") {
      const next = argv[i + 1];
      if (!next) {
        throw new RenovateSyncError("Missing value for --report-path.");
      }
      return next;
    }
    if (arg.startsWith("--report-path=")) {
      const value = arg.slice("--report-path=".length);
      if (!value) {
        throw new RenovateSyncError("Missing value for --report-path=.");
      }
      return value;
    }
  }

  const positional = argv.find((arg) => !arg.startsWith("-"));
  if (positional) return positional;

  const fromEnv = env.RENOVATE_REPORT_PATH?.trim();
  if (fromEnv) return fromEnv;

  throw new RenovateSyncError(
    "Usage: bun scripts/renovate-sync.ts --report-path <path-to-renovate-report.json>",
  );
}

if (import.meta.main) {
  try {
    const reportPath = parseReportPathArg(process.argv.slice(2));
    const outcome = runRenovateSync(reportPath);
    console.log(`renovate-sync: ${outcome.status} (${outcome.updates.length} update(s))`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
