import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import * as configModule from "./core/config.js";
import * as routingModule from "./core/routing.js";
import * as schemaModule from "./core/schema.js";
import * as storeModule from "./core/store.js";
import { sha256Hex } from "./core/digest.js";
import { hasWorkspaceBuildAuthorization } from "./core/build-authorization.js";
import { checkWorktreeBase, WorktreeBaseError } from "./core/worktree-base.js";
import { buildRetroReport } from "./core/retro.js";
import { prepareRoadmapRun } from "./roadmap/prepare-run.js";
import { persistRoadmapPublication } from "./roadmap/persist-publication.js";
import { normalizeCheckpointPatch } from "./roadmap/runtime-coherence.js";
import { runHook } from "./hooks/index.js";
import { runInitBootstrap } from "./init/index.js";
import { checkBuildInstallation } from "./init/build-installation.js";
import { parseInitInvocation, type ParsedInitInvocation } from "./init/invocation.js";
import * as profileModule from "./profile/index.js";
import {
  DEFAULT_ROADMAP_MARKDOWN_PATH,
  ROADMAP_BOARD_STATUSES,
  RoadmapError,
  computeRoadmapCandidateDigest,
  computeRoadmapNextActionEnvelope,
  createPublishedRoadmapStore,
  createRoadmapRuntimeStore,
  createRoadmapStore,
  planExternalSync,
  planIdempotentPublication,
  publishRoadmap,
  recordCheckpointResult,
  recordExternalSyncBatch,
  recordPublishedRoadmapBatch,
  renderRoadmapMarkdown,
  renderRoadmapSessionState,
  renderRoadmapVisualSummary,
  selectReadyWorkItems,
  transitionRoadmapWorkItemStatus,
  validateRoadmapState,
  type PublishedRoadmap,
  type RoadmapAdapter,
  type RoadmapBoardStatus,
  type RoadmapRuntimeState,
  type RoadmapSelectResult,
  type RoadmapState,
  type RoadmapSyncRecordPatch,
  type RoadmapVisualFormat,
} from "./roadmap/index.js";
import {
  activeVerifierDigests,
  computeTaskNextActionEnvelope,
  createTaskStateStore,
  deriveMacroPhase,
  renderGateContract,
  validateTaskState,
  type GateDecisionInput,
} from "./task/index.js";
import { contractReviewView } from "./task/contract-review.js";
import { roadmapTaskInitializer } from "./task/roadmap-intake.js";
import {
  HARNESS_IDS,
  HOOK_EVENTS,
  VERIFIER_KINDS,
  type CliResult,
  type HarnessId,
  type HarnessPreference,
  type HookEvent,
  type HookRunResult,
  type NextActionEnvelope,
  type SurfaceVerificationRule,
  type TaskState,
  type VerifierKind,
} from "./types.js";

const { applyPolicy, explainConfig, loadConfigSources, resolveConfig } = configModule;
const { resolveRoutingReport } = routingModule;
const { EXIT_CODES, InvocationError, StateStoreError } = schemaModule;
const {
  TELEMETRY_RUNS_PATH,
  appendTelemetryEvent,
  readTelemetryEvents,
  summarizeFactoryTelemetry,
} = storeModule;
export { EXIT_CODES };
const {
  createProjectProfileStore,
  diffProjectProfiles,
  reconcileProjectProfile,
  renderProjectInitState,
  renderProjectProfile,
  validateLocalProjectProfile,
  validateProjectProfileProjections,
} = profileModule;
export type { NextActionEnvelope };

type ConfigSource = configModule.ConfigSource;
type PolicyInput = configModule.PolicyInput;
type ResolvedConfig = configModule.ResolvedConfig;
type AppServerOptions = routingModule.AppServerOptions;
type CapturedRoutingSnapshot = routingModule.CapturedRoutingSnapshot;
type ProjectProfileProjection = profileModule.ProjectProfileProjection;

const MAX_STRUCTURED_INPUT_BYTES = 2_000_000;
const VALID_HARNESS_VALUES = new Set<string>(["auto", ...HARNESS_IDS]);
const VALID_HOOK_HARNESS_VALUES = new Set<string>(HARNESS_IDS);
const VALID_HOOK_EVENT_VALUES = new Set<string>(HOOK_EVENTS);
const VALID_ROADMAP_ADAPTERS = new Set<string>(["local", "github", "entire"]);

const KNOWN_SUBCOMMANDS = new Set([
  "--help",
  "init",
  "hook",
  "resume",
  "status",
  "config",
  "task",
  "project-profile",
  "roadmap",
  "telemetry",
  "retro",
  "guardrails",
  "worktree",
]);

export const HELP_TEXT = `Usage: forgix [--harness auto|codex|claude|antigravity] <command|objective>

Commands:
  --help
  init plan|apply|check
  init check-build <codex|claude|antigravity>
  hook <codex|claude|antigravity> <session-start|pre-tool-use|post-tool-use|post-invocation>
  config show [--explain]
  config validate [--json]
  status [task-id]
  resume <task-id>
  task validate [task-id]
  task save <task-id> [--create] [--expected-revision=N] [--adopt-design]
  task project <task-id> --path=<path> --authorize=<contract-digest>
  task review <task-id>   Read a Contract Review action from stdin
  task gate <task-id> [--view | --approve [--digest=<contract-digest>] | --reject | --change=<instruction> | --autonomous [--issue=<ref>]]
  project-profile inspect
  project-profile view [--local]
  project-profile validate [--local]
  project-profile publish [--local]
  project-profile session-view|session-save|session-clear
  roadmap session-view [--format=tree|mermaid]
  roadmap session-save|session-clear
  roadmap validate [--session]
  roadmap publish [--adapter=local|github|entire] [--actor=<name>]
  roadmap view [--format=tree|mermaid]
  roadmap sync-plan [--adapter=local|github|entire]
  roadmap sync-record
  roadmap checkpoint-record
  roadmap publish-plan|publish-record
  roadmap select-ready [--limit=N] [--max-risk=low|medium|all] [--require-issue]
  roadmap set-status <work-item-id> <status>
  roadmap prepare-local <work-item-id> [--dry-run]
  telemetry record
  telemetry summary
  retro
  guardrails check [--strict]
  worktree check-base [base-branch]
  <objective>
`;

export type TaskGateAction = "view" | "approve" | "reject" | "change" | "autonomous";

