import {
  cpSync,
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

// The real preparation code, prompts stubbed and child validation replaced by a
// deterministic local executable. git-cliff and Git themselves are exercised.
function preparation() {
  const directory = mkdtempSync(join(tmpdir(), "forgix-prepare-contract-"));
  const source = new URL("../../../../", import.meta.url);
  for (const path of [
    "cliff.toml",
    "plugins/forgix/scripts/release.ts",
    "plugins/forgix/scripts/release-lib.ts",
    "plugins/forgix/scripts/release-notes.ts",
    "plugins/forgix/package.json",
    "plugins/forgix/.codex-plugin/plugin.json",
    "plugins/forgix/.claude-plugin/plugin.json",
    "plugins/forgix/plugin.json",
    ".claude-plugin/marketplace.json",
  ]) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    cpSync(new URL(path, source), join(directory, path));
  }
  const initial = {
    "bun.lock": "original lock\n",
    "plugins/forgix/dist/forgix.mjs": "original bundle\n",
    "plugins/forgix/CHANGELOG.md": "# Changelog\n\n## [1.0.1] - historical\n\nHistorical bytes.\n",
  };
  for (const [path, contents] of Object.entries(initial)) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), contents);
  }
  writeFileSync(join(directory, ".gitignore"), "node_modules/\n.mock/\n");
  const prompt = join(directory, "node_modules/@clack/prompts");
  mkdirSync(prompt, { recursive: true });
  writeFileSync(join(prompt, "package.json"), '{"type":"module","exports":"./index.js"}');
  writeFileSync(
    join(prompt, "index.js"),
    `
export const intro=()=>{};export const note=()=>{};export const outro=()=>{};export const text=async()=>"2.0.0";
export const isCancel=()=>false;export const select=async(options)=>options.message==='Release target'?process.env.TEST_TARGET:'major';
export const confirm=async()=>process.env.TEST_PREVIEW==='true';
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
 fs.writeFileSync('plugins/forgix/dist/forgix.mjs','prepared bundle\\n');
 if(process.env.TEST_FAILURE==='true') process.exit(1);
 if(process.env.TEST_SIGNAL==='true') process.kill(process.ppid,'SIGTERM');
}else throw new Error('Unexpected local operation: '+args.join(' '));
`,
  );
  chmodSync(bun, 0o755);
  const git = (args: string[]) => requireCommand("git", args, { cwd: directory }).stdout.trimEnd();
  git(["init", "-b", "release-preparation-test"]);
  git(["config", "user.name", "Release test"]);
  git(["config", "user.email", "release@example.invalid"]);
  git(["add", "."]);
  git(["-c", "commit.gpgsign=false", "commit", "-m", "feat: fixture"]);
  git(["tag", "v1.0.1"]);
  const before = git(["rev-parse", "HEAD"]);
  const run = (target: string, preview: boolean, failure = false, signal = false) =>
    Bun.spawnSync(["node", "plugins/forgix/scripts/release.ts"], {
      cwd: directory,
      env: {
        ...process.env,
        PATH: `${fake}:${process.env.PATH}`,
        TEST_TARGET: target,
        TEST_PREVIEW: String(preview),
        TEST_FAILURE: String(failure),
        TEST_SIGNAL: String(signal),
      },
    });
  return {
    directory,
    git,
    before,
    run,
    initial,
    read: (path: string) => readFileSync(join(directory, path), "utf8"),
    close: () => rmSync(directory, { recursive: true, force: true }),
  };
}

describe("release preparation does not publish", () => {
  test("preview restores exact original bytes, Git history and index", () => {
    const p = preparation();
    try {
      const result = p.run("both", true);
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      expect(p.git(["status", "--porcelain=v1"])).toBe("");
      expect(p.git(["rev-parse", "HEAD"])).toBe(p.before);
      for (const [path, contents] of Object.entries(p.initial)) expect(p.read(path)).toBe(contents);
      expect(p.git(["tag", "--list"])).toBe("v1.0.1");
    } finally {
      p.close();
    }
  });
  test("retained npm preparation leaves every plugin manifest unchanged", () => {
    const p = preparation();
    try {
      const codex = p.read("plugins/forgix/.codex-plugin/plugin.json");
      const result = p.run("npm", false);
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      expect(JSON.parse(p.read("plugins/forgix/package.json")).version).toBe("2.0.0");
      expect(p.read("plugins/forgix/.codex-plugin/plugin.json")).toBe(codex);
      expect(p.read("plugins/forgix/CHANGELOG.md")).toContain("## [npm-v2.0.0]");
      expect(p.read("plugins/forgix/CHANGELOG.md")).toEndWith("Historical bytes.\n");
      expect(p.git(["rev-parse", "HEAD"])).toBe(p.before);
      expect(p.git(["diff", "--cached", "--name-only"])).toBe("");
    } finally {
      p.close();
    }
  });
  test("plugin-only preparation leaves npm and lockfile unchanged", () => {
    const p = preparation();
    try {
      const pkg = p.read("plugins/forgix/package.json");
      const result = p.run("plugin", false);
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      expect(p.read("plugins/forgix/package.json")).toBe(pkg);
      expect(p.read("bun.lock")).toBe(p.initial["bun.lock"]);
      expect(p.read("plugins/forgix/CHANGELOG.md")).toContain("## [plugin-v1.0.1-codex.");
    } finally {
      p.close();
    }
  });
  test("failed or interrupted validation restores preparation, without commits or tags", () => {
    for (const signal of [false, true]) {
      const p = preparation();
      try {
        const result = p.run("both", false, !signal, signal);
        expect(result.exitCode).not.toBe(0);
        expect(p.git(["status", "--porcelain=v1"])).toBe("");
        expect(p.git(["rev-parse", "HEAD"])).toBe(p.before);
        expect(p.git(["tag", "--list"])).toBe("v1.0.1");
      } finally {
        p.close();
      }
    }
  });
});
