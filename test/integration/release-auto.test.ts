import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import { requireCommand } from "../../scripts/release-lib.ts";
import { pinReleaseFixtureVersions } from "../support/release-fixtures.ts";

function gitIn(cwd: string, args: readonly string[]): string {
  return requireCommand("git", args, { cwd }).stdout.trimEnd();
}

function autoReleaseFixture() {
  const sandbox = mkdtempSync(join(tmpdir(), "forgix-auto-release-"));
  const directory = join(sandbox, "repo");
  const originBare = join(sandbox, "origin.git");
  const mirrorBare = join(sandbox, "mirror.git");
  const mirrorSeed = join(sandbox, "mirror-seed");
  const entireLog = join(sandbox, "entire-calls.jsonl");
  const entireState = join(sandbox, "entire-trails.json");
  mkdirSync(directory, { recursive: true });
  mkdirSync(mirrorSeed, { recursive: true });
  writeFileSync(entireLog, "");
  writeFileSync(entireState, JSON.stringify({}));

  const source = new URL("../../", import.meta.url);
  for (const path of [
    "cliff.toml",
    "scripts/release-auto.ts",
    "scripts/release-ci.ts",
    "scripts/release-files.ts",
    "scripts/release-lib.ts",
    "scripts/release-notes.ts",
    "scripts/sync-github-mirror.ts",
    "package.json",
    ".codex-plugin/plugin.json",
    ".claude-plugin/plugin.json",
    "plugin.json",
    ".claude-plugin/marketplace.json",
  ]) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    cpSync(new URL(path, source), join(directory, path));
  }
  pinReleaseFixtureVersions(directory);
  for (const [path, contents] of Object.entries({
    "bun.lock": "original lock\n",
    "dist/forgix.mjs": "original bundle\n",
    "CHANGELOG.md": "# Changelog\n\n## [1.0.1] - historical\n\nHistorical bytes.\n",
  })) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), contents);
  }
  writeFileSync(join(directory, ".gitignore"), "node_modules/\n.mock/\ndist/\n");

  const fake = join(directory, ".mock");
  mkdirSync(fake);
  const bunStub = join(fake, "bun");
  writeFileSync(
    bunStub,
    `#!/usr/bin/env node
import fs from "node:fs";
const args = process.argv.slice(2);
if (args[0] === "install") {
  fs.writeFileSync("bun.lock", "prepared lock\\n");
} else if (args.join(" ") === "run build") {
  fs.writeFileSync("dist/forgix.mjs", "prepared bundle\\n");
  if (process.env.TEST_UNEXPECTED_FILE === "true") fs.writeFileSync("README.md", "oops\\n");
} else {
  throw new Error("Unexpected bun call: " + args.join(" "));
}
`,
  );
  chmodSync(bunStub, 0o755);

  const entireStub = join(fake, "entire");
  writeFileSync(
    entireStub,
    `#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_ENTIRE_LOG, JSON.stringify(args) + "\\n");
const statePath = process.env.TEST_ENTIRE_STATE;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const branchIdx = args.indexOf("--branch");
const branch = branchIdx >= 0 ? args[branchIdx + 1] : "";
if (args[0] === "trail" && args[1] === "show") {
  if (process.env.TEST_FAIL_TRAIL_SHOW === "true" && branch === "release/v1.0.2") {
    console.error("upstream 503 service unavailable");
    process.exit(1);
  }
  if (!state[branch]) {
    console.error("trail not found");
    process.exit(1);
  }
  console.log(JSON.stringify(state[branch]));
  process.exit(0);
}
if (args[0] === "trail" && args[1] === "create") {
  state[branch] = { id: "trail-" + branch, branch, status: "open" };
  fs.writeFileSync(statePath, JSON.stringify(state));
  console.log(JSON.stringify(state[branch]));
  process.exit(0);
}
if (args[0] === "trail" && args[1] === "update") {
  if (process.env.TEST_FAIL_TRAIL_CLOSE === "true" && args.includes("closed")) {
    console.error("simulated close failure");
    process.exit(1);
  }
  const statusIdx = args.indexOf("--status");
  if (state[branch]) {
    state[branch].status = statusIdx >= 0 ? args[statusIdx + 1] : state[branch].status;
    fs.writeFileSync(statePath, JSON.stringify(state));
    console.log(JSON.stringify(state[branch]));
    process.exit(0);
  }
  process.exit(1);
}
if (args[0] === "trail" && args[1] === "merge") {
  if (process.env.TEST_MERGE_CONFLICT === "true") {
    console.error("merge conflict with base branch");
    process.exit(1);
  }
  if (process.env.TEST_PENDING_AND_APPROVAL === "true") {
    console.error("CI checks are still running; approval required");
    process.exit(1);
  }
  if (process.env.TEST_PENDING_CI_ONCE === "true" && !args.includes("--force")) {
    console.error("CI checks are still running on release branch");
    process.exit(1);
  }
  const origin = process.env.TEST_ORIGIN_BARE;
  const sha = spawnSync("git", ["rev-parse", "refs/heads/" + branch], { cwd: origin, encoding: "utf8" }).stdout.trim();
  const upd = spawnSync("git", ["update-ref", "refs/heads/main", sha], { cwd: origin, encoding: "utf8" });
  if (upd.status !== 0) process.exit(1);
  if (args.includes("--delete-branch")) {
    spawnSync("git", ["branch", "-D", branch], { cwd: origin, encoding: "utf8" });
  }
  console.log(JSON.stringify({ merged: true, branch }));
  process.exit(0);
}
throw new Error("Unexpected entire command: " + args.join(" "));
`,
  );
  chmodSync(entireStub, 0o755);

  const git = (args: readonly string[]) => gitIn(directory, args);
  gitIn(sandbox, ["init", "--bare", originBare]);
  git(["init", "-b", "main"]);
  git(["config", "user.name", "Release test"]);
  git(["config", "user.email", "release@example.invalid"]);
  git(["config", "commit.gpgsign", "false"]);
  git(["config", "tag.gpgSign", "false"]);
  git(["add", "."]);
  git(["add", "-f", "dist/forgix.mjs"]);
  git(["commit", "-m", "feat: fixture"]);
  git(["tag", "-a", "v1.0.1", "-m", "chore(release): v1.0.1"]);
  git(["remote", "add", "origin", originBare]);
  git(["push", "-u", "origin", "main", "--tags"]);
  gitIn(originBare, ["symbolic-ref", "HEAD", "refs/heads/main"]);

  gitIn(sandbox, ["init", "--bare", mirrorBare]);
  gitIn(mirrorSeed, ["init", "-b", "main"]);
  gitIn(mirrorSeed, ["config", "user.name", "Mirror test"]);
  gitIn(mirrorSeed, ["config", "user.email", "mirror@example.invalid"]);
  gitIn(mirrorSeed, ["config", "commit.gpgsign", "false"]);
  mkdirSync(join(mirrorSeed, ".github", "workflows"), { recursive: true });
  writeFileSync(join(mirrorSeed, ".github", "workflows", "release.yml"), "name: Release\n");
  gitIn(mirrorSeed, ["add", "."]);
  gitIn(mirrorSeed, ["commit", "-m", "init mirror"]);
  gitIn(mirrorSeed, ["remote", "add", "origin", mirrorBare]);
  gitIn(mirrorSeed, ["push", "-u", "origin", "main"]);
  gitIn(mirrorBare, ["symbolic-ref", "HEAD", "refs/heads/main"]);

  let counter = 0;
  const commitOnMain = (message: string, push = true) => {
    writeFileSync(join(directory, "CHANGELOG.md"), readFileSync(join(directory, "CHANGELOG.md")));
    writeFileSync(join(directory, `change-${++counter}.txt`), `${message}\n`);
    git(["add", `change-${counter}.txt`]);
    git(["commit", "-m", message]);
    if (push) git(["push", "origin", "main"]);
  };

  const runAuto = (args: readonly string[], extraEnv: Record<string, string | undefined> = {}) =>
    Bun.spawnSync(["node", "scripts/release-auto.ts", ...args], {
      cwd: directory,
      env: {
        ...process.env,
        PATH: `${fake}:${process.env.PATH}`,
        TEST_ORIGIN_BARE: originBare,
        TEST_ENTIRE_LOG: entireLog,
        TEST_ENTIRE_STATE: entireState,
        FORGIX_MIRROR_TARGET: mirrorBare,
        BUILDKITE_TAG: "",
        BUILDKITE_PULL_REQUEST: "false",
        BUILDKITE_COMMIT: "",
        ...extraEnv,
      },
    });

  const readEntireCalls = (): string[][] =>
    readFileSync(entireLog, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string[]);

  return {
    sandbox,
    directory,
    originBare,
    mirrorBare,
    git,
    gitIn,
    commitOnMain,
    runAuto,
    readEntireCalls,
    close: () => rmSync(sandbox, { recursive: true, force: true }),
  };
}

