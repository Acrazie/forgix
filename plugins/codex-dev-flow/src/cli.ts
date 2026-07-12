import { pathToFileURL } from "node:url";
import { captureRoutingSnapshot } from "./app-server.js";
import { explainConfig, loadConfigSources, resolveConfig, type ConfigSource, type ResolvedConfig } from "./config.js";
import { EXIT_CODES } from "./exit-codes.js";
import { InvocationError, parseInvocation } from "./parse.js";
import { chooseRoute, type RouteTask } from "./routing.js";
import type { CliResult, TaskMode } from "./types.js";

export { EXIT_CODES } from "./exit-codes.js";
export { resolveConfig } from "./config.js";
export { DEFAULT_CONFIG, DEFAULT_SUBSCRIPTION_CONFIG, ConfigValidationError, explainConfig, loadConfigSources, validateConfigSource, validateSchema } from "./config.js";
export { InvocationError, parseInvocation } from "./parse.js";
export { PolicyError, applyPolicy } from "./policy.js";
export { addRoutingDecision, compareSnapshot, createState, transition } from "./state.js";
export { fingerprintFailure, nextCorrectionAction } from "./fingerprint.js";
export { decideWorktree } from "./worktree.js";
export { discoverVerificationCommands } from "./commands.js";
export {
  MODEL_COST_MULTIPLIERS,
  MODEL_COST_PROFILES,
  MODEL_IDS,
  APP_SERVER_PROTOCOL_VERSION,
  buildRoutingSnapshot,
  chooseRoute,
  classifyQuotaPressure,
  createUnavailableRoutingSnapshot,
  resolveSubscriptionPlan,
  resolveSubscriptionMultiplier,
  selectFiveHourWindow
} from "./routing.js";
export { AppServerClient, AppServerError, captureRoutingSnapshot } from "./app-server.js";
export { ROUTED_STAGES, delegateStage, isDelegableStage } from "./bridge.js";

export interface RunInvocationOptions {
  configSources?: ConfigSource[];
  appServer?: Parameters<typeof captureRoutingSnapshot>[0];
  captureSnapshot?: (options: Parameters<typeof captureRoutingSnapshot>[0]) => ReturnType<typeof captureRoutingSnapshot>;
}

export async function runInvocation(argv: string[], options: RunInvocationOptions = {}): Promise<CliResult> {
  const invocation = parseInvocation(argv);
  if (invocation.command === "config_show" || invocation.command === "config_validate") {
    const config = resolveRuntimeConfig(options.configSources);
    return invocation.command === "config_show"
      ? { command: invocation.command, status: "ok", data: invocation.explain ? explainConfig(config) : config.value }
      : { command: invocation.command, status: "valid", data: { valid: true } };
  }
  if (invocation.command === "status") return { command: "status", status: "read-only", data: { taskId: invocation.taskId } };

  const config = resolveRuntimeConfig(options.configSources);
  const capture = options.captureSnapshot ?? captureRoutingSnapshot;
  const subscription = isRecord(config.value.subscription) ? config.value.subscription : {};
  const snapshotResult = await capture({
    ...(options.appServer ?? {}),
    config: {
      plan: typeof subscription.plan === "string" ? subscription.plan : "auto",
      ...(typeof subscription.planOverride === "string" ? { planOverride: subscription.planOverride } : {}),
      ...(typeof subscription.multiplierOverride === "number" ? { multiplierOverride: subscription.multiplierOverride } : {}),
      ...(Array.isArray(subscription.modelAllowlist) ? { modelAllowlist: subscription.modelAllowlist.filter((model): model is "gpt-5.6-luna" | "gpt-5.6-terra" | "gpt-5.6-sol" => typeof model === "string") } : {}),
      ...(isRecord(subscription.quota) ? {
        quota: {
          ...(typeof subscription.quota.warningPercent === "number" ? { warningPercent: subscription.quota.warningPercent } : {}),
          ...(typeof subscription.quota.criticalPercent === "number" ? { criticalPercent: subscription.quota.criticalPercent } : {})
        }
      } : {})
    }
  });
  const mode: TaskMode | undefined = invocation.command === "run" ? invocation.mode : undefined;
  const decisions = ROUTING_TASKS.map((task) => chooseRoute(snapshotResult.snapshot, { ...task, critical: mode === "critical" }));
  return {
    command: invocation.command,
    status: snapshotResult.available ? "routed" : "routed_with_warning",
    data: {
      ...(invocation.command === "run" ? { mode, objective: invocation.objective } : { taskId: invocation.taskId }),
      routingSnapshot: snapshotResult.snapshot,
      routingDecisions: decisions,
      ...(snapshotResult.error ? { warning: snapshotResult.error } : {})
    }
  };
}

const ROUTING_TASKS: RouteTask[] = [
  { stage: "discover", risk: "low", ambiguity: "low" },
  { stage: "plan", risk: "medium", ambiguity: "medium" },
  { stage: "debug", risk: "high", ambiguity: "high" },
  { stage: "review", risk: "high", ambiguity: "medium" },
  { stage: "verify", risk: "medium", ambiguity: "low" }
];

function resolveRuntimeConfig(sources: ConfigSource[] | undefined): ResolvedConfig {
  return resolveConfig(sources ?? loadConfigSources());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function main(argv = process.argv.slice(2)): void {
  void runInvocation(argv).then(
    (result) => process.stdout.write(JSON.stringify(result) + "\n"),
    (error: unknown) => {
      const exitCode = error instanceof InvocationError || isExitCodeError(error) ? error.exitCode : EXIT_CODES.INTERNAL_ERROR;
      process.stderr.write((error instanceof Error ? error.message : "Unexpected error.") + "\n");
      process.exitCode = exitCode;
    }
  );
}

function isExitCodeError(error: unknown): error is { exitCode: number } {
  return typeof error === "object" && error !== null && "exitCode" in error && typeof error.exitCode === "number";
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
