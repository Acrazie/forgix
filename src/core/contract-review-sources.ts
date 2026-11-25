import type { TaskState } from "../types.js";
import { assertCleanHygiene, sha256Hex } from "./digest.js";
import { EXIT_CODES, StateStoreError } from "./schema.js";
import type { WorkspaceStore } from "./store.js";

export const MAX_SOURCES = 24;
const MAX_SOURCE_BYTES = 48_000;
const SOURCE = /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/;

function blocked(message: string): never {
  throw new StateStoreError("state_blocked", message, EXIT_CODES.BLOCKED);
}

export function sourcePath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 240 ||
    !SOURCE.test(value) ||
    value
      .split("/")
      .some((segment) => segment === "." || segment === ".." || segment.startsWith(".")) ||
    /(?:^|\/)(?:node_modules|credentials?)(?:\/|$)|\.(?:key|pem|p12)$/iu.test(value)
  ) {
    throw new StateStoreError("state_invalid", "Invalid review source path.");
  }
  return value;
}

export async function readSources(store: WorkspaceStore, paths: string[]) {
  const files = await Promise.all(
    paths.map(async (path) => {
      const content = await store.readText(sourcePath(path), false, MAX_SOURCE_BYTES);
      if (
        content === undefined ||
        content.includes("\u0000") ||
        content.includes("\uFFFD") ||
        Buffer.byteLength(content) > MAX_SOURCE_BYTES
      ) {
        return blocked("Invalid review source text.");
      }
      return { path, digest: sha256Hex(content), content };
    }),
  );
  if (files.reduce((sum, item) => sum + Buffer.byteLength(item.content), 0) > MAX_SOURCE_BYTES) {
    blocked("Review capsule too large.");
  }
  try {
    for (const file of files) assertCleanHygiene(file.content);
  } catch {
    return blocked("Review source fails hygiene.");
  }
  return files;
}

export async function checkContractReviewManifest(
  state: TaskState,
  store: WorkspaceStore,
): Promise<void> {
  const capsule = state.contractReview?.capsule;
  if (
    !capsule ||
    capsule.taskId !== state.taskId ||
    capsule.worktree !== sha256Hex(store.workspaceRoot) ||
    !state.contractDigest ||
    capsule.contractDigest !== state.contractDigest ||
    capsule.sources.length > MAX_SOURCES
  ) {
    return blocked("Review capsule, contract or worktree changed.");
  }
  const current = await readSources(
    store,
    capsule.sources.map(({ path }) => path),
  );
  if (current.some((source, i) => source.digest !== capsule.sources[i]?.digest)) {
    blocked("Reviewed source changed; return to SHAPE.");
  }
}

export async function checkContractReviewBuildSources(
  state: TaskState,
  store: WorkspaceStore,
): Promise<void> {
  const review = state.contractReview;
  if (!review) return;
  const proof = review.buildProof;
  if (
    !proof ||
    proof.receipt !== state.planApproval?.receiptDigest ||
    proof.worktree !== sha256Hex(store.workspaceRoot)
  ) {
    await checkContractReviewManifest(state, store);
  }
}

export function contractReviewPostCheckSignal(receipt: string, nativeWriteRef: string): string {
  return `Forgix Contract Review post-check complete: ${receipt} ${nativeWriteRef}`;
}
