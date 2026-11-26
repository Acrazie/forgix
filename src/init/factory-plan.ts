import type { FactoryArtifactKind, FactorySelection } from "../core/factory-types.js";
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
  preview?: string;
}

export interface FactoryPlanOptions {
  adoptAll?: boolean;
  adoptPaths?: ReadonlySet<string>;
  renderPreview?: (path: string, previous: string | undefined, next: string | undefined) => string;
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

interface FactoryPlanContext {
  safeRead: FactorySafeRead;
  operations: FactoryPlannedOp[];
  conflicts: FactoryConflict[];
  options?: FactoryPlanOptions;
}

function shouldAdopt(path: string, options?: FactoryPlanOptions): boolean {
  return Boolean(options?.adoptAll || options?.adoptPaths?.has(path));
}

function pushCollision(
  ctx: FactoryPlanContext,
  path: string,
  message: string,
  prev: string | undefined,
  next: string | undefined,
): void {
  const preview = ctx.options?.renderPreview?.(path, prev, next);
  ctx.conflicts.push({
    path,
    code: "unmanaged_file_collision",
    message,
    ...(preview !== undefined ? { preview } : {}),
  });
}

function pushOp(
  ctx: FactoryPlanContext,
  path: string,
  probe: FactoryReadProbe,
  nextContent: string | undefined,
): void {
  ctx.operations.push({
    path,
    existingContent: probe.content,
    existingMode: probe.mode,
    nextContent,
  });
}

async function planDesiredFiles(
  desiredList: readonly DesiredFactoryFile[],
  ctx: FactoryPlanContext,
): Promise<void> {
  const probes = await Promise.all(
    desiredList.map(async (d) => [d, await ctx.safeRead(d.path)] as const),
  );
  for (const [desired, probe] of probes) {
    if (!probe.ok) ctx.conflicts.push(probe.conflict);
    else if (
      !desired.isCanonical &&
      probe.content !== undefined &&
      !hasManagedMarker(probe.content, desired.kind, desired.id) &&
      !shouldAdopt(desired.path, ctx.options)
    ) {
      pushCollision(
        ctx,
        desired.path,
        `${desired.path} lacks Forgix ownership marker.`,
        probe.content,
        desired.content,
      );
    } else {
      pushOp(ctx, desired.path, probe, desired.content);
    }
  }
}

async function planStaleManagedRemovals(
  stalePaths: readonly string[],
  ctx: FactoryPlanContext,
): Promise<void> {
  const probes = await Promise.all(
    stalePaths.map(async (p) => [p, await ctx.safeRead(p)] as const),
  );
  for (const [stalePath, probe] of probes) {
    if (!probe.ok) ctx.conflicts.push(probe.conflict);
    else if (probe.content === undefined) continue;
    else if (
      !stalePath.startsWith(`${FACTORY_ROOT_DIR}/`) &&
      !hasManagedMarker(probe.content) &&
      !shouldAdopt(stalePath, ctx.options)
    ) {
      pushCollision(
        ctx,
        stalePath,
        `${stalePath} lacks Forgix ownership marker.`,
        probe.content,
        undefined,
      );
    } else {
      pushOp(ctx, stalePath, probe, undefined);
    }
  }
}

async function planLegacyRulesCleanup(
  ctx: FactoryPlanContext,
  preserveLegacyCanonical: boolean,
): Promise<void> {
  const pointerPaths = [LEGACY_CLAUDE_RULES_POINTER_PATH, LEGACY_ANTIGRAVITY_RULES_POINTER_PATH];
  const [legacyCanonical, ...pointerProbes] = await Promise.all([
    ctx.safeRead(LEGACY_CANONICAL_RULES_PATH),
    ...pointerPaths.map((p) => ctx.safeRead(p)),
  ]);
  if (!legacyCanonical.ok) ctx.conflicts.push(legacyCanonical.conflict);
  else if (legacyCanonical.content !== undefined) {
    if (preserveLegacyCanonical) {
      ctx.conflicts.push({
        path: LEGACY_CANONICAL_RULES_PATH,
        code: "legacy_rules_migration_required",
        message: `Legacy ${LEGACY_CANONICAL_RULES_PATH} exists with no canonical rules in ${FACTORY_ROOT_DIR}/rules/; migrate via $forgix init before removing.`,
      });
    } else {
      pushOp(ctx, LEGACY_CANONICAL_RULES_PATH, legacyCanonical, undefined);
    }
  }
  for (let i = 0; i < pointerPaths.length; i += 1) {
    const probe = pointerProbes[i]!;
    const path = pointerPaths[i]!;
    if (!probe.ok) ctx.conflicts.push(probe.conflict);
    else if (probe.content === undefined) continue;
    else if (!isLegacyRulesPointer(probe.content) && !shouldAdopt(path, ctx.options)) {
      pushCollision(ctx, path, `${path} is not a legacy Forgix pointer.`, probe.content, undefined);
    } else {
      pushOp(ctx, path, probe, undefined);
    }
  }
}

export async function planFactoryOperations(
  selection: FactorySelection,
  previousManagedPaths: readonly string[],
  safeRead: FactorySafeRead,
  options?: FactoryPlanOptions,
): Promise<{
  operations: FactoryPlannedOp[];
  conflicts: FactoryConflict[];
  managedPaths: string[];
}> {
  const { files, managedPaths } = buildDesiredFactoryFiles(selection);
  const ctx: FactoryPlanContext = {
    safeRead,
    operations: [],
    conflicts: [],
    ...(options ? { options } : {}),
  };
  const stalePaths = previousManagedPaths.filter((p) => !files.has(p));
  await planDesiredFiles([...files.values()], ctx);
  await planStaleManagedRemovals(stalePaths, ctx);
  if (selection.rules.enabled) {
    const preserveLegacyCanonical = (selection.rules.items?.length ?? 0) === 0;
    await planLegacyRulesCleanup(ctx, preserveLegacyCanonical);
  }
  return { operations: ctx.operations, conflicts: ctx.conflicts, managedPaths };
}
