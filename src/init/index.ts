import { parse as parseYaml } from "yaml";
import { compileFactoryPolicies } from "../core/factory-policy.js";
import type {
  FactoryAgentSpec,
  FactoryBootstrapConfig,
  FactoryManifestSection,
  FactoryRuleSpec,
  FactorySkillSpec,
  FactorySelection,
} from "../core/factory-types.js";
import { ConfigValidationError, InvocationError, validateSchema } from "../core/schema.js";
import { createWorkspaceStore, type WorkspaceStore } from "../core/store.js";
import { writeHarnessCliPin } from "../hooks/bundle-identity.js";
import type {
  CliResult,
  HarnessId,
  HarnessPreference,
  HookEnforcementMode,
  InitBootstrapAction,
} from "../types.js";
import { runInitCheck } from "./check.js";
import { validateFactoryManifestSections } from "./factory-parse.js";
import { planFactoryOperations } from "./factory-plan.js";
import { HOOK_CONFIG_PATHS } from "./hooks-config.js";
import { HASH_FORGIX_MARKERS, removeMarkerBlock, upsertMarkerBlock } from "./markers.js";
import {
  appendFactoryPlan,
  assertNoBlockingConflicts,
  makeProbeGetter,
  planHooksAndAgents,
  validateAndStringifyConfig,
} from "./plan-helpers.js";
import {
  CODEX_AGENTS_PATH,
  CONFIG_RELATIVE_PATH,
  DEFAULT_WORKTREE_INCLUDE_ENTRIES,
  GITIGNORE_PATH,
  INIT_APPLY_LOCK_PATH,
  MANDATORY_GITIGNORE_ENTRIES,
  MAX_RULES_CONTENT_BYTES,
  VERSIONED_DIR_MODE,
  WORKTREE_INCLUDE_PATH,
  applyPlanOperations,
  classifyOperation,
  dedupeStrings,
  isRecord,
  readPreviousManagedPaths,
  renderDiffPreview,
  safeReadTarget,
  toPlanActions,
  type InitCheckFinding,
  type InitConflict,
  type InitPlanAction,
  type PlannedFileOperation,
  type SafeReadResult,
} from "./shared.js";
import { runInitSync } from "./sync.js";

export {
  DEFAULT_WORKTREE_INCLUDE_ENTRIES,
  INIT_APPLY_LOCK_PATH,
  MANDATORY_GITIGNORE_ENTRIES,
  MAX_RULES_CONTENT_BYTES,
  runInitSync,
  type InitCheckFinding,
  type InitConflict,
  type InitPlanAction,
};

const MAX_STRUCTURED_INPUT_BYTES = 2_000_000;

export interface InitBootstrapManifest {
  schemaVersion: 1;
  harnesses: HarnessId[];
  configPatch?: Record<string, unknown>;
  rules: FactoryManifestSection<FactoryRuleSpec>;
  agents?: FactoryManifestSection<FactoryAgentSpec>;
  skills?: FactoryManifestSection<FactorySkillSpec>;
  hooks: {
    enabled: boolean;
    enforcement?: HookEnforcementMode;
  };
  gitignore: {
    enabled: boolean;
    extraEntries?: string[];
  };
  worktreeInclude: {
    enabled: boolean;
    entries?: string[];
  };
  adoptPaths?: string[];
}

export interface RunInitBootstrapOptions {
  workspaceRoot: string;
  input?: string;
  adopt?: boolean;
  strict?: boolean;
  harness?: HarnessPreference;
  store?: WorkspaceStore;
  env?: NodeJS.ProcessEnv;
  entrypointPath?: string;
}

interface InternalPlan {
  operations: PlannedFileOperation[];
  actions: InitPlanAction[];
  conflicts: InitConflict[];
}

function extractSelection(manifest: InitBootstrapManifest): FactorySelection {
  return {
    harnesses: manifest.harnesses,
    rules: manifest.rules,
    agents: manifest.agents ?? { enabled: false },
    skills: manifest.skills ?? { enabled: false },
  };
}

