import type { FactorySelection } from "../core/factory-types.js";
import { StateStoreError } from "../core/schema.js";
import { createWorkspaceStore, type WorkspaceStore } from "../core/store.js";
import { PLUGIN_VERSION } from "../core/version.js";
import { resolvePinFilePath } from "../hooks/bundle-identity.js";
import type { CliResult, HarnessId, HarnessPreference } from "../types.js";
import { planFactoryOperations } from "./factory-plan.js";
import {
  loadCanonicalAgents,
  loadCanonicalRules,
  loadCanonicalSkills,
  type FactoryCheckFinding,
} from "./factory-scan.js";
import { HOOK_CONFIG_PATHS } from "./hooks-config.js";
import {
  appendFactoryPlan,
  assertNoBlockingConflicts,
  isCliPinUpToDate,
  makeProbeGetter,
  planHooksAndAgents,
  resolveActiveRuntimeHarness,
} from "./plan-helpers.js";
import {
  CODEX_AGENTS_PATH,
  CONFIG_RELATIVE_PATH,
  GITIGNORE_PATH,
  INIT_APPLY_LOCK_PATH,
  MAX_RULES_CONTENT_BYTES,
  WORKTREE_INCLUDE_PATH,
  applyPlanOperations,
  classifyOperation,
  readPreviousManagedPaths,
  renderDiffPreview,
  safeReadTarget,
  toPlanActions,
  type InitConflict,
  type InitPlanAction,
  type PlannedFileOperation,
  type SafeReadResult,
} from "./shared.js";
import {
  applyActiveCliPin,
  buildSyncedConfigContent,
  parseExistingConfigForSync,
  planSyncHygiene,
  resolveSyncCapabilities,
  type LocalPinStatus,
  type ResolvedSyncConfig,
} from "./sync-plan.js";

export interface RunInitSyncOptions {
  workspaceRoot: string;
  adopt?: boolean;
  adoptPaths?: readonly string[];
  harness?: HarnessPreference;
  store?: WorkspaceStore;
  env?: NodeJS.ProcessEnv;
  entrypointPath?: string;
}

interface SyncPlanResult {
  activeHarness: HarnessId;
  operations: PlannedFileOperation[];
  actions: InitPlanAction[];
  conflicts: InitConflict[];
  localPin: LocalPinStatus;
  hooksEnabled: boolean;
  harnesses: HarnessId[];
}

const SYNC_TARGET_PATHS = [
  CODEX_AGENTS_PATH,
  HOOK_CONFIG_PATHS.antigravity,
  HOOK_CONFIG_PATHS.codex,
  HOOK_CONFIG_PATHS.claude,
  GITIGNORE_PATH,
  WORKTREE_INCLUDE_PATH,
] as const;

function evaluateLocalPin(
  hooksEnabled: boolean,
  harnesses: readonly HarnessId[],
  activeHarness: HarnessId,
  options: RunInitSyncOptions,
): LocalPinStatus {
  if (!hooksEnabled || !options.entrypointPath || !harnesses.includes(activeHarness)) {
    return { harness: activeHarness, kind: "not_applicable" };
  }
  const pinPath = resolvePinFilePath(activeHarness, options.env);
  const upToDate = isCliPinUpToDate(options.entrypointPath, activeHarness, options.env);
  return {
    harness: activeHarness,
    ...(pinPath ? { path: pinPath } : {}),
    kind: upToDate ? "unchanged" : "update",
  };
}

function blockedSyncPlan(activeHarness: HarnessId, conflict: InitConflict): SyncPlanResult {
  return {
    activeHarness,
    operations: [],
    actions: [],
    conflicts: [conflict],
    localPin: { harness: activeHarness, kind: "not_applicable" },
    hooksEnabled: false,
    harnesses: [],
  };
}

async function loadSyncInputs(store: WorkspaceStore, resolved: ResolvedSyncConfig) {
  const scanFindings: FactoryCheckFinding[] = [];
  const safeRead = (path: string) => safeReadTarget(store, path);
  const [readResults, rules, agents, skills] = await Promise.all([
    Promise.all(SYNC_TARGET_PATHS.map(async (path) => [path, await safeRead(path)] as const)),
    resolved.bootstrap.rules
      ? loadCanonicalRules(store, MAX_RULES_CONTENT_BYTES, safeRead, scanFindings)
      : Promise.resolve([]),
    resolved.bootstrap.agents
      ? loadCanonicalAgents(store, safeRead, scanFindings)
      : Promise.resolve([]),
    resolved.bootstrap.skills
      ? loadCanonicalSkills(store, safeRead, scanFindings)
      : Promise.resolve([]),
  ]);
  const selection: FactorySelection = {
    harnesses: resolved.harnesses,
    rules: { enabled: resolved.bootstrap.rules, items: rules },
    agents: { enabled: resolved.bootstrap.agents, items: agents },
    skills: { enabled: resolved.bootstrap.skills, items: skills },
  };
  return {
    probes: new Map<string, SafeReadResult>(readResults),
    selection,
    scanFindings,
    safeRead,
  };
}

