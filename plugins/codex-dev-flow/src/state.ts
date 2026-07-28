import { createHash } from "node:crypto";
import {
  GUARD_IDS,
  STATE_MACHINE,
  deriveMacroPhase,
  isOperationalResumeTarget,
  isTaskStatus,
  type GuardId,
  type TaskStatus,
  type TransitionContract
} from "./state-machine.js";
import { ROUTING_POLICY_VERSION } from "./routing.js";
import { validateStateV2 } from "./state-validator.js";
import type {
  ActiveArtifactReference,
  ActiveWorktreeReference,
  ApprovalGate,
  ContextCapsule,
  DurableHistoryEvent,
  EvaluatorReceiptRecord,
  GateDecisionRecord,
  GuardEvidenceRecord,
  HistoryGateAnchor,
  HistoryReferenceKind,
  IntakeState,
  Policy,
  RoutingDecision,
  RoutingSnapshot,
  StateHistoryEvent,
  TaskMode,
  TaskState,
  VerificationRequirements,
  WorkflowHistoryEvent,
  WorkflowHistoryEventType
} from "./types.js";

export { STATE_MACHINE, TASK_STATUSES, buildStateMachineProjection, deriveMacroPhase } from "./state-machine.js";
export type { GuardId, MacroPhase, TaskStatus } from "./state-machine.js";

