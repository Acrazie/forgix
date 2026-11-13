import { createHash } from "node:crypto";
import { compileAssuranceContract, validateAssuranceContract } from "./assurance.js";
import {
  dependencyClosure,
  validateDependencyGraph,
  type DependencyGraph,
  type DependencyNode,
} from "./shape-dependencies.js";
import {
  reconcileShapeFreshness,
  type ObservedFingerprintValue,
  type ShapeEvidenceItem,
  type ShapeSourceFingerprint,
} from "./shape-freshness.js";
import type { AssuranceContract, RiskLevel } from "./types.js";

export type PreparationProfile = "quick" | "plan";
export type ShapeRole = "discovering" | "planning";
export type DiscoveryTargetStatus = "open" | "resolved" | "escalated" | "blocked" | "stale";
export type DiscoveryMaterialImpact =
  | "scope"
  | "risk"
  | "acceptance"
  | "plan"
  | "validation"
  | "profile_recommendation";

export interface DiscoveryTarget {
  id: string;
  question: string;
  createdBecause: string;
  createdAt: string;
  materialImpacts: DiscoveryMaterialImpact[];
  candidateSourceRefs: string[];
  status: DiscoveryTargetStatus;
  evidenceIds: string[];
  dependencyNodeId: string;
}

export interface TechnicalDecisionOption {
  id: string;
  label: string;
  impact: string;
  excludedReason?: string;
}

export interface TechnicalDecision {
  schemaVersion: 1;
  id: string;
  decisionKey: string;
  targetId: string;
  materialityReason: string;
  evidenceIds: string[];
  options:
    | [TechnicalDecisionOption, TechnicalDecisionOption]
    | [TechnicalDecisionOption, TechnicalDecisionOption, TechnicalDecisionOption];
  recommendedOptionId: string;
  recommendationBasis: string;
  confidence: "low" | "medium" | "high";
  adrQualified: boolean;
  proposedDestination?: string;
  affectedDependencyRootIds: string[];
  priorRole: ShapeRole;
  status: "active" | "resolved";
  selectedOptionId?: string;
  answerEvidenceRef?: string;
}

export interface DiscoveryReceipt {
  schemaVersion: 1;
  evaluator: "discovery";
  outcome: "discovery_sufficient";
  inputDigest: string;
  evidenceRefs: string[];
  subjectIds: string[];
  completedIds: string[];
  receiptDigest: string;
}

export interface ContractAcceptanceCriterion {
  id: string;
  description: string;
  validationIds: string[];
  dependencyNodeId: string;
}

export interface ContractTask {
  id: string;
  description: string;
  criterionIds: string[];
  dependsOnTaskIds: string[];
  dependencyNodeId: string;
}

export interface ContractValidation {
  id: string;
  description: string;
  criterionIds: string[];
  command?: string;
  dependencyNodeId: string;
}

export interface ContractRisk {
  id: string;
  description: string;
  control: string;
  dependencyNodeId: string;
}

export type GuideReasonKind =
  | "architectural_boundary"
  | "compatibility_migration"
  | "non_obvious_order"
  | "security_concurrency_performance"
  | "mandatory_repository_pattern"
  | "complex_rollback_deployment";

export interface ImplementationGuide {
  dependencyNodeId: string;
  content: string[];
  requiredBecause: Array<{
    kind: GuideReasonKind;
    evidenceIds: string[];
    riskIds: string[];
  }>;
}

export interface CanonicalChangeContract {
  schemaVersion: 1;
  artifactId: string;
  revision: number;
  profile: PreparationProfile;
  risk: RiskLevel;
  productBaselineRef: string;
  discoveryReceiptDigest: string;
  scope: string[];
  nonGoals: string[];
  acceptanceCriteria: ContractAcceptanceCriterion[];
  tasks: ContractTask[];
  validations: ContractValidation[];
  risks: ContractRisk[];
  assuranceContract?: AssuranceContract;
  guide?: ImplementationGuide;
  digest: string;
}

export interface PlanningReceipt {
  schemaVersion: 1;
  evaluator: "planning";
  outcome: "contract_complete";
  inputDigest: string;
  evidenceRefs: string[];
  subjectIds: string[];
  completedIds: string[];
  receiptDigest: string;
}

export interface PlanProjectionRecord {
  schemaVersion: 1;
  path: string;
  status: "Proposed" | "Approved";
  contractDigest: string;
  contentFingerprint: string;
}

export interface PreparationCheckpoint {
  changeShape: string;
  surfaceCategories: string[];
  materialFacts: string[];
}

export interface PreparationProfileChoice {
  schemaVersion: 1;
  status: "pending" | "selected";
  recommendation: PreparationProfile;
  recommendationBasis: string;
  discoveryReceiptDigest: string;
  checkpoint: PreparationCheckpoint;
  selectedProfile?: PreparationProfile;
  selectionEvidenceRef?: string;
}

export interface ShapeUsage {
  reasoningCalls: number;
  inputTokens: number;
  outputTokens: number;
  contextBytes: number;
}

export interface ShapeBudgetLimits {
  maxReasoningCalls?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxContextBytes?: number;
}

export interface ShapeBudgetCheckpoint {
  reason: "reasoning_calls" | "input_tokens" | "output_tokens" | "context_bytes";
  actions: ["continue", "reduce_scope", "cancel"];
}

export interface ShapeBudget {
  limits: ShapeBudgetLimits;
  usage: ShapeUsage;
  continuations: number;
  checkpoint?: ShapeBudgetCheckpoint;
}

export interface ShapeInvalidation {
  rootIds: string[];
  invalidatedNodeIds: string[];
  reason: string;
}

export interface ShapeState {
  schemaVersion: 1;
  risk: RiskLevel;
  productBaselineRef: string;
  discoveryTargets: DiscoveryTarget[];
  evidence: ShapeEvidenceItem[];
  sourceFingerprints: ShapeSourceFingerprint[];
  technicalDecisions: TechnicalDecision[];
  activeTechnicalDecisionId?: string;
  preparationProfileChoice?: PreparationProfileChoice;
  contract?: CanonicalChangeContract;
  projection?: PlanProjectionRecord;
  dependencyGraph: DependencyGraph;
  invalidations: ShapeInvalidation[];
  budget: ShapeBudget;
  semanticRetryCounts: { discovery: number; planning: number };
  evaluatorReceipts: Array<DiscoveryReceipt | PlanningReceipt>;
}

export interface CreateShapeStateInput {
  risk: RiskLevel;
  productBaselineRef: string;
  budget?: ShapeBudgetLimits;
}

export interface DiscoveryEvaluation {
  targets: DiscoveryTarget[];
  evidence: ShapeEvidenceItem[];
  sourceFingerprints: ShapeSourceFingerprint[];
  dependencyNodes: DependencyNode[];
  semanticSufficient: boolean;
  usage?: Partial<ShapeUsage>;
}

