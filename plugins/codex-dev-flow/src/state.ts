import { createHash } from "node:crypto";
import {
  assuranceSucceeded,
  completeAssurance as completeAssuranceIndex,
  invalidateAssuranceEvidence,
  recordAssuranceIssue as recordAssuranceIssueIndex,
  recordCorrectionAttempt as recordCorrectionAttemptIndex,
  recordAssuranceEvidence,
  resolveAssuranceIssue as resolveAssuranceIssueIndex,
  setPendingHumanObservation,
  validateAssuranceState,
  type AssuranceCompletionInput,
  type EvidenceObservation,
} from "./assurance.js";
import {
  createDesignState,
  designComplete,
  validateDesignState,
  type DesignState,
} from "./design.js";
import { preflightGate } from "./gate.js";
import {
  GUARD_IDS,
  STATE_MACHINE,
  deriveMacroPhase,
  isOperationalResumeTarget,
  isTerminalStatus,
  isTaskStatus,
  type GuardId,
  type TaskStatus,
  type TransitionContract,
} from "./state-machine.js";
import { ROUTING_POLICY_VERSION } from "./routing.js";
import {
  createShapeState,
  evaluateContractCompleteness,
  evaluateDiscoveryCompleteness,
  validateShapeState,
  type DiscoveryReceipt,
  type PlanningReceipt,
  type ShapeState,
} from "./shape.js";
import { validateStateV6 } from "./state-validator.js";
import type {
  ActiveArtifactReference,
  ActiveWorktreeReference,
  ContextCapsule,
  EvaluatorReceiptRecord,
  GateDecisionRecord,
  GuardEvidenceRecord,
  HistoryReferenceKind,
  IntakeState,
  Policy,
  PlanApprovalReceipt,
  RiskLevel,
  RoutingDecision,
  RoutingSnapshot,
  StateHistoryEvent,
  TaskState,
  PendingHumanObservation,
  AssuranceIssue,
  WorkflowHistoryEvent,
  WorkflowHistoryEventType,
} from "./types.js";

export {
  STATE_MACHINE,
  TASK_STATUSES,
  buildStateMachineProjection,
  deriveMacroPhase,
} from "./state-machine.js";
export type { GuardId, MacroPhase, TaskStatus } from "./state-machine.js";

export interface CreateTaskInput {
  taskId: string;
  risk: RiskLevel;
  configSnapshot: Record<string, unknown>;
  policySnapshot: Policy;
  routingSnapshot?: RoutingSnapshot;
  activeArtifact?: ActiveArtifactReference;
  activeWorktree?: ActiveWorktreeReference;
  contextCapsule?: ContextCapsule;
  intake?: IntakeState;
  shape?: ShapeState;
  design?: DesignState;
  benchmarkEnabled?: boolean;
  at?: string;
}

export type GuardEvidenceProvenance =
  | "deterministic-check"
  | "human-approval"
  | "repository-observation";
export type GuardEvidence = GuardEvidenceRecord;
export type GateDecision = GateDecisionRecord;

export interface TransitionOptions {
  resumeTo?: TaskStatus;
  resumeReason?: string;
  terminalSource?: TaskStatus;
  guardEvidence?: readonly GuardEvidence[];
  gateDecision?: GateDecision;
  contractDigest?: string;
  at?: string;
}

export interface RecordHistoryEventInput {
  type: Exclude<WorkflowHistoryEventType, "task.created">;
  refs: WorkflowHistoryEvent["refs"];
  at?: string;
}

export interface ResumeContextInput {
  activeArtifact?: ActiveArtifactReference | null;
  activeWorktree?: ActiveWorktreeReference | null;
  contextCapsule?: ContextCapsule;
  at?: string;
}

export const HISTORY_LIMIT = 200;
export const HISTORY_REFERENCE_LIMIT = 16;
export const HISTORY_REFERENCE_TOTAL_CHARS = 4096;

export interface CreateGuardAttestationInput {
  observedFingerprint: string;
  evidenceRefs: readonly string[];
  provenance: GuardEvidenceProvenance;
  result?: "passed" | "not_applicable";
}

export interface CreateGateDecisionInput {
  decision: GateDecision["decision"];
  instructionRef?: string;
  at?: string;
}
export class StateValidationError extends Error {
  constructor(
    readonly code: "state_schema_incompatible" | "state_invalid",
    message: string,
  ) {
    super(message);
    this.name = "StateValidationError";
  }
}

export function createState(input: CreateTaskInput): TaskState {
  if (!nonEmpty(input.taskId) || !isRisk(input.risk))
    throw new Error("createState requires taskId and risk.");
  const contextCapsule =
    input.contextCapsule ?? defaultContextCapsule(input.configSnapshot, input.policySnapshot);
  const state: TaskState = {
    schemaVersion: 6,
    taskId: input.taskId,
    status: "new",
    revision: 0,
    risk: input.risk,
    configSnapshot: copy(input.configSnapshot),
    policySnapshot: copy(input.policySnapshot),
    issues: [],
    history: [
      {
        sequence: 1,
        at: normalizeEventAt(input.at),
        type: "task.created",
        refs: [{ kind: "task", ref: "state:taskId" }],
      },
    ],
    ...(input.activeArtifact ? { activeArtifact: copy(input.activeArtifact) } : {}),
    ...(input.activeWorktree ? { activeWorktree: copy(input.activeWorktree) } : {}),
    contextCapsule: copy(contextCapsule),
    ...(input.intake ? { intake: copy(input.intake) } : {}),
    ...(input.shape ? { shape: copy(input.shape) } : {}),
    design: copy(input.design ?? createDesignState()),
    benchmarkEnabled: input.benchmarkEnabled ?? false,
    ...(input.routingSnapshot ? { routingSnapshot: copy(input.routingSnapshot) } : {}),
    routingPolicyVersion: ROUTING_POLICY_VERSION,
    routingDecisions: [],
  };
  assertStateV6(state);
  return state;
}

export function loadStateV6(value: unknown): TaskState {
  if (!isRecord(value) || value.schemaVersion !== 6) {
    const version = isRecord(value) ? String(value.schemaVersion) : "missing";
    throw new StateValidationError(
      "state_schema_incompatible",
      `Task state schema ${version} is incompatible; schemaVersion 6 required. No migration is available.`,
    );
  }
  assertStateV6(value);
  return copy(value as TaskState);
}

