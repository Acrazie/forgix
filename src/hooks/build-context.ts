import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { hasBuildAuthorization, resolveGitWorktree } from "../core/build-authorization.js";
import { checkContractReviewBuildSources } from "../core/contract-review-sources.js";
import { StateStoreError, validateSchema } from "../core/schema.js";
import { createWorkspaceStore, type WorkspaceStore } from "../core/store.js";
import type { TaskState } from "../types.js";
import { canonicalizePath, type ActiveTaskResolution } from "./context.js";

function couldOwnBuild(state: TaskState): boolean {
  return (
    state.status === "executing" ||
    state.status === "awaiting_approval" ||
    (state.status === "blocked" && state.resumeTo === "executing")
  );
}

async function listTaskFiles(store: WorkspaceStore): Promise<string[]> {
  const folder = ".forgix/tasks";
  try {
    await store.readText(`${folder}/.forgix-directory-probe`, true);
    return (await readdir(store.resolvePath(folder))).filter((name) => name.endsWith(".json"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function loadBuildCandidates(store: WorkspaceStore): Promise<TaskState[]> {
  const states = await Promise.all(
    (await listTaskFiles(store)).map(async (name) => {
      const content = await store.readText(`.forgix/tasks/${name}`, false, 2_000_000);
      const parsed: unknown = JSON.parse(content ?? "");
      if (!validateSchema("state", parsed).valid) {
        throw new StateStoreError("state_invalid", "Unrecognized TaskState.");
      }
      const state = parsed as TaskState;
      if (name !== `${state.taskId}.json`) {
        throw new StateStoreError(
          "state_task_mismatch",
          "TaskState filename and task ID do not match.",
        );
      }
      return state;
    }),
  );
  return states.filter(couldOwnBuild);
}

async function resolveBuildContext(root: string, live: boolean): Promise<ActiveTaskResolution> {
  const store = createWorkspaceStore(root);
  const states = await loadBuildCandidates(store);
  if (states.length === 0) return { kind: "none" };
  if (states.length > 1) return { kind: "ambiguous", taskIds: states.map(({ taskId }) => taskId) };

  const state = states[0]!;
  if (state.status !== "executing" || !hasBuildAuthorization(state, root)) {
    return { kind: "unverified" };
  }
  if (live) await checkContractReviewBuildSources(state, store);
  return {
    kind: "active",
    task: {
      taskId: state.taskId,
      status: "executing",
      worktreeRef: root,
      approvedProtectedPaths: state.shape?.contract?.approvedProtectedPaths ?? [],
      approvedEscapeHatches: state.shape?.contract?.approvedEscapeHatches ?? [],
      ...(state.contractReview ? { contractReviewReceipt: state.planApproval!.receiptDigest } : {}),
    },
  };
}

export async function lookupBuildContext(
  root: string,
  live = false,
): Promise<ActiveTaskResolution> {
  try {
    return await resolveBuildContext(root, live);
  } catch {
    return { kind: "unverified" };
  }
}

export function owningWorktree(rawPath: string, cwd: string): string | undefined {
  let directory = dirname(canonicalizePath(resolve(cwd, rawPath)));
  for (;;) {
    const root = resolveGitWorktree(directory);
    if (root) return root;
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

export function withoutExemptions(result: ActiveTaskResolution): ActiveTaskResolution {
  if (result.kind !== "active") return result;
  return { kind: "unverified" };
}
