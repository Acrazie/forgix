#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { intro, isCancel, note, outro, select, text } from "@clack/prompts";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_RELEASE_PATHS,
  captureFileSnapshots,
  compareVersions,
  createReleasePlan,
  incrementVersion,
  parseStableVersion,
  recommendBump,
  ReleaseError,
  replaceJsonVersion,
  replaceMarketplacePluginVersion,
  requireCommand,
  restoreFileSnapshots,
  runCommand,
  validateVersions,
  type ReleasePlan,
  type VersionBump,
} from "./release-lib.ts";
import { assertAllowedReleaseChanges, prependReleaseChangelog } from "./release-files.ts";
import { git, previousTag } from "./release-notes.ts";
import { syncGithubMirror } from "./sync-github-mirror.ts";

const DEFAULT_MIRROR_TARGET = "git@github.com:Acrazie/forgix.git";
const BUMPS = new Set<string>(["patch", "minor", "major"]);

export interface ReleaseCliOptions {
  versionArg?: string;
  dryRun: boolean;
  noMirror: boolean;
  mirrorTarget: string;
}

export function parseReleaseArgs(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): ReleaseCliOptions {
  let versionArg: string | undefined;
  let dryRun = false;
  let noMirror = false;
  let mirrorTarget = env.FORGIX_MIRROR_TARGET || DEFAULT_MIRROR_TARGET;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--no-mirror") {
      noMirror = true;
    } else if (arg === "--mirror-target" && argv[i + 1]) {
      mirrorTarget = argv[++i]!;
    } else if (!arg.startsWith("-") && !versionArg) {
      versionArg = arg;
    } else {
      throw new ReleaseError(
        `Unknown argument "${arg}". Usage: bun run release [patch|minor|major|X.Y.Z] [--dry-run] [--no-mirror] [--mirror-target <url>]`,
      );
    }
  }
  return { ...(versionArg ? { versionArg } : {}), dryRun, noMirror, mirrorTarget };
}

async function run(
  root: string,
  command: string,
  args: string[],
  signal: AbortSignal,
): Promise<void> {
  await new Promise<void>((done, fail) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: false, signal });
    child.once("error", fail);
    child.once("close", (code) => {
      if (code === 0) done();
      else fail(new ReleaseError(`${command} ${args.join(" ")} failed.`));
    });
  });
}

function answer<T>(value: T | symbol): T {
  if (isCancel(value)) throw new ReleaseError("Release cancelled.");
  return value;
}

function verifyCleanSyncedMain(root: string): void {
  if (process.platform === "win32") {
    throw new ReleaseError("Release supports Linux and macOS.");
  }
  if (git(root, ["branch", "--show-current"]) !== "main") {
    throw new ReleaseError("Release must run from a clean, synchronized main branch.");
  }
  if (git(root, ["status", "--porcelain=v1", "--untracked-files=all"])) {
    throw new ReleaseError("Release requires a clean worktree.");
  }
  git(root, ["fetch", "origin", "main", "--tags"]);
  if (git(root, ["rev-parse", "HEAD"]) !== git(root, ["rev-parse", "origin/main"])) {
    throw new ReleaseError("Local main must match origin/main before releasing.");
  }
}

async function resolveNextVersion(
  root: string,
  currentVersion: string,
  versionArg?: string,
): Promise<string> {
  if (versionArg) {
    if (BUMPS.has(versionArg)) return incrementVersion(currentVersion, versionArg as VersionBump);
    parseStableVersion(versionArg);
    if (compareVersions(versionArg, currentVersion) <= 0) {
      throw new ReleaseError("Next version must be greater than current package version.");
    }
    return versionArg;
  }
  const base = previousTag(root);
  const commits = git(root, ["log", base ? `${base}..HEAD` : "HEAD", "--format=%s%n%b%x00"]).split(
    "\0",
  );
  const bump = answer(
    await select<VersionBump | "custom">({
      message: `Next version (current: ${currentVersion})`,
      initialValue: recommendBump(commits),
      options: [
        ...(["patch", "minor", "major"] as const).map((value) => ({
          value,
          label: `${value}: ${incrementVersion(currentVersion, value)}`,
        })),
        { value: "custom", label: "Custom stable version" },
      ],
    }),
  );
  if (bump !== "custom") return incrementVersion(currentVersion, bump);
  return answer(
    await text({
      message: "Next stable version",
      validate(value) {
        try {
          parseStableVersion(value ?? "");
          return compareVersions(value ?? "", currentVersion) > 0
            ? undefined
            : "Version must increase.";
        } catch {
          return "Expected stable SemVer.";
        }
      },
    }),
  );
}

