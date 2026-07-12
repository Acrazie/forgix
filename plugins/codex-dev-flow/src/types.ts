export type TaskMode = "quick" | "standard" | "critical";

export const ALLOWED_MODEL_IDS = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"] as const;
export type ModelId = (typeof ALLOWED_MODEL_IDS)[number];

export const REASONING_EFFORTS = ["low", "medium", "high", "max", "ultra"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export type SubscriptionPlan = "auto" | "plus" | "pro_5x" | "pro_20x";
export type ResolvedSubscriptionPlan = Exclude<SubscriptionPlan, "auto"> | "unknown";
export type QuotaPressure = "normal" | "warning" | "critical" | "unknown";
export type RoutingStage = "discover" | "plan" | "debug" | "review" | "verify";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ModelCapability {
  id: ModelId;
  supportedReasoningEfforts: ReasoningEffort[];
}

export interface QuotaSnapshot {
  windowDurationMins?: number;
  usedPercent?: number;
  pressure: QuotaPressure;
  source: "app-server" | "unknown";
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
    quota: "account/rateLimits/read" | "unknown";
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

export type TaskStatus =
  | "new"
  | "awaiting_mode_confirmation"
  | "discovering"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "validating"
  | "reviewing"
  | "resolving"
  | "verifying"
  | "handing_off"
  | "ready_for_handoff"
  | "blocked"
  | "cancelled"
  | "failed"
  | "finished_local"
  | "finished";

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
  schemaVersion: number;
  taskId: string;
  status: TaskStatus;
  resumeTo?: TaskStatus;
  configSnapshot: Record<string, unknown>;
  policySnapshot: Policy;
  issues: unknown[];
  reviewCycle: number;
  remainingActions: string[];
  history: unknown[];
  routingSnapshot?: RoutingSnapshot;
  routingDecisions?: RoutingDecision[];
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
