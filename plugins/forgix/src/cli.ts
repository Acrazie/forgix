import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
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
import { InvocationError, parseInvocation, type ParsedInvocation } from "./parse.js";
import { runInit, type InitOptions } from "./init.js";
import {
  ProjectProfileError,
  createProjectProfileStore,
  diffProjectProfiles,
  renderProjectProfile,
  validateLocalProjectProfile,
  validateProjectProfileProjections,
  type ProjectProfileProjection,
} from "./project-profile.js";
import {
  applyFiveHourResetFallback,
  readFiveHourResetCache,
  writeFiveHourResetCache,
} from "./quota-cache.js";
import { chooseRoute, ROUTING_POLICY_VERSION, type RouteTask } from "./routing.js";
import {
  RoadmapError,
  buildWorkItemBranchAndWorktree,
  computeRoadmapCandidateDigest,
  createRoadmapStore,
  deriveFeatureStatus,
  planIdempotentPublication,
  recordPublishedRoadmapBatch,
  renderRoadmapSessionState,
  renderRoadmapVisualSummary,
  selectEligibleWorkItems,
  validateRoadmapState,
  type RoadmapState,
} from "./roadmap.js";
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
export {
  CORE_PROFILE_CATEGORIES,
  OPTIONAL_PROFILE_CATEGORIES,
  LOCAL_PROJECT_PROFILE_IGNORE_ENTRY,
  LOCAL_PROJECT_PROFILE_PATH,
  PROJECT_DIAGRAM_ROOT,
  PROJECT_INIT_STATE_PATH,
  SHARED_PROJECT_PROFILE_PATH,
  ProjectProfileError,
  ProjectProfileStore,
  approveProjectProfile,
  createProjectProfileStore,
  diffProjectProfiles,
  prepareProjectProfile,
  reconcileProjectProfile,
  renderProjectProfile,
  renderProjectInitState,
  validateLocalProjectProfile,
  validateProjectProfileProjections,
  validateProjectProfile,
  validateProjectInitState,
} from "./project-profile.js";
export { PolicyError, applyPolicy } from "./policy.js";
export {
  assuranceSucceeded,
  compileAssuranceContract,
  createAssuranceState,
  planAssuranceExecution,
  recordAssuranceIssue,
  recordCorrectionAttempt,
  resolveAssuranceIssue,
  reviewRequiresEscalation,
  validateConsolidatedReviewResult,
  validateAssuranceContract,
  validateAssuranceState,
} from "./assurance.js";
export {
  applyOwnedMarkdownPatch,
  compileDomainSemanticPatches,
  resolveDomainDestinations,
} from "./domain-projection.js";
export {
  compileDesignState,
  createDesignState,
  designComplete,
  invalidateDesign,
  resolveProductBaseline,
  selectDesignFrontier,
  setActiveDesignQuestion,
  validateDesignState,
} from "./design.js";
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
  evaluateDiscoveryGuard,
  evaluatePlanningGuard,
  guardStateFingerprint,
  loadStateV6,
  completeAssurance,
  invalidateAssurance,
  isTaskTerminal,
  recordAssuranceObservation,
  recordTaskAssuranceIssue,
  recordTaskCorrectionAttempt,
  requestHumanObservation,
  resolveTaskAssuranceIssue,
  updateDesignState,
  recordHistoryEvent,
  updateShapeState,
  updateResumeContext,
  transition,
} from "./state.js";
export {
  evaluateAutonomousGateEligibility,
  parseGateIntent,
  preflightGate,
  renderGateCard,
  renderGateContract,
} from "./gate.js";
export {
  DEFAULT_PRODUCT_VISION_PATH,
  DEFAULT_WORKTREE_BASE_BRANCH,
  DEFAULT_WORKTREE_ROOT,
  ROADMAP_IGNORE_ENTRY,
  ROADMAP_STATE_PATH,
  RoadmapError,
  RoadmapStore,
  buildWorkItemBranchAndWorktree,
  computeRoadmapCandidateDigest,
  createRoadmapStore,
  deriveFeatureStatus,
  detectDependencyCycles,
  planIdempotentPublication,
  recordPublishedRoadmapBatch,
  renderRoadmapSessionState,
  renderRoadmapVisualSummary,
  selectEligibleWorkItems,
  validateRoadmapState,
  type RoadmapBoardStatus,
  type RoadmapPublishRecordPatch,
  type RoadmapState,
  type RoadmapWorkItem,
} from "./roadmap.js";
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
  createTechnicalDecision,
  createShapeState,
  evaluateDiscoveryCompleteness,
  evaluateContractCompleteness,
  recordShapeUsage,
  reconcileShapeResume,
  requestPreparationProfileChoice,
  resolveTechnicalDecision,
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
  setIntakeQuestionProjection,
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
export { discoverAssuranceCommands } from "./commands.js";
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