export type ParsedInvocation =
  | { command: "help"; harness?: HarnessPreference }
  | ParsedInitInvocation
  | {
      command: "hook";
      targetHarness: HarnessId;
      event: HookEvent;
      harness?: HarnessPreference;
    }
  | { command: "run"; objective: string; harness?: HarnessPreference }
  | { command: "resume"; taskId: string; harness?: HarnessPreference }
  | { command: "status"; taskId: string | undefined; harness?: HarnessPreference }
  | { command: "config_show"; explain: boolean; harness?: HarnessPreference }
  | { command: "config_validate"; json: boolean; harness?: HarnessPreference }
  | { command: "task_validate"; taskId?: string; harness?: HarnessPreference }
  | {
      command: "task_save";
      taskId: string;
      expectedRevision?: number;
      adoptDesign?: boolean;
      create?: boolean;
      harness?: HarnessPreference;
    }
  | {
      command: "task_project";
      taskId: string;
      path: string;
      digest: string;
      harness?: HarnessPreference;
    }
  | {
      command: "task_review";
      taskId: string;
      harness?: HarnessPreference;
    }
  | {
      command: "task_gate";
      taskId: string;
      action: TaskGateAction;
      instruction?: string;
      issueRef?: string;
      expectedDigest?: string;
      expectedReview?: string;
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
  | {
      command: "roadmap_publish";
      adapter?: RoadmapAdapter;
      actor?: string;
      harness?: HarnessPreference;
    }
  | { command: "roadmap_view"; format?: RoadmapVisualFormat; harness?: HarnessPreference }
  | { command: "roadmap_sync_plan"; adapter?: RoadmapAdapter; harness?: HarnessPreference }
  | { command: "roadmap_sync_record"; harness?: HarnessPreference }
  | { command: "roadmap_checkpoint_record"; harness?: HarnessPreference }
  | { command: "roadmap_publish_plan"; harness?: HarnessPreference }
  | { command: "roadmap_publish_record"; harness?: HarnessPreference }
  | {
      command: "roadmap_set_status";
      workItemId: string;
      status: RoadmapBoardStatus;
      harness?: HarnessPreference;
    }
  | {
      command: "roadmap_prepare_local";
      workItemId: string;
      dryRun: boolean;
      harness?: HarnessPreference;
    }
  | {
      command: "roadmap_select_ready";
      limit?: number;
      maxRisk?: "low" | "medium" | "all";
      requireIssueNumber: boolean;
      harness?: HarnessPreference;
    }
  | { command: "telemetry_record"; harness?: HarnessPreference }
  | { command: "telemetry_summary"; harness?: HarnessPreference }
  | { command: "retro"; harness?: HarnessPreference }
  | { command: "worktree_check_base"; base: string; harness?: HarnessPreference }
  | { command: "guardrails_check"; strict: boolean; harness?: HarnessPreference };

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

export interface TelemetryCommandOptions extends StructuredInputOptions {
  now?: string;
}

export type GuardrailsCommandOptions = StructuredInputOptions;

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
  init?: StructuredInputOptions;
  hook?: StructuredInputOptions;
  task?: TaskCommandOptions;
  projectProfile?: ProjectProfileCommandOptions;
  roadmap?: RoadmapCommandOptions;
  telemetry?: TelemetryCommandOptions;
  guardrails?: GuardrailsCommandOptions;
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
    const [taskId, ...flags] = args;
    if (!taskId || taskId.startsWith("--")) invalid("task save requires exactly one task id.");
    let expectedRevision: number | undefined;
    let adoptDesign = false;
    let create = false;
    for (const flag of flags) {
      if (flag === "--create" && !create) {
        create = true;
      } else if (flag === "--adopt-design" && !adoptDesign) {
        adoptDesign = true;
      } else if (/^--expected-revision=\d+$/.test(flag) && expectedRevision === undefined) {
        expectedRevision = Number(flag.slice("--expected-revision=".length));
        if (!Number.isSafeInteger(expectedRevision)) invalid("Invalid expected revision.");
      } else {
        invalid("Invalid or duplicate task save flag.");
      }
    }
    return {
      command: "task_save",
      taskId,
      ...(expectedRevision !== undefined ? { expectedRevision } : {}),
      ...(adoptDesign ? { adoptDesign } : {}),
      ...(create ? { create } : {}),
      ...harnessField,
    };
  }
  if (subcommand === "project") {
    const [taskId, ...flags] = args;
    const path = flags.find((flag) => flag.startsWith("--path="))?.slice("--path=".length);
    const digest = flags
      .find((flag) => flag.startsWith("--authorize="))
      ?.slice("--authorize=".length);
    if (
      !taskId ||
      taskId.startsWith("--") ||
      flags.length !== 2 ||
      !path ||
      !digest ||
      !/^[a-f0-9]{64}$/.test(digest)
    ) {
      invalid(
        "task project requires a task id, --path, and --authorize with the full contract digest.",
      );
    }
    return { command: "task_project", taskId, path, digest, ...harnessField };
  }
  if (subcommand === "review") {
    const [taskId] = args;
    if (args.length !== 1 || !taskId || taskId.startsWith("--"))
      invalid("task review requires one task id.");
    return { command: "task_review", taskId, ...harnessField };
  }
  if (subcommand === "gate") {
    const [taskId, ...flags] = args;
    if (!taskId || taskId.startsWith("--")) {
      invalid("task gate requires a task id.");
    }
    let action: TaskGateAction | undefined;
    let instruction: string | undefined;
    let issueRef: string | undefined;
    let expectedDigest: string | undefined;
    let expectedReview: string | undefined;
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
      } else if (flag.startsWith("--digest=")) {
        const value = flag.slice("--digest=".length);
        if (expectedDigest !== undefined || !/^[a-f0-9]{64}$/.test(value)) {
          invalid("task gate requires one full contract digest.");
        }
        expectedDigest = value;
      } else if (flag.startsWith("--review-digest=")) {
        const value = flag.slice("--review-digest=".length);
        if (expectedReview !== undefined || !/^[a-f0-9]{64}$/.test(value)) {
          invalid("task gate requires one full review digest.");
        }
        expectedReview = value;
      } else {
        invalid("Invalid task gate flag.");
      }
    }
    const resolvedAction = action ?? "view";
    if (issueRef !== undefined && resolvedAction !== "autonomous") {
      invalid("task gate --issue is only valid with --autonomous.");
    }
    if (
      (expectedDigest !== undefined || expectedReview !== undefined) &&
      resolvedAction !== "approve"
    ) {
      invalid("Gate digests are only valid with --approve.");
    }
    return {
      command: "task_gate",
      taskId,
      action: resolvedAction,
      ...(instruction !== undefined ? { instruction } : {}),
      ...(issueRef !== undefined ? { issueRef } : {}),
      ...(expectedDigest !== undefined ? { expectedDigest } : {}),
      ...(expectedReview !== undefined ? { expectedReview } : {}),
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

function parseRoadmapAdapter(value: string): RoadmapAdapter {
  if (!VALID_ROADMAP_ADAPTERS.has(value)) {
    invalid("Invalid --adapter value. Expected one of: local, github, entire.");
  }
  return value as RoadmapAdapter;
}

function parseRoadmapFormatFlags(
  flags: readonly string[],
  invalidMessage: string,
): RoadmapVisualFormat | undefined {
  let format: RoadmapVisualFormat | undefined;
  for (const flag of flags) {
    if (flag === "--format=tree" || flag === "--tree") format = "tree";
    else if (flag === "--format=mermaid" || flag === "--mermaid") format = "mermaid";
    else invalid(invalidMessage);
  }
  return format;
}

function parseRoadmapInvocation(
  rest: readonly string[],
  harnessField: { harness?: HarnessPreference },
): ParsedInvocation {
  const [subcommand, ...flags] = rest;
  if (subcommand === "session-view") {
    const format = parseRoadmapFormatFlags(flags, "Invalid roadmap session-view flag.");
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
  if (subcommand === "publish") {
    let adapter: RoadmapAdapter | undefined;
    let actor: string | undefined;
    for (const flag of flags) {
      if (flag.startsWith("--adapter=")) {
        adapter = parseRoadmapAdapter(flag.slice("--adapter=".length));
      } else if (flag.startsWith("--actor=")) {
        const value = flag.slice("--actor=".length);
        if (!value.trim()) invalid("Invalid --actor value.");
        actor = value;
      } else {
        invalid("Invalid roadmap publish flag.");
      }
    }
    return {
      command: "roadmap_publish",
      ...(adapter !== undefined ? { adapter } : {}),
      ...(actor !== undefined ? { actor } : {}),
      ...harnessField,
    };
  }
  if (subcommand === "view") {
    const format = parseRoadmapFormatFlags(flags, "Invalid roadmap view flag.");
    return format
      ? { command: "roadmap_view", format, ...harnessField }
      : { command: "roadmap_view", ...harnessField };
  }
  if (subcommand === "sync-plan") {
    let adapter: RoadmapAdapter | undefined;
    for (const flag of flags) {
      if (flag.startsWith("--adapter=")) {
        adapter = parseRoadmapAdapter(flag.slice("--adapter=".length));
      } else {
        invalid("Invalid roadmap sync-plan flag.");
      }
    }
    return {
      command: "roadmap_sync_plan",
      ...(adapter !== undefined ? { adapter } : {}),
      ...harnessField,
    };
  }
  if (subcommand === "sync-record" && flags.length === 0) {
    return { command: "roadmap_sync_record", ...harnessField };
  }
  if (subcommand === "checkpoint-record" && flags.length === 0) {
    return { command: "roadmap_checkpoint_record", ...harnessField };
  }
  if (subcommand === "publish-plan" && flags.length === 0) {
    return { command: "roadmap_publish_plan", ...harnessField };
  }
  if (subcommand === "publish-record" && flags.length === 0) {
    return { command: "roadmap_publish_record", ...harnessField };
  }
  if (subcommand === "set-status") {
    if (flags.length !== 2) {
      invalid("roadmap set-status requires <work-item-id> and <status>.");
    }
    const [workItemId, rawStatus] = flags;
    if (!workItemId || workItemId.startsWith("-")) {
      invalid("Invalid work-item-id for roadmap set-status.");
    }
    const statusValue = rawStatus!.startsWith("--status=")
      ? rawStatus!.slice("--status=".length)
      : rawStatus!;
    if (!ROADMAP_BOARD_STATUSES.includes(statusValue as RoadmapBoardStatus)) {
      invalid(
        `Invalid status "${statusValue}". Expected one of: ${ROADMAP_BOARD_STATUSES.join(", ")}.`,
      );
    }
    return {
      command: "roadmap_set_status",
      workItemId,
      status: statusValue as RoadmapBoardStatus,
      ...harnessField,
    };
  }
  if (subcommand === "prepare-local") {
    if (flags.length < 1 || flags.length > 2) {
      invalid("roadmap prepare-local requires <work-item-id> [--dry-run].");
    }
    const [workItemId, maybeFlag] = flags;
    if (!workItemId || workItemId.startsWith("-")) {
      invalid("Invalid work-item-id for roadmap prepare-local.");
    }
    if (maybeFlag !== undefined && maybeFlag !== "--dry-run") {
      invalid("Invalid roadmap prepare-local flag.");
    }
    return {
      command: "roadmap_prepare_local",
      workItemId,
      dryRun: maybeFlag === "--dry-run",
      ...harnessField,
    };
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
    if (first === "init") return parseInitInvocation(rest, harnessField);
    if (first === "hook") {
      const [targetHarness, event, ...extra] = rest;
      if (
        extra.length === 0 &&
        targetHarness &&
        event &&
        VALID_HOOK_HARNESS_VALUES.has(targetHarness) &&
        VALID_HOOK_EVENT_VALUES.has(event)
      ) {
        return {
          command: "hook",
          targetHarness: targetHarness as HarnessId,
          event: event as HookEvent,
          ...harnessField,
        };
      }
      invalid(
        "Usage: forgix hook <codex|claude|antigravity> <session-start|pre-tool-use|post-tool-use|post-invocation>",
      );
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
    if (first === "telemetry") {
      const [subcommand, ...flags] = rest;
      if (subcommand === "record" && flags.length === 0) {
        return { command: "telemetry_record", ...harnessField };
      }
      if (subcommand === "summary" && flags.length === 0) {
        return { command: "telemetry_summary", ...harnessField };
      }
      invalid("Invalid telemetry invocation.");
    }
    if (first === "retro") {
      if (rest.length !== 0) invalid("retro accepts no arguments.");
      return { command: "retro", ...harnessField };
    }
    if (first === "guardrails") {
      const [subcommand, ...flags] = rest;
      if (
        subcommand === "check" &&
        (flags.length === 0 || (flags.length === 1 && flags[0] === "--strict"))
      ) {
        return { command: "guardrails_check", strict: flags[0] === "--strict", ...harnessField };
      }
      invalid("Invalid guardrails invocation.");
    }
    if (first === "worktree") {
      if (rest[0] === "check-base" && rest.length <= 2 && !rest[1]?.startsWith("-")) {
        return { command: "worktree_check_base", base: rest[1] ?? "main", ...harnessField };
      }
      invalid("Usage: forgix worktree check-base [base-branch]");
    }
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
  const entrypointPath = fileURLToPath(import.meta.url);
  const env = options.env ?? process.env;
  if (invocation.command === "init_check_build") {
    return checkBuildInstallation(invocation.targetHarness, workspaceRoot, entrypointPath, env);
  }
  if (
    invocation.command === "init_plan" ||
    invocation.command === "init_apply" ||
    invocation.command === "init_check"
  ) {
    const action = invocation.command.slice(5) as "plan" | "apply" | "check";
    const input =
      action === "check"
        ? undefined
        : await readStructuredTextInput(
            "Provide a bootstrap manifest JSON/YAML on stdin.",
            options.init,
          );
    return runInitBootstrap(action, {
      workspaceRoot,
      ...(input !== undefined ? { input } : {}),
      env,
      entrypointPath,
    });
  }
  if (invocation.command === "hook") {
    const input = await readOptionalHookInput(options.hook);
    const hookResult = await runHook(invocation.targetHarness, invocation.event, {
      workspaceRoot,
      input,
      env,
      entrypointPath,
    });
    return {
      command: "hook",
      status: hookResult.exitCode === 0 ? "ok" : "blocked",
      data: hookResult,
    };
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
    const store = createTaskStateStore(workspaceRoot);
    const loaded = await store.load(invocation.taskId);
    const buildPending =
      loaded.status === "executing" ||
      (loaded.status === "blocked" && loaded.resumeTo === "executing");
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
        ...(buildPending
          ? {
              buildAuthorization: hasWorkspaceBuildAuthorization(loaded, store.workspaceRoot)
                ? "verified"
                : "fresh_gate_required",
            }
          : {}),
      },
    };
  }
  if (
    invocation.command === "task_validate" ||
    invocation.command === "task_save" ||
    invocation.command === "task_project" ||
    invocation.command === "task_review" ||
    invocation.command === "task_gate"
  ) {
    return runTaskInvocation(invocation, workspaceRoot, options);
  }
  if (isProjectProfileInvocation(invocation)) {
    return runProjectProfileInvocation(invocation, workspaceRoot, options.projectProfile);
  }
  if (invocation.command === "roadmap_prepare_local") {
    const task = roadmapTaskInitializer(
      (root) => resolveRuntimeConfig(options, invocation.harness, root).value,
      options.policy,
    );
    return {
      command: invocation.command,
      ...(await prepareRoadmapRun(workspaceRoot, invocation, task, options.roadmap)),
    };
  }
  if (isRoadmapInvocation(invocation)) {
    return runRoadmapInvocation(invocation, workspaceRoot, options.roadmap);
  }
  if (
    invocation.command === "telemetry_record" ||
    invocation.command === "telemetry_summary" ||
    invocation.command === "retro"
  ) {
    return runTelemetryOrRetroInvocation(
      invocation,
      workspaceRoot,
      options.telemetry ?? options.task ?? options.roadmap,
    );
  }
  if (invocation.command === "guardrails_check") {
    return runGuardrailsCheckInvocation(invocation, workspaceRoot, options.guardrails);
  }
  if (invocation.command === "worktree_check_base") {
    return {
      command: invocation.command,
      status: "verified",
      data: checkWorktreeBase(workspaceRoot, invocation.base),
    };
  }

  const resumedSummary =
    invocation.command === "resume"
      ? await loadResumeSummaryIfPresent(workspaceRoot, invocation.taskId)
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
            ...resumedSummary,
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

async function runTaskInvocation(
  invocation: Extract<ParsedInvocation, { command: `task_${string}` }>,
  workspaceRoot: string,
  options: RunInvocationOptions,
): Promise<CliResult> {
  const store = createTaskStateStore(workspaceRoot);
  workspaceRoot = store.workspaceRoot;
  const taskOptions = options.task;
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
        verifierDigests: activeVerifierDigests(validated),
        nextAction: computeTaskNextActionEnvelope(validated),
      },
    };
  }
  if (invocation.command === "task_save") {
    const raw = await readStructuredTextInput(
      "task save requires a YAML or JSON state payload on stdin.",
      taskOptions,
    );
    const expectedRevision = invocation.expectedRevision ?? taskOptions?.expectedRevision;
    const saved = await store.save(invocation.taskId, parseStructuredInput(raw, "Task input"), {
      ...(expectedRevision !== undefined ? { expectedRevision } : {}),
      ...(invocation.adoptDesign ? { adoptDesign: true } : {}),
      ...(invocation.create ? { create: true } : {}),
    });
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
        nextAction: computeTaskNextActionEnvelope(saved),
      },
    };
  }
  if (invocation.command === "task_project") {
    const projected = await store.project(invocation.taskId, {
      path: invocation.path,
      digest: invocation.digest,
      checkPolicy: async (path) => {
        const profile = await createProjectProfileStore(workspaceRoot).loadShared();
        const protectedPaths =
          profile?.content.protectedSurfaces ?? configModule.DEFAULT_PROTECTED_SURFACES;
        const policyText = await store.store.readText(".forgix/policy.yaml", true);
        const policy: unknown = policyText === undefined ? undefined : parseYaml(policyText);
        const resolved = resolveRuntimeConfig(options, invocation.harness, workspaceRoot);
        if (policy !== undefined) {
          if (!schemaModule.validateSchema("policy", policy).valid) {
            throw new StateStoreError("state_blocked", "Projection policy is invalid.");
          }
          applyPolicy(resolved, policy as PolicyInput);
        }
        if (!configModule.verifyProtectedSurfaces([path], protectedPaths).allowed) {
          throw new StateStoreError("state_blocked", "Projection destination is protected.");
        }
        return sha256Hex({
          profile: profile?.approval?.contentDigest,
          policy,
          invocationPolicy: options.policy,
          config: resolved.value,
        });
      },
    });
    return {
      command: invocation.command,
      status: "projected",
      data: {
        taskId: projected.taskId,
        revision: projected.revision,
        path: projected.shape?.projection?.path,
        state: projected,
        nextAction: computeTaskNextActionEnvelope(projected),
      },
    };
  }
  if (invocation.command === "task_review") {
    const raw = await readStructuredTextInput(
      "task review requires an action on stdin.",
      taskOptions,
    );
    const { state, detail } = await store.review(
      invocation.taskId,
      parseStructuredInput(raw, "Contract Review"),
      invocation.harness,
    );
    return {
      command: invocation.command,
      status: "recorded",
      data: {
        revision: state.revision,
        detail,
        review: contractReviewView(state),
        nextAction: computeTaskNextActionEnvelope(state),
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
        review: contractReviewView(outcome.state),
        state: outcome.state,
        nextAction: computeTaskNextActionEnvelope(outcome.state),
      },
    };
  }

  const decisionInput: GateDecisionInput = {
    decision: invocation.action,
    ...(invocation.instruction !== undefined ? { instruction: invocation.instruction } : {}),
    ...(invocation.issueRef !== undefined ? { issueRef: invocation.issueRef } : {}),
    ...(invocation.expectedDigest !== undefined
      ? { expectedDigest: invocation.expectedDigest }
      : {}),
    ...(invocation.expectedReview !== undefined
      ? { expectedReview: invocation.expectedReview }
      : {}),
    ...(invocation.harness !== undefined ? { harness: invocation.harness } : {}),
    ...(taskOptions?.decidedAt !== undefined ? { decidedAt: taskOptions.decidedAt } : {}),
  };
  const outcome = await store.gate(invocation.taskId, decisionInput);
  if (outcome.refusal) {
    return {
      command: invocation.command,
      status: "blocked",
      data: {
        action: invocation.action,
        reason: outcome.refusal,
        taskId: outcome.state.taskId,
        card: outcome.card,
        preflight: outcome.preflight,
        contract: renderGateContract(outcome.state),
        review: contractReviewView(outcome.state),
        nextAction: computeTaskNextActionEnvelope(outcome.state),
      },
    };
  }
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
      nextAction: computeTaskNextActionEnvelope(outcome.state),
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

