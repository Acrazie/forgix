import { createHash } from "node:crypto";
import {
  compileDesignState,
  invalidateDesign,
  type ActiveDesignQuestion,
  type DesignState,
  type ProductBaselineDimension,
} from "./design.js";
import { createGuardAttestation, recordHistoryEvent } from "./state.js";
import { deriveMacroPhase } from "./state-machine.js";
import { validateStateV6 } from "./state-validator.js";
import type {
  IntakeQuestionProjection,
  ProductIntakeInput,
  IntakeInvalidation,
  IntakeMetrics,
  IntakeState,
  NormalizedIntakeDecision,
  RiskLevel,
  TaskState,
  TechnicalUnknown,
} from "./types.js";

const MAX_TEXT = 2_000;
const MAX_LIST = 32;
const SECRET = /\b(?:sk-[A-Za-z0-9_-]{8,}|(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+)\b/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?<!\d)(?:\+\d{8,15}|\d{3}[ .()-]\d{3}[ .()-]\d{4})(?!\d)/g;
const DELEGATION_ANSWER =
  /^(?:you decide|decide for me|choose for me|à toi de décider|décide(?:z)? pour moi|comme tu veux)$/i;
const ADVANCE_ANSWER =
  /^(?:next|continue|go ahead|shape|(?:passe|passer|avance|avancer).*(?:étape|etape|stage|shape|suite).*)$/i;

export interface CreateIntakeInput {
  risk: RiskLevel;
  objective?: string;
  successSignal?: ProductIntakeInput["successSignal"];
  sourceRefs?: string[];
  freshnessRefs?: string[];
  capturedAt?: string;
}

export interface IntakeCompleteness {
  complete: boolean;
  missingDecisionKeys: string[];
  reasons: string[];
}

export interface IntakeModelEvaluation {
  productInput: ProductIntakeInput;
  resolvedDecisions: NormalizedIntakeDecision[];
  contradictions: string[];
  semanticComplete: boolean;
  nextQuestion?: IntakeQuestionProjection;
  questionsAvoided?: number;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}

export interface IntakeResponseResult {
  state: TaskState;
  completeness: IntakeCompleteness;
  checkpoint?: {
    objective?: string;
    success?: string;
    risk: RiskLevel;
    answeredDecisionKeys: string[];
  };
}

export function applyInitialIntakeEvaluation(
  state: TaskState,
  evaluation: IntakeModelEvaluation,
  at?: string,
): { state: TaskState; completeness: IntakeCompleteness } {
  assertIntakeWritable(state);
  if (state.design.activeQuestion)
    throw new Error("Initial Intake evaluation cannot replace an active question.");
  const intake =
    state.intake ??
    createIntakeState({
      risk: state.risk,
      sourceRefs: ["request"],
      freshnessRefs: ["state:configSnapshot", "state:policySnapshot"],
      ...(at ? { capturedAt: at } : {}),
    });
  const productInput = sanitizeProductInput(evaluation.productInput);
  if (productInput.risk !== state.risk)
    throw new Error("INTAKE assessment risk must match task risk.");
  const decisions = evaluation.resolvedDecisions.map(validateDecision);
  if (
    decisions.some((decision) => decision.source === "user" && decision.provenanceRef !== "request")
  ) {
    throw new Error("Initial user decisions must be attributable to explicit request.");
  }
  const contradictions = evaluation.contradictions.map(sanitizeText).filter(Boolean);
  const nextQuestion = evaluation.nextQuestion
    ? validateIntakeQuestionProjection(evaluation.nextQuestion, {
        ...intake,
        decisions,
        answeredDecisionKeys: decisions.map((item) => item.key),
      })
    : undefined;
  const candidate: IntakeState = {
    schemaVersion: 1,
    risk: productInput.risk,
    provenance: productInput.provenance,
    technicalUnknowns: productInput.technicalUnknowns,
    ...(nextQuestion ? { activeQuestionId: nextQuestion.id } : {}),
    decisions,
    answeredDecisionKeys: unique(decisions.map((item) => item.key)),
    invalidations: intake.invalidations,
    contradictions,
    semanticComplete: evaluation.semanticComplete,
    deterministicComplete: false,
    checkpointDue: false,
    semanticRetryCount: intake.semanticRetryCount,
    metrics: {
      ...updateMetrics(intake.metrics, decisions, evaluation),
      questionsAsked: nextQuestion ? 1 : 0,
      distinctQuestions: nextQuestion ? 1 : 0,
      zeroQuestionPath: !nextQuestion,
    },
  };
  const design = synchronizeProductDesign(state.design, candidate, productInput, nextQuestion);
  const completeness = evaluateIntakeCompleteness(candidate, design);
  candidate.deterministicComplete = completeness.complete;
  const updated: TaskState = {
    ...state,
    intake: candidate,
    design,
  };
  assertTaskState(updated);
  const persisted = recordHistoryEvent(updated, {
    type: nextQuestion ? "design.question_recorded" : "context.updated",
    refs: nextQuestion
      ? [{ kind: "decision", ref: compactEventRef(nextQuestion.decisionKey) }]
      : [{ kind: "context", ref: "state:intake" }],
    ...(at ? { at } : {}),
  });
  return { state: persisted, completeness };
}

