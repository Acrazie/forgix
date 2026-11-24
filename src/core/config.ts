import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { MODEL_COST_PROFILES } from "./routing.js";
import { ConfigValidationError, PolicyError, validateSchema } from "./schema.js";
import {
  TELEMETRY_RUNS_PATH,
  appendTelemetryEvent,
  globToRegex,
  proposeFactoryEvolution,
  readTelemetryEvents,
  redactTelemetryText,
  summarizeFactoryTelemetry,
} from "./store.js";
import type {
  EscapeHatchFinding,
  EscapeHatchScanResult,
  FactoryRunnerConfig,
  ProtectedSurfaceVerificationResult,
  ProtectedSurfaceViolation,
  SubscriptionConfig,
  SurfaceVerificationEvaluation,
  SurfaceVerificationRule,
  SurfaceVerificationViolation,
  VerifierKind,
} from "../types.js";

export {
  TELEMETRY_RUNS_PATH,
  appendTelemetryEvent,
  proposeFactoryEvolution,
  readTelemetryEvents,
  redactTelemetryText,
  summarizeFactoryTelemetry,
};

export interface ConfigSource {
  source: string;
  value: Record<string, unknown>;
}

interface LoadConfigOptions {
  cwd?: string;
  home?: string;
  flags?: Record<string, unknown>;
}

export interface ResolvedConfig {
  value: Record<string, unknown>;
  provenance: Record<string, string>;
}

export const DEFAULT_SUBSCRIPTION_CONFIG: SubscriptionConfig = {
  plan: "auto",
  quota: {
    warningPercent: 50,
    criticalPercent: 80,
    unknownPolicy: "conservative",
  },
  modelAllowlist: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"],
  modelCosts: MODEL_COST_PROFILES,
};

export const DEFAULT_RUNNER_CONFIG: FactoryRunnerConfig = {
  mode: "worktree",
  assureRunner: "auto",
};

export const DEFAULT_CONFIG: Record<string, unknown> = {
  schemaVersion: 1,
  worktree: { mode: "auto" },
  runner: DEFAULT_RUNNER_CONFIG,
  merge: "never",
  integrations: { plugins: [], skills: [] },
  subscription: DEFAULT_SUBSCRIPTION_CONFIG,
};

function validateConfigSource(value: Record<string, unknown>, source = "config"): void {
  const candidate = mergeForValidation(DEFAULT_CONFIG, value);
  const result = validateSchema("config", candidate);
  if (!result.valid) {
    const first = result.errors[0] as { instancePath?: string; message?: string } | undefined;
    throw new ConfigValidationError(
      `Invalid configuration from ${source} at ${first?.instancePath || "/"}: ${first?.message ?? "schema validation failed"}.`,
      source,
      result.errors,
    );
  }
}

export function loadConfigSources(options: LoadConfigOptions = {}): ConfigSource[] {
  const cwd = options.cwd ?? process.cwd();
  const home = options.home ?? process.env.HOME ?? "";
  const files: Array<{ source: string; path: string }> = [
    ...(home ? [{ source: "user", path: join(home, ".forgix", "config.yaml") }] : []),
    { source: "repo", path: join(cwd, ".forgix", "config.yaml") },
    { source: "local", path: join(cwd, ".forgix", "config.local.yaml") },
  ];
  const sources: ConfigSource[] = [];
  for (const file of files) {
    if (!existsSync(file.path)) continue;
    const parsed = parseYaml(readFileSync(file.path, "utf8")) as unknown;
    if (!isRecord(parsed)) {
      throw new ConfigValidationError(
        `Invalid configuration from ${file.source}: root must be an object.`,
        file.source,
        [],
      );
    }
    sources.push({ source: file.source, value: parsed });
  }
  if (options.flags) sources.push({ source: "flags", value: options.flags });
  return sources;
}

export function resolveConfig(sources: ConfigSource[]): ResolvedConfig {
  const suppliedDefaults = sources.some((source) => source.source === "defaults");
  const ordered = suppliedDefaults
    ? sources
    : [{ source: "defaults", value: DEFAULT_CONFIG }, ...sources];
  for (const source of ordered) validateConfigSource(source.value, source.source);
  const value: Record<string, unknown> = {};
  const provenance: Record<string, string> = {};
  for (const source of ordered) merge(value, source.value, source.source, provenance);
  return { value, provenance };
}

