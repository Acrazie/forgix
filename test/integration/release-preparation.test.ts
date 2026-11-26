import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import { requireCommand } from "../../scripts/release-lib.ts";
import { pinReleaseFixtureVersions } from "../support/release-fixtures.ts";

function gitIn(cwd: string, args: string[]): string {
  return requireCommand("git", args, { cwd }).stdout.trimEnd();
}

// Exercises the real one-step scripts/release.ts against local bare origin and
// mirror repos, stubbing only `bun` (lockfile/check) and `@clack/prompts`.
function releaseFixture() {
  const sandbox = mkdtempSync(join(tmpdir(), "forgix-one-step-release-"));
  const directory = join(sandbox, "repo");
  const originBare = join(sandbox, "origin.git");
  const mirrorBare = join(sandbox, "mirror.git");
  const mirrorSeed = join(sandbox, "mirror-seed");
  mkdirSync(directory, { recursive: true });
  mkdirSync(mirrorSeed, { recursive: true });

  const source = new URL("../../", import.meta.url);
  for (const path of [
    "cliff.toml",
    "scripts/release.ts",
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
  const initial = {
    "bun.lock": "original lock\n",
    "dist/forgix.mjs": "original bundle\n",
    "CHANGELOG.md": "# Changelog\n\n## [1.0.1] - historical\n\nHistorical bytes.\n",
  };
  for (const [path, contents] of Object.entries(initial)) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), contents);
  }
  writeFileSync(join(directory, ".gitignore"), "node_modules/\n.mock/\ndist/\n");

  const prompt = join(directory, "node_modules/@clack/prompts");
  mkdirSync(prompt, { recursive: true });
  writeFileSync(join(prompt, "package.json"), '{"type":"module","exports":"./index.js"}');
  writeFileSync(
    join(prompt, "index.js"),
    `
export const intro=()=>{};export const note=()=>{};export const outro=()=>{};export const text=async()=>"2.0.0";
export const isCancel=()=>false;export const select=async()=>'major';
`,
  );

  const fake = join(directory, ".mock");
  mkdirSync(fake);
  const bun = join(fake, "bun");
  writeFileSync(
    bun,
    `#!/usr/bin/env node
import fs from 'node:fs';
const args=process.argv.slice(2);
if(args[0]==='install') fs.writeFileSync('bun.lock','prepared lock\\n');
else if(args.join(' ')==='run check'){
 fs.writeFileSync('dist/forgix.mjs','prepared bundle\\n');
 if(process.env.TEST_FAILURE==='true') process.exit(1);
 if(process.env.TEST_SIGNAL==='true') process.kill(process.ppid,'SIGTERM');
}else throw new Error('Unexpected local operation: '+args.join(' '));
`,
  );
  chmodSync(bun, 0o755);

  // Stub `entire` CLI to simulate server-side Trail merge into origin/main.
  const entire = join(fake, "entire");
  writeFileSync(
    entire,
    `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
if (args[0] === 'trail' && args[1] === 'create') {
  console.log(JSON.stringify({ id: 'trail-test', status: 'open' }));
  process.exit(0);
}
if (args[0] === 'trail' && args[1] === 'merge') {
  const idx = args.indexOf('--branch');
  const branch = idx >= 0 ? args[idx + 1] : '';
  const origin = process.env.TEST_ORIGIN_BARE;
  const sha = spawnSync('git', ['rev-parse', 'refs/heads/' + branch], { cwd: origin, encoding: 'utf8' }).stdout.trim();
  const upd = spawnSync('git', ['update-ref', 'refs/heads/main', sha], { cwd: origin, encoding: 'utf8' });
  if (upd.status !== 0) process.exit(1);
  spawnSync('git', ['branch', '-D', branch], { cwd: origin, encoding: 'utf8' });
  process.exit(0);
}
throw new Error('Unexpected entire command: ' + args.join(' '));
`,
  );
  chmodSync(entire, 0o755);

  const git = (args: string[]) => gitIn(directory, args);

  // Bare origin repo
  gitIn(sandbox, ["init", "--bare", originBare]);
  git(["init", "-b", "main"]);
  git(["config", "user.name", "Release test"]);
  git(["config", "user.email", "release@example.invalid"]);
  git(["config", "commit.gpgsign", "false"]);
  git(["config", "tag.gpgSign", "false"]);
  git(["add", "."]);
  git(["add", "-f", "dist/forgix.mjs"]);
  git(["commit", "-m", "feat: fixture"]);
  git(["tag", "v1.0.1"]);
  git(["remote", "add", "origin", originBare]);
  git(["push", "-u", "origin", "main", "--tags"]);
  gitIn(originBare, ["symbolic-ref", "HEAD", "refs/heads/main"]);

  // Bare GitHub mirror repo with .github/workflows/release.yml
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

  const before = git(["rev-parse", "HEAD"]);
  const run = (args: string[], options?: { failure?: boolean; signal?: boolean }) =>
    Bun.spawnSync(["node", "scripts/release.ts", ...args], {
      cwd: directory,
      env: {
        ...process.env,
        PATH: `${fake}:${process.env.PATH}`,
        FORGIX_MIRROR_TARGET: mirrorBare,
        TEST_ORIGIN_BARE: originBare,
        TEST_FAILURE: String(options?.failure ?? false),
        TEST_SIGNAL: String(options?.signal ?? false),
      },
    });
  return {
    sandbox,
    directory,
    originBare,
    mirrorBare,
    git,
    gitIn,
    before,
    run,
    initial,
    read: (path: string) => readFileSync(join(directory, path), "utf8"),
    close: () => rmSync(sandbox, { recursive: true, force: true }),
  };
}

