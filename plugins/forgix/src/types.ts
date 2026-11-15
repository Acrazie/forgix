export const ALLOWED_MODEL_IDS = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"] as const;
export type ModelId = (typeof ALLOWED_MODEL_IDS)[number];

export const HARNESS_IDS = ["codex", "claude", "antigravity"] as const;
export type HarnessId = (typeof HARNESS_IDS)[number];
export type HarnessPreference = "auto" | HarnessId;
export type RoutingMode = "codex-app-server" | "host-native";

export const REASONING_EFFORTS = ["low", "medium", "high", "xhigh"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export type SubscriptionPlan = "auto" | "plus" | "pro_5x" | "pro_20x";
export type ResolvedSubscriptionPlan = Exclude<SubscriptionPlan, "auto"> | "unknown";
export type QuotaPressure = "normal" | "warning" | "critical" | "unknown";
export type RoutingStage = "design" | "discover" | "plan" | "debug" | "review";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type TaskStatus =
  | "new"
  | "intaking"
  | "discovering"
  | "awaiting_shape_decision"
  | "awaiting_profile_choice"
  | "planning"
  | "awaiting_intake_decision"
  | "awaiting_approval"
  | "executing"
  | "assuring"
  | "blocked"
  | "cancelled"
  | "failed";

export type ResumeTargetStatus =
  | "intaking"
  | "discovering"
  | "awaiting_shape_decision"
  | "awaiting_profile_choice"
  | "planning"
  | "awaiting_intake_decision"
  | "awaiting_approval"
  | "executing"
  | "assuring";

export type MacroPhase = "INTAKE" | "SHAPE" | "GATE" | "BUILD" | "ASSURE";

export type GuardId =
  | "task_initialized"
  | "effective_constraints_valid"
  | "intake_complete"
  | "intake_reopened"
  | "routing_ready"
  | "workspace_ready"
  | "discovery_sufficient"
  | "profile_selected"
  | "contract_complete"
  | "approval_current"
  | "resume_metadata_valid"
  | "resume_reconciled"
  | "terminal_source_recorded"
  | "gate_decision_valid";

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
  mode?: RoutingMode;
  harness?: HarnessId;
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

export type DependencyNodeKind =
  | "decision"
  | "product"
  | "terminology"
  | "domain_rule"
  | "domain_scenario"
  | "technical_decision"
  | "source"
  | "evidence"
  | "criterion"
  | "task"
  | "risk"
  | "validation"
  | "guide"
  | "projection"
  | "assurance_subject"
  | "assurance_operation";

export interface DependencyNode {
  id: string;
  kind: DependencyNodeKind;
  dependsOn: string[];
}

export interface DependencyGraph {
  schemaVersion: 1;
  nodes: DependencyNode[];
}

export type DecisionGraph = DependencyGraph;

export type DesignOwner = "intake" | "shape";
export type DesignQuestionKind = "product" | "terminology" | "domain_rule" | "technical";
export type DesignRecordStatus = "proposed" | "resolved" | "approved" | "projected" | "invalidated";
export type DomainDisposition =
  | "project"
  | "already_documented"
  | "task_local"
  | "policy_forbidden";

export interface DesignProvenance {
  sourceRefs: string[];
  freshnessRefs: string[];
}

export interface ProductBaselineDimension {
  key: "objective" | "users_value" | "scope" | "success" | "risks_constraints";
  status: "resolved" | "not_applicable" | "missing" | "unknown";
  value?: string;
  notApplicableReason?: string;
  provenance: DesignProvenance;
  dependencyNodeId: string;
}

export interface ProductBaseline {
  schemaVersion: 1;
  dimensions: ProductBaselineDimension[];
}

export interface DesignQuestionOption {
  id: string;
  label: string;
  consequences: string[];
}

export interface ActiveDesignQuestion {
  schemaVersion: 1;
  id: string;
  decisionKey: string;
  kind: DesignQuestionKind;
  owner: DesignOwner;
  subjectIds: string[];
  prerequisiteIds: string[];
  prompt: string;
  mode: "choice" | "elicitation";
  options?:
    | [DesignQuestionOption, DesignQuestionOption]
    | [DesignQuestionOption, DesignQuestionOption, DesignQuestionOption];
  recommendedOptionId?: string;
  recommendationBasis?: string;
  confidence?: "low" | "medium" | "high";
  priorRole: "intaking" | "discovering" | "planning";
  selectionReason: string;
  directConsequences: string[];
  freeFormAllowed: true;
  clarificationCount: number;
}

export interface DomainGlossaryDelta {
  id: string;
  context: string;
  term: string;
  definition: string;
  aliases: string[];
  rejectedTerms: Array<{ term: string; reason: string }>;
  relatedTermIds: string[];
  provenance: DesignProvenance;
  dependencyNodeId: string;
  status: DesignRecordStatus;
  disposition?: DomainDisposition;
}

export interface DomainScenario {
  id: string;
  angle: "nominal" | "boundary" | "exception" | "contradiction";
  startingSituation: string;
  action: string;
  expectedResult: string;
}

export interface DomainRule {
  id: string;
  context: string;
  termIds: string[];
  actors: string[];
  conditions: string[];
  outcome: string;
  exceptions: string[];
  scenarios: DomainScenario[];
  provenance: DesignProvenance;
  dependencyNodeId: string;
  status: DesignRecordStatus;
  disposition?: DomainDisposition;
}

export interface DecisionAlternative {
  id: string;
  label: string;
  consequences: string[];
  excludedReason?: string;
}

export interface DecisionCandidate {
  id: string;
  owner: DesignOwner;
  context: string;
  materialityReason: string;
  alternatives: DecisionAlternative[];
  evidenceRefs: string[];
  recommendedOptionId?: string;
  confidence: "low" | "medium" | "high";
  selectedOptionId?: string;
  dependencyNodeId: string;
  priorRole: "intaking" | "discovering" | "planning";
  status: DesignRecordStatus;
  disposition?: DomainDisposition;
}

export interface DesignInvalidation {
  rootIds: string[];
  invalidatedNodeIds: string[];
  reason: string;
  at: string;
}

export interface DesignFrontierCandidate {
  question: ActiveDesignQuestion;
  scores: {
    impact: number;
    irreversibility: number;
    risk: number;
    uncertainty: number;
    branchesUnlocked: number;
  };
  scoreReason: string;
}

export interface ProductBaselineResolution {
  key: ProductBaselineDimension["key"];
  status: "resolved" | "not_applicable";
  value?: string;
  notApplicableReason?: string;
  provenance: DesignProvenance;
}

export interface DesignState {
  schemaVersion: 1;
  graph: DecisionGraph;
  productBaseline: ProductBaseline;
  glossaryDeltas: DomainGlossaryDelta[];
  domainRules: DomainRule[];
  decisions?: DecisionCandidate[];
  activeQuestion?: ActiveDesignQuestion;
  invalidations?: DesignInvalidation[];
  semanticComplete?: boolean;
  digest?: string;
}

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

export type ShapeSourceFingerprintKind = "git_blob" | "content" | "command" | "external";

export interface ShapeSourceFingerprint {
  id: string;
  kind: ShapeSourceFingerprintKind;
  value: string;
  provenanceRef: string;
  dependencyNodeId: string;
  inputDigest?: string;
  observedAt?: string;
  expiresAt?: string;
}

export interface ShapeEvidenceItem {
  id: string;
  fact: string;
  provenanceRefs: string[];
  sourceFingerprintIds: string[];
  dependencyNodeId: string;
}

export interface EvidenceRecord extends ShapeEvidenceItem {
  expectedValue?: string;
  observedValue?: string;
}

export type ObservedFingerprintValue = string | { value: string; inputDigest?: string };

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
  discoveryReceiptDigest?: string;
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
  discoveryReceiptDigest?: string;
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
  evidence: EvidenceRecord[];
  sourceFingerprints?: ShapeSourceFingerprint[];
  technicalDecisions?: TechnicalDecision[];
  activeTechnicalDecisionId?: string;
  preparationProfileChoice?: PreparationProfileChoice;
  contract?: CanonicalChangeContract;
  projection?: PlanProjectionRecord;
  dependencyGraph: DependencyGraph;
  invalidations?: ShapeInvalidation[];
  budget?: ShapeBudget;
  semanticRetryCounts?: { discovery: number; planning: number };
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
  contractDigest: string;
  entrySequence: number;
  entryRevision: number;
  entryFrom: "planning";
  sourceFingerprint: string;
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
  | "context.updated"
  | "advance.rejected"
  | "discovery.target_recorded"
  | "discovery.evidence_recorded"
  | "discovery.completed"
  | "profile.choice_requested"
  | "profile.choice_recorded"
  | "design.question_recorded"
  | "design.answer_recorded"
  | "design.invalidated"
  | "contract.projected"
  | "projection.reconciliation_requested"
  | "evidence.invalidated"
  | "shape.checkpoint"
  | "assurance.evidence_recorded"
  | "assurance.evidence_invalidated"
  | "assurance.issue_resolved"
  | "assurance.human_observation_requested"
  | "assure.completed";

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

export type AssuranceSubjectKind = "criterion" | "risk" | "mandatory_check";
export type AssuranceOperationKind = "command" | "model-inspection" | "user-observation";

export interface AssuranceSubject {
  id: string;
  kind: AssuranceSubjectKind;
}

export interface AssuranceCheckIdentity {
  executable: string;
  argv: readonly string[];
  logicalCwd: string;
  environment: Readonly<Record<string, string>>;
  toolFingerprintRefs: readonly string[];
}

export interface AssuranceSuccessPredicate {
  exitCodes?: readonly number[];
  requiredOutputRefs?: readonly string[];
  requiredArtifactRefs?: readonly string[];
  thresholdRef?: string;
}

export interface AssuranceOperation {
  id: string;
  kind: AssuranceOperationKind;
  dependsOn: readonly string[];
  covers: readonly string[];
  cost: "low" | "medium" | "high";
  scopeRefs: readonly string[];
  fingerprintMode: "global" | "scoped";
  readOnly: boolean;
  concurrencySafe: boolean;
  conditional: boolean;
  activationPredicateRef?: string;
  checkIdentity?: AssuranceCheckIdentity;
  successPredicate?: AssuranceSuccessPredicate;
}

export interface AssuranceReviewBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCalls: 0 | 1 | 2;
  maxConcurrency: number;
}

