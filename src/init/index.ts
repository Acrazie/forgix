import { lstat } from "node:fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { compileFactoryPolicies, parseFactoryPolicies } from "../core/factory-policy.js";
import type {
  FactoryAgentSpec,
  FactoryBootstrapConfig,
  FactoryManifestSection,
  FactoryRuleSpec,
  FactorySelection,
  FactorySkillSpec,
} from "../core/factory-types.js";
import {
  ConfigValidationError,
  InvocationError,
  StateStoreError,
  validateSchema,
} from "../core/schema.js";
import { createWorkspaceStore, type WorkspaceStore } from "../core/store.js";
import { writeHarnessCliPin } from "../hooks/bundle-identity.js";
import type { CliResult, HarnessId, HookEnforcementMode, InitBootstrapAction } from "../types.js";
import { checkFactoryDrift } from "./factory-check.js";
import { validateFactoryManifestSections } from "./factory-parse.js";
import { planFactoryOperations } from "./factory-plan.js";
import { renderCodexAgentsIndexBlock } from "./factory-render.js";
import {
  HOOK_CONFIG_PATHS,
  checkHarnessHooksConfig,
  mergeHarnessHooksConfig,
} from "./hooks-config.js";
import {
  HASH_FORGIX_MARKERS,
  HTML_FORGIX_MARKERS,
  inspectMarkerBlock,
  removeMarkerBlock,
  upsertMarkerBlock,
} from "./markers.js";

const MAX_STRUCTURED_INPUT_BYTES = 2_000_000;
export const MAX_RULES_CONTENT_BYTES = 24_000;

export const INIT_APPLY_LOCK_PATH = ".forgix/init/apply.lock.sqlite";
const CONFIG_RELATIVE_PATH = ".forgix/config.yaml";
const PROJECT_PROFILE_RELATIVE_PATH = ".forgix/project.yaml";
const CODEX_AGENTS_PATH = "AGENTS.md";
const GITIGNORE_PATH = ".gitignore";
const WORKTREE_INCLUDE_PATH = ".worktreeinclude";

const VERSIONED_FILE_MODE = 0o644;
const VERSIONED_DIR_MODE = 0o755;

export const MANDATORY_GITIGNORE_ENTRIES: readonly string[] = [
  ".forgix/init/",
  ".forgix/tasks/",
  ".forgix/project.local.yaml",
  ".forgix/config.local.yaml",
  ".forgix/cache/",
  ".forgix/telemetry/",
  ".forgix/roadmap/session.yaml",
  ".forgix/roadmap/runtime.yaml",
];

export const DEFAULT_WORKTREE_INCLUDE_ENTRIES: readonly string[] = [
  ".forgix/project.local.yaml",
  ".forgix/config.local.yaml",
];

const ALL_HARNESSES: readonly HarnessId[] = ["codex", "claude", "antigravity"];

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

export type InitPlanActionKind = "create" | "update" | "remove" | "unchanged";

export interface InitPlanAction {
  path: string;
  kind: InitPlanActionKind;
  preview?: string;
}

export interface InitConflict {
  path: string;
  code: string;
  message: string;
  preview?: string;
}

export interface InitCheckFinding {
  path: string;
  code: string;
  message: string;
}

export interface RunInitBootstrapOptions {
  workspaceRoot: string;
  input?: string;
  adopt?: boolean;
  store?: WorkspaceStore;
  env?: NodeJS.ProcessEnv;
  entrypointPath?: string;
}

interface PlannedFileOperation {
  path: string;
  kind: InitPlanActionKind;
  existingContent: string | undefined;
  existingMode: number | undefined;
  nextContent: string | undefined;
  preview?: string;
}

interface InternalPlan {
  operations: PlannedFileOperation[];
  actions: InitPlanAction[];
  conflicts: InitConflict[];
}

interface FileReadProbe {
  ok: true;
  content: string | undefined;
  mode: number | undefined;
}

type SafeReadResult = FileReadProbe | { ok: false; conflict: InitConflict };

