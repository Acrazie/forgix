import {
  buildV2AssureCompletionPair,
  classifyAssureCompletion,
  completionProofSnapshot,
  computeAssuranceReceiptDigest,
  observeExternalArtifacts,
  observeWorktreeSnapshot,
} from "../core/assure-completion.js";
import {
  BUILD_AUTHORIZATION_RECEIPT_VERSION,
  canonicalContractDigest,
  gateDecisionDigest,
  requireBuildAuthorization,
  resolveGitWorktree,
} from "../core/build-authorization.js";
import { GATE_ISSUE_REF } from "../core/autonomous-gate.js";
import {
  assertCleanHygiene,
  canonicalize,
  sha256Hex,
  sha256Prefixed,
  validateDependencyGraph,
} from "../core/digest.js";
import { EXIT_CODES, StateStoreError, validateSchema } from "../core/schema.js";
import {
  type WorkspaceStore,
  type WorkspaceStoreOptions,
  createWorkspaceStore,
} from "../core/store.js";
import {
  EXECUTABLE_VERIFIER_KINDS,
  type ActiveDesignQuestion,
  type AssuranceEvidenceRecord,
  type AssuranceState,
  type CanonicalChangeContract,
  type DependencyGraph,
  type DesignState,
  type DurableHistoryEvent,
  type GateDecisionRecord,
  type HarnessPreference,
  type MacroPhase,
  type PlanApprovalReceipt,
  type ProductBaseline,
  type ShapeState,
  type StateHistoryEvent,
  type TaskState,
  type TaskStatus,
} from "../types.js";
import {
  evaluateTaskAutonomousGateEligibility,
  isEvidenceFresh,
  preflightGate,
  resolveObjective,
  type GatePreflightResult,
} from "./gate-preflight.js";
import { updateContractReview } from "./contract-review-actions.js";
import {
  checkContractReviewSources,
  contractReviewView,
  isSupportedReviewHarness,
} from "./contract-review.js";
import { deriveMacroPhase } from "./lifecycle-phase.js";
import {
  designSourceFingerprint,
  isDesignContract,
  normalizeDesignContract,
  operationFingerprint,
  renderDesignContract,
} from "./plan.js";

import { computeTaskNextActionEnvelope } from "./next-action.js";

export {
  evaluateTaskAutonomousGateEligibility as evaluateAutonomousGateEligibility,
  preflightGate,
} from "./gate-preflight.js";
export { computeTaskNextActionEnvelope };
export { deriveMacroPhase } from "./lifecycle-phase.js";

export function computeNextActionEnvelope(state: TaskState) {
  return computeTaskNextActionEnvelope(state);
}

export const TASK_STATUSES = [
  "new",
  "intaking",
  "discovering",
  "awaiting_shape_decision",
  "awaiting_profile_choice",
  "planning",
  "awaiting_intake_decision",
  "awaiting_approval",
  "executing",
  "assuring",
  "blocked",
  "cancelled",
  "failed",
] as const satisfies readonly TaskStatus[];

export const MACRO_PHASES = [
  "INTAKE",
  "SHAPE",
  "GATE",
  "BUILD",
  "ASSURE",
] as const satisfies readonly MacroPhase[];

const RESUME_TARGETS = new Set<string>([
  "intaking",
  "discovering",
  "awaiting_shape_decision",
  "awaiting_profile_choice",
  "planning",
  "awaiting_intake_decision",
  "awaiting_approval",
  "executing",
  "assuring",
]);

const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  new: ["intaking", "blocked", "cancelled", "failed"],
  intaking: ["discovering", "awaiting_intake_decision", "blocked", "cancelled", "failed"],
  discovering: [
    "awaiting_shape_decision",
    "awaiting_profile_choice",
    "planning",
    "awaiting_intake_decision",
    "blocked",
    "cancelled",
    "failed",
  ],
  awaiting_shape_decision: [
    "discovering",
    "planning",
    "awaiting_intake_decision",
    "blocked",
    "cancelled",
    "failed",
  ],
  awaiting_profile_choice: [
    "planning",
    "discovering",
    "awaiting_intake_decision",
    "blocked",
    "cancelled",
    "failed",
  ],
  planning: [
    "discovering",
    "awaiting_shape_decision",
    "awaiting_intake_decision",
    "awaiting_approval",
    "blocked",
    "cancelled",
    "failed",
  ],
  awaiting_intake_decision: [
    "intaking",
    "discovering",
    "planning",
    "blocked",
    "cancelled",
    "failed",
  ],
  awaiting_approval: [
    "executing",
    "planning",
    "discovering",
    "intaking",
    "awaiting_intake_decision",
    "blocked",
    "cancelled",
    "failed",
  ],
  executing: ["assuring", "planning", "awaiting_approval", "blocked", "cancelled", "failed"],
  assuring: ["executing", "planning", "awaiting_approval", "blocked", "cancelled", "failed"],
  blocked: [...(Array.from(RESUME_TARGETS) as TaskStatus[]), "cancelled", "failed"],
  cancelled: [],
  failed: [],
};

const BASELINE_KEYS = new Set([
  "objective",
  "users_value",
  "scope",
  "success",
  "risks_constraints",
]);
const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SAFE_REL_MD = /^[A-Za-z0-9][A-Za-z0-9._/-]*\.md$/;
const MAX_GATE_INSTRUCTION = 1024;

export { EXECUTABLE_VERIFIER_KINDS };
export type ExecutableVerifierKind = (typeof EXECUTABLE_VERIFIER_KINDS)[number];
export type ExtendedVerifierKind = ExecutableVerifierKind | "model-inspection" | "user-observation";

export interface GateDecisionInput {
  decision: "approve" | "reject" | "change" | "autonomous";
  instruction?: string;
  issueRef?: string;
  decidedAt?: string;
  expectedDigest?: string;
  expectedReview?: string;
  harness?: HarnessPreference;
}

interface GateDecisionOutcome {
  preflight: GatePreflightResult;
  card: string;
  state: TaskState;
  receipt?: PlanApprovalReceipt;
  refusal?:
    | "stale_contract_view"
    | "contract_review_sources_changed"
    | "contract_review_host_unavailable"
    | "autonomous_authorization_unavailable"
    | "build_worktree_unavailable";
}

interface TaskSaveOptions {
  create?: boolean;
  expectedRevision?: number;
  adoptDesign?: boolean;
}

interface ProjectionAuthorization {
  path: string;
  digest: string;
  checkPolicy: (path: string) => Promise<string>;
}

