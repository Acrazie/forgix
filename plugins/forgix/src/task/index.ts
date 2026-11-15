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
import type {
  ActiveDesignQuestion,
  AssuranceEvidenceRecord,
  AssuranceReceipt,
  AssuranceState,
  CanonicalChangeContract,
  DependencyGraph,
  DesignState,
  DurableHistoryEvent,
  EvidenceRecord,
  GateDecisionRecord,
  MacroPhase,
  PlanApprovalReceipt,
  ProductBaseline,
  RiskLevel,
  ShapeState,
  StateHistoryEvent,
  TaskState,
  TaskStatus,
} from "../types.js";

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

const ACTIVE_PHASE: Partial<Record<TaskStatus, MacroPhase>> = {
  new: "INTAKE",
  intaking: "INTAKE",
  discovering: "SHAPE",
  awaiting_shape_decision: "SHAPE",
  awaiting_profile_choice: "SHAPE",
  planning: "SHAPE",
  awaiting_intake_decision: "INTAKE",
  awaiting_approval: "GATE",
  executing: "BUILD",
  assuring: "ASSURE",
};

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
const GATE_ISSUE_REF = /^([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)?#[1-9][0-9]*$/;
const SAFE_REL_MD = /^[A-Za-z0-9][A-Za-z0-9._/-]*\.md$/;
const MAX_GATE_INSTRUCTION = 1024;

export interface GatePreflightSummary {
  objective: string;
  taskCount: number;
  criterionCount: number;
  validationCount: number;
  riskLevel: RiskLevel;
  riskControlCount: number;
}

export interface GatePreflightResult {
  ready: boolean;
  blockers: string[];
  contractDigest: string | null;
  summary: GatePreflightSummary | null;
}

export interface AutonomousGateEligibility {
  eligible: boolean;
  reasons: string[];
}

export type GateIntent =
  | { kind: "empty" }
  | { kind: "approve" }
  | { kind: "reject" }
  | { kind: "view" }
  | { kind: "change"; instruction: string }
  | {
      kind: "invalid";
      reason: "instruction_required" | "multiline_instruction" | "instruction_too_long";
    }
  | { kind: "ambiguous"; input: string };

export interface GateDecisionInput {
  decision: "approve" | "reject" | "change" | "autonomous";
  instruction?: string;
  issueRef?: string;
  decidedAt?: string;
}

export interface GateDecisionOutcome {
  preflight: GatePreflightResult;
  card: string;
  state: TaskState;
  receipt?: PlanApprovalReceipt;
}

export interface TaskSaveOptions {
  expectedRevision?: number;
}

export interface TaskStateStore {
  readonly workspaceRoot: string;
  readonly store: WorkspaceStore;
  load(taskId: string): Promise<TaskState>;
  save(taskId: string, rawState: unknown, options?: TaskSaveOptions): Promise<TaskState>;
  gate(taskId: string, decisionInput?: GateDecisionInput): Promise<GateDecisionOutcome>;
}

const failInvalid = (message: string): never => {
  throw new StateStoreError("state_invalid", message);
};

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

const computeContractDigest = (contract: CanonicalChangeContract): string =>
  sha256Hex(canonicalize({ ...contract, digest: "" }));

const computeReceiptDigest = (record: GateDecisionRecord): string => {
  const { receiptDigest: _ignored, ...rest } = record;
  return sha256Hex(canonicalize(rest));
};

const computeAssuranceDigest = (receipt: AssuranceReceipt): string => {
  const { receiptDigest: _ignored, ...rest } = receipt;
  return sha256Prefixed(canonicalize(rest));
};

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
    }),
  );

function isEvidenceFresh(
  evidence: EvidenceRecord,
  fingerprintsById: ReadonlyMap<string, string>,
): boolean {
  if (evidence.expectedValue !== undefined && evidence.observedValue !== undefined) {
    return evidence.observedValue === evidence.expectedValue;
  }
  if (evidence.expectedValue !== undefined) {
    return !evidence.sourceFingerprintIds.some((id) => {
      const value = fingerprintsById.get(id);
      return value !== undefined && value !== evidence.expectedValue;
    });
  }
  return true;
}

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

