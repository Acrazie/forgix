import { compileFactoryPolicies } from "../core/factory-policy.js";
import type {
  FactoryBootstrapConfig,
  FactoryPoliciesConfig,
  FactorySelection,
} from "../core/factory-types.js";
import type { WorkspaceStore } from "../core/store.js";
import type { HarnessId } from "../types.js";
import {
  buildDesiredFactoryFiles,
  type DesiredFactoryFile,
  type FactorySafeRead,
} from "./factory-plan.js";
import {
  LEGACY_ANTIGRAVITY_RULES_POINTER_PATH,
  LEGACY_CANONICAL_RULES_PATH,
  LEGACY_CLAUDE_RULES_POINTER_PATH,
  isLegacyRulesPointer,
  renderCodexAgentsIndexBlock,
} from "./factory-render.js";
import {
  loadCanonicalAgents,
  loadCanonicalRules,
  loadCanonicalSkills,
  type FactoryCheckFinding,
} from "./factory-scan.js";
import { HTML_FORGIX_MARKERS, inspectMarkerBlock } from "./markers.js";

const CODEX_AGENTS_PATH = "AGENTS.md";

async function checkLegacyRulesDrift(
  safeRead: FactorySafeRead,
  findings: FactoryCheckFinding[],
): Promise<void> {
  const pointerPaths = [LEGACY_CLAUDE_RULES_POINTER_PATH, LEGACY_ANTIGRAVITY_RULES_POINTER_PATH];
  const [legacy, ...pointerProbes] = await Promise.all([
    safeRead(LEGACY_CANONICAL_RULES_PATH),
    ...pointerPaths.map((p) => safeRead(p)),
  ]);
  if (!legacy.ok) findings.push(legacy.conflict);
  else if (legacy.content !== undefined) {
    findings.push({
      path: LEGACY_CANONICAL_RULES_PATH,
      code: "legacy_rules_present",
      message: `Legacy ${LEGACY_CANONICAL_RULES_PATH} present.`,
    });
  }
  for (let i = 0; i < pointerPaths.length; i += 1) {
    const probe = pointerProbes[i]!;
    if (probe.ok && probe.content !== undefined && isLegacyRulesPointer(probe.content)) {
      findings.push({
        path: pointerPaths[i]!,
        code: "legacy_rules_present",
        message: `Legacy ${pointerPaths[i]} present.`,
      });
    }
  }
}

async function checkProjectionsAndOrphans(
  files: ReadonlyMap<string, DesiredFactoryFile>,
  managedPaths: readonly string[],
  safeRead: FactorySafeRead,
  findings: FactoryCheckFinding[],
): Promise<void> {
  const projections = [...files.values()].filter((desired) => !desired.isCanonical);
  const probes = await Promise.all(
    projections.map(async (desired) => [desired, await safeRead(desired.path)] as const),
  );
  for (const [desired, probe] of probes) {
    if (!probe.ok) findings.push(probe.conflict);
    else if (probe.content !== desired.content) {
      findings.push({
        path: desired.path,
        code:
          probe.content === undefined ? "factory_projection_missing" : "factory_projection_drift",
        message: `${desired.path} drifted.`,
      });
    }
  }
  for (const managedPath of managedPaths) {
    if (!files.has(managedPath)) {
      findings.push({
        path: managedPath,
        code: "factory_orphan_managed_path",
        message: `${managedPath} is orphaned.`,
      });
    }
  }
}

async function checkCodexIndexDrift(
  selection: FactorySelection,
  safeRead: FactorySafeRead,
  findings: FactoryCheckFinding[],
): Promise<void> {
  const agentsProbe = await safeRead(CODEX_AGENTS_PATH);
  const expectedInner = `${renderCodexAgentsIndexBlock(selection)}\n`;
  if (!agentsProbe.ok) {
    findings.push(agentsProbe.conflict);
    return;
  }
  if (agentsProbe.content === undefined) {
    findings.push({
      path: CODEX_AGENTS_PATH,
      code: "rules_pointer_missing",
      message: `${CODEX_AGENTS_PATH} missing Forgix block.`,
    });
    return;
  }
  const inspection = inspectMarkerBlock(agentsProbe.content, HTML_FORGIX_MARKERS);
  if (inspection.status === "conflict") {
    findings.push({ path: CODEX_AGENTS_PATH, ...inspection.conflict });
  } else if (inspection.status === "absent" || inspection.innerContent !== expectedInner) {
    findings.push({
      path: CODEX_AGENTS_PATH,
      code: inspection.status === "absent" ? "rules_pointer_missing" : "rules_pointer_drift",
      message: `${CODEX_AGENTS_PATH} Forgix block drifted.`,
    });
  }
}

function checkPolicy(
  rules: Parameters<typeof compileFactoryPolicies>[0],
  cfg: FactoryPoliciesConfig | undefined,
  findings: FactoryCheckFinding[],
): void {
  if (JSON.stringify(compileFactoryPolicies(rules) ?? {}) !== JSON.stringify(cfg ?? {})) {
    findings.push({
      path: ".forgix/config.yaml",
      code: "factory_policy_drift",
      message: "factoryPolicies out of sync.",
    });
  }
}

export async function checkFactoryDrift(
  store: WorkspaceStore,
  harnesses: readonly HarnessId[],
  bootstrap: FactoryBootstrapConfig | undefined,
  configPolicies: FactoryPoliciesConfig | undefined,
  maxItemBytes: number,
  safeRead: FactorySafeRead,
): Promise<FactoryCheckFinding[]> {
  const findings: FactoryCheckFinding[] = [];
  const checkRules = bootstrap ? bootstrap.rules === true : true;
  const checkAgents = bootstrap?.agents === true;
  const checkSkills = bootstrap?.skills === true;

  if (checkRules) await checkLegacyRulesDrift(safeRead, findings);

  const [rules, agents, skills] = await Promise.all([
    checkRules ? loadCanonicalRules(store, maxItemBytes, safeRead, findings) : Promise.resolve([]),
    checkAgents ? loadCanonicalAgents(store, safeRead, findings) : Promise.resolve([]),
    checkSkills ? loadCanonicalSkills(store, safeRead, findings) : Promise.resolve([]),
  ]);
  const selection: FactorySelection = {
    harnesses,
    rules: { enabled: checkRules, items: rules },
    agents: { enabled: checkAgents, items: agents },
    skills: { enabled: checkSkills, items: skills },
  };
  checkPolicy(rules, configPolicies, findings);
  const { files } = buildDesiredFactoryFiles(selection);
  await checkProjectionsAndOrphans(files, bootstrap?.managedPaths ?? [], safeRead, findings);
  if ((checkRules || checkAgents || checkSkills) && harnesses.includes("codex")) {
    await checkCodexIndexDrift(selection, safeRead, findings);
  }
  return findings;
}
