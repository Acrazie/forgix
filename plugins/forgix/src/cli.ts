import { parse as parseYaml } from "yaml";
import * as configModule from "./core/config.js";
import * as digestModule from "./core/digest.js";
import * as routingModule from "./core/routing.js";
import * as schemaModule from "./core/schema.js";
import * as storeModule from "./core/store.js";
import * as profileModule from "./profile/index.js";
import * as roadmapModule from "./roadmap/index.js";
import * as taskModule from "./task/index.js";
import { HARNESS_IDS, type CliResult, type HarnessPreference, type TaskState } from "./types.js";

export * from "./types.js";
export {
  configModule as config,
  digestModule as digest,
  profileModule as profile,
  roadmapModule as roadmap,
  routingModule as routing,
  schemaModule as schema,
  storeModule as store,
  taskModule as task,
};

const { applyPolicy, explainConfig, loadConfigSources, resolveConfig, runInit } = configModule;
const { resolveRoutingReport } = routingModule;
const { EXIT_CODES, InvocationError, StateStoreError } = schemaModule;
const {
  createProjectProfileStore,
  diffProjectProfiles,
  reconcileProjectProfile,
  renderProjectInitState,
  renderProjectProfile,
  validateLocalProjectProfile,
  validateProjectProfileProjections,
} = profileModule;
const {
  RoadmapError,
  computeRoadmapCandidateDigest,
  createRoadmapStore,
  planIdempotentPublication,
  recordPublishedRoadmapBatch,
  renderRoadmapSessionState,
  renderRoadmapVisualSummary,
  selectReadyWorkItems,
  validateRoadmapState,
} = roadmapModule;
const { createTaskStateStore, deriveMacroPhase, renderGateContract, validateTaskState } =
  taskModule;

type ConfigSource = configModule.ConfigSource;
type InitOptions = configModule.InitOptions;
type PolicyInput = configModule.PolicyInput;
type ResolvedConfig = configModule.ResolvedConfig;
type AppServerOptions = routingModule.AppServerOptions;
type CapturedRoutingSnapshot = routingModule.CapturedRoutingSnapshot;
type ProjectProfileProjection = profileModule.ProjectProfileProjection;
type RoadmapState = roadmapModule.RoadmapState;
type RoadmapVisualFormat = roadmapModule.RoadmapVisualFormat;
type GateDecisionInput = taskModule.GateDecisionInput;

const MAX_STRUCTURED_INPUT_BYTES = 2_000_000;
const VALID_HARNESS_VALUES = new Set<string>(["auto", ...HARNESS_IDS]);

const KNOWN_SUBCOMMANDS = new Set([
  "--help",
  "init",
  "resume",
  "status",
  "config",
  "task",
  "project-profile",
  "roadmap",
]);

export const HELP_TEXT = `Usage: forgix [--harness auto|codex|claude|antigravity] <command|objective>

Commands:
  --help
  init
  config show [--explain]
  config validate [--json]
  status [task-id]
  resume <task-id>
  task validate [task-id]
  task save <task-id>
  task gate <task-id> [--view | --approve | --reject | --change=<instruction> | --autonomous [--issue=<ref>]]
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
  <objective>
`;

export type TaskGateAction = "view" | "approve" | "reject" | "change" | "autonomous";

export type ParsedInvocation =
  | { command: "help"; harness?: HarnessPreference }
  | { command: "init"; harness?: HarnessPreference }
  | { command: "run"; objective: string; harness?: HarnessPreference }
  | { command: "resume"; taskId: string; harness?: HarnessPreference }
  | { command: "status"; taskId: string | undefined; harness?: HarnessPreference }
  | { command: "config_show"; explain: boolean; harness?: HarnessPreference }
  | { command: "config_validate"; json: boolean; harness?: HarnessPreference }
  | { command: "task_validate"; taskId?: string; harness?: HarnessPreference }
  | { command: "task_save"; taskId: string; harness?: HarnessPreference }
  | {
      command: "task_gate";
      taskId: string;
      action: TaskGateAction;
      instruction?: string;
      issueRef?: string;
      harness?: HarnessPreference;
    }
  | {
      command:
        | "project_profile_inspect"
        | "project_profile_view"
        | "project_profile_validate"
        | "project_profile_publish";
      local: boolean;
      harness?: HarnessPreference;
    }
  | { command: "project_profile_session_view"; harness?: HarnessPreference }
  | { command: "project_profile_session_save"; harness?: HarnessPreference }
  | { command: "project_profile_session_clear"; harness?: HarnessPreference }
  | { command: "roadmap_session_view"; format?: RoadmapVisualFormat; harness?: HarnessPreference }
  | { command: "roadmap_session_save"; harness?: HarnessPreference }
  | { command: "roadmap_session_clear"; harness?: HarnessPreference }
  | { command: "roadmap_validate"; session: boolean; harness?: HarnessPreference }
  | { command: "roadmap_publish_plan"; harness?: HarnessPreference }
  | { command: "roadmap_publish_record"; harness?: HarnessPreference }
  | {
      command: "roadmap_select_ready";
      limit?: number;
      maxRisk?: "low" | "medium" | "all";
      requireIssueNumber: boolean;
      harness?: HarnessPreference;
    };