function resolveObjective(state: TaskState): string {
  const resolved = state.design.productBaseline.dimensions.find(
    (dim) => dim.key === "objective" && dim.status === "resolved" && dim.value,
  )?.value;
  return (
    resolved ?? state.shape?.contract?.scope.find((item) => item.trim().length > 0) ?? state.taskId
  );
}

export function deriveMacroPhase(state: TaskState): MacroPhase {
  const direct = ACTIVE_PHASE[state.status];
  if (direct) return direct;
  if (state.status === "blocked") {
    const target = state.resumeTo ? ACTIVE_PHASE[state.resumeTo] : undefined;
    return target ?? failInvalid(`Blocked task '${state.taskId}' requires valid resumeTo`);
  }
  for (let i = state.history.length - 1; i >= 0; i -= 1) {
    const event = state.history[i];
    if (!event || !isTransition(event) || event.to !== state.status) continue;
    const source =
      event.terminalSource === "blocked" ? event.terminalResumeTo : event.terminalSource;
    const derived = source ? ACTIVE_PHASE[source] : undefined;
    return derived ?? failInvalid(`Terminal task '${state.taskId}' missing valid terminalSource`);
  }
  return failInvalid(`Terminal task '${state.taskId}' missing terminal transition event`);
}

const bulletList = (items: readonly string[], empty = "- None"): string[] =>
  items.length > 0 ? items.map((item) => `- ${item}`) : [empty];

