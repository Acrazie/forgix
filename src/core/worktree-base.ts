import { spawnSync } from "node:child_process";

export class WorktreeBaseError extends Error {}
export const WORKTREE_GIT_TIMEOUT_MS = 60_000;

function git(cwd: string, args: string[], env = process.env) {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: WORKTREE_GIT_TIMEOUT_MS,
    killSignal: "SIGKILL",
    env: { ...env, GIT_TERMINAL_PROMPT: "0" },
  });
}

export function resolveRemoteBase(cwd: string, base: string, env = process.env): string {
  const run = (args: string[]) => git(cwd, args, env);
  if (base === "HEAD" || run(["check-ref-format", `refs/heads/${base}`]).status !== 0) {
    throw new WorktreeBaseError(`Invalid base branch name: ${base}`);
  }
  if (run(["remote", "get-url", "origin"]).status !== 0) {
    throw new WorktreeBaseError("Remote origin is not configured.");
  }
  const fetch = run([
    "fetch",
    "--prune",
    "--no-tags",
    "origin",
    "+refs/heads/*:refs/remotes/origin/*",
  ]);
  if (fetch.status !== 0) {
    throw new WorktreeBaseError("Could not fetch origin; refusing to use a cached base.");
  }
  const revision = run(["rev-parse", "--verify", `refs/remotes/origin/${base}^{commit}`]);
  if (revision.status !== 0) {
    throw new WorktreeBaseError(`Base branch origin/${base} does not exist.`);
  }
  return revision.stdout.trim();
}

export function checkWorktreeBase(cwd: string, base: string): { base: string; commit: string } {
  const expected = resolveRemoteBase(cwd, base);
  const head = git(cwd, ["rev-parse", "--verify", "HEAD"]);
  if (head.status !== 0) throw new WorktreeBaseError("Could not resolve the worktree HEAD.");
  const actual = head.stdout.trim();
  if (actual !== expected) {
    throw new WorktreeBaseError(
      `Worktree HEAD ${actual} does not match origin/${base} ${expected}. Start from the fetched base before editing.`,
    );
  }
  return { base: `origin/${base}`, commit: expected };
}