async function buildResolvedSyncPlan(
  store: WorkspaceStore,
  resolved: ResolvedSyncConfig,
  existingConfigContent: string,
  configMode: number | undefined,
  activeHarness: HarnessId,
  options: RunInitSyncOptions,
): Promise<SyncPlanResult> {
  const { probes, selection, scanFindings, safeRead } = await loadSyncInputs(store, resolved);
  const conflicts: InitConflict[] = [...scanFindings];
  const operations: PlannedFileOperation[] = [];
  const getProbe = makeProbeGetter(probes, conflicts);
  const factoryPlan = await planFactoryOperations(
    selection,
    readPreviousManagedPaths(existingConfigContent),
    safeRead,
    {
      adoptAll: Boolean(options.adopt),
      ...(options.adoptPaths?.length ? { adoptPaths: new Set(options.adoptPaths) } : {}),
      renderPreview: renderDiffPreview,
    },
  );
  appendFactoryPlan(factoryPlan, operations, conflicts);
  planHooksAndAgents(
    resolved.harnesses,
    resolved.bootstrap.hooks,
    selection,
    getProbe,
    operations,
    conflicts,
  );
  planSyncHygiene(resolved, getProbe, operations, conflicts);
  const nextConfig = buildSyncedConfigContent(
    existingConfigContent,
    resolved,
    selection,
    factoryPlan.managedPaths,
  );
  operations.push(
    classifyOperation(CONFIG_RELATIVE_PATH, existingConfigContent, configMode, nextConfig),
  );
  return {
    activeHarness,
    operations,
    actions: toPlanActions(operations),
    conflicts,
    localPin: evaluateLocalPin(
      resolved.bootstrap.hooks,
      resolved.harnesses,
      activeHarness,
      options,
    ),
    hooksEnabled: resolved.bootstrap.hooks,
    harnesses: resolved.harnesses,
  };
}

async function computeSyncPlan(
  store: WorkspaceStore,
  options: RunInitSyncOptions,
): Promise<SyncPlanResult> {
  const configProbe = await safeReadTarget(store, CONFIG_RELATIVE_PATH);
  const parsedConfig = parseExistingConfigForSync(configProbe);
  const activeHarness = resolveActiveRuntimeHarness({
    ...(options.harness ? { flag: options.harness } : {}),
    ...(parsedConfig.ok ? { configHarness: parsedConfig.config.harness } : {}),
    ...(options.env ? { env: options.env } : {}),
    ...(options.entrypointPath ? { entrypointPath: options.entrypointPath } : {}),
  });
  if (!parsedConfig.ok) return blockedSyncPlan(activeHarness, parsedConfig.conflict);
  const resolvedCaps = resolveSyncCapabilities(parsedConfig.config, activeHarness);
  if (!resolvedCaps.ok) return blockedSyncPlan(activeHarness, resolvedCaps.conflict);
  return buildResolvedSyncPlan(
    store,
    resolvedCaps.value,
    parsedConfig.content,
    configProbe.ok ? configProbe.mode : undefined,
    activeHarness,
    options,
  );
}

async function applySyncLocked(
  store: WorkspaceStore,
  options: RunInitSyncOptions,
): Promise<CliResult> {
  const plan = await computeSyncPlan(store, options);
  assertNoBlockingConflicts(plan.conflicts, "init sync");
  await applyPlanOperations(store, plan.operations);
  const localPin = applyActiveCliPin(plan.localPin, options.entrypointPath, options.env);
  return {
    command: "init_sync_apply",
    status: "ok",
    data: {
      pluginVersion: PLUGIN_VERSION,
      activeHarness: plan.activeHarness,
      actions: plan.actions,
      conflicts: [],
      localPin,
    },
  };
}

export async function runInitSync(
  mode: "plan" | "apply",
  options: RunInitSyncOptions,
): Promise<CliResult> {
  const store = options.store ?? createWorkspaceStore(options.workspaceRoot);
  if (mode === "plan") {
    const plan = await computeSyncPlan(store, options);
    const hasChanges =
      plan.actions.some((action) => action.kind !== "unchanged") || plan.localPin.kind === "update";
    return {
      command: "init_sync_plan",
      status: plan.conflicts.length > 0 ? "blocked" : "ok",
      data: {
        pluginVersion: PLUGIN_VERSION,
        activeHarness: plan.activeHarness,
        hasChanges,
        actions: plan.actions,
        conflicts: plan.conflicts,
        localPin: plan.localPin,
      },
    };
  }
  const preflight = await safeReadTarget(store, CONFIG_RELATIVE_PATH);
  if (!preflight.ok) assertNoBlockingConflicts([preflight.conflict], "init sync");
  if (preflight.ok && preflight.content === undefined) {
    throw new StateStoreError(
      "config_missing",
      `${CONFIG_RELATIVE_PATH} does not exist (config_missing). Run $forgix init to initialize this repository.`,
    );
  }
  return store.withWriteLock(INIT_APPLY_LOCK_PATH, () => applySyncLocked(store, options));
}
