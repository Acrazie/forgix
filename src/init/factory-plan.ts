import { validateSafeRegexPattern } from "../core/factory-policy.js";
import type {
  FactoryArtifactKind,
  FactoryRuleSpec,
  FactorySelection,
} from "../core/factory-types.js";
import { ConfigValidationError } from "../core/schema.js";
import {
  FACTORY_ROOT_DIR,
  LEGACY_ANTIGRAVITY_RULES_POINTER_PATH,
  LEGACY_CANONICAL_RULES_PATH,
  LEGACY_CLAUDE_RULES_POINTER_PATH,
  canonicalAgentPath,
  canonicalRulePath,
  canonicalSkillPath,
  hasManagedMarker,
  isLegacyRulesPointer,
  renderAgentProjections,
  renderCanonicalAgent,
  renderCanonicalRule,
  renderCanonicalSkill,
  renderRuleProjections,
  renderSkillProjections,
} from "./factory-render.js";

export interface DesiredFactoryFile {
  path: string;
  content: string;
  isCanonical: boolean;
  kind: FactoryArtifactKind;
  id: string;
}

export interface FactoryReadProbe {
  ok: true;
  content: string | undefined;
  mode: number | undefined;
}

export interface FactoryConflict {
  path: string;
  code: string;
  message: string;
}

export type FactorySafeRead = (
  relativePath: string,
) => Promise<FactoryReadProbe | { ok: false; conflict: FactoryConflict }>;

export interface FactoryPlannedOp {
  path: string;
  existingContent: string | undefined;
  existingMode: number | undefined;
  nextContent: string | undefined;
}

function validateUniqueIdsAndBytes(
  label: string,
  items: ReadonlyArray<{ id: string; content: string }>,
  maxBytes: number,
): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new ConfigValidationError(`Duplicate ${label} "${item.id}".`, "init-bootstrap", []);
    }
    seen.add(item.id);
    if (Buffer.byteLength(item.content, "utf8") > maxBytes) {
      throw new ConfigValidationError(
        `${label} "${item.id}" exceeds ${maxBytes} bytes.`,
        "init-bootstrap",
        [],
      );
    }
  }
}

function validateRuleEnforcePatterns(rule: FactoryRuleSpec): void {
  const patterns: Array<[string, string]> = [
    ...(rule.enforce?.blockedCommands ?? []).map((c): [string, string] => [
      "blockedCommands",
      c.pattern,
    ]),
    ...(rule.enforce?.escapeHatchPatterns ?? []).map((h): [string, string] => [
      "escapeHatchPatterns",
      h.pattern,
    ]),
  ];
  for (const [field, pattern] of patterns) {
    const res = validateSafeRegexPattern(pattern);
    if (!res.ok) {
      throw new ConfigValidationError(
        `Invalid ${field} regex in "${rule.id}": ${res.error}`,
        "init-bootstrap",
        [],
      );
    }
  }
}

export function validateFactoryManifestSections(
  selection: FactorySelection,
  maxItemBytes: number,
): void {
  if (selection.rules.enabled) {
    const rules = selection.rules.items ?? [];
    validateUniqueIdsAndBytes("rule", rules, maxItemBytes);
    for (const rule of rules) validateRuleEnforcePatterns(rule);
  }
  if (selection.agents.enabled) {
    validateUniqueIdsAndBytes("agent", selection.agents.items ?? [], maxItemBytes);
  }
  if (selection.skills.enabled) {
    validateUniqueIdsAndBytes("skill", selection.skills.items ?? [], maxItemBytes);
  }
}

function addArtifactEntries(
  files: Map<string, DesiredFactoryFile>,
  canonical: DesiredFactoryFile,
  projections: ReadonlyArray<Omit<DesiredFactoryFile, "isCanonical">>,
): void {
  files.set(canonical.path, canonical);
  for (const proj of projections) files.set(proj.path, { ...proj, isCanonical: false });
}

export function buildDesiredFactoryFiles(selection: FactorySelection): {
  files: Map<string, DesiredFactoryFile>;
  managedPaths: string[];
} {
  const files = new Map<string, DesiredFactoryFile>();
  const { harnesses } = selection;

  const pushSection = <T extends { id: string }>(
    enabled: boolean,
    items: readonly T[] | undefined,
    kind: FactoryArtifactKind,
    pathOf: (id: string) => string,
    renderCan: (item: T) => string,
    renderProj: (item: T) => ReadonlyArray<Omit<DesiredFactoryFile, "isCanonical">>,
  ) => {
    if (!enabled) return;
    for (const item of items ?? []) {
      addArtifactEntries(
        files,
        { path: pathOf(item.id), content: renderCan(item), isCanonical: true, kind, id: item.id },
        renderProj(item),
      );
    }
  };
  pushSection(
    selection.rules.enabled,
    selection.rules.items,
    "rule",
    canonicalRulePath,
    renderCanonicalRule,
    (r) => renderRuleProjections(r, harnesses),
  );
  pushSection(
    selection.agents.enabled,
    selection.agents.items,
    "agent",
    canonicalAgentPath,
    renderCanonicalAgent,
    (a) => renderAgentProjections(a, harnesses),
  );
  pushSection(
    selection.skills.enabled,
    selection.skills.items,
    "skill",
    canonicalSkillPath,
    renderCanonicalSkill,
    (s) => renderSkillProjections(s, harnesses),
  );

  return { files, managedPaths: [...files.keys()].toSorted() };
}

