import { parse as parseYaml } from "yaml";
import { parseFactoryPolicies } from "../core/factory-policy.js";
import type { FactoryAgentSpec, FactoryRuleSpec, FactorySkillSpec } from "../core/factory-types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return list.length > 0 ? list : undefined;
}

function splitFrontmatter(
  raw: string,
): { frontmatter: Record<string, unknown>; body: string } | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!match) return undefined;
  try {
    const parsed: unknown = parseYaml(match[1]!);
    if (!isRecord(parsed)) return undefined;
    return { frontmatter: parsed, body: match[2]!.trim() };
  } catch {
    return undefined;
  }
}

function parseIdentifiedDocument(
  raw: string,
  expectedId: string,
  label: string,
):
  | { ok: true; fm: Record<string, unknown>; description: string; body: string }
  | { ok: false; message: string } {
  const split = splitFrontmatter(raw);
  if (!split || !split.body) return { ok: false, message: "Invalid frontmatter or body." };
  const { frontmatter: fm, body } = split;
  if (fm.id !== expectedId || typeof fm.description !== "string" || !fm.description.trim()) {
    return { ok: false, message: `${label} requires id "${expectedId}" and description.` };
  }
  return { ok: true, fm, description: fm.description, body };
}

export function parseCanonicalRule(
  raw: string,
  expectedId: string,
): { ok: true; rule: FactoryRuleSpec } | { ok: false; message: string } {
  const doc = parseIdentifiedDocument(raw, expectedId, "Rule");
  if (!doc.ok) return doc;
  const globs = nonEmptyStrings(doc.fm.globs);
  const enforce = parseFactoryPolicies(doc.fm.enforce);
  return {
    ok: true,
    rule: {
      id: expectedId,
      description: doc.description,
      ...(globs ? { globs } : {}),
      ...(typeof doc.fm.alwaysApply === "boolean" ? { alwaysApply: doc.fm.alwaysApply } : {}),
      ...(enforce ? { enforce } : {}),
      content: doc.body,
    },
  };
}

export function parseCanonicalAgent(
  raw: string,
  expectedId: string,
): { ok: true; agent: FactoryAgentSpec } | { ok: false; message: string } {
  const doc = parseIdentifiedDocument(raw, expectedId, "Agent");
  if (!doc.ok) return doc;
  if (typeof doc.fm.name !== "string" || !doc.fm.name.trim()) {
    return { ok: false, message: "Agent frontmatter must declare non-empty name." };
  }
  const tools = nonEmptyStrings(doc.fm.tools);
  return {
    ok: true,
    agent: {
      id: expectedId,
      name: doc.fm.name,
      description: doc.description,
      ...(typeof doc.fm.role === "string" && doc.fm.role ? { role: doc.fm.role } : {}),
      ...(tools ? { tools } : {}),
      ...(typeof doc.fm.model === "string" && doc.fm.model ? { model: doc.fm.model } : {}),
      content: doc.body,
    },
  };
}

export function parseCanonicalSkill(
  raw: string,
  expectedId: string,
): { ok: true; skill: FactorySkillSpec } | { ok: false; message: string } {
  const split = splitFrontmatter(raw);
  if (!split?.body) return { ok: false, message: "Invalid frontmatter." };
  const { frontmatter: fm, body } = split;
  if (
    typeof fm.name !== "string" ||
    !fm.name.trim() ||
    typeof fm.description !== "string" ||
    !fm.description.trim()
  ) {
    return { ok: false, message: "Skill requires name and description." };
  }
  return {
    ok: true,
    skill: { id: expectedId, name: fm.name, description: fm.description, content: body },
  };
}
