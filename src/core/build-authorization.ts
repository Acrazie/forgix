import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import type {
  CanonicalChangeContract,
  GateDecisionRecord,
  StateHistoryEvent,
  TaskState,
} from "../types.js";
import { sha256Hex } from "./digest.js";
import { EXIT_CODES, StateStoreError } from "./schema.js";

export const BUILD_AUTHORIZATION_RECEIPT_VERSION = 2;

export function resolveGitWorktree(cwd: string): string | undefined {
  try {
    const path = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).replace(/\r?\n$/, "");
    return path ? realpathSync(path) : undefined;
  } catch {
    return undefined;
  }
}

export function canonicalContractDigest(contract: CanonicalChangeContract): string {
  return sha256Hex({ ...contract, digest: "" });
}

export function gateDecisionDigest(record: GateDecisionRecord): string {
  const { receiptDigest: _digest, ...body } = record;
  return sha256Hex(body);
}

function currentApprovalTransition(state: TaskState): StateHistoryEvent | undefined {
  for (const event of state.history.toReversed()) {
    if (event.type !== "state.transition") continue;
    if (event.from === "awaiting_approval" && event.to === "executing") return event;
    if (event.to !== "blocked" && event.to !== "executing") return undefined;
  }
  return undefined;
}

function bindsContract(state: TaskState, receipt: GateDecisionRecord): boolean {
  const contract = state.shape?.contract;
  return (
    contract !== undefined &&
    receipt.taskId === state.taskId &&
    receipt.artifactId === contract.artifactId &&
    receipt.contractDigest === state.contractDigest &&
    receipt.contractDigest === contract.digest &&
    receipt.contractDigest === canonicalContractDigest(contract)
  );
}

function bindsTransition(state: TaskState, receipt: GateDecisionRecord): boolean {
  const transition = currentApprovalTransition(state);
  return (
    transition !== undefined &&
    transition.revision === receipt.stateRevision + 1 &&
    transition.revision <= state.revision &&
    transition.at === receipt.decidedAt &&
    transition.contractDigest === receipt.contractDigest &&
    transition.sourceFingerprint === receipt.stateFingerprint &&
    sha256Hex(transition.gateDecision ?? null) === sha256Hex(receipt)
  );
}

export function hasBuildAuthorization(state: TaskState, canonicalRoot: string): boolean {
  const receipt = state.planApproval;
  if (
    receipt?.schemaVersion !== BUILD_AUTHORIZATION_RECEIPT_VERSION ||
    receipt.actor !== "user" ||
    receipt.issueRef
  )
    return false;
  return (
    receipt.worktreeDigest === sha256Hex(canonicalRoot) &&
    receipt.receiptDigest === gateDecisionDigest(receipt) &&
    bindsContract(state, receipt) &&
    bindsTransition(state, receipt)
  );
}

export function hasWorkspaceBuildAuthorization(state: TaskState, workspaceRoot: string): boolean {
  const root = resolveGitWorktree(workspaceRoot);
  return root === workspaceRoot && hasBuildAuthorization(state, root);
}

export function requireBuildAuthorization(state: TaskState, workspaceRoot: string): void {
  if (!hasWorkspaceBuildAuthorization(state, workspaceRoot)) {
    throw new StateStoreError(
      "state_blocked",
      "BUILD requires a current GATE v2 approval for this worktree. Preserve the worktree and return to SHAPE for fresh human approval.",
      EXIT_CODES.BLOCKED,
    );
  }
}
