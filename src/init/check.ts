import { parse as parseYaml } from "yaml";
import { parseFactoryPolicies } from "../core/factory-policy.js";
import type { FactoryBootstrapConfig } from "../core/factory-types.js";
import { validateSchema } from "../core/schema.js";
import type { WorkspaceStore } from "../core/store.js";
import { PLUGIN_VERSION } from "../core/version.js";
import { resolvePinFilePath } from "../hooks/bundle-identity.js";
import type { CliResult, HarnessId, HarnessPreference } from "../types.js";
import { checkFactoryDrift } from "./factory-check.js";
import { HOOK_CONFIG_PATHS, checkHarnessHooksConfig } from "./hooks-config.js";
import { HASH_FORGIX_MARKERS, inspectMarkerBlock } from "./markers.js";
import { isCliPinUpToDate, resolveActiveRuntimeHarness } from "./plan-helpers.js";
import {
  checkProjectProfileDrift,
  type ProjectProfileCheckSummary,
} from "./project-profile-check.js";
import {
  ALL_HARNESSES,
  BOOTSTRAP_CAPABILITY_KEYS,
  CONFIG_RELATIVE_PATH,
  DEFAULT_WORKTREE_INCLUDE_ENTRIES,
  GITIGNORE_PATH,
  MANDATORY_GITIGNORE_ENTRIES,
  MAX_RULES_CONTENT_BYTES,
  PROJECT_PROFILE_RELATIVE_PATH,
  WORKTREE_INCLUDE_PATH,
  isRecord,
  safeReadTarget,
  type InitCheckFinding,
  type SafeReadResult,
} from "./shared.js";
import { resolveSyncCapabilities } from "./sync-plan.js";

export interface RunInitCheckOptions {
  strict?: boolean;
  harness?: HarnessPreference;
  env?: NodeJS.ProcessEnv;
  entrypointPath?: string;
}

function buildCheckResult(
  repoFindings: InitCheckFinding[],
  localFindings: InitCheckFinding[],
  activeHarness: HarnessId,
  projectProfile: ProjectProfileCheckSummary,
  strict?: boolean,
): CliResult {
  const repoInSync = repoFindings.length === 0;
  const localInSync = localFindings.length === 0;
  const inSync = repoInSync && localInSync;
  return {
    command: "init_check",
    status: inSync ? "ok" : "drift",
    data: {
      pluginVersion: PLUGIN_VERSION,
      inSync,
      repoInSync,
      localInSync,
      activeHarness,
      ...(strict ? { strict: true } : {}),
      findings: [...repoFindings, ...localFindings],
      repoFindings,
      localFindings,
      projectProfile,
    },
  };
}

