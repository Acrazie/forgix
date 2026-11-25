import { stringify as stringifyYaml } from "yaml";
import type {
  FactoryAgentSpec,
  FactoryArtifactKind,
  FactoryRuleSpec,
  FactorySelection,
  FactorySkillSpec,
} from "../core/factory-types.js";
import type { HarnessId } from "../types.js";

export const LEGACY_CANONICAL_RULES_PATH = ".forgix/rules.md";
export const LEGACY_CLAUDE_RULES_POINTER_PATH = ".claude/rules/forgix.md";
export const LEGACY_ANTIGRAVITY_RULES_POINTER_PATH = ".agents/rules/forgix.md";
export const FACTORY_ROOT_DIR = ".forgix/factory";

const MANAGED_MARKER_REGEX =
  /^<!-- forgix:managed kind="(rule|agent|skill)" id="([a-z0-9-]+)" source="([^"]+)" -->$/m;

function renderFrontmatterDocument(
  frontmatter: Record<string, unknown>,
  body: string,
  marker?: string,
): string {
  const yamlBlock = stringifyYaml(frontmatter).trimEnd();
  const trimmedBody = body.trimEnd();
  const header = marker ? `---\n${yamlBlock}\n---\n${marker}\n\n` : `---\n${yamlBlock}\n---\n\n`;
  return `${header}${trimmedBody}\n`;
}

export function canonicalRulePath(id: string): string {
  return `${FACTORY_ROOT_DIR}/rules/${id}.md`;
}

export function canonicalAgentPath(id: string): string {
  return `${FACTORY_ROOT_DIR}/agents/${id}.md`;
}

export function canonicalSkillPath(id: string): string {
  return `${FACTORY_ROOT_DIR}/skills/${id}/SKILL.md`;
}

function formatManagedMarker(kind: FactoryArtifactKind, id: string, source: string): string {
  return `<!-- forgix:managed kind="${kind}" id="${id}" source="${source}" -->`;
}

export function hasManagedMarker(
  content: string,
  expectedKind?: FactoryArtifactKind,
  expectedId?: string,
): boolean {
  const match = MANAGED_MARKER_REGEX.exec(content);
  if (!match) return false;
  if (expectedKind && match[1] !== expectedKind) return false;
  if (expectedId && match[2] !== expectedId) return false;
  return true;
}

export function isLegacyRulesPointer(content: string): boolean {
  return (
    content.startsWith("# Forgix Workflow Rules\n") &&
    content.includes("`.forgix/rules.md`") &&
    content.includes("`$forgix init`")
  );
}

export function renderCanonicalRule(rule: FactoryRuleSpec): string {
  const frontmatter: Record<string, unknown> = {
    id: rule.id,
    description: rule.description,
    ...(rule.globs && rule.globs.length > 0 ? { globs: rule.globs } : {}),
    ...(rule.alwaysApply !== undefined ? { alwaysApply: rule.alwaysApply } : {}),
    ...(rule.enforce ? { enforce: rule.enforce } : {}),
  };
  return renderFrontmatterDocument(frontmatter, rule.content);
}

function buildAgentFrontmatter(
  agent: FactoryAgentSpec,
  includeId: boolean,
): Record<string, unknown> {
  return {
    ...(includeId ? { id: agent.id } : {}),
    name: agent.name,
    description: agent.description,
    ...(agent.role ? { role: agent.role } : {}),
    ...(agent.tools && agent.tools.length > 0 ? { tools: agent.tools } : {}),
    ...(agent.model ? { model: agent.model } : {}),
  };
}

export function renderCanonicalAgent(agent: FactoryAgentSpec): string {
  return renderFrontmatterDocument(buildAgentFrontmatter(agent, true), agent.content);
}

export function renderCanonicalSkill(skill: FactorySkillSpec): string {
  return renderFrontmatterDocument(
    { name: skill.name, description: skill.description },
    skill.content,
  );
}

export interface RenderedProjection {
  path: string;
  kind: FactoryArtifactKind;
  id: string;
  content: string;
}

export function renderRuleProjections(
  rule: FactoryRuleSpec,
  harnesses: readonly HarnessId[],
): RenderedProjection[] {
  const marker = formatManagedMarker("rule", rule.id, canonicalRulePath(rule.id));
  const globs = rule.globs && rule.globs.length > 0 ? rule.globs : undefined;
  const results: RenderedProjection[] = [];
  if (harnesses.includes("claude")) {
    results.push({
      path: `.claude/rules/forgix-${rule.id}.md`,
      kind: "rule",
      id: rule.id,
      content: renderFrontmatterDocument(
        { description: rule.description, ...(globs ? { paths: globs } : {}) },
        rule.content,
        marker,
      ),
    });
  }
  if (harnesses.includes("antigravity")) {
    results.push({
      path: `.agents/rules/forgix-${rule.id}.md`,
      kind: "rule",
      id: rule.id,
      content: renderFrontmatterDocument(
        {
          trigger: globs ? "glob" : "always_on",
          description: rule.description,
          ...(globs ? { globs } : {}),
        },
        rule.content,
        marker,
      ),
    });
  }
  return results;
}

export function renderAgentProjections(
  agent: FactoryAgentSpec,
  harnesses: readonly HarnessId[],
): RenderedProjection[] {
  const marker = formatManagedMarker("agent", agent.id, canonicalAgentPath(agent.id));
  const content = renderFrontmatterDocument(
    buildAgentFrontmatter(agent, false),
    agent.content,
    marker,
  );
  const dirs: ReadonlyArray<[HarnessId, string]> = [
    ["claude", ".claude/agents"],
    ["antigravity", ".agents/agents"],
    ["codex", ".codex/agents"],
  ];
  return dirs
    .filter(([h]) => harnesses.includes(h))
    .map(([, dir]) => ({
      path: `${dir}/forgix-${agent.id}.md`,
      kind: "agent" as const,
      id: agent.id,
      content,
    }));
}

export function renderSkillProjections(
  skill: FactorySkillSpec,
  harnesses: readonly HarnessId[],
): RenderedProjection[] {
  const marker = formatManagedMarker("skill", skill.id, canonicalSkillPath(skill.id));
  const content = renderFrontmatterDocument(
    { name: skill.name, description: skill.description },
    skill.content,
    marker,
  );
  const paths: string[] = [];
  if (harnesses.includes("claude")) paths.push(`.claude/skills/forgix-${skill.id}/SKILL.md`);
  if (harnesses.includes("antigravity") || harnesses.includes("codex")) {
    paths.push(`.agents/skills/forgix-${skill.id}/SKILL.md`);
  }
  return paths.map((path) => ({ path, kind: "skill" as const, id: skill.id, content }));
}

export function renderCodexAgentsIndexBlock(selection: FactorySelection): string {
  const lines = [
    "# Forgix Factory",
    "",
    "Canonical source: `.forgix/factory/` and `.forgix/project.yaml`. Reconcile with `$forgix init`.",
  ];
  const groups: ReadonlyArray<
    [string, ReadonlyArray<{ id: string; description: string }> | undefined, (id: string) => string]
  > = [
    ["Rules", selection.rules.enabled ? selection.rules.items : undefined, canonicalRulePath],
    ["Agents", selection.agents.enabled ? selection.agents.items : undefined, canonicalAgentPath],
    ["Skills", selection.skills.enabled ? selection.skills.items : undefined, canonicalSkillPath],
  ];
  for (const [title, items, pathOf] of groups) {
    if (!items?.length) continue;
    lines.push("", `## ${title}`, ...items.map((i) => `- \`${pathOf(i.id)}\`: ${i.description}`));
  }
  return lines.join("\n");
}