export const HELP_TEXT = `Usage: forgix <command|objective>

Commands:
  init
  resume <task-id>
  status [task-id]
  benchmark summary
  config show [--explain]
  config validate [--json]
  project-profile inspect
  project-profile view [--local]
  project-profile validate [--local]
  project-profile publish [--local]
  project-profile session-view|session-save|session-clear
  roadmap session-view [--format=tree|mermaid]
  roadmap session-save|session-clear
  roadmap validate [--session]
  roadmap publish-plan|publish-record
  roadmap select-ready [--limit=N] [--max-risk=low|medium|all] [--require-issue]
  --help

Workflow:
  forgix <objective>
  forgix --benchmark <objective>
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
  projectProfile?: ProjectProfileCommandOptions;
  roadmap?: ProjectProfileCommandOptions;
}

export interface ProjectProfileCommandOptions {
  input?: string;
  approvedAt?: string;
  readInput?: () => Promise<string>;
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
  if (isProjectProfileInvocation(invocation)) {
    return runProjectProfileInvocation(invocation, options);
  }
  if (isRoadmapInvocation(invocation)) {
    return runRoadmapInvocation(invocation, options);
  }
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

async function runProjectProfileInvocation(
  invocation: ProjectProfileInvocation,
  options: RunInvocationOptions,
): Promise<CliResult> {
  const store = createProjectProfileStore(options.workspaceRoot ?? process.cwd());
  if (invocation.command === "project_profile_session_view") {
    return {
      command: invocation.command,
      status: "ok",
      data: { state: (await store.loadInitState(true)) ?? null },
    };
  }
  if (invocation.command === "project_profile_session_clear") {
    return {
      command: invocation.command,
      status: "ok",
      data: { cleared: await store.clearInitState() },
    };
  }
  if (invocation.command === "project_profile_session_save") {
    const raw = await readProjectProfileInput(options.projectProfile);
    const state = await store.saveInitState(parseStructuredInput(raw));
    return {
      command: invocation.command,
      status: "saved",
      data: { state },
    };
  }
  if (invocation.command === "project_profile_inspect") {
    const shared = await store.loadShared(true);
    const local = await store.loadLocal(true);
    return {
      command: invocation.command,
      status: "ok",
      data: {
        shared: shared ?? null,
        local: local ?? null,
        localIgnored: await store.isLocalIgnored(),
      },
    };
  }
  if (invocation.command === "project_profile_view") {
    const profile = invocation.local ? await store.loadLocal(false) : await store.loadShared(false);
    return {
      command: invocation.command,
      status: "ok",
      data: { local: invocation.local, yaml: renderProjectProfile(profile!) },
    };
  }
  const raw = await readProjectProfileInput(options.projectProfile);
  const parsed = parseProjectProfileInput(raw);
  if (invocation.local) {
    if (parsed.projections.length) {
      throw new InvocationError("Local project profile cannot publish shared projections.");
    }
    const local = validateLocalProjectProfile(parsed.profile, await store.loadShared(true));
    if (invocation.command === "project_profile_publish") await store.publishLocal(local);
    return {
      command: invocation.command,
      status: invocation.command === "project_profile_publish" ? "published" : "valid",
      data: {
        local: true,
        path: store.localPath,
        yaml: renderProjectProfile(local),
      },
    };
  }
  const proposal = await store.prepareShared(parsed.profile);
  const projections = validateProjectProfileProjections(proposal, parsed.projections);
  const previous = await store.loadShared(true);
  if (invocation.command === "project_profile_validate") {
    return {
      command: invocation.command,
      status: "valid",
      data: {
        local: false,
        path: store.sharedPath,
        contentDigest: proposal.contentDigest,
        revision: proposal.revision,
        diff: diffProjectProfiles(previous, proposal),
        yaml: renderProjectProfile(proposal),
        projectionPaths: projections.map(({ path }) => path),
      },
    };
  }
  const initState = await store.loadInitState(true);
  if (
    initState &&
    (initState.status !== "awaiting_approval" ||
      initState.candidateContentDigest !== proposal.contentDigest)
  ) {
    throw new ProjectProfileError(
      "profile_session_conflict",
      "Project INIT session is not awaiting approval for this exact content digest.",
    );
  }
  const published = await store.publishShared(proposal, {
    projections,
    ...(options.projectProfile?.approvedAt
      ? { approvedAt: options.projectProfile.approvedAt }
      : {}),
  });
  return {
    command: invocation.command,
    status: "published",
    data: {
      local: false,
      path: store.sharedPath,
      profileId: published.profileId,
      revision: published.revision,
      contentDigest: published.contentDigest,
      approval: published.approval,
    },
  };
}

async function readProjectProfileInput(options: ProjectProfileCommandOptions | undefined) {
  return readStructuredTextInput(
    "project-profile validate/publish requires YAML or JSON on stdin.",
    options,
  );
}

async function readStructuredTextInput(
  emptyMessage: string,
  options: ProjectProfileCommandOptions | undefined,
): Promise<string> {
  const maximumBytes = 2_000_000;
  if (options?.input !== undefined) {
    if (Buffer.byteLength(options.input) > maximumBytes) {
      throw new InvocationError(`Structured input exceeds ${maximumBytes} bytes.`);
    }
    return options.input;
  }
  if (options?.readInput) {
    const input = await options.readInput();
    if (Buffer.byteLength(input) > maximumBytes) {
      throw new InvocationError(`Structured input exceeds ${maximumBytes} bytes.`);
    }
    return input;
  }
  if (process.stdin.isTTY) {
    throw new InvocationError(emptyMessage);
  }
  let source = "";
  for await (const chunk of process.stdin) {
    source += String(chunk);
    if (Buffer.byteLength(source) > maximumBytes) {
      throw new InvocationError(`Structured input exceeds ${maximumBytes} bytes.`);
    }
  }
  if (!source.trim()) {
    throw new InvocationError(emptyMessage);
  }
  return source;
}

function parseProjectProfileInput(source: string): {
  profile: unknown;
  projections: ProjectProfileProjection[];
} {
  const parsed = parseStructuredInput(source);
  if (isRecord(parsed) && "profile" in parsed) {
    const allowed = new Set(["profile", "projections"]);
    if (Object.keys(parsed).some((key) => !allowed.has(key))) {
      throw new InvocationError("Project profile transaction contains unsupported fields.");
    }
    if (parsed.projections !== undefined && !Array.isArray(parsed.projections)) {
      throw new InvocationError("Project profile projections are invalid.");
    }
    const projections = parsed.projections ?? [];
    if (
      projections.some(
        (entry) =>
          !isRecord(entry) || typeof entry.path !== "string" || typeof entry.content !== "string",
      )
    ) {
      throw new InvocationError("Project profile projections are invalid.");
    }
    return { profile: parsed.profile, projections: projections as ProjectProfileProjection[] };
  }
  return { profile: parsed, projections: [] };
}

function parseStructuredInput(source: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    try {
      return parseYaml(source);
    } catch {
      throw new InvocationError("Project profile input is not valid YAML or JSON.");
    }
  }
}

type ProjectProfileInvocation = Extract<ParsedInvocation, { command: `project_profile_${string}` }>;
type RoadmapInvocation = Extract<ParsedInvocation, { command: `roadmap_${string}` }>;

function isProjectProfileInvocation(value: ParsedInvocation): value is ProjectProfileInvocation {
  return value.command.startsWith("project_profile_");
}

function isRoadmapInvocation(value: ParsedInvocation): value is RoadmapInvocation {
  return value.command.startsWith("roadmap_");
}

async function runRoadmapInvocation(
  invocation: RoadmapInvocation,
  options: RunInvocationOptions,
): Promise<CliResult> {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const store = createRoadmapStore(workspaceRoot);
  const gitignored = store.isGitignored();

  if (invocation.command === "roadmap_session_clear") {
    return {
      command: invocation.command,
      status: "ok",
      data: { cleared: await store.clear() },
    };
  }

  if (invocation.command === "roadmap_session_view") {
    let state: RoadmapState | null = null;
    try {
      state = await store.load();
    } catch (error) {
      if (!(error instanceof RoadmapError && error.code === "roadmap_not_found")) {
        throw error;
      }
    }
    return {
      command: invocation.command,
      status: "ok",
      data: state
        ? {
            state,
            gitignored,
            candidateDigest: computeRoadmapCandidateDigest(state),
            summary: renderRoadmapSessionState(state, { gitignored }),
            visual: renderRoadmapVisualSummary(state, invocation.format),
          }
        : { state: null, gitignored },
    };
  }

  if (invocation.command === "roadmap_session_save") {
    const raw = await readStructuredTextInput(
      "roadmap session-save requires YAML or JSON on stdin.",
      options.roadmap,
    );
    const parsed = parseStructuredInput(raw);
    const state = await store.save(parsed);
    return {
      command: invocation.command,
      status: "saved",
      data: {
        state,
        gitignored,
        candidateDigest: computeRoadmapCandidateDigest(state),
        summary: renderRoadmapSessionState(state, { gitignored }),
        visual: renderRoadmapVisualSummary(state),
      },
    };
  }

  if (invocation.command === "roadmap_validate") {
    const rawState = invocation.session
      ? await store.load()
      : parseStructuredInput(
          await readStructuredTextInput(
            "roadmap validate requires YAML or JSON on stdin unless --session is passed.",
            options.roadmap,
          ),
        );
    const state = validateRoadmapState(rawState);
    return {
      command: invocation.command,
      status: "valid",
      data: {
        state,
        candidateDigest: computeRoadmapCandidateDigest(state),
        visual: renderRoadmapVisualSummary(state),
      },
    };
  }

  if (invocation.command === "roadmap_publish_plan") {
    const state = options.roadmap?.input
      ? validateRoadmapState(parseStructuredInput(options.roadmap.input))
      : await store.load();
    return {
      command: invocation.command,
      status: "ok",
      data: { plan: planIdempotentPublication(state) },
    };
  }

  if (invocation.command === "roadmap_publish_record") {
    const raw = await readStructuredTextInput(
      "roadmap publish-record requires a JSON or YAML patch on stdin.",
      options.roadmap,
    );
    const patch = parseStructuredInput(raw);
    if (!isRecord(patch)) {
      throw new InvocationError("Roadmap publish-record payload must be a YAML or JSON object.");
    }
    const existing = await store.load();
    const updated = recordPublishedRoadmapBatch(existing, patch);
    await store.save(updated);
    return {
      command: invocation.command,
      status: "saved",
      data: {
        state: updated,
        publication: updated.publication,
      },
    };
  }

  const state = options.roadmap?.input
    ? validateRoadmapState(parseStructuredInput(options.roadmap.input))
    : await store.load();
  const selection = selectEligibleWorkItems(state.workItems, {
    ...(invocation.limit !== undefined ? { limit: invocation.limit } : {}),
    ...(invocation.maxRisk !== undefined ? { maxRisk: invocation.maxRisk } : {}),
    requireIssueNumber: invocation.requireIssueNumber,
  });
  const eligible = selection.eligible.map((item) => ({
    workItem: item,
    workspace: buildWorkItemBranchAndWorktree(item),
    featureStatusAfterStart: deriveFeatureStatus(
      state.workItems
        .filter((candidate) => candidate.featureId === item.featureId)
        .map((candidate) => {
          if (candidate.id === item.id) {
            return { status: "In Progress" as const };
          }
          const projection: {
            status?: RoadmapState["workItems"][number]["status"];
            initialStatus?: RoadmapState["workItems"][number]["initialStatus"];
          } = {};
          if (candidate.status !== undefined) projection.status = candidate.status;
          if (candidate.initialStatus !== undefined)
            projection.initialStatus = candidate.initialStatus;
          return projection;
        }),
    ),
  }));
  return {
    command: invocation.command,
    status: "ok",
    data: { eligible, skipped: selection.skipped },
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
  { stage: "design", risk: "medium", ambiguity: "medium" },
  { stage: "discover", risk: "medium", ambiguity: "medium" },
  { stage: "plan", risk: "medium", ambiguity: "medium" },
  { stage: "debug", risk: "medium", ambiguity: "medium" },
  { stage: "review", risk: "medium", ambiguity: "medium" },
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