export interface CreateTaskInput {
  taskId: string;
  mode: TaskMode;
  modeEvidenceRef: string;
  configSnapshot: Record<string, unknown>;
  policySnapshot: Policy;
  routingSnapshot?: RoutingSnapshot;
  verificationRequirements?: Omit<VerificationRequirements, "requirementsDigest">;
  activeArtifact?: ActiveArtifactReference;
  activeWorktree?: ActiveWorktreeReference;
  contextCapsule?: ContextCapsule;
  intake?: IntakeState;
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
  type: Exclude<WorkflowHistoryEventType, "task.created" | "state.migrated">;
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

export interface CreateGateDecisionInput {
  decision: GateDecision["decision"];
  evidenceRef: string;
}

export interface EvaluatorObservation {
  id: string;
  stateRevision: number;
  observedFingerprint: string;
  evidenceRef: string;
  exitCode: number;
}

export interface VerificationEvaluatorInput {
  criteria: readonly EvaluatorObservation[];
  mandatoryChecks: readonly EvaluatorObservation[];
}

export interface HandoffIntentAction {
  id: string;
  disposition: "required" | "selected" | "not_selected";
  stateRevision: number;
  observedFingerprint: string;
  evidenceRef: string;
}

export interface HandoffIntentEvaluatorInput {
  delivery: "local" | "external";
  intentEvidenceRef: string;
  actions: readonly HandoffIntentAction[];
}

export interface HandoffObservation {
  actionId: string;
  status: "completed" | "pending" | "blocked";
  stateRevision: number;
  observedFingerprint: string;
  evidenceRef: string;
  receiptRef?: string;
}

export interface HandoffReconciliationEvaluatorInput {
  observations: readonly HandoffObservation[];
}

export interface MigrationOptions {
  mode?: TaskMode;
  modeEvidenceRef?: string;
}

export class StateMigrationError extends Error {
  constructor(
    readonly code: "state_migration_ambiguous" | "state_version_unsupported" | "state_invalid",
    message: string
  ) {
    super(message);
    this.name = "StateMigrationError";
  }
}

export interface StateMigrationResult {
  state: TaskState;
  migrationRequired: boolean;
}

export function createState(input: CreateTaskInput): TaskState {
  if (!isTaskMode(input.mode) || !nonEmpty(input.modeEvidenceRef)) throw new Error("createState requires mode and modeEvidenceRef.");
  const contextCapsule = input.contextCapsule ?? defaultContextCapsule(input.configSnapshot, input.policySnapshot);
  const created: WorkflowHistoryEvent = {
    sequence: 1,
    at: normalizeEventAt(input.at),
    type: "task.created",
    refs: [
      { kind: "task", ref: "state:taskId" },
      { kind: "mode-evidence", ref: "state:modeEvidenceRef" }
    ]
  };
  const state: TaskState = {
    schemaVersion: 2,
    taskId: input.taskId,
    status: "new",
    revision: 0,
    mode: input.mode,
    modeEvidenceRef: input.modeEvidenceRef,
    modeConfirmed: false,
    configSnapshot: input.configSnapshot,
    policySnapshot: input.policySnapshot,
    issues: [],
    reviewCycle: 0,
    remainingActions: [],
    history: [created],
    ...(input.activeArtifact ? { activeArtifact: copy(input.activeArtifact) } : {}),
    ...(input.activeWorktree ? { activeWorktree: copy(input.activeWorktree) } : {}),
    contextCapsule: copy(contextCapsule),
    ...(input.intake ? { intake: copy(input.intake) } : {}),
    benchmarkEnabled: input.benchmarkEnabled ?? false,
    ...(input.routingSnapshot ? { routingSnapshot: input.routingSnapshot } : {}),
    routingPolicyVersion: ROUTING_POLICY_VERSION,
    routingDecisions: [],
    ...(input.verificationRequirements ? {
      verificationRequirements: {
        ...copy(input.verificationRequirements),
        requirementsDigest: digest({
          criterionIds: input.verificationRequirements.criterionIds,
          mandatoryCheckIds: input.verificationRequirements.mandatoryCheckIds
        })
      }
    } : {})
  };
  assertV2State(state);
  return state;
}

export function guardStateFingerprint(state: TaskState): string {
  return createHash("sha256").update(stable({
    base: stateFingerprintAtRevision(state, state.revision),
    status: state.status,
    modeConfirmed: state.modeConfirmed,
    resumeTo: state.resumeTo,
    remainingActions: state.remainingActions,
    pendingGate: state.pendingGate,
    contractDigest: state.contractDigest,
    issues: state.issues,
    reviewCycle: state.reviewCycle,
    routingDecisions: state.routingDecisions,
    intake: state.intake,
    benchmarkEnabled: state.benchmarkEnabled
  })).digest("hex");
}

export function createGuardAttestation(state: TaskState, guard: GuardId, input: CreateGuardAttestationInput): GuardEvidence {
  assertV2State(state);
  if (!(GUARD_IDS as readonly string[]).includes(guard)) throw new Error(`Unknown transition guard ${String(guard)}.`);
  if (guard === "intake_complete") {
    validateCompleteIntake(state);
    if (!Array.isArray(input.evidenceRefs) || !input.evidenceRefs.length || !input.evidenceRefs.every(nonEmpty)) {
      throw new Error("intake_complete requires evidence references.");
    }
    const subjectIds = ["objective", "success_signal", "mode", "risk"];
    return createEvaluatorEvidence(state, "intake_complete", "deterministic-check", {
      evaluator: "intake",
      outcome: "intake_complete",
      inputDigest: digest(state.intake),
      evidenceRefs: [...input.evidenceRefs],
      subjectIds,
      completedIds: subjectIds
    });
  }
  if (TRUSTED_EVALUATOR_REQUIRED.has(guard)) throw new Error(`Guard ${guard} requires trusted evaluator.`);
  const evidence: GuardEvidence = {
    schemaVersion: 1,
    guard,
    stateRevision: state.revision,
    stateFingerprint: guardStateFingerprint(state),
    observedFingerprint: input.observedFingerprint,
    evidenceRefs: [...input.evidenceRefs],
    provenance: input.provenance,
    result: input.result ?? "passed"
  };
  validateGuardEvidence(state, evidence);
  return evidence;
}

const trustedEvaluatorEvidence = new WeakSet<object>();

export function evaluateVerification(state: TaskState, input: VerificationEvaluatorInput): GuardEvidence {
  assertV2State(state);
  const requirements = state.verificationRequirements;
  if (!requirements) throw new Error("Verification requires state-bound verificationRequirements.");
  validateVerificationRequirements(requirements);
  assertExactObservations(state, "acceptance criteria", requirements.criterionIds, input.criteria, true);
  assertExactObservations(state, "mandatory checks", requirements.mandatoryCheckIds, input.mandatoryChecks, false);
  const observations = [...input.criteria, ...input.mandatoryChecks];
  const subjectIds = [
    ...requirements.criterionIds.map((id) => `criterion:${id}`),
    ...requirements.mandatoryCheckIds.map((id) => `check:${id}`)
  ];
  return createEvaluatorEvidence(state, "verification_complete", "deterministic-check", {
    evaluator: "verification",
    outcome: "complete",
    inputDigest: digest({
      requirements,
      criteria: input.criteria.map(({ stateRevision: _stateRevision, ...item }) => item),
      mandatoryChecks: input.mandatoryChecks.map(({ stateRevision: _stateRevision, ...item }) => item)
    }),
    evidenceRefs: observations.map((item) => item.evidenceRef),
    subjectIds,
    completedIds: subjectIds
  });
}

export function evaluateHandoffIntent(state: TaskState, input: HandoffIntentEvaluatorInput): GuardEvidence {
  assertV2State(state);
  if (!nonEmpty(input.intentEvidenceRef) || !Array.isArray(input.actions)) throw new Error("Handoff intent requires explicit action set and evidence reference.");
  const ids = input.actions.map((action) => action.id);
  assertUniqueNonEmpty(ids, "handoff action IDs");
  for (const action of input.actions) {
    if (
      action.stateRevision !== state.revision
      || !nonEmpty(action.observedFingerprint)
      || !nonEmpty(action.evidenceRef)
      || !["required", "selected", "not_selected"].includes(action.disposition)
    ) throw new Error(`Handoff intent observation ${String(action.id)} is stale or malformed.`);
  }
  const selected = input.actions.filter((action) => action.disposition !== "not_selected").map((action) => action.id);
  if (input.delivery === "local" && selected.length) throw new Error("Local handoff intent cannot contain required or selected external actions.");
  if (input.delivery === "external" && !selected.length) throw new Error("External handoff intent requires at least one required or selected action.");
  if (input.delivery !== "local" && input.delivery !== "external") throw new Error("Unknown handoff delivery intent.");
  return createEvaluatorEvidence(state, "handoff_intent_resolved", "repository-observation", {
    evaluator: "handoff_intent",
    outcome: input.delivery === "local" ? "local_only" : "external_selected",
    inputDigest: digest(input),
    evidenceRefs: [input.intentEvidenceRef, ...input.actions.map((item) => item.evidenceRef)],
    subjectIds: ids,
    completedIds: selected
  });
}

export function evaluateHandoffReconciliation(
  state: TaskState,
  intent: GuardEvidence,
  input: HandoffReconciliationEvaluatorInput
): GuardEvidence {
  assertV2State(state);
  if (!trustedEvaluatorEvidence.has(intent) || intent.guard !== "handoff_intent_resolved") {
    throw new Error("Handoff reconciliation requires intent from trusted evaluator in current runtime.");
  }
  validateGuardEvidence(state, intent);
  const intentReceipt = intent.evaluatorReceipt;
  if (!intentReceipt || intentReceipt.evaluator !== "handoff_intent" || intentReceipt.outcome !== "external_selected") {
    throw new Error("Handoff reconciliation requires external handoff intent.");
  }
  const selectedIds = [...intentReceipt.completedIds];
  const observationIds = input.observations.map((item) => item.actionId);
  assertSameIds(selectedIds, observationIds, "handoff reconciliation actions");
  const completed: string[] = [];
  for (const observation of input.observations) {
    if (
      observation.stateRevision !== state.revision
      || !nonEmpty(observation.observedFingerprint)
      || !nonEmpty(observation.evidenceRef)
      || !["completed", "pending", "blocked"].includes(observation.status)
    ) throw new Error(`Handoff observation ${String(observation.actionId)} is stale or malformed.`);
    if (observation.status === "completed") {
      if (!nonEmpty(observation.receiptRef)) throw new Error(`Completed handoff action ${observation.actionId} requires receiptRef.`);
      completed.push(observation.actionId);
    } else if (observation.receiptRef !== undefined) {
      throw new Error(`Incomplete handoff action ${observation.actionId} cannot contain receiptRef.`);
    }
  }
  return createEvaluatorEvidence(state, "handoff_reconciled", "repository-observation", {
    evaluator: "handoff_reconciliation",
    outcome: completed.length === selectedIds.length ? "complete" : "action_required",
    inputDigest: digest({ intentReceiptDigest: intentReceipt.receiptDigest, ...input }),
    evidenceRefs: input.observations.flatMap((item) => [item.evidenceRef, ...(item.receiptRef ? [item.receiptRef] : [])]),
    subjectIds: selectedIds,
    completedIds: completed
  });
}

export function evaluateCriticalCompletionApproval(state: TaskState, decision: GateDecision): GuardEvidence {
  assertV2State(state);
  if (state.status !== "awaiting_approval" || state.mode !== "critical" || state.pendingGate !== "critical_completion") {
    throw new Error("Critical completion evaluator requires Critical completion gate.");
  }
  if (
    decision.decision !== "approved"
    || decision.gate !== "critical_completion"
    || decision.stateRevision !== state.revision
    || decision.stateFingerprint !== guardStateFingerprint(state)
    || decision.contractDigest !== state.contractDigest
    || !nonEmpty(decision.evidenceRef)
  ) throw new Error("Critical completion approval is stale, malformed, or not approved.");
  const gateEntry = [...state.history].reverse().find((event): event is StateHistoryEvent =>
    isTransitionEvent(event)
    && event.from === "verifying"
    && event.to === "awaiting_approval"
    && event.gateContext === "critical_completion"
    && event.contractDigest === state.contractDigest
  );
  const compactedGate = state.historySummary?.activeGate;
  const entryVerification = gateEntry?.guardEvidence?.find((item) => item.guard === "verification_complete");
  const verificationReceipt = entryVerification?.evaluatorReceipt
    ?? (compactedGate?.gateContext === "critical_completion" && compactedGate.contractDigest === state.contractDigest
      ? compactedGate.verificationReceipt
      : undefined);
  if (!verificationReceipt || verificationReceipt.evaluator !== "verification") {
    throw new Error("Critical completion gate lacks trusted verification receipt.");
  }
  if (entryVerification) validateEvaluatorReceipt(entryVerification, gateEntry?.sourceFingerprint, gateEntry ? gateEntry.revision - 1 : -1);
  else if (compactedGate) validateCompactedVerificationReceipt(compactedGate);
  return createEvaluatorEvidence(state, "critical_completion_approved", "human-approval", {
    evaluator: "critical_completion",
    outcome: "approved",
    inputDigest: digest({ decision, verificationReceiptDigest: verificationReceipt.receiptDigest }),
    evidenceRefs: [decision.evidenceRef, verificationReceipt.receiptDigest],
    subjectIds: [verificationReceipt.inputDigest],
    completedIds: [decision.evidenceRef]
  });
}

export function createGateDecision(state: TaskState, input: CreateGateDecisionInput): GateDecision {
  assertV2State(state);
  if (state.status !== "awaiting_approval" || !state.pendingGate) throw new Error("Gate decision requires awaiting_approval with pendingGate.");
  if (!nonEmpty(input.evidenceRef) || !nonEmpty(state.contractDigest)) throw new Error("Gate decision requires evidenceRef and state-bound contractDigest.");
  return {
    schemaVersion: 1,
    gate: state.pendingGate,
    decision: input.decision,
    stateRevision: state.revision,
    stateFingerprint: guardStateFingerprint(state),
    evidenceRef: input.evidenceRef,
    contractDigest: state.contractDigest
  };
}

export function addRoutingDecision(state: TaskState, decision: RoutingDecision): TaskState {
  assertV2State(state);
  return { ...state, routingDecisions: [...(state.routingDecisions ?? []), decision] };
}

export function recordHistoryEvent(state: TaskState, input: RecordHistoryEventInput): TaskState {
  assertV2State(state);
  if (STATE_MACHINE[state.status].terminal) throw new Error("Terminal state history is immutable.");
  const eventType = input.type as WorkflowHistoryEventType;
  if (!WORKFLOW_EVENT_TYPES.has(eventType) || eventType === "task.created" || eventType === "state.migrated") {
    throw new Error(`Unsupported workflow history event type ${String(input.type)}.`);
  }
  validateHistoryReferences(input.refs, `Workflow event ${eventType}`);
  const normalized = normalizeHistoryEnvelope(state);
  const event: WorkflowHistoryEvent = {
    sequence: nextHistorySequence(normalized),
    at: normalizeEventAt(input.at),
    type: input.type,
    refs: copy(input.refs)
  };
  const output = withCompactedHistory(normalized, [...normalized.history, event]);
  assertV2State(output);
  return output;
}

export function updateResumeContext(state: TaskState, input: ResumeContextInput): TaskState {
  assertV2State(state);
  if (STATE_MACHINE[state.status].terminal) throw new Error("Terminal state resume context is immutable.");
  const { activeArtifact: _activeArtifact, activeWorktree: _activeWorktree, ...base } = state;
  const updated: TaskState = {
    ...base,
    remainingActions: input.remainingActions === undefined ? [...state.remainingActions] : [...input.remainingActions],
    ...(input.activeArtifact === undefined ? (state.activeArtifact ? { activeArtifact: copy(state.activeArtifact) } : {}) : input.activeArtifact === null ? {} : { activeArtifact: copy(input.activeArtifact) }),
    ...(input.activeWorktree === undefined ? (state.activeWorktree ? { activeWorktree: copy(state.activeWorktree) } : {}) : input.activeWorktree === null ? {} : { activeWorktree: copy(input.activeWorktree) }),
    contextCapsule: input.contextCapsule === undefined
      ? copy(state.contextCapsule ?? defaultContextCapsule(state.configSnapshot, state.policySnapshot))
      : copy(input.contextCapsule)
  };
  const refs: WorkflowHistoryEvent["refs"] = [{ kind: "context-capsule", ref: "state:contextCapsule" }];
  if (updated.activeArtifact) refs.push({ kind: "artifact", ref: "state:activeArtifact", fingerprint: `sha256:${digest(updated.activeArtifact.fingerprint)}` });
  if (updated.activeWorktree) refs.push({ kind: "worktree", ref: "state:activeWorktree", fingerprint: `sha256:${digest(updated.activeWorktree.gitFingerprint)}` });
  return recordHistoryEvent(updated, { type: "context.updated", refs, ...(input.at === undefined ? {} : { at: input.at }) });
}

export function transition(state: TaskState, next: TaskStatus, options: TransitionOptions = {}): TaskState {
  assertV2State(state);
  validateTransitionOptionKeys(options);
  if (!isTaskStatus(next)) throw new Error(`Invalid state transition from ${state.status} to ${String(next)}.`);
  const contract = transitionContract(state.status, next);
  if (!contract) throw new Error(`Invalid state transition from ${state.status} to ${next}.`);
  if (!contract.modes.includes(state.mode)) throw new Error(`Transition ${state.status} to ${next} is not allowed for mode ${state.mode}.`);
  if (state.status === "verifying" && next === "awaiting_approval" && state.mode !== "critical") {
    throw new Error("Only Critical verification may enter the completion gate.");
  }

  const required = requiredGuards(state, contract);
  validateOptionApplicability(state, next, options, required);
  const structural = validateStructuralGuards(state, next, options, required);
  const evidenceByGuard = validateEvidenceSet(state, options.guardEvidence ?? [], required);
  const missing = required.filter((guard) => !structural.has(guard) && !evidenceByGuard.has(guard));
  if (missing.length) throw new Error(`Unmet transition guards from ${state.status} to ${next}: ${missing.join(", ")}.`);
  validateTrustedTarget(state, next, evidenceByGuard);

  const revision = state.revision + 1;
  const normalized = normalizeHistoryEnvelope(state);
  const gateContext = transitionGateContext(state, next);
  const contractDigest = transitionContractDigest(state, next, options);
  const event: StateHistoryEvent = {
    sequence: nextHistorySequence(normalized),
    at: normalizeEventAt(options.at),
    type: "state.transition",
    from: state.status,
    to: next,
    mode: state.mode,
    revision,
    sourceFingerprint: guardStateFingerprint(state),
    ...(gateContext ? { gateContext } : {}),
    ...(contractDigest ? { contractDigest } : {}),
    ...(options.guardEvidence?.length ? { guardEvidence: options.guardEvidence.map((evidence) => copy(evidence)) } : {}),
    ...(options.gateDecision ? { gateDecision: copy(options.gateDecision) } : {}),
    ...(next === "cancelled" || next === "failed"
      ? {
          terminalSource: state.status,
          ...(state.status === "blocked" && state.resumeTo ? { terminalResumeTo: state.resumeTo } : {})
        }
      : {})
  };

  const { resumeTo: _resumeTo, pendingGate: _pendingGate, ...base } = state;
  const metadata = transitionMetadata(state, next, options);
  const output: TaskState = {
    ...base,
    status: next,
    revision,
    modeConfirmed: state.modeConfirmed || (state.status === "awaiting_mode_confirmation" && (next === "executing" || next === "discovering")),
    ...metadata,
    history: normalized.history
  };
  const compacted = withCompactedHistory(output, [...normalized.history, event]);
  assertV2State(compacted);
  return compacted;
}

function transitionGateContext(state: TaskState, next: TaskStatus): ApprovalGate | undefined {
  if (state.pendingGate && (state.status === "awaiting_approval" || state.status === "blocked" || next === "blocked" || next === "awaiting_approval")) return state.pendingGate;
  if (next === "awaiting_approval" && state.status === "planning") return "pre_build";
  if (next === "awaiting_approval" && state.status === "verifying") return "critical_completion";
  return undefined;
}

function transitionContractDigest(state: TaskState, next: TaskStatus, options: TransitionOptions): string | undefined {
  if (next === "awaiting_approval" && state.status === "planning") return options.contractDigest;
  if (state.contractDigest && (state.pendingGate || state.status === "awaiting_approval" || state.status === "blocked" || next === "awaiting_approval" || next === "blocked")) return state.contractDigest;
  return undefined;
}

function transitionMetadata(state: TaskState, next: TaskStatus, options: TransitionOptions): Pick<TaskState, "remainingActions"> & { resumeTo?: TaskStatus; pendingGate?: ApprovalGate; contractDigest?: string } {
  if (next === "blocked") {
    return {
      resumeTo: options.resumeTo as TaskStatus,
      remainingActions: [...(options.remainingActions ?? [])],
      ...(state.pendingGate ? { pendingGate: state.pendingGate } : {}),
      ...(state.contractDigest ? { contractDigest: state.contractDigest } : {})
    };
  }
  if (next === "ready_for_handoff") {
    return { resumeTo: "handing_off", remainingActions: [...(options.remainingActions ?? [])] };
  }
  if (next === "awaiting_approval") {
    const gate = state.status === "planning" ? "pre_build" : state.status === "verifying" ? "critical_completion" : state.pendingGate;
    if (!gate) throw new Error("awaiting_approval requires deterministic pendingGate context.");
    const digest = state.status === "planning" ? options.contractDigest : state.contractDigest;
    if (!nonEmpty(digest)) throw new Error("awaiting_approval requires contractDigest bound to current contract.");
    return { pendingGate: gate, contractDigest: digest, remainingActions: [] };
  }
  return { remainingActions: [] };
}

function transitionContract(from: TaskStatus, to: TaskStatus): TransitionContract | undefined {
  return (STATE_MACHINE[from].transitions as Readonly<Record<string, TransitionContract>>)[to];
}

function requiredGuards(state: TaskState, contract: TransitionContract): GuardId[] {
  return [
    ...contract.guards,
    ...contract.conditionalGuards.filter((conditional) => conditional.when.mode === state.mode).map((conditional) => conditional.guard)
  ];
}

function validateStructuralGuards(state: TaskState, next: TaskStatus, options: TransitionOptions, required: readonly GuardId[]): Set<GuardId> {
  const satisfied = new Set<GuardId>();
  if (required.includes("task_initialized")) {
    if (!nonEmpty(state.taskId) || !isRecord(state.configSnapshot) || !isRecord(state.policySnapshot)) throw new Error("task_initialized failed.");
    satisfied.add("task_initialized");
  }
  if (required.includes("resume_metadata_valid")) {
    if (next === "blocked") {
      if (!options.resumeTo || !options.remainingActions?.length) throw new Error("blocked requires resumeTo and remainingActions.");
      if (!isOperationalResumeTarget(options.resumeTo)) throw new Error(`blocked requires operational, non-stable resumeTo; received ${options.resumeTo}.`);
      if (options.resumeTo === "awaiting_approval" && (!state.pendingGate || !state.contractDigest)) throw new Error("blocked resumeTo awaiting_approval requires existing pendingGate and contractDigest.");
      if (state.pendingGate && options.resumeTo !== "awaiting_approval") throw new Error("blocked state with pendingGate must resume to awaiting_approval.");
    } else if (state.status === "blocked") {
      if (!state.resumeTo || !state.remainingActions.length || !isOperationalResumeTarget(state.resumeTo)) throw new Error("blocked state has invalid resume metadata.");
      if (next !== state.resumeTo) throw new Error(`blocked may transition only to exact resumeTo ${state.resumeTo}.`);
    } else {
      throw new Error(`resume_metadata_valid is not applicable from ${state.status} to ${next}.`);
    }
    satisfied.add("resume_metadata_valid");
  }
  if (required.includes("terminal_source_recorded")) {
    if (options.terminalSource !== state.status) throw new Error(`${next} requires terminalSource equal to current status ${state.status}.`);
    satisfied.add("terminal_source_recorded");
  }
  if (required.includes("gate_context_valid")) {
    validateGateContext(state, next, options.gateDecision);
    satisfied.add("gate_context_valid");
  }
  if (next === "ready_for_handoff" && !options.remainingActions?.length) throw new Error("ready_for_handoff requires remainingActions.");
  return satisfied;
}

function validateGateContext(state: TaskState, next: TaskStatus, decision: GateDecision | undefined): void {
  if (state.status !== "awaiting_approval" || !state.pendingGate || !decision) throw new Error("Gate exit requires pendingGate and bound gateDecision.");
  if (
    decision.schemaVersion !== 1
    || decision.gate !== state.pendingGate
    || decision.stateRevision !== state.revision
    || decision.stateFingerprint !== guardStateFingerprint(state)
    || !nonEmpty(decision.evidenceRef)
    || !nonEmpty(decision.contractDigest)
    || decision.contractDigest !== state.contractDigest
  ) throw new Error("Gate decision is stale, malformed, or bound to another state.");

  if (!gateDecisionAllows(decision.gate, decision.decision, next)) throw new Error(`Gate ${state.pendingGate} decision ${decision.decision} cannot transition to ${next}.`);
}

function gateDecisionAllows(gate: ApprovalGate, decision: GateDecision["decision"], target: TaskStatus): boolean {
  const approvedTargets: Record<ApprovalGate, readonly TaskStatus[]> = {
    pre_build: ["executing"],
    critical_completion: ["handing_off", "ready_for_handoff", "finished_local"]
  };
  const rejectedTargets: Record<ApprovalGate, readonly TaskStatus[]> = {
    pre_build: ["planning"],
    critical_completion: ["resolving_assure", "verifying"]
  };
  return (decision === "approved" ? approvedTargets[gate] : rejectedTargets[gate]).includes(target);
}

function validateEvidenceSet(state: TaskState, evidence: readonly GuardEvidence[], required: readonly GuardId[]): Map<GuardId, GuardEvidence> {
  const output = new Map<GuardId, GuardEvidence>();
  for (const item of evidence) {
    validateGuardEvidence(state, item);
    if (!required.includes(item.guard) || STRUCTURAL_GUARDS.has(item.guard)) throw new Error(`Guard evidence for ${item.guard} is not applicable to this transition.`);
    if (TRUSTED_EVALUATOR_REQUIRED.has(item.guard) && !trustedEvaluatorEvidence.has(item)) {
      throw new Error(`Guard ${item.guard} requires trusted evaluator evidence from current runtime.`);
    }
    if (output.has(item.guard)) throw new Error(`Duplicate guard evidence for ${item.guard}.`);
    output.set(item.guard, item);
  }
  return output;
}

function validateOptionApplicability(state: TaskState, next: TaskStatus, options: TransitionOptions, required: readonly GuardId[]): void {
  const terminal = next === "cancelled" || next === "failed";
  if (options.terminalSource !== undefined && !terminal) throw new Error("terminalSource is valid only for cancelled or failed transitions.");
  if (options.resumeTo !== undefined && next !== "blocked") throw new Error("resumeTo is valid only when entering blocked.");
  if (options.remainingActions !== undefined && next !== "blocked" && next !== "ready_for_handoff") throw new Error("remainingActions is valid only for blocked or ready_for_handoff.");
  if (options.gateDecision !== undefined && !required.includes("gate_context_valid")) throw new Error("gateDecision is valid only when exiting awaiting_approval.");
  if (options.contractDigest !== undefined && next !== "awaiting_approval") throw new Error("contractDigest is valid only when entering awaiting_approval.");
  if (options.contractDigest !== undefined && state.status !== "planning") throw new Error("contractDigest may be supplied only by planning entering pre-build gate.");
  if (options.contractDigest !== undefined && state.verificationRequirements && state.verificationRequirements.sourceDigest !== options.contractDigest) {
    throw new Error("Pre-build contractDigest does not match state-bound verification requirements.");
  }
}

function validateGuardEvidence(state: TaskState, evidence: GuardEvidence): void {
  if (
    evidence.schemaVersion !== 1
    || !(GUARD_IDS as readonly string[]).includes(evidence.guard)
    || evidence.stateRevision !== state.revision
    || evidence.stateFingerprint !== guardStateFingerprint(state)
    || !nonEmpty(evidence.observedFingerprint)
    || !Array.isArray(evidence.evidenceRefs)
    || !evidence.evidenceRefs.length
    || !evidence.evidenceRefs.every(nonEmpty)
    || !["deterministic-check", "human-approval", "repository-observation"].includes(evidence.provenance)
    || !["passed", "not_applicable"].includes(evidence.result)
  ) throw new Error(`Guard evidence for ${String(evidence.guard)} is stale, malformed, or unproven.`);
  if (evidence.result === "not_applicable" && evidence.guard !== "review_satisfied") {
    throw new Error(`Guard ${evidence.guard} cannot be attested not_applicable.`);
  }
  if (TRUSTED_EVALUATOR_REQUIRED.has(evidence.guard)) validateEvaluatorReceipt(evidence, guardStateFingerprint(state), state.revision);
  else if (evidence.evaluatorReceipt !== undefined) throw new Error(`Guard ${evidence.guard} cannot contain evaluatorReceipt.`);
}

function validateTransitionOptionKeys(options: TransitionOptions): void {
  const allowed = new Set(["resumeTo", "remainingActions", "terminalSource", "guardEvidence", "gateDecision", "contractDigest", "at"]);
  const unknown = Object.keys(options).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`Unknown transition options: ${unknown.join(", ")}.`);
}