export interface AssuranceContract {
  schemaVersion: 1;
  sourceDigest: string;
  subjects: readonly AssuranceSubject[];
  operations: readonly AssuranceOperation[];
  evidencePreference: readonly string[];
  reviewBudget: AssuranceReviewBudget;
  policyDigest: string;
  digest: string;
}

export interface AssuranceEvidenceRecord {
  schemaVersion: 1;
  evidenceId: string;
  operationId: string;
  subjectIds: readonly string[];
  verifierKind: AssuranceOperationKind;
  result: "passed" | "not_applicable" | "failed";
  verifierDigest: string;
  observedFingerprint: string;
  detailRef: string;
  recordedAt: string;
  digest: string;
}

export interface PendingHumanObservation {
  requestId: string;
  operationIds: readonly string[];
  promptRef: string;
  requestedAt: string;
}

export interface AssuranceIssue {
  issueId: string;
  operationId: string;
  status: "active" | "resolved";
  correctionAttempts: number;
  rootCauseRequired: boolean;
  evidenceRef: string;
}

export interface AssuranceState {
  schemaVersion: 1;
  evidenceIndex: readonly AssuranceEvidenceRecord[];
  issues?: readonly AssuranceIssue[];
  pendingHumanObservation?: PendingHumanObservation;
  completionIndex?: readonly string[];
  receipt?: AssuranceReceipt;
}

