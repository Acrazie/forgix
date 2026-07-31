import { createHash } from "node:crypto";
import {
  GUARD_IDS, STATE_MACHINE, deriveMacroPhase, isOperationalResumeTarget, isTaskStatus,
  type GuardId, type TaskStatus, type TransitionContract
} from "./state-machine.js";
import { ROUTING_POLICY_VERSION } from "./routing.js";
import { createShapeState, evaluateContractCompleteness, evaluateDiscoveryCompleteness, validateShapeState, type DiscoveryReceipt, type PlanningReceipt, type ShapeState } from "./shape.js";
import { validateStateV3 } from "./state-validator.js";
import type {
  ActiveArtifactReference, ActiveWorktreeReference, ApprovalGate, ContextCapsule, DurableHistoryEvent,
  EvaluatorReceiptRecord, GateDecisionRecord, GuardEvidenceRecord, HistoryReferenceKind, IntakeState, Policy,
  RiskLevel, RoutingDecision, RoutingSnapshot, StateHistoryEvent, TaskState, VerificationRequirements,
  WorkflowHistoryEvent, WorkflowHistoryEventType
} from "./types.js";

export { STATE_MACHINE, TASK_STATUSES, buildStateMachineProjection, deriveMacroPhase } from "./state-machine.js";
export type { GuardId, MacroPhase, TaskStatus } from "./state-machine.js";

export interface CreateTaskInput {
  taskId: string;
  risk: RiskLevel;
  configSnapshot: Record<string, unknown>;
  policySnapshot: Policy;
  routingSnapshot?: RoutingSnapshot;
  verificationRequirements?: Omit<VerificationRequirements, "requirementsDigest">;
  activeArtifact?: ActiveArtifactReference;
  activeWorktree?: ActiveWorktreeReference;
  contextCapsule?: ContextCapsule;
  intake?: IntakeState;
  shape?: ShapeState;
  benchmarkEnabled?: boolean;
  at?: string;
}

export type GuardEvidenceProvenance = "deterministic-check" | "human-approval" | "repository-observation";
export type GuardEvidence = GuardEvidenceRecord;
export type GateDecision = GateDecisionRecord;