function createEvaluatorEvidence(
  state: TaskState,
  guard: Extract<GuardId, "intake_complete" | "verification_complete" | "handoff_intent_resolved" | "handoff_reconciled" | "critical_completion_approved">,
  provenance: Exclude<GuardEvidenceProvenance, "deterministic-check"> | "deterministic-check",
  input: Omit<EvaluatorReceiptRecord, "schemaVersion" | "stateRevision" | "stateFingerprint" | "receiptDigest">
): GuardEvidence {
  const receiptBase = {
    schemaVersion: 1 as const,
    ...input,
    stateRevision: state.revision,
    stateFingerprint: guardStateFingerprint(state)
  };
  const receipt: EvaluatorReceiptRecord = { ...receiptBase, receiptDigest: digest(receiptBase) };
  const evidence: GuardEvidence = deepFreezeValue({
    schemaVersion: 1,
    guard,
    stateRevision: state.revision,
    stateFingerprint: guardStateFingerprint(state),
    observedFingerprint: receipt.receiptDigest,
    evidenceRefs: [...receipt.evidenceRefs],
    provenance,
    result: "passed",
    evaluatorReceipt: receipt
  });
  validateGuardEvidence(state, evidence);
  trustedEvaluatorEvidence.add(evidence);
  return evidence;
}