export function assertStateV6(value: unknown): asserts value is TaskState {
  const result = validateStateV6(value);
  if (!result.valid)
    throw new StateValidationError(
      "state_invalid",
      `Task state V6 schema validation failed: ${JSON.stringify(result.errors.slice(0, 3))}`,
    );
  const state = value as TaskState;
  if (!isTaskStatus(state.status) || !isRisk(state.risk))
    throw new StateValidationError("state_invalid", "Task state V6 status or risk is invalid.");
  try {
    validateDesignState(state.design);
  } catch (error) {
    throw new StateValidationError(
      "state_invalid",
      `Persisted DesignState is invalid: ${error instanceof Error ? error.message : "unknown error"}.`,
    );
  }
  validateHistory(state);
  const intakeQuestionId =
    state.design.activeQuestion?.owner === "intake" ? state.design.activeQuestion.id : undefined;
  if (state.intake?.activeQuestionId !== intakeQuestionId)
    throw new StateValidationError(
      "state_invalid",
      "INTAKE active-question reference must match DesignState authority.",
    );
  if (state.intake && state.intake.risk !== state.risk)
    throw new StateValidationError(
      "state_invalid",
      "Task risk contradicts INTAKE assessment risk.",
    );
  if (state.shape) {
    try {
      validateShapeState(state.shape);
    } catch (error) {
      throw new StateValidationError(
        "state_invalid",
        `Persisted ShapeState is invalid: ${error instanceof Error ? error.message : "unknown error"}.`,
      );
    }
    if (
      state.shape.risk !== state.risk ||
      state.shape.productBaselineRef !== "state:design.productBaseline"
    )
      throw new StateValidationError(
        "state_invalid",
        "Shape state is not bound to current Product Baseline and risk.",
      );
  }
  if (
    [
      "discovering",
      "awaiting_shape_decision",
      "awaiting_profile_choice",
      "planning",
      "awaiting_intake_decision",
      "awaiting_approval",
      "executing",
      "assuring",
    ].includes(state.status) &&
    !state.shape
  ) {
    throw new StateValidationError(
      "state_invalid",
      `Task status ${state.status} requires persisted ShapeState.`,
    );
  }
  if (state.status === "blocked") {
    if (
      !state.resumeTo ||
      !isOperationalResumeTarget(state.resumeTo) ||
      !nonEmpty(state.resumeReason)
    )
      throw new StateValidationError(
        "state_invalid",
        "Blocked state requires exact operational resume metadata.",
      );
  } else if (state.resumeTo !== undefined || state.resumeReason !== undefined)
    throw new StateValidationError("state_invalid", "Only blocked may contain resume metadata.");
  if (state.status === "awaiting_approval" && !nonEmpty(state.contractDigest))
    throw new StateValidationError("state_invalid", "awaiting_approval requires contract digest.");
  if (state.planApproval) validatePlanApproval(state, state.planApproval);
  if (["executing", "assuring"].includes(state.status) && !state.planApproval)
    throw new StateValidationError(
      "state_invalid",
      `${state.status} requires current PlanApprovalReceipt.`,
    );
  if (state.assurance) {
    const contract = state.shape?.contract?.assuranceContract;
    if (!contract)
      throw new StateValidationError(
        "state_invalid",
        "AssuranceState requires canonical assuranceContract.",
      );
    try {
      validateAssuranceState(contract, state.assurance);
    } catch (error) {
      throw new StateValidationError(
        "state_invalid",
        `Persisted AssuranceState is invalid: ${error instanceof Error ? error.message : "unknown error"}.`,
      );
    }
  }
  const succeeded = assuranceSucceeded(state.assurance);
  const completedEvent = state.history.at(-1)?.type === "assure.completed";
  if (succeeded !== completedEvent)
    throw new StateValidationError(
      "state_invalid",
      "AssuranceReceipt and assure.completed must be paired.",
    );
  if (succeeded) {
    const receipt = state.assurance?.receipt;
    if (
      state.status !== "assuring" ||
      receipt?.taskId !== state.taskId ||
      receipt.contractDigest !== state.shape?.contract?.digest
    )
      throw new StateValidationError(
        "state_invalid",
        "Completed ASSURE is bound to another task or contract.",
      );
  }
}

export function guardStateFingerprint(state: TaskState): string {
  return digest({
    schemaVersion: state.schemaVersion,
    taskId: state.taskId,
    status: state.status,
    revision: state.revision,
    risk: state.risk,
    resumeTo: state.resumeTo,
    resumeReason: state.resumeReason,
    contractDigest: state.contractDigest,
    planApproval: state.planApproval,
    assurance: state.assurance,
    configSnapshot: state.configSnapshot,
    policySnapshot: state.policySnapshot,
    routingSnapshot: state.routingSnapshot,
    routingDecisions: state.routingDecisions,
    intake: state.intake,
    shape: state.shape,
    design: state.design,
    issues: state.issues,
  });
}

export function isTaskTerminal(state: TaskState): boolean {
  assertStateV6(state);
  return isTerminalStatus(state.status, assuranceSucceeded(state.assurance));
}

export function createGuardAttestation(
  state: TaskState,
  guard: GuardId,
  input: CreateGuardAttestationInput,
): GuardEvidence {
  assertStateV6(state);
  if (!GUARD_ID_SET.has(guard)) throw new Error(`Unknown transition guard ${guard}.`);
  if (guard === "intake_complete") {
    validateCompleteIntake(state);
    return createEvaluatorEvidence(state, guard, "deterministic-check", {
      evaluator: "intake",
      outcome: "intake_complete",
      inputDigest: digest(state.intake),
      evidenceRefs: [...input.evidenceRefs],
      subjectIds: ["objective", "success_signal", "risk"],
      completedIds: ["objective", "success_signal", "risk"],
    });
  }
  if (TRUSTED_GUARDS.has(guard)) throw new Error(`Guard ${guard} requires trusted evaluator.`);
  if (guard === "profile_selected") validateSelectedProfile(state);
  if (guard === "approval_current") {
    if (!state.planApproval) throw new Error("approval_current requires PlanApprovalReceipt.");
    validatePlanApproval(state, state.planApproval);
  }
  const evidence: GuardEvidence = {
    schemaVersion: 1,
    guard,
    stateRevision: state.revision,
    stateFingerprint: guardStateFingerprint(state),
    observedFingerprint: input.observedFingerprint,
    evidenceRefs: [...input.evidenceRefs],
    provenance: input.provenance,
    result: input.result ?? "passed",
  };
  validateGuardEvidence(state, evidence);
  return evidence;
}

const trustedEvidence = new WeakSet<object>();