interface TaskStateStore {
  readonly workspaceRoot: string;
  readonly store: WorkspaceStore;
  load(taskId: string): Promise<TaskState>;
  resume(taskId: string): Promise<TaskState>;
  save(taskId: string, rawState: unknown, options?: TaskSaveOptions): Promise<TaskState>;
  gate(taskId: string, decisionInput?: GateDecisionInput): Promise<GateDecisionOutcome>;
  project(taskId: string, authorization: ProjectionAuthorization): Promise<TaskState>;
  review(
    taskId: string,
    payload: unknown,
    harness?: HarnessPreference,
  ): Promise<{ state: TaskState; detail: unknown }>;
}

const failInvalid = (message: string): never => {
  throw new StateStoreError("state_invalid", message);
};

function conflict(message: string): never {
  throw new StateStoreError("state_conflict", message);
}

const failBlocked = (message: string): never => {
  throw new StateStoreError("state_blocked", message, EXIT_CODES.BLOCKED);
};

const isTransition = (event: DurableHistoryEvent): event is StateHistoryEvent =>
  event.type === "state.transition";
const isValidIso = (value: string): boolean =>
  value.trim().length > 0 && !Number.isNaN(Date.parse(value));

function assertValidTaskId(taskId: string): string {
  if (!SAFE_TASK_ID.test(taskId) || taskId.includes("..")) {
    throw new StateStoreError("state_path_invalid", `Invalid taskId '${taskId}'`);
  }
  return `.forgix/tasks/${taskId}.json`;
}

function assertUnique<T>(items: readonly T[], keyOf: (item: T) => string, label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) failInvalid(`Duplicate ${label} '${key}'`);
    seen.add(key);
  }
}

