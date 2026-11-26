import { parse as parseYaml } from "yaml";
import { compileFactoryPolicies } from "../core/factory-policy.js";
import type { FactoryBootstrapConfig, FactorySelection } from "../core/factory-types.js";
import { StateStoreError, validateSchema } from "../core/schema.js";
import { identifyPinnedHookBundle, writeHarnessCliPin } from "../hooks/bundle-identity.js";
import type { HarnessId } from "../types.js";
import {
  HASH_FORGIX_MARKERS,
  inspectMarkerBlock,
  removeMarkerBlock,
  upsertMarkerBlock,
} from "./markers.js";
import { validateAndStringifyConfig } from "./plan-helpers.js";
import {
  BOOTSTRAP_CAPABILITY_DEFAULTS,
  CONFIG_RELATIVE_PATH,
  DEFAULT_WORKTREE_INCLUDE_ENTRIES,
  GITIGNORE_PATH,
  MANDATORY_GITIGNORE_ENTRIES,
  WORKTREE_INCLUDE_PATH,
  classifyOperation,
  isRecord,
  type FileReadProbe,
  type InitConflict,
  type PlannedFileOperation,
  type SafeReadResult,
} from "./shared.js";

export interface ResolvedSyncConfig {
  rawConfig: Record<string, unknown>;
  harnesses: HarnessId[];
  bootstrap: Required<
    Pick<
      FactoryBootstrapConfig,
      "rules" | "agents" | "skills" | "hooks" | "gitignore" | "worktreeInclude"
    >
  >;
}