async function writeReleaseFiles(
  root: string,
  plan: ReleasePlan,
  signal: AbortSignal,
): Promise<string> {
  const pkgPath = resolve(root, "package.json");
  await writeFile(pkgPath, replaceJsonVersion(await readFile(pkgPath, "utf8"), plan.version));
  await run(root, "bun", ["install", "--lockfile-only", "--ignore-scripts"], signal);
  await Promise.all(
    [
      [".codex-plugin/plugin.json", plan.pluginVersion],
      [".claude-plugin/plugin.json", plan.version],
      ["plugin.json", plan.version],
    ].map(async ([relative, version]) => {
      const path = resolve(root, relative!);
      await writeFile(path, replaceJsonVersion(await readFile(path, "utf8"), version!));
    }),
  );
  const marketPath = resolve(root, ".claude-plugin/marketplace.json");
  await writeFile(
    marketPath,
    replaceMarketplacePluginVersion(await readFile(marketPath, "utf8"), "forgix", plan.version),
  );
  validateVersions(root, plan.tag);
  return prependReleaseChangelog(root, plan.tag, new Date());
}

function rollbackLocalRelease(
  root: string,
  tag: string,
  releaseBranch: string,
  beforeSha: string,
): void {
  try {
    if (git(root, ["branch", "--show-current"]) !== "main") {
      git(root, ["checkout", "-f", "main"]);
    }
    if (git(root, ["branch", "--list", releaseBranch])) {
      git(root, ["branch", "-D", releaseBranch]);
    }
    if (git(root, ["tag", "--list", tag])) git(root, ["tag", "-d", tag]);
    if (git(root, ["rev-parse", "HEAD"]) !== beforeSha) {
      git(root, ["reset", "--hard", beforeSha]);
    }
  } catch {
    /* Best-effort local rollback when release merge never completed. */
  }
}

const TRAIL_MERGE_POLL_MS = 15_000;
const TRAIL_MERGE_TIMEOUT_MS = 15 * 60_000;

async function mergeReleaseTrail(
  root: string,
  releaseBranch: string,
  deadline = Date.now() + TRAIL_MERGE_TIMEOUT_MS,
): Promise<void> {
  const result = runCommand(
    "entire",
    ["trail", "merge", "--branch", releaseBranch, "--delete-branch"],
    { cwd: root },
  );
  if (result.status === 0) return;
  const output = `${result.stdout}\n${result.stderr}`.trim();
  const pending = /CI checks are still running|pending/i.test(output);
  if (!pending || Date.now() >= deadline) {
    throw new ReleaseError(`entire trail merge failed: ${output}`);
  }
  process.stdout.write(`Waiting for Buildkite CI on ${releaseBranch}...\n`);
  await new Promise((done) => setTimeout(done, TRAIL_MERGE_POLL_MS));
  return mergeReleaseTrail(root, releaseBranch, deadline);
}