function assertGraphAcyclic(graph: DependencyGraph, label: string): void {
  try {
    validateDependencyGraph(graph);
  } catch (error) {
    failInvalid(`Invalid ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const computeStateFingerprint = (state: TaskState): string =>
  sha256Prefixed(
    canonicalize({
      taskId: state.taskId,
      status: state.status,
      revision: state.revision,
      risk: state.risk,
      design: state.design,
      shape: state.shape ?? null,
      contractDigest: state.contractDigest ?? null,
      contractReview: state.contractReview,
    }),
  );

function defaultProjectionPath(state: TaskState): string {
  const firstAt = state.history[0]?.at ?? state.historySummary?.firstAt ?? "";
  const date = /^(\d{4}-\d{2}-\d{2})/.exec(firstAt)?.[1] ?? "1970-01-01";
  const slug =
    state.taskId
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "task";
  return `docs/forgix/${date}-${slug}.md`;
}

const bulletList = (items: readonly string[], empty = "- None"): string[] =>
  items.length > 0 ? items.map((item) => `- ${item}`) : [empty];

export function renderPlanProjection(contract: CanonicalChangeContract): string {
  if (isDesignContract(contract)) return renderDesignContract(contract);
  const lines = [
    `# Plan Projection: ${contract.artifactId}`,
    "",
    `- Profile: ${contract.profile}`,
    `- Risk: ${contract.risk}`,
    `- Revision: ${contract.revision}`,
    `- Product Baseline: ${contract.productBaselineRef}`,
    `- Contract Digest: ${contract.digest || "pending"}`,
    "",
    "## Scope",
    ...bulletList(contract.scope),
    "",
    "## Non-Goals",
    ...bulletList(contract.nonGoals),
    "",
    "## Acceptance Criteria",
    ...bulletList(
      contract.acceptanceCriteria.map(
        (c) =>
          `**${c.id}**: ${c.description} (validations: ${c.validationIds.join(", ") || "none"})`,
      ),
    ),
    "",
    "## Tasks",
    ...bulletList(
      contract.tasks.map((t) => {
        const deps =
          t.dependsOnTaskIds.length > 0 ? `; depends on: ${t.dependsOnTaskIds.join(", ")}` : "";
        return `**${t.id}**: ${t.description} (criteria: ${t.criterionIds.join(", ") || "none"}${deps})`;
      }),
    ),
    "",
    "## Validations",
    ...bulletList(
      contract.validations.map(
        (v) => `**${v.id}**: ${v.description}${v.command ? ` (\`${v.command}\`)` : ""}`,
      ),
    ),
    "",
    "## Risks & Controls",
    ...bulletList(
      contract.risks.map((r) => `**${r.id}**: ${r.description} — Control: ${r.control}`),
    ),
  ];
  if (contract.guide && contract.guide.content.length > 0) {
    lines.push("", "## Implementation Guide", ...bulletList(contract.guide.content));
  }
  return `${lines.join("\n")}\n`;
}

function validateProductBaseline(baseline: ProductBaseline): void {
  if (baseline.schemaVersion !== 1 || !Array.isArray(baseline.dimensions)) {
    failInvalid("design.productBaseline must have schemaVersion 1 and dimensions");
  }
  const seen = new Set<string>();
  for (const dim of baseline.dimensions) {
    if (!BASELINE_KEYS.has(dim.key) || seen.has(dim.key)) {
      failInvalid(`Invalid or duplicate productBaseline dimension '${dim.key}'`);
    }
    seen.add(dim.key);
    if (dim.status === "resolved" && !dim.value?.trim()) {
      failInvalid(`Resolved productBaseline dimension '${dim.key}' requires value`);
    }
    if (dim.status === "not_applicable" && !dim.notApplicableReason?.trim()) {
      failInvalid(
        `not_applicable productBaseline dimension '${dim.key}' requires notApplicableReason`,
      );
    }
  }
  if (seen.size !== BASELINE_KEYS.size) {
    failInvalid("design.productBaseline must contain all 5 required dimensions");
  }
}

function validateActiveQuestion(question: ActiveDesignQuestion): void {
  if (question.schemaVersion !== 1 || !question.freeFormAllowed) {
    failInvalid("Invalid activeQuestion metadata");
  }
  if (question.subjectIds.length === 0 || question.prerequisiteIds.includes(question.id)) {
    failInvalid(`Invalid subjectIds or self-prerequisite on question '${question.id}'`);
  }
  if (!Number.isInteger(question.clarificationCount) || question.clarificationCount < 0) {
    failInvalid(`Invalid clarificationCount on question '${question.id}'`);
  }
  if (question.mode === "choice") {
    const options = question.options;
    if (!options || options.length < 2 || options.length > 3) {
      return failInvalid(`Choice question '${question.id}' requires 2 or 3 options`);
    }
    assertUnique(options, (opt) => opt.id, `option ID on question '${question.id}'`);
    if (
      question.recommendedOptionId !== undefined &&
      !options.some((o) => o.id === question.recommendedOptionId)
    ) {
      return failInvalid(
        `recommendedOptionId '${question.recommendedOptionId}' missing from question '${question.id}' options`,
      );
    }
  } else if (question.options && question.options.length > 0) {
    failInvalid(`Elicitation question '${question.id}' must not define options`);
  }
}

function validateDesignState(design: DesignState): void {
  if (!design || design.schemaVersion !== 1) failInvalid("design must have schemaVersion 1");
  assertGraphAcyclic(design.graph, "design.graph");
  validateProductBaseline(design.productBaseline);
  if (design.activeQuestion) validateActiveQuestion(design.activeQuestion);

  assertUnique(design.glossaryDeltas, (entry) => entry.id, "glossary delta");
  assertUnique(design.domainRules, (rule) => rule.id, "domain rule");
  const glossaryIds = new Set(design.glossaryDeltas.map((entry) => entry.id));

  for (const entry of design.glossaryDeltas) {
    if (entry.rejectedTerms.some((r) => r.term === entry.term)) {
      failInvalid(`Glossary delta '${entry.id}' cannot reject its own term`);
    }
  }
  for (const rule of design.domainRules) {
    if (rule.status !== "invalidated") {
      for (const termId of rule.termIds) {
        if (!glossaryIds.has(termId))
          failInvalid(`Domain rule '${rule.id}' references unknown term '${termId}'`);
      }
    }
  }
}

function validateHistory(state: TaskState): void {
  let prevSequence = state.historySummary?.lastSequence ?? 0;
  let prevRevision = 0;
  let lastTransition: StateHistoryEvent | undefined;

  for (const event of state.history) {
    if (!Number.isInteger(event.sequence) || event.sequence <= prevSequence) {
      failInvalid(`History sequence ${event.sequence} must increase monotonically`);
    }
    prevSequence = event.sequence;
    if (!isValidIso(event.at))
      failInvalid(`Invalid timestamp on history sequence ${event.sequence}`);
    if (!isTransition(event)) continue;

    if (!TRANSITIONS[event.from]?.includes(event.to)) {
      failInvalid(`Illegal state transition ${event.from} -> ${event.to}`);
    }
    if (event.revision <= prevRevision || event.revision > state.revision) {
      failInvalid(`Invalid transition revision ${event.revision} at seq ${event.sequence}`);
    }
    prevRevision = event.revision;

    if (event.to === "cancelled" || event.to === "failed") {
      if (event.terminalSource !== event.from) {
        failInvalid(
          `Terminal transition at seq ${event.sequence} requires terminalSource === from`,
        );
      }
      if (
        event.terminalSource === "blocked" &&
        (!event.terminalResumeTo || !RESUME_TARGETS.has(event.terminalResumeTo))
      ) {
        failInvalid(
          `Blocked terminal transition at seq ${event.sequence} requires terminalResumeTo`,
        );
      }
    }
    if (event.gateDecision) {
      if (event.gateDecision.taskId !== state.taskId) {
        failInvalid(`Transition gateDecision taskId mismatch at seq ${event.sequence}`);
      }
      if (
        event.gateDecision.actor === "autonomous_policy" &&
        !GATE_ISSUE_REF.test(event.gateDecision.issueRef ?? "")
      ) {
        failInvalid(`Autonomous gateDecision missing valid issueRef at seq ${event.sequence}`);
      }
    }
    lastTransition = event;
  }

  const effectiveLastTo = lastTransition?.to ?? state.historySummary?.lastTransition?.to;
  if (effectiveLastTo !== undefined && effectiveLastTo !== state.status) {
    failInvalid(
      `Latest transition target '${effectiveLastTo}' does not match state.status '${state.status}'`,
    );
  }
  if (state.status === "cancelled" || state.status === "failed") {
    deriveMacroPhase(state);
  }
}

function validateTaskDependenciesAcyclic(contract: CanonicalChangeContract): void {
  const byId = new Map(contract.tasks.map((task) => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (taskId: string): void => {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) failInvalid(`Cycle detected in contract.tasks at '${taskId}'`);
    visiting.add(taskId);
    const task = byId.get(taskId) ?? failInvalid(`Unknown task '${taskId}' in contract.tasks`);
    for (const depId of task.dependsOnTaskIds) {
      if (!byId.has(depId)) failInvalid(`Task '${taskId}' depends on unknown task '${depId}'`);
      visit(depId);
    }
    visiting.delete(taskId);
    visited.add(taskId);
  };
  for (const task of contract.tasks) visit(task.id);
}

function validateAndNormalizeShape(state: TaskState, shape: ShapeState): void {
  if (shape.schemaVersion !== 1) failInvalid("shape.schemaVersion must equal 1");
  assertGraphAcyclic(shape.dependencyGraph, "shape.dependencyGraph");
  assertUnique(shape.evidence, (item) => item.id, "shape evidence");

  const fingerprintsById = new Map((shape.sourceFingerprints ?? []).map((fp) => [fp.id, fp.value]));
  for (const item of shape.evidence) {
    if (!isEvidenceFresh(item, fingerprintsById)) {
      failInvalid(
        `Stale shape evidence '${item.id}': observed '${item.observedValue ?? "missing"}' vs expected '${item.expectedValue}'`,
      );
    }
  }

  if (shape.technicalDecisions) {
    assertUnique(shape.technicalDecisions, (d) => d.id, "technicalDecision");
    for (const d of shape.technicalDecisions) {
      const optionIds = new Set(d.options.map((o) => o.id));
      if (!optionIds.has(d.recommendedOptionId)) {
        failInvalid(`Invalid recommendedOptionId on technicalDecision '${d.id}'`);
      }
      if (d.status === "resolved" && (!d.selectedOptionId || !optionIds.has(d.selectedOptionId))) {
        failInvalid(`Resolved technicalDecision '${d.id}' requires valid selectedOptionId`);
      }
    }
  }

  if (!shape.contract) return;
  const contract = shape.contract;
  if (isDesignContract(contract)) {
    normalizeDesignContract(contract, state, shape);
  } else if (contract.schemaVersion !== 1 || contract.planDesign !== undefined) {
    failInvalid("Unsupported change contract version or design content.");
  }
  validateTaskDependenciesAcyclic(contract);

  const computedDigest = canonicalContractDigest(shape.contract);
  shape.contract.digest = computedDigest;
  state.contractDigest = computedDigest;

  const selectedProfile = shape.preparationProfileChoice?.selectedProfile ?? shape.contract.profile;
  if (isDesignContract(contract) && selectedProfile !== "plan") {
    failInvalid("Design contract requires the Plan preparation profile.");
  }
  if (selectedProfile === "plan") {
    const targetPath = shape.projection?.path ?? defaultProjectionPath(state);
    if (!SAFE_REL_MD.test(targetPath) || targetPath.includes("..")) {
      failInvalid(`Unsafe plan projection path '${targetPath}'`);
    }
    const contentFingerprint = sha256Hex(renderPlanProjection(shape.contract));
    const status =
      (state.status === "executing" || state.status === "assuring") && state.planApproval
        ? "Approved"
        : "Proposed";
    shape.projection = {
      schemaVersion: 1,
      path: targetPath,
      status,
      contractDigest: computedDigest,
      contentFingerprint,
      ...(isDesignContract(contract) && shape.projection?.written
        ? { written: shape.projection.written }
        : {}),
      ...(isDesignContract(contract) && shape.projection?.pending
        ? { pending: shape.projection.pending }
        : {}),
    };
  }
}

function validatePlanApproval(state: TaskState): void {
  if (!state.shape?.contract || !state.contractDigest) {
    failInvalid(`Status '${state.status}' requires shape.contract and contractDigest`);
  }
  const contract = state.shape!.contract!;
  const approval = state.planApproval;
  if (!approval || approval.decision !== "approved") {
    failInvalid(`Status '${state.status}' requires an approved planApproval receipt`);
  }
  const receipt = approval!;
  if (receipt.taskId !== state.taskId) failInvalid("planApproval.taskId does not match taskId");
  if (receipt.artifactId !== contract.artifactId)
    failInvalid("planApproval.artifactId does not match contract artifactId");
  if (receipt.contractDigest !== state.contractDigest) {
    failInvalid(
      `planApproval.contractDigest '${receipt.contractDigest}' does not match contractDigest '${state.contractDigest}'`,
    );
  }
  if (receipt.stateRevision > state.revision)
    failInvalid("planApproval.stateRevision exceeds task revision");
  if (receipt.actor === "autonomous_policy" && !GATE_ISSUE_REF.test(receipt.issueRef ?? "")) {
    failInvalid("Autonomous planApproval requires a valid issueRef");
  }
  if (receipt.receiptDigest !== gateDecisionDigest(receipt)) {
    failInvalid("planApproval.receiptDigest is invalid or tampered");
  }
}

function isStrictEvidenceValid(
  record: AssuranceEvidenceRecord,
  op: NonNullable<NonNullable<CanonicalChangeContract["assuranceContract"]>["operations"]>[number],
): boolean {
  const { digest, ...body } = record;
  const expectedDigest = sha256Hex(body);
  const validResult =
    record.result === "passed" || record.result === "not_applicable" || record.result === "failed";
  const validSubjects = record.subjectIds.every((id) => op.covers.includes(id));
  const validConditional =
    record.result !== "not_applicable" ||
    (op.conditional && Boolean(record.activationEvidenceRef?.trim()));
  const validDigest = digest === "" || digest === expectedDigest;
  if (
    !validDigest ||
    !record.detailRef?.trim() ||
    !validResult ||
    !validSubjects ||
    !validConditional
  ) {
    return false;
  }
  record.digest = expectedDigest;
  return true;
}

type AssuranceOp = NonNullable<
  NonNullable<CanonicalChangeContract["assuranceContract"]>["operations"]
>[number];

function validateAssuranceRecord(
  record: AssuranceEvidenceRecord,
  operations: ReadonlyMap<string, AssuranceOp>,
  strictProof: boolean,
): boolean {
  if (!isValidIso(record.recordedAt) || record.subjectIds.length === 0) {
    failInvalid(`Invalid assurance evidence record '${record.evidenceId}'`);
  }
  const op = operations.get(record.operationId);
  if (operations.size > 0 && (!op || op.kind !== record.verifierKind)) {
    failInvalid(`Assurance evidence '${record.evidenceId}' mismatches contract operation`);
  }
  if (!strictProof || !op) return true;
  if (!isStrictEvidenceValid(record, op)) {
    failInvalid(
      `Assurance evidence '${record.evidenceId}' does not prove its operation or applicability`,
    );
  }
  return record.verifierDigest === operationFingerprint(op);
}

function collectLatestAssuranceRecords(
  assurance: AssuranceState,
  operations: ReadonlyMap<string, AssuranceOp>,
  strictProof: boolean,
): Map<string, AssuranceEvidenceRecord> {
  const latestByOp = new Map<string, AssuranceEvidenceRecord>();
  for (const record of assurance.evidenceIndex) {
    if (!validateAssuranceRecord(record, operations, strictProof)) continue;
    const prev = latestByOp.get(record.operationId);
    if (!prev || Date.parse(record.recordedAt) >= Date.parse(prev.recordedAt)) {
      latestByOp.set(record.operationId, record);
    }
  }
  return latestByOp;
}

function countActiveAssuranceIssues(issues: AssuranceState["issues"]): number {
  let activeIssues = 0;
  for (const issue of issues ?? []) {
    if (!Number.isInteger(issue.correctionAttempts) || issue.correctionAttempts < 0) {
      failInvalid(`Invalid correctionAttempts on assurance issue '${issue.issueId}'`);
    }
    if (issue.status !== "active") continue;
    activeIssues += 1;
    if (issue.correctionAttempts >= 2 && !issue.rootCauseRequired) {
      failInvalid(
        `Assurance issue '${issue.issueId}' triggered 2-strike escalation and requires rootCauseRequired === true`,
      );
    }
  }
  return activeIssues;
}

function collectCoveredAssuranceSubjects(
  latestRecords: readonly AssuranceEvidenceRecord[],
  activeSnapshot: string | undefined,
  strictProof: boolean,
  criteria: ReadonlySet<string>,
): Set<string> {
  const coveredSubjects = new Set<string>();
  for (const record of latestRecords) {
    const passing = record.result === "passed" || record.result === "not_applicable";
    const fresh = activeSnapshot === undefined || record.observedFingerprint === activeSnapshot;
    if (!passing || !fresh) continue;
    for (const id of record.subjectIds) {
      if (!strictProof || !criteria.has(id) || record.result === "passed") coveredSubjects.add(id);
    }
  }
  return coveredSubjects;
}

function hasExactAssuranceOperations(
  operations: ReadonlyMap<string, AssuranceOp>,
  latestByOp: ReadonlyMap<string, AssuranceEvidenceRecord>,
  activeSnapshot: string | undefined,
  strictProof: boolean,
): boolean {
  if (!strictProof) return true;
  if (activeSnapshot === undefined) return false;
  return [...operations.values()].every((op) => {
    const proof = latestByOp.get(op.id);
    return (
      proof?.observedFingerprint === activeSnapshot &&
      (proof.result === "passed" || proof.result === "not_applicable") &&
      op.covers.every((id) => proof.subjectIds.includes(id))
    );
  });
}

function isContractCoveredBySubjects(
  contract: CanonicalChangeContract | undefined,
  coveredSubjects: ReadonlySet<string>,
): boolean {
  if (!contract || contract.acceptanceCriteria.length === 0) return false;
  const criteriaCovered = contract.acceptanceCriteria.every((c) => coveredSubjects.has(c.id));
  const subjectsCovered = (contract.assuranceContract?.subjects ?? []).every((s) =>
    coveredSubjects.has(s.id),
  );
  return criteriaCovered && subjectsCovered;
}

function evaluateAssuranceReadiness(
  state: TaskState,
  assurance: AssuranceState,
): { readyForReceipt: boolean; latestRecords: AssuranceEvidenceRecord[] } {
  if (assurance.schemaVersion !== 1 || !Array.isArray(assurance.evidenceIndex)) {
    failInvalid("assurance must have schemaVersion 1 and evidenceIndex");
  }
  assertUnique(assurance.evidenceIndex, (record) => record.evidenceId, "assurance evidenceId");
  assertUnique(assurance.issues ?? [], (issue) => issue.issueId, "assurance issueId");

  const contract = state.shape?.contract;
  const strictProof = isDesignContract(contract);
  const operations = new Map(
    (contract?.assuranceContract?.operations ?? []).map((op) => [op.id, op]),
  );
  const criteria = new Set(contract?.acceptanceCriteria.map(({ id }) => id));
  const latestByOp = collectLatestAssuranceRecords(assurance, operations, strictProof);
  const activeIssues = countActiveAssuranceIssues(assurance.issues);
  const activeSnapshot = state.activeWorktree?.gitFingerprint;
  const latestRecords = Array.from(latestByOp.values());
  const coveredSubjects = collectCoveredAssuranceSubjects(
    latestRecords,
    activeSnapshot,
    strictProof,
    criteria,
  );
  const checkedRecords = strictProof ? latestRecords : assurance.evidenceIndex;
  const readyForReceipt =
    isContractCoveredBySubjects(contract, coveredSubjects) &&
    hasExactAssuranceOperations(operations, latestByOp, activeSnapshot, strictProof) &&
    !checkedRecords.some((r) => r.result === "failed") &&
    (activeSnapshot === undefined ||
      latestRecords.every((r) => r.observedFingerprint === activeSnapshot)) &&
    activeIssues === 0 &&
    assurance.pendingHumanObservation === undefined;

  return { readyForReceipt, latestRecords };
}

function validateAndComputeAssurance(state: TaskState, assurance: AssuranceState): void {
  const { readyForReceipt } = evaluateAssuranceReadiness(state, assurance);
  if (!assurance.receipt) return;
  if (!readyForReceipt) {
    failInvalid("Assurance receipt present while assurance checks are incomplete or failed");
  }
  if (assurance.receipt.taskId !== state.taskId) {
    failInvalid("assurance.receipt.taskId does not match taskId");
  }
  if (assurance.receipt.contractDigest !== state.contractDigest) {
    failInvalid("assurance.receipt.contractDigest does not match state.contractDigest");
  }
  if (assurance.receipt.receiptDigest !== computeAssuranceReceiptDigest(assurance.receipt)) {
    failInvalid("assurance.receipt.receiptDigest is invalid or tampered");
  }
}

function protectAssureCompletion(validated: TaskState, current: TaskState | undefined): void {
  const classification = current ? classifyAssureCompletion(current) : "none";
  if (classification === "verified" || classification === "incomplete") {
    conflict("ASSURE completion is sealed or incomplete; no task writes are allowed.");
  }
  if (completionProofSnapshot(current) !== completionProofSnapshot(validated)) {
    conflict("ASSURE completion proof is runtime-owned and cannot be injected via save.");
  }
}

function sealAssureCompletion(state: TaskState, workspaceRoot: string): void {
  if (state.status !== "assuring" || !state.assurance || !state.contractDigest) return;
  if (classifyAssureCompletion(state) !== "none") return;
  const { readyForReceipt, latestRecords } = evaluateAssuranceReadiness(state, state.assurance);
  if (!readyForReceipt) return;

  const worktreeDigest = observeWorktreeSnapshot(workspaceRoot);
  if (!worktreeDigest) {
    return failInvalid("Cannot seal ASSURE completion: live Git worktree is unobservable.");
  }
  const artifactPaths = state.assurance.externalArtifacts;
  const artifactDigests = artifactPaths?.length
    ? observeExternalArtifacts(workspaceRoot, artifactPaths)
    : undefined;
  if (artifactPaths?.length && !artifactDigests) {
    return failInvalid(
      "Cannot seal ASSURE completion: declared external artifacts are missing or unobservable.",
    );
  }

  const sortedRecords = latestRecords.toSorted((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  const pair = buildV2AssureCompletionPair(state, sortedRecords, worktreeDigest, artifactDigests);
  state.assurance.completionIndex = pair.completionIndex;
  state.assurance.receipt = pair.receipt;
  state.history.push(pair.event);
}

export function activeVerifierDigests(state: TaskState): Record<string, string> | undefined {
  const contract = state.shape?.contract;
  if (!isDesignContract(contract)) return undefined;
  return Object.fromEntries(
    contract.assuranceContract.operations.map((op) => [op.id, operationFingerprint(op)]),
  );
}

export function validateTaskState(raw: unknown): TaskState {
  const schemaResult = validateSchema("state", raw);
  if (!schemaResult.valid) {
    throw new StateStoreError(
      "state_schema_incompatible",
      `TaskState schema validation failed: ${JSON.stringify(schemaResult.errors)}`,
    );
  }
  try {
    assertCleanHygiene(raw);
  } catch (error) {
    throw new StateStoreError(
      "state_invalid",
      error instanceof Error ? error.message : String(error),
      EXIT_CODES.INVALID_CONFIGURATION,
    );
  }

  const state = structuredClone(raw) as TaskState;
  assertValidTaskId(state.taskId);
  validateHistory(state);
  validateDesignState(state.design);
  if (state.shape) validateAndNormalizeShape(state, state.shape);
  if (state.status === "executing" || state.status === "assuring") validatePlanApproval(state);
  if (state.status === "assuring") {
    if (!state.assurance) failInvalid("Status 'assuring' requires state.assurance");
    validateAndComputeAssurance(state, state.assurance!);
  }
  return state;
}

export function renderGateCard(state: TaskState, preflight?: GatePreflightResult): string {
  const resolved = preflight ?? preflightGate(state);
  const contract = state.shape?.contract;
  const objective = resolved.summary?.objective ?? resolveObjective(state);
  const taskCount = resolved.summary?.taskCount ?? contract?.tasks.length ?? 0;
  const criterionCount =
    resolved.summary?.criterionCount ?? contract?.acceptanceCriteria.length ?? 0;
  const validationCount = resolved.summary?.validationCount ?? contract?.validations.length ?? 0;
  const riskLevel = resolved.summary?.riskLevel ?? contract?.risk ?? state.risk;
  const controlCount = resolved.summary?.riskControlCount ?? contract?.risks.length ?? 0;
  const shortDigest = (
    resolved.contractDigest ??
    state.contractDigest ??
    contract?.digest ??
    "pending"
  ).slice(0, 8);

  return [
    `Objectif : ${objective}`,
    `Plan : ${taskCount} tâches · ${criterionCount} critères · ${validationCount} validations`,
    `Risque : ${riskLevel} · ${controlCount} contrôles`,
    `Contrat : ${shortDigest}…`,
    "[Approuver] [Modifier] [Rejeter] [Voir]",
  ].join("\n");
}

export function renderGateContract(state: TaskState): string {
  const contract = state.shape?.contract;
  if (!contract) return `${renderGateCard(state)}\n\nAucun contrat canonique disponible.\n`;
  return [
    renderPlanProjection(contract).trimEnd(),
    "",
    "## Protected Surface permissions",
    ...bulletList((contract.approvedProtectedPaths ?? []).map((path) => JSON.stringify(path))),
    "",
    "## Escape Hatch permissions",
    ...bulletList((contract.approvedEscapeHatches ?? []).map((entry) => JSON.stringify(entry))),
    "",
  ].join("\n");
}

export function applyTaskGateDecision(
  state: TaskState,
  input: GateDecisionInput,
): GateDecisionOutcome {
  if (state.status !== "awaiting_approval") {
    failBlocked(
      `Task '${state.taskId}' must be in 'awaiting_approval' status (got '${state.status}')`,
    );
  }

  const preflight = preflightGate(state);
  const card = renderGateCard(state, preflight);
  const decidedAt = input.decidedAt ?? new Date().toISOString();
  if (!isValidIso(decidedAt)) failInvalid(`Invalid decidedAt timestamp '${decidedAt}'`);

  const nextState = structuredClone(state);
  const nextRevision = state.revision + 1;
  const sequence =
    Math.max(state.history.at(-1)?.sequence ?? 0, state.historySummary?.lastSequence ?? 0) + 1;
  const stateFingerprint = computeStateFingerprint(state);
  const contractDigest = preflight.contractDigest ?? state.contractDigest ?? "missing-contract";
  const artifactId = state.shape?.contract?.artifactId ?? `task:${state.taskId}`;

  if (input.decision === "approve" || input.decision === "autonomous") {
    if (
      state.contractReview &&
      input.decision === "approve" &&
      (!input.expectedReview || input.expectedReview !== contractReviewView(state)?.digest)
    ) {
      failBlocked(
        "Gate approval requires the exact Contract Review view; show the current contract again.",
      );
    }
    if (
      input.decision === "approve" &&
      (state.contractReview || isDesignContract(state.shape?.contract)) &&
      (!input.expectedDigest || input.expectedDigest !== preflight.contractDigest)
    ) {
      failBlocked(
        "Gate approval requires the current full contract digest; view the contract again.",
      );
    }
    if (!preflight.ready || !preflight.contractDigest || !state.shape?.contract) {
      failBlocked(`Gate approval blocked: ${preflight.blockers.join(", ")}`);
    }
    if (input.decision === "autonomous") {
      const eligibility = evaluateTaskAutonomousGateEligibility(
        state,
        input.issueRef !== undefined ? { issueRef: input.issueRef } : undefined,
      );
      if (!eligibility.eligible)
        failBlocked(`Autonomous gate ineligible: ${eligibility.reasons.join(", ")}`);
    }

    const body: Omit<PlanApprovalReceipt, "receiptDigest"> = {
      schemaVersion: 1,
      decision: "approved",
      actor: input.decision === "autonomous" ? "autonomous_policy" : "user",
      ...(input.decision === "autonomous" && input.issueRef ? { issueRef: input.issueRef } : {}),
      decidedAt,
      taskId: state.taskId,
      artifactId,
      stateRevision: state.revision,
      stateFingerprint,
      contractDigest: preflight.contractDigest!,
    };
    const receipt: PlanApprovalReceipt = { ...body, receiptDigest: sha256Hex(canonicalize(body)) };

    nextState.status = "executing";
    nextState.revision = nextRevision;
    nextState.contractDigest = preflight.contractDigest!;
    nextState.planApproval = receipt;
    nextState.history.push({
      sequence,
      at: decidedAt,
      type: "state.transition",
      from: "awaiting_approval",
      to: "executing",
      revision: nextRevision,
      sourceFingerprint: stateFingerprint,
      contractDigest: preflight.contractDigest!,
      gateDecision: receipt,
    });
    return { preflight, card, state: validateTaskState(nextState), receipt };
  }

  const instruction = (input.instruction ?? "").trim();
  if (input.decision === "change") {
    if (!instruction || /[\r\n]/.test(instruction) || instruction.length > MAX_GATE_INSTRUCTION) {
      failBlocked(
        "Gate decision 'change' requires a non-empty single-line instruction <= 1024 chars",
      );
    }
    try {
      assertCleanHygiene(instruction);
    } catch (error) {
      throw new StateStoreError(
        "state_invalid",
        error instanceof Error ? error.message : String(error),
        EXIT_CODES.INVALID_CONFIGURATION,
      );
    }
  }

  const body: Omit<GateDecisionRecord, "receiptDigest"> = {
    schemaVersion: 1,
    decision: input.decision === "change" ? "change_requested" : "rejected",
    actor: "user",
    decidedAt,
    taskId: state.taskId,
    artifactId,
    stateRevision: state.revision,
    stateFingerprint,
    contractDigest,
    ...(input.decision === "change"
      ? { instructionRef: `decision:gate-change:${sha256Hex(instruction).slice(0, 16)}` }
      : {}),
  };
  const gateDecision: GateDecisionRecord = {
    ...body,
    receiptDigest: sha256Hex(canonicalize(body)),
  };

  delete nextState.planApproval;
  nextState.status = input.decision === "change" ? "planning" : "cancelled";
  nextState.revision = nextRevision;
  nextState.history.push({
    sequence,
    at: decidedAt,
    type: "state.transition",
    from: "awaiting_approval",
    to: nextState.status,
    revision: nextRevision,
    sourceFingerprint: stateFingerprint,
    ...(nextState.status === "cancelled" ? { terminalSource: "awaiting_approval" as const } : {}),
    ...(preflight.contractDigest ? { contractDigest: preflight.contractDigest } : {}),
    gateDecision,
  });
  return { preflight, card, state: validateTaskState(nextState) };
}

function parseTaskJson(taskId: string, rawText: string): unknown {
  try {
    return JSON.parse(rawText) as unknown;
  } catch (error) {
    throw new StateStoreError(
      "state_yaml_invalid",
      `Failed to parse task '${taskId}' JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function protectApproval(
  next: TaskState,
  current: TaskState | undefined,
  workspaceRoot: string,
): void {
  const approval = next.planApproval;
  if (approval && sha256Hex(approval) !== sha256Hex(current?.planApproval ?? null)) {
    conflict("Only GATE can issue a Plan Approval Receipt.");
  }
  const before = new Set(
    current?.history.filter(isTransition).filter(isApprovalTransition).map(sha256Hex),
  );
  if (
    next.history
      .filter(isTransition)
      .filter(isApprovalTransition)
      .some((event) => !before.has(sha256Hex(event)))
  ) {
    conflict("Only GATE can record approval transitions.");
  }
  if (!canCarryApproval(next) && approval) {
    conflict("Leaving BUILD or ASSURE invalidates the active approval.");
  }
  if (next.status === "executing") checkSaveBuildEntry(next, current, workspaceRoot);
}

function canCarryApproval(state: TaskState): boolean {
  return (
    state.status === "executing" ||
    state.status === "assuring" ||
    (state.status === "blocked" &&
      (state.resumeTo === "executing" || state.resumeTo === "assuring"))
  );
}

function checkSaveBuildEntry(
  next: TaskState,
  current: TaskState | undefined,
  workspaceRoot: string,
): void {
  if (
    current?.status !== "executing" &&
    !(current?.status === "blocked" && current.resumeTo === "executing")
  ) {
    conflict("Only GATE can enter BUILD.");
  }
  requireBuildAuthorization(next, workspaceRoot);
}

function isApprovalTransition(event: StateHistoryEvent): boolean {
  return (
    event.gateDecision?.decision === "approved" ||
    (event.from === "awaiting_approval" && event.to === "executing")
  );
}

function bindGateApproval(outcome: GateDecisionOutcome, root: string): void {
  if (!outcome.receipt) return;
  const event = outcome.state.history.at(-1);
  if (!event || !isTransition(event)) return failInvalid("Missing GATE approval transition.");
  const receipt: PlanApprovalReceipt = {
    ...outcome.receipt,
    schemaVersion: BUILD_AUTHORIZATION_RECEIPT_VERSION,
    worktreeDigest: sha256Hex(root),
  };
  receipt.receiptDigest = gateDecisionDigest(receipt);
  outcome.receipt = receipt;
  outcome.state.planApproval = receipt;
  event.gateDecision = receipt;
}

export function createTaskStateStore(
  workspaceRoot: string,
  options?: WorkspaceStoreOptions,
): TaskStateStore {
  const store = createWorkspaceStore(resolveGitWorktree(workspaceRoot) ?? workspaceRoot, options);
  const withTaskLock = <T>(taskId: string, action: () => Promise<T>) =>
    store.withWriteLock(`${assertValidTaskId(taskId)}.lock.sqlite`, action);

  const load = async (taskId: string): Promise<TaskState> => {
    const relativePath = assertValidTaskId(taskId);
    const rawText = await store.readText(relativePath, false);
    if (rawText === undefined)
      throw new StateStoreError("state_not_found", `Task state '${taskId}' not found`);
    const validated = validateTaskState(parseTaskJson(taskId, rawText));
    if (validated.taskId !== taskId) {
      throw new StateStoreError(
        "state_task_mismatch",
        `Task file '${relativePath}' contains mismatched taskId '${validated.taskId}'`,
      );
    }
    return validated;
  };

  const persist = async (state: TaskState): Promise<TaskState> => {
    const validated = validateTaskState(state);
    await store.writeTextAtomically(
      assertValidTaskId(state.taskId),
      `${JSON.stringify(canonicalize(validated), null, 2)}\n`,
    );
    return validated;
  };

  const save = (
    taskId: string,
    rawState: unknown,
    saveOptions?: TaskSaveOptions,
  ): Promise<TaskState> =>
    withTaskLock(taskId, async () => {
      const relativePath = assertValidTaskId(taskId);
      const validated = validateTaskState(rawState);
      if (validated.taskId !== taskId) {
        throw new StateStoreError(
          "state_task_mismatch",
          `Cannot save taskId '${validated.taskId}' under '${relativePath}'`,
        );
      }
      const currentText = await store.readText(relativePath, true);
      if (saveOptions?.create && currentText !== undefined) {
        conflict("Task already exists; load it instead of initializing it again.");
      }
      const current =
        currentText === undefined
          ? undefined
          : validateTaskState(parseTaskJson(taskId, currentText));
      protectApproval(validated, current, store.workspaceRoot);
      protectAssureCompletion(validated, current);
      const previousContract = current?.shape?.contract;
      const nextShape = validated.shape;
      const nextContract = nextShape?.contract;
      const versioned = isDesignContract(nextContract) || isDesignContract(previousContract);
      const startsContractReview =
        nextContract !== undefined &&
        (previousContract === undefined ||
          (current?.status === "planning" && current.contractDigest !== validated.contractDigest));
      const reviewOwned = current?.contractReview !== undefined || startsContractReview;
      const currentRevision = current?.revision ?? 0;
      if (
        (versioned || reviewOwned || saveOptions?.expectedRevision !== undefined) &&
        saveOptions?.expectedRevision !== currentRevision
      ) {
        conflict(
          `Task '${taskId}' revision conflict: expected ${String(saveOptions?.expectedRevision)}, found ${currentRevision}.`,
        );
      }
      if (
        sha256Hex(validated.contractReview ?? null) !== sha256Hex(current?.contractReview ?? null)
      ) {
        conflict("Contract Review state is runtime-owned; use task review.");
      }
      if (reviewOwned) {
        if (!nextContract || validated.revision <= currentRevision || current?.assurance?.receipt) {
          conflict("A Contract Review task requires a newer revision and its canonical contract.");
        }
        if (!validated.contractReview) {
          validated.contractReview = { version: 1, rounds: [], accepted: [] };
        }
      }
      if (
        nextContract?.profile === "plan" &&
        !isDesignContract(nextContract) &&
        previousContract?.profile !== "plan"
      ) {
        failInvalid("The first Plan contract must use the design contract format.");
      }
      if (versioned) {
        if (!current || validated.revision <= currentRevision || current.assurance?.receipt) {
          return conflict(
            "A design contract requires a newer revision of an existing unfinished task.",
          );
        }
        if (!nextShape || !isDesignContract(nextContract) || !nextShape.projection) {
          return failInvalid("A design contract cannot be dropped or downgraded.");
        }
        if (
          !isDesignContract(previousContract) &&
          (current.status !== "planning" ||
            (previousContract?.profile === "plan" && !saveOptions?.adoptDesign))
        ) {
          conflict(
            "Prepare the design contract in SHAPE Planning; legacy Plan adoption must be explicit.",
          );
        }
        if (
          previousContract?.profile === "plan" &&
          (previousContract.artifactId !== nextContract.artifactId ||
            current.shape?.projection?.path !== nextShape.projection.path)
        ) {
          conflict("A Plan revision cannot change the design artifact identity or path.");
        }
        // Projection receipts belong to the store, not the incoming host payload.
        const { written: _written, pending: _pending, ...metadata } = nextShape.projection;
        const previousProjection = isDesignContract(previousContract)
          ? current.shape?.projection
          : undefined;
        nextShape.projection = {
          ...metadata,
          ...(previousProjection?.written ? { written: previousProjection.written } : {}),
          ...(previousProjection?.pending ? { pending: previousProjection.pending } : {}),
        };
      }
      sealAssureCompletion(validated, store.workspaceRoot);
      return persist(validated);
    });

  const project = (taskId: string, authorization: ProjectionAuthorization): Promise<TaskState> =>
    withTaskLock(taskId, async () => {
      let state = await load(taskId);
      const shape = state.shape;
      const contract = shape?.contract;
      if (
        !shape?.projection ||
        !isDesignContract(contract) ||
        (state.status !== "planning" && state.status !== "awaiting_approval")
      ) {
        return failBlocked("Only SHAPE can project a design contract.");
      }
      const projection = shape.projection;
      const { path, contentFingerprint } = projection;
      if (
        authorization.path !== path ||
        authorization.digest !== contract.digest ||
        contract.planDesign.sourceFingerprint !== designSourceFingerprint(state, shape)
      ) {
        return failBlocked(
          "Projection authorization does not match the current design and destination.",
        );
      }
      const policy = await authorization.checkPolicy(path);
      const authorizationFingerprint = sha256Hex(
        canonicalize({ policy, path, digest: contract.digest }),
      );
      const stagedPath = `${assertValidTaskId(taskId)}.projection`;
      const currentText = await store.readText(path, true);
      const currentIdentity =
        currentText === undefined ? undefined : await store.fileIdentity(path);
      const currentFingerprint = currentText === undefined ? undefined : sha256Hex(currentText);
      const matches = (entry: { identity: string; fingerprint: string } | undefined) =>
        entry !== undefined &&
        currentIdentity === entry.identity &&
        currentFingerprint === entry.fingerprint;

      if (
        matches(projection.written) &&
        currentFingerprint === contentFingerprint &&
        projection.written?.authorization === authorizationFingerprint &&
        !projection.pending
      ) {
        return state;
      }
      const pending = projection.pending;
      if (
        pending &&
        matches(pending) &&
        pending.contractDigest === contract.digest &&
        pending.authorization === authorizationFingerprint &&
        pending.fingerprint === contentFingerprint
      ) {
        projection.written = {
          identity: pending.identity,
          fingerprint: pending.fingerprint,
          authorization: authorizationFingerprint,
        };
      } else if (currentText !== undefined) {
        // Portable rename cannot compare the destination and replace it atomically against an editor.
        return failBlocked(
          "Projection reconciliation required. Preserve the existing file and clear the destination before regenerating.",
        );
      } else {
        const markdown = renderDesignContract(contract);
        const staged = await store.readText(stagedPath, true);
        if (staged !== markdown) {
          await store.writeTextAtomically(stagedPath, markdown);
        }
        const identity = await store.fileIdentity(stagedPath);
        if (!identity) return failBlocked("Staged projection no longer exists.");
        projection.pending = {
          contractDigest: contract.digest,
          authorization: authorizationFingerprint,
          fingerprint: contentFingerprint,
          fromFingerprint: null,
          identity,
        };
        state.revision += 1;
        await persist(state);
        if (
          !(await store.linkFileIfAbsent(
            stagedPath,
            path,
            async () => (await authorization.checkPolicy(path)) === policy,
          ))
        ) {
          return failBlocked(
            "Projection destination or authorization changed; nothing was replaced.",
          );
        }
        projection.written = {
          identity,
          fingerprint: contentFingerprint,
          authorization: authorizationFingerprint,
        };
      }
      delete projection.pending;
      state.revision += 1;
      state = await persist(state);
      await store.removeFile(stagedPath);
      return state;
    });

  const gate = async (
    taskId: string,
    decisionInput?: GateDecisionInput,
  ): Promise<GateDecisionOutcome> => {
    if (!decisionInput) {
      const current = await load(taskId);
      const preflight = preflightGate(current);
      if (current.contractReview && preflight.ready && !(await sourcesCurrent(current))) {
        preflight.ready = false;
        preflight.blockers.push("contract_review_sources_changed");
      }
      return { preflight, card: renderGateCard(current, preflight), state: current };
    }
    return withTaskLock(taskId, async () => {
      const current = await load(taskId);
      const refused = (refusal: NonNullable<GateDecisionOutcome["refusal"]>) => {
        const preflight = preflightGate(current);
        if (refusal !== "stale_contract_view") {
          preflight.ready = false;
          preflight.blockers.push(refusal);
        }
        return {
          preflight,
          card: renderGateCard(current, preflight),
          state: current,
          refusal,
        };
      };
      if (decisionInput.decision === "autonomous")
        return refused("autonomous_authorization_unavailable");
      if (
        decisionInput.decision === "approve" &&
        (!decisionInput.expectedDigest ||
          decisionInput.expectedDigest !== current.contractDigest ||
          (current.contractReview &&
            decisionInput.expectedReview !== contractReviewView(current)?.digest))
      ) {
        return refused("stale_contract_view");
      }
      if (current.contractReview && decisionInput.decision === "approve") {
        if (!isSupportedReviewHarness(decisionInput.harness)) {
          return refused("contract_review_host_unavailable");
        }
        if (preflightGate(current).ready && !(await sourcesCurrent(current))) {
          return refused("contract_review_sources_changed");
        }
      }
      const outcome = applyTaskGateDecision(current, decisionInput);
      if (decisionInput.decision === "approve") {
        const root = resolveGitWorktree(store.workspaceRoot);
        if (root !== store.workspaceRoot) return refused("build_worktree_unavailable");
        bindGateApproval(outcome, root);
        requireBuildAuthorization(outcome.state, root);
      }
      return { ...outcome, state: await persist(outcome.state) };
    });
  };

  async function sourcesCurrent(state: TaskState): Promise<boolean> {
    try {
      await checkContractReviewSources(state, store, renderPlanProjection);
      return true;
    } catch (error) {
      if (error instanceof StateStoreError) return false;
      throw error;
    }
  }

  const review = (taskId: string, payload: unknown, harness?: HarnessPreference) =>
    withTaskLock(taskId, async () => {
      let state = await load(taskId);
      if (state.status === "executing") requireBuildAuthorization(state, store.workspaceRoot);
      const { detail, mutate } = await updateContractReview(
        state,
        payload,
        store,
        harness,
        renderPlanProjection,
      );
      if (mutate) {
        state.revision += 1;
        state = await persist(state);
      }
      return { state, detail };
    });

  async function resume(taskId: string): Promise<TaskState> {
    const state = await load(taskId);
    if (
      state.status === "executing" ||
      (state.status === "blocked" && state.resumeTo === "executing")
    ) {
      requireBuildAuthorization(state, store.workspaceRoot);
    }
    return state;
  }

  return { workspaceRoot: store.workspaceRoot, store, load, resume, save, gate, project, review };
}
