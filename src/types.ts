export const ALLOWED_MODEL_IDS = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"] as const;
export type ModelId = (typeof ALLOWED_MODEL_IDS)[number];

export const HARNESS_IDS = ["codex", "claude", "antigravity"] as const;
export type HarnessId = (typeof HARNESS_IDS)[number];
export type HarnessPreference = "auto" | HarnessId;

export const HOOK_ENFORCEMENT_MODES = ["balanced", "strict", "warn"] as const;
export type HookEnforcementMode = (typeof HOOK_ENFORCEMENT_MODES)[number];

export const HOOK_EVENTS = [
  "session-start",
  "pre-tool-use",
  "post-tool-use",
  "post-invocation",
] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];

export interface HooksConfig {
  enforcement?: HookEnforcementMode;
}

export interface BootstrapConfig {
  rules?: boolean;
  hooks?: boolean;
  gitignore?: boolean;
  worktreeInclude?: boolean;
}

export interface HookRunResult {
  stdout: string;
  stderr?: string;
  exitCode: 0 | 2;
}

export type InitBootstrapAction = "plan" | "apply" | "check";

type RoutingMode = "codex-app-server" | "host-native";

export const REASONING_EFFORTS = ["low", "medium", "high", "xhigh"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

type SubscriptionPlan = "auto" | "plus" | "pro_5x" | "pro_20x";
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

export type MacroPhase = "INTAKE" | "SHAPE" | "GATE" | "BUILD" | "ASSURE";

type GuardId =
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

interface QuotaSnapshot {
  windowDurationMins?: number;
  usedPercent?: number;
  resetsAt?: number;
  pressure: QuotaPressure;
  source: "app-server" | "last-known" | "unknown";
  observedWindow?: QuotaWindowSnapshot;
}

interface SanitizedAccount {
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

interface ModelCostProfile {
  multiplier: number;
  rateVersion: string;
  inputCreditsPerMillion: number;
  cachedInputCreditsPerMillion: number;
  outputCreditsPerMillion: number;
}

interface Policy {
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

type DecisionGraph = DependencyGraph;

type DesignOwner = "intake" | "shape";
type DesignQuestionKind = "product" | "terminology" | "domain_rule" | "technical";
type DesignRecordStatus = "proposed" | "resolved" | "approved" | "projected" | "invalidated";
type DomainDisposition = "project" | "already_documented" | "task_local" | "policy_forbidden";

interface DesignProvenance {
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

interface DesignQuestionOption {
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

interface DomainGlossaryDelta {
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

interface DomainScenario {
  id: string;
  angle: "nominal" | "boundary" | "exception" | "contradiction";
  startingSituation: string;
  action: string;
  expectedResult: string;
}

interface DomainRule {
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

interface DecisionAlternative {
  id: string;
  label: string;
  consequences: string[];
  excludedReason?: string;
}

interface DecisionCandidate {
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

interface DesignInvalidation {
  rootIds: string[];
  invalidatedNodeIds: string[];
  reason: string;
  at: string;
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
type ShapeRole = "discovering" | "planning";
type DiscoveryTargetStatus = "open" | "resolved" | "escalated" | "blocked" | "stale";
type DiscoveryMaterialImpact =
  | "scope"
  | "risk"
  | "acceptance"
  | "plan"
  | "validation"
  | "profile_recommendation";

interface DiscoveryTarget {
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

interface TechnicalDecisionOption {
  id: string;
  label: string;
  impact: string;
  excludedReason?: string;
}

interface TechnicalDecision {
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

type ShapeSourceFingerprintKind = "git_blob" | "content" | "command" | "external";

interface ShapeSourceFingerprint {
  id: string;
  kind: ShapeSourceFingerprintKind;
  value: string;
  provenanceRef: string;
  dependencyNodeId: string;
  inputDigest?: string;
  observedAt?: string;
  expiresAt?: string;
}

interface ShapeEvidenceItem {
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

export interface ContractAcceptanceCriterion {
  id: string;
  description: string;
  validationIds: string[];
  dependencyNodeId: string;
  verifierKind?: VerifierKind;
  nonAutomatable?: boolean;
  requiresHumanGate?: boolean;
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
  verifierKind?: VerifierKind;
  dependencyNodeId: string;
}

export interface ContractRisk {
  id: string;
  description: string;
  control: string;
  dependencyNodeId: string;
}

type GuideReasonKind =
  | "architectural_boundary"
  | "compatibility_migration"
  | "non_obvious_order"
  | "security_concurrency_performance"
  | "mandatory_repository_pattern"
  | "complex_rollback_deployment";

interface ImplementationGuide {
  dependencyNodeId: string;
  content: string[];
  requiredBecause: Array<{
    kind: GuideReasonKind;
    evidenceIds: string[];
    riskIds: string[];
  }>;
}

export interface CanonicalChangeContract {
  schemaVersion: 1 | 2;
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
  approvedProtectedPaths?: string[];
  approvedEscapeHatches?: string[];
  planDesign?: {
    objective: string;
    sourceFingerprint?: string;
    choices: Array<{
      decisionId: string;
      optionId: string;
      summary: string;
      rationale?: string;
    }>;
  };
  guide?: ImplementationGuide;
  digest: string;
}

interface PlanProjectionRecord {
  schemaVersion: 1;
  path: string;
  status: "Proposed" | "Approved";
  contractDigest: string;
  contentFingerprint: string;
  written?: {
    fingerprint: string;
    identity: string;
    authorization: string;
  };
  pending?: {
    contractDigest: string;
    fromFingerprint: string | null;
    fingerprint: string;
    authorization: string;
    identity: string;
  };
}

interface PreparationCheckpoint {
  changeShape: string;
  surfaceCategories: string[];
  materialFacts: string[];
}

interface PreparationProfileChoice {
  schemaVersion: 1;
  status: "pending" | "selected";
  recommendation: PreparationProfile;
  recommendationBasis: string;
  discoveryReceiptDigest?: string;
  checkpoint: PreparationCheckpoint;
  selectedProfile?: PreparationProfile;
  selectionEvidenceRef?: string;
}

interface ShapeUsage {
  reasoningCalls: number;
  inputTokens: number;
  outputTokens: number;
  contextBytes: number;
}

interface ShapeBudgetLimits {
  maxReasoningCalls?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxContextBytes?: number;
}

interface ShapeBudgetCheckpoint {
  reason: "reasoning_calls" | "input_tokens" | "output_tokens" | "context_bytes";
  actions: ["continue", "reduce_scope", "cancel"];
}

interface ShapeBudget {
  limits: ShapeBudgetLimits;
  usage: ShapeUsage;
  continuations: number;
  checkpoint?: ShapeBudgetCheckpoint;
}

interface ShapeInvalidation {
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

interface HistorySummary {
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

type HistoryReferenceKind =
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

interface HistoryReference {
  kind: HistoryReferenceKind;
  ref: string;
  fingerprint?: string;
}

interface HistoryGateAnchor {
  contractDigest: string;
  entrySequence: number;
  entryRevision: number;
  entryFrom: "planning";
  sourceFingerprint: string;
}

type WorkflowHistoryEventType =
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
  receiptDigest?: string;
  contractDigest?: string;
  verifiedSnapshotFingerprint?: string;
  completionIndex?: readonly string[];
  receiptVersion?: 1 | 2;
}

type ActiveArtifactReference = { artifactId: string; ownerRef: string; fingerprint: string };

type ActiveWorktreeReference = { worktreeRef: string; gitFingerprint: string };

type ContextCapsuleSection =
  | "objective"
  | "approved_scope"
  | "risk"
  | "relevant_code"
  | "constraints"
  | "acceptance"
  | "decision"
  | "evidence";

interface ContextCapsuleEntry {
  section: ContextCapsuleSection;
  ownerRef: string;
  provenanceRef: string;
  fingerprintRefs: string[];
}

interface ContextCapsuleFingerprint {
  id: string;
  kind: "git" | "config" | "policy" | "artifact" | "worktree";
  value: string;
  provenanceRef: string;
}

interface ContextCapsule {
  schemaVersion: 1;
  entries: ContextCapsuleEntry[];
  fingerprints: ContextCapsuleFingerprint[];
}

export const VERIFIER_KINDS = [
  "command",
  "runtime-evidence",
  "tla-tlc",
  "lean4",
  "model-inspection",
  "user-observation",
] as const;
export type VerifierKind = (typeof VERIFIER_KINDS)[number];
export type AssuranceOperationKind = VerifierKind;
export const EXECUTABLE_VERIFIER_KINDS = [
  "command",
  "runtime-evidence",
  "tla-tlc",
  "lean4",
] as const satisfies readonly VerifierKind[];

export type AssuranceSubjectKind = "criterion" | "risk" | "mandatory_check";

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

interface AssuranceReviewBudget {
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
  activationEvidenceRef?: string;
  recordedAt: string;
  digest: string;
}

interface PendingHumanObservation {
  requestId: string;
  operationIds: readonly string[];
  promptRef: string;
  requestedAt: string;
}

interface AssuranceIssue {
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
  externalArtifacts?: readonly string[];
  completionIndex?: readonly string[];
  receipt?: AssuranceReceipt;
}

interface GuardEvidenceRecord {
  schemaVersion: 1;
  guard: GuardId;
  stateRevision: number;
  stateFingerprint: string;
  observedFingerprint: string;
  evidenceRefs: readonly string[];
  provenance: "deterministic-check" | "human-approval" | "repository-observation";
  result: "passed" | "not_applicable";
}

type GateActor = "user" | "autonomous_policy";
export interface GateDecisionRecord {
  schemaVersion: 1 | 2;
  worktreeDigest?: string;
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
  schemaVersion: 1 | 2;
  taskId: string;
  contractDigest: string;
  verifiedSnapshotFingerprint: string;
  evidenceIndexDigest: string;
  completedAt: string;
  receiptDigest: string;
  worktreeDigest?: string;
  observedSnapshotFingerprint?: string;
  artifactDigests?: Record<string, string>;
}

type ContractReviewRole = {
  id: string;
  fingerprint: string;
  sources: string[];
  sections?: string[];
  reason?: string;
};
type ContractReviewSourceStamp = { path: string; digest: string };
type ContractReviewCapsule = {
  digest: string;
  taskId: string;
  contractDigest: string;
  worktree: string;
  sources: ContractReviewSourceStamp[];
  roles: ContractReviewRole[];
  renderDigest?: string;
};
type ContractReviewFinding = {
  id: string;
  severity: "blocker" | "major" | "nit";
  description: string;
  source?: string;
};
export type ContractReviewParaphrase = { proposal: string; existingSystem: string };
type ContractReviewResult = {
  nativeId: string;
  role: string;
  fingerprint: string;
  findings: ContractReviewFinding[];
  paraphrase?: ContractReviewParaphrase;
};
type ContractReviewRound = {
  id: number;
  capsule: string;
  roles: string[];
  permit?: string;
  results: ContractReviewResult[];
};
type ContractReviewDisposition = {
  finding: string;
  contractDigest: string;
  capsule: string;
  rationale: string;
};
type ContractReviewBuildProof = { receipt: string; worktree: string; nativeWriteRef: string };
export type ContractReviewState = {
  version: 1;
  capsule?: ContractReviewCapsule;
  rounds: ContractReviewRound[];
  accepted: ContractReviewDisposition[];
  buildProof?: ContractReviewBuildProof;
};

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
  contractReview?: ContractReviewState;
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

export type CliResult = { command: string; status: string; data: unknown };

export const FACTORY_RUNNER_MODES = ["worktree", "dagger", "auto"] as const;
export type FactoryRunnerMode = (typeof FACTORY_RUNNER_MODES)[number];

export interface FactoryRunnerConfig {
  mode: FactoryRunnerMode;
  assureRunner: FactoryRunnerMode;
}

export interface SurfaceVerificationRule {
  id: string;
  pathGlobs: string[];
  requiredVerifierKinds: VerifierKind[];
  requiredCommands: string[];
}

export interface SurfaceVerificationViolation {
  ruleId: string;
  matchedPaths: string[];
  missingVerifierKinds: VerifierKind[];
  missingCommands: string[];
}

export interface SurfaceVerificationEvaluation {
  passed: boolean;
  clean: boolean;
  matchedRuleIds: string[];
  requiredVerifierKinds: VerifierKind[];
  requiredCommands: string[];
  missingVerifierKinds: VerifierKind[];
  missingCommands: string[];
  violations: SurfaceVerificationViolation[];
}

export interface EscapeHatchFinding {
  kind: string;
  pattern: string;
  file: string;
  line: number;
  snippet: string;
}

export interface EscapeHatchScanResult {
  clean: boolean;
  passed: boolean;
  findings: EscapeHatchFinding[];
  violations: EscapeHatchFinding[];
}

export interface ProtectedSurfaceViolation {
  path: string;
  matchedGlob: string;
}

export interface ProtectedSurfaceVerificationResult {
  allowed: boolean;
  passed: boolean;
  clean: boolean;
  protectedPaths: string[];
  unapprovedPaths: string[];
  violations: ProtectedSurfaceViolation[];
}
export interface NextActionEnvelope {
  role: string;
  phase: string;
  allowedCommands: string[];
  activeInvariants: string[];
  retroRecommended?: boolean;
  retroReason?: string;
}
export type FactoryTelemetryEventType =
  | "gate.rejected"
  | "assure.check_failed"
  | "assure.completed"
  | "escape_hatch.blocked"
  | "debug_root_cause.activated"
  | "shared_contract.drift"
  | "checkpoint.failed"
  | "phase.bounce"
  | (string & {});

export interface FactoryTelemetryEvent {
  schemaVersion?: 1;
  eventId?: string;
  at: string;
  type: FactoryTelemetryEventType;
  taskId?: string;
  workItemId?: string;
  phase?: MacroPhase;
  issueId?: string;
  firstPassAssure?: boolean;
  phaseBounces?: number;
  escapeHatchKind?: string;
  surfacePath?: string;
  contractId?: string;
  checkpointId?: string;
  durationMs?: number;
  detail?: string;
}

export interface RecurringIssueStat {
  issueId: string;
  count: number;
}

export interface FactoryTelemetrySummary {
  totalEvents: number;
  totalAssureRuns: number;
  firstPassAssureCount: number;
  firstPassAssureRate: number;
  recurringIssues: RecurringIssueStat[];
  recurringIssueIds: string[];
  phaseBounces: number;
  escapeHatchBlocks: number;
  debugRootCauseActivations: number;
  sharedContractDrifts: number;
  checkpointFailures: number;
  byType: Record<string, number>;
}

export const FACTORY_EVOLUTION_CATEGORIES = [
  "mechanical_guardrail",
  "surface_verification_rule",
  "skill_budget_bounded_doc",
] as const;
export type FactoryEvolutionCategory = (typeof FACTORY_EVOLUTION_CATEGORIES)[number];

export interface FactoryEvolutionProposal {
  id: string;
  priority: 1 | 2 | 3;
  category: FactoryEvolutionCategory;
  kind: FactoryEvolutionCategory;
  targetPath: string;
  title: string;
  rationale: string;
  triggeredBy: string[];
}