describe("one-step release command", () => {
  test("dry-run validates and restores exact original bytes, Git history and remotes", () => {
    const f = releaseFixture();
    try {
      const result = f.run(["major", "--dry-run"]);
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      expect(f.git(["status", "--porcelain=v1"])).toBe("");
      expect(f.git(["rev-parse", "HEAD"])).toBe(f.before);
      for (const [path, contents] of Object.entries(f.initial)) expect(f.read(path)).toBe(contents);
      expect(f.git(["tag", "--list"])).toBe("v1.0.1");
      expect(f.gitIn(f.mirrorBare, ["tag", "--list"])).toBe("");
    } finally {
      f.close();
    }
  });

  test("commits, tags, pushes Entire main + tag, and syncs GitHub mirror + tag while preserving .github/", () => {
    const f = releaseFixture();
    try {
      const result = f.run(["major"]);
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      expect(JSON.parse(f.read("package.json")).version).toBe("2.0.0");
      expect(JSON.parse(f.read(".codex-plugin/plugin.json")).version).toMatch(
        /^2\.0\.0\+codex\.\d{14}$/,
      );
      expect(JSON.parse(f.read(".claude-plugin/plugin.json")).version).toBe("2.0.0");
      expect(JSON.parse(f.read("plugin.json")).version).toBe("2.0.0");
      expect(f.read("CHANGELOG.md")).toContain("## [v2.0.0] - ");
      expect(f.read("CHANGELOG.md")).toEndWith("Historical bytes.\n");
      expect(f.git(["status", "--porcelain=v1"])).toBe("");
      expect(f.git(["log", "-1", "--format=%s"])).toBe("chore(release): v2.0.0");
      expect(f.gitIn(f.originBare, ["tag", "--list", "v2.0.0"])).toBe("v2.0.0");
      expect(f.gitIn(f.mirrorBare, ["tag", "--list", "v2.0.0"])).toBe("v2.0.0");

      const verifyClone = join(f.sandbox, "verify-mirror");
      f.gitIn(f.sandbox, ["clone", "--branch", "main", f.mirrorBare, verifyClone]);
      expect(JSON.parse(readFileSync(join(verifyClone, "package.json"), "utf8")).version).toBe(
        "2.0.0",
      );
      expect(existsSync(join(verifyClone, "dist", "forgix.mjs"))).toBe(true);
      expect(readFileSync(join(verifyClone, ".github", "workflows", "release.yml"), "utf8")).toBe(
        "name: Release\n",
      );
    } finally {
      f.close();
    }
  });

  test("refuses non-main branch without modifying worktree or remotes", () => {
    const f = releaseFixture();
    try {
      f.git(["checkout", "-b", "feat/not-main"]);
      const result = f.run(["patch"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr.toString()).toContain("synchronized main branch");
      expect(f.git(["rev-parse", "HEAD"])).toBe(f.before);
    } finally {
      f.close();
    }
  });

  test("failed or interrupted validation restores files with zero commits or tags", () => {
    for (const signal of [false, true]) {
      const f = releaseFixture();
      try {
        const result = f.run(["patch"], { failure: !signal, signal });
        expect(result.exitCode).not.toBe(0);
        expect(f.git(["status", "--porcelain=v1"])).toBe("");
        expect(f.git(["rev-parse", "HEAD"])).toBe(f.before);
        expect(f.git(["tag", "--list"])).toBe("v1.0.1");
      } finally {
        f.close();
      }
    }
  });

  test("prints idempotent mirror retry command if mirror push fails after Entire push", () => {
    const f = releaseFixture();
    try {
      const result = f.run(["patch", "--mirror-target", join(f.sandbox, "missing.git")]);
      expect(result.exitCode).toBe(1);
      const stderr = result.stderr.toString();
      expect(stderr).toContain("Entire push succeeded for v1.0.2");
      expect(stderr).toContain("bun scripts/sync-github-mirror.ts --target");
      expect(stderr).toContain("--source-ref v1.0.2 --tag v1.0.2 --apply");
      expect(f.gitIn(f.originBare, ["tag", "--list", "v1.0.2"])).toBe("v1.0.2");
    } finally {
      f.close();
    }
  });
});