export interface StructuredInputOptions {
  input?: string;
  readInput?: () => Promise<string>;
}

export interface TaskCommandOptions extends StructuredInputOptions {
  expectedRevision?: number;
  decidedAt?: string;
}

export interface ProjectProfileCommandOptions extends StructuredInputOptions {
  approvedAt?: string;
  observedFingerprints?: Record<string, string>;
}

export interface RoadmapCommandOptions extends StructuredInputOptions {
  now?: string;
  baseBranch?: string;
  worktreeRoot?: string;
}

export interface RunInvocationOptions {
  cwd?: string;
  home?: string;
  workspaceRoot?: string;
  configSources?: ConfigSource[];
  policy?: PolicyInput;
  captureSnapshot?: (options?: AppServerOptions) => Promise<CapturedRoutingSnapshot>;
  appServer?: AppServerOptions;
  quotaCachePath?: string | false;
  nowEpochSeconds?: number;
  init?: InitOptions;
  task?: TaskCommandOptions;
  projectProfile?: ProjectProfileCommandOptions;
  roadmap?: RoadmapCommandOptions;
  env?: NodeJS.ProcessEnv;
  entrypointPath?: string;
}

function invalid(message: string): never {
  throw new InvocationError(message);
}

function parseHarnessValue(value: string | undefined): HarnessPreference {
  if (!value || !VALID_HARNESS_VALUES.has(value)) {
    invalid(`Invalid --harness value. Expected one of: auto, ${HARNESS_IDS.join(", ")}.`);
  }
  return value as HarnessPreference;
}

function extractLeadingHarness(argv: readonly string[]): {
  harness?: HarnessPreference;
  remaining: string[];
} {
  let harness: HarnessPreference | undefined;
  let index = 0;
  while (index < argv.length) {
    const token = argv[index];
    if (token === "--harness") {
      if (harness !== undefined) invalid("Duplicate --harness flag.");
      harness = parseHarnessValue(argv[index + 1]);
      index += 2;
      continue;
    }
    if (token?.startsWith("--harness=")) {
      if (harness !== undefined) invalid("Duplicate --harness flag.");
      harness = parseHarnessValue(token.slice("--harness=".length));
      index += 1;
      continue;
    }
    break;
  }
  return {
    ...(harness ? { harness } : {}),
    remaining: argv.slice(index),
  };
}

function extractTrailingHarness(
  args: readonly string[],
  initialHarness: HarnessPreference | undefined,
): { harness?: HarnessPreference; rest: string[] } {
  let harness = initialHarness;
  const rest: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (token === "--harness") {
      if (harness !== undefined) invalid("Duplicate --harness flag.");
      harness = parseHarnessValue(args[index + 1]);
      index += 1;
      continue;
    }
    if (token.startsWith("--harness=")) {
      if (harness !== undefined) invalid("Duplicate --harness flag.");
      harness = parseHarnessValue(token.slice("--harness=".length));
      continue;
    }
    rest.push(token);
  }
  return { ...(harness ? { harness } : {}), rest };
}