export interface DiscoveryCompleteness {
  complete: boolean;
  reasons: string[];
}

export interface PlanningEvaluation {
  semanticImplementable: boolean;
  dependencyNodes: DependencyNode[];
  contract?: Omit<
    CanonicalChangeContract,
    "risk" | "productBaselineRef" | "discoveryReceiptDigest" | "digest"
  >;
  missingEvidenceTarget?: DiscoveryTarget;
  usage?: Partial<ShapeUsage>;
}

export interface ContractCompleteness {
  complete: boolean;
  reasons: string[];
}

export interface ShapeResumeReconciliation {
  state: ShapeState;
  reusedEvidenceIds: string[];
  staleEvidenceIds: string[];
  refreshTargetIds: string[];
  invalidatedNodeIds: string[];
  reasoningRequired: boolean;
}

export interface ShapeBudgetResolution {
  state: ShapeState;
  nextAction: "continue_shape" | "return_to_intake_scope_reduction" | "cancel_shape";
}

// oxlint-disable-next-line eslint/no-control-regex -- persisted tokens must reject NUL and line separators.
const TOKEN = /^[^\r\n\u0000]{1,1024}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]{0,255}$/;
const RISKS: ReadonlySet<RiskLevel> = new Set(["low", "medium", "high", "critical"]);
const IMPACTS: ReadonlySet<DiscoveryMaterialImpact> = new Set([
  "scope",
  "risk",
  "acceptance",
  "plan",
  "validation",
  "profile_recommendation",
]);
const GUIDE_REASONS: ReadonlySet<GuideReasonKind> = new Set([
  "architectural_boundary",
  "compatibility_migration",
  "non_obvious_order",
  "security_concurrency_performance",
  "mandatory_repository_pattern",
  "complex_rollback_deployment",
]);
const MAX_ITEMS = 4096;

export function createShapeState(input: CreateShapeStateInput): ShapeState {
  if (!RISKS.has(input.risk) || !TOKEN.test(input.productBaselineRef)) {
    throw new Error("Shape state requires risk and INTAKE assessment reference.");
  }
  validateBudgetLimits(input.budget ?? {});
  return {
    schemaVersion: 1,
    risk: input.risk,
    productBaselineRef: input.productBaselineRef,
    discoveryTargets: [],
    evidence: [],
    sourceFingerprints: [],
    technicalDecisions: [],
    dependencyGraph: { schemaVersion: 1, nodes: [] },
    invalidations: [],
    budget: {
      limits: { ...input.budget },
      usage: { reasoningCalls: 0, inputTokens: 0, outputTokens: 0, contextBytes: 0 },
      continuations: 0,
    },
    semanticRetryCounts: { discovery: 0, planning: 0 },
    evaluatorReceipts: [],
  };
}

export function applyDiscoveryEvaluation(
  state: ShapeState,
  evaluation: DiscoveryEvaluation,
): ShapeState {
  assertShapeStateEnvelope(state);
  if (
    !evaluation ||
    !Array.isArray(evaluation.targets) ||
    !Array.isArray(evaluation.evidence) ||
    !Array.isArray(evaluation.sourceFingerprints) ||
    !Array.isArray(evaluation.dependencyNodes)
  ) {
    throw new Error("Discovery evaluation is structurally invalid.");
  }
  for (const target of evaluation.targets) validateDiscoveryTarget(target);
  const discoveryTargets = mergeById(state.discoveryTargets, evaluation.targets);
  const evidence = mergeById(state.evidence, evaluation.evidence);
  const sourceFingerprints = mergeById(state.sourceFingerprints, evaluation.sourceFingerprints);
  const dependencyGraph = validateDependencyGraph({
    schemaVersion: 1,
    nodes: mergeById(state.dependencyGraph.nodes, evaluation.dependencyNodes),
  });
  if (
    [
      discoveryTargets.length,
      evidence.length,
      sourceFingerprints.length,
      dependencyGraph.nodes.length,
    ].some((size) => size > MAX_ITEMS)
  ) {
    throw new Error("Discovery evaluation exceeds SHAPE item bounds.");
  }

  const candidate: ShapeState = recordShapeUsage(
    {
      ...state,
      discoveryTargets,
      evidence,
      sourceFingerprints,
      dependencyGraph,
    },
    evaluation.usage ?? { reasoningCalls: 1 },
  );
  validateShapeEvidence(candidate);
  const completeness = evaluateDiscoveryCompleteness(candidate);
  const semanticContradictions = completeness.reasons.filter(
    (reason) => reason !== "budget_checkpoint",
  );
  if (evaluation.semanticSufficient && semanticContradictions.length) {
    throw new Error(
      `Discovery semantic sufficiency contradicts unresolved targets: ${semanticContradictions.join(", ")}.`,
    );
  }
  if (!evaluation.semanticSufficient) return withoutDiscoveryReceipts(candidate);
  return candidate;
}

export function evaluateDiscoveryCompleteness(state: ShapeState): DiscoveryCompleteness {
  assertShapeStateEnvelope(state);
  const reasons: string[] = [];
  const unresolved = state.discoveryTargets.filter((target) => target.status !== "resolved");
  if (unresolved.length)
    reasons.push(...unresolved.map((target) => `target:${target.id}:${target.status}`));
  for (const target of state.discoveryTargets.filter((item) => item.status === "resolved")) {
    if (!target.evidenceIds.length) reasons.push(`target:${target.id}:missing_evidence`);
    for (const evidenceId of target.evidenceIds) {
      if (!state.evidence.some((evidence) => evidence.id === evidenceId))
        reasons.push(`target:${target.id}:unknown_evidence:${evidenceId}`);
    }
  }
  if (!state.discoveryTargets.length) reasons.push("no_discovery_target");
  if (state.activeTechnicalDecisionId) reasons.push("active_technical_decision");
  if (state.budget.checkpoint) reasons.push("budget_checkpoint");
  try {
    validateShapeEvidence(state);
    const observedValues = Object.fromEntries(
      state.sourceFingerprints.map((fingerprint) => [
        fingerprint.id,
        fingerprint.kind === "command"
          ? { value: fingerprint.value, inputDigest: fingerprint.inputDigest! }
          : fingerprint.value,
      ]),
    );
    const freshness = reconcileShapeFreshness({
      graph: state.dependencyGraph,
      fingerprints: state.sourceFingerprints,
      evidence: state.evidence,
      observedValues,
    });
    if (freshness.staleEvidenceIds.length)
      reasons.push(...freshness.staleEvidenceIds.map((id) => `stale_evidence:${id}`));
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : "invalid_evidence");
  }
  return { complete: reasons.length === 0, reasons: [...new Set(reasons)].toSorted() };
}

