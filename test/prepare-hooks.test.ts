import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";

const script = fileURLToPath(new URL("../scripts/prepare-hooks.ts", import.meta.url));

test("linked-worktree hook setup never changes shared settings and preserves foreign hooks", () => {
  const directory = mkdtempSync(join(tmpdir(), "forgix-hook-scope-"));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  const git = (args: string[]) =>
    execFileSync("git", ["-C", directory, ...args], { env, encoding: "utf8" }).trim();
  try {
    git(["init", "--quiet"]);
    git([
      "-c",
      "user.name=Hook Test",
      "-c",
      "user.email=hook@example.invalid",
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      "test: create fixture",
    ]);
    const linked = join(directory, "linked");
    git(["worktree", "add", "--quiet", "--detach", linked, "HEAD"]);
    const sharedConfig = join(directory, ".git", "config");
    const beforeEnable = readFileSync(sharedConfig);
    const run = () => spawnSync(process.execPath, [script], { cwd: linked, env, encoding: "utf8" });
    let result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("requires extensions.worktreeConfig=true");
    expect(readFileSync(sharedConfig)).toEqual(beforeEnable);
    git(["config", "extensions.worktreeConfig", "true"]);
    const original = readFileSync(sharedConfig);
    result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(git(["-C", linked, "config", "--worktree", "--get", "core.hooksPath"])).toBe(
      ".vite-hooks",
    );
    expect(readFileSync(sharedConfig)).toEqual(original);
    git(["-C", linked, "config", "--worktree", "core.hooksPath", "custom/hooks"]);
    result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(git(["-C", linked, "config", "--worktree", "--get", "core.hooksPath"])).toBe(
      "custom/hooks",
    );
    expect(readFileSync(sharedConfig)).toEqual(original);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