function computeProjectProfileNextActionEnvelope(
  action: "session_view" | "validate" | "publish",
  stateStatus?: string,
  local = false,
): NextActionEnvelope {
  if (action === "session_view") {
    const awaiting = stateStatus === "awaiting_approval";
    return {
      role: awaiting ? "profile-approval" : "profile-init",
      phase: stateStatus ?? "discovering",
      allowedCommands: awaiting
        ? [
            "forgix project-profile publish",
            "forgix project-profile validate",
            "forgix project-profile session-clear",
          ]
        : [
            "forgix project-profile inspect",
            "forgix project-profile session-save",
            "forgix project-profile validate",
          ],
      activeInvariants: [
        "portable_shared_profile_no_local_paths",
        "single_active_init_question",
        "init_dir_gitignored",
      ],
    };
  }
  if (action === "validate") {
    return {
      role: "profile-approval",
      phase: "awaiting_approval",
      allowedCommands: local
        ? ["forgix project-profile publish --local", "forgix project-profile view --local"]
        : [
            "forgix project-profile session-save",
            "forgix project-profile publish",
            "forgix project-profile view",
          ],
      activeInvariants: [
        "read_only_validation",
        "candidate_digest_bound",
        "explicit_profile_approval_required",
      ],
    };
  }
  return {
    role: "profile-published",
    phase: "published",
    allowedCommands: local
      ? ["forgix project-profile view --local", "forgix project-profile inspect"]
      : [
          "forgix project-profile session-clear",
          "forgix project-profile view",
          "forgix project-profile inspect",
        ],
    activeInvariants: [
      "profile_approval_receipt_bound",
      "atomic_projection_and_profile_write",
      "authority_precedence_monotonic",
    ],
  };
}

