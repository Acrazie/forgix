import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  compareVersions,
  parsePorcelainPaths,
  ReleaseError,
  releaseIdentity,
  replaceJsonVersion,
  replaceMarketplacePluginVersion,
  requireCommand,
  runCommand,
  unexpectedReleasePaths,
  validateVersions,
  type ReleasePlan,
} from "./release-lib.ts";
import { git, notesMetadata, renderNotes } from "./release-notes.ts";

export const BOT_NAME = "forgix-release[bot]";
export const BOT_EMAIL = "forgix-release[bot]@users.noreply.entire.io";
export const RELEASE_BRANCH_RE = /^release\/(v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;
const PENDING_CI_RE = /CI checks are still running/i;
const OTHER_BLOCKING_GATE_RE = /approval|review|conflict|out of date|behind/i;
const TRAIL_NOT_FOUND_RE = /not found|no trail/i;

const MANIFEST_PATHS = [
  "package.json",
  ".codex-plugin/plugin.json",
  ".claude-plugin/plugin.json",
  "plugin.json",
  ".claude-plugin/marketplace.json",
] as const;

export interface PreparedReleaseFiles {
  notes: string;
  changes: string[];
}

export function validateCommitVersions(root: string, commitSha: string, tag: string): string {
  const scratch = mkdtempSync(join(tmpdir(), "forgix-release-verify-"));
  try {
    for (const relPath of MANIFEST_PATHS) {
      const contents = git(root, ["show", `${commitSha}:${relPath}`]);
      const targetPath = join(scratch, relPath);
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, `${contents}\n`);
    }
    return validateVersions(scratch, tag);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

export function assertAllowedReleaseChanges(root: string): string[] {
  const changes = parsePorcelainPaths(
    git(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
  );
  const unexpected = unexpectedReleasePaths(changes);
  if (unexpected.length > 0) {
    throw new ReleaseError(`Unexpected changed files during release: ${unexpected.join(", ")}`);
  }
  return changes;
}

export function prependReleaseChangelog(root: string, tag: string, now: Date): string {
  const changelogPath = resolve(root, "CHANGELOG.md");
  const changelog = readFileSync(changelogPath, "utf8");
  if (changelog.includes(`## [${tag}] - `)) {
    throw new ReleaseError("Changelog already contains this release.");
  }
  if (!changelog.startsWith("# Changelog\n")) {
    throw new ReleaseError("Expected canonical changelog header.");
  }
  const date = now.toISOString().slice(0, 10);
  const notes = renderNotes(root, notesMetadata(root, tag, date));
  const rest = changelog.slice("# Changelog\n".length).replace(/^\n+/, "");
  writeFileSync(changelogPath, `# Changelog\n\n${notes}\n${rest}`);
  return notes;
}

export function prepareReleaseFilesInRepo(
  root: string,
  plan: ReleasePlan,
  now: Date,
): PreparedReleaseFiles {
  const pkgPath = resolve(root, "package.json");
  writeFileSync(pkgPath, replaceJsonVersion(readFileSync(pkgPath, "utf8"), plan.version));
  requireCommand("bun", ["install", "--lockfile-only", "--ignore-scripts"], { cwd: root });

  const manifestUpdates: readonly [string, string][] = [
    [".codex-plugin/plugin.json", plan.pluginVersion],
    [".claude-plugin/plugin.json", plan.version],
    ["plugin.json", plan.version],
  ];
  for (const [relativePath, version] of manifestUpdates) {
    const target = resolve(root, relativePath);
    writeFileSync(target, replaceJsonVersion(readFileSync(target, "utf8"), version));
  }

  const marketPath = resolve(root, ".claude-plugin/marketplace.json");
  writeFileSync(
    marketPath,
    replaceMarketplacePluginVersion(readFileSync(marketPath, "utf8"), "forgix", plan.version),
  );
  requireCommand("bun", ["run", "build"], { cwd: root });
  validateVersions(root, plan.tag);

  const notes = prependReleaseChangelog(root, plan.tag, now);
  const changes = assertAllowedReleaseChanges(root);
  return { notes, changes };
}

function isBotOwnedCommit(root: string, branch: string, expectedSha: string): boolean {
  git(root, ["fetch", "origin", `refs/heads/${branch}`]);
  const [authorEmail, committerEmail] = git(root, [
    "log",
    "-1",
    "--format=%ae%n%ce",
    expectedSha,
  ]).split("\n");
  return authorEmail === BOT_EMAIL && committerEmail === BOT_EMAIL;
}

function closeSupersededTrail(root: string, branch: string): void {
  const shown = runCommand("entire", ["trail", "show", "--branch", branch, "--json"], {
    cwd: root,
  });
  if (shown.status === 0) {
    requireCommand(
      "entire",
      ["trail", "update", "--branch", branch, "--status", "closed", "--json"],
      { cwd: root },
    );
    return;
  }
  const detail = `${shown.stdout}\n${shown.stderr}`.trim();
  if (!TRAIL_NOT_FOUND_RE.test(detail)) {
    throw new ReleaseError(
      `entire trail show --branch ${branch} failed${detail ? `: ${detail}` : "."}`,
    );
  }
}

export function cleanupSupersededReleaseBranches(
  root: string,
  currentVersion: string,
  activeBranch: string,
): void {
  const remoteHeads = git(root, ["ls-remote", "--heads", "origin", "refs/heads/release/v*"]);
  for (const line of remoteHeads.split("\n").filter(Boolean)) {
    const [expectedSha, ref] = line.split(/\s+/);
    const branch = (ref ?? "").replace(/^refs\/heads\//, "");
    const match = RELEASE_BRANCH_RE.exec(branch);
    if (!expectedSha || !match || branch === activeBranch) continue;
    if (compareVersions(releaseIdentity(match[1]!).version, currentVersion) <= 0) continue;
    if (!isBotOwnedCommit(root, branch, expectedSha)) continue;
    closeSupersededTrail(root, branch);
    requireCommand(
      "git",
      [
        "push",
        "origin",
        `--force-with-lease=refs/heads/${branch}:${expectedSha}`,
        `:refs/heads/${branch}`,
      ],
      { cwd: root },
    );
  }
}

export function upsertReleaseTrail(
  root: string,
  plan: ReleasePlan,
  releaseBranch: string,
  notes: string,
): "created" | "updated" {
  const existing = runCommand("entire", ["trail", "show", "--branch", releaseBranch, "--json"], {
    cwd: root,
  });
  if (existing.status === 0) {
    requireCommand(
      "entire",
      [
        "trail",
        "update",
        "--branch",
        releaseBranch,
        "--status",
        "open",
        "--title",
        plan.commitMessage,
        "--body",
        notes,
        "--json",
      ],
      { cwd: root },
    );
    return "updated";
  }
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
      "--body",
      notes,
      "--json",
    ],
    { cwd: root },
  );
  return "created";
}

export function mergeReleaseBranch(root: string, branch: string): boolean {
  const baseArgs = ["trail", "merge", "--branch", branch, "--delete-branch", "--json"];
  const first = runCommand("entire", baseArgs, { cwd: root });
  if (first.status === 0) return false;
  const output = `${first.stdout}\n${first.stderr}`.trim();
  if (!PENDING_CI_RE.test(output) || OTHER_BLOCKING_GATE_RE.test(output)) {
    throw new ReleaseError(`entire ${baseArgs.join(" ")} failed${output ? `: ${output}` : "."}`);
  }
  requireCommand("entire", [...baseArgs, "--force", "--yes"], { cwd: root });
  return true;
}