export function attestDiscoverySufficient(state: ShapeState): DiscoveryReceipt {
  const completeness = evaluateDiscoveryCompleteness(state);
  if (!completeness.complete)
    throw new Error(`Discovery is incomplete: ${completeness.reasons.join(", ")}.`);
  const completedIds = state.discoveryTargets.map((target) => target.id).toSorted();
  const evidenceRefs = state.evidence.map((item) => item.id).toSorted();
  const inputDigest = digest({
    productBaselineRef: state.productBaselineRef,
    risk: state.risk,
    discoveryTargets: state.discoveryTargets,
    evidence: state.evidence,
    sourceFingerprints: state.sourceFingerprints,
    dependencyGraph: state.dependencyGraph,
  });
  const receipt: DiscoveryReceipt = {
    schemaVersion: 1,
    evaluator: "discovery",
    outcome: "discovery_sufficient",
    inputDigest,
    evidenceRefs,
    subjectIds: completedIds,
    completedIds,
    receiptDigest: "",
  };
  receipt.receiptDigest = digest({ ...receipt, receiptDigest: undefined });
  return receipt;
}

export function createTechnicalDecision(
  state: ShapeState,
  input: Omit<TechnicalDecision, "schemaVersion" | "status">,
): ShapeState {
  assertShapeStateEnvelope(state);
  if (state.activeTechnicalDecisionId)
    throw new Error("Only one Technical Decision may be active.");
  const target = state.discoveryTargets.find((item) => item.id === input.targetId);
  if (!target || !["open", "blocked", "stale"].includes(target.status)) {
    throw new Error("Technical Decision requires an unresolved Discovery Target.");
  }
  if (
    !ID.test(input.id) ||
    !ID.test(input.decisionKey) ||
    !TOKEN.test(input.materialityReason) ||
    !TOKEN.test(input.recommendationBasis) ||
    !["low", "medium", "high"].includes(input.confidence) ||
    !["discovering", "planning"].includes(input.priorRole)
  ) {
    throw new Error("Technical Decision identity or impact is invalid.");
  }
  if (
    state.technicalDecisions.some(
      (item) => item.id === input.id || item.decisionKey === input.decisionKey,
    )
  ) {
    throw new Error("Technical Decision identity already exists.");
  }
  if (
    input.options.length < 2 ||
    input.options.length > 3 ||
    new Set(input.options.map((option) => option.id)).size !== input.options.length
  ) {
    throw new Error("Technical Decision requires two or three distinct options.");
  }
  for (const option of input.options) {
    if (
      !ID.test(option.id) ||
      !TOKEN.test(option.label) ||
      !TOKEN.test(option.impact) ||
      (option.excludedReason !== undefined && !TOKEN.test(option.excludedReason))
    ) {
      throw new Error("Technical Decision option is invalid.");
    }
  }
  if (!input.options.some((option) => option.id === input.recommendedOptionId)) {
    throw new Error("Technical Decision recommendation must reference an option.");
  }
  if (
    !input.evidenceIds.length ||
    input.evidenceIds.some((id) => !state.evidence.some((item) => item.id === id))
  ) {
    throw new Error("Technical Decision requires known technical evidence.");
  }
  dependencyClosure(state.dependencyGraph, input.affectedDependencyRootIds);
  const technicalDecision: TechnicalDecision = {
    schemaVersion: 1,
    ...copy(input),
    status: "active",
  };
  return {
    ...withoutDiscoveryReceipts(state),
    discoveryTargets: state.discoveryTargets.map((item) =>
      item.id === target.id ? { ...item, status: "escalated" } : item,
    ),
    technicalDecisions: [...state.technicalDecisions, technicalDecision],
    activeTechnicalDecisionId: technicalDecision.id,
  };
}

export function resolveTechnicalDecision(
  state: ShapeState,
  input: { technicalDecisionId: string; selectedOptionId: string; evidenceRef: string },
): { state: ShapeState; resumeRole: ShapeRole; invalidatedNodeIds: string[] } {
  assertShapeStateEnvelope(state);
  const technicalDecision = state.technicalDecisions.find(
    (item) => item.id === input.technicalDecisionId,
  );
  if (
    !technicalDecision ||
    technicalDecision.status !== "active" ||
    state.activeTechnicalDecisionId !== technicalDecision.id
  ) {
    throw new Error("Active Technical Decision does not exist.");
  }
  if (
    !technicalDecision.options.some((option) => option.id === input.selectedOptionId) ||
    !TOKEN.test(input.evidenceRef)
  ) {
    throw new Error("Technical Decision requires explicit selected option and evidence.");
  }
  const invalidatedNodeIds = dependencyClosure(
    state.dependencyGraph,
    technicalDecision.affectedDependencyRootIds,
  );
  const invalidatedSet = new Set(invalidatedNodeIds);
  const { activeTechnicalDecisionId: _activeTechnicalDecisionId, ...base } =
    withoutDiscoveryReceipts(state);
  const nextState: ShapeState = {
    ...base,
    discoveryTargets: state.discoveryTargets.map((target) =>
      target.id === technicalDecision.targetId ? { ...target, status: "stale" } : target,
    ),
    technicalDecisions: state.technicalDecisions.map((item) =>
      item.id === technicalDecision.id
        ? {
            ...item,
            status: "resolved",
            selectedOptionId: input.selectedOptionId,
            answerEvidenceRef: input.evidenceRef,
          }
        : item,
    ),
    invalidations: [
      ...state.invalidations,
      {
        rootIds: [...technicalDecision.affectedDependencyRootIds],
        invalidatedNodeIds,
        reason: `decision:${technicalDecision.decisionKey}`,
      },
    ],
    evidence: state.evidence.filter((item) => !invalidatedSet.has(item.dependencyNodeId)),
  };
  const needsDiscovery = nextState.discoveryTargets.some((target) =>
    ["open", "stale", "blocked"].includes(target.status),
  );
  return {
    state: nextState,
    resumeRole: needsDiscovery ? "discovering" : technicalDecision.priorRole,
    invalidatedNodeIds,
  };
}

