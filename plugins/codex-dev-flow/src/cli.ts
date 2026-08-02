import { resolve } from "node:path";
import { captureRoutingSnapshot } from "./app-server.js";
import { createBenchmarkStore } from "./benchmark.js";
import {
  explainConfig,
  loadConfigSources,
  resolveConfig,
  type ConfigSource,
  type ResolvedConfig,
} from "./config.js";
import { EXIT_CODES } from "./exit-codes.js";
import { InvocationError, parseInvocation } from "./parse.js";
import { runInit, type InitOptions } from "./init.js";
import {
  applyFiveHourResetFallback,
  readFiveHourResetCache,
  writeFiveHourResetCache,
} from "./quota-cache.js";
import { chooseRoute, ROUTING_POLICY_VERSION, type RouteTask } from "./routing.js";
import { deriveMacroPhase } from "./state-machine.js";
import { StateStoreError, createTaskStateStore } from "./state-store.js";
import type { CliResult } from "./types.js";

export { EXIT_CODES } from "./exit-codes.js";
export { resolveConfig } from "./config.js";
export {
  DEFAULT_CONFIG,
  DEFAULT_SUBSCRIPTION_CONFIG,
  ConfigValidationError,
  explainConfig,
  loadConfigSources,
  validateConfigSource,
  validateSchema,
} from "./config.js";
export { InvocationError, parseInvocation } from "./parse.js";
export { buildRoutingPreview, runInit } from "./init.js";
export { PolicyError, applyPolicy } from "./policy.js";
export {
  STATE_MACHINE,
  TASK_STATUSES,
  StateValidationError,
  HISTORY_LIMIT,
  HISTORY_REFERENCE_LIMIT,
  HISTORY_REFERENCE_TOTAL_CHARS,
  addRoutingDecision,
  compareSnapshot,
  createGateDecision,
  createGuardAttestation,
  createState,
  deriveMacroPhase,
  evaluateCompletionApproval,
  evaluateDiscoveryGuard,
  evaluateHandoffIntent,
  evaluateHandoffReconciliation,
  evaluateVerification,
  evaluatePlanningGuard,
  guardStateFingerprint,
  loadStateV3,
  recordHistoryEvent,
  updateShapeState,
  updateResumeContext,
  transition,
} from "./state.js";
export { GUARD_IDS, MACRO_PHASES, buildStateMachineProjection } from "./state-machine.js";
export {
  LIFECYCLE_METRICS,
  buildBaselineReport,
  createLifecycleMetricEvent,
  createMetricRunId,
  summarizeLifecycleTrace,
  tryCreateLifecycleMetricEvent,
  validateBaselineReport,
} from "./metrics.js";
export { fingerprintFailure, nextCorrectionAction } from "./fingerprint.js";
export {
  DEPENDENCY_NODE_KINDS,
  dependencyClosure,
  validateDependencyGraph,
} from "./shape-dependencies.js";
export { isSourceFingerprintFresh, reconcileShapeFreshness } from "./shape-freshness.js";
export {
  applyDiscoveryEvaluation,
  applyPlanningEvaluation,
  attestContractComplete,
  attestDiscoverySufficient,
  createDecisionEscalation,
  createShapeState,
  evaluateDiscoveryCompleteness,
  evaluateContractCompleteness,
  recordShapeUsage,
  reconcileShapeResume,
  requestPreparationProfileChoice,
  resolveDecisionEscalation,
  resolveShapeBudgetCheckpoint,
  resolveShapeBudgetCheckpointWithRouting,
  selectPreparationProfile,
  validateShapeState,
} from "./shape.js";
export {
  approvePlanProjection,
  detectPlanProjectionDrift,
  reconcilePlanProjection,
  renderPlanProjection,
} from "./shape-projection.js";
export {
  attestIntakeComplete,
  attestIntakeReopened,
  applyInitialIntakeEvaluation,
  applyIntakeResponse,
  createIntakeState,
  evaluateIntakeCompleteness,
  invalidateIntakeDecisions,
  recordInvalidIntakeModelOutput,
  rejectPrematureAdvance,
  routeLateUnknown,
  setDecisionQuestion,
} from "./intake.js";
export {
  BENCHMARK_DIRECTORY,
  BenchmarkStore,
  classifyBenchmarkDeviations,
  createBenchmarkRecord,
  createBenchmarkStore,
  shouldOfferBenchmarkSurvey,
  summarizeBenchmarkRecords,
  tryWriteBenchmarkRecord,
} from "./benchmark.js";
export { decideWorktree } from "./worktree.js";
export { discoverVerificationCommands } from "./commands.js";
export {
  MODEL_COST_MULTIPLIERS,
  MODEL_COST_PROFILES,
  MODEL_IDS,
  APP_SERVER_PROTOCOL_VERSION,
  ROUTING_POLICY_VERSION,
  buildRoutingSnapshot,
  chooseRoute,
  classifyQuotaPressure,
  createUnavailableRoutingSnapshot,
  resolveSubscriptionPlan,
  resolveSubscriptionMultiplier,
  selectFiveHourWindow,
  selectObservedQuotaWindow,
} from "./routing.js";
export {
  applyFiveHourResetFallback,
  readFiveHourResetCache,
  writeFiveHourResetCache,
} from "./quota-cache.js";
export { AppServerClient, AppServerError, captureRoutingSnapshot } from "./app-server.js";
export { ROUTED_STAGES, delegateStage, isDelegableStage } from "./bridge.js";
export {
  STATE_FILENAME,
  StateStoreError,
  TaskStateStore,
  createTaskStateStore,
} from "./state-store.js";