function parseTaskInvocation(
  rest: readonly string[],
  harnessField: { harness?: HarnessPreference },
): ParsedInvocation {
  const [subcommand, ...args] = rest;
  if (subcommand === "validate") {
    if (args.length === 0) return { command: "task_validate", ...harnessField };
    const taskId = args[0];
    if (args.length === 1 && taskId && !taskId.startsWith("--")) {
      return { command: "task_validate", taskId, ...harnessField };
    }
    invalid("Invalid task validate invocation.");
  }
  if (subcommand === "save") {
    const taskId = args[0];
    if (args.length === 1 && taskId && !taskId.startsWith("--")) {
      return { command: "task_save", taskId, ...harnessField };
    }
    invalid("task save requires exactly one task id.");
  }
  if (subcommand === "gate") {
    const [taskId, ...flags] = args;
    if (!taskId || taskId.startsWith("--")) {
      invalid("task gate requires a task id.");
    }
    let action: TaskGateAction | undefined;
    let instruction: string | undefined;
    let issueRef: string | undefined;
    const setAction = (next: TaskGateAction): void => {
      if (action !== undefined) invalid("task gate accepts at most one decision flag.");
      action = next;
    };
    for (const flag of flags) {
      if (flag === "--view") setAction("view");
      else if (flag === "--approve") setAction("approve");
      else if (flag === "--reject") setAction("reject");
      else if (flag === "--autonomous") setAction("autonomous");
      else if (flag.startsWith("--change=")) {
        setAction("change");
        const value = flag.slice("--change=".length).trim();
        if (!value) invalid("task gate --change requires a non-empty instruction.");
        instruction = value;
      } else if (flag.startsWith("--issue=")) {
        if (issueRef !== undefined) invalid("Duplicate --issue flag.");
        const value = flag.slice("--issue=".length).trim();
        if (!value) invalid("task gate --issue requires a non-empty reference.");
        issueRef = value;
      } else {
        invalid("Invalid task gate flag.");
      }
    }
    const resolvedAction = action ?? "view";
    if (issueRef !== undefined && resolvedAction !== "autonomous") {
      invalid("task gate --issue is only valid with --autonomous.");
    }
    return {
      command: "task_gate",
      taskId,
      action: resolvedAction,
      ...(instruction !== undefined ? { instruction } : {}),
      ...(issueRef !== undefined ? { issueRef } : {}),
      ...harnessField,
    };
  }
  throw new InvocationError("Invalid task invocation.");
}

function parseProjectProfileInvocation(
  rest: readonly string[],
  harnessField: { harness?: HarnessPreference },
): ParsedInvocation {
  const [subcommand, ...flags] = rest;
  const local = flags.length === 1 && flags[0] === "--local";
  if (flags.length !== 0 && !local) invalid("Invalid project-profile invocation.");
  if (subcommand === "inspect" && flags.length === 0) {
    return { command: "project_profile_inspect", local: false, ...harnessField };
  }
  if (subcommand === "view") return { command: "project_profile_view", local, ...harnessField };
  if (subcommand === "validate") {
    return { command: "project_profile_validate", local, ...harnessField };
  }
  if (subcommand === "publish") {
    return { command: "project_profile_publish", local, ...harnessField };
  }
  if (subcommand === "session-view" && flags.length === 0) {
    return { command: "project_profile_session_view", ...harnessField };
  }
  if (subcommand === "session-save" && flags.length === 0) {
    return { command: "project_profile_session_save", ...harnessField };
  }
  if (subcommand === "session-clear" && flags.length === 0) {
    return { command: "project_profile_session_clear", ...harnessField };
  }
  throw new InvocationError("Invalid project-profile invocation.");
}