export type ReviewFindingSeverity = "blocking" | "major" | "minor" | "style";
export type ReviewConfidence = "low" | "medium" | "high";

export interface ReviewFinding {
  issueId: string;
  subjectId: string;
  severity: ReviewFindingSeverity;
  locationRef: string;
  evidence: string;
  requiredCorrection: string;
  confidence: ReviewConfidence;
}

export interface ConsolidatedReviewResult {
  schemaVersion: 1;
  subjectVerdicts: readonly {
    subjectId: string;
    verdict: "passed" | "finding";
  }[];
  findings: readonly ReviewFinding[];
}

export interface GuardEvidenceRecord {
  schemaVersion: 1;
  guard: GuardId;
  stateRevision: number;
  stateFingerprint: string;
  observedFingerprint: string;
  evidenceRefs: readonly string[];
  provenance: "deterministic-check" | "human-approval" | "repository-observation";
  result: "passed" | "not_applicable";
}

export type GateActor = "user" | "autonomous_policy";

export interface GateDecisionRecord {
  schemaVersion: 1;
  decision: "approved" | "rejected" | "change_requested";
  actor: GateActor;
  issueRef?: string;
  decidedAt: string;
  taskId: string;
  artifactId: string;
  stateRevision: number;
  stateFingerprint: string;
  contractDigest: string;
  instructionRef?: string;
  receiptDigest: string;
}

export interface PlanApprovalReceipt extends GateDecisionRecord {
  decision: "approved";
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
  contractDigest?: string;
  guardEvidence?: GuardEvidenceRecord[];
  gateDecision?: GateDecisionRecord;
}

export type DurableHistoryEvent = StateHistoryEvent | WorkflowHistoryEvent;

export interface AssuranceReceipt {
  schemaVersion: 1;
  taskId: string;
  contractDigest: string;
  verifiedSnapshotFingerprint: string;
  evidenceIndexDigest: string;
  completedAt: string;
  receiptDigest: string;
}

export interface IssueIdentity {
  issueId: string;
  occurrenceId: string;
  rootCauseId?: string;
}

export interface TaskState {
  schemaVersion: 6;
  taskId: string;
  status: TaskStatus;
  revision: number;
  risk: RiskLevel;
  design: DesignState;
  shape?: ShapeState;
  contractDigest?: string;
  planApproval?: PlanApprovalReceipt;
  assurance?: AssuranceState;
  resumeTo?: TaskStatus;
  resumeReason?: string;
  configSnapshot: Record<string, unknown>;
  policySnapshot: Policy;
  issues: unknown[];
  history: DurableHistoryEvent[];
  historySummary?: HistorySummary;
  activeArtifact?: ActiveArtifactReference;
  activeWorktree?: ActiveWorktreeReference;
  contextCapsule?: ContextCapsule;
  routingSnapshot?: RoutingSnapshot;
  routingPolicyVersion?: string;
  routingDecisions?: RoutingDecision[];
}

export interface CliResult {
  command: string;
  status: string;
  data: unknown;
}
