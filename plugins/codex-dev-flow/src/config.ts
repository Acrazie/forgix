import { Ajv2020 } from "ajv/dist/2020.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { EXIT_CODES } from "./exit-codes.js";
import { MODEL_COST_PROFILES } from "./routing.js";
import type { SubscriptionConfig } from "./types.js";

export interface ConfigSource {
  source: string;
  value: Record<string, unknown>;
}

export interface LoadConfigOptions {
  cwd?: string;
  home?: string;
  flags?: Record<string, unknown>;
}

export interface ResolvedConfig {
  value: Record<string, unknown>;
  provenance: Record<string, string>;
}

export class ConfigValidationError extends Error {
  readonly exitCode = EXIT_CODES.INVALID_CONFIGURATION;

  constructor(
    message: string,
    readonly source: string,
    readonly errors: unknown[],
  ) {
    super(message);
  }
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

export const DEFAULT_CONFIG: Record<string, unknown> = {
  schemaVersion: 1,
  worktree: { mode: "auto" },
  merge: "never",
  integrations: { plugins: [], skills: [] },
  subscription: DEFAULT_SUBSCRIPTION_CONFIG,
};

type SchemaName = "config" | "policy" | "state";

export interface SchemaValidationResult {
  valid: boolean;
  errors: unknown[];
}

export function validateSchema(name: SchemaName, value: unknown): SchemaValidationResult {
  const schema = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../schemas/" + name + ".schema.json", import.meta.url)),
      "utf8",
    ),
  ) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const valid = validate(value);
  return { valid, errors: validate.errors ? [...validate.errors] : [] };
}

export function validateConfigSource(value: Record<string, unknown>, source = "config"): void {
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
    { source: "user", path: join(home, ".codex", "dev-flow.yaml") },
    { source: "repo", path: join(cwd, ".codex", "dev-flow.yaml") },
    { source: "local", path: join(cwd, ".codex", "dev-flow.local.yaml") },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function copy(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copy);
  if (isRecord(value))
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copy(entry)]));
  return value;
}

function recordLeaves(
  value: unknown,
  source: string,
  provenance: Record<string, string>,
  prefix: string,
): void {
  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value))
      recordLeaves(nested, source, provenance, prefix ? prefix + "." + key : key);
    return;
  }
  provenance[prefix] = source;
}

function merge(
  target: Record<string, unknown>,
  incoming: Record<string, unknown>,
  source: string,
  provenance: Record<string, string>,
  prefix = "",
): void {
  for (const [key, incomingValue] of Object.entries(incoming)) {
    const path = prefix ? prefix + "." + key : key;
    const targetValue = target[key];
    if (isRecord(targetValue) && isRecord(incomingValue)) {
      merge(targetValue, incomingValue, source, provenance, path);
      continue;
    }
    target[key] = copy(incomingValue);
    recordLeaves(incomingValue, source, provenance, path);
  }
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
