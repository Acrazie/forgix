import { parse, stringify } from "yaml";
import { assertCleanHygiene, canonicalJson, sha256Hex } from "../core/digest.js";
import { EXIT_CODES, StateStoreError, validateSchema, type ExitCode } from "../core/schema.js";
import {
  createWorkspaceStore,
  type WorkspaceStore,
  type WorkspaceStoreOptions,
} from "../core/store.js";
import type { RiskLevel } from "../types.js";

export const ROADMAP_STATE_PATH = ".forgix/roadmap/state.yaml";
export const ROADMAP_IGNORE_ENTRY = ".forgix/roadmap/";
export const DEFAULT_PRODUCT_VISION_PATH = "docs/product-vision.md";
export const DEFAULT_WORKTREE_BASE_BRANCH = "main";
export const DEFAULT_WORKTREE_ROOT = ".worktrees";

export type RoadmapPhase = "divergence" | "convergence" | "synthesis" | "published";
export type RoadmapCodebaseKind = "greenfield" | "existing";
export type RoadmapProjectMode = "create" | "attach";
export type RoadmapVisualFormat = "tree" | "mermaid";
export type RoadmapPriority = "P0" | "P1" | "P2" | "P3";
export type RoadmapBoardStatus =
  | "Backlog"
  | "Ready"
  | "In Progress"
  | "Blocked"
  | "In Review"
  | "Done";

export interface RoadmapTheme {
  id: string;
  title: string;
  summary: string;
  notes?: string[];
}

export interface RoadmapFeature {
  id: string;
  title: string;
  summary: string;
  priority: RoadmapPriority;
  risk: RiskLevel;
  wave?: number;
  scopeIn: string[];
  scopeOut: string[];
  issueNumber?: number;
  issueUrl?: string;
  projectItemId?: string;
}

export interface RoadmapWorkItem {
  id: string;
  featureId: string;
  title: string;
  objective: string;
  scopeIn: string[];
  scopeOut: string[];
  linkedRuleIds?: string[];
  acceptanceCriteria: string[];
  risk: RiskLevel;
  priority: RoadmapPriority;
  wave?: number;
  blockedBy: string[];
  initialStatus?: RoadmapBoardStatus;
  status?: RoadmapBoardStatus;
  issueNumber?: number;
  issueUrl?: string;
  projectItemId?: string;
}

export interface RoadmapProjectBinding {
  owner: string;
  number?: number;
  title?: string;
  url?: string;
}

export interface RoadmapPublicationBatch {
  batchId: string;
  recordedAt: string;
  createdIssues: number;
  updatedIssues: number;
}

export interface RoadmapPublicationState {
  status: "pending" | "partial" | "completed";
  projectNumber?: number;
  projectUrl?: string;
  publishedAt?: string;
  batchHistory?: RoadmapPublicationBatch[];
}

export interface RoadmapApprovalState {
  approved: boolean;
  approvedAt?: string;
  digest?: string;
}

export interface RoadmapState {
  schemaVersion: 1;
  sessionId: string;
  phase: RoadmapPhase;
  codebaseKind: RoadmapCodebaseKind;
  projectMode: RoadmapProjectMode;
  visualFormat: RoadmapVisualFormat;
  updatedAt: string;
  productVisionPath?: string;
  productVisionSummary?: string;
  projectBinding?: RoadmapProjectBinding;
  themes: RoadmapTheme[];
  features: RoadmapFeature[];
  workItems: RoadmapWorkItem[];
  candidateDigest?: string;
  approval?: RoadmapApprovalState;
  publication?: RoadmapPublicationState;
}

export type RoadmapErrorCode =
  | "roadmap_invalid"
  | "roadmap_not_found"
  | "roadmap_path_invalid"
  | "roadmap_cycle_detected"
  | "roadmap_secret_detected"
  | "roadmap_state_conflict"
  | "roadmap_write_failed";

export class RoadmapError extends Error {
  readonly exitCode: ExitCode;

  constructor(
    readonly code: RoadmapErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RoadmapError";
    this.exitCode =
      code === "roadmap_state_conflict" || code === "roadmap_not_found"
        ? EXIT_CODES.STATE_CONFLICT
        : code === "roadmap_write_failed"
          ? EXIT_CODES.INTERNAL_ERROR
          : EXIT_CODES.INVALID_CONFIGURATION;
  }
}

export interface RoadmapPublicationFeaturePlan {
  id: string;
  title: string;
  action: "create" | "update";
  issueNumber?: number;
}

export interface RoadmapPublicationWorkItemPlan {
  id: string;
  featureId: string;
  title: string;
  action: "create" | "update";
  issueNumber?: number;
  initialStatus: RoadmapBoardStatus;
  wave: number;
  blockedBy: string[];
}

