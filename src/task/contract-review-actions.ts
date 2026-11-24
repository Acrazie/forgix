import { randomUUID } from "node:crypto";
import {
  checkContractReviewBuildSources,
  contractReviewPostCheckSignal,
  MAX_SOURCES,
  sourcePath,
} from "../core/contract-review-sources.js";
import { assertCleanHygiene, sha256Hex } from "../core/digest.js";
import { StateStoreError } from "../core/schema.js";
import type { WorkspaceStore } from "../core/store.js";
import type {
  CanonicalChangeContract,
  ContractReviewParaphrase,
  ContractReviewState,
  HarnessPreference,
  TaskState,
} from "../types.js";
import { prepareContractReview } from "./contract-review-prepare.js";
import {
  activeFindings,
  blockedReview,
  checkContractReviewSources,
  claimReviewRound,
  contractReviewView,
  invalidReview,
  isSupportedReviewHarness,
  reviewCoverage,
  reviewIdentifier,
  reviewList,
  reviewNote,
  reviewObject,
  verifyCurrentCapsule,
  type ReviewCapsule,
  type ReviewFinding,
} from "./contract-review.js";

const MAX_ROUNDS = 5;

function parseParaphrase(value: unknown): ContractReviewParaphrase | undefined {
  if (value === undefined) return undefined;
  const item = reviewObject(value);
  return {
    proposal: reviewNote(item.proposal),
    existingSystem: reviewNote(item.existingSystem),
  };
}

function parseFindings(value: unknown, capsule: ReviewCapsule): ReviewFinding[] {
  const ids = new Set<string>();
  return reviewList(value, 32).map((input) => {
    const finding = reviewObject(input);
    const id = reviewIdentifier(finding.id);
    const { severity } = finding;
    if (ids.has(id) || (severity !== "blocker" && severity !== "major" && severity !== "nit")) {
      return invalidReview("Invalid or duplicate finding.");
    }
    ids.add(id);
    const source = finding.source === undefined ? undefined : sourcePath(finding.source);
    if (source && !capsule.sources.some(({ path }) => path === source)) {
      invalidReview("Finding source not in capsule.");
    }
    const result: ReviewFinding = { id, severity, description: reviewNote(finding.description) };
    if (source) result.source = source;
    return result;
  });
}

function recordContractReview(
  payload: Record<string, unknown>,
  review: ContractReviewState,
  capsule: ReviewCapsule,
): boolean {
  const round = claimReviewRound(review, payload);
  if (
    !round.permit ||
    payload.permit !== round.permit ||
    payload.completed !== true ||
    payload.freshContext !== true
  ) {
    blockedReview("Native fresh-context review required.");
  }
  const role = capsule.roles.find(({ id }) => id === payload.role);
  if (!role || !round.roles.includes(role.id)) return blockedReview("Unexpected reviewer role.");
  const nativeId = reviewIdentifier(payload.nativeId);
  const read = reviewList(payload.read, MAX_SOURCES).map((entry) => {
    const item = reviewObject(entry);
    return { path: sourcePath(item.path), digest: reviewIdentifier(item.digest) };
  });
  const expectedRead = capsule.sources
    .filter(({ path }) => role.sources.includes(path))
    .toSorted((a, b) => a.path.localeCompare(b.path));
  const actualRead = read.toSorted((a, b) => a.path.localeCompare(b.path));
  if (
    payload.capsule !== capsule.digest ||
    payload.contractDigest !== capsule.contractDigest ||
    sha256Hex(actualRead) !== sha256Hex(expectedRead)
  ) {
    blockedReview("Mismatched native review inputs.");
  }
  const paraphrase = parseParaphrase(payload.paraphrase);
  const result = {
    nativeId,
    role: role.id,
    fingerprint: role.fingerprint,
    findings: parseFindings(payload.findings, capsule),
    ...(paraphrase ? { paraphrase } : {}),
  };
  const previous = round.results.find((item) => item.role === role.id);
  if (previous) {
    if (sha256Hex(previous) !== sha256Hex(result)) blockedReview("Reviewer result is immutable.");
    return false;
  }
  if (review.rounds.some((other) => other.results.some((item) => item.nativeId === nativeId))) {
    blockedReview("Native execution already recorded.");
  }
  round.results.push(result);
  return true;
}