export interface TransitionOptions {
  resumeTo?: TaskStatus;
  remainingActions?: string[];
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
  remainingActions?: string[];
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

export interface CreateGateDecisionInput { decision: GateDecision["decision"]; evidenceRef: string; }
export interface EvaluatorObservation { id: string; stateRevision: number; observedFingerprint: string; evidenceRef: string; exitCode: number; }
export interface VerificationEvaluatorInput { criteria: readonly EvaluatorObservation[]; mandatoryChecks: readonly EvaluatorObservation[]; }
export interface HandoffIntentAction { id: string; disposition: "required" | "selected" | "not_selected"; stateRevision: number; observedFingerprint: string; evidenceRef: string; }
export interface HandoffIntentEvaluatorInput { delivery: "local" | "external"; intentEvidenceRef: string; actions: readonly HandoffIntentAction[]; }
export interface HandoffObservation { actionId: string; status: "completed" | "pending" | "blocked"; stateRevision: number; observedFingerprint: string; evidenceRef: string; receiptRef?: string; }
export interface HandoffReconciliationEvaluatorInput { observations: readonly HandoffObservation[]; }

export class StateValidationError extends Error {
  constructor(readonly code: "state_schema_incompatible" | "state_invalid", message: string) {
    super(message);
    this.name = "StateValidationError";
  }
}

export function createState(input: CreateTaskInput): TaskState {
  if (!nonEmpty(input.taskId) || !isRisk(input.risk)) throw new Error("createState requires taskId and risk.");
  const contextCapsule = input.contextCapsule ?? defaultContextCapsule(input.configSnapshot, input.policySnapshot);
  const state: TaskState = {
    schemaVersion: 3,
    taskId: input.taskId,
    status: "new",
    revision: 0,
    risk: input.risk,
    configSnapshot: copy(input.configSnapshot),
    policySnapshot: copy(input.policySnapshot),
    issues: [], reviewCycle: 0, remainingActions: [],
    history: [{ sequence: 1, at: normalizeEventAt(input.at), type: "task.created", refs: [{ kind: "task", ref: "state:taskId" }] }],
    ...(input.activeArtifact ? { activeArtifact: copy(input.activeArtifact) } : {}),
    ...(input.activeWorktree ? { activeWorktree: copy(input.activeWorktree) } : {}),
    contextCapsule: copy(contextCapsule),
    ...(input.intake ? { intake: copy(input.intake) } : {}),
    ...(input.shape ? { shape: copy(input.shape) } : {}),
    benchmarkEnabled: input.benchmarkEnabled ?? false,
    ...(input.routingSnapshot ? { routingSnapshot: copy(input.routingSnapshot) } : {}),
    routingPolicyVersion: ROUTING_POLICY_VERSION,
    routingDecisions: [],
    ...(input.verificationRequirements ? { verificationRequirements: normalizeVerificationRequirements(input.verificationRequirements) } : {})
  };
  assertStateV3(state);
  return state;
}

export function loadStateV3(value: unknown): TaskState {
  if (!isRecord(value) || value.schemaVersion !== 3) {
    const version = isRecord(value) ? String(value.schemaVersion) : "missing";
    throw new StateValidationError("state_schema_incompatible", `Task state schema ${version} is incompatible; schemaVersion 3 required. No migration is available.`);
  }
  assertStateV3(value);
  return copy(value as TaskState);
}

export function assertStateV3(value: unknown): asserts value is TaskState {
  const result = validateStateV3(value);
  if (!result.valid) throw new StateValidationError("state_invalid", `Task state V3 schema validation failed: ${JSON.stringify(result.errors.slice(0, 3))}`);
  const state = value as TaskState;
  if (!isTaskStatus(state.status) || !isRisk(state.risk)) throw new StateValidationError("state_invalid", "Task state V3 status or risk is invalid.");
  validateHistory(state);
  if (state.intake && state.intake.brief.risk !== state.risk) throw new StateValidationError("state_invalid", "Task risk contradicts Intake Brief risk.");
  if (state.shape) {
    try { validateShapeState(state.shape); } catch (error) {
      throw new StateValidationError("state_invalid", `Persisted ShapeState is invalid: ${error instanceof Error ? error.message : "unknown error"}.`);
    }
    if (state.shape.risk !== state.risk || state.shape.intakeBriefRef !== "state:intake.brief") throw new StateValidationError("state_invalid", "Shape state is not bound to current Intake Brief and risk.");
  }
  if (["discovering", "awaiting_profile_choice", "planning", "awaiting_intake_decision", "awaiting_approval", "executing", "validating", "resolving_build", "reviewing", "resolving_assure", "verifying", "handing_off", "ready_for_handoff", "finished_local", "finished"].includes(state.status) && !state.shape) {
    throw new StateValidationError("state_invalid", `Task status ${state.status} requires persisted ShapeState.`);
  }
  if (state.status === "blocked") {
    if (!state.resumeTo || !isOperationalResumeTarget(state.resumeTo) || !state.remainingActions.length) throw new StateValidationError("state_invalid", "Blocked state requires exact operational resume metadata.");
  } else if (state.status === "ready_for_handoff") {
    if (state.resumeTo !== "handing_off" || !state.remainingActions.length) throw new StateValidationError("state_invalid", "ready_for_handoff requires handing_off resume metadata.");
  } else if (state.resumeTo !== undefined) throw new StateValidationError("state_invalid", "Only blocked or ready_for_handoff may contain resumeTo.");
  if (state.status === "awaiting_approval" && (!state.pendingGate || !nonEmpty(state.contractDigest))) throw new StateValidationError("state_invalid", "awaiting_approval requires gate and contract digest.");
}

export function guardStateFingerprint(state: TaskState): string {
  return digest({ schemaVersion: state.schemaVersion, taskId: state.taskId, status: state.status, revision: state.revision, risk: state.risk,
    resumeTo: state.resumeTo, remainingActions: state.remainingActions, pendingGate: state.pendingGate, contractDigest: state.contractDigest,
    configSnapshot: state.configSnapshot, policySnapshot: state.policySnapshot, routingSnapshot: state.routingSnapshot,
    routingDecisions: state.routingDecisions, intake: state.intake, shape: state.shape, issues: state.issues, reviewCycle: state.reviewCycle });
}

export function createGuardAttestation(state: TaskState, guard: GuardId, input: CreateGuardAttestationInput): GuardEvidence {
  assertStateV3(state);
  if (!(GUARD_IDS as readonly string[]).includes(guard)) throw new Error(`Unknown transition guard ${String(guard)}.`);
  if (guard === "intake_complete") {
    validateCompleteIntake(state);
    return createEvaluatorEvidence(state, guard, "deterministic-check", { evaluator: "intake", outcome: "intake_complete", inputDigest: digest(state.intake), evidenceRefs: [...input.evidenceRefs], subjectIds: ["objective", "success_signal", "risk"], completedIds: ["objective", "success_signal", "risk"] });
  }
  if (TRUSTED_GUARDS.has(guard)) throw new Error(`Guard ${guard} requires trusted evaluator.`);
  if (guard === "profile_selected") validateSelectedProfile(state);
  const evidence: GuardEvidence = { schemaVersion: 1, guard, stateRevision: state.revision, stateFingerprint: guardStateFingerprint(state), observedFingerprint: input.observedFingerprint, evidenceRefs: [...input.evidenceRefs], provenance: input.provenance, result: input.result ?? "passed" };
  validateGuardEvidence(state, evidence);
  return evidence;
}

const trustedEvidence = new WeakSet<object>();

export function evaluateDiscoveryGuard(state: TaskState, receipt: DiscoveryReceipt): GuardEvidence {
  assertStateV3(state);
  if (!state.shape || !evaluateDiscoveryCompleteness(state.shape).complete) throw new Error("Discovery evaluator requires current complete Shape Discovery.");
  const current = state.shape.evaluatorReceipts.find((candidate): candidate is DiscoveryReceipt => candidate.evaluator === "discovery" && candidate.receiptDigest === receipt.receiptDigest);
  if (!current || digestWithoutReceipt(current) !== digestWithoutReceipt(receipt)) throw new Error("Discovery receipt is stale or not persisted.");
  return createEvaluatorEvidence(state, "discovery_sufficient", "repository-observation", { evaluator: "discovery", outcome: "discovery_sufficient", inputDigest: receipt.inputDigest, evidenceRefs: receipt.evidenceRefs, subjectIds: receipt.subjectIds, completedIds: receipt.completedIds });
}

export function evaluatePlanningGuard(state: TaskState, receipt: PlanningReceipt): GuardEvidence {
  assertStateV3(state);
  if (!state.shape || !evaluateContractCompleteness(state.shape).complete || state.shape.contract?.digest !== state.contractDigest && state.status === "awaiting_approval") throw new Error("Planning evaluator requires current complete Shape contract.");
  const current = state.shape.evaluatorReceipts.find((candidate): candidate is PlanningReceipt => candidate.evaluator === "planning" && candidate.receiptDigest === receipt.receiptDigest);
  if (!current || digestWithoutReceipt(current) !== digestWithoutReceipt(receipt)) throw new Error("Planning receipt is stale or not persisted.");
  return createEvaluatorEvidence(state, "contract_complete", "deterministic-check", { evaluator: "planning", outcome: "contract_complete", inputDigest: receipt.inputDigest, evidenceRefs: receipt.evidenceRefs, subjectIds: receipt.subjectIds, completedIds: receipt.completedIds });
}

export function evaluateVerification(state: TaskState, input: VerificationEvaluatorInput): GuardEvidence {
  assertStateV3(state);
  const requirements = state.verificationRequirements;
  if (!requirements) throw new Error("Verification requires state-bound verificationRequirements.");
  assertExactObservations(state, requirements.criterionIds, input.criteria, "acceptance criteria", true);
  assertExactObservations(state, requirements.mandatoryCheckIds, input.mandatoryChecks, "mandatory checks", false);
  const observations = [...input.criteria, ...input.mandatoryChecks];
  const ids = [...requirements.criterionIds.map((id) => `criterion:${id}`), ...requirements.mandatoryCheckIds.map((id) => `check:${id}`)];
  return createEvaluatorEvidence(state, "verification_complete", "deterministic-check", { evaluator: "verification", outcome: "complete", inputDigest: digest({ requirements, input }), evidenceRefs: observations.map((item) => item.evidenceRef), subjectIds: ids, completedIds: ids });
}

export function evaluateHandoffIntent(state: TaskState, input: HandoffIntentEvaluatorInput): GuardEvidence {
  assertStateV3(state);
  if (!nonEmpty(input.intentEvidenceRef) || !Array.isArray(input.actions)) throw new Error("Handoff intent requires action set and evidence.");
  assertUnique(input.actions.map((item) => item.id), "handoff action IDs", true);
  for (const item of input.actions) if (item.stateRevision !== state.revision || !nonEmpty(item.observedFingerprint) || !nonEmpty(item.evidenceRef)) throw new Error(`Handoff action ${item.id} is stale or malformed.`);
  const selected = input.actions.filter((item) => item.disposition !== "not_selected").map((item) => item.id);
  if (input.delivery === "local" && selected.length) throw new Error("Local handoff cannot select external actions.");
  if (input.delivery === "external" && !selected.length) throw new Error("External handoff requires selected action.");
  return createEvaluatorEvidence(state, "handoff_intent_resolved", "repository-observation", { evaluator: "handoff_intent", outcome: input.delivery === "local" ? "local_only" : "external_selected", inputDigest: digest(input), evidenceRefs: [input.intentEvidenceRef, ...input.actions.map((item) => item.evidenceRef)], subjectIds: input.actions.map((item) => item.id), completedIds: selected });
}

export function evaluateHandoffReconciliation(state: TaskState, intent: GuardEvidence, input: HandoffReconciliationEvaluatorInput): GuardEvidence {
  assertStateV3(state);
  validateGuardEvidence(state, intent);
  if (!trustedEvidence.has(intent) || intent.evaluatorReceipt?.evaluator !== "handoff_intent" || intent.evaluatorReceipt.outcome !== "external_selected") throw new Error("Handoff reconciliation requires trusted external intent.");
  assertSameIds(intent.evaluatorReceipt.completedIds, input.observations.map((item) => item.actionId), "handoff actions");
  const completed: string[] = [];
  for (const item of input.observations) {
    if (item.stateRevision !== state.revision || !nonEmpty(item.observedFingerprint) || !nonEmpty(item.evidenceRef)) throw new Error(`Handoff observation ${item.actionId} is stale or malformed.`);
    if (item.status === "completed") { if (!nonEmpty(item.receiptRef)) throw new Error(`Completed handoff action ${item.actionId} requires receiptRef.`); completed.push(item.actionId); }
    else if (item.receiptRef !== undefined) throw new Error(`Incomplete handoff action ${item.actionId} cannot contain receiptRef.`);
  }
  return createEvaluatorEvidence(state, "handoff_reconciled", "repository-observation", { evaluator: "handoff_reconciliation", outcome: completed.length === input.observations.length ? "complete" : "action_required", inputDigest: digest(input), evidenceRefs: input.observations.flatMap((item) => [item.evidenceRef, ...(item.receiptRef ? [item.receiptRef] : [])]), subjectIds: input.observations.map((item) => item.actionId), completedIds: completed });
}

export function evaluateCompletionApproval(state: TaskState, decision: GateDecision): GuardEvidence {
  assertStateV3(state);
  if (state.status !== "awaiting_approval" || state.pendingGate !== "completion" || decision.decision !== "approved") throw new Error("Completion evaluator requires approved completion gate.");
  validateGateDecision(state, decision);
  return createEvaluatorEvidence(state, "completion_approved", "human-approval", { evaluator: "completion", outcome: "approved", inputDigest: digest(decision), evidenceRefs: [decision.evidenceRef], subjectIds: [state.contractDigest!], completedIds: [decision.evidenceRef] });
}

export function createGateDecision(state: TaskState, input: CreateGateDecisionInput): GateDecision {
  assertStateV3(state);
  if (state.status !== "awaiting_approval" || !state.pendingGate || !state.contractDigest || !nonEmpty(input.evidenceRef)) throw new Error("Gate decision requires current gate, contract, and evidence.");
  return { schemaVersion: 1, gate: state.pendingGate, decision: input.decision, stateRevision: state.revision, stateFingerprint: guardStateFingerprint(state), evidenceRef: input.evidenceRef, contractDigest: state.contractDigest };
}

export function updateShapeState(state: TaskState, shape: ShapeState, input: { type: Extract<WorkflowHistoryEventType, "discovery.target_recorded" | "discovery.evidence_recorded" | "discovery.completed" | "profile.choice_requested" | "profile.choice_recorded" | "decision.escalated" | "contract.projected" | "projection.reconciliation_requested" | "evidence.invalidated" | "shape.checkpoint">; refs: WorkflowHistoryEvent["refs"]; at?: string }): TaskState {
  assertStateV3(state);
  if (deriveMacroPhase(state) !== "SHAPE" && state.status !== "awaiting_intake_decision") {
    throw new Error("ShapeState may change only in SHAPE or while resolving linked Intake escalation.");
  }
  if (!isRisk(shape.risk) || shape.risk !== state.risk || shape.intakeBriefRef !== "state:intake.brief") throw new Error("Shape update must remain bound to current Intake Brief and risk.");
  return recordHistoryEvent({ ...state, shape: copy(shape) }, input);
}

export function addRoutingDecision(state: TaskState, decision: RoutingDecision): TaskState { assertStateV3(state); return { ...state, routingDecisions: [...(state.routingDecisions ?? []), copy(decision)] }; }

export function recordHistoryEvent(state: TaskState, input: RecordHistoryEventInput): TaskState {
  assertStateV3(state);
  if (STATE_MACHINE[state.status].terminal) throw new Error("Terminal state history is immutable.");
  validateHistoryReferences(input.refs, `Workflow event ${input.type}`);
  const event: WorkflowHistoryEvent = { sequence: nextSequence(state), at: normalizeEventAt(input.at), type: input.type, refs: copy(input.refs) };
  return compactAndValidate({ ...state, history: [...state.history, event] });
}

export function updateResumeContext(state: TaskState, input: ResumeContextInput): TaskState {
  assertStateV3(state);
  const { activeArtifact: _a, activeWorktree: _w, ...base } = state;
  const updated: TaskState = { ...base, remainingActions: input.remainingActions ? [...input.remainingActions] : [...state.remainingActions],
    ...(input.activeArtifact === undefined ? state.activeArtifact ? { activeArtifact: copy(state.activeArtifact) } : {} : input.activeArtifact === null ? {} : { activeArtifact: copy(input.activeArtifact) }),
    ...(input.activeWorktree === undefined ? state.activeWorktree ? { activeWorktree: copy(state.activeWorktree) } : {} : input.activeWorktree === null ? {} : { activeWorktree: copy(input.activeWorktree) }),
    contextCapsule: input.contextCapsule ? copy(input.contextCapsule) : copy(state.contextCapsule ?? defaultContextCapsule(state.configSnapshot, state.policySnapshot)) };
  return recordHistoryEvent(updated, { type: "context.updated", refs: [{ kind: "context-capsule", ref: "state:contextCapsule" }], ...(input.at ? { at: input.at } : {}) });
}

export function transition(state: TaskState, next: TaskStatus, options: TransitionOptions = {}): TaskState {
  assertStateV3(state);
  validateTransitionOptionKeys(options);
  if (!isTaskStatus(next)) throw new Error(`Invalid state transition from ${state.status} to ${String(next)}.`);
  const contract = transitionContract(state.status, next);
  if (!contract) throw new Error(`Invalid state transition from ${state.status} to ${next}.`);
  const structural = validateStructuralGuards(state, next, options, contract.guards);
  const evidence = validateEvidenceSet(state, options.guardEvidence ?? [], contract.guards);
  const missing = contract.guards.filter((guard) => !structural.has(guard) && evidence.get(guard)?.result !== "passed" && evidence.get(guard)?.result !== "not_applicable");
  if (missing.length) throw new Error(`Unmet transition guards from ${state.status} to ${next}: ${missing.join(", ")}.`);
  validateTrustedTarget(next, evidence);
  const sourceFingerprint = guardStateFingerprint(state);
  const metadata = transitionMetadata(state, next, options);
  const event: StateHistoryEvent = { sequence: nextSequence(state), at: normalizeEventAt(options.at), type: "state.transition", from: state.status, to: next, revision: state.revision + 1, sourceFingerprint,
    ...(next === "cancelled" || next === "failed" ? { terminalSource: state.status, ...(state.status === "blocked" && state.resumeTo ? { terminalResumeTo: state.resumeTo } : {}) } : {}),
    ...(metadata.pendingGate ? { gateContext: metadata.pendingGate, contractDigest: metadata.contractDigest } : state.pendingGate && options.gateDecision ? { gateContext: state.pendingGate, contractDigest: state.contractDigest } : {}),
    ...(evidence.size ? { guardEvidence: [...evidence.values()].map(copy) } : {}), ...(options.gateDecision ? { gateDecision: copy(options.gateDecision) } : {}) };
  let shape = state.shape;
  if (next === "discovering" && !shape) shape = createShapeState({ risk: state.risk, intakeBriefRef: "state:intake.brief" });
  const { resumeTo: _resume, pendingGate: _gate, contractDigest: _contract, ...base } = state;
  const output: TaskState = { ...base, status: next, revision: state.revision + 1, ...metadata, ...(shape ? { shape } : {}), history: [...state.history, event] };
  return compactAndValidate(output);
}

export function compareSnapshot(state: Pick<TaskState, "configSnapshot" | "policySnapshot" | "routingSnapshot">, current: { config: unknown; policy: unknown; routingSnapshot?: RoutingSnapshot }): { changed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (stable(state.configSnapshot) !== stable(current.config)) reasons.push("config_changed");
  if (stable(state.policySnapshot) !== stable(current.policy)) reasons.push("policy_changed");
  if (state.routingSnapshot && current.routingSnapshot && routingStable(state.routingSnapshot) !== routingStable(current.routingSnapshot)) reasons.push("routing_changed");
  return { changed: reasons.length > 0, reasons };
}

function transitionMetadata(state: TaskState, next: TaskStatus, options: TransitionOptions): Pick<TaskState, "remainingActions"> & { resumeTo?: TaskStatus; pendingGate?: ApprovalGate; contractDigest?: string } {
  if (next === "blocked") return { resumeTo: options.resumeTo!, remainingActions: [...(options.remainingActions ?? [])], ...(state.pendingGate ? { pendingGate: state.pendingGate } : {}), ...(state.contractDigest ? { contractDigest: state.contractDigest } : {}) };
  if (next === "ready_for_handoff") return { resumeTo: "handing_off", remainingActions: [...(options.remainingActions ?? [])] };
  if (next === "awaiting_approval") {
    const pendingGate: ApprovalGate = state.status === "planning" ? "pre_build" : "completion";
    const contractDigest = state.status === "planning" ? options.contractDigest : state.contractDigest;
    if (!nonEmpty(contractDigest)) throw new Error("awaiting_approval requires current contract digest.");
    return { pendingGate, contractDigest, remainingActions: [] };
  }
  return { remainingActions: [] };
}

function validateStructuralGuards(state: TaskState, next: TaskStatus, options: TransitionOptions, required: readonly GuardId[]): Set<GuardId> {
  const satisfied = new Set<GuardId>();
  if (required.includes("task_initialized")) { if (!nonEmpty(state.taskId) || !isRecord(state.configSnapshot) || !isRecord(state.policySnapshot)) throw new Error("task_initialized failed."); satisfied.add("task_initialized"); }
  if (required.includes("resume_metadata_valid")) {
    if (next === "blocked") { if (!options.resumeTo || !isOperationalResumeTarget(options.resumeTo) || !options.remainingActions?.length) throw new Error("blocked requires operational resumeTo and remainingActions."); }
    else if (state.status === "blocked") { if (next !== state.resumeTo) throw new Error(`blocked may transition only to exact resumeTo ${state.resumeTo}.`); }
    else throw new Error(`resume_metadata_valid is not applicable from ${state.status}.`);
    satisfied.add("resume_metadata_valid");
  }
  if (required.includes("terminal_source_recorded")) { if (options.terminalSource !== state.status) throw new Error(`${next} requires terminalSource equal to ${state.status}.`); satisfied.add("terminal_source_recorded"); }
  if (required.includes("gate_context_valid")) { if (!options.gateDecision) throw new Error("Gate exit requires decision."); validateGateDecision(state, options.gateDecision); if (!gateDecisionAllows(options.gateDecision, next)) throw new Error(`Gate decision cannot transition to ${next}.`); satisfied.add("gate_context_valid"); }
  if (next === "ready_for_handoff" && !options.remainingActions?.length) throw new Error("ready_for_handoff requires remainingActions.");
  if (options.contractDigest !== undefined && (state.status !== "planning" || next !== "awaiting_approval")) throw new Error("contractDigest may only enter GATE from Planning.");
  if (state.status === "planning" && next === "awaiting_approval" && state.shape?.contract?.digest !== options.contractDigest) throw new Error("GATE digest must match canonical Shape contract.");
  return satisfied;
}

function validateEvidenceSet(state: TaskState, items: readonly GuardEvidence[], required: readonly GuardId[]): Map<GuardId, GuardEvidence> {
  const output = new Map<GuardId, GuardEvidence>();
  for (const item of items) { validateGuardEvidence(state, item); if (!required.includes(item.guard) || STRUCTURAL_GUARDS.has(item.guard)) throw new Error(`Guard evidence for ${item.guard} is not applicable.`); if (TRUSTED_GUARDS.has(item.guard) && !trustedEvidence.has(item)) throw new Error(`Guard ${item.guard} requires trusted evaluator evidence from current runtime.`); if (output.has(item.guard)) throw new Error(`Duplicate guard evidence for ${item.guard}.`); output.set(item.guard, item); }
  return output;
}

function validateGuardEvidence(state: TaskState, evidence: GuardEvidence): void {
  if (evidence.schemaVersion !== 1 || !(GUARD_IDS as readonly string[]).includes(evidence.guard) || evidence.stateRevision !== state.revision || evidence.stateFingerprint !== guardStateFingerprint(state) || !nonEmpty(evidence.observedFingerprint) || !evidence.evidenceRefs?.length || !evidence.evidenceRefs.every(nonEmpty) || !["deterministic-check", "human-approval", "repository-observation"].includes(evidence.provenance)) throw new Error(`Guard evidence for ${String(evidence.guard)} is stale, malformed, or unproven.`);
  if (TRUSTED_GUARDS.has(evidence.guard)) validateEvaluatorReceipt(evidence, state);
  else if (evidence.evaluatorReceipt) throw new Error(`Guard ${evidence.guard} cannot contain evaluatorReceipt.`);
}

function createEvaluatorEvidence(state: TaskState, guard: Extract<GuardId, "intake_complete" | "discovery_sufficient" | "contract_complete" | "verification_complete" | "handoff_intent_resolved" | "handoff_reconciled" | "completion_approved">, provenance: GuardEvidenceProvenance, input: Omit<EvaluatorReceiptRecord, "schemaVersion" | "stateRevision" | "stateFingerprint" | "receiptDigest">): GuardEvidence {
  if (!input.evidenceRefs.length) throw new Error(`${guard} evaluator requires evidence references.`);
  const base = { schemaVersion: 1 as const, ...input, stateRevision: state.revision, stateFingerprint: guardStateFingerprint(state) };
  const receipt: EvaluatorReceiptRecord = { ...base, receiptDigest: digest(base) };
  const evidence = deepFreeze({ schemaVersion: 1 as const, guard, stateRevision: state.revision, stateFingerprint: guardStateFingerprint(state), observedFingerprint: receipt.receiptDigest, evidenceRefs: [...receipt.evidenceRefs], provenance, result: "passed" as const, evaluatorReceipt: receipt });
  validateGuardEvidence(state, evidence); trustedEvidence.add(evidence); return evidence;
}

function validateEvaluatorReceipt(evidence: GuardEvidence, state: TaskState): void {
  const receipt = evidence.evaluatorReceipt;
  const evaluators: Partial<Record<GuardId, EvaluatorReceiptRecord["evaluator"]>> = { intake_complete: "intake", discovery_sufficient: "discovery", contract_complete: "planning", verification_complete: "verification", handoff_intent_resolved: "handoff_intent", handoff_reconciled: "handoff_reconciliation", completion_approved: "completion" };
  if (!receipt || receipt.evaluator !== evaluators[evidence.guard] || receipt.stateRevision !== state.revision || receipt.stateFingerprint !== guardStateFingerprint(state) || receipt.receiptDigest !== digest({ ...receipt, receiptDigest: undefined }) || evidence.observedFingerprint !== receipt.receiptDigest || !sameIds(evidence.evidenceRefs, receipt.evidenceRefs)) throw new Error(`Trusted evaluator receipt for ${evidence.guard} is stale or malformed.`);
}

function validateTrustedTarget(next: TaskStatus, evidence: Map<GuardId, GuardEvidence>): void {
  const intent = evidence.get("handoff_intent_resolved")?.evaluatorReceipt;
  if (next === "finished_local" && intent?.outcome !== "local_only") throw new Error("finished_local requires local handoff intent.");
  if (["handing_off", "ready_for_handoff", "finished"].includes(next) && intent && intent.outcome !== "external_selected") throw new Error(`${next} requires external handoff intent.`);
  if (next === "finished" && evidence.get("handoff_reconciled")?.evaluatorReceipt?.outcome !== "complete") throw new Error("finished requires complete handoff reconciliation.");
}

function validateGateDecision(state: TaskState, decision: GateDecision): void {
  if (state.status !== "awaiting_approval" || decision.gate !== state.pendingGate || decision.stateRevision !== state.revision || decision.stateFingerprint !== guardStateFingerprint(state) || decision.contractDigest !== state.contractDigest || !nonEmpty(decision.evidenceRef)) throw new Error("Gate decision is stale or bound to another state.");
}
function gateDecisionAllows(decision: GateDecision, target: TaskStatus): boolean { return decision.gate === "pre_build" ? (decision.decision === "approved" ? target === "executing" : target === "planning") : (decision.decision === "approved" ? ["handing_off", "ready_for_handoff", "finished_local"].includes(target) : ["resolving_assure", "verifying"].includes(target)); }
function transitionContract(from: TaskStatus, to: TaskStatus): TransitionContract | undefined { return (STATE_MACHINE[from].transitions as Readonly<Record<string, TransitionContract>>)[to]; }

function validateCompleteIntake(state: TaskState): void {
  const intake = state.intake; const signal = intake?.brief.successSignal;
  if (!intake || !intake.semanticComplete || !intake.deterministicComplete || intake.activeQuestion || intake.contradictions.length || intake.blockedReason || !nonEmpty(intake.brief.objective) || !signal || !nonEmpty(signal.description) || !nonEmpty(signal.observationMethod) || intake.brief.risk !== state.risk) throw new Error("intake_complete requires complete current Intake Brief.");
}
function validateSelectedProfile(state: TaskState): void { const choice = state.shape?.preparationProfileChoice; if (!choice || choice.status !== "selected" || !choice.selectedProfile || !nonEmpty(choice.selectionEvidenceRef)) throw new Error("profile_selected requires explicit persisted Quick/Plan answer."); }

function assertExactObservations(state: TaskState, required: readonly string[], observed: readonly EvaluatorObservation[], label: string, nonEmptyRequired: boolean): void { assertUnique(required, `${label} required IDs`, !nonEmptyRequired); assertSameIds(required, observed.map((item) => item.id), label); for (const item of observed) if (item.stateRevision !== state.revision || item.exitCode !== 0 || !nonEmpty(item.observedFingerprint) || !nonEmpty(item.evidenceRef)) throw new Error(`${label} observation ${item.id} did not pass or is stale.`); }
function normalizeVerificationRequirements(input: Omit<VerificationRequirements, "requirementsDigest">): VerificationRequirements { assertUnique(input.criterionIds, "criterion IDs"); assertUnique(input.mandatoryCheckIds, "check IDs", true); return { ...copy(input), requirementsDigest: digest({ criterionIds: input.criterionIds, mandatoryCheckIds: input.mandatoryCheckIds }) }; }

function validateHistory(state: TaskState): void {
  if (!Array.isArray(state.history) || !state.history.length) throw new StateValidationError("state_invalid", "Task state history is empty.");
  let previous = state.historySummary?.lastSequence ?? 0;
  let latestStatus: TaskStatus = state.historySummary?.lastTransition?.to ?? "new";
  let revision = state.historySummary?.lastTransition?.revision ?? 0;
  for (const event of state.history) {
    if (!Number.isInteger(event.sequence) || event.sequence <= previous || !validAt(event.at)) throw new StateValidationError("state_invalid", "History sequence or timestamp is invalid.");
    previous = event.sequence;
    if (event.type === "state.transition") {
      const contract = transitionContract(event.from, event.to);
      if (!isTaskStatus(event.from) || !isTaskStatus(event.to) || event.from !== latestStatus || !contract) throw new StateValidationError("state_invalid", `History edge ${event.from} -> ${event.to} is invalid.`);
      if (event.revision !== revision + 1) throw new StateValidationError("state_invalid", "History transition revision is non-monotonic.");
      validatePersistedTransitionEvent(event, contract);
      revision = event.revision;
      latestStatus = event.to;
    }
  }
  if (latestStatus !== state.status) throw new StateValidationError("state_invalid", `History latest status ${latestStatus} differs from ${state.status}.`);
  if (revision !== state.revision) throw new StateValidationError("state_invalid", `History latest revision ${revision} differs from ${state.revision}.`);
}

function validatePersistedTransitionEvent(event: StateHistoryEvent, contract: TransitionContract): void {
  if (!nonEmpty(event.sourceFingerprint)) throw new StateValidationError("state_invalid", "Transition source fingerprint is missing.");
  if (event.to === "cancelled" || event.to === "failed") {
    if (event.terminalSource !== event.from) throw new StateValidationError("state_invalid", "Terminal transition source is invalid.");
  } else if (event.terminalSource !== undefined || event.terminalResumeTo !== undefined) {
    throw new StateValidationError("state_invalid", "Non-terminal transition contains terminal source metadata.");
  }
  const expected = contract.guards.filter((guard) => !STRUCTURAL_GUARDS.has(guard)).sort();
  const evidence = event.guardEvidence ?? [];
  if (!sameIds(expected, evidence.map((item) => item.guard).sort())) {
    throw new StateValidationError("state_invalid", `Transition ${event.from} -> ${event.to} guard evidence is incomplete.`);
  }
  for (const item of evidence) {
    if (
      item.schemaVersion !== 1
      || item.stateRevision !== event.revision - 1
      || item.stateFingerprint !== event.sourceFingerprint
      || !nonEmpty(item.observedFingerprint)
      || !item.evidenceRefs.length
      || !item.evidenceRefs.every(nonEmpty)
      || !["passed", "not_applicable"].includes(item.result)
      || (item.result === "not_applicable" && item.guard !== "review_satisfied")
    ) throw new StateValidationError("state_invalid", `Persisted guard ${item.guard} is malformed or stale.`);
    if (TRUSTED_GUARDS.has(item.guard)) validatePersistedEvaluatorReceipt(item);
    else if (item.evaluatorReceipt !== undefined) throw new StateValidationError("state_invalid", `Non-trusted guard ${item.guard} contains evaluator receipt.`);
  }
  if (contract.guards.includes("gate_context_valid")) {
    if (!event.gateDecision || event.gateDecision.stateRevision !== event.revision - 1
      || event.gateDecision.stateFingerprint !== event.sourceFingerprint
      || event.gateDecision.gate !== event.gateContext
      || event.gateDecision.contractDigest !== event.contractDigest) {
      throw new StateValidationError("state_invalid", "Persisted gate decision context is invalid.");
    }
  } else if (event.gateDecision !== undefined) {
    throw new StateValidationError("state_invalid", "Gate decision is attached to non-gate transition.");
  }
}

function validatePersistedEvaluatorReceipt(evidence: GuardEvidenceRecord): void {
  const receipt = evidence.evaluatorReceipt;
  const evaluators: Partial<Record<GuardId, EvaluatorReceiptRecord["evaluator"]>> = {
    intake_complete: "intake",
    discovery_sufficient: "discovery",
    contract_complete: "planning",
    verification_complete: "verification",
    handoff_intent_resolved: "handoff_intent",
    handoff_reconciled: "handoff_reconciliation",
    completion_approved: "completion"
  };
  if (
    !receipt
    || receipt.evaluator !== evaluators[evidence.guard]
    || receipt.stateRevision !== evidence.stateRevision
    || receipt.stateFingerprint !== evidence.stateFingerprint
    || receipt.receiptDigest !== digest({ ...receipt, receiptDigest: undefined })
    || evidence.observedFingerprint !== receipt.receiptDigest
    || !sameIds(evidence.evidenceRefs, receipt.evidenceRefs)
  ) throw new StateValidationError("state_invalid", `Persisted evaluator receipt for ${evidence.guard} is invalid.`);
}
function validateHistoryReferences(refs: WorkflowHistoryEvent["refs"], label: string): void { if (!Array.isArray(refs) || !refs.length || refs.length > HISTORY_REFERENCE_LIMIT) throw new Error(`${label} requires 1-${HISTORY_REFERENCE_LIMIT} references.`); let chars = 0; for (const item of refs) { if (!HISTORY_REFERENCE_KINDS.has(item.kind) || !REF.test(item.ref) || (item.fingerprint !== undefined && !REF.test(item.fingerprint))) throw new Error(`${label} contains invalid reference.`); chars += item.ref.length + (item.fingerprint?.length ?? 0); } if (chars > HISTORY_REFERENCE_TOTAL_CHARS) throw new Error(`${label} references exceed character budget.`); }
function compactAndValidate(state: TaskState): TaskState { const output = state.history.length <= HISTORY_LIMIT ? state : { ...state, history: state.history.slice(-HISTORY_LIMIT), historySummary: summarizeHistory(state) }; assertStateV3(output); return output; }
function summarizeHistory(state: TaskState): TaskState["historySummary"] { const removed = state.history.slice(0, -HISTORY_LIMIT); const first = removed[0]!; const last = removed.at(-1)!; const typeCounts: Record<string, number> = {}; for (const item of removed) typeCounts[item.type] = (typeCounts[item.type] ?? 0) + 1; const transition = [...removed].reverse().find((item): item is StateHistoryEvent => item.type === "state.transition"); return { removedCount: removed.length, firstSequence: first.sequence, lastSequence: last.sequence, firstAt: first.at, lastAt: last.at, typeCounts, ...(transition ? { lastTransition: { sequence: transition.sequence, revision: transition.revision, to: transition.to } } : {}) }; }
function nextSequence(state: TaskState): number { return Math.max(state.historySummary?.lastSequence ?? 0, state.history.at(-1)?.sequence ?? 0) + 1; }

function defaultContextCapsule(config: unknown, policy: unknown): ContextCapsule { return { schemaVersion: 1, entries: [{ section: "constraints", ownerRef: "state:configSnapshot", provenanceRef: "state:configSnapshot", fingerprintRefs: ["config"] }, { section: "constraints", ownerRef: "state:policySnapshot", provenanceRef: "state:policySnapshot", fingerprintRefs: ["policy"] }], fingerprints: [{ id: "config", kind: "config", value: digest(config), provenanceRef: "state:configSnapshot" }, { id: "policy", kind: "policy", value: digest(policy), provenanceRef: "state:policySnapshot" }] }; }
function routingStable(snapshot: RoutingSnapshot): string { const { capturedAt: _capturedAt, ...rest } = snapshot; return stable(rest); }
function validateTransitionOptionKeys(options: TransitionOptions): void { const allowed = new Set(["resumeTo", "remainingActions", "terminalSource", "guardEvidence", "gateDecision", "contractDigest", "at"]); const unknown = Object.keys(options).filter((key) => !allowed.has(key)); if (unknown.length) throw new Error(`Unknown transition options: ${unknown.join(", ")}.`); }
function assertSameIds(expected: readonly string[], actual: readonly string[], label: string): void { assertUnique(actual, `${label} observed IDs`, expected.length === 0); if (!sameIds(expected, actual)) throw new Error(`${label} do not exactly cover required IDs.`); }
function assertUnique(values: readonly string[], label: string, allowEmpty = false): void { if (!Array.isArray(values) || (!allowEmpty && !values.length) || !values.every(nonEmpty) || new Set(values).size !== values.length) throw new Error(`${label} must contain unique non-empty values.`); }
function sameIds(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]); }
function digestWithoutReceipt(value: DiscoveryReceipt | PlanningReceipt): string { const { receiptDigest: _digest, ...rest } = value; return digest(rest); }
function digest(value: unknown): string { return createHash("sha256").update(stable(value)).digest("hex"); }
function stable(value: unknown): string { return JSON.stringify(canonical(value)); }
function canonical(value: unknown): unknown { if (Array.isArray(value)) return value.map(canonical); if (isRecord(value)) return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])); return value; }
function copy<T>(value: T): T { return structuredClone(value); }
function deepFreeze<T>(value: T): T { if (!isRecord(value) && !Array.isArray(value)) return value; if (Object.isFrozen(value)) return value; for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item); return Object.freeze(value); }
function normalizeEventAt(value?: string): string { if (value && validAt(value)) return new Date(value).toISOString(); return new Date().toISOString(); }
function validAt(value: unknown): value is string { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isRisk(value: unknown): value is RiskLevel { return ["low", "medium", "high", "critical"].includes(value as string); }
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]{0,511}$/;
const HISTORY_REFERENCE_KINDS = new Set<HistoryReferenceKind>(["task", "shape", "artifact", "worktree", "context-capsule", "context", "issue", "correction", "gate", "scope", "handoff", "evidence", "receipt", "command", "criterion", "decision", "policy", "config", "git", "symbol"]);
const STRUCTURAL_GUARDS = new Set<GuardId>(["task_initialized", "resume_metadata_valid", "terminal_source_recorded", "gate_context_valid"]);
const TRUSTED_GUARDS = new Set<GuardId>(["intake_complete", "discovery_sufficient", "contract_complete", "verification_complete", "handoff_intent_resolved", "handoff_reconciled", "completion_approved"]);
