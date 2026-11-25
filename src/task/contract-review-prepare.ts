import { MAX_SOURCES, readSources, sourcePath } from "../core/contract-review-sources.js";
import { sha256Hex } from "../core/digest.js";
import type { WorkspaceStore } from "../core/store.js";
import type { CanonicalChangeContract, ContractReviewState, TaskState } from "../types.js";
import {
  blockedReview,
  invalidReview,
  reviewIdentifier,
  reviewList,
  reviewNote,
  reviewObject,
  type ReviewRole,
} from "./contract-review.js";

const SECTIONS = [
  "scope",
  "nonGoals",
  "acceptanceCriteria",
  "tasks",
  "validations",
  "risks",
  "assuranceContract",
  "planDesign",
  "guide",
] as const;
type Section = (typeof SECTIONS)[number];

function buildSpecialistRole(
  input: unknown,
  contract: CanonicalChangeContract,
  paths: string[],
  sources: { path: string; digest: string }[],
  worktree: string,
  existingIds: Set<string>,
): ReviewRole {
  const item = reviewObject(input);
  const id = reviewIdentifier(item.id);
  if (existingIds.has(id)) invalidReview("Duplicate reviewer role.");
  existingIds.add(id);
  const fields = reviewList(item.sections, SECTIONS.length).map((field) => {
    if (!SECTIONS.includes(field as Section)) return invalidReview("Unknown contract section.");
    return field as Section;
  });
  if (fields.length === 0 || new Set(fields).size !== fields.length) {
    invalidReview("Invalid specialist sections.");
  }
  const dependencies = reviewList(item.sources, MAX_SOURCES).map(sourcePath).toSorted();
  if (
    new Set(dependencies).size !== dependencies.length ||
    dependencies.some((path) => !paths.includes(path))
  ) {
    invalidReview("Invalid specialist sources.");
  }
  const sections = Object.fromEntries(fields.map((field) => [field, contract[field]]));
  const reason = reviewNote(item.reason);
  return {
    id,
    sources: dependencies,
    sections: fields,
    reason,
    fingerprint: sha256Hex({
      sections,
      sources: sources.filter(({ path }) => dependencies.includes(path)),
      reason,
      worktree,
    }),
  };
}

function assertCoverageNotReduced(
  state: TaskState,
  review: ContractReviewState,
  roles: ReviewRole[],
): void {
  const priorCapsule = review.capsule;
  if (!priorCapsule || priorCapsule.contractDigest !== state.contractDigest) return;
  const reduced = priorCapsule.roles.some(
    (prior) =>
      !roles.some(
        (role) =>
          role.id === prior.id &&
          prior.sources.every((path) => role.sources.includes(path)) &&
          (prior.sections ?? []).every((field) => role.sections?.includes(field)),
      ),
  );
  if (reduced) blockedReview("Required coverage cannot be removed.");
}

export async function prepareContractReview(
  state: TaskState,
  review: ContractReviewState,
  payload: Record<string, unknown>,
  store: WorkspaceStore,
  canonicalRender: string,
) {
  const contract = state.shape?.contract;
  if (!contract || !state.contractDigest) return blockedReview("Prepared contract required.");
  const paths = reviewList(payload.sources, MAX_SOURCES).map(sourcePath).toSorted();
  if (new Set(paths).size !== paths.length) invalidReview("Duplicate source path.");
  const files = await readSources(store, paths);
  const sources = files.map(({ path, digest }) => ({ path, digest }));
  const renderDigest = contract.profile === "plan" ? sha256Hex(canonicalRender) : undefined;
  const worktree = sha256Hex(store.workspaceRoot);
  const roles: ReviewRole[] = [
    {
      id: "generalist",
      sources: paths,
      fingerprint: sha256Hex({ contract: state.contractDigest, sources, renderDigest, worktree }),
    },
  ];
  const specialists = reviewList(payload.specialists ?? [], 4);
  if (contract.profile === "quick" && specialists.length > 0) {
    invalidReview("Quick requires one generalist.");
  }
  const ids = new Set<string>(["generalist"]);
  for (const input of specialists) {
    roles.push(buildSpecialistRole(input, contract, paths, sources, worktree, ids));
  }
  assertCoverageNotReduced(state, review, roles);
  const body = {
    taskId: state.taskId,
    contractDigest: state.contractDigest,
    worktree,
    sources,
    roles,
    ...(renderDigest ? { renderDigest } : {}),
  };
  review.capsule = { ...body, digest: sha256Hex(body) };
  review.accepted = review.accepted.filter(({ capsule }) => capsule === review.capsule?.digest);
  return {
    capsule: review.capsule,
    contract,
    ...(renderDigest ? { document: canonicalRender } : {}),
    files,
  };
}