function validateEvaluatorReceipt(evidence: GuardEvidence, expectedFingerprint: unknown, expectedRevision: number): void {
  const receipt = evidence.evaluatorReceipt;
  const expectedEvaluator: Partial<Record<GuardId, EvaluatorReceiptRecord["evaluator"]>> = {
    intake_complete: "intake",
    verification_complete: "verification",
    handoff_intent_resolved: "handoff_intent",
    handoff_reconciled: "handoff_reconciliation",
    critical_completion_approved: "critical_completion"
  };
  if (
    !receipt
    || receipt.schemaVersion !== 1
    || receipt.evaluator !== expectedEvaluator[evidence.guard]
    || receipt.stateRevision !== expectedRevision
    || receipt.stateFingerprint !== expectedFingerprint
    || evidence.observedFingerprint !== receipt.receiptDigest
    || !nonEmpty(receipt.inputDigest)
    || !Array.isArray(receipt.evidenceRefs)
    || !receipt.evidenceRefs.length
    || !receipt.evidenceRefs.every(nonEmpty)
    || !Array.isArray(receipt.subjectIds)
    || !Array.isArray(receipt.completedIds)
  ) throw new Error(`Trusted evaluator receipt for ${evidence.guard} is stale or malformed.`);
  if (!sameIds(evidence.evidenceRefs, receipt.evidenceRefs)) throw new Error(`Trusted evaluator receipt for ${evidence.guard} has mismatched evidence references.`);
  assertUniqueNonEmpty(receipt.subjectIds, "evaluator subject IDs");
  assertUniqueNonEmpty(receipt.completedIds, "evaluator completed IDs", true);
  const { receiptDigest, ...base } = receipt;
  if (receiptDigest !== digest(base)) throw new Error(`Trusted evaluator receipt for ${evidence.guard} has invalid digest.`);
  if (receipt.evaluator === "intake" && (
    receipt.outcome !== "intake_complete"
    || !sameIds(receipt.subjectIds, ["objective", "success_signal", "mode", "risk"])
    || !sameIds(receipt.subjectIds, receipt.completedIds)
  )) throw new Error("Intake evaluator receipt is incomplete.");
  if (receipt.evaluator === "verification" && (receipt.outcome !== "complete" || !sameIds(receipt.subjectIds, receipt.completedIds) || !receipt.subjectIds.length)) {
    throw new Error("Verification evaluator receipt does not prove complete coverage.");
  }
  if (receipt.evaluator === "handoff_intent") {
    if (receipt.outcome === "local_only" && receipt.completedIds.length) throw new Error("Local handoff evaluator receipt selects external actions.");
    if (receipt.outcome === "external_selected" && !receipt.completedIds.length) throw new Error("External handoff evaluator receipt selects no action.");
    if (receipt.outcome !== "local_only" && receipt.outcome !== "external_selected") throw new Error("Handoff intent evaluator receipt has invalid outcome.");
    if (!receipt.completedIds.every((id) => receipt.subjectIds.includes(id))) throw new Error("Handoff intent evaluator receipt contains unknown selected action.");
  }
  if (receipt.evaluator === "handoff_reconciliation") {
    if (!receipt.subjectIds.length || !receipt.completedIds.every((id) => receipt.subjectIds.includes(id))) throw new Error("Handoff reconciliation evaluator receipt contains unknown action.");
    if (receipt.outcome === "complete" && !sameIds(receipt.subjectIds, receipt.completedIds)) throw new Error("Complete handoff receipt lacks completed actions.");
    if (receipt.outcome === "action_required" && sameIds(receipt.subjectIds, receipt.completedIds)) throw new Error("Action-required handoff receipt has no remaining action.");
    if (receipt.outcome !== "complete" && receipt.outcome !== "action_required") throw new Error("Handoff reconciliation evaluator receipt has invalid outcome.");
  }
  if (receipt.evaluator === "critical_completion" && (receipt.outcome !== "approved" || receipt.subjectIds.length !== 1 || receipt.completedIds.length !== 1)) {
    throw new Error("Critical completion evaluator receipt is incomplete.");
  }
}

function validateTrustedTarget(state: TaskState, next: TaskStatus, evidence: Map<GuardId, GuardEvidence>): void {
  const intent = evidence.get("handoff_intent_resolved")?.evaluatorReceipt;
  if (next === "finished_local" && intent?.outcome !== "local_only") throw new Error("finished_local requires local-only handoff intent.");
  if (["handing_off", "ready_for_handoff", "finished"].includes(next) && intent && intent.outcome !== "external_selected") {
    throw new Error(`${next} requires external-selected handoff intent.`);
  }
  const reconciliation = evidence.get("handoff_reconciled")?.evaluatorReceipt;
  if (intent && reconciliation && !sameIds(intent.completedIds, reconciliation.subjectIds)) {
    throw new Error("Handoff reconciliation does not match selected intent actions.");
  }
  if (next === "finished" && reconciliation?.outcome !== "complete") throw new Error("finished requires complete handoff reconciliation.");
  if ((next === "ready_for_handoff" || (state.status === "ready_for_handoff" && next === "handing_off")) && reconciliation?.outcome !== "action_required") {
    throw new Error(`${next} requires action-required handoff reconciliation.`);
  }
  const critical = evidence.get("critical_completion_approved")?.evaluatorReceipt;
  const verification = evidence.get("verification_complete")?.evaluatorReceipt;
  if (critical && verification && critical.subjectIds[0] !== verification.inputDigest) {
    throw new Error("Critical completion approval does not match current verification projection.");
  }
}

function assertExactObservations(
  state: TaskState,
  label: string,
  requiredIds: readonly string[],
  observations: readonly EvaluatorObservation[],
  requireNonEmpty: boolean
): void {
  assertUniqueNonEmpty(requiredIds, `${label} required IDs`, !requireNonEmpty);
  if (!Array.isArray(observations)) throw new Error(`${label} observations must be an array.`);
  assertSameIds(requiredIds, observations.map((item) => item.id), label);
  for (const item of observations) {
    if (item.stateRevision !== state.revision) throw new Error(`${label} observation ${String(item.id)} is stale.`);
    if (!nonEmpty(item.observedFingerprint) || !nonEmpty(item.evidenceRef)) throw new Error(`${label} observation ${String(item.id)} is malformed.`);
    if (!Number.isInteger(item.exitCode)) throw new Error(`${label} observation ${String(item.id)} is malformed.`);
    if (item.exitCode !== 0) throw new Error(`${label} observation ${item.id} did not pass.`);
  }
}