export function parseExistingConfigForSync(
  probe: SafeReadResult,
):
  | { ok: true; content: string; config: Record<string, unknown> }
  | { ok: false; conflict: InitConflict } {
  if (!probe.ok) return { ok: false, conflict: probe.conflict };
  if (probe.content === undefined) {
    return {
      ok: false,
      conflict: {
        path: CONFIG_RELATIVE_PATH,
        code: "config_missing",
        message: `${CONFIG_RELATIVE_PATH} does not exist. Run $forgix init to initialize this repository.`,
      },
    };
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(probe.content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "malformed YAML";
    return {
      ok: false,
      conflict: {
        path: CONFIG_RELATIVE_PATH,
        code: "invalid_yaml",
        message: `${CONFIG_RELATIVE_PATH} contains malformed YAML: ${detail}`,
      },
    };
  }
  if (!isRecord(parsed) || !validateSchema("config", parsed).valid) {
    return {
      ok: false,
      conflict: {
        path: CONFIG_RELATIVE_PATH,
        code: "config_invalid",
        message: `${CONFIG_RELATIVE_PATH} failed schema validation.`,
      },
    };
  }
  return { ok: true, content: probe.content, config: parsed };
}

export function resolveSyncCapabilities(
  parsedConfig: Record<string, unknown>,
  activeHarness: HarnessId,
): { ok: true; value: ResolvedSyncConfig } | { ok: false; conflict: InitConflict } {
  const hasBootstrap = isRecord(parsedConfig.bootstrap);
  const hasHarnesses = Array.isArray(parsedConfig.harnesses);
  if (!hasBootstrap && !hasHarnesses) {
    return {
      ok: false,
      conflict: {
        path: CONFIG_RELATIVE_PATH,
        code: "bootstrap_not_configured",
        message: `${CONFIG_RELATIVE_PATH} has neither harnesses nor bootstrap modules configured. Run $forgix init.`,
      },
    };
  }
  const harnesses: HarnessId[] = hasHarnesses
    ? (parsedConfig.harnesses as HarnessId[])
    : parsedConfig.harness === "codex" ||
        parsedConfig.harness === "claude" ||
        parsedConfig.harness === "antigravity"
      ? [parsedConfig.harness]
      : [activeHarness];
  const raw = hasBootstrap ? (parsedConfig.bootstrap as Record<string, unknown>) : {};
  const pickBool = (key: keyof typeof BOOTSTRAP_CAPABILITY_DEFAULTS): boolean =>
    typeof raw[key] === "boolean" ? raw[key] : BOOTSTRAP_CAPABILITY_DEFAULTS[key];

  return {
    ok: true,
    value: {
      rawConfig: parsedConfig,
      harnesses,
      bootstrap: {
        rules: pickBool("rules"),
        agents: pickBool("agents"),
        skills: pickBool("skills"),
        hooks: pickBool("hooks"),
        gitignore: pickBool("gitignore"),
        worktreeInclude: pickBool("worktreeInclude"),
      },
    },
  };
}

function planDelimitedBlock(
  path: string,
  probe: FileReadProbe,
  enabled: boolean,
  requiredEntries: readonly string[],
  operations: PlannedFileOperation[],
  conflicts: InitConflict[],
): void {
  if (!enabled) {
    const removed = removeMarkerBlock(probe.content, HASH_FORGIX_MARKERS);
    if (!removed.ok) {
      conflicts.push({ path, code: removed.conflict.code, message: removed.conflict.message });
    } else {
      operations.push(classifyOperation(path, probe.content, probe.mode, removed.content));
    }
    return;
  }

  let nextEntries: string[] = [...requiredEntries];
  if (probe.content !== undefined) {
    const inspection = inspectMarkerBlock(probe.content, HASH_FORGIX_MARKERS);
    if (inspection.status === "conflict") {
      conflicts.push({
        path,
        code: inspection.conflict.code,
        message: inspection.conflict.message,
      });
      return;
    }
    if (inspection.status === "present") {
      const existing = inspection.innerContent
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const existingSet = new Set(existing);
      const missing = requiredEntries.filter((entry) => !existingSet.has(entry));
      nextEntries = [...existing, ...missing];
    }
  }

  const merged = upsertMarkerBlock(probe.content, HASH_FORGIX_MARKERS, nextEntries.join("\n"));
  if (!merged.ok) {
    conflicts.push({ path, code: merged.conflict.code, message: merged.conflict.message });
  } else {
    operations.push(classifyOperation(path, probe.content, probe.mode, merged.content));
  }
}

export function planSyncHygiene(
  resolved: ResolvedSyncConfig,
  getProbe: (path: string) => FileReadProbe | undefined,
  operations: PlannedFileOperation[],
  conflicts: InitConflict[],
): void {
  const gitignoreProbe = getProbe(GITIGNORE_PATH);
  if (gitignoreProbe) {
    planDelimitedBlock(
      GITIGNORE_PATH,
      gitignoreProbe,
      resolved.bootstrap.gitignore,
      MANDATORY_GITIGNORE_ENTRIES,
      operations,
      conflicts,
    );
  }
  const worktreeProbe = getProbe(WORKTREE_INCLUDE_PATH);
  if (worktreeProbe) {
    planDelimitedBlock(
      WORKTREE_INCLUDE_PATH,
      worktreeProbe,
      resolved.bootstrap.worktreeInclude,
      DEFAULT_WORKTREE_INCLUDE_ENTRIES,
      operations,
      conflicts,
    );
  }
}

function isSyncedConfigUnchanged(
  rawConfig: Record<string, unknown>,
  harnesses: readonly HarnessId[],
  nextBootstrap: FactoryBootstrapConfig,
  compiledPolicies: ReturnType<typeof compileFactoryPolicies>,
): boolean {
  return (
    JSON.stringify(rawConfig.harnesses ?? null) === JSON.stringify(harnesses) &&
    JSON.stringify(rawConfig.bootstrap ?? null) === JSON.stringify(nextBootstrap) &&
    JSON.stringify(rawConfig.factoryPolicies ?? null) === JSON.stringify(compiledPolicies ?? null)
  );
}

export function buildSyncedConfigContent(
  existingContent: string,
  resolved: ResolvedSyncConfig,
  selection: FactorySelection,
  managedPaths: readonly string[],
): string {
  const nextBootstrap: FactoryBootstrapConfig = {
    ...resolved.bootstrap,
    ...(managedPaths.length > 0 ? { managedPaths: [...managedPaths] } : {}),
  };
  const compiledPolicies = compileFactoryPolicies(
    selection.rules.enabled ? (selection.rules.items ?? []) : [],
  );
  if (
    isSyncedConfigUnchanged(resolved.rawConfig, resolved.harnesses, nextBootstrap, compiledPolicies)
  ) {
    return existingContent;
  }

  const nextConfig: Record<string, unknown> = {
    ...resolved.rawConfig,
    schemaVersion: 1,
    harnesses: [...resolved.harnesses],
    bootstrap: nextBootstrap,
  };
  if (compiledPolicies) nextConfig.factoryPolicies = compiledPolicies;
  else delete nextConfig.factoryPolicies;

  return validateAndStringifyConfig(nextConfig, "Synced");
}

export interface LocalPinStatus {
  harness: HarnessId;
  path?: string;
  kind: "update" | "updated" | "unchanged" | "not_applicable";
}

export function applyActiveCliPin(
  localPin: LocalPinStatus,
  entrypointPath: string | undefined,
  env: NodeJS.ProcessEnv | undefined,
): LocalPinStatus {
  if (localPin.kind !== "update" || !entrypointPath) return localPin;
  const written = writeHarnessCliPin(localPin.harness, entrypointPath, env);
  if (!written) {
    throw new StateStoreError(
      "state_write_failed",
      `Failed to write machine-local CLI pin for harness "${localPin.harness}".`,
    );
  }
  const verified = identifyPinnedHookBundle(entrypointPath, {
    harness: localPin.harness,
    ...(env ? { env } : {}),
  });
  if (!verified) {
    throw new StateStoreError(
      "state_conflict",
      `Machine-local CLI pin for harness "${localPin.harness}" was written, but effective pin (e.g. FORGIX_CLI_PATH) still does not match the running bundle.`,
    );
  }
  return { ...localPin, path: written, kind: "updated" };
}