interface AppliedSnapshot {
  path: string;
  existed: boolean;
  previousContent: string | undefined;
  previousMode: number | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function runSequentially<T>(items: readonly T[], fn: (item: T) => Promise<void>): Promise<void> {
  return items.reduce((chain, item) => chain.then(() => fn(item)), Promise.resolve());
}

function extractSelection(manifest: InitBootstrapManifest): FactorySelection {
  return {
    harnesses: manifest.harnesses,
    rules: manifest.rules,
    agents: manifest.agents ?? { enabled: false },
    skills: manifest.skills ?? { enabled: false },
  };
}

function readPreviousManagedPaths(existingConfigYaml: string | undefined): string[] {
  if (!existingConfigYaml) return [];
  try {
    const parsed: unknown = parseYaml(existingConfigYaml);
    if (!isRecord(parsed) || !isRecord(parsed.bootstrap)) return [];
    if (!Array.isArray(parsed.bootstrap.managedPaths)) return [];
    return parsed.bootstrap.managedPaths.filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0,
    );
  } catch {
    return [];
  }
}

function dedupeStrings(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    if (!seen.has(entry)) {
      seen.add(entry);
      result.push(entry);
    }
  }
  return result;
}

function appendPreviewSection(
  target: string[],
  sourceLines: readonly string[],
  prefix: "-" | "+",
  maxSectionLines: number,
): void {
  const limit = Math.min(sourceLines.length, maxSectionLines);
  for (let i = 0; i < limit; i += 1) {
    target.push(`${prefix}${sourceLines[i]}`);
  }
  if (sourceLines.length > maxSectionLines) {
    target.push("... (truncated)");
  }
}

function renderDiffPreview(
  path: string,
  previous: string | undefined,
  next: string | undefined,
): string {
  const prevLines = previous === undefined ? [] : previous.replace(/\n$/, "").split("\n");
  const nextLines = next === undefined ? [] : next.replace(/\n$/, "").split("\n");
  const lines: string[] = [
    `--- ${previous === undefined ? "/dev/null" : `a/${path}`}`,
    `+++ ${next === undefined ? "/dev/null" : `b/${path}`}`,
  ];
  const totalBudget = 76;
  const halfBudget = 38;
  const prevLimit = Math.min(
    prevLines.length,
    Math.max(halfBudget, totalBudget - nextLines.length),
  );
  const nextLimit = Math.min(nextLines.length, totalBudget - prevLimit);
  appendPreviewSection(lines, prevLines, "-", prevLimit);
  appendPreviewSection(lines, nextLines, "+", nextLimit);
  return lines.join("\n");
}

