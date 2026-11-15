import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { createWorkspaceStore } from "./store.js";
import {
  ALLOWED_MODEL_IDS,
  REASONING_EFFORTS,
  type HarnessId,
  type HarnessPreference,
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
} from "../types.js";

export const MODEL_IDS = ALLOWED_MODEL_IDS;
export const APP_SERVER_PROTOCOL_VERSION = "v2";
export const ROUTING_POLICY_VERSION = "2026-08-13.taskstate-v6.v1";
export const DEFAULT_QUOTA_CACHE_PATH = ".forgix/cache/five-hour-quota-reset.json";

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

export interface RouteTask {
  stage: RoutingStage;
  risk: RiskLevel;
  ambiguity: RiskLevel;
}

export const ROUTING_TASKS: RouteTask[] = [
  { stage: "design", risk: "medium", ambiguity: "medium" },
  { stage: "discover", risk: "medium", ambiguity: "medium" },
  { stage: "plan", risk: "medium", ambiguity: "medium" },
  { stage: "debug", risk: "medium", ambiguity: "medium" },
  { stage: "review", risk: "medium", ambiguity: "medium" },
];

export const ROUTED_STAGES: RoutingStage[] = ["design", "discover", "plan", "debug", "review"];
const MUTATING_STAGES = new Set(["validate"]);

export function isDelegableStage(stage: string): stage is RoutingStage {
  return ROUTED_STAGES.includes(stage as RoutingStage);
}

export async function delegateStage<T>(
  stage: string,
  runner: (decision?: RoutingDecision) => Promise<T>,
  decision?: RoutingDecision,
): Promise<T> {
  if (!isDelegableStage(stage) || MUTATING_STAGES.has(stage)) {
    throw new Error(
      "Mutation and validation stages stay with the parent workflow; no delegation permitted.",
    );
  }
  return runner(decision);
}

const EFFORT_ORDER: ReasoningEffort[] = [...REASONING_EFFORTS];
type MatrixPlan = Exclude<ResolvedSubscriptionPlan, "unknown">;
type RouteTarget = { model: ModelId; effort: ReasoningEffort };

