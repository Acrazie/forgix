import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EscapeHatchFinding, HarnessId, HookEnforcementMode } from "../types.js";
import { DEFAULT_PROTECTED_SURFACES } from "./config.js";
import type {
  BlockedCommandRule,
  EscapeHatchPatternRule,
  FactoryBootstrapConfig,
  FactoryPoliciesConfig,
  FactoryRuleSpec,
} from "./factory-types.js";

const MAX_REGEX_PATTERN_LENGTH = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateSafeRegexPattern(
  pattern: string,
): { ok: true; regex: RegExp } | { ok: false; error: string } {
  if (!pattern || pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    return { ok: false, error: `Pattern must be 1..${MAX_REGEX_PATTERN_LENGTH} characters.` };
  }
  try {
    return { ok: true, regex: new RegExp(pattern) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid RegExp";
    return { ok: false, error: detail };
  }
}

function buildFactoryPoliciesObject(
  protectedSurfaces: string[],
  blockedCommands: BlockedCommandRule[],
  escapeHatchPatterns: EscapeHatchPatternRule[],
): FactoryPoliciesConfig | undefined {
  if (
    protectedSurfaces.length === 0 &&
    blockedCommands.length === 0 &&
    escapeHatchPatterns.length === 0
  ) {
    return undefined;
  }
  return {
    ...(protectedSurfaces.length > 0 ? { protectedSurfaces } : {}),
    ...(blockedCommands.length > 0 ? { blockedCommands } : {}),
    ...(escapeHatchPatterns.length > 0 ? { escapeHatchPatterns } : {}),
  };
}

function collectRuleEnforce(
  rule: FactoryRuleSpec,
  surfaces: Set<string>,
  commands: Map<string, BlockedCommandRule>,
  hatches: Map<string, EscapeHatchPatternRule>,
): void {
  const enforce = rule.enforce;
  if (!enforce) return;
  for (const surface of enforce.protectedSurfaces ?? []) surfaces.add(surface);
  for (const cmd of enforce.blockedCommands ?? []) {
    if (!commands.has(cmd.pattern)) {
      commands.set(cmd.pattern, { pattern: cmd.pattern, reason: cmd.reason });
    }
  }
  for (const hatch of enforce.escapeHatchPatterns ?? []) {
    const key = `${hatch.kind}\0${hatch.pattern}`;
    if (!hatches.has(key)) {
      hatches.set(key, { kind: hatch.kind, pattern: hatch.pattern });
    }
  }
}

export function compileFactoryPolicies(
  rules: readonly FactoryRuleSpec[],
): FactoryPoliciesConfig | undefined {
  const surfaces = new Set<string>();
  const commands = new Map<string, BlockedCommandRule>();
  const hatches = new Map<string, EscapeHatchPatternRule>();
  for (const rule of rules) collectRuleEnforce(rule, surfaces, commands, hatches);
  return buildFactoryPoliciesObject(
    [...surfaces].toSorted(),
    [...commands.values()].toSorted((a, b) => a.pattern.localeCompare(b.pattern)),
    [...hatches.values()].toSorted((a, b) =>
      `${a.kind}:${a.pattern}`.localeCompare(`${b.kind}:${b.pattern}`),
    ),
  );
}

function parseEntries<T>(
  value: unknown,
  extract: (entry: Record<string, unknown>) => T | undefined,
): T[] {
  if (!Array.isArray(value)) return [];
  const results: T[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const item = extract(entry);
    if (item) results.push(item);
  }
  return results;
}

export function parseFactoryPolicies(value: unknown): FactoryPoliciesConfig | undefined {
  if (!isRecord(value)) return undefined;
  const protectedSurfaces = Array.isArray(value.protectedSurfaces)
    ? value.protectedSurfaces.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : [];
  return buildFactoryPoliciesObject(
    protectedSurfaces,
    parseEntries(value.blockedCommands, (e) =>
      typeof e.pattern === "string" && typeof e.reason === "string"
        ? { pattern: e.pattern, reason: e.reason }
        : undefined,
    ),
    parseEntries(value.escapeHatchPatterns, (e) =>
      typeof e.kind === "string" && typeof e.pattern === "string"
        ? { kind: e.kind, pattern: e.pattern }
        : undefined,
    ),
  );
}

export function resolveEffectiveProtectedSurfaces(
  projectProtectedSurfaces: readonly string[],
  factoryPolicies?: FactoryPoliciesConfig,
): string[] {
  const base =
    projectProtectedSurfaces.length > 0 ? projectProtectedSurfaces : DEFAULT_PROTECTED_SURFACES;
  const extra = factoryPolicies?.protectedSurfaces ?? [];
  return extra.length === 0 ? [...base] : [...new Set([...base, ...extra])];
}

export function evaluateFactoryBlockedCommands(
  command: string,
  policies: FactoryPoliciesConfig | undefined,
  enforcement: HookEnforcementMode,
): { decision: "allow" | "warn" | "deny"; reason?: string } {
  const rules = policies?.blockedCommands ?? [];
  if (rules.length === 0) return { decision: "allow" };
  const hits: string[] = [];
  for (const rule of rules) {
    const compiled = validateSafeRegexPattern(rule.pattern);
    if (compiled.ok && compiled.regex.test(command)) hits.push(rule.reason);
  }
  if (hits.length === 0) return { decision: "allow" };
  return {
    decision: enforcement === "warn" ? "warn" : "deny",
    reason: `Forgix factory policy: ${hits.join(" ")}`,
  };
}

function isApprovedException(
  kind: string,
  file: string,
  lineText: string,
  approved: readonly string[],
): boolean {
  return approved.some(
    (entry) =>
      entry === kind ||
      entry === file ||
      entry === `${file}:${kind}` ||
      (entry.length > 0 && lineText.includes(entry)),
  );
}

interface AddedDiffLine {
  file: string;
  line: number;
  text: string;
}

function isDiffMetaLine(raw: string): boolean {
  return raw.startsWith("--- ") || raw.startsWith("diff --git ") || raw.startsWith("index ");
}

function parseTargetFile(raw: string): string {
  const target = raw.slice(4).trim();
  return target.startsWith("b/") ? target.slice(2) : target;
}

interface DiffCursor {
  file: string;
  lineNumber: number;
}

function stepDiffLine(
  raw: string,
  hasAdded: boolean,
  cursor: DiffCursor,
  result: AddedDiffLine[],
): void {
  if (raw.startsWith("+++ ")) {
    cursor.file = parseTargetFile(raw);
    return;
  }
  if (raw.startsWith("@@ ")) {
    const match = /\+(\d+)/.exec(raw);
    cursor.lineNumber = match ? Number(match[1]) - 1 : cursor.lineNumber;
    return;
  }
  if (isDiffMetaLine(raw)) return;
  if (hasAdded && !raw.startsWith("+")) {
    cursor.lineNumber += raw.startsWith("-") ? 0 : 1;
    return;
  }
  if (!hasAdded && raw.startsWith("-")) return;
  cursor.lineNumber += 1;
  result.push({ file: cursor.file, line: cursor.lineNumber, text: hasAdded ? raw.slice(1) : raw });
}

function extractAddedDiffLines(diffText: string): AddedDiffLine[] {
  const lines = diffText.split(/\r?\n/);
  const hasAdded = lines.some((line) => line.startsWith("+") && !line.startsWith("+++"));
  const result: AddedDiffLine[] = [];
  const cursor: DiffCursor = { file: "unknown", lineNumber: 0 };
  for (const raw of lines) stepDiffLine(raw, hasAdded, cursor, result);
  return result;
}

export function scanDiffForFactoryEscapeHatches(
  diffText: string,
  policies: FactoryPoliciesConfig | undefined,
  approvedExceptions: readonly string[] = [],
): EscapeHatchFinding[] {
  const rules = (policies?.escapeHatchPatterns ?? []).flatMap((rule) => {
    const compiled = validateSafeRegexPattern(rule.pattern);
    return compiled.ok ? [{ kind: rule.kind, regex: compiled.regex }] : [];
  });
  if (rules.length === 0 || !diffText.trim()) return [];
  const findings: EscapeHatchFinding[] = [];
  for (const entry of extractAddedDiffLines(diffText)) {
    for (const rule of rules) {
      if (
        rule.regex.test(entry.text) &&
        !isApprovedException(rule.kind, entry.file, entry.text, approvedExceptions)
      ) {
        findings.push({
          kind: rule.kind,
          pattern: rule.kind,
          file: entry.file,
          line: entry.line,
          snippet: entry.text.trim(),
        });
      }
    }
  }
  return findings;
}

export function detectFactorySessionDrift(
  workspaceRoot: string,
  harnesses: readonly HarnessId[],
  bootstrap: FactoryBootstrapConfig | undefined,
): string[] {
  const findings: string[] = [];
  const checkRules = bootstrap?.rules !== false;
  if (checkRules && existsSync(join(workspaceRoot, ".forgix", "rules.md"))) {
    findings.push("legacy .forgix/rules.md present");
  }
  for (const p of bootstrap?.managedPaths ?? []) {
    if (!existsSync(join(workspaceRoot, p))) findings.push(`missing ${p}`);
  }
  if (checkRules && harnesses.includes("codex")) {
    const p = join(workspaceRoot, "AGENTS.md");
    const c = existsSync(p) ? readFileSync(p, "utf8") : "";
    if (!c.includes("<!-- forgix:start -->") || !c.includes("<!-- forgix:end -->")) {
      findings.push("AGENTS.md missing forgix block");
    }
  }
  return findings;
}