function parseManifest(input: string | undefined): InitBootstrapManifest {
  if (input === undefined || !input.trim()) {
    throw new InvocationError(
      "forgix init plan|apply requires a JSON or YAML bootstrap manifest on stdin.",
    );
  }
  if (Buffer.byteLength(input, "utf8") > MAX_STRUCTURED_INPUT_BYTES) {
    throw new InvocationError(`Bootstrap manifest exceeds ${MAX_STRUCTURED_INPUT_BYTES} bytes.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    try {
      parsed = parseYaml(input);
    } catch {
      throw new ConfigValidationError(
        "Bootstrap manifest is not valid JSON or YAML.",
        "init-bootstrap",
        [],
      );
    }
  }

  const validation = validateSchema("init-bootstrap", parsed);
  if (!validation.valid) {
    const first = validation.errors[0] as { instancePath?: string; message?: string } | undefined;
    throw new ConfigValidationError(
      `Invalid init bootstrap manifest at ${first?.instancePath || "/"}: ${first?.message ?? "schema validation failed"}.`,
      "init-bootstrap",
      validation.errors,
    );
  }

  const manifest = parsed as InitBootstrapManifest;
  validateFactoryManifestSections(extractSelection(manifest), MAX_RULES_CONTENT_BYTES);

  const allLineEntries = [
    ...(manifest.gitignore.extraEntries ?? []),
    ...(manifest.worktreeInclude.entries ?? []),
  ];
  for (const entry of allLineEntries) {
    const trimmed = entry.trim();
    if (trimmed === HASH_FORGIX_MARKERS.start || trimmed === HASH_FORGIX_MARKERS.end) {
      throw new ConfigValidationError(
        `Entry "${trimmed}" cannot match a reserved Forgix delimiter marker.`,
        "init-bootstrap",
        [],
      );
    }
  }

  return manifest;
}

function attachFactoryConfig(
  nextConfig: Record<string, unknown>,
  manifest: InitBootstrapManifest,
  managedPaths: readonly string[],
): void {
  const nextBootstrap: FactoryBootstrapConfig = {
    rules: manifest.rules.enabled,
    agents: manifest.agents?.enabled ?? false,
    skills: manifest.skills?.enabled ?? false,
    hooks: manifest.hooks.enabled,
    gitignore: manifest.gitignore.enabled,
    worktreeInclude: manifest.worktreeInclude.enabled,
    ...(managedPaths.length > 0 ? { managedPaths: [...managedPaths] } : {}),
  };
  nextConfig.bootstrap = nextBootstrap;
  const compiledPolicies = compileFactoryPolicies(
    manifest.rules.enabled ? (manifest.rules.items ?? []) : [],
  );
  if (compiledPolicies) nextConfig.factoryPolicies = compiledPolicies;
  else delete nextConfig.factoryPolicies;
}

function buildMergedConfig(
  existingContent: string | undefined,
  manifest: InitBootstrapManifest,
  managedPaths: readonly string[],
): { ok: true; content: string } | { ok: false; conflict: InitConflict } {
  let base: Record<string, unknown>;
  if (existingContent === undefined) {
    base = { schemaVersion: 1, merge: "never" };
  } else {
    let parsed: unknown;
    try {
      parsed = parseYaml(existingContent);
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
    if (!isRecord(parsed)) {
      return {
        ok: false,
        conflict: {
          path: CONFIG_RELATIVE_PATH,
          code: "invalid_yaml",
          message: `${CONFIG_RELATIVE_PATH} root must be a YAML mapping.`,
        },
      };
    }
    base = { ...parsed };
  }

  if (manifest.configPatch) {
    for (const [key, value] of Object.entries(manifest.configPatch)) {
      base[key] = structuredClone(value);
    }
  }

  const existingHooks = isRecord(base.hooks) ? base.hooks : undefined;
  const existingEnforcement =
    existingHooks &&
    (existingHooks.enforcement === "balanced" ||
      existingHooks.enforcement === "strict" ||
      existingHooks.enforcement === "warn")
      ? existingHooks.enforcement
      : undefined;

  const nextConfig: Record<string, unknown> = {
    ...base,
    schemaVersion: 1,
    harnesses: [...manifest.harnesses],
    hooks: {
      ...existingHooks,
      enforcement: manifest.hooks.enforcement ?? existingEnforcement ?? "balanced",
    },
  };
  attachFactoryConfig(nextConfig, manifest, managedPaths);
  return { ok: true, content: validateAndStringifyConfig(nextConfig, "Merged") };
}

async function computePlan(
  store: WorkspaceStore,
  manifest: InitBootstrapManifest,
  adopt = false,
): Promise<InternalPlan> {
  const selection = extractSelection(manifest);

  const targetPaths = [
    CODEX_AGENTS_PATH,
    HOOK_CONFIG_PATHS.antigravity,
    HOOK_CONFIG_PATHS.codex,
    HOOK_CONFIG_PATHS.claude,
    GITIGNORE_PATH,
    WORKTREE_INCLUDE_PATH,
    CONFIG_RELATIVE_PATH,
  ] as const;

  const readResults = await Promise.all(
    targetPaths.map(async (path) => [path, await safeReadTarget(store, path)] as const),
  );
  const probes = new Map<string, SafeReadResult>(readResults);

  const conflicts: InitConflict[] = [];
  const operations: PlannedFileOperation[] = [];
  const getProbe = makeProbeGetter(probes, conflicts);

  const configProbe = getProbe(CONFIG_RELATIVE_PATH);
  const previousManagedPaths = readPreviousManagedPaths(configProbe?.content);

  const factoryPlan = await planFactoryOperations(
    selection,
    previousManagedPaths,
    (path) => safeReadTarget(store, path),
    {
      adoptAll: adopt,
      ...(manifest.adoptPaths?.length ? { adoptPaths: new Set(manifest.adoptPaths) } : {}),
      renderPreview: renderDiffPreview,
    },
  );
  appendFactoryPlan(factoryPlan, operations, conflicts);
  planHooksAndAgents(
    manifest.harnesses,
    manifest.hooks.enabled,
    selection,
    getProbe,
    operations,
    conflicts,
  );

  const gitignoreProbe = getProbe(GITIGNORE_PATH);
  if (gitignoreProbe) {
    const merged = manifest.gitignore.enabled
      ? upsertMarkerBlock(
          gitignoreProbe.content,
          HASH_FORGIX_MARKERS,
          dedupeStrings([
            ...MANDATORY_GITIGNORE_ENTRIES,
            ...(manifest.gitignore.extraEntries ?? []),
          ]).join("\n"),
        )
      : removeMarkerBlock(gitignoreProbe.content, HASH_FORGIX_MARKERS);
    if (!merged.ok) {
      conflicts.push({
        path: GITIGNORE_PATH,
        code: merged.conflict.code,
        message: merged.conflict.message,
      });
    } else {
      operations.push(
        classifyOperation(
          GITIGNORE_PATH,
          gitignoreProbe.content,
          gitignoreProbe.mode,
          merged.content,
        ),
      );
    }
  }

  const worktreeIncludeProbe = getProbe(WORKTREE_INCLUDE_PATH);
  if (worktreeIncludeProbe) {
    const entries =
      manifest.worktreeInclude.entries !== undefined
        ? dedupeStrings(manifest.worktreeInclude.entries)
        : [...DEFAULT_WORKTREE_INCLUDE_ENTRIES];
    const merged = manifest.worktreeInclude.enabled
      ? upsertMarkerBlock(worktreeIncludeProbe.content, HASH_FORGIX_MARKERS, entries.join("\n"))
      : removeMarkerBlock(worktreeIncludeProbe.content, HASH_FORGIX_MARKERS);
    if (!merged.ok) {
      conflicts.push({
        path: WORKTREE_INCLUDE_PATH,
        code: merged.conflict.code,
        message: merged.conflict.message,
      });
    } else {
      operations.push(
        classifyOperation(
          WORKTREE_INCLUDE_PATH,
          worktreeIncludeProbe.content,
          worktreeIncludeProbe.mode,
          merged.content,
        ),
      );
    }
  }

  if (configProbe) {
    const mergedConfig = buildMergedConfig(configProbe.content, manifest, factoryPlan.managedPaths);
    if (!mergedConfig.ok) {
      conflicts.push(mergedConfig.conflict);
    } else {
      operations.push(
        classifyOperation(
          CONFIG_RELATIVE_PATH,
          configProbe.content,
          configProbe.mode,
          mergedConfig.content,
        ),
      );
    }
  }

  return { operations, actions: toPlanActions(operations), conflicts };
}

export async function runInitBootstrap(
  action: InitBootstrapAction,
  options: RunInitBootstrapOptions,
): Promise<CliResult> {
  const store = options.store ?? createWorkspaceStore(options.workspaceRoot);

  if (action === "check") {
    return runInitCheck(store, {
      ...(options.strict ? { strict: true } : {}),
      ...(options.harness ? { harness: options.harness } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.entrypointPath ? { entrypointPath: options.entrypointPath } : {}),
    });
  }

  const manifest = parseManifest(options.input);

  if (action === "plan") {
    const plan = await computePlan(store, manifest, options.adopt);
    return {
      command: "init_plan",
      status: plan.conflicts.length > 0 ? "blocked" : "ok",
      data: {
        actions: plan.actions,
        conflicts: plan.conflicts,
      },
    };
  }

  if (action === "apply") {
    await store.ensureSafeDirectory(".forgix", { dirMode: VERSIONED_DIR_MODE });
    return store.withWriteLock(INIT_APPLY_LOCK_PATH, async () => {
      const plan = await computePlan(store, manifest, options.adopt);
      assertNoBlockingConflicts(plan.conflicts, "init bootstrap");
      await applyPlanOperations(store, plan.operations);
      if (manifest.hooks.enabled && options.entrypointPath) {
        for (const harness of manifest.harnesses) {
          writeHarnessCliPin(harness, options.entrypointPath, options.env);
        }
      }
      return {
        command: "init_apply",
        status: "ok",
        data: {
          actions: plan.actions,
          conflicts: [],
        },
      };
    });
  }

  throw new InvocationError(`Unsupported init action: ${String(action)}.`);
}