function classifyOperation(
  path: string,
  existingContent: string | undefined,
  existingMode: number | undefined,
  nextContent: string | undefined,
): PlannedFileOperation {
  if (existingContent === nextContent) {
    return {
      path,
      kind: "unchanged",
      existingContent,
      existingMode,
      nextContent,
    };
  }
  if (existingContent === undefined && nextContent !== undefined) {
    return {
      path,
      kind: "create",
      existingContent,
      existingMode,
      nextContent,
      preview: renderDiffPreview(path, existingContent, nextContent),
    };
  }
  if (existingContent !== undefined && nextContent === undefined) {
    return {
      path,
      kind: "remove",
      existingContent,
      existingMode,
      nextContent,
      preview: renderDiffPreview(path, existingContent, nextContent),
    };
  }
  return {
    path,
    kind: "update",
    existingContent,
    existingMode,
    nextContent,
    preview: renderDiffPreview(path, existingContent, nextContent),
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

async function safeReadTarget(
  store: WorkspaceStore,
  relativePath: string,
): Promise<SafeReadResult> {
  try {
    const content = await store.readText(relativePath, true);
    if (content === undefined) {
      return { ok: true, content: undefined, mode: undefined };
    }
    let mode: number | undefined;
    try {
      const metadata = await lstat(store.resolvePath(relativePath));
      mode = metadata.mode & 0o777;
    } catch {
      mode = undefined;
    }
    return { ok: true, content, mode };
  } catch (error) {
    if (error instanceof StateStoreError && error.code === "state_path_invalid") {
      return {
        ok: false,
        conflict: {
          path: relativePath,
          code: "symlink_or_non_file",
          message: error.message,
        },
      };
    }
    throw error;
  }
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

  const validation = validateSchema("config", nextConfig);
  if (!validation.valid) {
    const first = validation.errors[0] as { instancePath?: string; message?: string } | undefined;
    throw new ConfigValidationError(
      `Merged ${CONFIG_RELATIVE_PATH} failed schema validation at ${first?.instancePath || "/"}: ${first?.message ?? "schema validation failed"}.`,
      "config",
      validation.errors,
    );
  }

  return { ok: true, content: stringifyYaml(nextConfig) };
}

async function computePlan(
  store: WorkspaceStore,
  manifest: InitBootstrapManifest,
  adopt = false,
): Promise<InternalPlan> {
  const harnessSet = new Set<HarnessId>(manifest.harnesses);
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

  const getProbe = (path: string): FileReadProbe | undefined => {
    const result = probes.get(path);
    if (!result) return undefined;
    if (!result.ok) {
      conflicts.push(result.conflict);
      return undefined;
    }
    return result;
  };

  const configProbe = getProbe(CONFIG_RELATIVE_PATH);
  const previousManagedPaths = readPreviousManagedPaths(configProbe?.content);

  // 1. Canonical factory (.forgix/factory/**) + harness projections + legacy rules cleanup
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
  conflicts.push(...factoryPlan.conflicts);
  for (const op of factoryPlan.operations) {
    operations.push(
      classifyOperation(op.path, op.existingContent, op.existingMode, op.nextContent),
    );
  }

  // 2. Codex AGENTS.md delimited block (CLAUDE.md is never written)
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

  // 5. Harness lifecycle hooks
  for (const harness of ALL_HARNESSES) {
    const hookPath = HOOK_CONFIG_PATHS[harness];
    const probe = getProbe(hookPath);
    if (!probe) continue;
    const enableHarnessHooks = manifest.hooks.enabled && harnessSet.has(harness);
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

  // 6. .gitignore delimited block
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

  // 7. .worktreeinclude delimited block
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

  // 6. .forgix/config.yaml (always planned & written last as authoritative commit point)
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

  const actions: InitPlanAction[] = operations.map((op) =>
    op.preview !== undefined
      ? { path: op.path, kind: op.kind, preview: op.preview }
      : { path: op.path, kind: op.kind },
  );

  return { operations, actions, conflicts };
}

async function applyPlanOperations(
  store: WorkspaceStore,
  operations: readonly PlannedFileOperation[],
): Promise<void> {
  const pending = operations.filter((op) => op.kind !== "unchanged");
  const secondary = pending.filter((op) => op.path !== CONFIG_RELATIVE_PATH);
  const configOps = pending.filter((op) => op.path === CONFIG_RELATIVE_PATH);
  const ordered = [...secondary, ...configOps];

  const applied: AppliedSnapshot[] = [];

  try {
    await runSequentially(ordered, async (op) => {
      const snapshot: AppliedSnapshot = {
        path: op.path,
        existed: op.existingContent !== undefined,
        previousContent: op.existingContent,
        previousMode: op.existingMode,
      };
      if (op.kind === "remove") {
        await store.removeFile(op.path);
      } else if (op.nextContent !== undefined) {
        await store.writeTextAtomically(op.path, op.nextContent, {
          mode: op.existingMode ?? VERSIONED_FILE_MODE,
          dirMode: VERSIONED_DIR_MODE,
        });
      }
      applied.push(snapshot);
    });
  } catch (error) {
    const rollbackTargets = applied.toReversed();
    await runSequentially(rollbackTargets, async (entry) => {
      try {
        if (entry.existed && entry.previousContent !== undefined) {
          await store.writeTextAtomically(entry.path, entry.previousContent, {
            mode: entry.previousMode ?? VERSIONED_FILE_MODE,
            dirMode: VERSIONED_DIR_MODE,
          });
        } else {
          await store.removeFile(entry.path);
        }
      } catch {
        // Best-effort rollback: continue restoring remaining files.
      }
    });

    const detail = error instanceof Error ? error.message : "Unexpected I/O failure.";
    throw new StateStoreError(
      "state_write_failed",
      `Failed to apply init bootstrap changes (best-effort rollback attempted): ${detail}`,
    );
  }
}

async function runCheck(store: WorkspaceStore): Promise<CliResult> {
  const findings: InitCheckFinding[] = [];

  const configProbe = await safeReadTarget(store, CONFIG_RELATIVE_PATH);
  if (!configProbe.ok) {
    findings.push({
      path: CONFIG_RELATIVE_PATH,
      code: configProbe.conflict.code,
      message: configProbe.conflict.message,
    });
    return {
      command: "init_check",
      status: "drift",
      data: { inSync: false, findings },
    };
  }

  if (configProbe.content === undefined) {
    findings.push({
      path: CONFIG_RELATIVE_PATH,
      code: "config_missing",
      message: `${CONFIG_RELATIVE_PATH} does not exist. Run $forgix init to bootstrap this repository.`,
    });
    return {
      command: "init_check",
      status: "drift",
      data: { inSync: false, findings },
    };
  }

  let parsedConfig: unknown;
  try {
    parsedConfig = parseYaml(configProbe.content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "malformed YAML";
    findings.push({
      path: CONFIG_RELATIVE_PATH,
      code: "config_invalid",
      message: `${CONFIG_RELATIVE_PATH} contains malformed YAML: ${detail}`,
    });
    return {
      command: "init_check",
      status: "drift",
      data: { inSync: false, findings },
    };
  }

  if (!isRecord(parsedConfig) || !validateSchema("config", parsedConfig).valid) {
    findings.push({
      path: CONFIG_RELATIVE_PATH,
      code: "config_invalid",
      message: `${CONFIG_RELATIVE_PATH} failed schema validation.`,
    });
    return {
      command: "init_check",
      status: "drift",
      data: { inSync: false, findings },
    };
  }

  const projectProfileProbe = await safeReadTarget(store, PROJECT_PROFILE_RELATIVE_PATH);
  if (!projectProfileProbe.ok) {
    findings.push({
      path: PROJECT_PROFILE_RELATIVE_PATH,
      code: projectProfileProbe.conflict.code,
      message: projectProfileProbe.conflict.message,
    });
  }

  const hasBootstrap = isRecord(parsedConfig.bootstrap);
  const hasHarnesses = Array.isArray(parsedConfig.harnesses);

  if (!hasBootstrap && !hasHarnesses) {
    findings.push({
      path: CONFIG_RELATIVE_PATH,
      code: "bootstrap_not_configured",
      message: `${CONFIG_RELATIVE_PATH} has neither harnesses nor bootstrap modules configured.`,
    });
    return {
      command: "init_check",
      status: "drift",
      data: { inSync: false, findings },
    };
  }

  const harnesses: HarnessId[] = hasHarnesses ? (parsedConfig.harnesses as HarnessId[]) : [];
  const bootstrap = hasBootstrap ? (parsedConfig.bootstrap as FactoryBootstrapConfig) : undefined;

  const checkHooks = bootstrap ? bootstrap.hooks === true : true;
  const checkGitignore = bootstrap ? bootstrap.gitignore === true : true;
  const checkWorktreeInclude = bootstrap ? bootstrap.worktreeInclude === true : true;

  const [
    factoryFindings,
    antigravityHooksProbe,
    codexHooksProbe,
    claudeHooksProbe,
    gitignoreProbe,
    worktreeIncludeProbe,
  ] = await Promise.all([
    checkFactoryDrift(
      store,
      harnesses,
      bootstrap,
      parseFactoryPolicies(parsedConfig.factoryPolicies),
      MAX_RULES_CONTENT_BYTES,
      (path) => safeReadTarget(store, path),
    ),
    checkHooks && harnesses.includes("antigravity")
      ? safeReadTarget(store, HOOK_CONFIG_PATHS.antigravity)
      : Promise.resolve(undefined),
    checkHooks && harnesses.includes("codex")
      ? safeReadTarget(store, HOOK_CONFIG_PATHS.codex)
      : Promise.resolve(undefined),
    checkHooks && harnesses.includes("claude")
      ? safeReadTarget(store, HOOK_CONFIG_PATHS.claude)
      : Promise.resolve(undefined),
    checkGitignore ? safeReadTarget(store, GITIGNORE_PATH) : Promise.resolve(undefined),
    checkWorktreeInclude
      ? safeReadTarget(store, WORKTREE_INCLUDE_PATH)
      : Promise.resolve(undefined),
  ]);

  findings.push(...factoryFindings);

  if (checkHooks) {
    const hookProbes: Array<[HarnessId, SafeReadResult | undefined]> = [
      ["antigravity", antigravityHooksProbe],
      ["codex", codexHooksProbe],
      ["claude", claudeHooksProbe],
    ];
    for (const [harness, probe] of hookProbes) {
      if (!probe) continue;
      if (!probe.ok) {
        findings.push({
          path: HOOK_CONFIG_PATHS[harness],
          code: probe.conflict.code,
          message: probe.conflict.message,
        });
      } else {
        findings.push(...checkHarnessHooksConfig(harness, probe.content));
      }
    }
  }

  if (checkGitignore && gitignoreProbe) {
    if (!gitignoreProbe.ok) {
      findings.push({
        path: GITIGNORE_PATH,
        code: gitignoreProbe.conflict.code,
        message: gitignoreProbe.conflict.message,
      });
    } else if (gitignoreProbe.content === undefined) {
      findings.push({
        path: GITIGNORE_PATH,
        code: "gitignore_missing",
        message: `${GITIGNORE_PATH} does not exist.`,
      });
    } else {
      const inspection = inspectMarkerBlock(gitignoreProbe.content, HASH_FORGIX_MARKERS);
      if (inspection.status === "conflict") {
        findings.push({
          path: GITIGNORE_PATH,
          code: inspection.conflict.code,
          message: inspection.conflict.message,
        });
      } else if (inspection.status === "absent") {
        findings.push({
          path: GITIGNORE_PATH,
          code: "gitignore_block_missing",
          message: `${GITIGNORE_PATH} is missing the # forgix:start / # forgix:end block.`,
        });
      } else {
        const lines = new Set(
          inspection.innerContent
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean),
        );
        const missing = MANDATORY_GITIGNORE_ENTRIES.filter((entry) => !lines.has(entry));
        if (missing.length > 0) {
          findings.push({
            path: GITIGNORE_PATH,
            code: "gitignore_entries_missing",
            message: `${GITIGNORE_PATH} Forgix block is missing mandatory entries: ${missing.join(", ")}.`,
          });
        }
      }
    }
  }

  if (checkWorktreeInclude && worktreeIncludeProbe) {
    if (!worktreeIncludeProbe.ok) {
      findings.push({
        path: WORKTREE_INCLUDE_PATH,
        code: worktreeIncludeProbe.conflict.code,
        message: worktreeIncludeProbe.conflict.message,
      });
    } else if (worktreeIncludeProbe.content === undefined) {
      findings.push({
        path: WORKTREE_INCLUDE_PATH,
        code: "worktree_include_missing",
        message: `${WORKTREE_INCLUDE_PATH} does not exist.`,
      });
    } else {
      const inspection = inspectMarkerBlock(worktreeIncludeProbe.content, HASH_FORGIX_MARKERS);
      if (inspection.status === "conflict") {
        findings.push({
          path: WORKTREE_INCLUDE_PATH,
          code: inspection.conflict.code,
          message: inspection.conflict.message,
        });
      } else if (inspection.status === "absent") {
        findings.push({
          path: WORKTREE_INCLUDE_PATH,
          code: "worktree_include_block_missing",
          message: `${WORKTREE_INCLUDE_PATH} is missing the # forgix:start / # forgix:end block.`,
        });
      }
    }
  }

  const inSync = findings.length === 0;
  return {
    command: "init_check",
    status: inSync ? "ok" : "drift",
    data: {
      inSync,
      findings,
    },
  };
}

export async function runInitBootstrap(
  action: InitBootstrapAction,
  options: RunInitBootstrapOptions,
): Promise<CliResult> {
  const store = options.store ?? createWorkspaceStore(options.workspaceRoot);

  if (action === "check") {
    return runCheck(store);
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
      if (plan.conflicts.length > 0) {
        const summary = plan.conflicts.map((c) => `${c.path}: ${c.message}`).join("; ");
        throw new StateStoreError(
          "state_conflict",
          `Cannot apply init bootstrap due to blocking conflicts: ${summary}`,
        );
      }
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
