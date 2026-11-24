import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";

const root = fileURLToPath(new URL("../..", import.meta.url));
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  PATH: `${join(root, "node_modules/.bin")}${delimiter}${process.env.PATH}`,
};

test("CLINT enforces the explicitly approved commit policy without modifying messages", () => {
  const cases: [string, number][] = [
    ["feat: add parser\n", 0],
    ["feat!: add parser\n\nBREAKING CHANGE: parser changed\n", 0],
    ["feat: add parser.\n", 0],
    ["feat: add parser \n", 0],
    [`feat: add parser\n\n${"a".repeat(101)}\n`, 0],
    [`feat: add parser\n\nRefs: ${"a".repeat(101)}\n`, 0],
    ["fixup! feat: add parser\n", 1],
    ["squash! feat: add parser\n", 1],
    ["feat: add parser\nbody\n", 1],
    [`feat: ${"a".repeat(94)}\n`, 0],
    [`feat: ${"a".repeat(95)}\n`, 1],
    [`feat: ${"😀".repeat(94)}\n`, 0],
    [`feat: ${"😀".repeat(95)}\n`, 1],
    [`feat: ${"a".repeat(101)}\n`, 1],
    ["Feat: add parser\n", 1],
    ["banana: add parser\n", 1],
    ["feat: \n", 1],
    ['Revert "add parser"\n\nThis reverts commit abcdef1234567890.\n', 1],
  ];
  const directory = mkdtempSync(join(tmpdir(), "forgix-clint-"));
  const message = join(directory, "message with spaces.txt");
  try {
    for (const [contents, status] of cases) {
      writeFileSync(message, contents);
      const result = spawnSync(
        "fluidise-clint",
        ["--config", join(root, "fluidise.toml"), "--file", message],
        { env, encoding: "utf8" },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, `${contents}\n${result.stdout}\n${result.stderr}`).toBe(status);
      expect(readFileSync(message, "utf8")).toBe(contents);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Vite+ dispatcher blocks invalid messages and bad staged formatting in a real Git repository", () => {
  const directory = mkdtempSync(join(tmpdir(), "forgix-vite-hooks-"));
  try {
    execFileSync("git", ["init", "--quiet", directory], { env });
    symlinkSync(join(root, "node_modules"), join(directory, "node_modules"), "dir");
    copyFileSync(join(root, "vite.config.ts"), join(directory, "vite.config.ts"));
    copyFileSync(join(root, "fluidise.toml"), join(directory, "fluidise.toml"));
    mkdirSync(join(directory, ".vite-hooks"));
    for (const hook of ["pre-commit", "commit-msg", "commit-msg.pre-entire"]) {
      const path = join(directory, ".vite-hooks", hook);
      copyFileSync(join(root, ".vite-hooks", hook), path);
      chmodSync(path, 0o755);
    }
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({
        name: "hooks-fixture",
        private: true,
        type: "module",
        packageManager: "bun@1.4.4",
        scripts: { "check:staged": `bun "${join(root, "scripts/check-staged.ts")}"` },
      }),
    );
    const instructions = "Fixture instructions remain unchanged.\n";
    writeFileSync(join(directory, "AGENTS.md"), instructions);
    const enable = spawnSync(process.execPath, [join(root, "scripts/prepare-hooks.ts")], {
      cwd: directory,
      env,
      encoding: "utf8",
    });
    expect(enable.status, `${enable.stdout}\n${enable.stderr}`).toBe(0);
    expect(readFileSync(join(directory, "AGENTS.md"), "utf8")).toBe(instructions);
    const commit = (message: string) =>
      spawnSync(
        "git",
        [
          "-c",
          "user.name=Hook Test",
          "-c",
          "user.email=hook@example.invalid",
          "commit",
          "--allow-empty",
          "-m",
          message,
        ],
        { cwd: directory, env, encoding: "utf8" },
      );
    let result = commit("feat: initial commit.");
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    result = commit("banana: rejected message");
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("commit.type.not_allowed");
    writeFileSync(join(directory, "example.ts"), "export const value=2;\n");
    execFileSync("git", ["-C", directory, "add", "--", "example.ts"], { env });
    result = commit("feat: rejected formatting");
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("Format issues");
    expect(readFileSync(join(directory, "example.ts"), "utf8")).toBe("export const value=2;\n");
    expect(
      execFileSync("git", ["-C", directory, "show", ":example.ts"], { env, encoding: "utf8" }),
    ).toBe("export const value=2;\n");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 60_000);