function parseRoadmapInvocation(
  rest: readonly string[],
  harnessField: { harness?: HarnessPreference },
): ParsedInvocation {
  const [subcommand, ...flags] = rest;
  if (subcommand === "session-view") {
    let format: RoadmapVisualFormat | undefined;
    for (const flag of flags) {
      if (flag === "--format=tree" || flag === "--tree") format = "tree";
      else if (flag === "--format=mermaid" || flag === "--mermaid") format = "mermaid";
      else invalid("Invalid roadmap session-view flag.");
    }
    return format
      ? { command: "roadmap_session_view", format, ...harnessField }
      : { command: "roadmap_session_view", ...harnessField };
  }
  if (subcommand === "session-save" && flags.length === 0) {
    return { command: "roadmap_session_save", ...harnessField };
  }
  if (subcommand === "session-clear" && flags.length === 0) {
    return { command: "roadmap_session_clear", ...harnessField };
  }
  if (subcommand === "validate") {
    if (flags.length === 0) return { command: "roadmap_validate", session: false, ...harnessField };
    if (flags.length === 1 && flags[0] === "--session") {
      return { command: "roadmap_validate", session: true, ...harnessField };
    }
    invalid("Invalid roadmap validate flag.");
  }
  if (subcommand === "publish-plan" && flags.length === 0) {
    return { command: "roadmap_publish_plan", ...harnessField };
  }
  if (subcommand === "publish-record" && flags.length === 0) {
    return { command: "roadmap_publish_record", ...harnessField };
  }
  if (subcommand === "select-ready") {
    let limit: number | undefined;
    let maxRisk: "low" | "medium" | "all" | undefined;
    let requireIssueNumber = false;
    for (const flag of flags) {
      if (flag.startsWith("--limit=")) {
        const parsed = Number(flag.slice("--limit=".length));
        if (!Number.isInteger(parsed) || parsed < 1) invalid("Invalid --limit value.");
        limit = parsed;
      } else if (
        flag === "--max-risk=low" ||
        flag === "--max-risk=medium" ||
        flag === "--max-risk=all"
      ) {
        maxRisk = flag.slice("--max-risk=".length) as "low" | "medium" | "all";
      } else if (flag === "--require-issue") {
        requireIssueNumber = true;
      } else {
        invalid("Invalid roadmap select-ready flag.");
      }
    }
    return {
      command: "roadmap_select_ready",
      ...(limit !== undefined ? { limit } : {}),
      ...(maxRisk !== undefined ? { maxRisk } : {}),
      requireIssueNumber,
      ...harnessField,
    };
  }
  throw new InvocationError("Invalid roadmap invocation.");
}

export function parseInvocation(argv: string[]): ParsedInvocation {
  if (argv.length === 0) invalid("An objective or subcommand is required.");

  const leading = extractLeadingHarness(argv);
  const tokens = leading.remaining;
  const first = tokens[0];
  if (!first) invalid("An objective or subcommand is required.");

  if (KNOWN_SUBCOMMANDS.has(first)) {
    const extracted = extractTrailingHarness(tokens.slice(1), leading.harness);
    const rest = extracted.rest;
    const harnessField = extracted.harness ? { harness: extracted.harness } : {};

    if (first === "--help") {
      if (rest.length !== 0) invalid("help accepts no arguments.");
      return { command: "help", ...harnessField };
    }
    if (first === "init") {
      if (rest.length !== 0) invalid("init accepts no arguments.");
      return { command: "init", ...harnessField };
    }
    if (first === "resume") {
      const taskId = rest[0];
      if (rest.length !== 1 || !taskId || taskId.startsWith("--")) {
        invalid("resume requires exactly one task id.");
      }
      return { command: "resume", taskId, ...harnessField };
    }
    if (first === "status") {
      if (rest.length === 0) return { command: "status", taskId: undefined, ...harnessField };
      const taskId = rest[0];
      if (rest.length === 1 && taskId && !taskId.startsWith("--")) {
        return { command: "status", taskId, ...harnessField };
      }
      invalid("status accepts at most one task id.");
    }
    if (first === "config") {
      const [subcommand, ...flags] = rest;
      if (
        subcommand === "show" &&
        (flags.length === 0 || (flags.length === 1 && flags[0] === "--explain"))
      ) {
        return { command: "config_show", explain: flags[0] === "--explain", ...harnessField };
      }
      if (
        subcommand === "validate" &&
        (flags.length === 0 || (flags.length === 1 && flags[0] === "--json"))
      ) {
        return { command: "config_validate", json: flags[0] === "--json", ...harnessField };
      }
      invalid("Invalid config invocation.");
    }
    if (first === "task") return parseTaskInvocation(rest, harnessField);
    if (first === "project-profile") return parseProjectProfileInvocation(rest, harnessField);
    if (first === "roadmap") return parseRoadmapInvocation(rest, harnessField);
  }

  if (tokens.some((part) => part.startsWith("--"))) {
    invalid("A run requires an objective and no unsupported flags.");
  }
  return {
    command: "run",
    objective: tokens.join(" "),
    ...(leading.harness ? { harness: leading.harness } : {}),
  };
}