export function evaluateDiscoveryGuard(state: TaskState, receipt: DiscoveryReceipt): GuardEvidence {
  assertStateV6(state);
  if (!state.shape || !evaluateDiscoveryCompleteness(state.shape).complete)
    throw new Error("Discovery evaluator requires current complete Shape Discovery.");
  const current = state.shape.evaluatorReceipts.find(
    (candidate): candidate is DiscoveryReceipt =>
      candidate.evaluator === "discovery" && candidate.receiptDigest === receipt.receiptDigest,
  );
  if (!current || digestWithoutReceipt(current) !== digestWithoutReceipt(receipt))
    throw new Error("Discovery receipt is stale or not persisted.");
  return createEvaluatorEvidence(state, "discovery_sufficient", "repository-observation", {
    evaluator: "discovery",
    outcome: "discovery_sufficient",
    inputDigest: receipt.inputDigest,
    evidenceRefs: receipt.evidenceRefs,
    subjectIds: receipt.subjectIds,
    completedIds: receipt.completedIds,
  });
}

export function evaluatePlanningGuard(state: TaskState, receipt: PlanningReceipt): GuardEvidence {
  assertStateV6(state);
  if (
    !state.shape ||
    !evaluateContractCompleteness(state.shape).complete ||
    (state.shape.contract?.digest !== state.contractDigest && state.status === "awaiting_approval")
  )
    throw new Error("Planning evaluator requires current complete Shape contract.");
  const current = state.shape.evaluatorReceipts.find(
    (candidate): candidate is PlanningReceipt =>
      candidate.evaluator === "planning" && candidate.receiptDigest === receipt.receiptDigest,
  );
  if (!current || digestWithoutReceipt(current) !== digestWithoutReceipt(receipt))
    throw new Error("Planning receipt is stale or not persisted.");
  return createEvaluatorEvidence(state, "contract_complete", "deterministic-check", {
    evaluator: "planning",
    outcome: "contract_complete",
    inputDigest: receipt.inputDigest,
    evidenceRefs: receipt.evidenceRefs,
    subjectIds: receipt.subjectIds,
    completedIds: receipt.completedIds,
  });
}

export function createGateDecision(state: TaskState, input: CreateGateDecisionInput): GateDecision {
  assertStateV6(state);
  const unknown = Object.keys(input).filter(
    (key) => !["decision", "instructionRef", "at"].includes(key),
  );
  if (unknown.length) throw new Error(`Unknown Gate decision fields: ${unknown.join(", ")}.`);
  if (!(["approved", "change_requested", "rejected"] as const).includes(input.decision))
    throw new Error("Gate decision kind is invalid.");
  if (input.at !== undefined && !validAt(input.at))
    throw new Error("Gate decision time is invalid.");
  const contract = state.shape?.contract;
  if (state.status !== "awaiting_approval" || !state.contractDigest || !contract)
    throw new Error("Gate decision requires current canonical contract.");
  const preflight = preflightGate(state);
  if (!preflight.ready) throw new Error(`Gate preflight failed: ${preflight.reason}.`);
  if (input.decision === "change_requested" && !nonEmpty(input.instructionRef))
    throw new Error("Gate change request requires structured instruction reference.");
  if (input.instructionRef !== undefined && !REF.test(input.instructionRef))
    throw new Error("Gate instruction reference is invalid.");
  if (input.decision !== "change_requested" && input.instructionRef !== undefined)
    throw new Error("Only Gate change request may contain instruction reference.");
  const base = {
    schemaVersion: 1 as const,
    decision: input.decision,
    actor: "user" as const,
    decidedAt: normalizeEventAt(input.at),
    taskId: state.taskId,
    artifactId: contract.artifactId,
    stateRevision: state.revision,
    stateFingerprint: guardStateFingerprint(state),
    contractDigest: state.contractDigest,
    ...(input.instructionRef ? { instructionRef: input.instructionRef } : {}),
  };
  return { ...base, receiptDigest: digest(base) };
}

export function updateShapeState(
  state: TaskState,
  shape: ShapeState,
  input: {
    type: Extract<
      WorkflowHistoryEventType,
      | "discovery.target_recorded"
      | "discovery.evidence_recorded"
      | "discovery.completed"
      | "profile.choice_requested"
      | "profile.choice_recorded"
      | "contract.projected"
      | "projection.reconciliation_requested"
      | "evidence.invalidated"
      | "shape.checkpoint"
    >;
    refs: WorkflowHistoryEvent["refs"];
    at?: string;
  },
): TaskState {
  assertStateV6(state);
  if (assuranceSucceeded(state.assurance)) throw new Error("Completed ASSURE is immutable.");
  if (deriveMacroPhase(state) !== "SHAPE" && state.status !== "awaiting_intake_decision") {
    throw new Error(
      "ShapeState may change only in SHAPE or while resolving linked Intake escalation.",
    );
  }
  if (
    !isRisk(shape.risk) ||
    shape.risk !== state.risk ||
    shape.productBaselineRef !== "state:design.productBaseline"
  )
    throw new Error("Shape update must remain bound to current Product Baseline and risk.");
  const contractChanged = state.shape?.contract?.digest !== shape.contract?.digest;
  const {
    planApproval: _approval,
    assurance: _assurance,
    contractDigest: _contractDigest,
    ...withoutReceipts
  } = state;
  return recordHistoryEvent(
    contractChanged
      ? {
          ...withoutReceipts,
          shape: copy(shape),
          ...(shape.contract ? { contractDigest: shape.contract.digest } : {}),
        }
      : { ...state, shape: copy(shape) },
    input,
  );
}

export function updateDesignState(
  state: TaskState,
  design: DesignState,
  input: {
    type: Extract<
      WorkflowHistoryEventType,
      "design.question_recorded" | "design.answer_recorded" | "design.invalidated"
    >;
    refs: WorkflowHistoryEvent["refs"];
    at?: string;
  },
): TaskState {
  assertStateV6(state);
  validateDesignState(design);
  if (!["INTAKE", "SHAPE"].includes(deriveMacroPhase(state)))
    throw new Error("DesignState may change only in INTAKE or SHAPE.");
  const intake = alignIntakeQuestionReference(state.intake, design);
  const { planApproval: _approval, assurance: _assurance, ...base } = state;
  return recordHistoryEvent(
    { ...base, design: copy(design), ...(intake ? { intake } : {}) },
    input,
  );
}

