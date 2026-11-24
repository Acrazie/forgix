import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMirrorArgs, syncGithubMirror } from "../scripts/sync-github-mirror.ts";

function git(cwd: string, args: readonly string[]): string {
  const res = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${res.stderr}`);
  }
  return res.stdout.trim();
}

function initRepo(dir: string): void {
  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.name", "Test"]);
  git(dir, ["config", "user.email", "test@example.com"]);
}

function createFixtureRepos(): {
  sandbox: string;
  sourceDir: string;
  targetBare: string;
  verifyClone: string;
} {
  const sandbox = mkdtempSync(join(tmpdir(), "forgix-mirror-test-"));
  const sourceDir = join(sandbox, "source");
  const targetSeed = join(sandbox, "target-seed");
  const targetBare = join(sandbox, "target.git");
  const verifyClone = join(sandbox, "verify");
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(targetSeed, { recursive: true });

  // Source repo: root-layout plugin (no .github/)
  initRepo(sourceDir);
  mkdirSync(join(sourceDir, "dist"), { recursive: true });
  mkdirSync(join(sourceDir, "skills", "forgix"), { recursive: true });
  writeFileSync(join(sourceDir, "plugin.json"), JSON.stringify({ name: "forgix" }) + "\n");
  writeFileSync(join(sourceDir, "dist", "forgix.mjs"), "#!/usr/bin/env node\n");
  writeFileSync(join(sourceDir, "skills", "forgix", "SKILL.md"), "# Forgix\n");
  git(sourceDir, ["add", "-A"]);
  git(sourceDir, ["commit", "-m", "feat: root layout"]);

  // Target bare repo: legacy plugins/ layout WITH .github/workflows/publish-entire-npm.yml
  git(sandbox, ["init", "--bare", targetBare]);
  initRepo(targetSeed);
  mkdirSync(join(targetSeed, ".github", "workflows"), { recursive: true });
  mkdirSync(join(targetSeed, "plugins", "forgix"), { recursive: true });
  writeFileSync(
    join(targetSeed, ".github", "workflows", "publish-entire-npm.yml"),
    "name: Publish npm\n",
  );
  writeFileSync(join(targetSeed, "plugins", "forgix", "plugin.json"), "{}\n");
  git(targetSeed, ["add", "-A"]);
  git(targetSeed, ["commit", "-m", "legacy layout"]);
  git(targetSeed, ["remote", "add", "origin", targetBare]);
  git(targetSeed, ["push", "-u", "origin", "main"]);
  git(targetBare, ["symbolic-ref", "HEAD", "refs/heads/main"]);

  return { sandbox, sourceDir, targetBare, verifyClone };
}

describe("sync-github-mirror", () => {
  test("parses CLI flags with safe dry-run default", () => {
    expect(parseMirrorArgs([], "/repo")).toEqual({
      sourceRepoDir: "/repo",
      target: "https://github.com/Acrazie/forgix.git",
      branch: "main",
      sourceRef: "HEAD",
      apply: false,
    });
    expect(
      parseMirrorArgs(
        [
          "--target",
          "/tmp/x.git",
          "--branch",
          "dev",
          "--push-branch",
          "mirror/dev",
          "--source-ref",
          "v1",
          "--apply",
        ],
        "/repo",
      ),
    ).toEqual({
      sourceRepoDir: "/repo",
      target: "/tmp/x.git",
      branch: "dev",
      pushBranch: "mirror/dev",
      sourceRef: "v1",
      apply: true,
    });
    expect(() => parseMirrorArgs(["--bogus"], "/repo")).toThrow(/Unknown argument/);
  });

  test("dry-run previews sync without pushing, apply syncs root layout while preserving .github/, and re-run is idempotent", () => {
    const { sandbox, sourceDir, targetBare, verifyClone } = createFixtureRepos();
    try {
      const beforeHead = git(targetBare, ["rev-parse", "refs/heads/main"]);

      const preview = syncGithubMirror({
        sourceRepoDir: sourceDir,
        target: targetBare,
        branch: "main",
        sourceRef: "HEAD",
        apply: false,
      });
      expect(preview.status).toBe("dry_run");
      expect(preview.pushed).toBe(false);
      expect(preview.preservedGithub).toBe(true);
      expect(preview.changedFiles).toBeGreaterThan(0);
      expect(git(targetBare, ["rev-parse", "refs/heads/main"])).toBe(beforeHead);

      const applied = syncGithubMirror({
        sourceRepoDir: sourceDir,
        target: targetBare,
        branch: "main",
        sourceRef: "HEAD",
        apply: true,
      });
      expect(applied.status).toBe("pushed");
      expect(applied.pushed).toBe(true);
      expect(applied.preservedGithub).toBe(true);

      git(sandbox, ["clone", "--branch", "main", targetBare, verifyClone]);
      expect(existsSync(join(verifyClone, "plugin.json"))).toBe(true);
      expect(existsSync(join(verifyClone, "dist", "forgix.mjs"))).toBe(true);
      expect(existsSync(join(verifyClone, "plugins"))).toBe(false);
      expect(
        readFileSync(join(verifyClone, ".github", "workflows", "publish-entire-npm.yml"), "utf8"),
      ).toBe("name: Publish npm\n");

      const rerun = syncGithubMirror({
        sourceRepoDir: sourceDir,
        target: targetBare,
        branch: "main",
        sourceRef: "HEAD",
        apply: true,
      });
      expect(rerun.status).toBe("up_to_date");
      expect(rerun.pushed).toBe(false);
      expect(rerun.changedFiles).toBe(0);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test("refuses to sync a source ref missing required root plugin files", () => {
    const { sandbox, sourceDir, targetBare } = createFixtureRepos();
    try {
      rmSync(join(sourceDir, "plugin.json"));
      git(sourceDir, ["add", "-A"]);
      git(sourceDir, ["commit", "-m", "remove plugin.json"]);
      expect(() =>
        syncGithubMirror({
          sourceRepoDir: sourceDir,
          target: targetBare,
          branch: "main",
          sourceRef: "HEAD",
          apply: false,
        }),
      ).toThrow(/missing required root plugin file: plugin\.json/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
