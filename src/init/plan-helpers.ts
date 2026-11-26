import { stringify as stringifyYaml } from "yaml";
import type { FactorySelection } from "../core/factory-types.js";
import { resolveHarness } from "../core/routing.js";
import { ConfigValidationError, StateStoreError, validateSchema } from "../core/schema.js";
import { identifyPinnedHookBundle } from "../hooks/bundle-identity.js";
import type { HarnessId, HarnessPreference } from "../types.js";
import { renderCodexAgentsIndexBlock } from "./factory-render.js";
import { HOOK_CONFIG_PATHS, mergeHarnessHooksConfig } from "./hooks-config.js";
import { HTML_FORGIX_MARKERS, removeMarkerBlock, upsertMarkerBlock } from "./markers.js";
import {
  ALL_HARNESSES,
  CODEX_AGENTS_PATH,
  CONFIG_RELATIVE_PATH,
  classifyOperation,
  type FileReadProbe,
  type InitConflict,
  type PlannedFileOperation,
  type SafeReadResult,
} from "./shared.js";

export function makeProbeGetter(
  probes: ReadonlyMap<string, SafeReadResult>,
  conflicts: InitConflict[],
): (path: string) => FileReadProbe | undefined {
  return (path: string): FileReadProbe | undefined => {
    const result = probes.get(path);
    if (!result) return undefined;
    if (!result.ok) {
      conflicts.push(result.conflict);
      return undefined;
    }
    return result;
  };
}

export function appendFactoryPlan(
  factoryPlan: {
    conflicts: readonly InitConflict[];
    operations: ReadonlyArray<{
      path: string;
      existingContent: string | undefined;
      existingMode: number | undefined;
      nextContent: string | undefined;
    }>;
  },
  operations: PlannedFileOperation[],
  conflicts: InitConflict[],
): void {
  conflicts.push(...factoryPlan.conflicts);
  for (const op of factoryPlan.operations) {
    operations.push(
      classifyOperation(op.path, op.existingContent, op.existingMode, op.nextContent),
    );
  }
}

export function planHooksAndAgents(
  harnesses: readonly HarnessId[],
  hooksEnabled: boolean,
  selection: FactorySelection,
  getProbe: (path: string) => FileReadProbe | undefined,
  operations: PlannedFileOperation[],
  conflicts: InitConflict[],
): void {
  const harnessSet = new Set<HarnessId>(harnesses);
  const agentsProbe = getProbe(CODEX_AGENTS_PATH);
  if (agentsProbe) {
    const wantCodexBlock =
      (selection.rules.enabled || selection.agents.enabled || selection.skills.enabled) &&
      harnessSet.has("codex");
    const merged = wantCodexBlock
      ? upsertMarkerBlock(
          agentsProbe.content,
          HTML_FORGIX_MARKERS,
          renderCodexAgentsIndexBlock(selection),
        )
      : removeMarkerBlock(agentsProbe.content, HTML_FORGIX_MARKERS);
    if (!merged.ok) {
      conflicts.push({
        path: CODEX_AGENTS_PATH,
        code: merged.conflict.code,
        message: merged.conflict.message,
      });
    } else {
      operations.push(
        classifyOperation(CODEX_AGENTS_PATH, agentsProbe.content, agentsProbe.mode, merged.content),
      );
    }
  }

  for (const harness of ALL_HARNESSES) {
    const hookPath = HOOK_CONFIG_PATHS[harness];
    const probe = getProbe(hookPath);
    if (!probe) continue;
    const enableHarnessHooks = hooksEnabled && harnessSet.has(harness);
    const merged = mergeHarnessHooksConfig(harness, probe.content, enableHarnessHooks);
    if (!merged.ok) {
      conflicts.push({
        path: hookPath,
        code: merged.conflict.code,
        message: merged.conflict.message,
      });
    } else {
      operations.push(classifyOperation(hookPath, probe.content, probe.mode, merged.content));
    }
  }
}

export function validateAndStringifyConfig(
  nextConfig: Record<string, unknown>,
  label: string,
): string {
  const validation = validateSchema("config", nextConfig);
  if (!validation.valid) {
    const first = validation.errors[0] as { instancePath?: string; message?: string } | undefined;
    throw new ConfigValidationError(
      `${label} ${CONFIG_RELATIVE_PATH} failed schema validation at ${first?.instancePath || "/"}: ${first?.message ?? "schema validation failed"}.`,
      "config",
      validation.errors,
    );
  }
  return stringifyYaml(nextConfig);
}

export function assertNoBlockingConflicts(conflicts: readonly InitConflict[], label: string): void {
  if (conflicts.length === 0) return;
  const summary = conflicts.map((c) => `${c.path}: ${c.message}`).join("; ");
  throw new StateStoreError(
    "state_conflict",
    `Cannot apply ${label} due to blocking conflicts: ${summary}`,
  );
}

export function isCliPinUpToDate(
  entrypointPath: string,
  harness: HarnessId,
  env: NodeJS.ProcessEnv | undefined,
): boolean {
  const withoutOverride = { ...(env ?? process.env) };
  delete withoutOverride.FORGIX_CLI_PATH;
  const persistent = identifyPinnedHookBundle(entrypointPath, { harness, env: withoutOverride });
  const effective = identifyPinnedHookBundle(entrypointPath, { harness, ...(env ? { env } : {}) });
  return Boolean(persistent && effective);
}

export function resolveActiveRuntimeHarness(options: {
  flag?: HarnessPreference;
  configHarness?: unknown;
  env?: NodeJS.ProcessEnv;
  entrypointPath?: string;
}): HarnessId {
  if (options.flag && options.flag !== "auto") return options.flag;
  const env = options.env ?? process.env;
  const detected = resolveHarness({
    flag: "auto",
    env,
    ...(options.entrypointPath ? { entrypointPath: options.entrypointPath } : {}),
  });
  const codexEnv = env.CODEX_THREAD_ID?.trim().toLowerCase();
  const hasCodexEnv = Boolean(codexEnv && codexEnv !== "0" && codexEnv !== "false");
  if (detected !== "codex" || hasCodexEnv) return detected;
  return resolveHarness(options);
}