describe("automated release pipeline (Phases 1, 2, 3a, 3b)", () => {
  test("Phase 1: no-ops on non-releasing commits and stale BUILDKITE_COMMIT", () => {
    const f = autoReleaseFixture();
    try {
      f.commitOnMain("docs(readme): explain workflow");
      f.commitOnMain("chore(ci): tidy comments");
      const noop = f.runAuto(["main", "--now", "2026-11-26T12:00:00Z"]);
      expect(noop.exitCode, noop.stderr.toString()).toBe(0);
      expect(JSON.parse(noop.stdout.toString()).status).toBe("no_releasable_changes");
      expect(f.readEntireCalls()).toEqual([]);

      f.commitOnMain("fix(core): repair edge case");
      const stale = f.runAuto(["main", "--now", "2026-11-26T12:00:00Z"], {
        BUILDKITE_COMMIT: "0".repeat(40),
      });
      expect(stale.exitCode, stale.stderr.toString()).toBe(0);
      expect(JSON.parse(stale.stdout.toString()).status).toBe("stale_commit");
      expect(f.readEntireCalls()).toEqual([]);
    } finally {
      f.close();
    }
  });

  test("Phase 1: rejects unexpected files outside ALLOWED_RELEASE_PATHS", () => {
    const f = autoReleaseFixture();
    try {
      f.commitOnMain("fix(core): repair edge case");
      const failed = f.runAuto(["main", "--now", "2026-11-26T12:00:00Z"], {
        TEST_UNEXPECTED_FILE: "true",
      });
      expect(failed.exitCode).toBe(1);
      expect(failed.stderr.toString()).toContain(
        "Unexpected changed files during release: README.md",
      );
    } finally {
      f.close();
    }
  });

  test("Phase 1 -> 2 -> 3a -> 3b: full end-to-end minor release, anti-loop, and mirror sync", () => {
    const f = autoReleaseFixture();
    try {
      f.commitOnMain("docs(specs): add spec");
      f.commitOnMain("feat(init): add $forgix sync");
      f.commitOnMain("fix(init): polish checks");

      // Phase 1: prepare release/v1.1.0
      const phase1 = f.runAuto(["main", "--now", "2026-11-26T12:00:00Z"]);
      expect(phase1.exitCode, phase1.stderr.toString()).toBe(0);
      const p1 = JSON.parse(phase1.stdout.toString());
      expect(p1).toMatchObject({
        status: "prepared",
        bump: "minor",
        version: "1.1.0",
        tag: "v1.1.0",
        branch: "release/v1.1.0",
        trailAction: "created",
      });
      expect(f.git(["log", "-1", "--format=%an <%ae>"])).toBe(
        "forgix-release[bot] <forgix-release[bot]@users.noreply.entire.io>",
      );

      // Phase 2: auto-merge minor release/v1.1.0
      const phase2 = f.runAuto(["merge", "--branch", "release/v1.1.0"]);
      expect(phase2.exitCode, phase2.stderr.toString()).toBe(0);
      expect(JSON.parse(phase2.stdout.toString())).toMatchObject({
        status: "merged",
        branch: "release/v1.1.0",
        tag: "v1.1.0",
      });

      // Switch local checkout to merged main (simulating Buildkite main build on chore(release): v1.1.0)
      f.git(["checkout", "main"]);
      f.git(["pull", "--ff-only", "origin", "main"]);
      expect(f.git(["log", "-1", "--format=%s"])).toBe("chore(release): v1.1.0");

      // Phase 3a: tag v1.1.0 and exit without preparing a new release
      const phase3a = f.runAuto(["main", "--now", "2026-11-26T12:05:00Z"]);
      expect(phase3a.exitCode, phase3a.stderr.toString()).toBe(0);
      expect(JSON.parse(phase3a.stdout.toString())).toMatchObject({
        status: "tagged",
        tag: "v1.1.0",
        tagged: ["v1.1.0"],
      });
      expect(f.gitIn(f.originBare, ["tag", "--list", "v1.1.0"])).toBe("v1.1.0");

      // Phase 3a anti-loop re-run: already tagged -> immediate no-op
      const antiLoop = f.runAuto(["main", "--now", "2026-11-26T12:06:00Z"]);
      expect(antiLoop.exitCode, antiLoop.stderr.toString()).toBe(0);
      expect(JSON.parse(antiLoop.stdout.toString())).toMatchObject({
        status: "already_tagged",
        tag: "v1.1.0",
        tagged: [],
      });

      // Phase 3b: fails fast when BUILDKITE=true and GITHUB_MIRROR_TOKEN is missing
      const tagCommitSha = f.git(["rev-parse", "refs/tags/v1.1.0^{commit}"]);
      const missingToken = f.runAuto(["mirror"], {
        BUILDKITE: "true",
        BUILDKITE_REPO: "entire://aws-eu-central-1.entire.io/et/forgix/forgix",
        BUILDKITE_TAG: "v1.1.0",
        BUILDKITE_COMMIT: tagCommitSha,
        BUILDKITE_PULL_REQUEST: "false",
        GITHUB_MIRROR_TOKEN: "",
      });
      expect(missingToken.exitCode).toBe(1);
      expect(missingToken.stderr.toString()).toContain("GITHUB_MIRROR_TOKEN is required");

      // Phase 3b: mirror sync on verified tag build preserving .github/
      const phase3b = f.runAuto(["mirror"], {
        BUILDKITE: "true",
        BUILDKITE_REPO: "entire://aws-eu-central-1.entire.io/et/forgix/forgix",
        BUILDKITE_TAG: "v1.1.0",
        BUILDKITE_COMMIT: tagCommitSha,
        BUILDKITE_PULL_REQUEST: "false",
        GITHUB_MIRROR_TOKEN: "test-mirror-token",
      });
      expect(phase3b.exitCode, phase3b.stderr.toString()).toBe(0);
      expect(JSON.parse(phase3b.stdout.toString())).toMatchObject({
        status: "mirrored",
        tag: "v1.1.0",
        mirror: { status: "pushed", preservedGithub: true, tagPushed: true },
      });

      // Phase 3b old tag replay: returns already_superseded without touching mirror
      const oldTagSha = f.git(["rev-parse", "refs/tags/v1.0.1^{commit}"]);
      f.git(["checkout", "v1.0.1"]);
      const supersededReplay = f.runAuto(["mirror"], {
        BUILDKITE: "true",
        BUILDKITE_REPO: "entire://aws-eu-central-1.entire.io/et/forgix/forgix",
        BUILDKITE_TAG: "v1.0.1",
        BUILDKITE_COMMIT: oldTagSha,
        BUILDKITE_PULL_REQUEST: "false",
        GITHUB_MIRROR_TOKEN: "test-mirror-token",
      });
      expect(supersededReplay.exitCode, supersededReplay.stderr.toString()).toBe(0);
      expect(JSON.parse(supersededReplay.stdout.toString())).toMatchObject({
        status: "already_superseded",
        tag: "v1.0.1",
        latestTag: "v1.1.0",
      });

      const verifyClone = join(f.sandbox, "verify-mirror");
      f.gitIn(f.sandbox, ["clone", "--branch", "main", f.mirrorBare, verifyClone]);
      expect(JSON.parse(readFileSync(join(verifyClone, "package.json"), "utf8")).version).toBe(
        "1.1.0",
      );
      expect(existsSync(join(verifyClone, "dist", "forgix.mjs"))).toBe(true);
      expect(readFileSync(join(verifyClone, ".github", "workflows", "release.yml"), "utf8")).toBe(
        "name: Release\n",
      );
    } finally {
      f.close();
    }
  });

  test("Phase 1 supersedes obsolete unreleased release branch and updates existing trail", () => {
    const f = autoReleaseFixture();
    try {
      // Seed an already-released historical branch release/v1.0.1 AND a human-authored release/v1.9.0
      f.git(["push", "origin", "HEAD:refs/heads/release/v1.0.1"]);
      f.git(["checkout", "-b", "release/v1.9.0"]);
      f.commitOnMain("chore(release): v1.9.0", false);
      f.git(["push", "origin", "HEAD:refs/heads/release/v1.9.0"]);
      f.git(["checkout", "main"]);

      f.commitOnMain("fix(core): first fix");
      const first = f.runAuto(["main", "--now", "2026-11-26T12:00:00Z"]);
      expect(first.exitCode, first.stderr.toString()).toBe(0);
      expect(JSON.parse(first.stdout.toString()).branch).toBe("release/v1.0.2");

      // Re-run on main with a second fix -> updates existing release/v1.0.2 trail with --status open
      f.git(["checkout", "main"]);
      f.commitOnMain("fix(core): second fix");
      const updated = f.runAuto(["main", "--now", "2026-11-26T12:01:00Z"]);
      expect(updated.exitCode, updated.stderr.toString()).toBe(0);
      expect(JSON.parse(updated.stdout.toString())).toMatchObject({
        branch: "release/v1.0.2",
        trailAction: "updated",
      });
      const updateCall = f
        .readEntireCalls()
        .find((call) => call[1] === "update" && call.includes("release/v1.0.2"));
      expect(updateCall).toContain("--status");
      expect(updateCall).toContain("open");

      // If trail show fails with a non-not-found error, cleanup fails loud and preserves the branch
      f.git(["checkout", "main"]);
      f.commitOnMain("feat(core): new capability");
      const showFailed = f.runAuto(["main", "--now", "2026-11-26T12:02:00Z"], {
        TEST_FAIL_TRAIL_SHOW: "true",
      });
      expect(showFailed.exitCode).toBe(1);
      expect(showFailed.stderr.toString()).toContain("upstream 503 service unavailable");
      expect(f.gitIn(f.originBare, ["branch", "--list", "release/v1.0.2"]).trim()).toBe(
        "release/v1.0.2",
      );

      // If closing the superseded trail fails, cleanup fails loud and preserves the branch
      f.git(["checkout", "main"]);
      const closeFailed = f.runAuto(["main", "--now", "2026-11-26T12:02:00Z"], {
        TEST_FAIL_TRAIL_CLOSE: "true",
      });
      expect(closeFailed.exitCode).toBe(1);
      expect(closeFailed.stderr.toString()).toContain("simulated close failure");
      expect(f.gitIn(f.originBare, ["branch", "--list", "release/v1.0.2"]).trim()).toBe(
        "release/v1.0.2",
      );

      // Now cleanup succeeds -> supersedes bot-owned release/v1.0.2, keeps release/v1.0.1 & human release/v1.9.0
      f.git(["checkout", "main"]);
      const superseded = f.runAuto(["main", "--now", "2026-11-26T12:02:00Z"]);
      expect(superseded.exitCode, superseded.stderr.toString()).toBe(0);
      expect(JSON.parse(superseded.stdout.toString())).toMatchObject({
        branch: "release/v1.1.0",
        trailAction: "created",
      });
      expect(f.gitIn(f.originBare, ["branch", "--list", "release/v1.0.2"])).toBe("");
      expect(f.gitIn(f.originBare, ["branch", "--list", "release/v1.0.1"]).trim()).toBe(
        "release/v1.0.1",
      );
      expect(f.gitIn(f.originBare, ["branch", "--list", "release/v1.9.0"]).trim()).toBe(
        "release/v1.9.0",
      );
    } finally {
      f.close();
    }
  });

  test("Phase 2 never auto-merges major releases", () => {
    const f = autoReleaseFixture();
    try {
      f.commitOnMain("feat!: breaking change");
      const phase1 = f.runAuto(["main", "--now", "2026-11-26T12:00:00Z"]);
      expect(phase1.exitCode, phase1.stderr.toString()).toBe(0);
      expect(JSON.parse(phase1.stdout.toString())).toMatchObject({
        bump: "major",
        version: "2.0.0",
        branch: "release/v2.0.0",
      });

      const phase2 = f.runAuto(["merge", "--branch", "release/v2.0.0"]);
      expect(phase2.exitCode, phase2.stderr.toString()).toBe(0);
      expect(JSON.parse(phase2.stdout.toString())).toMatchObject({
        status: "skipped_major",
        branch: "release/v2.0.0",
        previousVersion: "1.0.1",
        nextVersion: "2.0.0",
      });
      const mergeCalls = f.readEntireCalls().filter((call) => call[1] === "merge");
      expect(mergeCalls).toEqual([]);
    } finally {
      f.close();
    }
  });

  test("Phase 3a recovery tags an untagged ancestor release commit before running Phase 1", () => {
    const f = autoReleaseFixture();
    try {
      f.commitOnMain("fix(core): patch before cancel");
      const p1 = f.runAuto(["main", "--now", "2026-11-26T12:00:00Z"]);
      expect(p1.exitCode, p1.stderr.toString()).toBe(0);
      const p2 = f.runAuto(["merge", "--branch", "release/v1.0.2"]);
      expect(p2.exitCode, p2.stderr.toString()).toBe(0);

      // Simulate cancelled main build on chore(release): v1.0.2: a new fix merges before v1.0.2 is tagged
      f.git(["checkout", "main"]);
      f.git(["pull", "--ff-only", "origin", "main"]);
      f.commitOnMain("fix(core): follow-up fix");
      expect(f.gitIn(f.originBare, ["tag", "--list", "v1.0.2"])).toBe("");

      const recovered = f.runAuto(["main", "--now", "2026-11-26T12:10:00Z"]);
      expect(recovered.exitCode, recovered.stderr.toString()).toBe(0);
      expect(JSON.parse(recovered.stdout.toString())).toMatchObject({
        status: "prepared",
        bump: "patch",
        version: "1.0.3",
        tag: "v1.0.3",
        branch: "release/v1.0.3",
        tagged: ["v1.0.2"],
      });
      expect(f.gitIn(f.originBare, ["tag", "--list", "v1.0.2"])).toBe("v1.0.2");
    } finally {
      f.close();
    }
  });

  test("Phase 2 guards: retries --force --yes only on pending CI, rejects conflicts/downgrades, and no-ops on stale base or moved branch", () => {
    const f = autoReleaseFixture();
    try {
      f.commitOnMain("fix(core): patch release");
      const p1 = f.runAuto(["main", "--now", "2026-11-26T12:00:00Z"]);
      expect(p1.exitCode, p1.stderr.toString()).toBe(0);

      // Non-pending merge conflict fails immediately without --force
      const conflict = f.runAuto(["merge", "--branch", "release/v1.0.2"], {
        TEST_MERGE_CONFLICT: "true",
      });
      expect(conflict.exitCode).toBe(1);
      expect(
        f.readEntireCalls().some((call) => call[1] === "merge" && call.includes("--force")),
      ).toBe(false);

      // Pending CI combined with an unrelated blocking gate (approval) must NOT retry with --force
      const approvalBlocked = f.runAuto(["merge", "--branch", "release/v1.0.2"], {
        TEST_PENDING_AND_APPROVAL: "true",
      });
      expect(approvalBlocked.exitCode).toBe(1);
      expect(
        f.readEntireCalls().some((call) => call[1] === "merge" && call.includes("--force")),
      ).toBe(false);

      // Deleted remote branch returns stale_release_branch (branch_deleted) with exit 0
      const deleted = f.runAuto(["merge", "--branch", "release/v9.9.9"]);
      expect(deleted.exitCode, deleted.stderr.toString()).toBe(0);
      expect(JSON.parse(deleted.stdout.toString())).toMatchObject({
        status: "stale_release_branch",
        reason: "branch_deleted",
        branch: "release/v9.9.9",
      });

      // Stale branch (BUILDKITE_COMMIT != HEAD) returns stale_release_branch without merging
      const movedBranch = f.runAuto(["merge", "--branch", "release/v1.0.2"], {
        BUILDKITE_COMMIT: "0".repeat(40),
      });
      expect(movedBranch.exitCode, movedBranch.stderr.toString()).toBe(0);
      expect(JSON.parse(movedBranch.stdout.toString())).toMatchObject({
        status: "stale_release_branch",
        reason: "branch_moved",
      });

      // Pending CI self-block retries once with --force --yes and succeeds
      const forced = f.runAuto(["merge", "--branch", "release/v1.0.2"], {
        TEST_PENDING_CI_ONCE: "true",
      });
      expect(forced.exitCode, forced.stderr.toString()).toBe(0);
      expect(JSON.parse(forced.stdout.toString())).toMatchObject({
        status: "merged",
        branch: "release/v1.0.2",
        forcedPendingCi: true,
      });

      // Stale base: main moved ahead of release/v1.0.2 parent -> stale_release_branch (base_moved)
      f.git(["checkout", "main"]);
      f.git(["pull", "--ff-only", "origin", "main"]);
      f.commitOnMain("fix(core): next fix");
      const p1Next = f.runAuto(["main", "--now", "2026-11-26T12:05:00Z"]);
      expect(p1Next.exitCode, p1Next.stderr.toString()).toBe(0);
      const releaseSha = f.git(["rev-parse", "HEAD"]);
      f.git(["checkout", "main"]);
      f.commitOnMain("docs: move main ahead");
      f.git(["checkout", releaseSha]);
      const staleBase = f.runAuto(["merge", "--branch", "release/v1.0.3"]);
      expect(staleBase.exitCode, staleBase.stderr.toString()).toBe(0);
      expect(JSON.parse(staleBase.stdout.toString())).toMatchObject({
        status: "stale_release_branch",
        reason: "base_moved",
      });

      // Non-advancing / downgrade release (v1.0.1 <= untagged origin/main package.json 1.0.2) is refused
      f.git(["checkout", "v1.0.1"]);
      f.git(["push", "origin", "HEAD:refs/heads/release/v1.0.1"]);
      const downgrade = f.runAuto(["merge", "--branch", "release/v1.0.1"]);
      expect(downgrade.exitCode).toBe(1);
      expect(downgrade.stderr.toString()).toContain("latest on origin/main is 1.0.2");
    } finally {
      f.close();
    }
  });

  test("Phase 3a stale main build never tags a newer unverified release commit on origin/main", () => {
    const f = autoReleaseFixture();
    try {
      const olderSha = f.git(["rev-parse", "HEAD"]);
      f.commitOnMain("fix(core): patch");
      const p1 = f.runAuto(["main", "--now", "2026-11-26T12:00:00Z"]);
      expect(p1.exitCode, p1.stderr.toString()).toBe(0);
      const p2 = f.runAuto(["merge", "--branch", "release/v1.0.2"]);
      expect(p2.exitCode, p2.stderr.toString()).toBe(0);

      // Checkout older commit (simulating stale green main build while chore(release): v1.0.2 is on origin/main)
      f.git(["checkout", olderSha]);
      const stale = f.runAuto(["main", "--now", "2026-11-26T12:01:00Z"], {
        BUILDKITE_COMMIT: olderSha,
      });
      expect(stale.exitCode, stale.stderr.toString()).toBe(0);
      expect(JSON.parse(stale.stdout.toString())).toMatchObject({
        status: "stale_commit",
        tagged: [],
      });
      expect(f.gitIn(f.originBare, ["tag", "--list", "v1.0.2"])).toBe("");
    } finally {
      f.close();
    }
  });
});