export function renderPlanProjection(contract: CanonicalChangeContract): string {
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

function renderGroupedByContext<T extends { context: string }>(
  title: string,
  emptyNotice: string,
  items: readonly T[],
  renderItem: (item: T) => string[],
): string {
  const lines = [`# ${title}`];
  if (items.length === 0) {
    lines.push("", emptyNotice);
    return `${lines.join("\n")}\n`;
  }
  let currentContext = "";
  for (const item of items) {
    if (item.context !== currentContext) {
      currentContext = item.context;
      lines.push("", `## ${currentContext}`);
    }
    lines.push("", ...renderItem(item));
  }
  return `${lines.join("\n")}\n`;
}

export function renderDomainMarkdownProjection(design: DesignState): {
  glossaryMarkdown: string;
  rulesMarkdown: string;
} {
  const activeGlossary = design.glossaryDeltas
    .filter((entry) => entry.status !== "invalidated")
    .toSorted(
      (a, b) =>
        a.context.localeCompare(b.context) ||
        a.term.localeCompare(b.term) ||
        a.id.localeCompare(b.id),
    );
  const activeRules = design.domainRules
    .filter((rule) => rule.status !== "invalidated")
    .toSorted((a, b) => a.context.localeCompare(b.context) || a.id.localeCompare(b.id));

  const glossaryMarkdown = renderGroupedByContext(
    "Domain Glossary",
    "_No active glossary terms._",
    activeGlossary,
    (e) => [
      `### ${e.term} (${e.id})`,
      `- Status: ${e.status}`,
      `- Definition: ${e.definition}`,
      `- Aliases: ${e.aliases.join(", ") || "none"}`,
      `- Related Terms: ${e.relatedTermIds.join(", ") || "none"}`,
      ...(e.rejectedTerms.length > 0
        ? [`- Rejected Terms: ${e.rejectedTerms.map((r) => `${r.term} (${r.reason})`).join("; ")}`]
        : []),
    ],
  );

  const rulesMarkdown = renderGroupedByContext(
    "Domain Rules",
    "_No active domain rules._",
    activeRules,
    (r) => [
      `### ${r.id}`,
      `- Status: ${r.status}`,
      `- Terms: ${r.termIds.join(", ") || "none"}`,
      `- Actors: ${r.actors.join(", ") || "none"}`,
      `- Conditions: ${r.conditions.join("; ") || "none"}`,
      `- Outcome: ${r.outcome}`,
      `- Exceptions: ${r.exceptions.join("; ") || "none"}`,
      ...(r.scenarios.length > 0
        ? [
            "- Scenarios:",
            ...r.scenarios.map(
              (s) =>
                `  - [${s.angle}] ${s.id}: Given ${s.startingSituation}, when ${s.action}, then ${s.expectedResult}`,
            ),
          ]
        : []),
    ],
  );

  return { glossaryMarkdown, rulesMarkdown };
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
  if (shape.contract.schemaVersion !== 1) failInvalid("shape.contract.schemaVersion must equal 1");
  validateTaskDependenciesAcyclic(shape.contract);

  const computedDigest = computeContractDigest(shape.contract);
  shape.contract.digest = computedDigest;
  state.contractDigest = computedDigest;

  const selectedProfile = shape.preparationProfileChoice?.selectedProfile ?? shape.contract.profile;
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
  if (receipt.receiptDigest !== computeReceiptDigest(receipt)) {
    failInvalid("planApproval.receiptDigest is invalid or tampered");
  }
}

function validateAndComputeAssurance(state: TaskState, assurance: AssuranceState): void {
  if (assurance.schemaVersion !== 1 || !Array.isArray(assurance.evidenceIndex)) {
    failInvalid("assurance must have schemaVersion 1 and evidenceIndex");
  }
  assertUnique(assurance.evidenceIndex, (record) => record.evidenceId, "assurance evidenceId");
  assertUnique(assurance.issues ?? [], (issue) => issue.issueId, "assurance issueId");

  const operations = new Map(
    (state.shape?.contract?.assuranceContract?.operations ?? []).map((op) => [op.id, op]),
  );
  const latestByOp = new Map<string, AssuranceEvidenceRecord>();

  for (const record of assurance.evidenceIndex) {
    if (!isValidIso(record.recordedAt) || record.subjectIds.length === 0) {
      failInvalid(`Invalid assurance evidence record '${record.evidenceId}'`);
    }
    const op = operations.get(record.operationId);
    if (operations.size > 0 && (!op || op.kind !== record.verifierKind)) {
      failInvalid(`Assurance evidence '${record.evidenceId}' mismatches contract operation`);
    }
    const prev = latestByOp.get(record.operationId);
    if (!prev || Date.parse(record.recordedAt) >= Date.parse(prev.recordedAt)) {
      latestByOp.set(record.operationId, record);
    }
  }

  let activeIssues = 0;
  for (const issue of assurance.issues ?? []) {
    if (!Number.isInteger(issue.correctionAttempts) || issue.correctionAttempts < 0) {
      failInvalid(`Invalid correctionAttempts on assurance issue '${issue.issueId}'`);
    }
    if (issue.status === "active") {
      activeIssues += 1;
      if (issue.correctionAttempts >= 2 && !issue.rootCauseRequired) {
        failInvalid(
          `Assurance issue '${issue.issueId}' triggered 2-strike escalation and requires rootCauseRequired === true`,
        );
      }
    }
  }

  const activeSnapshot = state.activeWorktree?.gitFingerprint;
  const latestRecords = Array.from(latestByOp.values());
  const coveredSubjects = new Set<string>();
  for (const record of latestRecords) {
    if (
      (record.result === "passed" || record.result === "not_applicable") &&
      (activeSnapshot === undefined || record.observedFingerprint === activeSnapshot)
    ) {
      for (const id of record.subjectIds) coveredSubjects.add(id);
    }
  }

  const contract = state.shape?.contract;
  const readyForReceipt =
    contract !== undefined &&
    contract.acceptanceCriteria.length > 0 &&
    contract.acceptanceCriteria.every((c) => coveredSubjects.has(c.id)) &&
    (contract.assuranceContract?.subjects ?? []).every((s) => coveredSubjects.has(s.id)) &&
    !assurance.evidenceIndex.some((r) => r.result === "failed") &&
    !(
      activeSnapshot !== undefined &&
      latestRecords.some((r) => r.observedFingerprint !== activeSnapshot)
    ) &&
    activeIssues === 0 &&
    assurance.pendingHumanObservation === undefined;

  if (assurance.receipt) {
    if (!readyForReceipt)
      failInvalid("Assurance receipt present while assurance checks are incomplete or failed");
    if (assurance.receipt.taskId !== state.taskId)
      failInvalid("assurance.receipt.taskId does not match taskId");
    if (assurance.receipt.contractDigest !== state.contractDigest) {
      failInvalid("assurance.receipt.contractDigest does not match state.contractDigest");
    }
    if (assurance.receipt.receiptDigest !== computeAssuranceDigest(assurance.receipt)) {
      failInvalid("assurance.receipt.receiptDigest is invalid or tampered");
    }
    return;
  }

  if (!readyForReceipt || !state.contractDigest) return;

  const sortedRecords = latestRecords.toSorted((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  const distinctSnapshots = Array.from(
    new Set(sortedRecords.map((r) => r.observedFingerprint)),
  ).toSorted();
  const verifiedSnapshotFingerprint =
    activeSnapshot ??
    (distinctSnapshots.length === 1 && distinctSnapshots[0]
      ? distinctSnapshots[0]
      : sha256Prefixed(canonicalize(distinctSnapshots)));
  const completedAt =
    sortedRecords
      .map((r) => r.recordedAt)
      .toSorted((a, b) => Date.parse(a) - Date.parse(b))
      .at(-1) ?? new Date(0).toISOString();

  const body: Omit<AssuranceReceipt, "receiptDigest"> = {
    schemaVersion: 1,
    taskId: state.taskId,
    contractDigest: state.contractDigest,
    verifiedSnapshotFingerprint,
    evidenceIndexDigest: sha256Prefixed(canonicalize(sortedRecords)),
    completedAt,
  };
  assurance.completionIndex = sortedRecords.map((r) => r.evidenceId);
  assurance.receipt = { ...body, receiptDigest: sha256Prefixed(canonicalize(body)) };
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

export function preflightGate(state: TaskState): GatePreflightResult {
  const blockers: string[] = [];
  if (state.status !== "awaiting_approval") blockers.push("status_not_awaiting_approval");
  if (state.design.activeQuestion !== undefined) blockers.push("active_design_question");
  if (state.shape?.technicalDecisions?.some((d) => d.status !== "resolved"))
    blockers.push("unresolved_technical_decision");

  const fingerprints = new Map(
    (state.shape?.sourceFingerprints ?? []).map((fp) => [fp.id, fp.value]),
  );
  if (state.shape?.evidence.some((item) => !isEvidenceFresh(item, fingerprints)))
    blockers.push("stale_evidence");

  const contract = state.shape?.contract;
  if (!contract) {
    blockers.push("missing_contract");
    return { ready: false, blockers, contractDigest: null, summary: null };
  }

  const contractDigest = computeContractDigest(contract);
  if (!state.contractDigest || state.contractDigest !== contractDigest)
    blockers.push("contract_digest_mismatch");
  if (contract.tasks.length === 0) blockers.push("empty_tasks");
  if (contract.acceptanceCriteria.length === 0) blockers.push("empty_acceptance_criteria");
  if (contract.validations.length === 0) blockers.push("empty_validations");

  return {
    ready: blockers.length === 0,
    blockers,
    contractDigest,
    summary: {
      objective: resolveObjective(state),
      taskCount: contract.tasks.length,
      criterionCount: contract.acceptanceCriteria.length,
      validationCount: contract.validations.length,
      riskLevel: contract.risk,
      riskControlCount: contract.risks.length,
    },
  };
}

export function evaluateAutonomousGateEligibility(
  state: TaskState,
  options?: { issueRef?: string },
): AutonomousGateEligibility {
  const reasons: string[] = [];
  if (state.risk !== "low" && state.risk !== "medium") reasons.push("risk_requires_human_gate");
  if (state.design.activeQuestion !== undefined) reasons.push("active_design_question");
  if (state.shape?.technicalDecisions?.some((d) => d.status !== "resolved" || d.adrQualified)) {
    reasons.push("technical_decision_requires_human_gate");
  }
  if (!GATE_ISSUE_REF.test(options?.issueRef ?? "")) reasons.push("invalid_or_missing_issue_ref");
  const preflight = preflightGate(state);
  if (!preflight.ready) reasons.push("preflight_blocked", ...preflight.blockers);
  return { eligible: reasons.length === 0, reasons: Array.from(new Set(reasons)) };
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
  return state.shape?.contract
    ? renderPlanProjection(state.shape.contract)
    : `${renderGateCard(state)}\n\nAucun contrat canonique disponible.\n`;
}

export function parseGateIntent(input: string): GateIntent {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "empty" };
  const lower = trimmed.toLowerCase();
  if (lower === "approuver" || lower === "approve") return { kind: "approve" };
  if (lower === "rejeter" || lower === "reject") return { kind: "reject" };
  if (lower === "voir" || lower === "view") return { kind: "view" };
  if (lower === "modifier" || lower === "change")
    return { kind: "invalid", reason: "instruction_required" };
  const match = /^(?:modifier|change)\s*:(.*)$/is.exec(trimmed);
  if (!match) return { kind: "ambiguous", input: trimmed };

  const raw = match[1] ?? "";
  if (/[\r\n]/.test(raw)) return { kind: "invalid", reason: "multiline_instruction" };
  const instruction = raw.trim();
  if (!instruction) return { kind: "invalid", reason: "instruction_required" };
  if (instruction.length > MAX_GATE_INSTRUCTION)
    return { kind: "invalid", reason: "instruction_too_long" };
  return { kind: "change", instruction };
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
    if (!preflight.ready || !preflight.contractDigest || !state.shape?.contract) {
      failBlocked(`Gate approval blocked: ${preflight.blockers.join(", ")}`);
    }
    if (input.decision === "autonomous") {
      const eligibility = evaluateAutonomousGateEligibility(
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

export function createTaskStateStore(
  workspaceRoot: string,
  options?: WorkspaceStoreOptions,
): TaskStateStore {
  const store = createWorkspaceStore(workspaceRoot, options);

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

  const save = async (
    taskId: string,
    rawState: unknown,
    saveOptions?: TaskSaveOptions,
  ): Promise<TaskState> => {
    const relativePath = assertValidTaskId(taskId);
    const validated = validateTaskState(rawState);
    if (validated.taskId !== taskId) {
      throw new StateStoreError(
        "state_task_mismatch",
        `Cannot save taskId '${validated.taskId}' under '${relativePath}'`,
      );
    }
    if (saveOptions?.expectedRevision !== undefined) {
      const currentText = await store.readText(relativePath, true);
      if (currentText === undefined) {
        if (saveOptions.expectedRevision !== 0) {
          throw new StateStoreError(
            "state_conflict",
            `Task '${taskId}' missing on disk while expectedRevision=${saveOptions.expectedRevision}`,
          );
        }
      } else {
        const current = parseTaskJson(taskId, currentText) as Partial<TaskState>;
        if (current.revision !== saveOptions.expectedRevision) {
          throw new StateStoreError(
            "state_conflict",
            `Task '${taskId}' revision conflict: expected ${saveOptions.expectedRevision}, found ${String(current.revision)}`,
          );
        }
      }
    }
    await store.writeTextAtomically(
      relativePath,
      `${JSON.stringify(canonicalize(validated), null, 2)}\n`,
    );
    return validated;
  };

  const gate = async (
    taskId: string,
    decisionInput?: GateDecisionInput,
  ): Promise<GateDecisionOutcome> => {
    const current = await load(taskId);
    if (!decisionInput) {
      const preflight = preflightGate(current);
      return { preflight, card: renderGateCard(current, preflight), state: current };
    }
    const outcome = applyTaskGateDecision(current, decisionInput);
    const persisted = await save(taskId, outcome.state, { expectedRevision: current.revision });
    return { ...outcome, state: persisted };
  };

  return { workspaceRoot: store.workspaceRoot, store, load, save, gate };
}
