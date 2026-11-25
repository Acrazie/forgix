import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type {
  AssuranceEvidenceRecord,
  AssuranceReceipt,
  TaskState,
  WorkflowHistoryEvent,
} from "../types.js";
import { resolveGitWorktree } from "./build-authorization.js";
import { canonicalize, sha256Hex, sha256Prefixed } from "./digest.js";

export const ASSURANCE_RECEIPT_VERSION = 2;

export type AssureCompletionClassification = "none" | "verified" | "historical" | "incomplete";

export function computeAssuranceReceiptDigest(receipt: AssuranceReceipt): string {
  const { receiptDigest: _digest, ...body } = receipt;
  return sha256Prefixed(canonicalize(body));
}

function hashFileBytes(filePath: string): string | undefined {
  try {
    if (!lstatSync(filePath).isFile()) return undefined;
    return `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;
  } catch {
    return undefined;
  }
}

function runGit(root: string, args: readonly string[], timeout: number): string | undefined {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout,
    });
  } catch {
    return undefined;
  }
}

function resolveHeadSha(root: string): string | undefined {
  const head = runGit(root, ["rev-parse", "--verify", "HEAD"], 2000)?.trim();
  if (head) return head;
  const symbolic = runGit(root, ["symbolic-ref", "-q", "HEAD"], 2000)?.trim();
  return symbolic ? `UNBORN:${symbolic}` : undefined;
}

function parsePorcelainPaths(rawStatus: string): Array<{ status: string; path: string }> {
  const tokens = rawStatus.split("\0").filter((entry) => entry.length > 0);
  const entries: Array<{ status: string; path: string }> = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    const status = token.slice(0, 2);
    entries.push({ status, path: token.slice(3) });
    if ((status.includes("R") || status.includes("C")) && i + 1 < tokens.length) {
      i += 1;
    }
  }
  return entries.toSorted((a, b) => a.path.localeCompare(b.path));
}

export function observeWorktreeSnapshot(workspaceRoot: string): string | undefined {
  const root = resolveGitWorktree(workspaceRoot);
  const head = root ? resolveHeadSha(root) : undefined;
  const rawStatus =
    root && head ? runGit(root, ["status", "--porcelain=v1", "-z"], 3000) : undefined;
  if (!root || !head || rawStatus === undefined) return undefined;

  const dirty = parsePorcelainPaths(rawStatus).map(({ status, path }) => ({
    status,
    path,
    digest: status.includes("D") ? "DELETED" : (hashFileBytes(resolve(root, path)) ?? "NON_FILE"),
  }));
  return sha256Prefixed(canonicalize({ head, dirty }));
}

export function observeExternalArtifacts(
  workspaceRoot: string,
  artifactPaths: readonly string[],
): Record<string, string> | undefined {
  const digests: Record<string, string> = {};
  for (const rawPath of artifactPaths) {
    const trimmed = rawPath.trim();
    if (!trimmed) return undefined;
    const absPath = isAbsolute(trimmed) ? trimmed : resolve(workspaceRoot, trimmed);
    const rel = relative(workspaceRoot, absPath);
    if (rel.startsWith("..") || isAbsolute(rel)) return undefined;
    const digest = hashFileBytes(absPath);
    if (!digest) return undefined;
    digests[trimmed] = digest;
  }
  return canonicalize(digests);
}

function sameStringArray(a: readonly string[] | undefined, b: readonly string[]): boolean {
  return Array.isArray(a) && a.length === b.length && a.every((item, idx) => item === b[idx]);
}

function isReceiptConsistent(state: TaskState, receipt: AssuranceReceipt): boolean {
  return (
    receipt.taskId === state.taskId &&
    receipt.contractDigest === state.contractDigest &&
    receipt.receiptDigest === computeAssuranceReceiptDigest(receipt)
  );
}

function matchesV2Completion(
  receipt: AssuranceReceipt,
  event: WorkflowHistoryEvent,
  completionIndex: readonly string[],
): boolean {
  const hasFields = Boolean(receipt.worktreeDigest) && Boolean(receipt.observedSnapshotFingerprint);
  const matchesEvent =
    event.receiptVersion === ASSURANCE_RECEIPT_VERSION &&
    event.receiptDigest === receipt.receiptDigest &&
    event.contractDigest === receipt.contractDigest &&
    event.verifiedSnapshotFingerprint === receipt.verifiedSnapshotFingerprint;
  const matchesIndex =
    event.completionIndex === undefined || sameStringArray(event.completionIndex, completionIndex);
  return hasFields && matchesEvent && matchesIndex;
}

function matchesV1Completion(receipt: AssuranceReceipt, event: WorkflowHistoryEvent): boolean {
  return (
    (event.receiptDigest === undefined || event.receiptDigest === receipt.receiptDigest) &&
    (event.contractDigest === undefined || event.contractDigest === receipt.contractDigest) &&
    (event.verifiedSnapshotFingerprint === undefined ||
      event.verifiedSnapshotFingerprint === receipt.verifiedSnapshotFingerprint)
  );
}

export function classifyAssureCompletion(state: TaskState): AssureCompletionClassification {
  const receipt = state.assurance?.receipt;
  const completionIndex = state.assurance?.completionIndex;
  const assureEvents = state.history.filter(
    (event): event is WorkflowHistoryEvent => event.type === "assure.completed",
  );
  if (!receipt && assureEvents.length === 0) return "none";
  if (!receipt || assureEvents.length !== 1 || !completionIndex?.length) return "incomplete";
  if (!isReceiptConsistent(state, receipt)) return "incomplete";

  const event = assureEvents[0]!;
  if (receipt.schemaVersion === ASSURANCE_RECEIPT_VERSION) {
    return matchesV2Completion(receipt, event, completionIndex) ? "verified" : "incomplete";
  }
  if (receipt.schemaVersion === 1) {
    return matchesV1Completion(receipt, event) ? "historical" : "incomplete";
  }
  return "incomplete";
}

export function completionProofSnapshot(state: TaskState | undefined): string {
  return sha256Hex(
    canonicalize({
      receipt: state?.assurance?.receipt ?? null,
      index: state?.assurance?.completionIndex ?? null,
      events: (state?.history ?? []).filter((event) => event.type === "assure.completed"),
    }),
  );
}

export function buildV2AssureCompletionPair(
  state: TaskState,
  sortedRecords: readonly AssuranceEvidenceRecord[],
  worktreeDigest: string,
  artifactDigests: Record<string, string> | undefined,
): {
  completionIndex: string[];
  receipt: AssuranceReceipt;
  event: WorkflowHistoryEvent;
} {
  const distinctSnapshots = Array.from(
    new Set(sortedRecords.map((r) => r.observedFingerprint)),
  ).toSorted();
  const verifiedSnapshotFingerprint =
    state.activeWorktree?.gitFingerprint ??
    (distinctSnapshots.length === 1 && distinctSnapshots[0]
      ? distinctSnapshots[0]
      : sha256Prefixed(canonicalize(distinctSnapshots)));
  const completedAt =
    sortedRecords
      .map((r) => r.recordedAt)
      .toSorted((a, b) => Date.parse(a) - Date.parse(b))
      .at(-1) ?? new Date(0).toISOString();
  const completionIndex = sortedRecords.map((r) => r.evidenceId);
  const body: Omit<AssuranceReceipt, "receiptDigest"> = {
    schemaVersion: ASSURANCE_RECEIPT_VERSION,
    taskId: state.taskId,
    contractDigest: state.contractDigest!,
    verifiedSnapshotFingerprint,
    evidenceIndexDigest: sha256Prefixed(canonicalize(sortedRecords)),
    completedAt,
    worktreeDigest,
    observedSnapshotFingerprint: worktreeDigest,
    ...(artifactDigests ? { artifactDigests } : {}),
  };
  const receipt: AssuranceReceipt = {
    ...body,
    receiptDigest: computeAssuranceReceiptDigest(body as AssuranceReceipt),
  };
  const event: WorkflowHistoryEvent = {
    sequence: (state.history.at(-1)?.sequence ?? 0) + 1,
    at: completedAt,
    type: "assure.completed",
    refs: [{ kind: "artifact", ref: `assurance:${state.taskId}` }],
    receiptDigest: receipt.receiptDigest,
    contractDigest: receipt.contractDigest,
    verifiedSnapshotFingerprint: receipt.verifiedSnapshotFingerprint,
    completionIndex,
    receiptVersion: ASSURANCE_RECEIPT_VERSION,
  };
  return { completionIndex, receipt, event };
}