function assertSameIds(expected: readonly string[], actual: readonly string[], label: string): void {
  assertUniqueNonEmpty(actual, `${label} observed IDs`, expected.length === 0);
  if (!sameIds(expected, actual)) throw new Error(`${label} do not exactly cover required IDs.`);
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function assertUniqueNonEmpty(values: readonly string[], label: string, allowEmpty = false): void {
  if (!Array.isArray(values) || (!allowEmpty && !values.length) || !values.every(nonEmpty) || new Set(values).size !== values.length) {
    throw new Error(`${label} must contain unique non-empty values${allowEmpty ? "" : " and cannot be empty"}.`);
  }
}

function validateVerificationRequirements(value: VerificationRequirements): void {
  if (value.schemaVersion !== 1 || !nonEmpty(value.sourceDigest) || !nonEmpty(value.requirementsDigest)) throw new Error("verificationRequirements is malformed.");
  assertUniqueNonEmpty(value.criterionIds, "verification criterion IDs");
  assertUniqueNonEmpty(value.mandatoryCheckIds, "verification mandatory check IDs", true);
  if (value.requirementsDigest !== digest({ criterionIds: value.criterionIds, mandatoryCheckIds: value.mandatoryCheckIds })) {
    throw new Error("verificationRequirements digest does not match required IDs.");
  }
}

function validateCompleteIntake(state: TaskState): void {
  const intake = state.intake;
  const signal = intake?.brief.successSignal;
  if (
    !intake
    || !intake.semanticComplete
    || !intake.deterministicComplete
    || intake.activeQuestion !== undefined
    || intake.contradictions.length > 0
    || intake.blockedReason !== undefined
    || !nonEmpty(intake.brief.objective)
    || !signal
    || !nonEmpty(signal.description)
    || !nonEmpty(signal.observationMethod)
    || intake.brief.mode !== state.mode
    || !["low", "medium", "high", "critical"].includes(intake.brief.risk)
    || intake.brief.technicalUnknowns.some((unknown) => (
      !nonEmpty(unknown.key)
      || !["code", "dependency", "architecture", "validation", "operations"].includes(unknown.kind)
      || !nonEmpty(unknown.description)
      || unknown.owner !== "shape"
    ))
  ) throw new Error("intake_complete requires semantically and deterministically complete Intake Brief.");
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function deepFreezeValue<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreezeValue(nested);
  return Object.freeze(value);
}

export function migrateStateToV2(value: unknown, options: MigrationOptions = {}): StateMigrationResult {
  if (!isRecord(value) || !Number.isInteger(value.schemaVersion)) throw unsupported("State schemaVersion is missing or unsupported");
  if (value.schemaVersion === 2) {
    assertV2State(value);
    return { state: copy(value) as TaskState, migrationRequired: false };
  }
  if (value.schemaVersion !== 1) throw unsupported(`State schemaVersion ${String(value.schemaVersion)} is unsupported`);
  validateV1State(value);

  const source = copy(value) as Record<string, unknown>;
  const rawHistory = source.history as LegacyTransition[];
  if (["handing_off", "ready_for_handoff", "finished_local", "finished"].includes(source.status as string)
    || ["handing_off", "ready_for_handoff"].includes(source.resumeTo as string)) {
    throw ambiguous(`V1 ${source.status} lacks V2 verification evidence and requires reverification`);
  }
  const { mode, evidenceRef, confirmed } = inferMigrationMode(rawHistory, options);
  const migratedTransitions = migrateHistory(rawHistory, mode);
  const fullHistory: DurableHistoryEvent[] = [
    {
      sequence: 1,
      at: migrationEventAt(1),
      type: "task.created",
      refs: [{ kind: "task", ref: "state:taskId" }, { kind: "migration-source", ref: "state:v1" }]
    },
    ...migratedTransitions,
    {
      sequence: migratedTransitions.length + 2,
      at: migrationEventAt(migratedTransitions.length + 2),
      type: "state.migrated",
      refs: [{ kind: "migration-source", ref: "state:v1" }, { kind: "migration-target", ref: "state:v2" }]
    }
  ];
  const rawStatus = source.status as V1Status;
  const status = mapCurrentV1Status(rawStatus, rawHistory);
  const rawResumeTo = source.resumeTo as V1Status | undefined;
  const resumeTo = rawStatus === "blocked" && rawResumeTo === "resolving"
    ? inferResolvingStatus(rawHistory, true)
    : rawStatus === "ready_for_handoff"
      ? "handing_off"
      : rawResumeTo === undefined ? undefined : mapV1OrdinaryStatus(rawResumeTo);

  const {
    schemaVersion: _schemaVersion,
    status: _status,
    resumeTo: _resumeTo,
    history: _history,
    ...preserved
  } = source;
  const migrated: Record<string, unknown> = {
    ...preserved,
    schemaVersion: 2,
    status,
    revision: migratedTransitions.length,
    mode,
    modeEvidenceRef: evidenceRef,
    modeConfirmed: confirmed,
    ...(resumeTo ? { resumeTo } : {}),
    contextCapsule: defaultContextCapsule(source.configSnapshot as Record<string, unknown>, source.policySnapshot as Policy),
    history: fullHistory
  };
  const compacted = withCompactedHistory(migrated as unknown as TaskState, fullHistory);
  assertV2State(compacted);
  return { state: compacted, migrationRequired: true };
}

const V1_STATUSES = [
  "new", "awaiting_mode_confirmation", "discovering", "planning", "awaiting_approval", "executing", "validating",
  "reviewing", "resolving", "verifying", "handing_off", "ready_for_handoff", "blocked", "cancelled", "failed",
  "finished_local", "finished"
] as const;
type V1Status = (typeof V1_STATUSES)[number];
type LegacyTransition = Record<string, unknown> & { from: V1Status; to: V1Status };

const V1_ALLOWED: Readonly<Record<V1Status, readonly V1Status[]>> = {
  new: ["awaiting_mode_confirmation"],
  awaiting_mode_confirmation: ["executing", "discovering", "cancelled"],
  discovering: [], planning: [], awaiting_approval: [],
  executing: ["validating", "blocked"],
  validating: ["reviewing", "verifying", "resolving"],
  reviewing: ["resolving", "verifying"],
  resolving: ["validating", "blocked"],
  verifying: ["handing_off", "finished_local", "ready_for_handoff", "resolving"],
  handing_off: ["finished", "ready_for_handoff"],
  ready_for_handoff: [], blocked: [], cancelled: [], failed: [], finished_local: [], finished: []
};

function validateV1State(value: Record<string, unknown>): void {
  const allowedKeys = new Set([
    "schemaVersion", "taskId", "status", "resumeTo", "configSnapshot", "policySnapshot", "issues", "reviewCycle",
    "remainingActions", "history", "routingSnapshot", "routingPolicyVersion", "routingDecisions"
  ]);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknown.length) throw invalid(`V1 state contains unknown properties: ${unknown.join(", ")}`);
  if (
    typeof value.taskId !== "string" || !value.taskId
    || !isV1Status(value.status)
    || !isRecord(value.configSnapshot) || !isRecord(value.policySnapshot)
    || !Array.isArray(value.issues) || !Number.isInteger(value.reviewCycle) || (value.reviewCycle as number) < 0
    || !Array.isArray(value.remainingActions) || !value.remainingActions.every(nonEmpty)
    || !Array.isArray(value.history)
  ) throw invalid("V1 state does not satisfy required V1 fields");
  if (value.resumeTo !== undefined && !isV1Status(value.resumeTo)) throw invalid("V1 resumeTo is invalid");
  if (value.status === "blocked") {
    const operationalV1 = ["new", "awaiting_mode_confirmation", "discovering", "planning", "awaiting_approval", "executing", "validating", "reviewing", "resolving", "verifying", "handing_off"];
    if (!operationalV1.includes(value.resumeTo as string)) throw invalid("V1 blocked resumeTo must be operational");
  } else if (value.status === "ready_for_handoff") {
    if (value.resumeTo !== "handing_off") throw invalid("V1 ready_for_handoff resumeTo must be handing_off");
  } else if (value.resumeTo !== undefined) {
    throw invalid(`V1 ${value.status} must not contain resumeTo`);
  }

  const history = value.history;
  if (value.status === "new") {
    if (history.length) throw invalid("V1 new state must have empty history");
    return;
  }
  if (!history.length) throw invalid(`V1 ${value.status} cannot migrate without complete transition history`);
  let previousTo: V1Status | undefined;
  for (const [index, raw] of history.entries()) {
    if (!isLegacyTransition(raw)) throw invalid(`V1 history event ${index} is not a recognized transition`);
    if (index === 0 && raw.from !== "new") throw invalid("V1 history must start from new");
    if (previousTo !== undefined && raw.from !== previousTo) throw invalid(`V1 history breaks continuity at event ${index}`);
    if (!V1_ALLOWED[raw.from].includes(raw.to)) throw invalid(`V1 history edge ${raw.from} -> ${raw.to} is illegal`);
    previousTo = raw.to;
  }
  if (previousTo !== value.status) throw invalid(`V1 latest history status ${String(previousTo)} does not match current ${value.status}`);
  if (value.status === "blocked" && (!isV1Status(value.resumeTo) || !value.remainingActions.length)) throw invalid("V1 blocked requires resumeTo and remainingActions");
  if (value.status === "ready_for_handoff" && !value.remainingActions.length) throw invalid("V1 ready_for_handoff requires remainingActions");
}

function inferMigrationMode(history: readonly LegacyTransition[], options: MigrationOptions): { mode: TaskMode; evidenceRef: string; confirmed: boolean } {
  const exit = history.find((event) => event.from === "awaiting_mode_confirmation");
  const inferred = exit?.to === "executing" ? "quick" : undefined;
  const confirmed = exit?.to === "executing" || exit?.to === "discovering";
  if (inferred) {
    if (options.mode && options.mode !== inferred) throw ambiguous(`Migration mode ${options.mode} contradicts Quick history`);
    return { mode: inferred, evidenceRef: options.modeEvidenceRef ?? "migration:history:quick", confirmed };
  }
  if (!options.mode || !nonEmpty(options.modeEvidenceRef)) throw ambiguous("V1 mode cannot be inferred uniquely; provide mode with modeEvidenceRef");
  if (exit?.to === "discovering" && options.mode === "quick") throw ambiguous("Quick mode contradicts V1 discovery history");
  return { mode: options.mode, evidenceRef: options.modeEvidenceRef, confirmed };
}

