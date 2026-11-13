import { createHash, randomUUID } from "node:crypto";
import { constants, lstatSync, readFileSync, realpathSync, type Stats } from "node:fs";
import * as nodeFs from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { parse, stringify } from "yaml";
import { validateSchema } from "./config.js";
import { EXIT_CODES, type ExitCode } from "./exit-codes.js";
import type { RiskLevel } from "./types.js";

export const ROADMAP_STATE_PATH = ".codex/roadmap/state.yaml";
export const ROADMAP_IGNORE_ENTRY = ".codex/roadmap/";
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
}

export interface RoadmapSkippedWorkItem {
  id: string;
  issueNumber?: number;
  reason: string;
}

export interface RoadmapSelectResult {
  eligible: RoadmapWorkItem[];
  skipped: RoadmapSkippedWorkItem[];
}

export interface RoadmapStoreFileSystem {
  readFile(path: string): Promise<Buffer>;
  mkdir(path: string, options: { recursive?: boolean; mode?: number }): Promise<unknown>;
  writeFile(
    path: string,
    data: string | Buffer,
    options: { flag: "wx"; mode: number },
  ): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  lstat(path: string): Promise<Stats>;
  realpath(path: string): Promise<string>;
  unlink(path: string): Promise<void>;
}

export interface RoadmapStoreOptions {
  fileSystem?: Partial<RoadmapStoreFileSystem>;
  temporaryId?: () => string;
}

const DEFAULT_FILE_SYSTEM: RoadmapStoreFileSystem = {
  readFile: async (path) => {
    const handle = await nodeFs.open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile()) throw Object.assign(new Error("not regular"), { code: "EINVAL" });
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  },
  mkdir: (path, options) => nodeFs.mkdir(path, options),
  writeFile: (path, data, options) => nodeFs.writeFile(path, data, options),
  rename: (from, to) => nodeFs.rename(from, to),
  lstat: (path) => nodeFs.lstat(path),
  realpath: (path) => nodeFs.realpath(path),
  unlink: (path) => nodeFs.unlink(path),
};

const SECRET_PATTERNS: readonly RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
];

