#!/usr/bin/env bun

import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
  spinner,
  text
} from "@clack/prompts";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareVersions,
  captureFileSnapshots,
  createReleasePlan,
  incrementVersion,
  normalizeGitOutput,
  parsePorcelainPaths,
  parseReleaseCommit,
  parseStableVersion,
  recommendBump,
  ReleaseError,
  requireCommand,
  restoreFileSnapshots,
  runCommand,
  semanticBase,
  unexpectedReleasePaths,
  validatePluginManifest,
  type ReleaseMode,
  type ReleasePlan,
  type ReleaseTarget,
  type VersionBump,
  type PublicationState
} from "../src/release.ts";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = requireCommand("git", ["rev-parse", "--show-toplevel"], { cwd: pluginRoot }).stdout.trim();
const packagePath = resolve(pluginRoot, "package.json");
const manifestPath = resolve(pluginRoot, ".codex-plugin/plugin.json");
const lockPath = resolve(pluginRoot, "bun.lock");
const bundlePath = resolve(pluginRoot, "dist/dev-flow.mjs");
const marketplace = "acrazie";
const packageName = "codex-dev-flow";

let cleanup: (() => Promise<void>) | undefined;
let externalPublicationStarted = false;
let cleaning = false;

function cancelled(value: unknown): value is symbol {
  return isCancel(value);
}

async function abortFromPrompt(): Promise<never> {
  cancel("Release cancelled.");
  if (cleanup && !externalPublicationStarted) await cleanup();
  process.exit(0);
}

function displayError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function runCheck(
  label: string,
  command: string,
  args: readonly string[],
  cwd = repoRoot,
  interactive = false
): void {
  if (interactive) {
    log.step(label);
    const result = runCommand(command, args, { cwd, stdio: "inherit" });
    if (result.status !== 0) throw new ReleaseError(`${label} failed.`);
    log.success(label);
    return;
  }
  const progress = spinner();
  progress.start(label);
  const result = runCommand(command, args, { cwd });
  if (result.status !== 0) {
    progress.error(label);
    const detail = (result.stderr || result.stdout).trim();
    throw new ReleaseError(`${label} failed${detail ? `: ${detail}` : "."}`);
  }
  progress.stop(label);
}

function git(args: readonly string[]): string {
  return normalizeGitOutput(requireCommand("git", args, { cwd: repoRoot }).stdout);
}

function assertSupportedPlatform(): void {
  if (process.platform === "win32") {
    throw new ReleaseError("Windows is not supported by release workflow V1. Use macOS; Linux is best-effort.");
  }
}

function assertCleanMain(): void {
  const branch = git(["branch", "--show-current"]);
  if (branch !== "main") throw new ReleaseError(`Release requires branch "main"; current branch is "${branch}".`);
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status) throw new ReleaseError("Release requires a clean worktree. Commit, stash, or remove local changes.");
}

function syncMain(mode: ReleaseMode): void {
  const localHead = git(["rev-parse", "HEAD"]);
  if (mode === "preview") {
    const remote = requireCommand("git", ["ls-remote", "origin", "refs/heads/main"], { cwd: repoRoot }).stdout;
    const remoteHead = remote.split(/\s/)[0];
    if (!remoteHead || remoteHead !== localHead) {
      throw new ReleaseError("Preview requires local main to equal origin/main. Run `git pull --ff-only` first.");
    }
    return;
  }

  runCheck("Fetch origin/main", "git", ["fetch", "origin", "main"]);
  const remoteHead = git(["rev-parse", "origin/main"]);
  const mergeBase = git(["merge-base", "HEAD", "origin/main"]);
  if (localHead === remoteHead) return;
  if (mergeBase === localHead) {
    runCheck("Fast-forward main", "git", ["merge", "--ff-only", "origin/main"]);
    return;
  }
  if (mergeBase === remoteHead) {
    throw new ReleaseError("Local main is ahead of origin/main. Push or reconcile it manually.");
  }
  throw new ReleaseError("Local main and origin/main have diverged. Reconcile them manually.");
}

function assertAuthentication(target: ReleaseTarget): void {
  const gh = runCommand("gh", ["auth", "status"], { cwd: repoRoot });
  if (gh.status !== 0) throw new ReleaseError("GitHub authentication missing. Run `gh auth login`, then rerun.");
  if (target !== "plugin") {
    const npm = runCommand("bun", ["pm", "whoami"], { cwd: pluginRoot });
    if (npm.status !== 0) {
      throw new ReleaseError("npm authentication missing. Run `bunx npm login`, then rerun.");
    }
  }
}