function migrateHistory(history: readonly LegacyTransition[], mode: TaskMode): StateHistoryEvent[] {
  let resolvingContext: "resolving_build" | "resolving_assure" | undefined;
  return history.map((raw, index) => {
    const from = raw.from === "resolving" ? resolvingContext : mapV1OrdinaryStatus(raw.from);
    if (!from) throw ambiguous(`V1 history event ${index} leaves resolving source ambiguous`);
    let to: TaskStatus;
    if (raw.to === "resolving") {
      resolvingContext = splitResolvingSource(raw.from);
      to = resolvingContext;
    } else {
      to = mapV1OrdinaryStatus(raw.to);
    }
    const contract = transitionContract(from, to);
    if (!contract) throw invalid(`Translated V1 edge ${from} -> ${to} is not canonical V2`);
    // V1 backup remains byte-identical owner of legacy detail. V2 keeps only provenance,
    // never arbitrary event payloads that may contain command output or credentials.
    const legacyData = { migratedFromSchemaVersion: 1 };
    const migrationEvidence: GuardEvidenceRecord[] = [
      ...contract.guards,
      ...contract.conditionalGuards.filter((conditional) => conditional.when.mode === mode).map((conditional) => conditional.guard)
    ].filter((guard) => !STRUCTURAL_GUARDS.has(guard)).map((guard) => ({
      schemaVersion: 1,
      guard,
      stateRevision: index,
      stateFingerprint: `migration:v1:state:${index}`,
      observedFingerprint: `migration:v1:event:${index + 1}`,
      evidenceRefs: [`migration:v1:history:${index + 1}`],
      provenance: "migration-history",
      result: guard === "review_satisfied" ? "not_applicable" : "passed"
    }));
    return {
      sequence: index + 2,
      at: migrationEventAt(index + 2),
      type: "state.transition",
      from,
      to,
      mode,
      revision: index + 1,
      sourceFingerprint: `migration:v1:state:${index}`,
      ...(migrationEvidence.length ? { guardEvidence: migrationEvidence } : {}),
      ...(to === "cancelled" || to === "failed" ? { terminalSource: from } : {}),
      legacyData
    };
  });
}

function mapCurrentV1Status(status: V1Status, history: readonly LegacyTransition[]): TaskStatus {
  return status === "resolving" ? inferResolvingStatus(history, false) : mapV1OrdinaryStatus(status);
}

function inferResolvingStatus(history: readonly LegacyTransition[], blockedContext: boolean): "resolving_build" | "resolving_assure" {
  const event = blockedContext ? history.at(-2) : history.at(-1);
  if (!event || event.to !== "resolving") throw ambiguous("V1 resolving lacks coherent latest entry context");
  return splitResolvingSource(event.from);
}

function splitResolvingSource(source: V1Status): "resolving_build" | "resolving_assure" {
  if (source === "validating") return "resolving_build";
  if (source === "reviewing" || source === "verifying") return "resolving_assure";
  throw ambiguous(`V1 resolving source ${source} does not identify BUILD or ASSURE`);
}

function mapV1OrdinaryStatus(value: V1Status): TaskStatus {
  if (value === "resolving") throw ambiguous("V1 resolving requires history context");
  if (!isTaskStatus(value)) throw invalid(`V1 status ${value} has no V2 mapping`);
  return value;
}

function assertV2State(value: unknown): asserts value is TaskState {
  const schema = validateStateV2(value);
  if (!schema.valid) throw invalid(`State V2 schema validation failed: ${formatSchemaError(schema.errors[0])}`);
  const state = value as TaskState;
  if (state.verificationRequirements) {
    try {
      validateVerificationRequirements(state.verificationRequirements);
    } catch (error) {
      throw invalid(error instanceof Error ? error.message : "verificationRequirements is invalid");
    }
  }
  if (state.contractDigest !== undefined && state.verificationRequirements
    && state.contractDigest !== state.verificationRequirements.sourceDigest) {
    throw invalid("Persisted contractDigest does not match state-bound verification requirements");
  }
  if (state.contextCapsule) validateContextCapsule(state.contextCapsule);
  if (state.activeArtifact && (!compactRef(state.activeArtifact.artifactId) || !compactRef(state.activeArtifact.ownerRef) || !compactRef(state.activeArtifact.fingerprint))) {
    throw invalid("Active artifact reference is malformed");
  }
  if (state.activeWorktree && (!compactRef(state.activeWorktree.worktreeRef) || !compactRef(state.activeWorktree.gitFingerprint))) {
    throw invalid("Active worktree reference is malformed");
  }
  validateHistoryEnvelope(state);
  const events = state.history.filter(isTransitionEvent);
  const compactedTransitions = state.historySummary?.typeCounts["state.transition"] ?? 0;
  if (state.revision !== compactedTransitions + events.length) throw invalid("State V2 revision must equal total transition count");
  let previous: TaskStatus | undefined = state.historySummary?.lastTransition?.to;
  let activeGate: ApprovalGate | undefined = state.historySummary?.activeGate?.gateContext;
  let activeGateDigest: string | undefined = state.historySummary?.activeGate?.contractDigest;
  let activeCriticalVerificationProjection: string | undefined = state.historySummary?.activeGate?.verificationReceipt?.inputDigest;
  for (const [index, event] of events.entries()) {
    if (event.revision !== compactedTransitions + index + 1) throw invalid(`State V2 history revision is non-monotonic at event ${index}`);
    if (index === 0 && compactedTransitions === 0 && event.from !== "new") throw invalid("State V2 history must start from new");
    if (previous !== undefined && event.from !== previous) throw invalid(`State V2 history breaks continuity at event ${index}`);
    if (!(event.to in STATE_MACHINE[event.from].transitions)) throw invalid(`State V2 history edge ${event.from} -> ${event.to} is illegal`);
    const eventContract = transitionContract(event.from, event.to);
    const eventMode = event.mode ?? state.mode;
    if (!eventContract?.modes.includes(eventMode)) throw invalid(`State V2 history edge ${event.from} -> ${event.to} is invalid for mode ${eventMode}`);
    if (!nonEmpty(event.sourceFingerprint)) throw invalid(`State V2 event ${index} lacks sourceFingerprint`);
    if (event.guardEvidence) {
      const seen = new Set<GuardId>();
      for (const evidence of event.guardEvidence) {
        if (evidence.stateRevision !== event.revision - 1 || seen.has(evidence.guard)) throw invalid(`State V2 event ${index} contains stale or duplicate guard evidence`);
        if (evidence.result === "not_applicable" && evidence.guard !== "review_satisfied") throw invalid(`State V2 event ${index} contains invalid not_applicable evidence`);
        if (evidence.stateFingerprint !== event.sourceFingerprint) throw invalid(`State V2 event ${index} contains mismatched evidence stateFingerprint`);
        if (TRUSTED_EVALUATOR_REQUIRED.has(evidence.guard)
          && !(evidence.guard === "intake_complete" && evidence.provenance === "migration-history")) {
          try {
            validateEvaluatorReceipt(evidence, event.sourceFingerprint, event.revision - 1);
          } catch (error) {
            throw invalid(error instanceof Error ? error.message : `State V2 event ${index} has invalid trusted evaluator receipt`);
          }
        } else if (evidence.evaluatorReceipt !== undefined) {
          throw invalid(`State V2 event ${index} has evaluator receipt on untrusted guard ${evidence.guard}`);
        }
        seen.add(evidence.guard);
      }
    }
    const contract = transitionContract(event.from, event.to);
    if (!contract) throw invalid(`State V2 history edge ${event.from} -> ${event.to} lacks contract`);
    const evidenceByGuard = new Map(event.guardEvidence?.map((evidence) => [evidence.guard, evidence]) ?? []);
    try {
      validateTrustedTarget({ ...state, status: event.from } as TaskState, event.to, evidenceByGuard);
    } catch (error) {
      throw invalid(error instanceof Error ? error.message : `State V2 event ${index} has invalid trusted target evidence`);
    }
    if (event.gateDecision) {
      if (event.gateDecision.stateRevision !== event.revision - 1 || event.gateDecision.stateFingerprint !== event.sourceFingerprint) throw invalid(`State V2 event ${index} contains stale gate decision`);
      if (event.from !== "awaiting_approval" || event.gateContext !== event.gateDecision.gate || !gateDecisionAllows(event.gateDecision.gate, event.gateDecision.decision, event.to)) {
        throw invalid(`State V2 event ${index} contains invalid gate decision context`);
      }
    } else if (contract.guards.includes("gate_context_valid")) {
      throw invalid(`State V2 gate exit event ${index} lacks gate decision`);
    }
    if (event.to === "awaiting_approval") {
      const expectedGate = event.from === "planning" ? "pre_build" : event.from === "verifying" ? "critical_completion" : event.from === "blocked" ? event.gateContext : undefined;
      if (!expectedGate || event.gateContext !== expectedGate || !nonEmpty(event.contractDigest)) throw invalid(`State V2 event ${index} lacks valid gate entry context`);
      if (event.from === "blocked" && activeGate !== undefined && (event.gateContext !== activeGate || event.contractDigest !== activeGateDigest)) throw invalid(`State V2 event ${index} changes blocked gate context`);
      activeGate = event.gateContext;
      activeGateDigest = event.contractDigest;
      if (event.from === "verifying") {
        activeCriticalVerificationProjection = evidenceByGuard.get("verification_complete")?.evaluatorReceipt?.inputDigest;
        if (!activeCriticalVerificationProjection) throw invalid(`State V2 event ${index} lacks Critical verification projection`);
      }
    }
    if (event.from === "awaiting_approval") {
      if (activeGate !== undefined && (event.gateContext !== activeGate || event.contractDigest !== activeGateDigest)) throw invalid(`State V2 event ${index} gate digest/context differs from entry`);
      if (event.gateDecision && event.gateDecision.contractDigest !== event.contractDigest) throw invalid(`State V2 event ${index} gate decision digest differs from event`);
      if (event.gateContext === "critical_completion" && event.to !== "blocked" && ["handing_off", "ready_for_handoff", "finished_local"].includes(event.to)) {
        const critical = evidenceByGuard.get("critical_completion_approved")?.evaluatorReceipt;
        if (!critical || (activeCriticalVerificationProjection !== undefined && critical.subjectIds[0] !== activeCriticalVerificationProjection) || critical.completedIds[0] !== event.gateDecision?.evidenceRef) {
          throw invalid(`State V2 event ${index} Critical approval does not match gate verification and decision`);
        }
      }
      if (event.to !== "blocked") {
        activeGate = undefined;
        activeGateDigest = undefined;
        activeCriticalVerificationProjection = undefined;
      }
    } else if (event.from === "blocked" && event.gateContext) {
      if (activeGate !== undefined && (event.gateContext !== activeGate || event.contractDigest !== activeGateDigest)) throw invalid(`State V2 event ${index} changes preserved gate context`);
      if (event.to !== "awaiting_approval" && event.to !== "blocked") {
        activeGate = undefined;
        activeGateDigest = undefined;
        activeCriticalVerificationProjection = undefined;
      }
    }
    const nonStructural = requiredGuards({ ...state, mode: eventMode }, contract).filter((guard) => !STRUCTURAL_GUARDS.has(guard));
    const recorded = new Set(event.guardEvidence?.map((evidence) => evidence.guard) ?? []);
    const missing = nonStructural.filter((guard) => !recorded.has(guard));
    if (missing.length) throw invalid(`State V2 event ${index} lacks durable guard evidence: ${missing.join(", ")}`);
    const terminal = event.to === "cancelled" || event.to === "failed";
    if (terminal) {
      if (event.terminalSource !== event.from) throw invalid("Terminal event source must equal from status");
      if (event.from === "blocked") {
        if (!event.terminalResumeTo || !isOperationalResumeTarget(event.terminalResumeTo)) throw invalid("Blocked terminal event requires operational terminalResumeTo");
      } else if (event.terminalResumeTo !== undefined) throw invalid("terminalResumeTo is valid only for blocked terminal source");
    } else if (event.terminalSource !== undefined || event.terminalResumeTo !== undefined) {
      throw invalid("Non-terminal transition cannot contain terminal source metadata");
    }
    previous = event.to;
  }
  if (state.status === "new") {
    if (events.length || state.revision !== 0) throw invalid("State new must have no transition history");
  } else if (previous !== state.status) {
    throw invalid(`State latest history status ${String(previous)} does not match current ${state.status}`);
  }
  const confirmedByHistory = events.some((event) => event.from === "awaiting_mode_confirmation" && (event.to === "executing" || event.to === "discovering"));
  if (state.modeConfirmed !== ((state.historySummary?.modeConfirmed ?? false) || confirmedByHistory)) throw invalid("State V2 modeConfirmed contradicts history");
  if (state.status === "blocked") {
    if (!state.resumeTo || !isOperationalResumeTarget(state.resumeTo) || !state.remainingActions.length) throw invalid("Blocked V2 state has invalid resume metadata");
    if (state.pendingGate && state.resumeTo !== "awaiting_approval") throw invalid("Blocked pendingGate requires resumeTo awaiting_approval");
  }
  if (state.status === "awaiting_approval") {
    if (!state.pendingGate) throw invalid("awaiting_approval requires pendingGate");
    const latest = events.at(-1);
    if (latest && latest.gateContext !== state.pendingGate) throw invalid("pendingGate contradicts latest gate context");
    if (latest && state.pendingGate === "pre_build" && latest.from !== "planning" && latest.from !== "blocked") throw invalid("pre_build pendingGate requires planning or resumed source");
    if (state.pendingGate === "critical_completion" && ((latest && latest.from !== "verifying" && latest.from !== "blocked") || state.mode !== "critical")) throw invalid("critical_completion pendingGate requires Critical verifying or resumed source");
  }
  if (state.pendingGate) {
    if (activeGate !== state.pendingGate || activeGateDigest !== state.contractDigest) throw invalid("Persisted gate context does not match active gate anchor");
  } else if (activeGate !== undefined) {
    throw invalid("Compacted active gate anchor survives outside a pending gate");
  }
  if (state.status === "cancelled" || state.status === "failed") deriveMacroPhase(state);
}

