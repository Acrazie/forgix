import { retainsActiveReservations, trackerStatus } from "./reservations.js";
import { currentCheckpointIds, verifyCheckpointVerification } from "./runtime-coherence.js";
export { verifyCheckpointVerification } from "./runtime-coherence.js";
import { parse, stringify } from "yaml";
import { assertCleanHygiene, canonicalJson, sha256Hex } from "../core/digest.js";
import {
  EXIT_CODES,
  StateStoreError,
  validateSchema,
  type ExitCode,
  type SchemaName,
} from "../core/schema.js";
import {
  createWorkspaceStore,
  type WorkspaceStore,
  type WorkspaceStoreOptions,
} from "../core/store.js";
import { evaluateAutonomousGateEligibility } from "../core/autonomous-gate.js";
import type { NextActionEnvelope, RiskLevel } from "../types.js";

export { evaluateAutonomousGateEligibility, type NextActionEnvelope };

export const ROADMAP_SESSION_PATH = ".forgix/roadmap/session.yaml";
export const ROADMAP_STATE_PATH = ROADMAP_SESSION_PATH;
export const ROADMAP_CANONICAL_PATH = ".forgix/roadmap.yaml";
export const ROADMAP_RUNTIME_PATH = ".forgix/roadmap/runtime.yaml";
export const ROADMAP_IGNORE_ENTRY = ".forgix/roadmap/";
export const DEFAULT_PRODUCT_VISION_PATH = "docs/product-vision.md";
export const DEFAULT_ROADMAP_MARKDOWN_PATH = "docs/roadmap.md";
export const DEFAULT_WORKTREE_BASE_BRANCH = "main";
export const DEFAULT_WORKTREE_ROOT = ".worktrees";

export type RoadmapPhase = "divergence" | "convergence" | "audit" | "synthesis" | "published";
export type RoadmapCodebaseKind = "greenfield" | "existing";
export type RoadmapProjectMode = "create" | "attach";
export type RoadmapVisualFormat = "tree" | "mermaid";
export type RoadmapPriority = "P0" | "P1" | "P2" | "P3";
export type RoadmapAdapter = "local" | "github" | "entire";
export type RoadmapBoardStatus =
  | "Backlog"
  | "Ready"
  | "In Progress"
  | "Blocked"
  | "In Review"
  | "Done";
export const ROADMAP_BOARD_STATUSES: readonly RoadmapBoardStatus[] = [
  "Backlog",
  "Ready",
  "In Progress",
  "Blocked",
  "In Review",
  "Done",
];
export type RoadmapSharedContractKind =
  | "interface"
  | "schema"
  | "api"
  | "domain-invariant"
  | "module-boundary"
  | "formal-spec";
export const ROADMAP_SHARED_CONTRACT_KINDS: readonly RoadmapSharedContractKind[] = [
  "interface",
  "schema",
  "api",
  "domain-invariant",
  "module-boundary",
  "formal-spec",
];
export type RoadmapSharedContractStatus = "planned" | "existing" | "verified";
export type RoadmapAuditDimension =
  | "slicing_atomicity"
  | "contract_completeness"
  | "dag_soundness"
  | "verifiability"
  | "scope_alignment";
export type RoadmapAuditSeverity = "blocking" | "warning";
export type RoadmapAuditFindingStatus = "open" | "resolved" | "waived";
export type RoadmapCheckpointScopeType = "feature" | "wave";
export type RoadmapCheckpointStatus = "pending" | "ready" | "passed" | "failed";
export type RoadmapCheckpointReceiptStatus = "Passed" | "Failed";

export interface RoadmapTheme {
  id: string;
  title: string;
  summary: string;
  notes?: string[];
}

export interface RoadmapActiveQuestionOption {
  id: string;
  label: string;
  impact: string;
}

export interface RoadmapActiveQuestion {
  id: string;
  phase: "divergence" | "convergence" | "audit" | "synthesis";
  prompt: string;
  reason: string;
  options: RoadmapActiveQuestionOption[];
  recommendedOptionId: string;
  consequences: string[];
}

export interface RoadmapSharedContract {
  id: string;
  title: string;
  kind: RoadmapSharedContractKind;
  status: RoadmapSharedContractStatus;
  summary: string;
  invariants: string[];
  verificationHint: string;
  digest?: string;
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
  providesContractIds?: string[];
  consumesContractIds?: string[];
  initialStatus?: RoadmapBoardStatus;
  status?: RoadmapBoardStatus;
  issueNumber?: number;
  issueUrl?: string;
  projectItemId?: string;
}

export interface RoadmapVerificationCheckpoint {
  id: string;
  title: string;
  scopeType: RoadmapCheckpointScopeType;
  targetIds: string[];
  dependsOnWorkItemIds: string[];
  checks: string[];
  independentVerifierRequired: boolean;
  status?: RoadmapCheckpointStatus;
}

export interface RoadmapAuditFinding {
  id: string;
  dimension: RoadmapAuditDimension;
  severity: RoadmapAuditSeverity;
  targetId: string;
  message: string;
  status: RoadmapAuditFindingStatus;
  waiverReason?: string;
}

export interface RoadmapPlanAudit {
  candidateDigest: string;
  auditedAt: string;
  auditorContext: string;
  findings: RoadmapAuditFinding[];
  passed: boolean;
}

export type RoadmapAuditReceipt = RoadmapPlanAudit;

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
  actor?: string;
}

export interface RoadmapApprovalReceipt {
  approved: true;
  approvedAt: string;
  digest: string;
  actor?: string;
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
  activeQuestion?: RoadmapActiveQuestion;
  themes: RoadmapTheme[];
  sharedContracts?: RoadmapSharedContract[];
  features: RoadmapFeature[];
  workItems: RoadmapWorkItem[];
  verificationCheckpoints?: RoadmapVerificationCheckpoint[];
  candidateDigest?: string;
  audit?: RoadmapPlanAudit;
  approval?: RoadmapApprovalState;
  publication?: RoadmapPublicationState;
}

export interface PublishedFeature {
  id: string;
  title: string;
  summary: string;
  priority: RoadmapPriority;
  risk: RiskLevel;
  wave?: number;
  scopeIn: string[];
  scopeOut: string[];
}

export interface PublishedWorkItem {
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
  providesContractIds: string[];
  consumesContractIds: string[];
}

export interface PublishedVerificationCheckpoint {
  id: string;
  title: string;
  scopeType: RoadmapCheckpointScopeType;
  targetIds: string[];
  dependsOnWorkItemIds: string[];
  checks: string[];
  independentVerifierRequired: boolean;
}

export interface PublishedRoadmap {
  schemaVersion: 1;
  roadmapId: string;
  publishedAt: string;
  contentDigest: string;
  productVisionPath: string;
  productVisionSummary: string;
  adapter: RoadmapAdapter;
  projectBinding?: RoadmapProjectBinding;
  features: PublishedFeature[];
  sharedContracts: RoadmapSharedContract[];
  workItems: PublishedWorkItem[];
  verificationCheckpoints: PublishedVerificationCheckpoint[];
  auditReceipt: RoadmapPlanAudit;
  approvalReceipt: RoadmapApprovalReceipt;
}

export interface RoadmapWorkItemRuntimeState {
  id: string;
  reservation?: {
    taskId: string;
    roadmapDigest: string;
    baseBranch: string;
    handoffPending?: true;
    worktreeIdentity?: string;
  };
  status: RoadmapBoardStatus;
  branch?: string;
  worktreePath?: string;
  externalIssueNumber?: number;
  externalIssueUrl?: string;
  externalTrailId?: string;
  updatedAt: string;
  blockerReason?: string;
}

export interface RoadmapCheckpointReceipt {
  checkpointId: string;
  observedRoadmapDigest?: string;
  roadmapDigest: string;
  status: RoadmapCheckpointReceiptStatus;
  verifiedAt: string;
  verifierContext: string;
  checksRun: string[];
  summary: string;
  offendingIds?: string[];
}