export function requestPreparationProfileChoice(
  state: ShapeState,
  input: {
    recommendation: PreparationProfile;
    recommendationBasis: string;
    checkpoint: PreparationCheckpoint;
    discoveryReceipt: DiscoveryReceipt;
    preselectedProfile?: PreparationProfile;
    selectionEvidenceRef?: string;
  },
): ShapeState {
  assertShapeStateEnvelope(state);
  validateDiscoveryReceipt(state, input.discoveryReceipt);
  if (state.preparationProfileChoice) throw new Error("Preparation profile choice already exists.");
  if (!["quick", "plan"].includes(input.recommendation) || !TOKEN.test(input.recommendationBasis)) {
    throw new Error("Preparation profile recommendation is invalid.");
  }
  validateCheckpoint(input.checkpoint);
  if (input.preselectedProfile && !TOKEN.test(input.selectionEvidenceRef ?? "")) {
    throw new Error("Preselected preparation profile requires evidence.");
  }
  const autonomousPreselect = input.selectionEvidenceRef?.startsWith("policy:autonomous:") ?? false;
  if (input.preselectedProfile && input.preselectedProfile !== "plan" && !autonomousPreselect) {
    throw new Error("Only explicit durable-plan request or policy may preselect Plan.");
  }
  const selected = input.preselectedProfile;
  return {
    ...state,
    evaluatorReceipts: [...state.evaluatorReceipts, copy(input.discoveryReceipt)],
    preparationProfileChoice: {
      schemaVersion: 1,
      status: selected ? "selected" : "pending",
      recommendation: input.recommendation,
      recommendationBasis: input.recommendationBasis,
      discoveryReceiptDigest: input.discoveryReceipt.receiptDigest,
      checkpoint: copy(input.checkpoint),
      ...(selected
        ? { selectedProfile: selected, selectionEvidenceRef: input.selectionEvidenceRef }
        : {}),
    },
  };
}

export function selectPreparationProfile(
  state: ShapeState,
  input: { profile: PreparationProfile; evidenceRef: string },
): ShapeState {
  assertShapeStateEnvelope(state);
  const choice = state.preparationProfileChoice;
  if (!choice || choice.status !== "pending")
    throw new Error("Pending preparation profile choice does not exist.");
  if (
    !state.evaluatorReceipts.some(
      (receipt) =>
        receipt.evaluator === "discovery" &&
        receipt.receiptDigest === choice.discoveryReceiptDigest,
    )
  )
    throw new Error("Preparation profile choice is stale because Discovery changed.");
  if (!["quick", "plan"].includes(input.profile) || !TOKEN.test(input.evidenceRef)) {
    throw new Error("Preparation profile requires explicit profile and evidence.");
  }
  return {
    ...state,
    preparationProfileChoice: {
      ...choice,
      status: "selected",
      selectedProfile: input.profile,
      selectionEvidenceRef: input.evidenceRef,
    },
  };
}

export function applyPlanningEvaluation(
  state: ShapeState,
  evaluation: PlanningEvaluation,
): ShapeState {
  assertShapeStateEnvelope(state);
  const choice = state.preparationProfileChoice;
  if (!choice || choice.status !== "selected" || !choice.selectedProfile) {
    throw new Error("Planning requires selected preparation profile.");
  }
  const discoveryReceipt = state.evaluatorReceipts.find(
    (receipt): receipt is DiscoveryReceipt => receipt.evaluator === "discovery",
  );
  if (!discoveryReceipt) throw new Error("Planning requires current Discovery receipt.");
  if (!evaluation || !Array.isArray(evaluation.dependencyNodes))
    throw new Error("Planning evaluation is structurally invalid.");

  const dependencyGraph = validateDependencyGraph({
    schemaVersion: 1,
    nodes: mergeById(state.dependencyGraph.nodes, evaluation.dependencyNodes),
  });
  let candidate = recordShapeUsage(
    { ...state, dependencyGraph },
    evaluation.usage ?? { reasoningCalls: 1 },
  );

  if (evaluation.missingEvidenceTarget) {
    if (evaluation.semanticImplementable || evaluation.contract) {
      throw new Error("Missing Planning evidence cannot accompany implementable contract.");
    }
    validateDiscoveryTarget(evaluation.missingEvidenceTarget);
    if (
      evaluation.missingEvidenceTarget.status !== "open" ||
      evaluation.missingEvidenceTarget.evidenceIds.length
    ) {
      throw new Error("Missing Planning evidence must create one open Discovery Target.");
    }
    return {
      ...withoutPlanningReceipts(candidate),
      discoveryTargets: mergeById(candidate.discoveryTargets, [evaluation.missingEvidenceTarget]),
    };
  }

  if (!evaluation.contract)
    throw new Error("Planning evaluation requires contract or missing-evidence target.");
  if (evaluation.contract.profile !== choice.selectedProfile) {
    throw new Error("Planning contract profile does not match selected profile.");
  }
  const contract: CanonicalChangeContract = {
    ...copy(evaluation.contract),
    risk: state.risk,
    productBaselineRef: state.productBaselineRef,
    discoveryReceiptDigest: discoveryReceipt.receiptDigest,
    digest: "",
  };
  contract.assuranceContract ??= deriveAssuranceContract(contract);
  contract.digest = digest(contractProjectionForDigest(contract));
  candidate = { ...withoutPlanningReceipts(candidate), contract };
  const completeness = evaluateContractCompleteness(candidate);
  if (evaluation.semanticImplementable && !completeness.complete) {
    throw new Error(
      `Planning semantic implementability contradicts contract: ${completeness.reasons.join(", ")}.`,
    );
  }
  if (!evaluation.semanticImplementable) {
    const { contract: _contract, ...withoutContract } = candidate;
    return withoutContract;
  }
  const receipt = attestContractComplete(candidate);
  return {
    ...candidate,
    evaluatorReceipts: [
      ...candidate.evaluatorReceipts.filter((item) => item.evaluator !== "planning"),
      receipt,
    ],
  };
}