function alignIntakeQuestionReference(
  intake: IntakeState | undefined,
  design: DesignState,
): IntakeState | undefined {
  const questionId =
    design.activeQuestion?.owner === "intake" ? design.activeQuestion.id : undefined;
  if (!intake) {
    if (questionId) throw new Error("INTAKE design question requires IntakeState.");
    return undefined;
  }
  const { activeQuestionId: _activeQuestionId, ...base } = intake;
  return { ...base, ...(questionId ? { activeQuestionId: questionId } : {}) };
}

export function recordAssuranceObservation(
  state: TaskState,
  observation: EvidenceObservation,
): TaskState {
  assertStateV6(state);
  if (!["executing", "assuring"].includes(state.status))
    throw new Error("Assurance evidence may be recorded only in BUILD or ASSURE.");
  const contract = requireAssuranceContract(state);
  const assurance = recordAssuranceEvidence(contract, state.assurance, observation);
  return recordHistoryEvent(
    { ...state, assurance },
    {
      type: "assurance.evidence_recorded",
      refs: [
        { kind: "evidence", ref: observation.evidenceId },
        { kind: "command", ref: observation.operationId },
      ],
      ...(observation.recordedAt ? { at: observation.recordedAt } : {}),
    },
  );
}

export function invalidateAssurance(
  state: TaskState,
  changedScopeRefs: readonly string[],
  at?: string,
): TaskState {
  assertStateV6(state);
  if (!state.assurance) return state;
  const assurance = invalidateAssuranceEvidence(
    requireAssuranceContract(state),
    state.assurance,
    changedScopeRefs,
  );
  return recordHistoryEvent(
    { ...state, assurance },
    {
      type: "assurance.evidence_invalidated",
      refs: changedScopeRefs.slice(0, HISTORY_REFERENCE_LIMIT).map((ref) => ({
        kind: "scope" as const,
        ref,
      })),
      ...(at ? { at } : {}),
    },
  );
}

export function requestHumanObservation(
  state: TaskState,
  pending: PendingHumanObservation,
): TaskState {
  assertStateV6(state);
  if (state.status !== "assuring") throw new Error("Human observation belongs to ASSURE.");
  const assurance = setPendingHumanObservation(
    requireAssuranceContract(state),
    state.assurance,
    pending,
  );
  return recordHistoryEvent(
    { ...state, assurance },
    {
      type: "assurance.human_observation_requested",
      refs: [{ kind: "evidence", ref: pending.requestId }],
      at: pending.requestedAt,
    },
  );
}

export function recordTaskAssuranceIssue(
  state: TaskState,
  issue: Omit<AssuranceIssue, "status" | "correctionAttempts" | "rootCauseRequired">,
  at?: string,
): TaskState {
  assertStateV6(state);
  if (state.status !== "assuring") throw new Error("Assurance issues belong to ASSURE.");
  const assurance = recordAssuranceIssueIndex(
    requireAssuranceContract(state),
    state.assurance ?? { schemaVersion: 1, evidenceIndex: [], issues: [] },
    issue,
  );
  return recordHistoryEvent(
    { ...state, assurance },
    {
      type: "issue.recorded",
      refs: [
        { kind: "issue", ref: issue.issueId },
        { kind: "evidence", ref: issue.evidenceRef },
      ],
      ...(at ? { at } : {}),
    },
  );
}

export function recordTaskCorrectionAttempt(
  state: TaskState,
  issueId: string,
  at?: string,
): TaskState {
  assertStateV6(state);
  if (state.status !== "assuring" || !state.assurance)
    throw new Error("Assurance correction requires active ASSURE issue state.");
  const assurance = recordCorrectionAttemptIndex(
    requireAssuranceContract(state),
    state.assurance,
    issueId,
  );
  return recordHistoryEvent(
    { ...state, assurance },
    {
      type: "correction.recorded",
      refs: [{ kind: "issue", ref: issueId }],
      ...(at ? { at } : {}),
    },
  );
}

export function resolveTaskAssuranceIssue(
  state: TaskState,
  issueId: string,
  at?: string,
): TaskState {
  assertStateV6(state);
  if (state.status !== "assuring" || !state.assurance)
    throw new Error("Assurance issue resolution requires active ASSURE issue state.");
  const assurance = resolveAssuranceIssueIndex(
    requireAssuranceContract(state),
    state.assurance,
    issueId,
  );
  return recordHistoryEvent(
    { ...state, assurance },
    {
      type: "assurance.issue_resolved",
      refs: [{ kind: "issue", ref: issueId }],
      ...(at ? { at } : {}),
    },
  );
}

export function completeAssurance(
  state: TaskState,
  input: Omit<AssuranceCompletionInput, "taskId" | "contractDigest">,
): TaskState {
  assertStateV6(state);
  if (state.status !== "assuring" || !state.assurance)
    throw new Error("ASSURE completion requires active assuring state and evidence.");
  const completedAt = input.completedAt ?? new Date().toISOString();
  const assurance = completeAssuranceIndex(requireAssuranceContract(state), state.assurance, {
    ...input,
    taskId: state.taskId,
    contractDigest: state.shape?.contract?.digest ?? "",
    completedAt,
  });
  const event: WorkflowHistoryEvent = {
    sequence: nextSequence(state),
    at: completedAt,
    type: "assure.completed",
    refs: [
      { kind: "receipt", ref: assurance.receipt?.receiptDigest ?? "receipt:missing" },
      { kind: "evidence", ref: assurance.receipt?.evidenceIndexDigest ?? "evidence:missing" },
    ],
  };
  return compactAndValidate({ ...state, assurance, history: [...state.history, event] });
}

export function addRoutingDecision(state: TaskState, decision: RoutingDecision): TaskState {
  assertStateV6(state);
  return { ...state, routingDecisions: [...(state.routingDecisions ?? []), copy(decision)] };
}

export function recordHistoryEvent(state: TaskState, input: RecordHistoryEventInput): TaskState {
  assertStateV6(state);
  if (STATE_MACHINE[state.status].terminal || assuranceSucceeded(state.assurance))
    throw new Error("Terminal state history is immutable.");
  validateHistoryReferences(input.refs, `Workflow event ${input.type}`);
  const event: WorkflowHistoryEvent = {
    sequence: nextSequence(state),
    at: normalizeEventAt(input.at),
    type: input.type,
    refs: copy(input.refs),
  };
  return compactAndValidate({ ...state, history: [...state.history, event] });
}