export const HELP_TEXT = `Usage: codex-dev-flow <command|objective>

Commands:
  init
  resume <task-id>
  status [task-id]
  benchmark summary
  config show [--explain]
  config validate [--json]
  --help

Workflow:
  codex-dev-flow <objective>
  codex-dev-flow --benchmark <objective>
`;

export interface RunInvocationOptions {
  configSources?: ConfigSource[];
  init?: InitOptions;
  appServer?: Parameters<typeof captureRoutingSnapshot>[0];
  captureSnapshot?: (
    options: Parameters<typeof captureRoutingSnapshot>[0],
  ) => ReturnType<typeof captureRoutingSnapshot>;
  quotaCachePath?: string | false;
  nowEpochSeconds?: number;
  workspaceRoot?: string;
}

export async function runInvocation(
  argv: string[],
  options: RunInvocationOptions = {},
): Promise<CliResult> {
  const invocation = parseInvocation(argv);
  if (invocation.command === "help") {
    return { command: "help", status: "ok", data: { text: HELP_TEXT } };
  }
  if (invocation.command === "init") return runInit(options.init);
  if (invocation.command === "config_show" || invocation.command === "config_validate") {
    const config = resolveRuntimeConfig(options.configSources);
    return invocation.command === "config_show"
      ? {
          command: invocation.command,
          status: "ok",
          data: invocation.explain ? explainConfig(config) : config.value,
        }
      : { command: invocation.command, status: "valid", data: { valid: true } };
  }
  if (invocation.command === "benchmark_summary") {
    const summary = await createBenchmarkStore(options.workspaceRoot ?? process.cwd()).summary();
    return { command: "benchmark_summary", status: "ok", data: summary };
  }
  if (invocation.command === "status") {
    if (!invocation.taskId)
      return { command: "status", status: "read-only", data: { taskId: undefined } };
    const loaded = await createTaskStateStore(options.workspaceRoot ?? process.cwd()).load(
      invocation.taskId,
    );
    return {
      command: "status",
      status: loaded.status,
      data: {
        taskId: invocation.taskId,
        risk: loaded.risk,
        preparationProfile: loaded.shape?.preparationProfileChoice?.selectedProfile ?? "unselected",
        macroPhase: deriveMacroPhase(loaded),
        benchmarkEnabled: loaded.benchmarkEnabled ?? false,
      },
    };
  }

  const resumedState =
    invocation.command === "resume"
      ? await loadResumeStateIfPresent(options.workspaceRoot ?? process.cwd(), invocation.taskId)
      : undefined;
  const config = resolveRuntimeConfig(options.configSources);
  const capture = options.captureSnapshot ?? captureRoutingSnapshot;
  const subscription = isRecord(config.value.subscription) ? config.value.subscription : {};
  const snapshotResult = await capture({
    ...options.appServer,
    config: {
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
              (model): model is "gpt-5.6-luna" | "gpt-5.6-terra" | "gpt-5.6-sol" =>
                typeof model === "string",
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
    },
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
  const decisions = ROUTING_TASKS.map((task) => chooseRoute(routingSnapshot, task));
  const unavailable = decisions.some(
    (decision) => decision.model === null || decision.effort === null,
  );
  const permissionRequired = snapshotResult.failure?.code === "app_server_permission_denied";
  return {
    command: invocation.command,
    status: permissionRequired
      ? "routing_permission_required"
      : unavailable
        ? "routing_unavailable"
        : snapshotResult.available
          ? "routed"
          : "routed_with_warning",
    data: {
      ...(invocation.command === "run"
        ? { objective: invocation.objective, benchmarkEnabled: invocation.flags.benchmark === true }
        : {
            taskId: invocation.taskId,
            benchmarkEnabled: resumedState?.benchmarkEnabled ?? false,
          }),
      routingSnapshot,
      routingPolicyVersion: ROUTING_POLICY_VERSION,
      routingDecisions: decisions,
      ...(snapshotResult.failure ? { routingFailure: snapshotResult.failure } : {}),
      ...(snapshotResult.error ? { warning: snapshotResult.error } : {}),
    },
  };
}

function appendRoutingWarning(
  snapshot: Awaited<ReturnType<typeof captureRoutingSnapshot>>["snapshot"],
  warning: string,
) {
  return snapshot.warnings.includes(warning)
    ? snapshot
    : { ...snapshot, warnings: [...snapshot.warnings, warning] };
}

function resolveQuotaCachePath(options: RunInvocationOptions): string | undefined {
  if (options.quotaCachePath === false) return undefined;
  if (typeof options.quotaCachePath === "string") return options.quotaCachePath;
  if (options.captureSnapshot) return undefined;
  return resolve(process.cwd(), ".codex", "tasks", "five-hour-quota-reset.json");
}

const ROUTING_TASKS: RouteTask[] = [
  { stage: "discover", risk: "medium", ambiguity: "medium" },
  { stage: "plan", risk: "medium", ambiguity: "medium" },
  { stage: "execute", risk: "medium", ambiguity: "medium" },
  { stage: "debug", risk: "medium", ambiguity: "medium" },
  { stage: "review", risk: "medium", ambiguity: "medium" },
  { stage: "verify", risk: "medium", ambiguity: "medium" },
];

function resolveRuntimeConfig(sources: ConfigSource[] | undefined): ResolvedConfig {
  return resolveConfig(sources ?? loadConfigSources());
}

async function loadResumeStateIfPresent(workspaceRoot: string, taskId: string) {
  try {
    return await createTaskStateStore(workspaceRoot).load(taskId);
  } catch (error) {
    if (error instanceof StateStoreError && error.code === "state_not_found") return undefined;
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function main(argv = process.argv.slice(2)): void {
  void runInvocation(argv).then(
    (result) => {
      if (result.command === "help") process.stdout.write(HELP_TEXT);
      else if (result.command !== "init") process.stdout.write(JSON.stringify(result) + "\n");
    },
    (error: unknown) => {
      const exitCode =
        error instanceof InvocationError || isExitCodeError(error)
          ? error.exitCode
          : EXIT_CODES.INTERNAL_ERROR;
      process.stderr.write((error instanceof Error ? error.message : "Unexpected error.") + "\n");
      process.exitCode = exitCode;
    },
  );
}

function isExitCodeError(error: unknown): error is { exitCode: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "exitCode" in error &&
    typeof error.exitCode === "number"
  );
}

if (import.meta.main) {
  main();
}