export function computeNextActionEnvelope(
  input:
    | TaskState
    | RoadmapState
    | PublishedRoadmap
    | RoadmapSelectResult
    | RoadmapRuntimeState
    | {
        domain: "project-profile";
        action: "session_view" | "validate" | "publish";
        status?: string;
        local?: boolean;
      },
): NextActionEnvelope {
  if ("domain" in input) {
    return computeProjectProfileNextActionEnvelope(input.action, input.status, input.local);
  }
  if ("taskId" in input && "status" in input) {
    return computeTaskNextActionEnvelope(input);
  }
  return computeRoadmapNextActionEnvelope(input);
}

async function runProjectProfileInvocation(
  invocation: ProjectProfileInvocation,
  workspaceRoot: string,
  profileOptions: ProjectProfileCommandOptions | undefined,
): Promise<CliResult> {
  const profileStore = createProjectProfileStore(workspaceRoot);
  if (invocation.command === "project_profile_session_view") {
    const loadedState = (await profileStore.loadInitState(true)) ?? null;
    return {
      command: invocation.command,
      status: "ok",
      data: {
        state: loadedState,
        nextAction: computeProjectProfileNextActionEnvelope(
          "session_view",
          loadedState?.status,
          false,
        ),
      },
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
    const isPublish = invocation.command === "project_profile_publish";
    return {
      command: invocation.command,
      status: isPublish ? "published" : "valid",
      data: {
        local: true,
        path: profileStore.localPath,
        yaml: renderProjectProfile(local),
        nextAction: computeProjectProfileNextActionEnvelope(
          isPublish ? "publish" : "validate",
          undefined,
          true,
        ),
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
        nextAction: computeProjectProfileNextActionEnvelope("validate", undefined, false),
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
      nextAction: computeProjectProfileNextActionEnvelope("publish", undefined, false),
    },
  };
}

async function runRoadmapInvocation(
  invocation: Exclude<RoadmapInvocation, { command: "roadmap_prepare_local" }>,
  workspaceRoot: string,
  roadmapOptions: RoadmapCommandOptions | undefined,
): Promise<CliResult> {
  const roadmapStore = createRoadmapStore(workspaceRoot);
  const publishedStore = createPublishedRoadmapStore(workspaceRoot);
  const runtimeStore = createRoadmapRuntimeStore(workspaceRoot);
  const gitignored = roadmapStore.isGitignored();

  const loadSessionOrInput = async (): Promise<RoadmapState> =>
    roadmapOptions?.input
      ? validateRoadmapState(parseStructuredInput(roadmapOptions.input, "Roadmap input"))
      : roadmapStore.load();

  if (invocation.command === "roadmap_session_clear") {
    return {
      command: invocation.command,
      status: "ok",
      data: { cleared: await runtimeStore.withLock(() => roadmapStore.clear()) },
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
            nextAction: computeRoadmapNextActionEnvelope(state),
          }
        : { state: null, gitignored },
    };
  }
  if (invocation.command === "roadmap_session_save") {
    const raw = await readStructuredTextInput(
      "roadmap session-save requires YAML or JSON on stdin.",
      roadmapOptions,
    );
    const candidate = parseStructuredInput(raw, "Roadmap input");
    const saved = await runtimeStore.withLock(() => roadmapStore.save(candidate));
    return {
      command: invocation.command,
      status: "saved",
      data: {
        state: saved,
        gitignored,
        candidateDigest: computeRoadmapCandidateDigest(saved),
        summary: renderRoadmapSessionState(saved, { gitignored }),
        visual: renderRoadmapVisualSummary(saved),
        nextAction: computeRoadmapNextActionEnvelope(saved),
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
        nextAction: computeRoadmapNextActionEnvelope(validated),
      },
    };
  }
  if (invocation.command === "roadmap_publish") {
    const result = await persistRoadmapPublication(workspaceRoot, async () =>
      publishRoadmap(await loadSessionOrInput(), {
        ...(invocation.adapter ? { adapter: invocation.adapter } : {}),
        ...(invocation.actor ? { actor: invocation.actor } : {}),
        ...(roadmapOptions?.now ? { publishedAt: roadmapOptions.now } : {}),
      }),
    );
    return {
      command: invocation.command,
      status: "published",
      data: {
        roadmap: result.roadmap,
        runtime: result.runtime,
        markdownPath: DEFAULT_ROADMAP_MARKDOWN_PATH,
        contentDigest: result.roadmap.contentDigest,
        nextAction: computeRoadmapNextActionEnvelope(result.roadmap),
      },
    };
  }
  if (invocation.command === "roadmap_view") {
    const roadmap = await publishedStore.load();
    const runtime = (await runtimeStore.exists()) ? await runtimeStore.load() : undefined;
    return {
      command: invocation.command,
      status: "ok",
      data: {
        roadmap,
        runtime: runtime ?? null,
        markdown: renderRoadmapMarkdown(roadmap, runtime),
        visual: renderRoadmapVisualSummary(roadmap, invocation.format),
      },
    };
  }
  if (invocation.command === "roadmap_sync_plan") {
    const roadmap = await publishedStore.load();
    const runtime = (await runtimeStore.exists()) ? await runtimeStore.load() : undefined;
    const effectiveRoadmap = invocation.adapter
      ? { ...roadmap, adapter: invocation.adapter }
      : roadmap;
    return {
      command: invocation.command,
      status: "ok",
      data: { plan: planExternalSync(effectiveRoadmap, runtime) },
    };
  }
  if (invocation.command === "roadmap_sync_record") {
    const raw = await readStructuredTextInput(
      "roadmap sync-record requires a JSON or YAML patch on stdin.",
      roadmapOptions,
    );
    const patch = parseStructuredInput(raw, "Roadmap sync-record payload");
    if (!isRecord(patch)) {
      throw new InvocationError("Roadmap sync-record payload must be a YAML or JSON object.");
    }
    const recordedAt =
      typeof patch.recordedAt === "string" ? patch.recordedAt : roadmapOptions?.now;
    const normalizedPatch: RoadmapSyncRecordPatch = {
      ...(recordedAt !== undefined ? { recordedAt } : {}),
      ...(Array.isArray(patch.workItems)
        ? { workItems: patch.workItems as NonNullable<RoadmapSyncRecordPatch["workItems"]> }
        : {}),
    };
    const updated = await runtimeStore.withLock(async () =>
      runtimeStore.save(recordExternalSyncBatch(await runtimeStore.load(), normalizedPatch)),
    );
    return {
      command: invocation.command,
      status: "saved",
      data: { runtime: updated },
    };
  }
  if (invocation.command === "roadmap_checkpoint_record") {
    const raw = await readStructuredTextInput(
      "roadmap checkpoint-record requires a JSON or YAML payload on stdin.",
      roadmapOptions,
    );
    const patch = parseStructuredInput(raw, "Roadmap checkpoint-record payload");
    if (!isRecord(patch)) {
      throw new InvocationError("Roadmap checkpoint-record payload must be a YAML or JSON object.");
    }
    const normalizedPatch = normalizeCheckpointPatch(patch, roadmapOptions?.now);
    const updated = await runtimeStore.withLock(async () => {
      const roadmap = await publishedStore.load();
      const existing = await runtimeStore.load();
      if (
        normalizedPatch.observedRoadmapDigest !== roadmap.contentDigest ||
        existing.roadmapDigest !== roadmap.contentDigest ||
        !roadmap.verificationCheckpoints?.some(({ id }) => id === normalizedPatch.checkpointId)
      ) {
        throw new RoadmapError(
          "roadmap_invalid",
          "Checkpoint requires an observed digest and checkpoint from the current published Roadmap.",
        );
      }
      return runtimeStore.save(recordCheckpointResult(existing, normalizedPatch, { roadmap }));
    });
    const receipt = updated.checkpointReceipts.find(
      (entry) => entry.checkpointId === normalizedPatch.checkpointId,
    );
    return {
      command: invocation.command,
      status: "saved",
      data: {
        runtime: updated,
        receipt,
        nextAction: computeRoadmapNextActionEnvelope(updated),
      },
    };
  }
  if (invocation.command === "roadmap_publish_plan") {
    const state = await loadSessionOrInput();
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
    const normalizedPatch =
      roadmapOptions?.now !== undefined && patch.recordedAt === undefined
        ? { ...patch, recordedAt: roadmapOptions.now }
        : patch;
    const updated = await runtimeStore.withLock(async () =>
      roadmapStore.save(recordPublishedRoadmapBatch(await roadmapStore.load(), normalizedPatch)),
    );
    return {
      command: invocation.command,
      status: "saved",
      data: { state: updated, publication: updated.publication },
    };
  }
  if (invocation.command === "roadmap_set_status") {
    const { transitioned, saved } = await runtimeStore.withLock(async () => {
      const transition = transitionRoadmapWorkItemStatus(
        await roadmapStore.load(),
        invocation.workItemId,
        invocation.status,
        ...(roadmapOptions?.now !== undefined ? [{ updatedAt: roadmapOptions.now }] : []),
      );
      const stored = await roadmapStore.save(transition.state);
      if (await runtimeStore.exists()) {
        const runtime = await runtimeStore.load();
        const entry = runtime.workItemStates.find(({ id }) => id === invocation.workItemId);
        if (entry) {
          entry.status = transition.status;
          await runtimeStore.save(runtime);
        }
      }
      return { transitioned: transition, saved: stored };
    });
    return {
      command: invocation.command,
      status: "saved",
      data: {
        workItemId: transitioned.workItem.id,
        featureId: transitioned.featureId,
        previousStatus: transitioned.previousStatus,
        status: transitioned.status,
        featureStatus: transitioned.featureStatus,
        promotedIds: transitioned.promotedIds,
        state: saved,
        summary: renderRoadmapSessionState(saved, { gitignored }),
        visual: renderRoadmapVisualSummary(saved),
      },
    };
  }
  const { roadmapInput, runtimeState } = await runtimeStore.withLock(async () => ({
    roadmapInput: (await publishedStore.exists())
      ? await publishedStore.load()
      : await loadSessionOrInput(),
    runtimeState: (await runtimeStore.exists()) ? await runtimeStore.load() : undefined,
  }));
  const roadmapDigest =
    "contentDigest" in roadmapInput
      ? roadmapInput.contentDigest
      : computeRoadmapCandidateDigest(roadmapInput);
  if (runtimeState && runtimeState.roadmapDigest !== roadmapDigest) {
    throw new RoadmapError(
      "roadmap_invalid",
      "Roadmap and runtime revisions disagree; reconcile publication before selecting work.",
    );
  }
  const selection = selectReadyWorkItems(roadmapInput, {
    ...(invocation.limit !== undefined ? { limit: invocation.limit } : {}),
    ...(invocation.maxRisk !== undefined ? { maxRisk: invocation.maxRisk } : {}),
    requireIssueNumber: invocation.requireIssueNumber,
    ...(roadmapOptions?.baseBranch !== undefined ? { baseBranch: roadmapOptions.baseBranch } : {}),
    ...(roadmapOptions?.worktreeRoot !== undefined
      ? { worktreeRoot: roadmapOptions.worktreeRoot }
      : {}),
    ...(runtimeState !== undefined ? { runtimeState } : {}),
  });
  return {
    command: invocation.command,
    status: "ok",
    data: {
      roadmapDigest,
      eligible: selection.eligible,
      readyCheckpoints: selection.readyCheckpoints,
      skipped: selection.skipped,
      nextAction: computeRoadmapNextActionEnvelope(selection),
    },
  };
}

async function runTelemetryOrRetroInvocation(
  invocation: Extract<
    ParsedInvocation,
    { command: "telemetry_record" | "telemetry_summary" | "retro" }
  >,
  workspaceRoot: string,
  telemetryOptions: (StructuredInputOptions & { now?: string }) | undefined,
): Promise<CliResult> {
  if (invocation.command === "telemetry_record") {
    const raw = await readStructuredTextInput(
      "telemetry record requires a JSON or YAML event payload on stdin.",
      telemetryOptions,
    );
    const parsed = parseStructuredInput(raw, "Telemetry event");
    if (!isRecord(parsed)) {
      throw new InvocationError("Telemetry event must be a JSON or YAML object.");
    }
    const normalizedInput: Record<string, unknown> = {
      ...parsed,
      ...(typeof parsed.type !== "string" && typeof parsed.kind === "string"
        ? { type: parsed.kind }
        : {}),
      ...(telemetryOptions?.now !== undefined && parsed.at === undefined
        ? { at: telemetryOptions.now }
        : {}),
    };
    const event = await appendTelemetryEvent(workspaceRoot, normalizedInput);
    return {
      command: "telemetry_record",
      status: "recorded",
      data: {
        path: TELEMETRY_RUNS_PATH,
        event,
      },
    };
  }

  const events = await readTelemetryEvents(workspaceRoot);
  const summary = summarizeFactoryTelemetry(events);

  if (invocation.command === "telemetry_summary") {
    return {
      command: "telemetry_summary",
      status: "ok",
      data: {
        path: TELEMETRY_RUNS_PATH,
        ...summary,
        summary,
      },
    };
  }

  const report = buildRetroReport(workspaceRoot, summary);
  return {
    command: "retro",
    status: "ok",
    data: {
      path: TELEMETRY_RUNS_PATH,
      summary,
      signals: report.signals,
      clusters: report.clusters,
      proposals: report.proposals,
      nextAction: {
        role: "factory-retro",
        phase: "retro",
        allowedCommands: ["forgix telemetry summary", "forgix project-profile validate"],
        activeInvariants: [
          "mechanical_guardrail_first",
          "surface_verification_rule_second",
          "skill_budget_bounded_doc_last",
          "human_confirmation_before_edit",
        ],
      },
    },
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!isStringArray(value)) {
    invalid(`guardrails check ${fieldName} must be an array of strings.`);
  }
  return value;
}

function isVerifierKind(value: string): value is VerifierKind {
  return (VERIFIER_KINDS as readonly string[]).includes(value);
}

function parseOptionalSurfaceVerificationRules(
  value: unknown,
): SurfaceVerificationRule[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    invalid("guardrails check surfaceVerificationRules must be an array.");
  }
  const rules: SurfaceVerificationRule[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id.trim()) {
      invalid("guardrails check surfaceVerificationRules entries require a non-empty string id.");
    }
    if (!isStringArray(entry.pathGlobs)) {
      invalid(`guardrails check rule ${entry.id} requires pathGlobs as an array of strings.`);
    }
    const rawKinds = entry.requiredVerifierKinds ?? [];
    if (!isStringArray(rawKinds) || !rawKinds.every(isVerifierKind)) {
      invalid(
        `guardrails check rule ${entry.id} has invalid requiredVerifierKinds; expected: ${VERIFIER_KINDS.join(", ")}.`,
      );
    }
    const rawCommands = entry.requiredCommands ?? [];
    if (!isStringArray(rawCommands)) {
      invalid(
        `guardrails check rule ${entry.id} requires requiredCommands as an array of strings.`,
      );
    }
    rules.push({
      id: entry.id,
      pathGlobs: entry.pathGlobs,
      requiredVerifierKinds: rawKinds,
      requiredCommands: rawCommands,
    });
  }
  return rules;
}