export function createIntakeState(input: CreateIntakeInput): IntakeState {
  const productInput = sanitizeProductInput({
    schemaVersion: 1,
    ...(input.objective ? { objective: input.objective } : {}),
    ...(input.successSignal ? { successSignal: input.successSignal } : {}),
    risk: input.risk,
    provenance: {
      sourceRefs: input.sourceRefs ?? [],
      capturedAt: normalizeAt(input.capturedAt),
      freshnessRefs: input.freshnessRefs ?? [],
    },
    technicalUnknowns: [],
  });
  return {
    schemaVersion: 1,
    risk: productInput.risk,
    provenance: productInput.provenance,
    technicalUnknowns: productInput.technicalUnknowns,
    decisions: [],
    answeredDecisionKeys: [],
    invalidations: [],
    contradictions: [],
    semanticComplete: false,
    deterministicComplete: false,
    checkpointDue: false,
    semanticRetryCount: 0,
    metrics: emptyMetrics(),
  };
}

export function setIntakeQuestionProjection(
  state: TaskState,
  question: IntakeQuestionProjection,
  at?: string,
): TaskState {
  assertIntakeWritable(state);
  const intake =
    state.intake ??
    createIntakeState({
      risk: state.risk,
      sourceRefs: ["request"],
      freshnessRefs: ["state:configSnapshot", "state:policySnapshot"],
      ...(at ? { capturedAt: at } : {}),
    });
  if (state.design.activeQuestion)
    throw new Error(
      "Active Design Question must be answered or cancelled before another question.",
    );
  const normalized = validateIntakeQuestionProjection(question, intake);
  const distinct = !intake.answeredDecisionKeys.includes(normalized.decisionKey);
  const updated: TaskState = {
    ...state,
    intake: {
      ...intake,
      activeQuestionId: normalized.id,
      semanticComplete: false,
      deterministicComplete: false,
      checkpointDue: false,
      semanticRetryCount: intake.semanticRetryCount,
      metrics: {
        ...intake.metrics,
        questionsAsked: intake.metrics.questionsAsked + 1,
        distinctQuestions: intake.metrics.distinctQuestions + (distinct ? 1 : 0),
        zeroQuestionPath: false,
      },
    },
    design: setDesignQuestion(state.design, normalized),
  };
  assertTaskState(updated);
  return recordHistoryEvent(updated, {
    type: "design.question_recorded",
    refs: [{ kind: "decision", ref: compactEventRef(normalized.decisionKey) }],
    ...(at ? { at } : {}),
  });
}

