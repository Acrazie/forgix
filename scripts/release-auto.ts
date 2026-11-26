#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertContext } from "./release-ci.ts";
import {
  assertAllowedReleaseChanges,
  BOT_EMAIL,
  BOT_NAME,
  cleanupSupersededReleaseBranches,
  mergeReleaseBranch,
  prepareReleaseFilesInRepo,
  RELEASE_BRANCH_RE,
  upsertReleaseTrail,
  validateCommitVersions,
} from "./release-files.ts";
import {
  compareVersions,
  computeAutomatedBump,
  createReleasePlan,
  incrementVersion,
  isMajorBump,
  parseReleaseCommitTag,
  ReleaseError,
  releaseIdentity,
  requireCommand,
  validateVersions,
  type ReleasePlan,
} from "./release-lib.ts";
import { changelogSection, git, previousTag } from "./release-notes.ts";
import { syncGithubMirror } from "./sync-github-mirror.ts";

const DEFAULT_MIRROR_TARGET = "https://github.com/Acrazie/forgix.git";

function gitBot(root: string, args: readonly string[]): string {
  return git(root, [
    "-c",
    `user.name=${BOT_NAME}`,
    "-c",
    `user.email=${BOT_EMAIL}`,
    "-c",
    "commit.gpgsign=false",
    "-c",
    "tag.gpgSign=false",
    ...args,
  ]);
}

function ensureFullMainHistory(root: string): void {
  const gitDir = resolve(root, git(root, ["rev-parse", "--git-dir"]));
  if (existsSync(join(gitDir, "shallow"))) {
    git(root, ["fetch", "--unshallow"]);
  }
  git(root, ["fetch", "--tags", "origin", "+refs/heads/main:refs/remotes/origin/main"]);
}

export function tagUntaggedReleases(root: string, ref = "HEAD"): string[] {
  const base = previousTag(root, ref);
  const range = base ? `${base}..${ref}` : ref;
  const output = git(root, ["log", "--first-parent", "--reverse", "--format=%H%x1f%s", range]);
  const tagged: string[] = [];
  for (const line of output.split("\n").filter(Boolean)) {
    const [sha, subject] = line.split("\x1f");
    if (!sha || !subject) continue;
    const tag = parseReleaseCommitTag(subject);
    if (!tag) continue;
    if (git(root, ["ls-remote", "--tags", "origin", `refs/tags/${tag}`])) continue;
    validateCommitVersions(root, sha, tag);
    gitBot(root, ["tag", "-a", "-f", tag, "-m", `chore(release): ${tag}`, sha]);
    git(root, ["push", "origin", `refs/tags/${tag}`]);
    tagged.push(tag);
  }
  return tagged;
}

function runPrepareFilesMode(
  root: string,
  plan: ReleasePlan,
  now: Date,
  mode: string,
): { notes: string; changes: string[] } {
  if (mode === "dagger") {
    requireCommand(
      "dagger",
      [
        "call",
        "prepare-release-files",
        "--source=.",
        "--version",
        plan.version,
        "--now",
        now.toISOString(),
        "--output=.",
      ],
      { cwd: root },
    );
    validateVersions(root, plan.tag);
    const notes = changelogSection(
      readFileSync(resolve(root, "CHANGELOG.md"), "utf8"),
      plan.tag,
    ).notes;
    return { notes, changes: assertAllowedReleaseChanges(root) };
  }
  return prepareReleaseFilesInRepo(root, plan, now);
}

function publishPreparedRelease(
  root: string,
  currentVersion: string,
  plan: ReleasePlan,
  now: Date,
  mode: string,
): { branch: string; trailAction: "created" | "updated" } {
  const releaseBranch = `release/${plan.tag}`;
  const { notes, changes } = runPrepareFilesMode(root, plan, now, mode);
  git(root, ["checkout", "-B", releaseBranch]);
  git(root, ["add", "-f", "--", ...changes]);
  gitBot(root, ["commit", "-m", plan.commitMessage]);
  git(root, ["push", "--force", "origin", `HEAD:refs/heads/${releaseBranch}`]);
  cleanupSupersededReleaseBranches(root, currentVersion, releaseBranch);
  const trailAction = upsertReleaseTrail(root, plan, releaseBranch, notes);
  return { branch: releaseBranch, trailAction };
}