const STRUCTURAL_GUARDS = new Set<GuardId>(["task_initialized", "resume_metadata_valid", "terminal_source_recorded", "gate_context_valid"]);
const TRUSTED_EVALUATOR_REQUIRED = new Set<GuardId>(["intake_complete", "verification_complete", "handoff_intent_resolved", "handoff_reconciled", "critical_completion_approved"]);
const WORKFLOW_EVENT_TYPES = new Set<WorkflowHistoryEventType>([
  "task.created", "state.migrated", "task.blocked", "task.resumed", "gate.recorded", "scope.approved",
  "artifact.recorded", "issue.recorded", "correction.recorded", "handoff.attempted", "handoff.result", "context.updated",
  "intake.question_recorded", "intake.answer_recorded", "intake.checkpoint", "advance.rejected", "intake.reopened"
]);
const HISTORY_REFERENCE_KINDS = new Set<HistoryReferenceKind>([
  "task", "mode-evidence", "migration-source", "migration-target", "artifact", "worktree", "context-capsule", "context",
  "issue", "correction", "gate", "scope", "handoff", "evidence", "receipt", "command", "criterion", "decision",
  "policy", "config", "git", "symbol"
]);

function isTransitionEvent(event: DurableHistoryEvent): event is StateHistoryEvent {
  return event.type === "state.transition";
}

function normalizeEventAt(value?: string): string {
  const source = value ?? new Date().toISOString();
  if (!isValidRfc3339(source)) throw new Error("History event at must be a valid RFC 3339 calendar timestamp.");
  const date = new Date(source);
  if (!Number.isFinite(date.valueOf())) throw new Error("History event at must be a valid RFC 3339 calendar timestamp.");
  return date.toISOString();
}

function migrationEventAt(sequence: number): string {
  return new Date(sequence - 1).toISOString();
}

function nextHistorySequence(state: TaskState): number {
  return (state.history.at(-1)?.sequence ?? state.historySummary?.lastSequence ?? 0) + 1;
}

function normalizeHistoryEnvelope(state: TaskState): TaskState {
  if (state.history.every((event) => event.sequence !== undefined && event.at !== undefined)) return state;
  if (state.historySummary || state.history.some((event) => event.sequence !== undefined || event.at !== undefined || !isTransitionEvent(event))) {
    throw invalid("State V2 history mixes legacy and structured event envelopes");
  }
  return {
    ...state,
    history: state.history.map((event, index) => ({ ...event, sequence: index + 1, at: migrationEventAt(index + 1) }))
  };
}

function withCompactedHistory(state: TaskState, inputHistory: DurableHistoryEvent[]): TaskState {
  const normalized = normalizeHistoryEnvelope({ ...state, history: inputHistory });
  if (normalized.history.length <= HISTORY_LIMIT) return normalized;
  const removed = normalized.history.slice(0, normalized.history.length - HISTORY_LIMIT);
  const history = normalized.history.slice(-HISTORY_LIMIT);
  const previous = normalized.historySummary;
  const typeCounts: Record<string, number> = { ...(previous?.typeCounts ?? {}) };
  for (const event of removed) typeCounts[event.type] = (typeCounts[event.type] ?? 0) + 1;
  const removedTransitions = removed.filter(isTransitionEvent);
  const lastRemovedTransition = removedTransitions.at(-1);
  const lastTransition = lastRemovedTransition
    ? { sequence: lastRemovedTransition.sequence, revision: lastRemovedTransition.revision, to: lastRemovedTransition.to }
    : previous?.lastTransition;
  const modeConfirmed = (previous?.modeConfirmed ?? false) || removedTransitions.some((event) =>
    event.from === "awaiting_mode_confirmation" && (event.to === "executing" || event.to === "discovering")
  );
  const activeGate = foldCompactedGate(previous?.activeGate, removedTransitions);
  return {
    ...normalized,
    history,
    historySummary: {
      removedCount: (previous?.removedCount ?? 0) + removed.length,
      firstSequence: previous?.firstSequence ?? removed[0]!.sequence,
      lastSequence: removed.at(-1)?.sequence ?? previous?.lastSequence ?? 0,
      firstAt: previous?.firstAt ?? removed[0]!.at,
      lastAt: removed.at(-1)?.at ?? previous?.lastAt ?? "",
      typeCounts,
      modeConfirmed,
      ...(lastTransition ? { lastTransition } : {}),
      ...(activeGate ? { activeGate } : {})
    }
  };
}

function foldCompactedGate(initial: HistoryGateAnchor | undefined, events: readonly StateHistoryEvent[]): HistoryGateAnchor | undefined {
  let active = initial ? copy(initial) : undefined;
  for (const event of events) {
    if (event.to === "awaiting_approval" && (event.from === "planning" || event.from === "verifying")) {
      const gateContext = event.from === "planning" ? "pre_build" : "critical_completion";
      const verificationReceipt = event.guardEvidence?.find((evidence) => evidence.guard === "verification_complete")?.evaluatorReceipt;
      active = {
        gateContext,
        contractDigest: event.contractDigest ?? "",
        entrySequence: event.sequence,
        entryRevision: event.revision,
        entryFrom: event.from,
        sourceFingerprint: event.sourceFingerprint,
        ...(verificationReceipt ? { verificationReceipt: copy(verificationReceipt) } : {})
      };
      continue;
    }
    if (event.from === "awaiting_approval" && event.to !== "blocked") active = undefined;
    else if (event.from === "blocked" && event.gateContext && event.to !== "awaiting_approval" && event.to !== "blocked") active = undefined;
  }
  return active;
}