export async function runInvocation(
  argv: string[],
  options: RunInvocationOptions = {},
): Promise<CliResult> {
  const invocation = parseInvocation(argv);
  const workspaceRoot = options.workspaceRoot ?? options.cwd ?? process.cwd();

  if (invocation.command === "help") {
    return { command: "help", status: "ok", data: { text: HELP_TEXT } };
  }
  if (invocation.command === "init") {
    return runInit({
      cwd: workspaceRoot,
      ...(options.home !== undefined ? { home: options.home } : {}),
      ...options.init,
    });
  }
  if (invocation.command === "config_show" || invocation.command === "config_validate") {
    const resolved = resolveRuntimeConfig(options, invocation.harness, workspaceRoot);
    return invocation.command === "config_show"
      ? {
          command: invocation.command,
          status: "ok",
          data: invocation.explain ? explainConfig(resolved) : resolved.value,
        }
      : { command: invocation.command, status: "valid", data: { valid: true } };
  }
  if (invocation.command === "status") {
    if (!invocation.taskId) {
      return { command: "status", status: "read-only", data: { taskId: undefined } };
    }
    const loaded = await createTaskStateStore(workspaceRoot).load(invocation.taskId);
    return {
      command: "status",
      status: loaded.status,
      data: {
        taskId: invocation.taskId,
        risk: loaded.risk,
        revision: loaded.revision,
        preparationProfile: loaded.shape?.preparationProfileChoice?.selectedProfile ?? "unselected",
        macroPhase: deriveMacroPhase(loaded),
        contractDigest: loaded.contractDigest ?? null,
      },
    };
  }
  if (
    invocation.command === "task_validate" ||
    invocation.command === "task_save" ||
    invocation.command === "task_gate"
  ) {
    return runTaskInvocation(invocation, workspaceRoot, options.task);
  }
  if (isProjectProfileInvocation(invocation)) {
    return runProjectProfileInvocation(invocation, workspaceRoot, options.projectProfile);
  }
  if (isRoadmapInvocation(invocation)) {
    return runRoadmapInvocation(invocation, workspaceRoot, options.roadmap);
  }

  const resumedState =
    invocation.command === "resume"
      ? await loadResumeStateIfPresent(workspaceRoot, invocation.taskId)
      : undefined;
  const resolved = resolveRuntimeConfig(options, invocation.harness, workspaceRoot);
  const report = await resolveRoutingReport({
    cwd: workspaceRoot,
    configValue: resolved.value,
    ...(invocation.harness ? { harnessFlag: invocation.harness } : {}),
    ...(options.entrypointPath ? { entrypointPath: options.entrypointPath } : {}),
    env: options.env ?? process.env,
    ...(options.appServer ? { appServer: options.appServer } : {}),
    ...(options.captureSnapshot ? { captureSnapshot: options.captureSnapshot } : {}),
    ...(options.quotaCachePath !== undefined ? { quotaCachePath: options.quotaCachePath } : {}),
    ...(options.nowEpochSeconds !== undefined ? { nowEpochSeconds: options.nowEpochSeconds } : {}),
  });

  return {
    command: invocation.command,
    status: report.status,
    data: {
      ...(invocation.command === "run"
        ? { objective: invocation.objective }
        : {
            taskId: invocation.taskId,
            ...(resumedState ? resumeSummary(resumedState) : {}),
          }),
      harness: report.harness,
      routingSnapshot: report.routingSnapshot,
      routingPolicyVersion: report.routingPolicyVersion,
      routingDecisions: report.routingDecisions,
      ...(report.routingFailure ? { routingFailure: report.routingFailure } : {}),
      ...(report.warning ? { warning: report.warning } : {}),
      config: resolved.value,
    },
  };
}

function resumeSummary(state: TaskState): Record<string, unknown> {
  return {
    taskStatus: state.status,
    macroPhase: deriveMacroPhase(state),
    ...(state.resumeTo ? { resumeTo: state.resumeTo } : {}),
    ...(state.resumeReason ? { resumeReason: state.resumeReason } : {}),
  };
}