export function evaluateContractCompleteness(state: ShapeState): ContractCompleteness {
  assertShapeStateEnvelope(state);
  const contract = state.contract;
  const reasons: string[] = [];
  const choice = state.preparationProfileChoice;
  if (!choice || choice.status !== "selected" || !choice.selectedProfile)
    reasons.push("profile_not_selected");
  if (!contract) return { complete: false, reasons: [...reasons, "contract_missing"].toSorted() };
  if (
    contract.schemaVersion !== 1 ||
    !ID.test(contract.artifactId) ||
    !Number.isInteger(contract.revision) ||
    contract.revision < 1
  ) {
    reasons.push("contract_identity");
  }
  if (contract.profile !== choice?.selectedProfile) reasons.push("profile_mismatch");
  if (contract.risk !== state.risk || contract.productBaselineRef !== state.productBaselineRef)
    reasons.push("intake_binding");
  const discoveryReceipt = state.evaluatorReceipts.find(
    (receipt) => receipt.evaluator === "discovery",
  );
  if (!discoveryReceipt || contract.discoveryReceiptDigest !== discoveryReceipt.receiptDigest)
    reasons.push("discovery_binding");
  if (
    !Array.isArray(contract.scope) ||
    !contract.scope.length ||
    contract.scope.some((item) => !TOKEN.test(item))
  )
    reasons.push("scope");
  if (
    contract.profile === "plan" &&
    (!Array.isArray(contract.nonGoals) || !contract.nonGoals.length)
  )
    reasons.push("plan_non_goals");
  if (!contract.acceptanceCriteria.length) reasons.push("acceptance_criteria");
  if (!contract.tasks.length) reasons.push("tasks");
  if (!contract.validations.length) reasons.push("validations");
  if (!contract.assuranceContract) reasons.push("assurance_contract");
  else {
    try {
      validateAssuranceContract(contract.assuranceContract);
    } catch (error) {
      reasons.push(`assurance_contract:${error instanceof Error ? error.message : "invalid"}`);
    }
  }

  const criterionIds = uniqueIds(contract.acceptanceCriteria, "criterion", reasons);
  const taskIds = uniqueIds(contract.tasks, "task", reasons);
  const validationIds = uniqueIds(contract.validations, "validation", reasons);
  const riskIds = uniqueIds(contract.risks, "risk", reasons);
  const evidenceIds = new Set(state.evidence.map((item) => item.id));
  const graphNodes = new Map(state.dependencyGraph.nodes.map((node) => [node.id, node]));

  for (const criterion of contract.acceptanceCriteria) {
    validateContractItem(criterion, "criterion", graphNodes, reasons);
    if (
      !criterion.validationIds.length ||
      criterion.validationIds.some((id) => !validationIds.has(id))
    ) {
      reasons.push(`criterion:${criterion.id}:validation_coverage`);
    }
    if (!contract.tasks.some((task) => task.criterionIds.includes(criterion.id))) {
      reasons.push(`criterion:${criterion.id}:task_coverage`);
    }
  }
  for (const task of contract.tasks) {
    validateContractItem(task, "task", graphNodes, reasons);
    if (!task.criterionIds.length || task.criterionIds.some((id) => !criterionIds.has(id))) {
      reasons.push(`task:${task.id}:criterion_coverage`);
    }
    if (task.dependsOnTaskIds.some((id) => !taskIds.has(id) || id === task.id)) {
      reasons.push(`task:${task.id}:dependencies`);
    }
  }
  for (const validation of contract.validations) {
    validateContractItem(validation, "validation", graphNodes, reasons);
    if (
      !validation.criterionIds.length ||
      validation.criterionIds.some((id) => !criterionIds.has(id))
    ) {
      reasons.push(`validation:${validation.id}:criterion_coverage`);
    }
  }
  for (const risk of contract.risks) {
    validateContractItem(risk, "risk", graphNodes, reasons);
    if (!TOKEN.test(risk.control)) reasons.push(`risk:${risk.id}:control`);
  }
  if (contract.guide) {
    if (contract.profile !== "plan") reasons.push("quick_guide_forbidden");
    if (graphNodes.get(contract.guide.dependencyNodeId)?.kind !== "guide")
      reasons.push("guide_dependency_node");
    if (!contract.guide.content.length || contract.guide.content.some((item) => !TOKEN.test(item)))
      reasons.push("guide_content");
    if (!contract.guide.requiredBecause.length) reasons.push("guide_reason");
    for (const reason of contract.guide.requiredBecause) {
      if (!GUIDE_REASONS.has(reason.kind)) reasons.push("guide_reason_kind");
      if (!reason.evidenceIds.length && !reason.riskIds.length)
        reasons.push("Guide reason requires evidence or risk");
      if (
        reason.evidenceIds.some((id) => !evidenceIds.has(id)) ||
        reason.riskIds.some((id) => !riskIds.has(id))
      ) {
        reasons.push("guide_reason_reference");
      }
    }
  }
  try {
    validateDependencyGraph(state.dependencyGraph);
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : "dependency_graph");
  }
  if (contract.digest !== digest(contractProjectionForDigest(contract)))
    reasons.push("contract_digest");
  if (state.budget.checkpoint) reasons.push("budget_checkpoint");
  return { complete: reasons.length === 0, reasons: [...new Set(reasons)].toSorted() };
}

export function attestContractComplete(state: ShapeState): PlanningReceipt {
  const completeness = evaluateContractCompleteness(state);
  if (!completeness.complete || !state.contract) {
    throw new Error(`Contract is incomplete: ${completeness.reasons.join(", ")}.`);
  }
  const subjectIds = [
    ...state.contract.acceptanceCriteria.map((item) => item.id),
    ...state.contract.tasks.map((item) => item.id),
    ...state.contract.validations.map((item) => item.id),
  ].toSorted();
  const inputDigest = digest({
    contract: state.contract,
    dependencyGraph: state.dependencyGraph,
    profileChoice: state.preparationProfileChoice,
  });
  const receipt: PlanningReceipt = {
    schemaVersion: 1,
    evaluator: "planning",
    outcome: "contract_complete",
    inputDigest,
    evidenceRefs: state.evidence.map((item) => item.id).toSorted(),
    subjectIds,
    completedIds: subjectIds,
    receiptDigest: "",
  };
  receipt.receiptDigest = digest({ ...receipt, receiptDigest: undefined });
  return receipt;
}

export function recordShapeUsage(state: ShapeState, usage: Partial<ShapeUsage>): ShapeState {
  assertShapeStateEnvelope(state);
  const increment = {
    reasoningCalls: nonNegativeInteger(usage.reasoningCalls ?? 0, "reasoningCalls"),
    inputTokens: nonNegativeInteger(usage.inputTokens ?? 0, "inputTokens"),
    outputTokens: nonNegativeInteger(usage.outputTokens ?? 0, "outputTokens"),
    contextBytes: nonNegativeInteger(usage.contextBytes ?? 0, "contextBytes"),
  };
  const nextUsage: ShapeUsage = {
    reasoningCalls: state.budget.usage.reasoningCalls + increment.reasoningCalls,
    inputTokens: state.budget.usage.inputTokens + increment.inputTokens,
    outputTokens: state.budget.usage.outputTokens + increment.outputTokens,
    contextBytes: state.budget.usage.contextBytes + increment.contextBytes,
  };
  const reason = budgetReason(state.budget.limits, nextUsage);
  return {
    ...state,
    budget: {
      ...state.budget,
      usage: nextUsage,
      ...(reason
        ? { checkpoint: { reason, actions: ["continue", "reduce_scope", "cancel"] } }
        : {}),
    },
  };
}

export function resolveShapeBudgetCheckpoint(
  state: ShapeState,
  action: "continue" | "reduce_scope" | "cancel",
): ShapeState {
  return resolveShapeBudgetCheckpointWithRouting(state, action).state;
}

export function resolveShapeBudgetCheckpointWithRouting(
  state: ShapeState,
  action: "continue" | "reduce_scope" | "cancel",
): ShapeBudgetResolution {
  assertShapeStateEnvelope(state);
  if (!state.budget.checkpoint || !state.budget.checkpoint.actions.includes(action)) {
    throw new Error("Active SHAPE budget checkpoint and explicit action are required.");
  }
  const { checkpoint: _checkpoint, ...budget } = state.budget;
  return {
    state: {
      ...state,
      budget: {
        ...budget,
        continuations: budget.continuations + (action === "continue" ? 1 : 0),
      },
    },
    nextAction:
      action === "continue"
        ? "continue_shape"
        : action === "reduce_scope"
          ? "return_to_intake_scope_reduction"
          : "cancel_shape",
  };
}