export function updateResumeContext(state: TaskState, input: ResumeContextInput): TaskState {
  assertStateV6(state);
  const { activeArtifact: _a, activeWorktree: _w, ...base } = state;
  const updated: TaskState = {
    ...base,
    ...(input.activeArtifact === undefined
      ? state.activeArtifact
        ? { activeArtifact: copy(state.activeArtifact) }
        : {}
      : input.activeArtifact === null
        ? {}
        : { activeArtifact: copy(input.activeArtifact) }),
    ...(input.activeWorktree === undefined
      ? state.activeWorktree
        ? { activeWorktree: copy(state.activeWorktree) }
        : {}
      : input.activeWorktree === null
        ? {}
        : { activeWorktree: copy(input.activeWorktree) }),
    contextCapsule: input.contextCapsule
      ? copy(input.contextCapsule)
      : copy(
          state.contextCapsule ?? defaultContextCapsule(state.configSnapshot, state.policySnapshot),
        ),
  };
  return recordHistoryEvent(updated, {
    type: "context.updated",
    refs: [{ kind: "context-capsule", ref: "state:contextCapsule" }],
    ...(input.at ? { at: input.at } : {}),
  });
}

export function transition(
  state: TaskState,
  next: TaskStatus,
  options: TransitionOptions = {},
): TaskState {
  assertStateV6(state);
  if (assuranceSucceeded(state.assurance)) throw new Error("Completed ASSURE is immutable.");
  validateTransitionOptionKeys(options);
  if (!isTaskStatus(next))
    throw new Error(`Invalid state transition from ${state.status} to ${String(next)}.`);
  const contract = transitionContract(state.status, next);
  if (!contract) throw new Error(`Invalid state transition from ${state.status} to ${next}.`);
  const structural = validateStructuralGuards(state, next, options, contract.guards);
  const evidence = validateEvidenceSet(state, options.guardEvidence ?? [], contract.guards);
  const missing = contract.guards.filter(
    (guard) =>
      !structural.has(guard) &&
      evidence.get(guard)?.result !== "passed" &&
      evidence.get(guard)?.result !== "not_applicable",
  );
  if (missing.length)
    throw new Error(
      `Unmet transition guards from ${state.status} to ${next}: ${missing.join(", ")}.`,
    );
  const sourceFingerprint = guardStateFingerprint(state);
  const metadata = transitionMetadata(state, next, options);
  const eventAt = normalizeEventAt(options.at);
  const event: StateHistoryEvent = {
    sequence: nextSequence(state),
    at: eventAt,
    type: "state.transition",
    from: state.status,
    to: next,
    revision: state.revision + 1,
    sourceFingerprint,
    ...(next === "cancelled" || next === "failed"
      ? {
          terminalSource: state.status,
          ...(state.status === "blocked" && state.resumeTo
            ? { terminalResumeTo: state.resumeTo }
            : {}),
        }
      : {}),
    ...(next === "awaiting_approval" || options.gateDecision
      ? { contractDigest: metadata.contractDigest ?? state.contractDigest }
      : {}),
    ...(evidence.size ? { guardEvidence: [...evidence.values()].map(copy) } : {}),
    ...(options.gateDecision ? { gateDecision: copy(options.gateDecision) } : {}),
  };
  let shape = state.shape;
  if (next === "discovering" && !shape)
    shape = createShapeState({
      risk: state.risk,
      productBaselineRef: "state:design.productBaseline",
    });
  const {
    resumeTo: _resume,
    resumeReason: _resumeReason,
    planApproval: _approval,
    assurance: _assurance,
    ...base
  } = state;
  const approvedDecision =
    options.gateDecision?.decision === "approved"
      ? (options.gateDecision as PlanApprovalReceipt)
      : undefined;
  const planApproval = approvedDecision
    ? approvedDecision
    : next === "planning" || next === "intaking" || next === "discovering"
      ? undefined
      : state.planApproval;
  const assurance = ["planning", "intaking", "discovering", "awaiting_shape_decision"].includes(
    next,
  )
    ? undefined
    : state.assurance;
  const output: TaskState = {
    ...base,
    status: next,
    revision: state.revision + 1,
    ...metadata,
    ...(shape ? { shape } : {}),
    ...(planApproval ? { planApproval: copy(planApproval) } : {}),
    ...(assurance ? { assurance: copy(assurance) } : {}),
    history: [...state.history, event],
  };
  return compactAndValidate(output);
}

export function compareSnapshot(
  state: Pick<TaskState, "configSnapshot" | "policySnapshot" | "routingSnapshot">,
  current: { config: unknown; policy: unknown; routingSnapshot?: RoutingSnapshot },
): { changed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (stable(state.configSnapshot) !== stable(current.config)) reasons.push("config_changed");
  if (stable(state.policySnapshot) !== stable(current.policy)) reasons.push("policy_changed");
  if (
    state.routingSnapshot &&
    current.routingSnapshot &&
    routingStable(state.routingSnapshot) !== routingStable(current.routingSnapshot)
  )
    reasons.push("routing_changed");
  return { changed: reasons.length > 0, reasons };
}

function transitionMetadata(
  state: TaskState,
  next: TaskStatus,
  options: TransitionOptions,
): {
  resumeTo?: TaskStatus;
  resumeReason?: string;
  contractDigest?: string;
} {
  if (next === "blocked")
    return {
      resumeTo: options.resumeTo!,
      resumeReason: options.resumeReason!,
      ...(state.contractDigest ? { contractDigest: state.contractDigest } : {}),
    };
  if (next === "awaiting_approval") {
    const contractDigest = options.contractDigest;
    if (!nonEmpty(contractDigest))
      throw new Error("awaiting_approval requires current contract digest.");
    return { contractDigest };
  }
  return state.contractDigest ? { contractDigest: state.contractDigest } : {};
}

function requireAssuranceContract(state: TaskState) {
  const contract = state.shape?.contract?.assuranceContract;
  if (!contract) throw new Error("Canonical assuranceContract is missing.");
  return contract;
}