async function npmVersionPublished(version: string): Promise<boolean> {
  const response = await fetch(`https://registry.npmjs.org/${packageName}/${version}`, {
    headers: { accept: "application/json" }
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new ReleaseError(`npm registry check failed with HTTP ${response.status}.`);
  return true;
}

function remoteTagCommit(tag: string): string | null {
  const output = requireCommand("git", ["ls-remote", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`], {
    cwd: repoRoot
  }).stdout.trim();
  if (!output) return null;
  const peeled = output
    .split("\n")
    .find((line) => line.endsWith(`refs/tags/${tag}^{}`));
  return (peeled ?? output.split("\n")[0]!).split(/\s/)[0] ?? null;
}

function githubReleaseExists(tag: string): boolean {
  return runCommand("gh", ["release", "view", tag, "--json", "tagName"], { cwd: repoRoot }).status === 0;
}

function remoteMainCommit(): string | null {
  const output = requireCommand("git", ["ls-remote", "origin", "refs/heads/main"], { cwd: repoRoot }).stdout.trim();
  return output ? output.split(/\s/)[0] ?? null : null;
}

async function externalState(plan: ReleasePlan, head: string): Promise<PublicationState> {
  const tagCommit = remoteTagCommit(plan.tag);
  return {
    pushed: remoteMainCommit() === head && tagCommit === head,
    npmPublished: plan.target === "plugin" ? true : await npmVersionPublished(plan.packageVersion),
    githubRelease: githubReleaseExists(plan.tag)
  };
}

function repositorySlug(): string {
  const url = git(["remote", "get-url", "origin"]);
  const match =
    /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url) ??
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url);
  if (!match) throw new ReleaseError(`Cannot derive GitHub repository from origin "${url}".`);
  return `${match[1]}/${match[2]}`;
}

function generateNotes(tag: string): string {
  const result = requireCommand(
    "gh",
    [
      "api",
      "--method",
      "POST",
      `repos/${repositorySlug()}/releases/generate-notes`,
      "-f",
      `tag_name=${tag}`,
      "-f",
      "target_commitish=main",
      "--jq",
      ".body"
    ],
    { cwd: repoRoot }
  );
  return result.stdout.trim() || `Release ${tag}`;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

function currentVersions(packageJson: Record<string, unknown>, manifest: Record<string, unknown>): {
  packageVersion: string;
  pluginVersion: string;
} {
  if (typeof packageJson.version !== "string") throw new ReleaseError("package.json version is missing.");
  if (typeof manifest.version !== "string") throw new ReleaseError("plugin.json version is missing.");
  parseStableVersion(packageJson.version);
  semanticBase(manifest.version);
  return { packageVersion: packageJson.version, pluginVersion: manifest.version };
}

function commitsSinceLastTag(): string[] {
  const latest = runCommand("git", ["describe", "--tags", "--abbrev=0"], { cwd: repoRoot });
  const range = latest.status === 0 ? `${latest.stdout.trim()}..HEAD` : "HEAD";
  const output = git(["log", range, "--format=%s%n%b%x00"]);
  return output ? output.split("\0").filter(Boolean) : [];
}

async function chooseTarget(): Promise<ReleaseTarget> {
  const answer = await select<ReleaseTarget>({
    message: "Release target",
    initialValue: "both",
    options: [
      { value: "both", label: "Plugin + npm", hint: "recommended" },
      { value: "plugin", label: "Codex plugin" },
      { value: "npm", label: "npm package" }
    ]
  });
  if (cancelled(answer)) return abortFromPrompt();
  return answer;
}

async function chooseMode(): Promise<ReleaseMode> {
  const answer = await select<ReleaseMode>({
    message: "Action",
    initialValue: "publish",
    options: [
      { value: "publish", label: "Prepare and publish" },
      { value: "preview", label: "Preview only", hint: "read-only" }
    ]
  });
  if (cancelled(answer)) return abortFromPrompt();
  return answer;
}

async function chooseVersion(current: string, recommendation: VersionBump): Promise<string> {
  const versions = {
    patch: incrementVersion(current, "patch"),
    minor: incrementVersion(current, "minor"),
    major: incrementVersion(current, "major")
  };
  const answer = await select<VersionBump | "custom">({
    message: `Next npm version (recommended: ${recommendation})`,
    initialValue: recommendation,
    options: [
      { value: "patch", label: `Patch — ${versions.patch}`, ...(recommendation === "patch" ? { hint: "recommended" } : {}) },
      { value: "minor", label: `Minor — ${versions.minor}`, ...(recommendation === "minor" ? { hint: "recommended" } : {}) },
      { value: "major", label: `Major — ${versions.major}`, ...(recommendation === "major" ? { hint: "recommended" } : {}) },
      { value: "custom", label: "Custom stable version" }
    ]
  });
  if (cancelled(answer)) return abortFromPrompt();
  if (answer !== "custom") return versions[answer];

  const custom = await text({
    message: "Custom stable version",
    placeholder: versions[recommendation],
    validate(value) {
      try {
        if (!value) return "Version required.";
        parseStableVersion(value);
        if (compareVersions(value, current) <= 0) return `Version must be greater than ${current}.`;
      } catch (error) {
        return displayError(error);
      }
    }
  });
  if (cancelled(custom)) return abortFromPrompt();
  return custom;
}

function planSummary(plan: ReleasePlan, mode: ReleaseMode): string {
  const files = [...new Set([
    ...(plan.target !== "npm" ? [".codex-plugin/plugin.json"] : []),
    ...(plan.target !== "plugin" ? ["package.json", "bun.lock"] : []),
    "dist/dev-flow.mjs"
  ])];
  return [
    `Action: ${mode === "preview" ? "preview only" : "prepare and publish"}`,
    `Target: ${plan.target}`,
    `npm: ${plan.packageVersion}`,
    `Plugin: ${plan.pluginVersion}`,
    `Tag: ${plan.tag}`,
    `Files: ${files.join(", ")}`,
    "Checks: auth, Git sync, frozen install, typecheck, build, tests, manifest, package dry-run, availability",
    `Order: push → ${plan.target === "plugin" ? "" : "bun publish → "}GitHub Release${plan.target === "npm" ? "" : " → optional local install"}`
  ].join("\n");
}

function validateChangedPaths(plan: ReleasePlan): string[] {
  const output = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  const paths = parsePorcelainPaths(output);
  const unexpected = unexpectedReleasePaths(paths, plan.target);
  if (unexpected.length) {
    throw new ReleaseError(`Unexpected generated files: ${unexpected.join(", ")}`);
  }
  return paths;
}

async function runPreflightValidations(target: ReleaseTarget, readOnly: boolean): Promise<void> {
  runCheck(
    "Frozen Bun install",
    "bun",
    ["install", "--frozen-lockfile", ...(readOnly ? ["--dry-run"] : [])],
    pluginRoot
  );
  runCheck("Typecheck", "bun", ["run", "typecheck"], pluginRoot);
  runCheck("Deterministic build", "bun", ["run", "build"], pluginRoot);
  runCheck("Test suite", "bun", ["run", "test"], pluginRoot);
  runCheck("Release tests", "bun", ["run", "release:test"], pluginRoot);

  const manifest = await readJson(manifestPath);
  validatePluginManifest(manifest);
  if (target !== "plugin") {
    runCheck("npm package content", "bun", ["pm", "pack", "--dry-run", "--ignore-scripts"], pluginRoot);
  }
}

async function runPreparedValidations(plan: ReleasePlan): Promise<void> {
  runCheck("Frozen Bun install", "bun", ["install", "--frozen-lockfile"], pluginRoot);
  validatePluginManifest(await readJson(manifestPath));
  if (plan.target !== "plugin") {
    runCheck(
      "npm package dry-run",
      "bun",
      ["publish", "--dry-run", "--ignore-scripts", "--access", "public"],
      pluginRoot
    );
  }
}

async function assertVersionsAvailable(plan: ReleasePlan): Promise<void> {
  if (runCommand("git", ["show-ref", "--verify", "--quiet", `refs/tags/${plan.tag}`], { cwd: repoRoot }).status === 0) {
    throw new ReleaseError(`Local Git tag "${plan.tag}" already exists.`);
  }
  if (remoteTagCommit(plan.tag)) throw new ReleaseError(`Git tag "${plan.tag}" already exists on origin.`);
  if (githubReleaseExists(plan.tag)) throw new ReleaseError(`GitHub Release "${plan.tag}" already exists.`);
  if (plan.target !== "plugin" && (await npmVersionPublished(plan.packageVersion))) {
    throw new ReleaseError(`npm version ${packageName}@${plan.packageVersion} already exists.`);
  }
}

async function optionalLocalInstall(target: ReleaseTarget): Promise<void> {
  if (target === "npm") return;
  const answer = await confirm({
    message: "Refresh local Codex plugin now?",
    initialValue: false,
    active: "Yes",
    inactive: "No"
  });
  if (cancelled(answer) || !answer) {
    log.info("Local plugin unchanged. Start a new Codex thread after installing this release.");
    return;
  }
  runCheck("Upgrade marketplace", "codex", ["plugin", "marketplace", "upgrade", marketplace], repoRoot, true);
  runCheck("Install plugin", "codex", ["plugin", "add", `${packageName}@${marketplace}`], repoRoot, true);
  log.info("Start a new Codex thread to load updated plugin.");
}

async function publishMissing(plan: ReleasePlan, notes: string, state: PublicationState): Promise<void> {
  if (!state.pushed) {
    const head = git(["rev-parse", "HEAD"]);
    const remoteTag = remoteTagCommit(plan.tag);
    if (remoteTag && remoteTag !== head) {
      throw new ReleaseError(`Remote tag "${plan.tag}" does not point to release commit.`);
    }
    runCheck(
      "Push release commit and tag",
      "git",
      ["push", "--atomic", "origin", "main", ...(remoteTag ? [] : [`refs/tags/${plan.tag}`])],
      repoRoot,
      true
    );
    externalPublicationStarted = true;
  }
  if (!state.npmPublished && plan.target !== "plugin") {
    externalPublicationStarted = true;
    runCheck("Publish npm package", "bun", ["publish", "--access", "public"], pluginRoot, true);
  }
  if (!state.githubRelease) {
    externalPublicationStarted = true;
    runCheck(
      "Create GitHub Release",
      "gh",
      ["release", "create", plan.tag, "--verify-tag", "--title", plan.tag, "--notes", notes]
    );
  }
}

async function maybeResumePartialRelease(): Promise<boolean> {
  const subject = git(["log", "-1", "--pretty=%s"]);
  const release = parseReleaseCommit(subject);
  if (!release) return false;
  const packageJson = await readJson(packagePath);
  const manifest = await readJson(manifestPath);
  const versions = currentVersions(packageJson, manifest);
  if (release.target !== "plugin" && versions.packageVersion !== release.version) {
    throw new ReleaseError("Release commit identity does not match package.json version.");
  }
  if (release.target !== "npm" && semanticBase(versions.pluginVersion) !== release.version) {
    throw new ReleaseError("Release commit identity does not match plugin manifest version.");
  }
  if (
    release.target === "plugin" &&
    release.identity !== `plugin-v${versions.pluginVersion.replace("+codex.", "-codex.")}`
  ) {
    throw new ReleaseError("Plugin release identity does not match manifest cachebuster.");
  }
  const plan: ReleasePlan = {
    target: release.target,
    identity: release.identity,
    tag: release.identity,
    commitMessage: subject,
    packageVersion: versions.packageVersion,
    pluginVersion: versions.pluginVersion
  };

  const head = git(["rev-parse", "HEAD"]);
  const localTag = runCommand("git", ["rev-parse", `${plan.tag}^{}`], { cwd: repoRoot });
  if (localTag.status === 0 && localTag.stdout.trim() !== head) {
    throw new ReleaseError(`Local tag "${plan.tag}" does not point to release commit.`);
  }
  const state = await externalState(plan, head);
  if (state.pushed && state.npmPublished && state.githubRelease) return false;

  assertAuthentication(plan.target);
  note(
    [
      `Tag/identity: ${plan.tag}`,
      `Push: ${state.pushed ? "complete" : "missing"}`,
      `npm: ${state.npmPublished ? "complete/not applicable" : "missing"}`,
      `GitHub Release: ${state.githubRelease ? "complete" : "missing"}`
    ].join("\n"),
    "Partial release detected"
  );
  const answer = await confirm({
    message: "Resume missing publication steps?",
    initialValue: true,
    active: "Yes",
    inactive: "No"
  });
  if (cancelled(answer) || !answer) return abortFromPrompt();
  if (!state.pushed && !remoteTagCommit(plan.tag) && localTag.status !== 0) {
    requireCommand("git", ["tag", "-a", plan.tag, "-m", plan.commitMessage], {
      cwd: repoRoot,
      stdio: "inherit"
    });
  }
  const notes = generateNotes(plan.tag);
  note(notes, "Generated GitHub release notes");
  await publishMissing(plan, notes, state);
  await optionalLocalInstall(plan.target);
  outro(`Release ${plan.tag} completed.`);
  return true;
}

async function prepareAndPublish(plan: ReleasePlan): Promise<void> {
  const originalHead = git(["rev-parse", "HEAD"]);
  const paths = [packagePath, manifestPath, lockPath, bundlePath];
  const snapshots = await captureFileSnapshots(paths);
  let indexTouched = false;
  let localCommitCreated = false;
  let localTagCreated = false;

  cleanup = async () => {
    if (cleaning || externalPublicationStarted) return;
    cleaning = true;
    try {
      if (localTagCreated) runCommand("git", ["tag", "-d", plan.tag], { cwd: repoRoot });
      if (localCommitCreated) {
        requireCommand("git", ["update-ref", "refs/heads/main", originalHead], { cwd: repoRoot });
      }
      if (indexTouched) {
        requireCommand("git", ["read-tree", originalHead], { cwd: repoRoot });
      }
      await restoreFileSnapshots(snapshots);
    } finally {
      cleaning = false;
    }
  };

  try {
    const packageJson = await readJson(packagePath);
    const manifest = await readJson(manifestPath);
    if (plan.target !== "plugin") {
      packageJson.version = plan.packageVersion;
      await writeJson(packagePath, packageJson);
      runCheck("Update Bun lock", "bun", ["install"], pluginRoot);
    }
    if (plan.target !== "npm") {
      manifest.version = plan.pluginVersion;
      await writeJson(manifestPath, manifest);
    }

    await runPreparedValidations(plan);
    const changedPaths = validateChangedPaths(plan);
    if (changedPaths.length === 0) throw new ReleaseError("Release produced no file changes.");

    requireCommand("git", ["add", "--", ...changedPaths], { cwd: repoRoot });
    indexTouched = true;
    requireCommand("git", ["commit", "-m", plan.commitMessage], { cwd: repoRoot, stdio: "inherit" });
    localCommitCreated = true;
    requireCommand("git", ["tag", "-a", plan.tag, "-m", plan.commitMessage], {
      cwd: repoRoot,
      stdio: "inherit"
    });
    localTagCreated = true;

    const notes = generateNotes(plan.tag);
    note(notes, "Generated GitHub release notes");
    note(planSummary(plan, "publish"), "Final release summary");
    const approved = await confirm({
      message: "Publish this release?",
      initialValue: false,
      active: "Yes",
      inactive: "No"
    });
    if (cancelled(approved) || !approved) return abortFromPrompt();

    const state: PublicationState = {
      pushed: false,
      npmPublished: plan.target === "plugin",
      githubRelease: false
    };
    await publishMissing(plan, notes, state);
    cleanup = undefined;
    await optionalLocalInstall(plan.target);
    outro(`Release ${plan.tag} completed.`);
  } catch (error) {
    if (!externalPublicationStarted) await cleanup?.();
    throw error;
  }
}

async function main(): Promise<void> {
  intro("Codex Dev Flow release");
  assertSupportedPlatform();
  assertCleanMain();

  if (await maybeResumePartialRelease()) return;

  const target = await chooseTarget();
  const mode = await chooseMode();
  assertAuthentication(target);
  syncMain(mode);
  assertCleanMain();
  if (await maybeResumePartialRelease()) return;

  const packageJson = await readJson(packagePath);
  const manifest = await readJson(manifestPath);
  validatePluginManifest(manifest);
  const current = currentVersions(packageJson, manifest);
  const recommendation = recommendBump(commitsSinceLastTag());
  const nextPackageVersion =
    target === "plugin" ? undefined : await chooseVersion(current.packageVersion, recommendation);
  const plan = createReleasePlan({
    target,
    currentPackageVersion: current.packageVersion,
    currentPluginVersion: current.pluginVersion,
    ...(nextPackageVersion ? { nextPackageVersion } : {}),
    now: new Date()
  });
  if (target !== "npm" && plan.pluginVersion === current.pluginVersion) {
    throw new ReleaseError("Generated plugin cachebuster matches current version. Wait one second and rerun.");
  }

  await assertVersionsAvailable(plan);
  note(planSummary(plan, mode), mode === "preview" ? "Read-only preview" : "Release preparation");

  if (mode === "preview") {
    const [bundleSnapshot] = await captureFileSnapshots([bundlePath]);
    try {
      await runPreflightValidations(target, true);
    } finally {
      if (bundleSnapshot) await restoreFileSnapshots([bundleSnapshot]);
    }
    assertCleanMain();
    outro("Preview complete. No files or remote systems changed.");
    return;
  }

  await runPreflightValidations(target, false);
  assertCleanMain();
  await prepareAndPublish(plan);
}

process.once("SIGINT", () => {
  void (async () => {
    if (cleanup && !externalPublicationStarted) await cleanup();
    process.exit(130);
  })();
});

try {
  await main();
} catch (error) {
  if (cleanup && !externalPublicationStarted) await cleanup();
  log.error(displayError(error));
  process.exitCode = 1;
}