export function applyIntakeResponse(
  state: TaskState,
  answer: string,
  evaluation: IntakeModelEvaluation,
  at?: string,
): IntakeResponseResult {
  assertIntakeWritable(state);
  const intake = state.intake;
  const activeQuestion = state.design.activeQuestion;
  if (!intake?.activeQuestionId || !activeQuestion || intake.activeQuestionId !== activeQuestion.id)
    throw new Error("No active Active Design Question exists.");
  const safeAnswer = sanitizeText(answer);
  if (!safeAnswer || DELEGATION_ANSWER.test(safeAnswer) || ADVANCE_ANSWER.test(safeAnswer)) {
    throw new Error(`Explicit answer required for decision ${activeQuestion.decisionKey}.`);
  }
  if (!Array.isArray(evaluation.resolvedDecisions) || !Array.isArray(evaluation.contradictions)) {
    throw new Error("Intake model evaluation is structurally invalid.");
  }

  const productInput = sanitizeProductInput(evaluation.productInput);
  const resolved = evaluation.resolvedDecisions.map(validateDecision);
  const riskDecision = resolved.find(
    (decision) => decision.key === "risk" && decision.source === "user",
  );
  const riskChanged = productInput.risk !== state.risk;
  if (riskChanged && !riskDecision)
    throw new Error("INTAKE assessment risk change requires an explicit user decision.");
  const resolutionKeys = new Set(resolved.map((item) => item.key));
  const activeResolved = resolutionKeys.has(activeQuestion.decisionKey);
  let nextQuestion: IntakeQuestionProjection | undefined;
  if (evaluation.nextQuestion) {
    const { activeQuestionId: _activeQuestionId, ...intakeWithoutQuestion } = intake;
    const base: IntakeState = {
      ...intakeWithoutQuestion,
      decisions: mergeDecisions(intake.decisions, resolved),
      answeredDecisionKeys: unique([
        ...intake.answeredDecisionKeys,
        ...resolved.map((item) => item.key),
      ]),
    };
    nextQuestion = validateIntakeQuestionProjection(evaluation.nextQuestion, base);
    if (!activeResolved && nextQuestion.decisionKey !== activeQuestion.decisionKey) {
      throw new Error(`Unresolved decision ${activeQuestion.decisionKey} must remain active.`);
    }
    if (!activeResolved) {
      nextQuestion = {
        ...nextQuestion,
        clarificationCount: activeQuestion.clarificationCount + 1,
      };
    }
  } else if (!activeResolved) {
    throw new Error(
      `Evaluation neither resolved nor clarified decision ${activeQuestion.decisionKey}.`,
    );
  }

  const answeredDecisionKeys = unique([
    ...intake.answeredDecisionKeys,
    ...resolved.map((item) => item.key),
  ]);
  const contradictions = evaluation.contradictions.map(sanitizeText).filter(Boolean);
  const metrics = updateMetrics(intake.metrics, resolved, evaluation);
  const checkpointDue =
    metrics.distinctQuestions > 0 &&
    metrics.distinctQuestions % 5 === 0 &&
    answeredDecisionKeys.length >= metrics.distinctQuestions;
  const candidate: IntakeState = {
    schemaVersion: 1,
    risk: productInput.risk,
    provenance: productInput.provenance,
    technicalUnknowns: productInput.technicalUnknowns,
    ...(nextQuestion ? { activeQuestionId: nextQuestion.id } : {}),
    decisions: mergeDecisions(intake.decisions, resolved),
    answeredDecisionKeys,
    invalidations: intake.invalidations,
    contradictions,
    semanticComplete: evaluation.semanticComplete,
    deterministicComplete: false,
    checkpointDue,
    semanticRetryCount: intake.semanticRetryCount,
    ...(nextQuestion && nextQuestion.clarificationCount >= 2 && !activeResolved
      ? { blockedReason: "answer_required" as const }
      : {}),
    metrics,
  };
  const design = synchronizeProductDesign(state.design, candidate, productInput, nextQuestion);
  const completeness = evaluateIntakeCompleteness(candidate, design);
  candidate.deterministicComplete = completeness.complete;
  const updated: TaskState = {
    ...state,
    ...(riskChanged ? { risk: productInput.risk, routingDecisions: [] } : {}),
    intake: candidate,
    design,
  };
  assertTaskState(updated);
  let persisted = recordHistoryEvent(updated, {
    type: "design.answer_recorded",
    refs: resolved.length
      ? resolved
          .slice(0, 16)
          .map((item) => ({ kind: "decision" as const, ref: compactEventRef(item.key) }))
      : [{ kind: "decision", ref: compactEventRef(activeQuestion.decisionKey) }],
    ...(at ? { at } : {}),
  });
  if (checkpointDue) {
    persisted = recordHistoryEvent(persisted, {
      type: "intake.checkpoint",
      refs: [{ kind: "context", ref: "state:intake" }],
      ...(at ? { at } : {}),
    });
  }
  return {
    state: persisted,
    completeness,
    ...(checkpointDue
      ? {
          checkpoint: {
            ...(productInput.objective ? { objective: productInput.objective } : {}),
            ...(productInput.successSignal
              ? { success: productInput.successSignal.description }
              : {}),
            risk: productInput.risk,
            answeredDecisionKeys,
          },
        }
      : {}),
  };
}