export interface RoadmapRuntimeState {
  schemaVersion: 1;
  roadmapDigest: string;
  updatedAt: string;
  workItemStates: RoadmapWorkItemRuntimeState[];
  checkpointReceipts: RoadmapCheckpointReceipt[];
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

export interface RoadmapSyncPlanItem {
  id: string;
  featureId: string;
  title: string;
  action: "create" | "update";
  status: RoadmapBoardStatus;
  wave: number;
  blockedBy: string[];
  externalIssueNumber?: number;
  externalTrailId?: string;
}

export interface RoadmapSyncPlan {
  adapter: RoadmapAdapter;
  roadmapId: string;
  contentDigest: string;
  workItems: RoadmapSyncPlanItem[];
  dependencies: RoadmapPublicationDependency[];
  summary: {
    createWorkItems: number;
    updateWorkItems: number;
    dependencyEdges: number;
  };
}

export interface RoadmapSyncRecordPatch {
  recordedAt?: string;
  workItems?: Array<{
    id: string;
    status?: RoadmapBoardStatus;
    branch?: string;
    worktreePath?: string;
    externalIssueNumber?: number;
    externalIssueUrl?: string;
    externalTrailId?: string;
    blockerReason?: string;
  }>;
}

export interface PublishRoadmapOptions {
  roadmapId?: string;
  adapter?: RoadmapAdapter;
  publishedAt?: string;
  actor?: string;
}

export interface PublishRoadmapResult {
  roadmap: PublishedRoadmap;
  runtime: RoadmapRuntimeState;
  markdown: string;
  session: RoadmapState;
}

export interface ContractInvalidationOptions {
  now?: string;
  runtimeState?: RoadmapRuntimeState;
}

export interface ContractInvalidationResult {
  state: RoadmapState;
  updatedContractIds: string[];
  invalidatedWorkItemIds: string[];
  invalidatedCheckpointIds: string[];
  runtimeState?: RoadmapRuntimeState;
}

export interface RecordCheckpointResultInput {
  checkpointId: string;
  observedRoadmapDigest?: string;
  status: RoadmapCheckpointReceiptStatus;
  verifiedAt?: string;
  verifierContext: string;
  checksRun: string[];
  summary: string;
  offendingIds?: string[];
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
  runtimeState?: RoadmapRuntimeState;
}

export interface RoadmapSkippedWorkItem {
  id: string;
  issueNumber?: number;
  reason: string;
}

export interface RoadmapEligibleWorkItem {
  workItem: RoadmapWorkItem;
  issueRef: string;
  workspace: WorkItemWorkspaceSpec;
  featureStatusAfterStart: "Backlog" | "In Progress" | "Done";
}

export interface RoadmapReadyCheckpoint {
  checkpoint: RoadmapVerificationCheckpoint;
  allDependenciesDone: boolean;
}

export interface RoadmapSelectResult {
  eligible: RoadmapEligibleWorkItem[];
  skipped: RoadmapSkippedWorkItem[];
  readyCheckpoints: RoadmapReadyCheckpoint[];
}

export type RoadmapStoreOptions = WorkspaceStoreOptions;

type SelectableWorkItem = RoadmapWorkItem | PublishedWorkItem;
type SelectableCheckpoint = RoadmapVerificationCheckpoint | PublishedVerificationCheckpoint;

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
 * Computes a deterministic SHA-256 digest for a Shared Contract specification.
 */
export function computeSharedContractDigest(
  contract: Pick<
    RoadmapSharedContract,
    "id" | "title" | "kind" | "summary" | "invariants" | "verificationHint"
  >,
): string {
  return `sha256:${sha256Hex({
    id: contract.id,
    title: contract.title,
    kind: contract.kind,
    summary: contract.summary,
    invariants: contract.invariants,
    verificationHint: contract.verificationHint,
  })}`;
}

/**
 * Computes a deterministic digest over the candidate roadmap specification fields
 * so audit, approval, and publication remain anchored to content rather than
 * mutable issue numbers, runtime statuses, or timestamps.
 */
export function computeRoadmapCandidateDigest(
  state: Pick<
    RoadmapState,
    | "features"
    | "workItems"
    | "projectBinding"
    | "productVisionPath"
    | "productVisionSummary"
    | "sharedContracts"
    | "verificationCheckpoints"
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
    sharedContracts: (state.sharedContracts ?? [])
      .toSorted((a, b) => a.id.localeCompare(b.id))
      .map((contract) => ({
        id: contract.id,
        title: contract.title,
        kind: contract.kind,
        summary: contract.summary,
        invariants: contract.invariants,
        verificationHint: contract.verificationHint,
      })),
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
        providesContractIds: (item.providesContractIds ?? []).toSorted(),
        consumesContractIds: (item.consumesContractIds ?? []).toSorted(),
        initialStatus: item.initialStatus,
      })),
    verificationCheckpoints: (state.verificationCheckpoints ?? [])
      .toSorted((a, b) => a.id.localeCompare(b.id))
      .map((cp) => ({
        id: cp.id,
        title: cp.title,
        scopeType: cp.scopeType,
        targetIds: cp.targetIds.toSorted(),
        dependsOnWorkItemIds: cp.dependsOnWorkItemIds.toSorted(),
        checks: cp.checks,
        independentVerifierRequired: cp.independentVerifierRequired,
      })),
  };
  return `sha256:${sha256Hex(payload)}`;
}

/**
 * Detects directed dependency cycles in Work Item `blockedBy` edges using DFS.
 */
export function detectDependencyCycles(
  workItems: readonly Pick<RoadmapWorkItem, "id" | "blockedBy">[],
): string[][] {
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

function normalizeRoadmapForSchemaValidation(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.sharedContracts)) return raw;
  const hasFormalSpec = record.sharedContracts.some(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as { kind?: unknown }).kind === "formal-spec",
  );
  if (!hasFormalSpec) return raw;
  const clone = structuredClone(record);
  for (const item of clone.sharedContracts as Array<Record<string, unknown>>) {
    if (item.kind === "formal-spec") {
      item.kind = "domain-invariant";
    }
  }
  return clone;
}

/**
 * Validates a roadmap ideation session state against JSON Schema, DAG acyclicity,
 * Shared Contract invariants, cross-entity references, phase completeness, and hygiene.
 */
export function validateRoadmapState(rawState: unknown): RoadmapState {
  const schemaResult = validateSchema(
    "roadmap-state",
    normalizeRoadmapForSchemaValidation(rawState),
  );
  if (!schemaResult.valid) {
    throw new RoadmapError(
      "roadmap_invalid",
      `Roadmap state schema invalid: ${schemaResult.errors.join("; ")}`,
    );
  }

  const state = structuredClone(rawState) as RoadmapState;
  assertRoadmapHygiene(state);

  assertUniqueIds(state.themes, "theme");
  const contracts = state.sharedContracts ?? [];
  const checkpoints = state.verificationCheckpoints ?? [];

  if (state.activeQuestion) {
    const optionIds = new Set(state.activeQuestion.options.map((opt) => opt.id));
    if (!optionIds.has(state.activeQuestion.recommendedOptionId)) {
      throw new RoadmapError(
        "roadmap_invalid",
        `Active question "${state.activeQuestion.id}" recommendedOptionId "${state.activeQuestion.recommendedOptionId}" is not in options.`,
      );
    }
  }

  const { featureIds, workItemIds, contractIds, contractsById, providerByContract } =
    validateGraphEntities({
      features: state.features,
      workItems: state.workItems,
      sharedContracts: contracts,
      verificationCheckpoints: checkpoints,
    });
  void featureIds;
  void workItemIds;
  void contractIds;

  if (state.phase === "audit" || state.phase === "synthesis" || state.phase === "published") {
    validateExecutionReadiness({
      phaseLabel: state.phase,
      features: state.features,
      workItems: state.workItems,
      contractsById,
      providerByContract,
    });
  }

  const computed = computeRoadmapCandidateDigest(state);

  if (state.phase === "synthesis" || state.phase === "published") {
    if (!state.audit) {
      throw new RoadmapError(
        "roadmap_invalid",
        `Phase "${state.phase}" requires a completed audit receipt.`,
      );
    }
    validatePassedAudit(state.audit, computed, `Phase "${state.phase}"`);
  }

  if (state.approval?.approved && state.approval.digest && state.approval.digest !== computed) {
    throw new RoadmapError(
      "roadmap_state_conflict",
      `Approved digest (${state.approval.digest}) does not match current candidate digest (${computed}).`,
    );
  }

  return state;
}

/**
 * Validates a canonical published `.forgix/roadmap.yaml` specification.
 */
export function validatePublishedRoadmap(rawRoadmap: unknown): PublishedRoadmap {
  const schemaResult = validateSchema("roadmap", normalizeRoadmapForSchemaValidation(rawRoadmap));
  if (!schemaResult.valid) {
    throw new RoadmapError(
      "roadmap_invalid",
      `Published roadmap schema invalid: ${schemaResult.errors.join("; ")}`,
    );
  }

  const roadmap = structuredClone(rawRoadmap) as PublishedRoadmap;
  assertRoadmapHygiene(roadmap);

  const { contractsById, providerByContract } = validateGraphEntities({
    features: roadmap.features,
    workItems: roadmap.workItems,
    sharedContracts: roadmap.sharedContracts,
    verificationCheckpoints: roadmap.verificationCheckpoints,
  });

  validateExecutionReadiness({
    phaseLabel: "published",
    features: roadmap.features,
    workItems: roadmap.workItems,
    contractsById,
    providerByContract,
  });

  validatePassedAudit(roadmap.auditReceipt, undefined, "Published roadmap");

  if (!roadmap.approvalReceipt.approved) {
    throw new RoadmapError(
      "roadmap_invalid",
      "Published roadmap requires approvalReceipt.approved === true.",
    );
  }

  return roadmap;
}

/**
 * Validates a gitignored `.forgix/roadmap/runtime.yaml` execution state.
 */
export function validateRoadmapRuntimeState(rawRuntime: unknown): RoadmapRuntimeState {
  const schemaResult = validateSchema("roadmap-runtime", rawRuntime);
  if (!schemaResult.valid) {
    throw new RoadmapError(
      "roadmap_invalid",
      `Roadmap runtime schema invalid: ${schemaResult.errors.join("; ")}`,
    );
  }

  const runtime = structuredClone(rawRuntime) as RoadmapRuntimeState;
  assertRoadmapHygiene(runtime);
  assertUniqueIds(runtime.workItemStates, "workItemState");
  return runtime;
}

/**
 * Selectively invalidates unfinished consumer Work Items (and their transitive
 * dependents) plus dependent Verification Checkpoints when Shared Contracts change.
 */
