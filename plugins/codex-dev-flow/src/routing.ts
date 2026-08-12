import {
  ALLOWED_MODEL_IDS,
  REASONING_EFFORTS,
  type ModelCapability,
  type ModelId,
  type QuotaPressure,
  type QuotaWindowSnapshot,
  type ReasoningEffort,
  type ResolvedSubscriptionPlan,
  type RiskLevel,
  type RoutingDecision,
  type RoutingSnapshot,
  type RoutingStage,
  type SubscriptionConfig,
} from "./types.js";

export const MODEL_IDS = ALLOWED_MODEL_IDS;
export const APP_SERVER_PROTOCOL_VERSION = "v2";
export const ROUTING_POLICY_VERSION = "2026-08-12.native-build.v2";
export const MODEL_COST_MULTIPLIERS: Record<ModelId, number> = {
  "gpt-5.6-luna": 1,
  "gpt-5.6-terra": 2.5,
  "gpt-5.6-sol": 5,
};

export const MODEL_COST_PROFILES: SubscriptionConfig["modelCosts"] = {
  "gpt-5.6-luna": {
    multiplier: 1,
    rateVersion: "2026-07-09",
    inputCreditsPerMillion: 25,
    cachedInputCreditsPerMillion: 2.5,
    outputCreditsPerMillion: 150,
  },
  "gpt-5.6-terra": {
    multiplier: 2.5,
    rateVersion: "2026-07-09",
    inputCreditsPerMillion: 62.5,
    cachedInputCreditsPerMillion: 6.25,
    outputCreditsPerMillion: 375,
  },
  "gpt-5.6-sol": {
    multiplier: 5,
    rateVersion: "2026-07-09",
    inputCreditsPerMillion: 125,
    cachedInputCreditsPerMillion: 12.5,
    outputCreditsPerMillion: 750,
  },
};

const EFFORT_ORDER: ReasoningEffort[] = [...REASONING_EFFORTS];

type MatrixPlan = Exclude<ResolvedSubscriptionPlan, "unknown">;
type RouteTarget = { model: ModelId; effort: ReasoningEffort };

const STANDARD_ROUTES: Record<MatrixPlan, Record<RoutingStage, RouteTarget>> = {
  plus: {
    discover: { model: "gpt-5.6-terra", effort: "medium" },
    plan: { model: "gpt-5.6-sol", effort: "medium" },
    review: { model: "gpt-5.6-sol", effort: "medium" },
    verify: { model: "gpt-5.6-luna", effort: "medium" },
    debug: { model: "gpt-5.6-sol", effort: "high" },
  },
  pro_5x: {
    discover: { model: "gpt-5.6-terra", effort: "high" },
    plan: { model: "gpt-5.6-sol", effort: "high" },
    review: { model: "gpt-5.6-sol", effort: "high" },
    verify: { model: "gpt-5.6-luna", effort: "medium" },
    debug: { model: "gpt-5.6-sol", effort: "xhigh" },
  },
  pro_20x: {
    discover: { model: "gpt-5.6-sol", effort: "medium" },
    plan: { model: "gpt-5.6-sol", effort: "xhigh" },
    review: { model: "gpt-5.6-sol", effort: "xhigh" },
    verify: { model: "gpt-5.6-terra", effort: "medium" },
    debug: { model: "gpt-5.6-sol", effort: "xhigh" },
  },
};

export function classifyQuotaPressure(
  usedPercent: number | undefined,
  thresholds: { warningPercent?: number; criticalPercent?: number } = {},
): QuotaPressure {
  if (usedPercent === undefined || !Number.isFinite(usedPercent)) return "unknown";
  const warning = thresholds.warningPercent ?? 50;
  const critical = thresholds.criticalPercent ?? 80;
  if (usedPercent >= critical) return "critical";
  if (usedPercent >= warning) return "warning";
  return "normal";
}

export function selectFiveHourWindow(
  rateLimits: unknown,
): (QuotaWindowSnapshot & { windowDurationMins: 300 }) | undefined {
  return collectQuotaWindows(rateLimits).find(
    (window): window is QuotaWindowSnapshot & { windowDurationMins: 300 } =>
      window.windowDurationMins === 300,
  );
}