function validateHistoryEnvelope(state: TaskState): void {
  const structured = state.history.some((event) => event.sequence !== undefined || event.at !== undefined || !isTransitionEvent(event));
  if (!structured && !state.historySummary) return; // Backward-compatible P1.1 V2 reader.
  if (state.history.length > HISTORY_LIMIT) throw invalid(`State V2 history exceeds ${HISTORY_LIMIT} events`);
  let expected = (state.historySummary?.lastSequence ?? 0) + 1;
  for (const [index, event] of state.history.entries()) {
    if (event.sequence !== expected) throw invalid(`State V2 history sequence is non-monotonic at event ${index}`);
    assertRfc3339(event.at, `State V2 event ${index} at`);
    if (!isTransitionEvent(event)) validateHistoryReferences(event.refs, `State V2 event ${index}`);
    expected += 1;
  }
  const summary = state.historySummary;
  if (!summary) {
    if (state.history[0]?.sequence !== 1) throw invalid("State V2 history without summary must start at sequence 1");
    return;
  }
  if (summary.removedCount < 1 || summary.firstSequence !== 1 || summary.lastSequence !== summary.removedCount) throw invalid("State V2 historySummary sequence range is inconsistent");
  assertRfc3339(summary.firstAt, "State V2 historySummary firstAt");
  assertRfc3339(summary.lastAt, "State V2 historySummary lastAt");
  const count = Object.values(summary.typeCounts).reduce((sum, value) => sum + value, 0);
  if (count !== summary.removedCount || Object.entries(summary.typeCounts).some(([type, value]) => !isHistoryType(type) || !Number.isInteger(value) || value < 1)) {
    throw invalid("State V2 historySummary type counters are inconsistent");
  }
  const transitionCount = summary.typeCounts["state.transition"] ?? 0;
  if (transitionCount > 0) {
    if (!summary.lastTransition || summary.lastTransition.revision !== transitionCount || summary.lastTransition.sequence > summary.lastSequence) {
      throw invalid("State V2 historySummary transition anchor is inconsistent");
    }
  } else if (summary.lastTransition !== undefined || summary.modeConfirmed) {
    throw invalid("State V2 historySummary has transition metadata without transitions");
  }
  if (summary.activeGate) validateCompactedGateAnchor(summary.activeGate, transitionCount, summary.lastSequence);
}

function validateCompactedGateAnchor(anchor: HistoryGateAnchor, transitionCount: number, lastSequence: number): void {
  const expectedGate: ApprovalGate = anchor.entryFrom === "planning" ? "pre_build" : "critical_completion";
  if (anchor.gateContext !== expectedGate || !compactRef(anchor.contractDigest) || !compactRef(anchor.sourceFingerprint)
    || anchor.entrySequence > lastSequence || anchor.entryRevision > transitionCount) {
    throw invalid("State V2 compacted gate anchor is malformed");
  }
  if (anchor.gateContext === "pre_build") {
    if (anchor.verificationReceipt !== undefined) throw invalid("Pre-build compacted gate cannot carry verification receipt");
    return;
  }
  if (!anchor.verificationReceipt) throw invalid("Critical compacted gate lacks matching verification receipt");
  try {
    validateCompactedVerificationReceipt(anchor);
  } catch (error) {
    throw invalid(error instanceof Error ? error.message : "Critical compacted gate receipt is invalid");
  }
}

function validateCompactedVerificationReceipt(anchor: HistoryGateAnchor): void {
  const receipt = anchor.verificationReceipt;
  if (!receipt) throw new Error("Critical compacted gate lacks verification receipt.");
  const reconstructed: GuardEvidenceRecord = {
    schemaVersion: 1,
    guard: "verification_complete",
    stateRevision: anchor.entryRevision - 1,
    stateFingerprint: anchor.sourceFingerprint,
    observedFingerprint: receipt.receiptDigest,
    evidenceRefs: [...receipt.evidenceRefs],
    provenance: "deterministic-check",
    result: "passed",
    evaluatorReceipt: receipt
  };
  validateEvaluatorReceipt(reconstructed, anchor.sourceFingerprint, anchor.entryRevision - 1);
}

function isHistoryType(value: string): boolean {
  return value === "state.transition" || WORKFLOW_EVENT_TYPES.has(value as WorkflowHistoryEventType);
}

function assertRfc3339(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !isValidRfc3339(value)) throw invalid(`${label} must be a valid RFC 3339 calendar timestamp`);
}

function isValidRfc3339(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return false;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1]!;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function validateHistoryReferences(refs: unknown, label: string): void {
  if (!Array.isArray(refs) || refs.length < 1 || refs.length > HISTORY_REFERENCE_LIMIT) throw invalid(`${label} requires 1..${HISTORY_REFERENCE_LIMIT} structured references`);
  let totalChars = 0;
  for (const ref of refs) {
    if (!isRecord(ref) || !HISTORY_REFERENCE_KINDS.has(ref.kind as HistoryReferenceKind)
      || !historyReferenceToken(ref.kind, 32) || !historyReferenceToken(ref.ref, 512)
      || (ref.fingerprint !== undefined && !historyReferenceToken(ref.fingerprint, 512))) {
      throw invalid(`${label} contains malformed or non-compact references`);
    }
    totalChars += ref.kind.length + ref.ref.length + (typeof ref.fingerprint === "string" ? ref.fingerprint.length : 0);
  }
  if (totalChars > HISTORY_REFERENCE_TOTAL_CHARS) throw invalid(`${label} references exceed compact size bound`);
}

function historyReferenceToken(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
    && /^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]*$/.test(value);
}

function defaultContextCapsule(configSnapshot: Record<string, unknown>, policySnapshot: Policy): ContextCapsule {
  return {
    schemaVersion: 1,
    entries: [],
    fingerprints: [
      { id: "config", kind: "config", value: `sha256:${digest(configSnapshot)}`, provenanceRef: "state:configSnapshot" },
      { id: "policy", kind: "policy", value: `sha256:${digest(policySnapshot)}`, provenanceRef: "state:policySnapshot" }
    ]
  };
}

function validateContextCapsule(capsule: ContextCapsule): void {
  if (capsule.schemaVersion !== 1 || !Array.isArray(capsule.entries) || !Array.isArray(capsule.fingerprints)) throw invalid("Context Capsule is malformed");
  const ids = new Set<string>();
  for (const fingerprint of capsule.fingerprints) {
    if (!compactRef(fingerprint.id) || ids.has(fingerprint.id) || !["git", "config", "policy", "artifact", "worktree"].includes(fingerprint.kind)
      || !compactRef(fingerprint.value) || !compactRef(fingerprint.provenanceRef)) throw invalid("Context Capsule fingerprint is malformed");
    ids.add(fingerprint.id);
  }
  for (const entry of capsule.entries) {
    if (!["objective", "approved_scope", "risk", "relevant_code", "constraints", "acceptance", "decision", "evidence"].includes(entry.section)
      || !compactRef(entry.ownerRef) || !compactRef(entry.provenanceRef) || !Array.isArray(entry.fingerprintRefs)
      || entry.fingerprintRefs.length < 1 || new Set(entry.fingerprintRefs).size !== entry.fingerprintRefs.length
      || entry.fingerprintRefs.some((id) => !ids.has(id))) throw invalid("Context Capsule entry is malformed or references unknown fingerprints");
  }
}

function compactRef(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !/[\r\n\0]/.test(value);
}

function formatSchemaError(value: unknown): string {
  if (!isRecord(value)) return "unknown schema error";
  return `${String(value.instancePath || "/")} ${String(value.message ?? "invalid")}`;
}

function invalid(message: string): StateMigrationError {
  return new StateMigrationError("state_invalid", `${message}; state was not modified.`);
}

function ambiguous(message: string): StateMigrationError {
  return new StateMigrationError("state_migration_ambiguous", `${message}. Resolve ambiguity with provenance; state was not modified.`);
}

function unsupported(message: string): StateMigrationError {
  return new StateMigrationError("state_version_unsupported", `${message}; state was not modified.`);
}

function isLegacyTransition(value: unknown): value is LegacyTransition {
  return isRecord(value) && isV1Status(value.from) && isV1Status(value.to);
}

function isV1Status(value: unknown): value is V1Status {
  return typeof value === "string" && (V1_STATUSES as readonly string[]).includes(value);
}

function isTaskMode(value: unknown): value is TaskMode {
  return value === "quick" || value === "standard" || value === "critical";
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function copy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copy) as T;
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, copy(nested)])) as T;
  return value;
}

function stateFingerprintAtRevision(state: TaskState, revision: number): string {
  const history = state.history.map((event) => ({
    ...event,
    ...(isTransitionEvent(event) && event.guardEvidence ? {
      guardEvidence: event.guardEvidence.map(({ stateFingerprint: _stateFingerprint, ...evidence }) => evidence)
    } : {}),
    ...(isTransitionEvent(event) && event.gateDecision ? {
      gateDecision: (({ stateFingerprint: _stateFingerprint, ...decision }) => decision)(event.gateDecision)
    } : {})
  }));
  const projection = {
    schemaVersion: state.schemaVersion,
    taskId: state.taskId,
    mode: state.mode,
    modeEvidenceRef: state.modeEvidenceRef,
    configSnapshot: state.configSnapshot,
    policySnapshot: state.policySnapshot,
    verificationRequirements: state.verificationRequirements,
    routingSnapshot: state.routingSnapshot,
    routingPolicyVersion: state.routingPolicyVersion,
    activeArtifact: state.activeArtifact,
    activeWorktree: state.activeWorktree,
    contextCapsule: state.contextCapsule,
    intake: state.intake,
    benchmarkEnabled: state.benchmarkEnabled,
    historySummary: state.historySummary,
    revision,
    history
  };
  return createHash("sha256").update(stable(projection)).digest("hex");
}

function stable(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function compareSnapshot(
  state: Pick<TaskState, "configSnapshot" | "policySnapshot" | "routingSnapshot">,
  current: { config: Record<string, unknown>; policy: Policy; routingSnapshot?: RoutingSnapshot }
): { changed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (stable(state.configSnapshot) !== stable(current.config)) reasons.push("Effective configuration changed.");
  if (stable(state.policySnapshot) !== stable(current.policy)) reasons.push("Effective policy changed.");
  if (state.routingSnapshot && current.routingSnapshot && stableRoutingSnapshot(state.routingSnapshot) !== stableRoutingSnapshot(current.routingSnapshot)) reasons.push("Routing snapshot changed.");
  return { changed: reasons.length > 0, reasons };
}

function stableRoutingSnapshot(snapshot: RoutingSnapshot): string {
  const { capturedAt: _capturedAt, ...behavior } = snapshot;
  return stable(behavior);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalize(nested)]));
  }
  return value;
}
