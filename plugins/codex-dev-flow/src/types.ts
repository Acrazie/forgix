import type { PreparationProfile, ShapeState } from "./shape.js";

export const ALLOWED_MODEL_IDS = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"] as const;
export type ModelId = (typeof ALLOWED_MODEL_IDS)[number];

export const REASONING_EFFORTS = ["low", "medium", "high", "xhigh"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export type SubscriptionPlan = "auto" | "plus" | "pro_5x" | "pro_20x";
export type ResolvedSubscriptionPlan = Exclude<SubscriptionPlan, "auto"> | "unknown";
export type QuotaPressure = "normal" | "warning" | "critical" | "unknown";
export type RoutingStage = "discover" | "plan" | "execute" | "debug" | "review" | "verify";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type { TaskStatus } from "./state-machine.js";
import type { TaskStatus } from "./state-machine.js";
import type { GuardId } from "./state-machine.js";

export interface ModelCapability {
  id: ModelId;
  supportedReasoningEfforts: ReasoningEffort[];
}

export interface QuotaWindowSnapshot {
  windowDurationMins: number;
  usedPercent: number;
  resetsAt?: number;
}

export interface QuotaSnapshot {
  windowDurationMins?: number;
  usedPercent?: number;
  resetsAt?: number;
  pressure: QuotaPressure;
  source: "app-server" | "last-known" | "unknown";
  observedWindow?: QuotaWindowSnapshot;
}

export interface SanitizedAccount {
  planType?: string;
}

export interface RoutingSnapshot {
  schemaVersion: 1;
  capturedAt: string;
  plan: ResolvedSubscriptionPlan;
  account: SanitizedAccount;
  quota: QuotaSnapshot;
  models: ModelCapability[];
  warnings: string[];
  provenance: {
    plan: "config" | "account/read" | "unknown";
    quota: "account/rateLimits/read" | "last-known-cache" | "unknown";
    models: "model/list" | "unknown";
  };
  subscriptionMultiplier?: number;
}

export interface RoutingDecision {
  stage: RoutingStage;
  model: ModelId | null;
  effort: ReasoningEffort | null;
  quotaPressure: QuotaPressure;
  reason: string;
  warnings: string[];
}

export interface EffectiveConfig {
  schemaVersion: number;
  subscription?: SubscriptionConfig;
}

export interface SubscriptionConfig {
  plan: SubscriptionPlan;
  planOverride?: Exclude<SubscriptionPlan, "auto">;
  multiplierOverride?: number;
  quota: {
    warningPercent: number;
    criticalPercent: number;
    unknownPolicy: "conservative";
  };
  modelAllowlist: ModelId[];
  modelCosts: Record<ModelId, ModelCostProfile>;
}

export interface ModelCostProfile {
  multiplier: number;
  rateVersion: string;
  inputCreditsPerMillion: number;
  cachedInputCreditsPerMillion: number;
  outputCreditsPerMillion: number;
}

export interface Policy {
  schemaVersion: number;
  requirements: Record<string, unknown>;
  prohibitions: Record<string, unknown>;
  bounds: Record<string, unknown>;
  locks: string[];
}

export interface TaskState {
  schemaVersion: 3;
  taskId: string;
  status: TaskStatus;
  revision: number;
  risk: RiskLevel;
  shape?: ShapeState;
  contractDigest?: string;
  verificationRequirements?: VerificationRequirements;
  pendingGate?: ApprovalGate;
  resumeTo?: TaskStatus;
  configSnapshot: Record<string, unknown>;
  policySnapshot: Policy;
  issues: unknown[];
  reviewCycle: number;
  remainingActions: string[];
  history: DurableHistoryEvent[];
  historySummary?: HistorySummary;
  activeArtifact?: ActiveArtifactReference;
  activeWorktree?: ActiveWorktreeReference;
  contextCapsule?: ContextCapsule;
  routingSnapshot?: RoutingSnapshot;
  routingPolicyVersion?: string;
  routingDecisions?: RoutingDecision[];
  intake?: IntakeState;
  benchmarkEnabled?: boolean;
}

export type IntakeDecisionSource = "user" | "repository";
export type RecommendationDisposition = "accepted" | "modified" | "not_applicable";
export type DecisionQuestionConfidence = "high" | "medium" | "low";
export type TechnicalUnknownKind =
  | "code"
  | "dependency"
  | "architecture"
  | "validation"
  | "operations";

export interface IntakeSuccessSignal {
  description: string;
  observationMethod: string;
  validator?: string;
  guardrails?: string[];
}

export interface IntakeProvenance {
  sourceRefs: string[];
  capturedAt: string;
  freshnessRefs: string[];
}

export interface IntakeBrief {
  schemaVersion: 1;
  objective?: string;
  successSignal?: IntakeSuccessSignal;
  risk: RiskLevel;
  provenance: IntakeProvenance;
  successValidator?: string;
  successGuardrails?: string[];
  determiningConstraints?: string[];
  affectedUsers?: string[];
  motivation?: string;
  urgency?: string;
  scopeBoundaries?: string[];
  technicalUnknowns: TechnicalUnknown[];
}

export interface TechnicalUnknown {
  key: string;
  kind: TechnicalUnknownKind;
  description: string;
  owner: "shape";
}

export interface DecisionQuestionOption {
  id: string;
  label: string;
  impact: string;
}

export interface DecisionQuestion {
  schemaVersion: 1;
  id: string;
  decisionKey: string;
  missingInformation: string;
  determiningImpact: string;
  prompt: string;
  options:
    | [DecisionQuestionOption, DecisionQuestionOption]
    | [DecisionQuestionOption, DecisionQuestionOption, DecisionQuestionOption];
  recommendedOptionId: string;
  recommendationBasis: string;
  recommendationConfidence: DecisionQuestionConfidence;
  freeFormAllowed: true;
  clarificationCount: number;
}

export interface NormalizedIntakeDecision {
  key: string;
  value: string;
  source: IntakeDecisionSource;
  provenanceRef: string;
  recommendationDisposition: RecommendationDisposition;
  dependsOn: string[];
}

export interface IntakeInvalidation {
  decisionKey: string;
  reason: string;
  at: string;
}

export interface IntakeMetrics {
  modelCalls: number;
  questionsAsked: number;
  questionsAvoided: number;
  distinctQuestions: number;
  recommendationsAccepted: number;
  recommendationsModified: number;
  zeroQuestionPath: boolean;
  lateReopenings: number;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}

export interface IntakeState {
  schemaVersion: 1;
  brief: IntakeBrief;
  activeQuestion?: DecisionQuestion;
  decisions: NormalizedIntakeDecision[];
  answeredDecisionKeys: string[];
  invalidations: IntakeInvalidation[];
  contradictions: string[];
  semanticComplete: boolean;
  deterministicComplete: boolean;
  checkpointDue: boolean;
  semanticRetryCount: number;
  blockedReason?: "semantic_output_invalid" | "answer_required";
  metrics: IntakeMetrics;
}

export interface BenchmarkSurveyAnswers {
  satisfaction: 1 | 2 | 3 | 4 | 5;
  conformance: "yes" | "partial" | "no";
  pluginValue: "useful" | "neutral" | "counterproductive";
  comment?: string;
}

export interface BenchmarkDeviationFact {
  code: "unplanned_new_file" | "forbidden_new_file" | "missing_validation" | "missing_handoff";
  surfaceRef: string;
}

export interface BenchmarkRecord {
  schemaVersion: 1;
  taskId: string;
  recordedAt: string;
  preparationProfile: PreparationProfile | "unselected";
  outcome: "finished_local" | "finished" | "failed";
  authority: "canonical_change_contract";
  survey: BenchmarkSurveyAnswers;
  deviations: BenchmarkDeviationFact[];
}

export interface HistorySummary {
  removedCount: number;
  firstSequence: number;
  lastSequence: number;
  firstAt: string;
  lastAt: string;
  typeCounts: Record<string, number>;
  lastTransition?: {
    sequence: number;
    revision: number;
    to: TaskStatus;
  };
  activeGate?: HistoryGateAnchor;
}

export type HistoryReferenceKind =
  | "task"
  | "shape"
  | "artifact"
  | "worktree"
  | "context-capsule"
  | "context"
  | "issue"
  | "correction"
  | "gate"
  | "scope"
  | "handoff"
  | "evidence"
  | "receipt"
  | "command"
  | "criterion"
  | "decision"
  | "policy"
  | "config"
  | "git"
  | "symbol";

export interface HistoryReference {
  kind: HistoryReferenceKind;
  ref: string;
  fingerprint?: string;
}

export interface HistoryGateAnchor {
  gateContext: ApprovalGate;
  contractDigest: string;
  entrySequence: number;
  entryRevision: number;
  entryFrom: "planning" | "verifying";
  sourceFingerprint: string;
  verificationReceipt?: EvaluatorReceiptRecord;
}

export type WorkflowHistoryEventType =
  | "task.created"
  | "task.blocked"
  | "task.resumed"
  | "gate.recorded"
  | "scope.approved"
  | "artifact.recorded"
  | "issue.recorded"
  | "correction.recorded"
  | "handoff.attempted"
  | "handoff.result"
  | "context.updated"
  | "intake.question_recorded"
  | "intake.answer_recorded"
  | "intake.checkpoint"
  | "advance.rejected"
  | "intake.reopened"
  | "discovery.target_recorded"
  | "discovery.evidence_recorded"
  | "discovery.completed"
  | "profile.choice_requested"
  | "profile.choice_recorded"
  | "decision.escalated"
  | "contract.projected"
  | "projection.reconciliation_requested"
  | "evidence.invalidated"
  | "shape.checkpoint";

export interface WorkflowHistoryEvent {
  sequence: number;
  at: string;
  type: WorkflowHistoryEventType;
  refs: HistoryReference[];
}

export interface ActiveArtifactReference {
  artifactId: string;
  ownerRef: string;
  fingerprint: string;
}

export interface ActiveWorktreeReference {
  worktreeRef: string;
  gitFingerprint: string;
}

export type ContextCapsuleSection =
  | "objective"
  | "approved_scope"
  | "risk"
  | "relevant_code"
  | "constraints"
  | "acceptance"
  | "decision"
  | "evidence";

export interface ContextCapsuleEntry {
  section: ContextCapsuleSection;
  ownerRef: string;
  provenanceRef: string;
  fingerprintRefs: string[];
}

export interface ContextCapsuleFingerprint {
  id: string;
  kind: "git" | "config" | "policy" | "artifact" | "worktree";
  value: string;
  provenanceRef: string;
}

export interface ContextCapsule {
  schemaVersion: 1;
  entries: ContextCapsuleEntry[];
  fingerprints: ContextCapsuleFingerprint[];
}

export interface VerificationRequirements {
  schemaVersion: 1;
  sourceDigest: string;
  requirementsDigest: string;
  criterionIds: readonly string[];
  mandatoryCheckIds: readonly string[];
}

export interface StateHistoryEvent {
  sequence: number;
  at: string;
  type: "state.transition";
  from: TaskStatus;
  to: TaskStatus;
  revision: number;
  sourceFingerprint: string;
  terminalSource?: TaskStatus;
  terminalResumeTo?: TaskStatus;
  gateContext?: ApprovalGate;
  contractDigest?: string;
  guardEvidence?: GuardEvidenceRecord[];
  gateDecision?: GateDecisionRecord;
}

export type DurableHistoryEvent = StateHistoryEvent | WorkflowHistoryEvent;

export type ApprovalGate = "pre_build" | "completion";

export interface GuardEvidenceRecord {
  schemaVersion: 1;
  guard: GuardId;
  stateRevision: number;
  stateFingerprint: string;
  observedFingerprint: string;
  evidenceRefs: readonly string[];
  provenance: "deterministic-check" | "human-approval" | "repository-observation";
  result: "passed" | "not_applicable";
  evaluatorReceipt?: EvaluatorReceiptRecord;
}

export type TrustedEvaluator =
  | "intake"
  | "discovery"
  | "planning"
  | "verification"
  | "handoff_intent"
  | "handoff_reconciliation"
  | "completion";

export interface EvaluatorReceiptRecord {
  schemaVersion: 1;
  evaluator: TrustedEvaluator;
  outcome:
    | "intake_complete"
    | "discovery_sufficient"
    | "contract_complete"
    | "complete"
    | "local_only"
    | "external_selected"
    | "action_required"
    | "approved";
  stateRevision: number;
  stateFingerprint: string;
  inputDigest: string;
  evidenceRefs: readonly string[];
  subjectIds: readonly string[];
  completedIds: readonly string[];
  receiptDigest: string;
}

export interface GateDecisionRecord {
  schemaVersion: 1;
  gate: ApprovalGate;
  decision: "approved" | "rejected" | "change_requested";
  stateRevision: number;
  stateFingerprint: string;
  evidenceRef: string;
  contractDigest: string;
}

export interface IssueIdentity {
  issueId: string;
  occurrenceId: string;
  rootCauseId?: string;
}

export interface CliResult {
  command: string;
  status: string;
  data: unknown;
}