async function handleBuildAction(
  state: TaskState,
  review: ContractReviewState,
  payload: Record<string, unknown>,
  store: WorkspaceStore,
): Promise<{ detail: unknown; mutate: boolean }> {
  const approval = state.planApproval;
  if (state.status !== "executing" || !approval || payload.receipt !== approval.receiptDigest) {
    return blockedReview("Current GATE receipt required.");
  }
  if (payload.action === "check-build") {
    await checkContractReviewBuildSources(state, store);
    return { detail: { ready: true }, mutate: false };
  }
  const capsule = verifyCurrentCapsule(state, review);
  const nativeWriteRef = reviewIdentifier(payload.nativeWriteRef);
  if (
    payload.completed !== true ||
    capsule.worktree !== sha256Hex(store.workspaceRoot) ||
    payload.postCheck !== contractReviewPostCheckSignal(approval.receiptDigest, nativeWriteRef)
  ) {
    return blockedReview("Completed native write and correlated post-check verdict required.");
  }
  review.buildProof = {
    receipt: approval.receiptDigest,
    worktree: capsule.worktree,
    nativeWriteRef,
  };
  return { detail: { recorded: true }, mutate: true };
}

function reserveRound(
  review: ContractReviewState,
  capsule: ReviewCapsule,
  payload: Record<string, unknown>,
) {
  if (review.rounds.length >= MAX_ROUNDS) return blockedReview("Five review rounds exhausted.");
  const open = review.rounds.findLast((round) => round.capsule === capsule.digest);
  if (open && !open.permit) return blockedReview("Claim the existing reserved review round.");
  const recheck = reviewList(payload.recheck ?? [], 5).map(reviewIdentifier);
  const disputed = activeFindings(review).filter(({ severity }) => severity !== "nit");
  if (recheck.some((role) => !disputed.some((finding) => finding.role === role))) {
    return invalidReview("Targeted recheck requires a disputed finding.");
  }
  const roles = reviewCoverage(review)
    .filter(({ result, role }) => !result || recheck.includes(role))
    .map(({ role }) => role);
  if (roles.length === 0) return blockedReview("No review coverage missing.");
  const round = { id: review.rounds.length + 1, capsule: capsule.digest, roles, results: [] };
  review.rounds.push(round);
  return { detail: round, mutate: true };
}

function acceptFinding(
  state: TaskState,
  review: ContractReviewState,
  capsule: ReviewCapsule,
  payload: Record<string, unknown>,
) {
  const finding = activeFindings(review).find(({ key }) => key === payload.finding);
  if (
    !finding ||
    finding.severity !== "major" ||
    payload.confirmedByUser !== true ||
    payload.contractDigest !== capsule.contractDigest ||
    payload.capsule !== capsule.digest
  ) {
    return blockedReview("Explicit acceptance of a current major required.");
  }
  review.accepted = review.accepted.filter((item) => item.finding !== finding.key);
  review.accepted.push({
    finding: finding.key,
    contractDigest: capsule.contractDigest,
    capsule: capsule.digest,
    rationale: reviewNote(payload.rationale),
  });
  return { detail: contractReviewView(state), mutate: true };
}

async function dispatchCapsuleAction(
  state: TaskState,
  review: ContractReviewState,
  payload: Record<string, unknown>,
  store: WorkspaceStore,
  render: (contract: CanonicalChangeContract) => string,
): Promise<{ detail: unknown; mutate: boolean }> {
  const capsule = verifyCurrentCapsule(state, review);
  switch (payload.action) {
    case "reserve":
      return reserveRound(review, capsule, payload);
    case "claim": {
      const round = claimReviewRound(review, payload);
      if (round.permit) return blockedReview("Launch right consumed; do not resend.");
      await checkContractReviewSources(state, store, render);
      round.permit = randomUUID();
      return { detail: round, mutate: true };
    }
    case "record": {
      const mutate = recordContractReview(payload, review, capsule);
      return { detail: contractReviewView(state), mutate };
    }
    case "accept":
      return acceptFinding(state, review, capsule, payload);
    default:
      return invalidReview("Unknown Contract Review action.");
  }
}

export async function updateContractReview(
  state: TaskState,
  raw: unknown,
  store: WorkspaceStore,
  harness: HarnessPreference | undefined,
  render: (contract: CanonicalChangeContract) => string,
): Promise<{ detail: unknown; mutate: boolean }> {
  const payload = reviewObject(raw);
  assertCleanHygiene(payload);
  const review = state.contractReview;
  if (!review) return blockedReview("Contract Review not applicable.");
  if (!isSupportedReviewHarness(harness)) {
    return blockedReview(
      "Resume Contract Review on a supported host (codex, claude, antigravity).",
    );
  }
  if (payload.expectedRevision !== state.revision) {
    throw new StateStoreError("state_conflict", "Task revision conflict; reload.");
  }
  if (payload.action === "check-build" || payload.action === "record-write") {
    return handleBuildAction(state, review, payload, store);
  }
  if (state.status !== "planning" && state.status !== "awaiting_approval") {
    return blockedReview("Contract Review belongs to SHAPE.");
  }
  if (payload.action === "prepare") {
    const contract = state.shape?.contract;
    return {
      detail: await prepareContractReview(
        state,
        review,
        payload,
        store,
        contract ? render(contract) : "",
      ),
      mutate: true,
    };
  }
  return dispatchCapsuleAction(state, review, payload, store, render);
}