export function invalidateDependentsOnContractChange(
  rawState: RoadmapState,
  changedContractIds: readonly string[],
  options: ContractInvalidationOptions = {},
): ContractInvalidationResult {
  const state = structuredClone(rawState);
  const changedSet = new Set(changedContractIds);
  const now = options.now ?? new Date().toISOString();
  const updatedContractIds: string[] = [];

  for (const contract of state.sharedContracts ?? []) {
    if (!changedSet.has(contract.id)) continue;
    contract.digest = computeSharedContractDigest(contract);
    if (contract.status === "verified") {
      contract.status = "planned";
    }
    updatedContractIds.push(contract.id);
  }

  const byId = new Map(state.workItems.map((item) => [item.id, item]));
  const dependents = new Map<string, string[]>();
  for (const item of state.workItems) {
    for (const dep of item.blockedBy) {
      const list = dependents.get(dep) ?? [];
      list.push(item.id);
      dependents.set(dep, list);
    }
  }

  const invalidatedWorkItemSet = new Set<string>();
  const queue: string[] = [];
  for (const item of state.workItems) {
    const consumesChanged = (item.consumesContractIds ?? []).some((id) => changedSet.has(id));
    if (consumesChanged && effectiveStatus(item, byId) !== "Done") {
      invalidatedWorkItemSet.add(item.id);
      queue.push(item.id);
    }
  }

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) break;
    for (const nextId of dependents.get(currentId) ?? []) {
      const nextItem = byId.get(nextId);
      if (
        nextItem &&
        !invalidatedWorkItemSet.has(nextId) &&
        effectiveStatus(nextItem, byId) !== "Done"
      ) {
        invalidatedWorkItemSet.add(nextId);
        queue.push(nextId);
      }
    }
  }

  const invalidatedFeatureIds = new Set<string>();
  for (const item of state.workItems) {
    if (invalidatedWorkItemSet.has(item.id)) {
      item.status = "Backlog";
      invalidatedFeatureIds.add(item.featureId);
    }
  }

  const invalidatedCheckpointIds: string[] = [];
  for (const checkpoint of state.verificationCheckpoints ?? []) {
    const touchesWorkItem = checkpoint.dependsOnWorkItemIds.some((id) =>
      invalidatedWorkItemSet.has(id),
    );
    const touchesFeature =
      checkpoint.scopeType === "feature" &&
      checkpoint.targetIds.some((id) => invalidatedFeatureIds.has(id));
    if (touchesWorkItem || touchesFeature) {
      checkpoint.status = "pending";
      invalidatedCheckpointIds.push(checkpoint.id);
    }
  }

  state.updatedAt = now;
  state.candidateDigest = computeRoadmapCandidateDigest(state);
  if (state.phase === "synthesis" || state.phase === "published") {
    state.phase = "convergence";
    delete state.audit;
    delete state.approval;
  }

  const invalidatedWorkItemIds = [...invalidatedWorkItemSet];
  let nextRuntime: RoadmapRuntimeState | undefined;
  if (options.runtimeState) {
    nextRuntime = structuredClone(options.runtimeState);
    const checkpointSet = new Set(invalidatedCheckpointIds);
    for (const wiState of nextRuntime.workItemStates) {
      if (invalidatedWorkItemSet.has(wiState.id) && wiState.status !== "Done") {
        wiState.status = "Backlog";
        wiState.updatedAt = now;
      }
    }
    nextRuntime.checkpointReceipts = nextRuntime.checkpointReceipts.filter(
      (receipt) => !checkpointSet.has(receipt.checkpointId),
    );
    nextRuntime.roadmapDigest = state.candidateDigest;
    nextRuntime.updatedAt = now;
  }

  return {
    state,
    updatedContractIds,
    invalidatedWorkItemIds,
    invalidatedCheckpointIds,
    ...(nextRuntime !== undefined ? { runtimeState: nextRuntime } : {}),
  };
}

/**
 * Publishes an audited and approved Roadmap Session State into the canonical
 * `.forgix/roadmap.yaml`, initial `.forgix/roadmap/runtime.yaml`, and `docs/roadmap.md`
 * Markdown projection.
 */
export function publishRoadmap(
  rawState: RoadmapState,
  options: PublishRoadmapOptions = {},
): PublishRoadmapResult {
  const state = validateRoadmapState(rawState);
  if (state.phase !== "synthesis" && state.phase !== "published") {
    throw new RoadmapError(
      "roadmap_state_conflict",
      `Cannot publish roadmap from phase "${state.phase}"; must be in "synthesis" or "published".`,
    );
  }
  if (!state.audit) {
    throw new RoadmapError("roadmap_state_conflict", "Roadmap must pass audit before publication.");
  }
  if (!state.approval?.approved) {
    throw new RoadmapError(
      "roadmap_state_conflict",
      "Roadmap must be explicitly approved before publication.",
    );
  }

  const contentDigest = computeRoadmapCandidateDigest(state);
  if (state.approval.digest && state.approval.digest !== contentDigest) {
    throw new RoadmapError(
      "roadmap_state_conflict",
      `Approval digest (${state.approval.digest}) does not match content digest (${contentDigest}).`,
    );
  }

  const publishedAt = options.publishedAt ?? new Date().toISOString();
  const actor = options.actor ?? state.approval.actor;
  const byId = new Map(state.workItems.map((item) => [item.id, item]));

  const sharedContracts: RoadmapSharedContract[] = (state.sharedContracts ?? []).map(
    (contract) => ({
      id: contract.id,
      title: contract.title,
      kind: contract.kind,
      status: contract.status,
      summary: contract.summary,
      invariants: [...contract.invariants],
      verificationHint: contract.verificationHint,
      digest: contract.digest ?? computeSharedContractDigest(contract),
    }),
  );

  const features: PublishedFeature[] = state.features.map((feature) => ({
    id: feature.id,
    title: feature.title,
    summary: feature.summary,
    priority: feature.priority,
    risk: feature.risk,
    ...(feature.wave !== undefined ? { wave: feature.wave } : {}),
    scopeIn: [...feature.scopeIn],
    scopeOut: [...feature.scopeOut],
  }));

  const workItems: PublishedWorkItem[] = state.workItems.map((item) => ({
    id: item.id,
    featureId: item.featureId,
    title: item.title,
    objective: item.objective,
    scopeIn: [...item.scopeIn],
    scopeOut: [...item.scopeOut],
    ...(item.linkedRuleIds !== undefined ? { linkedRuleIds: [...item.linkedRuleIds] } : {}),
    acceptanceCriteria: [...item.acceptanceCriteria],
    risk: item.risk,
    priority: item.priority,
    ...(item.wave !== undefined ? { wave: item.wave } : {}),
    blockedBy: [...item.blockedBy],
    providesContractIds: [...(item.providesContractIds ?? [])],
    consumesContractIds: [...(item.consumesContractIds ?? [])],
  }));

  const verificationCheckpoints: PublishedVerificationCheckpoint[] = (
    state.verificationCheckpoints ?? []
  ).map((cp) => ({
    id: cp.id,
    title: cp.title,
    scopeType: cp.scopeType,
    targetIds: [...cp.targetIds],
    dependsOnWorkItemIds: [...cp.dependsOnWorkItemIds],
    checks: [...cp.checks],
    independentVerifierRequired: cp.independentVerifierRequired,
  }));

  const roadmap: PublishedRoadmap = validatePublishedRoadmap({
    schemaVersion: 1,
    roadmapId: options.roadmapId ?? state.sessionId,
    publishedAt,
    contentDigest,
    productVisionPath: state.productVisionPath ?? DEFAULT_PRODUCT_VISION_PATH,
    productVisionSummary: state.productVisionSummary ?? "Product roadmap specification.",
    adapter: options.adapter ?? "local",
    ...(state.projectBinding ? { projectBinding: state.projectBinding } : {}),
    features,
    sharedContracts,
    workItems,
    verificationCheckpoints,
    auditReceipt: structuredClone(state.audit),
    approvalReceipt: {
      approved: true,
      approvedAt: state.approval.approvedAt ?? publishedAt,
      digest: state.approval.digest ?? contentDigest,
      ...(actor ? { actor } : {}),
    },
  });

  const runtime: RoadmapRuntimeState = validateRoadmapRuntimeState({
    schemaVersion: 1,
    roadmapDigest: contentDigest,
    updatedAt: publishedAt,
    workItemStates: state.workItems.map((item) => ({
      id: item.id,
      status: effectiveStatus(item, byId),
      updatedAt: publishedAt,
      ...(item.issueNumber !== undefined ? { externalIssueNumber: item.issueNumber } : {}),
      ...(item.issueUrl !== undefined ? { externalIssueUrl: item.issueUrl } : {}),
    })),
    checkpointReceipts: [],
  });

  const session: RoadmapState = {
    ...state,
    phase: "published",
    candidateDigest: contentDigest,
    updatedAt: publishedAt,
  };

  return {
    roadmap,
    runtime,
    markdown: renderRoadmapMarkdown(roadmap, runtime),
    session,
  };
}

/**
 * Renders the human-readable `docs/roadmap.md` Markdown projection from a
 * canonical `PublishedRoadmap` (and optional `RoadmapRuntimeState`).
 */