function synchronizeProductDesign(
  current: DesignState,
  intake: IntakeState,
  productInput: ProductIntakeInput,
  nextQuestion?: IntakeQuestionProjection,
): DesignState {
  const dimensionDecisions = new Map(
    intake.decisions.flatMap((decision) => {
      const key = baselineKey(decision.key);
      return key ? [[key, decision] as const] : [];
    }),
  );
  const provenance = {
    sourceRefs: [...productInput.provenance.sourceRefs],
    freshnessRefs: [...productInput.provenance.freshnessRefs],
  };
  const dimensionValues: Record<ProductBaselineDimension["key"], string | undefined> = {
    objective: productInput.objective,
    users_value: compactList([...(productInput.affectedUsers ?? []), productInput.motivation]),
    scope: compactList(productInput.scopeBoundaries ?? []),
    success: productInput.successSignal
      ? `${productInput.successSignal.description} [${productInput.successSignal.observationMethod}]`
      : undefined,
    risks_constraints: compactList([
      `risk:${productInput.risk}`,
      ...(productInput.determiningConstraints ?? []),
    ]),
  };
  const dimensions = current.productBaseline.dimensions.map((dimension) => {
    const decision = dimensionDecisions.get(dimension.key);
    if (decision?.recommendationDisposition === "not_applicable") {
      return {
        key: dimension.key,
        status: "not_applicable" as const,
        notApplicableReason: decision.value,
        provenance,
        dependencyNodeId: dimension.dependencyNodeId,
      };
    }
    const value = dimensionValues[dimension.key] ?? decision?.value;
    return {
      key: dimension.key,
      status: value ? ("resolved" as const) : ("missing" as const),
      ...(value ? { value } : {}),
      provenance,
      dependencyNodeId: dimension.dependencyNodeId,
    };
  });
  const activeQuestion = nextQuestion ? projectDesignQuestion(nextQuestion) : undefined;
  const dimensionsComplete = dimensions.every((item) =>
    ["resolved", "not_applicable"].includes(item.status),
  );
  const { digest: _digest, activeQuestion: _activeQuestion, ...designBase } = current;
  return compileDesignState({
    ...designBase,
    productBaseline: { schemaVersion: 1, dimensions },
    ...(activeQuestion ? { activeQuestion } : {}),
    semanticComplete:
      intake.semanticComplete &&
      dimensionsComplete &&
      !activeQuestion &&
      !intake.contradictions.length,
  });
}

function setDesignQuestion(current: DesignState, question: IntakeQuestionProjection): DesignState {
  const { digest: _digest, activeQuestion: _activeQuestion, ...base } = current;
  return compileDesignState({
    ...base,
    activeQuestion: projectDesignQuestion(question),
    semanticComplete: false,
  });
}

function projectDesignQuestion(question: IntakeQuestionProjection): ActiveDesignQuestion {
  const questionKey = baselineKey(question.decisionKey) ?? "scope";
  return {
    schemaVersion: 1,
    id: question.id,
    decisionKey: question.decisionKey,
    kind: "product",
    owner: "intake",
    subjectIds: [`product:${questionKey}`],
    prerequisiteIds: [],
    prompt: question.prompt,
    mode: "choice",
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      consequences: [option.impact],
    })) as NonNullable<ActiveDesignQuestion["options"]>,
    recommendedOptionId: question.recommendedOptionId,
    recommendationBasis: question.recommendationBasis,
    confidence: question.recommendationConfidence,
    priorRole: "intaking",
    selectionReason: question.determiningImpact,
    directConsequences: question.options.map((option) => option.impact),
    freeFormAllowed: true,
    clarificationCount: question.clarificationCount,
  };
}

