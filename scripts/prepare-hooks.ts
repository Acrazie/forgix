import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function config(key: string, boolean = false): string | undefined {
  const result = spawnSync("git", ["config", ...(boolean ? ["--bool"] : []), "--get", key], {
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status === 1) return undefined;
  if (result.status !== 0) throw new Error(result.stderr || `Cannot read Git setting ${key}.`);
  return result.stdout.trim();
}

if (process.env.VP_GIT_HOOKS !== "0" && config("vp.hooks.disabled", true) !== "true") {
  const gitDir = resolve(git(["rev-parse", "--git-dir"]));
  const commonDir = resolve(git(["rev-parse", "--git-common-dir"]));
  if (gitDir === commonDir) {
    const vp = fileURLToPath(new URL("../node_modules/.bin/vp", import.meta.url));
    const result = spawnSync(vp, ["config", "--no-agent"], { stdio: "inherit" });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } else {
    const existing = config("core.hooksPath");
    if (existing && existing !== ".vite-hooks" && existing !== ".vite-hooks/_") {
      console.log(`Preserving existing hooks path: ${existing}`);
    } else {
      if (config("extensions.worktreeConfig", true) !== "true") {
        throw new Error(
          "Linked-worktree hook setup requires extensions.worktreeConfig=true. Enable it explicitly before retrying; shared Git settings were not changed.",
        );
      }
      // Vite+ writes --local settings shared by linked worktrees. Use Git's native
      // per-worktree scope and the same project-owned scripts instead.
      git(["config", "--worktree", "core.hooksPath", ".vite-hooks"]);
      console.log("Project hooks enabled for this worktree only.");
    }
  }
}