const LOCAL_PATH_PATTERNS: readonly RegExp[] = [
  /\/Users\/[^\s"'`]+/,
  /\/home\/[^\s"'`]+/,
  /[A-Za-z]:\\Users\\[^\s"'`]+/,
];

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

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .toSorted(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => [key, canonicalize(entry)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

function sha256Digest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;
}

function scanTextHygiene(value: unknown, pathLabel: string): void {
  if (typeof value === "string") {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(value)) {
        throw new RoadmapError(
          "roadmap_secret_detected",
          `Secret-like token rejected at ${pathLabel}.`,
        );
      }
    }
    for (const pattern of LOCAL_PATH_PATTERNS) {
      if (pattern.test(value)) {
        throw new RoadmapError(
          "roadmap_path_invalid",
          `Machine-local absolute path rejected at ${pathLabel}.`,
        );
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanTextHygiene(item, `${pathLabel}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      scanTextHygiene(entry, `${pathLabel}.${key}`);
    }
  }
}

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
  return sha256Digest(payload);
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
  scanTextHygiene(state, "roadmap");

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
    const left = byId.get(leftId)!;
    const right = byId.get(rightId)!;
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
    const currentId = queue.shift()!;
    ordered.push(byId.get(currentId)!);
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

/**
 * Renders Step 3 visual synthesis in ASCII `tree` or Mermaid `flowchart TD` DAG format.
 */
export function renderRoadmapVisualSummary(
  state: RoadmapState,
  format: RoadmapVisualFormat = state.visualFormat,
): string {
  return format === "mermaid" ? renderMermaidSummary(state) : renderTreeSummary(state);
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
    next.projectBinding = {
      owner: patch.projectBinding.owner ?? next.projectBinding?.owner ?? "",
      ...next.projectBinding,
      ...patch.projectBinding,
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

function slugifySegment(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return slug || "work-item";
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

/**
 * Selects eligible `Ready` Work Items whose `blockedBy` dependencies are all `Done`
 * (`In Review` still blocks downstream Work Items), sorted deterministically.
 */
export function selectEligibleWorkItems(
  workItems: readonly RoadmapWorkItem[],
  options: RoadmapSelectOptions = {},
): RoadmapSelectResult {
  const byId = new Map(workItems.map((item) => [item.id, item]));
  const maxRiskRank =
    options.maxRisk === undefined || options.maxRisk === "all"
      ? RISK_RANK.critical
      : RISK_RANK[options.maxRisk];
  const eligible: RoadmapWorkItem[] = [];
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
    eligible.push(item);
  }

  eligible.sort((left, right) => {
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
    options.limit !== undefined && options.limit >= 0 ? eligible.slice(0, options.limit) : eligible;
  if (options.limit !== undefined && eligible.length > limited.length) {
    for (const item of eligible.slice(limited.length)) {
      pushSkipped(skipped, item, "limit reached");
    }
  }

  return { eligible: limited, skipped };
}

function assertInsideWorkspace(workspaceRoot: string, candidate: string): void {
  const rel = relative(workspaceRoot, candidate);
  if (!rel || rel.startsWith("..") || rel === "." || rel.startsWith(sep)) {
    throw new RoadmapError("roadmap_path_invalid", "Roadmap path escapes workspace root.");
  }
}

async function assertNoSymlinkSegments(
  fsApi: RoadmapStoreFileSystem,
  workspaceRoot: string,
  targetPath: string,
): Promise<void> {
  const rel = relative(workspaceRoot, targetPath);
  const parts = rel.split(sep).filter(Boolean);
  const segments: Array<{ part: string; cursor: string }> = [];
  let cursor = workspaceRoot;
  for (const part of parts) {
    cursor = resolve(cursor, part);
    segments.push({ part, cursor });
  }
  await Promise.all(
    segments.map(async (segment) => {
      try {
        const stat = await fsApi.lstat(segment.cursor);
        if (stat.isSymbolicLink()) {
          throw new RoadmapError(
            "roadmap_path_invalid",
            `Symlink segment rejected in roadmap path: ${segment.part}.`,
          );
        }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException)?.code;
        if (code === "ENOENT") return;
        if (error instanceof RoadmapError) throw error;
        throw new RoadmapError(
          "roadmap_path_invalid",
          `Cannot inspect roadmap path: ${segment.part}.`,
        );
      }
    }),
  );
}

export class RoadmapStore {
  readonly workspaceRoot: string;
  readonly statePath: string;
  readonly #fs: RoadmapStoreFileSystem;
  readonly #temporaryId: () => string;

  constructor(workspaceRoot: string, options: RoadmapStoreOptions = {}) {
    if (!workspaceRoot || workspaceRoot.includes("\u0000")) {
      throw new RoadmapError("roadmap_path_invalid", "Workspace root is invalid.");
    }
    try {
      this.workspaceRoot = realpathSync(resolve(workspaceRoot));
      if (!lstatSync(this.workspaceRoot).isDirectory()) throw new Error("not directory");
    } catch {
      throw new RoadmapError(
        "roadmap_path_invalid",
        "Workspace root must be an existing directory.",
      );
    }
    this.statePath = resolve(this.workspaceRoot, ROADMAP_STATE_PATH);
    assertInsideWorkspace(this.workspaceRoot, this.statePath);
    this.#fs = { ...DEFAULT_FILE_SYSTEM, ...options.fileSystem };
    this.#temporaryId = options.temporaryId ?? randomUUID;
  }

  isGitignored(): boolean {
    try {
      const gitignore = readFileSync(resolve(this.workspaceRoot, ".gitignore"), "utf8");
      return gitignore
        .split(/\r?\n/)
        .map((line) => line.trim())
        .some(
          (line) =>
            line === ".codex/roadmap/" ||
            line === ".codex/roadmap" ||
            line === "/.codex/roadmap/" ||
            line === ".codex/",
        );
    } catch {
      return false;
    }
  }

  async exists(): Promise<boolean> {
    try {
      await assertNoSymlinkSegments(this.#fs, this.workspaceRoot, this.statePath);
      const stat = await this.#fs.lstat(this.statePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  async load(): Promise<RoadmapState> {
    await assertNoSymlinkSegments(this.#fs, this.workspaceRoot, this.statePath);
    let rawBuffer: Buffer;
    try {
      rawBuffer = await this.#fs.readFile(this.statePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        throw new RoadmapError(
          "roadmap_not_found",
          `No active roadmap draft found at ${ROADMAP_STATE_PATH}.`,
        );
      }
      throw new RoadmapError("roadmap_invalid", `Unable to read ${ROADMAP_STATE_PATH}.`);
    }

    let parsed: unknown;
    try {
      parsed = parse(rawBuffer.toString("utf8"));
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
    const dir = dirname(this.statePath);
    await assertNoSymlinkSegments(this.#fs, this.workspaceRoot, this.statePath);
    await this.#fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await assertNoSymlinkSegments(this.#fs, this.workspaceRoot, this.statePath);

    const realDir = await this.#fs.realpath(dir);
    assertInsideWorkspace(this.workspaceRoot, realDir);

    const serialized = `${stringify(validated)}\n`;
    const tempPath = resolve(dir, `.state.${this.#temporaryId()}.tmp`);
    try {
      await this.#fs.writeFile(tempPath, serialized, { flag: "wx", mode: 0o600 });
      await this.#fs.rename(tempPath, this.statePath);
      return validated;
    } catch (error) {
      try {
        await this.#fs.unlink(tempPath);
      } catch {
        // Ignore cleanup failure when temp file was not created.
      }
      throw new RoadmapError(
        "roadmap_write_failed",
        `Failed to write ${ROADMAP_STATE_PATH}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async clear(): Promise<boolean> {
    await assertNoSymlinkSegments(this.#fs, this.workspaceRoot, this.statePath);
    try {
      await this.#fs.unlink(this.statePath);
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") return false;
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