async function runGuardrailsCheckInvocation(
  invocation: Extract<ParsedInvocation, { command: "guardrails_check" }>,
  workspaceRoot: string,
  guardrailsOptions: GuardrailsCommandOptions | undefined,
): Promise<CliResult> {
  const raw = await readStructuredTextInput(
    "guardrails check requires a JSON or YAML payload on stdin.",
    guardrailsOptions,
  );
  const payload = parseStructuredInput(raw, "Guardrails check input");
  if (!isRecord(payload)) {
    throw new InvocationError("Guardrails check payload must be a YAML or JSON object.");
  }
  if (payload.diffText !== undefined && typeof payload.diffText !== "string") {
    invalid("guardrails check diffText must be a string.");
  }

  const diffText = payload.diffText ?? "";
  const changedPaths = parseOptionalStringArray(payload.changedPaths, "changedPaths") ?? [];
  const approvedExceptions =
    parseOptionalStringArray(payload.approvedExceptions, "approvedExceptions") ?? [];
  const approvedPaths = parseOptionalStringArray(payload.approvedPaths, "approvedPaths") ?? [];
  const executedCommands =
    parseOptionalStringArray(payload.executedCommands, "executedCommands") ?? [];
  const executedVerifiers =
    parseOptionalStringArray(payload.executedVerifiers, "executedVerifiers") ?? [];
  const explicitProtectedSurfaces = parseOptionalStringArray(
    payload.protectedSurfaces,
    "protectedSurfaces",
  );
  const explicitSurfaceRules = parseOptionalSurfaceVerificationRules(
    payload.surfaceVerificationRules,
  );

  const sharedProfile =
    explicitProtectedSurfaces === undefined || explicitSurfaceRules === undefined
      ? await createProjectProfileStore(workspaceRoot).loadShared(true)
      : undefined;

  const protectedGlobs =
    explicitProtectedSurfaces ??
    sharedProfile?.content.protectedSurfaces ??
    configModule.DEFAULT_PROTECTED_SURFACES;
  const surfaceRules =
    explicitSurfaceRules ??
    sharedProfile?.content.surfaceVerificationRules ??
    configModule.DEFAULT_SURFACE_VERIFICATION_RULES;

  const escapeHatches = configModule.scanDiffForEscapeHatches(diffText, approvedExceptions);
  const protectedSurfaces = configModule.verifyProtectedSurfaces(
    changedPaths,
    protectedGlobs,
    approvedPaths,
  );
  const surfaceVerification = configModule.evaluateSurfaceVerificationRules(
    changedPaths,
    surfaceRules,
    executedCommands,
    executedVerifiers,
  );
  const passed = escapeHatches.passed && protectedSurfaces.passed && surfaceVerification.passed;

  if (invocation.strict && !passed) {
    const details = [
      ...escapeHatches.findings.map((f) => `escape_hatch:${f.kind}:${f.file}:${f.line}`),
      ...protectedSurfaces.violations.map((v) => `protected_surface:${v.path}`),
      ...surfaceVerification.violations.map(
        (v) =>
          `surface_verification:${v.ruleId}[${v.matchedPaths.join(",")}]:${[...v.missingVerifierKinds, ...v.missingCommands].join(",")}`,
      ),
    ];
    throw new StateStoreError("state_blocked", `Guardrails check blocked: ${details.join("; ")}`);
  }

  const nextAction: NextActionEnvelope = {
    role: "assure",
    phase: "ASSURE",
    allowedCommands: passed
      ? ["forgix task save <task-id>", "forgix telemetry record"]
      : ["forgix guardrails check --strict", "forgix telemetry record"],
    activeInvariants: [
      "protected_surface_write_deny",
      "no_unapproved_escape_hatches",
      "surface_verification_rules",
    ],
  };

  return {
    command: "guardrails_check",
    status: passed ? "passed" : "blocked",
    data: {
      passed,
      clean: passed,
      escapeHatches,
      protectedSurfaces,
      surfaceVerification,
      nextAction,
    },
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

async function readOptionalHookInput(options: StructuredInputOptions | undefined): Promise<string> {
  try {
    return await readStructuredTextInput("Missing hook input.", options);
  } catch {
    return "";
  }
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

async function loadResumeSummaryIfPresent(
  workspaceRoot: string,
  taskId: string,
): Promise<Record<string, unknown> | undefined> {
  try {
    const state = await createTaskStateStore(workspaceRoot).resume(taskId);
    const nextAction = computeTaskNextActionEnvelope(state);
    return {
      taskStatus: state.status,
      macroPhase: nextAction.phase,
      ...(state.resumeTo ? { resumeTo: state.resumeTo } : {}),
      ...(state.resumeReason ? { resumeReason: state.resumeReason } : {}),
      nextAction,
    };
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
      if (result.command === "help") {
        process.stdout.write(HELP_TEXT);
      } else if (result.command === "hook") {
        const hookData = result.data as HookRunResult;
        if (hookData.stdout) {
          process.stdout.write(
            hookData.stdout.endsWith("\n") ? hookData.stdout : `${hookData.stdout}\n`,
          );
        }
        if (hookData.stderr) {
          process.stderr.write(
            hookData.stderr.endsWith("\n") ? hookData.stderr : `${hookData.stderr}\n`,
          );
        }
        process.exitCode = hookData.exitCode;
        return;
      } else {
        process.stdout.write(JSON.stringify(result) + "\n");
      }
      if (
        result.status === "blocked" &&
        (result.command === "init_check_build" ||
          (result.command === "task_gate" &&
            isRecord(result.data) &&
            (result.data.action === "approve" || result.data.action === "autonomous")))
      ) {
        process.exitCode = EXIT_CODES.BLOCKED;
      }
    },
    (error: unknown) => {
      const exitCode =
        error instanceof WorktreeBaseError
          ? EXIT_CODES.BLOCKED
          : error instanceof InvocationError || isExitCodeError(error)
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