export interface RoadmapPublicationDependency {
  workItemId: string;
  blockedById: string;
}

export interface RoadmapPublicationPlan {
  candidateDigest: string;
  project: {
    mode: RoadmapProjectMode;
    owner?: string;
    number?: number;
    title?: string;
  };
  features: RoadmapPublicationFeaturePlan[];
  workItems: RoadmapPublicationWorkItemPlan[];
  dependencies: RoadmapPublicationDependency[];
  summary: {
    createFeatures: number;
    updateFeatures: number;
    createWorkItems: number;
    updateWorkItems: number;
    dependencyEdges: number;
  };
}

export interface RoadmapPublishRecordPatch {
  batchId?: string;
  recordedAt?: string;
  projectBinding?: Partial<RoadmapProjectBinding>;
  features?: Array<{
    id: string;
    issueNumber: number;
    issueUrl?: string;
    projectItemId?: string;
  }>;
  workItems?: Array<{
    id: string;
    issueNumber: number;
    issueUrl?: string;
    projectItemId?: string;
    status?: RoadmapBoardStatus;
  }>;
}

export interface WorkItemWorkspaceSpec {
  branch: string;
  worktreePath: string;
  baseBranch: string;
}

export interface RoadmapSelectOptions {
  limit?: number;
  maxRisk?: "low" | "medium" | "all";
  requireIssueNumber?: boolean;
  baseBranch?: string;
  worktreeRoot?: string;
}

export interface RoadmapSkippedWorkItem {
  id: string;
  issueNumber?: number;
  reason: string;
}

export interface RoadmapEligibleWorkItem {
  workItem: RoadmapWorkItem;
  workspace: WorkItemWorkspaceSpec;
  featureStatusAfterStart: "Backlog" | "In Progress" | "Done";
}

export interface RoadmapSelectResult {
  eligible: RoadmapEligibleWorkItem[];
  skipped: RoadmapSkippedWorkItem[];
}

export type RoadmapStoreOptions = WorkspaceStoreOptions;

const PRIORITY_RANK: Record<RoadmapPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

const RISK_RANK: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/**
 * Computes a deterministic digest over the candidate roadmap specification fields
 * so approval and incremental GitHub publication remain anchored to content rather
 * than mutable issue numbers or timestamps.
 */
export function computeRoadmapCandidateDigest(
  state: Pick<
    RoadmapState,
    "features" | "workItems" | "projectBinding" | "productVisionPath" | "productVisionSummary"
  >,
): string {
  const payload = {
    productVisionPath: state.productVisionPath ?? DEFAULT_PRODUCT_VISION_PATH,
    productVisionSummary: state.productVisionSummary,
    projectBinding: state.projectBinding
      ? {
          owner: state.projectBinding.owner,
          title: state.projectBinding.title,
        }
      : undefined,
    features: state.features
      .toSorted((a, b) => a.id.localeCompare(b.id))
      .map((feature) => ({
        id: feature.id,
        title: feature.title,
        summary: feature.summary,
        priority: feature.priority,
        risk: feature.risk,
        wave: feature.wave ?? 1,
        scopeIn: feature.scopeIn,
        scopeOut: feature.scopeOut,
      })),
    workItems: state.workItems
      .toSorted((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        featureId: item.featureId,
        title: item.title,
        objective: item.objective,
        scopeIn: item.scopeIn,
        scopeOut: item.scopeOut,
        linkedRuleIds: item.linkedRuleIds ?? [],
        acceptanceCriteria: item.acceptanceCriteria,
        risk: item.risk,
        priority: item.priority,
        wave: item.wave ?? 1,
        blockedBy: item.blockedBy.toSorted(),
        initialStatus: item.initialStatus,
      })),
  };
  return `sha256:${sha256Hex(payload)}`;
}

/**
 * Detects directed dependency cycles in Work Item `blockedBy` edges using DFS.
 */
export function detectDependencyCycles(workItems: readonly RoadmapWorkItem[]): string[][] {
  const byId = new Map(workItems.map((item) => [item.id, item]));
  const color = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const cycles: string[][] = [];

  const visit = (id: string): void => {
    color.set(id, "visiting");
    stack.push(id);
    const item = byId.get(id);
    if (item) {
      for (const dep of item.blockedBy) {
        const depState = color.get(dep);
        if (depState === "visiting") {
          const start = stack.indexOf(dep);
          cycles.push([...stack.slice(start), dep]);
        } else if (!depState && byId.has(dep)) {
          visit(dep);
        }
      }
    }
    stack.pop();
    color.set(id, "done");
  };

  for (const item of workItems) {
    if (!color.has(item.id)) {
      visit(item.id);
    }
  }
  return cycles;
}