function pushCollision(conflicts: FactoryConflict[], path: string, message: string): void {
  conflicts.push({ path, code: "unmanaged_file_collision", message });
}

function pushOp(
  operations: FactoryPlannedOp[],
  path: string,
  probe: FactoryReadProbe,
  nextContent: string | undefined,
): void {
  operations.push({ path, existingContent: probe.content, existingMode: probe.mode, nextContent });
}

async function planDesiredFiles(
  desiredList: readonly DesiredFactoryFile[],
  safeRead: FactorySafeRead,
  operations: FactoryPlannedOp[],
  conflicts: FactoryConflict[],
): Promise<void> {
  const probes = await Promise.all(
    desiredList.map(async (d) => [d, await safeRead(d.path)] as const),
  );
  for (const [desired, probe] of probes) {
    if (!probe.ok) conflicts.push(probe.conflict);
    else if (
      !desired.isCanonical &&
      probe.content !== undefined &&
      !hasManagedMarker(probe.content, desired.kind, desired.id)
    ) {
      pushCollision(conflicts, desired.path, `${desired.path} lacks Forgix ownership marker.`);
    } else {
      pushOp(operations, desired.path, probe, desired.content);
    }
  }
}

async function planStaleManagedRemovals(
  stalePaths: readonly string[],
  safeRead: FactorySafeRead,
  operations: FactoryPlannedOp[],
  conflicts: FactoryConflict[],
): Promise<void> {
  const probes = await Promise.all(stalePaths.map(async (p) => [p, await safeRead(p)] as const));
  for (const [stalePath, probe] of probes) {
    if (!probe.ok) conflicts.push(probe.conflict);
    else if (probe.content === undefined) continue;
    else if (!stalePath.startsWith(`${FACTORY_ROOT_DIR}/`) && !hasManagedMarker(probe.content)) {
      pushCollision(conflicts, stalePath, `${stalePath} lacks Forgix ownership marker.`);
    } else {
      pushOp(operations, stalePath, probe, undefined);
    }
  }
}

async function planLegacyRulesCleanup(
  safeRead: FactorySafeRead,
  operations: FactoryPlannedOp[],
  conflicts: FactoryConflict[],
): Promise<void> {
  const pointerPaths = [LEGACY_CLAUDE_RULES_POINTER_PATH, LEGACY_ANTIGRAVITY_RULES_POINTER_PATH];
  const [legacyCanonical, ...pointerProbes] = await Promise.all([
    safeRead(LEGACY_CANONICAL_RULES_PATH),
    ...pointerPaths.map((p) => safeRead(p)),
  ]);
  if (!legacyCanonical.ok) conflicts.push(legacyCanonical.conflict);
  else if (legacyCanonical.content !== undefined) {
    pushOp(operations, LEGACY_CANONICAL_RULES_PATH, legacyCanonical, undefined);
  }
  for (let i = 0; i < pointerPaths.length; i += 1) {
    const probe = pointerProbes[i]!;
    if (!probe.ok) conflicts.push(probe.conflict);
    else if (probe.content === undefined) continue;
    else if (!isLegacyRulesPointer(probe.content)) {
      pushCollision(
        conflicts,
        pointerPaths[i]!,
        `${pointerPaths[i]} is not a legacy Forgix pointer.`,
      );
    } else {
      pushOp(operations, pointerPaths[i]!, probe, undefined);
    }
  }
}

export async function planFactoryOperations(
  selection: FactorySelection,
  previousManagedPaths: readonly string[],
  safeRead: FactorySafeRead,
): Promise<{
  operations: FactoryPlannedOp[];
  conflicts: FactoryConflict[];
  managedPaths: string[];
}> {
  const { files, managedPaths } = buildDesiredFactoryFiles(selection);
  const operations: FactoryPlannedOp[] = [];
  const conflicts: FactoryConflict[] = [];
  const stalePaths = previousManagedPaths.filter((p) => !files.has(p));

  await planDesiredFiles([...files.values()], safeRead, operations, conflicts);
  await planStaleManagedRemovals(stalePaths, safeRead, operations, conflicts);
  await planLegacyRulesCleanup(safeRead, operations, conflicts);
  return { operations, conflicts, managedPaths };
}