function baselineKey(key: string): ProductBaselineDimension["key"] | undefined {
  const aliases: Record<string, ProductBaselineDimension["key"]> = {
    objective: "objective",
    users: "users_value",
    users_value: "users_value",
    value: "users_value",
    scope: "scope",
    success: "success",
    success_signal: "success",
    risk: "risks_constraints",
    constraints: "risks_constraints",
    risks_constraints: "risks_constraints",
  };
  return aliases[key];
}

function compactList(values: readonly (string | undefined)[]): string | undefined {
  const compact = values.filter((value): value is string => Boolean(value?.trim()));
  return compact.length ? compact.join("; ") : undefined;
}

export function evaluateIntakeCompleteness(
  intake: IntakeState,
  design: DesignState,
): IntakeCompleteness {
  const missingDecisionKeys: string[] = [];
  const reasons: string[] = [];
  for (const dimension of design.productBaseline.dimensions)
    if (!["resolved", "not_applicable"].includes(dimension.status))
      missingDecisionKeys.push(dimension.key);
  if (!["low", "medium", "high", "critical"].includes(intake.risk))
    missingDecisionKeys.push("risk");
  if (intake.activeQuestionId) reasons.push(`active_question:${intake.activeQuestionId}`);
  if (intake.contradictions.length) reasons.push("contradictions");
  if (!intake.semanticComplete) reasons.push("semantic_incomplete");
  if (!intake.technicalUnknowns.every(validTechnicalUnknown))
    reasons.push("untyped_technical_unknown");
  return {
    complete: missingDecisionKeys.length === 0 && reasons.length === 0,
    missingDecisionKeys: unique(missingDecisionKeys),
    reasons,
  };
}

export function attestIntakeComplete(state: TaskState, evidenceRef: string) {
  const intake = state.intake;
  if (!intake) throw new Error("Intake state is missing.");
  const result = evaluateIntakeCompleteness(intake, state.design);
  if (!result.complete || !intake.deterministicComplete) {
    const missing = [...result.missingDecisionKeys, ...result.reasons];
    throw new Error(`INTAKE incomplete: ${missing.join(", ")}.`);
  }
  return createGuardAttestation(state, "intake_complete", {
    observedFingerprint: `sha256:${digest(intake)}`,
    evidenceRefs: [evidenceRef],
    provenance: "deterministic-check",
  });
}

export function rejectPrematureAdvance(state: TaskState, at?: string): TaskState {
  assertIntakeWritable(state);
  const intake = state.intake;
  if (!intake) throw new Error("Intake state is missing.");
  const completeness = evaluateIntakeCompleteness(intake, state.design);
  if (completeness.complete) return state;
  const missing =
    state.design.activeQuestion?.decisionKey ??
    completeness.missingDecisionKeys[0] ??
    completeness.reasons[0] ??
    "intake_context";
  return recordHistoryEvent(state, {
    type: "advance.rejected",
    refs: [{ kind: "decision", ref: compactEventRef(missing) }],
    ...(at ? { at } : {}),
  });
}

export function invalidateIntakeDecisions(
  state: TaskState,
  decisionKeys: readonly string[],
  reason: string,
  at?: string,
): TaskState {
  if (!state.intake) throw new Error("Intake state is missing.");
  const keys = unique(decisionKeys.map(sanitizeText).filter(Boolean));
  if (!keys.length || !nonEmpty(sanitizeText(reason)))
    throw new Error("Intake invalidation requires decision keys and reason.");
  const timestamp = normalizeAt(at);
  const invalidations: IntakeInvalidation[] = keys.map((decisionKey) => ({
    decisionKey,
    reason: sanitizeText(reason),
    at: timestamp,
  }));
  const productRoots = keys.flatMap((key) => {
    const baseline = baselineKey(key);
    return baseline ? [`product:${baseline}`] : [];
  });
  const design = productRoots.length
    ? invalidateDesign(state.design, productRoots, sanitizeText(reason), timestamp)
    : state.design;
  const questionId =
    design.activeQuestion?.owner === "intake" ? design.activeQuestion.id : undefined;
  const { activeQuestionId: _activeQuestionId, ...intakeBase } = state.intake;
  const updated: TaskState = {
    ...state,
    design,
    intake: {
      ...intakeBase,
      ...(questionId ? { activeQuestionId: questionId } : {}),
      decisions: state.intake.decisions.filter((decision) => !keys.includes(decision.key)),
      answeredDecisionKeys: state.intake.answeredDecisionKeys.filter((key) => !keys.includes(key)),
      invalidations: [...state.intake.invalidations, ...invalidations].slice(-MAX_LIST),
      semanticComplete: false,
      deterministicComplete: false,
      checkpointDue: false,
      semanticRetryCount: state.intake.semanticRetryCount,
      metrics: { ...state.intake.metrics, lateReopenings: state.intake.metrics.lateReopenings + 1 },
    },
  };
  assertTaskState(updated);
  return recordHistoryEvent(updated, {
    type: "intake.reopened",
    refs: keys
      .slice(0, 16)
      .map((key) => ({ kind: "decision" as const, ref: compactEventRef(key) })),
    at: timestamp,
  });
}