export function reconcileShapeResume(
  state: ShapeState,
  observedValues: Readonly<Record<string, ObservedFingerprintValue>>,
  now?: string,
): ShapeResumeReconciliation {
  validateShapeState(state);
  const result = reconcileShapeFreshness({
    graph: state.dependencyGraph,
    fingerprints: state.sourceFingerprints,
    evidence: state.evidence,
    observedValues,
    ...(now ? { now } : {}),
  });
  if (!result.staleEvidenceIds.length) {
    return {
      state,
      reusedEvidenceIds: result.reusedEvidenceIds,
      staleEvidenceIds: [],
      refreshTargetIds: [],
      invalidatedNodeIds: [],
      reasoningRequired: false,
    };
  }

  const invalidated = new Set(result.invalidatedNodeIds);
  const staleEvidence = new Set(result.staleEvidenceIds);
  const refreshTargets = state.evidence
    .filter((item) => staleEvidence.has(item.id))
    .map(
      (item): DiscoveryTarget => ({
        id: `refresh:${item.id}`,
        question: `Refresh stale evidence ${item.id}`,
        createdBecause: "Referenced source fingerprint changed during resume reconciliation.",
        createdAt: now ?? new Date().toISOString(),
        materialImpacts: ["plan", "validation"],
        candidateSourceRefs: item.provenanceRefs,
        status: "open",
        evidenceIds: [],
        dependencyNodeId: item.dependencyNodeId,
      }),
    );
  const contract = selectivelyInvalidateContract(state.contract, invalidated);
  const invalidatesContract = contract !== state.contract;
  const invalidatesProjection = [...invalidated].some((id) =>
    ["criterion", "task", "risk", "validation", "guide", "projection"].includes(
      state.dependencyGraph.nodes.find((node) => node.id === id)?.kind ?? "",
    ),
  );
  const { contract: _priorContract, projection: _priorProjection, ...base } = state;
  const next: ShapeState = {
    ...base,
    discoveryTargets: mergeById(
      state.discoveryTargets.map((target) => {
        const evidenceIds = target.evidenceIds.filter((id) => !staleEvidence.has(id));
        return evidenceIds.length === target.evidenceIds.length
          ? target
          : { ...target, evidenceIds, status: "stale" as const };
      }),
      refreshTargets,
    ),
    evidence: state.evidence.filter((item) => !invalidated.has(item.dependencyNodeId)),
    invalidations: [
      ...state.invalidations,
      {
        rootIds: result.staleFingerprintIds
          .map((id) => state.sourceFingerprints.find((item) => item.id === id)?.dependencyNodeId)
          .filter((id): id is string => id !== undefined),
        invalidatedNodeIds: result.invalidatedNodeIds,
        reason: "resume:source_freshness",
      },
    ],
    ...(contract ? { contract } : {}),
    ...(!(invalidatesProjection || invalidatesContract) && state.projection
      ? { projection: state.projection }
      : {}),
    evaluatorReceipts: state.evaluatorReceipts.filter(
      (receipt) =>
        receipt.evaluator !== "discovery" &&
        (!invalidatesContract || receipt.evaluator !== "planning"),
    ),
  };
  return {
    state: copyWithoutUndefined(next),
    reusedEvidenceIds: result.reusedEvidenceIds,
    staleEvidenceIds: result.staleEvidenceIds,
    refreshTargetIds: refreshTargets.map((item) => item.id).toSorted(),
    invalidatedNodeIds: result.invalidatedNodeIds,
    reasoningRequired: true,
  };
}

export function validateShapeState(value: unknown): asserts value is ShapeState {
  const state = value as ShapeState;
  assertShapeStateEnvelope(state);
  validateBudgetLimits(state.budget.limits);
  for (const [key, amount] of Object.entries(state.budget.usage)) nonNegativeInteger(amount, key);
  validateDependencyGraph(state.dependencyGraph);
  for (const target of state.discoveryTargets) validateDiscoveryTarget(target);
  validateShapeEvidence(state);
  const technicalDecisionIds = new Set<string>();
  const decisionKeys = new Set<string>();
  for (const technicalDecision of state.technicalDecisions) {
    validateTechnicalDecisionRecord(state, technicalDecision);
    if (
      technicalDecisionIds.has(technicalDecision.id) ||
      decisionKeys.has(technicalDecision.decisionKey)
    ) {
      throw new Error("Technical Decision identity is duplicated.");
    }
    technicalDecisionIds.add(technicalDecision.id);
    decisionKeys.add(technicalDecision.decisionKey);
  }
  if (
    state.activeTechnicalDecisionId &&
    !state.technicalDecisions.some(
      (item) => item.id === state.activeTechnicalDecisionId && item.status === "active",
    )
  )
    throw new Error("Active Technical Decision reference is invalid.");
  if (state.preparationProfileChoice) {
    validateCheckpoint(state.preparationProfileChoice.checkpoint);
    if (
      state.preparationProfileChoice.status === "selected" &&
      (!state.preparationProfileChoice.selectedProfile ||
        !TOKEN.test(state.preparationProfileChoice.selectionEvidenceRef ?? ""))
    ) {
      throw new Error("Selected preparation profile lacks explicit evidence.");
    }
  }
  if (state.contract) evaluateContractCompleteness(state);
  for (const receipt of state.evaluatorReceipts) {
    const { receiptDigest, ...base } = receipt;
    if (receiptDigest !== digest(base))
      throw new Error(`${receipt.evaluator} evaluator receipt digest is invalid.`);
  }
}