/**
 * Validates a roadmap ideation draft against JSON Schema, DAG acyclicity,
 * cross-entity references, phase completeness, and secret/path hygiene.
 */
export function validateRoadmapState(rawState: unknown): RoadmapState {
  const schemaResult = validateSchema("roadmap-state", rawState);
  if (!schemaResult.valid) {
    throw new RoadmapError(
      "roadmap_invalid",
      `Roadmap state schema invalid: ${schemaResult.errors.join("; ")}`,
    );
  }

  const state = structuredClone(rawState) as RoadmapState;
  assertRoadmapHygiene(state);

  assertUniqueIds(state.themes, "theme");
  const featureIds = assertUniqueIds(state.features, "feature");
  const workItemIds = assertUniqueIds(state.workItems, "workItem");

  for (const item of state.workItems) {
    if (!featureIds.has(item.featureId)) {
      throw new RoadmapError(
        "roadmap_invalid",
        `Work item "${item.id}" references unknown feature "${item.featureId}".`,
      );
    }
    for (const dep of item.blockedBy) {
      if (dep === item.id) {
        throw new RoadmapError(
          "roadmap_cycle_detected",
          `Work item "${item.id}" cannot depend on itself.`,
        );
      }
      if (!workItemIds.has(dep)) {
        throw new RoadmapError(
          "roadmap_invalid",
          `Work item "${item.id}" references unknown dependency "${dep}".`,
        );
      }
    }
  }

  const cycles = detectDependencyCycles(state.workItems);
  if (cycles.length > 0) {
    throw new RoadmapError(
      "roadmap_cycle_detected",
      `Dependency cycle detected: ${cycles.map((cycle) => cycle.join(" -> ")).join("; ")}.`,
    );
  }

  if (state.phase === "synthesis" || state.phase === "published") {
    if (state.features.length === 0) {
      throw new RoadmapError(
        "roadmap_invalid",
        `Phase "${state.phase}" requires at least one Feature.`,
      );
    }
    if (state.workItems.length === 0) {
      throw new RoadmapError(
        "roadmap_invalid",
        `Phase "${state.phase}" requires at least one Work Item.`,
      );
    }
    for (const feature of state.features) {
      if (feature.scopeIn.length === 0) {
        throw new RoadmapError(
          "roadmap_invalid",
          `Feature "${feature.id}" requires non-empty scopeIn before "${state.phase}".`,
        );
      }
    }
    for (const item of state.workItems) {
      if (item.scopeIn.length === 0 || item.acceptanceCriteria.length === 0) {
        throw new RoadmapError(
          "roadmap_invalid",
          `Work item "${item.id}" requires scopeIn and acceptanceCriteria before "${state.phase}".`,
        );
      }
    }
  }

  if (state.approval?.approved && state.approval.digest) {
    const computed = computeRoadmapCandidateDigest(state);
    if (state.approval.digest !== computed) {
      throw new RoadmapError(
        "roadmap_state_conflict",
        `Approved digest (${state.approval.digest}) does not match current candidate digest (${computed}).`,
      );
    }
  }

  return state;
}

/**
 * Renders a concise status summary of a roadmap ideation session.
 */
export function renderRoadmapSessionState(
  state: RoadmapState,
  options: { gitignored?: boolean } = {},
): string {
  const byId = new Map(state.workItems.map((item) => [item.id, item]));
  const readyCount = state.workItems.filter(
    (item) => effectiveStatus(item, byId) === "Ready",
  ).length;
  const publishedIssues =
    state.features.filter((feature) => feature.issueNumber !== undefined).length +
    state.workItems.filter((item) => item.issueNumber !== undefined).length;
  const lines = [
    `Roadmap Session: ${state.sessionId}`,
    `Phase: ${state.phase} | Codebase: ${state.codebaseKind} | Project mode: ${state.projectMode}`,
    `Features: ${state.features.length} | Work Items: ${state.workItems.length} | Wave-1 Ready: ${readyCount}`,
    `Candidate digest: ${state.candidateDigest ?? computeRoadmapCandidateDigest(state)}`,
    `Approval: ${state.approval?.approved ? `approved (${state.approval.approvedAt ?? "timestamped"})` : "pending"}`,
    `Publication: ${state.publication?.status ?? "pending"} (${publishedIssues} published issues)`,
  ];
  if (state.projectBinding?.number) {
    lines.push(
      `GitHub Project: ${state.projectBinding.owner}#${state.projectBinding.number}${state.projectBinding.url ? ` (${state.projectBinding.url})` : ""}`,
    );
  }
  if (options.gitignored === false) {
    lines.push(
      `Warning: ${ROADMAP_IGNORE_ENTRY} is not listed in .gitignore; add it before committing.`,
    );
  }
  return lines.join("\n");
}