export function explainConfig(config: ResolvedConfig): {
  value: Record<string, unknown>;
  provenance: Record<string, string>;
} {
  return {
    value: copy(config.value) as Record<string, unknown>,
    provenance: { ...config.provenance },
  };
}

export interface PolicyInput {
  schemaVersion: number;
  requirements: Record<string, unknown>;
  prohibitions: Record<string, unknown>;
  bounds: Record<string, unknown>;
  locks: string[];
}

export function applyPolicy(config: ResolvedConfig, policy: PolicyInput): ResolvedConfig {
  for (const [path, requiredValue] of Object.entries(policy.requirements)) {
    if (readPath(config.value, path) !== requiredValue) {
      throw new PolicyError(
        `Policy requires ${path} to be ${JSON.stringify(requiredValue)}.`,
        path,
        config.provenance[path],
      );
    }
  }
  for (const [path, forbiddenValue] of Object.entries(policy.prohibitions)) {
    if (readPath(config.value, path) === forbiddenValue) {
      throw new PolicyError(
        `Policy prohibits ${path} from being ${JSON.stringify(forbiddenValue)}.`,
        path,
        config.provenance[path],
      );
    }
  }
  return config;
}

function mergeForValidation(
  base: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const output = copy(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(incoming)) {
    const current = output[key];
    if (isRecord(current) && isRecord(value)) output[key] = mergeForValidation(current, value);
    else output[key] = copy(value);
  }
  return output;
}

function merge(
  target: Record<string, unknown>,
  incoming: Record<string, unknown>,
  source: string,
  provenance: Record<string, string>,
  prefix = "",
): void {
  for (const [key, incomingValue] of Object.entries(incoming)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const targetValue = target[key];
    if (isRecord(targetValue) && isRecord(incomingValue)) {
      merge(targetValue, incomingValue, source, provenance, path);
      continue;
    }
    target[key] = copy(incomingValue);
    recordLeaves(incomingValue, source, provenance, path);
  }
}

function recordLeaves(
  value: unknown,
  source: string,
  provenance: Record<string, string>,
  prefix: string,
): void {
  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      recordLeaves(nested, source, provenance, prefix ? `${prefix}.${key}` : key);
    }
    return;
  }
  provenance[prefix] = source;
}

function readPath(value: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function copy(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copy);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copy(entry)]));
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const DEFAULT_PROTECTED_SURFACES: readonly string[] = [
  "docs/golden-rules.md",
  ".fallowrc.json",
  "fallow-baselines/**",
  "fallow-rules/**",
  "vite.config.ts",
  "bunfig.toml",
  "test/artifact-budget.json",
  ".forgix/config.yaml",
  ".forgix/policy.yaml",
  ".forgix/project.yaml",
  ".vite-hooks/**",
  ".dagger/**",
  ".buildkite/pipeline.yml",
  "formal/**/*.tla",
  "formal/**/*.cfg",
  "formal/**/*.lean",
];

export const DEFAULT_SURFACE_VERIFICATION_RULES: readonly SurfaceVerificationRule[] = [
  {
    id: "runtime-packaging-surface",
    pathGlobs: ["src/**", "scripts/build.mjs"],
    requiredVerifierKinds: ["runtime-evidence"],
    requiredCommands: ["bun run pack:runtime", "bun run test:runtime"],
  },
  {
    id: "formal-tla-surface",
    pathGlobs: ["formal/**/*.tla", "formal/**/*.cfg"],
    requiredVerifierKinds: ["tla-tlc"],
    requiredCommands: ["bun test test/unit/formal-kernel.test.ts"],
  },
  {
    id: "formal-lean-surface",
    pathGlobs: ["formal/**/*.lean"],
    requiredVerifierKinds: ["lean4"],
    requiredCommands: ["bun test test/unit/formal-kernel.test.ts"],
  },
];

const hatchRule = (parts: string[], pattern: RegExp, sep = "") => ({
  kind: parts.join(sep),
  pattern,
});