function validateTechnicalDecisionRecord(
  state: ShapeState,
  technicalDecision: TechnicalDecision,
): void {
  if (
    technicalDecision.schemaVersion !== 1 ||
    !ID.test(technicalDecision.id) ||
    !ID.test(technicalDecision.decisionKey) ||
    !ID.test(technicalDecision.targetId) ||
    !TOKEN.test(technicalDecision.materialityReason) ||
    !TOKEN.test(technicalDecision.recommendationBasis) ||
    !["low", "medium", "high"].includes(technicalDecision.confidence) ||
    typeof technicalDecision.adrQualified !== "boolean" ||
    (technicalDecision.proposedDestination !== undefined &&
      (!TOKEN.test(technicalDecision.proposedDestination) ||
        technicalDecision.proposedDestination.startsWith("/") ||
        technicalDecision.proposedDestination.includes(".."))) ||
    !["discovering", "planning"].includes(technicalDecision.priorRole) ||
    !["active", "resolved"].includes(technicalDecision.status) ||
    !state.discoveryTargets.some((target) => target.id === technicalDecision.targetId)
  )
    throw new Error("Technical Decision record is malformed.");
  if (
    technicalDecision.options.length < 2 ||
    technicalDecision.options.length > 3 ||
    new Set(technicalDecision.options.map((option) => option.id)).size !==
      technicalDecision.options.length
  ) {
    throw new Error(`Technical Decision ${technicalDecision.id} options are invalid.`);
  }
  for (const option of technicalDecision.options) {
    if (
      !ID.test(option.id) ||
      !TOKEN.test(option.label) ||
      !TOKEN.test(option.impact) ||
      (option.excludedReason !== undefined && !TOKEN.test(option.excludedReason))
    ) {
      throw new Error(`Technical Decision ${technicalDecision.id} option is malformed.`);
    }
  }
  if (
    !technicalDecision.options.some(
      (option) => option.id === technicalDecision.recommendedOptionId,
    ) ||
    !technicalDecision.evidenceIds.length ||
    (technicalDecision.status === "active" &&
      technicalDecision.evidenceIds.some((id) => !state.evidence.some((item) => item.id === id)))
  ) {
    throw new Error(
      `Technical Decision ${technicalDecision.id} recommendation or evidence is invalid.`,
    );
  }
  dependencyClosure(state.dependencyGraph, technicalDecision.affectedDependencyRootIds);
  if (technicalDecision.status === "resolved") {
    if (
      !technicalDecision.selectedOptionId ||
      !technicalDecision.options.some(
        (option) => option.id === technicalDecision.selectedOptionId,
      ) ||
      !TOKEN.test(technicalDecision.answerEvidenceRef ?? "")
    ) {
      throw new Error(
        `Resolved Technical Decision ${technicalDecision.id} lacks explicit answer evidence.`,
      );
    }
  } else if (
    technicalDecision.selectedOptionId !== undefined ||
    technicalDecision.answerEvidenceRef !== undefined
  ) {
    throw new Error(`Active Technical Decision ${technicalDecision.id} cannot contain answer.`);
  }
}

function selectivelyInvalidateContract(
  contract: CanonicalChangeContract | undefined,
  invalidated: ReadonlySet<string>,
): CanonicalChangeContract | undefined {
  if (!contract) return undefined;
  const acceptanceCriteria = contract.acceptanceCriteria.filter(
    (item) => !invalidated.has(item.dependencyNodeId),
  );
  const tasks = contract.tasks.filter((item) => !invalidated.has(item.dependencyNodeId));
  const validations = contract.validations.filter(
    (item) => !invalidated.has(item.dependencyNodeId),
  );
  const risks = contract.risks.filter((item) => !invalidated.has(item.dependencyNodeId));
  const guide =
    contract.guide && !invalidated.has(contract.guide.dependencyNodeId)
      ? contract.guide
      : undefined;
  if (
    acceptanceCriteria.length === contract.acceptanceCriteria.length &&
    tasks.length === contract.tasks.length &&
    validations.length === contract.validations.length &&
    risks.length === contract.risks.length &&
    guide === contract.guide
  )
    return contract;
  const { guide: _priorGuide, ...base } = contract;
  return {
    ...base,
    acceptanceCriteria,
    tasks,
    validations,
    risks,
    ...(guide ? { guide } : {}),
  };
}

function validateDiscoveryTarget(target: DiscoveryTarget): void {
  if (
    !target ||
    !ID.test(target.id) ||
    !TOKEN.test(target.question) ||
    !TOKEN.test(target.createdBecause) ||
    !Number.isFinite(Date.parse(target.createdAt)) ||
    !ID.test(target.dependencyNodeId) ||
    !["open", "resolved", "escalated", "blocked", "stale"].includes(target.status)
  ) {
    throw new Error("Discovery Target is malformed.");
  }
  if (
    !Array.isArray(target.materialImpacts) ||
    !target.materialImpacts.length ||
    target.materialImpacts.some((impact) => !IMPACTS.has(impact)) ||
    new Set(target.materialImpacts).size !== target.materialImpacts.length
  ) {
    throw new Error(`Discovery Target ${target.id} material impacts are invalid.`);
  }
  if (
    !Array.isArray(target.candidateSourceRefs) ||
    !target.candidateSourceRefs.length ||
    target.candidateSourceRefs.some((ref) => !TOKEN.test(ref))
  ) {
    throw new Error(`Discovery Target ${target.id} requires candidate sources.`);
  }
  if (!Array.isArray(target.evidenceIds) || target.evidenceIds.some((id) => !ID.test(id))) {
    throw new Error(`Discovery Target ${target.id} evidence IDs are invalid.`);
  }
}

function validateShapeEvidence(state: ShapeState): void {
  const observedValues = Object.fromEntries(
    state.sourceFingerprints.map((fingerprint) => [
      fingerprint.id,
      fingerprint.kind === "command"
        ? { value: fingerprint.value, inputDigest: fingerprint.inputDigest! }
        : fingerprint.value,
    ]),
  );
  reconcileShapeFreshness({
    graph: state.dependencyGraph,
    fingerprints: state.sourceFingerprints,
    evidence: state.evidence,
    observedValues,
    now: new Date().toISOString(),
  });
}

function validateDiscoveryReceipt(state: ShapeState, receipt: DiscoveryReceipt): void {
  const expected = attestDiscoverySufficient(state);
  if (
    receipt.schemaVersion !== 1 ||
    receipt.evaluator !== "discovery" ||
    receipt.receiptDigest !== expected.receiptDigest ||
    receipt.inputDigest !== expected.inputDigest
  ) {
    throw new Error("Discovery receipt is stale or bound to another SHAPE state.");
  }
}

function validateCheckpoint(checkpoint: PreparationCheckpoint): void {
  if (
    !checkpoint ||
    !TOKEN.test(checkpoint.changeShape) ||
    !Array.isArray(checkpoint.surfaceCategories) ||
    !checkpoint.surfaceCategories.length ||
    checkpoint.surfaceCategories.length > 16 ||
    checkpoint.surfaceCategories.some((item) => !TOKEN.test(item)) ||
    !Array.isArray(checkpoint.materialFacts) ||
    !checkpoint.materialFacts.length ||
    checkpoint.materialFacts.length > 8 ||
    checkpoint.materialFacts.some((item) => !TOKEN.test(item))
  ) {
    throw new Error("Preparation checkpoint is invalid or not compact.");
  }
}

function assertShapeStateEnvelope(state: ShapeState): void {
  if (
    !state ||
    state.schemaVersion !== 1 ||
    !RISKS.has(state.risk) ||
    !TOKEN.test(state.productBaselineRef) ||
    !Array.isArray(state.discoveryTargets) ||
    !Array.isArray(state.evidence) ||
    !Array.isArray(state.sourceFingerprints) ||
    !Array.isArray(state.technicalDecisions) ||
    !state.budget ||
    !state.semanticRetryCounts ||
    !Array.isArray(state.evaluatorReceipts)
  ) {
    throw new Error("SHAPE state is malformed.");
  }
}