export function runReleaseMain(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Record<string, unknown> {
  if (env.BUILDKITE_TAG) {
    throw new ReleaseError("Release main step must not run on a tag build.");
  }
  if (env.BUILDKITE_PULL_REQUEST && env.BUILDKITE_PULL_REQUEST !== "false") {
    throw new ReleaseError("Release main step must not run on a pull request build.");
  }
  ensureFullMainHistory(root);

  const headSha = git(root, ["rev-parse", "HEAD"]);
  const originMainSha = git(root, ["rev-parse", "origin/main"]);
  const buildCommit = env.BUILDKITE_COMMIT?.trim() || headSha;
  if (buildCommit !== originMainSha || headSha !== originMainSha) {
    return { status: "stale_commit", headSha, originMainSha, tagged: [] };
  }

  const tagged = tagUntaggedReleases(root, "HEAD");
  const headReleaseTag = parseReleaseCommitTag(git(root, ["log", "-1", "--format=%s", "HEAD"]));
  if (headReleaseTag) {
    return {
      status: tagged.includes(headReleaseTag) ? "tagged" : "already_tagged",
      tag: headReleaseTag,
      tagged,
    };
  }

  const baseTag = previousTag(root, "HEAD");
  const range = baseTag ? `${baseTag}..HEAD` : "HEAD";
  const commits = git(root, ["log", "--first-parent", range, "--format=%s%n%b%x00"]).split("\0");
  const bump = computeAutomatedBump(commits);
  if (bump === "none") {
    return { status: "no_releasable_changes", baseTag, tagged };
  }

  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    version: string;
  };
  const nextVersion = incrementVersion(pkg.version, bump);
  const plan = createReleasePlan({ currentPackageVersion: pkg.version, nextVersion, now });
  const mode = env.FORGIX_PREPARE_FILES_MODE || "local";
  const { branch, trailAction } = publishPreparedRelease(root, pkg.version, plan, now, mode);
  return {
    status: "prepared",
    bump,
    version: plan.version,
    tag: plan.tag,
    branch,
    trailAction,
    tagged,
  };
}

function resolveMainBaselineVersion(root: string): string {
  const prevTag = previousTag(root, "origin/main");
  const prevTagVersion = prevTag ? releaseIdentity(prevTag).version : "0.0.0";
  const mainPkg = JSON.parse(git(root, ["show", "origin/main:package.json"])) as {
    version: string;
  };
  return compareVersions(mainPkg.version, prevTagVersion) > 0 ? mainPkg.version : prevTagVersion;
}

export function runReleaseMerge(
  root: string,
  branchInput?: string,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  const branch = branchInput || env.BUILDKITE_BRANCH || git(root, ["branch", "--show-current"]);
  const match = RELEASE_BRANCH_RE.exec(branch);
  if (!match) {
    throw new ReleaseError(`Expected release branch "release/vX.Y.Z", received "${branch}".`);
  }
  const targetTag = match[1]!;
  const targetVersion = releaseIdentity(targetTag).version;
  ensureFullMainHistory(root);
  const remoteHeadLine = git(root, ["ls-remote", "--heads", "origin", `refs/heads/${branch}`]);
  if (!remoteHeadLine) {
    return { status: "stale_release_branch", reason: "branch_deleted", branch, tag: targetTag };
  }
  validateVersions(root, targetTag);

  const prevVersion = resolveMainBaselineVersion(root);
  if (compareVersions(targetVersion, prevVersion) <= 0) {
    throw new ReleaseError(
      `Refusing to merge non-advancing release ${targetVersion} (latest on origin/main is ${prevVersion}).`,
    );
  }
  const headSha = git(root, ["rev-parse", "HEAD"]);
  const parentSha = git(root, ["rev-parse", "HEAD^"]);
  const originMainSha = git(root, ["rev-parse", "origin/main"]);
  if (parentSha !== originMainSha) {
    return { status: "stale_release_branch", reason: "base_moved", branch, tag: targetTag };
  }
  const remoteBranchSha = remoteHeadLine.split(/\s+/)[0] ?? "";
  const buildCommit = env.BUILDKITE_COMMIT?.trim() || headSha;
  if (remoteBranchSha !== headSha || buildCommit !== headSha) {
    return { status: "stale_release_branch", reason: "branch_moved", branch, tag: targetTag };
  }
  if (isMajorBump(prevVersion, targetVersion)) {
    return {
      status: "skipped_major",
      branch,
      tag: targetTag,
      previousVersion: prevVersion,
      nextVersion: targetVersion,
    };
  }
  const forcedPendingCi = mergeReleaseBranch(root, branch);
  return {
    status: "merged",
    branch,
    tag: targetTag,
    previousVersion: prevVersion,
    nextVersion: targetVersion,
    forcedPendingCi,
  };
}