const STANDARD_ROUTES: Record<MatrixPlan, Record<RoutingStage, RouteTarget>> = {
  plus: {
    design: { model: "gpt-5.6-terra", effort: "medium" },
    discover: { model: "gpt-5.6-terra", effort: "medium" },
    plan: { model: "gpt-5.6-sol", effort: "medium" },
    review: { model: "gpt-5.6-luna", effort: "medium" },
    debug: { model: "gpt-5.6-sol", effort: "high" },
  },
  pro_5x: {
    design: { model: "gpt-5.6-sol", effort: "high" },
    discover: { model: "gpt-5.6-terra", effort: "high" },
    plan: { model: "gpt-5.6-sol", effort: "high" },
    review: { model: "gpt-5.6-luna", effort: "medium" },
    debug: { model: "gpt-5.6-sol", effort: "xhigh" },
  },
  pro_20x: {
    design: { model: "gpt-5.6-sol", effort: "xhigh" },
    discover: { model: "gpt-5.6-sol", effort: "medium" },
    plan: { model: "gpt-5.6-sol", effort: "xhigh" },
    review: { model: "gpt-5.6-luna", effort: "medium" },
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
  if (configPlan === "plus" || configPlan === "pro_5x" || configPlan === "pro_20x") {
    return configPlan;
  }
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
      models: available && models.length > 0 ? "model/list" : "unknown",
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

export function createHostNativeRoutingSnapshot(
  harness: Exclude<HarnessId, "codex">,
  capturedAt = new Date().toISOString(),
): RoutingSnapshot {
  return {
    schemaVersion: 1,
    mode: "host-native",
    harness,
    capturedAt,
    plan: "unknown",
    account: {},
    quota: {
      pressure: "unknown",
      source: "unknown",
    },
    models: [],
    warnings: [],
    provenance: {
      plan: "unknown",
      quota: "unknown",
      models: "unknown",
    },
  };
}

export function chooseRoute(snapshot: RoutingSnapshot, task: RouteTask): RoutingDecision {
  if (snapshot.mode === "host-native") {
    return {
      stage: task.stage,
      model: null,
      effort: null,
      quotaPressure: "unknown",
      reason: `host-native:${snapshot.harness ?? "unknown"}`,
      warnings: [],
    };
  }
  const warnings = [...snapshot.warnings];
  const pressure = snapshot.quota.pressure;
  const unknownPlan = snapshot.plan === "unknown";
  if (pressure === "unknown" && !warnings.includes("quota_unknown")) warnings.push("quota_unknown");
  if (unknownPlan && !warnings.includes("plan_unknown")) warnings.push("plan_unknown");
  const effectivePlan = effectiveMatrixPlan(snapshot.plan, pressure);
  const base =
    task.stage === "review"
      ? leastCostReviewTarget(task.risk, task.ambiguity)
      : STANDARD_ROUTES[effectivePlan][task.stage];
  const elevated =
    task.risk === "high" ||
    task.risk === "critical" ||
    task.ambiguity === "high" ||
    task.ambiguity === "critical";
  const delta = elevated && task.stage !== "review" ? 1 : 0;
  const effort = shiftEffort(base.effort, delta);
  const capability = snapshot.models.find((candidate) => candidate.id === base.model);
  const exactAvailable = capability?.supportedReasoningEfforts.includes(effort) === true;
  const reason =
    task.stage === "review"
      ? `least-cost qualified review route for ${highestRisk(task.risk, task.ambiguity)} risk`
      : `${task.stage} route for ${effectivePlan} plan under ${pressure} quota`;
  if (!exactAvailable) {
    if (!warnings.includes("required_route_unavailable")) {
      warnings.push("required_route_unavailable");
    }
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

export interface AppServerOptions {
  command?: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  config?: {
    plan?: string;
    planOverride?: string;
    multiplierOverride?: number;
    modelAllowlist?: readonly ModelId[];
    quota?: { warningPercent?: number; criticalPercent?: number };
  };
}

interface JsonRpcMessage {
  id?: number;
  method?: string;
  result?: unknown;
  error?: { code?: number; message?: string };
  params?: unknown;
}

export class AppServerError extends Error {
  constructor(
    message: string,
    readonly kind: "timeout" | "permission" | "spawn" | "rpc" | "closed" | "unknown" = "unknown",
    readonly stderr = "",
  ) {
    super(message);
  }
}

export type AppServerFailureCode =
  | "app_server_timeout"
  | "app_server_permission_denied"
  | "app_server_spawn_failed"
  | "app_server_rpc_failed"
  | "app_server_closed"
  | "app_server_unavailable";

export interface AppServerFailure {
  code: AppServerFailureCode;
  retryableWithApproval: boolean;
  path?: "~/.codex";
}

const MAX_STDERR_CHARS = 8_192;

export class AppServerClient {
  private readonly process: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private nextId = 1;
  private closed = false;
  private stderr = "";

  constructor(options: AppServerOptions = {}) {
    const args = options.args ?? ["app-server"];
    const spawnOptions = options.cwd
      ? { cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"] }
      : { stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"] };
    this.process = spawn(options.command ?? "codex", args, spawnOptions);
    const lines = createInterface({ input: this.process.stdout });
    lines.on("line", (line) => this.receive(line));
    this.process.stderr.on("data", (chunk: Buffer | string) => {
      if (this.stderr.length >= MAX_STDERR_CHARS) return;
      this.stderr = (this.stderr + String(chunk)).slice(0, MAX_STDERR_CHARS);
    });
    this.process.on("error", (error) =>
      this.fail(new AppServerError(error.message, "spawn", this.stderr)),
    );
    this.process.on("close", () => {
      const kind = looksLikePermissionFailure(this.stderr) ? "permission" : "closed";
      this.fail(
        new AppServerError("app-server closed before completing request", kind, this.stderr),
      );
    });
  }

  async readSnapshot(config?: AppServerOptions["config"]): Promise<BuiltRoutingSnapshot> {
    await this.request("initialize", {
      clientInfo: { name: "forgix", title: "Forgix", version: "0.1.0" },
    });
    this.notify("initialized", {});
    const account = await this.request("account/read", { refreshToken: false });
    const rateLimits = await this.request("account/rateLimits/read", {});
    const models = await this.request("model/list", { includeHidden: false });
    return buildRoutingSnapshot({ account, rateLimits, models, ...(config ? { config } : {}) });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.process.kill();
  }

  private notify(method: string, params: unknown): void {
    if (this.closed) throw new AppServerError("app-server is closed");
    this.process.stdin.write(JSON.stringify({ method, params }) + "\n");
  }

  private request(method: string, params: unknown): Promise<unknown> {
    if (this.closed) return Promise.reject(new AppServerError("app-server is closed"));
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject });
      try {
        this.process.stdin.write(JSON.stringify({ id, method, params }) + "\n");
      } catch (error) {
        this.pending.delete(id);
        reject(
          error instanceof Error ? error : new AppServerError("failed to write to app-server"),
        );
      }
    });
  }

  private receive(line: string): void {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return;
    }
    if (typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(
        new AppServerError(message.error.message ?? "app-server request failed", "rpc"),
      );
      return;
    }
    pending.resolve(message.result);
  }

  private fail(error: AppServerError): void {
    if (this.closed) return;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

export interface CapturedRoutingSnapshot extends BuiltRoutingSnapshot {
  error?: string;
  failure?: AppServerFailure;
}

export async function captureRoutingSnapshot(
  options: AppServerOptions = {},
): Promise<CapturedRoutingSnapshot> {
  const client = new AppServerClient(options);
  const timeoutMs = options.timeoutMs ?? 1500;
  try {
    return await withTimeout(client.readSnapshot(options.config), timeoutMs);
  } catch (error) {
    const failure = classifyAppServerFailure(error);
    return {
      ...createUnavailableRoutingSnapshot(),
      error:
        failure.code === "app_server_timeout" ? "app-server timeout" : "app-server unavailable",
      failure,
    };
  } finally {
    client.close();
  }
}

export interface FiveHourResetCache {
  schemaVersion: 1;
  windowDurationMins: 300;
  resetsAt: number;
}

const FIVE_HOURS_SECONDS = 300 * 60;

export async function readFiveHourResetCache(
  path: string,
  nowEpochSeconds: number,
): Promise<FiveHourResetCache | undefined> {
  try {
    const resolved = findExistingStoreRoot(path);
    if (!resolved) return undefined;
    const store = createWorkspaceStore(resolved.root);
    const content = await store.readText(resolved.relativePath, true);
    if (content === undefined) return undefined;
    const parsed: unknown = JSON.parse(content);
    if (
      !isFiveHourResetCache(parsed) ||
      parsed.resetsAt <= nowEpochSeconds ||
      parsed.resetsAt > nowEpochSeconds + FIVE_HOURS_SECONDS
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export async function writeFiveHourResetCache(
  path: string,
  value: Omit<FiveHourResetCache, "schemaVersion">,
): Promise<void> {
  if (value.windowDurationMins !== 300 || !Number.isFinite(value.resetsAt)) {
    throw new Error("Invalid five-hour reset cache value.");
  }
  const cache: FiveHourResetCache = { schemaVersion: 1, ...value };
  const resolved = findExistingStoreRoot(path);
  if (!resolved) {
    throw new Error(`No existing workspace root for quota cache path: ${path}.`);
  }
  const store = createWorkspaceStore(resolved.root);
  await store.writeTextAtomically(resolved.relativePath, JSON.stringify(cache, null, 2) + "\n");
}

export function applyFiveHourResetFallback(
  snapshot: RoutingSnapshot,
  cached: FiveHourResetCache | undefined,
): RoutingSnapshot {
  if (!cached || snapshot.quota.source === "app-server") return snapshot;
  return {
    ...snapshot,
    quota: {
      windowDurationMins: 300,
      resetsAt: cached.resetsAt,
      pressure: "unknown",
      source: "last-known",
      ...(snapshot.quota.observedWindow ? { observedWindow: snapshot.quota.observedWindow } : {}),
    },
    warnings: snapshot.warnings.includes("quota_fallback_last_known")
      ? snapshot.warnings
      : [...snapshot.warnings, "quota_fallback_last_known"],
    provenance: { ...snapshot.provenance, quota: "last-known-cache" },
  };
}

export interface ResolveHarnessOptions {
  flag?: HarnessPreference;
  configHarness?: unknown;
  env?: NodeJS.ProcessEnv;
  entrypointPath?: string;
}

export function resolveHarness(options: ResolveHarnessOptions = {}): HarnessId {
  if (options.flag && options.flag !== "auto") {
    return options.flag;
  }
  if (
    options.flag !== "auto" &&
    (options.configHarness === "codex" ||
      options.configHarness === "claude" ||
      options.configHarness === "antigravity")
  ) {
    return options.configHarness;
  }
  const env = options.env ?? process.env;
  if (isTruthyEnv(env.CODEX_THREAD_ID)) {
    return "codex";
  }
  if (
    isTruthyEnv(env.CLAUDE_PLUGIN_ROOT) ||
    isTruthyEnv(env.CLAUDECODE) ||
    isTruthyEnv(env.CLAUDE_CODE_ENTRYPOINT)
  ) {
    return "claude";
  }
  const entry = (options.entrypointPath ?? process.argv[1] ?? "").replaceAll("\\", "/");
  if (
    isTruthyEnv(env.ANTIGRAVITY_AGENT) ||
    isTruthyEnv(env.ANTIGRAVITY_CLI) ||
    isTruthyEnv(env.ANTIGRAVITY_SESSION_ID) ||
    (!entry.includes("/.gemini/antigravity/worktrees/") &&
      (entry.includes("/.gemini/config/plugins/") ||
        entry.includes("/.gemini/antigravity/plugins/")))
  ) {
    return "antigravity";
  }
  if (entry.includes("/.claude/plugins/")) {
    return "claude";
  }
  return "codex";
}

export interface ResolveRoutingReportOptions {
  cwd?: string;
  configValue?: Record<string, unknown>;
  harnessFlag?: HarnessPreference;
  entrypointPath?: string;
  env?: NodeJS.ProcessEnv;
  appServer?: AppServerOptions;
  captureSnapshot?: (options?: AppServerOptions) => Promise<CapturedRoutingSnapshot>;
  quotaCachePath?: string | false;
  nowEpochSeconds?: number;
}

export interface RoutingReport {
  status: "routed" | "routed_with_warning" | "routing_permission_required" | "routing_unavailable";
  harness: HarnessId;
  routingSnapshot: RoutingSnapshot;
  routingPolicyVersion: string;
  routingDecisions: RoutingDecision[];
  routingFailure?: AppServerFailure;
  warning?: string;
}

export async function resolveRoutingReport(
  options: ResolveRoutingReportOptions = {},
): Promise<RoutingReport> {
  const harness = resolveHarness({
    ...(options.harnessFlag ? { flag: options.harnessFlag } : {}),
    configHarness: options.configValue?.harness,
    ...(options.env ? { env: options.env } : {}),
    ...(options.entrypointPath ? { entrypointPath: options.entrypointPath } : {}),
  });

  if (harness === "claude" || harness === "antigravity") {
    const routingSnapshot = createHostNativeRoutingSnapshot(harness);
    const routingDecisions = ROUTING_TASKS.map((task) => chooseRoute(routingSnapshot, task));
    return {
      status: "routed",
      harness,
      routingSnapshot,
      routingPolicyVersion: ROUTING_POLICY_VERSION,
      routingDecisions,
    };
  }

  const capture = options.captureSnapshot ?? captureRoutingSnapshot;
  const subscription = isRecord(options.configValue?.subscription)
    ? options.configValue.subscription
    : {};
  const snapshotResult = await capture({
    ...options.appServer,
    config: buildAppServerSubscriptionConfig(subscription),
  });

  const nowEpochSeconds = options.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  const quotaCachePath = resolveQuotaCachePath(options);
  let routingSnapshot = snapshotResult.snapshot;
  if (quotaCachePath) {
    if (
      routingSnapshot.quota.source === "app-server" &&
      routingSnapshot.quota.windowDurationMins === 300 &&
      routingSnapshot.quota.resetsAt !== undefined &&
      routingSnapshot.quota.resetsAt > nowEpochSeconds
    ) {
      try {
        await writeFiveHourResetCache(quotaCachePath, {
          windowDurationMins: 300,
          resetsAt: routingSnapshot.quota.resetsAt,
        });
      } catch {
        routingSnapshot = appendRoutingWarning(routingSnapshot, "quota_cache_write_failed");
      }
    } else {
      const cached = await readFiveHourResetCache(quotaCachePath, nowEpochSeconds);
      routingSnapshot = applyFiveHourResetFallback(routingSnapshot, cached);
    }
  }

  const routingDecisions = ROUTING_TASKS.map((task) => chooseRoute(routingSnapshot, task));
  const unavailable = routingDecisions.some(
    (decision) => decision.model === null || decision.effort === null,
  );
  const permissionRequired = snapshotResult.failure?.code === "app_server_permission_denied";
  const status = permissionRequired
    ? "routing_permission_required"
    : unavailable
      ? "routing_unavailable"
      : snapshotResult.available
        ? "routed"
        : "routed_with_warning";

  return {
    status,
    harness,
    routingSnapshot,
    routingPolicyVersion: ROUTING_POLICY_VERSION,
    routingDecisions,
    ...(snapshotResult.failure ? { routingFailure: snapshotResult.failure } : {}),
    ...(snapshotResult.error ? { warning: snapshotResult.error } : {}),
  };
}

function buildAppServerSubscriptionConfig(
  subscription: Record<string, unknown>,
): NonNullable<AppServerOptions["config"]> {
  return {
    plan: typeof subscription.plan === "string" ? subscription.plan : "auto",
    ...(typeof subscription.planOverride === "string"
      ? { planOverride: subscription.planOverride }
      : {}),
    ...(typeof subscription.multiplierOverride === "number"
      ? { multiplierOverride: subscription.multiplierOverride }
      : {}),
    ...(Array.isArray(subscription.modelAllowlist)
      ? {
          modelAllowlist: subscription.modelAllowlist.filter(
            (model): model is ModelId =>
              typeof model === "string" && (ALLOWED_MODEL_IDS as readonly string[]).includes(model),
          ),
        }
      : {}),
    ...(isRecord(subscription.quota)
      ? {
          quota: {
            ...(typeof subscription.quota.warningPercent === "number"
              ? { warningPercent: subscription.quota.warningPercent }
              : {}),
            ...(typeof subscription.quota.criticalPercent === "number"
              ? { criticalPercent: subscription.quota.criticalPercent }
              : {}),
          },
        }
      : {}),
  };
}

function resolveQuotaCachePath(options: ResolveRoutingReportOptions): string | undefined {
  if (options.quotaCachePath === false) return undefined;
  if (typeof options.quotaCachePath === "string") return options.quotaCachePath;
  if (options.captureSnapshot) return undefined;
  return resolve(options.cwd ?? process.cwd(), DEFAULT_QUOTA_CACHE_PATH);
}

function appendRoutingWarning(snapshot: RoutingSnapshot, warning: string): RoutingSnapshot {
  return snapshot.warnings.includes(warning)
    ? snapshot
    : { ...snapshot, warnings: [...snapshot.warnings, warning] };
}

function findExistingStoreRoot(targetPath: string): { root: string; relativePath: string } | null {
  const fullTarget = resolve(targetPath);
  let cursor = dirname(fullTarget);
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
  const rel = relative(cursor, fullTarget);
  if (!rel || rel === ".." || rel.startsWith("..")) return null;
  return { root: cursor, relativePath: rel };
}

function leastCostReviewTarget(risk: RiskLevel, ambiguity: RiskLevel): RouteTarget {
  const level = highestRisk(risk, ambiguity);
  if (level === "critical") return { model: "gpt-5.6-sol", effort: "high" };
  if (level === "high") return { model: "gpt-5.6-terra", effort: "high" };
  return { model: "gpt-5.6-luna", effort: "medium" };
}

function highestRisk(left: RiskLevel, right: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high", "critical"];
  return order[Math.max(order.indexOf(left), order.indexOf(right))] ?? "critical";
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
    if (!isRecord(candidate) || typeof candidate.id !== "string" || !isModelId(candidate.id)) {
      continue;
    }
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(
      () => reject(new AppServerError("app-server timeout", "timeout")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolvePromise(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function classifyAppServerFailure(error: unknown): AppServerFailure {
  if (error instanceof AppServerError) {
    if (error.kind === "timeout") {
      return { code: "app_server_timeout", retryableWithApproval: false };
    }
    if (error.kind === "spawn") {
      return { code: "app_server_spawn_failed", retryableWithApproval: false };
    }
    if (error.kind === "rpc") {
      return { code: "app_server_rpc_failed", retryableWithApproval: false };
    }
    if (error.kind === "permission" || looksLikePermissionFailure(error.stderr)) {
      return {
        code: "app_server_permission_denied",
        ...(mentionsCodexHome(error.stderr) ? { path: "~/.codex" as const } : {}),
        retryableWithApproval: true,
      };
    }
    if (error.kind === "closed") {
      return { code: "app_server_closed", retryableWithApproval: false };
    }
  }
  return { code: "app_server_unavailable", retryableWithApproval: false };
}

function looksLikePermissionFailure(value: string): boolean {
  return /operation not permitted|permission denied|\bEACCES\b|\bEPERM\b/i.test(value);
}

function mentionsCodexHome(value: string): boolean {
  return /(?:^|[\\/])\.codex(?:[\\/]|\b)/i.test(value);
}

function isFiveHourResetCache(value: unknown): value is FiveHourResetCache {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 1 &&
    candidate.windowDurationMins === 300 &&
    typeof candidate.resetsAt === "number" &&
    Number.isFinite(candidate.resetsAt)
  );
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "0" && normalized !== "false";
}