export function attestIntakeReopened(state: TaskState, evidenceRef: string) {
  if (
    !state.intake ||
    state.intake.semanticComplete ||
    state.intake.deterministicComplete ||
    !state.intake.invalidations.length
  ) {
    throw new Error("INTAKE reopen requires persisted product-context invalidation.");
  }
  return createGuardAttestation(state, "intake_reopened", {
    observedFingerprint: `sha256:${digest(state.intake.invalidations.at(-1))}`,
    evidenceRefs: [evidenceRef],
    provenance: "deterministic-check",
  });
}

export function routeLateUnknown(kind: "product" | "technical"): "INTAKE" | "SHAPE" {
  return kind === "product" ? "INTAKE" : "SHAPE";
}

export function recordInvalidIntakeModelOutput(state: TaskState): {
  state: TaskState;
  action: "retry_semantic" | "block";
} {
  assertIntakeWritable(state);
  if (!state.intake) throw new Error("Intake state is missing.");
  if (state.intake.semanticRetryCount === 0) {
    const updated: TaskState = {
      ...state,
      intake: { ...state.intake, semanticRetryCount: 1 },
    };
    assertTaskState(updated);
    return { state: updated, action: "retry_semantic" };
  }
  const updated: TaskState = {
    ...state,
    intake: {
      ...state.intake,
      semanticComplete: false,
      deterministicComplete: false,
      blockedReason: "semantic_output_invalid",
    },
  };
  assertTaskState(updated);
  return { state: updated, action: "block" };
}

function validateIntakeQuestionProjection(
  question: IntakeQuestionProjection,
  intake: IntakeState,
): IntakeQuestionProjection {
  if (question.schemaVersion !== 1)
    throw new Error("Active Design Question schemaVersion must be 1.");
  const id = sanitizeText(question.id);
  const decisionKey = sanitizeText(question.decisionKey);
  const missingInformation = sanitizeText(question.missingInformation);
  const determiningImpact = sanitizeText(question.determiningImpact);
  const prompt = sanitizeText(question.prompt);
  const recommendationBasis = sanitizeText(question.recommendationBasis);
  if (
    ![id, decisionKey, missingInformation, determiningImpact, prompt, recommendationBasis].every(
      nonEmpty,
    )
  ) {
    throw new Error(
      "Active Design Question requires id, decisionKey, missing information, determining impact, prompt, and recommendation basis.",
    );
  }
  if (intake.answeredDecisionKeys.includes(decisionKey))
    throw new Error(`Decision ${decisionKey} was already answered.`);
  if (
    !Array.isArray(question.options) ||
    question.options.length < 2 ||
    question.options.length > 3
  ) {
    throw new Error("Active Design Question requires 2–3 mutually exclusive options.");
  }
  const options = question.options.map((option) => ({
    id: sanitizeText(option.id),
    label: sanitizeText(option.label),
    impact: sanitizeText(option.impact),
  }));
  if (
    options.some((option) => !option.id || !option.label || !option.impact) ||
    new Set(options.map((option) => option.id)).size !== options.length
  ) {
    throw new Error("Active Design Question options must have unique IDs, labels, and impacts.");
  }
  if (!options.some((option) => option.id === question.recommendedOptionId)) {
    throw new Error("Recommended option must reference one offered option.");
  }
  if (options[0]?.id !== question.recommendedOptionId) {
    throw new Error("Recommended option must be listed first.");
  }
  if (!question.freeFormAllowed)
    throw new Error("Active Design Question must allow free-form input.");
  if (!["high", "medium", "low"].includes(question.recommendationConfidence))
    throw new Error("Active Design Question recommendation confidence is invalid.");
  if (
    !Number.isInteger(question.clarificationCount) ||
    question.clarificationCount < 0 ||
    question.clarificationCount > 2
  ) {
    throw new Error("Active Design Question clarificationCount must be 0–2.");
  }
  return {
    schemaVersion: 1,
    id,
    decisionKey,
    missingInformation,
    determiningImpact,
    prompt,
    options: options as IntakeQuestionProjection["options"],
    recommendedOptionId: sanitizeText(question.recommendedOptionId),
    recommendationBasis,
    recommendationConfidence: question.recommendationConfidence,
    freeFormAllowed: true,
    clarificationCount: question.clarificationCount,
  };
}