export function renderRoadmapMarkdown(
  roadmap: PublishedRoadmap,
  runtime?: RoadmapRuntimeState,
): string {
  const statusById = new Map(
    (runtime?.workItemStates ?? []).map((entry) => [entry.id, entry.status]),
  );
  const lines: string[] = [
    `# Roadmap: ${roadmap.roadmapId}`,
    "",
    `- **Published**: ${roadmap.publishedAt}`,
    `- **Content Digest**: \`${roadmap.contentDigest}\``,
    `- **Adapter**: \`${roadmap.adapter}\``,
    `- **Vision**: ${roadmap.productVisionSummary} (\`${roadmap.productVisionPath}\`)`,
    "",
  ];

  if (roadmap.sharedContracts.length > 0) {
    lines.push("## Shared Contracts", "");
    for (const contract of roadmap.sharedContracts) {
      lines.push(`### ${contract.id}: ${contract.title}`);
      lines.push(`- **Kind**: \`${contract.kind}\` | **Status**: \`${contract.status}\``);
      lines.push(`- **Summary**: ${contract.summary}`);
      lines.push(`- **Invariants**: ${contract.invariants.join("; ")}`);
      lines.push(`- **Verification Hint**: ${contract.verificationHint}`, "");
    }
  }

  lines.push("## Features & Work Items", "");
  const sortedFeatures = roadmap.features.toSorted(
    (a, b) =>
      (a.wave ?? 1) - (b.wave ?? 1) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );
  for (const feature of sortedFeatures) {
    lines.push(
      `### [Wave ${feature.wave ?? 1}] ${feature.id}: ${feature.title} (${feature.priority}, risk=${feature.risk})`,
    );
    lines.push("", feature.summary, "");
    const items = roadmap.workItems.filter((item) => item.featureId === feature.id);
    for (const item of items) {
      const status = statusById.get(item.id) ?? (item.blockedBy.length === 0 ? "Ready" : "Backlog");
      const deps = item.blockedBy.length > 0 ? ` | blockedBy: ${item.blockedBy.join(", ")}` : "";
      lines.push(
        `- **${item.id}**: ${item.title} [${item.priority}, risk=${item.risk}, status=${status}${deps}]`,
      );
    }
    lines.push("");
  }

  if (roadmap.verificationCheckpoints.length > 0) {
    lines.push("## Verification Checkpoints", "");
    for (const cp of roadmap.verificationCheckpoints) {
      lines.push(
        `- **${cp.id}** (${cp.scopeType}: ${cp.targetIds.join(", ")}): ${cp.title} — depends on [${cp.dependsOnWorkItemIds.join(", ")}]`,
      );
    }
    lines.push("");
  }

  lines.push("## Dependency Graph", "", renderMermaidSummary(roadmap), "");
  return lines.join("\n");
}

/**
 * Records a Verification Checkpoint receipt (`Passed` or `Failed`) in runtime state.
 */
export function recordCheckpointResult(
  rawRuntime: RoadmapRuntimeState,
  patch: RecordCheckpointResultInput,
  options?: {
    roadmap?: Pick<
      RoadmapState | PublishedRoadmap,
      "verificationCheckpoints" | "sharedContracts" | "workItems"
    >;
  },
): RoadmapRuntimeState {
  const next = validateRoadmapRuntimeState(rawRuntime);
  if (patch.observedRoadmapDigest && patch.observedRoadmapDigest !== next.roadmapDigest) {
    throw new RoadmapError(
      "roadmap_invalid",
      "Checkpoint was verified against a different Roadmap digest.",
    );
  }
  if (patch.status === "Passed") {
    const cleanChecks = (patch.checksRun ?? []).map((c) => c.trim()).filter(Boolean);
    if (cleanChecks.every((c) => /^(?:model-inspection|user-observation)$/i.test(c))) {
      throw new RoadmapError(
        "roadmap_invalid",
        `Checkpoint "${patch.checkpointId}" cannot pass without executable formal or runtime verification checks.`,
      );
    }
    const checkpoint = options?.roadmap?.verificationCheckpoints?.find(
      (cp) => cp.id === patch.checkpointId,
    );
    if (checkpoint) {
      const verification = verifyCheckpointVerification(checkpoint, cleanChecks, {
        ...(options?.roadmap?.sharedContracts
          ? { sharedContracts: options.roadmap.sharedContracts }
          : {}),
        ...(options?.roadmap?.workItems ? { workItems: options.roadmap.workItems } : {}),
      });
      if (!verification.passed) {
        throw new RoadmapError(
          "roadmap_invalid",
          `Checkpoint "${patch.checkpointId}" missing required verification checks: ${verification.missingChecks.join(", ")}.`,
        );
      }
    }
  }
  const verifiedAt = patch.verifiedAt ?? new Date().toISOString();
  const receipt: RoadmapCheckpointReceipt = {
    checkpointId: patch.checkpointId,
    roadmapDigest: next.roadmapDigest,
    ...(patch.observedRoadmapDigest ? { observedRoadmapDigest: patch.observedRoadmapDigest } : {}),
    status: patch.status,
    verifiedAt,
    verifierContext: patch.verifierContext,
    checksRun: [...patch.checksRun],
    summary: patch.summary,
    ...(patch.offendingIds && patch.offendingIds.length > 0
      ? { offendingIds: [...new Set(patch.offendingIds)] }
      : {}),
  };

  next.checkpointReceipts = [
    ...next.checkpointReceipts.filter((entry) => entry.checkpointId !== patch.checkpointId),
    receipt,
  ];
  next.updatedAt = verifiedAt;
  return validateRoadmapRuntimeState(next);
}

export function computeRoadmapNextActionEnvelope(
  input: RoadmapState | PublishedRoadmap | RoadmapSelectResult | RoadmapRuntimeState,
): NextActionEnvelope {
  if ("eligible" in input && "readyCheckpoints" in input) {
    const hasCheckpoints = input.readyCheckpoints.length > 0;
    return {
      role: hasCheckpoints ? "checkpoint-verifier" : "roadmap-runner",
      phase: "execution",
      allowedCommands: hasCheckpoints
        ? [
            "forgix roadmap checkpoint-record",
            "forgix roadmap select-ready",
            "forgix telemetry record",
          ]
        : [
            "forgix roadmap prepare-local <work-item-id>",
            "forgix roadmap set-status <work-item-id> <status>",
            "forgix task gate <task-id> --view",
          ],
      activeInvariants: [
        "worktree_isolation",
        "shared_contract_coverage",
        "verification_checkpoint_gating",
        "autonomous_proof_floor",
      ],
    };
  }
  if ("workItemStates" in input && "checkpointReceipts" in input) {
    return {
      role: "roadmap-runner",
      phase: "checkpoint",
      allowedCommands: ["forgix roadmap select-ready", "forgix roadmap view", "forgix retro"],
      activeInvariants: [
        "independent_checkpoint_verifier",
        "checkpoint_receipt_digest_bound",
        "wave_unlock_requires_passed_checkpoint",
      ],
    };
  }
  if ("roadmapId" in input && "contentDigest" in input) {
    return {
      role: "roadmap-runner",
      phase: "published",
      allowedCommands: [
        "forgix roadmap select-ready",
        "forgix roadmap view",
        "forgix roadmap sync-plan",
        "forgix roadmap checkpoint-record",
      ],
      activeInvariants: [
        "published_digest_immutable",
        "worktree_isolation",
        "verification_checkpoint_gating",
      ],
    };
  }
  switch (input.phase) {
    case "divergence":
      return {
        role: "roadmap-divergence",
        phase: "divergence",
        allowedCommands: [
          "forgix roadmap session-save",
          "forgix roadmap session-view",
          "forgix roadmap validate --session",
        ],
        activeInvariants: [
          "read_only_discovery",
          "single_active_roadmap_question",
          "roadmap_dir_gitignored",
        ],
      };
    case "convergence":
      return {
        role: "roadmap-convergence",
        phase: "convergence",
        allowedCommands: [
          "forgix roadmap session-save",
          "forgix roadmap validate --session",
          "forgix roadmap session-view",
        ],
        activeInvariants: [
          "acyclic_work_item_dag",
          "shared_contract_coverage",
          "verifiable_acceptance_criteria",
        ],
      };
    case "audit":
      return {
        role: "roadmap-auditor",
        phase: "audit",
        allowedCommands: ["forgix roadmap session-save", "forgix roadmap validate --session"],
        activeInvariants: [
          "independent_plan_audit",
          "zero_open_blocking_findings",
          "candidate_digest_bound",
        ],
      };
    case "synthesis":
      return {
        role: "roadmap-synthesis",
        phase: "synthesis",
        allowedCommands: [
          "forgix roadmap publish",
          "forgix roadmap publish-plan",
          "forgix roadmap session-view --format=mermaid",
        ],
        activeInvariants: [
          "passed_audit_receipt_required",
          "explicit_human_approval_required",
          "candidate_digest_match",
        ],
      };
    case "published":
    default:
      return {
        role: "roadmap-runner",
        phase: "published",
        allowedCommands: [
          "forgix roadmap select-ready",
          "forgix roadmap view",
          "forgix roadmap sync-plan",
        ],
        activeInvariants: [
          "published_digest_immutable",
          "worktree_isolation",
          "verification_checkpoint_gating",
        ],
      };
  }
}

export const computeNextActionEnvelope = computeRoadmapNextActionEnvelope;

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
    `Audit: ${state.audit ? (state.audit.passed ? "passed" : "failed") : "pending"}`,
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
 * Renders visual DAG synthesis in ASCII `tree` or Mermaid `flowchart TD` format.
 */