function validateStructuralGuards(
  state: TaskState,
  next: TaskStatus,
  options: TransitionOptions,
  required: readonly GuardId[],
): Set<GuardId> {
  const satisfied = new Set<GuardId>();
  if (required.includes("task_initialized")) {
    if (
      !nonEmpty(state.taskId) ||
      !isRecord(state.configSnapshot) ||
      !isRecord(state.policySnapshot)
    )
      throw new Error("task_initialized failed.");
    satisfied.add("task_initialized");
  }
  if (required.includes("resume_metadata_valid")) {
    if (next === "blocked") {
      if (
        !options.resumeTo ||
        !isOperationalResumeTarget(options.resumeTo) ||
        !nonEmpty(options.resumeReason)
      )
        throw new Error("blocked requires operational resumeTo and resumeReason.");
    } else if (state.status === "blocked") {
      if (next !== state.resumeTo)
        throw new Error(`blocked may transition only to exact resumeTo ${state.resumeTo}.`);
    } else throw new Error(`resume_metadata_valid is not applicable from ${state.status}.`);
    satisfied.add("resume_metadata_valid");
  }
  if (required.includes("terminal_source_recorded")) {
    if (options.terminalSource !== state.status)
      throw new Error(`${next} requires terminalSource equal to ${state.status}.`);
    satisfied.add("terminal_source_recorded");
  }
  if (required.includes("gate_decision_valid")) {
    if (!options.gateDecision) throw new Error("Gate exit requires decision.");
    validateGateDecision(state, options.gateDecision);
    if (!gateDecisionAllows(options.gateDecision, next))
      throw new Error(`Gate decision cannot transition to ${next}.`);
    satisfied.add("gate_decision_valid");
  }
  if (
    options.contractDigest !== undefined &&
    (state.status !== "planning" || next !== "awaiting_approval")
  )
    throw new Error("contractDigest may only enter GATE from Planning.");
  if (
    state.status === "planning" &&
    next === "awaiting_approval" &&
    state.shape?.contract?.digest !== options.contractDigest
  )
    throw new Error("GATE digest must match canonical Shape contract.");
  return satisfied;
}

function validateEvidenceSet(
  state: TaskState,
  items: readonly GuardEvidence[],
  required: readonly GuardId[],
): Map<GuardId, GuardEvidence> {
  const output = new Map<GuardId, GuardEvidence>();
  for (const item of items) {
    validateGuardEvidence(state, item);
    if (!required.includes(item.guard) || STRUCTURAL_GUARDS.has(item.guard))
      throw new Error(`Guard evidence for ${item.guard} is not applicable.`);
    if (TRUSTED_GUARDS.has(item.guard) && !trustedEvidence.has(item))
      throw new Error(
        `Guard ${item.guard} requires trusted evaluator evidence from current runtime.`,
      );
    if (output.has(item.guard)) throw new Error(`Duplicate guard evidence for ${item.guard}.`);
    output.set(item.guard, item);
  }
  return output;
}

function validateGuardEvidence(state: TaskState, evidence: GuardEvidence): void {
  if (
    evidence.schemaVersion !== 1 ||
    !GUARD_ID_SET.has(evidence.guard) ||
    evidence.stateRevision !== state.revision ||
    evidence.stateFingerprint !== guardStateFingerprint(state) ||
    !nonEmpty(evidence.observedFingerprint) ||
    !evidence.evidenceRefs?.length ||
    !evidence.evidenceRefs.every(nonEmpty) ||
    !["deterministic-check", "human-approval", "repository-observation"].includes(
      evidence.provenance,
    )
  )
    throw new Error(`Guard evidence for ${evidence.guard} is stale, malformed, or unproven.`);
  if (TRUSTED_GUARDS.has(evidence.guard)) validateEvaluatorReceipt(evidence, state);
  else if (evidence.evaluatorReceipt)
    throw new Error(`Guard ${evidence.guard} cannot contain evaluatorReceipt.`);
}

function createEvaluatorEvidence(
  state: TaskState,
  guard: Extract<GuardId, "intake_complete" | "discovery_sufficient" | "contract_complete">,
  provenance: GuardEvidenceProvenance,
  input: Omit<
    EvaluatorReceiptRecord,
    "schemaVersion" | "stateRevision" | "stateFingerprint" | "receiptDigest"
  >,
): GuardEvidence {
  if (!input.evidenceRefs.length)
    throw new Error(`${guard} evaluator requires evidence references.`);
  const base = {
    schemaVersion: 1 as const,
    ...input,
    stateRevision: state.revision,
    stateFingerprint: guardStateFingerprint(state),
  };
  const receipt: EvaluatorReceiptRecord = { ...base, receiptDigest: digest(base) };
  const evidence = deepFreeze({
    schemaVersion: 1 as const,
    guard,
    stateRevision: state.revision,
    stateFingerprint: guardStateFingerprint(state),
    observedFingerprint: receipt.receiptDigest,
    evidenceRefs: [...receipt.evidenceRefs],
    provenance,
    result: "passed" as const,
    evaluatorReceipt: receipt,
  });
  validateGuardEvidence(state, evidence);
  trustedEvidence.add(evidence);
  return evidence;
}

function validateEvaluatorReceipt(evidence: GuardEvidence, state: TaskState): void {
  const receipt = evidence.evaluatorReceipt;
  const evaluators: Partial<Record<GuardId, EvaluatorReceiptRecord["evaluator"]>> = {
    intake_complete: "intake",
    discovery_sufficient: "discovery",
    contract_complete: "planning",
  };
  if (
    !receipt ||
    receipt.evaluator !== evaluators[evidence.guard] ||
    receipt.stateRevision !== state.revision ||
    receipt.stateFingerprint !== guardStateFingerprint(state) ||
    receipt.receiptDigest !== digest({ ...receipt, receiptDigest: undefined }) ||
    evidence.observedFingerprint !== receipt.receiptDigest ||
    !sameIds(evidence.evidenceRefs, receipt.evidenceRefs)
  )
    throw new Error(`Trusted evaluator receipt for ${evidence.guard} is stale or malformed.`);
}

function validateGateDecision(state: TaskState, decision: GateDecision): void {
  if (
    state.status !== "awaiting_approval" ||
    decision.schemaVersion !== 1 ||
    !["approved", "change_requested", "rejected"].includes(decision.decision) ||
    decision.actor !== "user" ||
    decision.taskId !== state.taskId ||
    decision.artifactId !== state.shape?.contract?.artifactId ||
    decision.stateRevision !== state.revision ||
    decision.stateFingerprint !== guardStateFingerprint(state) ||
    decision.contractDigest !== state.contractDigest ||
    decision.receiptDigest !== digest({ ...decision, receiptDigest: undefined }) ||
    !validAt(decision.decidedAt) ||
    (decision.instructionRef !== undefined && !REF.test(decision.instructionRef)) ||
    (decision.decision === "change_requested") !== nonEmpty(decision.instructionRef)
  )
    throw new Error("Gate decision is stale or bound to another state.");
}