function validateDecision(value: NormalizedIntakeDecision): NormalizedIntakeDecision {
  const decision: NormalizedIntakeDecision = {
    key: sanitizeText(value.key),
    value: sanitizeText(value.value),
    source: value.source,
    provenanceRef: sanitizeText(value.provenanceRef),
    recommendationDisposition: value.recommendationDisposition,
    dependsOn: unique((value.dependsOn ?? []).map(sanitizeText).filter(Boolean)).slice(0, MAX_LIST),
  };
  if (!decision.key || !decision.value || !decision.provenanceRef)
    throw new Error("Normalized decision requires key, value, and provenance.");
  if (!["user", "repository"].includes(decision.source))
    throw new Error("Normalized decision source is invalid.");
  if (!["accepted", "modified", "not_applicable"].includes(decision.recommendationDisposition))
    throw new Error("Recommendation disposition is invalid.");
  return decision;
}

function sanitizeProductInput(value: ProductIntakeInput): ProductIntakeInput {
  if (!value || value.schemaVersion !== 1)
    throw new Error("INTAKE assessment schemaVersion must be 1.");
  const technicalUnknowns = (value.technicalUnknowns ?? [])
    .map((unknown) => ({
      key: sanitizeText(unknown.key),
      kind: unknown.kind,
      description: sanitizeText(unknown.description),
      owner: "shape" as const,
    }))
    .slice(0, MAX_LIST);
  if (!technicalUnknowns.every(validTechnicalUnknown))
    throw new Error("Technical unknowns must be typed and owned by SHAPE.");
  const productInput: ProductIntakeInput = {
    schemaVersion: 1,
    ...(nonEmpty(sanitizeText(value.objective))
      ? { objective: sanitizeText(value.objective) }
      : {}),
    ...(value.successSignal
      ? {
          successSignal: {
            description: sanitizeText(value.successSignal.description),
            observationMethod: sanitizeText(value.successSignal.observationMethod),
            ...(nonEmpty(sanitizeText(value.successSignal.validator))
              ? { validator: sanitizeText(value.successSignal.validator) }
              : {}),
            ...(value.successSignal.guardrails?.length
              ? { guardrails: sanitizeList(value.successSignal.guardrails) }
              : {}),
          },
        }
      : {}),
    risk: value.risk,
    provenance: {
      sourceRefs: sanitizeList(value.provenance?.sourceRefs ?? []),
      capturedAt: normalizeAt(value.provenance?.capturedAt),
      freshnessRefs: sanitizeList(value.provenance?.freshnessRefs ?? []),
    },
    technicalUnknowns,
    ...optionalText("successValidator", value.successValidator),
    ...optionalList("successGuardrails", value.successGuardrails),
    ...optionalList("determiningConstraints", value.determiningConstraints),
    ...optionalList("affectedUsers", value.affectedUsers),
    ...optionalText("motivation", value.motivation),
    ...optionalText("urgency", value.urgency),
    ...optionalList("scopeBoundaries", value.scopeBoundaries),
  };
  if (!["low", "medium", "high", "critical"].includes(productInput.risk))
    throw new Error("INTAKE assessment risk is invalid.");
  return productInput;
}