async function runTaskInvocation(
  invocation: Extract<ParsedInvocation, { command: `task_${string}` }>,
  workspaceRoot: string,
  taskOptions: TaskCommandOptions | undefined,
): Promise<CliResult> {
  const store = createTaskStateStore(workspaceRoot);
  if (invocation.command === "task_validate") {
    const validated = invocation.taskId
      ? await store.load(invocation.taskId)
      : validateTaskState(
          parseStructuredInput(
            await readStructuredTextInput(
              "task validate requires a task id or YAML/JSON state on stdin.",
              taskOptions,
            ),
            "Task input",
          ),
        );
    return {
      command: invocation.command,
      status: "valid",
      data: {
        taskId: validated.taskId,
        status: validated.status,
        revision: validated.revision,
        macroPhase: deriveMacroPhase(validated),
        contractDigest: validated.contractDigest ?? null,
        state: validated,
      },
    };
  }
  if (invocation.command === "task_save") {
    const raw = await readStructuredTextInput(
      "task save requires a YAML or JSON state payload on stdin.",
      taskOptions,
    );
    const saved = await store.save(
      invocation.taskId,
      parseStructuredInput(raw, "Task input"),
      taskOptions?.expectedRevision !== undefined
        ? { expectedRevision: taskOptions.expectedRevision }
        : undefined,
    );
    return {
      command: invocation.command,
      status: "saved",
      data: {
        taskId: saved.taskId,
        status: saved.status,
        revision: saved.revision,
        macroPhase: deriveMacroPhase(saved),
        contractDigest: saved.contractDigest ?? null,
        state: saved,
      },
    };
  }

  if (invocation.action === "view") {
    const outcome = await store.gate(invocation.taskId);
    return {
      command: invocation.command,
      status: outcome.preflight.ready ? "ready" : "blocked",
      data: {
        taskId: outcome.state.taskId,
        action: "view",
        ready: outcome.preflight.ready,
        blockers: outcome.preflight.blockers,
        preflight: outcome.preflight,
        card: outcome.card,
        contract: renderGateContract(outcome.state),
        state: outcome.state,
      },
    };
  }

  const decisionInput: GateDecisionInput = {
    decision: invocation.action,
    ...(invocation.instruction !== undefined ? { instruction: invocation.instruction } : {}),
    ...(invocation.issueRef !== undefined ? { issueRef: invocation.issueRef } : {}),
    ...(taskOptions?.decidedAt !== undefined ? { decidedAt: taskOptions.decidedAt } : {}),
  };
  const outcome = await store.gate(invocation.taskId, decisionInput);
  const status =
    invocation.action === "change"
      ? "change_requested"
      : invocation.action === "reject"
        ? "rejected"
        : "approved";
  return {
    command: invocation.command,
    status,
    data: {
      taskId: outcome.state.taskId,
      action: invocation.action,
      status: outcome.state.status,
      revision: outcome.state.revision,
      card: outcome.card,
      ...(outcome.receipt ? { receipt: outcome.receipt } : {}),
      state: outcome.state,
    },
  };
}

type ProjectProfileInvocation = Extract<ParsedInvocation, { command: `project_profile_${string}` }>;
type RoadmapInvocation = Extract<ParsedInvocation, { command: `roadmap_${string}` }>;

function isProjectProfileInvocation(value: ParsedInvocation): value is ProjectProfileInvocation {
  return value.command.startsWith("project_profile_");
}

function isRoadmapInvocation(value: ParsedInvocation): value is RoadmapInvocation {
  return value.command.startsWith("roadmap_");
}