function checkDelimitedEntries(
  path: string,
  probe: SafeReadResult,
  requiredEntries: readonly string[],
  codes: readonly [string, string, string],
  label: string,
  findings: InitCheckFinding[],
): void {
  if (!probe.ok) {
    findings.push(probe.conflict);
    return;
  }
  if (probe.content === undefined) {
    findings.push({ path, code: codes[0], message: `${path} does not exist.` });
    return;
  }
  const inspection = inspectMarkerBlock(probe.content, HASH_FORGIX_MARKERS);
  if (inspection.status === "conflict") {
    findings.push({ path, ...inspection.conflict });
    return;
  }
  if (inspection.status === "absent") {
    findings.push({
      path,
      code: codes[1],
      message: `${path} is missing the # forgix:start / # forgix:end block.`,
    });
    return;
  }
  const lines = new Set(
    inspection.innerContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const missing = requiredEntries.filter((entry) => !lines.has(entry));
  if (missing.length > 0) {
    findings.push({
      path,
      code: codes[2],
      message: `${path} Forgix block is missing ${label} entries: ${missing.join(", ")}.`,
    });
  }
}

function checkLocalCliPin(
  checkHooks: boolean,
  harnesses: readonly HarnessId[],
  activeHarness: HarnessId,
  options: RunInitCheckOptions,
): InitCheckFinding[] {
  if (!checkHooks || !options.entrypointPath || !harnesses.includes(activeHarness)) return [];
  if (isCliPinUpToDate(options.entrypointPath, activeHarness, options.env)) return [];
  const pinPath = resolvePinFilePath(activeHarness, options.env) ?? `cli-path.${activeHarness}`;
  return [
    {
      path: pinPath,
      code: "cli_pin_stale",
      message: `Machine-local CLI pin for active harness "${activeHarness}" is missing or does not match the running bundle.`,
    },
  ];
}

function configFinding(code: string, message: string): { ok: false; finding: InitCheckFinding } {
  return { ok: false, finding: { path: CONFIG_RELATIVE_PATH, code, message } };
}

function parseConfigForCheck(
  probe: SafeReadResult,
): { ok: true; config: Record<string, unknown> } | { ok: false; finding: InitCheckFinding } {
  if (!probe.ok) return configFinding(probe.conflict.code, probe.conflict.message);
  if (probe.content === undefined) {
    return configFinding(
      "config_missing",
      `${CONFIG_RELATIVE_PATH} does not exist. Run $forgix init to bootstrap this repository.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(probe.content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "malformed YAML";
    return configFinding(
      "config_invalid",
      `${CONFIG_RELATIVE_PATH} contains malformed YAML: ${detail}`,
    );
  }
  if (!isRecord(parsed) || !validateSchema("config", parsed).valid) {
    return configFinding("config_invalid", `${CONFIG_RELATIVE_PATH} failed schema validation.`);
  }
  return { ok: true, config: parsed };
}

async function checkHooksAndHygiene(
  store: WorkspaceStore,
  harnesses: readonly HarnessId[],
  bootstrap: FactoryBootstrapConfig | undefined,
  findings: InitCheckFinding[],
): Promise<void> {
  const checkHooks = bootstrap ? bootstrap.hooks !== false : true;
  const checkGitignore = bootstrap ? bootstrap.gitignore !== false : true;
  const checkWorktreeInclude = bootstrap ? bootstrap.worktreeInclude !== false : true;
  const active = checkHooks ? ALL_HARNESSES.filter((h) => harnesses.includes(h)) : [];
  const [hookProbes, gitignoreProbe, worktreeProbe] = await Promise.all([
    Promise.all(
      active.map(async (h) => [h, await safeReadTarget(store, HOOK_CONFIG_PATHS[h])] as const),
    ),
    checkGitignore ? safeReadTarget(store, GITIGNORE_PATH) : Promise.resolve(undefined),
    checkWorktreeInclude
      ? safeReadTarget(store, WORKTREE_INCLUDE_PATH)
      : Promise.resolve(undefined),
  ]);
  for (const [harness, probe] of hookProbes) {
    if (!probe.ok) findings.push(probe.conflict);
    else findings.push(...checkHarnessHooksConfig(harness, probe.content));
  }
  if (gitignoreProbe) {
    checkDelimitedEntries(
      GITIGNORE_PATH,
      gitignoreProbe,
      MANDATORY_GITIGNORE_ENTRIES,
      ["gitignore_missing", "gitignore_block_missing", "gitignore_entries_missing"],
      "mandatory",
      findings,
    );
  }
  if (worktreeProbe) {
    checkDelimitedEntries(
      WORKTREE_INCLUDE_PATH,
      worktreeProbe,
      DEFAULT_WORKTREE_INCLUDE_ENTRIES,
      [
        "worktree_include_missing",
        "worktree_include_block_missing",
        "worktree_include_entries_missing",
      ],
      "default",
      findings,
    );
  }
}

function checkMissingConfigFields(
  parsedConfig: Record<string, unknown>,
  findings: InitCheckFinding[],
): void {
  if (!Array.isArray(parsedConfig.harnesses)) {
    const msg = `${CONFIG_RELATIVE_PATH} is missing explicit harnesses list.`;
    findings.push(configFinding("harnesses_missing", msg).finding);
  }
  const bootstrapRecord = isRecord(parsedConfig.bootstrap) ? parsedConfig.bootstrap : {};
  const missing = BOOTSTRAP_CAPABILITY_KEYS.filter(
    (key) => typeof bootstrapRecord[key] !== "boolean",
  );
  if (missing.length > 0) {
    const msg = `${CONFIG_RELATIVE_PATH} bootstrap is missing capability key(s): ${missing.join(", ")}.`;
    findings.push(configFinding("bootstrap_capability_missing", msg).finding);
  }
}

function resolveCheckHarness(options: RunInitCheckOptions, configHarness?: unknown): HarnessId {
  return resolveActiveRuntimeHarness({
    ...(options.harness ? { flag: options.harness } : {}),
    ...(configHarness !== undefined ? { configHarness } : {}),
    ...(options.env ? { env: options.env } : {}),
    ...(options.entrypointPath ? { entrypointPath: options.entrypointPath } : {}),
  });
}

export async function runInitCheck(
  store: WorkspaceStore,
  options: RunInitCheckOptions = {},
): Promise<CliResult> {
  const parsedResult = parseConfigForCheck(await safeReadTarget(store, CONFIG_RELATIVE_PATH));
  const activeHarness = resolveCheckHarness(
    options,
    parsedResult.ok ? parsedResult.config.harness : undefined,
  );
  if (!parsedResult.ok) {
    return buildCheckResult(
      [parsedResult.finding],
      [],
      activeHarness,
      { status: "missing" },
      options.strict,
    );
  }
  const parsedConfig = parsedResult.config;
  const profileCheck = await checkProjectProfileDrift(
    store,
    await safeReadTarget(store, PROJECT_PROFILE_RELATIVE_PATH),
  );
  const repoFindings: InitCheckFinding[] = [...profileCheck.findings];
  const resolvedCaps = resolveSyncCapabilities(parsedConfig, activeHarness);
  if (!resolvedCaps.ok) {
    repoFindings.push(resolvedCaps.conflict);
    return buildCheckResult(repoFindings, [], activeHarness, profileCheck.summary, options.strict);
  }
  const { harnesses: activeHarnesses, bootstrap: effectiveBootstrap } = resolvedCaps.value;
  checkMissingConfigFields(parsedConfig, repoFindings);
  const rawManaged = isRecord(parsedConfig.bootstrap)
    ? (parsedConfig.bootstrap as FactoryBootstrapConfig).managedPaths
    : undefined;
  const factoryBootstrap: FactoryBootstrapConfig = {
    ...effectiveBootstrap,
    ...(rawManaged ? { managedPaths: rawManaged } : {}),
  };
  const policies = parseFactoryPolicies(parsedConfig.factoryPolicies);
  const safeRead = (path: string) => safeReadTarget(store, path);
  const factory = await checkFactoryDrift(
    store,
    activeHarnesses,
    factoryBootstrap,
    policies,
    MAX_RULES_CONTENT_BYTES,
    safeRead,
  );
  repoFindings.push(...factory);
  await checkHooksAndHygiene(store, activeHarnesses, factoryBootstrap, repoFindings);
  const local = checkLocalCliPin(effectiveBootstrap.hooks, activeHarnesses, activeHarness, options);
  return buildCheckResult(repoFindings, local, activeHarness, profileCheck.summary, options.strict);
}