function mergeDecisions(
  existing: NormalizedIntakeDecision[],
  incoming: NormalizedIntakeDecision[],
): NormalizedIntakeDecision[] {
  const merged = new Map(existing.map((item) => [item.key, item]));
  for (const item of incoming) merged.set(item.key, item);
  return [...merged.values()].slice(-MAX_LIST);
}

function updateMetrics(
  current: IntakeMetrics,
  decisions: NormalizedIntakeDecision[],
  evaluation: IntakeModelEvaluation,
): IntakeMetrics {
  return {
    ...current,
    modelCalls: current.modelCalls + 1,
    questionsAvoided: current.questionsAvoided + Math.max(0, evaluation.questionsAvoided ?? 0),
    recommendationsAccepted:
      current.recommendationsAccepted +
      decisions.filter((item) => item.recommendationDisposition === "accepted").length,
    recommendationsModified:
      current.recommendationsModified +
      decisions.filter((item) => item.recommendationDisposition === "modified").length,
    ...(evaluation.inputTokens === undefined
      ? {}
      : { inputTokens: (current.inputTokens ?? 0) + nonNegativeInteger(evaluation.inputTokens) }),
    ...(evaluation.outputTokens === undefined
      ? {}
      : {
          outputTokens: (current.outputTokens ?? 0) + nonNegativeInteger(evaluation.outputTokens),
        }),
    ...(evaluation.latencyMs === undefined
      ? {}
      : { latencyMs: (current.latencyMs ?? 0) + nonNegativeInteger(evaluation.latencyMs) }),
  };
}

function emptyMetrics(): IntakeMetrics {
  return {
    modelCalls: 0,
    questionsAsked: 0,
    questionsAvoided: 0,
    distinctQuestions: 0,
    recommendationsAccepted: 0,
    recommendationsModified: 0,
    zeroQuestionPath: true,
    lateReopenings: 0,
  };
}

function assertIntakeWritable(state: TaskState): void {
  assertTaskState(state);
  if (deriveMacroPhase(state) !== "INTAKE")
    throw new Error("Active Design Questions may be changed only in INTAKE.");
}

function assertTaskState(state: TaskState): void {
  const result = validateStateV6(state);
  if (!result.valid)
    throw new Error(`Task state is invalid: ${JSON.stringify(result.errors.slice(0, 3))}`);
}

function validTechnicalUnknown(value: TechnicalUnknown): boolean {
  return (
    nonEmpty(value.key) &&
    ["code", "dependency", "architecture", "validation", "operations"].includes(value.kind) &&
    nonEmpty(value.description) &&
    value.owner === "shape"
  );
}

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return (
    value
      .replace(SECRET, "[REDACTED]")
      .replace(EMAIL, "[REDACTED_EMAIL]")
      .replace(PHONE, "[REDACTED_PHONE]")
      // oxlint-disable-next-line eslint/no-control-regex -- control separators are intentionally normalized.
      .replace(/[\u0000\r\n]+/g, " ")
      .trim()
      .slice(0, MAX_TEXT)
  );
}

function sanitizeList(values: readonly string[]): string[] {
  return unique(values.map(sanitizeText).filter(Boolean)).slice(0, MAX_LIST);
}

function optionalText<K extends string>(key: K, value: unknown): Partial<Record<K, string>> {
  const safe = sanitizeText(value);
  return safe ? ({ [key]: safe } as Record<K, string>) : {};
}

function optionalList<K extends string>(
  key: K,
  value: readonly string[] | undefined,
): Partial<Record<K, string[]>> {
  const safe = sanitizeList(value ?? []);
  return safe.length ? ({ [key]: safe } as Record<K, string[]>) : {};
}

function compactEventRef(value: string): string {
  const safe = value
    .replace(/[^A-Za-z0-9._:/#@+~=-]/g, "-")
    .replace(/^-+/, "")
    .slice(0, 400);
  return safe || `sha256:${digest(value)}`;
}

function normalizeAt(value?: string): string {
  if (value && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return new Date().toISOString();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function nonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error("Metric value must be non-negative.");
  return Math.round(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function digest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}