async function landReleaseOnMain(
  root: string,
  plan: ReleasePlan,
  changes: readonly string[],
  releaseBranch: string,
): Promise<void> {
  git(root, ["checkout", "-b", releaseBranch]);
  git(root, ["add", "-f", "--", ...changes]);
  git(root, ["commit", "-m", plan.commitMessage]);
  git(root, ["push", "-u", "origin", releaseBranch]);
  requireCommand(
    "entire",
    [
      "trail",
      "create",
      "--title",
      plan.commitMessage,
      "--type",
      "task",
      "--base",
      "main",
      "--branch",
      releaseBranch,
      "--json",
    ],
    { cwd: root },
  );
  await mergeReleaseTrail(root, releaseBranch);
  git(root, ["checkout", "main"]);
  git(root, ["pull", "--ff-only", "origin", "main"]);
  git(root, ["branch", "-D", releaseBranch]);
}

function syncReleaseMirror(root: string, tag: string, mirrorTarget: string): void {
  try {
    syncGithubMirror({
      sourceRepoDir: root,
      target: mirrorTarget,
      branch: "main",
      sourceRef: tag,
      tag,
      apply: true,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ReleaseError(
      `Entire push succeeded for ${tag}, but GitHub mirror sync failed: ${detail}\nRetry with:\n  bun scripts/sync-github-mirror.ts --target ${mirrorTarget} --source-ref ${tag} --tag ${tag} --apply`,
    );
  }
}

async function publishRelease(
  root: string,
  plan: ReleasePlan,
  changes: readonly string[],
  options: ReleaseCliOptions,
): Promise<void> {
  const beforeSha = git(root, ["rev-parse", "HEAD"]);
  const releaseBranch = `release/${plan.tag}`;
  let mergedMain = false;
  try {
    await landReleaseOnMain(root, plan, changes, releaseBranch);
    mergedMain = true;
    git(root, ["tag", "-a", plan.tag, "-m", plan.commitMessage]);
    git(root, ["push", "origin", `refs/tags/${plan.tag}`]);
  } catch (error) {
    if (!mergedMain) rollbackLocalRelease(root, plan.tag, releaseBranch, beforeSha);
    throw error;
  }
  if (!options.noMirror) syncReleaseMirror(root, plan.tag, options.mirrorTarget);
}

async function main(): Promise<void> {
  const options = parseReleaseArgs(process.argv.slice(2));
  const scriptDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const root = requireCommand("git", ["rev-parse", "--show-toplevel"], {
    cwd: scriptDir,
  }).stdout.trim();
  verifyCleanSyncedMain(root);
  intro(options.dryRun ? "Forgix release (dry-run)" : "Forgix one-step release (plugin + npm)");
  const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as {
    version: string;
  };
  const nextVersion = await resolveNextVersion(root, pkg.version, options.versionArg);
  const plan = createReleasePlan({
    currentPackageVersion: pkg.version,
    nextVersion,
    now: new Date(),
  });
  if (git(root, ["tag", "--list", plan.tag])) {
    throw new ReleaseError(`Release tag ${plan.tag} already exists.`);
  }
  const snapshots = await captureFileSnapshots(
    [...ALLOWED_RELEASE_PATHS].map((path) => resolve(root, path)),
  );
  const controller = new AbortController();
  const interrupted = () => controller.abort();
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  let committed = false;
  try {
    const notes = await writeReleaseFiles(root, plan, controller.signal);
    controller.signal.throwIfAborted();
    await run(root, "bun", ["run", "check"], controller.signal);
    controller.signal.throwIfAborted();
    const changes = assertAllowedReleaseChanges(root);
    note(notes, "Release notes");
    if (options.dryRun) {
      outro(`Dry-run complete for ${plan.tag}; all files restored.`);
      return;
    }
    await publishRelease(root, plan, changes, options);
    committed = true;
    outro(
      options.noMirror
        ? `Released ${plan.tag} to Entire (mirror sync skipped).`
        : `Released ${plan.tag} to Entire and GitHub mirror. GitHub Actions will publish @acrasie/forgix@${plan.version} via npm OIDC.`,
    );
  } finally {
    process.removeListener("SIGINT", interrupted);
    process.removeListener("SIGTERM", interrupted);
    if (!committed) await restoreFileSnapshots(snapshots);
  }
}

if (import.meta.main)
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