const ESCAPE_HATCH_RULES: ReadonlyArray<{ kind: string; pattern: RegExp }> = [
  hatchRule(["oxlint", "disable"], /\boxlint[-]disable(?:-(?:next-)?line)?\b/, "-"),
  hatchRule(["eslint", "disable"], /\beslint[-]disable(?:-(?:next-)?line)?\b/, "-"),
  hatchRule(["@ts", "ignore"], /@ts[-]ignore\b/, "-"),
  hatchRule(["@ts", "expect", "error"], /@ts[-]expect[-]error\b/, "-"),
  hatchRule(["@ts", "nocheck"], /@ts[-]nocheck\b/, "-"),
  hatchRule(["fallow", "ignore"], /\bfallow[-]ignore\b/, "-"),
  hatchRule(["@expected", "unused"], /@expected[-]unused\b/, "-"),
  hatchRule(["as", "any"], /\bas[\s]+an[y]\b/, " "),
  hatchRule(["as", "unknown", "as"], /\bas[\s]+unknown[\s]+as\b/, " "),
  hatchRule([".sk", "ip("], /[.](?:sk[i]p)\s*\(/),
  hatchRule([".to", "do("], /[.](?:to[d]o)\s*\(/),
  hatchRule(["sor", "ry"], /\bsor[r]y\b/),
  hatchRule(["adm", "it"], /\badm[i]t\b/),
  hatchRule(["unsa", "fe"], /\bunsaf[e]\b/),
  hatchRule(["axi", "om"], /\baxio[m]\b/),
  hatchRule(["CHECK_DEADLOCK", "FALSE"], /\bCHECK_DEADLOCK[\s]+FALS[E]\b/, " "),
];

function isEscapeHatchApproved(
  kind: string,
  file: string,
  lineText: string,
  approvedExceptions: readonly string[],
): boolean {
  const shortKind = kind.replace(/\($/, "");
  return approvedExceptions.some(
    (entry) =>
      entry === kind ||
      entry === shortKind ||
      entry === file ||
      entry === `${file}:${kind}` ||
      entry === `${file}:${shortKind}` ||
      (entry.length > 0 && lineText.includes(entry)),
  );
}

export function scanDiffForEscapeHatches(
  diffText: string,
  approvedExceptions: readonly string[] = [],
): EscapeHatchScanResult {
  const lines = diffText.split(/\r?\n/);
  const hasAddedMarkers = lines.some((line) => line.startsWith("+") && !line.startsWith("+++"));
  const findings: EscapeHatchFinding[] = [];
  let currentFile = "unknown";
  let lineNumber = 0;

  for (const rawLine of lines) {
    if (rawLine.startsWith("+++ ")) {
      const target = rawLine.slice(4).trim();
      currentFile = target.startsWith("b/") ? target.slice(2) : target;
      continue;
    }
    if (
      rawLine.startsWith("--- ") ||
      rawLine.startsWith("diff --git ") ||
      rawLine.startsWith("index ")
    ) {
      continue;
    }
    if (rawLine.startsWith("@@ ")) {
      const match = /\+(\d+)/.exec(rawLine);
      lineNumber = match ? Number(match[1]) - 1 : lineNumber;
      continue;
    }
    if (hasAddedMarkers) {
      if (!rawLine.startsWith("+")) {
        if (!rawLine.startsWith("-")) lineNumber += 1;
        continue;
      }
      lineNumber += 1;
      const content = rawLine.slice(1);
      for (const rule of ESCAPE_HATCH_RULES) {
        if (
          rule.pattern.test(content) &&
          !isEscapeHatchApproved(rule.kind, currentFile, content, approvedExceptions)
        ) {
          findings.push({
            kind: rule.kind,
            pattern: rule.kind,
            file: currentFile,
            line: lineNumber,
            snippet: content.trim(),
          });
        }
      }
    } else {
      lineNumber += 1;
      if (rawLine.startsWith("-")) continue;
      for (const rule of ESCAPE_HATCH_RULES) {
        if (
          rule.pattern.test(rawLine) &&
          !isEscapeHatchApproved(rule.kind, currentFile, rawLine, approvedExceptions)
        ) {
          findings.push({
            kind: rule.kind,
            pattern: rule.kind,
            file: currentFile,
            line: lineNumber,
            snippet: rawLine.trim(),
          });
        }
      }
    }
  }

  return {
    clean: findings.length === 0,
    passed: findings.length === 0,
    findings,
    violations: findings,
  };
}

function normalizeRepoPath(path: string): string {
  return path
    .replaceAll("\\", "/")
    .replace(/^(?:\.\/|\/)+/, "")
    .replace(/\/+$/, "");
}

function compileRepoGlob(rawGlob: string): RegExp {
  const normalized = normalizeRepoPath(rawGlob);
  return globToRegex(rawGlob.endsWith("/") ? `${normalized}/**` : normalized);
}

function matchesRepoGlob(path: string, glob: string): boolean {
  const cleanPath = normalizeRepoPath(path);
  const cleanGlob = normalizeRepoPath(glob);
  if (!cleanPath || !cleanGlob) return false;
  if (cleanPath === cleanGlob) return true;
  if (glob.endsWith("/") && cleanPath.startsWith(`${cleanGlob}/`)) return true;
  return compileRepoGlob(glob).test(cleanPath);
}

export function verifyProtectedSurfaces(
  changedPaths: readonly string[],
  protectedGlobs: readonly string[] = DEFAULT_PROTECTED_SURFACES,
  approvedPaths: readonly string[] = [],
): ProtectedSurfaceVerificationResult {
  const effectiveGlobs = protectedGlobs.length > 0 ? protectedGlobs : DEFAULT_PROTECTED_SURFACES;
  const protectedPaths: string[] = [];
  const unapprovedPaths: string[] = [];
  const violations: ProtectedSurfaceViolation[] = [];

  for (const rawPath of changedPaths) {
    const path = normalizeRepoPath(rawPath);
    if (!path) continue;
    const matchedGlob = effectiveGlobs.find((glob) => matchesRepoGlob(path, glob));
    if (!matchedGlob) continue;
    protectedPaths.push(path);
    const isApproved = approvedPaths.some((approved) => matchesRepoGlob(path, approved));
    if (!isApproved) {
      unapprovedPaths.push(path);
      violations.push({ path, matchedGlob });
    }
  }

  return {
    allowed: violations.length === 0,
    passed: violations.length === 0,
    clean: violations.length === 0,
    protectedPaths,
    unapprovedPaths,
    violations,
  };
}

function isCommandSatisfied(requiredCmd: string, executedCommands: readonly string[]): boolean {
  const trimmed = requiredCmd.trim();
  if (!trimmed) return true;
  if (executedCommands.some((exec) => exec.trim() === trimmed || exec.includes(trimmed))) {
    return true;
  }
  if (trimmed.includes("&&")) {
    const parts = trimmed
      .split("&&")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 0 && parts.every((part) => isCommandSatisfied(part, executedCommands));
  }
  return false;
}

export function evaluateSurfaceVerificationRules(
  changedPaths: readonly string[],
  rules: readonly SurfaceVerificationRule[] = DEFAULT_SURFACE_VERIFICATION_RULES,
  executedCommands: readonly string[] = [],
  executedVerifiers: readonly string[] = [],
): SurfaceVerificationEvaluation {
  const effectiveRules = rules.length > 0 ? rules : DEFAULT_SURFACE_VERIFICATION_RULES;
  const normalizedPaths = changedPaths.map(normalizeRepoPath).filter(Boolean);
  const verifierSet = new Set(executedVerifiers);
  const matchedRuleIds: string[] = [];
  const requiredVerifierKinds = new Set<VerifierKind>();
  const requiredCommands = new Set<string>();
  const missingVerifierKinds = new Set<VerifierKind>();
  const missingCommands = new Set<string>();
  const violations: SurfaceVerificationViolation[] = [];

  for (const rule of effectiveRules) {
    const matchedPaths = normalizedPaths.filter((path) =>
      rule.pathGlobs.some((glob) => matchesRepoGlob(path, glob)),
    );
    if (matchedPaths.length === 0) continue;

    matchedRuleIds.push(rule.id);
    const ruleMissingVerifiers: VerifierKind[] = [];
    const ruleMissingCommands: string[] = [];

    for (const kind of rule.requiredVerifierKinds) {
      requiredVerifierKinds.add(kind);
      if (!verifierSet.has(kind)) {
        missingVerifierKinds.add(kind);
        ruleMissingVerifiers.push(kind);
      }
    }
    for (const cmd of rule.requiredCommands) {
      requiredCommands.add(cmd);
      if (!isCommandSatisfied(cmd, executedCommands)) {
        missingCommands.add(cmd);
        ruleMissingCommands.push(cmd);
      }
    }

    if (ruleMissingVerifiers.length > 0 || ruleMissingCommands.length > 0) {
      violations.push({
        ruleId: rule.id,
        matchedPaths,
        missingVerifierKinds: ruleMissingVerifiers,
        missingCommands: ruleMissingCommands,
      });
    }
  }

  return {
    passed: violations.length === 0,
    clean: violations.length === 0,
    matchedRuleIds,
    requiredVerifierKinds: [...requiredVerifierKinds],
    requiredCommands: [...requiredCommands],
    missingVerifierKinds: [...missingVerifierKinds],
    missingCommands: [...missingCommands],
    violations,
  };
}