export function renderRoadmapVisualSummary(
  state: Pick<RoadmapState, "features" | "workItems"> & {
    sessionId?: string;
    roadmapId?: string;
    visualFormat?: RoadmapVisualFormat;
  },
  format: RoadmapVisualFormat = state.visualFormat ?? "tree",
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
 * Computes an idempotent external sync plan (`local | github | entire`) from a
 * canonical `PublishedRoadmap` and optional `RoadmapRuntimeState`.
 */
export function planExternalSync(
  rawRoadmap: PublishedRoadmap,
  runtime?: RoadmapRuntimeState,
): RoadmapSyncPlan {
  const roadmap = validatePublishedRoadmap(rawRoadmap);
  const byId = new Map(roadmap.workItems.map((item) => [item.id, item]));
  const runtimeById = new Map((runtime?.workItemStates ?? []).map((entry) => [entry.id, entry]));
  const orderedItems = topologicalWorkItems(roadmap.workItems);

  const workItems: RoadmapSyncPlanItem[] = orderedItems.map((item) => {
    const rt = runtimeById.get(item.id);
    const hasExternal = rt?.externalIssueNumber !== undefined || rt?.externalTrailId !== undefined;
    return {
      id: item.id,
      featureId: item.featureId,
      title: item.title,
      action: hasExternal ? "update" : "create",
      status: rt?.status ?? defaultInitialStatus(item, byId),
      wave: item.wave ?? 1,
      blockedBy: [...item.blockedBy],
      ...(rt?.externalIssueNumber !== undefined
        ? { externalIssueNumber: rt.externalIssueNumber }
        : {}),
      ...(rt?.externalTrailId !== undefined ? { externalTrailId: rt.externalTrailId } : {}),
    };
  });

  const dependencies: RoadmapPublicationDependency[] = [];
  for (const item of orderedItems) {
    for (const dep of item.blockedBy) {
      dependencies.push({ workItemId: item.id, blockedById: dep });
    }
  }

  return {
    adapter: roadmap.adapter,
    roadmapId: roadmap.roadmapId,
    contentDigest: roadmap.contentDigest,
    workItems,
    dependencies,
    summary: {
      createWorkItems: workItems.filter((item) => item.action === "create").length,
      updateWorkItems: workItems.filter((item) => item.action === "update").length,
      dependencyEdges: dependencies.length,
    },
  };
}

export const syncPlan = planExternalSync;

/**
 * Records external tracker sync updates (`local | github | entire`) onto `RoadmapRuntimeState`.
 */
export function recordExternalSyncBatch(
  rawRuntime: RoadmapRuntimeState,
  patch: RoadmapSyncRecordPatch,
): RoadmapRuntimeState {
  const next = validateRoadmapRuntimeState(rawRuntime);
  const now = patch.recordedAt ?? new Date().toISOString();
  const byId = new Map(next.workItemStates.map((entry) => [entry.id, entry]));

  for (const entry of patch.workItems ?? []) {
    const existing = byId.get(entry.id);
    const branch = entry.branch ?? existing?.branch;
    const worktreePath = entry.worktreePath ?? existing?.worktreePath;
    const externalIssueNumber = entry.externalIssueNumber ?? existing?.externalIssueNumber;
    const externalIssueUrl = entry.externalIssueUrl ?? existing?.externalIssueUrl;
    const externalTrailId = entry.externalTrailId ?? existing?.externalTrailId;
    const blockerReason = entry.blockerReason ?? existing?.blockerReason;
    const updated: RoadmapWorkItemRuntimeState = {
      ...(existing?.reservation ? { reservation: existing.reservation } : {}),
      id: entry.id,
      status: trackerStatus(existing, entry.status),
      updatedAt: now,
      ...(branch !== undefined ? { branch } : {}),
      ...(worktreePath !== undefined ? { worktreePath } : {}),
      ...(externalIssueNumber !== undefined ? { externalIssueNumber } : {}),
      ...(externalIssueUrl !== undefined ? { externalIssueUrl } : {}),
      ...(externalTrailId !== undefined ? { externalTrailId } : {}),
      ...(blockerReason !== undefined ? { blockerReason } : {}),
    };
    byId.set(entry.id, updated);
  }

  next.workItemStates = [...byId.values()];
  next.updatedAt = now;
  return validateRoadmapRuntimeState(next);
}

export const syncRecord = recordExternalSyncBatch;

function recordWorkItemIssue(
  item: RoadmapWorkItem,
  issueNumber: number,
  issueUrl: string | undefined,
): void {
  if (issueUrl) item.issueUrl = issueUrl;
  else if (item.issueNumber !== issueNumber) delete item.issueUrl;
  item.issueNumber = issueNumber;
}

/**
 * Records published GitHub Project bindings and Issue numbers onto the local
 * roadmap session state so interrupted multi-issue publication batches can resume idempotently.
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
    recordWorkItemIssue(item, entry.issueNumber, entry.issueUrl);
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

export interface RoadmapStatusTransitionResult {
  state: RoadmapState;
  workItem: RoadmapWorkItem;
  featureId: string;
  previousStatus: RoadmapBoardStatus;
  status: RoadmapBoardStatus;
  featureStatus: "Backlog" | "In Progress" | "Done";
  promotedIds: string[];
}

/**
 * Transitions a single Work Item's local board status in `RoadmapState` without
 * requiring a published GitHub `issueNumber` or `projectItemId`, derives the
 * updated parent Feature status, and promotes newly unblocked `Backlog`
 * dependents to `Ready` when `nextStatus === "Done"`.
 */
export function transitionRoadmapWorkItemStatus(
  rawState: RoadmapState,
  workItemId: string,
  nextStatus: RoadmapBoardStatus,
  options: { updatedAt?: string } = {},
): RoadmapStatusTransitionResult {
  const state = validateRoadmapState(rawState);
  if (!ROADMAP_BOARD_STATUSES.includes(nextStatus)) {
    throw new RoadmapError(
      "roadmap_invalid",
      `Invalid work-item status "${nextStatus}". Expected one of: ${ROADMAP_BOARD_STATUSES.join(", ")}.`,
    );
  }
  const byId = new Map(state.workItems.map((item) => [item.id, item]));
  const target = byId.get(workItemId);
  if (!target) {
    throw new RoadmapError(
      "roadmap_invalid",
      `Work item "${workItemId}" not found in roadmap state.`,
    );
  }

  const previousStatus = effectiveStatus(target, byId);
  let workItems = state.workItems.map((item) =>
    item.id === workItemId ? { ...item, status: nextStatus } : item,
  );
  const promotedIds: string[] = [];
  if (nextStatus === "Done") {
    const updatedMap = new Map(workItems.map((item) => [item.id, item]));
    workItems = workItems.map((item) => {
      if (effectiveStatus(item, updatedMap) !== "Backlog") return item;
      const allDepsDone = item.blockedBy.every((depId) => {
        const dep = updatedMap.get(depId);
        return dep !== undefined && effectiveStatus(dep, updatedMap) === "Done";
      });
      if (!allDepsDone) return item;
      promotedIds.push(item.id);
      return { ...item, status: "Ready" };
    });
  }
  const nextState = validateRoadmapState({
    ...state,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    workItems,
  });

  const updatedWorkItem = nextState.workItems.find((item) => item.id === workItemId)!;
  const featureItems = nextState.workItems.filter(
    (item) => item.featureId === updatedWorkItem.featureId,
  );
  return {
    state: nextState,
    workItem: updatedWorkItem,
    featureId: updatedWorkItem.featureId,
    previousStatus,
    status: nextStatus,
    featureStatus: deriveFeatureStatus(featureItems),
    promotedIds,
  };
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
 * Selects eligible `Ready` Work Items whose `blockedBy` dependencies and upstream
 * Verification Checkpoints are all `Done`/`Passed`, AND selects `readyCheckpoints`
 * whose `dependsOnWorkItemIds` are all `Done` and not yet `Passed`.
 */
export function selectEligibleWorkItems(
  input:
    | readonly RoadmapWorkItem[]
    | Pick<RoadmapState, "workItems" | "verificationCheckpoints">
    | Pick<PublishedRoadmap, "workItems" | "verificationCheckpoints">,
  options: RoadmapSelectOptions = {},
): RoadmapSelectResult {
  const workItems: readonly SelectableWorkItem[] = "workItems" in input ? input.workItems : input;
  const checkpoints: readonly SelectableCheckpoint[] =
    "workItems" in input ? (input.verificationCheckpoints ?? []) : [];

  const runtimeById = new Map(
    (options.runtimeState?.workItemStates ?? []).map((entry) => [entry.id, entry]),
  );
  const runtime = options.runtimeState;
  const passedCheckpointIds = currentCheckpointIds(
    runtime?.checkpointReceipts ?? [],
    runtime?.roadmapDigest ?? "",
  );

  const byId = new Map(workItems.map((item) => [item.id, item]));
  const statusOf = (item: SelectableWorkItem): RoadmapBoardStatus => {
    const entry = runtimeById.get(item.id);
    return entry?.reservation && (entry.reservation.handoffPending || entry.status === "Ready")
      ? "In Progress"
      : (entry?.status ?? effectiveStatus(item, byId, runtimeById));
  };
  const issueNumberOf = (item: SelectableWorkItem): number | undefined =>
    runtimeById.get(item.id)?.externalIssueNumber ??
    ("issueNumber" in item ? item.issueNumber : undefined);

  const readyCheckpoints: RoadmapReadyCheckpoint[] = [];
  for (const cp of checkpoints) {
    if (passedCheckpointIds.has(cp.id)) continue;
    const allDependenciesDone = cp.dependsOnWorkItemIds.every((depId) => {
      const dep = byId.get(depId);
      return dep !== undefined && statusOf(dep) === "Done";
    });
    if (allDependenciesDone) {
      readyCheckpoints.push({ checkpoint: cp, allDependenciesDone: true });
    }
  }

  const maxRiskRank =
    options.maxRisk === undefined || options.maxRisk === "all"
      ? RISK_RANK.critical
      : RISK_RANK[options.maxRisk];
  const selected: SelectableWorkItem[] = [];
  const skipped: RoadmapSkippedWorkItem[] = [];

  for (const item of workItems) {
    const status = statusOf(item);
    const issueNumber = issueNumberOf(item);
    if (status !== "Ready") {
      pushSkipped(skipped, { id: item.id, issueNumber }, `status is ${status}`);
      continue;
    }
    if (options.requireIssueNumber && issueNumber === undefined) {
      pushSkipped(skipped, { id: item.id, issueNumber }, "missing published GitHub issueNumber");
      continue;
    }
    const incompleteDeps = item.blockedBy.filter((depId) => {
      const dep = byId.get(depId);
      return !dep || statusOf(dep) !== "Done";
    });
    if (incompleteDeps.length > 0) {
      pushSkipped(
        skipped,
        { id: item.id, issueNumber },
        `blocked by incomplete dependencies: ${incompleteDeps.join(", ")}`,
      );
      continue;
    }

    const blockingCheckpoint = findBlockingWaveCheckpoint(
      item.wave ?? 1,
      checkpoints,
      passedCheckpointIds,
    );
    if (blockingCheckpoint) {
      pushSkipped(
        skipped,
        { id: item.id, issueNumber },
        `blocked by pending verification checkpoint: ${blockingCheckpoint.id}`,
      );
      continue;
    }

    if (RISK_RANK[item.risk] > maxRiskRank) {
      pushSkipped(
        skipped,
        { id: item.id, issueNumber },
        `risk ${item.risk} exceeds maxRisk=${options.maxRisk}`,
      );
      continue;
    }
    selected.push(item);
  }

  selected.sort((left, right) => {
    const waveDiff = (left.wave ?? 1) - (right.wave ?? 1);
    if (waveDiff !== 0) return waveDiff;
    const prioDiff = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    if (prioDiff !== 0) return prioDiff;
    const leftNum = issueNumberOf(left) ?? Number.MAX_SAFE_INTEGER;
    const rightNum = issueNumberOf(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftNum !== rightNum) return leftNum - rightNum;
    return left.id.localeCompare(right.id);
  });

  const limited =
    options.limit !== undefined && options.limit >= 0 ? selected.slice(0, options.limit) : selected;
  if (options.limit !== undefined && selected.length > limited.length) {
    for (const item of selected.slice(limited.length)) {
      pushSkipped(skipped, { id: item.id, issueNumber: issueNumberOf(item) }, "limit reached");
    }
  }

  const workspaceOptions = {
    ...(options.baseBranch !== undefined ? { baseBranch: options.baseBranch } : {}),
    ...(options.worktreeRoot !== undefined ? { worktreeRoot: options.worktreeRoot } : {}),
  };

  const eligible: RoadmapEligibleWorkItem[] = limited.map((item) => {
    const issueNumber = issueNumberOf(item);
    return {
      workItem: item,
      issueRef: issueNumber !== undefined ? `#${issueNumber}` : `local:${item.id}`,
      workspace: buildWorkItemBranchAndWorktree(
        { id: item.id, title: item.title, ...(issueNumber !== undefined ? { issueNumber } : {}) },
        workspaceOptions,
      ),
      featureStatusAfterStart: computeFeatureStatusAfterStart(workItems, item, runtimeById),
    };
  });

  return { eligible, skipped, readyCheckpoints };
}

export interface LocalWorkItemRunSeed {
  workItem: RoadmapWorkItem;
  feature: RoadmapFeature;
  issueRef: string;
  workspace: WorkItemWorkspaceSpec;
  featureStatusAfterStart: "Backlog" | "In Progress" | "Done";
  intakeSeed: {
    objective: string;
    scopeIn: string[];
    scopeOut: string[];
    acceptanceCriteria: string[];
    linkedRuleIds: string[];
    risk: RiskLevel;
    priority: RoadmapPriority;
    wave: number;
  };
}

/**
 * Prepares a single local `Ready` Work Item for autonomous execution without
 * requiring a GitHub issue, returning its `local:<id>` gate `issueRef`, isolated
 * workspace spec, and INTAKE seed.
 */
export function prepareLocalWorkItemRun(
  rawState: RoadmapState | PublishedRoadmap,
  workItemId: string,
  options: {
    baseBranch?: string;
    worktreeRoot?: string;
    maxRisk?: "low" | "medium" | "all";
    runtimeState?: RoadmapRuntimeState;
  } = {},
): LocalWorkItemRunSeed {
  const state =
    "contentDigest" in rawState
      ? validatePublishedRoadmap(rawState)
      : validateRoadmapState(rawState);
  const selection = selectReadyWorkItems(state, {
    maxRisk: options.maxRisk ?? "medium",
    ...options,
    requireIssueNumber: false,
  });
  const match = selection.eligible.find((entry) => entry.workItem.id === workItemId);
  if (!match) {
    const skipped = selection.skipped.find((entry) => entry.id === workItemId);
    const reason = skipped ? skipped.reason : `Work item "${workItemId}" not found in roadmap.`;
    throw new RoadmapError(
      "roadmap_invalid",
      `Cannot run local work item "${workItemId}": ${reason}`,
    );
  }
  const feature = state.features.find((item) => item.id === match.workItem.featureId)!;
  return {
    workItem: match.workItem,
    feature,
    issueRef: match.issueRef,
    workspace: match.workspace,
    featureStatusAfterStart: match.featureStatusAfterStart,
    intakeSeed: {
      objective: match.workItem.objective,
      scopeIn: match.workItem.scopeIn,
      scopeOut: match.workItem.scopeOut,
      acceptanceCriteria: match.workItem.acceptanceCriteria,
      linkedRuleIds: match.workItem.linkedRuleIds ?? [],
      risk: match.workItem.risk,
      priority: match.workItem.priority,
      wave: match.workItem.wave ?? 1,
    },
  };
}

/**
 * Plans a bounded local `run-roadmap` execution loop over unblocked `Ready`
 * items without requiring GitHub issue numbers or remote calls.
 */
export function planLocalRoadmapRun(
  rawState: RoadmapState,
  options: Omit<RoadmapSelectOptions, "requireIssueNumber"> = {},
): RoadmapSelectResult {
  const state = validateRoadmapState(rawState);
  return selectReadyWorkItems(state, {
    ...options,
    maxRisk: options.maxRisk ?? "medium",
    requireIssueNumber: false,
  });
}

/**
 * Resolves the effective roadmap mode (`local` or `github`) from explicit
 * configuration or repository remote URL.
 */
export function resolveRoadmapMode(
  options: { configuredMode?: "local" | "github"; remoteUrl?: string } = {},
): "local" | "github" {
  if (options.configuredMode) return options.configuredMode;
  if (options.remoteUrl && /github\.com[:/]/i.test(options.remoteUrl)) return "github";
  return "local";
}

/**
 * Selects enriched ready Work Items and Verification Checkpoints from a roadmap state.
 */
export function selectReadyWorkItems(
  input:
    | readonly RoadmapWorkItem[]
    | Pick<RoadmapState, "workItems" | "verificationCheckpoints">
    | Pick<PublishedRoadmap, "workItems" | "verificationCheckpoints">,
  options: RoadmapSelectOptions = {},
): RoadmapSelectResult {
  return selectEligibleWorkItems(input, options);
}

/**
 * Atomic, symlink-safe persistence store for roadmap ideation sessions under
 * `.forgix/roadmap/session.yaml`.
 */
export class RoadmapStore {
  readonly workspaceRoot: string;
  readonly statePath: string;
  readonly sessionPath: string;
  readonly #store: WorkspaceStore;

  constructor(workspaceRoot: string, options: RoadmapStoreOptions = {}) {
    this.#store = initWorkspaceStore(workspaceRoot, options);
    this.workspaceRoot = this.#store.workspaceRoot;
    this.sessionPath = this.#store.resolvePath(ROADMAP_SESSION_PATH);
    this.statePath = this.sessionPath;
  }

  isGitignored(): boolean {
    return checkGitignored(this.#store);
  }

  async exists(): Promise<boolean> {
    return checkStoreExists(this.#store, ROADMAP_SESSION_PATH);
  }

  async load(): Promise<RoadmapState> {
    const parsed = await readYamlStore(this.#store, ROADMAP_SESSION_PATH, "roadmap session");
    return validateRoadmapState(parsed);
  }

  async save(rawState: unknown): Promise<RoadmapState> {
    const validated = validateRoadmapState(rawState);
    await writeYamlStore(this.#store, ROADMAP_SESSION_PATH, validated);
    return validated;
  }

  async clear(): Promise<boolean> {
    return removeStoreFile(this.#store, ROADMAP_SESSION_PATH);
  }
}

export function createRoadmapStore(
  workspaceRoot: string,
  options: RoadmapStoreOptions = {},
): RoadmapStore {
  return new RoadmapStore(workspaceRoot, options);
}

/**
 * Atomic, symlink-safe persistence store for the canonical published roadmap
 * at `.forgix/roadmap.yaml`.
 */
export class PublishedRoadmapStore {
  readonly workspaceRoot: string;
  readonly roadmapPath: string;
  readonly #store: WorkspaceStore;

  constructor(workspaceRoot: string, options: RoadmapStoreOptions = {}) {
    this.#store = initWorkspaceStore(workspaceRoot, options);
    this.workspaceRoot = this.#store.workspaceRoot;
    this.roadmapPath = this.#store.resolvePath(ROADMAP_CANONICAL_PATH);
  }

  async exists(): Promise<boolean> {
    return checkStoreExists(this.#store, ROADMAP_CANONICAL_PATH);
  }

  async load(): Promise<PublishedRoadmap> {
    const parsed = await readYamlStore(this.#store, ROADMAP_CANONICAL_PATH, "published roadmap");
    return validatePublishedRoadmap(parsed);
  }

  async save(rawRoadmap: unknown): Promise<PublishedRoadmap> {
    const validated = validatePublishedRoadmap(rawRoadmap);
    await writeYamlStore(this.#store, ROADMAP_CANONICAL_PATH, validated);
    return validated;
  }

  async clear(): Promise<boolean> {
    return removeStoreFile(this.#store, ROADMAP_CANONICAL_PATH);
  }
}

export function createPublishedRoadmapStore(
  workspaceRoot: string,
  options: RoadmapStoreOptions = {},
): PublishedRoadmapStore {
  return new PublishedRoadmapStore(workspaceRoot, options);
}

/**
 * Atomic, symlink-safe persistence store for gitignored runtime execution state
 * under `.forgix/roadmap/runtime.yaml`.
 */
export class RoadmapRuntimeStore {
  readonly workspaceRoot: string;
  readonly runtimePath: string;
  readonly #store: WorkspaceStore;

  constructor(workspaceRoot: string, options: RoadmapStoreOptions = {}) {
    this.#store = initWorkspaceStore(workspaceRoot, options);
    this.workspaceRoot = this.#store.workspaceRoot;
    this.runtimePath = this.#store.resolvePath(ROADMAP_RUNTIME_PATH);
  }

  isGitignored(): boolean {
    return checkGitignored(this.#store);
  }

  async exists(): Promise<boolean> {
    return checkStoreExists(this.#store, ROADMAP_RUNTIME_PATH);
  }

  async load(): Promise<RoadmapRuntimeState> {
    const parsed = await readYamlStore(this.#store, ROADMAP_RUNTIME_PATH, "roadmap runtime");
    return validateRoadmapRuntimeState(parsed);
  }

  withLock<T>(action: () => Promise<T>): Promise<T> {
    return this.#store.withWriteLock(`${ROADMAP_RUNTIME_PATH}.lock.sqlite`, action);
  }

  async assertPreservesReservations(next: RoadmapRuntimeState): Promise<void> {
    if ((await this.exists()) && !retainsActiveReservations(await this.load(), next)) {
      throw new RoadmapError(
        "roadmap_invalid",
        "Active Roadmap reservations must be reconciled before replacing their coordinates or revision.",
      );
    }
  }

  async save(rawRuntime: unknown): Promise<RoadmapRuntimeState> {
    const validated = validateRoadmapRuntimeState(rawRuntime);
    await this.assertPreservesReservations(validated);
    await writeYamlStore(this.#store, ROADMAP_RUNTIME_PATH, validated);
    return validated;
  }

  async clear(): Promise<boolean> {
    return removeStoreFile(this.#store, ROADMAP_RUNTIME_PATH);
  }
}

export function createRoadmapRuntimeStore(
  workspaceRoot: string,
  options: RoadmapStoreOptions = {},
): RoadmapRuntimeStore {
  return new RoadmapRuntimeStore(workspaceRoot, options);
}

export type RoadmapSchemaKind = Extract<
  SchemaName,
  "roadmap-state" | "roadmap" | "roadmap-runtime"
>;

function initWorkspaceStore(workspaceRoot: string, options: RoadmapStoreOptions): WorkspaceStore {
  try {
    return createWorkspaceStore(workspaceRoot, options);
  } catch {
    throw new RoadmapError("roadmap_path_invalid", "Workspace root must be an existing directory.");
  }
}

function checkGitignored(store: WorkspaceStore): boolean {
  try {
    return store.isGitignoredSync(ROADMAP_IGNORE_ENTRY);
  } catch (error) {
    if (error instanceof StateStoreError && error.code === "state_path_invalid") {
      throw new RoadmapError("roadmap_path_invalid", error.message);
    }
    return false;
  }
}

async function checkStoreExists(store: WorkspaceStore, relativePath: string): Promise<boolean> {
  try {
    return (await store.readText(relativePath, true)) !== undefined;
  } catch {
    return false;
  }
}

async function readYamlStore(
  store: WorkspaceStore,
  relativePath: string,
  label: string,
): Promise<unknown> {
  let raw: string | undefined;
  try {
    raw = await store.readText(relativePath, false);
  } catch (error) {
    if (error instanceof StateStoreError) {
      if (error.code === "state_not_found") {
        throw new RoadmapError("roadmap_not_found", `No ${label} found at ${relativePath}.`);
      }
      if (error.code === "state_path_invalid") {
        throw new RoadmapError("roadmap_path_invalid", error.message);
      }
    }
    throw new RoadmapError("roadmap_invalid", `Unable to read ${relativePath}.`);
  }
  if (raw === undefined) {
    throw new RoadmapError("roadmap_not_found", `No ${label} found at ${relativePath}.`);
  }

  try {
    return parse(raw);
  } catch (error) {
    throw new RoadmapError(
      "roadmap_invalid",
      `Roadmap YAML is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function writeYamlStore(
  store: WorkspaceStore,
  relativePath: string,
  value: unknown,
): Promise<void> {
  const canonical = JSON.parse(canonicalJson(value)) as unknown;
  const serialized = `${stringify(canonical)}\n`;
  try {
    await store.writeTextAtomically(relativePath, serialized);
  } catch (error) {
    if (error instanceof StateStoreError && error.code === "state_path_invalid") {
      throw new RoadmapError("roadmap_path_invalid", error.message);
    }
    throw new RoadmapError(
      "roadmap_write_failed",
      `Failed to write ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function removeStoreFile(store: WorkspaceStore, relativePath: string): Promise<boolean> {
  try {
    return await store.removeFile(relativePath);
  } catch (error) {
    if (error instanceof StateStoreError && error.code === "state_path_invalid") {
      throw new RoadmapError("roadmap_path_invalid", error.message);
    }
    throw new RoadmapError("roadmap_write_failed", `Failed to remove ${relativePath}.`);
  }
}

function validateGraphEntities(input: {
  features: readonly Pick<RoadmapFeature, "id">[];
  workItems: readonly SelectableWorkItem[];
  sharedContracts: readonly RoadmapSharedContract[];
  verificationCheckpoints: readonly SelectableCheckpoint[];
}): {
  featureIds: Set<string>;
  workItemIds: Set<string>;
  contractIds: Set<string>;
  contractsById: Map<string, RoadmapSharedContract>;
  providerByContract: Map<string, SelectableWorkItem>;
} {
  const contractIds = assertUniqueIds(input.sharedContracts, "sharedContract");
  const featureIds = assertUniqueIds(input.features, "feature");
  const workItemIds = assertUniqueIds(input.workItems, "workItem");
  assertUniqueIds(input.verificationCheckpoints, "verificationCheckpoint");

  const contractsById = new Map(input.sharedContracts.map((contract) => [contract.id, contract]));
  const providerByContract = new Map<string, SelectableWorkItem>();

  for (const item of input.workItems) {
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
    for (const contractId of item.providesContractIds ?? []) {
      if (!contractIds.has(contractId)) {
        throw new RoadmapError(
          "roadmap_invalid",
          `Work item "${item.id}" provides unknown shared contract "${contractId}".`,
        );
      }
      const existingProvider = providerByContract.get(contractId);
      if (existingProvider) {
        throw new RoadmapError(
          "roadmap_invalid",
          `Shared contract "${contractId}" is provided by multiple work items ("${existingProvider.id}" and "${item.id}").`,
        );
      }
      providerByContract.set(contractId, item);
    }
    for (const contractId of item.consumesContractIds ?? []) {
      if (!contractIds.has(contractId)) {
        throw new RoadmapError(
          "roadmap_invalid",
          `Work item "${item.id}" consumes unknown shared contract "${contractId}".`,
        );
      }
    }
  }

  const cycles = detectDependencyCycles(input.workItems);
  if (cycles.length > 0) {
    throw new RoadmapError(
      "roadmap_cycle_detected",
      `Dependency cycle detected: ${cycles.map((cycle) => cycle.join(" -> ")).join("; ")}.`,
    );
  }

  for (const cp of input.verificationCheckpoints) {
    for (const dep of cp.dependsOnWorkItemIds) {
      if (!workItemIds.has(dep)) {
        throw new RoadmapError(
          "roadmap_invalid",
          `Verification checkpoint "${cp.id}" references unknown work item "${dep}".`,
        );
      }
    }
    if (cp.scopeType === "feature") {
      for (const targetId of cp.targetIds) {
        if (!featureIds.has(targetId)) {
          throw new RoadmapError(
            "roadmap_invalid",
            `Verification checkpoint "${cp.id}" references unknown feature "${targetId}".`,
          );
        }
      }
    }
  }

  return { featureIds, workItemIds, contractIds, contractsById, providerByContract };
}

function validateExecutionReadiness(input: {
  phaseLabel: string;
  features: readonly Pick<RoadmapFeature, "id" | "scopeIn">[];
  workItems: readonly SelectableWorkItem[];
  contractsById: ReadonlyMap<string, RoadmapSharedContract>;
  providerByContract: ReadonlyMap<string, SelectableWorkItem>;
}): void {
  if (input.features.length === 0) {
    throw new RoadmapError(
      "roadmap_invalid",
      `Phase "${input.phaseLabel}" requires at least one Feature.`,
    );
  }
  if (input.workItems.length === 0) {
    throw new RoadmapError(
      "roadmap_invalid",
      `Phase "${input.phaseLabel}" requires at least one Work Item.`,
    );
  }
  for (const feature of input.features) {
    if (feature.scopeIn.length === 0) {
      throw new RoadmapError(
        "roadmap_invalid",
        `Feature "${feature.id}" requires non-empty scopeIn before "${input.phaseLabel}".`,
      );
    }
  }

  const ancestors = computeTransitiveAncestors(input.workItems);
  for (const item of input.workItems) {
    if (item.scopeIn.length === 0 || item.acceptanceCriteria.length === 0) {
      throw new RoadmapError(
        "roadmap_invalid",
        `Work item "${item.id}" requires scopeIn and acceptanceCriteria before "${input.phaseLabel}".`,
      );
    }
    for (const contractId of item.consumesContractIds ?? []) {
      const contract = input.contractsById.get(contractId);
      if (!contract) {
        throw new RoadmapError(
          "roadmap_invalid",
          `Work item "${item.id}" consumes unknown shared contract "${contractId}".`,
        );
      }
      if (contract.status === "existing") continue;

      const provider = input.providerByContract.get(contractId);
      if (!provider) {
        throw new RoadmapError(
          "roadmap_invalid",
          `Consumed shared contract "${contractId}" on work item "${item.id}" has no provider and is not status="existing".`,
        );
      }
      if (provider.id === item.id || !ancestors.get(item.id)?.has(provider.id)) {
        throw new RoadmapError(
          "roadmap_invalid",
          `Work item "${item.id}" consumes contract "${contractId}" without depending on provider "${provider.id}" via blockedBy.`,
        );
      }
      if ((item.wave ?? 1) < (provider.wave ?? 1)) {
        throw new RoadmapError(
          "roadmap_invalid",
          `Work item "${item.id}" (wave ${item.wave ?? 1}) cannot consume contract "${contractId}" from later-wave provider "${provider.id}" (wave ${provider.wave ?? 1}).`,
        );
      }
    }
  }
}

function validatePassedAudit(
  audit: RoadmapPlanAudit,
  expectedDigest: string | undefined,
  contextLabel: string,
): void {
  if (!audit.passed) {
    throw new RoadmapError("roadmap_invalid", `${contextLabel} requires audit.passed === true.`);
  }
  if (expectedDigest !== undefined && audit.candidateDigest !== expectedDigest) {
    throw new RoadmapError(
      "roadmap_state_conflict",
      `Audit candidateDigest (${audit.candidateDigest}) does not match current candidate digest (${expectedDigest}).`,
    );
  }
  const openBlocking = audit.findings.filter(
    (finding) => finding.severity === "blocking" && finding.status === "open",
  );
  if (openBlocking.length > 0) {
    throw new RoadmapError(
      "roadmap_invalid",
      `${contextLabel} has ${openBlocking.length} open blocking audit finding(s): ${openBlocking.map((f) => f.id).join(", ")}.`,
    );
  }
}

function computeTransitiveAncestors(
  workItems: readonly Pick<RoadmapWorkItem, "id" | "blockedBy">[],
): Map<string, Set<string>> {
  const byId = new Map(workItems.map((item) => [item.id, item]));
  const memo = new Map<string, Set<string>>();

  const collect = (id: string, visiting: Set<string>): Set<string> => {
    const cached = memo.get(id);
    if (cached) return cached;
    const result = new Set<string>();
    const item = byId.get(id);
    if (item && !visiting.has(id)) {
      visiting.add(id);
      for (const dep of item.blockedBy) {
        result.add(dep);
        for (const ancestor of collect(dep, visiting)) {
          result.add(ancestor);
        }
      }
      visiting.delete(id);
    }
    memo.set(id, result);
    return result;
  };

  for (const item of workItems) {
    collect(item.id, new Set<string>());
  }
  return memo;
}

function findBlockingWaveCheckpoint(
  itemWave: number,
  checkpoints: readonly SelectableCheckpoint[],
  passedCheckpointIds: ReadonlySet<string>,
): SelectableCheckpoint | undefined {
  if (itemWave <= 1) return undefined;
  for (const cp of checkpoints) {
    if (cp.scopeType !== "wave" || passedCheckpointIds.has(cp.id)) continue;
    for (const target of cp.targetIds) {
      const match = /^(?:wave[-_]?)?(\d+)$/i.exec(target.trim());
      if (match && Number(match[1]) < itemWave) {
        return cp;
      }
    }
  }
  return undefined;
}

function assertRoadmapHygiene(value: unknown): void {
  try {
    assertCleanHygiene(value);
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
  item: SelectableWorkItem,
  byId: ReadonlyMap<string, SelectableWorkItem>,
  runtimeById?: ReadonlyMap<string, RoadmapWorkItemRuntimeState>,
): RoadmapBoardStatus {
  if ("initialStatus" in item && item.initialStatus) return item.initialStatus;
  const wave = item.wave ?? 1;
  if (wave > 1) return "Backlog";
  const allDepsDone = item.blockedBy.every((depId) => {
    const rtStatus = runtimeById?.get(depId)?.status;
    if (rtStatus !== undefined) return rtStatus === "Done";
    const dep = byId.get(depId);
    if (!dep) return false;
    const depStatus = "status" in dep ? dep.status : undefined;
    const depInitial = "initialStatus" in dep ? dep.initialStatus : undefined;
    return (depStatus ?? depInitial) === "Done";
  });
  return allDepsDone ? "Ready" : "Backlog";
}

function effectiveStatus(
  item: SelectableWorkItem,
  byId?: ReadonlyMap<string, SelectableWorkItem>,
  runtimeById?: ReadonlyMap<string, RoadmapWorkItemRuntimeState>,
): RoadmapBoardStatus {
  const rtStatus = runtimeById?.get(item.id)?.status;
  if (rtStatus) return rtStatus;
  if ("status" in item && item.status) return item.status;
  if ("initialStatus" in item && item.initialStatus) return item.initialStatus;
  return byId ? defaultInitialStatus(item, byId, runtimeById) : "Backlog";
}

function topologicalWorkItems<T extends SelectableWorkItem>(workItems: readonly T[]): T[] {
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
  const ordered: T[] = [];

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

function renderTreeSummary(
  state: Pick<RoadmapState, "features" | "workItems"> & {
    sessionId?: string;
    roadmapId?: string;
  },
): string {
  const byId = new Map(state.workItems.map((item) => [item.id, item]));
  const waves = new Map<number, (RoadmapFeature | PublishedFeature)[]>();
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

  const labelId = state.sessionId ?? state.roadmapId ?? "roadmap";
  const lines = [`Roadmap (${labelId}) [format=tree]`];
  for (const [wave, features] of [...waves.entries()].toSorted((a, b) => a[0] - b[0])) {
    lines.push(`Wave ${wave}`);
    features.forEach((feature, fIdx) => {
      const fLast = fIdx === features.length - 1;
      const fPrefix = fLast ? "└── " : "├── ";
      const fChildPad = fLast ? "    " : "│   ";
      const fIssue =
        "issueNumber" in feature && feature.issueNumber ? ` (#${feature.issueNumber})` : "";
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
        const issue = "issueNumber" in item && item.issueNumber ? ` (#${item.issueNumber})` : "";
        lines.push(
          `${fChildPad}${iPrefix}${item.id}: ${item.title}${issue} [${item.priority}, risk=${item.risk}, status=${status}]${deps}`,
        );
      });
    });
  }
  return lines.join("\n");
}

function renderMermaidSummary(state: Pick<RoadmapState, "features" | "workItems">): string {
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
  item: { id: string; issueNumber: number | undefined },
  reason: string,
): void {
  skipped.push({
    id: item.id,
    ...(item.issueNumber !== undefined ? { issueNumber: item.issueNumber } : {}),
    reason,
  });
}

function computeFeatureStatusAfterStart(
  workItems: readonly SelectableWorkItem[],
  targetItem: SelectableWorkItem,
  runtimeById?: ReadonlyMap<string, RoadmapWorkItemRuntimeState>,
): "Backlog" | "In Progress" | "Done" {
  const siblings: Array<{
    status?: RoadmapBoardStatus | undefined;
    initialStatus?: RoadmapBoardStatus | undefined;
  }> = [];
  for (const candidate of workItems) {
    if (candidate.featureId !== targetItem.featureId) continue;
    if (candidate.id === targetItem.id) {
      siblings.push({ status: "In Progress" });
    } else {
      const rtStatus = runtimeById?.get(candidate.id)?.status;
      const status = rtStatus ?? ("status" in candidate ? candidate.status : undefined);
      const initialStatus = "initialStatus" in candidate ? candidate.initialStatus : undefined;
      siblings.push({ status, initialStatus });
    }
  }
  return deriveFeatureStatus(siblings);
}