/**
 * Renders Step 3 visual synthesis in ASCII `tree` or Mermaid `flowchart TD` DAG format.
 */
export function renderRoadmapVisualSummary(
  state: RoadmapState,
  format: RoadmapVisualFormat = state.visualFormat,
): string {
  return format === "mermaid" ? renderMermaidSummary(state) : renderTreeSummary(state);
}

/**
 * Computes an idempotent, dependency-ordered GitHub Project & Issue publication plan
 * from the validated roadmap state without performing any network calls.
 */
export function planIdempotentPublication(rawState: RoadmapState): RoadmapPublicationPlan {
  const state = validateRoadmapState(rawState);
  const byId = new Map(state.workItems.map((item) => [item.id, item]));
  const orderedItems = topologicalWorkItems(state.workItems);

  const features: RoadmapPublicationFeaturePlan[] = state.features
    .toSorted((a, b) => (a.wave ?? 1) - (b.wave ?? 1) || a.id.localeCompare(b.id))
    .map(toFeaturePlan);

  const workItems: RoadmapPublicationWorkItemPlan[] = orderedItems.map((item) =>
    toWorkItemPlan(item, byId),
  );

  const dependencies: RoadmapPublicationDependency[] = [];
  for (const item of orderedItems) {
    for (const dep of item.blockedBy) {
      dependencies.push({ workItemId: item.id, blockedById: dep });
    }
  }

  return {
    candidateDigest: computeRoadmapCandidateDigest(state),
    project: {
      mode: state.projectMode,
      ...(state.projectBinding?.owner ? { owner: state.projectBinding.owner } : {}),
      ...(state.projectBinding?.number !== undefined
        ? { number: state.projectBinding.number }
        : {}),
      ...(state.projectBinding?.title ? { title: state.projectBinding.title } : {}),
    },
    features,
    workItems,
    dependencies,
    summary: {
      createFeatures: features.filter((item) => item.action === "create").length,
      updateFeatures: features.filter((item) => item.action === "update").length,
      createWorkItems: workItems.filter((item) => item.action === "create").length,
      updateWorkItems: workItems.filter((item) => item.action === "update").length,
      dependencyEdges: dependencies.length,
    },
  };
}

/**
 * Records published GitHub Project bindings and Issue numbers onto the local
 * roadmap state so interrupted multi-issue publication batches can resume idempotently.
 */