export function selectObservedQuotaWindow(rateLimits: unknown): QuotaWindowSnapshot | undefined {
  return collectQuotaWindows(rateLimits)
    .filter((window) => window.windowDurationMins !== 300)
    .toSorted((left, right) => left.windowDurationMins - right.windowDurationMins)[0];
}

export function resolveSubscriptionPlan(
  configPlan: string | undefined,
  accountPlan: string | undefined,
): ResolvedSubscriptionPlan {
  if (configPlan === "plus" || configPlan === "pro_5x" || configPlan === "pro_20x")
    return configPlan;
  if (accountPlan === "plus") return "plus";
  if (accountPlan === "pro_5x" || accountPlan === "pro_20x") return accountPlan;
  if (accountPlan === "pro") return "pro_5x";
  return "unknown";
}

export function resolveSubscriptionMultiplier(
  plan: ResolvedSubscriptionPlan,
  override?: number,
): number {
  if (override !== undefined && Number.isFinite(override) && override > 0) return override;
  if (plan === "pro_20x") return 20;
  if (plan === "pro_5x") return 5;
  return 1;
}

export interface RawRoutingSnapshotInput {
  account?: unknown;
  rateLimits?: unknown;
  models?: unknown;
  config?: {
    plan?: string;
    planOverride?: string;
    multiplierOverride?: number;
    modelAllowlist?: readonly ModelId[];
    quota?: { warningPercent?: number; criticalPercent?: number };
  };
  capturedAt?: string;
}

export interface BuiltRoutingSnapshot {
  available: boolean;
  snapshot: RoutingSnapshot;
}

export function buildRoutingSnapshot(
  input: RawRoutingSnapshotInput,
  available = true,
): BuiltRoutingSnapshot {
  const account = extractAccount(input.account);
  const accountPlan = typeof account.planType === "string" ? account.planType : undefined;
  const configuredPlan = input.config?.planOverride ?? input.config?.plan;
  const plan = resolveSubscriptionPlan(configuredPlan, accountPlan);
  const window = selectFiveHourWindow(input.rateLimits);
  const observedWindow = window ? undefined : selectObservedQuotaWindow(input.rateLimits);
  const pressure = classifyQuotaPressure(window?.usedPercent, input.config?.quota);
  const models = normalizeModels(input.models, input.config?.modelAllowlist);
  const warnings: string[] = [];
  if (pressure === "unknown") warnings.push("quota_unknown");
  if (available && !window) warnings.push("five_hour_window_unavailable");
  if (models.length === 0) warnings.push("allowed_model_unavailable");
  if (!available && !warnings.includes("quota_unknown")) warnings.push("quota_unknown");
  const snapshot: RoutingSnapshot = {
    schemaVersion: 1,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    plan,
    account,
    quota: {
      ...(window
        ? {
            windowDurationMins: window.windowDurationMins,
            usedPercent: window.usedPercent,
            ...(window.resetsAt !== undefined ? { resetsAt: window.resetsAt } : {}),
          }
        : {}),
      pressure,
      source: available && window ? "app-server" : "unknown",
      ...(observedWindow ? { observedWindow } : {}),
    },
    models,
    warnings,
    provenance: {
      plan:
        configuredPlan && configuredPlan !== "auto"
          ? "config"
          : accountPlan
            ? "account/read"
            : "unknown",
      quota: available && window ? "account/rateLimits/read" : "unknown",
      models: available && models.length ? "model/list" : "unknown",
    },
    subscriptionMultiplier: resolveSubscriptionMultiplier(plan, input.config?.multiplierOverride),
  };
  return { available, snapshot };
}

export function createUnavailableRoutingSnapshot(
  capturedAt = new Date().toISOString(),
): BuiltRoutingSnapshot {
  return buildRoutingSnapshot({ capturedAt, config: { plan: "auto" } }, false);
}

export interface RouteTask {
  stage: RoutingStage;
  risk: RiskLevel;
  ambiguity: RiskLevel;
}

