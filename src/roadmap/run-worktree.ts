import { spawnSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { dirname } from "node:path";
import { resolveGitWorktree } from "../core/build-authorization.js";
import { createWorkspaceStore } from "../core/store.js";
import { resolveRemoteBase, WORKTREE_GIT_TIMEOUT_MS } from "../core/worktree-base.js";
import { RoadmapError } from "./index.js";

function git(root: string, args: string[]) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 10000 });
}

export function hasBranch(root: string, branch: string): boolean {
  const { status } = git(root, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
  if (status === 0) return true;
  if (status === 1) return false;
  throw new RoadmapError(
    "roadmap_invalid",
    "Cannot verify Roadmap branch; preserve the coordinate.",
  );
}

export function hasWorktreePath(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return false;
    throw error;
  }
}

export async function worktreeIdentity(root: string, path: string, branch: string) {
  if (resolveGitWorktree(path) !== path) return undefined;
  const reference = git(path, ["symbolic-ref", "--quiet", "HEAD"]);
  if (reference.status !== 0 || reference.stdout.trim() !== `refs/heads/${branch}`)
    return undefined;
  const commonArgs = ["rev-parse", "--path-format=absolute", "--git-common-dir"];
  const origin = git(root, commonArgs);
  const checkout = git(path, commonArgs);
  if (origin.status !== 0 || checkout.status !== 0 || origin.stdout !== checkout.stdout)
    return undefined;
  const listing = git(root, ["worktree", "list", "--porcelain", "-z"]);
  if (listing.status !== 0) return undefined;
  const registered = listing.stdout.split("\0\0").some((record) => {
    const [worktree, ...fields] = record.split("\0");
    return worktree === `worktree ${path}` && fields.includes(`branch refs/heads/${branch}`);
  });
  if (!registered) return undefined;
  return createWorkspaceStore(path).fileIdentity(".git");
}

export async function createRunWorktree(
  root: string,
  relativePath: string,
  branch: string,
  baseBranch: string,
) {
  const store = createWorkspaceStore(root);
  const path = store.resolvePath(relativePath);
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", FORGIX_ROADMAP_SETUP: "1" };
  const base = resolveRemoteBase(root, baseBranch, env);
  await store.ensureSafeDirectory(dirname(relativePath));
  if (hasWorktreePath(path) || hasBranch(root, branch)) return undefined;
  const result = spawnSync(
    "git",
    ["worktree", "add", "--no-track", "-b", branch, "--", path, base],
    {
      cwd: root,
      stdio: "ignore",
      env,
      timeout: WORKTREE_GIT_TIMEOUT_MS,
      killSignal: "SIGKILL",
    },
  );
  return result.status === 0 ? worktreeIdentity(root, path, branch) : undefined;
}