export function recordPublishedRoadmapBatch(
  rawState: RoadmapState,
  patch: RoadmapPublishRecordPatch,
): RoadmapState {
  const next = structuredClone(validateRoadmapState(rawState));
  const now = patch.recordedAt ?? new Date().toISOString();
  let createdIssues = 0;
  let updatedIssues = 0;

  if (patch.projectBinding) {
    const number = patch.projectBinding.number ?? next.projectBinding?.number;
    const title = patch.projectBinding.title ?? next.projectBinding?.title;
    const url = patch.projectBinding.url ?? next.projectBinding?.url;
    next.projectBinding = {
      owner: patch.projectBinding.owner ?? next.projectBinding?.owner ?? "",
      ...(number !== undefined ? { number } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(url !== undefined ? { url } : {}),
    };
  }

  const featuresById = new Map(next.features.map((feature) => [feature.id, feature]));
  for (const entry of patch.features ?? []) {
    const feature = featuresById.get(entry.id);
    if (!feature) {
      throw new RoadmapError("roadmap_invalid", `Unknown published feature id: ${entry.id}.`);
    }
    if (feature.issueNumber === undefined) createdIssues += 1;
    else updatedIssues += 1;
    feature.issueNumber = entry.issueNumber;
    if (entry.issueUrl) feature.issueUrl = entry.issueUrl;
    if (entry.projectItemId) feature.projectItemId = entry.projectItemId;
  }

  const workItemsById = new Map(next.workItems.map((item) => [item.id, item]));
  for (const entry of patch.workItems ?? []) {
    const item = workItemsById.get(entry.id);
    if (!item) {
      throw new RoadmapError("roadmap_invalid", `Unknown published workItem id: ${entry.id}.`);
    }
    if (item.issueNumber === undefined) createdIssues += 1;
    else updatedIssues += 1;
    item.issueNumber = entry.issueNumber;
    if (entry.issueUrl) item.issueUrl = entry.issueUrl;
    if (entry.projectItemId) item.projectItemId = entry.projectItemId;
    item.status = entry.status ?? defaultInitialStatus(item, workItemsById);
  }

  const allPublished =
    next.features.every((feature) => feature.issueNumber !== undefined) &&
    next.workItems.every((item) => item.issueNumber !== undefined);

  const history = [...(next.publication?.batchHistory ?? [])];
  history.push({
    batchId: patch.batchId ?? `batch-${history.length + 1}`,
    recordedAt: now,
    createdIssues,
    updatedIssues,
  });

  next.publication = {
    status: allPublished ? "completed" : "partial",
    ...(next.projectBinding?.number !== undefined
      ? { projectNumber: next.projectBinding.number }
      : {}),
    ...(next.projectBinding?.url ? { projectUrl: next.projectBinding.url } : {}),
    ...(allPublished ? { publishedAt: now } : {}),
    batchHistory: history,
  };
  next.phase = allPublished ? "published" : next.phase;
  next.updatedAt = now;
  next.candidateDigest = computeRoadmapCandidateDigest(next);

  return validateRoadmapState(next);
}

/**
 * Derives parent Feature status from its child Work Items:
 * `Done` when all are Done, `In Progress` when any has started or completed,
 * otherwise `Backlog`.
 */
export function deriveFeatureStatus(
  workItems: readonly {
    status?: RoadmapBoardStatus | undefined;
    initialStatus?: RoadmapBoardStatus | undefined;
  }[],
): "Backlog" | "In Progress" | "Done" {
  if (workItems.length === 0) return "Backlog";
  const statuses = workItems.map((item) => item.status ?? item.initialStatus ?? "Backlog");
  if (statuses.every((status) => status === "Done")) return "Done";
  if (
    statuses.some(
      (status) =>
        status === "In Progress" ||
        status === "In Review" ||
        status === "Blocked" ||
        status === "Done",
    )
  ) {
    return "In Progress";
  }
  return "Backlog";
}

/**
 * Computes the deterministic branch name and isolated worktree path rooted on `main`
 * for an autonomous Work Item run.
 */
export function buildWorkItemBranchAndWorktree(
  workItem: Pick<RoadmapWorkItem, "id" | "issueNumber" | "title">,
  options: { baseBranch?: string; worktreeRoot?: string } = {},
): WorkItemWorkspaceSpec {
  const baseBranch = options.baseBranch?.trim() || DEFAULT_WORKTREE_BASE_BRANCH;
  const worktreeRoot = (options.worktreeRoot?.trim() || DEFAULT_WORKTREE_ROOT).replace(/\/+$/, "");
  if (
    worktreeRoot.startsWith("/") ||
    worktreeRoot.includes("..") ||
    baseBranch.includes("..") ||
    baseBranch.includes(" ")
  ) {
    throw new RoadmapError(
      "roadmap_path_invalid",
      "Worktree root and baseBranch must be safe relative repository references.",
    );
  }
  const slug = slugifySegment(workItem.title || workItem.id);
  const identifier =
    workItem.issueNumber !== undefined ? `issue-${workItem.issueNumber}-${slug}` : `wi-${slug}`;
  return {
    branch: `feat/${identifier}`,
    worktreePath: `${worktreeRoot}/${identifier}`,
    baseBranch,
  };
}

/**
 * Selects eligible `Ready` Work Items whose `blockedBy` dependencies are all `Done`
 * (`In Review` still blocks downstream Work Items), returning enriched workspace specs and
 * derived feature status after start in deterministic order.
 */
export function selectEligibleWorkItems(
  input: readonly RoadmapWorkItem[] | Pick<RoadmapState, "workItems">,
  options: RoadmapSelectOptions = {},
): RoadmapSelectResult {
  const workItems = "workItems" in input ? input.workItems : input;
  const byId = new Map(workItems.map((item) => [item.id, item]));
  const maxRiskRank =
    options.maxRisk === undefined || options.maxRisk === "all"
      ? RISK_RANK.critical
      : RISK_RANK[options.maxRisk];
  const selected: RoadmapWorkItem[] = [];
  const skipped: RoadmapSkippedWorkItem[] = [];

  for (const item of workItems) {
    const status = effectiveStatus(item, byId);
    if (status !== "Ready") {
      pushSkipped(skipped, item, `status is ${status}`);
      continue;
    }
    if (options.requireIssueNumber && item.issueNumber === undefined) {
      pushSkipped(skipped, item, "missing published GitHub issueNumber");
      continue;
    }
    const incompleteDeps = item.blockedBy.filter((depId) => {
      const dep = byId.get(depId);
      return !dep || effectiveStatus(dep, byId) !== "Done";
    });
    if (incompleteDeps.length > 0) {
      pushSkipped(
        skipped,
        item,
        `blocked by incomplete dependencies: ${incompleteDeps.join(", ")}`,
      );
      continue;
    }
    if (RISK_RANK[item.risk] > maxRiskRank) {
      pushSkipped(skipped, item, `risk ${item.risk} exceeds maxRisk=${options.maxRisk}`);
      continue;
    }
    selected.push(item);
  }

  selected.sort((left, right) => {
    const waveDiff = (left.wave ?? 1) - (right.wave ?? 1);
    if (waveDiff !== 0) return waveDiff;
    const prioDiff = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    if (prioDiff !== 0) return prioDiff;
    const leftNum = left.issueNumber ?? Number.MAX_SAFE_INTEGER;
    const rightNum = right.issueNumber ?? Number.MAX_SAFE_INTEGER;
    if (leftNum !== rightNum) return leftNum - rightNum;
    return left.id.localeCompare(right.id);
  });

  const limited =
    options.limit !== undefined && options.limit >= 0 ? selected.slice(0, options.limit) : selected;
  if (options.limit !== undefined && selected.length > limited.length) {
    for (const item of selected.slice(limited.length)) {
      pushSkipped(skipped, item, "limit reached");
    }
  }

  const workspaceOptions = {
    ...(options.baseBranch !== undefined ? { baseBranch: options.baseBranch } : {}),
    ...(options.worktreeRoot !== undefined ? { worktreeRoot: options.worktreeRoot } : {}),
  };

  const eligible: RoadmapEligibleWorkItem[] = limited.map((item) => ({
    workItem: item,
    workspace: buildWorkItemBranchAndWorktree(item, workspaceOptions),
    featureStatusAfterStart: computeFeatureStatusAfterStart(workItems, item),
  }));

  return { eligible, skipped };
}

/**
 * Selects enriched ready Work Items from a roadmap state or work-item list.
 */
export function selectReadyWorkItems(
  input: readonly RoadmapWorkItem[] | Pick<RoadmapState, "workItems">,
  options: RoadmapSelectOptions = {},
): RoadmapSelectResult {
  return selectEligibleWorkItems(input, options);
}

/**
 * Atomic, symlink-safe persistence store for roadmap ideation sessions under `.forgix/roadmap/state.yaml`.
 */
export class RoadmapStore {
  readonly workspaceRoot: string;
  readonly statePath: string;
  readonly #store: WorkspaceStore;

  constructor(workspaceRoot: string, options: RoadmapStoreOptions = {}) {
    try {
      this.#store = createWorkspaceStore(workspaceRoot, options);
    } catch {
      throw new RoadmapError(
        "roadmap_path_invalid",
        "Workspace root must be an existing directory.",
      );
    }
    this.workspaceRoot = this.#store.workspaceRoot;
    this.statePath = this.#store.resolvePath(ROADMAP_STATE_PATH);
  }

  isGitignored(): boolean {
    try {
      return this.#store.isGitignoredSync(ROADMAP_IGNORE_ENTRY);
    } catch (error) {
      if (error instanceof StateStoreError && error.code === "state_path_invalid") {
        throw new RoadmapError("roadmap_path_invalid", error.message);
      }
      return false;
    }
  }

  async exists(): Promise<boolean> {
    try {
      return (await this.#store.readText(ROADMAP_STATE_PATH, true)) !== undefined;
    } catch {
      return false;
    }
  }

  async load(): Promise<RoadmapState> {
    let raw: string | undefined;
    try {
      raw = await this.#store.readText(ROADMAP_STATE_PATH, false);
    } catch (error) {
      if (error instanceof StateStoreError) {
        if (error.code === "state_not_found") {
          throw new RoadmapError(
            "roadmap_not_found",
            `No active roadmap draft found at ${ROADMAP_STATE_PATH}.`,
          );
        }
        if (error.code === "state_path_invalid") {
          throw new RoadmapError("roadmap_path_invalid", error.message);
        }
      }
      throw new RoadmapError("roadmap_invalid", `Unable to read ${ROADMAP_STATE_PATH}.`);
    }
    if (raw === undefined) {
      throw new RoadmapError(
        "roadmap_not_found",
        `No active roadmap draft found at ${ROADMAP_STATE_PATH}.`,
      );
    }

    let parsed: unknown;
    try {
      parsed = parse(raw);
    } catch (error) {
      throw new RoadmapError(
        "roadmap_invalid",
        `Roadmap YAML is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return validateRoadmapState(parsed);
  }

  async save(rawState: unknown): Promise<RoadmapState> {
    const validated = validateRoadmapState(rawState);
    const canonical = JSON.parse(canonicalJson(validated)) as RoadmapState;
    const serialized = `${stringify(canonical)}\n`;
    try {
      await this.#store.writeTextAtomically(ROADMAP_STATE_PATH, serialized);
      return validated;
    } catch (error) {
      if (error instanceof StateStoreError && error.code === "state_path_invalid") {
        throw new RoadmapError("roadmap_path_invalid", error.message);
      }
      throw new RoadmapError(
        "roadmap_write_failed",
        `Failed to write ${ROADMAP_STATE_PATH}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async clear(): Promise<boolean> {
    try {
      return await this.#store.removeFile(ROADMAP_STATE_PATH);
    } catch (error) {
      if (error instanceof StateStoreError && error.code === "state_path_invalid") {
        throw new RoadmapError("roadmap_path_invalid", error.message);
      }
      throw new RoadmapError("roadmap_write_failed", `Failed to remove ${ROADMAP_STATE_PATH}.`);
    }
  }
}

export function createRoadmapStore(
  workspaceRoot: string,
  options: RoadmapStoreOptions = {},
): RoadmapStore {
  return new RoadmapStore(workspaceRoot, options);
}

function assertRoadmapHygiene(state: RoadmapState): void {
  try {
    assertCleanHygiene(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/local_absolute_path|home_tilde_path|windows_absolute_path|file_uri/.test(message)) {
      throw new RoadmapError(
        "roadmap_path_invalid",
        `Machine-local absolute path rejected: ${message}`,
      );
    }
    throw new RoadmapError(
      "roadmap_secret_detected",
      `Secret or PII rejected in roadmap state: ${message}`,
    );
  }
}

function assertUniqueIds(items: readonly { id: string }[], label: string): Set<string> {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new RoadmapError("roadmap_invalid", `Duplicate ${label} id: ${item.id}.`);
    }
    seen.add(item.id);
  }
  return seen;
}

function defaultInitialStatus(
  item: RoadmapWorkItem,
  byId: ReadonlyMap<string, RoadmapWorkItem>,
): RoadmapBoardStatus {
  if (item.initialStatus) return item.initialStatus;
  const wave = item.wave ?? 1;
  if (wave > 1) return "Backlog";
  const allDepsDone = item.blockedBy.every((depId) => {
    const dep = byId.get(depId);
    return (dep?.status ?? dep?.initialStatus) === "Done";
  });
  return allDepsDone ? "Ready" : "Backlog";
}

function effectiveStatus(
  item: RoadmapWorkItem,
  byId?: ReadonlyMap<string, RoadmapWorkItem>,
): RoadmapBoardStatus {
  if (item.status) return item.status;
  if (item.initialStatus) return item.initialStatus;
  return byId ? defaultInitialStatus(item, byId) : "Backlog";
}

function topologicalWorkItems(workItems: readonly RoadmapWorkItem[]): RoadmapWorkItem[] {
  const byId = new Map(workItems.map((item) => [item.id, item]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const item of workItems) {
    inDegree.set(item.id, item.blockedBy.length);
    for (const dep of item.blockedBy) {
      const list = dependents.get(dep) ?? [];
      list.push(item.id);
      dependents.set(dep, list);
    }
  }

  const compareItems = (leftId: string, rightId: string): number => {
    const left = byId.get(leftId);
    const right = byId.get(rightId);
    if (!left || !right) return 0;
    const waveDiff = (left.wave ?? 1) - (right.wave ?? 1);
    if (waveDiff !== 0) return waveDiff;
    const prioDiff = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    if (prioDiff !== 0) return prioDiff;
    return left.id.localeCompare(right.id);
  };

  const queue = workItems
    .filter((item) => (inDegree.get(item.id) ?? 0) === 0)
    .map((item) => item.id)
    .toSorted(compareItems);
  const ordered: RoadmapWorkItem[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (currentId === undefined) break;
    const currentItem = byId.get(currentId);
    if (currentItem) ordered.push(currentItem);
    for (const nextId of dependents.get(currentId) ?? []) {
      const remaining = (inDegree.get(nextId) ?? 0) - 1;
      inDegree.set(nextId, remaining);
      if (remaining === 0) {
        queue.push(nextId);
        queue.sort(compareItems);
      }
    }
  }

  if (ordered.length !== workItems.length) {
    throw new RoadmapError(
      "roadmap_cycle_detected",
      "Cannot topologically sort cyclic work items.",
    );
  }
  return ordered;
}

function sanitizeMermaidId(rawId: string): string {
  return `wi_${rawId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function quoteMermaidLabel(text: string): string {
  return text.replace(/"/g, "'");
}

function renderTreeSummary(state: RoadmapState): string {
  const byId = new Map(state.workItems.map((item) => [item.id, item]));
  const waves = new Map<number, RoadmapFeature[]>();
  const sortedFeatures = state.features.toSorted((a, b) => {
    const waveDiff = (a.wave ?? 1) - (b.wave ?? 1);
    if (waveDiff !== 0) return waveDiff;
    const prioDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return prioDiff !== 0 ? prioDiff : a.id.localeCompare(b.id);
  });

  for (const feature of sortedFeatures) {
    const wave = feature.wave ?? 1;
    const bucket = waves.get(wave) ?? [];
    bucket.push(feature);
    waves.set(wave, bucket);
  }

  const lines = [`Roadmap (${state.sessionId}) [format=tree]`];
  for (const [wave, features] of [...waves.entries()].toSorted((a, b) => a[0] - b[0])) {
    lines.push(`Wave ${wave}`);
    features.forEach((feature, fIdx) => {
      const fLast = fIdx === features.length - 1;
      const fPrefix = fLast ? "└── " : "├── ";
      const fChildPad = fLast ? "    " : "│   ";
      const fIssue = feature.issueNumber ? ` (#${feature.issueNumber})` : "";
      lines.push(
        `${fPrefix}[Feature] ${feature.id}: ${feature.title}${fIssue} [${feature.priority}, risk=${feature.risk}]`,
      );
      const items = state.workItems.filter((item) => item.featureId === feature.id);
      items.forEach((item, iIdx) => {
        const iLast = iIdx === items.length - 1;
        const iPrefix = iLast ? "└── " : "├── ";
        const status = effectiveStatus(item, byId);
        const deps =
          item.blockedBy.length > 0 ? ` <- blocked by [${item.blockedBy.join(", ")}]` : "";
        const issue = item.issueNumber ? ` (#${item.issueNumber})` : "";
        lines.push(
          `${fChildPad}${iPrefix}${item.id}: ${item.title}${issue} [${item.priority}, risk=${item.risk}, status=${status}]${deps}`,
        );
      });
    });
  }
  return lines.join("\n");
}

function renderMermaidSummary(state: RoadmapState): string {
  const byId = new Map(state.workItems.map((item) => [item.id, item]));
  const lines = ["```mermaid", "flowchart TD"];
  for (const feature of state.features) {
    const fNode = sanitizeMermaidId(`feat_${feature.id}`);
    lines.push(`  subgraph ${fNode}["Feature: ${quoteMermaidLabel(feature.title)}"]`);
    const items = state.workItems.filter((item) => item.featureId === feature.id);
    for (const item of items) {
      const status = effectiveStatus(item, byId);
      const label = quoteMermaidLabel(
        `${item.id}: ${item.title} (${item.priority} / ${item.risk} / ${status})`,
      );
      lines.push(`    ${sanitizeMermaidId(item.id)}["${label}"]`);
    }
    lines.push("  end");
  }
  for (const item of state.workItems) {
    for (const dep of item.blockedBy) {
      lines.push(`  ${sanitizeMermaidId(dep)} --> ${sanitizeMermaidId(item.id)}`);
    }
  }
  lines.push("```");
  return lines.join("\n");
}

function toFeaturePlan(feature: RoadmapFeature): RoadmapPublicationFeaturePlan {
  const plan: RoadmapPublicationFeaturePlan = {
    id: feature.id,
    title: feature.title,
    action: feature.issueNumber !== undefined ? "update" : "create",
  };
  if (feature.issueNumber !== undefined) {
    plan.issueNumber = feature.issueNumber;
  }
  return plan;
}

function toWorkItemPlan(
  item: RoadmapWorkItem,
  byId: ReadonlyMap<string, RoadmapWorkItem>,
): RoadmapPublicationWorkItemPlan {
  const plan: RoadmapPublicationWorkItemPlan = {
    id: item.id,
    featureId: item.featureId,
    title: item.title,
    action: item.issueNumber !== undefined ? "update" : "create",
    initialStatus: defaultInitialStatus(item, byId),
    wave: item.wave ?? 1,
    blockedBy: [...item.blockedBy],
  };
  if (item.issueNumber !== undefined) {
    plan.issueNumber = item.issueNumber;
  }
  return plan;
}

function slugifySegment(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return slug || "work-item";
}

function pushSkipped(
  skipped: RoadmapSkippedWorkItem[],
  item: Pick<RoadmapWorkItem, "id" | "issueNumber">,
  reason: string,
): void {
  skipped.push({
    id: item.id,
    ...(item.issueNumber !== undefined ? { issueNumber: item.issueNumber } : {}),
    reason,
  });
}

function computeFeatureStatusAfterStart(
  workItems: readonly RoadmapWorkItem[],
  targetItem: RoadmapWorkItem,
): "Backlog" | "In Progress" | "Done" {
  const siblings: Array<{
    status?: RoadmapBoardStatus | undefined;
    initialStatus?: RoadmapBoardStatus | undefined;
  }> = [];
  for (const candidate of workItems) {
    if (candidate.featureId !== targetItem.featureId) continue;
    siblings.push(candidate.id === targetItem.id ? { status: "In Progress" } : candidate);
  }
  return deriveFeatureStatus(siblings);
}