function validatePlanApproval(state: TaskState, receipt: TaskState["planApproval"] & {}): void {
  if (
    receipt.decision !== "approved" ||
    receipt.actor !== "user" ||
    receipt.taskId !== state.taskId ||
    receipt.artifactId !== state.shape?.contract?.artifactId ||
    receipt.receiptDigest !== digest({ ...receipt, receiptDigest: undefined }) ||
    !validAt(receipt.decidedAt) ||
    receipt.instructionRef !== undefined ||
    receipt.stateRevision >= state.revision ||
    receipt.contractDigest !== state.contractDigest ||
    receipt.contractDigest !== state.shape?.contract?.digest
  )
    throw new StateValidationError(
      "state_invalid",
      "PlanApprovalReceipt is stale or bound to another contract.",
    );
}

function gateDecisionAllows(decision: GateDecision, target: TaskStatus): boolean {
  return decision.decision === "approved"
    ? target === "executing"
    : decision.decision === "change_requested"
      ? target === "planning"
      : target === "cancelled";
}
function transitionContract(from: TaskStatus, to: TaskStatus): TransitionContract | undefined {
  return (STATE_MACHINE[from].transitions as Readonly<Record<string, TransitionContract>>)[to];
}

function validateCompleteIntake(state: TaskState): void {
  const intake = state.intake;
  if (
    !intake ||
    !designComplete(state.design) ||
    !intake.semanticComplete ||
    !intake.deterministicComplete ||
    intake.activeQuestionId ||
    intake.contradictions.length ||
    intake.blockedReason ||
    intake.risk !== state.risk
  )
    throw new Error("intake_complete requires complete current INTAKE assessment.");
}
function validateSelectedProfile(state: TaskState): void {
  const choice = state.shape?.preparationProfileChoice;
  if (
    !choice ||
    choice.status !== "selected" ||
    !choice.selectedProfile ||
    !nonEmpty(choice.selectionEvidenceRef)
  )
    throw new Error("profile_selected requires explicit persisted Quick/Plan answer.");
}

function validateHistory(state: TaskState): void {
  if (!Array.isArray(state.history) || !state.history.length)
    throw new StateValidationError("state_invalid", "Task state history is empty.");
  let previous = state.historySummary?.lastSequence ?? 0;
  let latestStatus: TaskStatus = state.historySummary?.lastTransition?.to ?? "new";
  let revision = state.historySummary?.lastTransition?.revision ?? 0;
  for (const event of state.history) {
    if (!Number.isInteger(event.sequence) || event.sequence <= previous || !validAt(event.at))
      throw new StateValidationError("state_invalid", "History sequence or timestamp is invalid.");
    previous = event.sequence;
    if (event.type === "state.transition") {
      const contract = transitionContract(event.from, event.to);
      if (
        !isTaskStatus(event.from) ||
        !isTaskStatus(event.to) ||
        event.from !== latestStatus ||
        !contract
      )
        throw new StateValidationError(
          "state_invalid",
          `History edge ${event.from} -> ${event.to} is invalid.`,
        );
      if (event.revision !== revision + 1)
        throw new StateValidationError(
          "state_invalid",
          "History transition revision is non-monotonic.",
        );
      validatePersistedTransitionEvent(event, contract);
      revision = event.revision;
      latestStatus = event.to;
    }
  }
  if (latestStatus !== state.status)
    throw new StateValidationError(
      "state_invalid",
      `History latest status ${latestStatus} differs from ${state.status}.`,
    );
  if (revision !== state.revision)
    throw new StateValidationError(
      "state_invalid",
      `History latest revision ${revision} differs from ${state.revision}.`,
    );
}

function validatePersistedTransitionEvent(
  event: StateHistoryEvent,
  contract: TransitionContract,
): void {
  if (!nonEmpty(event.sourceFingerprint))
    throw new StateValidationError("state_invalid", "Transition source fingerprint is missing.");
  if (event.to === "cancelled" || event.to === "failed") {
    if (event.terminalSource !== event.from)
      throw new StateValidationError("state_invalid", "Terminal transition source is invalid.");
  } else if (event.terminalSource !== undefined || event.terminalResumeTo !== undefined) {
    throw new StateValidationError(
      "state_invalid",
      "Non-terminal transition contains terminal source metadata.",
    );
  }
  const expected = contract.guards.filter((guard) => !STRUCTURAL_GUARDS.has(guard)).toSorted();
  const evidence = event.guardEvidence ?? [];
  if (!sameIds(expected, evidence.map((item) => item.guard).toSorted())) {
    throw new StateValidationError(
      "state_invalid",
      `Transition ${event.from} -> ${event.to} guard evidence is incomplete.`,
    );
  }
  for (const item of evidence) {
    if (
      item.schemaVersion !== 1 ||
      item.stateRevision !== event.revision - 1 ||
      item.stateFingerprint !== event.sourceFingerprint ||
      !nonEmpty(item.observedFingerprint) ||
      !item.evidenceRefs.length ||
      !item.evidenceRefs.every(nonEmpty) ||
      !["passed", "not_applicable"].includes(item.result)
    )
      throw new StateValidationError(
        "state_invalid",
        `Persisted guard ${item.guard} is malformed or stale.`,
      );
    if (TRUSTED_GUARDS.has(item.guard)) validatePersistedEvaluatorReceipt(item);
    else if (item.evaluatorReceipt !== undefined)
      throw new StateValidationError(
        "state_invalid",
        `Non-trusted guard ${item.guard} contains evaluator receipt.`,
      );
  }
  if (contract.guards.includes("gate_decision_valid")) {
    if (
      !event.gateDecision ||
      event.gateDecision.stateRevision !== event.revision - 1 ||
      event.gateDecision.stateFingerprint !== event.sourceFingerprint ||
      event.gateDecision.contractDigest !== event.contractDigest ||
      event.gateDecision.schemaVersion !== 1 ||
      !["approved", "change_requested", "rejected"].includes(event.gateDecision.decision) ||
      event.gateDecision.actor !== "user" ||
      !gateDecisionAllows(event.gateDecision, event.to) ||
      !validAt(event.gateDecision.decidedAt) ||
      (event.gateDecision.instructionRef !== undefined &&
        !REF.test(event.gateDecision.instructionRef)) ||
      (event.gateDecision.decision === "change_requested") !==
        nonEmpty(event.gateDecision.instructionRef) ||
      event.gateDecision.receiptDigest !==
        digest({ ...event.gateDecision, receiptDigest: undefined })
    ) {
      throw new StateValidationError(
        "state_invalid",
        "Persisted gate decision context is invalid.",
      );
    }
  } else if (event.gateDecision !== undefined) {
    throw new StateValidationError(
      "state_invalid",
      "Gate decision is attached to non-gate transition.",
    );
  }
}

