import { checkContractReviewManifest } from "../core/contract-review-sources.js";
import { sha256Hex } from "../core/digest.js";
import { EXIT_CODES, StateStoreError } from "../core/schema.js";
import type { WorkspaceStore } from "../core/store.js";
import type {
  CanonicalChangeContract,
  ContractReviewState,
  HarnessId,
  HarnessPreference,
  TaskState,
} from "../types.js";

const ID = /^[a-zA-Z0-9][a-zA-Z0-9.:_-]{0,127}$/;
const SUPPORTED_REVIEW_HARNESSES = new Set<HarnessId>(["codex", "claude", "antigravity"]);

export type ReviewCapsule = NonNullable<ContractReviewState["capsule"]>;
export type ReviewRole = ReviewCapsule["roles"][number];
export type ReviewResult = ContractReviewState["rounds"][number]["results"][number];
export type ReviewFinding = ReviewResult["findings"][number];

export function isSupportedReviewHarness(
  harness: HarnessPreference | undefined,
): harness is HarnessId {
  return harness !== undefined && harness !== "auto" && SUPPORTED_REVIEW_HARNESSES.has(harness);
}

export const invalidReview = (message: string): never => {
  throw new StateStoreError("state_invalid", message);
};

export const blockedReview = (message: string): never => {
  throw new StateStoreError("state_blocked", message, EXIT_CODES.BLOCKED);
};

export function reviewObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return invalidReview("Invalid review object.");
  return value as Record<string, unknown>;
}

export function reviewList(value: unknown, limit: number): unknown[] {
  if (!Array.isArray(value) || value.length > limit) return invalidReview("Invalid review list.");
  return value;
}

export function reviewIdentifier(value: unknown): string {
  if (typeof value !== "string" || !ID.test(value))
    return invalidReview("Invalid review identifier.");
  return value;
}

export function reviewNote(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 1200)
    return invalidReview("Invalid review explanation.");
  return value.trim();
}

function latestReviewResult(
  review: ContractReviewState,
  role: ReviewRole,
): ReviewResult | undefined {
  const requested = review.rounds.findLast(
    (round) => round.capsule === review.capsule?.digest && round.roles.includes(role.id),
  );
  if (requested) return requested.results.find((item) => item.role === role.id);
  return review.rounds
    .flatMap((round) => round.results)
    .findLast((item) => item.role === role.id && item.fingerprint === role.fingerprint);
}

export function reviewCoverage(review: ContractReviewState) {
  return (review.capsule?.roles ?? []).map((role) => ({
    role: role.id,
    result: latestReviewResult(review, role),
  }));
}

function findingKey(role: string, finding: ReviewFinding) {
  return sha256Hex({ role, finding });
}

export function activeFindings(review: ContractReviewState) {
  return reviewCoverage(review).flatMap(({ role, result }) =>
    (result?.findings ?? []).map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      description: finding.description,
      source: finding.source,
      role,
      key: findingKey(role, finding),
    })),
  );
}

export function contractReviewBlockers(state: TaskState): string[] {
  const review = state.contractReview;
  if (!review) return [];
  const capsule = review.capsule;
  if (
    !capsule ||
    capsule.taskId !== state.taskId ||
    capsule.contractDigest !== state.contractDigest
  )
    return ["contract_review_capsule_required"];
  if (reviewCoverage(review).some(({ result }) => !result)) return ["contract_review_incomplete"];
  const blockers = new Set<string>();
  for (const finding of activeFindings(review)) {
    if (finding.severity === "blocker") blockers.add("contract_review_unresolved_blocker");
    if (
      finding.severity === "major" &&
      !review.accepted.some(
        (item) =>
          item.finding === finding.key &&
          item.contractDigest === capsule.contractDigest &&
          item.capsule === capsule.digest,
      )
    )
      blockers.add("contract_review_unresolved_major");
  }
  return [...blockers];
}

export function contractReviewView(state: TaskState) {
  const review = state.contractReview;
  const capsule = review?.capsule;
  if (!review || !capsule) return undefined;
  const view = {
    contractDigest: capsule.contractDigest,
    capsule: capsule.digest,
    coverage: reviewCoverage(review).map(({ role, result }) => {
      const entry: {
        role: string;
        completed: boolean;
        nativeId: string | undefined;
        paraphrase?: ReviewResult["paraphrase"];
      } = {
        role,
        completed: result !== undefined,
        nativeId: result?.nativeId,
      };
      if (result?.paraphrase) entry.paraphrase = result.paraphrase;
      return entry;
    }),
    findings: activeFindings(review),
    accepted: review.accepted.filter(({ capsule: accepted }) => accepted === capsule.digest),
  };
  return { ...view, digest: sha256Hex(view) };
}

export async function checkContractReviewSources(
  state: TaskState,
  store: WorkspaceStore,
  render: (contract: CanonicalChangeContract) => string,
): Promise<void> {
  const contract = state.shape?.contract;
  const capsule = state.contractReview?.capsule;
  if (contract?.profile === "plan" && capsule?.renderDigest !== sha256Hex(render(contract))) {
    return blockedReview("Reviewed contract or render changed.");
  }
  await checkContractReviewManifest(state, store);
}

export function verifyCurrentCapsule(state: TaskState, review: ContractReviewState): ReviewCapsule {
  const capsule = review.capsule;
  if (
    !capsule ||
    capsule.taskId !== state.taskId ||
    capsule.contractDigest !== state.contractDigest
  ) {
    return blockedReview("Current review capsule required.");
  }
  return capsule;
}

export function claimReviewRound(review: ContractReviewState, payload: Record<string, unknown>) {
  const round = review.rounds.find(({ id }) => id === payload.round);
  if (!round || round.capsule !== review.capsule?.digest)
    return blockedReview("Missing or obsolete review round.");
  return round;
}