export function chooseRoute(snapshot: RoutingSnapshot, task: RouteTask): RoutingDecision {
  const warnings = [...snapshot.warnings];
  const pressure = snapshot.quota.pressure;
  const unknownPlan = snapshot.plan === "unknown";
  if (pressure === "unknown" && !warnings.includes("quota_unknown")) warnings.push("quota_unknown");
  if (unknownPlan && !warnings.includes("plan_unknown")) warnings.push("plan_unknown");
  const effectivePlan = effectiveMatrixPlan(snapshot.plan, pressure);
  const base = STANDARD_ROUTES[effectivePlan][task.stage];
  const elevated =
    task.risk === "high" ||
    task.risk === "critical" ||
    task.ambiguity === "high" ||
    task.ambiguity === "critical";
  const delta = elevated ? 1 : 0;
  const effort = shiftEffort(base.effort, delta);
  const capability = snapshot.models.find((candidate) => candidate.id === base.model);
  const exactAvailable = capability?.supportedReasoningEfforts.includes(effort) === true;
  const reason = `${task.stage} route for ${effectivePlan} plan under ${pressure} quota`;
  if (!exactAvailable) {
    if (!warnings.includes("required_route_unavailable"))
      warnings.push("required_route_unavailable");
    return {
      stage: task.stage,
      model: null,
      effort: null,
      quotaPressure: pressure,
      reason: `${reason}; exact ${base.model}/${effort} unavailable`,
      warnings,
    };
  }
  return {
    stage: task.stage,
    model: base.model,
    effort,
    quotaPressure: pressure,
    reason,
    warnings,
  };
}

function effectiveMatrixPlan(plan: ResolvedSubscriptionPlan, pressure: QuotaPressure): MatrixPlan {
  const known: MatrixPlan = plan === "unknown" ? "plus" : plan;
  if (pressure === "critical" || pressure === "unknown") return "plus";
  if (pressure !== "warning") return known;
  if (known === "pro_20x") return "pro_5x";
  return "plus";
}

function shiftEffort(effort: ReasoningEffort, delta: -1 | 0 | 1): ReasoningEffort {
  const index = EFFORT_ORDER.indexOf(effort);
  return EFFORT_ORDER[Math.max(0, Math.min(EFFORT_ORDER.length - 1, index + delta))] ?? effort;
}

function normalizeModels(
  input: unknown,
  allowlist: readonly ModelId[] | undefined,
): ModelCapability[] {
  const candidates = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray(input.models)
      ? input.models
      : isRecord(input) && Array.isArray(input.data)
        ? input.data
        : [];
  const models: ModelCapability[] = [];
  for (const candidate of candidates) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || !isModelId(candidate.id))
      continue;
    if (allowlist && !allowlist.includes(candidate.id)) continue;
    const efforts = Array.isArray(candidate.supportedReasoningEfforts)
      ? candidate.supportedReasoningEfforts.flatMap((effort): ReasoningEffort[] => {
          const value =
            typeof effort === "string"
              ? effort
              : isRecord(effort) && typeof effort.reasoningEffort === "string"
                ? effort.reasoningEffort
                : undefined;
          return value && REASONING_EFFORTS.includes(value as ReasoningEffort)
            ? [value as ReasoningEffort]
            : [];
        })
      : [];
    models.push({ id: candidate.id, supportedReasoningEfforts: efforts });
  }
  return models;
}

function extractAccount(input: unknown): { planType?: string } {
  if (!isRecord(input)) return {};
  const account = isRecord(input.account) ? input.account : input;
  return typeof account.planType === "string" ? { planType: account.planType } : {};
}

function isModelId(value: string): value is ModelId {
  return (ALLOWED_MODEL_IDS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectQuotaWindows(
  input: unknown,
  output: QuotaWindowSnapshot[] = [],
  seen = new Set<unknown>(),
): QuotaWindowSnapshot[] {
  if (!isRecord(input) || seen.has(input)) return output;
  seen.add(input);
  if (
    typeof input.windowDurationMins === "number" &&
    Number.isFinite(input.windowDurationMins) &&
    input.windowDurationMins > 0 &&
    typeof input.usedPercent === "number" &&
    Number.isFinite(input.usedPercent)
  ) {
    output.push({
      windowDurationMins: input.windowDurationMins,
      usedPercent: input.usedPercent,
      ...(typeof input.resetsAt === "number" && Number.isFinite(input.resetsAt)
        ? { resetsAt: input.resetsAt }
        : {}),
    });
  }
  for (const value of Object.values(input)) {
    if (isRecord(value)) collectQuotaWindows(value, output, seen);
  }
  return output;
}