async function runProjectProfileInvocation(
  invocation: ProjectProfileInvocation,
  workspaceRoot: string,
  profileOptions: ProjectProfileCommandOptions | undefined,
): Promise<CliResult> {
  const profileStore = createProjectProfileStore(workspaceRoot);
  if (invocation.command === "project_profile_session_view") {
    return {
      command: invocation.command,
      status: "ok",
      data: { state: (await profileStore.loadInitState(true)) ?? null },
    };
  }
  if (invocation.command === "project_profile_session_clear") {
    return {
      command: invocation.command,
      status: "ok",
      data: { cleared: await profileStore.clearInitState() },
    };
  }
  if (invocation.command === "project_profile_session_save") {
    const raw = await readStructuredTextInput(
      "project-profile session-save requires YAML or JSON on stdin.",
      profileOptions,
    );
    const saved = await profileStore.saveInitState(
      parseStructuredInput(raw, "Project profile input"),
    );
    return {
      command: invocation.command,
      status: "saved",
      data: { state: saved, yaml: renderProjectInitState(saved) },
    };
  }
  if (invocation.command === "project_profile_inspect") {
    const shared = await profileStore.loadShared(true);
    const local = await profileStore.loadLocal(true);
    const reconciliation =
      shared && profileOptions?.observedFingerprints
        ? reconcileProjectProfile(shared, profileOptions.observedFingerprints)
        : undefined;
    return {
      command: invocation.command,
      status: "ok",
      data: {
        shared: shared ?? null,
        local: local ?? null,
        localIgnored: await profileStore.isLocalIgnored(),
        initIgnored: await profileStore.isInitIgnored(),
        ...(reconciliation ? { reconciliation } : {}),
      },
    };
  }
  if (invocation.command === "project_profile_view") {
    const loaded = invocation.local
      ? await profileStore.loadLocal(false)
      : await profileStore.loadShared(false);
    return {
      command: invocation.command,
      status: "ok",
      data: { local: invocation.local, yaml: renderProjectProfile(loaded!) },
    };
  }

  const raw = await readStructuredTextInput(
    "project-profile validate/publish requires YAML or JSON on stdin.",
    profileOptions,
  );
  const parsed = parseProjectProfileInput(raw);
  if (invocation.local) {
    if (parsed.projections.length) {
      throw new InvocationError("Local project profile cannot publish shared projections.");
    }
    const local = validateLocalProjectProfile(parsed.profile, await profileStore.loadShared(true));
    if (invocation.command === "project_profile_publish") await profileStore.publishLocal(local);
    return {
      command: invocation.command,
      status: invocation.command === "project_profile_publish" ? "published" : "valid",
      data: {
        local: true,
        path: profileStore.localPath,
        yaml: renderProjectProfile(local),
      },
    };
  }

  const proposal = await profileStore.prepareShared(parsed.profile);
  const projections = validateProjectProfileProjections(proposal, parsed.projections);
  const previous = await profileStore.loadShared(true);
  if (invocation.command === "project_profile_validate") {
    return {
      command: invocation.command,
      status: "valid",
      data: {
        local: false,
        path: profileStore.sharedPath,
        contentDigest: proposal.contentDigest,
        revision: proposal.revision,
        diff: diffProjectProfiles(previous, proposal),
        yaml: renderProjectProfile(proposal),
        projectionPaths: projections.map(({ path }) => path),
      },
    };
  }

  const published = await profileStore.publishShared(parsed.profile, {
    projections,
    ...(profileOptions?.approvedAt ? { approvedAt: profileOptions.approvedAt } : {}),
  });
  return {
    command: invocation.command,
    status: "published",
    data: {
      local: false,
      path: profileStore.sharedPath,
      profileId: published.profileId,
      revision: published.revision,
      contentDigest: published.contentDigest,
      approval: published.approval,
      projectionPaths: projections.map(({ path }) => path),
    },
  };
}

async function runRoadmapInvocation(
  invocation: RoadmapInvocation,
  workspaceRoot: string,
  roadmapOptions: RoadmapCommandOptions | undefined,
): Promise<CliResult> {
  const roadmapStore = createRoadmapStore(workspaceRoot);
  const gitignored = roadmapStore.isGitignored();

  if (invocation.command === "roadmap_session_clear") {
    return {
      command: invocation.command,
      status: "ok",
      data: { cleared: await roadmapStore.clear() },
    };
  }
  if (invocation.command === "roadmap_session_view") {
    let state: RoadmapState | null = null;
    try {
      state = await roadmapStore.load();
    } catch (error) {
      if (!(error instanceof RoadmapError && error.code === "roadmap_not_found")) throw error;
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
      roadmapOptions,
    );
    const saved = await roadmapStore.save(parseStructuredInput(raw, "Roadmap input"));
    return {
      command: invocation.command,
      status: "saved",
      data: {
        state: saved,
        gitignored,
        candidateDigest: computeRoadmapCandidateDigest(saved),
        summary: renderRoadmapSessionState(saved, { gitignored }),
        visual: renderRoadmapVisualSummary(saved),
      },
    };
  }
  if (invocation.command === "roadmap_validate") {
    const rawState = invocation.session
      ? await roadmapStore.load()
      : parseStructuredInput(
          await readStructuredTextInput(
            "roadmap validate requires YAML or JSON on stdin unless --session is passed.",
            roadmapOptions,
          ),
          "Roadmap input",
        );
    const validated = validateRoadmapState(rawState);
    return {
      command: invocation.command,
      status: "valid",
      data: {
        state: validated,
        candidateDigest: computeRoadmapCandidateDigest(validated),
        visual: renderRoadmapVisualSummary(validated),
      },
    };
  }
  if (invocation.command === "roadmap_publish_plan") {
    const state = roadmapOptions?.input
      ? validateRoadmapState(parseStructuredInput(roadmapOptions.input, "Roadmap input"))
      : await roadmapStore.load();
    return {
      command: invocation.command,
      status: "ok",
      data: { plan: planIdempotentPublication(state) },
    };
  }
  if (invocation.command === "roadmap_publish_record") {
    const raw = await readStructuredTextInput(
      "roadmap publish-record requires a JSON or YAML patch on stdin.",
      roadmapOptions,
    );
    const patch = parseStructuredInput(raw, "Roadmap publish-record payload");
    if (!isRecord(patch)) {
      throw new InvocationError("Roadmap publish-record payload must be a YAML or JSON object.");
    }
    const existing = await roadmapStore.load();
    const normalizedPatch =
      roadmapOptions?.now !== undefined && patch.recordedAt === undefined
        ? { ...patch, recordedAt: roadmapOptions.now }
        : patch;
    const updated = recordPublishedRoadmapBatch(existing, normalizedPatch);
    await roadmapStore.save(updated);
    return {
      command: invocation.command,
      status: "saved",
      data: { state: updated, publication: updated.publication },
    };
  }

  const state = roadmapOptions?.input
    ? validateRoadmapState(parseStructuredInput(roadmapOptions.input, "Roadmap input"))
    : await roadmapStore.load();
  const selection = selectReadyWorkItems(state, {
    ...(invocation.limit !== undefined ? { limit: invocation.limit } : {}),
    ...(invocation.maxRisk !== undefined ? { maxRisk: invocation.maxRisk } : {}),
    requireIssueNumber: invocation.requireIssueNumber,
    ...(roadmapOptions?.baseBranch !== undefined ? { baseBranch: roadmapOptions.baseBranch } : {}),
    ...(roadmapOptions?.worktreeRoot !== undefined
      ? { worktreeRoot: roadmapOptions.worktreeRoot }
      : {}),
  });
  return {
    command: invocation.command,
    status: "ok",
    data: { eligible: selection.eligible, skipped: selection.skipped },
  };
}