export function runReleaseMirror(
  root: string,
  options: { tag?: string | undefined; target?: string | undefined } = {},
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  if (env.BUILDKITE === "true" && !env.GITHUB_MIRROR_TOKEN?.trim()) {
    throw new ReleaseError("GITHUB_MIRROR_TOKEN is required for Buildkite mirror sync.");
  }
  const tag = options.tag || env.BUILDKITE_TAG || "";
  releaseIdentity(tag);
  ensureFullMainHistory(root);
  const sha = git(root, ["rev-parse", "--verify", `refs/tags/${tag}^{commit}`]);
  const tagObjectSha = git(root, ["rev-parse", "--verify", `refs/tags/${tag}`]);
  assertContext(tag, sha, env, tagObjectSha);
  git(root, ["merge-base", "--is-ancestor", sha, "origin/main"]);
  validateVersions(root, tag);

  const latestTag = previousTag(root, "origin/main");
  if (latestTag && latestTag !== tag) {
    return { status: "already_superseded", tag, latestTag };
  }

  const target = options.target || env.FORGIX_MIRROR_TARGET || DEFAULT_MIRROR_TARGET;
  const mirror = syncGithubMirror({
    sourceRepoDir: root,
    target,
    branch: "main",
    sourceRef: tag,
    tag,
    apply: true,
    ...(env.GITHUB_MIRROR_TOKEN ? { token: env.GITHUB_MIRROR_TOKEN } : {}),
  });
  return { status: "mirrored", tag, mirror };
}

function parseFlag(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value) throw new ReleaseError(`Missing value for ${flag}.`);
  return value;
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);
  const scriptDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const root = requireCommand("git", ["rev-parse", "--show-toplevel"], {
    cwd: scriptDir,
  }).stdout.trim();

  let result: Record<string, unknown>;
  if (command === "main") {
    const nowArg = parseFlag(rest, "--now");
    result = runReleaseMain(root, process.env, nowArg ? new Date(nowArg) : new Date());
  } else if (command === "merge") {
    result = runReleaseMerge(root, parseFlag(rest, "--branch"), process.env);
  } else if (command === "mirror") {
    result = runReleaseMirror(
      root,
      { tag: parseFlag(rest, "--tag"), target: parseFlag(rest, "--target") },
      process.env,
    );
  } else if (command === "prepare-files") {
    const version = parseFlag(rest, "--version");
    if (!version) throw new ReleaseError("prepare-files requires --version <X.Y.Z>.");
    const nowArg = parseFlag(rest, "--now");
    const now = nowArg ? new Date(nowArg) : new Date();
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      version: string;
    };
    const plan = createReleasePlan({
      currentPackageVersion: pkg.version,
      nextVersion: version,
      now,
    });
    const prepared = prepareReleaseFilesInRepo(root, plan, now);
    result = { status: "prepared_files", version: plan.version, tag: plan.tag, ...prepared };
  } else {
    throw new ReleaseError(
      "Usage: bun scripts/release-auto.ts <main|merge|mirror|prepare-files> [options]",
    );
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