function validateBudgetLimits(limits: ShapeBudgetLimits): void {
  for (const [key, value] of Object.entries(limits)) {
    if (
      !["maxReasoningCalls", "maxInputTokens", "maxOutputTokens", "maxContextBytes"].includes(
        key,
      ) ||
      !Number.isInteger(value) ||
      (value as number) <= 0
    ) {
      throw new Error(`SHAPE budget limit ${key} is invalid.`);
    }
  }
}

function budgetReason(
  limits: ShapeBudgetLimits,
  usage: ShapeUsage,
): ShapeBudgetCheckpoint["reason"] | undefined {
  if (limits.maxReasoningCalls !== undefined && usage.reasoningCalls >= limits.maxReasoningCalls)
    return "reasoning_calls";
  if (limits.maxInputTokens !== undefined && usage.inputTokens >= limits.maxInputTokens)
    return "input_tokens";
  if (limits.maxOutputTokens !== undefined && usage.outputTokens >= limits.maxOutputTokens)
    return "output_tokens";
  if (limits.maxContextBytes !== undefined && usage.contextBytes >= limits.maxContextBytes)
    return "context_bytes";
  return undefined;
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`SHAPE usage ${label} is invalid.`);
  return value;
}

function withoutDiscoveryReceipts(state: ShapeState): ShapeState {
  if (state.preparationProfileChoice?.status === "pending") {
    const { preparationProfileChoice: _choice, ...base } = state;
    return {
      ...base,
      evaluatorReceipts: state.evaluatorReceipts.filter(
        (receipt) => receipt.evaluator !== "discovery",
      ),
    };
  }
  return {
    ...state,
    evaluatorReceipts: state.evaluatorReceipts.filter(
      (receipt) => receipt.evaluator !== "discovery",
    ),
  };
}

function withoutPlanningReceipts(state: ShapeState): ShapeState {
  return {
    ...state,
    evaluatorReceipts: state.evaluatorReceipts.filter(
      (receipt) => receipt.evaluator !== "planning",
    ),
  };
}

function validateContractItem(
  item: { id: string; description: string; dependencyNodeId: string },
  kind: "criterion" | "task" | "validation" | "risk",
  graphNodes: ReadonlyMap<string, DependencyNode>,
  reasons: string[],
): void {
  if (!ID.test(item.id) || !TOKEN.test(item.description))
    reasons.push(`${kind}:${item.id}:content`);
  if (graphNodes.get(item.dependencyNodeId)?.kind !== kind)
    reasons.push(`${kind}:${item.id}:dependency_node`);
}

function uniqueIds(
  items: readonly { id: string }[],
  label: string,
  reasons: string[],
): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) reasons.push(`${label}:${item.id}:duplicate`);
    ids.add(item.id);
  }
  return ids;
}

function contractProjectionForDigest(contract: CanonicalChangeContract): unknown {
  const { digest: _digest, ...projection } = contract;
  return projection;
}

function deriveAssuranceContract(contract: CanonicalChangeContract) {
  const subjects = [
    ...contract.acceptanceCriteria.map((item) => ({
      id: item.id,
      kind: "criterion" as const,
    })),
    ...contract.risks.map((item) => ({ id: item.id, kind: "risk" as const })),
    ...contract.validations.map((item) => ({
      id: `mandatory:${item.id}`,
      kind: "mandatory_check" as const,
    })),
  ];
  const commandByIdentity = new Map<string, ReturnType<typeof commandOperation>>();
  for (const item of contract.validations.filter((candidate) => candidate.command)) {
    const [executable, ...argv] = splitCommand(item.command as string);
    const identityKey = JSON.stringify([executable, argv, ".", {}, ["toolchain:current"]]);
    const existing = commandByIdentity.get(identityKey);
    const covers = [
      ...new Set([...(existing?.covers ?? []), ...item.criterionIds, `mandatory:${item.id}`]),
    ].toSorted();
    commandByIdentity.set(identityKey, commandOperation(executable, argv, covers));
  }
  const commandOperations = [...commandByIdentity.values()].toSorted((left, right) =>
    left.id.localeCompare(right.id),
  );
  const commandCovered = new Set(commandOperations.flatMap((item) => item.covers));
  const reviewSubjects = subjects.map((item) => item.id).filter((id) => !commandCovered.has(id));
  const reviewIsRiskOnly = reviewSubjects.every((id) =>
    subjects.some((subject) => subject.id === id && subject.kind === "risk"),
  );
  const reviewOperations = reviewSubjects.length
    ? [
        {
          id: "review:consolidated",
          kind: "model-inspection" as const,
          dependsOn: commandOperations.map((item) => item.id),
          covers: [...new Set(reviewSubjects)].toSorted(),
          cost: "high" as const,
          scopeRefs: ["scope:approved"],
          fingerprintMode: "global" as const,
          readOnly: true,
          concurrencySafe: false,
          conditional: reviewIsRiskOnly,
          ...(reviewIsRiskOnly ? { activationPredicateRef: "policy:applicable-review" } : {}),
        },
      ]
    : [];
  const operations = [...commandOperations, ...reviewOperations];
  return compileAssuranceContract({
    schemaVersion: 1,
    sourceDigest: `sha256:${contract.discoveryReceiptDigest.replace(/^sha256:/, "")}`,
    subjects,
    operations,
    evidencePreference: operations.map((item) => item.id),
    reviewBudget: {
      maxInputTokens: 8_000,
      maxOutputTokens: 1_500,
      maxCalls: reviewOperations.length ? 2 : 0,
      maxConcurrency: 4,
    },
    policyDigest: "policy:gate-snapshot",
  });
}

function commandOperation(executable: string, argv: string[], covers: string[]) {
  const identity = {
    executable,
    argv,
    logicalCwd: ".",
    environment: {},
    toolFingerprintRefs: ["toolchain:current"],
  };
  return {
    id: `check:${digest(identity).slice(0, 16)}`,
    kind: "command" as const,
    dependsOn: [] as string[],
    covers,
    cost: "low" as const,
    scopeRefs: [] as string[],
    fingerprintMode: "global" as const,
    readOnly: true,
    concurrencySafe: false,
    conditional: false,
    checkIdentity: identity,
    successPredicate: { exitCodes: [0] },
  };
}

function splitCommand(command: string): [string, ...string[]] {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || /[|;&<>`]/.test(command))
    throw new Error(
      "Assurance command must use canonical executable and argv without shell control operators.",
    );
  return parts as [string, ...string[]];
}

function mergeById<T extends { id: string }>(left: readonly T[], right: readonly T[]): T[] {
  const output = new Map(left.map((item) => [item.id, copy(item)]));
  for (const item of right) output.set(item.id, copy(item));
  return [...output.values()].toSorted((a, b) => a.id.localeCompare(b.id));
}

function digest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nested]) => nested !== undefined)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function copyWithoutUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