async function readStructuredTextInput(
  emptyMessage: string,
  options: StructuredInputOptions | undefined,
): Promise<string> {
  if (options?.input !== undefined) {
    if (Buffer.byteLength(options.input) > MAX_STRUCTURED_INPUT_BYTES) {
      throw new InvocationError(`Structured input exceeds ${MAX_STRUCTURED_INPUT_BYTES} bytes.`);
    }
    if (!options.input.trim()) throw new InvocationError(emptyMessage);
    return options.input;
  }
  if (options?.readInput) {
    const input = await options.readInput();
    if (Buffer.byteLength(input) > MAX_STRUCTURED_INPUT_BYTES) {
      throw new InvocationError(`Structured input exceeds ${MAX_STRUCTURED_INPUT_BYTES} bytes.`);
    }
    if (!input.trim()) throw new InvocationError(emptyMessage);
    return input;
  }
  if (process.stdin.isTTY) throw new InvocationError(emptyMessage);
  let source = "";
  for await (const chunk of process.stdin) {
    source += String(chunk);
    if (Buffer.byteLength(source) > MAX_STRUCTURED_INPUT_BYTES) {
      throw new InvocationError(`Structured input exceeds ${MAX_STRUCTURED_INPUT_BYTES} bytes.`);
    }
  }
  if (!source.trim()) throw new InvocationError(emptyMessage);
  return source;
}

function parseStructuredInput(source: string, label: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    try {
      return parseYaml(source);
    } catch {
      throw new InvocationError(`${label} is not valid YAML or JSON.`);
    }
  }
}

function parseProjectProfileInput(source: string): {
  profile: unknown;
  projections: ProjectProfileProjection[];
} {
  const parsed = parseStructuredInput(source, "Project profile input");
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

function resolveRuntimeConfig(
  options: RunInvocationOptions,
  harnessFlag: HarnessPreference | undefined,
  workspaceRoot: string,
): ResolvedConfig {
  const base =
    options.configSources ??
    loadConfigSources({
      cwd: workspaceRoot,
      ...(options.home !== undefined ? { home: options.home } : {}),
    });
  const merged: ConfigSource[] = harnessFlag
    ? [...base, { source: "flags", value: { harness: harnessFlag } }]
    : base;
  const resolved = resolveConfig(merged);
  return options.policy ? applyPolicy(resolved, options.policy) : resolved;
}

async function loadResumeStateIfPresent(
  workspaceRoot: string,
  taskId: string,
): Promise<TaskState | undefined> {
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

function isExitCodeError(error: unknown): error is { exitCode: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "exitCode" in error &&
    typeof error.exitCode === "number"
  );
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

if (import.meta.main) {
  main();
}