function validatePersistedEvaluatorReceipt(evidence: GuardEvidenceRecord): void {
  const receipt = evidence.evaluatorReceipt;
  const evaluators: Partial<Record<GuardId, EvaluatorReceiptRecord["evaluator"]>> = {
    intake_complete: "intake",
    discovery_sufficient: "discovery",
    contract_complete: "planning",
  };
  if (
    !receipt ||
    receipt.evaluator !== evaluators[evidence.guard] ||
    receipt.stateRevision !== evidence.stateRevision ||
    receipt.stateFingerprint !== evidence.stateFingerprint ||
    receipt.receiptDigest !== digest({ ...receipt, receiptDigest: undefined }) ||
    evidence.observedFingerprint !== receipt.receiptDigest ||
    !sameIds(evidence.evidenceRefs, receipt.evidenceRefs)
  )
    throw new StateValidationError(
      "state_invalid",
      `Persisted evaluator receipt for ${evidence.guard} is invalid.`,
    );
}
function validateHistoryReferences(refs: WorkflowHistoryEvent["refs"], label: string): void {
  if (!Array.isArray(refs) || !refs.length || refs.length > HISTORY_REFERENCE_LIMIT)
    throw new Error(`${label} requires 1-${HISTORY_REFERENCE_LIMIT} references.`);
  let chars = 0;
  for (const item of refs) {
    if (
      !HISTORY_REFERENCE_KINDS.has(item.kind) ||
      !REF.test(item.ref) ||
      (item.fingerprint !== undefined && !REF.test(item.fingerprint))
    )
      throw new Error(`${label} contains invalid reference.`);
    chars += item.ref.length + (item.fingerprint?.length ?? 0);
  }
  if (chars > HISTORY_REFERENCE_TOTAL_CHARS)
    throw new Error(`${label} references exceed character budget.`);
}
function compactAndValidate(state: TaskState): TaskState {
  const output =
    state.history.length <= HISTORY_LIMIT
      ? state
      : {
          ...state,
          history: state.history.slice(-HISTORY_LIMIT),
          historySummary: summarizeHistory(state),
        };
  assertStateV6(output);
  return output;
}
function summarizeHistory(state: TaskState): TaskState["historySummary"] {
  const removed = state.history.slice(0, -HISTORY_LIMIT);
  const first = removed[0]!;
  const last = removed.at(-1)!;
  const typeCounts: Record<string, number> = {};
  for (const item of removed) typeCounts[item.type] = (typeCounts[item.type] ?? 0) + 1;
  const lastTransition = removed
    .toReversed()
    .find((item): item is StateHistoryEvent => item.type === "state.transition");
  return {
    removedCount: removed.length,
    firstSequence: first.sequence,
    lastSequence: last.sequence,
    firstAt: first.at,
    lastAt: last.at,
    typeCounts,
    ...(lastTransition
      ? {
          lastTransition: {
            sequence: lastTransition.sequence,
            revision: lastTransition.revision,
            to: lastTransition.to,
          },
        }
      : {}),
  };
}
function nextSequence(state: TaskState): number {
  return Math.max(state.historySummary?.lastSequence ?? 0, state.history.at(-1)?.sequence ?? 0) + 1;
}

function defaultContextCapsule(config: unknown, policy: unknown): ContextCapsule {
  return {
    schemaVersion: 1,
    entries: [
      {
        section: "constraints",
        ownerRef: "state:configSnapshot",
        provenanceRef: "state:configSnapshot",
        fingerprintRefs: ["config"],
      },
      {
        section: "constraints",
        ownerRef: "state:policySnapshot",
        provenanceRef: "state:policySnapshot",
        fingerprintRefs: ["policy"],
      },
    ],
    fingerprints: [
      {
        id: "config",
        kind: "config",
        value: digest(config),
        provenanceRef: "state:configSnapshot",
      },
      {
        id: "policy",
        kind: "policy",
        value: digest(policy),
        provenanceRef: "state:policySnapshot",
      },
    ],
  };
}
function routingStable(snapshot: RoutingSnapshot): string {
  const { capturedAt: _capturedAt, ...rest } = snapshot;
  return stable(rest);
}
function validateTransitionOptionKeys(options: TransitionOptions): void {
  const allowed = new Set([
    "resumeTo",
    "resumeReason",
    "terminalSource",
    "guardEvidence",
    "gateDecision",
    "contractDigest",
    "at",
  ]);
  const unknown = Object.keys(options).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`Unknown transition options: ${unknown.join(", ")}.`);
}
function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    [...left].toSorted().every((item, index) => item === [...right].toSorted()[index])
  );
}
function digestWithoutReceipt(value: DiscoveryReceipt | PlanningReceipt): string {
  const { receiptDigest: _digest, ...rest } = value;
  return digest(rest);
}
function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}
function stable(value: unknown): string {
  return JSON.stringify(canonical(value));
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
function copy<T>(value: T): T {
  return structuredClone(value);
}
function deepFreeze<T>(value: T): T {
  if (!isRecord(value) && !Array.isArray(value)) return value;
  if (Object.isFrozen(value)) return value;
  for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  return Object.freeze(value);
}
function normalizeEventAt(value?: string): string {
  if (value && validAt(value)) return new Date(value).toISOString();
  return new Date().toISOString();
}
function validAt(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isRisk(value: unknown): value is RiskLevel {
  return ["low", "medium", "high", "critical"].includes(value as string);
}
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]{0,511}$/;
const GUARD_ID_SET: ReadonlySet<string> = new Set(GUARD_IDS);
const HISTORY_REFERENCE_KINDS = new Set<HistoryReferenceKind>([
  "task",
  "shape",
  "artifact",
  "worktree",
  "context-capsule",
  "context",
  "issue",
  "correction",
  "gate",
  "scope",
  "evidence",
  "receipt",
  "command",
  "criterion",
  "decision",
  "policy",
  "config",
  "git",
  "symbol",
]);
const STRUCTURAL_GUARDS = new Set<GuardId>([
  "task_initialized",
  "resume_metadata_valid",
  "terminal_source_recorded",
  "gate_decision_valid",
]);
const TRUSTED_GUARDS = new Set<GuardId>([
  "intake_complete",
  "discovery_sufficient",
  "contract_complete",
]);
